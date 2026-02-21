// SAGA Zod Schemas - Runtime validation for SAGA types
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// Goal Genome Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const ObjectiveDescriptorSchema = z.object({
  id: z.string(),
  description: z.string(),
  domain: z.string(),
  parameters: z.record(z.union([z.number(), z.nan()]).transform(v => Number.isNaN(v) ? 0 : v)),
  weight: z.union([z.number().min(0).max(1), z.nan()]).transform(v => Number.isNaN(v) ? 0 : Math.max(0, Math.min(1, v))),
});

export const FitnessCriterionSchema = z.object({
  objectiveId: z.string(),
  metricName: z.string(),
  targetValue: z.union([z.number(), z.nan()]).transform(v => Number.isNaN(v) ? 0 : v),
  currentValue: z.union([z.number(), z.nan()]).transform(v => Number.isNaN(v) ? 0 : v),
});

export const GoalGenomeSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().int().min(1),
  agentName: z.string(),
  generation: z.number().int().min(0),
  parentId: z.string().nullable(),
  objectives: z.array(ObjectiveDescriptorSchema),
  fitnessCriteria: z.array(FitnessCriterionSchema),
  createdAt: z.string(),
  metadata: z.record(z.string()),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Fitness Schemas (defined before EvolutionSessionSchema to avoid TDZ issues)
// ═══════════════════════════════════════════════════════════════════════════════

export const FitnessScoreSchema = z.object({
  genomeId: z.string(),
  performanceScore: z.number().min(0).max(1),
  noveltyScore: z.number().min(0).max(1),
  tasteAlignmentScore: z.number().min(0).max(1),
  aggregateScore: z.number().min(0).max(1),
  breakdown: z.record(z.number()),
});

export const CurriculumTaskResultSchema = z.object({
  taskId: z.string(),
  objectiveId: z.string(),
  passed: z.boolean(),
  score: z.number(),
  duration: z.number().int().min(0),
});

export const InnerLoopResultSchema = z.object({
  genomeId: z.string(),
  taskResults: z.array(CurriculumTaskResultSchema),
  totalDuration: z.number().int().min(0),
  iterationsCompleted: z.number().int().min(0),
  partial: z.boolean(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session & Configuration Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const EvolutionConfigSchema = z.object({
  maxIterations: z.number().int().positive(),
  maxComputeTimeMs: z.number().int().positive(),
  maxMemoryBytes: z.number().int().positive(),
  populationSize: z.number().int().positive(),
  minFitnessThreshold: z.number().min(0).max(1),
  portfolioSeedPercent: z.number().min(0).max(1),
  checkpointIntervalMs: z.number().int().positive(),
  enableSwarmDebate: z.boolean(),
  notableFitnessThreshold: z.number().min(0).max(1),
});

export const SessionMetricsSchema = z.object({
  outerLoopIterations: z.number().int().min(0),
  innerLoopExecutions: z.number().int().min(0),
  totalComputeTimeMs: z.number().int().min(0),
  peakMemoryBytes: z.number().int().min(0),
  candidatesGenerated: z.number().int().min(0),
  candidatesRejectedByTaste: z.number().int().min(0),
  swarmDebatesRun: z.number().int().min(0),
});

export const SessionStatusSchema = z.union([
  z.literal('running'),
  z.literal('paused'),
  z.literal('completed'),
  z.literal('stopped'),
  z.literal('budget_exceeded'),
]);

export const EvolutionSessionSchema = z.object({
  id: z.string(),
  agentName: z.string(),
  status: SessionStatusSchema,
  config: EvolutionConfigSchema,
  currentGeneration: z.number().int().min(0),
  population: z.array(GoalGenomeSchema),
  bestGenome: GoalGenomeSchema.nullable(),
  fitnessHistory: z.array(z.array(FitnessScoreSchema)),
  startedAt: z.string(),
  lastCheckpointAt: z.string().nullable(),
  metrics: SessionMetricsSchema,
});

// ═══════════════════════════════════════════════════════════════════════════════
// Mutation Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const MutationTypeSchema = z.union([
  z.literal('add'),
  z.literal('remove'),
  z.literal('perturb'),
  z.literal('recombine'),
]);

export const GoalMutationSchema = z.object({
  type: MutationTypeSchema,
  parentId: z.string(),
  childId: z.string(),
  timestamp: z.string(),
  details: z.record(z.unknown()),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Taste Guard Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const TastePatternSchema = z.object({
  id: z.string(),
  canonicalContent: z.string(),
  successScore: z.number().min(0).max(1),
  isActive: z.boolean(),
  tags: z.array(z.string()),
});

export const TasteConflictSchema = z.object({
  objectiveId: z.string(),
  patternId: z.string(),
  reason: z.string(),
});

export const TasteCheckResultSchema = z.object({
  passed: z.boolean(),
  conflicts: z.array(TasteConflictSchema),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Curriculum Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const CurriculumTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  objectiveId: z.string(),
  difficulty: z.number().min(0).max(1),
  predecessorIds: z.array(z.string()),
  status: z.union([
    z.literal('pending'),
    z.literal('passed'),
    z.literal('failed'),
    z.literal('remedial'),
  ]),
});

export const CurriculumSchema = z.object({
  genomeId: z.string(),
  tasks: z.array(CurriculumTaskSchema),
  createdAt: z.string(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session Summary Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const EvolutionSessionInfoSchema = z.object({
  id: z.string(),
  agentName: z.string(),
  status: z.string(),
  currentGeneration: z.number().int().min(0),
  bestFitness: z.number(),
  startedAt: z.string(),
});

export const EvolutionSessionSummarySchema = z.object({
  sessionId: z.string(),
  agentName: z.string(),
  generationsEvolved: z.number().int().min(0),
  startingBestFitness: z.number(),
  endingBestFitness: z.number(),
  notableDiscoveries: z.array(GoalGenomeSchema),
  metrics: SessionMetricsSchema,
});

export const BudgetStatusSchema = z.union([
  z.literal('ok'),
  z.literal('time_exceeded'),
  z.literal('iterations_exceeded'),
  z.literal('memory_exceeded'),
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Swarm Debate Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const SwarmCritiqueSchema = z.object({
  agentId: z.string(),
  score: z.number(),
  feedback: z.string(),
});

export const SwarmDebateResultSchema = z.object({
  candidateId: z.string(),
  consensusScore: z.number(),
  critiques: z.array(SwarmCritiqueSchema),
  unanimousRejection: z.boolean(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Serialization / Deserialization
// ═══════════════════════════════════════════════════════════════════════════════

const CURRENT_SCHEMA_VERSION = 1;

export function serializeGenome(genome: GoalGenome): string {
  const validated = GoalGenomeSchema.parse(genome);
  return JSON.stringify(validated);
}

export function deserializeGenome(json: string): GoalGenome {
  const parsed = JSON.parse(json);
  
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Invalid genome schema version: ${parsed.schemaVersion}. Expected: ${CURRENT_SCHEMA_VERSION}`
    );
  }
  
  return GoalGenomeSchema.parse(parsed);
}

export function serializeSession(session: EvolutionSession): string {
  const validated = EvolutionSessionSchema.parse(session);
  return JSON.stringify(validated);
}

export function deserializeSession(json: string): EvolutionSession {
  return EvolutionSessionSchema.parse(JSON.parse(json));
}
