// Build Metrics Aggregator - Per-build statistics for Nova26
// Implements KMS-17

// @ts-ignore - better-sqlite3 types installed at runtime
import { getAnalyticsDB } from './agent-analytics.js';

/**
 * Task count breakdown for a build
 */
export interface TaskCount {
  total: number;
  completed: number;
  failed: number;
}

/**
 * Agent utilization metrics
 */
export interface AgentUtilization {
  agent: string;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksFailed: number;
  avgDuration: number;
  percentageOfBuild: number;
}

/**
 * Complete build metrics
 */
export interface BuildMetrics {
  buildId: string;
  duration: number;
  taskCount: TaskCount;
  passRate: number;
  agentUtilization: AgentUtilization[];
  costEstimate: number;
  tokensUsed: number;
  startTime: string;
  endTime: string;
}

/**
 * Summary metrics across multiple builds
 */
export interface BuildMetricsSummary {
  totalBuilds: number;
  avgDuration: number;
  totalTasks: number;
  overallPassRate: number;
  totalCost: number;
  totalTokens: number;
}

/**
 * Database row for agent results
 */
interface AgentResultRow {
  agent: string;
  success: number;
  duration: number;
  tokens: number;
  timestamp: string;
}

/**
 * Calculate per-build metrics
 * @param buildId - The unique build identifier
 * @returns Complete build metrics or null if build not found
 */
export function calculateBuildMetrics(buildId: string): BuildMetrics | null {
  const db = getAnalyticsDB();

  // Get all results for this build
  const rows = db.prepare(`
    SELECT agent, success, duration, tokens, timestamp
    FROM agent_results
    WHERE build_id = ?
  `).all(buildId) as AgentResultRow[];

  if (rows.length === 0) {
    return null;
  }

  // Calculate duration from first to last task
  const timestamps = rows
    .map(r => new Date(r.timestamp).getTime())
    .filter(t => !isNaN(t));
  
  const startTime = timestamps.length > 0 
    ? new Date(Math.min(...timestamps)).toISOString()
    : new Date().toISOString();
  const endTime = timestamps.length > 0
    ? new Date(Math.max(...timestamps)).toISOString()
    : new Date().toISOString();
  
  const duration = timestamps.length > 1
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : 0;

  // Calculate task counts
  const total = rows.length;
  const completed = rows.filter(r => r.success === 1).length;
  const failed = total - completed;

  // Calculate pass rate
  const passRate = total > 0 ? completed / total : 0;

  // Calculate tokens used
  const tokensUsed = rows.reduce((sum, r) => sum + (r.tokens || 0), 0);

  // Calculate cost estimate (simple model: $0.002 per 1K tokens)
  const costEstimate = (tokensUsed / 1000) * 0.002;

  // Calculate agent utilization
  const agentStats = new Map<string, {
    tasksAssigned: number;
    tasksCompleted: number;
    tasksFailed: number;
    totalDuration: number;
  }>();

  for (const row of rows) {
    const stats = agentStats.get(row.agent) || {
      tasksAssigned: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      totalDuration: 0,
    };
    
    stats.tasksAssigned++;
    if (row.success === 1) {
      stats.tasksCompleted++;
    } else {
      stats.tasksFailed++;
    }
    stats.totalDuration += row.duration || 0;
    
    agentStats.set(row.agent, stats);
  }

  const agentUtilization: AgentUtilization[] = Array.from(agentStats.entries())
    .map(([agent, stats]) => ({
      agent,
      tasksAssigned: stats.tasksAssigned,
      tasksCompleted: stats.tasksCompleted,
      tasksFailed: stats.tasksFailed,
      avgDuration: stats.tasksAssigned > 0
        ? Math.round(stats.totalDuration / stats.tasksAssigned)
        : 0,
      percentageOfBuild: total > 0 ? stats.tasksAssigned / total : 0,
    }))
    .sort((a, b) => b.tasksAssigned - a.tasksAssigned);

  return {
    buildId,
    duration,
    taskCount: { total, completed, failed },
    passRate,
    agentUtilization,
    costEstimate,
    tokensUsed,
    startTime,
    endTime,
  };
}

/**
 * Get metrics for multiple builds
 * @param buildIds - Array of build identifiers
 * @returns Array of build metrics (null for builds not found)
 */
export function calculateMultipleBuildMetrics(buildIds: string[]): Array<BuildMetrics | null> {
  return buildIds.map(id => calculateBuildMetrics(id));
}

