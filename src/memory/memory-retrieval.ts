// Memory Retrieval & Forgetting Curve
// KIMI-MEMORY-03: R16-02 spec

import { z } from 'zod';
import {
  AgentMemoryStore,
  AgentMemory,
  EpisodicMemory,
  ProceduralMemory,
  type RetrievalQuery,
  type RetrievalResult,
} from './agent-memory.js';

// ============================================================================
// Core Types
// ============================================================================

export interface RetrievalConfig {
  maxEpisodic: number;               // default: 5
  maxSemantic: number;               // default: 3
  maxProcedural: number;             // default: 2
  maxTokens: number;                 // default: 800
  negativeBoostMultiplier: number;   // default: 1.5
  recencyWeight: number;             // default: 0.1 (multiplied by accessCount in scoring)
}

export interface ForgettingCurveConfig {
  decayRate: number;                 // default: 0.05
  deletionThreshold: number;        // default: 0.1
  reinforcementBoost: number;       // default: 0.2
  maxRelevance: number;             // default: 1.0
}

// Relevance-to-language mapping for user-facing output
export type MemoryConfidenceLabel =
  | 'clear'      // 0.8-1.0: "I have a clear memory of this"
  | 'recall'     // 0.5-0.8: "I recall something similar"
  | 'vague'      // 0.2-0.5: "I vaguely remember"
  | 'none';      // <0.2: "I don't think we've tried this before"

// ============================================================================
// Zod Schemas
// ============================================================================

export const RetrievalConfigSchema = z.object({
  maxEpisodic: z.number().int().positive().default(5),
  maxSemantic: z.number().int().positive().default(3),
  maxProcedural: z.number().int().positive().default(2),
  maxTokens: z.number().int().positive().default(800),
  negativeBoostMultiplier: z.number().positive().default(1.5),
  recencyWeight: z.number().min(0).default(0.1),
});

export const ForgettingCurveConfigSchema = z.object({
  decayRate: z.number().min(0).max(1).default(0.05),
  deletionThreshold: z.number().min(0).max(1).default(0.1),
  reinforcementBoost: z.number().min(0).max(1).default(0.2),
  maxRelevance: z.number().min(0).max(1).default(1.0),
});

// ============================================================================
// Default Configs
// ============================================================================

const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  maxEpisodic: 5,
  maxSemantic: 3,
  maxProcedural: 2,
  maxTokens: 800,
  negativeBoostMultiplier: 1.5,
  recencyWeight: 0.1,
};

const DEFAULT_FORGETTING_CONFIG: ForgettingCurveConfig = {
  decayRate: 0.05,
  deletionThreshold: 0.1,
  reinforcementBoost: 0.2,
  maxRelevance: 1.0,
};

// ============================================================================
// MemoryRetrieval Class
// ============================================================================

export class MemoryRetrieval {
  private store: AgentMemoryStore;
  private embeddingFn: (text: string) => Promise<number[]>;
  private config: RetrievalConfig;
  private forgettingConfig: ForgettingCurveConfig;

