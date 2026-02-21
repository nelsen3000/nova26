// Perplexity Cache Tests
// Comprehensive test suite for caching, cost tracking, and budget enforcement

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PerplexityCache,
  CostTracker,
  CachedPerplexityClient,
  BudgetExceededError,
  initializeCachedClient,
  getCachedClient,
  resetCachedClient,
  type PerplexityCacheConfig,
  type SearchResult,
} from './perplexity-cache.js';

describe('PerplexityCache', () => {
  let cache: PerplexityCache;

  beforeEach(() => {
    cache = new PerplexityCache();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Cache Basic Operations Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('basic operations', () => {
    const mockResult: SearchResult = {
      answer: 'Test answer',
      citations: [],
      confidence: 0.8,
      model: 'sonar',
      tokensUsed: 100,
    };

    it('stores and retrieves cached result', () => {
      cache.set('test query', {}, mockResult);
      const retrieved = cache.get('test query', {});

      expect(retrieved).toEqual(mockResult);
    });

    it('returns undefined for non-existent key', () => {
      const retrieved = cache.get('non-existent', {});
      expect(retrieved).toBeUndefined();
    });

    it('generates different keys for different queries', () => {
      cache.set('query 1', {}, mockResult);
      const retrieved = cache.get('query 2', {});

      expect(retrieved).toBeUndefined();
    });

    it('generates different keys for different options', () => {
      cache.set('query', { temperature: 0.5 }, mockResult);
      const retrieved = cache.get('query', { temperature: 0.7 });

      expect(retrieved).toBeUndefined();
    });

    it('invalidates specific cache entry', () => {
      cache.set('query', {}, mockResult);
      expect(cache.get('query', {})).toEqual(mockResult);

      cache.invalidate('query', {});
      expect(cache.get('query', {})).toBeUndefined();
    });

    it('returns true when invalidating existing entry', () => {
      cache.set('query', {}, mockResult);
      expect(cache.invalidate('query', {})).toBe(true);
    });

    it('returns false when invalidating non-existent entry', () => {
      expect(cache.invalidate('non-existent', {})).toBe(false);
    });

    it('clears all entries', () => {
      cache.set('query1', {}, mockResult);
      cache.set('query2', {}, mockResult);

      cache.clear();

      expect(cache.get('query1', {})).toBeUndefined();
      expect(cache.get('query2', {})).toBeUndefined();
      expect(cache.size()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Cache TTL Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('TTL handling', () => {
    const mockResult: SearchResult = {
      answer: 'Test answer',
      citations: [],
      confidence: 0.8,
      model: 'sonar',
      tokensUsed: 100,
    };

    it('returns expired entries as undefined', () => {
      vi.useFakeTimers();

      try {
        const shortCache = new PerplexityCache({ defaultTTL: 1 }); // 1ms TTL
        shortCache.set('query', {}, mockResult);

        // Wait for expiry
        vi.advanceTimersByTime(2);

        const retrieved = shortCache.get('query', {});
        expect(retrieved).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('uses longer TTL for fact checks', () => {
      const cacheWithTTL = new PerplexityCache({
        defaultTTL: 1000,
        factCheckTTL: 5000,
      });

      cacheWithTTL.set('regular query', {}, mockResult, false);
      cacheWithTTL.set('fact check query', {}, mockResult, true);

      const stats = cacheWithTTL.getStats();
      expect(stats.entries).toHaveLength(2);
      // Both should be present initially
      expect(cacheWithTTL.size()).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Cache LRU Eviction Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('LRU eviction', () => {
    const mockResult: SearchResult = {
      answer: 'Test answer',
      citations: [],
      confidence: 0.8,
      model: 'sonar',
      tokensUsed: 100,
    };

    it('evicts oldest entries when at capacity', () => {
      const smallCache = new PerplexityCache({ maxSize: 2 });

      smallCache.set('query1', {}, mockResult);
      smallCache.set('query2', {}, mockResult);
      smallCache.set('query3', {}, mockResult); // Should evict query1

      expect(smallCache.get('query1', {})).toBeUndefined();
      expect(smallCache.get('query2', {})).toEqual(mockResult);
      expect(smallCache.get('query3', {})).toEqual(mockResult);
    });

    it('updates access order on get', () => {
      const smallCache = new PerplexityCache({ maxSize: 2 });

      smallCache.set('query1', {}, mockResult);
      smallCache.set('query2', {}, mockResult);

      // Access query1 to make it most recently used
      smallCache.get('query1', {});

      // Add new entry - should evict query2 (now least recently used)
      smallCache.set('query3', {}, mockResult);

      expect(smallCache.get('query1', {})).toEqual(mockResult);
      expect(smallCache.get('query2', {})).toBeUndefined();
      expect(smallCache.get('query3', {})).toEqual(mockResult);
    });

    it('respects configured max size', () => {
      const cacheWithSize = new PerplexityCache({ maxSize: 100 });

      for (let i = 0; i < 150; i++) {
        cacheWithSize.set(`query${i}`, {}, mockResult);
      }

      expect(cacheWithSize.size()).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Cache Stats Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('statistics', () => {
    const mockResult: SearchResult = {
      answer: 'Test answer',
      citations: [],
      confidence: 0.8,
      model: 'sonar',
      tokensUsed: 100,
    };

    it('reports correct size', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set('query1', {}, mockResult);
      expect(cache.getStats().size).toBe(1);

      cache.set('query2', {}, mockResult);
      expect(cache.getStats().size).toBe(2);
    });

    it('reports max size', () => {
      const sizedCache = new PerplexityCache({ maxSize: 500 });
      expect(sizedCache.getStats().maxSize).toBe(500);
    });

    it('reports entry details', () => {
      cache.set('query', {}, mockResult);
      const stats = cache.getStats();

      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
      expect(stats.entries[0].ttl).toBe(60 * 60 * 1000); // Default 1 hour
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CostTracker Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  describe('basic tracking', () => {
    it('logs API calls', () => {
      tracker.logCall('sonar', 100, 200);

      const records = tracker.getRecords();
      expect(records).toHaveLength(1);
      expect(records[0].model).toBe('sonar');
      expect(records[0].inputTokens).toBe(100);
      expect(records[0].outputTokens).toBe(200);
    });

    it('calculates estimated cost', () => {
      tracker.logCall('sonar', 1000, 1000);

      const records = tracker.getRecords();
      // Cost should be > 0
      expect(records[0].estimatedCost).toBeGreaterThan(0);
    });

    it('accumulates multiple calls', () => {
      tracker.logCall('sonar', 100, 100);
      tracker.logCall('sonar', 200, 200);
      tracker.logCall('sonar', 300, 300);

      expect(tracker.getRecords()).toHaveLength(3);
    });
  });

  describe('usage periods', () => {
    beforeEach(() => {
      // Log some calls
      tracker.logCall('sonar', 100, 100);
      tracker.logCall('sonar', 200, 200);
    });

    it('returns usage for hour period', () => {
      const usage = tracker.getUsage('hour');

      expect(usage.calls).toBe(2);
      expect(usage.inputTokens).toBe(300);
      expect(usage.outputTokens).toBe(300);
      expect(usage.estimatedCost).toBeGreaterThan(0);
    });

    it('returns usage for day period', () => {
      const usage = tracker.getUsage('day');

      expect(usage.calls).toBe(2);
      expect(usage.inputTokens).toBe(300);
    });

    it('returns usage for month period', () => {
      const usage = tracker.getUsage('month');

      expect(usage.calls).toBe(2);
    });

    it('filters records outside period', () => {
      // Create a new tracker with old records
      const oldTracker = new CostTracker();
      
      // Add old record (35 days ago)
      const oldRecord = {
        timestamp: Date.now() - 35 * 24 * 60 * 60 * 1000,
        model: 'sonar',
        inputTokens: 1000,
        outputTokens: 1000,
        estimatedCost: 0.001,
      };
      (oldTracker as unknown as { records: typeof oldRecord[] }).records = [oldRecord];

      const usage = oldTracker.getUsage('month');
      expect(usage.calls).toBe(0);
    });
  });

  describe('budget management', () => {
    it('sets daily budget', () => {
      tracker.setBudget(10.0);
      expect(tracker.getRemainingBudget()).toBe(10.0);
    });

    it('tracks remaining budget after calls', () => {
      tracker.setBudget(1.0);
      tracker.logCall('sonar', 1000000, 1000000); // Large call

      const remaining = tracker.getRemainingBudget();
      expect(remaining).toBeLessThan(1.0);
      expect(remaining).toBeGreaterThan(0);
    });

    it('throws when setting budget below current spend', () => {
      tracker.logCall('sonar', 1000000, 1000000);
      const currentSpend = tracker.getDailySpend();

      expect(() => tracker.setBudget(currentSpend / 2)).toThrow(BudgetExceededError);
    });

    it('returns 0 remaining when budget exceeded', () => {
      tracker.setBudget(0.0001); // Very small budget
      tracker.logCall('sonar', 1000000, 1000000);

      expect(tracker.getRemainingBudget()).toBe(0);
    });

    it('checks if request can be afforded', () => {
      tracker.setBudget(1.0);

      expect(tracker.canAfford(100, 100)).toBe(true);
    });

    it('returns false when request would exceed budget', () => {
      tracker.setBudget(0.0001);

      expect(tracker.canAfford(1000000, 1000000)).toBe(false);
    });

    it('throws BudgetExceededError on checkBudget', () => {
      tracker.setBudget(0.0001);

      expect(() => tracker.checkBudget(1000000, 1000000)).toThrow(BudgetExceededError);
    });

    it('resets daily spend on new day', () => {
      tracker.setBudget(10.0);
      tracker.logCall('sonar', 1000000, 1000000);
      
      const todaySpend = tracker.getDailySpend();
      expect(todaySpend).toBeGreaterThan(0);

      // Simulate day change by manipulating internal state
      (tracker as unknown as { lastResetDate: string }).lastResetDate = '2000-01-01';
      
      const newDaySpend = tracker.getDailySpend();
      expect(newDaySpend).toBe(0);
    });
  });

  describe('clear and reset', () => {
    it('clears all records', () => {
      tracker.logCall('sonar', 100, 100);
      expect(tracker.getRecords()).toHaveLength(1);

      tracker.clear();
      expect(tracker.getRecords()).toHaveLength(0);
    });

    it('resets daily spend on clear', () => {
      tracker.setBudget(10.0);
      tracker.logCall('sonar', 1000000, 1000000);
      
      expect(tracker.getDailySpend()).toBeGreaterThan(0);
      
      tracker.clear();
      expect(tracker.getDailySpend()).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CachedPerplexityClient Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('CachedPerplexityClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    resetCachedClient();
  });

  const mockResponse: SearchResult = {
    answer: 'Test answer',
    citations: [{ title: 'Source', url: 'https://example.com' }],
    confidence: 0.85,
    model: 'sonar',
    tokensUsed: 100,
  };

  const mockApiResponse = {
    id: 'test-id',
    model: 'sonar',
    choices: [{
      message: { role: 'assistant', content: 'Test answer' },
      finish_reason: 'stop',
    }],
    citations: [{ title: 'Source', url: 'https://example.com' }],
    usage: { prompt_tokens: 30, completion_tokens: 70, total_tokens: 100 },
  };

  describe('caching integration', () => {
    it('returns cached result on cache hit', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const client = new CachedPerplexityClient({ apiKey: 'test-key' });

      // First call - should hit API
      const result1 = await client.search('test query', {});
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      const result2 = await client.search('test query', {});
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional API call

      expect(result1).toEqual(result2);
    });

    it('bypasses cache on different queries', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const client = new CachedPerplexityClient({ apiKey: 'test-key' });

      await client.search('query 1', {});
      await client.search('query 2', {});

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('clears cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const client = new CachedPerplexityClient({ apiKey: 'test-key' });

      await client.search('query', {});
      client.clearCache();

      // Should hit API again after cache clear
      await client.search('query', {});
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('invalidates specific cache entry', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const client = new CachedPerplexityClient({ apiKey: 'test-key' });

      await client.search('query', {});
      client.invalidate('query', {});

      // Should hit API again after invalidation
      await client.search('query', {});
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('exposes cache stats', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const client = new CachedPerplexityClient({ apiKey: 'test-key' });

      await client.search('query', {});
      const stats = client.getCacheStats();

      expect(stats.size).toBe(1);
    });
  });

  describe('cost tracking integration', () => {
    it('tracks costs on API calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const client = new CachedPerplexityClient({ apiKey: 'test-key' });

      await client.search('query', {});
      const usage = client.getUsage('hour');

      expect(usage.calls).toBe(1);
      expect(usage.estimatedCost).toBeGreaterThan(0);
    });

    it('does not track costs on cache hits', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const client = new CachedPerplexityClient({ apiKey: 'test-key' });

      await client.search('query', {});
      await client.search('query', {}); // Cache hit

      const usage = client.getUsage('hour');
      expect(usage.calls).toBe(1);
    });

    it('exposes remaining budget', async () => {
      const client = new CachedPerplexityClient({ 
        apiKey: 'test-key',
        budget: { maxCostPerDay: 10.0 }
      });

      expect(client.getRemainingBudget()).toBe(10.0);
    });

    it('allows setting budget', async () => {
      const client = new CachedPerplexityClient({ apiKey: 'test-key' });

      client.setBudget(5.0);
      expect(client.getRemainingBudget()).toBe(5.0);
    });
  });

  describe('budget enforcement', () => {
    it('throws BudgetExceededError when budget exceeded', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const client = new CachedPerplexityClient({ 
        apiKey: 'test-key',
        budget: { maxCostPerDay: 0.00001 } // Very small budget
      });

      // First call should work (estimated check)
      await client.search('query', {}, 10);

      // Second call should exceed budget
      await expect(client.search('query2', {}, 1000000))
        .rejects.toThrow(BudgetExceededError);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Functions Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('cached client factory functions', () => {
  beforeEach(() => {
    resetCachedClient();
    delete process.env.PERPLEXITY_API_KEY;
  });

  it('initializeCachedClient creates global client', () => {
    const client = initializeCachedClient({ apiKey: 'test-key' });
    expect(client).toBeInstanceOf(CachedPerplexityClient);
  });

  it('getCachedClient returns initialized client', () => {
    initializeCachedClient({ apiKey: 'test-key' });
    const client = getCachedClient();
    expect(client).toBeInstanceOf(CachedPerplexityClient);
  });

  it('getCachedClient creates client from environment', () => {
    process.env.PERPLEXITY_API_KEY = 'env-key';
    const client = getCachedClient();
    expect(client).toBeInstanceOf(CachedPerplexityClient);
  });

  it('getCachedClient throws without API key', () => {
    expect(() => getCachedClient()).toThrow('PERPLEXITY_API_KEY');
  });

  it('resetCachedClient clears global client', () => {
    initializeCachedClient({ apiKey: 'test-key' });
    resetCachedClient();

    process.env.PERPLEXITY_API_KEY = 'env-key';
    const client = getCachedClient();
    expect(client).toBeInstanceOf(CachedPerplexityClient);
  });
});
