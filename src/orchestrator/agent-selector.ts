// Smart Agent Selection for NOVA26
// Uses agent-analytics data to intelligently assign agents to tasks

import { getAllAgentStats } from '../analytics/agent-analytics.js';
import type { AgentStats } from '../analytics/agent-analytics.js';

/**
 * Criteria for selecting an agent for a task
 */
export interface AgentSelectionCriteria {
  taskDescription: string;
  taskType?: string;
  preferredAgents?: string[];
  excludeAgents?: string[];
  minSuccessRate?: number;
}

/**
 * Score breakdown for an agent
 */
export interface AgentScore {
  agent: string;
  score: number;
  successRate: number;
  avgDuration: number;
  gatePassRate: number;
  reasoning: string;
}

/**
 * Result of agent selection
 */
export interface SelectionResult {
  selectedAgent: string;
  scores: AgentScore[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

// Agent domain keywords for keyword matching
const AGENT_KEYWORDS: Record<string, string[]> = {
  'PLUTO': ['schema', 'database', 'table', 'convex', 'data model', 'migration', 'pluto'],
  'MARS': ['api', 'backend', 'endpoint', 'typescript', 'server'],
  'VENUS': ['component', 'page', 'frontend', 'react', 'css', 'html', 'style', 'venus'],
  'SATURN': ['test', 'spec', 'validate', 'verify', 'quality', 'gate', 'saturn'],
  'ENCELADUS': ['security', 'auth', 'permission', 'access control', 'enceladus', 'validation'],
  'GANYMEDE': ['integration', 'webhook', 'stripe', 'third party', 'external api', 'ganymede'],
  'CALLISTO': ['doc', 'readme', 'documentation', 'wiki', 'markdown', 'callisto'],
  'IO': ['performance', 'optimize', 'cache', 'speed', 'memory', 'io'],
  'MIMAS': ['resilience', 'retry', 'circuit breaker', 'config', 'setting', 'env', 'mimas'],
  'NEPTUNE': ['analytics', 'metrics', 'dashboard', 'tracking', 'monitor', 'neptune'],
  'SUN': ['prd', 'product requirement', 'spec', 'architecture', 'plan', 'design', 'sun'],
  'EARTH': ['earth', 'convex', 'data model'],
  'MERCURY': ['mercury', 'validate', 'verify'],
  'JUPITER': ['jupiter', 'adr', 'decision', 'pattern', 'structure'],
  'TITAN': ['titan', 'third party', 'external'],
  'EUROPA': ['europa', 'data flow', 'pipeline', 'stream', 'event'],
  'CHARON': ['charon', 'deploy', 'release', 'ci', 'cd', 'pipeline', 'build'],
  'ATLAS': ['atlas', 'document', 'knowledge', 'wiki'],
  'URANUS': ['uranus', 'research', 'experiment', 'prototype', 'spike', 'explore'],
  'TRITON': ['triton', 'cli', 'command', 'tool', 'automation', 'script'],
  'ANDROMEDA': ['andromeda', 'galaxy', 'multi agent', 'swarm', 'orchestration', 'coordination'],
};

// Default fallback agent mapping based on task keywords
const FALLBACK_KEYWORD_MAP: Record<string, string> = {
  'schema': 'PLUTO',
  'database': 'PLUTO',
  'table': 'PLUTO',
  'api': 'MARS',
  'backend': 'MARS',
  'mutation': 'MARS',
  'query': 'MARS',

  'component': 'VENUS',
  'page': 'VENUS',
  'frontend': 'VENUS',
  'react': 'VENUS',
  'test': 'SATURN',
  'spec': 'SATURN',
  'security': 'ENCELADUS',
  'auth': 'ENCELADUS',
  'validation': 'ENCELADUS',
  'integration': 'GANYMEDE',
  'webhook': 'GANYMEDE',
  'stripe': 'GANYMEDE',
  'doc': 'CALLISTO',
  'readme': 'CALLISTO',
  'documentation': 'CALLISTO',
  'performance': 'IO',
  'optimize': 'IO',
  'cache': 'IO',
  'resilience': 'MIMAS',
  'retry': 'MIMAS',
  'circuit': 'MIMAS',
  'analytics': 'NEPTUNE',
  'metrics': 'NEPTUNE',
  'dashboard': 'NEPTUNE',
};

/**
 * Get keyword match score between task description and agent
 * Returns score 0-30 based on keyword matches
 */
export function getKeywordMatchScore(taskDescription: string, agent: string): number {
  const normalizedDesc = taskDescription.toLowerCase();
  const keywords = AGENT_KEYWORDS[agent] || [];
  
  let matches = 0;
  for (const keyword of keywords) {
    if (normalizedDesc.includes(keyword.toLowerCase())) {
      matches++;
    }
  }
  
  // Cap at 30 points, with diminishing returns
  // 1 match = 10 points, 2 = 20, 3+ = 30
  return Math.min(30, matches * 10);
}

/**
 * Fallback to default agent based on task type keywords
 */
export function fallbackToDefaultAgent(taskType: string): string {
  const normalized = taskType.toLowerCase();
  
  // Check for keyword matches in fallback map
  for (const [keyword, agent] of Object.entries(FALLBACK_KEYWORD_MAP)) {
    if (normalized.includes(keyword)) {
      return agent;
    }
  }
  
  // Default to MARS for general backend tasks
  return 'MARS';
}

/**
 * Calculate recency penalty for agents with recent failures
 * Checks if agent has any failed tasks in recent history
 */
function calculateRecencyPenalty(stats: AgentStats): number {
  // If agent has low success rate, apply penalty
  if (stats.successRate < 0.5 && stats.totalTasks > 0) {
    return -20;
  }
  if (stats.successRate < 0.7 && stats.totalTasks > 5) {
    return -10;
  }
  return 0;
}

/**
 * Calculate duration bonus (faster agents score higher)
 * Returns 0-15 points based on duration percentile
 */
function calculateDurationBonus(allStats: AgentStats[], agentDuration: number): number {
  if (allStats.length === 0 || agentDuration === 0) {
    return 0;
  }
  
  // Get all durations
  const durations = allStats
    .map(s => s.avgDuration)
    .filter(d => d > 0)
    .sort((a, b) => a - b);
  
  if (durations.length === 0) {
    return 0;
  }
  
  // Find percentile (lower is better)
  const position = durations.indexOf(agentDuration);
  const percentile = position / durations.length;
  
  // Top 25% get 15 points, next 25% get 10, next 25% get 5, rest get 0
  if (percentile <= 0.25) return 15;
  if (percentile <= 0.5) return 10;
  if (percentile <= 0.75) return 5;
  return 0;
}

/**
 * Score all agents for a given task
 */
export async function scoreAgentsForTask(
  criteria: AgentSelectionCriteria
): Promise<AgentScore[]> {
  const { taskDescription, excludeAgents = [], minSuccessRate = 0 } = criteria;
  
  // Get all agent stats from analytics
  const allStats = getAllAgentStats();
  
  // If no analytics data, return empty array (will trigger fallback)
  if (allStats.length === 0) {
    return [];
  }
  
  const scores: AgentScore[] = [];
  
  for (const stats of allStats) {
    // Skip excluded agents
    if (excludeAgents.includes(stats.agent)) {
      continue;
    }
    
    // Skip agents below minSuccessRate
    if (stats.successRate < minSuccessRate) {
      continue;
    }
    
    // Base score from success rate (0-100)
    const baseScore = stats.successRate * 100;
    
    // Keyword matching bonus (0-30)
    const keywordBonus = getKeywordMatchScore(taskDescription, stats.agent);
    
    // Recency penalty for agents with recent failures
    const recencyPenalty = calculateRecencyPenalty(stats);
    
    // Duration bonus for faster agents (0-15)
    const durationBonus = calculateDurationBonus(allStats, stats.avgDuration);
    
    // Calculate total score
    const totalScore = baseScore + keywordBonus + recencyPenalty + durationBonus;
    
    // Build reasoning string
    const reasoningParts: string[] = [];
    reasoningParts.push(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    if (keywordBonus > 0) {
      reasoningParts.push(`Keyword match: +${keywordBonus}`);
    }
    if (recencyPenalty < 0) {
      reasoningParts.push(`Recent failures: ${recencyPenalty}`);
    }
    if (durationBonus > 0) {
      reasoningParts.push(`Speed bonus: +${durationBonus}`);
    }
    
    scores.push({
      agent: stats.agent,
      score: Math.max(0, totalScore),
      successRate: stats.successRate,
      avgDuration: stats.avgDuration,
      gatePassRate: stats.gatePassRate,
      reasoning: reasoningParts.join(', '),
    });
  }
  
  // Sort by score descending
  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Calculate confidence level based on scores and data quality
 */
function calculateConfidence(
  topScore: AgentScore | undefined,
  _allScores: AgentScore[],
  hasPreferredMatch: boolean
): 'high' | 'medium' | 'low' {
  if (!topScore) {
    return 'low';
  }
  
  // High confidence if:
  // 1. Score is above 80
  // 2. Success rate is above 80%
  // 3. Significant gap to second place
  // 4. Has keyword match
  if (topScore.score >= 80 && 
      topScore.successRate >= 0.8 &&
      hasPreferredMatch) {
    return 'high';
  }
  
  // Medium confidence if score is decent
  if (topScore.score >= 50 || topScore.successRate >= 0.6) {
    return 'medium';
  }
  
  // Low confidence for everything else
  return 'low';
}

/**
 * Select the best agent for a task
 */
export async function selectBestAgent(
  criteria: AgentSelectionCriteria
): Promise<SelectionResult> {
  const { taskDescription, preferredAgents = [], taskType } = criteria;
  
  // Score all agents
  const scores = await scoreAgentsForTask(criteria);
  
  // If no scores from analytics, use fallback
  if (scores.length === 0) {
    const fallbackAgent = taskType 
      ? fallbackToDefaultAgent(taskType)
      : fallbackToDefaultAgent(taskDescription);
    
    return {
      selectedAgent: fallbackAgent,
      scores: [],
      confidence: 'low',
      reasoning: `No analytics data available. Selected ${fallbackAgent} based on task type fallback.`,
    };
  }
  
  // Check if any preferred agents are in the scored list
  let selectedAgent = scores[0];
  let hasPreferredMatch = false;
  
  for (const preferred of preferredAgents) {
    const preferredScore = scores.find(s => s.agent === preferred);
    if (preferredScore && preferredScore.score >= scores[0].score * 0.8) {
      // Preferred agent is within 80% of top score
      selectedAgent = preferredScore;
      hasPreferredMatch = true;
      break;
    }
  }
  
  // Calculate confidence
  const confidence = calculateConfidence(selectedAgent, scores, hasPreferredMatch);
  
  // Build reasoning
  let reasoning: string;
  if (hasPreferredMatch) {
    reasoning = `Selected ${selectedAgent.agent} from preferred agents list with strong performance match.`;
  } else if (selectedAgent.score >= 80) {
    reasoning = `${selectedAgent.agent} has excellent historical performance for this task type.`;
  } else if (selectedAgent.score >= 50) {
    reasoning = `${selectedAgent.agent} has moderate performance. Consider reviewing agent assignment.`;
  } else {
    reasoning = `${selectedAgent.agent} selected but has limited data. Confidence is low.`;
  }
  
  return {
    selectedAgent: selectedAgent.agent,
    scores,
    confidence,
    reasoning,
  };
}

/**
 * Format selection result for display
 */
export function formatSelectionResult(result: SelectionResult): string {
  const lines: string[] = [
    '🤖 Agent Selection Result',
    '═══════════════════════════════════════════════════',
    '',
  ];
  
  // Selected agent
  const confidenceEmoji = {
    'high': '✅',
    'medium': '⚠️',
    'low': '❓',
  }[result.confidence];
  
  lines.push(`Selected: ${result.selectedAgent} ${confidenceEmoji} (${result.confidence} confidence)`);
  lines.push(`Reason: ${result.reasoning}`);
  lines.push('');
  
  // Score breakdown
  if (result.scores.length > 0) {
    lines.push('Score Breakdown:');
    lines.push('Rank │ Agent      │ Score │ Success% │ Duration │ Gate Pass%');
    lines.push('─────┼────────────┼───────┼──────────┼──────────┼───────────');
    
    for (let i = 0; i < Math.min(5, result.scores.length); i++) {
      const s = result.scores[i];
      const rank = (i + 1).toString().padStart(2);
      const agent = s.agent.padEnd(10);
      const score = s.score.toFixed(1).padStart(5);
      const success = `${(s.successRate * 100).toFixed(1)}%`.padStart(8);
      const duration = `${s.avgDuration}ms`.padStart(8);
      const gatePass = `${(s.gatePassRate * 100).toFixed(1)}%`.padStart(9);
      
      lines.push(` ${rank}  │ ${agent} │ ${score} │ ${success} │ ${duration} │ ${gatePass}`);
    }
    
    if (result.scores.length > 5) {
      lines.push(`     │ ...        │       │          │          │           (${result.scores.length - 5} more)`);
    }
  } else {
    lines.push('No analytics data available for scoring.');
  }
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════');
  
  return lines.join('\n');
}
