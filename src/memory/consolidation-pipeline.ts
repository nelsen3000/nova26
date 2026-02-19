// Consolidation Pipeline
// KIMI-MEMORY-02: R16-02 spec

import { z } from 'zod';
import {
  AgentMemoryStore,
  AgentMemory,
  type MemoryType,
  type MemoryOutcome,
  type EpisodicMemory,
  type SemanticMemory,
  type ConsolidationResult,
} from './agent-memory.js';

// ============================================================================
// Core Types
// ============================================================================

export interface ConsolidationConfig {
  deduplicationThreshold: number;    // default: 0.82 (cosine similarity)
  maxMemoriesPerExtraction: number;  // default: 8
  compressionCycleInterval: number;  // default: 10
  maxDurationMs: number;             // default: 60000 (60 seconds)
  maxMemoryMb: number;               // default: 128
}

export interface BuildEventLog {
  buildId: string;
  projectId: string;
  tasks: Array<{
    taskId: string;
    agentName: string;
    description: string;
    output: string;
    outcome: 'success' | 'failure' | 'partial';
    aceScore?: number;
  }>;
  userInterventions: Array<{
    timestamp: string;
    action: string;
    context: string;
  }>;
  buildSummary: string;
  buildOutcome: 'success' | 'failure' | 'partial';
  startedAt: string;
  completedAt: string;
}

