// Eval Store and Reporter Tests
// Comprehensive test suite for Task K10

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EvalStore,
  getEvalStore,
  resetEvalStore,
  RunNotFoundError,
} from './eval-store.js';
import {
  EvalReporter,
  getEvalReporter,
  resetEvalReporter,
} from './eval-reporter.js';
import type { EvalRun, EvalSuite, EvalCase } from './types.js';

describe('EvalStore', () => {
  let store: EvalStore;
  const testDir = './.eval-test-store';

  const createMockRun = (id: string, suiteId: string): EvalRun => ({
    id,
    suiteId,
    targetFn: 'test',
    results: [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      avgScore: 0,
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
    },
  });

  beforeEach(async () => {
    store = new EvalStore({ directory: testDir });
    await store.initialize();
  });

  afterEach(async () => {
    await store.clear();
  });

  describe('saveRun and getRun', () => {
    it('saves and retrieves a run', async () => {
      const run = createMockRun('run-1', 'suite-1');
      await store.saveRun(run);

      const retrieved = await store.getRun('run-1');
      expect(retrieved).toEqual(run);
    });

    it('returns undefined for non-existent run', async () => {
      const retrieved = await store.getRun('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('getRunOrThrow throws for non-existent', async () => {
      await expect(store.getRunOrThrow('non-existent')).rejects.toThrow(RunNotFoundError);
    });

    it('validates run before saving', async () => {
      const invalidRun = { id: 'bad' } as EvalRun;
      await expect(store.saveRun(invalidRun)).rejects.toThrow();
    });
  });

  describe('listRuns', () => {
    it('lists runs for a suite', async () => {
      await store.saveRun(createMockRun('run-1', 'suite-1'));
      await store.saveRun(createMockRun('run-2', 'suite-1'));
      await store.saveRun(createMockRun('run-3', 'suite-2'));

      const runs = await store.listRuns('suite-1');
      expect(runs).toHaveLength(2);
    });

    it('respects limit', async () => {
      for (let i = 0; i < 10; i++) {
        await store.saveRun(createMockRun(`run-${i}`, 'suite-1'));
      }

      const runs = await store.listRuns('suite-1', { limit: 5 });
      expect(runs).toHaveLength(5);
    });

    it('respects offset', async () => {
      for (let i = 0; i < 5; i++) {
        await store.saveRun(createMockRun(`run-${i}`, 'suite-1'));
      }

      const runs = await store.listRuns('suite-1', { offset: 3 });
      expect(runs).toHaveLength(2);
    });
  });

  describe('golden sets', () => {
    it('saves and retrieves golden set', async () => {
      const goldenSet = {
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
        scoringFunction: 'exactMatch',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        promotedAt: new Date().toISOString(),
        baselineScores: {},
      };

      await store.saveGoldenSet(goldenSet);
      const retrieved = await store.getGoldenSet('suite-1');

      expect(retrieved).toEqual(goldenSet);
    });
  });

  describe('getRunHistory', () => {
    it('returns history entries', async () => {
      const run = createMockRun('run-1', 'suite-1');
      run.results = [{
        caseId: 'c1',
        success: true,
        actualOutput: 'test',
        score: 0.9,
        latency: 100,
        timestamp: new Date().toISOString(),
      }];
      run.summary.passed = 1;
      run.summary.total = 1;
      run.summary.avgScore = 0.9;

      await store.saveRun(run);

      const history = await store.getRunHistory('suite-1');
      expect(history).toHaveLength(1);
      expect(history[0].passRate).toBe(1);
      expect(history[0].avgScore).toBe(0.9);
    });
  });

  describe('analyzeTrend', () => {
    it('analyzes improving trend', async () => {
      // Create runs with improving scores
      for (let i = 0; i < 10; i++) {
        const run = createMockRun(`run-${i}`, 'suite-1');
        run.summary.avgScore = 0.5 + i * 0.05; // Improving
        run.startedAt = new Date(Date.now() - (10 - i) * 1000).toISOString();
        await store.saveRun(run);
      }

      const analysis = await store.analyzeTrend('suite-1', 10);

      expect(analysis.direction).toBe('improving');
      expect(analysis.scoreChange).toBeGreaterThan(0);
    });

    it('analyzes degrading trend', async () => {
      // Create runs with degrading scores
      for (let i = 0; i < 10; i++) {
        const run = createMockRun(`run-${i}`, 'suite-1');
        run.summary.avgScore = 0.9 - i * 0.05; // Degrading
        run.startedAt = new Date(Date.now() - (10 - i) * 1000).toISOString();
        await store.saveRun(run);
      }

      const analysis = await store.analyzeTrend('suite-1', 10);

      expect(analysis.direction).toBe('degrading');
      expect(analysis.scoreChange).toBeLessThan(0);
    });

    it('returns stable with insufficient data', async () => {
      const analysis = await store.analyzeTrend('suite-1', 10);

      expect(analysis.direction).toBe('stable');
      expect(analysis.confidence).toBe(0);
    });
  });

  describe('deleteRun', () => {
    it('deletes existing run', async () => {
      const run = createMockRun('run-1', 'suite-1');
      await store.saveRun(run);

      expect(await store.deleteRun('run-1')).toBe(true);
      expect(await store.getRun('run-1')).toBeUndefined();
    });

    it('returns false for non-existent run', async () => {
      expect(await store.deleteRun('non-existent')).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EvalReporter Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('EvalReporter', () => {
  let reporter: EvalReporter;

  const createMockRun = (): EvalRun => ({
    id: 'run-1',
    suiteId: 'suite-1',
    targetFn: 'test',
    results: [
      {
        caseId: 'c1',
        success: true,
        actualOutput: 'test',
        score: 1.0,
        latency: 100,
        timestamp: new Date().toISOString(),
      },
      {
        caseId: 'c2',
        success: false,
        actualOutput: 'wrong',
        score: 0.3,
        latency: 150,
        timestamp: new Date().toISOString(),
        error: 'Mismatch',
      },
    ],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    summary: {
      total: 2,
      passed: 1,
      failed: 1,
      avgScore: 0.65,
      avgLatency: 125,
      p50Latency: 100,
      p95Latency: 150,
    },
  });

  beforeEach(() => {
    reporter = new EvalReporter();
  });

  describe('generateReport', () => {
    it('generates markdown report by default', () => {
      const run = createMockRun();
      const report = reporter.generateReport(run);

      expect(report).toContain('# Evaluation Report');
      expect(report).toContain('suite-1');
      expect(report).toContain('Summary');
    });

    it('generates JSON report', () => {
      const run = createMockRun();
      const report = reporter.generateReport(run, { format: 'json' });

      const parsed = JSON.parse(report);
      expect(parsed.run.id).toBe('run-1');
    });

    it('generates HTML report', () => {
      const run = createMockRun();
      const report = reporter.generateReport(run, { format: 'html' });

      expect(report).toContain('<!DOCTYPE html>');
      expect(report).toContain('Evaluation Report');
    });

    it('includes passed cases when requested', () => {
      const run = createMockRun();
      const report = reporter.generateReport(run, {
        format: 'markdown',
        includePassedCases: true,
      });

      expect(report).toContain('Passed Cases');
    });

    it('limits failures shown', () => {
      const run = createMockRun();
      const report = reporter.generateReport(run, {
        format: 'markdown',
        maxFailures: 1,
      });

      expect(report).toContain('Failures');
    });
  });

  describe('generateDiffReport', () => {
    it('compares two runs', () => {
      const runA = createMockRun();
      const runB = createMockRun();
      runB.results[0].score = 0.8; // Worse
      runB.results[1].score = 0.9; // Better

      const diff = reporter.generateDiffReport(runA, runB);

      expect(diff.runA).toBe('run-1');
      expect(diff.differences).toHaveLength(2);
      expect(diff.summary.improved).toBe(1);
      expect(diff.summary.regressed).toBe(1);
    });

    it('identifies significant changes', () => {
      const runA = createMockRun();
      const runB = createMockRun();
      runB.results[0].score = 0.97; // Small change (0.03 < threshold of 0.05), not significant

      const diff = reporter.generateDiffReport(runA, runB);

      expect(diff.differences[0].significant).toBe(false);
    });
  });

  describe('generateTrendReport', () => {
    it('generates trend markdown', () => {
      const history = [
        { runId: 'r1', suiteId: 's1', timestamp: new Date().toISOString(), passRate: 0.8, avgScore: 0.7, avgLatency: 100 },
        { runId: 'r2', suiteId: 's1', timestamp: new Date().toISOString(), passRate: 0.9, avgScore: 0.8, avgLatency: 90 },
      ];

      const analysis = {
        suiteId: 's1',
        window: 10,
        direction: 'improving' as const,
        scoreChange: 0.1,
        latencyChange: -10,
        passRateChange: 0.1,
        confidence: 0.8,
      };

      const report = reporter.generateTrendReport('s1', history, analysis);

      expect(report).toContain('# Trend Report');
      expect(report).toContain('IMPROVING');
      expect(report).toContain('Changes');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Singleton instances', () => {
  it('getEvalStore returns singleton', () => {
    const s1 = getEvalStore();
    const s2 = getEvalStore();
    expect(s1).toBe(s2);
  });

  it('getEvalReporter returns singleton', () => {
    const r1 = getEvalReporter();
    const r2 = getEvalReporter();
    expect(r1).toBe(r2);
  });
});
