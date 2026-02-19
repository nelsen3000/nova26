// Explanation Engine — R21-03
// Generate explanations for AI decisions

import type { ExplanationRequest, ExplanationResponse, AIDecisionLog, AgentTrajectory } from './types.js';
import type { TrajectoryRecorder } from './trajectory-recorder.js';

export class ExplanationEngine {
  private trajectoryRecorder: TrajectoryRecorder;

  constructor(trajectoryRecorder: TrajectoryRecorder) {
    this.trajectoryRecorder = trajectoryRecorder;
  }

  /**
   * Generate an explanation for a decision
   */
  generateExplanation(
    request: ExplanationRequest,
    decisionLog: AIDecisionLog
  ): ExplanationResponse {
    const trajectory = this.trajectoryRecorder.getTrajectory(decisionLog.trajectoryId);
    
    const narrative = this.buildNarrative(decisionLog, trajectory, request.depth);
    const tasteVaultFactors = this.extractTasteVaultFactors(trajectory);

    return {
      decisionLogId: decisionLog.id,
      narrative,
      trajectorySteps: trajectory?.steps ?? [],
      tasteVaultFactors,
      complianceScore: trajectory?.complianceScore ?? 0,
    };
  }

  /**
   * Build narrative explanation
   */
  private buildNarrative(
    decisionLog: AIDecisionLog,
    trajectory: AgentTrajectory | undefined,
    depth: ExplanationRequest['depth']
  ): string {
    const parts: string[] = [];

    // Summary always included
    parts.push(`Decision: ${decisionLog.decisionType}`);
    parts.push(`Made by: ${decisionLog.agentId}`);
    parts.push(`Risk Level: ${decisionLog.riskLevel}`);
    parts.push('');

    // Reasoning
    parts.push('Reasoning:');
    parts.push(decisionLog.reasoning);
    parts.push('');

    if (depth === 'detailed' || depth === 'technical') {
      if (trajectory) {
        parts.push(`This decision was part of a larger workflow to: ${trajectory.rootIntent}`);
        parts.push(`Step ${trajectory.steps.findIndex(s => s.decisionLogId === decisionLog.id) + 1} of ${trajectory.steps.length}`);
        parts.push('');
      }
    }

    if (depth === 'technical') {
      parts.push('Technical Details:');
      parts.push(`- Input: ${decisionLog.inputSummary.substring(0, 100)}...`);
      parts.push(`- Output: ${decisionLog.outputSummary.substring(0, 100)}...`);
      parts.push(`- Trajectory ID: ${decisionLog.trajectoryId}`);
      parts.push(`- Compliance Tags: ${decisionLog.complianceTags.join(', ')}`);
      parts.push('');
    }

    // Compliance info
    parts.push('Compliance:');
    if (trajectory) {
      parts.push(`This workflow achieved a compliance score of ${trajectory.complianceScore}/100.`);
    }
    parts.push(`This decision is tagged for: ${decisionLog.complianceTags.join(', ')}.`);

    return parts.join('\n');
  }

  /**
   * Extract taste vault factors from trajectory
   */
  private extractTasteVaultFactors(trajectory: AgentTrajectory | undefined): string[] {
    if (!trajectory) return [];

    const factors: string[] = [];
    
    // Analyze taste vault influence across steps
    const influences = trajectory.steps.map(s => s.tasteVaultInfluence);
    const avgInfluence = influences.reduce((a, b) => a + b, 0) / influences.length;

    if (avgInfluence > 0.8) {
      factors.push('Strong Taste Vault alignment (>80%)');
    } else if (avgInfluence > 0.5) {
      factors.push('Moderate Taste Vault alignment (50-80%)');
    } else {
      factors.push('Low Taste Vault alignment (<50%)');
    }

    // Identify agents with highest influence
    const agentInfluences = new Map<string, number[]>();
    for (const step of trajectory.steps) {
      const list = agentInfluences.get(step.agent) ?? [];
      list.push(step.tasteVaultInfluence);
      agentInfluences.set(step.agent, list);
    }

    // Find agent with highest average influence
    let highestAgent = '';
    let highestAvg = 0;
    for (const [agent, values] of agentInfluences) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      if (avg > highestAvg) {
        highestAvg = avg;
        highestAgent = agent;
      }
    }

    if (highestAgent) {
      factors.push(`${highestAgent} showed strongest Taste Vault alignment (${Math.round(highestAvg * 100)}%)`);
    }

    return factors;
  }

  /**
   * Explain a trajectory
   */
  explainTrajectory(trajectoryId: string): string {
    const trajectory = this.trajectoryRecorder.getTrajectory(trajectoryId);
    if (!trajectory) {
      throw new Error(`Trajectory not found: ${trajectoryId}`);
    }

    const lines: string[] = [
      '=== Workflow Explanation ===',
      '',
      `Objective: ${trajectory.rootIntent}`,
      `Total Steps: ${trajectory.steps.length}`,
      `Duration: ${trajectory.totalDurationMs}ms`,
      `Compliance Score: ${trajectory.complianceScore}/100`,
      '',
      'Agent Involvement:',
    ];

    const agentCounts = new Map<string, number>();
    for (const step of trajectory.steps) {
      agentCounts.set(step.agent, (agentCounts.get(step.agent) ?? 0) + 1);
    }

    for (const [agent, count] of agentCounts) {
      lines.push(`- ${agent}: ${count} step${count > 1 ? 's' : ''}`);
    }

    lines.push('');
    lines.push('Outcome:');
    lines.push(trajectory.finalOutcome);

    return lines.join('\n');
  }
}

export function createExplanationEngine(trajectoryRecorder: TrajectoryRecorder): ExplanationEngine {
  return new ExplanationEngine(trajectoryRecorder);
}
