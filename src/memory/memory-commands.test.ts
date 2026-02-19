// Tests for Explicit Memory Interface & CLI
// KIMI-MEMORY-04

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryCommands } from './memory-commands.js';
import { AgentMemoryStore, type AgentMemory } from './agent-memory.js';
import { MemoryRetrieval } from './memory-retrieval.js';

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

describe('MemoryCommands', () => {
  let store: AgentMemoryStore;
  let retrieval: MemoryRetrieval;
  let commands: MemoryCommands;
  let mockEmbeddingFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new AgentMemoryStore({ dbPath: ':memory:' });
    mockEmbeddingFn = vi.fn((text: string) => Promise.resolve([0.1, 0.2, 0.3]));
    retrieval = new MemoryRetrieval(store, mockEmbeddingFn);
    commands = new MemoryCommands(store, mockEmbeddingFn, retrieval);
  });

  describe('remember', () => {
    it('creates pinned semantic memory', async () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 1 })),
      });

      const result = await commands.remember('User prefers TypeScript');

      expect(result.success).toBe(true);
      expect(result.command).toBe('remember');
      expect(result.message).toContain('Remembered');
      expect(result.message).toContain('pinned');
    });

    it('embeds the text', async () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 1 })),
      });

      await commands.remember('Test memory');

      expect(mockEmbeddingFn).toHaveBeenCalledWith('Test memory');
    });

    it('returns success message with content preview', async () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 1 })),
      });

      const result = await commands.remember('Short text');

      expect(result.message).toContain('Short text');
    });

    it('accepts custom tags', async () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        run: vi.fn(() => ({ changes: 1 })),
      });

      const result = await commands.remember('Test', ['custom', 'tags']);

      expect(result.success).toBe(true);
    });
  });

  describe('forget', () => {
    it('suppresses matching memory', async () => {
      const mockDb = (store as any).db;
      const memories = [
        {
          id: 'mem-1',
          type: 'semantic',
          content: 'User prefers TypeScript over JavaScript',
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
          extra_json: JSON.stringify({ confidence: 0.9, supportingMemoryIds: [] }),
        },
      ];

      // Mock getAllMemories + updateMemory
      mockDb.prepare
        .mockReturnValueOnce({ all: vi.fn(() => memories), get: vi.fn(), run: vi.fn() })  // getAllMemories
        .mockReturnValueOnce({ get: vi.fn(() => memories[0]), all: vi.fn(), run: vi.fn() })  // getMemory (check)
        .mockReturnValueOnce({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() })  // UPDATE
        .mockReturnValueOnce({ get: vi.fn(() => ({ ...memories[0], is_suppressed: 1 })), all: vi.fn(), run: vi.fn() });  // getMemory (return)

      const result = await commands.forget('TypeScript preference');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Forgot');
    });

    it('returns failure when no match', async () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => []), // No memories
      });

      const result = await commands.forget('Something that does not exist');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No matching memory');
    });

    it('requires similarity > 0.5', async () => {
      const mockDb = (store as any).db;
      const memories = [
        {
          id: 'mem-1',
          type: 'semantic',
          content: 'Something completely different',
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
        },
      ];

      // Override embedding to return orthogonal vector
      mockEmbeddingFn.mockResolvedValueOnce([0, 1, 0]);

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => memories),
      });

      const result = await commands.forget('TypeScript');

      expect(result.success).toBe(false);
    });
  });

  describe('ask', () => {
    it('returns episodic memories only', async () => {
      const mockDb = (store as any).db;
      const memories = [
        {
          id: 'mem-1',
          type: 'episodic',
          content: 'User asked for dark mode',
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
          extra_json: JSON.stringify({ eventDate: '2024-01-01', location: 'test' }),
        },
      ];

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => memories),
      });

      const result = await commands.ask('dark mode');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Here is what I remember');
    });

    it('formats natural language summary', async () => {
      const mockDb = (store as any).db;
      const memories = [
        {
          id: 'mem-1',
          type: 'episodic',
          content: 'Test memory content',
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
          extra_json: JSON.stringify({ eventDate: '2024-01-01', location: 'test' }),
        },
      ];

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => memories),
      });

      const result = await commands.ask('test');

      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('list', () => {
    it('returns memories with truncated content', () => {
      const mockDb = (store as any).db;
      const longContent = 'A'.repeat(100);
      const memories = [
        {
          id: 'mem-1',
          type: 'episodic',
          content: longContent,
          embedding: Buffer.from(new Float32Array([0.1]).buffer),
          agents_involved: '[]',
          outcome: 'positive',
          relevance_score: 0.9,
          is_pinned: 0,
          is_suppressed: 0,
          access_count: 5,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          tags: '[]',
          extra_json: '{}',
        },
      ];

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => memories),
      });

      const result = commands.list();

      expect(result[0].content).toContain('...');
      expect(result[0].content.length).toBeLessThanOrEqual(80);
    });

    it('filters by type', () => {
      const mockDb = (store as any).db;
      const episodic = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Episodic memory',
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
      };
      const semantic = {
        id: 'mem-2',
        type: 'semantic',
        content: 'Semantic memory',
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

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [episodic]),
      });

      const result = commands.list({ type: 'episodic' });

      expect(result.every(m => m.type === 'episodic')).toBe(true);
    });

    it('respects limit', () => {
      const mockDb = (store as any).db;
      const memories = Array.from({ length: 30 }, (_, i) => ({
        id: `mem-${i}`,
        type: 'episodic',
        content: `Memory ${i}`,
        embedding: Buffer.from(new Float32Array([0.1]).buffer),
        agents_involved: '[]',
        outcome: 'positive',
        relevance_score: 0.9 - i * 0.01,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 0,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        tags: '[]',
        extra_json: '{}',
      }));

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => memories),
      });

      const result = commands.list({ limit: 10 });

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe('show', () => {
    it('returns full memory', () => {
      const mockDb = (store as any).db;
      const memory = {
        id: 'mem-1',
        type: 'episodic',
        content: 'Full content',
        embedding: Buffer.from(new Float32Array([0.1]).buffer),
        agents_involved: '[]',
        outcome: 'positive',
        relevance_score: 0.9,
        is_pinned: 0,
        is_suppressed: 0,
        access_count: 5,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        tags: '[]',
        extra_json: '{}',
      };

      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => memory),
      });

      const result = commands.show('mem-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('mem-1');
      expect(result!.content).toBe('Full content');
    });

    it('returns undefined for non-existent ID', () => {
      const mockDb = (store as any).db;
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => undefined),
      });

      const result = commands.show('fake-id');

      expect(result).toBeUndefined();
    });
  });

  describe('stats', () => {
    it('returns correct counts', () => {
      const mockDb = (store as any).db;

      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 10 })) })  // total
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 5 })) })   // episodic
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 3 })) })   // semantic
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 2 })) })   // procedural
        .mockReturnValueOnce({ get: vi.fn(() => ({ avg: 0.75 })) })  // avg relevance
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 1 })) })   // pinned
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 2 })) });  // suppressed

      const result = commands.stats();

      expect(result.total).toBe(10);
      expect(result.byType.episodic).toBe(5);
      expect(result.byType.semantic).toBe(3);
      expect(result.byType.procedural).toBe(2);
      expect(result.avgRelevance).toBe(0.75);
      expect(result.pinnedCount).toBe(1);
      expect(result.suppressedCount).toBe(2);
    });
  });

  describe('exportMemories', () => {
    it('includes all memories', () => {
      const mockDb = (store as any).db;
      const memories = [
        {
          id: 'mem-1',
          type: 'episodic',
          content: 'Memory 1',
          embedding: Buffer.from(new Float32Array([0.1]).buffer),
          agents_involved: '[]',
          outcome: 'positive',
          relevance_score: 0.9,
          is_pinned: 0,
          is_suppressed: 1, // Suppressed
          access_count: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          tags: '[]',
          extra_json: '{}',
        },
        {
          id: 'mem-2',
          type: 'semantic',
          content: 'Memory 2',
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
        },
      ];

      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => memories),
      });

      const result = commands.exportMemories();

      expect(result.version).toBe('1.0.0');
      expect(result.totalMemories).toBe(2);
      expect(result.memories).toHaveLength(2);
    });
  });

  describe('formatAge', () => {
    it('seconds ago → "just now"', () => {
      const now = new Date().toISOString();
      const result = commands.formatAge(now);
      expect(result).toBe('just now');
    });

    it('2 days ago → "2 days ago"', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const result = commands.formatAge(twoDaysAgo);
      expect(result).toBe('2 days ago');
    });

    it('1 minute ago → "1 minute ago"', () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const result = commands.formatAge(oneMinuteAgo);
      expect(result).toBe('1 minute ago');
    });

    it('1 hour ago → "1 hour ago"', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const result = commands.formatAge(oneHourAgo);
      expect(result).toBe('1 hour ago');
    });
  });
});
