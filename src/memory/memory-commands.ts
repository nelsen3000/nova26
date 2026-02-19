// Explicit Memory Interface & CLI
// KIMI-MEMORY-04: R16-02 spec

import { z } from 'zod';
import {
  AgentMemoryStore,
  AgentMemory,
  type MemoryType,
  type MemoryOutcome,
  type SemanticMemory,
} from './agent-memory.js';
import { MemoryRetrieval, type MemoryConfidenceLabel } from './memory-retrieval.js';

// ============================================================================
// Core Types
// ============================================================================

export interface MemoryCommandResult {
  command: string;
  success: boolean;
  message: string;
  data?: unknown;
}

export interface MemoryListOptions {
  type?: MemoryType;
  project?: string;
  includeSuppressed?: boolean;
  limit?: number;                    // default: 20
  sortBy?: 'relevance' | 'created' | 'accessed';  // default: 'relevance'
}

export interface MemoryListEntry {
  id: string;
  type: MemoryType;
  content: string;                   // truncated to 80 chars for display
  relevanceScore: number;
  confidenceLabel: MemoryConfidenceLabel;
  outcome: MemoryOutcome;
  age: string;                       // human-readable, e.g. "3 days ago"
  accessCount: number;
  isPinned: boolean;
}

export interface MemoryStatsOutput {
  total: number;
  byType: Record<MemoryType, number>;
  avgRelevance: number;
  pinnedCount: number;
  suppressedCount: number;
  dbSizeBytes: number;
}

export interface MemoryExport {
  version: string;                   // '1.0.0'
  exportedAt: string;
  totalMemories: number;
  memories: AgentMemory[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const MemoryExportSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  totalMemories: z.number().int().nonnegative(),
  memories: z.array(z.any()), // AgentMemory validation done per-item
});

// ============================================================================
// MemoryCommands Class
// ============================================================================

export class MemoryCommands {
  private store: AgentMemoryStore;
  private embeddingFn: (text: string) => Promise<number[]>;
  private retrieval: MemoryRetrieval;

  constructor(
    store: AgentMemoryStore,
    embeddingFn: (text: string) => Promise<number[]>,
    retrieval: MemoryRetrieval
  ) {
    this.store = store;
    this.embeddingFn = embeddingFn;
    this.retrieval = retrieval;
  }

  // ---- Remember Command ----

  async remember(text: string, tags?: string[]): Promise<MemoryCommandResult> {
    // Embed the text
    const embedding = await this.embeddingFn(text);

    // Create a pinned semantic memory
    const memory: Omit<SemanticMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'> = {
      type: 'semantic',
      content: text,
      embedding,
      agentsInvolved: ['USER'],
      outcome: 'positive',
      relevanceScore: 1.0,
      isPinned: true,
      isSuppressed: false,
      tags: tags || ['user-defined'],
      confidence: 1.0,
      supportingMemoryIds: [],
    };

    const inserted = this.store.insertMemory(memory);

