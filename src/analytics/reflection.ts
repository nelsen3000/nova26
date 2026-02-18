// Reflection Summary Generator - Human-readable summaries after builds complete

import { getAllAgentStats, getAgentStats, type AgentStats } from './agent-analytics.js';
import { EventStore, type Event } from '../orchestrator/event-store.js';
import { getTodaySpending } from '../cost/cost-tracker.js';
import { recall, type MemoryCategory } from '../memory/session-memory.js';

/**
 * ReflectionSummary - Complete post-build analysis and recommendations
 */
export interface ReflectionSummary {
  sessionId: string;
  timestamp: string;
  whatWorkedWell: string[];
  whatFailed: Array<{ task: string; reason: string; agent: string }>;
  agentHighlights: Array<{
    agent: string;
    successRate: number;
    avgDuration: number;
    highlight: string;
  }>;
  recommendations: string[];
  costSummary: {
    totalCost: number;
    totalTokens: number;
    taskCount: number;
    avgCostPerTask: number;
  };
  overallAssessment: 'excellent' | 'good' | 'mixed' | 'poor';
}

/**
 * FailedTaskInfo - Extracted failure information from events
 */
interface FailedTaskInfo {
  task: string;
  reason: string;
  agent: string;
}

/**
 * Generate a complete reflection summary for a session
 */
export async function generateReflection(sessionId: string): Promise<ReflectionSummary> {
  const timestamp = new Date().toISOString();

  // Gather data from all sources
  const [whatWorkedWell, whatFailed, agentHighlights, costSummary] = await Promise.all([
    extractWhatWorkedWell(sessionId),
    extractWhatFailed(sessionId),
    generateAgentHighlights(sessionId),
    calculateCostSummary(),
  ]);

  // Build the summary
  const summary: ReflectionSummary = {
    sessionId,
    timestamp,
    whatWorkedWell,
    whatFailed,
    agentHighlights,
    recommendations: [], // Will be generated below
    costSummary,
    overallAssessment: 'mixed', // Will be calculated below
  };

  // Generate recommendations based on the complete summary
  summary.recommendations = generateRecommendations(summary);

  // Calculate overall assessment
  summary.overallAssessment = calculateOverallAssessment(summary);

  return summary;
}

/**
 * Extract patterns that worked well from session memory and events
 */
async function extractWhatWorkedWell(_sessionId: string): Promise<string[]> {
  const workedWell: string[] = [];

  // Get positive patterns from session memory
  const patterns = recall('pattern' as MemoryCategory, 10);
  for (const pattern of patterns) {
    if (pattern.confidence >= 0.8) {
      workedWell.push(`${pattern.key}: ${pattern.value}`);
    }
  }

  // Get architecture decisions that worked
  const architecture = recall('architecture' as MemoryCategory, 5);
  for (const arch of architecture) {
    if (arch.confidence >= 0.85) {
      workedWell.push(`Architecture: ${arch.key} - ${arch.value}`);
    }
  }

  // Get successful error solutions
  const solutions = recall('error_solution' as MemoryCategory, 5);
  for (const solution of solutions) {
    if (solution.confidence >= 0.75) {
      workedWell.push(`Resolved: ${solution.key}`);
    }
  }

  // Get agent analytics data to find high-performing patterns
  const allStats = getAllAgentStats();
  for (const stats of allStats) {
    if (stats.successRate >= 0.9 && stats.totalTasks >= 3) {
      workedWell.push(`${stats.agent} achieved ${(stats.successRate * 100).toFixed(0)}% success rate across ${stats.totalTasks} tasks`);
    }
    if (stats.gatePassRate >= 0.95 && stats.totalTasks >= 3) {
      workedWell.push(`${stats.agent} passed gates on first attempt ${(stats.gatePassRate * 100).toFixed(0)}% of the time`);
    }
  }

  // Add generic messages if we don't have enough data
  if (workedWell.length === 0) {
    workedWell.push('Session completed successfully');
  }

  // Remove duplicates and limit
  return [...new Set(workedWell)].slice(0, 8);
}

