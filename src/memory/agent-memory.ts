// Agent Memory Types & SQLite Store
// KIMI-MEMORY-01: R16-02 spec

import { z } from 'zod';
import Database from 'better-sqlite3';

// ============================================================================
// Core Types
// ============================================================================

export interface AgentMemoryConfig {
  dbPath: string;                     // default: '~/.nova/memory.db'
  consolidationEnabled: boolean;      // default: true
  retrievalBudget: {
    episodic: number;                 // default: 5
    semantic: number;                 // default: 3
    procedural: number;              // default: 2
    maxTokens: number;               // default: 800
  };
  forgettingCurve: {
    decayRate: number;               // default: 0.05
    deletionThreshold: number;       // default: 0.1
    reinforcementBoost: number;      // default: 0.2
  };
  compressionCycleInterval: number;  // default: 10 (builds)
}

export type MemoryType = 'episodic' | 'semantic' | 'procedural';
export type MemoryOutcome = 'positive' | 'negative' | 'neutral' | 'unknown';

export interface AgentMemory {
  id: string;
  type: MemoryType;
  content: string;                   // natural language, max 800 chars
  embedding: number[];               // vector for semantic search
  projectId?: string;                // undefined for cross-project semantic memories
  buildId?: string;                  // undefined for semantic and procedural memories
  agentsInvolved: string[];
  outcome: MemoryOutcome;
  relevanceScore: number;            // 0-1, decays over time
  isPinned: boolean;                 // pinned memories do not decay
  isSuppressed: boolean;             // suppressed memories are not retrieved
  accessCount: number;
  lastAccessedAt?: string;
  createdAt: string;
  updatedAt: string;
  sourceEventIds?: string[];         // build event log IDs that produced this memory
  tags: string[];
}

export type EpisodicMemory = AgentMemory & {
  type: 'episodic';
  eventDate: string;
  location: string;                  // e.g., 'auth/session.ts during auth sprint'
  decision?: string;                 // what was decided
  alternativesConsidered?: string[];
};

export type SemanticMemory = AgentMemory & {
  type: 'semantic';
  confidence: number;                // 0-1, how confident ATLAS is in this generalization
  supportingMemoryIds: string[];     // episodic memories that back this up
};

export type ProceduralMemory = AgentMemory & {
  type: 'procedural';
  triggerPattern: string;            // when this procedure applies
  steps: string[];                   // ordered list of actions
  successRate: number;              // 0-1
};

export interface ConsolidationResult {
  buildId: string;
  consolidatedAt: string;
  memoriesExtracted: number;
  memoriesDeduplicated: number;
  memoriesCompressed: number;
  memoriesDeleted: number;
  newMemoryIds: string[];
  durationMs: number;
}

export interface RetrievalQuery {
  taskDescription: string;
  taskEmbedding: number[];
  agentName: string;
  projectId: string;
  maxEpisodic: number;
  maxSemantic: number;
  maxProcedural: number;
  maxTokens: number;
}

