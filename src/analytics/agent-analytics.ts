// Agent Performance Analytics - Track how well each of the 21 agents performs

// @ts-ignore - better-sqlite3 types installed at runtime
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

export interface AgentStats {
  agent: string;
  totalTasks: number;
  successRate: number;
  avgTokens: number;
  avgDuration: number;
  gatePassRate: number;
  topFailures: { reason: string; count: number }[];
}

interface TrendData {
  date: string;
  successRate: number;
}

const DATA_DIR = join(process.cwd(), '.nova', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'analytics.db'));

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_results (
    id TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    task_id TEXT NOT NULL,
    build_id TEXT,
    success BOOLEAN NOT NULL,
    tokens INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    gate_retries INTEGER DEFAULT 0,
    failure_reason TEXT,
    timestamp TEXT NOT NULL,
    vault_patterns_used INTEGER DEFAULT 0,
    global_wisdom_applied INTEGER DEFAULT 0,
    build_phase TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_agent ON agent_results(agent);
  CREATE INDEX IF NOT EXISTS idx_timestamp ON agent_results(timestamp);
  CREATE INDEX IF NOT EXISTS idx_build_id ON agent_results(build_id);
`);

// Migration: Add new columns if they don't exist (backward compatibility)
try {
  db.exec(`ALTER TABLE agent_results ADD COLUMN vault_patterns_used INTEGER DEFAULT 0;`);
} catch (e) {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE agent_results ADD COLUMN global_wisdom_applied INTEGER DEFAULT 0;`);
} catch (e) {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE agent_results ADD COLUMN build_phase TEXT;`);
} catch (e) {
  // Column already exists
}

/**
 * Record a task result for analytics
 */
export function recordTaskResult(
  agent: string,
  taskId: string,
  success: boolean,
  tokens: number,
  duration: number,
  gateRetries: number = 0,
  failureReason?: string,
  buildId?: string,
  vaultPatternsUsed: number = 0,
  globalWisdomApplied: number = 0,
  buildPhase?: string,
): void {
  const id = `result-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const stmt = db.prepare(`
    INSERT INTO agent_results (id, agent, task_id, build_id, success, tokens, duration, gate_retries, failure_reason, timestamp, vault_patterns_used, global_wisdom_applied, build_phase)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
  `);
  stmt.run(
    id,
    agent,
    taskId,
    buildId || null,
    success ? 1 : 0,
    tokens,
    duration,
    gateRetries,
    failureReason || null,
    vaultPatternsUsed,
    globalWisdomApplied,
    buildPhase || null
  );
}

/**
 * Get statistics for a specific agent
 */
export function getAgentStats(agent: string): AgentStats {
  const totalRow = db.prepare(`
    SELECT COUNT(*) as total, 
           SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
           AVG(tokens) as avg_tokens,
           AVG(duration) as avg_duration,
           CAST(SUM(CASE WHEN gate_retries = 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as gate_pass_rate
    FROM agent_results
    WHERE agent = ?
  `).get(agent) as { total: number; successes: number; avg_tokens: number; avg_duration: number; gate_pass_rate: number } | undefined;

  const topFailures = db.prepare(`
    SELECT failure_reason as reason, COUNT(*) as count
    FROM agent_results
    WHERE agent = ? AND success = 0 AND failure_reason IS NOT NULL
    GROUP BY failure_reason
    ORDER BY count DESC
    LIMIT 5
  `).all(agent) as Array<{ reason: string; count: number }>;

  const total = totalRow?.total || 0;
  const successes = totalRow?.successes || 0;

  return {
    agent,
    totalTasks: total,
    successRate: total > 0 ? successes / total : 0,
    avgTokens: Math.round(totalRow?.avg_tokens || 0),
    avgDuration: Math.round(totalRow?.avg_duration || 0),
    gatePassRate: total > 0 ? (totalRow?.gate_pass_rate ?? 0) : 1,
    topFailures: topFailures || [],
  };
}

/**
 * Get statistics for all agents sorted by success rate descending
 */
export function getAllAgentStats(): AgentStats[] {
  const agents = db.prepare(`
    SELECT DISTINCT agent FROM agent_results
  `).all() as Array<{ agent: string }>;

  const stats = agents.map(row => getAgentStats(row.agent));
  
  // Sort by success rate descending
  return stats.sort((a, b) => b.successRate - a.successRate);
}

/**
 * Get a formatted leaderboard of all agents
 */
