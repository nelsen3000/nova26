// Convex query helpers — pagination, deduplication, computed aggregates.

import { z } from 'zod';

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationResult<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface PaginationOptions {
  cursor?: string | null;
  limit?: number;
}

/**
 * Build a paginated query params object for Convex `.paginate()` calls.
 */
export function buildPaginationArgs(options: PaginationOptions = {}): {
  paginationOpts: { cursor: string | null; numItems: number };
} {
  return {
    paginationOpts: {
      cursor: options.cursor ?? null,
      numItems: Math.min(options.limit ?? 20, 100), // Cap at 100
    },
  };
}

/**
 * Normalise a Convex paginated response into a consistent shape.
 */
export function normalizePaginatedResponse<T>(response: {
  page: T[];
  isDone: boolean;
  continueCursor: string;
}): PaginationResult<T> {
  return {
    items: response.page,
    cursor: response.isDone ? null : response.continueCursor,
    hasMore: !response.isDone,
  };
}

// ============================================================================
// In-flight deduplication (client-side)
// ============================================================================

interface InflightEntry<T> {
  promise: Promise<T>;
  resolvedAt: number | null;
}

/**
 * cachedQuery — deduplicates identical in-flight requests.
 * Calls that happen within `ttlMs` of each other share one Promise.
 */
export class QueryCache {
  private cache = new Map<string, InflightEntry<unknown>>();
  private readonly ttlMs: number;

  constructor(ttlMs = 500) {
    this.ttlMs = ttlMs;
  }

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const entry = this.cache.get(key);

    if (entry) {
      const age = entry.resolvedAt ? Date.now() - entry.resolvedAt : 0;
      if (!entry.resolvedAt || age < this.ttlMs) {
        return entry.promise as Promise<T>;
      }
    }

    const promise = fetcher().then((result) => {
      const e = this.cache.get(key);
      if (e) e.resolvedAt = Date.now();
      return result;
    });

    this.cache.set(key, { promise, resolvedAt: null });
    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Aggregation helpers
// ============================================================================

/**
 * Aggregate build stats from a list of builds.
 */
export function aggregateBuildStats(builds: Array<{
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
}>): {
  total: number;
  completed: number;
  failed: number;
  running: number;
  successRate: number;
  avgDurationMs: number;
} {
  const total = builds.length;
  const completed = builds.filter((b) => b.status === 'completed').length;
  const failed = builds.filter((b) => b.status === 'failed').length;
  const running = builds.filter((b) => b.status === 'running').length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const durations = builds
    .filter((b) => b.completedAt)
    .map(
      (b) =>
        new Date(b.completedAt!).getTime() - new Date(b.startedAt).getTime()
    )
    .filter((d) => d > 0);

  const avgDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  return { total, completed, failed, running, successRate, avgDurationMs };
}

/**
 * Format a duration in ms to a human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Cursor-based activity feed pagination
// ============================================================================

export const ActivityCursorSchema = z.object({
  lastTimestamp: z.string(),
  lastId: z.string(),
});

export type ActivityCursor = z.infer<typeof ActivityCursorSchema>;

/**
 * Parse a base64-encoded activity cursor (from the API) safely.
 */
export function parseActivityCursor(raw: string | null): ActivityCursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return ActivityCursorSchema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Encode an activity cursor to a base64 string for API consumption.
 */
export function encodeActivityCursor(cursor: ActivityCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}
