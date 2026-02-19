// Cache Manager — Multi-tier caching for LLM responses, embeddings, and repo maps
// KIMI-POLISH-02: Performance and Caching

import { createHash } from 'crypto';

// ============================================================================
// Cache Entry Types
// ============================================================================

export interface LLMCacheEntry {
  key: string;
  response: string;
  cachedAt: string;
  expiresAt: string;
  model: string;
  promptPreview: string;
}

export interface EmbeddingCacheEntry {
  key: string;
  embedding: number[];
  model: string;
  cachedAt: string;
  expiresAt: string;
}

export interface RepoMapCacheEntry {
  directoryHash: string;
  repoPath: string;
  map: Record<string, unknown>;
  cachedAt: string;
}

export interface CacheStats {
  llmHits: number;
  llmMisses: number;
  llmHitRate: number;
  llmSize: number;
  embeddingHits: number;
  embeddingMisses: number;
  embeddingSize: number;
  repoMapHits: number;
  repoMapMisses: number;
  repoMapSize: number;
}

// ============================================================================
// Configuration
// ============================================================================

interface CacheManagerOptions {
  llmTTLMs: number;
  llmMaxEntries: number;
  embeddingTTLMs: number;
  embeddingMaxEntries: number;
}

const DEFAULT_OPTIONS: CacheManagerOptions = {
  llmTTLMs: 3_600_000,      // 1 hour
  llmMaxEntries: 500,
  embeddingTTLMs: 86_400_000, // 24 hours
  embeddingMaxEntries: 10_000,
};

// ============================================================================
// LRU Map Implementation for Embedding Cache
// ============================================================================

class LRUMap<K, V> extends Map<K, V> {
  private maxSize: number;

  constructor(maxSize: number) {
    super();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      super.delete(key);
      super.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): this {
    if (super.has(key)) {
      super.delete(key);
    } else if (super.size >= this.maxSize) {
      // Evict least recently used (first item)
      const firstKey = super.keys().next().value;
      if (firstKey !== undefined) {
        super.delete(firstKey);
      }
    }
    super.set(key, value);
    return this;
  }
}

// ============================================================================
// Cache Manager
// ============================================================================

export class CacheManager {
  private options: CacheManagerOptions;
  
  // LLM cache: simple Map with FIFO eviction when max entries reached
  private llmCache: Map<string, LLMCacheEntry> = new Map();
  private llmAccessOrder: string[] = []; // Track insertion order for FIFO
  
  // Embedding cache: LRU eviction
  private embeddingCache: LRUMap<string, EmbeddingCacheEntry>;
  
  // Repo map cache: no TTL, invalidated by directory hash change
  private repoMapCache: Map<string, RepoMapCacheEntry> = new Map();
  
  // Statistics
  private statsData = {
    llmHits: 0,
    llmMisses: 0,
    embeddingHits: 0,
    embeddingMisses: 0,
    repoMapHits: 0,
    repoMapMisses: 0,
  };

  constructor(options?: Partial<CacheManagerOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.embeddingCache = new LRUMap(this.options.embeddingMaxEntries);
  }

  // ==========================================================================
  // LLM Response Cache
  // ==========================================================================

  /**
   * Get cached LLM response if available and not expired
   * Key = SHA-256 of (model + '\x00' + prompt)
   */
  async getLLMResponse(model: string, prompt: string): Promise<string | null> {
    const key = this.generateKey(model + '\x00' + prompt);
    const entry = this.llmCache.get(key);

    if (!entry) {
      this.statsData.llmMisses++;
      return null;
    }

    // Check expiration
    if (new Date(entry.expiresAt) < new Date()) {
      this.llmCache.delete(key);
      this.removeFromAccessOrder(key);
      this.statsData.llmMisses++;
      return null;
    }

    // Update access order for LRU-like behavior (move to end)
    this.removeFromAccessOrder(key);
    this.llmAccessOrder.push(key);
    
    this.statsData.llmHits++;
    return entry.response;
  }

  /**
   * Store LLM response with TTL, evict oldest if size > llmMaxEntries
   */
  async setLLMResponse(model: string, prompt: string, response: string): Promise<void> {
    const key = this.generateKey(model + '\x00' + prompt);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.options.llmTTLMs);

    // Create preview (first 100 chars of prompt)
    const promptPreview = prompt.slice(0, 100) + (prompt.length > 100 ? '...' : '');

