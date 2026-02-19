// KIMI-ACE-03: Rehearsal Stage - Main Orchestration
// Coordinates branch generation, scoring, and winner selection

import type { Task } from '../types/index.js';
import { getConfigUncached } from '../config/config.js';
import {
  BranchManager,
  getBranchManager,
  resetBranchManager,
  type RehearsalBranch,
  type BranchStrategy,
} from './branch-manager.js';
import {
  RehearsalScorer,
  getRehearsalScorer,
  resetRehearsalScorer,
  type RehearsalResult,
} from './scorer.js';

// Re-export RehearsalResult for consumers
export type { RehearsalResult } from './scorer.js';

// ============================================================================
// Types
// ============================================================================

export interface RehearsalOptions {
  branchCount?: number; // default 2, max 3
  strategyHint?: BranchStrategy;
  forceRehearse?: boolean;
}

export interface RehearsalSession {
  id: string;
  taskId: string;
  agentName: string;
  branches: RehearsalBranch[];
  results: RehearsalResult[];
  winner?: string;
  userApproved?: boolean;
  createdAt: string;
  completedAt?: string;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<RehearsalOptions> = {
  branchCount: 2,
  strategyHint: 'in-memory',
  forceRehearse: false,
};

// ============================================================================
// Rehearsal Stage Class
// ============================================================================

export class RehearsalStage {
  private branchManager: BranchManager;
  private scorer: RehearsalScorer;

  constructor() {
    this.branchManager = getBranchManager();
    this.scorer = getRehearsalScorer();
  }

