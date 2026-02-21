// Memory Compressor Tests
// Test suite for Task K12

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryCompressor,
  getMemoryCompressor,
  resetMemoryCompressor,
  mergeStrategy,
  summarizeStrategy,
  pruneStrategy,
} from './memory-compressor.js';
import type { MemoryItem } from './memory-store.js';

describe('MemoryCompressor', () => {
  let compressor: MemoryCompressor;

  const createItem = (
    content: string,
    tags: string[] = [],
    importance = 0.5,
    level: MemoryItem['level'] = 'L1'
  ): MemoryItem => ({
    id: `id-${content}`,
    content,
    tags,
    importance,
    createdAt: Date.now(),
    accessedAt: Date.now(),
    accessCount: 1,
    level,
  });

  beforeEach(() => {
    compressor = new MemoryCompressor();
  });

  describe('compress', () => {
    it('compresses with merge strategy', () => {
      const items = [
        createItem('hello world today'),
        createItem('hello world tomorrow'),
        createItem('completely different'),
      ];

      const { compressed, freed } = compressor.compress(items, 'L1', {
        strategy: 'merge',
      });

      expect(compressed.length).toBeLessThan(items.length);
      expect(freed).toBeGreaterThan(0);
    });

    it('compresses with summarize strategy', () => {
      const items = [
        createItem('item 1', ['tag-a']),
        createItem('item 2', ['tag-a']),
        createItem('item 3', ['tag-a']),
      ];

      const { compressed } = compressor.compress(items, 'L1', {
        strategy: 'summarize',
      });

      expect(compressed.length).toBeLessThan(items.length);
      expect(compressed[0].metadata?.compressed).toBe(true);
    });

    it('compresses with prune strategy', () => {
      const oldItem = createItem('old', [], 0.1);
      oldItem.accessedAt = Date.now() - 100000000; // Very old
      oldItem.accessCount = 1;

      const newItem = createItem('new', [], 0.8);

      const items = [oldItem, newItem];

      const { compressed } = compressor.compress(items, 'L2', {
        strategy: 'prune',
      });

      expect(compressed.length).toBeLessThan(items.length);
    });

    it('archives with archive strategy', () => {
      const items = [createItem('test')];

      const { compressed } = compressor.compress(items, 'L3', {
        strategy: 'archive',
      });

      expect(compressed).toHaveLength(0);
    });

    it('records compression history', () => {
      const items = [createItem('test')];
      compressor.compress(items, 'L1', { strategy: 'summarize' });

      const history = compressor.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].level).toBe('L1');
      expect(history[0].strategy).toBe('summarize');
    });
  });

  describe('archive operations', () => {
    it('archives items', () => {
      const items = [
        createItem('item 1'),
        createItem('item 2'),
      ];

      const archiveId = compressor.archiveItems(items, 'test-reason');

      expect(archiveId).toBeDefined();
      expect(compressor.getArchiveStats().totalArchives).toBe(1);
    });

    it('searches archive', () => {
      const items = [createItem('hello world')];
      compressor.archiveItems(items, 'test');

      const results = compressor.searchArchive('hello');

      expect(results).toHaveLength(1);
    });

    it('decompresses archive', () => {
      const items = [createItem('test', [], 0.5, 'L1')];
      const archiveId = compressor.archiveItems(items, 'test');

      const restored = compressor.decompressArchive(archiveId);

      expect(restored).toHaveLength(1);
      expect(restored![0].level).toBe('L3');
      expect(restored![0].metadata?.restored).toBe(true);
    });

    it('returns undefined for unknown archive', () => {
      const restored = compressor.decompressArchive('unknown');
      expect(restored).toBeUndefined();
    });
  });

  describe('history', () => {
    it('filters history by level', () => {
      compressor.compress([createItem('test')], 'L1', { strategy: 'summarize' });
      compressor.compress([createItem('test')], 'L2', { strategy: 'prune' });

      const l1History = compressor.getHistory('L1');
      expect(l1History).toHaveLength(1);
      expect(l1History[0].level).toBe('L1');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Strategy Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Compression Strategies', () => {
  const createItem = (content: string, tags: string[] = []): MemoryItem => ({
    id: `id-${content}`,
    content,
    tags,
    importance: 0.5,
    createdAt: Date.now(),
    accessedAt: Date.now(),
    accessCount: 1,
    level: 'L1',
  });

  describe('mergeStrategy', () => {
    it('merges similar items', () => {
      const items = [
        createItem('hello world today'),
        createItem('hello world tomorrow'),
        createItem('goodbye moon'),
      ];

      const merged = mergeStrategy(items);

      expect(merged.length).toBeLessThan(items.length);
    });

    it('keeps unique items', () => {
      const items = [
        createItem('apple banana cherry'),
        createItem('delta echo foxtrot'),
      ];

      const merged = mergeStrategy(items);

      expect(merged.length).toBe(2);
    });
  });

  describe('summarizeStrategy', () => {
    it('summarizes by tags', () => {
      const items = [
        createItem('item 1', ['tag-a']),
        createItem('item 2', ['tag-a']),
        createItem('item 3', ['tag-b']),
      ];

      const summarized = summarizeStrategy(items);

      expect(summarized.length).toBeLessThanOrEqual(items.length);
    });

    it('keeps small groups as-is', () => {
      const items = [
        createItem('item 1', ['tag-a']),
        createItem('item 2', ['tag-b']),
      ];

      const summarized = summarizeStrategy(items);

      expect(summarized.length).toBe(2);
    });
  });

  describe('pruneStrategy', () => {
    it('prunes stale items', () => {
      const oldItem = createItem('old');
      oldItem.accessedAt = Date.now() - 100000000;
      oldItem.accessCount = 1;

      const newItem = createItem('new');

      const { kept, pruned } = pruneStrategy([oldItem, newItem]);

      expect(pruned.length).toBeGreaterThan(0);
      expect(kept.length).toBeLessThan(2);
    });

    it('prunes unimportant items', () => {
      const unimportant = createItem('low');
      unimportant.importance = 0.1;
      unimportant.accessCount = 1;

      const important = createItem('high');
      important.importance = 0.9;

      const { kept, pruned } = pruneStrategy([unimportant, important]);

      expect(pruned).toContain(unimportant);
      expect(kept).toContain(important);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Singleton instances', () => {
  it('getMemoryCompressor returns singleton', () => {
    const c1 = getMemoryCompressor();
    const c2 = getMemoryCompressor();
    expect(c1).toBe(c2);
  });
});
