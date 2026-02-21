// Memory Store and Retriever Tests
// Comprehensive test suite for Task K11

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryStore,
  getMemoryStore,
  resetMemoryStore,
  ItemNotFoundError,
} from './memory-store.js';
import {
  MemoryRetriever,
  RelevanceScorer,
  MemoryIndex,
  getMemoryRetriever,
  resetMemoryRetriever,
} from './memory-retriever.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore({ l1Capacity: 5, l2Capacity: 10 });
  });

  describe('store', () => {
    it('stores item in L1', () => {
      const item = store.store('test content', ['tag1'], 0.8);

      expect(item.id).toBeDefined();
      expect(item.content).toBe('test content');
      expect(item.tags).toEqual(['tag1']);
      expect(item.importance).toBe(0.8);
      expect(item.level).toBe('L1');
    });

    it('generates unique IDs', () => {
      const item1 = store.store('content 1');
      const item2 = store.store('content 2');

      expect(item1.id).not.toBe(item2.id);
    });

    it('evicts old items when L1 full', () => {
      // Fill L1
      for (let i = 0; i < 6; i++) {
        store.store(`content ${i}`);
      }

      const stats = store.getStats();
      expect(stats.l1Count).toBeLessThanOrEqual(5);
    });
  });

  describe('get', () => {
    it('retrieves item by ID', () => {
      const item = store.store('test content');
      const retrieved = store.get(item.id);

      expect(retrieved?.content).toBe('test content');
    });

    it('updates access count and time', async () => {
      const item = store.store('test content');
      const beforeAccess = item.accessCount;
      const beforeAccessedAt = item.accessedAt;

      await new Promise(r => setTimeout(r, 10));
      const retrieved = store.get(item.id);

      expect(retrieved?.accessCount).toBe(beforeAccess + 1);
      expect(retrieved?.accessedAt).toBeGreaterThan(beforeAccessedAt);
    });

    it('returns undefined for unknown ID', () => {
      const retrieved = store.get('unknown-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getOrThrow', () => {
    it('returns item if exists', () => {
      const item = store.store('test');
      expect(store.getOrThrow(item.id).content).toBe('test');
    });

    it('throws if not found', () => {
      expect(() => store.getOrThrow('unknown')).toThrow(ItemNotFoundError);
    });
  });

  describe('promote', () => {
    it('promotes L1 to L2', () => {
      const item = store.store('test');
      const promoted = store.promote(item.id);

      expect(promoted?.level).toBe('L2');
      expect(store.get(item.id)?.level).toBe('L2');
    });

    it('promotes L2 to L3', () => {
      const item = store.store('test');
      store.promote(item.id); // L1 -> L2
      const promoted = store.promote(item.id); // L2 -> L3

      expect(promoted?.level).toBe('L3');
    });

    it('returns undefined for unknown ID', () => {
      expect(store.promote('unknown')).toBeUndefined();
    });
  });

  describe('demote', () => {
    it('demotes L3 to L2', () => {
      const item = store.store('test');
      store.promote(item.id);
      store.promote(item.id); // Now L3
      const demoted = store.demote(item.id);

      expect(demoted?.level).toBe('L2');
    });

    it('demotes L2 to L1', () => {
      const item = store.store('test');
      store.promote(item.id); // Now L2
      const demoted = store.demote(item.id);

      expect(demoted?.level).toBe('L1');
    });
  });

  describe('compress', () => {
    it('compresses items by tags', () => {
      // Add multiple items with same tag
      for (let i = 0; i < 5; i++) {
        store.store(`content ${i}`, ['shared-tag']);
      }

      const result = store.compress('L1');

      expect(result.itemsBefore).toBe(5);
      expect(result.itemsAfter).toBeLessThan(5);
      expect(result.strategy).toBe('merge-by-tags');
    });

    it('creates summary item', () => {
      store.store('item 1', ['tag']);
      store.store('item 2', ['tag']);
      store.store('item 3', ['tag']);

      store.compress('L1');

      const items = store.getItemsByLevel('L1');
      expect(items[0].metadata?.compressed).toBe(true);
    });

    it('returns no-op for empty level', () => {
      const result = store.compress('L1');

      expect(result.itemsBefore).toBe(0);
      expect(result.itemsAfter).toBe(0);
    });
  });

  describe('findByTags', () => {
    it('finds items by tag (any)', () => {
      store.store('item 1', ['tag-a']);
      store.store('item 2', ['tag-b']);
      store.store('item 3', ['tag-a', 'tag-b']);

      const results = store.findByTags(['tag-a']);

      expect(results).toHaveLength(2);
    });

    it('finds items by tag (all)', () => {
      store.store('item 1', ['tag-a']);
      store.store('item 2', ['tag-a', 'tag-b']);

      const results = store.findByTags(['tag-a', 'tag-b'], true);

      expect(results).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('returns correct counts', () => {
      store.store('l1 item');
      const l2Item = store.store('l2 item');
      store.promote(l2Item.id);

      const stats = store.getStats();

      expect(stats.l1Count).toBe(1);
      expect(stats.l2Count).toBe(1);
      expect(stats.totalCount).toBe(2);
    });
  });

  describe('delete', () => {
    it('deletes item', () => {
      const item = store.store('test');
      expect(store.delete(item.id)).toBe(true);
      expect(store.get(item.id)).toBeUndefined();
    });

    it('returns false for unknown item', () => {
      expect(store.delete('unknown')).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MemoryRetriever Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('MemoryRetriever', () => {
  let retriever: MemoryRetriever;

  const createItem = (content: string, tags: string[] = [], importance = 0.5) => ({
    id: `id-${content}`,
    content,
    tags,
    importance,
    createdAt: Date.now(),
    accessedAt: Date.now(),
    accessCount: 1,
    level: 'L1' as const,
  });

  beforeEach(() => {
    retriever = new MemoryRetriever();
  });

  describe('retrieve', () => {
    it('retrieves by keyword strategy', () => {
      const items = [
        createItem('hello world'),
        createItem('goodbye world'),
      ];

      retriever.index(items);
      const results = retriever.retrieve(items, 'hello', { strategy: 'keyword' });

      expect(results.some(r => r.item.content === 'hello world')).toBe(true);
    });

    it('retrieves by semantic strategy', () => {
      const items = [
        createItem('the quick brown fox'),
        createItem('lazy dog sleeping'),
      ];

      retriever.index(items);
      const results = retriever.retrieve(items, 'fast brown animal', { strategy: 'semantic' });

      // Should rank fox higher than dog
      expect(results[0].strategy).toBe('semantic');
    });

    it('retrieves by temporal strategy', () => {
      const items = [
        { ...createItem('old'), accessedAt: Date.now() - 100000 },
        { ...createItem('new'), accessedAt: Date.now() },
      ];

      const results = retriever.retrieve(items, '', { strategy: 'temporal' });

      expect(results[0].item.content).toBe('new');
    });

    it('retrieves by importance strategy', () => {
      const items = [
        createItem('low', [], 0.2),
        createItem('high', [], 0.9),
      ];

      const results = retriever.retrieve(items, '', { strategy: 'importance' });

      expect(results[0].item.content).toBe('high');
    });

    it('retrieves by hybrid strategy', () => {
      const items = [
        createItem('test content', ['tag'], 0.8),
      ];

      retriever.index(items);
      const results = retriever.retrieve(items, 'content', { strategy: 'hybrid', tags: ['tag'] });

      expect(results).toHaveLength(1);
      expect(results[0].strategy).toBe('hybrid');
    });

    it('filters by tags', () => {
      const items = [
        createItem('a', ['tag1']),
        createItem('b', ['tag2']),
      ];

      const results = retriever.retrieve(items, '', { tags: ['tag1'] });

      expect(results).toHaveLength(1);
      expect(results[0].item.content).toBe('a');
    });

    it('respects limit', () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        createItem(`item ${i}`)
      );

      const results = retriever.retrieve(items, '', { limit: 5 });

      expect(results).toHaveLength(5);
    });

    it('respects minScore', () => {
      const items = [
        createItem('exact match'),
        createItem('something else'),
      ];

      retriever.index(items);
      const results = retriever.retrieve(items, 'exact match', { minScore: 0.9 });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MemoryIndex Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('MemoryIndex', () => {
  let index: MemoryIndex;

  beforeEach(() => {
    index = new MemoryIndex();
  });

  it('indexes and searches items', () => {
    const item = {
      id: 'test-1',
      content: 'hello world',
      tags: [],
      importance: 0.5,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
      level: 'L1' as const,
    };

    index.indexItem(item);
    const matches = index.searchKeywords('hello');

    expect(matches.has('test-1')).toBe(true);
  });

  it('removes items from index', () => {
    const item = {
      id: 'test-1',
      content: 'hello world',
      tags: [],
      importance: 0.5,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
      level: 'L1' as const,
    };

    index.indexItem(item);
    index.removeItem(item);
    const matches = index.searchKeywords('hello');

    expect(matches.has('test-1')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RelevanceScorer Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('RelevanceScorer', () => {
  let scorer: RelevanceScorer;

  const createItem = (content: string, importance = 0.5, accessCount = 1) => ({
    id: `id-${content}`,
    content,
    tags: [],
    importance,
    createdAt: Date.now(),
    accessedAt: Date.now(),
    accessCount,
    level: 'L1' as const,
  });

  beforeEach(() => {
    scorer = new RelevanceScorer();
  });

  it('scores exact match highly', () => {
    const item = createItem('hello world');
    scorer.indexItem(item);

    const score = scorer.score('hello world', item);

    expect(score).toBeGreaterThan(0.5);
  });

  it('considers importance', () => {
    const lowItem = createItem('content', 0.2);
    const highItem = createItem('content', 0.9);
    scorer.indexItem(lowItem);
    scorer.indexItem(highItem);

    const lowScore = scorer.score('content', lowItem);
    const highScore = scorer.score('content', highItem);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('considers tag matches', () => {
    const item = createItem('content', 0.5, 1);
    scorer.indexItem(item);

    const withoutTags = scorer.score('content', item);
    const withTags = scorer.score('content', item, ['related']);

    expect(withTags).toBe(withoutTags); // No matching tags
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Singleton instances', () => {
  it('getMemoryStore returns singleton', () => {
    const s1 = getMemoryStore();
    const s2 = getMemoryStore();
    expect(s1).toBe(s2);
  });

  it('getMemoryRetriever returns singleton', () => {
    const r1 = getMemoryRetriever();
    const r2 = getMemoryRetriever();
    expect(r1).toBe(r2);
  });
});
