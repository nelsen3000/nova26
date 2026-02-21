// SAGA Portfolio Learning - Cross-project knowledge sharing
// Spec: .kiro/specs/saga-self-evolving-agents/tasks.md

import type {
  GoalGenome,
  EvolutionConfig,
  FitnessScore,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface PortfolioLearningConfig {
  minPortfolioFitness: number;
  maxPortfolioSeedsPercent: number;
  reevaluateImportedGenomes: boolean;
  enableCrossProjectLogging: boolean;
}

export const DEFAULT_CONFIG: PortfolioLearningConfig = {
  minPortfolioFitness: 0.7,
  maxPortfolioSeedsPercent: 0.2, // 20% of population
  reevaluateImportedGenomes: true,
  enableCrossProjectLogging: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Portfolio Entry
// ═══════════════════════════════════════════════════════════════════════════════

export interface PortfolioEntry {
  genome: GoalGenome;
  originalProjectId: string;
  originalAgentName: string;
  originalFitness: number;
  importDate: number;
  reevaluatedFitness?: number;
  isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-Project Learning Log
// ═══════════════════════════════════════════════════════════════════════════════

export interface CrossProjectLearningEntry {
  timestamp: number;
  sourceProject: string;
  targetProject: string;
  genomeId: string;
  achievedFitness: number;
  notes: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Portfolio Store Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface PortfolioStore {
  save(entry: PortfolioEntry): Promise<void>;
  query(options: {
    minFitness?: number;
    projectId?: string;
    limit?: number;
  }): Promise<PortfolioEntry[]>;
  logLearning(entry: CrossProjectLearningEntry): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// In-Memory Portfolio Store
// ═══════════════════════════════════════════════════════════════════════════════

class InMemoryPortfolioStore implements PortfolioStore {
  private entries: PortfolioEntry[] = [];
  private logs: CrossProjectLearningEntry[] = [];

  async save(entry: PortfolioEntry): Promise<void> {
    this.entries.push(entry);
  }

  async query(options: {
    minFitness?: number;
    projectId?: string;
    limit?: number;
  }): Promise<PortfolioEntry[]> {
    let results = this.entries.filter(e => e.isActive);

    if (options.minFitness !== undefined) {
      results = results.filter(
        e =>
          (e.reevaluatedFitness || e.originalFitness) >= options.minFitness!
      );
    }

    if (options.projectId !== undefined) {
      results = results.filter(
        e => e.originalProjectId !== options.projectId
      );
    }

    // Sort by fitness
    results.sort(
      (a, b) =>
        (b.reevaluatedFitness || b.originalFitness) -
        (a.reevaluatedFitness || a.originalFitness)
    );

    if (options.limit !== undefined) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async logLearning(entry: CrossProjectLearningEntry): Promise<void> {
    this.logs.push(entry);
  }

  getLogs(): CrossProjectLearningEntry[] {
    return [...this.logs].sort((a, b) => b.timestamp - a.timestamp);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Portfolio Learning
// ═══════════════════════════════════════════════════════════════════════════════

export class PortfolioLearning {
  private config: PortfolioLearningConfig;
  private store: PortfolioStore;

  constructor(
    store: PortfolioStore = new InMemoryPortfolioStore(),
    config?: Partial<PortfolioLearningConfig>
  ) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Seed Portfolio
  // ═══════════════════════════════════════════════════════════════════════════

  async seedPortfolio(
    projectId: string,
    agentName: string,
    genomes: GoalGenome[],
    fitnessScores: FitnessScore[]
  ): Promise<void> {
    for (const genome of genomes) {
      const fitness = fitnessScores.find(f => f.genomeId === genome.id);
      if (!fitness || fitness.aggregateScore < this.config.minPortfolioFitness) {
        continue;
      }

      const entry: PortfolioEntry = {
        genome,
        originalProjectId: projectId,
        originalAgentName: agentName,
        originalFitness: fitness.aggregateScore,
        importDate: Date.now(),
        isActive: true,
      };

      await this.store.save(entry);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Get Portfolio Seeds
  // ═══════════════════════════════════════════════════════════════════════════

  async getSeeds(
    targetProjectId: string,
    populationSize: number,
    evolutionConfig: EvolutionConfig
  ): Promise<GoalGenome[]> {
    const maxSeeds = Math.floor(
      populationSize * evolutionConfig.portfolioSeedPercent
    );

    const entries = await this.store.query({
      minFitness: this.config.minPortfolioFitness,
      projectId: targetProjectId,
      limit: maxSeeds,
    });

    return entries.map(e => e.genome);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Re-evaluate Imported Genome
  // ═══════════════════════════════════════════════════════════════════════════

  async reevaluateGenome(
    genome: GoalGenome,
    currentObjectives: string[],
    evaluator: (genome: GoalGenome) => Promise<number>
  ): Promise<number> {
    if (!this.config.reevaluateImportedGenomes) {
      return 0.5; // Neutral score if not reevaluating
    }

    // Re-run fitness evaluation against current objectives
    const fitness = await evaluator(genome);
    return fitness;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Log Cross-Project Learning
  // ═══════════════════════════════════════════════════════════════════════════

  async logCrossProjectSuccess(
    sourceProject: string,
    targetProject: string,
    genome: GoalGenome,
    achievedFitness: number,
    notes?: string
  ): Promise<void> {
    if (!this.config.enableCrossProjectLogging) {
      return;
    }

    const entry: CrossProjectLearningEntry = {
      timestamp: Date.now(),
      sourceProject,
      targetProject,
      genomeId: genome.id,
      achievedFitness,
      notes: notes || `Genome from ${sourceProject} achieved fitness ${achievedFitness.toFixed(2)}`,
    };

    await this.store.logLearning(entry);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Get Learning Statistics
  // ═══════════════════════════════════════════════════════════════════════════

  async getStatistics(): Promise<{
    totalEntries: number;
    activeEntries: number;
    averageOriginalFitness: number;
    crossProjectSuccesses: number;
  }> {
    const allEntries = await this.store.query({});
    const activeEntries = allEntries.filter(e => e.isActive);

    const avgFitness =
      allEntries.length > 0
        ? allEntries.reduce((sum, e) => sum + e.originalFitness, 0) /
          allEntries.length
        : 0;

    return {
      totalEntries: allEntries.length,
      activeEntries: activeEntries.length,
      averageOriginalFitness: avgFitness,
      crossProjectSuccesses: 0, // Would be tracked in real implementation
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createPortfolioLearning(
  store?: PortfolioStore,
  config?: Partial<PortfolioLearningConfig>
): PortfolioLearning {
  return new PortfolioLearning(store, config);
}
