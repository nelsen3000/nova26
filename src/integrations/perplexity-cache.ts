// Perplexity Cache - LRU caching layer with TTL for Perplexity API
// Provides cost tracking and budget enforcement

import { createHash } from 'crypto';
import type { SearchResult, SearchOptions } from './perplexity-client.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Error Classes
// ═══════════════════════════════════════════════════════════════════════════════

export class BudgetExceededError extends Error {
  constructor(
    message: string = 'Daily budget exceeded',
    public readonly budget: number,
    public readonly spent: number
  ) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cache Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheEntry {
  result: SearchResult;
  timestamp: number;
  ttl: number;
}

export interface PerplexityCacheConfig {
  maxSize?: number; // Maximum number of entries (default: 1000)
  defaultTTL?: number; // Default TTL in milliseconds (default: 1 hour)
  factCheckTTL?: number; // TTL for fact checks in milliseconds (default: 24 hours)
}

export interface UsagePeriod {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PerplexityCache Class
// ═══════════════════════════════════════════════════════════════════════════════

export class PerplexityCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private defaultTTL: number;
  private factCheckTTL: number;
  private accessOrder: string[]; // LRU tracking

  constructor(config: PerplexityCacheConfig = {}) {
    this.maxSize = config.maxSize ?? 1000;
    this.defaultTTL = config.defaultTTL ?? 60 * 60 * 1000; // 1 hour
    this.factCheckTTL = config.factCheckTTL ?? 24 * 60 * 60 * 1000; // 24 hours
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Generate cache key from query and options
   */
  private generateKey(query: string, options: SearchOptions): string {
    const data = query + JSON.stringify(options);
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cached result if available and not expired
   */
  get(query: string, options: SearchOptions): SearchResult | undefined {
    const key = this.generateKey(query, options);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return undefined;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);

    return entry.result;
  }

  /**
   * Store result in cache
   */
  set(query: string, options: SearchOptions, result: SearchResult, isFactCheck = false): void {
    const key = this.generateKey(query, options);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      ttl: isFactCheck ? this.factCheckTTL : this.defaultTTL,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(query: string, options: SearchOptions = {}): boolean {
    const key = this.generateKey(query, options);
    return this.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.slice(0, 16) + '...', // Truncate for readability
      age: now - entry.timestamp,
      ttl: entry.ttl,
    }));

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate(),
      entries,
    };
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    return existed;
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private calculateHitRate(): number {
    // This is a placeholder - in production, you'd track actual hits/misses
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CostTracker Class
// ═══════════════════════════════════════════════════════════════════════════════

// Perplexity pricing (as of 2024) - adjust as needed
const PERPLEXITY_COSTS = {
  inputTokenCost: 0.0001 / 1000, // $0.0001 per 1K input tokens
  outputTokenCost: 0.0001 / 1000, // $0.0001 per 1K output tokens
};

interface UsageRecord {
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export class CostTracker {
  private records: UsageRecord[];
  private maxCostPerDay: number;
  private dailySpend: number;
  private lastResetDate: string;

  constructor() {
    this.records = [];
    this.maxCostPerDay = Infinity;
    this.dailySpend = 0;
    this.lastResetDate = this.getCurrentDate();
  }

  /**
   * Log an API call with token usage
   */
  logCall(model: string, inputTokens: number, outputTokens: number): void {
    this.checkAndResetDailyBudget();

    const estimatedCost = this.calculateCost(inputTokens, outputTokens);
    
    const record: UsageRecord = {
      timestamp: Date.now(),
      model,
      inputTokens,
      outputTokens,
      estimatedCost,
    };

    this.records.push(record);
    this.dailySpend += estimatedCost;
  }

  /**
   * Get usage for a specific period
   */
  getUsage(period: 'hour' | 'day' | 'month'): UsagePeriod {
    const now = Date.now();
    let cutoff: number;

    switch (period) {
      case 'hour':
        cutoff = now - 60 * 60 * 1000;
        break;
      case 'day':
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case 'month':
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        cutoff = 0;
    }

    const relevantRecords = this.records.filter(r => r.timestamp >= cutoff);

    const calls = relevantRecords.length;
    const inputTokens = relevantRecords.reduce((sum, r) => sum + r.inputTokens, 0);
    const outputTokens = relevantRecords.reduce((sum, r) => sum + r.outputTokens, 0);
    const estimatedCost = relevantRecords.reduce((sum, r) => sum + r.estimatedCost, 0);

    return { calls, inputTokens, outputTokens, estimatedCost };
  }

  /**
   * Set daily budget limit
   */
  setBudget(maxCostPerDay: number): void {
    this.maxCostPerDay = maxCostPerDay;
    this.checkAndResetDailyBudget();

    if (this.dailySpend > maxCostPerDay) {
      throw new BudgetExceededError(
        'Daily budget already exceeded',
        maxCostPerDay,
        this.dailySpend
      );
    }
  }

  /**
   * Check if a request can be afforded within budget
   */
  canAfford(inputTokens: number, outputTokens: number): boolean {
    this.checkAndResetDailyBudget();
    const estimatedCost = this.calculateCost(inputTokens, outputTokens);
    return this.dailySpend + estimatedCost <= this.maxCostPerDay;
  }

  /**
   * Check budget before making a call, throws if exceeded
   */
  checkBudget(inputTokens: number, outputTokens: number): void {
    if (!this.canAfford(inputTokens, outputTokens)) {
      throw new BudgetExceededError(
        'Daily budget would be exceeded by this request',
        this.maxCostPerDay,
        this.dailySpend
      );
    }
  }

  /**
   * Get remaining budget for today
   */
  getRemainingBudget(): number {
    this.checkAndResetDailyBudget();
    return Math.max(0, this.maxCostPerDay - this.dailySpend);
  }

  /**
   * Get current daily spend
   */
  getDailySpend(): number {
    this.checkAndResetDailyBudget();
    return this.dailySpend;
  }

  /**
   * Get all records (for testing/debugging)
   */
  getRecords(): UsageRecord[] {
    return [...this.records];
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.records = [];
    this.dailySpend = 0;
    this.lastResetDate = this.getCurrentDate();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = inputTokens * PERPLEXITY_COSTS.inputTokenCost;
    const outputCost = outputTokens * PERPLEXITY_COSTS.outputTokenCost;
    return inputCost + outputCost;
  }

  private getCurrentDate(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private checkAndResetDailyBudget(): void {
    const currentDate = this.getCurrentDate();
    if (currentDate !== this.lastResetDate) {
      this.dailySpend = 0;
      this.lastResetDate = currentDate;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CachedPerplexityClient - Combines client with caching and cost tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { PerplexityClient, type PerplexityClientConfig } from './perplexity-client.js';

export interface CachedClientConfig extends PerplexityClientConfig {
  cache?: PerplexityCacheConfig;
  budget?: {
    maxCostPerDay: number;
  };
}

export class CachedPerplexityClient {
  private client: PerplexityClient;
  private cache: PerplexityCache;
  private costTracker: CostTracker;

  constructor(config: CachedClientConfig) {
    this.client = new PerplexityClient(config);
    this.cache = new PerplexityCache(config.cache);
    this.costTracker = new CostTracker();

    if (config.budget) {
      this.costTracker.setBudget(config.budget.maxCostPerDay);
    }
  }

  /**
   * Search with caching and cost tracking
   */
  async search(query: string, options: SearchOptions = {}, estimatedTokens = 1000): Promise<SearchResult> {
    // Check budget first
    this.costTracker.checkBudget(Math.floor(estimatedTokens * 0.3), Math.floor(estimatedTokens * 0.7));

    // Check cache
    const cached = this.cache.get(query, options);
    if (cached) {
      return cached;
    }

    // Make API call
    const result = await this.client.search(query, options);

    // Log cost
    this.costTracker.logCall(result.model, Math.floor(result.tokensUsed * 0.3), Math.floor(result.tokensUsed * 0.7));

    // Cache result
    const isFactCheck = query.toLowerCase().includes('fact-check') || 
                        query.toLowerCase().includes('fact check');
    this.cache.set(query, options, result, isFactCheck);

    return result;
  }

  /**
   * Get cache stats
   */
  getCacheStats(): ReturnType<PerplexityCache['getStats']> {
    return this.cache.getStats();
  }

  /**
   * Get cost usage
   */
  getUsage(period: 'hour' | 'day' | 'month'): UsagePeriod {
    return this.costTracker.getUsage(period);
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    return this.costTracker.getRemainingBudget();
  }

  /**
   * Set daily budget
   */
  setBudget(maxCostPerDay: number): void {
    this.costTracker.setBudget(maxCostPerDay);
  }

  /**
   * Invalidate cache entry
   */
  invalidate(query: string, options?: SearchOptions): boolean {
    return this.cache.invalidate(query, options ?? {});
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cost records
   */
  clearCostRecords(): void {
    this.costTracker.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════════

let globalCachedClient: CachedPerplexityClient | null = null;

export function initializeCachedClient(config: CachedClientConfig): CachedPerplexityClient {
  globalCachedClient = new CachedPerplexityClient(config);
  return globalCachedClient;
}

export function getCachedClient(): CachedPerplexityClient {
  if (!globalCachedClient) {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable not set');
    }
    globalCachedClient = new CachedPerplexityClient({ apiKey });
  }
  return globalCachedClient;
}

export function resetCachedClient(): void {
  globalCachedClient = null;
}
