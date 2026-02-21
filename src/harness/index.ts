// Agent Harness Module - Wave 1: Foundation
// Exports all harness components for external use

// ═══════════════════════════════════════════════════════════════════════════════
// Core Types & Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export * from './types.js';
export * from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Core Engine (Task K2-02)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  AgentHarness,
  createAgentHarness,
  TaskQueue,
} from './engine.js';

export type {
  TaskQueueItem,
} from './engine.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Checkpoint Manager (Task K2-03)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  CheckpointManager,
  createCheckpointManager,
} from './checkpoint.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Recovery Manager (Task K2-04)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  RecoveryManager,
  DeadLetterQueue,
  createRecoveryManager,
} from './recovery.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Resource Management (Task K2-05)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  ResourceManager,
  ProcessMonitor,
} from './resources.js';

export type {
  ResourceManagerConfig,
  ProcessInfo,
} from './resources.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Communication (Task K2-06)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  HarnessMessageBus,
  ParentChildManager,
  ProgressReporter,
  harnessMessageBus,
  parentChildManager,
  progressReporter,
} from './communication.js';

export type {
  HarnessMessage,
  HarnessSubscription,
  ProgressUpdate,
} from './communication.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Observability (Task K2-07)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  StructuredLogger,
  EventStream,
  MetricsCollector,
  ToolCallAuditLog,
  harnessLogger,
  harnessEventStream,
  harnessMetrics,
  toolCallAuditLog,
} from './observability.js';

export type {
  LogEntry,
  LoggerConfig,
  MetricValue,
  MetricsSnapshot,
} from './observability.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Wave 5: Harness Advanced (K3-25 through K3-32)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  HarnessManager,
  createHarnessManager,
  getHarnessManager,
  resetHarnessManager,
} from './harness-manager.js';

export {
  HarnessSerializer,
  createHarnessSerializer,
} from './harness-serializer.js';

export type { SerializedHarness } from './harness-serializer.js';

export {
  EternalEngineBridge,
  createEternalEngineBridge,
} from './eternal-engine-bridge.js';

export type { PersistenceResult, RestoreResult } from './eternal-engine-bridge.js';

export {
  ToolCallManager,
  createToolCallManager,
  DEFAULT_TOOL_CONFIG,
} from './tool-call-manager.js';

export type {
  ToolCallManagerConfig,
  ToolCallOptions,
  ToolCallResult,
} from './tool-call-manager.js';

export {
  HumanInLoopGate,
  createHumanInLoopGate,
} from './human-in-loop-gate.js';

export type { GateEntry } from './human-in-loop-gate.js';

export {
  ExecutionPlanManager,
  createExecutionPlan,
  createLinearPlan,
} from './execution-plan.js';

export type { StepSpec } from './execution-plan.js';

export {
  ObservabilityEmitter,
  createObservabilityEmitter,
} from './observability-emitter.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════════

import { AgentHarness } from './engine.js';
import { CheckpointManager } from './checkpoint.js';
import { RecoveryManager } from './recovery.js';
import type { HarnessConfig } from './types.js';

/**
 * Create a complete harness system with all components wired together
 */
export function createHarnessSystem(config: HarnessConfig): {
  harness: AgentHarness;
  checkpoints: CheckpointManager;
  recovery: RecoveryManager;
} {
  const harness = new AgentHarness(config);
  const checkpoints = new CheckpointManager();
  const recovery = new RecoveryManager({
    maxRetries: config.maxRetries,
    maxBackoffMs: 30000,
    enableDeadLetterQueue: true,
  });

  return { harness, checkpoints, recovery };
}
