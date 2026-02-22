// Convex Types for Agent Harnesses
// Mirror types for convex/harnesses.ts mutations and queries
// Spec: .kiro/specs/agent-harnesses/tasks.md Task 15

// ═══════════════════════════════════════════════════════════════════════════════
// Harness Record Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Agent Harness stored in Convex
 */
export interface AgentHarnessRecord {
  _id: string;
  _creationTime: number;
  companyId: string;
  harnessId: string;
  agentId: string;
  parentHarnessId?: string;
  status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
  autonomyLevel: number;
  taskDescription: string;
  executionPlan?: ExecutionPlanRecord;
  subAgentIds: string[];
  checkpointData?: string;
  result?: HarnessResultRecord;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Execution plan record
 */
export interface ExecutionPlanRecord {
  planId: string;
  steps: ExecutionStepRecord[];
  currentStepIndex: number;
}

/**
 * Execution step record
 */
export interface ExecutionStepRecord {
  stepId: string;
  description: string;
  assignedAgentId: string;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  isCritical: boolean;
  output?: string;
  error?: string;
}

/**
 * Harness result record
 */
export interface HarnessResultRecord {
  success: boolean;
  output: string;
  durationMs: number;
  stepsCompleted: number;
  stepsTotal: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Harness Event Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Harness event stored in Convex
 */
export interface HarnessEventRecord {
  _id: string;
  _creationTime: number;
  companyId: string;
  harnessId: string;
  eventType: HarnessEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

/**
 * Harness event types
 */
export type HarnessEventType =
  | 'state_transition'
  | 'tool_called'
  | 'tool_failed'
  | 'human_gate_triggered'
  | 'human_gate_resolved'
  | 'sub_agent_spawned'
  | 'sub_agent_completed'
  | 'sub_agent_failed'
  | 'checkpoint_created'
  | 'checkpoint_restored'
  | 'step_completed'
  | 'step_failed'
  | 'plan_completed'
  | 'harness_failed';

// ═══════════════════════════════════════════════════════════════════════════════
// Input Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input for creating a harness
 */
export interface CreateHarnessInput {
  companyId: string;
  harnessId: string;
  agentId: string;
  parentHarnessId?: string;
  autonomyLevel: number;
  taskDescription: string;
}

/**
 * Input for updating harness status
 */
export interface UpdateHarnessStatusInput {
  harnessId: string;
  status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
  checkpointData?: string;
  result?: HarnessResultRecord;
}

/**
 * Input for logging a harness event
 */
export interface LogHarnessEventInput {
  companyId: string;
  harnessId: string;
  eventType: HarnessEventType;
  payload: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Query Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Query options for harnesses
 */
export interface HarnessQueryOptions {
  agentId?: string;
  status?: 'created' | 'running' | 'paused' | 'completed' | 'failed';
  parentHarnessId?: string | null;
  limit?: number;
}

/**
 * Query options for events
 */
export interface HarnessEventQueryOptions {
  eventType?: HarnessEventType;
  limit?: number;
  since?: string; // ISO timestamp
}

// ═══════════════════════════════════════════════════════════════════════════════
// Statistics Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Harness statistics
 */
export interface HarnessStats {
  totalHarnesses: number;
  byStatus: Record<string, number>;
  avgDurationMs: number;
  successRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Convex Schema Documentation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Required Convex schema additions for Agent Harnesses:
 *
 * ```typescript
 * // In convex/schema.ts:
 * agentHarnesses: defineTable({
 *   companyId: v.string(),
 *   harnessId: v.string(),
 *   agentId: v.string(),
 *   parentHarnessId: v.optional(v.string()),
 *   status: v.union(
 *     v.literal('created'),
 *     v.literal('running'),
 *     v.literal('paused'),
 *     v.literal('completed'),
 *     v.literal('failed')
 *   ),
 *   autonomyLevel: v.number(),
 *   taskDescription: v.string(),
 *   executionPlan: v.optional(v.object({
 *     planId: v.string(),
 *     steps: v.array(v.object({
 *       stepId: v.string(),
 *       description: v.string(),
 *       assignedAgentId: v.string(),
 *       dependencies: v.array(v.string()),
 *       status: v.union(
 *         v.literal('pending'),
 *         v.literal('in_progress'),
 *         v.literal('completed'),
 *         v.literal('failed'),
 *         v.literal('blocked')
 *       ),
 *       isCritical: v.boolean(),
 *       output: v.optional(v.string()),
 *       error: v.optional(v.string()),
 *     })),
 *     currentStepIndex: v.number(),
 *   })),
 *   subAgentIds: v.array(v.string()),
 *   checkpointData: v.optional(v.string()),
 *   result: v.optional(v.object({
 *     success: v.boolean(),
 *     output: v.string(),
 *     durationMs: v.number(),
 *     stepsCompleted: v.number(),
 *     stepsTotal: v.number(),
 *   })),
 *   createdAt: v.string(),
 *   updatedAt: v.string(),
 *   startedAt: v.optional(v.string()),
 *   completedAt: v.optional(v.string()),
 * })
 *   .index('by_harness_id', ['harnessId'])
 *   .index('by_company', ['companyId'])
 *   .index('by_status', ['companyId', 'status'])
 *   .index('by_agent', ['companyId', 'agentId'])
 *   .index('by_parent', ['parentHarnessId']),
 *
 * harnessEvents: defineTable({
 *   companyId: v.string(),
 *   harnessId: v.string(),
 *   eventType: v.union(
 *     v.literal('state_transition'),
 *     v.literal('tool_called'),
 *     v.literal('tool_failed'),
 *     v.literal('human_gate_triggered'),
 *     v.literal('human_gate_resolved'),
 *     v.literal('sub_agent_spawned'),
 *     v.literal('sub_agent_completed'),
 *     v.literal('sub_agent_failed'),
 *     v.literal('checkpoint_created'),
 *     v.literal('checkpoint_restored'),
 *     v.literal('step_completed'),
 *     v.literal('step_failed'),
 *     v.literal('plan_completed'),
 *     v.literal('harness_failed')
 *   ),
 *   payload: v.record(v.any()),
 *   timestamp: v.string(),
 * })
 *   .index('by_harness', ['harnessId'])
 *   .index('by_harness_time', ['harnessId', 'timestamp'])
 *   .index('by_company_time', ['companyId', 'timestamp'])
 *   .index('by_event_type', ['harnessId', 'eventType']),
 * ```
 */
