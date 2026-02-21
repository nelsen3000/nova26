// Swarm Debate - Multi-agent critique and consensus mechanism
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import type { GoalGenome, SwarmDebateResult, SwarmCritique } from './types.js';
import { SwarmDebateResultSchema } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface SwarmDebateConfig {
  minParticipants: number;
  maxParticipants: number;
  consensusThreshold: number;
  rejectionThreshold: number;
  timeoutMs: number;
}

export const DEFAULT_CONFIG: SwarmDebateConfig = {
  minParticipants: 3,
  maxParticipants: 7,
  consensusThreshold: 0.7,
  rejectionThreshold: 0.3,
  timeoutMs: 30000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Participant Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface DebateParticipant {
  id: string;
  critique(candidate: GoalGenome): Promise<SwarmCritique>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Swarm Debate Execution
// ═══════════════════════════════════════════════════════════════════════════════

export async function conductDebate(
  candidate: GoalGenome,
  participants: DebateParticipant[],
  config: Partial<SwarmDebateConfig> = {}
): Promise<SwarmDebateResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate participant count
  if (participants.length < fullConfig.minParticipants) {
    // Insufficient participants - return neutral result
    return createNeutralResult(candidate.id, 'Insufficient participants');
  }

  // Limit participants
  const selectedParticipants = participants.slice(0, fullConfig.maxParticipants);

  // Collect critiques with timeout
  const critiques: SwarmCritique[] = [];
  const startTime = Date.now();

  for (const participant of selectedParticipants) {
    const remainingTime = fullConfig.timeoutMs - (Date.now() - startTime);
    if (remainingTime <= 0) {
      break;
    }

    try {
      const critique = await Promise.race([
        participant.critique(candidate),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), remainingTime)
        ),
      ]);
      critiques.push(critique);
    } catch (error) {
      // Participant failed or timed out - add neutral critique
      critiques.push({
        agentId: participant.id,
        score: 0.5,
        feedback: 'No response',
      });
    }
  }

  // Calculate consensus score
  const consensusScore = calculateConsensusScore(critiques);

  // Check for unanimous rejection
  const unanimousRejection =
    critiques.length > 0 &&
    critiques.every(c => c.score < fullConfig.rejectionThreshold);

  const result: SwarmDebateResult = {
    candidateId: candidate.id,
    consensusScore,
    critiques,
    unanimousRejection,
  };

  return SwarmDebateResultSchema.parse(result);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Batch Debate for Multiple Candidates
// ═══════════════════════════════════════════════════════════════════════════════

export async function conductBatchDebate(
  candidates: GoalGenome[],
  participants: DebateParticipant[],
  config: Partial<SwarmDebateConfig> = {}
): Promise<SwarmDebateResult[]> {
  const results: SwarmDebateResult[] = [];

  for (const candidate of candidates) {
    const result = await conductDebate(candidate, participants, config);
    results.push(result);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Consensus Calculation
// ═══════════════════════════════════════════════════════════════════════════════

function calculateConsensusScore(critiques: SwarmCritique[]): number {
  if (critiques.length === 0) {
    return 0.5; // Neutral if no critiques
  }

  // Weight by agreement with median
  const scores = critiques.map(c => c.score).sort((a, b) => a - b);
  const median = scores[Math.floor(scores.length / 2)];

  // Calculate variance from median
  const deviations = scores.map(s => Math.abs(s - median));
  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;

  // High consensus = low deviation
  const consensusScore = Math.max(0, 1 - avgDeviation);

  return consensusScore;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Score Incorporation
// ═══════════════════════════════════════════════════════════════════════════════

export interface FitnessWithDebate {
  baseFitness: number;
  debateScore: number;
  finalFitness: number;
}

export function incorporateDebateScore(
  baseFitness: number,
  debateResult: SwarmDebateResult,
  debateWeight: number = 0.3
): FitnessWithDebate {
  // Use average critique score as debate contribution
  const avgCritiqueScore =
    debateResult.critiques.reduce((sum, c) => sum + c.score, 0) /
    debateResult.critiques.length;

  // Penalize unanimous rejection heavily
  if (debateResult.unanimousRejection) {
    const finalFitness = baseFitness * 0.1; // 90% penalty
    return {
      baseFitness,
      debateScore: avgCritiqueScore,
      finalFitness,
    };
  }

  // Weighted combination
  const debateScore = debateResult.consensusScore * avgCritiqueScore;
  const finalFitness =
    baseFitness * (1 - debateWeight) + debateScore * debateWeight;

  return {
    baseFitness,
    debateScore,
    finalFitness,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Participants (for testing)
// ═══════════════════════════════════════════════════════════════════════════════

export function createMockParticipant(
  id: string,
  bias: number = 0.5
): DebateParticipant {
  return {
    id,
    async critique(candidate): Promise<SwarmCritique> {
      // Simulate evaluation time
      await new Promise(r => setTimeout(r, 10));

      // Generate score around bias with some variance
      const variance = (Math.random() - 0.5) * 0.4;
      const score = Math.max(0, Math.min(1, bias + variance));

      let feedback: string;
      if (score > 0.7) {
        feedback = 'Strong candidate with clear objectives';
      } else if (score > 0.4) {
        feedback = 'Acceptable candidate with minor concerns';
      } else {
        feedback = 'Weak candidate - needs improvement';
      }

      return {
        agentId: id,
        score,
        feedback,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function createNeutralResult(
  candidateId: string,
  reason: string
): SwarmDebateResult {
  return {
    candidateId,
    consensusScore: 0.5,
    critiques: [
      {
        agentId: 'system',
        score: 0.5,
        feedback: reason,
      },
    ],
    unanimousRejection: false,
  };
}