export interface ExtractionPromptResult {
  memories: Array<{
    type: MemoryType;
    content: string;
    outcome: MemoryOutcome;
    agentsInvolved: string[];
    tags: string[];
    // Episodic-specific
    eventDate?: string;
    location?: string;
    decision?: string;
    alternativesConsidered?: string[];
    // Semantic-specific
    confidence?: number;
    // Procedural-specific
    triggerPattern?: string;
    steps?: string[];
  }>;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ConsolidationConfigSchema = z.object({
  deduplicationThreshold: z.number().min(0).max(1).default(0.82),
  maxMemoriesPerExtraction: z.number().int().positive().default(8),
  compressionCycleInterval: z.number().int().positive().default(10),
  maxDurationMs: z.number().int().positive().default(60000),
  maxMemoryMb: z.number().int().positive().default(128),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: ConsolidationConfig = {
  deduplicationThreshold: 0.82,
  maxMemoriesPerExtraction: 8,
  compressionCycleInterval: 10,
  maxDurationMs: 60000,
  maxMemoryMb: 128,
};

// ============================================================================
// ConsolidationPipeline Class
// ============================================================================

export class ConsolidationPipeline {
  private store: AgentMemoryStore;
  private embeddingFn: (text: string) => Promise<number[]>;
  private extractionFn: (eventLog: BuildEventLog) => Promise<ExtractionPromptResult>;
  private config: ConsolidationConfig;

  constructor(
    store: AgentMemoryStore,
    embeddingFn: (text: string) => Promise<number[]>,
    extractionFn: (eventLog: BuildEventLog) => Promise<ExtractionPromptResult>,
    config?: Partial<ConsolidationConfig>
  ) {
    this.store = store;
    this.embeddingFn = embeddingFn;
    this.extractionFn = extractionFn;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Main Consolidation ----

  async consolidate(eventLog: BuildEventLog): Promise<ConsolidationResult> {
    const startTime = Date.now();
    const result: ConsolidationResult = {
      buildId: eventLog.buildId,
      consolidatedAt: new Date().toISOString(),
      memoriesExtracted: 0,
      memoriesDeduplicated: 0,
      memoriesCompressed: 0,
      memoriesDeleted: 0,
      newMemoryIds: [],
      durationMs: 0,
    };

    // Extract candidate memories from build log
    const extraction = await this.extractionFn(eventLog);
    const candidates = extraction.memories.slice(0, this.config.maxMemoriesPerExtraction);

    for (const candidate of candidates) {
      // Check time limit
      if (Date.now() - startTime > this.config.maxDurationMs) {
        break;
      }

      // Compute embedding
      const embedding = await this.embeddingFn(candidate.content);

      // Check for duplicates
      const duplicate = this.deduplicate(embedding, candidate.type);

      if (duplicate) {
        // Merge with existing
        this.merge(duplicate, {
          content: candidate.content,
          sourceEventIds: [eventLog.buildId],
          outcome: candidate.outcome,
        });
        result.memoriesDeduplicated++;
      } else {
        // Insert new memory
        const memory = this.candidateToMemory(candidate, embedding, eventLog);
        const inserted = this.store.insertMemory(memory);
        result.newMemoryIds.push(inserted.id);
        result.memoriesExtracted++;
      }
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  // ---- Deduplication ----

  deduplicate(embedding: number[], type: MemoryType): AgentMemory | null {
    // Query existing memories of the same type (non-suppressed, limit 100)
    const existingMemories = this.store.queryByType(type, { includeSuppressed: false, limit: 100 });

    for (const existing of existingMemories) {
      const similarity = this.cosineSimilarity(embedding, existing.embedding);
      if (similarity >= this.config.deduplicationThreshold) {
        return existing;
      }
    }

    return null;
  }

  // ---- Merge ----

  merge(
    existing: AgentMemory,
    candidate: { content: string; sourceEventIds?: string[]; outcome: MemoryOutcome }
  ): AgentMemory {
    // Merge sourceEventIds (for future use in tracking)
    const newSourceEventIds = candidate.sourceEventIds || [];
    void [...(existing.sourceEventIds || []), ...newSourceEventIds]; // Acknowledge for future use

    // Average relevanceScore
    const newRelevance = (existing.relevanceScore + 1.0) / 2;

    // If candidate's content is longer (more detail), replace existing content
    const newContent = candidate.content.length > existing.content.length
      ? candidate.content
      : existing.content;

    return this.store.updateMemory(existing.id, {
      content: newContent,
      relevanceScore: newRelevance,
      outcome: candidate.outcome,
    });
  }

  // ---- Compression ----

  async compress(cycleCount: number): Promise<{ compressed: number; deleted: number }> {
    // Only run on compression cycle intervals
    if (cycleCount % this.config.compressionCycleInterval !== 0) {
      return { compressed: 0, deleted: 0 };
    }

    let compressed = 0;
    let deleted = 0;

    // Get all episodic memories
    const episodicMemories = this.store.queryByType('episodic', { includeSuppressed: false, limit: 1000 });

    // Group by overlapping tags (2+ shared tags = same group)
    const groups = this.groupMemoriesByTags(episodicMemories);

    // For each group of 3+ with same outcome, create semantic memory
    for (const group of groups) {
      if (group.length >= 3 && this.haveSameOutcome(group)) {
        await this.createSemanticFromEpisodic(group);
        compressed++;
      }
    }

    // Garbage collection: delete low-relevance memories
    const allMemories = this.store.getAllMemories({ includeSuppressed: false });
    for (const memory of allMemories) {
      if (
        memory.relevanceScore < this.store['config'].forgettingCurve.deletionThreshold &&
        memory.accessCount < 3 &&
        !memory.isPinned &&
        !memory.isSuppressed &&
        !this.isLandmark(memory)
      ) {
        this.store.deleteMemory(memory.id);
        deleted++;
      }
    }

    return { compressed, deleted };
  }

  // ---- Landmark Detection ----

  isLandmark(memory: AgentMemory): boolean {
    // Check by tags
    const landmarkTags = ['critical-failure', 'data-loss', 'security-incident', 'user-escalation'];
    if (memory.tags.some(tag => landmarkTags.includes(tag))) {
      return true;
    }

    // Check if negative outcome and only record for project
    if (memory.outcome === 'negative' && memory.projectId) {
      const projectMemories = this.store.queryByProject(memory.projectId);
      const similarTagged = projectMemories.filter(m => 
        m.tags.some(tag => memory.tags.includes(tag))
      );
      if (similarTagged.length <= 1) {
        return true;
      }
    }

    return false;
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

  private candidateToMemory(
    candidate: ExtractionPromptResult['memories'][0],
    embedding: number[],
    eventLog: BuildEventLog
  ): Omit<AgentMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'> {
    const baseMemory = {
      type: candidate.type,
      content: candidate.content,
      embedding,
      projectId: eventLog.projectId,
      buildId: eventLog.buildId,
      agentsInvolved: candidate.agentsInvolved,
      outcome: candidate.outcome,
      relevanceScore: 1.0,
      isPinned: false,
      isSuppressed: false,
      tags: candidate.tags,
      sourceEventIds: [eventLog.buildId],
    };

    if (candidate.type === 'episodic') {
      return {
        ...baseMemory,
        eventDate: candidate.eventDate || eventLog.completedAt,
        location: candidate.location || `${eventLog.projectId}`,
        decision: candidate.decision,
        alternativesConsidered: candidate.alternativesConsidered,
      } as Omit<EpisodicMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>;
    }

    if (candidate.type === 'semantic') {
      return {
        ...baseMemory,
        confidence: candidate.confidence || 0.7,
        supportingMemoryIds: [],
      } as Omit<SemanticMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>;
    }

    // procedural
    return {
      ...baseMemory,
      triggerPattern: candidate.triggerPattern || '',
      steps: candidate.steps || [],
      successRate: 1.0,
    } as Omit<import('./agent-memory.js').ProceduralMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>;
  }

  private groupMemoriesByTags(memories: AgentMemory[]): AgentMemory[][] {
    const groups: AgentMemory[][] = [];
    const used = new Set<string>();

    for (const memory of memories) {
      if (used.has(memory.id)) continue;

      const group: AgentMemory[] = [memory];
      used.add(memory.id);

      for (const other of memories) {
        if (used.has(other.id)) continue;

        // Check if 2+ tags overlap
        const sharedTags = memory.tags.filter(tag => other.tags.includes(tag));
        if (sharedTags.length >= 2) {
          group.push(other);
          used.add(other.id);
        }
      }

      if (group.length >= 3) {
        groups.push(group);
      }
    }

    return groups;
  }

  private haveSameOutcome(memories: AgentMemory[]): boolean {
    if (memories.length === 0) return false;
    const firstOutcome = memories[0].outcome;
    return memories.every(m => m.outcome === firstOutcome);
  }

  private async createSemanticFromEpisodic(group: AgentMemory[]): Promise<void> {
    // Create summary content
    const contents = group.map(m => m.content);
    const summaryContent = `Pattern observed across ${group.length} builds: ${contents.join('; ')}`;

    // Compute embedding for summary
    const embedding = await this.embeddingFn(summaryContent);

    // Determine confidence based on group size
    let confidence = 0.7;
    if (group.length >= 5) confidence = 0.9;
    else if (group.length >= 4) confidence = 0.8;

    // Create semantic memory
    const semanticMemory: Omit<SemanticMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'> = {
      type: 'semantic',
      content: summaryContent,
      embedding,
      agentsInvolved: [...new Set(group.flatMap(m => m.agentsInvolved))],
      outcome: group[0].outcome,
      relevanceScore: 1.0,
      isPinned: false,
      isSuppressed: false,
      tags: [...new Set(group.flatMap(m => m.tags))],
      confidence,
      supportingMemoryIds: group.map(m => m.id),
    };

    this.store.insertMemory(semanticMemory);
  }
}
