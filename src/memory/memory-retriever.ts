// Memory Retriever - Various retrieval strategies for memory store
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-03)

import type { MemoryItem, MemoryLevel } from './memory-store.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type RetrievalStrategy = 'keyword' | 'semantic' | 'temporal' | 'importance' | 'hybrid';

export interface RetrievalOptions {
  strategy?: RetrievalStrategy;
  level?: MemoryLevel;
  limit?: number;
  minScore?: number;
  tags?: string[];
}

export interface RetrievalResult {
  item: MemoryItem;
  score: number;
  strategy: RetrievalStrategy;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TF-IDF Implementation
// ═══════════════════════════════════════════════════════════════════════════════

class TFIDFIndex {
  private documents: Map<string, string[]> = new Map();
  private idf: Map<string, number> = new Map();

  addDocument(id: string, tokens: string[]): void {
    this.documents.set(id, tokens);
    this.computeIDF();
  }

  removeDocument(id: string): void {
    this.documents.delete(id);
    this.computeIDF();
  }

  private computeIDF(): void {
    const docCount = this.documents.size;
    const docFreq = new Map<string, number>();

    for (const tokens of this.documents.values()) {
      const unique = new Set(tokens);
      for (const token of unique) {
        docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
      }
    }

    this.idf.clear();
    for (const [token, freq] of docFreq) {
      // Use smoothing: log((N + 1) / df) to handle single-document case
      this.idf.set(token, Math.log((docCount + 1) / freq));
    }
  }

  computeTFIDF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    const tfidf = new Map<string, number>();
    const maxTf = Math.max(...tf.values(), 1);

    for (const [token, count] of tf) {
      const normalizedTf = count / maxTf;
      const idf = this.idf.get(token) ?? 0;
      tfidf.set(token, normalizedTf * idf);
    }

    return tfidf;
  }

  cosineSimilarity(tokensA: string[], tokensB: string[]): number {
    const vecA = this.computeTFIDF(tokensA);
    const vecB = this.computeTFIDF(tokensB);

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [token, valA] of vecA) {
      const valB = vecB.get(token) ?? 0;
      dotProduct += valA * valB;
      normA += valA * valA;
    }

