// KIMI-R23-05: Cinematic Observability & Eval Suite - Core Types
// Type definitions for distributed tracing and evaluation framework

// ============================================================================
// Span Types
// ============================================================================

/**
 * Span type categories for classification
 */
export type SpanType = 
  | 'agent-call' 
  | 'llm-inference' 
  | 'tool-use' 
  | 'gate-check' 
  | 'user-interaction';

/**
 * Span execution status
 */
export type SpanStatus = 'running' | 'success' | 'failure';

/**
 * Cinematic span - atomic unit of observability
 * Captures every agent call, LLM inference, tool use, gate check, and user interaction
 */
export interface CinematicSpan {
  /** Unique span identifier (UUID v4) */
  id: string;
  /** Trace ID for grouping related spans */
  traceId: string;
  /** Parent span ID for hierarchical traces */
  parentId?: string;
  /** Human-readable span name */
  name: string;
  /** Agent that created this span */
  agentId: string;
  /** Span classification type */
  type: SpanType;
  /** ISO 8601 timestamp when span started */
  startTime: string;
  /** ISO 8601 timestamp when span ended (undefined if running) */
  endTime?: string;
  /** Duration in milliseconds (undefined if running) */
  durationMs?: number;
  /** Arbitrary metadata for extensibility */
  metadata: Record<string, unknown>;
  /** Taste vault relevance score (0-1, higher = more relevant to user taste) */
  tasteVaultScore?: number;
  /** Current execution status */
  status: SpanStatus;
}

/**
 * Span creation input (omits auto-generated fields)
 */
export type SpanInput = Omit<CinematicSpan, 'id'>;

// ============================================================================
// Evaluator Types
// ============================================================================

/**
 * Evaluator algorithm types
 */
export type EvaluatorType = 'llm-judge' | 'heuristic' | 'human-labeled' | 'taste-vault';

/**
 * Individual evaluator configuration
 */
export interface EvaluatorConfig {
  /** Evaluator name for identification */
  name: string;
  /** Evaluation algorithm type */
  type: EvaluatorType;
  /** Type-specific configuration */
  config: Record<string, unknown>;
}

/**
 * Dataset entry for evaluation
 */
export interface EvalDatasetEntry {
  /** Input data for the test case */
  input: unknown;
  /** Expected/ground truth output */
  expectedOutput: unknown;
  /** Classification tags for filtering */
  tags: string[];
}

/**
 * Individual evaluation result
 */
export interface EvalResult {
  /** Score from 0-1 (higher is better) */
  score: number;
  /** Which evaluator produced this result */
  evaluator: string;
  /** Human-readable details */
  details: string;
  /** Optional metadata from evaluation */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Eval Suite Types
// ============================================================================

/**
 * Complete evaluation suite definition
 */
export interface EvalSuite {
  /** Unique suite identifier */
  id: string;
  /** Human-readable suite name */
  name: string;
  /** Configured evaluators for this suite */
  evaluators: EvaluatorConfig[];
  /** Test dataset entries */
  dataset: EvalDatasetEntry[];
  /** Optional: previous run results */
  results?: EvalResult[];
}

/**
 * Eval suite execution result
 */
export interface EvalSuiteResult {
  /** Whether all evaluators passed thresholds */
  passed: boolean;
  /** Aggregated scores by evaluator name */
  scores: Record<string, number>;
  /** Detailed result messages */
  details: string[];
  /** Per-entry detailed results */
  entryResults?: Array<{
    entryIndex: number;
    scores: Record<string, number>;
    passed: boolean;
  }>;
}

// ============================================================================
// Remediation Types
// ============================================================================

/**
 * Remediation action types
 */
export type RemediationAction = 
  | 'alert' 
  | 'rollback' 
  | 'circuit-break' 
  | 'retry' 
  | 'escalate';

/**
 * Auto-remediation configuration
 */
export interface RemediationConfig {
  /** Taste score drop threshold (0-1) that triggers remediation */
  tasteScoreDropThreshold: number;
  /** Actions to take when threshold is breached */
  actions: RemediationAction[];
  /** Cooldown period in ms between remediations */
  cooldownMs: number;
}

/**
 * Remediation event record
 */
export interface RemediationEvent {
  /** Event timestamp */
  timestamp: string;
  /** Triggering span/trace ID */
  triggerId: string;
  /** Detected score drop (0-1) */
  scoreDrop: number;
  /** Actions taken */
  actionsTaken: RemediationAction[];
  /** Whether remediation succeeded */
  resolved: boolean;
}

// ============================================================================
// Integration Types
// ============================================================================

/**
 * Braintrust dataset format
 */
export interface BraintrustDataset {
  /** Dataset identifier */
  id: string;
  /** Dataset name */
  name: string;
  /** Project identifier */
  projectId: string;
  /** Dataset entries */
  data: Array<{
    id: string;
    input: unknown;
    expected?: unknown;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * LangSmith trace run format
 */
export interface LangSmithTrace {
  /** Run ID */
  id: string;
  /** Trace/session ID */
  traceId: string;
  /** Run name */
  name: string;
  /** Run type */
  runType: string;
  /** Start time */
  startTime: string;
  /** End time */
  endTime?: string;
  /** Inputs */
  inputs: Record<string, unknown>;
  /** Outputs */
  outputs?: Record<string, unknown>;
  /** Error info */
  error?: string;
  /** Child runs */
  childRuns: LangSmithTrace[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Cinematic observability configuration
 */
export interface CinematicConfig {
  /** Enable 100% span capture */
  fullCapture: boolean;
  /** Sampling rate (1.0 = 100%, used when fullCapture is false) */
  sampleRate: number;
  /** Maximum spans to retain in memory */
  maxInMemorySpans: number;
  /** Auto-remediation configuration */
  remediation: RemediationConfig;
  /** Braintrust integration config */
  braintrust?: {
    apiKey: string;
    projectName: string;
    enabled: boolean;
  };
  /** LangSmith integration config */
  langsmith?: {
    apiKey: string;
    endpoint: string;
    enabled: boolean;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CINEMATIC_CONFIG: CinematicConfig = {
  fullCapture: true,
  sampleRate: 1.0,
  maxInMemorySpans: 10000,
  remediation: {
    tasteScoreDropThreshold: 0.08, // 8% drop threshold
    actions: ['alert', 'escalate'],
    cooldownMs: 60000, // 1 minute cooldown
  },
};
