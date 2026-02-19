// KIMI-INFRA-01: Semantic Similarity Engine for NOVA26
// Embedding-based deduplication for Global Wisdom Pipeline

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface DedupResult {
  isDuplicate: boolean;
  canonicalNodeId?: string;
  similarity: number;
}

export interface EmbeddingCacheEntry {
  nodeId: string;
  embedding: number[];
  computedAt: string;
  model: string;
}

export interface GraphNode {
  id: string;
  content: string;
  [key: string]: unknown;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const OllamaEmbeddingResponseSchema = z.object({
  embedding: z.array(z.number()),
});

export const EmbeddingCacheEntrySchema = z.object({
  nodeId: z.string(),
  embedding: z.array(z.number()),
  computedAt: z.string(),
  model: z.string(),
});

export const EmbeddingCacheFileSchema = z.object({
  version: z.string(),
  entries: z.array(EmbeddingCacheEntrySchema),
});

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_OPTIONS = {
  model: 'nomic-embed-text',
  threshold: 0.92,
  ollamaBaseUrl: 'http://localhost:11434',
};

const CACHE_DIR = join(process.cwd(), '.nova', 'similarity');
const CACHE_FILE = join(CACHE_DIR, 'embeddings.json');
const CACHE_VERSION = '1.0.0';

// ============================================================================
// SemanticDedup Class
// ============================================================================

export interface SemanticDedupOptions {
  model?: string;
  threshold?: number;
  ollamaBaseUrl?: string;
}

export class SemanticDedup {
  private model: string;
  private threshold: number;
  private ollamaBaseUrl: string;
  private cache: Map<string, EmbeddingCacheEntry> = new Map();

  constructor(options: SemanticDedupOptions = {}) {
    this.model = options.model ?? DEFAULT_OPTIONS.model;
    this.threshold = options.threshold ?? DEFAULT_OPTIONS.threshold;
    this.ollamaBaseUrl = options.ollamaBaseUrl ?? DEFAULT_OPTIONS.ollamaBaseUrl;
  }

  /**
   * Generate a cache key from text using SHA-256 hash
   */
  private getCacheKey(text: string): string {
    const hash = createHash('sha256');
    hash.update(text + ':' + this.model);
    return hash.digest('hex');
  }

  /**
   * Fetch embedding from Ollama API
   */
  private async fetchEmbedding(text: string): Promise<number[]> {
    const url = `${this.ollamaBaseUrl}/api/embeddings`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    const parsed = OllamaEmbeddingResponseSchema.parse(raw);
    return parsed.embedding;
  }

  /**
   * Get embedding for text, using cache if available
   */
  async getEmbedding(text: string): Promise<number[]> {
    const cacheKey = this.getCacheKey(text);

    // Check in-memory cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.embedding;
    }

    // Fetch from Ollama
    const embedding = await this.fetchEmbedding(text);

    // Cache the result
    this.cache.set(cacheKey, {
      nodeId: cacheKey,
      embedding,
      computedAt: new Date().toISOString(),
      model: this.model,
    });

    return embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   * Returns 0 if vectors are empty or have different dimensions
   * Result is clamped to [0, 1]
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    // Clamp to [0, 1] to handle floating point errors
    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Calculate Jaccard similarity as fallback
   */
  private jaccardSimilarity(a: string, b: string): number {
    const tokensA = new Set(this.tokenize(a.toLowerCase()));
    const tokensB = new Set(this.tokenize(b.toLowerCase()));

    if (tokensA.size === 0 && tokensB.size === 0) return 1;
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.size / union.size;
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  /**
   * Check if a new node is a duplicate of any existing node
   * Falls back to Jaccard similarity if Ollama fails
   */
  async isDuplicate(
    newNode: GraphNode,
    existingNodes: GraphNode[],
    threshold?: number
  ): Promise<DedupResult> {
    const useThreshold = threshold ?? this.threshold;

    try {
      // Try semantic similarity with embeddings
      const newEmbedding = await this.getEmbedding(newNode.content);

      let bestMatch: { nodeId: string; similarity: number } | null = null;

      for (const existingNode of existingNodes) {
        const existingEmbedding = await this.getEmbedding(existingNode.content);
        const similarity = this.cosineSimilarity(newEmbedding, existingEmbedding);

        if (similarity >= useThreshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { nodeId: existingNode.id, similarity };
          }
        }
      }

      if (bestMatch) {
        return {
          isDuplicate: true,
          canonicalNodeId: bestMatch.nodeId,
          similarity: bestMatch.similarity,
        };
      }

      return { isDuplicate: false, similarity: 0 };
    } catch (error) {
      // Fall back to Jaccard similarity
      console.warn('Semantic similarity failed, falling back to Jaccard:', error);
      return this.jaccardFallback(newNode, existingNodes);
    }
  }

  /**
   * Jaccard fallback when embeddings fail
   */
  private jaccardFallback(
    newNode: GraphNode,
    existingNodes: GraphNode[]
  ): DedupResult {
    const JACCARD_THRESHOLD = 0.7;
    let bestMatch: { nodeId: string; similarity: number } | null = null;

    for (const existingNode of existingNodes) {
      const similarity = this.jaccardSimilarity(newNode.content, existingNode.content);

      if (similarity >= JACCARD_THRESHOLD) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { nodeId: existingNode.id, similarity };
        }
      }
    }

    if (bestMatch) {
      return {
        isDuplicate: true,
        canonicalNodeId: bestMatch.nodeId,
        similarity: bestMatch.similarity,
      };
    }

    return { isDuplicate: false, similarity: 0 };
  }

  /**
   * Bulk index multiple nodes for embedding
   */
  async bulkIndex(nodes: GraphNode[]): Promise<void> {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      try {
        await this.getEmbedding(node.content);
        console.log(`SemanticDedup: indexed ${i + 1}/${nodes.length}`);
      } catch (error) {
        console.error(`SemanticDedup: failed to index node ${node.id}:`, error);
      }
    }
  }

  /**
   * Persist cache to disk
   */
  async persistCache(): Promise<void> {
    // Ensure directory exists
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }

    const cacheData: z.infer<typeof EmbeddingCacheFileSchema> = {
      version: CACHE_VERSION,
      entries: Array.from(this.cache.values()),
    };

    writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
  }

  /**
   * Load cache from disk
   */
  async loadCache(): Promise<void> {
    if (!existsSync(CACHE_FILE)) {
      return;
    }

    try {
      const raw = readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const validated = EmbeddingCacheFileSchema.parse(parsed);

      this.cache.clear();
      for (const entry of validated.entries) {
        // Only load entries for the current model
        if (entry.model === this.model) {
          this.cache.set(entry.nodeId, entry);
        }
      }
    } catch (error) {
      console.error('Failed to load embedding cache:', error);
      // Continue with empty cache
    }
  }

  /**
   * Clear in-memory cache (useful for tests)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for testing/monitoring)
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: SemanticDedup | null = null;

/**
 * Get the singleton SemanticDedup instance
 */
export function getSemanticDedup(): SemanticDedup {
  if (!instance) {
    instance = new SemanticDedup();
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSemanticDedup(): void {
  instance = null;
}
