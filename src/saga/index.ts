// SAGA Module - Self-Evolving Goal Agents
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

// ═══════════════════════════════════════════════════════════════════════════════
// Core Types & Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export * from './types.js';
export * from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Goal Genome & Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export {
  serialize,
  deserialize,
  createSeedGenome,
  addObjective,
  removeObjective,
  perturbObjective,
  recombine,
  mutate,
} from './goal-genome.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Fitness Evaluation
// ═══════════════════════════════════════════════════════════════════════════════

export {
  evaluate,
  tournamentSelect,
  calculateFitnessStatistics,
  DEFAULT_CONFIG as FITNESS_DEFAULT_CONFIG,
} from './fitness-evaluator.js';

export type {
  FitnessEvaluatorConfig,
  FitnessStatistics,
} from './fitness-evaluator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Taste Guard
// ═══════════════════════════════════════════════════════════════════════════════

export {
  check,
  filterCandidates,
  checkBatch,
  calculatePatternStatistics,
  DEFAULT_CONFIG as TASTE_DEFAULT_CONFIG,
} from './taste-guard.js';

export type {
  TasteGuardConfig,
  BatchCheckResult,
  PatternStatistics,
} from './taste-guard.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Curriculum Generator
// ═══════════════════════════════════════════════════════════════════════════════

export {
  generate as generateCurriculum,
  generateRemedialTask,
  getReadyTasks,
  getProgress,
  updateTaskStatus,
  DEFAULT_CONFIG as CURRICULUM_DEFAULT_CONFIG,
} from './curriculum-generator.js';

export type {
  CurriculumConfig,
} from './curriculum-generator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configurations
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULTS = {
  fitness: {
    performanceWeight: 0.5,
    noveltyWeight: 0.3,
    tasteWeight: 0.2,
    tournamentSize: 3,
  },
  taste: {
    successScoreThreshold: 0.5,
    detailedReporting: true,
  },
  curriculum: {
    tasksPerObjective: 3,
    progressionCurve: 'linear' as const,
    enableRemedial: true,
  },
  evolution: {
    maxIterations: 100,
    maxComputeTimeMs: 3600000, // 1 hour
    maxMemoryBytes: 8 * 1024 * 1024, // 8MB
    populationSize: 20,
    minFitnessThreshold: 0.3,
    portfolioSeedPercent: 0.2,
    checkpointIntervalMs: 600000, // 10 minutes
    enableSwarmDebate: false,
    notableFitnessThreshold: 0.85,
  },
};