/**
 * Extract failed tasks from event store
 */
async function extractWhatFailed(sessionId: string): Promise<FailedTaskInfo[]> {
  const failures: FailedTaskInfo[] = [];

  try {
    // Replay all events from the session
    const events = EventStore.replay(sessionId);

    // Find task_fail events and extract information
    for (const event of events) {
      if (event.type === 'task_fail' && event.taskId) {
        const failureInfo: FailedTaskInfo = {
          task: event.taskId,
          agent: event.agent || 'Unknown',
          reason: extractFailureReason(event),
        };
        failures.push(failureInfo);
      }
    }

    // Also check gate_fail events for additional context
    for (const event of events) {
      if (event.type === 'gate_fail' && event.taskId) {
        const existingFailure = failures.find(f => f.task === event.taskId);
        if (existingFailure && event.data?.gate) {
          existingFailure.reason += ` (Gate: ${event.data.gate})`;
        }
      }
    }
  } catch {
    // If we can't replay events, return empty array
  }

  return failures;
}

/**
 * Extract a human-readable failure reason from an event
 */
function extractFailureReason(event: Event): string {
  if (event.data?.error) {
    const error = String(event.data.error);
    // Truncate long errors
    return error.length > 100 ? error.substring(0, 97) + '...' : error;
  }
  if (event.data?.reason) {
    return String(event.data.reason);
  }
  if (event.data?.message) {
    return String(event.data.message);
  }
  return 'Unknown failure reason';
}

/**
 * Generate highlights for each agent based on performance
 */
async function generateAgentHighlights(sessionId: string): Promise<ReflectionSummary['agentHighlights']> {
  const highlights: ReflectionSummary['agentHighlights'] = [];

  // Get events to find which agents participated in this session
  let participatingAgents: Set<string> = new Set();
  try {
    const events = EventStore.replay(sessionId);
    for (const event of events) {
      if (event.agent) {
        participatingAgents.add(event.agent);
      }
    }
  } catch {
    // If we can't replay, we'll use all agents with stats
  }

  // If no agents found in events, use all agents with stats
  if (participatingAgents.size === 0) {
    const allStats = getAllAgentStats();
    participatingAgents = new Set(allStats.map(s => s.agent));
  }

  // Generate highlights for each participating agent
  for (const agent of participatingAgents) {
    const stats = getAgentStats(agent);
    if (stats.totalTasks === 0) continue;

    const highlight = generateAgentHighlight(stats);
    highlights.push({
      agent,
      successRate: stats.successRate,
      avgDuration: stats.avgDuration,
      highlight,
    });
  }

  // Sort by success rate descending
  return highlights.sort((a, b) => b.successRate - a.successRate);
}

/**
 * Generate a highlight string for an agent based on their stats
 */
function generateAgentHighlight(stats: AgentStats): string {
  if (stats.successRate >= 0.95) {
    return `Exceptional performance with ${(stats.successRate * 100).toFixed(0)}% success rate`;
  }
  if (stats.successRate >= 0.8) {
    return `Strong performance with ${(stats.successRate * 100).toFixed(0)}% success rate`;
  }
  if (stats.successRate >= 0.6) {
    return `Moderate performance with ${(stats.successRate * 100).toFixed(0)}% success rate`;
  }
  if (stats.totalTasks >= 5) {
    return `Struggling with ${(stats.successRate * 100).toFixed(0)}% success rate - consider review`;
  }
  return `Limited data: ${stats.totalTasks} tasks completed`;
}

/**
 * Calculate cost summary from cost tracker
 */
async function calculateCostSummary(): Promise<ReflectionSummary['costSummary']> {
  const todaySpending = getTodaySpending();

  // Estimate task count from request count
  // Most tasks involve 1-3 LLM calls
  const estimatedTaskCount = Math.max(1, Math.round(todaySpending.requests / 1.5));

  return {
    totalCost: todaySpending.cost,
    totalTokens: todaySpending.tokens,
    taskCount: estimatedTaskCount,
    avgCostPerTask: estimatedTaskCount > 0 ? todaySpending.cost / estimatedTaskCount : 0,
  };
}

