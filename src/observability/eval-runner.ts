// Eval Runner - Execute evaluation suites with configurable concurrency
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-05)

import { z } from 'zod';
import {
  EvalCaseSchema,
  EvalResultSchema,
  EvalRunSchema,
  type EvalCase,
  type EvalResult,
  type EvalSuite,
  type EvalRun,
  type EvalRunOptions,
} from './types.js';
import { getScorer } from './scoring.js';
import { getEvalRegistry } from './eval-registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Error Classes
// ═══════════════════════════════════════════════════════════════════════════════

export class EvalRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalRunnerError';
  }
}

export class EvalTimeoutError extends Error {
  constructor(caseId: string, timeout: number) {
    super(`Case "${caseId}" timed out after ${timeout}ms`);
    this.name = 'EvalTimeoutError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Target Function Type
// ═══════════════════════════════════════════════════════════════════════════════

export type TargetFunction = (
  input: unknown
) => Promise<unknown> | unknown;

// ═══════════════════════════════════════════════════════════════════════════════
// EvalRunner Class
// ═══════════════════════════════════════════════════════════════════════════════

export class EvalRunner {
  private registry = getEvalRegistry();

  /**
   * Run an evaluation suite
   */
  async run(
    suiteId: string,
    targetFn: TargetFunction,
    options: EvalRunOptions = {}
  ): Promise<EvalRun> {
    const suite = this.registry.getSuiteOrThrow(suiteId);
    const startedAt = new Date().toISOString();

    const {
      concurrency = 5,
      timeout = 30000,
      progressCallback,
      stopOnFailure = false,
      metadata,
    } = options;

    const results: EvalResult[] = [];
    const cases = [...suite.cases];
    let completed = 0;

    // Process cases with concurrency limit
    const processCase = async (evalCase: EvalCase): Promise<void> => {
      const result = await this.executeCase(
        evalCase,
        targetFn,
        suite.scoringFunction,
        timeout
      );

      results.push(result);
      completed++;

      if (progressCallback) {
        progressCallback(completed, cases.length, evalCase.name);
      }

      if (stopOnFailure && !result.success) {
        throw new EvalRunnerError(`Case "${evalCase.name}" failed`);
      }
    };

    // Execute with concurrency control
    const queue = [...cases];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Fill up to concurrency limit
      while (executing.length < concurrency && queue.length > 0) {
        const evalCase = queue.shift()!;
        executing.push(processCase(evalCase));
      }

      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
        // Remove completed promises
        for (let i = executing.length - 1; i >= 0; i--) {
          const promise = executing[i]!;
          // Check if done (this is simplified; in practice use a completion marker)
          if (results.length >= completed) {
            // Still running, check later
          }
        }
        // Simplified: just wait for all current batch
        await Promise.all(executing);
        executing.length = 0;
      }
    }

    // Ensure all completed
    await Promise.all(executing);

    const completedAt = new Date().toISOString();
    const summary = this.calculateSummary(results);

    const run: EvalRun = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      suiteId,
      targetFn: targetFn.name || 'anonymous',
      results,
      startedAt,
      completedAt,
      summary,
      metadata,
    };

    // Validate
    return EvalRunSchema.parse(run);
  }

  /**
   * Execute a single evaluation case
   */
  private async executeCase(
    evalCase: EvalCase,
    targetFn: TargetFunction,
    scoringFunction: string,
    timeoutMs: number
  ): Promise<EvalResult> {
    const startTime = Date.now();
    let actualOutput: unknown;
    let error: string | undefined;

    try {
      // Execute with timeout
      const result = await Promise.race([
        Promise.resolve(targetFn(evalCase.input)),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new EvalTimeoutError(evalCase.id, timeoutMs)),
            timeoutMs
          )
        ),
      ]);

      actualOutput = result;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const latency = Date.now() - startTime;

    // Score the result
    let score = 0;
    if (!error) {
      try {
        const scorer = getScorer(scoringFunction);
        if (scorer) {
          score = scorer(actualOutput, evalCase.expectedOutput);
        }
      } catch (scoringError) {
        error = `Scoring error: ${scoringError instanceof Error ? scoringError.message : String(scoringError)}`;
      }
    }

    // Determine success based on threshold
    const success = !error && score >= evalCase.threshold;

    return {
      caseId: evalCase.id,
      success,
      actualOutput,
      score,
      latency,
      error,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(results: EvalResult[]): EvalRun['summary'] {
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    const scores = results.map(r => r.score);
    const latencies = results.map(r => r.latency);

    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      total,
      passed,
      failed: total - passed,
      avgScore,
      avgLatency,
      p50Latency: this.percentile(latencies, 0.5),
      p95Latency: this.percentile(latencies, 0.95),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  /**
   * Quick run - convenience method for simple evaluations
   */
  async quickRun(
    cases: EvalCase[],
    targetFn: TargetFunction,
    options: Omit<EvalRunOptions, 'progressCallback'> & {
      suiteName?: string;
      scoringFunction?: string;
    } = {}
  ): Promise<EvalRun> {
    const {
      suiteName = 'Quick Run',
      scoringFunction = 'exactMatch',
      ...runOptions
    } = options;

    // Create temporary suite
    const suite = this.registry.createSuite({
      id: `quick-${Date.now()}`,
      name: suiteName,
      cases,
      scoringFunction,
    });

    try {
      return await this.run(suite.id, targetFn, runOptions);
    } finally {
      // Clean up temporary suite
      this.registry.removeSuite(suite.id);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalRunner: EvalRunner | null = null;

export function getEvalRunner(): EvalRunner {
  if (!globalRunner) {
    globalRunner = new EvalRunner();
  }
  return globalRunner;
}

export function resetEvalRunner(): void {
  globalRunner = null;
}
