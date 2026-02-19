// Optimization — R19-03 Types

export interface OptimizationObjective {
  agentTemplateId: string;
  goldenSet: Array<{ input: string; expectedOutput: string; weight: number }>;
  scorers: Array<{ name: string; fn: (output: string, expected: string) => number }>;
  weights: number[];
}

export interface OptimizeResult {
  optimizedSystemPrompt: string;
  optimizedFewShot: Array<{ input: string; output: string }>;
  improvementPercent: number;
  trace: Array<{ iteration: number; score: number; mutation: string }>;
}

export interface GoldenSetEntry {
  id: string;
  input: string;
  expectedOutput: string;
  weight: number;
  tags: string[];
}

export interface EvalResult {
  passed: boolean;
  score: number;
  details: Array<{ entryId: string; score: number; diff?: string }>;
  regressionDetected: boolean;
  baselineComparison?: { previousScore: number; currentScore: number };
}
