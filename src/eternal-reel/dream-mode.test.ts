// Dream Mode Tests - K3-38
import { describe, it, expect, beforeEach } from 'vitest';
import { DreamMode, createDreamMode } from './dream-mode.js';
import { createHindsightEngine } from '../hindsight/engine.js';
import { createHarnessManager } from '../harness/harness-manager.js';
import { CheckpointManager } from '../harness/checkpoint.js';
import type { HarnessConfig } from '../harness/types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeHarnessConfig(id: string): HarnessConfig {
  return {
    id,
    name: `DM Test ${id}`,
    agentId: 'agent-dm',
    task: 'dream mode test',
    priority: 'normal',
    timeoutMs: 0,
    maxRetries: 1,
    autonomyLevel: 3,
    maxDepth: 1,
    depth: 0,
    allowedTools: [],
    budget: { maxToolCalls: 10, maxTokens: 1000, maxCost: 1 },
    checkpointIntervalMs: 30000,
    dreamModeEnabled: true,
    overnightEvolutionEnabled: false,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DreamMode', () => {
  let dreamMode: DreamMode;

  beforeEach(() => {
    const hindsight = createHindsightEngine({ namespace: 'dream-test' });
    const harnessManager = createHarnessManager();
    dreamMode = createDreamMode(hindsight, harnessManager);
  });

  describe('run()', () => {
    it('returns a DreamModeReport', async () => {
      const report = await dreamMode.run();
      expect(report).toBeDefined();
      expect(report.startedAt).toBeGreaterThan(0);
      expect(report.completedAt).toBeGreaterThanOrEqual(report.startedAt);
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('reports active harness count', async () => {
      const manager = createHarnessManager();
      manager.create(makeHarnessConfig('dm-h1'));
      manager.create(makeHarnessConfig('dm-h2'));
      const dm = createDreamMode(createHindsightEngine({ namespace: 'n1' }), manager);
      const report = await dm.run();
      expect(report.activeHarnessCount).toBe(2);
    });

    it('starts with zero harnesses when manager is empty', async () => {
      const report = await dreamMode.run();
      expect(report.activeHarnessCount).toBe(0);
    });

    it('completes hindsight consolidation phase', async () => {
      const report = await dreamMode.run();
      // With no fragments, consolidation should return a valid (possibly empty) report
      expect(report.hindsightConsolidation).not.toBeNull();
    });

    it('has no warnings when all phases succeed', async () => {
      const report = await dreamMode.run();
      expect(report.warnings).toHaveLength(0);
    });

    it('pruning counts are ≥ 0', async () => {
      const report = await dreamMode.run();
      expect(report.checkpointsPruned).toBeGreaterThanOrEqual(0);
    });

    it('accepts maxCheckpointsPerHarness option', async () => {
      const report = await dreamMode.run({ maxCheckpointsPerHarness: 3 });
      expect(report).toBeDefined();
    });

    it('runs multiple times without error', async () => {
      await dreamMode.run();
      const report2 = await dreamMode.run();
      expect(report2.warnings).toHaveLength(0);
    });
  });

  describe('shouldRun()', () => {
    it('always returns true', async () => {
      expect(await dreamMode.shouldRun()).toBe(true);
    });
  });

  describe('createDreamMode()', () => {
    it('creates instance with default CheckpointManager', () => {
      const hindsight = createHindsightEngine({ namespace: 'x' });
      const manager = createHarnessManager();
      const dm = createDreamMode(hindsight, manager);
      expect(dm).toBeInstanceOf(DreamMode);
    });

    it('accepts custom CheckpointManager', () => {
      const hindsight = createHindsightEngine({ namespace: 'x' });
      const manager = createHarnessManager();
      const cp = new CheckpointManager();
      const dm = createDreamMode(hindsight, manager, cp);
      expect(dm).toBeInstanceOf(DreamMode);
    });
  });
});
