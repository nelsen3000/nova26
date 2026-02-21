// Perplexity Client - Core API Integration for NOVA26
// Provides search capabilities using Perplexity's Sonar API

import { z } from 'zod';
import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// Error Classes
// ═══════════════════════════════════════════════════════════════════════════════

export class PerplexityAuthError extends Error {
  constructor(message: string = 'Perplexity API authentication failed') {
    super(message);
    this.name = 'PerplexityAuthError';
  }
}

export class PerplexityTimeoutError extends Error {
  constructor(message: string = 'Perplexity API request timed out') {
    super(message);
    this.name = 'PerplexityTimeoutError';
  }
}

export class PerplexityRateLimitError extends Error {
  constructor(
    message: string = 'Perplexity API rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'PerplexityRateLimitError';
  }
}

export class PerplexityServerError extends Error {
  constructor(
    message: string = 'Perplexity API server error',
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'PerplexityServerError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Zod Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const CitationSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string().optional(),
  date: z.string().optional(),
});

export const SearchOptionsSchema = z.object({
  maxTokens: z.number().int().min(1).max(4096).optional(),
  temperature: z.number().min(0).max(2).optional(),
  searchDomain: z.array(z.string()).optional(),
  returnCitations: z.boolean().optional(),
  searchRecency: z.enum(['day', 'week', 'month', 'year']).optional(),
});

export const PerplexityRequestSchema = z.object({
  model: z.literal('sonar'),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  max_tokens: z.number().int().optional(),
  temperature: z.number().optional(),
  search_domain_filter: z.array(z.string()).optional(),
  return_citations: z.boolean().optional(),
  search_recency_filter: z.enum(['day', 'week', 'month', 'year']).optional(),
});

export const PerplexityResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(z.object({
    message: z.object({
      role: z.string(),
      content: z.string(),
    }),
    finish_reason: z.string(),
  })),
  citations: z.array(z.object({
    title: z.string().optional(),
    url: z.string().optional(),
  })).optional(),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
});

