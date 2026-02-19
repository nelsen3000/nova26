// Tests for Consolidation Pipeline
// KIMI-MEMORY-02

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConsolidationPipeline,
  type BuildEventLog,
  type ExtractionPromptResult,
} from './consolidation-pipeline.js';
import { AgentMemoryStore, type AgentMemory } from './agent-memory.js';

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  const mockStmt = {
    run: vi.fn(() => ({ changes: 1 })),
    get: vi.fn(),
    all: vi.fn(() => []),
  };

  const mockDb = {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn(() => mockStmt),
    close: vi.fn(),
  };

  return {
    default: vi.fn(function() { return mockDb; }),
  };
});

describe('ConsolidationPipeline', () => {
  let store: AgentMemoryStore;
  let pipeline: ConsolidationPipeline;
  let mockEmbeddingFn: ReturnType<typeof vi.fn>;
  let mockExtractionFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new AgentMemoryStore({ dbPath: ':memory:' });
    
    mockEmbeddingFn = vi.fn((text: string) => Promise.resolve([0.1, 0.2, 0.3]));
    mockExtractionFn = vi.fn(() => Promise.resolve({ memories: [] }));
    
    pipeline = new ConsolidationPipeline(store, mockEmbeddingFn, mockExtractionFn);
  });

  function createMockEventLog(): BuildEventLog {
    return {
      buildId: 'build-1',
      projectId: 'project-1',
      tasks: [
        {
          taskId: 'task-1',
          agentName: 'MERCURY',
          description: 'Implement auth',
          output: 'Auth implemented successfully',
          outcome: 'success',
          aceScore: 85,
        },
      ],
      userInterventions: [],
      buildSummary: 'Build completed successfully',
      buildOutcome: 'success',
      startedAt: '2024-01-01T00:00:00Z',
      completedAt: '2024-01-01T01:00:00Z',
    };
  }

  describe('consolidate', () => {
    it('extracts memories from build event log', async () => {
      const eventLog = createMockEventLog();
      const extractionResult: ExtractionPromptResult = {
        memories: [
          {
            type: 'episodic',
            content: 'User prefers JWT tokens',
            outcome: 'positive',
            agentsInvolved: ['MERCURY'],
            tags: ['auth', 'preference'],
          },
          {
            type: 'episodic',
            content: 'Error handling pattern worked well',
            outcome: 'positive',
            agentsInvolved: ['MERCURY'],
            tags: ['error-handling'],
          },
          {
            type: 'semantic',
            content: 'User likes secure auth',
            outcome: 'positive',
            agentsInvolved: ['MERCURY'],
            tags: ['auth'],
          },
        ],
      };

      mockExtractionFn.mockResolvedValueOnce(extractionResult);

      const result = await pipeline.consolidate(eventLog);

      expect(result.memoriesExtracted).toBe(3);
      expect(result.newMemoryIds).toHaveLength(3);
    });

    it('computes embeddings for each candidate', async () => {
      const eventLog = createMockEventLog();
      mockExtractionFn.mockResolvedValueOnce({
        memories: [
          { type: 'episodic', content: 'Memory 1', outcome: 'positive', agentsInvolved: ['MERCURY'], tags: [] },
          { type: 'episodic', content: 'Memory 2', outcome: 'positive', agentsInvolved: ['MERCURY'], tags: [] },
        ],
      });

      await pipeline.consolidate(eventLog);

      expect(mockEmbeddingFn).toHaveBeenCalledTimes(2);
      expect(mockEmbeddingFn).toHaveBeenCalledWith('Memory 1');
      expect(mockEmbeddingFn).toHaveBeenCalledWith('Memory 2');
    });

    it('enforces max extraction count', async () => {
      const eventLog = createMockEventLog();
      const manyMemories = Array.from({ length: 12 }, (_, i) => ({
        type: 'episodic' as const,
        content: `Memory ${i}`,
        outcome: 'positive' as const,
        agentsInvolved: ['MERCURY'],
        tags: [],
      }));

      mockExtractionFn.mockResolvedValueOnce({ memories: manyMemories });

      const result = await pipeline.consolidate(eventLog);

      // Should be capped at maxMemoriesPerExtraction (8)
      expect(result.memoriesExtracted).toBeLessThanOrEqual(8);
    });

    it('returns correct ConsolidationResult stats', async () => {
      const eventLog = createMockEventLog();
      mockExtractionFn.mockResolvedValueOnce({
        memories: [
          { type: 'episodic', content: 'Test', outcome: 'positive', agentsInvolved: ['MERCURY'], tags: [] },
        ],
      });

      const result = await pipeline.consolidate(eventLog);

      expect(result.buildId).toBe('build-1');
      expect(result.consolidatedAt).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.memoriesExtracted).toBe(1);
      expect(result.newMemoryIds).toHaveLength(1);
    });
  });

  describe('deduplicate', () => {
    it('finds duplicate above threshold', () => {
      // Insert a memory first
      const mockDb = (store as any).db;
      const existingMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Existing memory',
        embedding: Buffer.from(new Float32Array([0.1, 0.2, 0.3]).buffer),
        agents_involved: '[]',
        outcome: 'positive',
        relevance_score: 0.9,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 0,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        tags: '[]',
        extra_json: '{}',
      };

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [existingMemory]),
      });

      // Same embedding should have similarity 1.0 > 0.82 threshold
      const duplicate = pipeline.deduplicate([0.1, 0.2, 0.3], 'episodic');

      expect(duplicate).toBeDefined();
    });

    it('does not deduplicate below threshold', () => {
      const mockDb = (store as any).db;
      const existingMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Existing memory',
        embedding: Buffer.from(new Float32Array([1, 0, 0]).buffer), // Orthogonal to [0, 1, 0]
        agents_involved: '[]',
        outcome: 'positive',
        relevance_score: 0.9,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 0,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        tags: '[]',
        extra_json: '{}',
      };

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [existingMemory]),
      });

      const duplicate = pipeline.deduplicate([0, 1, 0], 'episodic');

      expect(duplicate).toBeNull();
    });
  });

  describe('merge', () => {
    it('averages relevanceScore on merge', () => {
      const mockDb = (store as any).db;
      const existingMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Existing',
        embedding: Buffer.from(new Float32Array([0.1]).buffer),
        agents_involved: '[]',
        outcome: 'positive',
        relevance_score: 0.8,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 5,
        last_accessed_at: '2024-01-01',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        tags: '[]',
        extra_json: '{}',
      };

      const updatedMemory = {
        ...existingMemory,
        relevance_score: 0.9, // (0.8 + 1.0) / 2
      };

      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn(() => existingMemory) })
        .mockReturnValueOnce({ run: vi.fn(() => ({ changes: 1 })) })
        .mockReturnValueOnce({ get: vi.fn(() => updatedMemory) });

      const existing: AgentMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Existing',
        embedding: [0.1],
        agentsInvolved: [],
        outcome: 'positive',
        relevanceScore: 0.8,
        isPinned: false,
        isSuppressed: false,
        accessCount: 5,
        lastAccessedAt: '2024-01-01',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        tags: [],
      };

      const result = pipeline.merge(existing, {
        content: 'New content',
        outcome: 'positive',
        sourceEventIds: ['build-2'],
      });

      expect(result.relevanceScore).toBe(0.9);
    });

    it('replaces content when candidate is more detailed', () => {
      const mockDb = (store as any).db;
      const existingMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Short',
        embedding: Buffer.from(new Float32Array([0.1]).buffer),
        agents_involved: '[]',
        outcome: 'positive',
        relevance_score: 0.8,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 0,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        tags: '[]',
        extra_json: '{}',
      };

      const updatedMemory = {
        ...existingMemory,
        content: 'This is a much longer and more detailed content',
      };

      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn(() => existingMemory) })
        .mockReturnValueOnce({ run: vi.fn(() => ({ changes: 1 })) })
        .mockReturnValueOnce({ get: vi.fn(() => updatedMemory) });

      const existing: AgentMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Short',
        embedding: [0.1],
        agentsInvolved: [],
        outcome: 'positive',
        relevanceScore: 0.8,
        isPinned: false,
        isSuppressed: false,
        accessCount: 0,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        tags: [],
      };

      const result = pipeline.merge(existing, {
        content: 'This is a much longer and more detailed content',
        outcome: 'positive',
      });

      expect(result.content).toBe('This is a much longer and more detailed content');
    });

    it('keeps content when existing is more detailed', () => {
      const mockDb = (store as any).db;
      const existingMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'This is a much longer and more detailed existing content',
        embedding: Buffer.from(new Float32Array([0.1]).buffer),
        agents_involved: '[]',
        outcome: 'positive',
        relevance_score: 0.8,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 0,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        tags: '[]',
        extra_json: '{}',
      };

      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn(() => existingMemory) })
        .mockReturnValueOnce({ run: vi.fn(() => ({ changes: 1 })) })
        .mockReturnValueOnce({ get: vi.fn(() => existingMemory) });

      const existing: AgentMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'This is a much longer and more detailed existing content',
        embedding: [0.1],
        agentsInvolved: [],
        outcome: 'positive',
        relevanceScore: 0.8,
        isPinned: false,
        isSuppressed: false,
        accessCount: 0,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        tags: [],
      };

      const result = pipeline.merge(existing, {
        content: 'Short',
        outcome: 'positive',
      });

      expect(result.content).toBe('This is a much longer and more detailed existing content');
    });
  });

  describe('compress', () => {
    it('does not run on wrong cycle', async () => {
      const result = await pipeline.compress(5); // cycle 5, interval 10

      expect(result.compressed).toBe(0);
      expect(result.deleted).toBe(0);
    });

    it('runs on correct cycle', async () => {
      const result = await pipeline.compress(10); // cycle 10, interval 10

      // Just verify it runs without error (no memories to compress in empty store)
      expect(result).toBeDefined();
    });
  });

  describe('isLandmark', () => {
    it('identifies landmark by critical-failure tag', () => {
      const memory: AgentMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Critical failure occurred',
        embedding: [0.1],
        agentsInvolved: ['MERCURY'],
        outcome: 'negative',
        relevanceScore: 0.2,
        isPinned: false,
        isSuppressed: false,
        accessCount: 1,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        tags: ['critical-failure', 'auth'],
      };

      expect(pipeline.isLandmark(memory)).toBe(true);
    });

    it('identifies landmark by data-loss tag', () => {
      const memory: AgentMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Data loss occurred',
        embedding: [0.1],
        agentsInvolved: ['MERCURY'],
        outcome: 'negative',
        relevanceScore: 0.2,
        isPinned: false,
        isSuppressed: false,
        accessCount: 1,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        tags: ['data-loss'],
      };

      expect(pipeline.isLandmark(memory)).toBe(true);
    });

    it('identifies landmark by negative outcome when only record for project', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => []), // No other memories with same tags
      });

      const memory: AgentMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Failure in project',
        embedding: [0.1],
        projectId: 'project-1',
        agentsInvolved: ['MERCURY'],
        outcome: 'negative',
        relevanceScore: 0.2,
        isPinned: false,
        isSuppressed: false,
        accessCount: 1,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        tags: ['specific-issue'],
      };

      expect(pipeline.isLandmark(memory)).toBe(true);
    });

    it('does not identify positive outcomes as landmarks', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
      });

      const memory: AgentMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Success',
        embedding: [0.1],
        projectId: 'project-1',
        agentsInvolved: ['MERCURY'],
        outcome: 'positive',
        relevanceScore: 0.2,
        isPinned: false,
        isSuppressed: false,
        accessCount: 1,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        tags: ['issue'],
      };

      expect(pipeline.isLandmark(memory)).toBe(false);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];

      const similarity = pipeline.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];

      const similarity = pipeline.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('returns 0 for empty vectors', () => {
      const a: number[] = [];
      const b: number[] = [];

      const similarity = pipeline.cosineSimilarity(a, b);

      expect(similarity).toBe(0);
    });

    it('returns 0 for zero vectors', () => {
      const a = [0, 0, 0];
      const b = [0, 0, 0];

      const similarity = pipeline.cosineSimilarity(a, b);

      expect(similarity).toBe(0);
    });
  });
});