    const entry: LLMCacheEntry = {
      key,
      response,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      model,
      promptPreview,
    };

    // If key exists, update it
    if (this.llmCache.has(key)) {
      this.removeFromAccessOrder(key);
    }

    // Evict oldest entries if at capacity
    while (this.llmCache.size >= this.options.llmMaxEntries && this.llmAccessOrder.length > 0) {
      const oldestKey = this.llmAccessOrder.shift();
      if (oldestKey) {
        this.llmCache.delete(oldestKey);
      }
    }

    this.llmCache.set(key, entry);
    this.llmAccessOrder.push(key);
  }

  // ==========================================================================
  // Embedding Cache
  // ==========================================================================

  /**
   * Get cached embedding if available and not expired
   * Key = SHA-256 of (text + '\x00' + model)
   */
  async getEmbedding(text: string, model: string): Promise<number[] | null> {
    const key = this.generateKey(text + '\x00' + model);
    const entry = this.embeddingCache.get(key);

    if (!entry) {
      this.statsData.embeddingMisses++;
      return null;
    }

    // Check expiration
    if (new Date(entry.expiresAt) < new Date()) {
      this.embeddingCache.delete(key);
      this.statsData.embeddingMisses++;
      return null;
    }

    this.statsData.embeddingHits++;
    return entry.embedding;
  }

  /**
   * Store embedding with TTL, evict LRU if size > embeddingMaxEntries
   */
  async setEmbedding(text: string, model: string, embedding: number[]): Promise<void> {
    const key = this.generateKey(text + '\x00' + model);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.options.embeddingTTLMs);

    const entry: EmbeddingCacheEntry = {
      key,
      embedding,
      model,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.embeddingCache.set(key, entry);
  }

  // ==========================================================================
  // Repo Map Cache
  // ==========================================================================

  /**
   * Get cached repo map if directory hash matches
   */
  async getRepoMap(repoPath: string, directoryHash: string): Promise<Record<string, unknown> | null> {
    const key = `${repoPath}:${directoryHash}`;
    const entry = this.repoMapCache.get(key);

    if (!entry) {
      this.statsData.repoMapMisses++;
      return null;
    }

    this.statsData.repoMapHits++;
    return entry.map;
  }

  /**
   * Store repo map (no TTL, invalidated by directory hash change)
   */
  async setRepoMap(
    repoPath: string, 
    directoryHash: string, 
    map: Record<string, unknown>
  ): Promise<void> {
    const key = `${repoPath}:${directoryHash}`;
    
    const entry: RepoMapCacheEntry = {
      directoryHash,
      repoPath,
      map,
      cachedAt: new Date().toISOString(),
    };

    this.repoMapCache.set(key, entry);
  }

  /**
   * Invalidate all repo map entries for a given repo path
   */
  invalidateRepoMap(repoPath: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.repoMapCache.entries()) {
      if (entry.repoPath === repoPath) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.repoMapCache.delete(key);
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    const llmTotal = this.statsData.llmHits + this.statsData.llmMisses;
    const llmHitRate = llmTotal > 0 ? this.statsData.llmHits / llmTotal : 0;

    return {
      llmHits: this.statsData.llmHits,
      llmMisses: this.statsData.llmMisses,
      llmHitRate: Math.round(llmHitRate * 100) / 100,
      llmSize: this.llmCache.size,
      embeddingHits: this.statsData.embeddingHits,
      embeddingMisses: this.statsData.embeddingMisses,
      embeddingSize: this.embeddingCache.size,
      repoMapHits: this.statsData.repoMapHits,
      repoMapMisses: this.statsData.repoMapMisses,
      repoMapSize: this.repoMapCache.size,
    };
  }

  // ==========================================================================
  // Management
  // ==========================================================================

  /**
   * Clear all caches and reset statistics
   */
  clearAll(): void {
    this.llmCache.clear();
    this.llmAccessOrder = [];
    this.embeddingCache.clear();
    this.repoMapCache.clear();
    
    this.statsData = {
      llmHits: 0,
      llmMisses: 0,
      embeddingHits: 0,
      embeddingMisses: 0,
      repoMapHits: 0,
      repoMapMisses: 0,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private generateKey(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.llmAccessOrder.indexOf(key);
    if (index > -1) {
      this.llmAccessOrder.splice(index, 1);
    }
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

let cacheManagerInstance: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager();
  }
  return cacheManagerInstance;
}

export function resetCacheManager(): void {
  cacheManagerInstance = null;
}
