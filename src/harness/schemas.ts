// Agent Harness Schemas - Zod validation schemas for harness types
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// Core Schema Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export const HarnessStatusSchema = z.enum([
  'created',
  'starting',
  'running',
  'paused',
  'stopping',
  'stopped',
  'completed',
  'failed',
]);

export const HarnessPrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);

export const StepStatusSchema = z.enum([
  'pending',
  'ready',
  'running',
  'completed',
  'failed',
  'blocked',
]);

export const HarnessEventTypeSchema = z.enum([
  'state_transition',
  'step_completed',
  'step_failed',
  'tool_called',
  'tool_failed',
  'sub_agent_spawned',
  'sub_agent_completed',
  'human_gate_triggered',
  'checkpoint_created',
  'checkpoint_restored',
  'recovery_attempted',
  'recovery_failed',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Complex Object Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const HarnessConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  agentId: z.string().min(1),
  task: z.string().min(1),
  priority: HarnessPrioritySchema,
  timeoutMs: z.number().int().min(0).nullable().transform(v => v ?? 0),
  maxRetries: z.number().int().min(0).max(10).nullable().transform(v => v ?? 3),
  autonomyLevel: z.number().int().min(1).max(5).nullable().transform(v => v ?? 3),
  parentId: z.string().nullable().optional(),
  maxDepth: z.number().int().min(0).max(5).nullable().transform(v => v ?? 3),
  depth: z.number().int().min(0).nullable().transform(v => v ?? 0),
  allowedTools: z.array(z.string()).default([]),
  budget: z.object({
    maxToolCalls: z.number().int().min(0).nullable().transform(v => v ?? 100),
    maxTokens: z.number().int().min(0).nullable().transform(v => v ?? 100000),
    maxCost: z.union([z.number().min(0), z.nan(), z.null()]).transform(v => (v === null || Number.isNaN(v)) ? 100 : v),
  }),
  checkpointIntervalMs: z.number().int().min(1000).nullable().transform(v => v ?? 300000), // 5 minutes
  dreamModeEnabled: z.boolean().nullable().transform(v => v ?? false),
  overnightEvolutionEnabled: z.boolean().nullable().transform(v => v ?? false),
});

export const HarnessErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  stack: z.string().nullable().optional(),
  timestamp: z.number().int().nullable().transform(v => v ?? Date.now()),
});

export const ToolCallRecordSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  arguments: z.record(z.unknown()),
  result: z.unknown().nullable().optional(),
  error: z.string().nullable().optional(),
  timestamp: z.number().int().nullable().transform(v => v ?? Date.now()),
  durationMs: z.number().int().min(0).nullable().transform(v => v ?? 0),
  retryCount: z.number().int().min(0).nullable().transform(v => v ?? 0),
  cost: z.union([z.number().min(0), z.nan(), z.null()]).transform(v => (v === null || Number.isNaN(v)) ? 0 : v),
  success: z.boolean(),
});

export const ExecutionStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  agentId: z.string(),
  status: StepStatusSchema,
  dependencies: z.array(z.string()).default([]),
  isCritical: z.boolean().default(false),
  estimatedDurationMs: z.number().int().min(0).nullable().transform(v => v ?? 60000),
  startedAt: z.number().int().nullable().optional(),
  completedAt: z.number().int().nullable().optional(),
  output: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  toolCalls: z.array(ToolCallRecordSchema).default([]),
  subAgentId: z.string().nullable().optional(),
});

export const ExecutionPlanSchema = z.object({
  id: z.string(),
  version: z.number().int().min(1).nullable().transform(v => v ?? 1),
  createdAt: z.number().int().nullable().transform(v => v ?? Date.now()),
  steps: z.array(ExecutionStepSchema),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
});

export const HarnessStateSchema = z.object({
  schemaVersion: z.number().int().min(1).max(1).nullable().transform(v => v ?? 1),
  config: HarnessConfigSchema,
  status: HarnessStatusSchema,
  createdAt: z.number().int().nullable().transform(v => v ?? Date.now()),
  startedAt: z.number().int().nullable().optional(),
  completedAt: z.number().int().nullable().optional(),
  pausedAt: z.number().int().nullable().optional(),
  executionPlan: ExecutionPlanSchema.nullable().optional(),
  currentStepIndex: z.number().int().min(0).nullable().transform(v => v ?? 0),
  toolCallHistory: z.array(ToolCallRecordSchema).default([]),
  subAgentIds: z.array(z.string()).default([]),
  toolCallCount: z.number().int().min(0).nullable().transform(v => v ?? 0),
  tokenCount: z.number().int().min(0).nullable().transform(v => v ?? 0),
  cost: z.number().min(0).nullable().transform(v => v ?? 0),
  retryCount: z.number().int().min(0).nullable().transform(v => v ?? 0),
  error: HarnessErrorSchema.nullable().optional(),
  lastCheckpointAt: z.number().int().nullable().optional(),
  context: z.record(z.unknown()).default({}),
});

