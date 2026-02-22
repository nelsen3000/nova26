// Convex Bridge for SAGA
// Client-side bridge to convex/saga.ts mutations and queries
// Spec: .kiro/specs/saga-self-evolving-agents/tasks.md Task 10

import type {
  GoalGenomeRecord,
  EvolutionSessionRecord,
  PersistGenomeInput,
  CreateSessionInput,
  UpdateSessionInput,
  GenomeQueryOptions,
  SessionQueryOptions,
  FitnessScoreRecord,
} from './convex-types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Type-only imports for Convex API
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConvexApi {
  query: <TArgs, TReturn>(name: string) => (args: TArgs) => Promise<TReturn>;
  mutation: <TArgs, TReturn>(name: string) => (args: TArgs) => Promise<TReturn>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Goal Genome Bridge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Persist a goal genome to Convex
 */
export async function persistGenome(
  convex: ConvexApi,
  input: PersistGenomeInput
): Promise<string> {
  const genomeId = await convex.mutation<PersistGenomeInput, string>('saga:persistGenome')(input);
  return genomeId;
}

/**
 * Persist a generation of genomes (batch operation)
 */
export async function persistGeneration(
  convex: ConvexApi,
  companyId: string,
  agentId: string,
  generation: number,
  genomes: PersistGenomeInput[]
): Promise<string[]> {
  const genomeIds: string[] = [];
  for (const genome of genomes) {
    const id = await persistGenome(convex, { ...genome, companyId, agentId });
    genomeIds.push(id);
  }
  return genomeIds;
}

/**
 * Get the latest population for an agent
 */
export async function getLatestPopulation(
  convex: ConvexApi,
  companyId: string,
  agentId: string,
  limit?: number
): Promise<GoalGenomeRecord[]> {
  const genomes = await convex.query<
    { companyId: string; agentId: string; limit?: number },
    GoalGenomeRecord[]
  >('saga:getLatestPopulation')({ companyId, agentId, limit });
  return genomes;
}

/**
 * Get genomes by fitness threshold
 */
export async function getGenomesByFitness(
  convex: ConvexApi,
  companyId: string,
  agentId: string,
  minFitness: number,
  limit?: number
): Promise<GoalGenomeRecord[]> {
  const genomes = await convex.query<
    { companyId: string; agentId: string; minFitness: number; limit?: number },
    GoalGenomeRecord[]
  >('saga:getGenomesByFitness')({ companyId, agentId, minFitness, limit });
  return genomes;
}

/**
 * Get a specific genome by generation
 */
export async function getGenomeByGeneration(
  convex: ConvexApi,
  companyId: string,
  agentId: string,
  generation: number
): Promise<GoalGenomeRecord | null> {
  const genome = await convex.query<
    { companyId: string; agentId: string; generation: number },
    GoalGenomeRecord | null
  >('saga:getGenomeByGeneration')({ companyId, agentId, generation });
  return genome;
}

/**
 * Get the lineage of a genome
 */
export async function getGenomeLineage(
  convex: ConvexApi,
  genomeId: string
): Promise<GoalGenomeRecord[]> {
  const lineage = await convex.query<
    { genomeId: string },
    GoalGenomeRecord[]
  >('saga:getGenomeLineage')({ genomeId });
  return lineage;
}

/**
 * Get portfolio seeds from other projects
 */
export async function getPortfolioSeeds(
  convex: ConvexApi,
  companyId: string,
  excludeAgentId: string,
  limit?: number
): Promise<GoalGenomeRecord[]> {
  const seeds = await convex.query<
    { companyId: string; excludeAgentId: string; limit?: number },
    GoalGenomeRecord[]
  >('saga:getPortfolioSeeds')({ companyId, excludeAgentId, limit });
  return seeds;
}

/**
 * Prune old genomes beyond retention limit
 */
export async function pruneOldGenomes(
  convex: ConvexApi,
  companyId: string,
  agentId: string,
  retainCount: number
): Promise<number> {
  const prunedCount = await convex.mutation<
    { companyId: string; agentId: string; retainCount: number },
    number
  >('saga:pruneOldGenomes')({ companyId, agentId, retainCount });
  return prunedCount;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Evolution Session Bridge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new evolution session
 */
export async function createEvolutionSession(
  convex: ConvexApi,
  input: CreateSessionInput
): Promise<string> {
  const sessionId = await convex.mutation<CreateSessionInput, string>(
    'saga:createSession'
  )(input);
  return sessionId;
}

/**
 * Persist session state (checkpoint)
 */
export async function persistSessionState(
  convex: ConvexApi,
  sessionId: string,
  checkpointData: string
): Promise<void> {
  await convex.mutation<
    { sessionId: string; checkpointData: string },
    void
  >('saga:persistSessionState')({ sessionId, checkpointData });
}

/**
 * Restore session state from checkpoint
 */
export async function restoreSessionState(
  convex: ConvexApi,
  sessionId: string
): Promise<string | null> {
  const checkpointData = await convex.query<
    { sessionId: string },
    string | null
  >('saga:restoreSessionState')({ sessionId });
  return checkpointData;
}

/**
 * List evolution sessions for a company
 */
export async function listEvolutionSessions(
  convex: ConvexApi,
  companyId: string,
  options?: SessionQueryOptions
): Promise<EvolutionSessionRecord[]> {
  const sessions = await convex.query<
    { companyId: string } & SessionQueryOptions,
    EvolutionSessionRecord[]
  >('saga:listSessions')({ companyId, ...options });
  return sessions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fitness Logging
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log a notable fitness achievement to ATLAS learnings
 */
export async function logNotableFitness(
  convex: ConvexApi,
  companyId: string,
  agentId: string,
  genomeId: string,
  fitnessScore: number,
  generation: number,
  notes?: string
): Promise<string> {
  const learningId = await convex.mutation<
    {
      companyId: string;
      agentId: string;
      genomeId: string;
      fitnessScore: number;
      generation: number;
      notes?: string;
    },
    string
  >('saga:logNotableFitness')({
    companyId,
    agentId,
    genomeId,
    fitnessScore,
    generation,
    notes,
  });
  return learningId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Re-export Types
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  GoalGenomeRecord,
  EvolutionSessionRecord,
  PersistGenomeInput,
  CreateSessionInput,
  UpdateSessionInput,
  GenomeQueryOptions,
  SessionQueryOptions,
  FitnessScoreRecord,
} from './convex-types.js';
