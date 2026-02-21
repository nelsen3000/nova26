// Eval Store - Persistence for evaluation runs and golden sets
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-05)

import { promises as fs } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import {
  EvalRunSchema,
  GoldenSetSchema,
  type EvalRun,
  type GoldenSet,
  type RunHistoryEntry,
  type TrendAnalysis,
  type EvalStoreOptions,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Error Classes
// ═══════════════════════════════════════════════════════════════════════════════

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Run not found: ${runId}`);
    this.name = 'RunNotFoundError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EvalStore Class
// ═══════════════════════════════════════════════════════════════════════════════

export class EvalStore {
  private directory: string;
  private maxRunsPerSuite: number;
  private runs: Map<string, EvalRun>;
  private goldenSets: Map<string, GoldenSet>;

  constructor(options: EvalStoreOptions = {}) {
    this.directory = options.directory ?? './.eval-store';
    this.maxRunsPerSuite = options.maxRunsPerSuite ?? 100;
    this.runs = new Map();
    this.goldenSets = new Map();
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
      await fs.mkdir(join(this.directory, 'runs'), { recursive: true });
      await fs.mkdir(join(this.directory, 'golden-sets'), { recursive: true });
    } catch (error) {
      throw new StoreError(`Failed to initialize store: ${error}`);
    }
  }

  /**
   * Save an evaluation run
   */
  async saveRun(run: EvalRun): Promise<void> {
    // Validate
    const validated = EvalRunSchema.parse(run);

    // Save to memory
    this.runs.set(run.id, validated);

    // Save to file
    const filePath = join(this.directory, 'runs', `${run.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(validated, null, 2));

    // Cleanup old runs for this suite
    await this.cleanupOldRuns(run.suiteId);
  }

  /**
   * Get a run by ID
   */
  async getRun(runId: string): Promise<EvalRun | undefined> {
    // Check memory first
    const cached = this.runs.get(runId);
    if (cached) return cached;

    // Try to load from file
    try {
      const filePath = join(this.directory, 'runs', `${runId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const run = EvalRunSchema.parse(JSON.parse(data));
      this.runs.set(runId, run);
      return run;
    } catch {
      return undefined;
    }
  }

  /**
   * Get run or throw
   */
  async getRunOrThrow(runId: string): Promise<EvalRun> {
    const run = await this.getRun(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }
    return run;
  }

  /**
   * List runs for a suite
   */
  async listRuns(
    suiteId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'timestamp' | 'score';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<EvalRun[]> {
    const { limit = 50, offset = 0, sortBy = 'timestamp', sortOrder = 'desc' } = options;

    // Get all runs for suite
    const runs: EvalRun[] = [];

    // Check memory
    for (const run of this.runs.values()) {
      if (run.suiteId === suiteId) {
        runs.push(run);
      }
    }

    // Check files
    try {
      const runsDir = join(this.directory, 'runs');
      const files = await fs.readdir(runsDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const runId = file.replace('.json', '');
          if (!this.runs.has(runId)) {
            const run = await this.getRun(runId);
            if (run && run.suiteId === suiteId) {
              runs.push(run);
            }
          }
        }
      }
    } catch {
      // Directory might not exist yet
    }

    // Sort
    runs.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'timestamp') {
        comparison = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      } else if (sortBy === 'score') {
        comparison = a.summary.avgScore - b.summary.avgScore;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Paginate
    return runs.slice(offset, offset + limit);
  }

  /**
   * Save a golden set
   */
  async saveGoldenSet(goldenSet: GoldenSet): Promise<void> {
    // Validate
    const validated = GoldenSetSchema.parse(goldenSet);

    // Save to memory
    this.goldenSets.set(goldenSet.id, validated);

    // Save to file
    const filePath = join(this.directory, 'golden-sets', `${goldenSet.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(validated, null, 2));
  }

  /**
   * Get a golden set
   */
  async getGoldenSet(suiteId: string): Promise<GoldenSet | undefined> {
    // Check memory first
    const cached = this.goldenSets.get(suiteId);
    if (cached) return cached;

    // Try to load from file
    try {
      const filePath = join(this.directory, 'golden-sets', `${suiteId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const goldenSet = GoldenSetSchema.parse(JSON.parse(data));
      this.goldenSets.set(suiteId, goldenSet);
      return goldenSet;
    } catch {
      return undefined;
    }
  }

  /**
   * Get run history for trend analysis
   */
  async getRunHistory(
    suiteId: string,
    window: number = 30
  ): Promise<RunHistoryEntry[]> {
    const runs = await this.listRuns(suiteId, { limit: window });

    return runs.map(run => ({
      runId: run.id,
      suiteId: run.suiteId,
      timestamp: run.completedAt,
      passRate: run.summary.total > 0
        ? run.summary.passed / run.summary.total
        : 0,
      avgScore: run.summary.avgScore,
      avgLatency: run.summary.avgLatency,
    }));
  }

  /**
   * Analyze trends over time
   */
  async analyzeTrend(
    suiteId: string,
    window: number = 10
  ): Promise<TrendAnalysis> {
    const history = await this.getRunHistory(suiteId, window);

    if (history.length < 2) {
      return {
        suiteId,
        window,
        direction: 'stable',
        scoreChange: 0,
        latencyChange: 0,
        passRateChange: 0,
        confidence: 0,
      };
    }

    // Reverse history to ensure oldest runs come first (listRuns returns newest first)
    const sortedHistory = history.reverse();

    // Split into first (older) and second (newer) half
    const mid = Math.floor(sortedHistory.length / 2);
    const firstHalf = sortedHistory.slice(0, mid);
    const secondHalf = sortedHistory.slice(mid);

    // Calculate averages
    const avgFirst = {
      score: firstHalf.reduce((s, h) => s + h.avgScore, 0) / firstHalf.length,
      latency: firstHalf.reduce((s, h) => s + h.avgLatency, 0) / firstHalf.length,
      passRate: firstHalf.reduce((s, h) => s + h.passRate, 0) / firstHalf.length,
    };

    const avgSecond = {
      score: secondHalf.reduce((s, h) => s + h.avgScore, 0) / secondHalf.length,
      latency: secondHalf.reduce((s, h) => s + h.avgLatency, 0) / secondHalf.length,
      passRate: secondHalf.reduce((s, h) => s + h.passRate, 0) / secondHalf.length,
    };

    // Calculate changes
    const scoreChange = avgSecond.score - avgFirst.score;
    const latencyChange = avgSecond.latency - avgFirst.latency;
    const passRateChange = avgSecond.passRate - avgFirst.passRate;

    // Determine direction
    let direction: TrendAnalysis['direction'] = 'stable';
    const threshold = 0.05;

    if (scoreChange > threshold || passRateChange > threshold) {
      direction = 'improving';
    } else if (scoreChange < -threshold || passRateChange < -threshold) {
      direction = 'degrading';
    }

    // Calculate confidence based on data points
    const confidence = Math.min(1, history.length / window);

    return {
      suiteId,
      window,
      direction,
      scoreChange,
      latencyChange,
      passRateChange,
      confidence,
    };
  }

  /**
   * Delete a run
   */
  async deleteRun(runId: string): Promise<boolean> {
    this.runs.delete(runId);

    try {
      const filePath = join(this.directory, 'runs', `${runId}.json`);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    this.runs.clear();
    this.goldenSets.clear();

    try {
      await fs.rm(this.directory, { recursive: true });
    } catch {
      // Ignore errors
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  private async cleanupOldRuns(suiteId: string): Promise<void> {
    const runs = await this.listRuns(suiteId, {
      limit: this.maxRunsPerSuite + 10,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });

    if (runs.length > this.maxRunsPerSuite) {
      const toDelete = runs.slice(this.maxRunsPerSuite);
      for (const run of toDelete) {
        await this.deleteRun(run.id);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalStore: EvalStore | null = null;

export function getEvalStore(options?: EvalStoreOptions): EvalStore {
  if (!globalStore) {
    globalStore = new EvalStore(options);
  }
  return globalStore;
}

export function resetEvalStore(): void {
  globalStore = null;
}
