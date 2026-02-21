// Outer Loop - Bi-level evolutionary optimization framework
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import type {
  GoalGenome,
  EvolutionConfig,
  FitnessScore,
  TastePattern,
  InnerLoopResult,
} from './types.js';
import { mutate } from './goal-genome.js';
import { evaluate, tournamentSelect } from './fitness-evaluator.js';
import { filterCandidates } from './taste-guard.js';
import { executeInnerLoop, type TaskExecutor } from './inner-loop.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface OuterLoopConfig extends EvolutionConfig {
  tournamentSize: number;
  mutationRate: number;
  diversityBoostThreshold: number;
}

export const DEFAULT_CONFIG: Partial<OuterLoopConfig> = {
  maxIterations: 100,
  maxComputeTimeMs: 3600000,
  maxMemoryBytes: 8 * 1024 * 1024,
  populationSize: 20,
  minFitnessThreshold: 0.3,
  portfolioSeedPercent: 0.2,
  checkpointIntervalMs: 600000,
  enableSwarmDebate: false,
  notableFitnessThreshold: 0.85,
  tournamentSize: 3,
  mutationRate: 0.3,
  diversityBoostThreshold: 0.2,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Outer Loop State
// ═══════════════════════════════════════════════════════════════════════════════

export interface OuterLoopState {
  generation: number;
  population: GoalGenome[];
  fitnessScores: Map<string, FitnessScore>;
  lineage: Map<string, string[]>; // genomeId -> ancestor IDs
  candidatesGenerated: number;
  candidatesRejected: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Outer Loop Execution
// ═══════════════════════════════════════════════════════════════════════════════

export interface OuterLoopOptions {
  initialPopulation: GoalGenome[];
  tastePatterns: TastePattern[];
  executor: TaskExecutor;
  config?: Partial<OuterLoopConfig>;
  onGeneration?: (gen: number, bestFitness: number) => void;
  shouldStop?: () => boolean;
}

export interface OuterLoopResult {
  finalPopulation: GoalGenome[];
  bestGenome: GoalGenome;
  bestFitness: number;
  generations: number;
  lineage: Map<string, string[]>;
}

export async function executeOuterLoop(
  options: OuterLoopOptions
): Promise<OuterLoopResult> {
  const config = { ...DEFAULT_CONFIG, ...options.config } as OuterLoopConfig;
  const startTime = Date.now();

  // Initialize state
  let state: OuterLoopState = {
    generation: 0,
    population: options.initialPopulation,
    fitnessScores: new Map(),
    lineage: new Map(),
    candidatesGenerated: 0,
    candidatesRejected: 0,
  };

  // Build initial lineage
  for (const genome of state.population) {
    const ancestors: string[] = [];
    if (genome.parentId) {
      ancestors.push(genome.parentId);
    }
    state.lineage.set(genome.id, ancestors);
  }

  // Evolution loop
  while (state.generation < config.maxIterations) {
    // Check time budget
    if (Date.now() - startTime > config.maxComputeTimeMs) {
      break;
    }

    // Check external stop signal
    if (options.shouldStop?.()) {
      break;
    }

    // 1. Generate candidate mutations
    const candidates = generateCandidates(state.population, config);
    state.candidatesGenerated += candidates.length;

    // 2. Filter through Taste Guard
    const filtered = filterCandidates(candidates, options.tastePatterns, {
      successScoreThreshold: 0.5,
      detailedReporting: false,
    });
    state.candidatesRejected += candidates.length - filtered.length;

    // 3. Evaluate fitness via Inner Loop
    const evaluated: Array<{ genome: GoalGenome; score: FitnessScore }> = [];
    for (const genome of filtered) {
      // Check budget
      if (Date.now() - startTime > config.maxComputeTimeMs) {
        break;
      }

      // Execute inner loop
      const innerResult = await executeInnerLoop({
        genome,
        executor: options.executor,
        config: {
          maxIterations: 50,
          timeoutMs: 60000,
          enableRemedial: true,
        },
      });

      // Evaluate fitness
      const fitness = evaluate(
        genome,
        innerResult,
        state.population,
        options.tastePatterns
      );

      state.fitnessScores.set(genome.id, fitness);
      evaluated.push({ genome, score: fitness });

      // Track lineage
      const ancestors: string[] = [genome.id];
      if (genome.parentId) {
        const parentAncestors = state.lineage.get(genome.parentId) || [];
        ancestors.push(...parentAncestors);
      }
      state.lineage.set(genome.id, ancestors);
    }

    // 4. Tournament selection for next generation
    const selected = tournamentSelect(
      evaluated,
      config.tournamentSize,
      config.populationSize
    );

    // Update state
    state.generation++;
    state.population = selected;

    // Calculate best fitness
    const bestScore = Math.max(...evaluated.map(e => e.score.aggregateScore));
    options.onGeneration?.(state.generation, bestScore);

    // 5. Check for low fitness - increase diversity if needed
    const avgFitness =
      evaluated.reduce((sum, e) => sum + e.score.aggregateScore, 0) /
      evaluated.length;
    if (avgFitness < config.minFitnessThreshold) {
      // Low fitness - inject random mutations to increase diversity
      const diversityBoosts = state.population.map(g => mutate(g).genome);
      state.population = [...state.population, ...diversityBoosts].slice(
        0,
        config.populationSize
      );
    }
  }

  // Find best genome
  let bestGenome = state.population[0];
  let bestFitness = 0;

  for (const genome of state.population) {
    const score = state.fitnessScores.get(genome.id);
    if (score && score.aggregateScore > bestFitness) {
      bestFitness = score.aggregateScore;
      bestGenome = genome;
    }
  }

  return {
    finalPopulation: state.population,
    bestGenome,
    bestFitness,
    generations: state.generation,
    lineage: state.lineage,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Candidate Generation
// ═══════════════════════════════════════════════════════════════════════════════

function generateCandidates(
  population: GoalGenome[],
  config: OuterLoopConfig
): GoalGenome[] {
  const candidates: GoalGenome[] = [];

  // Each genome produces mutated offspring
  for (const genome of population) {
    // Always include the parent
    candidates.push(genome);

    // Generate mutations based on mutation rate
    if (Math.random() < config.mutationRate) {
      const { genome: child } = mutate(genome);
      candidates.push(child);
    }

    // Recombine with random partner
    if (population.length > 1 && Math.random() < config.mutationRate) {
      const partner = population[Math.floor(Math.random() * population.length)];
      if (partner.id !== genome.id) {
        // Use mutate with recombine type (simulated)
        const { genome: child } = mutate(genome, 'recombine');
        candidates.push(child);
      }
    }
  }

  return candidates;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lineage Utilities
// ═══════════════════════════════════════════════════════════════════════════════

export function getLineage(
  genomeId: string,
  lineageMap: Map<string, string[]>
): string[] {
  const ancestors: string[] = [];
  const visited = new Set<string>();
  const toProcess = [genomeId];

  while (toProcess.length > 0) {
    const current = toProcess.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const parents = lineageMap.get(current) || [];
    for (const parent of parents) {
      ancestors.push(parent);
      toProcess.push(parent);
    }
  }

  return ancestors;
}

export function isDescendant(
  potentialDescendant: string,
  potentialAncestor: string,
  lineageMap: Map<string, string[]>
): boolean {
  const ancestors = getLineage(potentialDescendant, lineageMap);
  return ancestors.includes(potentialAncestor);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Executor Factory
// ═══════════════════════════════════════════════════════════════════════════════

import type { CurriculumTask, CurriculumTaskResult } from './types.js';

/**
 * Creates a mock task executor for testing purposes.
 * @param successRate - Probability of task success (0-1)
 * @returns TaskExecutor function
 */
export function createMockExecutor(
  successRate: number
): (task: CurriculumTask) => Promise<CurriculumTaskResult> {
  return async (task: CurriculumTask): Promise<CurriculumTaskResult> => {
    const passed = Math.random() < successRate;
    const duration = Math.floor(Math.random() * 1000);

    return {
      taskId: task.id,
      objectiveId: task.objectiveId,
      passed,
      score: passed ? 0.7 + Math.random() * 0.3 : Math.random() * 0.5,
      duration,
      remedial: task.difficulty === 'remedial',
    };
  };
}
