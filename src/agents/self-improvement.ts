// KIMI-ACE-04: Agent Self-Improvement Protocol
// Tracks agent performance and automatically improves playbooks

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import {
  type PlaybookDelta,
  getPlaybookManager,
} from '../ace/playbook.js';
import { getAceCurator } from '../ace/curator.js';
import { getTasteVault } from '../taste-vault/taste-vault.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentPerformanceProfile {
  agentName: string;
  totalTasks: number;
  successRate: number;
  avgGateScore: number;
  strongTaskTypes: string[];
  weakTaskTypes: string[];
  recentOutcomes: PerformanceOutcome[];
  lastReviewedAt: string;
  lastUpdated: string;
  pendingDeltas?: PlaybookDelta[];
}

export interface PerformanceOutcome {
  taskId: string;
  taskTitle: string;
  taskType: string;
  success: boolean;
  gateScore?: number;
  appliedRuleIds: string[];
  timestamp: string;
}

export interface StyleAdaptation {
  preference: string;
  source: 'taste-vault' | 'self-observed';
  confidence: number;
  appliedCount: number;
}

// ============================================================================
// SelfImprovementProtocol Class
// ============================================================================

export class SelfImprovementProtocol {
  private profiles: Map<string, AgentPerformanceProfile> = new Map();

  /**
   * Record a task outcome and update the agent's profile
   */
  async recordOutcome(
    agentName: string,
    outcome: Omit<PerformanceOutcome, 'timestamp'>
  ): Promise<void> {
    const profile = await this.getProfile(agentName);

    // Create full outcome with timestamp
    const fullOutcome: PerformanceOutcome = {
      ...outcome,
      timestamp: new Date().toISOString(),
    };

    // Append to recentOutcomes, cap at 20
    profile.recentOutcomes.push(fullOutcome);
    if (profile.recentOutcomes.length > 20) {
      profile.recentOutcomes.shift(); // Drop oldest
    }

    // Recompute statistics
    this.recomputeStats(profile);

    // Update timestamps
    profile.lastUpdated = new Date().toISOString();

    // Persist profile
    await this.persist(agentName);
  }

  /**
   * Get or create a profile for an agent
   */
  async getProfile(agentName: string): Promise<AgentPerformanceProfile> {
    // Check in-memory cache first
    const cached = this.profiles.get(agentName);
    if (cached) {
      return cached;
    }

    // Try to load from disk
    const loaded = await this.load(agentName);
    if (loaded) {
      this.profiles.set(agentName, loaded);
      return loaded;
    }

    // Create default profile
    const defaultProfile: AgentPerformanceProfile = {
      agentName,
      totalTasks: 0,
      successRate: 0,
      avgGateScore: 0,
      strongTaskTypes: [],
      weakTaskTypes: [],
      recentOutcomes: [],
      lastReviewedAt: '',
      lastUpdated: new Date().toISOString(),
    };

    this.profiles.set(agentName, defaultProfile);
    return defaultProfile;
  }

  /**
   * Run a review cycle for an agent
   * Analyzes performance and creates playbook improvements
   */
  async runReview(agentName: string): Promise<{
    rulesAdded: number;
    rulesModified: number;
    reviewSummary: string;
  }> {
    const profile = await this.getProfile(agentName);

    // Preconditions check
    if (profile.totalTasks < 5) {
      return {
        rulesAdded: 0,
        rulesModified: 0,
        reviewSummary: `Review skipped: insufficient tasks (${profile.totalTasks}/5)`,
      };
    }

    // Check if reviewed recently (> 7 days ago)
    if (profile.lastReviewedAt) {
      const lastReviewed = new Date(profile.lastReviewedAt);
      const now = new Date();
      const daysSinceReview = (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceReview < 7) {
        return {
          rulesAdded: 0,
          rulesModified: 0,
          reviewSummary: `Review skipped: last review was ${daysSinceReview.toFixed(1)} days ago`,
        };
      }
    }

    // Get current playbook
    const playbookManager = getPlaybookManager();
    await playbookManager.getPlaybook(agentName);

    // Analyze task types
    const taskTypeStats = this.analyzeTaskTypes(profile);

    // Identify patterns
    const failingPatterns = taskTypeStats
      .filter(t => t.successRate < 0.5 && t.count >= 3)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 3);

