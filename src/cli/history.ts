// Build History & Trends CLI for NOVA26
// Provides analytics and visualization of build performance over time

// @ts-ignore - better-sqlite3 types installed at runtime
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';

// Types
export interface BuildHistoryEntry {
  buildId: string;
  sessionId: string;
  timestamp: string;
  status: 'success' | 'failure' | 'partial';
  duration: number;        // milliseconds
  taskCount: number;
  successCount: number;
  failureCount: number;
  totalCost: number;
  totalTokens: number;
}

export interface AgentUtilization {
  agent: string;
  taskCount: number;
  successCount: number;
  utilizationPct: number;  // % of total tasks
}

export interface TrendAnalysis {
  direction: 'improving' | 'declining' | 'stable';
  successRateChange: number;  // percentage points
  avgDurationChange: number;  // percentage
  avgCostChange: number;      // percentage
}

export interface FailurePattern {
  pattern: string;
  count: number;
  agents: string[];
}

export interface HistorySummary {
  recentBuilds: BuildHistoryEntry[];
  agentUtilization: AgentUtilization[];
  trends: TrendAnalysis;
  commonFailures: FailurePattern[];
  summary: {
    totalBuilds: number;
    overallSuccessRate: number;
    totalCost: number;
    totalTasks: number;
  };
}

// Database paths
const DATA_DIR = join(process.cwd(), '.nova', 'data');
const EVENTS_DIR = join(process.cwd(), '.nova', 'events');

// Ensure directories exist
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Get the analytics database connection
 */
function getAnalyticsDB(): Database.Database {
  return new Database(join(DATA_DIR, 'analytics.db'));
}

/**
 * Get the cost tracking database connection
 */
function getCostDB(): Database.Database {
  return new Database(join(DATA_DIR, 'cost-tracking.db'));
}

/**
 * Calculate build status based on success/failure counts
 */
function calculateBuildStatus(successCount: number, failureCount: number): 'success' | 'failure' | 'partial' {
  if (failureCount === 0) return 'success';
  if (successCount === 0) return 'failure';
  return 'partial';
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
}

/**
 * Format timestamp to readable date string
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Get build history entries from the database
 */
export async function getBuildHistory(limit: number = 10): Promise<BuildHistoryEntry[]> {
  const analyticsDb = getAnalyticsDB();
  const costDb = getCostDB();
  
  // Get builds with task counts from agent_results
  const buildRows = analyticsDb.prepare(`
    SELECT 
      build_id,
      COUNT(*) as task_count,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count,
      MIN(timestamp) as start_time,
      MAX(timestamp) as end_time,
      SUM(tokens) as total_tokens
    FROM agent_results
    WHERE build_id IS NOT NULL
    GROUP BY build_id
    ORDER BY start_time DESC
    LIMIT ?
  `).all(limit) as Array<{
    build_id: string;
    task_count: number;
    success_count: number;
    failure_count: number;
    start_time: string;
    end_time: string;
    total_tokens: number;
  }>;

  // Get cost data per build
  const costRows = costDb.prepare(`
    SELECT 
      task_id,
      cost,
      timestamp
    FROM cost_entries
    WHERE timestamp > datetime('now', '-30 days')
  `).all() as Array<{ task_id: string; cost: number; timestamp: string }>;

  // Get session info from events
  const sessions = getSessionInfo();
  const sessionMap = new Map(sessions.map(s => [s.sessionId, s]));

  // Map builds to entries
  const entries: BuildHistoryEntry[] = buildRows.map((row) => {
    const startTime = new Date(row.start_time).getTime();
    const endTime = new Date(row.end_time).getTime();
    const duration = Math.max(0, endTime - startTime);
    
    // Find associated session (closest timestamp match)
    let sessionId = `session-${row.build_id}`;
    for (const [sid, session] of sessionMap) {
      const sessionTime = new Date(session.startedAt).getTime();
      const buildTime = new Date(row.start_time).getTime();
      if (Math.abs(sessionTime - buildTime) < 60000) { // Within 1 minute
        sessionId = sid;
        break;
      }
    }

    // Calculate cost for this build's timeframe
    const buildStartTime = new Date(row.start_time).getTime();
    const buildEndTime = new Date(row.end_time).getTime();
    const totalCost = costRows
      .filter(c => {
        const costTime = new Date(c.timestamp).getTime();
        return costTime >= buildStartTime && costTime <= buildEndTime + 60000;
      })
      .reduce((sum, c) => sum + c.cost, 0);

    return {
      buildId: row.build_id,
      sessionId,
      timestamp: row.start_time,
      status: calculateBuildStatus(row.success_count, row.failure_count),
      duration,
      taskCount: row.task_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      totalCost,
      totalTokens: row.total_tokens || 0
    };
  });

  // Close database connections
  analyticsDb.close();
  costDb.close();

  return entries;
}

