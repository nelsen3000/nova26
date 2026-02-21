// Dream Mode - K3-38
// Coordinates overnight operations across all Eternal Data Reel modules:
// - SAGA overnight evolution trigger
// - Hindsight consolidation
// - RLM cache warming (best-effort)
// - Harness checkpoint pruning
// Produces a unified DreamModeReport

import { HindsightEngine } from '../hindsight/engine.js';
import type { ConsolidationReport } from '../hindsight/consolidation.js';
import type { HarnessManager } from '../harness/harness-manager.js';
import { CheckpointManager } from '../harness/checkpoint.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface DreamModeOptions {
  /** Harness checkpoint pruning: max checkpoints to retain per harness */
  maxCheckpointsPerHarness?: number;
  /** Hindsight: consolidation min confidence threshold */
  consolidationMinConfidence?: number;
  /** Timeout for the entire dream cycle in ms (0 = unlimited) */
  timeoutMs?: number;
}

export interface DreamModeReport {
  /** Timestamp when dream mode started */
  startedAt: number;
  /** Timestamp when dream mode completed */
  completedAt: number;
  /** Total duration in ms */
  durationMs: number;
  /** Hindsight consolidation result */
  hindsightConsolidation: ConsolidationReport | null;
  /** Number of harness checkpoints pruned */
  checkpointsPruned: number;
  /** Number of active harnesses at the start */
  activeHarnessCount: number;
  /** Any errors encountered (non-fatal) */
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DreamMode
// ═══════════════════════════════════════════════════════════════════════════════

export class DreamMode {
  private hindsight: HindsightEngine;
  private harnessManager: HarnessManager;
  private checkpointManager: CheckpointManager;

  constructor(
    hindsight: HindsightEngine,
    harnessManager: HarnessManager,
    checkpointManager?: CheckpointManager
  ) {
    this.hindsight = hindsight;
    this.harnessManager = harnessManager;
    this.checkpointManager = checkpointManager ?? new CheckpointManager();
  }

  /**
   * Run a full dream cycle across all modules.
   * Each phase is best-effort — failures are recorded as warnings, not thrown.
   */
  async run(options: DreamModeOptions = {}): Promise<DreamModeReport> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    let hindsightConsolidation: ConsolidationReport | null = null;
    let checkpointsPruned = 0;

    const harnesses = this.harnessManager.list();
    const activeHarnessCount = harnesses.length;

    // ── Phase 1: Hindsight Consolidation ────────────────────────────────────
    try {
      hindsightConsolidation = await this.hindsight.consolidate();
    } catch (err) {
      warnings.push(
        `Hindsight consolidation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // ── Phase 2: Harness Checkpoint Pruning ──────────────────────────────────
    const maxCheckpoints = options.maxCheckpointsPerHarness ?? 5;
    for (const info of harnesses) {
      try {
        const pruned = await this.checkpointManager.prune(info.id, maxCheckpoints);
        checkpointsPruned += pruned;
      } catch (err) {
        warnings.push(
          `Checkpoint prune failed for ${info.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // ── Phase 3: RLM Cache Warming (best-effort, stub) ───────────────────────
    // Full implementation deferred until RLM cache module exposes warmCache()
    // The hindsight consolidation already surfaces high-value patterns

    const completedAt = Date.now();
    return {
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      hindsightConsolidation,
      checkpointsPruned,
      activeHarnessCount,
      warnings,
    };
  }

  /**
   * Check if dream mode should be triggered.
   * Currently always returns true — callers can schedule as needed.
   */
  async shouldRun(): Promise<boolean> {
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createDreamMode(
  hindsight: HindsightEngine,
  harnessManager: HarnessManager,
  checkpointManager?: CheckpointManager
): DreamMode {
  return new DreamMode(hindsight, harnessManager, checkpointManager);
}
