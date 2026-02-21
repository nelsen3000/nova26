/**
 * Perplexity Intelligence Division — Research Agent
 * Spec: .nova/specs/perplexity-integration.md
 *
 * Uses the OpenAI-compatible Perplexity API to perform real-time,
 * cited web research for all 21 Nova26 agents.
 */

import { createHash } from 'crypto';
import type {
  CacheEntry,
  CacheStats,
  PerplexityApiResponse,
  PerplexityResearchBrief,
  PerplexitySource,
  PerplexityToolConfig,
  ResearchOptions,
} from './types.js';
import {
  PerplexityError,
  PerplexityRateLimitError,
  PerplexityServerError,
  PerplexityTimeoutError,
} from './types.js';

const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';
const DEFAULT_TIMEOUT_MS = 30_000;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function buildQueryId(query: string, model: string): string {
  return createHash('sha256').update(`${model}:${query}`).digest('hex').slice(0, 16);
}

function computeRelevanceScore(answer: string, sources: PerplexitySource[]): number {
  let score = 50; // base

  // Boost for source count
  score += Math.min(sources.length * 5, 25);

  // Boost for longer, detailed answers
  if (answer.length > 500) score += 10;
  if (answer.length > 1000) score += 10;

  // Boost for Nova26-relevant keywords
  const novaKeywords = ['agent', 'AI', 'build', 'deploy', 'code', 'LLM', 'API', 'Nova26'];
  const lowerAnswer = answer.toLowerCase();
  for (const kw of novaKeywords) {
    if (lowerAnswer.includes(kw.toLowerCase())) score += 1;
  }

  return Math.min(100, Math.max(0, score));
}

function extractKeyFindings(answer: string): string[] {
  const sentences = answer
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 300);

  // Prefer sentences that start with action words or contain numbers
  const scored = sentences.map((s) => {
    let weight = 0;
    if (/^(use|avoid|ensure|note|key|important|critical|best)/i.test(s)) weight += 2;
    if (/\d/.test(s)) weight += 1;
    if (s.length < 150) weight += 1;
    return { s, weight };
  });

  return scored
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(({ s }) => s);
}

function extractSuggestedActions(answer: string, tags: string[]): string[] {
  const actions: string[] = [];
  if (tags.includes('deployment') || tags.includes('build')) {
    actions.push('Review deployment configuration based on findings');
  }
  if (tags.includes('security')) {
    actions.push('Run PLUTO security scan with updated threat intelligence');
  }
  if (answer.toLowerCase().includes('update') || answer.toLowerCase().includes('upgrade')) {
    actions.push('Check for dependency updates mentioned in findings');
  }
  actions.push('Ingest brief into ATLAS GraphMemory for future retrieval');
  return actions;
}

