// Agent Harness Types - Core type definitions for long-running agent tasks
// Spec: .kiro/specs/agent-harnesses/tasks.md

// ═══════════════════════════════════════════════════════════════════════════════
// Core Harness Types
// ═══════════════════════════════════════════════════════════════════════════════

export type HarnessStatus =
  | 'created'
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'failed';

export type HarnessPriority = 'low' | 'normal' | 'high' | 'critical';

export interface HarnessConfig {
  /** Unique harness identifier */
  id: string;
  /** Display name */
  name: string;
  /** Agent ID to execute tasks */
  agentId: string;
  /** Task description or goal */
  task: string;
  /** Priority level for scheduling */
  priority: HarnessPriority;
  /** Maximum execution time in ms (0 = unlimited) */
  timeoutMs: number;
  /** Maximum number of retries on failure */
  maxRetries: number;
  /** Autonomy level 1-5 (affects checkpoint frequency and human gates) */
  autonomyLevel: number;
  /** Parent harness ID for sub-agents */
  parentId?: string;
  /** Maximum sub-agent nesting depth */
  maxDepth: number;
  /** Current depth level */
  depth: number;
  /** Tools available to this harness */
  allowedTools: string[];
  /** Budget limits */
  budget: {
    maxToolCalls: number;
    maxTokens: number;
    maxCost: number;
  };
  /** Checkpoint interval in ms */
  checkpointIntervalMs: number;
  /** Dream mode enabled */
  dreamModeEnabled: boolean;
  /** Overnight evolution enabled */
  overnightEvolutionEnabled: boolean;
}

export interface HarnessState {
  /** Schema version for migration support */
  schemaVersion: number;
  /** Harness configuration */
  config: HarnessConfig;
  /** Current execution status */
  status: HarnessStatus;
  /** Creation timestamp */
  createdAt: number;
  /** Start timestamp */
  startedAt?: number;
  /** Completion timestamp */
  completedAt?: number;
  /** Pause timestamp */
  pausedAt?: number;
  /** Current execution plan */
  executionPlan?: ExecutionPlan;
  /** Current step index in plan */
  currentStepIndex: number;
  /** Tool call history */
  toolCallHistory: ToolCallRecord[];
  /** Sub-agent harness IDs */
  subAgentIds: string[];
  /** Total tool calls made */
  toolCallCount: number;
  /** Total tokens consumed */
  tokenCount: number;
  /** Total cost incurred */
  cost: number;
  /** Retry count for current step */
  retryCount: number;
  /** Error information if failed */
  error?: HarnessError;
  /** Last checkpoint timestamp */
  lastCheckpointAt?: number;
  /** Custom state data */
  context: Record<string, unknown>;
}

export interface HarnessError {
  code: string;
  message: string;
  stack?: string;
  timestamp: number;
}

export interface HarnessResult {
  /** Harness ID */
  harnessId: string;
  /** Final status */
  status: 'completed' | 'failed' | 'stopped';
  /** Task output */
  output?: string;
  /** Execution duration in ms */
  durationMs: number;
  /** Total tool calls */
  toolCallCount: number;
  /** Total tokens used */
  tokenCount: number;
  /** Total cost */
  cost: number;
  /** Sub-agent results */
  subAgentResults: SubAgentResult[];
  /** Error if failed */
  error?: HarnessError;
  /** Final execution state */
  finalState: HarnessState;
}

export interface HarnessInfo {
  id: string;
  name: string;
  agentId: string;
  status: HarnessStatus;
  priority: HarnessPriority;
  progress: number; // 0-100
  createdAt: number;
  startedAt?: number;
  estimatedCompletionAt?: number;
  parentId?: string;
  subAgentCount: number;
}

