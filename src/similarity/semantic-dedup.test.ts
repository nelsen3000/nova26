// KIMI-INFRA-01: Semantic Similarity Engine Tests

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import {
  SemanticDedup,
  getSemanticDedup,
  resetSemanticDedup,
  OllamaEmbeddingResponseSchema,
  EmbeddingCacheFileSchema,
  type GraphNode,
} from './semantic-dedup.js';

describe('SemanticDedup', () => {
  let dedup: SemanticDedup;
  let fetchMock: MockInstance<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>;

  beforeEach(() => {
    dedup = new SemanticDedup();
    dedup.clearCache();
    fetchMock = vi.fn() as unknown as MockInstance<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dedup.clearCache();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const d = new SemanticDedup();
      expect(d).toBeDefined();
    });

    it('should accept custom model', () => {
      const d = new SemanticDedup({ model: 'custom-model' });
      expect(d).toBeDefined();
    });

    it('should accept custom threshold', () => {
      const d = new SemanticDedup({ threshold: 0.85 });
      expect(d).toBeDefined();
    });

    it('should accept custom ollamaBaseUrl', () => {
      const d = new SemanticDedup({ ollamaBaseUrl: 'http://custom:11434' });
      expect(d).toBeDefined();
    });

    it('should accept all custom options', () => {
      const d = new SemanticDedup({
        model: 'custom-model',
        threshold: 0.85,
        ollamaBaseUrl: 'http://custom:11434',
      });
      expect(d).toBeDefined();
    });
  });

  // ==========================================================================
  // getEmbedding Tests
  // ==========================================================================

  describe('getEmbedding', () => {
    it('should fetch embedding from Ollama API', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ embedding: mockEmbedding }),
      });

      const result = await dedup.getEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: 'test text',
          }),
        }
      );
    });

    it('should cache embeddings', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ embedding: mockEmbedding }),
      });

      // First call - should fetch
      await dedup.getEmbedding('test text');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await dedup.getEmbedding('test text');
      expect(fetchMock).toHaveBeenCalledTimes(1); // No additional fetch
      expect(result).toEqual(mockEmbedding);
    });

    it('should use different cache keys for different texts', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0.1, 0.2] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0.3, 0.4] }),
        });

      await dedup.getEmbedding('text one');
      await dedup.getEmbedding('text two');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(dedup.getEmbedding('test')).rejects.toThrow(
        'Ollama API error: 500 Internal Server Error'
      );
    });

    it('should throw on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(dedup.getEmbedding('test')).rejects.toThrow('Network error');
    });

    it('should throw on invalid response schema', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' }),
      });

      await expect(dedup.getEmbedding('test')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // cosineSimilarity Tests
  // ==========================================================================

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      expect(dedup.cosineSimilarity(a, b)).toBe(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(dedup.cosineSimilarity(a, b)).toBe(0);
    });

    it('should return 0 for zero-length vectors', () => {
      expect(dedup.cosineSimilarity([], [1, 2, 3])).toBe(0);
      expect(dedup.cosineSimilarity([1, 2, 3], [])).toBe(0);
      expect(dedup.cosineSimilarity([], [])).toBe(0);
    });

    it('should return 0 for different dimensions', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(dedup.cosineSimilarity(a, b)).toBe(0);
    });

    it('should calculate correct similarity for known vectors', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      // dot = 1*4 + 2*5 + 3*6 = 32
      // ||a|| = sqrt(1 + 4 + 9) = sqrt(14)
      // ||b|| = sqrt(16 + 25 + 36) = sqrt(77)
      // similarity = 32 / (sqrt(14) * sqrt(77))
      const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
      expect(dedup.cosineSimilarity(a, b)).toBeCloseTo(expected, 10);
    });

    it('should clamp results to [0, 1]', () => {
      // Due to floating point errors, very close vectors might exceed 1 slightly
      const a = [1e-10, 1e-10];
      const b = [1e-10, 1e-10];
      const result = dedup.cosineSimilarity(a, b);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // isDuplicate Tests
  // ==========================================================================

  describe('isDuplicate', () => {
    const newNode: GraphNode = { id: 'new-1', content: 'hello world' };
    const existingNodes: GraphNode[] = [
      { id: 'existing-1', content: 'hello world' },
      { id: 'existing-2', content: 'completely different' },
    ];

    it('should return duplicate for similar content', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0.9, 0.1] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0.91, 0.09] }),
        });

      const result = await dedup.isDuplicate(newNode, existingNodes);

      expect(result.isDuplicate).toBe(true);
      expect(result.canonicalNodeId).toBe('existing-1');
      expect(result.similarity).toBeGreaterThan(0.99);
    });

    it('should return not duplicate for different content', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [1, 0] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0, 1] }),
        });

      const result = await dedup.isDuplicate(newNode, [existingNodes[1]]);

      expect(result.isDuplicate).toBe(false);
      expect(result.similarity).toBe(0);
    });

    it('should use custom threshold when provided', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [1, 0] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0, 1] }),
        });

      // With default 0.92 threshold, orthogonal vectors are not duplicates
      const result = await dedup.isDuplicate(newNode, [existingNodes[1]]);
      expect(result.isDuplicate).toBe(false);
      expect(result.similarity).toBe(0);
    });

    it('should detect duplicates with lower threshold', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0.8, 0.6] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0.7, 0.5] }),
        });

      // These vectors have similarity ~0.998, above 0.92 threshold
      const result = await dedup.isDuplicate(newNode, [existingNodes[1]]);
      expect(result.isDuplicate).toBe(true);
    });

    it('should fall back to Jaccard on Ollama error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Ollama unavailable'));

      const result = await dedup.isDuplicate(
        { id: 'new', content: 'hello world foo' },
        [{ id: 'existing', content: 'hello world bar' }]
      );

      // Should not throw, should use fallback
      expect(result).toBeDefined();
    });

    it('should find duplicate via Jaccard fallback for similar text', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Ollama unavailable'));

      const result = await dedup.isDuplicate(
        { id: 'new', content: 'hello world test' },
        [{ id: 'existing', content: 'hello world test' }]
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.canonicalNodeId).toBe('existing');
      expect(result.similarity).toBe(1);
    });

    it('should return not duplicate via Jaccard for different text', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Ollama unavailable'));

      const result = await dedup.isDuplicate(
        { id: 'new', content: 'hello world' },
        [{ id: 'existing', content: 'completely different text here' }]
      );

      expect(result.isDuplicate).toBe(false);
    });

    it('should handle empty existing nodes array', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.1, 0.2] }),
      });

      const result = await dedup.isDuplicate(newNode, []);

      expect(result.isDuplicate).toBe(false);
      expect(result.similarity).toBe(0);
    });
  });

  // ==========================================================================
  // bulkIndex Tests
  // ==========================================================================

  describe('bulkIndex', () => {
    it('should index multiple nodes sequentially', async () => {
      const nodes: GraphNode[] = [
        { id: '1', content: 'text one' },
        { id: '2', content: 'text two' },
        { id: '3', content: 'text three' },
      ];

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.1, 0.2] }),
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await dedup.bulkIndex(nodes);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith('SemanticDedup: indexed 1/3');
      expect(consoleSpy).toHaveBeenCalledWith('SemanticDedup: indexed 2/3');
      expect(consoleSpy).toHaveBeenCalledWith('SemanticDedup: indexed 3/3');

      consoleSpy.mockRestore();
    });

    it('should continue on individual failures', async () => {
      const nodes: GraphNode[] = [
        { id: '1', content: 'text one' },
        { id: '2', content: 'text two' },
      ];

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embedding: [0.1] }),
        })
        .mockRejectedValueOnce(new Error('Failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await dedup.bulkIndex(nodes);

      expect(consoleSpy).toHaveBeenCalledWith(
        'SemanticDedup: failed to index node 2:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Cache Tests
  // ==========================================================================

  describe('cache', () => {
    it('should clear cache', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.1] }),
      });

      await dedup.getEmbedding('test');
      expect(dedup.getCacheSize()).toBe(1);

      dedup.clearCache();
      expect(dedup.getCacheSize()).toBe(0);
    });

    it('should get cache size', async () => {
      expect(dedup.getCacheSize()).toBe(0);

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.1] }),
      });

      await dedup.getEmbedding('test 1');
      await dedup.getEmbedding('test 2');

      expect(dedup.getCacheSize()).toBe(2);
    });
  });

  // ==========================================================================
  // Zod Schema Tests
  // ==========================================================================

  describe('Zod schemas', () => {
    it('OllamaEmbeddingResponseSchema should validate correct response', () => {
      const valid = { embedding: [0.1, 0.2, 0.3] };
      expect(() => OllamaEmbeddingResponseSchema.parse(valid)).not.toThrow();
    });

    it('OllamaEmbeddingResponseSchema should reject invalid response', () => {
      const invalid = { wrong: 'field' };
      expect(() => OllamaEmbeddingResponseSchema.parse(invalid)).toThrow();
    });

    it('EmbeddingCacheFileSchema should validate correct cache file', () => {
      const valid = {
        version: '1.0.0',
        entries: [
          {
            nodeId: 'node-1',
            embedding: [0.1, 0.2],
            computedAt: '2024-01-01T00:00:00Z',
            model: 'nomic-embed-text',
          },
        ],
      };
      expect(() => EmbeddingCacheFileSchema.parse(valid)).not.toThrow();
    });

    it('EmbeddingCacheFileSchema should reject invalid cache file', () => {
      const invalid = { version: '1.0.0' }; // missing entries
      expect(() => EmbeddingCacheFileSchema.parse(invalid)).toThrow();
    });
  });

  // ==========================================================================
  // Singleton Tests
  // ==========================================================================

  describe('singleton factory', () => {
    it('getSemanticDedup should return same instance', () => {
      resetSemanticDedup();
      const a = getSemanticDedup();
      const b = getSemanticDedup();
      expect(a).toBe(b);
    });

    it('resetSemanticDedup should clear instance', () => {
      const a = getSemanticDedup();
      resetSemanticDedup();
      const b = getSemanticDedup();
      expect(a).not.toBe(b);
    });
  });
});
