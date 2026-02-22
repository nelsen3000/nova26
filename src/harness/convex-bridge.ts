// Convex Bridge for Agent Harnesses
// Client-side bridge to convex/harnesses.ts mutations and queries
// Spec: .kiro/specs/agent-harnesses/tasks.md Task 15

import type {
  AgentHarnessRecord,
  HarnessEventRecord,
  CreateHarnessInput,
  UpdateHarnessStatusInput,
  LogHarnessEventInput,
  HarnessQueryOptions,
  HarnessEventQueryOptions,
  HarnessStats,
  HarnessEventType,
  HarnessResultRecord,
} from './convex-types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Type-only imports for Convex API
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConvexApi {
  query: <TArgs, TReturn>(name: string) => (args: TArgs) => Promise<TReturn>;
  mutation: <TArgs, TReturn>(name: string) => (args: TArgs) => Promise<TReturn>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Harness Bridge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new harness in Convex
 */
export async function createHarness(
  convex: ConvexApi,
  input: CreateHarnessInput
): Promise<string> {
  const harnessRecordId = await convex.mutation<CreateHarnessInput, string>(
    'harnesses:createHarness'
  )(input);
  return harnessRecordId;
}

/**
 * Update harness status
 */
export async function updateHarnessStatus(
  convex: ConvexApi,
  input: UpdateHarnessStatusInput
): Promise<void> {
  await convex.mutation<UpdateHarnessStatusInput, void>(
    'harnesses:updateHarnessStatus'
  )(input);
}

/**
 * Get a harness by ID
 */
export async function getHarness(
  convex: ConvexApi,
  harnessId: string
): Promise<AgentHarnessRecord | null> {
  const harness = await convex.query<
    { harnessId: string },
    AgentHarnessRecord | null
  >('harnesses:getHarness')({ harnessId });
  return harness;
}

/**
 * List harnesses for a company
 */
export async function listHarnesses(
  convex: ConvexApi,
  companyId: string,
  options?: HarnessQueryOptions
): Promise<AgentHarnessRecord[]> {
  const harnesses = await convex.query<
    { companyId: string } & HarnessQueryOptions,
    AgentHarnessRecord[]
  >('harnesses:listHarnesses')({ companyId, ...options });
  return harnesses;
}

/**
 * Delete a harness
 */
export async function deleteHarness(
  convex: ConvexApi,
  harnessId: string
): Promise<boolean> {
  const success = await convex.mutation<
    { harnessId: string },
    boolean
  >('harnesses:deleteHarness')({ harnessId });
  return success;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Harness Event Bridge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log a harness event
 */
export async function logHarnessEvent(
  convex: ConvexApi,
  input: LogHarnessEventInput
): Promise<string> {
  const eventId = await convex.mutation<LogHarnessEventInput, string>(
    'harnesses:logHarnessEvent'
  )(input);
  return eventId;
}

/**
 * Get events for a harness
 */
export async function getHarnessEvents(
  convex: ConvexApi,
  harnessId: string,
  options?: HarnessEventQueryOptions
): Promise<HarnessEventRecord[]> {
  const events = await convex.query<
    { harnessId: string } & HarnessEventQueryOptions,
    HarnessEventRecord[]
  >('harnesses:getHarnessEvents')({ harnessId, ...options });
  return events;
}

/**
 * Convenience: Log a state transition event
 */
export async function logStateTransition(
  convex: ConvexApi,
  companyId: string,
  harnessId: string,
  from: string,
  to: string
): Promise<string> {
  return logHarnessEvent(convex, {
    companyId,
    harnessId,
    eventType: 'state_transition',
    payload: { from, to, timestamp: new Date().toISOString() },
  });
}

/**
 * Convenience: Log a tool call event
 */
export async function logToolCall(
  convex: ConvexApi,
  companyId: string,
  harnessId: string,
  toolName: string,
  success: boolean,
  durationMs: number,
  cost?: number
): Promise<string> {
  return logHarnessEvent(convex, {
    companyId,
    harnessId,
    eventType: success ? 'tool_called' : 'tool_failed',
    payload: { toolName, success, durationMs, cost, timestamp: new Date().toISOString() },
  });
}

/**
 * Convenience: Log a sub-agent event
 */
export async function logSubAgentEvent(
  convex: ConvexApi,
  companyId: string,
  parentHarnessId: string,
  subAgentHarnessId: string,
  eventType: 'sub_agent_spawned' | 'sub_agent_completed' | 'sub_agent_failed',
  output?: string
): Promise<string> {
  return logHarnessEvent(convex, {
    companyId,
    harnessId: parentHarnessId,
    eventType,
    payload: {
      subAgentHarnessId,
      output,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Convenience: Log a checkpoint event
 */
export async function logCheckpointEvent(
  convex: ConvexApi,
  companyId: string,
  harnessId: string,
  checkpointId: string,
  restored: boolean
): Promise<string> {
  return logHarnessEvent(convex, {
    companyId,
    harnessId,
    eventType: restored ? 'checkpoint_restored' : 'checkpoint_created',
    payload: { checkpointId, timestamp: new Date().toISOString() },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Statistics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get harness statistics for a company
 */
export async function getHarnessStats(
  convex: ConvexApi,
  companyId: string,
  since?: string
): Promise<HarnessStats> {
  const stats = await convex.query<
    { companyId: string; since?: string },
    HarnessStats
  >('harnesses:getHarnessStats')({ companyId, since });
  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Batch Operations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Batch update harness statuses
 */
export async function batchUpdateHarnessStatuses(
  convex: ConvexApi,
  updates: UpdateHarnessStatusInput[]
): Promise<void> {
  for (const update of updates) {
    await updateHarnessStatus(convex, update);
  }
}

/**
 * Get all sub-agent harnesses for a parent
 */
export async function getSubAgentHarnesses(
  convex: ConvexApi,
  companyId: string,
  parentHarnessId: string
): Promise<AgentHarnessRecord[]> {
  return listHarnesses(convex, companyId, { parentHarnessId });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Re-export Types
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  AgentHarnessRecord,
  HarnessEventRecord,
  CreateHarnessInput,
  UpdateHarnessStatusInput,
  LogHarnessEventInput,
  HarnessQueryOptions,
  HarnessEventQueryOptions,
  HarnessStats,
  HarnessEventType,
  HarnessResultRecord,
} from './convex-types.js';