/**
 * Get summary statistics across multiple builds
 * @param buildIds - Array of build identifiers
 * @returns Summary metrics
 */
export function getBuildMetricsSummary(buildIds: string[]): BuildMetricsSummary {
  const metrics = buildIds
    .map(id => calculateBuildMetrics(id))
    .filter((m): m is BuildMetrics => m !== null);

  if (metrics.length === 0) {
    return {
      totalBuilds: 0,
      avgDuration: 0,
      totalTasks: 0,
      overallPassRate: 0,
      totalCost: 0,
      totalTokens: 0,
    };
  }

  const totalBuilds = metrics.length;
  const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
  const totalTasks = metrics.reduce((sum, m) => sum + m.taskCount.total, 0);
  const totalCompleted = metrics.reduce((sum, m) => sum + m.taskCount.completed, 0);
  const totalCost = metrics.reduce((sum, m) => sum + m.costEstimate, 0);
  const totalTokens = metrics.reduce((sum, m) => sum + m.tokensUsed, 0);

  return {
    totalBuilds,
    avgDuration: Math.round(totalDuration / totalBuilds),
    totalTasks,
    overallPassRate: totalTasks > 0 ? totalCompleted / totalTasks : 0,
    totalCost,
    totalTokens,
  };
}

/**
 * Format build metrics for display
 * @param metrics - Build metrics to format
 * @returns Formatted string
 */
