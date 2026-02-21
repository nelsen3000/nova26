// Eval Runner and Golden Sets Tests
// Comprehensive test suite for Task K9

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EvalRunner,
  getEvalRunner,
  resetEvalRunner,
  EvalRunnerError,
  EvalTimeoutError,
} from './eval-runner.js';
import {
  GoldenSetManager,
  getGoldenSetManager,
  resetGoldenSetManager,
  GoldenSetNotFoundError,
} from './golden-sets.js';
import { EvalRegistry, getEvalRegistry, resetEvalRegistry } from './eval-registry.js';
import type { EvalCase, EvalSuite, EvalRun } from './types.js';

describe('EvalRunner', () => {
  let runner: EvalRunner;
  let registry: EvalRegistry;

  const createCase = (id: string, input: unknown, expected: unknown): EvalCase => ({
    id,
    name: `Case ${id}`,
    input,
    expectedOutput: expected,
    threshold: 0.8,
  });

  beforeEach(() => {
    resetEvalRunner();
    resetEvalRegistry();
    resetGoldenSetManager();
    runner = new EvalRunner();
    registry = new EvalRegistry();
  });

  describe('run', () => {
    it('executes all cases in a suite', async () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [
          createCase('c1', 'hello', 'hello'),
          createCase('c2', 'world', 'world'),
        ],
      });

      const targetFn = (input: unknown) => input;
      const run = await runner.run(suite.id, targetFn);

      expect(run.results).toHaveLength(2);
      expect(run.summary.total).toBe(2);
    });

    it('calculates correct scores', async () => {
      const suite = registry.createSuite({
        id: 'suite-2',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      const targetFn = (input: unknown) => input;
      const run = await runner.run(suite.id, targetFn);

      expect(run.results[0].score).toBe(1);
      expect(run.results[0].success).toBe(true);
    });

    it('handles failing cases', async () => {
      const suite = registry.createSuite({
        id: 'suite-3',
        name: 'Test Suite',
        cases: [createCase('c1', 'hello', 'world')],
      });

      const targetFn = (input: unknown) => input;
      const run = await runner.run(suite.id, targetFn);

      expect(run.results[0].score).toBe(0);
      expect(run.results[0].success).toBe(false);
      expect(run.summary.passed).toBe(0);
      expect(run.summary.failed).toBe(1);
    });

    it('measures latency', async () => {
      const suite = registry.createSuite({
        id: 'suite-4',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      const targetFn = async (input: unknown) => {
        await new Promise(r => setTimeout(r, 10));
        return input;
      };

      const run = await runner.run(suite.id, targetFn);

      expect(run.results[0].latency).toBeGreaterThanOrEqual(10);
    });

    it('calls progress callback', async () => {
      const suite = registry.createSuite({
        id: 'suite-5',
        name: 'Test Suite',
        cases: [
          createCase('c1', 'a', 'a'),
          createCase('c2', 'b', 'b'),
        ],
      });

      const progressCallback = vi.fn();
      const targetFn = (input: unknown) => input;

      await runner.run(suite.id, targetFn, { progressCallback });

      expect(progressCallback).toHaveBeenCalled();
    });

    it('respects concurrency limit', async () => {
      const suite = registry.createSuite({
        id: 'suite-6',
        name: 'Test Suite',
        cases: Array.from({ length: 10 }, (_, i) =>
          createCase(`c${i}`, `input${i}`, `input${i}`)
        ),
      });

      const targetFn = (input: unknown) => input;
      const run = await runner.run(suite.id, targetFn, { concurrency: 3 });

      expect(run.results).toHaveLength(10);
    });

    it('handles errors gracefully', async () => {
      const suite = registry.createSuite({
        id: 'suite-7',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      const targetFn = () => {
        throw new Error('Test error');
      };

      const run = await runner.run(suite.id, targetFn);

      expect(run.results[0].success).toBe(false);
      expect(run.results[0].error).toContain('Test error');
    });

    it('includes timestamps', async () => {
      const suite = registry.createSuite({
        id: 'suite-8',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      const targetFn = (input: unknown) => input;
      const run = await runner.run(suite.id, targetFn);

      expect(run.startedAt).toBeDefined();
      expect(run.completedAt).toBeDefined();
      expect(new Date(run.completedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(run.startedAt).getTime()
      );
    });

    it('throws if suite not found', async () => {
      await expect(runner.run('non-existent', (x) => x)).rejects.toThrow();
    });
  });

  describe('quickRun', () => {
    it('runs cases without registering suite', async () => {
      const cases = [createCase('c1', 'test', 'test')];
      const targetFn = (input: unknown) => input;

      const run = await runner.quickRun(cases, targetFn);

      expect(run.results).toHaveLength(1);
      expect(run.summary.passed).toBe(1);
    });

    it('cleans up temporary suite', async () => {
      const cases = [createCase('c1', 'test', 'test')];
      const targetFn = (input: unknown) => input;

      await runner.quickRun(cases, targetFn);

      // Suite should be removed
      const globalRegistry = getEvalRegistry();
      const tempSuites = globalRegistry.listSuites().filter(s =>
        s.id.startsWith('quick-')
      );
      expect(tempSuites).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GoldenSetManager Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('GoldenSetManager', () => {
  let manager: GoldenSetManager;
  let registry: EvalRegistry;

  const createCase = (id: string, input: unknown, expected: unknown): EvalCase => ({
    id,
    name: `Case ${id}`,
    input,
    expectedOutput: expected,
    threshold: 0.8,
  });

  beforeEach(() => {
    resetGoldenSetManager();
    resetEvalRegistry();
    manager = new GoldenSetManager();
    registry = new EvalRegistry();
  });

  describe('createGoldenSet', () => {
    it('creates golden set from suite', () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      const goldenSet = manager.createGoldenSet(suite);

      expect(goldenSet.version).toBe(1);
      expect(goldenSet.promotedAt).toBeDefined();
      expect(goldenSet.baselineScores).toBeDefined();
    });

    it('uses provided baseline scores', () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      const customScores = { c1: 0.95 };
      const goldenSet = manager.createGoldenSet(suite, customScores);

      expect(goldenSet.baselineScores?.c1).toBe(0.95);
    });
  });

  describe('createGoldenSetFromRun', () => {
    it('creates golden set from run results', () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      const run: EvalRun = {
        id: 'run-1',
        suiteId: suite.id,
        targetFn: 'test',
        results: [{
          caseId: 'c1',
          success: true,
          actualOutput: 'test',
          score: 0.95,
          latency: 100,
          timestamp: new Date().toISOString(),
        }],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          avgScore: 0.95,
          avgLatency: 100,
          p50Latency: 100,
          p95Latency: 100,
        },
      };

      const goldenSet = manager.createGoldenSetFromRun(run, 'tester');

      expect(goldenSet.promotedFromRunId).toBe('run-1');
      expect(goldenSet.promotedBy).toBe('tester');
      expect(goldenSet.baselineScores?.c1).toBe(0.95);
    });
  });

  describe('updateGoldenSet', () => {
    it('increments version', () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      manager.createGoldenSet(suite);
      const updated = manager.updateGoldenSet('suite-1', { name: 'Updated' });

      expect(updated.version).toBe(2);
      expect(updated.name).toBe('Updated');
    });
  });

  describe('compareToGolden', () => {
    it('identifies regressions', () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      manager.createGoldenSet(suite, { c1: 0.9 });

      const run: EvalRun = {
        id: 'run-1',
        suiteId: suite.id,
        targetFn: 'test',
        results: [{
          caseId: 'c1',
          success: true,
          actualOutput: 'test',
          score: 0.5, // Lower than golden
          latency: 100,
          timestamp: new Date().toISOString(),
        }],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          avgScore: 0.5,
          avgLatency: 100,
          p50Latency: 100,
          p95Latency: 100,
        },
      };

      const report = manager.compareToGolden(run);

      expect(report.regressions).toHaveLength(1);
      expect(report.regressions[0].delta).toBeLessThan(0);
      expect(report.summary.regressions).toBe(1);
    });

    it('identifies improvements', () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      manager.createGoldenSet(suite, { c1: 0.5 });

      const run: EvalRun = {
        id: 'run-1',
        suiteId: suite.id,
        targetFn: 'test',
        results: [{
          caseId: 'c1',
          success: true,
          actualOutput: 'test',
          score: 0.95, // Higher than golden
          latency: 100,
          timestamp: new Date().toISOString(),
        }],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          avgScore: 0.95,
          avgLatency: 100,
          p50Latency: 100,
          p95Latency: 100,
        },
      };

      const report = manager.compareToGolden(run);

      expect(report.improvements).toHaveLength(1);
      expect(report.improvements[0].delta).toBeGreaterThan(0);
    });

    it('handles unchanged scores', () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [createCase('c1', 'test', 'test')],
      });

      manager.createGoldenSet(suite, { c1: 0.9 });

      const run: EvalRun = {
        id: 'run-1',
        suiteId: suite.id,
        targetFn: 'test',
        results: [{
          caseId: 'c1',
          success: true,
          actualOutput: 'test',
          score: 0.9, // Same as golden
          latency: 100,
          timestamp: new Date().toISOString(),
        }],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          avgScore: 0.9,
          avgLatency: 100,
          p50Latency: 100,
          p95Latency: 100,
        },
      };

      const report = manager.compareToGolden(run);

      expect(report.unchanged).toHaveLength(1);
    });

    it('throws if golden set not found', () => {
      const run: EvalRun = {
        id: 'run-1',
        suiteId: 'non-existent',
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
      };

      expect(() => manager.compareToGolden(run)).toThrow(GoldenSetNotFoundError);
    });
  });

  describe('promoteRunToGolden', () => {
    it('creates new golden set if none exists', () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      const run: EvalRun = {
        id: 'run-1',
        suiteId: suite.id,
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
      };

      const goldenSet = manager.promoteRunToGolden(run, 'tester');

      expect(goldenSet.version).toBe(1);
    });

    it('updates existing golden set', () => {
      const suite = registry.createSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      manager.createGoldenSet(suite);

      const run: EvalRun = {
        id: 'run-1',
        suiteId: suite.id,
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
      };

      const goldenSet = manager.promoteRunToGolden(run);

      expect(goldenSet.version).toBe(2);
    });
  });

  describe('generateRegressionReportMarkdown', () => {
    it('generates markdown report', () => {
      const report = {
        suiteId: 'suite-1',
        runId: 'run-1',
        comparedToGolden: '1',
        timestamp: new Date().toISOString(),
        regressions: [{
          caseId: 'c1',
          caseName: 'Case 1',
          goldenScore: 0.9,
          currentScore: 0.5,
          delta: -0.4,
        }],
        improvements: [],
        unchanged: [],
        summary: {
          totalCases: 1,
          regressions: 1,
          improvements: 0,
          unchanged: 0,
          avgDelta: -0.4,
        },
      };

      const markdown = manager.generateRegressionReportMarkdown(report);

      expect(markdown).toContain('Regression Report');
      expect(markdown).toContain('Case 1');
      expect(markdown).toContain('🔴');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Singleton instances', () => {
  it('getEvalRunner returns singleton', () => {
    const r1 = getEvalRunner();
    const r2 = getEvalRunner();
    expect(r1).toBe(r2);
  });

  it('getGoldenSetManager returns singleton', () => {
    const m1 = getGoldenSetManager();
    const m2 = getGoldenSetManager();
    expect(m1).toBe(m2);
  });
});
