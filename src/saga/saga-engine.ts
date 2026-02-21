// SAGA Engine - Top-level coordinator for self-evolving goal agents
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import type {
  EvolutionConfig,
  EvolutionSession,
  EvolutionSessionInfo,
  EvolutionSessionSummary,
  GoalGenome,
  TastePattern,
} from './types.js';
import {
  createSession,
  pauseSession,
  resumeSession,
  stopSession,
  getSession,
  listSessions,
  updateSessionGeneration,
  updateSessionMetrics,
  checkBudget,
  checkpointSession,
  clearSessions,
} from './session-manager.js';
import {
  executeOuterLoop,
  createMockExecutor,
  type OuterLoopResult,
} from './outer-loop.js';
import { conductBatchDebate, createMockParticipant } from './swarm-debate.js';
import { isSwarmDebateEnabled, evaluateGate } from './autonomy-gating.js';
import { getPortfolioSeeds, persistGeneration } from './atlas-goal-store.js';
import { createSeedGenome } from './goal-genome.js';
import { evaluate } from './fitness-evaluator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SAGA Engine Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface SAGAEngineConfig {
  autonomyLevel: number;
  tastePatterns: TastePattern[];
  enableOvernight: boolean;
  overnightDurationMs: number;
}

export const DEFAULT_ENGINE_CONFIG: SAGAEngineConfig = {
  autonomyLevel: 3,
  tastePatterns: [],
  enableOvernight: false,
  overnightDurationMs: 8 * 60 * 60 * 1000, // 8 hours
};

// ═══════════════════════════════════════════════════════════════════════════════
// SAGA Engine Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export interface SAGAEngine {
  startSession(agentName: string, config: EvolutionConfig): Promise<EvolutionSession>;
  pauseSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<EvolutionSession>;
  stopSession(sessionId: string): Promise<EvolutionSessionSummary>;
  getSession(sessionId: string): EvolutionSession | undefined;
  listSessions(): EvolutionSessionInfo[];
}

class SAGAEngineImpl implements SAGAEngine {
  private engineConfig: SAGAEngineConfig;
  private activeLoops = new Map<string, AbortController>();
  private sessionStartTimes = new Map<string, number>();

  constructor(config: Partial<SAGAEngineConfig> = {}) {
    this.engineConfig = { ...DEFAULT_ENGINE_CONFIG, ...config };
  }

  async startSession(
    agentName: string,
    config: EvolutionConfig
  ): Promise<EvolutionSession> {
    // Create initial population with potential portfolio seeds
    const initialPopulation = await this.createInitialPopulation(agentName, config);

    // Create session
    const session = createSession(agentName, initialPopulation, config);
    this.sessionStartTimes.set(session.id, Date.now());

    // Start evolution in background
    this.runEvolution(session.id, config);

    return session;
  }

  async pauseSession(sessionId: string): Promise<void> {
    // Signal the evolution loop to pause
    const controller = this.activeLoops.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeLoops.delete(sessionId);
    }

    await pauseSession(sessionId);
  }

  async resumeSession(sessionId: string): Promise<EvolutionSession> {
    const session = await resumeSession(sessionId);

    // Resume evolution
    this.runEvolution(session.id, session.config);

    return session;
  }

  async stopSession(sessionId: string): Promise<EvolutionSessionSummary> {
    // Signal the evolution loop to stop
    const controller = this.activeLoops.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeLoops.delete(sessionId);
    }

    this.sessionStartTimes.delete(sessionId);
    return stopSession(sessionId);
  }

  getSession(sessionId: string): EvolutionSession | undefined {
    return getSession(sessionId);
  }

  listSessions(): EvolutionSessionInfo[] {
    return listSessions();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private async createInitialPopulation(
    agentName: string,
    config: EvolutionConfig
  ): Promise<GoalGenome[]> {
    const population: GoalGenome[] = [];

    // Seed with portfolio genomes from other agents
    const portfolioPercent = config.portfolioSeedPercent;
    const portfolioCount = Math.floor(config.populationSize * portfolioPercent);

    if (portfolioCount > 0) {
      const seeds = await getPortfolioSeeds(
        agentName,
        config.minFitnessThreshold,
        portfolioCount
      );
      population.push(...seeds);
    }

    // Fill remaining with random seed genomes
    const remainingCount = config.populationSize - population.length;
    for (let i = 0; i < remainingCount; i++) {
      const seed = createSeedGenome(agentName, [
        {
          id: `seed-${i}`,
          description: `Evolved objective ${i}`,
          domain: 'general',
          parameters: { priority: Math.random() },
          weight: Math.random(),
        },
      ]);
      population.push(seed);
    }

    return population;
  }

  private async runEvolution(
    sessionId: string,
    config: EvolutionConfig
  ): Promise<void> {
    const controller = new AbortController();
    this.activeLoops.set(sessionId, controller);

    const session = getSession(sessionId);
    if (!session) return;

    const startTime = this.sessionStartTimes.get(sessionId) || Date.now();

    try {
      const result = await executeOuterLoop({
        initialPopulation: session.population,
        tastePatterns: this.engineConfig.tastePatterns,
        executor: createMockExecutor(0.8),
        config,
        onGeneration: (gen, bestFitness) => {
          // Update session with generation results
          updateSessionGeneration(sessionId, gen, session.population, []);

          // Check autonomy gating
          const gateDecision = evaluateGate(
            this.engineConfig.autonomyLevel,
            gen,
            bestFitness,
            session.fitnessHistory.length > 0
              ? Math.max(
                  ...session.fitnessHistory[session.fitnessHistory.length - 1].map(
                    f => f.aggregateScore
                  )
                )
              : 0
          );

          if (gateDecision.shouldPause) {
            controller.abort();
          }

          // Checkpoint periodically
          if (gen % 5 === 0) {
            checkpointSession(sessionId);
          }
        },
        shouldStop: () => {
          // Check budget
          const budgetStatus = checkBudget(session, startTime, 0);
          if (budgetStatus !== 'ok') {
            return true;
          }

          return controller.signal.aborted;
        },
      });

      // Handle Swarm Debate if enabled
      if (isSwarmDebateEnabled(this.engineConfig.autonomyLevel)) {
        await this.runSwarmDebate(sessionId, result.finalPopulation);
      }

      // Persist final generation
      const fitnessScores = result.finalPopulation.map(g =>
        evaluate(g, { genomeId: g.id, taskResults: [], totalDuration: 0, iterationsCompleted: 0, partial: false }, [], [])
      );
      await persistGeneration(result.finalPopulation, fitnessScores);

      // Update final metrics
      updateSessionMetrics(sessionId, {
        outerLoopIterations: result.generations,
        candidatesGenerated: result.generations * config.populationSize,
      });
    } catch (error) {
      console.error(`Evolution error for session ${sessionId}:`, error);
    } finally {
      this.activeLoops.delete(sessionId);
    }
  }

  private async runSwarmDebate(
    sessionId: string,
    candidates: GoalGenome[]
  ): Promise<void> {
    // Create mock participants
    const participants = [
      createMockParticipant('agent1', 0.7),
      createMockParticipant('agent2', 0.6),
      createMockParticipant('agent3', 0.8),
    ];

    // Run debate on top candidates
    const topCandidates = candidates.slice(0, 5);
    await conductBatchDebate(topCandidates, participants);

    // Update metrics
    updateSessionMetrics(sessionId, { swarmDebatesRun: 1 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createSAGAEngine(
  config?: Partial<SAGAEngineConfig>
): SAGAEngine {
  return new SAGAEngineImpl(config);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════════════════════════════

export function resetSAGAEngine(): void {
  clearSessions();
}
