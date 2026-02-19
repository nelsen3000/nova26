// Perplexity Research Integration Types — KIMI-PERP-01

export interface PerplexityResearchBrief {
  queryId: string;
  timestamp: string;
  originalQuery: string;
  synthesizedAnswer: string;
  keyFindings: string[];
  sources: Array<{
    title: string;
    url: string;
    reliability: number;
    snippet: string;
  }>;
  novaRelevanceScore: number; // 0-100, ATLAS-scored
  suggestedNextActions: string[];
  tags: string[];
  tasteVaultPersonalization: string;
}

export interface PerplexityToolConfig {
  apiKey: string;
  model: 'sonar' | 'sonar-pro' | 'sonar-reasoning';
  maxTokens: number;
  temperature: number;
  cacheTTL: number; // minutes
  fallbackOnError: boolean;
}

export interface PerplexityAPIResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations?: string[];
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
    delta?: {
      role?: string;
      content?: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CachedResearch {
  brief: PerplexityResearchBrief;
  cachedAt: number;
  expiresAt: number;
}

export const DEFAULT_PERPLEXITY_CONFIG: PerplexityToolConfig = {
  apiKey: '',
  model: 'sonar',
  maxTokens: 2048,
  temperature: 0.2,
  cacheTTL: 60, // 1 hour
  fallbackOnError: true,
};
