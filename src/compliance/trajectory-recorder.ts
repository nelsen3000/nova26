// Trajectory Recorder — R21-03
// Agent trajectory recording and replay

import type { AgentTrajectory } from './types.js';

export class TrajectoryRecorder {
  private activeTrajectories: Map<string, AgentTrajectory> = new Map();
  private completedTrajectories: Map<string, AgentTrajectory> = new Map();

  /**
   * Start a new trajectory
   */
  startTrajectory(rootIntent: string): string {
    const id = this.generateId();
    const trajectory: AgentTrajectory = {
      id,
      rootIntent,
      steps: [],
      finalOutcome: '',
      totalDurationMs: 0,
      complianceScore: 0,
    };

    this.activeTrajectories.set(id, trajectory);
    return id;
  }

  /**
   * Record a step in the trajectory
   */
  recordStep(
    trajectoryId: string,
    agent: string,
    action: string,
    decisionLogId: string,
    tokensUsed: number,
    tasteVaultInfluence: number
  ): void {
    const trajectory = this.activeTrajectories.get(trajectoryId);
    if (!trajectory) {
      throw new Error(`Trajectory not found: ${trajectoryId}`);
    }

    trajectory.steps.push({
      agent,
      action,
      decisionLogId,
      tokensUsed,
      tasteVaultInfluence,
      timestamp: Date.now(),
    });
  }

  /**
   * Complete a trajectory
   */
  completeTrajectory(trajectoryId: string, finalOutcome: string): AgentTrajectory {
    const trajectory = this.activeTrajectories.get(trajectoryId);
    if (!trajectory) {
      throw new Error(`Trajectory not found: ${trajectoryId}`);
    }

    // Calculate duration
    if (trajectory.steps.length > 0) {
      const startTime = trajectory.steps[0].timestamp;
      const endTime = trajectory.steps[trajectory.steps.length - 1].timestamp;
      trajectory.totalDurationMs = endTime - startTime;
    }

    // Calculate compliance score
    trajectory.complianceScore = this.calculateComplianceScore(trajectory);
    trajectory.finalOutcome = finalOutcome;

    // Move to completed
    this.activeTrajectories.delete(trajectoryId);
    this.completedTrajectories.set(trajectoryId, trajectory);

    return trajectory;
  }

  /**
   * Get a trajectory
   */
  getTrajectory(trajectoryId: string): AgentTrajectory | undefined {
    return this.activeTrajectories.get(trajectoryId) || 
           this.completedTrajectories.get(trajectoryId);
  }

  /**
   * Replay a trajectory step by step
   */
  async *replayTrajectory(trajectoryId: string): AsyncGenerator<AgentTrajectory['steps'][0], void, unknown> {
    const trajectory = this.getTrajectory(trajectoryId);
    if (!trajectory) {
      throw new Error(`Trajectory not found: ${trajectoryId}`);
    }

    for (const step of trajectory.steps) {
      yield step;
    }
  }

  /**
   * Get trajectory as narrative
   */
  getNarrative(trajectoryId: string): string {
    const trajectory = this.getTrajectory(trajectoryId);
    if (!trajectory) {
      throw new Error(`Trajectory not found: ${trajectoryId}`);
    }

    const lines: string[] = [
      `Trajectory: ${trajectory.id}`,
      `Intent: ${trajectory.rootIntent}`,
      `Outcome: ${trajectory.finalOutcome}`,
      `Duration: ${trajectory.totalDurationMs}ms`,
      `Compliance Score: ${trajectory.complianceScore}/100`,
      '',
      'Steps:',
    ];

    for (let i = 0; i < trajectory.steps.length; i++) {
      const step = trajectory.steps[i];
      lines.push(`${i + 1}. ${step.agent}: ${step.action}`);
      lines.push(`   Tokens: ${step.tokensUsed}, Taste Vault: ${step.tasteVaultInfluence}%`);
    }

    return lines.join('\n');
  }

  /**
   * List all trajectories
   */
  listTrajectories(): { active: string[]; completed: string[] } {
    return {
      active: Array.from(this.activeTrajectories.keys()),
      completed: Array.from(this.completedTrajectories.keys()),
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTrajectories: number;
    activeCount: number;
    completedCount: number;
    averageSteps: number;
    averageDuration: number;
  } {
    const allTrajectories = [
      ...this.activeTrajectories.values(),
      ...this.completedTrajectories.values(),
    ];

    const totalSteps = allTrajectories.reduce((sum, t) => sum + t.steps.length, 0);
    const totalDuration = allTrajectories.reduce((sum, t) => sum + t.totalDurationMs, 0);

    return {
      totalTrajectories: allTrajectories.length,
      activeCount: this.activeTrajectories.size,
      completedCount: this.completedTrajectories.size,
      averageSteps: allTrajectories.length > 0 ? totalSteps / allTrajectories.length : 0,
      averageDuration: allTrajectories.length > 0 ? totalDuration / allTrajectories.length : 0,
    };
  }

  /**
   * Clear all trajectories (for testing)
   */
  clear(): void {
    this.activeTrajectories.clear();
    this.completedTrajectories.clear();
  }

  private generateId(): string {
    return `traj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateComplianceScore(trajectory: AgentTrajectory): number {
    // Base score
    let score = 100;

    // Deduct for long trajectories (potential complexity risk)
    if (trajectory.steps.length > 10) {
      score -= 5;
    }

    // Deduct for high token usage (potential over-generation)
    const totalTokens = trajectory.steps.reduce((sum, s) => sum + s.tokensUsed, 0);
    if (totalTokens > 10000) {
      score -= 5;
    }

    // Deduct for low taste vault influence (potential consistency issues)
    const avgInfluence = trajectory.steps.reduce((sum, s) => sum + s.tasteVaultInfluence, 0) / 
                        trajectory.steps.length;
    if (avgInfluence < 0.5) {
      score -= 10;
    }

    return Math.max(0, score);
  }
}

export function createTrajectoryRecorder(): TrajectoryRecorder {
  return new TrajectoryRecorder();
}
