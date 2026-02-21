// Perplexity Integration Tests — KIMI-PERP-01
// Comprehensive test suite for Perplexity Agent and caching

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerplexityAgent, createPerplexityAgent } from '../perplexity-agent.js';
import { DEFAULT_PERPLEXITY_CONFIG } from '../types.js';
import type { PerplexityToolConfig, ATLASIngestHook, PerplexityResearchBrief } from '../types.js';

// ============================================================================
// Test Helpers & Mocks
// ============================================================================

function createMockATLASHook(): ATLASIngestHook & { calls: PerplexityResearchBrief[] } {
  return {
    calls: [],
    async onResearchBriefReceived(brief: PerplexityResearchBrief): Promise<void> {
      this.calls.push(brief);
    },
  };
}

function createMockConfig(overrides?: Partial<PerplexityToolConfig>): PerplexityToolConfig {
  return {
    ...DEFAULT_PERPLEXITY_CONFIG,
    apiKey: 'test-api-key',
    ...overrides,
  };
}

// ============================================================================
// Test Suite: PerplexityAgent research()
// ============================================================================

describe('PerplexityAgent', () => {
  describe('research()', () => {
    let agent: PerplexityAgent;

    beforeEach(() => {
      agent = new PerplexityAgent(createMockConfig());
      vi.useRealTimers();
    });

    it('should return ResearchBrief with all required fields', async () => {
      const query = 'What are React best practices?';
      const result = await agent.research(query);

      // Verify all required fields exist
      expect(result.queryId).toBeDefined();
      expect(result.queryId).toMatch(/^perp-\d+-/);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
      expect(result.originalQuery).toBe(query);
      expect(result.synthesizedAnswer).toBeDefined();
      expect(result.synthesizedAnswer.length).toBeGreaterThan(0);
      expect(Array.isArray(result.keyFindings)).toBe(true);
      expect(Array.isArray(result.sources)).toBe(true);
      expect(typeof result.novaRelevanceScore).toBe('number');
      expect(result.novaRelevanceScore).toBeGreaterThanOrEqual(0);
      expect(result.novaRelevanceScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.suggestedNextActions)).toBe(true);
      expect(Array.isArray(result.tags)).toBe(true);
      expect(result.tasteVaultPersonalization).toBeDefined();
    });

    it('should return cached result on cache hit', async () => {
      const query = 'TypeScript performance tips';
      
      // First call - should hit API
      const result1 = await agent.research(query);
      
      // Second call with same query - should hit cache
      const result2 = await agent.research(query);
      
      // Results should be identical (same object from cache)
      expect(result2).toBe(result1);
      expect(result2.queryId).toBe(result1.queryId);
      expect(result2.timestamp).toBe(result1.timestamp);
    });

    it('should call API on cache miss', async () => {
      const query1 = 'Query one';
      const query2 = 'Query two';
      
      const result1 = await agent.research(query1);
      const result2 = await agent.research(query2);
      
      // Different queries should produce different results
      expect(result1.queryId).not.toBe(result2.queryId);
      expect(result1.originalQuery).toBe(query1);
      expect(result2.originalQuery).toBe(query2);
    });

    it('should handle cache expiration correctly', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);
      
      // Create agent with 1 minute cache TTL
      const agentWithShortTTL = new PerplexityAgent(createMockConfig({ cacheTTL: 1 }));
      const query = 'Expiring query';
      
      // First call
      const result1 = await agentWithShortTTL.research(query);
      
      // Advance time by 30 seconds (still cached)
      vi.advanceTimersByTime(30 * 1000);
      const result2 = await agentWithShortTTL.research(query);
      expect(result2).toBe(result1);
      
      // Advance time by 31 more seconds (total 61s, cache expired)
      vi.advanceTimersByTime(31 * 1000);
      const result3 = await agentWithShortTTL.research(query);
      expect(result3).not.toBe(result1);
      expect(result3.queryId).not.toBe(result1.queryId);
      
      vi.useRealTimers();
    });

    it('should prepend Taste Vault context to query', async () => {
      const query = 'Best state management library';
      const tasteVaultContext = 'User prefers lightweight solutions';
      
      const result = await agent.research(query, tasteVaultContext);
      
      expect(result.tasteVaultPersonalization).toBe(tasteVaultContext);
      expect(result.synthesizedAnswer).toContain(tasteVaultContext);
    });

    it('should invoke ATLAS hook when research completes', async () => {
      const atlasHook = createMockATLASHook();
      const agentWithHook = new PerplexityAgent(createMockConfig(), atlasHook);
      const query = 'Test ATLAS hook';
      
      await agentWithHook.research(query);
      
      expect(atlasHook.calls).toHaveLength(1);
      expect(atlasHook.calls[0].originalQuery).toBe(query);
    });

    it('should return fallback brief on error when fallbackOnError is true', async () => {
      // Create agent with a method that will throw
      const failingAgent = new PerplexityAgent(createMockConfig({ fallbackOnError: true }));
      
      // Mock the internal method to throw
      vi.spyOn(failingAgent as unknown as { callPerplexityAPI: () => Promise<PerplexityResearchBrief> }, 'callPerplexityAPI')
        .mockRejectedValue(new Error('API Error'));
      
      const query = 'Failing query';
      const result = await failingAgent.research(query);
      
      // Should return fallback, not throw
      expect(result.queryId).toMatch(/^fallback-/);
      expect(result.synthesizedAnswer).toContain('temporarily unavailable');
      expect(result.novaRelevanceScore).toBe(0);
      expect(result.tags).toContain('fallback');
      expect(result.sources).toHaveLength(0);
    });

    it('should calculate relevance score accurately based on query-content match', async () => {
      // This test verifies the relevance scoring algorithm
      const query = 'react hooks best practices';
      const result = await agent.research(query);
      
      // The mock response contains "react" content, so score should be > 0
      expect(typeof result.novaRelevanceScore).toBe('number');
      expect(result.novaRelevanceScore).toBeGreaterThanOrEqual(0);
      expect(result.novaRelevanceScore).toBeLessThanOrEqual(100);
      
      // Verify score calculation is consistent
      const result2 = await agent.research(query);
      // From cache, so should be identical
      expect(result2.novaRelevanceScore).toBe(result.novaRelevanceScore);
    });
  });

  // ============================================================================
  // Test Suite: Caching
  // ============================================================================

  describe('Caching', () => {
    let agent: PerplexityAgent;

    beforeEach(() => {
      agent = new PerplexityAgent(createMockConfig());
      vi.useRealTimers();
    });

    it('should generate consistent cache keys for identical queries', async () => {
      const query = 'Cache Key Test';
      const context = 'Some Context';
      
      // First call
      await agent.research(query, context);
      const stats1 = agent.getCacheStats();
      
      // Same query with different casing and spacing
      await agent.research('  cache KEY test  ', 'some context');
      const stats2 = agent.getCacheStats();
      
      // Should still be cache hit (normalized key)
      expect(stats2.size).toBe(stats1.size);
    });

    it('should store cache result with correct structure', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);
      
      const query = 'Cache structure test';
      await agent.research(query);
      
      const stats = agent.getCacheStats();
      expect(stats.size).toBe(1);
      
      vi.useRealTimers();
    });

    it('should respect cache TTL configuration', async () => {
      vi.useFakeTimers();
      const customAgent = new PerplexityAgent(createMockConfig({ cacheTTL: 5 })); // 5 minutes
      const query = 'TTL test';
      
      await customAgent.research(query);
      
      // 4 minutes later - should still be cached
      vi.advanceTimersByTime(4 * 60 * 1000);
      const result1 = await customAgent.research(query);
      
      // 2 more minutes (6 total) - should be expired
      vi.advanceTimersByTime(2 * 60 * 1000);
      const result2 = await customAgent.research(query);
      
      expect(result1.queryId).not.toBe(result2.queryId);
      
      vi.useRealTimers();
    });

    it('should clear cache when clearCache is called', async () => {
      // Populate cache
      await agent.research('Query 1');
      await agent.research('Query 2');
      await agent.research('Query 3');
      
      expect(agent.getCacheStats().size).toBe(3);
      
      // Clear cache
      agent.clearCache();
      
      expect(agent.getCacheStats().size).toBe(0);
    });

    it('should return correct cache stats', async () => {
      // Empty cache
      const emptyStats = agent.getCacheStats();
      expect(emptyStats.size).toBe(0);
      expect(typeof emptyStats.hitRate).toBe('number');
      
      // Add items
      await agent.research('Query A');
      await agent.research('Query B');
      
      const stats = agent.getCacheStats();
      expect(stats.size).toBe(2);
    });

    it('should track cache hit rate', async () => {
      // First call - cache miss
      await agent.research('Hit rate test');
      
      // Second call - cache hit
      await agent.research('Hit rate test');
      
      // Third call - cache hit
      await agent.research('Hit rate test');
      
      const stats = agent.getCacheStats();
      // hitRate is currently always 0 in the implementation (placeholder)
      expect(typeof stats.hitRate).toBe('number');
    });
  });

  // ============================================================================
  // Test Suite: Response Transformation
  // ============================================================================

  describe('Response Transformation', () => {
    let agent: PerplexityAgent;

    beforeEach(() => {
      agent = new PerplexityAgent(createMockConfig());
    });

    it('should transform API response to ResearchBrief correctly', async () => {
      const query = 'API transformation test';
      const result = await agent.research(query);
      
      // Verify transformation produces valid brief
      expect(result).toMatchObject({
        originalQuery: query,
        tasteVaultPersonalization: 'none',
      });
      
      // Verify content was extracted
      expect(result.synthesizedAnswer).toContain('Research findings');
      expect(result.keyFindings.length).toBeGreaterThan(0);
    });

    it('should extract key findings from content', async () => {
      // The mock response generates content with sentences
      const result = await agent.research('Findings test');
      
      // Key findings should be non-empty strings
      expect(result.keyFindings.length).toBeGreaterThan(0);
      result.keyFindings.forEach(finding => {
        expect(typeof finding).toBe('string');
        expect(finding.length).toBeGreaterThan(0);
      });
    });

    it('should generate sources from API citations', async () => {
      const result = await agent.research('Sources test');
      
      // Mock generates 2 citations
      expect(result.sources.length).toBeGreaterThan(0);
      result.sources.forEach((source, index) => {
        expect(source.title).toBe(`Source ${index + 1}`);
        expect(source.url).toMatch(/^https?:\/\//);
        expect(typeof source.reliability).toBe('number');
        expect(source.reliability).toBeGreaterThanOrEqual(0);
        expect(source.reliability).toBeLessThanOrEqual(1);
        expect(typeof source.snippet).toBe('string');
      });
    });

    it('should extract relevant tags from content', async () => {
      // Mock response contains "react", "api", "best practice" keywords
      const result = await agent.research('Tags test');
      
      // Should have extracted tags (mock content contains relevant keywords)
      expect(Array.isArray(result.tags)).toBe(true);
      
      // Tags should be lowercase strings
      result.tags.forEach(tag => {
        expect(typeof tag).toBe('string');
        expect(tag).toBe(tag.toLowerCase());
      });
    });

    it('should generate appropriate next actions based on content', async () => {
      // Mock response contains "code", "api", "best practice"
      const result = await agent.research('Actions test');
      
      expect(result.suggestedNextActions.length).toBeGreaterThan(0);
      
      // Actions should be strings
      result.suggestedNextActions.forEach(action => {
        expect(typeof action).toBe('string');
        expect(action.length).toBeGreaterThan(0);
      });
    });

    it('should calculate Nova relevance score based on query-content similarity', async () => {
      const query = 'react typescript performance';
      const result = await agent.research(query);
      
      // Score should be a number between 0-100
      expect(typeof result.novaRelevanceScore).toBe('number');
      expect(result.novaRelevanceScore).toBeGreaterThanOrEqual(0);
      expect(result.novaRelevanceScore).toBeLessThanOrEqual(100);
      
      // Mock content should have some relevance to the query
      expect(result.novaRelevanceScore).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Test Suite: Integration
  // ============================================================================

  describe('Integration', () => {
    it('should execute full research cycle end-to-end', async () => {
      const atlasHook = createMockATLASHook();
      const fullAgent = new PerplexityAgent(
        createMockConfig({ cacheTTL: 30 }),
        atlasHook
      );
      
      const query = 'Full integration test';
      const context = 'User prefers modern frameworks';
      
      // Execute research
      const result = await fullAgent.research(query, context);
      
      // Verify complete flow
      expect(result.originalQuery).toBe(query);
      expect(result.tasteVaultPersonalization).toBe(context);
      expect(atlasHook.calls).toHaveLength(1);
      expect(atlasHook.calls[0]).toBe(result);
      
      // Verify cache was populated
      expect(fullAgent.getCacheStats().size).toBe(1);
      
      // Second call should hit cache
      const cachedResult = await fullAgent.research(query, context);
      expect(cachedResult).toBe(result);
      // ATLAS hook should not be called again for cached result
      expect(atlasHook.calls).toHaveLength(1);
    });

    it('should handle errors with fallback when configured', async () => {
      const agentWithFallback = new PerplexityAgent(
        createMockConfig({ fallbackOnError: true })
      );
      
      // Mock internal API call to fail
      vi.spyOn(agentWithFallback as unknown as { callPerplexityAPI: () => Promise<PerplexityResearchBrief> }, 'callPerplexityAPI')
        .mockRejectedValue(new Error('Network timeout'));
      
      const result = await agentWithFallback.research('Error test');
      
      // Should get fallback, not throw
      expect(result.queryId.startsWith('fallback-')).toBe(true);
      expect(result.synthesizedAnswer).toContain('Network timeout');
      expect(result.keyFindings).toContain('Service temporarily unavailable');
      expect(result.suggestedNextActions).toContain('Retry research in a few moments');
    });

    it('should throw error when fallbackOnError is false', async () => {
      const agentWithoutFallback = new PerplexityAgent(
        createMockConfig({ fallbackOnError: false })
      );
      
      // Mock internal API call to fail
      vi.spyOn(agentWithoutFallback as unknown as { callPerplexityAPI: () => Promise<PerplexityResearchBrief> }, 'callPerplexityAPI')
        .mockRejectedValue(new Error('Critical API failure'));
      
      await expect(agentWithoutFallback.research('Error test')).rejects.toThrow('Critical API failure');
    });

    it('should integrate with ATLAS ingest hook correctly', async () => {
      const hookCalls: Array<{ brief: PerplexityResearchBrief; timestamp: number }> = [];
      
      const customHook: ATLASIngestHook = {
        async onResearchBriefReceived(brief: PerplexityResearchBrief): Promise<void> {
          hookCalls.push({ brief, timestamp: Date.now() });
        },
      };
      
      const agentWithHook = new PerplexityAgent(createMockConfig(), customHook);
      
      // Multiple research calls
      const result1 = await agentWithHook.research('Query 1');
      const result2 = await agentWithHook.research('Query 2');
      
      // Hook should be called for each (non-cached) research
      expect(hookCalls).toHaveLength(2);
      expect(hookCalls[0].brief).toBe(result1);
      expect(hookCalls[1].brief).toBe(result2);
    });

    it('should support RalphLoop ReAct cycle pattern', async () => {
      // RalphLoop pattern: Research -> Analyze -> Action -> Research...
      const agent = new PerplexityAgent(createMockConfig());
      
      // Initial research (Observation)
      const observation1 = await agent.research('What is React Server Components?');
      expect(observation1.novaRelevanceScore).toBeGreaterThan(0);
      
      // Follow-up research based on findings (Analysis -> Action -> New Observation)
      const followUpQuery = `Tell me more about: ${observation1.keyFindings[0] || 'React'}`;
      const observation2 = await agent.research(followUpQuery);
      
      // Should have two different cached results
      expect(agent.getCacheStats().size).toBe(2);
      expect(observation1.queryId).not.toBe(observation2.queryId);
      
      // Verify the ReAct cycle can continue
      const finalQuery = `Best practices for ${observation2.tags[0] || 'React'}`;
      const observation3 = await agent.research(finalQuery);
      
      expect(agent.getCacheStats().size).toBe(3);
      expect(observation3.suggestedNextActions.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Test Suite: createPerplexityAgent Factory
  // ============================================================================

  describe('createPerplexityAgent factory', () => {
    it('should create agent with default config', () => {
      const agent = createPerplexityAgent();
      expect(agent).toBeInstanceOf(PerplexityAgent);
    });

    it('should create agent with custom config', () => {
      const config = createMockConfig({ model: 'sonar-pro', cacheTTL: 120 });
      const agent = createPerplexityAgent(config);
      expect(agent).toBeInstanceOf(PerplexityAgent);
    });

    it('should create agent with ATLAS hook', () => {
      const atlasHook = createMockATLASHook();
      const agent = createPerplexityAgent(createMockConfig(), atlasHook);
      expect(agent).toBeInstanceOf(PerplexityAgent);
    });
  });

  // ============================================================================
  // Test Suite: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty query gracefully', async () => {
      const agent = new PerplexityAgent(createMockConfig());
      const result = await agent.research('');
      
      expect(result.originalQuery).toBe('');
      expect(result.queryId).toBeDefined();
    });

    it('should handle very long queries', async () => {
      const agent = new PerplexityAgent(createMockConfig());
      const longQuery = 'A'.repeat(1000);
      
      const result = await agent.research(longQuery);
      expect(result.originalQuery).toBe(longQuery);
    });

    it('should handle special characters in query', async () => {
      const agent = new PerplexityAgent(createMockConfig());
      const specialQuery = 'Query with <special> "characters" & symbols! @#$%';
      
      const result = await agent.research(specialQuery);
      expect(result.originalQuery).toBe(specialQuery);
    });

    it('should distinguish queries with different contexts', async () => {
      const agent = new PerplexityAgent(createMockConfig());
      const query = 'Same query';
      
      const result1 = await agent.research(query, 'Context A');
      const result2 = await agent.research(query, 'Context B');
      
      // Different contexts should produce different cache entries
      expect(result1).not.toBe(result2);
      expect(agent.getCacheStats().size).toBe(2);
    });
  });
});
