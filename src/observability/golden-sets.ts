// Golden Sets - Baseline evaluation sets with versioning and regression detection
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-05)

import { z } from 'zod';
import {
  GoldenSetSchema,
  type GoldenSet,
  type EvalRun,
  type EvalSuite,
  type RegressionReport,
  type EvalCase,
} from './types.js';
import { getEvalRegistry } from './eval-registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Error Classes
// ═══════════════════════════════════════════════════════════════════════════════

export class GoldenSetNotFoundError extends Error {
  constructor(suiteId: string) {
    super(`Golden set not found: ${suiteId}`);
    this.name = 'GoldenSetNotFoundError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GoldenSetManager Class
// ═══════════════════════════════════════════════════════════════════════════════

export class GoldenSetManager {
  private registry = getEvalRegistry();
  private goldenSets: Map<string, GoldenSet> = new Map();

  /**
   * Create a new golden set from a suite
   */
  createGoldenSet(
    suite: EvalSuite,
    baselineScores?: Record<string, number>
  ): GoldenSet {
    const now = new Date().toISOString();

    const goldenSet: GoldenSet = {
      ...suite,
      version: 1,
      promotedAt: now,
      baselineScores: baselineScores ?? this.extractBaselineScores(suite),
    };

    const validated = GoldenSetSchema.parse(goldenSet);
    this.goldenSets.set(suite.id, validated);

    return validated;
  }

  /**
   * Create golden set from an eval run
   */
  createGoldenSetFromRun(
    run: EvalRun,
    promotedBy?: string
  ): GoldenSet {
    const suite = this.registry.getSuiteOrThrow(run.suiteId);
    const now = new Date().toISOString();

    // Extract baseline scores from run results
    const baselineScores: Record<string, number> = {};
    for (const result of run.results) {
      baselineScores[result.caseId] = result.score;
    }

    const goldenSet: GoldenSet = {
      ...suite,
      version: 1,
      promotedFromRunId: run.id,
      promotedAt: now,
      promotedBy,
      baselineScores,
    };

    const validated = GoldenSetSchema.parse(goldenSet);
    this.goldenSets.set(suite.id, validated);

    return validated;
  }

  /**
   * Update an existing golden set (increments version)
   */
  updateGoldenSet(
    suiteId: string,
    updates: Partial<Omit<GoldenSet, 'id' | 'version' | 'createdAt'>>,
    promotedBy?: string
  ): GoldenSet {
    const existing = this.getGoldenSetOrThrow(suiteId);

    const updated: GoldenSet = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      promotedAt: new Date().toISOString(),
      promotedBy: promotedBy ?? existing.promotedBy,
    };

    const validated = GoldenSetSchema.parse(updated);
    this.goldenSets.set(suiteId, validated);

    return validated;
  }

  /**
   * Get a golden set
   */
  getGoldenSet(suiteId: string): GoldenSet | undefined {
    return this.goldenSets.get(suiteId);
  }

  /**
   * Get a golden set or throw
   */
  getGoldenSetOrThrow(suiteId: string): GoldenSet {
    const goldenSet = this.goldenSets.get(suiteId);
    if (!goldenSet) {
      throw new GoldenSetNotFoundError(suiteId);
    }
    return goldenSet;
  }

  /**
   * List all golden sets
   */
  listGoldenSets(): GoldenSet[] {
    return Array.from(this.goldenSets.values()).sort(
      (a, b) => new Date(b.promotedAt).getTime() - new Date(a.promotedAt).getTime()
    );
  }

  /**
   * Remove a golden set
   */
  removeGoldenSet(suiteId: string): boolean {
    return this.goldenSets.delete(suiteId);
  }

  /**
   * Compare a run to its golden set
   */
  compareToGolden(run: EvalRun): RegressionReport {
    const goldenSet = this.getGoldenSetOrThrow(run.suiteId);

    const regressions: RegressionReport['regressions'] = [];
    const improvements: RegressionReport['improvements'] = [];
    const unchanged: RegressionReport['unchanged'] = [];

    // Build lookup for current results
    const currentResults = new Map(
      run.results.map(r => [r.caseId, r])
    );

    // Build lookup for case names
    const caseNames = new Map(
      goldenSet.cases.map(c => [c.id, c.name])
    );

    for (const [caseId, goldenScore] of Object.entries(goldenSet.baselineScores ?? {})) {
      const currentResult = currentResults.get(caseId);
      const caseName = caseNames.get(caseId) ?? caseId;

      if (!currentResult) {
        // Case missing in current run - treat as regression
        regressions.push({
          caseId,
          caseName,
          goldenScore,
          currentScore: 0,
          delta: -goldenScore,
        });
        continue;
      }

      const currentScore = currentResult.score;
      const delta = currentScore - goldenScore;
      const threshold = 0.05; // 5% threshold for significant change

      if (delta < -threshold) {
        regressions.push({
          caseId,
          caseName,
          goldenScore,
          currentScore,
          delta,
        });
      } else if (delta > threshold) {
        improvements.push({
          caseId,
          caseName,
          goldenScore,
          currentScore,
          delta,
        });
      } else {
        unchanged.push({
          caseId,
          caseName,
          score: currentScore,
        });
      }
    }

    // Calculate average delta
    const allDeltas = [
      ...regressions.map(r => r.delta),
      ...improvements.map(i => i.delta),
      ...unchanged.map(() => 0),
    ];
    const avgDelta = allDeltas.length > 0
      ? allDeltas.reduce((a, b) => a + b, 0) / allDeltas.length
      : 0;

    return {
      suiteId: run.suiteId,
      runId: run.id,
      comparedToGolden: goldenSet.version.toString(),
      timestamp: new Date().toISOString(),
      regressions,
      improvements,
      unchanged,
      summary: {
        totalCases: goldenSet.cases.length,
        regressions: regressions.length,
        improvements: improvements.length,
        unchanged: unchanged.length,
        avgDelta,
      },
    };
  }

  /**
   * Promote a run to become the new golden set
   */
  promoteRunToGolden(
    run: EvalRun,
    promotedBy?: string
  ): GoldenSet {
    const existing = this.goldenSets.get(run.suiteId);

    if (existing) {
      // Update existing
      return this.updateGoldenSetFromRun(run, promotedBy);
    } else {
      // Create new
      return this.createGoldenSetFromRun(run, promotedBy);
    }
  }

  /**
   * Generate regression report markdown
   */
  generateRegressionReportMarkdown(report: RegressionReport): string {
    const lines: string[] = [];

    lines.push(`# Regression Report`);
    lines.push('');
    lines.push(`**Suite:** ${report.suiteId}`);
    lines.push(`**Run:** ${report.runId}`);
    lines.push(`**Compared to Golden:** v${report.comparedToGolden}`);
    lines.push(`**Timestamp:** ${report.timestamp}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Cases:** ${report.summary.totalCases}`);
    lines.push(`- **Regressions:** ${report.summary.regressions} 🔴`);
    lines.push(`- **Improvements:** ${report.summary.improvements} 🟢`);
    lines.push(`- **Unchanged:** ${report.summary.unchanged} ⚪`);
    lines.push(`- **Average Delta:** ${report.summary.avgDelta.toFixed(4)}`);
    lines.push('');

    // Regressions
    if (report.regressions.length > 0) {
      lines.push('## Regressions 🔴');
      lines.push('');
      lines.push('| Case | Golden | Current | Delta |');
      lines.push('|------|--------|---------|-------|');
      for (const r of report.regressions) {
        lines.push(`| ${r.caseName} | ${r.goldenScore.toFixed(4)} | ${r.currentScore.toFixed(4)} | ${r.delta.toFixed(4)} |`);
      }
      lines.push('');
    }

    // Improvements
    if (report.improvements.length > 0) {
      lines.push('## Improvements 🟢');
      lines.push('');
      lines.push('| Case | Golden | Current | Delta |');
      lines.push('|------|--------|---------|-------|');
      for (const i of report.improvements) {
        lines.push(`| ${i.caseName} | ${i.goldenScore.toFixed(4)} | ${i.currentScore.toFixed(4)} | +${i.delta.toFixed(4)} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private extractBaselineScores(suite: EvalSuite): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const c of suite.cases) {
      scores[c.id] = c.threshold;
    }
    return scores;
  }

  private updateGoldenSetFromRun(
    run: EvalRun,
    promotedBy?: string
  ): GoldenSet {
    const existing = this.goldenSets.get(run.suiteId);
    if (!existing) {
      throw new GoldenSetNotFoundError(run.suiteId);
    }

    // Extract new baseline scores
    const baselineScores: Record<string, number> = {};
    for (const result of run.results) {
      baselineScores[result.caseId] = result.score;
    }

    const updated: GoldenSet = {
      ...existing,
      version: existing.version + 1,
      promotedFromRunId: run.id,
      promotedAt: new Date().toISOString(),
      promotedBy,
      baselineScores,
    };

    const validated = GoldenSetSchema.parse(updated);
    this.goldenSets.set(run.suiteId, validated);

    return validated;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalManager: GoldenSetManager | null = null;

export function getGoldenSetManager(): GoldenSetManager {
  if (!globalManager) {
    globalManager = new GoldenSetManager();
  }
  return globalManager;
}

export function resetGoldenSetManager(): void {
  globalManager = null;
}
