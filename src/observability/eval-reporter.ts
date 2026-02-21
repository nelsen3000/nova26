// Eval Reporter - Generate reports from evaluation runs
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-05)

import {
  type EvalRun,
  type ReportOptions,
  type ReportFormat,
  type DiffReport,
  type RunHistoryEntry,
  type TrendAnalysis,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// EvalReporter Class
// ═══════════════════════════════════════════════════════════════════════════════

export class EvalReporter {
  /**
   * Generate a report for a run
   */
  generateReport(
    run: EvalRun,
    options: ReportOptions = { format: 'markdown' }
  ): string {
    switch (options.format) {
      case 'json':
        return this.generateJSONReport(run, options);
      case 'html':
        return this.generateHTMLReport(run, options);
      case 'markdown':
      default:
        return this.generateMarkdownReport(run, options);
    }
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(
    run: EvalRun,
    options: ReportOptions
  ): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Evaluation Report`);
    lines.push('');
    lines.push(`**Suite:** ${run.suiteId}`);
    lines.push(`**Run ID:** ${run.id}`);
    lines.push(`**Target:** ${run.targetFn}`);
    lines.push(`**Started:** ${new Date(run.startedAt).toLocaleString()}`);
    lines.push(`**Completed:** ${new Date(run.completedAt).toLocaleString()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Cases | ${run.summary.total} |`);
    lines.push(`| Passed | ${run.summary.passed} ✅ |`);
    lines.push(`| Failed | ${run.summary.failed} ❌ |`);
    lines.push(`| Pass Rate | ${((run.summary.passed / run.summary.total) * 100).toFixed(1)}% |`);
    lines.push(`| Avg Score | ${run.summary.avgScore.toFixed(4)} |`);
    lines.push(`| Avg Latency | ${run.summary.avgLatency.toFixed(0)}ms |`);
    lines.push(`| P50 Latency | ${run.summary.p50Latency.toFixed(0)}ms |`);
    lines.push(`| P95 Latency | ${run.summary.p95Latency.toFixed(0)}ms |`);
    lines.push('');

    // Failed cases
    if (run.summary.failed > 0) {
      const failures = run.results.filter(r => !r.success);
      const maxFailures = options.maxFailures ?? 10;
      const shown = failures.slice(0, maxFailures);

      lines.push('## Failures ❌');
      lines.push('');

      for (const result of shown) {
        const caseInfo = result.caseId;
        lines.push(`### ${caseInfo}`);
        lines.push('');
        lines.push(`- **Score:** ${result.score.toFixed(4)}`);
        lines.push(`- **Latency:** ${result.latency}ms`);
        if (result.error) {
          lines.push(`- **Error:** ${result.error}`);
        }
        if (options.includeDetails) {
          lines.push(`- **Actual:** \`${JSON.stringify(result.actualOutput)}\``);
        }
        lines.push('');
      }

      if (failures.length > maxFailures) {
        lines.push(`*... and ${failures.length - maxFailures} more failures*`);
        lines.push('');
      }
    }

    // Passed cases (if requested)
    if (options.includePassedCases && run.summary.passed > 0) {
      lines.push('## Passed Cases ✅');
      lines.push('');

      for (const result of run.results.filter(r => r.success)) {
        lines.push(`- ${result.caseId}: ${result.score.toFixed(4)} (${result.latency}ms)`);
      }
      lines.push('');
    }

    // Recommendations
    lines.push('## Recommendations');
    lines.push('');
    lines.push(...this.generateRecommendations(run));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate JSON report
   */
  private generateJSONReport(
    run: EvalRun,
    options: ReportOptions
  ): string {
    const report = {
      run,
      options,
      generatedAt: new Date().toISOString(),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(
    run: EvalRun,
    options: ReportOptions
  ): string {
    const passRate = ((run.summary.passed / run.summary.total) * 100).toFixed(1);
    const statusColor = run.summary.failed === 0 ? '#28a745' : '#dc3545';

    return `<!DOCTYPE html>
<html>
<head>
  <title>Evaluation Report - ${run.suiteId}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-value { font-size: 24px; font-weight: bold; color: ${statusColor}; }
    .metric-label { color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    .pass { color: #28a745; }
    .fail { color: #dc3545; }
    .error { background: #fff3f3; padding: 10px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Evaluation Report</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <div class="metric">
      <div class="metric-value">${run.summary.total}</div>
      <div class="metric-label">Total Cases</div>
    </div>
    <div class="metric">
      <div class="metric-value">${run.summary.passed} ✅</div>
      <div class="metric-label">Passed</div>
    </div>
    <div class="metric">
      <div class="metric-value">${run.summary.failed} ❌</div>
      <div class="metric-label">Failed</div>
    </div>
    <div class="metric">
      <div class="metric-value">${passRate}%</div>
      <div class="metric-label">Pass Rate</div>
    </div>
    <div class="metric">
      <div class="metric-value">${run.summary.avgScore.toFixed(4)}</div>
      <div class="metric-label">Avg Score</div>
    </div>
  </div>

  <h2>Results</h2>
  <table>
    <thead>
      <tr>
        <th>Case</th>
        <th>Status</th>
        <th>Score</th>
        <th>Latency</th>
      </tr>
    </thead>
    <tbody>
      ${run.results.map(r => `
        <tr>
          <td>${r.caseId}</td>
          <td class="${r.success ? 'pass' : 'fail'}">${r.success ? '✅ PASS' : '❌ FAIL'}</td>
          <td>${r.score.toFixed(4)}</td>
          <td>${r.latency}ms</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${run.results.filter(r => r.error).length > 0 ? `
  <h2>Errors</h2>
  ${run.results.filter(r => r.error).map(r => `
    <div class="error">
      <strong>${r.caseId}:</strong> ${r.error}
    </div>
  `).join('')}
  ` : ''}
</body>
</html>`;
  }

  /**
   * Generate diff report between two runs
   */
  generateDiffReport(runA: EvalRun, runB: EvalRun): DiffReport {
    const differences: DiffReport['differences'] = [];

    // Build lookup maps
    const resultsA = new Map(runA.results.map(r => [r.caseId, r]));
    const resultsB = new Map(runB.results.map(r => [r.caseId, r]));

    // Compare all cases
    const allCaseIds = new Set([...resultsA.keys(), ...resultsB.keys()]);

    for (const caseId of allCaseIds) {
      const resultA = resultsA.get(caseId);
      const resultB = resultsB.get(caseId);

      const scoreA = resultA?.score ?? 0;
      const scoreB = resultB?.score ?? 0;
      const delta = scoreB - scoreA;

      const threshold = 0.05;
      const significant = Math.abs(delta) > threshold;

      differences.push({
        caseId,
        caseName: caseId,
        scoreA,
        scoreB,
        delta,
        significant,
      });
    }

    const improved = differences.filter(d => d.delta > 0.05).length;
    const regressed = differences.filter(d => d.delta < -0.05).length;

    return {
      runA: runA.id,
      runB: runB.id,
      suiteId: runA.suiteId,
      timestamp: new Date().toISOString(),
      differences: differences.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
      summary: {
        totalCases: differences.length,
        improved,
        regressed,
        unchanged: differences.length - improved - regressed,
      },
    };
  }

  /**
   * Generate trend report
   */
  generateTrendReport(
    suiteId: string,
    history: RunHistoryEntry[],
    analysis: TrendAnalysis
  ): string {
    const lines: string[] = [];

    lines.push(`# Trend Report: ${suiteId}`);
    lines.push('');
    lines.push(`**Analysis Window:** ${analysis.window} runs`);
    lines.push(`**Direction:** ${analysis.direction.toUpperCase()}`);
    lines.push(`**Confidence:** ${(analysis.confidence * 100).toFixed(0)}%`);
    lines.push('');

    // Changes
    lines.push('## Changes');
    lines.push('');
    lines.push(`| Metric | Change |`);
    lines.push(`|--------|--------|`);
    lines.push(`| Score | ${analysis.scoreChange >= 0 ? '+' : ''}${analysis.scoreChange.toFixed(4)} |`);
    lines.push(`| Latency | ${analysis.latencyChange >= 0 ? '+' : ''}${analysis.latencyChange.toFixed(0)}ms |`);
    lines.push(`| Pass Rate | ${analysis.passRateChange >= 0 ? '+' : ''}${(analysis.passRateChange * 100).toFixed(1)}% |`);
    lines.push('');

    // History table
    lines.push('## History');
    lines.push('');
    lines.push(`| Run | Time | Pass Rate | Avg Score | Avg Latency |`);
    lines.push(`|-----|------|-----------|-----------|-------------|`);

    for (const entry of history.slice(-10)) {
      const time = new Date(entry.timestamp).toLocaleDateString();
      lines.push(
        `| ${entry.runId.slice(0, 8)}... | ${time} | ` +
        `${(entry.passRate * 100).toFixed(1)}% | ${entry.avgScore.toFixed(4)} | ${entry.avgLatency.toFixed(0)}ms |`
      );
    }

    lines.push('');

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private generateRecommendations(run: EvalRun): string[] {
    const recommendations: string[] = [];

    if (run.summary.failed === 0) {
      recommendations.push('✅ All tests passed. No action required.');
    } else {
      const failRate = run.summary.failed / run.summary.total;
      if (failRate > 0.5) {
        recommendations.push('🔴 High failure rate detected. Consider reviewing the target function implementation.');
      }

      // Find slowest cases
      const slowCases = run.results
        .filter(r => r.latency > run.summary.avgLatency * 2)
        .sort((a, b) => b.latency - a.latency)
        .slice(0, 3);

      if (slowCases.length > 0) {
        recommendations.push(`⚠️ ${slowCases.length} cases are significantly slower than average. Consider optimization.`);
      }
    }

    if (run.summary.avgScore < 0.8) {
      recommendations.push('📊 Average score is below 0.8. Consider adjusting thresholds or improving model quality.');
    }

    if (recommendations.length === 0) {
      recommendations.push('ℹ️ No specific recommendations. Monitor trends over time.');
    }

    return recommendations.map(r => `- ${r}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalReporter: EvalReporter | null = null;

export function getEvalReporter(): EvalReporter {
  if (!globalReporter) {
    globalReporter = new EvalReporter();
  }
  return globalReporter;
}

export function resetEvalReporter(): void {
  globalReporter = null;
}