export function formatBuildMetrics(metrics: BuildMetrics): string {
  const lines = [
    `📊 Build Metrics: ${metrics.buildId}`,
    '═══════════════════════════════════════════════════',
    '',
    `Duration:        ${formatDuration(metrics.duration)}`,
    `Start Time:      ${metrics.startTime}`,
    `End Time:        ${metrics.endTime}`,
    '',
    'Task Count:',
    `  Total:         ${metrics.taskCount.total}`,
    `  Completed:     ${metrics.taskCount.completed}`,
    `  Failed:        ${metrics.taskCount.failed}`,
    `  Pass Rate:     ${(metrics.passRate * 100).toFixed(1)}%`,
    '',
    `Cost Estimate:   $${metrics.costEstimate.toFixed(4)}`,
    `Tokens Used:     ${metrics.tokensUsed.toLocaleString()}`,
    '',
    'Agent Utilization:',
  ];

  if (metrics.agentUtilization.length === 0) {
    lines.push('  No agents assigned');
  } else {
    lines.push('  Agent      │ Tasks │ Completed │ Failed │ Avg Time │ % of Build');
    lines.push('  ───────────┼───────┼───────────┼────────┼──────────┼───────────');
    
    for (const agent of metrics.agentUtilization) {
      const name = agent.agent.padEnd(10);
      const tasks = agent.tasksAssigned.toString().padStart(5);
      const completed = agent.tasksCompleted.toString().padStart(9);
      const failed = agent.tasksFailed.toString().padStart(6);
      const avgTime = `${agent.avgDuration}ms`.padStart(8);
      const pct = `${(agent.percentageOfBuild * 100).toFixed(0)}%`.padStart(9);
      
      lines.push(`  ${name} │ ${tasks} │ ${completed} │ ${failed} │ ${avgTime} │ ${pct}`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format summary metrics for display
 * @param summary - Summary metrics to format
 * @returns Formatted string
 */
export function formatMetricsSummary(summary: BuildMetricsSummary): string {
  const lines = [
    '📈 Build Metrics Summary',
    '═══════════════════════════════════════════════════',
    '',
    `Total Builds:      ${summary.totalBuilds}`,
    `Avg Duration:      ${formatDuration(summary.avgDuration)}`,
    `Total Tasks:       ${summary.totalTasks.toLocaleString()}`,
    `Overall Pass Rate: ${(summary.overallPassRate * 100).toFixed(1)}%`,
    `Total Cost:        $${summary.totalCost.toFixed(4)}`,
    `Total Tokens:      ${summary.totalTokens.toLocaleString()}`,
    '',
    '═══════════════════════════════════════════════════',
  ];
  
  return lines.join('\n');
}

/**
 * Compare two builds and return differences
 * @param buildId1 - First build identifier
 * @param buildId2 - Second build identifier
 * @returns Comparison result or null if either build not found
 */
export interface BuildComparison {
  buildId1: string;
  buildId2: string;
  durationDelta: number;
  taskDelta: number;
  passRateDelta: number;
  costDelta: number;
  tokenDelta: number;
  winner: string | 'tie';
}

export function compareBuilds(buildId1: string, buildId2: string): BuildComparison | null {
  const m1 = calculateBuildMetrics(buildId1);
  const m2 = calculateBuildMetrics(buildId2);

  if (!m1 || !m2) {
    return null;
  }

  const durationDelta = m2.duration - m1.duration;
  const taskDelta = m2.taskCount.total - m1.taskCount.total;
  const passRateDelta = m2.passRate - m1.passRate;
  const costDelta = m2.costEstimate - m1.costEstimate;
  const tokenDelta = m2.tokensUsed - m1.tokensUsed;

  // Determine winner based on pass rate (primary) and duration (secondary, faster is better)
  let winner: string | 'tie';
  if (m1.passRate > m2.passRate) {
    winner = buildId1;
  } else if (m2.passRate > m1.passRate) {
    winner = buildId2;
  } else if (m1.duration < m2.duration) {
    winner = buildId1;
  } else if (m2.duration < m1.duration) {
    winner = buildId2;
  } else {
    winner = 'tie';
  }

  return {
    buildId1,
    buildId2,
    durationDelta,
    taskDelta,
    passRateDelta,
    costDelta,
    tokenDelta,
    winner,
  };
}

/**
 * Get all build IDs from the database
 * @returns Array of unique build IDs
 */
export function getAllBuildIds(): string[] {
  const db = getAnalyticsDB();
  
  const rows = db.prepare(`
    SELECT DISTINCT build_id
    FROM agent_results
    WHERE build_id IS NOT NULL
  `).all() as Array<{ build_id: string }>;

  return rows.map(r => r.build_id);
}

/**
 * Get trending metrics (improving or degrading)
 * @param buildIds - Array of build identifiers in chronological order
 * @returns Trend analysis
 */
export interface TrendAnalysis {
  passRateTrend: 'improving' | 'degrading' | 'stable';
  durationTrend: 'improving' | 'degrading' | 'stable';
  costTrend: 'improving' | 'degrading' | 'stable';
}

export function analyzeTrends(buildIds: string[]): TrendAnalysis {
  const metrics = buildIds
    .map(id => calculateBuildMetrics(id))
    .filter((m): m is BuildMetrics => m !== null);

  if (metrics.length < 2) {
    return {
      passRateTrend: 'stable',
      durationTrend: 'stable',
      costTrend: 'stable',
    };
  }

  // Compare first half vs second half
  const midPoint = Math.floor(metrics.length / 2);
  const firstHalf = metrics.slice(0, midPoint);
  const secondHalf = metrics.slice(midPoint);

  const firstAvgPassRate = firstHalf.reduce((sum, m) => sum + m.passRate, 0) / firstHalf.length;
  const secondAvgPassRate = secondHalf.reduce((sum, m) => sum + m.passRate, 0) / secondHalf.length;
  
  const firstAvgDuration = firstHalf.reduce((sum, m) => sum + m.duration, 0) / firstHalf.length;
  const secondAvgDuration = secondHalf.reduce((sum, m) => sum + m.duration, 0) / secondHalf.length;
  
  const firstAvgCost = firstHalf.reduce((sum, m) => sum + m.costEstimate, 0) / firstHalf.length;
  const secondAvgCost = secondHalf.reduce((sum, m) => sum + m.costEstimate, 0) / secondHalf.length;

  const passRateThreshold = 0.05;
  const durationThreshold = 0.1; // 10% change
  const costThreshold = 0.1;

  return {
    passRateTrend: secondAvgPassRate > firstAvgPassRate + passRateThreshold
      ? 'improving'
      : secondAvgPassRate < firstAvgPassRate - passRateThreshold
        ? 'degrading'
        : 'stable',
    durationTrend: secondAvgDuration < firstAvgDuration * (1 - durationThreshold)
      ? 'improving' // Faster is better
      : secondAvgDuration > firstAvgDuration * (1 + durationThreshold)
        ? 'degrading'
        : 'stable',
    costTrend: secondAvgCost < firstAvgCost * (1 - costThreshold)
      ? 'improving' // Cheaper is better
      : secondAvgCost > firstAvgCost * (1 + costThreshold)
        ? 'degrading'
        : 'stable',
  };
}
