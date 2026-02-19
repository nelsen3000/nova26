// Cache Manager Tests — Comprehensive test coverage for KIMI-POLISH-02

import { describe, it, expect, beforeEach } from 'vitest';
import { CacheManager, getCacheManager, resetCacheManager } from './cache-manager.js';

// ============================================================================
// Test Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Test Suite
// ============================================================================

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  // ============================================================================
  // LLM Response Cache
  // ============================================================================

  describe('LLM Response Cache', () => {
    it('getLLMResponse() returns null on cache miss', async () => {
      const result = await cacheManager.getLLMResponse('gpt-4', 'some prompt');
      expect(result).toBeNull();
    });

    it('setLLMResponse() + getLLMResponse() round-trip', async () => {
      const model = 'gpt-4';
      const prompt = 'What is 2+2?';
      const response = '4';

      await cacheManager.setLLMResponse(model, prompt, response);
      const result = await cacheManager.getLLMResponse(model, prompt);

      expect(result).toBe(response);
    });

    it('getLLMResponse() returns null when TTL expired', async () => {
      // Create cache manager with very short TTL
      const shortCacheManager = new CacheManager({ llmTTLMs: 10 });
      
      await shortCacheManager.setLLMResponse('gpt-4', 'prompt', 'response');
      
      // Wait for TTL to expire
      await sleep(20);
      
      const result = await shortCacheManager.getLLMResponse('gpt-4', 'prompt');
      expect(result).toBeNull();
    });

    it('setLLMResponse() evicts oldest when maxEntries exceeded', async () => {
      // Create cache manager with max 3 entries
      const smallCacheManager = new CacheManager({ llmMaxEntries: 3 });
      
      // Add 3 entries
      await smallCacheManager.setLLMResponse('model1', 'prompt1', 'response1');
      await smallCacheManager.setLLMResponse('model2', 'prompt2', 'response2');
      await smallCacheManager.setLLMResponse('model3', 'prompt3', 'response3');
      
      // Add 4th entry - should evict oldest
      await smallCacheManager.setLLMResponse('model4', 'prompt4', 'response4');
      
      // First entry should be evicted
      const result1 = await smallCacheManager.getLLMResponse('model1', 'prompt1');
      expect(result1).toBeNull();
      
      // Recent entries should still exist
      const result4 = await smallCacheManager.getLLMResponse('model4', 'prompt4');
      expect(result4).toBe('response4');
    });

    it('Cache key generation for model + prompt', async () => {
      const model = 'gpt-4';
      const prompt = 'Test prompt';
      const response = 'Test response';

      await cacheManager.setLLMResponse(model, prompt, response);

      // Same model and prompt should return cached value
      const result1 = await cacheManager.getLLMResponse(model, prompt);
      expect(result1).toBe(response);

      // Different prompt should miss
      const result2 = await cacheManager.getLLMResponse(model, 'Different prompt');
      expect(result2).toBeNull();

      // Different model with same prompt should miss
      const result3 = await cacheManager.getLLMResponse('claude', prompt);
      expect(result3).toBeNull();
    });
  });

  // ============================================================================
  // Embedding Cache
  // ============================================================================

  describe('Embedding Cache', () => {
    it('getEmbedding() round-trip', async () => {
      const text = 'Hello world';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3, 0.4];

      await cacheManager.setEmbedding(text, model, embedding);
      const result = await cacheManager.getEmbedding(text, model);

      expect(result).toEqual(embedding);
    });

    it('getEmbedding() returns null when TTL expired', async () => {
      // Create cache manager with very short TTL
      const shortCacheManager = new CacheManager({ embeddingTTLMs: 10 });
      
      await shortCacheManager.setEmbedding('text', 'model', [0.1, 0.2]);
      
      // Wait for TTL to expire
      await sleep(20);
      
      const result = await shortCacheManager.getEmbedding('text', 'model');
      expect(result).toBeNull();
    });

    it('setEmbedding() evicts when maxEntries exceeded', async () => {
      // Create cache manager with max 3 entries
      const smallCacheManager = new CacheManager({ embeddingMaxEntries: 3 });
      
      // Add 3 entries
      await smallCacheManager.setEmbedding('text1', 'model', [0.1]);
      await smallCacheManager.setEmbedding('text2', 'model', [0.2]);
      await smallCacheManager.setEmbedding('text3', 'model', [0.3]);
      
      // Access first entry to make it recently used
      await smallCacheManager.getEmbedding('text1', 'model');
      
      // Add 4th entry - should evict LRU (text2, not text1 because it was accessed)
      await smallCacheManager.setEmbedding('text4', 'model', [0.4]);
      
      // text1 should still exist (was accessed recently)
      const result1 = await smallCacheManager.getEmbedding('text1', 'model');
      expect(result1).toEqual([0.1]);
      
      // text2 should be evicted (least recently used)
      const result2 = await smallCacheManager.getEmbedding('text2', 'model');
      expect(result2).toBeNull();
    });
  });

  // ============================================================================
  // Repo Map Cache
  // ============================================================================

  describe('Repo Map Cache', () => {
    it('getRepoMap() round-trip with matching directoryHash', async () => {
      const repoPath = '/test/repo';
      const directoryHash = 'abc123';
      const map = { files: ['a.ts', 'b.ts'], structure: {} };

      await cacheManager.setRepoMap(repoPath, directoryHash, map);
      const result = await cacheManager.getRepoMap(repoPath, directoryHash);

      expect(result).toEqual(map);
    });

    it('getRepoMap() returns null when directoryHash differs', async () => {
      const repoPath = '/test/repo';
      const originalHash = 'abc123';
      const newHash = 'def456';
      const map = { files: ['a.ts', 'b.ts'] };

      await cacheManager.setRepoMap(repoPath, originalHash, map);
      
      // Request with different hash should miss
      const result = await cacheManager.getRepoMap(repoPath, newHash);
      expect(result).toBeNull();
    });

    it('invalidateRepoMap() removes cached maps', async () => {
      const repoPath = '/test/repo';
      const directoryHash = 'abc123';
      const map = { files: ['a.ts'] };

      await cacheManager.setRepoMap(repoPath, directoryHash, map);
      
      // Verify it exists
      const before = await cacheManager.getRepoMap(repoPath, directoryHash);
      expect(before).toEqual(map);
      
      // Invalidate
      cacheManager.invalidateRepoMap(repoPath);
      
      // Verify it's gone
      const after = await cacheManager.getRepoMap(repoPath, directoryHash);
      expect(after).toBeNull();
    });

    it('invalidateRepoMap() only affects specified repo', async () => {
      const repo1 = '/test/repo1';
      const repo2 = '/test/repo2';
      const map1 = { files: ['a.ts'] };
      const map2 = { files: ['b.ts'] };

      await cacheManager.setRepoMap(repo1, 'hash1', map1);
      await cacheManager.setRepoMap(repo2, 'hash2', map2);
      
      // Invalidate only repo1
      cacheManager.invalidateRepoMap(repo1);
      
      // repo1 should be gone
      const result1 = await cacheManager.getRepoMap(repo1, 'hash1');
      expect(result1).toBeNull();
      
      // repo2 should still exist
      const result2 = await cacheManager.getRepoMap(repo2, 'hash2');
      expect(result2).toEqual(map2);
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('Statistics', () => {
    it('stats() returns correct hit/miss counts', async () => {
      // Initial stats
      const initialStats = cacheManager.stats();
      expect(initialStats.llmHits).toBe(0);
      expect(initialStats.llmMisses).toBe(0);
      expect(initialStats.embeddingHits).toBe(0);
      expect(initialStats.embeddingMisses).toBe(0);
      expect(initialStats.repoMapHits).toBe(0);
      expect(initialStats.repoMapMisses).toBe(0);

      // Cause some hits and misses
      await cacheManager.setLLMResponse('model', 'prompt', 'response');
      await cacheManager.getLLMResponse('model', 'prompt'); // hit
      await cacheManager.getLLMResponse('model', 'other'); // miss

      const stats = cacheManager.stats();
      expect(stats.llmHits).toBe(1);
      expect(stats.llmMisses).toBe(1);
    });

    it('stats().llmHitRate calculation', async () => {
      // No requests yet - should be 0
      const initialStats = cacheManager.stats();
      expect(initialStats.llmHitRate).toBe(0);

      // Add some entries
      await cacheManager.setLLMResponse('model', 'prompt1', 'response1');
      
      // 2 hits, 1 miss
      await cacheManager.getLLMResponse('model', 'prompt1'); // hit
      await cacheManager.getLLMResponse('model', 'prompt1'); // hit
      await cacheManager.getLLMResponse('model', 'prompt2'); // miss

      const stats = cacheManager.stats();
      expect(stats.llmHits).toBe(2);
      expect(stats.llmMisses).toBe(1);
      expect(stats.llmHitRate).toBe(0.67); // 2/3 rounded to 2 decimal places
    });
  });

  // ============================================================================
  // Management
  // ============================================================================

  describe('Management', () => {
    it('clearAll() resets all caches', async () => {
      // Populate caches
      await cacheManager.setLLMResponse('model', 'prompt', 'response');
      await cacheManager.setEmbedding('text', 'model', [0.1, 0.2]);
      await cacheManager.setRepoMap('/repo', 'hash', { files: [] });

      // Cause some stats
      await cacheManager.getLLMResponse('model', 'prompt');
      
      // Verify populated
      expect(await cacheManager.getLLMResponse('model', 'prompt')).not.toBeNull();
      expect(await cacheManager.getEmbedding('text', 'model')).not.toBeNull();
      
      // Clear all
      cacheManager.clearAll();
      
      // Verify cleared
      expect(await cacheManager.getLLMResponse('model', 'prompt')).toBeNull();
      expect(await cacheManager.getEmbedding('text', 'model')).toBeNull();
      
      // Cache sizes should be reset
      const stats = cacheManager.stats();
      expect(stats.llmSize).toBe(0);
      expect(stats.embeddingSize).toBe(0);
      expect(stats.repoMapSize).toBe(0);
    });
  });

  // ============================================================================
  // Singleton Factory
  // ============================================================================

  describe('Singleton Factory', () => {
    it('getCacheManager() returns same instance', () => {
      resetCacheManager();
      
      const instance1 = getCacheManager();
      const instance2 = getCacheManager();
      
      expect(instance1).toBe(instance2);
    });

    it('resetCacheManager() creates new instance on next get', () => {
      resetCacheManager();
      
      const instance1 = getCacheManager();
      resetCacheManager();
      const instance2 = getCacheManager();
      
      expect(instance1).not.toBe(instance2);
    });

    it('singleton instance maintains state across calls', async () => {
      resetCacheManager();
      
      const instance1 = getCacheManager();
      await instance1.setLLMResponse('model', 'prompt', 'response');
      
      const instance2 = getCacheManager();
      const result = await instance2.getLLMResponse('model', 'prompt');
      
      expect(result).toBe('response');
    });
  });
});
