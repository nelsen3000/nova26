// Orchestrator Hierarchy Types — R20-01
// L0/L1/L2/L3 Layer definitions

export interface OrchestratorHierarchyConfig {
  enabled: boolean;
  layers: LayerConfig[];
  escalationPolicy: 'auto' | 'manual' | 'threshold-based';
  defaultMaxRetries: number;
  globalTimeoutMs: number;
  backwardCompatibilityMode: boolean; // true = flat mode, everything routes to L2
  observabilityLevel: 'minimal' | 'standard' | 'verbose';
}

export interface LayerConfig {
  level: 0 | 1 | 2 | 3;
  supervisorAgent: string;
  workers: string[];
  maxConcurrency: number;
  timeoutMs: number;
  maxRetries: number;
}

// L0: Intent Layer
export interface UserIntent {
  id: string;
  rawInput: string;
  parsedType: string;
  scope: string;
  constraints: string[];
  tasteVaultTags: string[];
  confidence: number; // 0-1
  needsClarification: boolean;
  clarificationHistory?: ClarificationExchange[];
}

export interface ClarificationExchange {
  question: string;
  answer: string;
  timestamp: number;
}

export interface IntentParseResult {
  intent: UserIntent;
  alternatives: string[];
  parsingMetadata: Record<string, unknown>;
}

// L1: Planning Layer
export interface TaskGraph {
  nodes: TaskNode[];
  edges: TaskEdge[];
  parallelGroups: string[][];
  estimatedTotalTokens: number;
  criticalPath: string[];
}

export interface TaskNode {
  id: string;
  agent: string;
  description: string;
  dependencies: string[];
  estimatedTokens: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  priority: number;
  metadata: Record<string, unknown>;
}

export interface TaskEdge {
  from: string;
  to: string;
  type: 'depends-on' | 'feeds-into' | 'parallel-with';
}

export interface DecompositionResult {
  graph: TaskGraph;
  architectureValidated: boolean;
  validationErrors: string[];
  replanCount: number;
}

// L2: Execution Layer
export interface ExecutionArtifact {
  type: 'code' | 'spec' | 'design' | 'test' | 'asset' | 'documentation';
  content: string;
  metadata: {
    agent: string;
    taskId: string;
    timestamp: number;
    tokensUsed: number;
    generationTimeMs: number;
  };
}

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  artifacts: ExecutionArtifact[];
  retryCount: number;
  finalPrompt: string;
  errors: string[];
}

export interface ParallelExecutionResult {
  results: ExecutionResult[];
  completedCount: number;
  failedCount: number;
  totalExecutionTimeMs: number;
}

// L3: Tool Layer
export interface ToolRequest {
  toolName: string;
  parameters: Record<string, unknown>;
  sandboxed: boolean;
  timeoutMs: number;
}

export interface ToolResult {
  success: boolean;
  output: string;
  exitCode?: number;
  executionTimeMs: number;
  resourceUsage: {
    memoryMb: number;
    cpuMs: number;
  };
}

export interface SandboxedExecution {
  id: string;
  request: ToolRequest;
  result?: ToolResult;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  retryCount: number;
}

// Escalation System
export interface EscalationEvent {
  layer: 0 | 1 | 2 | 3;
  taskId: string;
  error: string;
  retryCount: number;
  suggestedNextLayer: number;
  requiresHuman: boolean;
  context: Record<string, unknown>;
  timestamp: number;
}

export interface EscalationPolicy {
  mode: 'auto' | 'manual' | 'threshold-based';
  thresholds: {
    maxRetriesPerLayer: number;
    confidenceThreshold: number; // for L0
    successRateThreshold: number; // for L2
  };
  autoEscalateOn: ('timeout' | 'failure' | 'low-confidence')[];
}

// Layer Dispatcher
export interface LayerDispatchPayload {
  layer: 0 | 1 | 2 | 3;
  input: unknown;
  context: DispatchContext;
}

export interface DispatchContext {
  sessionId: string;
  userId?: string;
  projectId?: string;
  intentId?: string;
  parentTaskId?: string;
  trace: string[];
}

export interface DispatchResult {
  success: boolean;
  layer: number;
  output: unknown;
  nextLayer?: number;
  escalations: EscalationEvent[];
  executionTimeMs: number;
}

// Hierarchy State
export interface HierarchyState {
  currentLayer: number;
  intent?: UserIntent;
  graph?: TaskGraph;
  executionResults: ExecutionResult[];
  toolExecutions: SandboxedExecution[];
  escalations: EscalationEvent[];
}

// Observability
export interface LayerTransition {
  fromLayer: number;
  toLayer: number;
  timestamp: number;
  reason: string;
  payloadSize: number;
}

export interface HierarchyMetrics {
  transitions: LayerTransition[];
  layerDurations: Record<number, number>;
  escalationCount: number;
  retryCount: number;
}