export interface HarnessMetrics {
  harnessId: string;
  timestamp: number;
  /** Steps completed */
  stepsCompleted: number;
  /** Total steps in plan */
  totalSteps: number;
  /** Average step duration */
  avgStepDurationMs: number;
  /** Memory usage estimate in bytes */
  memoryUsageBytes: number;
  /** CPU time estimate in ms */
  cpuTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Execution Plan Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecutionPlan {
  /** Unique plan ID */
  id: string;
  /** Plan version */
  version: number;
  /** Creation timestamp */
  createdAt: number;
  /** Plan steps */
  steps: ExecutionStep[];
  /** Overall plan status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export type StepStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'blocked';

export interface ExecutionStep {
  /** Unique step ID */
  id: string;
  /** Step description */
  description: string;
  /** Assigned agent ID */
  agentId: string;
  /** Step status */
  status: StepStatus;
  /** IDs of steps that must complete before this one */
  dependencies: string[];
  /** Whether this is a critical step */
  isCritical: boolean;
  /** Estimated duration in ms */
  estimatedDurationMs: number;
  /** Actual start timestamp */
  startedAt?: number;
  /** Actual completion timestamp */
  completedAt?: number;
  /** Step output */
  output?: string;
  /** Error if failed */
  error?: string;
  /** Tool calls for this step */
  toolCalls: ToolCallRecord[];
  /** Sub-agent ID if spawned */
  subAgentId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Call Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ToolCallRecord {
  /** Call ID */
  id: string;
  /** Tool name */
  toolName: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
  /** Tool result */
  result?: unknown;
  /** Error if failed */
  error?: string;
  /** Call timestamp */
  timestamp: number;
  /** Duration in ms */
  durationMs: number;
  /** Number of retries */
  retryCount: number;
  /** Cost of this call */
  cost: number;
  /** Whether this call was successful */
  success: boolean;
}

export interface ToolPermission {
  toolName: string;
  allowed: boolean;
  requiresApproval: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Agent Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface SubAgentResult {
  /** Sub-agent harness ID */
  harnessId: string;
  /** Parent step ID */
  parentStepId: string;
  /** Final status */
  status: 'completed' | 'failed' | 'stopped';
  /** Task output */
  output?: string;
  /** Error if failed */
  error?: string;
  /** Execution duration */
  durationMs: number;
}

export interface SubAgentSpawnRequest {
  /** Step ID requesting sub-agent */
  stepId: string;
  /** Task for sub-agent */
  task: string;
  /** Agent ID to use */
  agentId: string;
  /** Priority */
  priority: HarnessPriority;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Checkpoint Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface HarnessCheckpoint {
  /** Checkpoint ID */
  id: string;
  /** Harness ID */
  harnessId: string;
  /** Checkpoint timestamp */
  timestamp: number;
  /** Serialized state */
  state: string;
  /** State hash for integrity */
  hash: string;
  /** Checkpoint size in bytes */
  sizeBytes: number;
  /** Parent checkpoint ID (for incremental) */
  parentId?: string;
}

export interface CheckpointOptions {
  /** Whether to compress the checkpoint */
  compress: boolean;
  /** Whether this is an incremental checkpoint */
  incremental: boolean;
  /** Maximum checkpoints to retain */
  maxRetained: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Human-in-the-Loop Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface HumanGateRequest {
  /** Gate ID */
  id: string;
  /** Step ID at which gate is placed */
  stepId: string;
  /** Gate reason */
  reason: string;
  /** Current harness state snapshot */
  stateSnapshot: HarnessState;
  /** Proposed next action */
  proposedAction: string;
  /** Timestamp */
  timestamp: number;
}

export interface HumanGateResponse {
  /** Gate ID */
  gateId: string;
  /** Response type */
  decision: 'approve' | 'reject' | 'modify';
  /** Modification if decision is 'modify' */
  modification?: string;
  /** Rejection reason if decision is 'reject' */
  rejectionReason?: string;
  /** Responder identity */
  respondedBy?: string;
  /** Response timestamp */
  respondedAt?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Loop Snapshot Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentLoopSnapshot {
  /** Snapshot version */
  version: number;
  /** Harness ID */
  harnessId: string;
  /** Timestamp */
  timestamp: number;
  /** Current conversation context */
  context: {
    messages: Array<{
      role: 'user' | 'assistant' | 'system' | 'tool';
      content: string;
      timestamp: number;
    }>;
    tokenCount: number;
  };
  /** Current scratchpad content */
  scratchpad?: string;
  /** Tool call buffer */
  pendingToolCalls: ToolCallRecord[];
  /** Loop iteration count */
  iterationCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Recovery Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface RecoveryStrategy {
  /** Strategy type */
  type: 'retry' | 'checkpoint' | 'degrade' | 'escalate';
  /** Maximum attempts */
  maxAttempts: number;
  /** Delay between attempts in ms */
  backoffMs: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

export interface DeadLetterEntry {
  /** Entry ID */
  id: string;
  /** Original harness state */
  state: HarnessState;
  /** Failure reason */
  failureReason: string;
  /** Number of recovery attempts */
  attempts: number;
  /** First failure timestamp */
  firstFailureAt: number;
  /** Last failure timestamp */
  lastFailureAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Types
// ═══════════════════════════════════════════════════════════════════════════════

export type HarnessEventType =
  | 'state_transition'
  | 'step_completed'
  | 'step_failed'
  | 'tool_called'
  | 'tool_failed'
  | 'sub_agent_spawned'
  | 'sub_agent_completed'
  | 'human_gate_triggered'
  | 'checkpoint_created'
  | 'checkpoint_restored'
  | 'recovery_attempted'
  | 'recovery_failed';

export interface HarnessEvent {
  /** Event ID */
  id: string;
  /** Harness ID */
  harnessId: string;
  /** Event type */
  type: HarnessEventType;
  /** Event timestamp */
  timestamp: number;
  /** Event payload */
  payload: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Resource Management Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResourceLimits {
  /** Max CPU time in ms */
  maxCpuTimeMs: number;
  /** Max memory in bytes */
  maxMemoryBytes: number;
  /** Max wall-clock time in ms */
  maxWallClockTimeMs: number;
}

export interface ResourceUsage {
  /** CPU time used in ms */
  cpuTimeMs: number;
  /** Memory used in bytes */
  memoryBytes: number;
  /** Wall-clock time in ms */
  wallClockTimeMs: number;
}
