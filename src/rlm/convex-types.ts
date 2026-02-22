// Convex Types for RLM
// Mirror types for convex/rlm.ts mutations and queries
// Spec: .kiro/specs/recursive-language-models/tasks.md Task 11

// ═══════════════════════════════════════════════════════════════════════════════
// RLM Config Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RLM Configuration stored in Convex
 */
export interface RlmConfig {
  _id: string;
  _creationTime: number;
  companyId: string;
  agentId?: string;
  enabled: boolean;
  readerModelId: string;
  compressionThreshold: number;
  maxTokens: number;
  fallbackOnError: boolean;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Input for creating/updating RLM config
 */
export interface RlmConfigInput {
  companyId: string;
  agentId?: string;
  enabled: boolean;
  readerModelId: string;
  compressionThreshold: number;
  maxTokens: number;
  fallbackOnError: boolean;
  updatedBy: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit Log Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RLM Audit Log entry stored in Convex
 */
export interface RlmAuditLog {
  _id: string;
  _creationTime: number;
  companyId: string;
  sessionId: string;
  agentId: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  driftScore: number;
  fallbackUsed: boolean;
  segmentsCount: number;
  timestamp: string;
  warningIssued: boolean;
}

/**
 * Input for logging an audit entry
 */
export interface RlmAuditLogInput {
  companyId: string;
  sessionId: string;
  agentId: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  driftScore: number;
  fallbackUsed: boolean;
  segmentsCount: number;
  warningIssued: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Query Result Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Statistics for RLM audit history
 */
export interface RlmAuditStats {
  totalCompressions: number;
  avgCompressionRatio: number;
  avgDriftScore: number;
  fallbackRate: number;
  warningRate: number;
}

/**
 * Query options for audit history
 */
export interface RlmAuditQueryOptions {
  limit?: number;
  agentId?: string;
}

/**
 * Query options for stats
 */
export interface RlmStatsQueryOptions {
  since?: string; // ISO timestamp
}

// ═══════════════════════════════════════════════════════════════════════════════
// Convex Schema Documentation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Required Convex schema additions for RLM:
 *
 * ```typescript
 * // In convex/schema.ts:
 * rlmConfigs: defineTable({
 *   companyId: v.string(),
 *   agentId: v.optional(v.string()),
 *   enabled: v.boolean(),
 *   readerModelId: v.string(),
 *   compressionThreshold: v.number(),
 *   maxTokens: v.number(),
 *   fallbackOnError: v.boolean(),
 *   updatedAt: v.string(),
 *   updatedBy: v.string(),
 * })
 *   .index('by_company', ['companyId'])
 *   .index('by_company_agent', ['companyId', 'agentId']),
 *
 * rlmAuditLogs: defineTable({
 *   companyId: v.string(),
 *   sessionId: v.string(),
 *   agentId: v.string(),
 *   originalTokens: v.number(),
 *   compressedTokens: v.number(),
 *   compressionRatio: v.number(),
 *   driftScore: v.number(),
 *   fallbackUsed: v.boolean(),
 *   segmentsCount: v.number(),
 *   timestamp: v.string(),
 *   warningIssued: v.boolean(),
 * })
 *   .index('by_company', ['companyId'])
 *   .index('by_company_time', ['companyId', 'timestamp'])
 *   .index('by_session', ['sessionId']),
 * ```
 */