    const succeedingPatterns = taskTypeStats
      .filter(t => t.successRate >= 0.8 && t.count >= 3)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3);

    // Create deltas
    const deltas: PlaybookDelta[] = [];

    // Mistake deltas for failing patterns
    for (const pattern of failingPatterns) {
      const delta: PlaybookDelta = {
        id: crypto.randomUUID(),
        action: 'add',
        content: `Improve ${pattern.taskType} tasks - current success rate: ${(pattern.successRate * 100).toFixed(1)}%`,
        type: 'Mistake',
        confidence: 0.75,
        helpfulDelta: 0,
        harmfulDelta: 0,
        isGlobalCandidate: false,
        reason: `Low success rate detected for ${pattern.taskType}`,
      };
      deltas.push(delta);
    }

    // Strategy deltas for succeeding patterns
    for (const pattern of succeedingPatterns) {
      const delta: PlaybookDelta = {
        id: crypto.randomUUID(),
        action: 'add',
        content: `Apply successful approach from ${pattern.taskType} tasks`,
        type: 'Strategy',
        confidence: Math.min(0.95, pattern.successRate),
        helpfulDelta: pattern.successCount,
        harmfulDelta: pattern.failureCount,
        isGlobalCandidate: pattern.successRate >= 0.9 && pattern.count >= 5,
        reason: `High success rate (${(pattern.successRate * 100).toFixed(1)}%) for ${pattern.taskType}`,
      };
      deltas.push(delta);
    }

    // Apply via AceCurator with guardrails
    let rulesAdded = 0;
    let rulesModified = 0;

    if (deltas.length > 0) {
      const curator = getAceCurator();
      const result = await curator.curate(deltas, agentName);

      rulesAdded = result.applied.filter(d => d.action === 'add').length;
      rulesModified = result.applied.filter(d => d.action === 'update').length;

      // Store any pending deltas in profile (those with confidence < 0.7 that weren't applied)
      const pendingDeltas = deltas.filter(d => d.confidence < 0.7);
      if (pendingDeltas.length > 0) {
        profile.pendingDeltas = [...(profile.pendingDeltas || []), ...pendingDeltas];
      }
    }

    // Sync with TasteVault for strong patterns
    const tasteVault = getTasteVault('system');
    for (const pattern of succeedingPatterns) {
      await tasteVault.learnFromBuildResult(
        `${agentName} - ${pattern.taskType} pattern`,
        `Successful pattern for ${pattern.taskType}`,
        `Success rate: ${(pattern.successRate * 100).toFixed(1)}%`,
        agentName,
        true
      );
    }

    // Update profile
    profile.strongTaskTypes = succeedingPatterns.map(p => p.taskType);
    profile.weakTaskTypes = failingPatterns.map(p => p.taskType);
    profile.lastReviewedAt = new Date().toISOString();
    profile.lastUpdated = new Date().toISOString();

    await this.persist(agentName);

    // Generate review summary
    const reviewSummary = this.generateReviewSummary(
      agentName,
      profile,
      failingPatterns,
      succeedingPatterns,
      rulesAdded,
      rulesModified
    );

    return {
      rulesAdded,
      rulesModified,
      reviewSummary,
    };
  }

  /**
   * Get style adaptations for an agent and user
   */
  async getStyleAdaptations(agentName: string, userId: string): Promise<StyleAdaptation[]> {
    const tasteVault = getTasteVault(userId);
    const profile = await this.getProfile(agentName);

    // Get relevant patterns from TasteVault
    const context = `${agentName.toLowerCase()} patterns`;
    const patterns = await tasteVault.getRelevantPatterns(context, 20);

    // Filter patterns that include agent name in tags
    const agentPatterns = patterns.filter(p =>
      p.tags.includes(agentName.toLowerCase())
    );

    // Convert to StyleAdaptation
    const adaptations: StyleAdaptation[] = agentPatterns.map(p => ({
      preference: p.content,
      source: 'taste-vault',
      confidence: p.confidence,
      appliedCount: p.helpfulCount,
    }));

    // Add self-observed adaptations from strong task types
    for (const taskType of profile.strongTaskTypes) {
      adaptations.push({
        preference: `Strong performance on ${taskType} tasks`,
        source: 'self-observed',
        confidence: 0.85,
        appliedCount: profile.totalTasks,
      });
    }

    // Sort by confidence descending
    adaptations.sort((a, b) => b.confidence - a.confidence);

    return adaptations;
  }

  /**
   * Persist profile to disk
   */
  async persist(agentName: string): Promise<void> {
    const profile = this.profiles.get(agentName);
    if (!profile) return;

    const path = this.getProfilePath(agentName);

    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(profile, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`[SelfImprovementProtocol] Failed to persist profile for ${agentName}:`, error);
    }
  }

  /**
   * Load profile from disk
   */
  async load(agentName: string): Promise<AgentPerformanceProfile | null> {
    const path = this.getProfilePath(agentName);

    if (!existsSync(path)) {
      return null;
    }

    try {
      const content = readFileSync(path, 'utf-8');
      const data = JSON.parse(content);
      return data as AgentPerformanceProfile;
    } catch (error) {
      console.warn(`[SelfImprovementProtocol] Failed to load profile for ${agentName}:`, error);
      return null;
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getProfilePath(agentName: string): string {
    return `.nova/ace/profiles/${agentName}.json`;
  }

  private recomputeStats(profile: AgentPerformanceProfile): void {
    const outcomes = profile.recentOutcomes;
    profile.totalTasks = outcomes.length;

    if (outcomes.length === 0) {
      profile.successRate = 0;
      profile.avgGateScore = 0;
      return;
    }

    // Compute success rate
    const successes = outcomes.filter(o => o.success).length;
    profile.successRate = successes / outcomes.length;

    // Compute average gate score
    const scores = outcomes
      .filter(o => o.gateScore !== undefined)
      .map(o => o.gateScore!);
    profile.avgGateScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  }

  private analyzeTaskTypes(profile: AgentPerformanceProfile): Array<{
    taskType: string;
    count: number;
    successRate: number;
    successCount: number;
    failureCount: number;
  }> {
    const stats = new Map<string, {
      count: number;
      successes: number;
      failures: number;
    }>();

    for (const outcome of profile.recentOutcomes) {
      const existing = stats.get(outcome.taskType) || { count: 0, successes: 0, failures: 0 };
      existing.count++;
      if (outcome.success) {
        existing.successes++;
      } else {
        existing.failures++;
      }
      stats.set(outcome.taskType, existing);
    }

    return Array.from(stats.entries()).map(([taskType, data]) => ({
      taskType,
      count: data.count,
      successRate: data.count > 0 ? data.successes / data.count : 0,
      successCount: data.successes,
      failureCount: data.failures,
    }));
  }

  private generateReviewSummary(
    agentName: string,
    profile: AgentPerformanceProfile,
    failingPatterns: Array<{ taskType: string; successRate: number }>,
    succeedingPatterns: Array<{ taskType: string; successRate: number }>,
    rulesAdded: number,
    rulesModified: number
  ): string {
    const parts: string[] = [];

    parts.push(`Review for ${agentName}:`);
    parts.push(`- Total tasks: ${profile.totalTasks}`);
    parts.push(`- Overall success rate: ${(profile.successRate * 100).toFixed(1)}%`);
    parts.push(`- Average gate score: ${profile.avgGateScore.toFixed(2)}`);

    if (failingPatterns.length > 0) {
      parts.push(`\nFailing patterns (needs improvement):`);
      for (const p of failingPatterns) {
        parts.push(`  - ${p.taskType}: ${(p.successRate * 100).toFixed(1)}%`);
      }
    }

    if (succeedingPatterns.length > 0) {
      parts.push(`\nSucceeding patterns (strategies captured):`);
      for (const p of succeedingPatterns) {
        parts.push(`  - ${p.taskType}: ${(p.successRate * 100).toFixed(1)}%`);
      }
    }

    parts.push(`\nChanges applied: ${rulesAdded} added, ${rulesModified} modified`);

    return parts.join('\n');
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let protocolInstance: SelfImprovementProtocol | null = null;

export function getSelfImprovementProtocol(): SelfImprovementProtocol {
  if (!protocolInstance) {
    protocolInstance = new SelfImprovementProtocol();
  }
  return protocolInstance;
}

export function resetSelfImprovementProtocol(): void {
  protocolInstance = null;
}