/**
 * Generate actionable recommendations based on the summary
 */
export function generateRecommendations(summary: ReflectionSummary): string[] {
  const recommendations: string[] = [];

  // Analyze failures
  if (summary.whatFailed.length > 0) {
    const failureByAgent = new Map<string, number>();
    for (const failure of summary.whatFailed) {
      failureByAgent.set(failure.agent, (failureByAgent.get(failure.agent) || 0) + 1);
    }

    // Find agents with multiple failures
    for (const [agent, count] of failureByAgent) {
      if (count >= 3) {
        recommendations.push(`Consider reassigning tasks from ${agent} - ${count} failures detected`);
      }
    }

    // Generic failure recommendation
    if (summary.whatFailed.length >= 5) {
      recommendations.push('High failure rate detected - consider breaking tasks into smaller units');
    }
  }

  // Analyze agent performance
  const lowPerformers = summary.agentHighlights.filter(h => h.successRate < 0.6);
  for (const performer of lowPerformers) {
    recommendations.push(`Review ${performer.agent} prompts and context - success rate below 60%`);
  }

  // Analyze cost efficiency
  if (summary.costSummary.avgCostPerTask > 0.5) {
    recommendations.push('High cost per task detected - consider using lighter models for simpler tasks');
  }
  if (summary.costSummary.totalCost > 10) {
    recommendations.push('Consider implementing response caching to reduce API costs');
  }

  // Analyze patterns
  if (summary.whatWorkedWell.length < 3) {
    recommendations.push('Low pattern recognition - consider using more consistent task structures');
  }

  // Add positive reinforcement
  const topPerformer = summary.agentHighlights[0];
  if (topPerformer && topPerformer.successRate >= 0.9) {
    recommendations.push(`Leverage ${topPerformer.agent}'s successful patterns for similar tasks`);
  }

  // Add generic recommendations if we don't have enough specific ones
  if (recommendations.length < 3) {
    recommendations.push('Continue monitoring agent performance trends');
    recommendations.push('Review and update agent system prompts regularly');
  }

  return [...new Set(recommendations)].slice(0, 6);
}

/**
 * Calculate overall assessment based on success rate and cost efficiency
 */
function calculateOverallAssessment(summary: ReflectionSummary): ReflectionSummary['overallAssessment'] {
  // Calculate success rate from agent highlights
  const totalTasks = summary.agentHighlights.reduce((sum, h) => sum + (h.successRate > 0 ? 1 : 0), 0);
  const avgSuccessRate = totalTasks > 0
    ? summary.agentHighlights.reduce((sum, h) => sum + h.successRate, 0) / summary.agentHighlights.length
    : 0;

  // Consider failure count
  const failureRatio = summary.costSummary.taskCount > 0
    ? summary.whatFailed.length / summary.costSummary.taskCount
    : 0;

  // Consider cost efficiency (assuming $1 per task is reasonable)
  const costEfficiency = summary.costSummary.avgCostPerTask < 0.3;

  // Score calculation
  let score = 0;

  if (avgSuccessRate >= 0.9) score += 3;
  else if (avgSuccessRate >= 0.7) score += 2;
  else if (avgSuccessRate >= 0.5) score += 1;

  if (failureRatio < 0.1) score += 2;
  else if (failureRatio < 0.3) score += 1;

  if (costEfficiency) score += 1;

  // Map score to assessment
  if (score >= 5) return 'excellent';
  if (score >= 3) return 'good';
  if (score >= 2) return 'mixed';
  return 'poor';
}

/**
 * Format a reflection summary as a human-readable string
 */