export function getLeaderboard(): string {
  const stats = getAllAgentStats();
  
  if (stats.length === 0) {
    return '📊 Agent Performance Leaderboard\n═══════════════════════════════════════════════════\n\n  No data recorded yet. Run some tasks to see analytics.\n\n═══════════════════════════════════════════════════';
  }

  const lines: string[] = [
    '📊 Agent Performance Leaderboard',
    '═══════════════════════════════════════════════════',
    '',
    'Rank │ Agent      │ Success% │ Avg Tokens │ Avg Time │ Tasks',
    '─────┼────────────┼──────────┼────────────┼──────────┼───────',
  ];

  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    const rank = (i + 1).toString().padStart(2);
    const agent = s.agent.padEnd(10);
    const successPct = `${(s.successRate * 100).toFixed(1)}%`.padStart(8);
    const avgTokens = s.avgTokens.toLocaleString().padStart(10);
    const avgTime = `${s.avgDuration}ms`.padStart(8);
    const tasks = s.totalTasks.toString().padStart(5);
    
    lines.push(` ${rank}  │ ${agent} │ ${successPct} │ ${avgTokens} │ ${avgTime} │ ${tasks}`);
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════');
  
  return lines.join('\n');
}

// Task type patterns for recommendation matching
const TASK_TYPE_PATTERNS: Record<string, RegExp[]> = {
  'SUN': [/prd|product.requirement|spec|architecture/i, /plan|design/i],
  'EARTH': [/schema|database|convex|table/i, /data.model/i],
  'PLUTO': [/convex|mutation|query/i, /backend.function/i],
  'MARS': [/api|backend|server|endpoint/i, /typescript|type/i],
  'VENUS': [/ui|component|frontend|react/i, /css|style|html/i],
  'MERCURY': [/test|spec|validate|verify/i, /quality|gate/i],
  'SATURN': [/ring|security|permission|auth/i, /access.control/i],
  'JUPITER': [/architecture|adr|decision/i, /pattern|structure/i],
  'TITAN': [/integration|third.party|external/i, /api.integration/i],
  'EUROPA': [/water|data.flow|pipeline/i, /stream|event/i],
  'CHARON': [/deploy|release|ci|cd/i, /pipeline|build/i],
  'NEPTUNE': [/analytics|metrics|tracking/i, /performance|monitor/i],
  'ATLAS': [/document|doc|readme/i, /knowledge|wiki/i],
  'URANUS': [/research|experiment|prototype/i, /spike|explore/i],
  'TRITON': [/cli|command|tool/i, /automation|script/i],
  'ENCELADUS': [/optimization|performance|speed/i, /cache|memory/i],
  'GANYMEDE': [/mobile|ios|android|app/i, /native|device/i],
  'IO': [/realtime|websocket|socket/i, /live|sync/i],
  'MIMAS': [/config|setting|env/i, /environment|variable/i],
  'CALLISTO': [/log|audit|history/i, /record|trace/i],
  'ANDROMEDA': [/galaxy|multi.agent|swarm/i, /orchestration|coordination/i],
};

/**
 * Get the best agent recommendation for a task based on historical performance
 */
export function getRecommendation(taskDescription: string): string {
  const normalizedDesc = taskDescription.toLowerCase();
  
  // Match task description to agent task types
  const agentScores: Array<{ agent: string; matchScore: number; stats: AgentStats }> = [];
  
  for (const [agent, patterns] of Object.entries(TASK_TYPE_PATTERNS)) {
    let matchScore = 0;
    for (const pattern of patterns) {
      if (pattern.test(normalizedDesc)) {
        matchScore += 1;
      }
    }
    
    const stats = getAgentStats(agent);
    agentScores.push({ agent, matchScore, stats });
  }
  
  // Filter agents that match the task type
  const matchingAgents = agentScores.filter(a => a.matchScore > 0);
  
  // Get all agents with data for fallback
  const allStats = getAllAgentStats();
  
  if (matchingAgents.length === 0 && allStats.length === 0) {
    return '🤖 No analytics data available. Cannot provide recommendation.';
  }
  
  if (matchingAgents.length === 0) {
    // No specific match, recommend based on overall success rate
    const best = allStats[0];
    return `🤖 Recommendation: ${best.agent}\n   Reason: No specific task type match. Best overall performer with ${(best.successRate * 100).toFixed(1)}% success rate.`;
  }
  
  // Sort by match score first, then by success rate (prefer agents with data)
  matchingAgents.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    // Prefer agents with actual task history
    if (b.stats.totalTasks !== a.stats.totalTasks) {
      return b.stats.totalTasks - a.stats.totalTasks;
    }
    return b.stats.successRate - a.stats.successRate;
  });
  
  const best = matchingAgents[0];
  const confidence = best.matchScore >= 2 ? 'High' : 'Medium';
  
  if (best.stats.totalTasks === 0) {
    return `🤖 Recommendation: ${best.agent}\n   Confidence: ${confidence} (task type match, no historical data)\n   Reason: Best match for task type based on description.`;
  }
  
  return `🤖 Recommendation: ${best.agent}\n   Confidence: ${confidence}\n   Success Rate: ${(best.stats.successRate * 100).toFixed(1)}% (${best.stats.totalTasks} tasks)\n   Avg Duration: ${best.stats.avgDuration}ms | Avg Tokens: ${best.stats.avgTokens.toLocaleString()}\n   Reason: Best match for task type with strong historical performance.`;
}