export const SearchResultSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema),
  confidence: z.number().min(0).max(1),
  model: z.string(),
  tokensUsed: z.number(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TypeScript Types
// ═══════════════════════════════════════════════════════════════════════════════

export type Citation = z.infer<typeof CitationSchema>;
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;
export type PerplexityRequest = z.infer<typeof PerplexityRequestSchema>;
export type PerplexityResponse = z.infer<typeof PerplexityResponseSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;

export interface PerplexityClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface LogEntry {
  timestamp: Date;
  method: string;
  query: string;
  duration: number;
  tokenCount: number;
  status: 'success' | 'error';
  statusCode?: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PerplexityClient Class
// ═══════════════════════════════════════════════════════════════════════════════

export class PerplexityClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly inFlightRequests: Map<string, Promise<SearchResult>>;
  private readonly logs: LogEntry[];
  private readonly maxRetries = 3;
  private readonly initialBackoffMs = 1000;

  constructor(config: PerplexityClientConfig) {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new PerplexityAuthError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.perplexity.ai';
    this.timeout = config.timeout ?? 30000;
    this.inFlightRequests = new Map();
    this.logs = [];
  }

  /**
   * Search using Perplexity's Sonar API
   * Implements request deduplication - if same query is in-flight, returns existing promise
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    // Validate inputs
    const validatedOptions = SearchOptionsSchema.parse(options);
    
    // Create cache key for deduplication
    const cacheKey = this.createCacheKey(query, validatedOptions);

    // Check for in-flight request
    const inFlight = this.inFlightRequests.get(cacheKey);
    if (inFlight) {
      this.log('search', query, 0, 0, 'success', undefined, 'DEDUPLICATED');
      return inFlight;
    }

    // Create the request promise
    const requestPromise = this.executeSearch(query, validatedOptions);
    
    // Store in-flight request
    this.inFlightRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up in-flight request
      this.inFlightRequests.delete(cacheKey);
    }
  }

  /**
   * Execute the actual search with retry logic
   */
  private async executeSearch(query: string, options: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.makeRequest(query, options, startTime);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on auth errors
        if (error instanceof PerplexityAuthError) {
          throw error;
        }

        // Don't retry on timeout errors
        if (error instanceof PerplexityTimeoutError) {
          throw error;
        }

        // Handle rate limiting with exponential backoff
        if (error instanceof PerplexityRateLimitError) {
          if (attempt < this.maxRetries - 1) {
            const delay = this.calculateBackoff(attempt);
            await this.sleep(delay);
            continue;
          }
        }

        // Server errors: retry once
        if (error instanceof PerplexityServerError && attempt === 0) {
          await this.sleep(this.initialBackoffMs);
          continue;
        }

        // Max retries reached
        throw error;
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  /**
   * Make the actual HTTP request to Perplexity API
   */
  private async makeRequest(
    query: string,
    options: SearchOptions,
    startTime: number
  ): Promise<SearchResult> {
    const requestBody: PerplexityRequest = {
      model: 'sonar',
      messages: [
        {
          role: 'user',
          content: query,
        },
      ],
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      return_citations: options.returnCitations ?? true,
    };

    if (options.searchDomain && options.searchDomain.length > 0) {
      requestBody.search_domain_filter = options.searchDomain;
    }

    if (options.searchRecency) {
      requestBody.search_recency_filter = options.searchRecency;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // Handle specific error cases
      if (response.status === 401) {
        const error = new PerplexityAuthError('Invalid API key');
        this.log('search', query, duration, 0, 'error', 401, error.message);
        throw error;
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const error = new PerplexityRateLimitError(
          'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );
        this.log('search', query, duration, 0, 'error', 429, error.message);
        throw error;
      }

      if (response.status >= 500) {
        const error = new PerplexityServerError('Server error', response.status);
        this.log('search', query, duration, 0, 'error', response.status, error.message);
        throw error;
      }

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Perplexity API error: ${response.status} - ${errorText}`);
        this.log('search', query, duration, 0, 'error', response.status, error.message);
        throw error;
      }

      const rawData = await response.json();
      
      // Validate response with Zod
      const validatedResponse = PerplexityResponseSchema.parse(rawData);

      // Transform to SearchResult
      const result: SearchResult = {
        answer: validatedResponse.choices[0]?.message?.content ?? '',
        citations: this.transformCitations(validatedResponse.citations),
        confidence: this.calculateConfidence(validatedResponse),
        model: validatedResponse.model,
        tokensUsed: validatedResponse.usage.total_tokens,
      };

      this.log('search', query, duration, result.tokensUsed, 'success', 200);

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof PerplexityAuthError ||
          error instanceof PerplexityRateLimitError ||
          error instanceof PerplexityServerError) {
        throw error;
      }

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new PerplexityTimeoutError(`Request timed out after ${this.timeout}ms`);
      }

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const validationError = new Error(`Invalid API response: ${error.message}`);
        this.log('search', query, Date.now() - startTime, 0, 'error', undefined, validationError.message);
        throw validationError;
      }

      throw error;
    }
  }

  /**
   * Transform Perplexity citations to our format
   */
  private transformCitations(
    citations?: Array<{ title?: string; url?: string }>
  ): Citation[] {
    if (!citations || citations.length === 0) {
      return [];
    }

    return citations.map(c => ({
      title: c.title ?? 'Untitled',
      url: c.url ?? '',
    }));
  }

  /**
   * Calculate confidence score based on response metadata
   */
  private calculateConfidence(response: PerplexityResponse): number {
    // Simple heuristic based on finish reason and citations
    const finishReason = response.choices[0]?.finish_reason;
    const citationCount = response.citations?.length ?? 0;

    let confidence = 0.7; // Base confidence

    // Boost for successful completion
    if (finishReason === 'stop') {
      confidence += 0.15;
    }

    // Boost for having citations
    if (citationCount > 0) {
      confidence += Math.min(citationCount * 0.03, 0.1);
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(attempt: number): number {
    const exponential = this.initialBackoffMs * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return exponential + jitter;
  }

  /**
   * Create a cache key for request deduplication
   */
  private createCacheKey(query: string, options: SearchOptions): string {
    const data = query + JSON.stringify(options);
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Log an API call
   */
  private log(
    method: string,
    query: string,
    duration: number,
    tokenCount: number,
    status: 'success' | 'error',
    statusCode?: number,
    error?: string
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      method,
      query: query.slice(0, 100), // Truncate long queries
      duration,
      tokenCount,
      status,
      statusCode,
      error,
    };

    this.logs.push(entry);

    // Also log to console in structured format
    const logData = {
      timestamp: entry.timestamp.toISOString(),
      method,
      query: entry.query,
      durationMs: duration,
      tokenCount,
      status,
      statusCode,
      error,
    };

    if (status === 'error') {
      console.error('[PerplexityClient]', JSON.stringify(logData));
    } else {
      console.log('[PerplexityClient]', JSON.stringify(logData));
    }
  }

  /**
   * Get all logged entries
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs.length = 0;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════════

let globalClient: PerplexityClient | null = null;

export function initializePerplexityClient(config: PerplexityClientConfig): PerplexityClient {
  globalClient = new PerplexityClient(config);
  return globalClient;
}

export function getPerplexityClient(): PerplexityClient {
  if (!globalClient) {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new PerplexityAuthError('PERPLEXITY_API_KEY environment variable not set');
    }
    globalClient = new PerplexityClient({ apiKey });
  }
  return globalClient;
}

export function resetPerplexityClient(): void {
  globalClient = null;
}
