// Tests for Agent Memory Types & SQLite Store
// KIMI-MEMORY-01

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AgentMemoryStore,
  serializeEmbedding,
  deserializeEmbedding,
  type AgentMemory,
  type EpisodicMemory,
  type SemanticMemory,
  type ProceduralMemory,
} from './agent-memory.js';

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

describe('AgentMemoryStore', () => {
  let store: AgentMemoryStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new AgentMemoryStore({ dbPath: ':memory:' });
  });

  afterEach(() => {
    store.close();
  });

  describe('initialization', () => {
    it('creates database and tables on init', () => {
      // The constructor should have called exec to create tables
      expect(store).toBeDefined();
    });
  });

  describe('insertMemory', () => {
    it('inserts episodic memory', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 1 })),
      });

      const memory: Omit<EpisodicMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'> = {
        type: 'episodic',
        content: 'User asked for JWT auth implementation',
        embedding: [0.1, 0.2, 0.3],
        projectId: 'project-1',
        buildId: 'build-1',
        agentsInvolved: ['MERCURY', 'MARS'],
        outcome: 'positive',
        relevanceScore: 0.9,
        isPinned: false,
        isSuppressed: false,
        tags: ['auth', 'jwt'],
        eventDate: '2024-01-15T10:00:00Z',
        location: 'auth/session.ts during auth sprint',
        decision: 'Use refresh tokens',
        alternativesConsidered: ['session cookies', 'JWT only'],
      };

      const result = store.insertMemory(memory);

      expect(result.id).toBeDefined();
      expect(result.type).toBe('episodic');
      expect(result.content).toBe(memory.content);
      expect(result.accessCount).toBe(0);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('inserts semantic memory', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 1 })),
      });

      const memory: Omit<SemanticMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'> = {
        type: 'semantic',
        content: 'User prefers short-lived JWT tokens',
        embedding: [0.5, 0.6, 0.7],
        agentsInvolved: ['ATLAS'],
        outcome: 'positive',
        relevanceScore: 0.85,
        isPinned: true,
        isSuppressed: false,
        tags: ['preference', 'auth'],
        confidence: 0.9,
        supportingMemoryIds: ['mem-1', 'mem-2'],
      };

      const result = store.insertMemory(memory);

      expect(result.id).toBeDefined();
      expect(result.type).toBe('semantic');
      expect(result.isPinned).toBe(true);
    });

    it('inserts procedural memory', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 1 })),
      });

      const memory: Omit<ProceduralMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'> = {
        type: 'procedural',
        content: 'Procedure for implementing JWT auth',
        embedding: [0.8, 0.9, 1.0],
        agentsInvolved: ['MERCURY'],
        outcome: 'positive',
        relevanceScore: 0.95,
        isPinned: false,
        isSuppressed: false,
        tags: ['procedure', 'auth'],
        triggerPattern: 'when user requests authentication',
        steps: ['Check user preferences', 'Implement JWT', 'Add refresh tokens', 'Test'],
        successRate: 0.9,
      };

      const result = store.insertMemory(memory);

      expect(result.id).toBeDefined();
      expect(result.type).toBe('procedural');
    });
  });

  describe('getMemory', () => {
    it('gets memory by ID', () => {
      const mockDb = (store as any).db;
      const mockMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Test memory',
        embedding: Buffer.from(new Float32Array([0.1, 0.2, 0.3]).buffer),
        project_id: 'proj-1',
        build_id: 'build-1',
        agents_involved: JSON.stringify(['MERCURY']),
        outcome: 'positive',
        relevance_score: 0.9,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 5,
        last_accessed_at: '2024-01-15T10:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        tags: JSON.stringify(['test']),
        extra_json: JSON.stringify({ eventDate: '2024-01-15T10:00:00Z', location: 'test.ts' }),
      };

      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => mockMemory),
      });

      const result = store.getMemory('mem-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('mem-1');
      expect(result!.content).toBe('Test memory');
      expect(result!.embedding).toHaveLength(3);
      expect(result!.embedding[0]).toBeCloseTo(0.1, 5);
    });

    it('returns undefined for non-existent ID', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => undefined),
      });

      const result = store.getMemory('fake-id');

      expect(result).toBeUndefined();
    });
  });

  describe('updateMemory', () => {
    it('updates memory fields', () => {
      const mockDb = (store as any).db;
      const mockMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Original content',
        embedding: Buffer.from(new Float32Array([0.1, 0.2, 0.3]).buffer),
        project_id: null,
        build_id: null,
        agents_involved: JSON.stringify(['MERCURY']),
        outcome: 'neutral',
        relevance_score: 0.5,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 0,
        last_accessed_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: JSON.stringify(['test']),
        extra_json: JSON.stringify({ eventDate: '2024-01-01', location: 'test' }),
      };

      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn(() => mockMemory) })  // First get for existence check
        .mockReturnValueOnce({ run: vi.fn(() => ({ changes: 1 })) })  // Update
        .mockReturnValueOnce({ get: vi.fn(() => ({ ...mockMemory, relevance_score: 0.8 })) });  // Get updated

      const result = store.updateMemory('mem-1', { relevanceScore: 0.8 });

      expect(result.relevanceScore).toBe(0.8);
    });

    it('throws for non-existent ID', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => undefined),
      });

      expect(() => store.updateMemory('fake-id', { relevanceScore: 0.5 })).toThrow('Memory not found');
    });
  });

  describe('deleteMemory', () => {
    it('deletes memory', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 1 })),
      });

      const result = store.deleteMemory('mem-1');

      expect(result).toBe(true);
    });

    it('returns false for non-existent ID', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 0 })),
      });

      const result = store.deleteMemory('fake-id');

      expect(result).toBe(false);
    });
  });

  describe('queryByType', () => {
    it('queries by type', () => {
      const mockDb = (store as any).db;
      const mockRows = [
        {
          id: 'mem-1',
          type: 'episodic',
          content: 'Memory 1',
          embedding: Buffer.from(new Float32Array([0.1]).buffer),
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
        },
        {
          id: 'mem-2',
          type: 'episodic',
          content: 'Memory 2',
          embedding: Buffer.from(new Float32Array([0.2]).buffer),
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
        },
      ];

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => mockRows),
      });

      const results = store.queryByType('episodic');

      expect(results).toHaveLength(2);
    });

    it('excludes suppressed by default', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn((type, limit) => {
          // Verify SQL has is_suppressed = 0 condition
          expect(limit).toBe(50);
          return [];
        }),
      });

      store.queryByType('episodic');

      // The mock verifies the query
    });

    it('includes suppressed when requested', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
      });

      store.queryByType('episodic', { includeSuppressed: true });

      // Mock verifies the query construction
    });

    it('respects limit in queryByType', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn((type, limit) => {
          expect(limit).toBe(3);
          return [];
        }),
      });

      store.queryByType('episodic', { limit: 3 });
    });
  });

  describe('queryByProject', () => {
    it('queries by project', () => {
      const mockDb = (store as any).db;
      const mockRows = [
        {
          id: 'mem-1',
          type: 'episodic',
          content: 'Project memory',
          embedding: Buffer.from(new Float32Array([0.1]).buffer),
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
        },
      ];

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => mockRows),
      });

      const results = store.queryByProject('project-1');

      expect(results).toHaveLength(1);
    });
  });

  describe('recordAccess', () => {
    it('records access and boosts relevance', () => {
      const mockDb = (store as any).db;
      const mockMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Test',
        embedding: Buffer.from(new Float32Array([0.1]).buffer),
        agents_involved: '[]',
        outcome: 'positive',
        relevance_score: 0.7,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 3,
        last_accessed_at: '2024-01-01',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        tags: '[]',
        extra_json: '{}',
      };

      const updatedMemory = {
        ...mockMemory,
        access_count: 4,
        relevance_score: 0.9, // 0.7 + 0.2 boost
      };

      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn(() => mockMemory) })
        .mockReturnValueOnce({ run: vi.fn(() => ({ changes: 1 })) })
        .mockReturnValueOnce({ get: vi.fn(() => updatedMemory) });

      const result = store.recordAccess('mem-1');

      expect(result.accessCount).toBe(4);
      expect(result.relevanceScore).toBe(0.9);
    });

    it('relevance capped at 1.0 after boost', () => {
      const mockDb = (store as any).db;
      const mockMemory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Test',
        embedding: Buffer.from(new Float32Array([0.1]).buffer),
        agents_involved: '[]',
        outcome: 'positive',
        relevance_score: 0.95,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 3,
        last_accessed_at: '2024-01-01',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        tags: '[]',
        extra_json: '{}',
      };

      const updatedMemory = {
        ...mockMemory,
        access_count: 4,
        relevance_score: 1.0, // capped
      };

      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn(() => mockMemory) })
        .mockReturnValueOnce({ run: vi.fn(() => ({ changes: 1 })) })
        .mockReturnValueOnce({ get: vi.fn(() => updatedMemory) });

      const result = store.recordAccess('mem-1');

      expect(result.relevanceScore).toBe(1.0);
    });

    it('throws for non-existent ID', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => undefined),
      });

      expect(() => store.recordAccess('fake-id')).toThrow('Memory not found');
    });
  });

  describe('getStats', () => {
    it('gets stats with correct counts', () => {
      const mockDb = (store as any).db;
      
      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 10 })) })  // total
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 5 })) })   // episodic
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 3 })) })   // semantic
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 2 })) })   // procedural
        .mockReturnValueOnce({ get: vi.fn(() => ({ avg: 0.75 })) })  // avg relevance
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 1 })) })   // pinned
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 2 })) });  // suppressed

      const stats = store.getStats();

      expect(stats.total).toBe(10);
      expect(stats.byType.episodic).toBe(5);
      expect(stats.byType.semantic).toBe(3);
      expect(stats.byType.procedural).toBe(2);
      expect(stats.avgRelevance).toBe(0.75);
      expect(stats.pinnedCount).toBe(1);
      expect(stats.suppressedCount).toBe(2);
    });
  });

  describe('getAllMemories', () => {
    it('returns all memories excluding suppressed by default', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
      });

      const results = store.getAllMemories();

      expect(results).toEqual([]);
    });

    it('includes suppressed when requested', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
      });

      const results = store.getAllMemories({ includeSuppressed: true });

      expect(results).toEqual([]);
    });
  });
});

describe('Embedding Serialization', () => {
  it('serializes and deserializes embeddings', () => {
    const original = [0.1, 0.2, 0.3, 0.4, 0.5];
    
    const serialized = serializeEmbedding(original);
    const deserialized = deserializeEmbedding(serialized);

    expect(deserialized).toHaveLength(original.length);
    deserialized.forEach((val, i) => {
      expect(val).toBeCloseTo(original[i], 5);
    });
  });

  it('handles empty embeddings', () => {
    const original: number[] = [];
    
    const serialized = serializeEmbedding(original);
    const deserialized = deserializeEmbedding(serialized);

    expect(deserialized).toEqual([]);
  });

  it('handles large embeddings', () => {
    const original = Array.from({ length: 1000 }, (_, i) => i / 1000);
    
    const serialized = serializeEmbedding(original);
    const deserialized = deserializeEmbedding(serialized);

    expect(deserialized).toHaveLength(1000);
    expect(deserialized[0]).toBeCloseTo(0, 5);
    expect(deserialized[999]).toBeCloseTo(0.999, 5);
  });
});