  constructor(
    store: AgentMemoryStore,
    embeddingFn: (text: string) => Promise<number[]>,
    config?: Partial<RetrievalConfig>,
    forgettingConfig?: Partial<ForgettingCurveConfig>
  ) {
    this.store = store;
    this.embeddingFn = embeddingFn;
    this.config = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };
    this.forgettingConfig = { ...DEFAULT_FORGETTING_CONFIG, ...forgettingConfig };
  }

  // ---- Main Retrieval ----

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    // Get embedding for query if not provided
    const queryEmbedding = query.taskEmbedding.length > 0
      ? query.taskEmbedding
      : await this.embeddingFn(query.taskDescription);

    const allRetrieved: AgentMemory[] = [];

    // Retrieve from each memory type
    const typeConfigs = [
      { type: 'episodic' as const, max: query.maxEpisodic },
      { type: 'semantic' as const, max: query.maxSemantic },
      { type: 'procedural' as const, max: query.maxProcedural },
    ];

    for (const { type, max } of typeConfigs) {
      // Query non-suppressed memories of this type
      const memories = this.store.queryByType(type, { includeSuppressed: false, limit: 20 });

      // Score and rank memories
      const scored = memories.map(memory => ({
        memory,
        score: this.computeRetrievalScore(memory, queryEmbedding),
      }));

      // Sort by score descending and take top N
      const topN = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, max)
        .map(s => s.memory);

      allRetrieved.push(...topN);
    }

    // Enforce token budget
    const withinBudget = this.enforceTokenBudget(allRetrieved, query.maxTokens);

    // Record access on retrieved memories
    for (const memory of withinBudget) {
      this.store.recordAccess(memory.id);
    }

    // Format prefix
    const injectedPromptPrefix = this.formatInjectedPrefix(withinBudget);

    return {
      queryId: crypto.randomUUID(),
      memories: withinBudget,
      totalTokensUsed: this.estimateTokens(withinBudget),
      injectedPromptPrefix,
      retrievedAt: new Date().toISOString(),
    };
  }

  // ---- Prompt Formatting ----

  formatInjectedPrefix(memories: AgentMemory[]): string {
    if (memories.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push('You have the following relevant memories from past experience:');
    lines.push('');

    for (const memory of memories) {
      if (memory.type === 'episodic') {
        const em = memory as EpisodicMemory;
        const label = this.getConfidenceLabel(memory.relevanceScore);
        const date = em.eventDate ? new Date(em.eventDate).toLocaleDateString() : 'unknown date';
        const project = memory.projectId || 'unknown project';
        lines.push(`• Episodic (${label}): On ${date} in ${project}, ${memory.content}`);
      } else if (memory.type === 'semantic') {
        lines.push(`• Semantic: ${memory.content}`);
      } else if (memory.type === 'procedural') {
        const pm = memory as ProceduralMemory;
        const steps = pm.steps.join(' → ');
        lines.push(`• Procedural: When ${pm.triggerPattern}: ${steps}`);
      }
    }

    lines.push('');
    lines.push('Use these memories to inform your work. Avoid repeating past mistakes.');

    return lines.join('\n');
  }

  // ---- Forgetting Curve ----

  calculateDecayedRelevance(
    initialWeight: number,
    daysSinceLastAccess: number,
    isPinned: boolean
  ): number {
    if (isPinned) {
      return 1.0;
    }
    return Math.max(0.0, initialWeight * Math.exp(-this.forgettingConfig.decayRate * daysSinceLastAccess));
  }

  applyDecay(): { updated: number; belowThreshold: number } {
    const allMemories = this.store.getAllMemories({ includeSuppressed: false });
    let updated = 0;
    let belowThreshold = 0;
    const now = new Date();

    for (const memory of allMemories) {
      if (memory.isPinned) continue;

      const lastAccess = memory.lastAccessedAt || memory.createdAt;
      const daysSince = (now.getTime() - new Date(lastAccess).getTime()) / (1000 * 60 * 60 * 24);
      
      const decayedRelevance = this.calculateDecayedRelevance(
        memory.relevanceScore,
        daysSince,
        memory.isPinned
      );

      this.store.updateMemory(memory.id, { relevanceScore: decayedRelevance });
      updated++;

      if (decayedRelevance < this.forgettingConfig.deletionThreshold) {
        belowThreshold++;
      }
    }

    return { updated, belowThreshold };
  }

  // ---- Confidence Labels ----

  getConfidenceLabel(relevanceScore: number): MemoryConfidenceLabel {
    if (relevanceScore >= 0.8) return 'clear';
    if (relevanceScore >= 0.5) return 'recall';
    if (relevanceScore >= 0.2) return 'vague';
    return 'none';
  }

  getConfidenceText(label: MemoryConfidenceLabel): string {
    switch (label) {
      case 'clear':
        return 'I have a clear memory of this';
      case 'recall':
        return 'I recall something similar';
      case 'vague':
        return 'I vaguely remember';
      case 'none':
        return "I don't think we've tried this before";
    }
  }

  // ---- Utility ----

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
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

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ---- Private Helpers ----

  private computeRetrievalScore(memory: AgentMemory, queryEmbedding: number[]): number {
    // Base score: relevanceScore * (1 + recencyWeight * accessCount)
    let score = memory.relevanceScore * (1 + this.config.recencyWeight * memory.accessCount);

    // Boost negative outcomes
    if (memory.outcome === 'negative') {
      score *= this.config.negativeBoostMultiplier;
    }

    // Re-rank by cosine similarity to query
    const similarity = this.cosineSimilarity(memory.embedding, queryEmbedding);
    score *= (1 + similarity); // Weight by similarity

    return score;
  }

  private enforceTokenBudget(memories: AgentMemory[], maxTokens: number): AgentMemory[] {
    // Estimate tokens for each memory
    const withTokens = memories.map(memory => ({
      memory,
      tokens: Math.ceil(memory.content.length / 4),
    }));

    // Sort by relevance score descending
    withTokens.sort((a, b) => b.memory.relevanceScore - a.memory.relevanceScore);

    // Take memories until token budget is reached
    const result: AgentMemory[] = [];
    let totalTokens = 0;

    for (const { memory, tokens } of withTokens) {
      if (totalTokens + tokens > maxTokens) {
        break;
      }
      result.push(memory);
      totalTokens += tokens;
    }

    return result;
  }

  private estimateTokens(memories: AgentMemory[]): number {
    return memories.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }
}