export function formatReflection(summary: ReflectionSummary): string {
  const lines: string[] = [];

  // Header
  lines.push('╔══════════════════════════════════════════════════════════════════╗');
  lines.push('║           NOVA26 Build Reflection Summary                        ║');
  lines.push('╚══════════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`📋 Session: ${summary.sessionId}`);
  lines.push(`🕐 Generated: ${new Date(summary.timestamp).toLocaleString()}`);
  lines.push(`🏆 Overall Assessment: ${formatAssessmentBadge(summary.overallAssessment)}`);
  lines.push('');

  // What Worked Well
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('✅ What Worked Well');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (summary.whatWorkedWell.length === 0) {
    lines.push('  No patterns recorded yet.');
  } else {
    for (const item of summary.whatWorkedWell) {
      lines.push(`  • ${item}`);
    }
  }
  lines.push('');

  // What Failed
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('❌ What Failed');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (summary.whatFailed.length === 0) {
    lines.push('  No failures recorded. Great job! 🎉');
  } else {
    lines.push('  ┌────────────────────────┬────────────┬──────────────────────────────────────────┐');
    lines.push('  │ Task                   │ Agent      │ Reason                                   │');
    lines.push('  ├────────────────────────┼────────────┼──────────────────────────────────────────┤');
    for (const failure of summary.whatFailed) {
      const task = truncate(failure.task, 20).padEnd(22);
      const agent = truncate(failure.agent, 10).padEnd(12);
      const reason = truncate(failure.reason, 38).padEnd(40);
      lines.push(`  │ ${task}│ ${agent}│ ${reason}│`);
    }
    lines.push('  └────────────────────────┴────────────┴──────────────────────────────────────────┘');
  }
  lines.push('');

  // Agent Performance
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📊 Agent Performance Highlights');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (summary.agentHighlights.length === 0) {
    lines.push('  No agent data available.');
  } else {
    for (const highlight of summary.agentHighlights) {
      const successPct = (highlight.successRate * 100).toFixed(1);
      const duration = highlight.avgDuration > 0 ? `${highlight.avgDuration}ms` : 'N/A';
      lines.push(`  🤖 ${highlight.agent}`);
      lines.push(`     Success: ${successPct}% | Avg Duration: ${duration}`);
      lines.push(`     ${highlight.highlight}`);
      lines.push('');
    }
  }

  // Recommendations
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('💡 Recommendations');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (summary.recommendations.length === 0) {
    lines.push('  No recommendations at this time.');
  } else {
    for (let i = 0; i < summary.recommendations.length; i++) {
      lines.push(`  ${i + 1}. ${summary.recommendations[i]}`);
    }
  }
  lines.push('');

  // Cost Summary
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('💰 Cost Summary');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('  ┌────────────────────┬──────────────────────────────────────────┐');
  lines.push(`  │ Total Cost         │ $${summary.costSummary.totalCost.toFixed(4).padStart(38)} │`);
  lines.push(`  │ Total Tokens       │ ${summary.costSummary.totalTokens.toLocaleString().padStart(39)} │`);
  lines.push(`  │ Task Count         │ ${summary.costSummary.taskCount.toString().padStart(39)} │`);
  lines.push(`  │ Avg Cost/Task      │ $${summary.costSummary.avgCostPerTask.toFixed(4).padStart(38)} │`);
  lines.push('  └────────────────────┴──────────────────────────────────────────┘');
  lines.push('');

  // Footer
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('End of Reflection Summary');
  lines.push('═══════════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Format assessment as a visual badge
 */
function formatAssessmentBadge(assessment: ReflectionSummary['overallAssessment']): string {
  const badges: Record<typeof assessment, string> = {
    excellent: '🟢 EXCELLENT',
    good: '🟡 GOOD',
    mixed: '🟠 MIXED',
    poor: '🔴 POOR',
  };
  return badges[assessment];
}

/**
 * Truncate a string to a maximum length
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Get failed tasks for a specific session (public API)
 */
export async function getFailedTasks(sessionId: string): Promise<FailedTaskInfo[]> {
  return extractWhatFailed(sessionId);
}

/**
 * Get events by session ID (public API wrapper)
 */
export function getEventsBySession(sessionId: string): Event[] {
  return EventStore.replay(sessionId);
}
