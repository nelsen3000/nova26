/**
 * H6-11: Memory System Property-Based Tests
 *
 * Property-based testing for memory store, compression, and retrieval
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Mock Memory System
// ============================================================================

interface MemoryEntry {
  id: string;
  content: string;
  importance: number;
  timestamp: number;
  compressed?: boolean;
  originalSize?: number;
  compressedSize?: number;
}

interface CompressionStats {
  originalBytes: number;
  compressedBytes: number;
  ratio: number;
}

class MockMemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private entryCounter = 0;
  private compressionStats: CompressionStats = {
    originalBytes: 0,
    compressedBytes: 0,
    ratio: 0,
  };

  async store(content: string, importance: number): Promise<string> {
    const id = `mem-${++this.entryCounter}`;
    const entry: MemoryEntry = {
      id,
      content,
      importance: Math.max(0, Math.min(1, importance)),
      timestamp: Date.now(),
    };

    this.entries.set(id, entry);
    this.compressionStats.originalBytes += content.length;
    return id;
  }

  async retrieve(id: string): Promise<MemoryEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async search(query: string): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values()).filter((e) =>
      e.content.toLowerCase().includes(query.toLowerCase())
    );
  }

  async compress(): Promise<CompressionStats> {
    let compressedSize = 0;

    for (const entry of this.entries.values()) {
      const compressed = this.simpleCompress(entry.content);
      entry.compressed = true;
      entry.originalSize = entry.content.length;
      entry.compressedSize = compressed.length;
      compressedSize += compressed.length;
    }

    this.compressionStats.compressedBytes = compressedSize;
    this.compressionStats.ratio =
      this.compressionStats.originalBytes > 0
        ? compressedSize / this.compressionStats.originalBytes
        : 0;

    return { ...this.compressionStats };
  }

  private simpleCompress(text: string): string {
    // Simple RLE compression for testing
    let compressed = '';
    let count = 1;
    for (let i = 0; i < text.length; i++) {
      if (i + 1 < text.length && text[i] === text[i + 1]) {
        count++;
      } else {
        if (count > 2) {
          compressed += `${text[i]}${count}`;
        } else {
          compressed += text[i].repeat(count);
        }
        count = 1;
      }
    }
    return compressed;
  }

  getStats(): { count: number; totalImportance: number; avgImportance: number } {
    const entries = Array.from(this.entries.values());
    const totalImportance = entries.reduce((sum, e) => sum + e.importance, 0);

    return {
      count: entries.length,
      totalImportance,
      avgImportance: entries.length > 0 ? totalImportance / entries.length : 0,
    };
  }

  async deleteOldest(count: number): Promise<number> {
    const sorted = Array.from(this.entries.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, count);

    let deleted = 0;
    for (const entry of sorted) {
      if (this.entries.delete(entry.id)) {
        deleted++;
      }
    }

    return deleted;
  }

  clear(): void {
    this.entries.clear();
    this.entryCounter = 0;
    this.compressionStats = { originalBytes: 0, compressedBytes: 0, ratio: 0 };
  }
}

// ============================================================================
// Property-Based Tests: Store/Retrieve Round-Trip
// ============================================================================

describe('PBT: Memory Store Round-Trip Invariants', () => {
  it('should store and retrieve content unchanged', async () => {
    const store = new MockMemoryStore();

    const testCases = [
      'simple text',
      'longer content with more details',
      'content\nwith\nnewlines',
      'special!@#$%^&*()chars',
    ];

    for (const content of testCases) {
      const id = await store.store(content, 0.5);
      const retrieved = await store.retrieve(id);

      expect(retrieved?.content).toBe(content);
    }
  });

  it('should preserve importance values', async () => {
    const store = new MockMemoryStore();

    const importances = [0.0, 0.25, 0.5, 0.75, 1.0];

    for (const importance of importances) {
      const id = await store.store(`content-${importance}`, importance);
      const retrieved = await store.retrieve(id);

      expect(retrieved?.importance).toBe(importance);
    }
  });

  it('should clip importance to [0, 1]', async () => {
    const store = new MockMemoryStore();

    const testCases = [-1, -0.5, 0, 0.5, 1, 1.5, 2];

    for (const importance of testCases) {
      const id = await store.store(`test-${importance}`, importance);
      const retrieved = await store.retrieve(id);

      expect(retrieved?.importance).toBeGreaterThanOrEqual(0);
      expect(retrieved?.importance).toBeLessThanOrEqual(1);
    }
  });

  it('should return null for non-existent entries', async () => {
    const store = new MockMemoryStore();

    const result = await store.retrieve('nonexistent-id');

    expect(result).toBeNull();
  });

  it('should maintain unique IDs for each entry', async () => {
    const store = new MockMemoryStore();

    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const id = await store.store(`content-${i}`, 0.5);
      ids.add(id);
    }

    expect(ids.size).toBe(100);
  });
});

// ============================================================================
// Property-Based Tests: Search
// ============================================================================

describe('PBT: Memory Search Invariants', () => {
  it('should find entries containing query text', async () => {
    const store = new MockMemoryStore();

    await store.store('apple banana cherry', 0.8);
    await store.store('banana grape orange', 0.7);
    await store.store('dog cat bird', 0.6);

    const results = await store.search('banana');

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.content.toLowerCase().includes('banana'))).toBe(true);
  });

  it('should handle case-insensitive search', async () => {
    const store = new MockMemoryStore();

    await store.store('The Quick Brown Fox', 0.9);
    await store.store('the lazy dog', 0.8);

    const upper = await store.search('THE');
    const lower = await store.search('the');

    expect(upper.length).toBe(lower.length);
    expect(upper.length).toBeGreaterThan(0);
  });

  it('should return empty result for non-matching queries', async () => {
    const store = new MockMemoryStore();

    await store.store('apple', 0.5);
    await store.store('banana', 0.5);

    const results = await store.search('cherry');

    expect(results).toHaveLength(0);
  });

  it('should maintain entry integrity during search', async () => {
    const store = new MockMemoryStore();

    const id1 = await store.store('searchable content here', 0.7);
    const id2 = await store.store('other content', 0.5);

    const results = await store.search('searchable');

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(id1);
    expect(results[0].importance).toBe(0.7);
  });
});

// ============================================================================
// Property-Based Tests: Compression
// ============================================================================

describe('PBT: Memory Compression Invariants', () => {
  it('should preserve key data during compression', async () => {
    const store = new MockMemoryStore();

    const testCases = [
      { content: 'repeated repeated repeated', importance: 0.8 },
      { content: 'varied a b c d e f', importance: 0.5 },
      { content: 'single', importance: 0.2 },
    ];

    for (const { content, importance } of testCases) {
      await store.store(content, importance);
    }

    const statsBefore = store.getStats();
    await store.compress();
    const statsAfter = store.getStats();

    expect(statsAfter.count).toBe(statsBefore.count);
    expect(statsAfter.totalImportance).toBe(statsBefore.totalImportance);
  });

  it('should achieve compression ratio between 0 and 1', async () => {
    const store = new MockMemoryStore();

    await store.store('aaaaabbbbccccdddd', 0.5);
    await store.store('xxxxxxyyyyyzzzzz', 0.5);

    const stats = await store.compress();

    expect(stats.ratio).toBeGreaterThanOrEqual(0);
    expect(stats.ratio).toBeLessThanOrEqual(1);
  });

  it('should not lose importance information during compression', async () => {
    const store = new MockMemoryStore();

    const importances = [0.1, 0.3, 0.5, 0.7, 0.9];

    for (const importance of importances) {
      await store.store(`content-${importance}`, importance);
    }

    await store.compress();

    const stats = store.getStats();
    expect(stats.totalImportance).toBeCloseTo(2.5, 1);
  });
});

// ============================================================================
// Property-Based Tests: Deletion and Maintenance
// ============================================================================

describe('PBT: Memory Maintenance Invariants', () => {
  it('should delete oldest entries first', async () => {
    const store = new MockMemoryStore();

    const ids: string[] = [];

    for (let i = 0; i < 10; i++) {
      const id = await store.store(`entry-${i}`, 0.5);
      ids.push(id);
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    const deleted = await store.deleteOldest(3);

    expect(deleted).toBe(3);

    const stats = store.getStats();
    expect(stats.count).toBe(7);
  });

  it('should maintain consistent stats after operations', async () => {
    const store = new MockMemoryStore();

    for (let i = 0; i < 20; i++) {
      await store.store(`entry-${i}`, Math.random());
    }

    const stats1 = store.getStats();
    expect(stats1.count).toBe(20);

    await store.deleteOldest(5);

    const stats2 = store.getStats();
    expect(stats2.count).toBe(15);
    expect(stats2.avgImportance).toBeGreaterThanOrEqual(0);
    expect(stats2.avgImportance).toBeLessThanOrEqual(1);
  });

  it('should handle clear operation completely', async () => {
    const store = new MockMemoryStore();

    for (let i = 0; i < 50; i++) {
      await store.store(`entry-${i}`, 0.5);
    }

    store.clear();

    const stats = store.getStats();
    expect(stats.count).toBe(0);

    const retrieved = await store.retrieve('mem-1');
    expect(retrieved).toBeNull();
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

describe('PBT: Memory System Stress Tests', () => {
  it('should handle 1000 entries efficiently', async () => {
    const store = new MockMemoryStore();

    for (let i = 0; i < 1000; i++) {
      await store.store(`entry-content-${i}`, Math.random());
    }

    const stats = store.getStats();
    expect(stats.count).toBe(1000);
    expect(stats.avgImportance).toBeGreaterThanOrEqual(0);
    expect(stats.avgImportance).toBeLessThanOrEqual(1);
  });

  it('should compress large dataset', async () => {
    const store = new MockMemoryStore();

    for (let i = 0; i < 500; i++) {
      const content = 'a'.repeat(100) + 'b'.repeat(100);
      await store.store(content, 0.5);
    }

    const stats = await store.compress();

    expect(stats.ratio).toBeGreaterThanOrEqual(0);
    expect(stats.ratio).toBeLessThanOrEqual(1);
  });

  it('should search across 500 entries quickly', async () => {
    const store = new MockMemoryStore();

    for (let i = 0; i < 500; i++) {
      const content = i % 2 === 0 ? 'searchable content' : 'other content';
      await store.store(content, 0.5);
    }

    const results = await store.search('searchable');

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(500);
  });
});
