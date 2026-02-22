// Convex Types for SAGA
// Mirror types for convex/saga.ts mutations and queries
// Spec: .kiro/specs/saga-self-evolving-agents/tasks.md Task 10

// ═══════════════════════════════════════════════════════════════════════════════
// Goal Genome Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Goal Genome stored in Convex
 */
export interface GoalGenomeRecord {
  _id: string;
  _creationTime: number;
  companyId: string;
  agentId: string;
  genomeId: string;
  generation: number;
  parentId?: string;
  objectives: ObjectiveDescriptor[];
  createdAt: string;
  fitnessScore?: number;
  fitnessRank?: number;
  lineage: string[];
}

/**
 * Objective descriptor for Convex storage
 */
export interface ObjectiveDescriptor {
  id: string;
  name: string;
  weight: number;
  constraints: Record<string, unknown>;
}

/**
 * Fitness score record
 */
export interface FitnessScoreRecord {
  genomeId: string;
  performanceScore: number;
  noveltyScore: number;
  tasteAlignmentScore: number;
  aggregateScore: number;
  evaluatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Evolution Session Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evolution Session stored in Convex
 */
export interface EvolutionSessionRecord {
  _id: string;
  _creationTime: number;
  companyId: string;
  sessionId: string;
  agentId: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  generation: number;
  maxGenerations: number;
  populationSize: number;
  budget: BudgetConfig;
  metrics: SessionMetrics;
  checkpointData?: string; // Serialized session state
  createdAt: string;
  updatedAt: string;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  maxIterations: number;
  maxTimeMs: number;
  usedIterations: number;
  usedTimeMs: number;
}

/**
 * Session metrics
 */
export interface SessionMetrics {
  bestFitness: number;
  avgFitness: number;
  diversityScore: number;
  totalMutations: number;
  totalEvaluations: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Input Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input for persisting a genome
 */
export interface PersistGenomeInput {
  companyId: string;
  agentId: string;
  genomeId: string;
  generation: number;
  parentId?: string;
  objectives: ObjectiveDescriptor[];
  fitnessScore?: number;
  lineage: string[];
}

/**
 * Input for creating a session
 */
export interface CreateSessionInput {
  companyId: string;
  sessionId: string;
  agentId: string;
  maxGenerations: number;
  populationSize: number;
  budget: BudgetConfig;
}

/**
 * Input for updating session state
 */
export interface UpdateSessionInput {
  sessionId: string;
  status?: 'running' | 'paused' | 'completed' | 'failed';
  generation?: number;
  metrics?: Partial<SessionMetrics>;
  checkpointData?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Query Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Query options for genomes
 */
export interface GenomeQueryOptions {
  agentId?: string;
  generation?: number;
  limit?: number;
  minFitness?: number;
}

/**
 * Query options for sessions
 */
export interface SessionQueryOptions {
  agentId?: string;
  status?: 'running' | 'paused' | 'completed' | 'failed';
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Convex Schema Documentation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Required Convex schema additions for SAGA:
 *
 * ```typescript
 * // In convex/schema.ts:
 * goalGenomes: defineTable({
 *   companyId: v.string(),
 *   agentId: v.string(),
 *   genomeId: v.string(),
 *   generation: v.number(),
 *   parentId: v.optional(v.string()),
 *   objectives: v.array(v.object({
 *     id: v.string(),
 *     name: v.string(),
 *     weight: v.number(),
 *     constraints: v.record(v.any()),
 *   })),
 *   createdAt: v.string(),
 *   fitnessScore: v.optional(v.number()),
 *   fitnessRank: v.optional(v.number()),
 *   lineage: v.array(v.string()),
 * })
 *   .index('by_company', ['companyId'])
 *   .index('by_company_agent', ['companyId', 'agentId'])
 *   .index('by_generation', ['companyId', 'agentId', 'generation'])
 *   .index('by_fitness', ['companyId', 'agentId', 'fitnessScore']),
 *
 * evolutionSessions: defineTable({
 *   companyId: v.string(),
 *   sessionId: v.string(),
 *   agentId: v.string(),
 *   status: v.union(
 *     v.literal('running'),
 *     v.literal('paused'),
 *     v.literal('completed'),
 *     v.literal('failed')
 *   ),
 *   generation: v.number(),
 *   maxGenerations: v.number(),
 *   populationSize: v.number(),
 *   budget: v.object({
 *     maxIterations: v.number(),
 *     maxTimeMs: v.number(),
 *     usedIterations: v.number(),
 *     usedTimeMs: v.number(),
 *   }),
 *   metrics: v.object({
 *     bestFitness: v.number(),
 *     avgFitness: v.number(),
 *     diversityScore: v.number(),
 *     totalMutations: v.number(),
 *     totalEvaluations: v.number(),
 *   }),
 *   checkpointData: v.optional(v.string()),
 *   createdAt: v.string(),
 *   updatedAt: v.string(),
 * })
 *   .index('by_company', ['companyId'])
 *   .index('by_session', ['sessionId'])
 *   .index('by_company_agent', ['companyId', 'agentId'])
 *   .index('by_status', ['companyId', 'status']),
 * ```
 */
