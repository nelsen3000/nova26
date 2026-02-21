// Vector Index - Embedding-based retrieval with composite scoring
// Spec: .kiro/specs/hindsight-persistent-memory/design.md

import type {
  MemoryFragment,
  FragmentFilter,
  ScoredFragment,
  StorageAdapter,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface VectorIndexConfig {
  similarityThreshold: number;
  recencyWeight: number;
  frequencyWeight: number;
  similarityWeight: number;
}

export const DEFAULT_CONFIG: VectorIndexConfig = {
  similarityThreshold: 0.7,
  recencyWeight: 0.3,
  frequencyWeight: 0.2,
  similarityWeight: 0.5,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Vector Index
// ═══════════════════════════════════════════════════════════════════════════════

export class VectorIndex {
  private adapter: StorageAdapter;
  private config: VectorIndexConfig;
  private size: number = 0;

  constructor(adapter: StorageAdapter, config?: Partial<VectorIndexConfig>) {
    this.adapter = adapter;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async index(id: string, embedding: number[]): Promise<void> {
    // Index is managed by storage adapter, just update size
    this.size = await this.adapter.count();
  }

  async search(
    query: number[],
    topK: number,
    filter?: FragmentFilter,
    similarityThreshold?: number
  ): Promise<ScoredFragment[]> {
    const threshold = similarityThreshold ?? this.config.similarityThreshold;

    // Get initial results from adapter
    const results = await this.adapter.searchByVector(query, topK * 2, filter);

    // Calculate composite scores
    const scored = results.map(result => {
      const compositeScore = this.calculateCompositeScore(
        result.similarityScore,
        result.fragment
      );
      return {
        ...result,
        score: compositeScore,
      };
    });

    // Filter by threshold and sort
    return scored
      .filter(r => r.similarityScore >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async remove(id: string): Promise<void> {
    await this.adapter.delete(id);
    this.size = await this.adapter.count();
  }

  async rebuild(): Promise<void> {
    // For in-memory adapter, rebuild is a no-op
    this.size = await this.adapter.count();
  }

  getSize(): number {
    return this.size;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Composite Scoring
  // ═══════════════════════════════════════════════════════════════════════════

  private calculateCompositeScore(
    similarityScore: number,
    fragment: MemoryFragment
  ): number {
    const recencyScore = this.calculateRecencyScore(fragment);
    const frequencyScore = this.calculateFrequencyScore(fragment);

    // Weighted combination
    const compositeScore =
      similarityScore * this.config.similarityWeight +
      recencyScore * this.config.recencyWeight +
      frequencyScore * this.config.frequencyWeight;

    // Apply relevance multiplier
    return compositeScore * fragment.relevance;
  }

  private calculateRecencyScore(fragment: MemoryFragment): number {
    const now = Date.now();
    const ageMs = now - fragment.lastAccessedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    // Exponential decay: score = exp(-0.1 * ageDays)
    // Half-life: ~7 days
    return Math.exp(-0.1 * ageDays);
  }

  private calculateFrequencyScore(fragment: MemoryFragment): number {
    // Logarithmic scaling: score = log(1 + accessCount) / log(1 + maxExpected)
    const maxExpected = 100;
    return Math.log(1 + fragment.accessCount) / Math.log(1 + maxExpected);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Embedding Utilities
// ═══════════════════════════════════════════════════════════════════════════════

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Embedding dimension mismatch: ${a.length} vs ${b.length}`
    );
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

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) {
    return embedding;
  }
  return embedding.map(v => v / norm);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Embedding Generator (for testing)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateRandomEmbedding(dimension: number = 384): number[] {
  const embedding = new Array(dimension);
  for (let i = 0; i < dimension; i++) {
    embedding[i] = (Math.random() - 0.5) * 2;
  }
  return normalizeEmbedding(embedding);
}

export function generateQueryEmbedding(
  content: string,
  dimension: number = 384
): number[] {
  // Simple hash-based embedding for deterministic testing
  const embedding = new Array(dimension).fill(0);
  for (let i = 0; i < content.length; i++) {
    const charCode = content.charCodeAt(i);
    embedding[i % dimension] += charCode / 255;
  }
  return normalizeEmbedding(embedding);
}
