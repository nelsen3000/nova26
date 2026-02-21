// SAGA Overnight Evolution - Time-batched autonomous evolution
// Spec: .kiro/specs/saga-self-evolving-agents/tasks.md

import type {
  EvolutionSession,
  EvolutionSessionSummary,
  EvolutionConfig,
  GoalGenome,
} from './types.js';
import type { SAGAEngine } from './saga-engine.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface OvernightEvolutionConfig {
  durationMs: number;
  checkpointIntervalMs: number;
  autoStartTime?: string; // ISO time (e.g., "02:00")
  minFitnessThreshold: number;
  maxGenerations: number;
}

export const DEFAULT_CONFIG: OvernightEvolutionConfig = {
  durationMs: 8 * 60 * 60 * 1000, // 8 hours
  checkpointIntervalMs: 30 * 60 * 1000, // 30 minutes
  minFitnessThreshold: 0.7,
  maxGenerations: 100,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Overnight Evolution Report
// ═══════════════════════════════════════════════════════════════════════════════

export interface OvernightReport {
  sessionId: string;
  agentName: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  generationsEvolved: number;
  startingBestFitness: number;
  endingBestFitness: number;
  fitnessImprovement: number;
  checkpointCount: number;
  notableDiscoveries: GoalGenome[];
  wasStopped: boolean;
  stopReason?: 'completed' | 'time_exceeded' | 'fitness_threshold' | 'manual';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Overnight Evolution Runner
// ═══════════════════════════════════════════════════════════════════════════════

export class OvernightEvolution {
  private engine: SAGAEngine;
  private config: OvernightEvolutionConfig;
  private activeSessions = new Map<string, string>(); // sessionId -> agentName
  private checkpoints = new Map<string, number>(); // sessionId -> checkpoint count

  constructor(engine: SAGAEngine, config?: Partial<OvernightEvolutionConfig>) {
    this.engine = engine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Start Overnight Evolution
  // ═══════════════════════════════════════════════════════════════════════════

  async start(
    agentName: string,
    evolutionConfig?: Partial<EvolutionConfig>
  ): Promise<EvolutionSession> {
    const config: EvolutionConfig = {
      maxIterations: this.config.maxGenerations,
      maxComputeTimeMs: this.config.durationMs,
      maxMemoryBytes: 16 * 1024 * 1024, // 16MB
      populationSize: 20,
      minFitnessThreshold: this.config.minFitnessThreshold,
      portfolioSeedPercent: 0.2,
      checkpointIntervalMs: this.config.checkpointIntervalMs,
      enableSwarmDebate: true,
      notableFitnessThreshold: 0.85,
      ...evolutionConfig,
    };

    const session = await this.engine.startSession(agentName, config);
    this.activeSessions.set(session.id, agentName);
    this.checkpoints.set(session.id, 0);

    return session;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Monitor and Checkpoint
  // ═══════════════════════════════════════════════════════════════════════════

  async checkpoint(sessionId: string): Promise<void> {
    const session = this.engine.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Record checkpoint
    const count = this.checkpoints.get(sessionId) || 0;
    this.checkpoints.set(sessionId, count + 1);

    // In a real implementation, this would persist state
    console.log(`[Overnight] Checkpoint ${count + 1} for session ${sessionId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Generate Report
  // ═══════════════════════════════════════════════════════════════════════════

  async generateReport(sessionId: string): Promise<OvernightReport> {
    const session = this.engine.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const summary = await this.engine.stopSession(sessionId);
    const agentName = this.activeSessions.get(sessionId) || 'unknown';

    const startingFitness = summary.startingBestFitness;
    const endingFitness = summary.endingBestFitness;
    const improvement = endingFitness - startingFitness;

    const report: OvernightReport = {
      sessionId,
      agentName,
      startedAt: new Date(session.startedAt).getTime(),
      completedAt: Date.now(),
      durationMs: Date.now() - new Date(session.startedAt).getTime(),
      generationsEvolved: summary.generationsEvolved,
      startingBestFitness: startingFitness,
      endingBestFitness: endingFitness,
      fitnessImprovement: improvement,
      checkpointCount: this.checkpoints.get(sessionId) || 0,
      notableDiscoveries: summary.notableDiscoveries,
      wasStopped: session.status === 'stopped',
      stopReason: this.determineStopReason(session, summary),
    };

    this.activeSessions.delete(sessionId);
    this.checkpoints.delete(sessionId);

    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Schedule
  // ═══════════════════════════════════════════════════════════════════════════

  schedule(agentName: string, startTime: string): void {
    // In a real implementation, this would use a scheduler like node-cron
    console.log(`[Overnight] Scheduled evolution for ${agentName} at ${startTime}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // List Active
  // ═══════════════════════════════════════════════════════════════════════════

  listActive(): Array<{ sessionId: string; agentName: string; checkpointCount: number }> {
    return Array.from(this.activeSessions.entries()).map(([sessionId, agentName]) => ({
      sessionId,
      agentName,
      checkpointCount: this.checkpoints.get(sessionId) || 0,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private determineStopReason(
    session: EvolutionSession,
    summary: EvolutionSessionSummary
  ): OvernightReport['stopReason'] {
    if (session.status === 'stopped') {
      return 'manual';
    }
    if (summary.endingBestFitness >= this.config.minFitnessThreshold) {
      return 'fitness_threshold';
    }
    if (summary.generationsEvolved >= this.config.maxGenerations) {
      return 'completed';
    }
    return 'time_exceeded';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createOvernightEvolution(
  engine: SAGAEngine,
  config?: Partial<OvernightEvolutionConfig>
): OvernightEvolution {
  return new OvernightEvolution(engine, config);
}
