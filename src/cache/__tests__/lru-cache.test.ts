// LRU Cache Tests - GLM-03
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LRUCache, createLRUCache } from '../lru-cache.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LRUCache', () => {

  // ── Construction ────────────────────────────────────────────────────────────

  describe('construction', () => {
    it('creates an empty cache', () => {
      const cache = new LRUCache<string>();
      expect(cache.size).toBe(0);
    });

    it('defaults to maxSize 500', () => {
      const cache = new LRUCache<string>();
      const stats = cache.getStats();
      expect(stats.maxSize).toBe(500);
    });

    it('respects custom maxSize', () => {
      const cache = new LRUCache<string>({ maxSize: 10 });
      expect(cache.getStats().maxSize).toBe(10);
    });

    it('createLRUCache() factory returns LRUCache instance', () => {
      const cache = createLRUCache<number>();
      expect(cache).toBeInstanceOf(LRUCache);
    });
  });

  // ── get / set ───────────────────────────────────────────────────────────────

  describe('get() / set()', () => {
    it('returns undefined for a missing key', () => {
      const cache = new LRUCache<string>();
      expect(cache.get('missing')).toBeUndefined();
    });

    it('stores and retrieves a value', () => {
      const cache = new LRUCache<number>();
      cache.set('a', 42);
      expect(cache.get('a')).toBe(42);
    });

    it('overwrites an existing key', () => {
      const cache = new LRUCache<string>();
      cache.set('k', 'v1');
      cache.set('k', 'v2');
      expect(cache.get('k')).toBe('v2');
    });

    it('size reflects number of entries', () => {
      const cache = new LRUCache<string>();
      cache.set('a', 'x');
      cache.set('b', 'y');
      expect(cache.size).toBe(2);
    });

    it('stores object values without cloning', () => {
      const cache = new LRUCache<{ id: number }>();
      const obj = { id: 99 };
      cache.set('obj', obj);
      expect(cache.get('obj')).toBe(obj);
    });
  });

  // ── LRU eviction ────────────────────────────────────────────────────────────

  describe('LRU eviction', () => {
    it('evicts the least recently used entry when full', () => {
      const cache = new LRUCache<number>({ maxSize: 3 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // 'a' should be evicted
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('d')).toBe(4);
    });

    it('accessing an entry promotes it, protecting it from eviction', () => {
      const cache = new LRUCache<number>({ maxSize: 3 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.get('a'); // promote 'a'
      cache.set('d', 4); // 'b' should be evicted (was LRU)
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
    });

    it('evictions are counted in stats', () => {
      const cache = new LRUCache<number>({ maxSize: 2 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // evicts 'a'
      expect(cache.getStats().evictions).toBe(1);
    });

    it('size never exceeds maxSize', () => {
      const cache = new LRUCache<number>({ maxSize: 5 });
      for (let i = 0; i < 20; i++) {
        cache.set(`k${i}`, i);
      }
      expect(cache.size).toBeLessThanOrEqual(5);
    });

    it('updating an existing key does not evict', () => {
      const cache = new LRUCache<number>({ maxSize: 3 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('a', 99); // update, not insert
      expect(cache.size).toBe(3);
      expect(cache.getStats().evictions).toBe(0);
    });
  });

  // ── TTL ─────────────────────────────────────────────────────────────────────

  describe('TTL expiry', () => {
    it('returns a value before TTL expires', async () => {
      const cache = new LRUCache<string>({ ttlMs: 100 });
      cache.set('x', 'alive');
      expect(cache.get('x')).toBe('alive');
    });

    it('returns undefined after TTL expires', async () => {
      vi.useFakeTimers();
      const cache = new LRUCache<string>({ ttlMs: 50 });
      cache.set('x', 'alive');
      vi.advanceTimersByTime(51);
      expect(cache.get('x')).toBeUndefined();
      vi.useRealTimers();
    });

    it('has() returns false for expired entries', async () => {
      vi.useFakeTimers();
      const cache = new LRUCache<string>({ ttlMs: 30 });
      cache.set('k', 'v');
      vi.advanceTimersByTime(31);
      expect(cache.has('k')).toBe(false);
      vi.useRealTimers();
    });

    it('expired entry is removed on get()', async () => {
      vi.useFakeTimers();
      const cache = new LRUCache<string>({ ttlMs: 50 });
      cache.set('x', 'v');
      vi.advanceTimersByTime(51);
      cache.get('x');
      expect(cache.size).toBe(0);
      vi.useRealTimers();
    });

    it('pruneExpired() removes all expired entries', async () => {
      vi.useFakeTimers();
      const cache = new LRUCache<number>({ ttlMs: 50 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      vi.advanceTimersByTime(51);
      const pruned = cache.pruneExpired();
      expect(pruned).toBe(3);
      expect(cache.size).toBe(0);
      vi.useRealTimers();
    });

    it('pruneExpired() returns 0 when no TTL configured', () => {
      const cache = new LRUCache<number>();
      cache.set('a', 1);
      expect(cache.pruneExpired()).toBe(0);
    });
  });

  // ── delete / has / clear ─────────────────────────────────────────────────────

  describe('delete() / has() / clear()', () => {
    it('delete() removes an existing key', () => {
      const cache = new LRUCache<string>();
      cache.set('k', 'v');
      expect(cache.delete('k')).toBe(true);
      expect(cache.get('k')).toBeUndefined();
    });

    it('delete() returns false for missing key', () => {
      const cache = new LRUCache<string>();
      expect(cache.delete('nope')).toBe(false);
    });

    it('has() returns true for existing key', () => {
      const cache = new LRUCache<string>();
      cache.set('k', 'v');
      expect(cache.has('k')).toBe(true);
    });

    it('has() returns false for missing key', () => {
      const cache = new LRUCache<string>();
      expect(cache.has('missing')).toBe(false);
    });

    it('clear() empties the cache', () => {
      const cache = new LRUCache<number>();
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('clear() resets statistics', () => {
      const cache = new LRUCache<number>();
      cache.set('a', 1);
      cache.get('a');
      cache.get('missing');
      cache.clear();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  // ── Statistics ───────────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('hitRate is 0 with no operations', () => {
      const cache = new LRUCache<string>();
      expect(cache.getStats().hitRate).toBe(0);
    });

    it('hitRate is 1.0 when all gets hit', () => {
      const cache = new LRUCache<string>();
      cache.set('a', 'x');
      cache.get('a');
      cache.get('a');
      expect(cache.getStats().hitRate).toBe(1.0);
    });

    it('hitRate is 0.5 with equal hits and misses', () => {
      const cache = new LRUCache<string>();
      cache.set('a', 'x');
      cache.get('a');    // hit
      cache.get('b');    // miss
      expect(cache.getStats().hitRate).toBe(0.5);
    });

    it('stats.size matches actual size', () => {
      const cache = new LRUCache<number>();
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.getStats().size).toBe(3);
    });
  });

  // ── Generic typing ───────────────────────────────────────────────────────────

  describe('generic typing', () => {
    it('works with string values', () => {
      const cache = createLRUCache<string>();
      cache.set('k', 'hello');
      expect(cache.get('k')).toBe('hello');
    });

    it('works with complex object values', () => {
      interface Route { model: string; confidence: number }
      const cache = createLRUCache<Route>();
      cache.set('r1', { model: 'gpt-4', confidence: 0.9 });
      expect(cache.get('r1')?.model).toBe('gpt-4');
    });
  });
});