    const truncated = text.length > 60 ? text.substring(0, 57) + '...' : text;
    return {
      command: 'remember',
      success: true,
      message: `Remembered: '${truncated}' (pinned, will not decay)`,
      data: { memoryId: inserted.id },
    };
  }

  // ---- Forget Command ----

  async forget(query: string): Promise<MemoryCommandResult> {
    // Embed the query
    const queryEmbedding = await this.embeddingFn(query);

    // Get all non-suppressed memories
    const allMemories = this.store.getAllMemories({ includeSuppressed: false });

    // Find best match by cosine similarity
    let bestMatch: AgentMemory | null = null;
    let bestSimilarity = 0;

    for (const memory of allMemories) {
      const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = memory;
      }
    }

    // Require similarity > 0.5
    if (bestMatch && bestSimilarity > 0.5) {
      // Mark as suppressed
      this.store.updateMemory(bestMatch.id, { isSuppressed: true });

      const preview = bestMatch.content.substring(0, 60);
      return {
        command: 'forget',
        success: true,
        message: `Forgot: '${preview}${bestMatch.content.length > 60 ? '...' : ''}'`,
        data: { memoryId: bestMatch.id, similarity: bestSimilarity },
      };
    }

    return {
      command: 'forget',
      success: false,
      message: 'No matching memory found to forget',
    };
  }

  // ---- Ask Command ----

  async ask(query: string): Promise<MemoryCommandResult> {
    // Embed the query
    const queryEmbedding = await this.embeddingFn(query);

    // Query episodic memories only
    const episodicMemories = this.store.queryByType('episodic', { includeSuppressed: false, limit: 20 });

    // Rank by cosine similarity, take top 5
    const scored = episodicMemories.map(memory => ({
      memory,
      similarity: this.cosineSimilarity(queryEmbedding, memory.embedding),
    }));

    const top5 = scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    // Format natural language summary
    if (top5.length === 0) {
      return {
        command: 'ask',
        success: true,
        message: "I don't have any memories about that.",
      };
    }

    const lines: string[] = [];
    lines.push('Here is what I remember:');
    lines.push('');

    for (const { memory, similarity } of top5) {
      void similarity; // Similarity score used for ranking; acknowledged for debugging
      const confidenceText = this.retrieval.getConfidenceText(
        this.retrieval.getConfidenceLabel(memory.relevanceScore)
      );
      lines.push(`• ${confidenceText}: ${memory.content}`);
    }

    return {
      command: 'ask',
      success: true,
      message: lines.join('\n'),
      data: { memoriesFound: top5.length },
    };
  }

  // ---- List Command ----

  list(options?: MemoryListOptions): MemoryListEntry[] {
    const limit = options?.limit ?? 20;
    const sortBy = options?.sortBy ?? 'relevance';

    let memories: AgentMemory[];

    // Get memories based on filters
    if (options?.project) {
      memories = this.store.queryByProject(options.project, {
        type: options?.type,
        limit: limit * 2, // Get more for sorting
      });
    } else if (options?.type) {
      memories = this.store.queryByType(options.type, {
        includeSuppressed: options?.includeSuppressed,
        limit: limit * 2,
      });
    } else {
      memories = this.store.getAllMemories({ includeSuppressed: options?.includeSuppressed });
    }

    // Sort
    switch (sortBy) {
      case 'relevance':
        memories.sort((a, b) => b.relevanceScore - a.relevanceScore);
        break;
      case 'created':
        memories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'accessed':
        memories.sort((a, b) => {
          const aTime = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
          const bTime = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
          return bTime - aTime;
        });
        break;
    }

    // Apply limit and map to entries
    return memories.slice(0, limit).map(memory => ({
      id: memory.id,
      type: memory.type,
      content: memory.content.length > 80
        ? memory.content.substring(0, 77) + '...'
        : memory.content,
      relevanceScore: memory.relevanceScore,
      confidenceLabel: this.retrieval.getConfidenceLabel(memory.relevanceScore),
      outcome: memory.outcome,
      age: this.formatAge(memory.createdAt),
      accessCount: memory.accessCount,
      isPinned: memory.isPinned,
    }));
  }

  // ---- Show Command ----

  show(id: string): AgentMemory | undefined {
    return this.store.getMemory(id);
  }

  // ---- Stats Command ----

  stats(): MemoryStatsOutput {
    const storeStats = this.store.getStats();

    // Get database file size (this is approximate since we mock in tests)
    // In real implementation, would use fs.statSync on the db file
    const dbSizeBytes = 0;

    return {
      ...storeStats,
      dbSizeBytes,
    };
  }

  // ---- Export Command ----

  exportMemories(): MemoryExport {
    const allMemories = this.store.getAllMemories({ includeSuppressed: true });

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      totalMemories: allMemories.length,
      memories: allMemories,
    };
  }

  // ---- Import Command ----

  importMemories(data: MemoryExport): MemoryCommandResult {
    // Validate export data
    const parseResult = MemoryExportSchema.safeParse(data);
    if (!parseResult.success) {
      return {
        command: 'import',
        success: false,
        message: 'Invalid export data format',
      };
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const memory of data.memories) {
      // Check if memory with same ID already exists
      const existing = this.store.getMemory(memory.id);
      if (existing) {
        skippedCount++;
        continue;
      }

      // Insert the memory (without id/timestamps - store will generate new ones)
      this.store.insertMemory({
        type: memory.type,
        content: memory.content,
        embedding: memory.embedding,
        projectId: memory.projectId,
        buildId: memory.buildId,
        agentsInvolved: memory.agentsInvolved,
        outcome: memory.outcome,
        relevanceScore: memory.relevanceScore,
        isPinned: memory.isPinned,
        isSuppressed: memory.isSuppressed,
        tags: memory.tags,
        ...this.getTypeSpecificFields(memory),
      });
      importedCount++;
    }

    return {
      command: 'import',
      success: true,
      message: `Imported ${importedCount} memories, skipped ${skippedCount} duplicates`,
      data: { imported: importedCount, skipped: skippedCount },
    };
  }

  // ---- Utility ----

  formatAge(isoTimestamp: string): string {
    const timestamp = new Date(isoTimestamp).getTime();
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 30) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffDays < 365) {
      return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    } else {
      return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
    }
  }

  // ---- Private Helpers ----

  private cosineSimilarity(a: number[], b: number[]): number {
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

  private getTypeSpecificFields(memory: AgentMemory): Record<string, unknown> {
    if (memory.type === 'episodic') {
      return {
        eventDate: (memory as any).eventDate,
        location: (memory as any).location,
        decision: (memory as any).decision,
        alternativesConsidered: (memory as any).alternativesConsidered,
      };
    } else if (memory.type === 'semantic') {
      return {
        confidence: (memory as any).confidence ?? 0.7,
        supportingMemoryIds: (memory as any).supportingMemoryIds ?? [],
      };
    } else if (memory.type === 'procedural') {
      return {
        triggerPattern: (memory as any).triggerPattern ?? '',
        steps: (memory as any).steps ?? [],
        successRate: (memory as any).successRate ?? 1.0,
      };
    }
    return {};
  }
}