function sourcesFromCitations(citations: string[] = []): PerplexitySource[] {
  return citations.map((url, i) => ({
    title: `Source ${i + 1}`,
    url,
    snippet: '',
    reliability: 0.8,
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// PerplexityAgent
// ──────────────────────────────────────────────────────────────────────────────

export class PerplexityAgent {
  private readonly config: PerplexityToolConfig;
  private readonly cache = new Map<string, CacheEntry>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private rateLimitedUntil = 0;

  constructor(config: PerplexityToolConfig) {
    this.config = config;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async research(
    query: string,
    options: ResearchOptions = {}
  ): Promise<PerplexityResearchBrief> {
    const model = options.model ?? this.config.model;
    const queryId = buildQueryId(query, model);
    const tags = options.tags ?? this.inferTags(query);

    // Cache check
    if (!options.bypassCache) {
      const cached = this.getFromCache(queryId);
      if (cached) return cached;
    }

    // Rate limit check
    if (Date.now() < this.rateLimitedUntil) {
      if (this.config.fallbackOnError) {
        return this.buildFallbackBrief(queryId, query, tags);
      }
      throw new PerplexityRateLimitError(this.rateLimitedUntil - Date.now());
    }

    try {
      const apiResponse = await this.callApi(query, model);
      const brief = this.buildBrief(queryId, query, apiResponse, tags);
      this.setInCache(queryId, brief);
      return brief;
    } catch (err) {
      if (this.config.fallbackOnError && !(err instanceof PerplexityRateLimitError)) {
        return this.buildFallbackBrief(queryId, query, tags);
      }
      throw err;
    }
  }

  /** Alias kept for backwards compat with mega-sprint prompt */
  async researchTopic(topic: string, options?: ResearchOptions): Promise<PerplexityResearchBrief> {
    return this.research(topic, options);
  }

  getCacheStats(): CacheStats {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.cache.size,
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async callApi(query: string, model: string): Promise<PerplexityApiResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are a research assistant for Nova26, an AI-powered IDE. Provide concise, accurate, cited answers. Focus on actionable insights for software builders.',
            },
            { role: 'user', content: query },
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          return_citations: true,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new PerplexityTimeoutError();
      }
      throw new PerplexityError(
        `Network error: ${(err as Error).message}`,
        'NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') ?? '60', 10) * 1000;
      this.rateLimitedUntil = Date.now() + retryAfter;
      throw new PerplexityRateLimitError(retryAfter);
    }

    if (!response.ok) {
      throw new PerplexityServerError(response.status, `HTTP ${response.status}`);
    }

    return (await response.json()) as PerplexityApiResponse;
  }

  private buildBrief(
    queryId: string,
    query: string,
    apiResponse: PerplexityApiResponse,
    tags: string[]
  ): PerplexityResearchBrief {
    const answer = apiResponse.choices[0]?.message?.content ?? '';
    const sources = sourcesFromCitations(apiResponse.citations);
    const keyFindings = extractKeyFindings(answer);
    const novaRelevanceScore = computeRelevanceScore(answer, sources);
    const suggestedNextActions = extractSuggestedActions(answer, tags);

    return {
      queryId,
      timestamp: new Date().toISOString(),
      originalQuery: query,
      synthesizedAnswer: answer,
      keyFindings,
      sources,
      novaRelevanceScore,
      suggestedNextActions,
      tags,
      tasteVaultPersonalization: '',
    };
  }

  private buildFallbackBrief(
    queryId: string,
    query: string,
    tags: string[]
  ): PerplexityResearchBrief {
    return {
      queryId,
      timestamp: new Date().toISOString(),
      originalQuery: query,
      synthesizedAnswer: `[Perplexity unavailable] Cached or offline response for: ${query}`,
      keyFindings: ['Research service temporarily unavailable — using fallback'],
      sources: [],
      novaRelevanceScore: 0,
      suggestedNextActions: ['Retry when Perplexity API is available'],
      tags,
      tasteVaultPersonalization: '',
    };
  }

  private getFromCache(queryId: string): PerplexityResearchBrief | null {
    const entry = this.cache.get(queryId);
    if (!entry) {
      this.cacheMisses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(queryId);
      this.cacheMisses++;
      return null;
    }
    this.cacheHits++;
    return entry.brief;
  }

  private setInCache(queryId: string, brief: PerplexityResearchBrief): void {
    const expiresAt = Date.now() + this.config.cacheTTL * 60 * 1000;
    this.cache.set(queryId, { brief, expiresAt });
  }

  private inferTags(query: string): string[] {
    const lower = query.toLowerCase();
    const tags: string[] = [];
    if (lower.includes('secur') || lower.includes('vuln')) tags.push('security');
    if (lower.includes('deploy') || lower.includes('build')) tags.push('deployment');
    if (lower.includes('perf') || lower.includes('optim')) tags.push('performance');
    if (lower.includes('mobile') || lower.includes('expo')) tags.push('mobile');
    if (lower.includes('test') || lower.includes('qa')) tags.push('testing');
    if (tags.length === 0) tags.push('general');
    return tags;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Singleton factory
// ──────────────────────────────────────────────────────────────────────────────

let _instance: PerplexityAgent | null = null;

export function createPerplexityAgent(config: PerplexityToolConfig): PerplexityAgent {
  _instance = new PerplexityAgent(config);
  return _instance;
}

export function getPerplexityAgent(config?: PerplexityToolConfig): PerplexityAgent | null {
  if (_instance) return _instance;
  if (config) return createPerplexityAgent(config);
  const apiKey = process.env.PERPLEXITY_API_KEY;
  const enabled = process.env.PERPLEXITY_ENABLED === 'true';
  if (!apiKey || !enabled) return null;
  return createPerplexityAgent({
    apiKey,
    model: 'sonar',
    maxTokens: 1024,
    temperature: 0.2,
    cacheTTL: 60,
    fallbackOnError: true,
  });
}

export function resetPerplexityAgent(): void {
  _instance = null;
}
