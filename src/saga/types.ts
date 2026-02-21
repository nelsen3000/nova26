// SAGA Core Types - Self-Evolving Goal Agents
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

// ═══════════════════════════════════════════════════════════════════════════════
// Goal Genome - Core evolutionary data structure
// ═══════════════════════════════════════════════════════════════════════════════

export interface ObjectiveDescriptor {
  id: string;
  description: string;
  domain: string;
  parameters: Record<string, number>;
  weight: number;
}

export interface FitnessCriterion {
  objectiveId: string;
  metricName: string;
  targetValue: number;
  currentValue: number;
}

export interface GoalGenome {
  id: string;
  schemaVersion: number;
  agentName: string;
  generation: number;
  parentId: string | null;
  objectives: ObjectiveDescriptor[];
  fitnessCriteria: FitnessCriterion[];
  createdAt: string;
  metadata: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Evolution Configuration & Session
// ═══════════════════════════════════════════════════════════════════════════════

export interface EvolutionConfig {
  maxIterations: number;
  maxComputeTimeMs: number;
  maxMemoryBytes: number;
  populationSize: number;
  minFitnessThreshold: number;
  portfolioSeedPercent: number;
  checkpointIntervalMs: number;
  enableSwarmDebate: boolean;
  notableFitnessThreshold: number;
}

export interface SessionMetrics {
  outerLoopIterations: number;
  innerLoopExecutions: number;
  totalComputeTimeMs: number;
  peakMemoryBytes: number;
  candidatesGenerated: number;
  candidatesRejectedByTaste: number;
  swarmDebatesRun: number;
}

export type SessionStatus = 'running' | 'paused' | 'completed' | 'stopped' | 'budget_exceeded';

export interface EvolutionSession {
  id: string;
  agentName: string;
  status: SessionStatus;
  config: EvolutionConfig;
  currentGeneration: number;
  population: GoalGenome[];
  bestGenome: GoalGenome | null;
  fitnessHistory: FitnessScore[][];
  startedAt: string;
  lastCheckpointAt: string | null;
  metrics: SessionMetrics;
}

export interface EvolutionSessionInfo {
  id: string;
  agentName: string;
  status: string;
  currentGeneration: number;
  bestFitness: number;
  startedAt: string;
}

export interface EvolutionSessionSummary {
  sessionId: string;
  agentName: string;
  generationsEvolved: number;
  startingBestFitness: number;
  endingBestFitness: number;
  notableDiscoveries: GoalGenome[];
  metrics: SessionMetrics;
}

export type BudgetStatus = 'ok' | 'time_exceeded' | 'iterations_exceeded' | 'memory_exceeded';

// ═══════════════════════════════════════════════════════════════════════════════
// Fitness Evaluation
// ═══════════════════════════════════════════════════════════════════════════════

export interface FitnessScore {
  genomeId: string;
  performanceScore: number;
  noveltyScore: number;
  tasteAlignmentScore: number;
  aggregateScore: number;
  breakdown: Record<string, number>;
}

export interface InnerLoopResult {
  genomeId: string;
  taskResults: CurriculumTaskResult[];
  totalDuration: number;
  iterationsCompleted: number;
  partial: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Goal Mutations
// ═══════════════════════════════════════════════════════════════════════════════

export type MutationType = 'add' | 'remove' | 'perturb' | 'recombine';

export interface GoalMutation {
  type: MutationType;
  parentId: string;
  childId: string;
  timestamp: string;
  details: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Taste Guard
// ═══════════════════════════════════════════════════════════════════════════════

export interface TastePattern {
  id: string;
  canonicalContent: string;
  successScore: number;
  isActive: boolean;
  tags: string[];
}

export interface TasteConflict {
  objectiveId: string;
  patternId: string;
  reason: string;
}

export interface TasteCheckResult {
  passed: boolean;
  conflicts: TasteConflict[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Curriculum Generation
// ═══════════════════════════════════════════════════════════════════════════════

export interface CurriculumTask {
  id: string;
  description: string;
  objectiveId: string;
  difficulty: number;
  predecessorIds: string[];
  status: 'pending' | 'passed' | 'failed' | 'remedial';
}

export interface Curriculum {
  genomeId: string;
  tasks: CurriculumTask[];
  createdAt: string;
}

export interface CurriculumTaskResult {
  taskId: string;
  objectiveId: string;
  passed: boolean;
  score: number;
  duration: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAGA Engine Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface SAGAEngine {
  startSession(agentName: string, config: EvolutionConfig): Promise<EvolutionSession>;
  pauseSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<EvolutionSession>;
  stopSession(sessionId: string): Promise<EvolutionSessionSummary>;
  getSession(sessionId: string): EvolutionSession | undefined;
  listSessions(): EvolutionSessionInfo[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ATLAS Goal Store Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface ATLASGoalStore {
  persistGenome(genome: GoalGenome, fitnessScore: number): Promise<void>;
  persistGeneration(genomes: GoalGenome[], fitnessScores: FitnessScore[]): Promise<void>;
  getLatestPopulation(agentName: string): Promise<GoalGenome[]>;
  getGenomesByFitness(agentName: string, minFitness: number): Promise<GoalGenome[]>;
  getGenomeByGeneration(agentName: string, generation: number): Promise<GoalGenome[]>;
  getGenomeLineage(genomeId: string): Promise<GoalGenome[]>;
  getPortfolioSeeds(excludeAgent: string, minFitness: number, limit: number): Promise<GoalGenome[]>;
  pruneOldGenomes(retentionDays: number): Promise<number>;
  persistSessionState(session: EvolutionSession): Promise<void>;
  restoreSessionState(sessionId: string): Promise<EvolutionSession | null>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component Interfaces
// ═══════════════════════════════════════════════════════════════════════════════

export interface GoalMutator {
  addObjective(genome: GoalGenome, objective: ObjectiveDescriptor): GoalGenome;
  removeObjective(genome: GoalGenome, objectiveId: string): GoalGenome;
  perturbObjective(
    genome: GoalGenome,
    objectiveId: string,
    delta: Record<string, number>
  ): GoalGenome;
  recombine(parent1: GoalGenome, parent2: GoalGenome): GoalGenome;
  mutate(genome: GoalGenome, mutationType?: MutationType): GoalGenome;
}

export interface FitnessEvaluator {
  evaluate(
    genome: GoalGenome,
    innerLoopResults: InnerLoopResult,
    population: GoalGenome[],
    tastePatterns: TastePattern[]
  ): FitnessScore;
  tournamentSelect(
    candidates: Array<{ genome: GoalGenome; score: FitnessScore }>,
    tournamentSize: number,
    selectionCount: number
  ): GoalGenome[];
}

export interface TasteGuard {
  check(genome: GoalGenome, patterns: TastePattern[]): TasteCheckResult;
  filterCandidates(candidates: GoalGenome[], patterns: TastePattern[]): GoalGenome[];
}

export interface CurriculumGenerator {
  generate(genome: GoalGenome): Curriculum;
  generateRemedialTask(failedTask: CurriculumTask, genome: GoalGenome): CurriculumTask;
}

export interface SessionManager {
  create(agentName: string, config: EvolutionConfig): EvolutionSession;
  pause(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<EvolutionSession>;
  stop(sessionId: string): Promise<EvolutionSessionSummary>;
  checkBudget(session: EvolutionSession): BudgetStatus;
  checkpoint(session: EvolutionSession): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Swarm Debate
// ═══════════════════════════════════════════════════════════════════════════════

export interface SwarmDebateResult {
  candidateId: string;
  consensusScore: number;
  critiques: SwarmCritique[];
  unanimousRejection: boolean;
}

export interface SwarmCritique {
  agentId: string;
  score: number;
  feedback: string;
}

export interface SwarmDebate {
  submitForDebate(
    candidate: GoalGenome,
    participants: string[],
    timeoutMs: number
  ): Promise<SwarmDebateResult>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Autonomy Gating
// ═══════════════════════════════════════════════════════════════════════════════

export interface AutonomyGating {
  shouldPauseAfterGeneration(autonomyLevel: number, generation: number): boolean;
  shouldTriggerOnDeviation(
    autonomyLevel: number,
    currentFitness: number,
    previousFitness: number
  ): boolean;
  isSwarmDebateEnabled(autonomyLevel: number): boolean;
}
