// Fitness Evaluator - Multi-signal fitness scoring and tournament selection
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import type {
  GoalGenome,
  FitnessScore,
  InnerLoopResult,
  TastePattern,
} from './types.js';
import { FitnessScoreSchema } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface FitnessEvaluatorConfig {
  performanceWeight: number;
  noveltyWeight: number;
  tasteWeight: number;
  tournamentSize: number;
}

export const DEFAULT_CONFIG: FitnessEvaluatorConfig = {
  performanceWeight: 0.5,
  noveltyWeight: 0.3,
  tasteWeight: 0.2,
  tournamentSize: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Fitness Evaluation
// ═══════════════════════════════════════════════════════════════════════════════

export function evaluate(
  genome: GoalGenome,
  innerLoopResults: InnerLoopResult,
  population: GoalGenome[],
  tastePatterns: TastePattern[],
  config: Partial<FitnessEvaluatorConfig> = {}
): FitnessScore {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Performance score from task results
  const performanceScore = calculatePerformanceScore(innerLoopResults);

  // Novelty score based on distance from population
  const noveltyScore = calculateNoveltyScore(genome, population);

  // Taste alignment score
  const tasteAlignmentScore = calculateTasteAlignmentScore(genome, tastePatterns);

  // Weighted aggregate
  const aggregateScore =
    performanceScore * fullConfig.performanceWeight +
    noveltyScore * fullConfig.noveltyWeight +
    tasteAlignmentScore * fullConfig.tasteWeight;

  // Per-objective breakdown
  const breakdown: Record<string, number> = {};
  for (const result of innerLoopResults.taskResults) {
    const existing = breakdown[result.objectiveId] || [];
    breakdown[result.objectiveId] = existing.length
      ? (existing[0] + result.score) / 2
      : result.score;
  }

  const score: FitnessScore = {
    genomeId: genome.id,
    performanceScore,
    noveltyScore,
    tasteAlignmentScore,
    aggregateScore,
    breakdown,
  };

  return FitnessScoreSchema.parse(score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tournament Selection
// ═══════════════════════════════════════════════════════════════════════════════

export function tournamentSelect(
  candidates: Array<{ genome: GoalGenome; score: FitnessScore }>,
  tournamentSize: number,
  selectionCount: number,
  random: () => number = Math.random
): GoalGenome[] {
  if (candidates.length === 0) {
    return [];
  }

  const selected: GoalGenome[] = [];
  const candidatePool = [...candidates];

  for (let i = 0; i < selectionCount; i++) {
    // Randomly select tournament participants
    const tournament: Array<{ genome: GoalGenome; score: FitnessScore }> = [];
    const poolSize = Math.min(tournamentSize, candidatePool.length);

    for (let j = 0; j < poolSize; j++) {
      const randomIndex = Math.floor(random() * candidatePool.length);
      tournament.push(candidatePool[randomIndex]);
    }

    // Select winner (highest aggregate score)
    const winner = tournament.reduce((best, current) =>
      current.score.aggregateScore > best.score.aggregateScore ? current : best
    );

    selected.push(winner.genome);
  }

  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Score Calculation Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function calculatePerformanceScore(innerLoopResults: InnerLoopResult): number {
  if (innerLoopResults.taskResults.length === 0) {
    return 0;
  }

  // Average score weighted by task success
  let totalWeight = 0;
  let weightedSum = 0;

  for (const result of innerLoopResults.taskResults) {
    const weight = result.passed ? 1.5 : 1.0;
    totalWeight += weight;
    weightedSum += result.score * weight;
  }

  const avgScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Penalize partial results (budget exceeded)
  const partialPenalty = innerLoopResults.partial ? 0.8 : 1.0;

  return clamp(avgScore * partialPenalty, 0, 1);
}

function calculateNoveltyScore(genome: GoalGenome, population: GoalGenome[]): number {
  if (population.length <= 1) {
    return 1.0; // Max novelty if alone
  }

  // Calculate average distance from other genomes
  let totalDistance = 0;
  let comparisonCount = 0;

  for (const other of population) {
    if (other.id === genome.id) continue;

    const distance = calculateGenomeDistance(genome, other);
    totalDistance += distance;
    comparisonCount++;
  }

  const avgDistance = comparisonCount > 0 ? totalDistance / comparisonCount : 0;
  return clamp(avgDistance, 0, 1);
}

function calculateTasteAlignmentScore(
  genome: GoalGenome,
  tastePatterns: TastePattern[]
): number {
  if (tastePatterns.length === 0) {
    return 1.0; // Neutral if no patterns
  }

  let totalAlignment = 0;
  let activePatterns = 0;

  for (const pattern of tastePatterns) {
    if (!pattern.isActive) continue;

    // Check for conflicts with objectives
    let hasConflict = false;
    for (const objective of genome.objectives) {
      if (objective.description.toLowerCase().includes(pattern.canonicalContent.toLowerCase())) {
        // Partial match - alignment depends on pattern success score
        totalAlignment += pattern.successScore;
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      // No explicit conflict - neutral alignment
      totalAlignment += 0.5;
    }

    activePatterns++;
  }

  return activePatterns > 0 ? totalAlignment / activePatterns : 1.0;
}

function calculateGenomeDistance(genome1: GoalGenome, genome2: GoalGenome): number {
  // Calculate distance based on objectives
  const objectives1 = new Map(genome1.objectives.map(o => [o.id, o]));
  const objectives2 = new Map(genome2.objectives.map(o => [o.id, o]));

  // Jaccard distance for objective sets
  const allIds = new Set([...objectives1.keys(), ...objectives2.keys()]);
  const intersection = new Set(
    [...objectives1.keys()].filter(id => objectives2.has(id))
  );
  const union = allIds;

  const jaccardDistance = union.size > 0 ? 1 - intersection.size / union.size : 0;

  // Parameter distance for shared objectives
  let paramDistance = 0;
  let paramCount = 0;

  for (const [id, obj1] of objectives1) {
    const obj2 = objectives2.get(id);
    if (obj2) {
      const allParams = new Set([...Object.keys(obj1.parameters), ...Object.keys(obj2.parameters)]);
      for (const param of allParams) {
        const val1 = obj1.parameters[param] || 0;
        const val2 = obj2.parameters[param] || 0;
        paramDistance += Math.abs(val1 - val2);
        paramCount++;
      }
    }
  }

  const avgParamDistance = paramCount > 0 ? paramDistance / paramCount : 0;

  // Combined distance
  return (jaccardDistance + Math.min(avgParamDistance, 1)) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fitness Statistics
// ═══════════════════════════════════════════════════════════════════════════════

export interface FitnessStatistics {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
}

export function calculateFitnessStatistics(scores: FitnessScore[]): FitnessStatistics {
  if (scores.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, stdDev: 0 };
  }

  const aggregateScores = scores.map(s => s.aggregateScore).sort((a, b) => a - b);

  const mean = aggregateScores.reduce((a, b) => a + b, 0) / aggregateScores.length;
  const min = aggregateScores[0];
  const max = aggregateScores[aggregateScores.length - 1];

  const median =
    aggregateScores.length % 2 === 0
      ? (aggregateScores[aggregateScores.length / 2 - 1] +
          aggregateScores[aggregateScores.length / 2]) /
        2
      : aggregateScores[Math.floor(aggregateScores.length / 2)];

  const variance =
    aggregateScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
    aggregateScores.length;
  const stdDev = Math.sqrt(variance);

  return { mean, median, min, max, stdDev };
}
