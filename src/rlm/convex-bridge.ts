// Convex Bridge for RLM
// Client-side bridge to convex/rlm.ts mutations and queries
// Spec: .kiro/specs/recursive-language-models/tasks.md Task 11

import type {
  RlmConfig,
  RlmConfigInput,
  RlmAuditLog,
  RlmAuditLogInput,
  RlmAuditStats,
  RlmAuditQueryOptions,
  RlmStatsQueryOptions,
} from './convex-types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Type-only imports for Convex API (avoid direct import in src/)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generic Convex API shape (type-only, no runtime dependency)
 */
export interface ConvexApi {
  query: <TArgs, TReturn>(name: string) => (args: TArgs) => Promise<TReturn>;
  mutation: <TArgs, TReturn>(name: string) => (args: TArgs) => Promise<TReturn>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RLM Config Bridge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get RLM configuration for a company/agent
 */
export async function getRlmConfig(
  convex: ConvexApi,
  companyId: string,
  agentId?: string
): Promise<RlmConfig | null> {
  const result = await convex.query<{ companyId: string; agentId?: string }, RlmConfig | null>(
    'rlm:getRlmConfig'
  )({ companyId, agentId });
  return result;
}

/**
 * Update or create RLM configuration
 */
export async function updateRlmConfig(
  convex: ConvexApi,
  input: RlmConfigInput
): Promise<string> {
  const configId = await convex.mutation<RlmConfigInput, string>('rlm:updateRlmConfig')(input);
  return configId;
}

/**
 * List all RLM configs for a company
 */
export async function listRlmConfigs(
  convex: ConvexApi,
  companyId: string
): Promise<RlmConfig[]> {
  const configs = await convex.query<{ companyId: string }, RlmConfig[]>('rlm:listRlmConfigs')({
    companyId,
  });
  return configs;
}

/**
 * Delete an RLM config
 */
export async function deleteRlmConfig(convex: ConvexApi, configId: string): Promise<boolean> {
  const success = await convex.mutation<{ configId: string }, boolean>('rlm:deleteRlmConfig')({
    configId,
  });
  return success;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit Log Bridge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log an RLM audit entry
 */
export async function logAuditEntry(
  convex: ConvexApi,
  input: RlmAuditLogInput
): Promise<string> {
  const logId = await convex.mutation<RlmAuditLogInput, string>('rlm:logAuditEntry')(input);
  return logId;
}

/**
 * Get audit history for a company
 */
export async function getAuditHistory(
  convex: ConvexApi,
  companyId: string,
  options?: RlmAuditQueryOptions
): Promise<RlmAuditLog[]> {
  const logs = await convex.query<
    { companyId: string } & RlmAuditQueryOptions,
    RlmAuditLog[]
  >('rlm:getAuditHistory')({ companyId, ...options });
  return logs;
}

/**
 * Get audit statistics for a company
 */
export async function getAuditStats(
  convex: ConvexApi,
  companyId: string,
  options?: RlmStatsQueryOptions
): Promise<RlmAuditStats> {
  const stats = await convex.query<
    { companyId: string } & RlmStatsQueryOptions,
    RlmAuditStats
  >('rlm:getAuditStats')({ companyId, ...options });
  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Batch Operations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Batch log multiple audit entries
 */
export async function batchLogAuditEntries(
  convex: ConvexApi,
  entries: RlmAuditLogInput[]
): Promise<string[]> {
  const logIds: string[] = [];
  for (const entry of entries) {
    const logId = await logAuditEntry(convex, entry);
    logIds.push(logId);
  }
  return logIds;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Re-export Types
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  RlmConfig,
  RlmConfigInput,
  RlmAuditLog,
  RlmAuditLogInput,
  RlmAuditStats,
  RlmAuditQueryOptions,
  RlmStatsQueryOptions,
} from './convex-types.js';