  /**
   * Main rehearsal orchestration method
   * 1. Verify NOVA26_TIER === 'premium', else throw
   * 2. Check shouldRehearse(task) || forceRehearse, else throw
   * 3. Generate branches via BranchManager
   * 4. Score each branch via RehearsalScorer
   * 5. Select winner (highest compositeScore)
   * 6. Build RehearsalSession, log summary, return session
   */
  async rehearse(
    task: Task,
    agentName: string,
    options: RehearsalOptions = {}
  ): Promise<RehearsalSession> {
    // Merge with defaults
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 1. Verify premium tier
    this.verifyPremiumTier();

    // 2. Check if rehearsal is needed
    if (!this.shouldRehearse(task) && !opts.forceRehearse) {
      throw new Error(
        `Task does not meet rehearsal criteria. ` +
        `Use forceRehearse: true to override.`
      );
    }

    // 3. Generate branches
    const effectiveBranchCount = Math.min(opts.branchCount, 3);
    const branches = await this.branchManager.createBranches(
      task,
      agentName,
      effectiveBranchCount
    );

    // 4. Score each branch
    const results: RehearsalResult[] = [];
    for (const branch of branches) {
      const result = await this.scorer.score(branch);
      results.push(result);
    }

    // 5. Select winner (highest compositeScore)
    const winner = this.selectWinner(results);

    // Update branch statuses
    if (winner) {
      const winningBranch = branches.find(b => b.id === winner.branchId);
      if (winningBranch) {
        winningBranch.status = 'executed';
      }
    }

    // Cleanup non-winner branches
    this.branchManager.cleanupBranches(branches, winner?.branchId);

    // 6. Build and return session
    const session: RehearsalSession = {
      id: this.generateSessionId(task.id),
      taskId: task.id,
      agentName,
      branches,
      results,
      winner: winner?.branchId,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    // Log summary
    console.log(this.formatSummary(session));

    return session;
  }

  /**
   * Verify that NOVA26_TIER is set to 'paid' (premium tier)
   * Throws error if not paid tier
   */
  private verifyPremiumTier(): void {
    // Use uncached config to ensure environment variable changes are picked up
    const config = getConfigUncached();
    const tier = config.models.tier;

    // 'paid' tier is the premium tier for rehearsal
    if (tier !== 'paid') {
      throw new Error(
        `Rehearsal stage requires premium tier. ` +
        `Current tier: ${tier}. ` +
        `Set NOVA26_TIER=paid to enable.`
      );
    }
  }

  /**
   * Determine if a task should be rehearsed
   * Returns true if: complexity > 0.7, or description contains 'schema'/'migration'/'rehearse'
   */
  shouldRehearse(task: Task): boolean {
    const description = task.description.toLowerCase();
    const title = task.title.toLowerCase();

    // Check for keywords that indicate complexity
    const complexityKeywords = ['schema', 'migration', 'rehearse', 'architecture', 'refactor'];
    for (const keyword of complexityKeywords) {
      if (description.includes(keyword) || title.includes(keyword)) {
        return true;
      }
    }

    // Check context for complexity score if available
    if (task.context?.complexity !== undefined) {
      const complexity = task.context.complexity as number;
      if (complexity > 0.7) {
        return true;
      }
    }

    // Check for multiple dependencies (indicates complex task)
    if (task.dependencies.length > 2) {
      return true;
    }

    // Check if task has failed multiple times (needs careful approach)
    if (task.attempts > 1) {
      return true;
    }

    return false;
  }

  /**
   * Select the winner branch based on highest composite score
   * Returns the winning result or undefined if no results
   */
  private selectWinner(results: RehearsalResult[]): RehearsalResult | undefined {
    if (results.length === 0) {
      return undefined;
    }

    // Sort by score descending
    const sorted = [...results].sort((a, b) => b.score - a.score);
    return sorted[0];
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(taskId: string): string {
    const timestamp = Date.now();
    return `rehearsal-${taskId}-${timestamp}`;
  }

  /**
   * Format a human-readable summary of the rehearsal session
   */
  formatSummary(session: RehearsalSession): string {
    const lines: string[] = [
      '🎭 Rehearsal Session Summary',
      '═══════════════════════════════════════════════════',
      '',
      `Session ID: ${session.id}`,
      `Task: ${session.taskId}`,
      `Agent: ${session.agentName}`,
      `Created: ${new Date(session.createdAt).toLocaleString()}`,
      '',
      `Branches Generated: ${session.branches.length}`,
      '',
    ];

    // Show all branch scores
    if (session.results.length > 0) {
      lines.push('Branch Scores:');
      lines.push('Rank │ Branch ID                    │ Score │ Quality │ Type │ Delta │ Taste');
      lines.push('─────┼──────────────────────────────┼───────┼─────────┼──────┼───────┼──────');

      const sorted = [...session.results].sort((a, b) => b.score - a.score);
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        const isWinner = r.branchId === session.winner;
        const rank = (i + 1).toString().padStart(2);
        const branchId = r.branchId.slice(0, 28).padEnd(28);
        const score = (r.score * 100).toFixed(0).padStart(3) + '%';
        const quality = r.estimatedQuality.padStart(7);
        const type = (r.scoreBreakdown.typeCheckPass * 100).toFixed(0).padStart(3) + '%';
        const delta = (r.scoreBreakdown.lineDelta * 100).toFixed(0).padStart(3) + '%';
        const taste = (r.tasteAlignment * 100).toFixed(0).padStart(3) + '%';
        const marker = isWinner ? ' 🏆' : '';

        lines.push(` ${rank}  │ ${branchId} │ ${score} │ ${quality} │ ${type} │ ${delta} │ ${taste}${marker}`);
      }

      lines.push('');
    }

    // Winner section
    if (session.winner) {
      const winnerResult = session.results.find(r => r.branchId === session.winner);
      if (winnerResult) {
        lines.push('🏆 Winner:');
        lines.push(`   Branch: ${session.winner}`);
        lines.push(`   Score: ${(winnerResult.score * 100).toFixed(1)}%`);
        lines.push(`   Quality: ${winnerResult.estimatedQuality.toUpperCase()}`);
        lines.push('');
        lines.push('   Score Breakdown:');
        lines.push(`     Type Safety: ${(winnerResult.scoreBreakdown.typeCheckPass * 100).toFixed(0)}%`);
        lines.push(`     Line Delta: ${(winnerResult.scoreBreakdown.lineDelta * 100).toFixed(0)}%`);
        lines.push(`     Agent Confidence: ${(winnerResult.scoreBreakdown.agentSelfAssessment * 100).toFixed(0)}%`);
        lines.push(`     Taste Alignment: ${(winnerResult.scoreBreakdown.tasteAlignment * 100).toFixed(0)}%`);
        lines.push('');
        lines.push(`   ${winnerResult.summary}`);
        lines.push('');
        lines.push('   Preview:');
        const previewLines = winnerResult.previewSnippet.split('\n').slice(0, 5);
        for (const line of previewLines) {
          lines.push(`     ${line.substring(0, 60)}${line.length > 60 ? '...' : ''}`);
        }
        if (winnerResult.previewSnippet.split('\n').length > 5) {
          lines.push('     ...');
        }
      }
    } else {
      lines.push('⚠️ No winner selected');
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════');

    return lines.join('\n');
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let stageInstance: RehearsalStage | null = null;

export function getRehearsalStage(): RehearsalStage {
  if (!stageInstance) {
    stageInstance = new RehearsalStage();
  }
  return stageInstance;
}

export function resetRehearsalStage(): void {
  stageInstance = null;
  resetBranchManager();
  resetRehearsalScorer();
}
