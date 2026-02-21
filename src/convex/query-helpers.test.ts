import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPaginationArgs,
  normalizePaginatedResponse,
  QueryCache,
  aggregateBuildStats,
  formatDuration,
  parseActivityCursor,
  encodeActivityCursor,
} from './query-helpers.js';

// ============================================================================
// buildPaginationArgs
// ============================================================================

describe('buildPaginationArgs', () => {
  it('defaults to 20 items and null cursor', () => {
    const args = buildPaginationArgs();
    expect(args.paginationOpts.numItems).toBe(20);
    expect(args.paginationOpts.cursor).toBeNull();
  });

  it('uses provided cursor', () => {
    const args = buildPaginationArgs({ cursor: 'abc123' });
    expect(args.paginationOpts.cursor).toBe('abc123');
  });

  it('caps numItems at 100', () => {
    const args = buildPaginationArgs({ limit: 500 });
    expect(args.paginationOpts.numItems).toBe(100);
  });

  it('uses provided limit when under cap', () => {
    const args = buildPaginationArgs({ limit: 50 });
    expect(args.paginationOpts.numItems).toBe(50);
  });
});

// ============================================================================
// normalizePaginatedResponse
// ============================================================================

describe('normalizePaginatedResponse', () => {
  it('maps isDone=true to hasMore=false and cursor=null', () => {
    const result = normalizePaginatedResponse({
      page: [1, 2, 3],
      isDone: true,
      continueCursor: 'ignore-me',
    });
    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeNull();
    expect(result.items).toEqual([1, 2, 3]);
  });

  it('maps isDone=false to hasMore=true with cursor', () => {
    const result = normalizePaginatedResponse({
      page: [1, 2],
      isDone: false,
      continueCursor: 'next-page-token',
    });
    expect(result.hasMore).toBe(true);
    expect(result.cursor).toBe('next-page-token');
  });
});

// ============================================================================
// QueryCache
// ============================================================================

describe('QueryCache', () => {
  let cache: QueryCache;

  beforeEach(() => {
    cache = new QueryCache(100);
  });

  it('calls fetcher once for concurrent requests with same key', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const [r1, r2] = await Promise.all([
      cache.get('key-1', fetcher),
      cache.get('key-1', fetcher),
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(r1).toBe('data');
    expect(r2).toBe('data');
  });

  it('calls fetcher again after TTL expires', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    await cache.get('key-1', fetcher);
    // Wait for TTL
    await new Promise((r) => setTimeout(r, 150));
    await cache.get('key-1', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidate removes cached entry', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    await cache.get('key-1', fetcher);
    cache.invalidate('key-1');
    await cache.get('key-1', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('clear removes all cached entries', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    await cache.get('key-a', fetcher);
    await cache.get('key-b', fetcher);
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('different keys use separate fetchers', async () => {
    const fetcherA = vi.fn().mockResolvedValue('a');
    const fetcherB = vi.fn().mockResolvedValue('b');
    const [a, b] = await Promise.all([
      cache.get('key-a', fetcherA),
      cache.get('key-b', fetcherB),
    ]);
    expect(a).toBe('a');
    expect(b).toBe('b');
  });
});

// ============================================================================
// aggregateBuildStats
// ============================================================================

describe('aggregateBuildStats', () => {
  const now = new Date().toISOString();
  const later = new Date(Date.now() + 5000).toISOString();

  it('counts statuses correctly', () => {
    const stats = aggregateBuildStats([
      { status: 'completed', startedAt: now, completedAt: later },
      { status: 'completed', startedAt: now, completedAt: later },
      { status: 'failed', startedAt: now },
      { status: 'running', startedAt: now },
    ]);
    expect(stats.completed).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.running).toBe(1);
    expect(stats.total).toBe(4);
  });

  it('calculates successRate as percentage', () => {
    const stats = aggregateBuildStats([
      { status: 'completed', startedAt: now, completedAt: later },
      { status: 'failed', startedAt: now },
    ]);
    expect(stats.successRate).toBe(50);
  });

  it('returns 0 successRate for empty builds', () => {
    const stats = aggregateBuildStats([]);
    expect(stats.successRate).toBe(0);
    expect(stats.avgDurationMs).toBe(0);
  });
});

// ============================================================================
// formatDuration
// ============================================================================

describe('formatDuration', () => {
  it('formats < 1000ms as ms', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats 1000–59999ms as seconds', () => {
    expect(formatDuration(2500)).toBe('2.5s');
  });

  it('formats 60000+ ms as minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
  });
});

// ============================================================================
// Activity cursor encoding/decoding
// ============================================================================

describe('Activity cursor round-trip', () => {
  it('encodes and decodes a cursor', () => {
    const cursor = { lastTimestamp: '2026-02-20T12:00:00Z', lastId: 'abc123' };
    const encoded = encodeActivityCursor(cursor);
    const decoded = parseActivityCursor(encoded);
    expect(decoded).toEqual(cursor);
  });

  it('parseActivityCursor returns null for null input', () => {
    expect(parseActivityCursor(null)).toBeNull();
  });

  it('parseActivityCursor returns null for malformed base64', () => {
    expect(parseActivityCursor('!!!invalid!!!')).toBeNull();
  });

  it('parseActivityCursor returns null for valid base64 but invalid schema', () => {
    const bad = Buffer.from(JSON.stringify({ wrong: 'fields' })).toString('base64');
    expect(parseActivityCursor(bad)).toBeNull();
  });
});