export const HarnessResultSchema = z.object({
  harnessId: z.string(),
  status: z.enum(['completed', 'failed', 'stopped']),
  output: z.string().nullable().optional(),
  durationMs: z.number().int().min(0).nullable().transform(v => v ?? 0),
  toolCallCount: z.number().int().min(0).nullable().transform(v => v ?? 0),
  tokenCount: z.number().int().min(0).nullable().transform(v => v ?? 0),
  cost: z.number().min(0).nullable().transform(v => v ?? 0),
  subAgentResults: z.array(
    z.object({
      harnessId: z.string(),
      parentStepId: z.string(),
      status: z.enum(['completed', 'failed', 'stopped']),
      output: z.string().nullable().optional(),
      error: z.string().nullable().optional(),
      durationMs: z.number().int().min(0).nullable().transform(v => v ?? 0),
    })
  ).default([]),
  error: HarnessErrorSchema.nullable().optional(),
  finalState: HarnessStateSchema,
});

export const HarnessInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  agentId: z.string(),
  status: HarnessStatusSchema,
  priority: HarnessPrioritySchema,
  progress: z.number().min(0).max(100).nullable().transform(v => v ?? 0),
  createdAt: z.number().int().nullable().transform(v => v ?? Date.now()),
  startedAt: z.number().int().nullable().optional(),
  estimatedCompletionAt: z.number().int().nullable().optional(),
  parentId: z.string().nullable().optional(),
  subAgentCount: z.number().int().min(0).nullable().transform(v => v ?? 0),
});

export const HarnessMetricsSchema = z.object({
  harnessId: z.string(),
  timestamp: z.number().int(),
  stepsCompleted: z.number().int().min(0).nullable().transform(v => v ?? 0),
  totalSteps: z.number().int().min(0).nullable().transform(v => v ?? 0),
  avgStepDurationMs: z.union([z.number().min(0), z.nan(), z.null()]).transform(v => (v === null || Number.isNaN(v)) ? 0 : v),
  memoryUsageBytes: z.number().int().min(0).nullable().transform(v => v ?? 0),
  cpuTimeMs: z.union([z.number().min(0), z.nan(), z.null()]).transform(v => (v === null || Number.isNaN(v)) ? 0 : v),
});

export const HarnessCheckpointSchema = z.object({
  id: z.string(),
  harnessId: z.string(),
  timestamp: z.number().int().nullable().transform(v => v ?? Date.now()),
  state: z.string(), // Serialized state
  hash: z.string(),
  sizeBytes: z.number().int().min(0).nullable().transform(v => v ?? 0),
  parentId: z.string().nullable().optional(),
});

export const CheckpointOptionsSchema = z.object({
  compress: z.boolean().nullable().transform(v => v ?? true),
  incremental: z.boolean().nullable().transform(v => v ?? false),
  maxRetained: z.number().int().min(1).nullable().transform(v => v ?? 10),
});

export const HumanGateRequestSchema = z.object({
  id: z.string(),
  stepId: z.string(),
  reason: z.string(),
  stateSnapshot: HarnessStateSchema,
  proposedAction: z.string(),
  timestamp: z.number().int().nullable().transform(v => v ?? Date.now()),
});

export const HumanGateResponseSchema = z.object({
  gateId: z.string(),
  decision: z.enum(['approve', 'reject', 'modify']),
  modification: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  respondedBy: z.string().nullable().optional(),
  respondedAt: z.number().int().nullable().transform(v => v ?? Date.now()),
});