/**
 * Get session information from event store
 */
function getSessionInfo(): Array<{ sessionId: string; startedAt: string; status: string }> {
  if (!existsSync(EVENTS_DIR)) return [];
  
  const sessions: Array<{ sessionId: string; startedAt: string; status: string }> = [];
  
  try {
    const files = readdirSync(EVENTS_DIR).filter(f => f.endsWith('.state.json'));
    for (const file of files) {
      try {
        const content = readFileSync(join(EVENTS_DIR, file), 'utf-8');
        const state = JSON.parse(content);
        sessions.push({
          sessionId: state.sessionId,
          startedAt: state.startedAt,
          status: state.status
        });
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Return empty if directory can't be read
  }
  
  return sessions.sort((a, b) => 
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

/**
 * Get agent utilization statistics
 */
export async function getAgentUtilization(_builds?: BuildHistoryEntry[]): Promise<AgentUtilization[]> {
  const analyticsDb = getAnalyticsDB();
  
  // Get all agent task counts
  const rows = analyticsDb.prepare(`
    SELECT 
      agent,
      COUNT(*) as task_count,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count
    FROM agent_results
    GROUP BY agent
    ORDER BY task_count DESC
  `).all() as Array<{ agent: string; task_count: number; success_count: number }>;

  analyticsDb.close();

  const totalTasks = rows.reduce((sum, r) => sum + r.task_count, 0);
  
  return rows.map(row => ({
    agent: row.agent,
    taskCount: row.task_count,
    successCount: row.success_count,
    utilizationPct: totalTasks > 0 ? Math.round((row.task_count / totalTasks) * 100) : 0
  }));
}

/**
 * Analyze trends comparing recent builds to older ones
 */
export function analyzeTrends(builds?: BuildHistoryEntry[]): TrendAnalysis {
  if (!builds || builds.length < 2) {
    return {
      direction: 'stable',
      successRateChange: 0,
      avgDurationChange: 0,
      avgCostChange: 0
    };
  }

  // Split builds in half - recent vs older
  const midPoint = Math.floor(builds.length / 2);
  const recentBuilds = builds.slice(0, midPoint);
  const olderBuilds = builds.slice(midPoint);

  // Calculate metrics for recent builds
  const recentSuccessRate = recentBuilds.reduce((sum, b) => 
    sum + (b.taskCount > 0 ? b.successCount / b.taskCount : 0), 0
  ) / recentBuilds.length;

  const recentAvgDuration = recentBuilds.reduce((sum, b) => sum + b.duration, 0) / recentBuilds.length;
  const recentAvgCost = recentBuilds.reduce((sum, b) => sum + b.totalCost, 0) / recentBuilds.length;

  // Calculate metrics for older builds
  const olderSuccessRate = olderBuilds.reduce((sum, b) => 
    sum + (b.taskCount > 0 ? b.successCount / b.taskCount : 0), 0
  ) / olderBuilds.length;

  const olderAvgDuration = olderBuilds.reduce((sum, b) => sum + b.duration, 0) / olderBuilds.length;
  const olderAvgCost = olderBuilds.reduce((sum, b) => sum + b.totalCost, 0) / olderBuilds.length;

  // Calculate changes
  const successRateChange = (recentSuccessRate - olderSuccessRate) * 100;
  
  const avgDurationChange = olderAvgDuration > 0 
    ? ((recentAvgDuration - olderAvgDuration) / olderAvgDuration) * 100 
    : 0;
  
  const avgCostChange = olderAvgCost > 0 
    ? ((recentAvgCost - olderAvgCost) / olderAvgCost) * 100 
    : 0;

  // Determine direction
  let direction: 'improving' | 'declining' | 'stable' = 'stable';
  
  // A build is improving if success rate is up OR (success rate is stable AND cost/duration is down)
  const isImproving = successRateChange > 5 || 
    (Math.abs(successRateChange) <= 5 && (avgDurationChange < -10 || avgCostChange < -10));
  const isDeclining = successRateChange < -5 || 
    (Math.abs(successRateChange) <= 5 && (avgDurationChange > 10 || avgCostChange > 10));

  if (isImproving) {
    direction = 'improving';
  } else if (isDeclining) {
    direction = 'declining';
  }

  return {
    direction,
    successRateChange: Math.round(successRateChange * 10) / 10,
    avgDurationChange: Math.round(avgDurationChange * 10) / 10,
    avgCostChange: Math.round(avgCostChange * 10) / 10
  };
}

/**
 * Get common failure patterns from analytics data
 */
export async function getCommonFailurePatterns(limit: number = 5): Promise<FailurePattern[]> {
  const analyticsDb = getAnalyticsDB();
  
  // Get failure reasons grouped by pattern
  const rows = analyticsDb.prepare(`
    SELECT 
      failure_reason,
      COUNT(*) as count,
      GROUP_CONCAT(DISTINCT agent) as agents
    FROM agent_results
    WHERE success = 0 AND failure_reason IS NOT NULL
    GROUP BY failure_reason
    ORDER BY count DESC
    LIMIT ?
  `).all(limit) as Array<{ failure_reason: string; count: number; agents: string }>;

  analyticsDb.close();

  // Group similar patterns (simplified categorization)
  const patterns: FailurePattern[] = rows.map(row => ({
    pattern: categorizeFailure(row.failure_reason),
    count: row.count,
    agents: row.agents ? row.agents.split(',') : []
  }));

  // Merge similar patterns
  const mergedPatterns = mergeSimilarPatterns(patterns);
  
  return mergedPatterns.slice(0, limit);
}

/**
 * Categorize a failure reason into a pattern
 */
function categorizeFailure(reason: string): string {
  const lowerReason = reason.toLowerCase();
  
  if (lowerReason.includes('type') && lowerReason.includes('error')) {
    return 'Type validation errors';
  }
  if (lowerReason.includes('index') || lowerReason.includes('query')) {
    return 'Missing index on query';
  }
  if (lowerReason.includes('timeout') || lowerReason.includes('time out')) {
    return 'Timeout errors';
  }
  if (lowerReason.includes('gate') || lowerReason.includes('retry')) {
    return 'Gate/validation failures';
  }
  if (lowerReason.includes('syntax') || lowerReason.includes('parse')) {
    return 'Syntax errors';
  }
  if (lowerReason.includes('import') || lowerReason.includes('module')) {
    return 'Import/module resolution';
  }
  if (lowerReason.includes('test') || lowerReason.includes('assert')) {
    return 'Test failures';
  }
  
  return reason.length > 40 ? reason.substring(0, 37) + '...' : reason;
}

/**
 * Merge similar failure patterns
 */
function mergeSimilarPatterns(patterns: FailurePattern[]): FailurePattern[] {
  const merged = new Map<string, FailurePattern>();
  
  for (const pattern of patterns) {
    const existing = merged.get(pattern.pattern);
    if (existing) {
      existing.count += pattern.count;
      existing.agents = [...new Set([...existing.agents, ...pattern.agents])];
    } else {
      merged.set(pattern.pattern, { ...pattern });
    }
  }
  
  return Array.from(merged.values()).sort((a, b) => b.count - a.count);
}

/**
 * Generate a complete history summary
 */
export async function generateHistorySummary(limit: number = 10): Promise<HistorySummary> {
  const recentBuilds = await getBuildHistory(limit);
  const agentUtilization = await getAgentUtilization(recentBuilds);
  const trends = analyzeTrends(recentBuilds);
  const commonFailures = await getCommonFailurePatterns(5);

  // Calculate summary statistics
  const totalBuilds = recentBuilds.length;
  const totalTasks = recentBuilds.reduce((sum, b) => sum + b.taskCount, 0);
  const totalSuccessCount = recentBuilds.reduce((sum, b) => sum + b.successCount, 0);
  const overallSuccessRate = totalTasks > 0 ? totalSuccessCount / totalTasks : 0;
  const totalCost = recentBuilds.reduce((sum, b) => sum + b.totalCost, 0);

  return {
    recentBuilds,
    agentUtilization,
    trends,
    commonFailures,
    summary: {
      totalBuilds,
      overallSuccessRate,
      totalCost,
      totalTasks
    }
  };
}

/**
 * Render an ASCII bar chart
 */
export function renderBarChart(
  data: Array<{ label: string; value: number; max: number }>,
  width: number = 20
): string {
  if (data.length === 0) return '';
  
  const maxValue = Math.max(...data.map(d => d.max));
  if (maxValue === 0) return '';

  const lines: string[] = [];
  
  for (const item of data) {
    const barLength = Math.round((item.value / maxValue) * width);
    const bar = '█'.repeat(barLength);
    const pct = Math.round((item.value / item.max) * 100);
    lines.push(`${item.label.padEnd(6)} ${bar} ${pct}%`);
  }
  
  return lines.join('\n');
}

/**
 * Format a history summary for display
 */
export function formatHistorySummary(summary: HistorySummary): string {
  const lines: string[] = [];
  
  // Header
  const buildCount = summary.summary.totalBuilds;
  lines.push(`📊 Build History (Last ${buildCount} build${buildCount !== 1 ? 's' : ''})`);
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');

  // Recent Builds
  lines.push('Recent Builds:');
  if (summary.recentBuilds.length === 0) {
    lines.push('  No builds recorded yet.');
  } else {
    summary.recentBuilds.forEach((build, index) => {
      const statusIcon = build.status === 'success' ? '✅' : build.status === 'failure' ? '❌' : '⚠️';
      const statusText = build.status === 'success' ? 'Success' : build.status === 'failure' ? 'Failed' : 'Partial';
      const timestamp = formatTimestamp(build.timestamp);
      const duration = formatDuration(build.duration);
      const cost = `$${build.totalCost.toFixed(2)}`;
      
      lines.push(`  #${(index + 1).toString().padStart(2)}  ${timestamp}  ${statusIcon} ${statusText.padEnd(7)} ${build.taskCount.toString().padStart(2)} tasks  ${cost.padStart(5)}  ${duration}`);
    });
  }
  lines.push('');

  // Agent Utilization
  lines.push('Agent Utilization:');
  if (summary.agentUtilization.length === 0) {
    lines.push('  No agent data recorded yet.');
  } else {
    const chartData = summary.agentUtilization.slice(0, 6).map(agent => ({
      label: agent.agent,
      value: agent.taskCount,
      max: summary.summary.totalTasks
    }));
    
    const maxTasks = Math.max(...chartData.map(d => d.value), 1);
    
    for (const agent of summary.agentUtilization.slice(0, 6)) {
      const barWidth = 20;
      const barLength = Math.round((agent.taskCount / maxTasks) * barWidth);
      const bar = '█'.repeat(barLength).padEnd(barWidth);
      lines.push(`  ${agent.agent.padEnd(6)} ${bar} ${agent.utilizationPct}% (${agent.taskCount} tasks)`);
    }
  }
  lines.push('');

  // Trends
  const trends = summary.trends;
  const trendIcon = trends.direction === 'improving' ? '📈' : trends.direction === 'declining' ? '📉' : '➡️';
  const trendEmoji = trends.direction === 'improving' ? '✅' : trends.direction === 'declining' ? '⚠️' : '➖';
  
  lines.push(`📈 Trends (vs previous ${Math.floor(buildCount / 2)} builds):`);
  
  const successChangeStr = trends.successRateChange >= 0 
    ? `+${trends.successRateChange.toFixed(0)}%` 
    : `${trends.successRateChange.toFixed(0)}%`;
  lines.push(`  Success Rate:  ${(summary.summary.overallSuccessRate * 100).toFixed(0)}% ${trends.successRateChange >= 0 ? '↑' : '↓'}  ${trendIcon} ${successChangeStr}`);
  
  const durationChangeStr = trends.avgDurationChange >= 0 
    ? `+${trends.avgDurationChange.toFixed(0)}%` 
    : `${trends.avgDurationChange.toFixed(0)}%`;
  const durationIcon = trends.avgDurationChange <= 0 ? '📈' : '📉';
  lines.push(`  Avg Duration:  ${durationIcon} ${durationChangeStr}`);
  
  const costChangeStr = trends.avgCostChange >= 0 
    ? `+${trends.avgCostChange.toFixed(0)}%` 
    : `${trends.avgCostChange.toFixed(0)}%`;
  const costIcon = trends.avgCostChange <= 0 ? '📈' : '📉';
  lines.push(`  Avg Cost:      ${costIcon} ${costChangeStr}`);
  
  const directionUpper = trends.direction.toUpperCase();
  lines.push(`  Overall:       ${directionUpper} ${trendEmoji}`);
  lines.push('');

  // Common Failures
  lines.push('🔥 Common Failure Patterns:');
  if (summary.commonFailures.length === 0) {
    lines.push('  No failures recorded.');
  } else {
    summary.commonFailures.forEach((failure, index) => {
      const agents = failure.agents.slice(0, 3).join(', ');
      const more = failure.agents.length > 3 ? ` +${failure.agents.length - 3} more` : '';
      lines.push(`  ${index + 1}. ${failure.pattern} (${failure.count}x) - ${agents}${more}`);
    });
  }
  lines.push('');

  // Summary
  lines.push(`💰 Summary (Last ${buildCount} builds):`);
  lines.push(`  Total Builds: ${summary.summary.totalBuilds}`);
  lines.push(`  Success Rate: ${(summary.summary.overallSuccessRate * 100).toFixed(0)}%`);
  lines.push(`  Total Cost:   $${summary.summary.totalCost.toFixed(2)}`);
  lines.push(`  Total Tasks:  ${summary.summary.totalTasks}`);
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}
