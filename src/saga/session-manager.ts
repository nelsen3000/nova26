// Session Manager - Evolution Session lifecycle, budgets, and checkpointing
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import type {
  EvolutionConfig,
  EvolutionSession,
  EvolutionSessionInfo,
  EvolutionSessionSummary,
  SessionMetrics,
  BudgetStatus,
  GoalGenome,
  FitnessScore,
} from './types.js';
import { EvolutionSessionSchema, EvolutionSessionSummarySchema } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface SessionManagerConfig {
  defaultConfig: EvolutionConfig;
  autoCheckpointIntervalMs: number;
}

export const DEFAULT_CONFIG: SessionManagerConfig = {
  defaultConfig: {
    maxIterations: 100,
    maxComputeTimeMs: 3600000,
    maxMemoryBytes: 8 * 1024 * 1024,
    populationSize: 20,
    minFitnessThreshold: 0.3,
    portfolioSeedPercent: 0.2,
    checkpointIntervalMs: 600000,
    enableSwarmDebate: false,
    notableFitnessThreshold: 0.85,
  },
  autoCheckpointIntervalMs: 600000, // 10 minutes
};

// ═══════════════════════════════════════════════════════════════════════════════
// Session Store
// ═══════════════════════════════════════════════════════════════════════════════

const sessions = new Map<string, EvolutionSession>();
const sessionCheckpoints = new Map<string, EvolutionSession>();

// ═══════════════════════════════════════════════════════════════════════════════
// Session Lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

export function createSession(
  agentName: string,
  initialPopulation: GoalGenome[],
  config?: Partial<EvolutionConfig>
): EvolutionSession {
  const mergedConfig = { ...DEFAULT_CONFIG.defaultConfig, ...config };
  const now = new Date().toISOString();

  const session: EvolutionSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    agentName,
    status: 'running',
    config: mergedConfig,
    currentGeneration: 0,
    population: initialPopulation,
    bestGenome: initialPopulation[0] || null,
    fitnessHistory: [],
    startedAt: now,
    lastCheckpointAt: null,
    metrics: createInitialMetrics(),
  };

  const validated = EvolutionSessionSchema.parse(session);
  sessions.set(validated.id, validated);
  return validated;
}

export async function pauseSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.status !== 'running') {
    throw new Error(`Cannot pause session with status: ${session.status}`);
  }

  // Save checkpoint before pausing
  await checkpointSession(sessionId);

  const updated: EvolutionSession = {
    ...session,
    status: 'paused',
  };

  sessions.set(sessionId, updated);
}

export async function resumeSession(sessionId: string): Promise<EvolutionSession> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.status !== 'paused') {
    throw new Error(`Cannot resume session with status: ${session.status}`);
  }

  // Restore from checkpoint if available
  const checkpoint = sessionCheckpoints.get(sessionId);
  const toResume = checkpoint || session;

  const updated: EvolutionSession = {
    ...toResume,
    status: 'running',
  };

  sessions.set(sessionId, updated);
  return updated;
}

export async function stopSession(
  sessionId: string
): Promise<EvolutionSessionSummary> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const updated: EvolutionSession = {
    ...session,
    status: 'stopped',
  };

  sessions.set(sessionId, updated);

  // Generate summary
  return generateSummary(updated);
}

export function getSession(sessionId: string): EvolutionSession | undefined {
  return sessions.get(sessionId);
}

