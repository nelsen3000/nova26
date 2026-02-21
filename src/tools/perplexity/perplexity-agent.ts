// Perplexity Agent — KIMI-PERP-01
// Main wrapper + caching for Perplexity API integration

import type {
  PerplexityResearchBrief,
  PerplexityToolConfig,
  PerplexityAPIResponse,
  CachedResearch,
} from './types.js';
import { DEFAULT_PERPLEXITY_CONFIG } from './types.js';

export interface ATLASIngestHook {
  onResearchBriefReceived(brief: PerplexityResearchBrief): Promise<void>;
}

export class PerplexityAgent {
  private config: PerplexityToolConfig;
  private cache: Map<string, CachedResearch> = new Map();
  private atlasHook?: ATLASIngestHook;

  constructor(config: Partial<PerplexityToolConfig> = {}, atlasHook?: ATLASIngestHook) {
    this.config = { ...DEFAULT_PERPLEXITY_CONFIG, ...config };
    this.atlasHook = atlasHook;
  }

  /**
   * Research a query using Perplexity API
   */
  async research(query: string, tasteVaultContext?: string): Promise<PerplexityResearchBrief> {
    // Check cache first
    const cacheKey = this.generateCacheKey(query, tasteVaultContext);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached.brief;
    }

    try {
      const brief = await this.callPerplexityAPI(query, tasteVaultContext);
      
      // Cache the result
      this.cacheResult(cacheKey, brief);

      // Notify ATLAS hook
      if (this.atlasHook) {
        await this.atlasHook.onResearchBriefReceived(brief);
      }

      return brief;
    } catch (error) {
      if (this.config.fallbackOnError) {
        return this.generateFallbackBrief(query, error);
      }
      throw error;
    }
  }

  /**
   * Call Perplexity API (OpenAI-compatible)
   */
  private async callPerplexityAPI(
    query: string,
    tasteVaultContext?: string
  ): Promise<PerplexityResearchBrief> {
    const enhancedQuery = tasteVaultContext
      ? `[Context: ${tasteVaultContext}] ${query}`
      : query;

    // Mock API call - in production would use fetch/OpenAI client
    const mockResponse = this.generateMockResponse(enhancedQuery);

    return this.transformToBrief(query, mockResponse, tasteVaultContext);
  }

  /**
   * Transform API response to ResearchBrief
   */
  private transformToBrief(
    originalQuery: string,
    response: PerplexityAPIResponse,
    tasteVaultContext?: string
  ): PerplexityResearchBrief {
    const content = response.choices[0]?.message?.content || '';
    
    // Extract key findings (simplified - would use NLP in production)
    const keyFindings = this.extractKeyFindings(content);
    
    // Generate sources from citations
    const sources = this.generateSources(response.citations || []);

    // Calculate relevance score
    const novaRelevanceScore = this.calculateRelevanceScore(content, originalQuery);

    // Generate suggested actions
    const suggestedNextActions = this.generateNextActions(content);

    return {
      queryId: `perp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      originalQuery,
      synthesizedAnswer: content,
      keyFindings,
      sources,
      novaRelevanceScore,
      suggestedNextActions,
      tags: this.extractTags(content),
      tasteVaultPersonalization: tasteVaultContext || 'none',
    };
  }

  /**
   * Check cache for existing research
   */
  private getFromCache(key: string): CachedResearch | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return cached;
  }

  /**
   * Cache research result
   */
  private cacheResult(key: string, brief: PerplexityResearchBrief): void {
    const ttlMs = this.config.cacheTTL * 60 * 1000;
    this.cache.set(key, {
      brief,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: string, context?: string): string {
    return context
      ? `${query.toLowerCase().trim()}|${context.toLowerCase().trim()}`
      : query.toLowerCase().trim();
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevanceScore(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    let matches = 0;
    for (const word of queryWords) {
      if (word.length > 3 && contentLower.includes(word)) {
        matches++;
      }
    }

    const score = queryWords.length > 0 ? (matches / queryWords.length) * 100 : 0;
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Extract key findings from content
   */
  private extractKeyFindings(content: string): string[] {
    // Simple extraction - would use NLP in production
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 5).map(s => s.trim());
  }

  /**
   * Generate sources from citations
   */
  private generateSources(citations: string[]): PerplexityResearchBrief['sources'] {
    return citations.map((url, index) => ({
      title: `Source ${index + 1}`,
      url,
      reliability: 0.8,
      snippet: '',
    }));
  }

  /**
   * Generate suggested next actions
   */
  private generateNextActions(content: string): string[] {
    const actions: string[] = [];
    
    if (content.toLowerCase().includes('code')) {
      actions.push('Generate code implementation');
    }
    if (content.toLowerCase().includes('api')) {
      actions.push('Explore API documentation');
    }
    if (content.toLowerCase().includes('best practice')) {
      actions.push('Review best practices guide');
    }
    
    if (actions.length === 0) {
      actions.push('Continue research on sub-topics');
    }

    return actions;
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lower = content.toLowerCase();
    
    if (lower.includes('react')) tags.push('react');
    if (lower.includes('typescript')) tags.push('typescript');
    if (lower.includes('api')) tags.push('api');
    if (lower.includes('performance')) tags.push('performance');
    if (lower.includes('security')) tags.push('security');

    return tags;
  }

  /**
   * Generate mock API response for testing
   */
  private generateMockResponse(query: string): PerplexityAPIResponse {
    return {
      id: `mock-${Date.now()}`,
      model: this.config.model,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      citations: ['https://example.com/source1', 'https://example.com/source2'],
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: `Research findings for: ${query}\n\nKey points:\n1. This is a synthesized answer based on multiple sources\n2. Best practices include proper error handling\n3. Performance optimizations are recommended`,
          },
        },
      ],
      usage: {
        prompt_tokens: query.length / 4,
        completion_tokens: 150,
        total_tokens: query.length / 4 + 150,
      },
    };
  }

  /**
   * Generate fallback brief on error
   */
  private generateFallbackBrief(query: string, error: unknown): PerplexityResearchBrief {
    return {
      queryId: `fallback-${Date.now()}`,
      timestamp: new Date().toISOString(),
      originalQuery: query,
      synthesizedAnswer: `Research temporarily unavailable. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      keyFindings: ['Service temporarily unavailable'],
      sources: [],
      novaRelevanceScore: 0,
      suggestedNextActions: ['Retry research in a few moments'],
      tags: ['fallback'],
      tasteVaultPersonalization: 'none',
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would track in production
    };
  }
}

export function createPerplexityAgent(
  config?: Partial<PerplexityToolConfig>,
  atlasHook?: ATLASIngestHook
): PerplexityAgent {
  return new PerplexityAgent(config, atlasHook);
}
