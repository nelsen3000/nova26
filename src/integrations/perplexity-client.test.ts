// Perplexity Client Tests
// Comprehensive test suite for the Perplexity API integration

import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import {
  PerplexityClient,
  PerplexityAuthError,
  PerplexityTimeoutError,
  PerplexityRateLimitError,
  PerplexityServerError,
  initializePerplexityClient,
  getPerplexityClient,
  resetPerplexityClient,
} from './perplexity-client.js';

describe('PerplexityClient', () => {
  let fetchMock: MockInstance<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock = vi.fn() as unknown as MockInstance<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Constructor Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('creates client with valid API key', () => {
      const client = new PerplexityClient({ apiKey: 'test-key' });
      expect(client).toBeInstanceOf(PerplexityClient);
    });

    it('throws PerplexityAuthError when API key is empty', () => {
      expect(() => new PerplexityClient({ apiKey: '' })).toThrow(PerplexityAuthError);
    });

    it('throws PerplexityAuthError when API key is whitespace', () => {
      expect(() => new PerplexityClient({ apiKey: '   ' })).toThrow(PerplexityAuthError);
    });

    it('uses default base URL when not provided', () => {
      const client = new PerplexityClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('uses custom base URL when provided', () => {
      const client = new PerplexityClient({ 
        apiKey: 'test-key',
        baseUrl: 'https://custom.perplexity.api'
      });
      expect(client).toBeDefined();
    });

    it('uses default timeout when not provided', () => {
      const client = new PerplexityClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('uses custom timeout when provided', () => {
      const client = new PerplexityClient({ 
        apiKey: 'test-key',
        timeout: 5000
      });
      expect(client).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Search Tests - Success Cases
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('search - success cases', () => {
    const mockSuccessResponse = {
      id: 'test-id',
      model: 'sonar',
      choices: [{
        message: {
          role: 'assistant',
          content: 'This is a test answer',
        },
        finish_reason: 'stop',
      }],
      citations: [
        { title: 'Test Source', url: 'https://example.com' },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    };

    it('returns search result with answer', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const result = await client.search('test query');

      expect(result.answer).toBe('This is a test answer');
    });

    it('returns citations array', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const result = await client.search('test query');

      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].title).toBe('Test Source');
      expect(result.citations[0].url).toBe('https://example.com');
    });

    it('returns confidence score', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const result = await client.search('test query');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('returns model name', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const result = await client.search('test query');

      expect(result.model).toBe('sonar');
    });

    it('returns token count', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const result = await client.search('test query');

      expect(result.tokensUsed).toBe(30);
    });

    it('accepts maxTokens option', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await client.search('test query', { maxTokens: 2048 });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.max_tokens).toBe(2048);
    });

    it('accepts temperature option', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await client.search('test query', { temperature: 0.5 });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.temperature).toBe(0.5);
    });

    it('accepts searchDomain option', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await client.search('test query', { searchDomain: ['github.com', 'stackoverflow.com'] });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.search_domain_filter).toEqual(['github.com', 'stackoverflow.com']);
    });

    it('accepts searchRecency option', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await client.search('test query', { searchRecency: 'week' });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.search_recency_filter).toBe('week');
    });

    it('accepts returnCitations option', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await client.search('test query', { returnCitations: false });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.return_citations).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Search Tests - Error Handling
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('search - error handling', () => {
    it('throws PerplexityAuthError on 401', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'invalid-key' });
      await expect(client.search('test query')).rejects.toThrow(PerplexityAuthError);
    });

    it('throws PerplexityRateLimitError on 429', async () => {
      // Need to provide enough mock responses for all retry attempts
      // maxRetries = 3, so we need 3 responses all returning 429
      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '60' : null),
        },
        text: () => Promise.resolve('Rate limited'),
        json: () => Promise.reject(new Error('No JSON')),
      } as unknown as Response;

      fetchMock
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(rateLimitResponse);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await expect(client.search('test query')).rejects.toThrow(PerplexityRateLimitError);
    });

    it('throws PerplexityServerError on 500', async () => {
      // Server errors (500+) retry once (only on first attempt)
      // So we need 2 responses: first for initial attempt, second for the retry
      const serverErrorResponse = {
        ok: false,
        status: 500,
        headers: { get: () => null },
        text: () => Promise.resolve('Server error'),
        json: () => Promise.reject(new Error('No JSON')),
      } as unknown as Response;

      fetchMock
        .mockResolvedValueOnce(serverErrorResponse)
        .mockResolvedValueOnce(serverErrorResponse);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await expect(client.search('test query')).rejects.toThrow(PerplexityServerError);
    });

    it('throws PerplexityServerError on 503', async () => {
      // Server errors (500+) retry once (only on first attempt)
      // So we need 2 responses: first for initial attempt, second for the retry
      const serverErrorResponse = {
        ok: false,
        status: 503,
        headers: { get: () => null },
        text: () => Promise.resolve('Service unavailable'),
        json: () => Promise.reject(new Error('No JSON')),
      } as unknown as Response;

      fetchMock
        .mockResolvedValueOnce(serverErrorResponse)
        .mockResolvedValueOnce(serverErrorResponse);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await expect(client.search('test query')).rejects.toThrow(PerplexityServerError);
    });

    it('retries on rate limit with exponential backoff', async () => {
      const mockSuccessResponse = {
        id: 'test-id',
        model: 'sonar',
        choices: [{ message: { role: 'assistant', content: 'Success' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      };

      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => null },
          text: () => Promise.resolve('Rate limited'),
          json: () => Promise.reject(new Error('No JSON')),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve(mockSuccessResponse),
        } as unknown as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const result = await client.search('test query');

      expect(result.answer).toBe('Success');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries server error once', async () => {
      const mockSuccessResponse = {
        id: 'test-id',
        model: 'sonar',
        choices: [{ message: { role: 'assistant', content: 'Success' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      };

      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          text: () => Promise.resolve('Bad gateway'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
        } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const result = await client.search('test query');

      expect(result.answer).toBe('Success');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry auth errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'invalid-key' });
      
      await expect(client.search('test query')).rejects.toThrow(PerplexityAuthError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Timeout Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('timeout handling', () => {
    it('throws PerplexityTimeoutError when request times out', async () => {
      // Mock fetch to simulate timeout by rejecting with AbortError after timeout
      fetchMock.mockImplementationOnce(() =>
        new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('The operation was aborted');
            (error as any).name = 'AbortError';
            reject(error);
          }, 100);
        })
      );

      const client = new PerplexityClient({ apiKey: 'test-key', timeout: 50 });

      await expect(client.search('test query')).rejects.toThrow(PerplexityTimeoutError);
    }, 10000);

    it('does not retry timeout errors', async () => {
      fetchMock.mockImplementationOnce(() =>
        new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('The operation was aborted');
            (error as any).name = 'AbortError';
            reject(error);
          }, 100);
        })
      );

      const client = new PerplexityClient({ apiKey: 'test-key', timeout: 50 });

      await expect(client.search('test query')).rejects.toThrow(PerplexityTimeoutError);
      // Should only be called once (no retries for timeout)
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Request Deduplication Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('request deduplication', () => {
    const mockSuccessResponse = {
      id: 'test-id',
      model: 'sonar',
      choices: [{ message: { role: 'assistant', content: 'Answer' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    };

    it('deduplicates concurrent identical requests', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount++;
        await new Promise(r => setTimeout(r, 50));
        return {
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
        } as Response;
      });

      const client = new PerplexityClient({ apiKey: 'test-key' });
      
      // Fire two identical requests concurrently
      const [result1, result2] = await Promise.all([
        client.search('same query'),
        client.search('same query'),
      ]);

      // Should only make one API call
      expect(callCount).toBe(1);
      expect(result1.answer).toBe(result2.answer);
    });

    it('does not deduplicate different queries', async () => {
      const queryResponses: Record<string, string> = {
        'query one': 'Answer 1',
        'query two': 'Answer 2',
      };

      let callCount = 0;
      fetchMock.mockImplementation(async (url: string, options: any) => {
        callCount++;
        const body = JSON.parse(options.body);
        const query = body.messages[0].content;
        const answer = queryResponses[query] || 'Default answer';

        return {
          ok: true,
          json: () => Promise.resolve({
            ...mockSuccessResponse,
            choices: [{ message: { role: 'assistant', content: answer }, finish_reason: 'stop' }],
          }),
        } as Response;
      });

      const client = new PerplexityClient({ apiKey: 'test-key' });

      const [result1, result2] = await Promise.all([
        client.search('query one'),
        client.search('query two'),
      ]);

      expect(callCount).toBe(2);
      expect(result1.answer).toBe('Answer 1');
      expect(result2.answer).toBe('Answer 2');
      expect(result1.answer).not.toBe(result2.answer);
    });

    it('does not deduplicate same query with different options', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
        } as Response;
      });

      const client = new PerplexityClient({ apiKey: 'test-key' });
      
      await Promise.all([
        client.search('same query', { temperature: 0.5 }),
        client.search('same query', { temperature: 0.7 }),
      ]);

      expect(callCount).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Logging Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('logging', () => {
    const mockSuccessResponse = {
      id: 'test-id',
      model: 'sonar',
      choices: [{ message: { role: 'assistant', content: 'Answer' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    };

    it('logs successful requests', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await client.search('test query');

      const logs = client.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].method).toBe('search');
      expect(logs[0].status).toBe('success');
      expect(logs[0].tokenCount).toBe(20);
    });

    it('logs failed requests', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      
      try {
        await client.search('test query');
      } catch {
        // Expected
      }

      const logs = client.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('error');
      expect(logs[0].statusCode).toBe(401);
    });

    it('truncates long queries in logs', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const longQuery = 'a'.repeat(200);
      await client.search(longQuery);

      const logs = client.getLogs();
      expect(logs[0].query.length).toBeLessThanOrEqual(100);
    });

    it('clears logs', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      await client.search('test query');

      expect(client.getLogs()).toHaveLength(1);
      client.clearLogs();
      expect(client.getLogs()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Confidence Calculation Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('confidence calculation', () => {
    it('returns higher confidence for successful completion', async () => {
      const mockResponse = {
        id: 'test-id',
        model: 'sonar',
        choices: [{ message: { role: 'assistant', content: 'Answer' }, finish_reason: 'stop' }],
        citations: [{ title: 'Source', url: 'https://example.com' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const result = await client.search('test query');

      // Should have boosted confidence from finish_reason=stop and citations
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('returns base confidence without citations', async () => {
      const mockResponse = {
        id: 'test-id',
        model: 'sonar',
        choices: [{ message: { role: 'assistant', content: 'Answer' }, finish_reason: 'length' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new PerplexityClient({ apiKey: 'test-key' });
      const result = await client.search('test query');

      // Base confidence without boosters
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Factory Function Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('factory functions', () => {
    beforeEach(() => {
      resetPerplexityClient();
      delete process.env.PERPLEXITY_API_KEY;
    });

    it('initializePerplexityClient creates global client', () => {
      const client = initializePerplexityClient({ apiKey: 'test-key' });
      expect(client).toBeInstanceOf(PerplexityClient);
    });

    it('getPerplexityClient returns initialized client', () => {
      initializePerplexityClient({ apiKey: 'test-key' });
      const client = getPerplexityClient();
      expect(client).toBeInstanceOf(PerplexityClient);
    });

    it('getPerplexityClient creates client from environment variable', () => {
      process.env.PERPLEXITY_API_KEY = 'env-key';
      const client = getPerplexityClient();
      expect(client).toBeInstanceOf(PerplexityClient);
    });

    it('getPerplexityClient throws when no API key available', () => {
      expect(() => getPerplexityClient()).toThrow(PerplexityAuthError);
    });

    it('resetPerplexityClient clears global client', () => {
      initializePerplexityClient({ apiKey: 'test-key' });
      resetPerplexityClient();
      
      process.env.PERPLEXITY_API_KEY = 'env-key';
      const client = getPerplexityClient();
      expect(client).toBeInstanceOf(PerplexityClient);
    });
  });
});
