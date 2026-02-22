// Convex Types for Hindsight
// Mirror types for convex/hindsight.ts mutations and queries
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md Task 13

// ═══════════════════════════════════════════════════════════════════════════════
// Memory Fragment Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Memory Fragment stored in Convex
 */
export interface MemoryFragmentRecord {
  _id: string;
  _creationTime: number;
  companyId: string;
  fragmentId: string;
  sourceType: 'episodic' | 'procedural' | 'semantic';
  content: string;
  embedding?: number[];
  agentId: string;
  projectId: string;
  namespace: string;
  sourceId: string;
  relevance: number;
  accessCount: number;
  lastAccessedAt: string;
  createdAt: string;
  expiresAt?: string;
  isPinned: boolean;
  isArchived: boolean;
  tags: string[];
  extra: Record<string, unknown>;
}

/**
 * Input for storing a fragment
 */
export interface StoreFragmentInput {
  companyId: string;
  fragmentId: string;
  sourceType: 'episodic' | 'procedural' | 'semantic';
  content: string;
  embedding?: number[];
  agentId: string;
  projectId: string;
  namespace: string;
  sourceId: string;
  relevance: number;
  expiresAt?: string;
  isPinned?: boolean;
  tags?: string[];
  extra?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Consolidation Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Consolidation job record
 */
export interface ConsolidationJobRecord {
  _id: string;
  _creationTime: number;
  companyId: string;
  jobId: string;
  namespace: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  fragmentsBefore: number;
  fragmentsAfter: number;
  duplicatesMerged: number;
  archivedCount: number;
  summary?: string;
}

/**
 * Input for creating a consolidation job
 */
export interface CreateConsolidationInput {
  companyId: string;
  jobId: string;
  namespace: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Query Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Query options for fragments
 */
export interface FragmentQueryOptions {
  namespace?: string;
  agentId?: string;
  projectId?: string;
  sourceType?: 'episodic' | 'procedural' | 'semantic';
  includeArchived?: boolean;
  minRelevance?: number;
  limit?: number;
  before?: string; // ISO timestamp
}

/**
 * Search options for vector search
 */
export interface VectorSearchOptions {
  namespace?: string;
  agentId?: string;
  projectId?: string;
  threshold?: number;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Statistics Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Storage statistics
 */
export interface StorageStats {
  totalFragments: number;
  bySourceType: {
    episodic: number;
    procedural: number;
    semantic: number;
  };
  archivedCount: number;
  pinnedCount: number;
  avgRelevance: number;
  namespaceCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Convex Schema Documentation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Required Convex schema additions for Hindsight:
 *
 * ```typescript
 * // In convex/schema.ts:
 * hindsightFragments: defineTable({
 *   companyId: v.string(),
 *   fragmentId: v.string(),
 *   sourceType: v.union(
 *     v.literal('episodic'),
 *     v.literal('procedural'),
 *     v.literal('semantic')
 *   ),
 *   content: v.string(),
 *   embedding: v.optional(v.array(v.number())),
 *   agentId: v.string(),
 *   projectId: v.string(),
 *   namespace: v.string(),
 *   sourceId: v.string(),
 *   relevance: v.number(),
 *   accessCount: v.number(),
 *   lastAccessedAt: v.string(),
 *   createdAt: v.string(),
 *   expiresAt: v.optional(v.string()),
 *   isPinned: v.boolean(),
 *   isArchived: v.boolean(),
 *   tags: v.array(v.string()),
 *   extra: v.record(v.any()),
 * })
 *   .index('by_fragment', ['fragmentId'])
 *   .index('by_company', ['companyId'])
 *   .index('by_namespace', ['companyId', 'namespace'])
 *   .index('by_agent', ['companyId', 'agentId'])
 *   .index('by_project', ['companyId', 'projectId'])
 *   .index('by_source', ['sourceId'])
 *   .index('by_relevance', ['companyId', 'relevance'])
 *   .index('by_archived', ['companyId', 'isArchived']),
 *
 * hindsightConsolidations: defineTable({
 *   companyId: v.string(),
 *   jobId: v.string(),
 *   namespace: v.string(),
 *   status: v.union(
 *     v.literal('pending'),
 *     v.literal('running'),
 *     v.literal('completed'),
 *     v.literal('failed')
 *   ),
 *   startedAt: v.optional(v.string()),
 *   completedAt: v.optional(v.string()),
 *   fragmentsBefore: v.number(),
 *   fragmentsAfter: v.number(),
 *   duplicatesMerged: v.number(),
 *   archivedCount: v.number(),
 *   summary: v.optional(v.string()),
 * })
 *   .index('by_job', ['jobId'])
 *   .index('by_company', ['companyId'])
 *   .index('by_namespace', ['companyId', 'namespace'])
 *   .index('by_status', ['companyId', 'status']),
 * ```
 */
