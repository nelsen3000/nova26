// Persistent Visual Workflow Engine — Type Definitions
// KIMI-R23-01 | Feb 2026

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'rewound';
export type NodeType = 'agent' | 'condition' | 'parallel' | 'join' | 'checkpoint' | 'human-in-loop';
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'rewound';
export type EventType =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.paused'
  | 'workflow.rewound'
  | 'node.started'
  | 'node.completed'
  | 'node.failed'
  | 'node.skipped'
  | 'checkpoint.created'
  | 'human.intervention';

export interface VisualPosition {
  x: number;
  y: number;
}

export interface LangGraphNodeConfig {
  channelBindings: Record<string, string>;  // maps node output → channel name
  conditionalEdges?: Record<string, string>; // conditionKey → nextNodeId
  maxRetries?: number;
  timeoutMs?: number;
  checkpointAfter?: boolean;
}

export interface VisualNode {
  id: string;
  label: string;
  type: NodeType;
  agentId?: string;        // which Nova26 agent handles this node
  status: NodeStatus;
  position: VisualPosition;
  config: LangGraphNodeConfig;
  inputChannels: string[];
  outputChannels: string[];
  startedAt?: number;
  completedAt?: number;
  error?: string;
  metadata: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  channel: string;
  label?: string;
  conditional?: boolean;
}

export interface TemporalEvent {
  id: string;
  workflowId: string;
  eventType: EventType;
  nodeId?: string;
  timestamp: number;
  sequenceNumber: number;
  payload: Record<string, unknown>;
  checkpointId?: string;
}

export interface WorkflowCheckpoint {
  id: string;
  workflowId: string;
  sequenceNumber: number;
  timestamp: number;
  nodeStates: Record<string, NodeStatus>;
  channelValues: Record<string, unknown>;
  activeNodeIds: string[];
  label?: string;  // user-defined label (e.g. "Before deployment")
}

export interface WorkflowState {
  workflowId: string;
  name: string;
  status: WorkflowStatus;
  nodes: Map<string, VisualNode>;
  edges: WorkflowEdge[];
  checkpoints: WorkflowCheckpoint[];
  events: TemporalEvent[];
  channelValues: Map<string, unknown>;
  startedAt?: number;
  completedAt?: number;
  currentSequenceNumber: number;
  tasteVaultScore: number;  // 0-1 — alignment with user preferences
}

export interface PersistentWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: VisualNode[];
  edges: WorkflowEdge[];
  initialChannelValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RewindTarget {
  checkpointId?: string;
  sequenceNumber?: number;
  timestamp?: number;
}

export interface VisualWorkflowEngineConfig {
  persistenceEnabled: boolean;
  maxCheckpoints: number;
  autoCheckpointEveryN: number;    // Create checkpoint every N completed nodes
  rewindEnabled: boolean;
  tasteVaultEnabled: boolean;
  langGraphSimulatorEnabled: boolean;
  maxConcurrentNodes: number;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  status: WorkflowStatus;
  completedNodes: string[];
  failedNodes: string[];
  skippedNodes: string[];
  durationMs: number;
  checkpointCount: number;
  tasteVaultScore: number;
  outputChannelValues: Record<string, unknown>;
}