    for (const valB of vecB.values()) {
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MemoryIndex Class
// ═══════════════════════════════════════════════════════════════════════════════

export class MemoryIndex {
  private keywordIndex: Map<string, Set<string>> = new Map();
  private tfidf: TFIDFIndex = new TFIDFIndex();

  indexItem(item: MemoryItem): void {
    const tokens = this.tokenize(item.content);

    // Add to keyword index
    for (const token of tokens) {
      const set = this.keywordIndex.get(token) ?? new Set();
      set.add(item.id);
      this.keywordIndex.set(token, set);
    }

    // Add to TF-IDF
    this.tfidf.addDocument(item.id, tokens);
  }

  removeItem(item: MemoryItem): void {
    const tokens = this.tokenize(item.content);

    for (const token of tokens) {
      const set = this.keywordIndex.get(token);
      if (set) {
        set.delete(item.id);
        if (set.size === 0) {
          this.keywordIndex.delete(token);
        }
      }
    }

    this.tfidf.removeDocument(item.id);
  }

  searchKeywords(query: string): Set<string> {
    const tokens = this.tokenize(query);
    const results = new Set<string>();

    for (const token of tokens) {
      const matches = this.keywordIndex.get(token);
      if (matches) {
        for (const id of matches) {
          results.add(id);
        }
      }
    }

    return results;
  }

  computeSimilarity(query: string, item: MemoryItem): number {
    const queryTokens = this.tokenize(query);
    const itemTokens = this.tokenize(item.content);
    return this.tfidf.cosineSimilarity(queryTokens, itemTokens);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RelevanceScorer Class
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScoringWeights {
  textSimilarity: number;
  recency: number;
  importance: number;
  frequency: number;
  tagMatch: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  textSimilarity: 0.3,
  recency: 0.25,
  importance: 0.2,
  frequency: 0.15,
  tagMatch: 0.1,
};

export class RelevanceScorer {
  private weights: ScoringWeights;
  private index: MemoryIndex;

  constructor(weights: Partial<ScoringWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.index = new MemoryIndex();
  }

  /**
   * Score an item's relevance to a query
   */
  score(query: string, item: MemoryItem, queryTags?: string[]): number {
    const now = Date.now();
    const scores: Record<string, number> = {};

    // Text similarity (TF-IDF cosine)
    scores.textSimilarity = this.index.computeSimilarity(query, item);

    // Recency decay (exponential)
    const ageHours = (now - item.accessedAt) / (1000 * 60 * 60);
    scores.recency = Math.exp(-ageHours / 24); // 24 hour half-life

    // Importance (already 0-1)
    scores.importance = item.importance;

    // Access frequency (log-normalized)
    scores.frequency = Math.log(1 + item.accessCount) / Math.log(100);

    // Tag match
    if (queryTags && queryTags.length > 0) {
      const matched = queryTags.filter(t => item.tags.includes(t)).length;
      scores.tagMatch = matched / queryTags.length;
    } else {
      scores.tagMatch = 0;
    }

    // Weighted sum
    let totalScore = 0;
    for (const [key, weight] of Object.entries(this.weights)) {
      totalScore += scores[key as keyof ScoringWeights] * weight;
    }

    return Math.min(1, Math.max(0, totalScore));
  }

  indexItems(items: MemoryItem[]): void {
    for (const item of items) {
      this.index.indexItem(item);
    }
  }

  indexItem(item: MemoryItem): void {
    this.index.indexItem(item);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MemoryRetriever Class
// ═══════════════════════════════════════════════════════════════════════════════

export class MemoryRetriever {
  private scorer: RelevanceScorer;
  private memoryIndex: MemoryIndex;

  constructor(weights?: Partial<ScoringWeights>) {
    this.scorer = new RelevanceScorer(weights);
    this.memoryIndex = new MemoryIndex();
  }

  /**
   * Retrieve items using specified strategy
   */
  retrieve(
    items: MemoryItem[],
    query: string,
    options: RetrievalOptions = {}
  ): RetrievalResult[] {
    const {
      strategy = 'hybrid',
      limit = 10,
      minScore = 0.1,
      tags,
    } = options;

    // Filter by tags first
    let candidates = items;
    if (tags && tags.length > 0) {
      candidates = items.filter(item =>
        tags.some(tag => item.tags.includes(tag))
      );
    }

    // Apply strategy
    let results: RetrievalResult[] = [];

    switch (strategy) {
      case 'keyword':
        results = this.keywordRetrieve(candidates, query);
        break;
      case 'semantic':
        results = this.semanticRetrieve(candidates, query);
        break;
      case 'temporal':
        results = this.temporalRetrieve(candidates);
        break;
      case 'importance':
        results = this.importanceRetrieve(candidates);
        break;
      case 'hybrid':
      default:
        results = this.hybridRetrieve(candidates, query, tags);
        break;
    }

    // Filter by minimum score
    results = results.filter(r => r.score >= minScore);

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Index items for retrieval
   */
  index(items: MemoryItem[]): void {
    for (const item of items) {
      this.memoryIndex.indexItem(item);
      this.scorer.indexItem(item);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Strategy Implementations
  // ═══════════════════════════════════════════════════════════════════════════════

  private keywordRetrieve(items: MemoryItem[], query: string): RetrievalResult[] {
    const matches = this.memoryIndex.searchKeywords(query);

    return items
      .filter(item => matches.has(item.id))
      .map(item => ({
        item,
        score: 1,
        strategy: 'keyword' as const,
      }));
  }

  private semanticRetrieve(items: MemoryItem[], query: string): RetrievalResult[] {
    return items.map(item => ({
      item,
      score: this.memoryIndex.computeSimilarity(query, item),
      strategy: 'semantic' as const,
    }));
  }

  private temporalRetrieve(items: MemoryItem[]): RetrievalResult[] {
    const now = Date.now();

    return items.map(item => {
      const ageHours = (now - item.accessedAt) / (1000 * 60 * 60);
      const score = Math.exp(-ageHours / 24);

      return {
        item,
        score,
        strategy: 'temporal' as const,
      };
    });
  }

  private importanceRetrieve(items: MemoryItem[]): RetrievalResult[] {
    return items.map(item => ({
      item,
      score: item.importance,
      strategy: 'importance' as const,
    }));
  }

  private hybridRetrieve(
    items: MemoryItem[],
    query: string,
    tags?: string[]
  ): RetrievalResult[] {
    return items.map(item => ({
      item,
      score: this.scorer.score(query, item, tags),
      strategy: 'hybrid' as const,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalRetriever: MemoryRetriever | null = null;

export function getMemoryRetriever(weights?: Partial<ScoringWeights>): MemoryRetriever {
  if (!globalRetriever) {
    globalRetriever = new MemoryRetriever(weights);
  }
  return globalRetriever;
}

export function resetMemoryRetriever(): void {
  globalRetriever = null;
}
