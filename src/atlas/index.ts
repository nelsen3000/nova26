// KronosAtlas - Triple-write ATLAS layer (local files + Kronos + Convex cloud)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { KronosClient } from './kronos-client.js';
import { ConvexAtlasClient } from './convex-client.js';
import type { KronosEntry, KronosSearchResult } from './types.js';
import type { BuildLog } from '../types/index.js';

// Re-export for external usage
export { KronosRetrospective } from './retrospective.js';
export { ConvexAtlasClient } from './convex-client.js';

// R19-02: Deep Semantic Model exports
export type {
  SemanticModelConfig,
  CodeNode,
  CodeEdge,
  CodeGraph,
  ImpactAnalysisResult,
  SemanticDiffSummary,
  CompactedContext,
} from './types.js';

export { SemanticModel, createSemanticModel } from './semantic-model.js';
export { ImpactAnalyzer, createImpactAnalyzer } from './impact-analyzer.js';
export { SemanticDiffer, createSemanticDiffer } from './semantic-differ.js';
export { ContextCompactor, createContextCompactor } from './context-compactor.js';
export { GraphMemory, createGraphMemory } from './graph-memory.js';

// R23-03: Infinite Hierarchical Memory exports
export type {
  MemoryLevel,
  HierarchicalMemoryNode,
  MemoryEdge,
  InfiniteMemoryGraph,
  QueryOptions,
  MigrationResult,
  PruneResult,
} from './infinite-memory-core.js';

export {
  ATLASInfiniteMemory,
  getInfiniteMemory,
  resetInfiniteMemory,
  createInfiniteMemory,
} from './infinite-memory-core.js';

// Mem0 Adapter exports
export type {
  Mem0Config,
  Mem0Memory,
  Mem0SearchResult,
  Mem0StoreOptions,
  Mem0SearchOptions,
  Mem0HealthStatus,
  Mem0SyncResult,
} from './mem0-adapter.js';

export {
  Mem0Adapter,
  Mem0ApiError,
  Mem0NotFoundError,
  createMem0Adapter,
} from './mem0-adapter.js';

// Letta Soul Manager exports
export type {
  LettaConfig,
  LettaSoul,
  LettaSoulCreateInput,
  LettaSoulUpdateInput,
  LettaMemoryAddInput,
  LettaInteractionRecord,
  LettaHealthStatus,
} from './letta-soul-manager.js';

export {
  LettaSoulManager,
  LettaApiError,
  LettaNotFoundError,
  createLettaSoulManager,
} from './letta-soul-manager.js';

// Memory Taste Scorer exports
export type {
  TasteProfile,
  TasteScorerConfig,
  ScoredMemory,
  TasteAnalysis,
} from './memory-taste-scorer.js';

export {
  MemoryTasteScorer,
  createMemoryTasteScorer,
  createFromTasteVault,
} from './memory-taste-scorer.js';

const ATLAS_DIR = join(process.cwd(), '.nova', 'atlas');
const BUILDS_FILE = join(ATLAS_DIR, 'builds.json');

export interface LogBuildOptions {
  prdId: string;
  prdName: string;
  taskTitle: string;
  phase: number;
}

// K3-35: Hindsight hook callback type (avoids circular import)
export type HindsightBuildHook = (log: BuildLog, project: string, phase: number) => Promise<void>;

export class KronosAtlas {
  private kronos: KronosClient;
  private convex: ConvexAtlasClient;
  private hindsightHook?: HindsightBuildHook;

  constructor(kronosBaseUrl?: string, convexUrl?: string) {
    this.kronos = new KronosClient(kronosBaseUrl);
    this.convex = new ConvexAtlasClient(convexUrl);
  }

  /**
   * K3-35: Register an optional Hindsight memory hook.
   * Called after each successful logBuild() to persist build context in Hindsight.
   */
  setHindsightHook(hook: HindsightBuildHook): void {
    this.hindsightHook = hook;
  }

  /** Remove the Hindsight hook. */
  clearHindsightHook(): void {
    this.hindsightHook = undefined;
  }

  /**
   * Triple-write: local builds.json + Kronos semantic memory + Convex cloud.
   * Local write always happens. Kronos and Convex are best-effort.
   */
  async logBuild(log: BuildLog, project: string, phase: number = 0, options?: LogBuildOptions): Promise<void> {
    // 1. Always write to local file-based builds.json
    this.appendToBuildLog(log);

    // 2 & 3: Kronos + Convex in parallel (both best-effort)
    await Promise.all([
      this.ingestToKronos(log, project, phase),
      this.syncToConvex(log, options),
    ]);

    // 4. K3-35: Optional Hindsight hook (best-effort, never fails the build log)
    if (this.hindsightHook) {
      this.hindsightHook(log, project, phase).catch((err: unknown) => {
        console.warn('[Hindsight] Atlas hook failed:', err instanceof Error ? err.message : String(err));
      });
    }
  }

  /** Search Kronos for relevant patterns. Returns empty result if unavailable. */
  async searchPatterns(query: string, project?: string): Promise<KronosSearchResult> {
    return this.kronos.search(query, project);
  }

  /** Check if Kronos is available. */
  async isKronosAvailable(): Promise<boolean> {
    return this.kronos.healthCheck();
  }

  /** Check if Convex cloud sync is available. */
  async isConvexAvailable(): Promise<boolean> {
    return this.convex.isAvailable();
  }

  /** Mark a build as completed/failed in Convex cloud. */
  async completeBuild(prdId: string, status: 'completed' | 'failed', error?: string): Promise<void> {
    await this.convex.completeBuild(prdId, status, error);
  }

  /** Log a learning to Convex cloud (from retrospective analysis). */
  async logLearning(prdId: string, taskId: string, pattern: string, insight: string): Promise<void> {
    await this.convex.logLearning(prdId, taskId, pattern, insight);
  }

  private async ingestToKronos(log: BuildLog, project: string, phase: number): Promise<void> {
    try {
      const isHealthy = await this.kronos.healthCheck();
      if (!isHealthy) {
        console.warn('[KronosAtlas] Kronos unavailable — skipping memory ingest');
        return;
      }

      const entry: KronosEntry = {
        project,
        taskId: log.taskId,
        agent: log.agent,
        phase,
        content: log.response,
        tags: [log.agent, `phase-${phase}`, log.gatesPassed ? 'gates-passed' : 'gates-failed'],
      };

      await this.kronos.ingest(entry);
      const tokenEstimate = Math.ceil(log.response.length / 4);
      console.log(`[Kronos] Ingested ${log.taskId} (~${tokenEstimate} tokens)`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Kronos] Ingest failed: ${message}`);
    }
  }

  private async syncToConvex(log: BuildLog, options?: LogBuildOptions): Promise<void> {
    if (!options) return;

    try {
      await this.convex.logExecution(
        log,
        options.prdId,
        options.prdName,
        options.taskTitle,
        options.phase
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Convex] Sync failed: ${message}`);
    }
  }

  private appendToBuildLog(log: BuildLog): void {
    if (!existsSync(ATLAS_DIR)) {
      mkdirSync(ATLAS_DIR, { recursive: true });
    }

    let builds: BuildLog[] = [];
    if (existsSync(BUILDS_FILE)) {
      try {
        const raw = readFileSync(BUILDS_FILE, 'utf-8');
        builds = JSON.parse(raw) as BuildLog[];
      } catch {
        builds = [];
      }
    }

    builds.push(log);
    writeFileSync(BUILDS_FILE, JSON.stringify(builds, null, 2));
  }
}