export const AgentLoopSnapshotSchema = z.object({
  version: z.number().int().min(1).nullable().transform(v => v ?? 1),
  harnessId: z.string(),
  timestamp: z.number().int().nullable().transform(v => v ?? Date.now()),
  context: z.object({
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant', 'system', 'tool']),
        content: z.string(),
        timestamp: z.number().int().nullable().transform(v => v ?? Date.now()),
      })
    ),
    tokenCount: z.number().int().min(0).nullable().transform(v => v ?? 0),
  }),
  scratchpad: z.string().nullable().optional(),
  pendingToolCalls: z.array(ToolCallRecordSchema).default([]),
  iterationCount: z.number().int().min(0).nullable().transform(v => v ?? 0),
});

export const RecoveryStrategySchema = z.object({
  type: z.enum(['retry', 'checkpoint', 'degrade', 'escalate']),
  maxAttempts: z.number().int().min(1).nullable().transform(v => v ?? 3),
  backoffMs: z.number().int().min(0).nullable().transform(v => v ?? 1000),
  exponentialBackoff: z.boolean().nullable().transform(v => v ?? true),
});

export const DeadLetterEntrySchema = z.object({
  id: z.string(),
  state: HarnessStateSchema,
  failureReason: z.string(),
  attempts: z.number().int().min(0).nullable().transform(v => v ?? 0),
  firstFailureAt: z.number().int().nullable().transform(v => v ?? Date.now()),
  lastFailureAt: z.number().int().nullable().transform(v => v ?? Date.now()),
});

export const HarnessEventSchema = z.object({
  id: z.string(),
  harnessId: z.string(),
  type: HarnessEventTypeSchema,
  timestamp: z.number().int().nullable().transform(v => v ?? Date.now()),
  payload: z.record(z.unknown()),
});

export const ResourceLimitsSchema = z.object({
  maxCpuTimeMs: z.number().int().min(0).nullable().transform(v => v ?? 0),
  maxMemoryBytes: z.number().int().min(0).nullable().transform(v => v ?? 0),
  maxWallClockTimeMs: z.number().int().min(0).nullable().transform(v => v ?? 0),
});

export const ResourceUsageSchema = z.object({
  cpuTimeMs: z.number().min(0).nullable().transform(v => v ?? 0),
  memoryBytes: z.number().int().min(0).nullable().transform(v => v ?? 0),
  wallClockTimeMs: z.number().min(0).nullable().transform(v => v ?? 0),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Type Inference Helpers
// ═══════════════════════════════════════════════════════════════════════════════

export type HarnessConfigInput = z.input<typeof HarnessConfigSchema>;
export type HarnessStateInput = z.input<typeof HarnessStateSchema>;
export type HarnessResultInput = z.input<typeof HarnessResultSchema>;
export type ExecutionPlanInput = z.input<typeof ExecutionPlanSchema>;
export type ExecutionStepInput = z.input<typeof ExecutionStepSchema>;
export type ToolCallRecordInput = z.input<typeof ToolCallRecordSchema>;
export type HarnessCheckpointInput = z.input<typeof HarnessCheckpointSchema>;
export type HumanGateRequestInput = z.input<typeof HumanGateRequestSchema>;
export type HumanGateResponseInput = z.input<typeof HumanGateResponseSchema>;
export type RecoveryStrategyInput = z.input<typeof RecoveryStrategySchema>;
export type DeadLetterEntryInput = z.input<typeof DeadLetterEntrySchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Validation Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate harness config
 */
export function validateHarnessConfig(input: unknown) {
  return HarnessConfigSchema.safeParse(input);
}

/**
 * Validate harness state
 */
export function validateHarnessState(input: unknown) {
  return HarnessStateSchema.safeParse(input);
}

/**
 * Validate harness state (strict - throws on error)
 */
export function parseHarnessState(input: unknown) {
  return HarnessStateSchema.parse(input);
}

/**
 * Validate execution plan
 */
export function validateExecutionPlan(input: unknown) {
  return ExecutionPlanSchema.safeParse(input);
}

/**
 * Validate checkpoint
 */
export function validateCheckpoint(input: unknown) {
  return HarnessCheckpointSchema.safeParse(input);
}

/**
 * Serialize harness state to JSON string
 */
export function serializeHarnessState(state: unknown): string {
  const validated = HarnessStateSchema.parse(state);
  return JSON.stringify(validated);
}

/**
 * Deserialize harness state from JSON string
 */
export function deserializeHarnessState(json: string): unknown {
  const parsed = JSON.parse(json);
  return HarnessStateSchema.parse(parsed);
}