export function listSessions(): EvolutionSessionInfo[] {
  return Array.from(sessions.values()).map(session => ({
    id: session.id,
    agentName: session.agentName,
    status: session.status,
    currentGeneration: session.currentGeneration,
    bestFitness: session.bestGenome
      ? getBestFitness(session.fitnessHistory, session.bestGenome.id)
      : 0,
    startedAt: session.startedAt,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Budget Management
// ═══════════════════════════════════════════════════════════════════════════════

export function checkBudget(
  session: EvolutionSession,
  startTime: number,
  currentMemoryBytes: number
): BudgetStatus {
  const config = session.config;

  // Check iteration budget
  if (session.currentGeneration >= config.maxIterations) {
    return 'iterations_exceeded';
  }

  // Check time budget
  const elapsedTime = Date.now() - startTime;
  if (elapsedTime >= config.maxComputeTimeMs) {
    return 'time_exceeded';
  }

  // Check memory budget
  if (currentMemoryBytes >= config.maxMemoryBytes) {
    return 'memory_exceeded';
  }

  return 'ok';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Checkpointing
// ═══════════════════════════════════════════════════════════════════════════════

export async function checkpointSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const checkpoint: EvolutionSession = {
    ...session,
    lastCheckpointAt: new Date().toISOString(),
  };

  sessionCheckpoints.set(sessionId, checkpoint);

  // Update session with checkpoint time
  sessions.set(sessionId, checkpoint);
}

export function restoreFromCheckpoint(sessionId: string): EvolutionSession | null {
  return sessionCheckpoints.get(sessionId) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Session Updates
// ═══════════════════════════════════════════════════════════════════════════════

export function updateSessionGeneration(
  sessionId: string,
  generation: number,
  population: GoalGenome[],
  fitnessScores: FitnessScore[]
): void {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Find best genome
  let bestGenome = session.bestGenome;
  let bestScore = bestGenome
    ? fitnessScores.find(f => f.genomeId === bestGenome!.id)?.aggregateScore || 0
    : 0;

  for (const genome of population) {
    const score = fitnessScores.find(f => f.genomeId === genome.id);
    if (score && score.aggregateScore > bestScore) {
      bestScore = score.aggregateScore;
      bestGenome = genome;
    }
  }

  const updated: EvolutionSession = {
    ...session,
    currentGeneration: generation,
    population,
    bestGenome,
    fitnessHistory: [...session.fitnessHistory, fitnessScores],
    metrics: {
      ...session.metrics,
      outerLoopIterations: generation,
    },
  };

  sessions.set(sessionId, updated);
}

export function updateSessionMetrics(
  sessionId: string,
  metrics: Partial<SessionMetrics>
): void {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const updated: EvolutionSession = {
    ...session,
    metrics: {
      ...session.metrics,
      ...metrics,
    },
  };

  sessions.set(sessionId, updated);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function createInitialMetrics(): SessionMetrics {
  return {
    outerLoopIterations: 0,
    innerLoopExecutions: 0,
    totalComputeTimeMs: 0,
    peakMemoryBytes: 0,
    candidatesGenerated: 0,
    candidatesRejectedByTaste: 0,
    swarmDebatesRun: 0,
  };
}

function generateSummary(
  session: EvolutionSession
): EvolutionSessionSummary {
  const startingFitness =
    session.fitnessHistory[0]?.reduce(
      (max, f) => Math.max(max, f.aggregateScore),
      0
    ) || 0;

  const endingFitness = session.bestGenome
    ? Math.max(
        ...session.fitnessHistory.flatMap(gen =>
          gen.map(f => f.aggregateScore)
        ),
        0
      )
    : 0;

  const notableDiscoveries = session.population.filter(g => {
    const score = session.fitnessHistory
      .flat()
      .find(f => f.genomeId === g.id);
    return score && score.aggregateScore >= session.config.notableFitnessThreshold;
  });

  const summary: EvolutionSessionSummary = {
    sessionId: session.id,
    agentName: session.agentName,
    generationsEvolved: session.currentGeneration,
    startingBestFitness: startingFitness,
    endingBestFitness: endingFitness,
    notableDiscoveries,
    metrics: session.metrics,
  };

  return EvolutionSessionSummarySchema.parse(summary);
}

function getBestFitness(
  fitnessHistory: FitnessScore[][],
  genomeId: string
): number {
  const allScores = fitnessHistory.flat();
  const genomeScores = allScores.filter(f => f.genomeId === genomeId);
  if (genomeScores.length === 0) return 0;
  return Math.max(...genomeScores.map(f => f.aggregateScore));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════════════════════════════

export function clearSessions(): void {
  sessions.clear();
  sessionCheckpoints.clear();
}
