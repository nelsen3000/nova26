/**
 * Perplexity Intelligence Division — Unit Tests
 * 27 vitest cases: constructor, research, cache, fallback, scoring, errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PerplexityAgent,
  createPerplexityAgent,
  getPerplexityAgent,
  resetPerplexityAgent,
} from '../perplexity-agent.js';
import {
  PerplexityError,
  PerplexityRateLimitError,
  PerplexityServerError,
  PerplexityTimeoutError,
} from '../types.js';
import type { PerplexityToolConfig } from '../types.js';

// ──────────────────────────────────────────────────────────────────────────────
// Mock fetch
// ──────────────────────────────────────────────────────────────────────────────

const defaultConfig: PerplexityToolConfig = {
  apiKey: 'test-key-123',
  model: 'sonar',
  maxTokens: 512,
  temperature: 0.2,
  cacheTTL: 60,
  fallbackOnError: false,
};

function mockFetch(response: Partial<Response> & { body?: unknown }) {
  const { body, ...rest } = response;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
      headers: new Headers(),
      ...rest,
    })
  );
}

function mockFetchError(error: Error) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
}

function makeApiResponse(content = 'Test answer', citations: string[] = []) {
  return {
    id: 'test-id',
    model: 'sonar',
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
    citations,
    usage: { prompt_tokens: 10, completion_tokens: 50, total_tokens: 60 },
  };
}

beforeEach(() => {
  resetPerplexityAgent();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetPerplexityAgent();
});

// ──────────────────────────────────────────────────────────────────────────────
// Constructor tests
// ──────────────────────────────────────────────────────────────────────────────

describe('PerplexityAgent constructor', () => {
  it('creates agent with provided config', () => {
    const agent = new PerplexityAgent(defaultConfig);
    expect(agent).toBeDefined();
  });

  it('starts with empty cache', () => {
    const agent = new PerplexityAgent(defaultConfig);
    const stats = agent.getCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('clearCache resets all counters', () => {
    const agent = new PerplexityAgent(defaultConfig);
    agent.clearCache();
    expect(agent.getCacheStats()).toEqual({ hits: 0, misses: 0, size: 0 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// research() happy path
// ──────────────────────────────────────────────────────────────────────────────

describe('PerplexityAgent.research()', () => {
  it('returns a research brief with correct shape', async () => {
    mockFetch({ body: makeApiResponse('Expo EAS limits are 100 builds/month on free tier.', ['https://expo.dev/docs']) });
    const agent = new PerplexityAgent(defaultConfig);
    const brief = await agent.research('Expo EAS 2026 submit limits');

    expect(brief.queryId).toMatch(/^[a-f0-9]{16}$/);
    expect(brief.originalQuery).toBe('Expo EAS 2026 submit limits');
    expect(brief.synthesizedAnswer).toContain('Expo EAS');
    expect(brief.timestamp).toBeTruthy();
    expect(Array.isArray(brief.keyFindings)).toBe(true);
    expect(Array.isArray(brief.sources)).toBe(true);
    expect(brief.novaRelevanceScore).toBeGreaterThanOrEqual(0);
    expect(brief.novaRelevanceScore).toBeLessThanOrEqual(100);
  });

  it('maps citations to sources', async () => {
    mockFetch({ body: makeApiResponse('Security advisory.', ['https://cve.org/1', 'https://nvd.nist.gov/2']) });
    const agent = new PerplexityAgent(defaultConfig);
    const brief = await agent.research('security advisory');

    expect(brief.sources).toHaveLength(2);
    expect(brief.sources[0].url).toBe('https://cve.org/1');
    expect(brief.sources[1].url).toBe('https://nvd.nist.gov/2');
  });

  it('researchTopic() is an alias for research()', async () => {
    mockFetch({ body: makeApiResponse('Topic result') });
    const agent = new PerplexityAgent(defaultConfig);
    const brief = await agent.researchTopic('some topic');
    expect(brief.originalQuery).toBe('some topic');
  });

  it('infers tags from query keywords', async () => {
    mockFetch({ body: makeApiResponse('Deploy to production') });
    const agent = new PerplexityAgent(defaultConfig);
    const brief = await agent.research('how to deploy Node.js to Heroku');
    expect(brief.tags).toContain('deployment');
  });

  it('accepts custom tags via options', async () => {
    mockFetch({ body: makeApiResponse('Security result') });
    const agent = new PerplexityAgent(defaultConfig);
    const brief = await agent.research('some query', { tags: ['security', 'mobile'] });
    expect(brief.tags).toContain('security');
    expect(brief.tags).toContain('mobile');
  });

  it('calls Perplexity API with correct URL and headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeApiResponse(),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const agent = new PerplexityAgent(defaultConfig);
    await agent.research('test query');

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.perplexity.ai/chat/completions');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key-123');
    const body = JSON.parse(opts.body as string);
    expect(body.model).toBe('sonar');
    expect(body.return_citations).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Cache tests
// ──────────────────────────────────────────────────────────────────────────────

describe('Cache behaviour', () => {
  it('caches results and returns on second call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeApiResponse('Cached answer'),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const agent = new PerplexityAgent(defaultConfig);

    await agent.research('cache test query');
    await agent.research('cache test query');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(agent.getCacheStats().hits).toBe(1);
  });

  it('increments miss count on first call', async () => {
    mockFetch({ body: makeApiResponse() });
    const agent = new PerplexityAgent(defaultConfig);
    await agent.research('miss test');
    expect(agent.getCacheStats().misses).toBe(1);
  });

  it('bypassCache option skips cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeApiResponse(),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const agent = new PerplexityAgent(defaultConfig);

    await agent.research('bypass test');
    await agent.research('bypass test', { bypassCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('expired cache entries are evicted and re-fetched', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeApiResponse(),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const agent = new PerplexityAgent({ ...defaultConfig, cacheTTL: 1 }); // 1 min TTL

    await agent.research('ttl test');
    vi.advanceTimersByTime(61 * 60 * 1000); // advance 61 minutes
    await agent.research('ttl test');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Error handling & fallback
// ──────────────────────────────────────────────────────────────────────────────

describe('Error handling', () => {
  it('throws PerplexityRateLimitError on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({}),
        headers: new Headers({ 'retry-after': '60' }),
      })
    );
    const agent = new PerplexityAgent(defaultConfig);
    await expect(agent.research('rate limit test')).rejects.toBeInstanceOf(PerplexityRateLimitError);
  });

  it('throws PerplexityServerError on 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
        headers: new Headers(),
      })
    );
    const agent = new PerplexityAgent(defaultConfig);
    await expect(agent.research('server error test')).rejects.toBeInstanceOf(PerplexityServerError);
  });

  it('throws PerplexityServerError on 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
        headers: new Headers(),
      })
    );
    const agent = new PerplexityAgent(defaultConfig);
    await expect(agent.research('503 test')).rejects.toBeInstanceOf(PerplexityServerError);
  });

  it('fallback brief returned when fallbackOnError is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
        headers: new Headers(),
      })
    );
    const agent = new PerplexityAgent({ ...defaultConfig, fallbackOnError: true });
    const brief = await agent.research('fallback test');
    expect(brief.synthesizedAnswer).toContain('[Perplexity unavailable]');
    expect(brief.novaRelevanceScore).toBe(0);
  });

  it('throws PerplexityTimeoutError when request times out', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetchError(abortError);
    const agent = new PerplexityAgent(defaultConfig);
    await expect(agent.research('timeout test')).rejects.toBeInstanceOf(PerplexityTimeoutError);
  });

  it('wraps network errors in PerplexityError', async () => {
    mockFetchError(new Error('ECONNREFUSED'));
    const agent = new PerplexityAgent(defaultConfig);
    await expect(agent.research('network err')).rejects.toBeInstanceOf(PerplexityError);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Relevance scoring
// ──────────────────────────────────────────────────────────────────────────────

describe('Relevance scoring', () => {
  it('longer answers score higher', async () => {
    const shortAnswer = 'Short.';
    const longAnswer = 'A'.repeat(1200);
    const agentA = new PerplexityAgent(defaultConfig);
    const agentB = new PerplexityAgent(defaultConfig);

    mockFetch({ body: makeApiResponse(shortAnswer) });
    const briefShort = await agentA.research('q1');

    mockFetch({ body: makeApiResponse(longAnswer) });
    const briefLong = await agentB.research('q2', { bypassCache: true });

    expect(briefLong.novaRelevanceScore).toBeGreaterThan(briefShort.novaRelevanceScore);
  });

  it('answers with more citations score higher', async () => {
    const agent = new PerplexityAgent(defaultConfig);

    mockFetch({ body: makeApiResponse('Answer', []) });
    const briefFew = await agent.research('q-no-citations');

    mockFetch({ body: makeApiResponse('Answer', ['a', 'b', 'c', 'd', 'e']) });
    const briefMany = await agent.research('q-many-citations', { bypassCache: true });

    expect(briefMany.novaRelevanceScore).toBeGreaterThan(briefFew.novaRelevanceScore);
  });

  it('score is clamped between 0 and 100', async () => {
    mockFetch({ body: makeApiResponse('A'.repeat(5000), Array.from({ length: 20 }, (_, i) => `https://src${i}.com`)) });
    const agent = new PerplexityAgent(defaultConfig);
    const brief = await agent.research('max score test');
    expect(brief.novaRelevanceScore).toBeLessThanOrEqual(100);
    expect(brief.novaRelevanceScore).toBeGreaterThanOrEqual(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Singleton factory
// ──────────────────────────────────────────────────────────────────────────────

describe('Singleton factory', () => {
  it('createPerplexityAgent returns an agent', () => {
    const agent = createPerplexityAgent(defaultConfig);
    expect(agent).toBeInstanceOf(PerplexityAgent);
  });

  it('getPerplexityAgent returns same instance after create', () => {
    const agent1 = createPerplexityAgent(defaultConfig);
    const agent2 = getPerplexityAgent();
    expect(agent1).toBe(agent2);
  });

  it('getPerplexityAgent returns null when not configured and no env vars', () => {
    vi.stubEnv('PERPLEXITY_API_KEY', '');
    vi.stubEnv('PERPLEXITY_ENABLED', 'false');
    const agent = getPerplexityAgent();
    expect(agent).toBeNull();
  });

  it('resetPerplexityAgent clears singleton', () => {
    createPerplexityAgent(defaultConfig);
    resetPerplexityAgent();
    vi.stubEnv('PERPLEXITY_API_KEY', '');
    vi.stubEnv('PERPLEXITY_ENABLED', 'false');
    expect(getPerplexityAgent()).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Model selection
// ──────────────────────────────────────────────────────────────────────────────

describe('Model selection', () => {
  it('uses model from options when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeApiResponse(),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const agent = new PerplexityAgent({ ...defaultConfig, model: 'sonar' });
    await agent.research('model test', { model: 'sonar-pro' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('sonar-pro');
  });

  it('falls back to config model when options.model not set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeApiResponse(),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const agent = new PerplexityAgent({ ...defaultConfig, model: 'sonar-reasoning' });
    await agent.research('model fallback test');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('sonar-reasoning');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('handles empty API response gracefully', async () => {
    mockFetch({
      body: {
        id: 'empty',
        model: 'sonar',
        choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
      },
    });
    const agent = new PerplexityAgent(defaultConfig);
    const brief = await agent.research('empty response test');
    expect(brief.synthesizedAnswer).toBe('');
    expect(brief.keyFindings).toEqual([]);
  });

  it('generates suggested next actions including ATLAS ingest', async () => {
    mockFetch({ body: makeApiResponse('Security vulnerability found.') });
    const agent = new PerplexityAgent(defaultConfig);
    const brief = await agent.research('security query', { tags: ['security'] });
    expect(brief.suggestedNextActions.some((a) => a.includes('ATLAS'))).toBe(true);
  });

  it('different queries produce different queryIds', async () => {
    mockFetch({ body: makeApiResponse() });
    const agentA = new PerplexityAgent(defaultConfig);
    const briefA = await agentA.research('query one');

    mockFetch({ body: makeApiResponse() });
    const agentB = new PerplexityAgent(defaultConfig);
    const briefB = await agentB.research('query two');

    expect(briefA.queryId).not.toBe(briefB.queryId);
  });
});