/**
 * Get daily success rate trends for an agent over the specified number of days
 */
export function getTrends(agent: string, days: number): TrendData[] {
  const results: TrendData[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const row = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes
      FROM agent_results
      WHERE agent = ? AND date(timestamp) = date(?)
    `).get(agent, dateStr) as { total: number; successes: number } | undefined;
    
    const total = row?.total || 0;
    const successes = row?.successes || 0;
    
    results.push({
      date: dateStr,
      successRate: total > 0 ? successes / total : 0,
    });
  }
  
  return results;
}

/**
 * Reset all analytics data (for tests)
 */
export function resetAnalytics(): void {
  db.prepare('DELETE FROM agent_results').run();
}

/**
 * Get raw database instance (for advanced queries)
 */
export function getAnalyticsDB(): DatabaseType {
  return db;
}

/**
 * Get build statistics for a specific build
 */
export function getBuildStats(buildId: string): { total: number; success: number; failed: number } {
  const row = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures
    FROM agent_results
    WHERE build_id = ?
  `).get(buildId) as { total: number; successes: number; failures: number } | undefined;
  
  return {
    total: row?.total || 0,
    success: row?.successes || 0,
    failed: row?.failures || 0,
  };
}

/**
 * Get top performing agents with minimum task threshold
 */
export function getTopPerformers(minTasks: number = 5): AgentStats[] {
  return getAllAgentStats().filter(s => s.totalTasks >= minTasks);
}

/**
 * Format agent stats for display
 */
export function formatAgentStats(stats: AgentStats): string {
  const lines = [
    `🤖 ${stats.agent}`,
    '─────────────────────────────────',
    `Total Tasks:     ${stats.totalTasks}`,
    `Success Rate:    ${(stats.successRate * 100).toFixed(1)}%`,
    `Avg Tokens:      ${stats.avgTokens.toLocaleString()}`,
    `Avg Duration:    ${stats.avgDuration.toLocaleString()}ms`,
    `Gate Pass Rate:  ${(stats.gatePassRate * 100).toFixed(1)}%`,
  ];
  
  if (stats.topFailures.length > 0) {
    lines.push('\nTop Failure Reasons:');
    for (const f of stats.topFailures.slice(0, 3)) {
      lines.push(`  • ${f.reason} (${f.count})`);
    }
  }
  
  lines.push('─────────────────────────────────');
  return lines.join('\n');
}

/**
 * Wisdom impact statistics
 */
export interface WisdomImpactStats {
  avgVaultPatternsPerTask: number;
  avgGlobalWisdomPerTask: number;
  wisdomAssistedSuccessRate: number;
  baselineSuccessRate: number;
}

/**
 * Get wisdom impact statistics comparing tasks with wisdom usage vs without
 * @param agentOrBuildId - The agent name or build ID to filter by
 * @param mode - 'agent' to filter by agent, 'build' to filter by build_id
 * @returns Wisdom impact statistics
 */
export function getWisdomImpactStats(
  agentOrBuildId: string,
  mode: 'agent' | 'build'
): WisdomImpactStats {
  const filterColumn = mode === 'agent' ? 'agent' : 'build_id';

  // Get stats for tasks with wisdom usage (vault_patterns_used > 0 OR global_wisdom_applied > 0)
  interface WisdomRow {
    total: number;
    successes: number;
    avg_vault_patterns: number;
    avg_global_wisdom: number;
  }
  const wisdomRow = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
      AVG(vault_patterns_used) as avg_vault_patterns,
      AVG(global_wisdom_applied) as avg_global_wisdom
    FROM agent_results
    WHERE ${filterColumn} = ? AND (vault_patterns_used > 0 OR global_wisdom_applied > 0)
  `).get(agentOrBuildId) as WisdomRow | undefined;

  // Get stats for tasks without wisdom usage
  interface BaselineRow {
    total: number;
    successes: number;
  }
  const baselineRow = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes
    FROM agent_results
    WHERE ${filterColumn} = ? AND (vault_patterns_used = 0 OR vault_patterns_used IS NULL) AND (global_wisdom_applied = 0 OR global_wisdom_applied IS NULL)
  `).get(agentOrBuildId) as BaselineRow | undefined;

  const wisdomTotal = wisdomRow?.total || 0;
  const wisdomSuccesses = wisdomRow?.successes || 0;
  const baselineTotal = baselineRow?.total || 0;
  const baselineSuccesses = baselineRow?.successes || 0;

  return {
    avgVaultPatternsPerTask: wisdomTotal > 0 ? (wisdomRow?.avg_vault_patterns || 0) : 0,
    avgGlobalWisdomPerTask: wisdomTotal > 0 ? (wisdomRow?.avg_global_wisdom || 0) : 0,
    wisdomAssistedSuccessRate: wisdomTotal > 0 ? wisdomSuccesses / wisdomTotal : 0,
    baselineSuccessRate: baselineTotal > 0 ? baselineSuccesses / baselineTotal : 0,
  };
}
