// Build Intelligence — predictive analytics and ROI for Nova26 premium users
// Implements Grok R8-05 analytics section

// @ts-ignore - better-sqlite3 types installed at runtime
import { getAnalyticsDB } from './agent-analytics.js';

export interface BuildTimePrediction {
  estimatedMinutes: number;
  confidence: number;
  basis: 'historical' | 'heuristic';
}

export interface ROISummary {
  userId: string;
  period: string;
  buildCount: number;
  avgBuildDurationMs: number;
  estimatedHoursSaved: number;
  estimatedCostSavedUsd: number;
  premiumCostUsd: number;
  netROI: number;
}

export interface AgentHeatmapEntry {
  agentName: string;
  taskType: string;
  totalTasks: number;
  successRate: number;
  avgDurationMs: number;
}

/**
 * Tokenize a text string into keywords (alphanumeric words, lowercase)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/**
 * Calculate similarity score between two descriptions
 * Based on keyword overlap heuristic (intersection / 5)
 */
function calculateSimilarity(desc1: string, desc2: string): number {
  const tokens1 = new Set(tokenize(desc1));
  const tokens2 = new Set(tokenize(desc2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = [...tokens1].filter(t => tokens2.has(t));
  return intersection.length / 5;
}

class BuildIntelligence {
  /**
   * Predict build time for a task based on historical data or heuristics
   */
  predictBuildTime(taskDescription: string, agentName: string): BuildTimePrediction {
    const db = getAnalyticsDB();

    // Query agent_results for the agent
    const rows = db.prepare(`
      SELECT task_id, duration
      FROM agent_results
      WHERE agent = ?
    `).all(agentName) as Array<{ task_id: string; duration: number }>;

    // Find similar tasks using keyword overlap heuristic
    const similarTasks: { duration: number; similarity: number }[] = [];

    for (const row of rows) {
      const similarity = calculateSimilarity(taskDescription, row.task_id);
      if (similarity > 0) {
        similarTasks.push({ duration: row.duration, similarity });
      }
    }

    // Sort by similarity and take top matches
    similarTasks.sort((a, b) => b.similarity - a.similarity);
    const topMatches = similarTasks.slice(0, 10);

    // If >= 3 similar tasks: return historical prediction
    if (topMatches.length >= 3) {
      const avgDuration = topMatches.reduce((sum, t) => sum + t.duration, 0) / topMatches.length;
      return {
        estimatedMinutes: avgDuration / 60000,
        confidence: 0.75,
        basis: 'historical'
      };
    }

    // Not enough similar tasks: use heuristic
    // Base = 5min, add 3min per 100 chars over 200
    const baseMinutes = 5;
    const extraChars = Math.max(0, taskDescription.length - 200);
    const extraMinutes = (extraChars / 100) * 3;
    const estimatedMinutes = baseMinutes + extraMinutes;

    return {
      estimatedMinutes,
      confidence: 0.40,
      basis: 'heuristic'
    };
  }

  /**
   * Calculate ROI for a user over a specific period
   * @param userId - The user ID
   * @param period - 'YYYY-MM' or 'last-30-days'
   */
  calculateROI(userId: string, period: string): ROISummary {
    const db = getAnalyticsDB();

    let dateFilter: string;
    let monthsInPeriod: number;

    if (period === 'last-30-days') {
      dateFilter = "timestamp >= datetime('now', '-30 days')";
      monthsInPeriod = 1;
    } else {
      // Expect YYYY-MM format
      dateFilter = `timestamp LIKE '${period}%'`;
      monthsInPeriod = 1; // Single month period
    }

    // Count builds and calculate avg duration
    interface BuildRow {
      build_count: number;
      avg_duration: number;
      total_duration: number;
    }
    const buildRow = db.prepare(`
      SELECT 
        COUNT(DISTINCT build_id) as build_count,
        AVG(duration) as avg_duration,
        SUM(duration) as total_duration
      FROM agent_results
      WHERE ${dateFilter} AND build_id IS NOT NULL
    `).get() as BuildRow | undefined;

    const buildCount = buildRow?.build_count || 0;
    const avgBuildDurationMs = buildRow?.avg_duration || 0;
    const totalBuildDurationMs = buildRow?.total_duration || 0;

    // estimatedHoursSaved = buildCount * 2 - (totalBuildDurationMs / 3_600_000), floor at 0
    const manualHoursEstimate = buildCount * 2;
    const actualHours = totalBuildDurationMs / 3_600_000;
    const estimatedHoursSaved = Math.max(0, manualHoursEstimate - actualHours);

    // estimatedCostSavedUsd = hoursSaved * 150
    const estimatedCostSavedUsd = estimatedHoursSaved * 150;

    // premiumCostUsd = 299 * monthsInPeriod
    const premiumCostUsd = 299 * monthsInPeriod;

    // netROI = estimatedCostSavedUsd - premiumCostUsd
    const netROI = estimatedCostSavedUsd - premiumCostUsd;

    return {
      userId,
      period,
      buildCount,
      avgBuildDurationMs,
      estimatedHoursSaved,
      estimatedCostSavedUsd,
      premiumCostUsd,
      netROI
    };
  }

  /**
   * Get agent heatmap data grouped by agent and inferred task type
   */
  getAgentHeatmap(_userId: string): AgentHeatmapEntry[] {
    const db = getAnalyticsDB();

    // Query agent_results grouped by agent
    const rows = db.prepare(`
      SELECT 
        agent,
        build_phase,
        COUNT(*) as total_tasks,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
        AVG(duration) as avg_duration
      FROM agent_results
      GROUP BY agent, build_phase
    `).all() as Array<{
      agent: string;
      build_phase: string | null;
      total_tasks: number;
      successes: number;
      avg_duration: number;
    }>;

    const entries: AgentHeatmapEntry[] = rows.map(row => {
      const totalTasks = row.total_tasks;
      const successRate = totalTasks > 0 ? row.successes / totalTasks : 0;
      
      return {
        agentName: row.agent,
        taskType: row.build_phase || 'general',
        totalTasks,
        successRate,
        avgDurationMs: Math.round(row.avg_duration || 0)
      };
    });

    // Sort by agentName asc, then successRate desc
    entries.sort((a, b) => {
      if (a.agentName !== b.agentName) {
        return a.agentName.localeCompare(b.agentName);
      }
      return b.successRate - a.successRate;
    });

    return entries;
  }
}

// Singleton instance
let intelligenceInstance: BuildIntelligence | null = null;

/**
 * Get the BuildIntelligence singleton instance
 */
export function getBuildIntelligence(): BuildIntelligence {
  if (!intelligenceInstance) {
    intelligenceInstance = new BuildIntelligence();
  }
  return intelligenceInstance;
}

/**
 * Reset the BuildIntelligence singleton (for tests)
 */
export function resetBuildIntelligence(): void {
  intelligenceInstance = null;
}
