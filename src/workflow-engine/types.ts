// Visual Workflow Engine - Type Definitions (KIMI-R23-01)

/**
 * Node types supported by the visual workflow engine
 */
export type VisualNodeType = 'agent' | 'gate' | 'decision' | 'parallel' | 'merge';

/**
 * Node status during workflow execution
 */
export type VisualNodeStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped';

/**
 * Event types for temporal tracking
 */
export type TemporalEventType = 'node-start' | 'node-complete' | 'node-fail' | 'rewind' | 'fork';

/**
 * Represents a persistent workflow with full state management
 */
export interface PersistentWorkflow {
  /** Unique workflow identifier */
  id: string;
  /** Human-readable workflow name */
  name: string;
  /** Visual nodes in the workflow */
  nodes: VisualNode[];
  /** Edges connecting nodes */
  edges: WorkflowEdge[];
  /** Current workflow state */
  state: WorkflowState;
  /** Temporal event log for replay/rewind */
  timeline: TemporalEvent[];
  /** Creation timestamp */
  createdAt: string;
  /** Last modification timestamp */
  lastModified: string;
}

/**
 * Edge connecting two nodes in the workflow graph
 */
export interface WorkflowEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Optional condition expression for conditional edges */
  condition?: string;
}

/**
 * A visual node in the workflow graph
 */
export interface VisualNode {
  /** Unique node identifier */
  id: string;
  /** Node type determining behavior */
  type: VisualNodeType;
  /** Associated agent ID (for agent nodes) */
  agentId?: string;
  /** LangGraph-compatible configuration */
  config: LangGraphNodeConfig;
  /** Visual position in the editor */
  position: NodePosition;
  /** Current execution status */
  status: VisualNodeStatus;
  /** Optional node label */
  label?: string;
  /** Node metadata */
  metadata?: Record<string, unknown>;
}

/**
 * 2D position for visual rendering
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * LangGraph-compatible node configuration
 */
export interface LangGraphNodeConfig {
  /** Entry function name for this node */
  entryFunction: string;
  /** State schema defining input/output structure */
  stateSchema: Record<string, unknown>;
  /** Optional retry policy for failed executions */
  retryPolicy?: RetryPolicy;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Retry policy for node execution
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Backoff delay in milliseconds between retries */
  backoffMs: number;
  /** Maximum backoff delay */
  maxBackoffMs?: number;
  /** Retry strategy */
  strategy?: 'linear' | 'exponential' | 'fixed';
}

/**
 * Workflow execution state
 */
export interface WorkflowState {
  /** ID of the currently executing node */
  currentNodeId: string;
  /** Saved checkpoints for rewind capability */
  checkpoints: Checkpoint[];
  /** Workflow variables accessible to all nodes */
  variables: Record<string, unknown>;
  /** Global workflow status */
  globalStatus: WorkflowGlobalStatus;
  /** Started timestamp */
  startedAt?: string;
  /** Completed timestamp */
  completedAt?: string;
}

/**
 * Global workflow status
 */
export type WorkflowGlobalStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'rewinding';

/**
 * Checkpoint for state restoration
 */
export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string;
  /** Node ID at time of checkpoint */
  nodeId: string;
  /** Timestamp when checkpoint was created */
  timestamp: string;
  /** Serialized state snapshot */
  stateSnapshot: unknown;
  /** Optional label for the checkpoint */
  label?: string;
}

/**
 * Temporal event for timeline tracking and replay
 */
export interface TemporalEvent {
  /** Unique event ID */
  id: string;
  /** Event type classification */
  type: TemporalEventType;
  /** Associated node ID */
  nodeId: string;
  /** Event timestamp */
  timestamp: string;
  /** Event payload data */
  data: unknown;
  /** Previous event ID for chain reconstruction */
  previousEventId?: string;
}

/**
 * Workflow execution context passed to nodes
 */
export interface NodeExecutionContext {
  /** Current workflow state */
  state: WorkflowState;
  /** Input data from previous node */
  input: unknown;
  /** Workflow variables */
  variables: Record<string, unknown>;
  /** Signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result from node execution
 */
export interface NodeExecutionResult {
  /** Success status */
  success: boolean;
  /** Output data for next node */
  output: unknown;
  /** Updated variables */
  variables?: Record<string, unknown>;
  /** Error information if failed */
  error?: NodeExecutionError;
  /** Next node ID override (for conditional routing) */
  nextNodeId?: string;
}

/**
 * Node execution error details
 */
export interface NodeExecutionError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Retryable flag */
  retryable: boolean;
}

/**
 * Workflow engine configuration options
 */
export interface WorkflowEngineOptions {
  /** Enable persistent storage */
  persistent?: boolean;
  /** Storage adapter for persistence */
  storageAdapter?: StorageAdapter;
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs?: number;
  /** Maximum execution time per node */
  nodeTimeoutMs?: number;
  /** Enable checkpoint creation */
  enableCheckpoints?: boolean;
  /** Maximum number of checkpoints to retain */
  maxCheckpoints?: number;
}

/**
 * Storage adapter interface for persistence
 */
export interface StorageAdapter {
  /** Save workflow state */
  save(workflow: PersistentWorkflow): Promise<void>;
  /** Load workflow by ID */
  load(workflowId: string): Promise<PersistentWorkflow | null>;
  /** List all workflows */
  list(): Promise<PersistentWorkflow[]>;
  /** Delete workflow */
  delete(workflowId: string): Promise<void>;
  /** Archive workflow */
  archive(workflowId: string): Promise<void>;
}

/**
 * Workflow statistics
 */
export interface WorkflowStats {
  /** Total nodes in workflow */
  totalNodes: number;
  /** Nodes completed */
  completedNodes: number;
  /** Nodes failed */
  failedNodes: number;
  /** Average execution time per node */
  avgExecutionTimeMs: number;
  /** Total execution time */
  totalExecutionTimeMs: number;
  /** Number of rewinds performed */
  rewindCount: number;
}

/**
 * Event emitted by the workflow engine
 */
export interface WorkflowEngineEvent {
  /** Event type */
  type: 'node-start' | 'node-complete' | 'node-fail' | 'checkpoint-created' | 'rewind' | 'workflow-complete' | 'workflow-fail';
  /** Timestamp */
  timestamp: string;
  /** Event payload */
  payload: unknown;
  /** Workflow ID */
  workflowId: string;
}

/**
 * Event handler type
 */
export type WorkflowEventHandler = (event: WorkflowEngineEvent) => void | Promise<void>;

/**
 * Map of task status from RalphLoop to visual node status
 */
export const TaskToNodeStatusMap: Record<string, VisualNodeStatus> = {
  pending: 'pending',
  ready: 'pending',
  running: 'running',
  done: 'complete',
  failed: 'failed',
  blocked: 'skipped',
} as const;
