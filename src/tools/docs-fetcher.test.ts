// Tests for DocsFetcher — Context7 Documentation Tool
// KIMI-INTEGRATE-06

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDocsFetcher, resetDocsFetcher, type DocsFetchResult } from './docs-fetcher.js';
import { mkdirSync, rmSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as https from 'https';

// Mock https module
vi.mock('https', () => ({
  get: vi.fn(),
}));

describe('DocsFetcher', () => {
  let cacheDir: string;

  beforeEach(() => {
    resetDocsFetcher();
    // Create temp cache directory
    cacheDir = join(tmpdir(), `nova26-docs-test-${Date.now()}`);
    mkdirSync(cacheDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp cache directory
    if (existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true });
    }
    vi.clearAllMocks();
  });

  describe('Cache behavior', () => {
    it('writes a cache entry to disk after successful network fetch', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "test docs"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      await fetcher.fetchDocs('react', 'hooks');

      // Check cache was written
      const files = readdirSync(join(cacheDir, 'react'));
      expect(files.length).toBeGreaterThan(0);
    });

    it('returns source: cache and cacheHit: true on second call within TTL', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "test docs"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      
      // First call - network
      const r1 = await fetcher.fetchDocs('react', 'hooks');
      expect(r1.source).toBe('network');
      expect(r1.cacheHit).toBe(false);

      // Second call - cache
      const r2 = await fetcher.fetchDocs('react', 'hooks');
      expect(r2.source).toBe('cache');
      expect(r2.cacheHit).toBe(true);
    });

    it('returns source: network on first call (cache miss)', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "test docs"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      const result = await fetcher.fetchDocs('react');

      expect(result.source).toBe('network');
      expect(result.cacheHit).toBe(false);
    });

    it('re-fetches when cache entry is expired', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "test docs"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      // Create fetcher with very short TTL (1ms)
      const fetcher = getDocsFetcher({ cacheDir, cacheTTLMs: 1 });
      
      // First fetch
      await fetcher.fetchDocs('react');
      
      // Wait for TTL to expire
      await new Promise(r => setTimeout(r, 10));
      
      // Second fetch should hit network again
      const r2 = await fetcher.fetchDocs('react');
      expect(r2.source).toBe('network');
      expect(r2.cacheHit).toBe(false);
    });

    it('returns null when cache file does not exist', () => {
      const fetcher = getDocsFetcher({ cacheDir });
      const result = (fetcher as unknown as { getCacheEntry: (lib: string, topic?: string) => unknown }).getCacheEntry('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when cache file contains invalid JSON', () => {
      const libDir = join(cacheDir, 'invalid');
      mkdirSync(libDir, { recursive: true });
      const fs = require('fs');
      fs.writeFileSync(join(libDir, '_default.json'), 'not json');

      const fetcher = getDocsFetcher({ cacheDir });
      const result = (fetcher as unknown as { getCacheEntry: (lib: string, topic?: string) => unknown }).getCacheEntry('invalid');
      expect(result).toBeNull();
    });
  });

  describe('Network behavior', () => {
    it('builds the correct URL with library and topic as query params', async () => {
      let capturedUrl = '';
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "docs"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((url, _options, callback) => {
        capturedUrl = url as string;
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      await fetcher.fetchDocs('react', 'hooks');

      expect(capturedUrl).toContain('library=react');
      expect(capturedUrl).toContain('topic=hooks');
    });

    it('parses a valid Context7 API response and returns content', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "React hooks documentation"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      const result = await fetcher.fetchDocs('react');

      expect(result.content).toBe('React hooks documentation');
    });

    it('returns fallback result when HTTP response is non-200', async () => {
      const mockResponse = {
        statusCode: 404,
        on: vi.fn(),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      const result = await fetcher.fetchDocs('react');

      expect(result.content).toContain('Documentation unavailable');
      expect(result.source).toBe('network');
      expect(result.cacheHit).toBe(false);
    });

    it('returns fallback result when request times out', async () => {
      const mockReq = {
        setTimeout: vi.fn((_, callback) => {
          callback();
        }),
        on: vi.fn((event: string, callback: () => void) => {
          if (event === 'error') callback();
        }),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockReturnValue(mockReq as unknown as import('http').ClientRequest);

      const fetcher = getDocsFetcher({ cacheDir });
      const result = await fetcher.fetchDocs('react');

      expect(result.content).toContain('Documentation unavailable');
    });

    it('returns fallback result when HTTPS module throws', async () => {
      vi.mocked(https.get).mockImplementation(() => {
        throw new Error('Network error');
      });

      const fetcher = getDocsFetcher({ cacheDir });
      const result = await fetcher.fetchDocs('react');

      expect(result.content).toContain('Documentation unavailable');
    });
  });

  describe('Truncation', () => {
    it('returns truncated: false when content is under the limit', async () => {
      const shortContent = 'Short content';
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback(`{"content": "${shortContent}"}`);
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir, maxTokens: 100 });
      const result = await fetcher.fetchDocs('react');

      expect(result.truncated).toBe(false);
    });

    it('returns truncated: true and appends ...[truncated] when over', async () => {
      const longContent = 'a'.repeat(1000);
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback(`{"content": "${longContent}"}`);
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir, maxTokens: 10 }); // 40 chars max
      const result = await fetcher.fetchDocs('react');

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('...[truncated]');
    });

    it('respects the maxTokens option passed to constructor', async () => {
      const content = 'a'.repeat(500);
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback(`{"content": "${content}"}`);
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir, maxTokens: 50 }); // 200 chars max
      const result = await fetcher.fetchDocs('react');

      // Should be truncated at 200 chars + ...[truncated]
      expect(result.content.length).toBeLessThanOrEqual(220);
    });
  });

  describe('Input validation', () => {
    it('throws when library is an empty string', async () => {
      const fetcher = getDocsFetcher({ cacheDir });
      await expect(fetcher.fetchDocs('')).rejects.toThrow('Library name cannot be empty');
    });

    it('sanitizes library name to lowercase and trimmed', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "docs"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      const result = await fetcher.fetchDocs('  REACT  ', '  HOOKS  ');

      expect(result.library).toBe('react');
    });
  });

  describe('Cache management', () => {
    it('clearCache(library) removes only that library cache directory', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "docs"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      await fetcher.fetchDocs('react');
      await fetcher.fetchDocs('vue');

      fetcher.clearCache('react');

      expect(existsSync(join(cacheDir, 'react'))).toBe(false);
      expect(existsSync(join(cacheDir, 'vue'))).toBe(true);
    });

    it('clearCache() (no argument) removes the entire cache directory', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "docs"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      await fetcher.fetchDocs('react');

      fetcher.clearCache();

      expect(existsSync(cacheDir)).toBe(false);
    });

    it('getCacheStats() returns zero entries on a fresh cache directory', () => {
      const fetcher = getDocsFetcher({ cacheDir });
      const stats = fetcher.getCacheStats();

      expect(stats.entries).toBe(0);
      expect(stats.oldestEntry).toBeUndefined();
      expect(stats.newestEntry).toBeUndefined();
    });

    it('getCacheStats() returns correct entry count after multiple fetches', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"content": "docs"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      await fetcher.fetchDocs('react');
      await fetcher.fetchDocs('vue');
      await fetcher.fetchDocs('react', 'hooks'); // Different topic, same library

      const stats = fetcher.getCacheStats();
      expect(stats.entries).toBe(3);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });
  });

  describe('Response body validation', () => {
    it('returns fallback when response body fails Zod validation', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event: string, callback: (chunk?: string) => void) => {
          if (event === 'data') callback('{"invalid": "no content field"}');
          if (event === 'end') callback();
        }),
      };
      const mockReq = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };
      vi.mocked(https.get).mockImplementation((_url, _options, callback) => {
        callback(mockResponse as unknown as import('http').IncomingMessage);
        return mockReq as unknown as import('http').ClientRequest;
      });

      const fetcher = getDocsFetcher({ cacheDir });
      const result = await fetcher.fetchDocs('react');

      expect(result.content).toContain('Documentation unavailable');
    });
  });
});
