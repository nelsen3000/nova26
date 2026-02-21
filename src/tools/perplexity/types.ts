/**
 * Perplexity Intelligence Division — Type Definitions
 * Spec: .nova/specs/perplexity-integration.md
 */

export interface PerplexityResearchBrief {
  queryId: string;
  timestamp: string;
  originalQuery: string;
  synthesizedAnswer: string;
  keyFindings: string[];
  sources: Array<{
    title: string;
    url: string;
    reliability: number;  // 0-1
    snippet: string;
  }>;
  novaRelevanceScore: number;       // 0-100, ATLAS-scored
  suggestedNextActions: string[];
  tags: string[];
  tasteVaultPersonalization: string;
}

export interface PerplexityToolConfig {
  apiKey: string;
  model: 'sonar' | 'sonar-pro' | 'sonar-reasoning';
  maxTokens: number;
  temperature: number;
  cacheTTL: number;                 // minutes
  fallbackOnError: boolean;
}

export interface ResearchOptions {
  model?: PerplexityToolConfig['model'];
  tags?: string[];
  maxSources?: number;
  bypassCache?: boolean;
}

export interface CacheEntry {
  brief: PerplexityResearchBrief;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export interface PerplexitySource {
  title: string;
  url: string;
  snippet: string;
}

export interface PerplexityMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface PerplexityApiResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PerplexityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'PerplexityError';
  }
}

export class PerplexityRateLimitError extends PerplexityError {
  constructor(public readonly retryAfterMs: number) {
    super(`Rate limited — retry after ${retryAfterMs}ms`, 'RATE_LIMITED', 429);
    this.name = 'PerplexityRateLimitError';
  }
}

export class PerplexityServerError extends PerplexityError {
  constructor(statusCode: number, message: string) {
    super(message, 'SERVER_ERROR', statusCode);
    this.name = 'PerplexityServerError';
  }
}

export class PerplexityTimeoutError extends PerplexityError {
  constructor() {
    super('Request timed out', 'TIMEOUT');
    this.name = 'PerplexityTimeoutError';
  }
}
