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
 * Individual cinematic evaluation result (used by CinematicObservability)
 */
export interface CinematicEvalResult {
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
// Cinematic Eval Suite Types
// ============================================================================

/**
 * Complete cinematic evaluation suite definition (used by CinematicObservability)
 */
export interface CinematicEvalSuite {
  /** Unique suite identifier */
  id: string;
  /** Human-readable suite name */
  name: string;
  /** Configured evaluators for this suite */
  evaluators: EvaluatorConfig[];
  /** Test dataset entries */
  dataset: EvalDatasetEntry[];
  /** Optional: previous run results */
  results?: CinematicEvalResult[];
}

/**
 * Cinematic eval suite execution result
 */
export interface CinematicEvalSuiteResult {
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


// ============================================================================
// Eval Framework Types (used by eval-registry, eval-runner, eval-store, golden-sets)
// ============================================================================

import { z } from 'zod';

/**
 * Individual evaluation case
 */
export interface EvalCase {
  id: string;
  name: string;
  input: unknown;
  expectedOutput: unknown;
  threshold: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Eval framework result (from eval-runner)
 */
export interface EvalResult {
  caseId: string;
  success: boolean;
  actualOutput?: unknown;
  score: number;
  latency: number;
  error?: string;
  timestamp: string;
}

/**
 * Eval framework suite (used by eval-registry, eval-runner)
 */
export interface EvalSuite {
  id: string;
  name: string;
  description?: string;
  cases: EvalCase[];
  scoringFunction: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Eval run (from eval-runner/eval-store)
 */
export interface EvalRun {
  id: string;
  suiteId: string;
  targetFn: string;
  results: EvalResult[];
  startedAt: string;
  completedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgScore: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Golden set — a versioned baseline evaluation set
 */
export interface GoldenSet extends EvalSuite {
  version: number;
  promotedAt: string;
  promotedFromRunId?: string;
  promotedBy?: string;
  baselineScores?: Record<string, number>;
}

/**
 * Run history entry for trend analysis
 */
export interface RunHistoryEntry {
  runId: string;
  suiteId: string;
  timestamp: string;
  passRate: number;
  avgScore: number;
  avgLatency: number;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  suiteId: string;
  window: number;
  direction: 'improving' | 'degrading' | 'stable';
  scoreChange: number;
  latencyChange: number;
  passRateChange: number;
  confidence: number;
}

/**
 * Eval store options
 */
export interface EvalStoreOptions {
  directory?: string;
  maxRunsPerSuite?: number;
}

/**
 * Eval run options
 */
export interface EvalRunOptions {
  concurrency?: number;
  timeout?: number;
  progressCallback?: (completed: number, total: number, caseName: string) => void;
  stopOnFailure?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Report format types
 */
export type ReportFormat = 'markdown' | 'json' | 'html';

/**
 * Report generation options
 */
export interface ReportOptions {
  format?: ReportFormat;
  includeDetails?: boolean;
  includeRecommendations?: boolean;
}

/**
 * Diff report between two runs
 */
export interface DiffReport {
  runA: string;
  runB: string;
  suiteId: string;
  timestamp: string;
  changes: Array<{
    caseId: string;
    caseName?: string;
    scoreA: number;
    scoreB: number;
    delta: number;
    statusA: boolean;
    statusB: boolean;
  }>;
  summary: {
    improved: number;
    regressed: number;
    unchanged: number;
    avgDelta: number;
  };
}

/**
 * Regression report
 */
export interface RegressionReport {
  suiteId: string;
  runId: string;
  comparedToGolden: string;
  timestamp: string;
  regressions: Array<{
    caseId: string;
    caseName: string;
    goldenScore: number;
    currentScore: number;
    delta: number;
  }>;
  improvements: Array<{
    caseId: string;
    caseName: string;
    goldenScore: number;
    currentScore: number;
    delta: number;
  }>;
  unchanged: Array<{
    caseId: string;
    caseName: string;
    score: number;
  }>;
  summary: {
    totalCases: number;
    regressions: number;
    improvements: number;
    unchanged: number;
    avgDelta: number;
  };
}

// ============================================================================
// Zod Schemas for Eval Framework
// ============================================================================

export const EvalCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
  expectedOutput: z.unknown(),
  threshold: z.number().default(0.8),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const EvalResultSchema = z.object({
  caseId: z.string(),
  success: z.boolean(),
  actualOutput: z.unknown().optional(),
  score: z.number(),
  latency: z.number(),
  error: z.string().optional(),
  timestamp: z.string(),
});

export const EvalSuiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  cases: z.array(EvalCaseSchema),
  scoringFunction: z.string().default('exactMatch'),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const EvalRunSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  targetFn: z.string(),
  results: z.array(EvalResultSchema),
  startedAt: z.string(),
  completedAt: z.string(),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    avgScore: z.number(),
    avgLatency: z.number(),
    p50Latency: z.number(),
    p95Latency: z.number(),
  }),
  metadata: z.record(z.unknown()).optional(),
});

export const GoldenSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  cases: z.array(EvalCaseSchema),
  scoringFunction: z.string().default('exactMatch'),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
  version: z.number(),
  promotedAt: z.string(),
  promotedFromRunId: z.string().optional(),
  promotedBy: z.string().optional(),
  baselineScores: z.record(z.number()).optional(),
});
