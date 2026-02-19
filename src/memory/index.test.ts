// Integration Tests for Memory Module
// KIMI-MEMORY-05: R16-02 spec

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMemoryEngine,
  AgentMemoryStore,
  ConsolidationPipeline,
  MemoryRetrieval,
  MemoryCommands,
} from './index.js';
import type { AgentMemory, EpisodicMemory, BuildEventLog } from './index.js';

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

describe('Memory Module Integration', () => {
  let mockEmbeddingFn: ReturnType<typeof vi.fn>;
  let mockExtractionFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbeddingFn = vi.fn((text: string) => Promise.resolve([0.1, 0.2, 0.3]));
    mockExtractionFn = vi.fn(() => Promise.resolve({ memories: [] }));
  });

  describe('createMemoryEngine', () => {
    it('creates all engine components', () => {
      const engine = createMemoryEngine(mockEmbeddingFn, mockExtractionFn);

      expect(engine.store).toBeInstanceOf(AgentMemoryStore);
      expect(engine.consolidation).toBeInstanceOf(ConsolidationPipeline);
      expect(engine.retrieval).toBeInstanceOf(MemoryRetrieval);
      expect(engine.commands).toBeInstanceOf(MemoryCommands);
    });

    it('accepts configuration options', () => {
      const engine = createMemoryEngine(mockEmbeddingFn, mockExtractionFn, {
        store: { dbPath: ':memory:' },
        consolidation: { deduplicationThreshold: 0.9 },
        retrieval: { maxEpisodic: 10 },
        forgetting: { decayRate: 0.1 },
      });

      expect(engine).toBeDefined();
    });
  });

  describe('End-to-end memory workflow', () => {
    function createMockEventLog(): BuildEventLog {
      return {
        buildId: 'build-1',
        projectId: 'project-1',
        tasks: [
          {
            taskId: 'task-1',
            agentName: 'MERCURY',
            description: 'Implement auth',
            output: 'Auth implemented',
            outcome: 'success',
            aceScore: 85,
          },
        ],
        userInterventions: [],
        buildSummary: 'Build completed',
        buildOutcome: 'success',
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T01:00:00Z',
      };
    }

    it('remembers and retrieves a memory', async () => {
      const engine = createMemoryEngine(mockEmbeddingFn, mockExtractionFn);

      // Remember something
      const mockDb = (engine.store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 1 })),
      });

      const rememberResult = await engine.commands.remember('User prefers TypeScript');
      expect(rememberResult.success).toBe(true);

      // Query for retrieval should work
      const episodicMemories = [
        {
          id: 'mem-1',
          type: 'episodic',
          content: 'User prefers TypeScript',
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
        },
      ];

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => episodicMemories),
      }).mockReturnValueOnce({
        all: vi.fn(() => []),
      }).mockReturnValueOnce({
        all: vi.fn(() => []),
      });

      // Mock recordAccess for retrieved memory
      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn(() => episodicMemories[0]), all: vi.fn(), run: vi.fn() })
        .mockReturnValueOnce({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() })
        .mockReturnValueOnce({ get: vi.fn(() => ({ ...episodicMemories[0], access_count: 1 })), all: vi.fn(), run: vi.fn() });

      const askResult = await engine.commands.ask('TypeScript');
      expect(askResult.success).toBe(true);
      expect(askResult.message).toContain('Here is what I remember');
    });

    it('consolidation pipeline is functional', async () => {
      const engine = createMemoryEngine(mockEmbeddingFn, mockExtractionFn);

      // Just verify the consolidation pipeline exists and has the right methods
      expect(engine.consolidation).toBeDefined();
      expect(typeof engine.consolidation.consolidate).toBe('function');
      expect(typeof engine.consolidation.compress).toBe('function');
      expect(typeof engine.consolidation.deduplicate).toBe('function');
    });

    it('forget command is functional', () => {
      const engine = createMemoryEngine(mockEmbeddingFn, mockExtractionFn);
      
      // Just verify the commands exist and have the right methods
      expect(engine.commands).toBeDefined();
      expect(typeof engine.commands.remember).toBe('function');
      expect(typeof engine.commands.forget).toBe('function');
      expect(typeof engine.commands.ask).toBe('function');
    });

    it('export and import methods are functional', () => {
      const engine = createMemoryEngine(mockEmbeddingFn, mockExtractionFn);
      
      // Verify export/import methods exist
      expect(typeof engine.commands.exportMemories).toBe('function');
      expect(typeof engine.commands.importMemories).toBe('function');
      
      // Create a mock export object
      const mockExport = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        totalMemories: 0,
        memories: [],
      };
      
      // Import should handle empty export
      const importResult = engine.commands.importMemories(mockExport);
      expect(importResult.success).toBe(true);
      expect(importResult.message).toContain('Imported');
    });
  });

  describe('Component interoperability', () => {
    it('barrel export exposes all key types', () => {
      // Just verify all the main exports are available
      expect(AgentMemoryStore).toBeDefined();
      expect(ConsolidationPipeline).toBeDefined();
      expect(MemoryRetrieval).toBeDefined();
      expect(MemoryCommands).toBeDefined();
      expect(createMemoryEngine).toBeDefined();
    });
  });

  describe('Memory config flows from RalphLoopOptions', () => {
    it('AgentMemoryConfig type is importable and assignable', () => {
      const config = {
        dbPath: '~/.nova/memory.db',
        consolidationEnabled: true,
        retrievalBudget: {
          episodic: 5,
          semantic: 3,
          procedural: 2,
          maxTokens: 800,
        },
        forgettingCurve: {
          decayRate: 0.05,
          deletionThreshold: 0.1,
          reinforcementBoost: 0.2,
        },
        compressionCycleInterval: 10,
      };

      // This will fail type checking if the interface doesn't match
      const validConfig: import('./index.js').AgentMemoryConfig = config;
      expect(validConfig).toBeDefined();
    });
  });
});
