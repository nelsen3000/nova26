// Eval Framework Types - Core type definitions for evaluation framework
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-05)

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// Core Type Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const EvalCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  input: z.union([z.string(), z.object({}).passthrough()]),
  expectedOutput: z.union([z.string(), z.object({}).passthrough(), z.array(z.any())]),
  tags: z.array(z.string()).default([]),
  threshold: z.number().min(0).max(1).default(0.8),
  timeout: z.number().default(30000),
  metadata: z.record(z.any()).optional(),
});

export const EvalResultSchema = z.object({
  caseId: z.string(),
  success: z.boolean(),
  actualOutput: z.any(),
  score: z.number().min(0).max(1),
  latency: z.number(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
  tokensUsed: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export const EvalSuiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  cases: z.array(EvalCaseSchema),
  scoringFunction: z.string().default('exactMatch'),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.any()).optional(),
});

export const ScoringFunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  scorer: z.function(
    z.tuple([z.any(), z.any()]),
    z.number().min(0).max(1)
  ),
});

export const EvalRunSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  targetFn: z.string(), // Function identifier/name
  results: z.array(EvalResultSchema),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    avgScore: z.number(),
    avgLatency: z.number(),
    p50Latency: z.number(),
    p95Latency: z.number(),
  }),
  metadata: z.record(z.any()).optional(),
});

export const EvalSummarySchema = z.object({
  suiteId: z.string(),
  runId: z.string(),
  timestamp: z.string().datetime(),
  stats: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    passRate: z.number(),
    avgScore: z.number(),
    avgLatency: z.number(),
  }),
  topFailures: z.array(z.object({
    caseId: z.string(),
    caseName: z.string(),
    score: z.number(),
    error: z.string().optional(),
  })).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TypeScript Types
// ═══════════════════════════════════════════════════════════════════════════════

export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type EvalResult = z.infer<typeof EvalResultSchema>;
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;
export type ScoringFunctionType = z.infer<typeof ScoringFunctionSchema>;
export type EvalRun = z.infer<typeof EvalRunSchema>;
export type EvalSummary = z.infer<typeof EvalSummarySchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Additional Types for Runner
// ═══════════════════════════════════════════════════════════════════════════════

export interface EvalRunOptions {
  concurrency?: number;
  timeout?: number;
  progressCallback?: (completed: number, total: number, currentCase: string) => void;
  stopOnFailure?: boolean;
  metadata?: Record<string, unknown>;
}

export interface EvalProgress {
  completed: number;
  total: number;
  currentCase: string;
  currentScore: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Golden Set Types
// ═══════════════════════════════════════════════════════════════════════════════

export const GoldenSetSchema = EvalSuiteSchema.extend({
  version: z.number().default(1),
  promotedFromRunId: z.string().optional(),
  promotedAt: z.string().datetime(),
  promotedBy: z.string().optional(),
  baselineScores: z.record(z.number()).optional(),
});

export type GoldenSet = z.infer<typeof GoldenSetSchema>;

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

// ═══════════════════════════════════════════════════════════════════════════════
// Store Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface EvalStoreOptions {
  directory?: string;
  maxRunsPerSuite?: number;
}

export interface RunHistoryEntry {
  runId: string;
  suiteId: string;
  timestamp: string;
  passRate: number;
  avgScore: number;
  avgLatency: number;
}

export interface TrendAnalysis {
  suiteId: string;
  window: number;
  direction: 'improving' | 'degrading' | 'stable';
  scoreChange: number;
  latencyChange: number;
  passRateChange: number;
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ReportFormat = 'markdown' | 'json' | 'html';

export interface ReportOptions {
  format: ReportFormat;
  includePassedCases?: boolean;
  includeDetails?: boolean;
  maxFailures?: number;
}

export interface DiffReport {
  runA: string;
  runB: string;
  suiteId: string;
  timestamp: string;
  differences: Array<{
    caseId: string;
    caseName: string;
    scoreA: number;
    scoreB: number;
    delta: number;
    significant: boolean;
  }>;
  summary: {
    totalCases: number;
    improved: number;
    regressed: number;
    unchanged: number;
  };
}
