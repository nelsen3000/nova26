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
// Inner Loop
// ═══════════════════════════════════════════════════════════════════════════════

export {
  executeInnerLoop,
  createMockExecutor,
  DEFAULT_CONFIG as INNER_LOOP_DEFAULT_CONFIG,
} from './inner-loop.js';

export type {
  InnerLoopConfig,
  TaskExecutor,
  InnerLoopOptions,
} from './inner-loop.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Outer Loop
// ═══════════════════════════════════════════════════════════════════════════════

export {
  executeOuterLoop,
  getLineage,
  isDescendant,
  DEFAULT_CONFIG as OUTER_LOOP_DEFAULT_CONFIG,
} from './outer-loop.js';

export type {
  OuterLoopConfig,
  OuterLoopState,
  OuterLoopOptions,
  OuterLoopResult,
} from './outer-loop.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Session Manager
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createSession,
  pauseSession,
  resumeSession,
  stopSession,
  getSession,
  listSessions,
  checkBudget,
  checkpointSession,
  restoreFromCheckpoint,
  updateSessionGeneration,
  updateSessionMetrics,
  clearSessions,
  DEFAULT_CONFIG as SESSION_DEFAULT_CONFIG,
} from './session-manager.js';

export type {
  SessionManagerConfig,
} from './session-manager.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Autonomy Gating
// ═══════════════════════════════════════════════════════════════════════════════

export {
  shouldPauseAfterGeneration,
  shouldTriggerOnDeviation,
  isSwarmDebateEnabled,
  getApprovalRequirements,
  evaluateGate,
  DEFAULT_CONFIG as AUTONOMY_DEFAULT_CONFIG,
} from './autonomy-gating.js';

export type {
  AutonomyGatingConfig,
  GateDecision,
} from './autonomy-gating.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Swarm Debate
// ═══════════════════════════════════════════════════════════════════════════════

export {
  conductDebate,
  conductBatchDebate,
  incorporateDebateScore,
  createMockParticipant,
  DEFAULT_CONFIG as SWARM_DEBATE_DEFAULT_CONFIG,
} from './swarm-debate.js';

export type {
  SwarmDebateConfig,
  DebateParticipant,
  FitnessWithDebate,
} from './swarm-debate.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ATLAS Goal Store
// ═══════════════════════════════════════════════════════════════════════════════

export {
  persistGenome,
  persistGeneration,
  getLatestPopulation,
  getGenomesByFitness,
  getGenomeByGeneration,
  getGenomeLineage,
  getPortfolioSeeds,
  pruneOldGenomes,
  persistSessionState,
  restoreSessionState,
  getStatistics,
  clearStore,
} from './atlas-goal-store.js';

export type {
  StoreStatistics,
} from './atlas-goal-store.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Overnight Evolution
// ═══════════════════════════════════════════════════════════════════════════════

export {
  OvernightEvolution,
  createOvernightEvolution,
  DEFAULT_CONFIG as OVERNIGHT_DEFAULT_CONFIG,
} from './overnight-evolution.js';

export type {
  OvernightEvolutionConfig,
  OvernightReport,
} from './overnight-evolution.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Portfolio Learning
// ═══════════════════════════════════════════════════════════════════════════════

export {
  PortfolioLearning,
  createPortfolioLearning,
  DEFAULT_CONFIG as PORTFOLIO_DEFAULT_CONFIG,
} from './portfolio-learning.js';

export type {
  PortfolioLearningConfig,
  PortfolioEntry,
  CrossProjectLearningEntry,
  PortfolioStore,
} from './portfolio-learning.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SAGA Engine
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createSAGAEngine,
  resetSAGAEngine,
  DEFAULT_ENGINE_CONFIG,
} from './saga-engine.js';

export type {
  SAGAEngine,
  SAGAEngineConfig,
} from './saga-engine.js';

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
  innerLoop: {
    maxIterations: 100,
    timeoutMs: 300000, // 5 minutes
    enableRemedial: true,
  },
  outerLoop: {
    tournamentSize: 3,
    mutationRate: 0.3,
    diversityBoostThreshold: 0.2,
  },
  session: {
    autoCheckpointIntervalMs: 600000, // 10 minutes
  },
  autonomy: {
    deviationThreshold: 0.2,
    pauseInterval: 1,
  },
  swarmDebate: {
    minParticipants: 3,
    maxParticipants: 7,
    consensusThreshold: 0.7,
    rejectionThreshold: 0.3,
    timeoutMs: 30000,
  },
  overnight: {
    durationMs: 8 * 60 * 60 * 1000, // 8 hours
    checkpointIntervalMs: 30 * 60 * 1000, // 30 minutes
    minFitnessThreshold: 0.7,
    maxGenerations: 100,
  },
  portfolio: {
    minPortfolioFitness: 0.7,
    maxPortfolioSeedsPercent: 0.2,
    reevaluateImportedGenomes: true,
    enableCrossProjectLogging: true,
  },
  engine: {
    autonomyLevel: 3,
    tastePatterns: [],
    enableOvernight: false,
    overnightDurationMs: 8 * 60 * 60 * 1000, // 8 hours
  },
};