export interface RetrievalResult {
  queryId: string;
  memories: AgentMemory[];
  totalTokensUsed: number;
  injectedPromptPrefix: string;      // formatted memory context for the agent
  retrievedAt: string;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const AgentMemoryConfigSchema = z.object({
  dbPath: z.string().default('~/.nova/memory.db'),
  consolidationEnabled: z.boolean().default(true),
  retrievalBudget: z.object({
    episodic: z.number().int().positive().default(5),
    semantic: z.number().int().positive().default(3),
    procedural: z.number().int().positive().default(2),
    maxTokens: z.number().int().positive().default(800),
  }).default({}),
  forgettingCurve: z.object({
    decayRate: z.number().min(0).max(1).default(0.05),
    deletionThreshold: z.number().min(0).max(1).default(0.1),
    reinforcementBoost: z.number().min(0).max(1).default(0.2),
  }).default({}),
  compressionCycleInterval: z.number().int().positive().default(10),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: AgentMemoryConfig = {
  dbPath: '~/.nova/memory.db',
  consolidationEnabled: true,
  retrievalBudget: {
    episodic: 5,
    semantic: 3,
    procedural: 2,
    maxTokens: 800,
  },
  forgettingCurve: {
    decayRate: 0.05,
    deletionThreshold: 0.1,
    reinforcementBoost: 0.2,
  },
  compressionCycleInterval: 10,
};

// ============================================================================
// Embedding Serialization Utilities
// ============================================================================

export function serializeEmbedding(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

export function deserializeEmbedding(blob: Buffer): number[] {
  return Array.from(new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4));
}

// ============================================================================
// AgentMemoryStore Class
// ============================================================================

export class AgentMemoryStore {
  private db: Database.Database;
  private config: AgentMemoryConfig;

  constructor(config?: Partial<AgentMemoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Open database (will create if doesn't exist)
    this.db = new Database(this.config.dbPath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Initialize schema
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Main memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('episodic', 'semantic', 'procedural')),
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        project_id TEXT,
        build_id TEXT,
        agents_involved TEXT NOT NULL,
        outcome TEXT NOT NULL DEFAULT 'unknown',
        relevance_score REAL NOT NULL DEFAULT 1.0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_suppressed INTEGER NOT NULL DEFAULT 0,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        extra_json TEXT
      );
    `);

    // Indexes for efficient querying
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
      CREATE INDEX IF NOT EXISTS idx_memories_relevance ON memories(relevance_score DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_suppressed ON memories(is_suppressed);
      CREATE INDEX IF NOT EXISTS idx_memories_type_relevance ON memories(type, relevance_score DESC);
    `);
  }

  // ---- CRUD Operations ----

  insertMemory(
    memory: Omit<AgentMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>
  ): AgentMemory {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const fullMemory: AgentMemory = {
      ...memory,
      id,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Serialize embedding
    const embeddingBlob = serializeEmbedding(memory.embedding);

    // Extract type-specific fields into extra_json
    let extraJson: Record<string, unknown> = {};
    if (memory.type === 'episodic') {
      const em = memory as EpisodicMemory;
      extraJson = {
        eventDate: em.eventDate,
        location: em.location,
        decision: em.decision,
        alternativesConsidered: em.alternativesConsidered,
      };
    } else if (memory.type === 'semantic') {
      const sm = memory as SemanticMemory;
      extraJson = {
        confidence: sm.confidence,
        supportingMemoryIds: sm.supportingMemoryIds,
      };
    } else if (memory.type === 'procedural') {
      const pm = memory as ProceduralMemory;
      extraJson = {
        triggerPattern: pm.triggerPattern,
        steps: pm.steps,
        successRate: pm.successRate,
      };
    }

    const stmt = this.db.prepare(`
      INSERT INTO memories (
        id, type, content, embedding, project_id, build_id, agents_involved,
        outcome, relevance_score, is_pinned, is_suppressed, access_count,
        last_accessed_at, created_at, updated_at, tags, extra_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      memory.type,
      memory.content,
      embeddingBlob,
      memory.projectId ?? null,
      memory.buildId ?? null,
      JSON.stringify(memory.agentsInvolved),
      memory.outcome,
      memory.relevanceScore,
      memory.isPinned ? 1 : 0,
      memory.isSuppressed ? 1 : 0,
      0, // access_count
      null, // last_accessed_at
      now,
      now,
      JSON.stringify(memory.tags),
      JSON.stringify(extraJson)
    );

    return fullMemory;
  }

  getMemory(id: string): AgentMemory | undefined {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    
    if (!row) return undefined;
    
    return this.rowToMemory(row);
  }

  updateMemory(
    id: string,
    updates: Partial<Pick<AgentMemory, 'content' | 'relevanceScore' | 'isPinned' | 'isSuppressed' | 'tags' | 'outcome'>>
  ): AgentMemory {
    const existing = this.getMemory(id);
    if (!existing) {
      throw new Error(`Memory not found: ${id}`);
    }

    const now = new Date().toISOString();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.content !== undefined) {
      sets.push('content = ?');
      values.push(updates.content);
    }
    if (updates.relevanceScore !== undefined) {
      sets.push('relevance_score = ?');
      values.push(updates.relevanceScore);
    }
    if (updates.isPinned !== undefined) {
      sets.push('is_pinned = ?');
      values.push(updates.isPinned ? 1 : 0);
    }
    if (updates.isSuppressed !== undefined) {
      sets.push('is_suppressed = ?');
      values.push(updates.isSuppressed ? 1 : 0);
    }
    if (updates.tags !== undefined) {
      sets.push('tags = ?');
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.outcome !== undefined) {
      sets.push('outcome = ?');
      values.push(updates.outcome);
    }

    sets.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE memories SET ${sets.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    return this.getMemory(id)!;
  }

  deleteMemory(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ---- Query Operations ----

  queryByType(
    type: MemoryType,
    options?: { limit?: number; includeSuppressed?: boolean }
  ): AgentMemory[] {
    const limit = options?.limit ?? 50;
    const includeSuppressed = options?.includeSuppressed ?? false;

    let sql = 'SELECT * FROM memories WHERE type = ?';
    if (!includeSuppressed) {
      sql += ' AND is_suppressed = 0';
    }
    sql += ' ORDER BY relevance_score DESC LIMIT ?';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(type, limit) as Record<string, unknown>[];
    
    return rows.map(row => this.rowToMemory(row));
  }

  queryByProject(
    projectId: string,
    options?: { type?: MemoryType; limit?: number }
  ): AgentMemory[] {
    const limit = options?.limit ?? 50;
    
    let sql = 'SELECT * FROM memories WHERE project_id = ? AND is_suppressed = 0';
    const params: unknown[] = [projectId];
    
    if (options?.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }
    
    sql += ' ORDER BY relevance_score DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    
    return rows.map(row => this.rowToMemory(row));
  }

  recordAccess(id: string): AgentMemory {
    const memory = this.getMemory(id);
    if (!memory) {
      throw new Error(`Memory not found: ${id}`);
    }

    const now = new Date().toISOString();
    const newAccessCount = memory.accessCount + 1;
    const boost = this.config.forgettingCurve.reinforcementBoost;
    const newRelevance = Math.min(1.0, memory.relevanceScore + boost);

    const stmt = this.db.prepare(`
      UPDATE memories 
      SET access_count = ?, last_accessed_at = ?, relevance_score = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(newAccessCount, now, newRelevance, now, id);

    return this.getMemory(id)!;
  }

  getStats(): { 
    total: number; 
    byType: Record<MemoryType, number>; 
    avgRelevance: number; 
    pinnedCount: number;
    suppressedCount: number 
  } {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM memories');
    const { count: total } = totalStmt.get() as { count: number };

    const byType: Record<MemoryType, number> = { episodic: 0, semantic: 0, procedural: 0 };
    for (const type of ['episodic', 'semantic', 'procedural'] as MemoryType[]) {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE type = ?');
      const { count } = stmt.get(type) as { count: number };
      byType[type] = count;
    }

    const avgStmt = this.db.prepare('SELECT AVG(relevance_score) as avg FROM memories');
    const { avg } = avgStmt.get() as { avg: number };

    const pinnedStmt = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE is_pinned = 1');
    const { count: pinnedCount } = pinnedStmt.get() as { count: number };

    const suppressedStmt = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE is_suppressed = 1');
    const { count: suppressedCount } = suppressedStmt.get() as { count: number };

    return {
      total,
      byType,
      avgRelevance: avg ?? 0,
      pinnedCount,
      suppressedCount,
    };
  }

  getAllMemories(options?: { includeSuppressed?: boolean }): AgentMemory[] {
    let sql = 'SELECT * FROM memories';
    if (!options?.includeSuppressed) {
      sql += ' WHERE is_suppressed = 0';
    }
    sql += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Record<string, unknown>[];
    
    return rows.map(row => this.rowToMemory(row));
  }

  close(): void {
    this.db.close();
  }

  // ---- Helper Methods ----

  private rowToMemory(row: Record<string, unknown>): AgentMemory {
    const embedding = deserializeEmbedding(row.embedding as Buffer);
    const extraJson = JSON.parse((row.extra_json as string) || '{}');

    const baseMemory: AgentMemory = {
      id: row.id as string,
      type: row.type as MemoryType,
      content: row.content as string,
      embedding,
      projectId: row.project_id as string | undefined,
      buildId: row.build_id as string | undefined,
      agentsInvolved: JSON.parse(row.agents_involved as string),
      outcome: row.outcome as MemoryOutcome,
      relevanceScore: row.relevance_score as number,
      isPinned: (row.is_pinned as number) === 1,
      isSuppressed: (row.is_suppressed as number) === 1,
      accessCount: row.access_count as number,
      lastAccessedAt: row.last_accessed_at as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      tags: JSON.parse(row.tags as string),
    };

    // Add type-specific fields
    if (baseMemory.type === 'episodic') {
      return {
        ...baseMemory,
        eventDate: extraJson.eventDate,
        location: extraJson.location,
        decision: extraJson.decision,
        alternativesConsidered: extraJson.alternativesConsidered,
      } as EpisodicMemory;
    } else if (baseMemory.type === 'semantic') {
      return {
        ...baseMemory,
        confidence: extraJson.confidence,
        supportingMemoryIds: extraJson.supportingMemoryIds,
      } as SemanticMemory;
    } else if (baseMemory.type === 'procedural') {
      return {
        ...baseMemory,
        triggerPattern: extraJson.triggerPattern,
        steps: extraJson.steps,
        successRate: extraJson.successRate,
      } as ProceduralMemory;
    }

    return baseMemory;
  }
}
