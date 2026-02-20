// Historical Build Comparison — KMS-19
// Compare two builds for duration, pass rate, cost, agent usage, regressions and improvements

import { getAnalyticsDB } from './agent-analytics.js';

/** Represents a build with its key metrics */
export interface BuildMetrics {
  buildId: string;
  timestamp: string;
  durationMs: number;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  passRate: number;
  estimatedCostUsd: number;
  agents: AgentUsage[];
}

/** Represents agent usage within a build */
export interface AgentUsage {
  agentName: string;
  taskCount: number;
  successCount: number;
  failCount: number;
  avgDurationMs: number;
  totalTokens: number;
}

/** Represents the difference between two builds */
export interface BuildDiff {
  durationDiffMs: number;
  durationDiffPercent: number;
  passRateDiff: number;
  passRateDiffPercent: number;
  costDiffUsd: number;
  costDiffPercent: number;
}

/** Represents a regression or improvement in a specific metric */
export interface ChangeItem {
  type: 'regression' | 'improvement' | 'neutral';
  category: 'duration' | 'pass_rate' | 'cost' | 'agent_usage';
  description: string;
  beforeValue: number;
  afterValue: number;
  diff: number;
  diffPercent: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/** Agent comparison between two builds */
export interface AgentComparison {
  agentName: string;
  before: AgentUsage | null;
  after: AgentUsage | null;
  taskCountDiff: number;
  successRateDiff: number;
  avgDurationDiffMs: number;
  status: 'added' | 'removed' | 'increased' | 'decreased' | 'unchanged';
}

/** Complete build comparison result */
export interface BuildComparisonResult {
  baselineBuildId: string;
  targetBuildId: string;
  baseline: BuildMetrics;
  target: BuildMetrics;
  diff: BuildDiff;
  changes: ChangeItem[];
  agentComparisons: AgentComparison[];
  summary: {
    totalRegressions: number;
    totalImprovements: number;
    overallStatus: 'better' | 'worse' | 'mixed' | 'identical';
  };
}

/** Options for build comparison */
export interface ComparisonOptions {
  durationRegressionThreshold?: number;
  durationImprovementThreshold?: number;
  passRateRegressionThreshold?: number;
  passRateImprovementThreshold?: number;
  costRegressionThreshold?: number;
  costImprovementThreshold?: number;
}

const DEFAULT_OPTIONS: Required<ComparisonOptions> = {
  durationRegressionThreshold: 0.1, // 10% slower
  durationImprovementThreshold: 0.1, // 10% faster
  passRateRegressionThreshold: 0.05, // 5% lower
  passRateImprovementThreshold: 0.05, // 5% higher
  costRegressionThreshold: 0.1, // 10% more expensive
  costImprovementThreshold: 0.1, // 10% cheaper
};

/**
 * Get build metrics from the analytics database
 */
export function getBuildMetrics(buildId: string): BuildMetrics | null {
  const db = getAnalyticsDB();

  // Get overall build stats
  interface BuildRow {
    total: number;
    successes: number;
    failures: number;
    avg_duration: number;
    timestamp: string;
  }
  const buildRow = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures,
      AVG(duration) as avg_duration,
      MIN(timestamp) as timestamp
    FROM agent_results
    WHERE build_id = ?
  `).get(buildId) as BuildRow | undefined;

  if (!buildRow || buildRow.total === 0) {
    return null;
  }

  // Get agent-specific stats for this build
  interface AgentRow {
    agent: string;
    task_count: number;
    successes: number;
    failures: number;
    avg_duration: number;
    total_tokens: number;
  }
  const agentRows = db.prepare(`
    SELECT 
      agent,
      COUNT(*) as task_count,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures,
      AVG(duration) as avg_duration,
      SUM(tokens) as total_tokens
    FROM agent_results
    WHERE build_id = ?
    GROUP BY agent
  `).all(buildId) as AgentRow[];

  const agents: AgentUsage[] = agentRows.map(row => ({
    agentName: row.agent,
    taskCount: row.task_count,
    successCount: row.successes,
    failCount: row.failures,
    avgDurationMs: Math.round(row.avg_duration || 0),
    totalTokens: row.total_tokens,
  }));

  // Calculate total duration (sum of all task durations)
  interface DurationRow {
    total_duration: number;
  }
  const durationRow = db.prepare(`
    SELECT SUM(duration) as total_duration
    FROM agent_results
    WHERE build_id = ?
  `).get(buildId) as DurationRow | undefined;

  const totalTasks = buildRow.total;
  const successfulTasks = buildRow.successes;
  const failedTasks = buildRow.failures;
  const passRate = totalTasks > 0 ? successfulTasks / totalTasks : 0;
  const durationMs = durationRow?.total_duration || 0;

  // Estimate cost: $0.002 per 1K tokens (approximate)
  const totalTokens = agents.reduce((sum, a) => sum + a.totalTokens, 0);
  const estimatedCostUsd = (totalTokens / 1000) * 0.002;

  return {
    buildId,
    timestamp: buildRow.timestamp,
    durationMs,
    totalTasks,
    successfulTasks,
    failedTasks,
    passRate,
    estimatedCostUsd,
    agents,
  };
}

/**
 * Calculate the difference between two builds
 */
function calculateBuildDiff(baseline: BuildMetrics, target: BuildMetrics): BuildDiff {
  const durationDiffMs = target.durationMs - baseline.durationMs;
  const durationDiffPercent = baseline.durationMs > 0
    ? durationDiffMs / baseline.durationMs
    : 0;

  const passRateDiff = target.passRate - baseline.passRate;
  const passRateDiffPercent = baseline.passRate > 0
    ? passRateDiff / baseline.passRate
    : 0;

  const costDiffUsd = target.estimatedCostUsd - baseline.estimatedCostUsd;
  const costDiffPercent = baseline.estimatedCostUsd > 0
    ? costDiffUsd / baseline.estimatedCostUsd
    : 0;

  return {
    durationDiffMs,
    durationDiffPercent,
    passRateDiff,
    passRateDiffPercent,
    costDiffUsd,
    costDiffPercent,
  };
}

/**
 * Identify regressions and improvements between builds
 */
function identifyChanges(
  baseline: BuildMetrics,
  target: BuildMetrics,
  diff: BuildDiff,
  options: Required<ComparisonOptions>,
): ChangeItem[] {
  const changes: ChangeItem[] = [];

  // Duration changes
  if (diff.durationDiffPercent > options.durationRegressionThreshold) {
    changes.push({
      type: 'regression',
      category: 'duration',
      description: `Build duration increased by ${(diff.durationDiffPercent * 100).toFixed(1)}%`,
      beforeValue: baseline.durationMs,
      afterValue: target.durationMs,
      diff: diff.durationDiffMs,
      diffPercent: diff.durationDiffPercent,
      severity: diff.durationDiffPercent > 0.5 ? 'high' : 'medium',
    });
  } else if (diff.durationDiffPercent < -options.durationImprovementThreshold) {
    changes.push({
      type: 'improvement',
      category: 'duration',
      description: `Build duration decreased by ${(Math.abs(diff.durationDiffPercent) * 100).toFixed(1)}%`,
      beforeValue: baseline.durationMs,
      afterValue: target.durationMs,
      diff: diff.durationDiffMs,
      diffPercent: diff.durationDiffPercent,
      severity: Math.abs(diff.durationDiffPercent) > 0.5 ? 'high' : 'medium',
    });
  }

  // Pass rate changes
  if (diff.passRateDiff < -options.passRateRegressionThreshold) {
    changes.push({
      type: 'regression',
      category: 'pass_rate',
      description: `Pass rate decreased by ${(Math.abs(diff.passRateDiff) * 100).toFixed(1)}%`,
      beforeValue: baseline.passRate,
      afterValue: target.passRate,
      diff: diff.passRateDiff,
      diffPercent: diff.passRateDiffPercent,
      severity: diff.passRateDiff < -0.2 ? 'critical' : diff.passRateDiff < -0.1 ? 'high' : 'medium',
    });
  } else if (diff.passRateDiff > options.passRateImprovementThreshold) {
    changes.push({
      type: 'improvement',
      category: 'pass_rate',
      description: `Pass rate increased by ${(diff.passRateDiff * 100).toFixed(1)}%`,
      beforeValue: baseline.passRate,
      afterValue: target.passRate,
      diff: diff.passRateDiff,
      diffPercent: diff.passRateDiffPercent,
      severity: diff.passRateDiff > 0.2 ? 'high' : 'medium',
    });
  }

  // Cost changes
  if (diff.costDiffPercent > options.costRegressionThreshold) {
    changes.push({
      type: 'regression',
      category: 'cost',
      description: `Estimated cost increased by ${(diff.costDiffPercent * 100).toFixed(1)}%`,
      beforeValue: baseline.estimatedCostUsd,
      afterValue: target.estimatedCostUsd,
      diff: diff.costDiffUsd,
      diffPercent: diff.costDiffPercent,
      severity: diff.costDiffPercent > 0.5 ? 'high' : 'low',
    });
  } else if (diff.costDiffPercent < -options.costImprovementThreshold) {
    changes.push({
      type: 'improvement',
      category: 'cost',
      description: `Estimated cost decreased by ${(Math.abs(diff.costDiffPercent) * 100).toFixed(1)}%`,
      beforeValue: baseline.estimatedCostUsd,
      afterValue: target.estimatedCostUsd,
      diff: diff.costDiffUsd,
      diffPercent: diff.costDiffPercent,
      severity: Math.abs(diff.costDiffPercent) > 0.5 ? 'high' : 'low',
    });
  }

  return changes;
}

/**
 * Compare agent usage between two builds
 */
function compareAgentUsage(
  baseline: BuildMetrics,
  target: BuildMetrics,
): AgentComparison[] {
  const comparisons: AgentComparison[] = [];
  const baselineAgents = new Map(baseline.agents.map(a => [a.agentName, a]));
  const targetAgents = new Map(target.agents.map(a => [a.agentName, a]));

  // All unique agent names
  const allAgents = new Set([...baselineAgents.keys(), ...targetAgents.keys()]);

  for (const agentName of allAgents) {
    const before = baselineAgents.get(agentName) || null;
    const after = targetAgents.get(agentName) || null;

    let status: AgentComparison['status'];
    let taskCountDiff = 0;
    let successRateDiff = 0;
    let avgDurationDiffMs = 0;

    if (before && after) {
      taskCountDiff = after.taskCount - before.taskCount;
      const beforeSuccessRate = before.taskCount > 0 ? before.successCount / before.taskCount : 0;
      const afterSuccessRate = after.taskCount > 0 ? after.successCount / after.taskCount : 0;
      successRateDiff = afterSuccessRate - beforeSuccessRate;
      avgDurationDiffMs = after.avgDurationMs - before.avgDurationMs;

      if (taskCountDiff > 0) {
        status = 'increased';
      } else if (taskCountDiff < 0) {
        status = 'decreased';
      } else {
        status = 'unchanged';
      }
    } else if (before && !after) {
      status = 'removed';
      taskCountDiff = -before.taskCount;
    } else if (!before && after) {
      status = 'added';
      taskCountDiff = after.taskCount;
    } else {
      status = 'unchanged';
    }

    comparisons.push({
      agentName,
      before,
      after,
      taskCountDiff,
      successRateDiff,
      avgDurationDiffMs,
      status,
    });
  }

  // Sort: added/removed first, then by task count change
  comparisons.sort((a, b) => {
    const statusPriority: Record<string, number> = {
      added: 0,
      removed: 1,
      increased: 2,
      decreased: 3,
      unchanged: 4,
    };
    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status];
    }
    return Math.abs(b.taskCountDiff) - Math.abs(a.taskCountDiff);
  });

  return comparisons;
}

/**
 * Calculate the overall comparison summary
 */
function calculateSummary(changes: ChangeItem[]): BuildComparisonResult['summary'] {
  const regressions = changes.filter(c => c.type === 'regression');
  const improvements = changes.filter(c => c.type === 'improvement');

  let overallStatus: BuildComparisonResult['summary']['overallStatus'];
  if (regressions.length === 0 && improvements.length === 0) {
    overallStatus = 'identical';
  } else if (regressions.length === 0) {
    overallStatus = 'better';
  } else if (improvements.length === 0) {
    overallStatus = 'worse';
  } else {
    overallStatus = 'mixed';
  }

  return {
    totalRegressions: regressions.length,
    totalImprovements: improvements.length,
    overallStatus,
  };
}

/**
 * Compare two builds and return a detailed comparison result
 */
export function compareBuilds(
  baselineBuildId: string,
  targetBuildId: string,
  options: ComparisonOptions = {},
): BuildComparisonResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const baseline = getBuildMetrics(baselineBuildId);
  const target = getBuildMetrics(targetBuildId);

  if (!baseline) {
    throw new Error(`Baseline build not found: ${baselineBuildId}`);
  }
  if (!target) {
    throw new Error(`Target build not found: ${targetBuildId}`);
  }

  const diff = calculateBuildDiff(baseline, target);
  const changes = identifyChanges(baseline, target, diff, mergedOptions);
  const agentComparisons = compareAgentUsage(baseline, target);
  const summary = calculateSummary(changes);

  return {
    baselineBuildId,
    targetBuildId,
    baseline,
    target,
    diff,
    changes,
    agentComparisons,
    summary,
  };
}

/**
 * Format a comparison result as a human-readable string
 */
export function formatComparisonResult(result: BuildComparisonResult): string {
  const lines: string[] = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║           Build Comparison Report                            ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `Baseline: ${result.baselineBuildId}`,
    `Target:   ${result.targetBuildId}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ' Overall Summary',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Status:        ${result.summary.overallStatus.toUpperCase()}`,
    `Regressions:   ${result.summary.totalRegressions}`,
    `Improvements:  ${result.summary.totalImprovements}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ' Metrics Comparison',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Duration:      ${formatDuration(result.baseline.durationMs)} → ${formatDuration(result.target.durationMs)} ` +
      `(${formatPercentChange(result.diff.durationDiffPercent)})`,
    `Pass Rate:     ${(result.baseline.passRate * 100).toFixed(1)}% → ${(result.target.passRate * 100).toFixed(1)}% ` +
      `(${formatPercentChange(result.diff.passRateDiffPercent)})`,
    `Est. Cost:     $${result.baseline.estimatedCostUsd.toFixed(4)} → $${result.target.estimatedCostUsd.toFixed(4)} ` +
      `(${formatPercentChange(result.diff.costDiffPercent)})`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ' Agent Usage Changes',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ];

  const significantAgentChanges = result.agentComparisons.filter(
    c => c.status !== 'unchanged'
  );

  if (significantAgentChanges.length === 0) {
    lines.push('  No significant agent usage changes');
  } else {
    for (const agent of significantAgentChanges.slice(0, 10)) {
      const symbol = agent.status === 'added' || agent.status === 'increased' ? '+' : '-';
      lines.push(`  ${symbol} ${agent.agentName}: ${agent.status} ` +
        `(${agent.taskCountDiff > 0 ? '+' : ''}${agent.taskCountDiff} tasks)`);
    }
    if (significantAgentChanges.length > 10) {
      lines.push(`  ... and ${significantAgentChanges.length - 10} more`);
    }
  }

  if (result.changes.length > 0) {
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(' Detailed Changes');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const change of result.changes) {
      const symbol = change.type === 'improvement' ? '✓' : '✗';
      const emoji = change.type === 'improvement' ? '🟢' : '🔴';
      lines.push(`  ${emoji} ${symbol} ${change.description} [${change.severity}]`);
    }
  }

  lines.push('');
  lines.push('════════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Format milliseconds as human-readable duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format percentage change with sign
 */
function formatPercent(percent: number): string {
  return `${(percent * 100).toFixed(1)}%`;
}

/**
 * Format percent change with + or - sign
 */
function formatPercentChange(percent: number): string {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${formatPercent(percent)}`;
}

/**
 * Get available builds from the database
 */
export function getAvailableBuilds(limit: number = 50): Array<{ buildId: string; timestamp: string; taskCount: number }> {
  const db = getAnalyticsDB();

  interface BuildRow {
    build_id: string;
    timestamp: string;
    task_count: number;
  }

  const rows = db.prepare(`
    SELECT 
      build_id,
      MIN(timestamp) as timestamp,
      COUNT(*) as task_count
    FROM agent_results
    WHERE build_id IS NOT NULL
    GROUP BY build_id
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as BuildRow[];

  return rows.map(row => ({
    buildId: row.build_id,
    timestamp: row.timestamp,
    taskCount: row.task_count,
  }));
}

/**
 * Compare the most recent builds
 */
export function compareRecentBuilds(count: number = 2): BuildComparisonResult | null {
  const builds = getAvailableBuilds(count);
  if (builds.length < 2) {
    return null;
  }

  // Most recent is at builds[0], so compare second most recent (baseline) to most recent (target)
  return compareBuilds(builds[1].buildId, builds[0].buildId);
}
