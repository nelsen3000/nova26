// Tests for Autonomous Test Runner & Reporter
// KIMI-TESTING-05

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AutonomousTestRunner,
  TestReporter,
  TestOrchestrator,
  createTestRunner,
  createTestReporter,
  createTestOrchestrator,
  TestCaseSchema,
  TestSuiteSchema,
  TestRunResultSchema,
  type TestRunConfig,
} from './autonomous-runner.js';

describe('AutonomousTestRunner', () => {
  let runner: AutonomousTestRunner;

  beforeEach(() => {
    runner = new AutonomousTestRunner();
  });

  describe('run', () => {
    it('runs tests and returns result', async () => {
      const result = await runner.run();

      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.suites).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('calculates summary correctly', async () => {
      const result = await runner.run();

      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.passed + result.summary.failed + result.summary.skipped)
        .toBe(result.summary.total);
    });

    it('emits run:start event', async () => {
      const startSpy = vi.fn();
      runner.on('run:start', startSpy);

      await runner.run();

      expect(startSpy).toHaveBeenCalled();
      expect(startSpy.mock.calls[0][0]).toHaveProperty('runId');
    });

    it('emits run:complete event', async () => {
      const completeSpy = vi.fn();
      runner.on('run:complete', completeSpy);

      await runner.run();

      expect(completeSpy).toHaveBeenCalled();
      expect(completeSpy.mock.calls[0][0]).toHaveProperty('result');
    });

    it('prevents concurrent runs', async () => {
      runner.run();
      
      await expect(runner.run()).rejects.toThrow('already in progress');
    });

    it('respects config options', async () => {
      const result = await runner.run({ 
        pattern: '**/*.spec.ts',
        coverage: true,
        parallel: false,
      });

      expect(result.config.pattern).toBe('**/*.spec.ts');
      expect(result.config.coverage).toBe(true);
      expect(result.config.parallel).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('returns empty history initially', () => {
      expect(runner.getHistory()).toHaveLength(0);
    });

    it('stores run in history', async () => {
      await runner.run();
      
      expect(runner.getHistory()).toHaveLength(1);
    });

    it('stores multiple runs', async () => {
      await runner.run();
      await runner.run();
      
      expect(runner.getHistory()).toHaveLength(2);
    });
  });

  describe('getLastRun', () => {
    it('returns undefined when no runs', () => {
      expect(runner.getLastRun()).toBeUndefined();
    });

    it('returns last run', async () => {
      const result1 = await runner.run();
      const result2 = await runner.run();

      expect(runner.getLastRun()?.id).toBe(result2.id);
    });
  });

  describe('clearHistory', () => {
    it('clears all history', async () => {
      await runner.run();
      await runner.run();

      runner.clearHistory();

      expect(runner.getHistory()).toHaveLength(0);
    });
  });

  describe('isWatchMode', () => {
    it('returns false by default', () => {
      expect(runner.isWatchMode()).toBe(false);
    });

    it('returns true when mode is watch', () => {
      const watchRunner = new AutonomousTestRunner({ mode: 'watch' });
      expect(watchRunner.isWatchMode()).toBe(true);
    });
  });
});

describe('TestReporter', () => {
  let reporter: TestReporter;

  beforeEach(() => {
    reporter = new TestReporter();
  });

  const createMockResult = (): import('./autonomous-runner.js').TestRunResult => ({
    id: 'test-run-123',
    timestamp: new Date().toISOString(),
    duration: 1000,
    config: { mode: 'single' },
    suites: [
      {
        id: 'suite-1',
        name: 'Module A',
        file: 'src/module-a.test.ts',
        status: 'passed',
        duration: 500,
        tests: [
          { id: 'test-1', name: 'should work', file: 'src/module-a.test.ts', line: 10, status: 'passed', duration: 100 },
          { id: 'test-2', name: 'should fail', file: 'src/module-a.test.ts', line: 20, status: 'failed', error: 'Expected true' },
        ],
      },
    ],
    summary: { total: 2, passed: 1, failed: 1, skipped: 0, error: 0 },
  });

  describe('formatConsole', () => {
    it('formats result as console output', () => {
      const result = createMockResult();
      const output = reporter.formatConsole(result);

      expect(output).toContain('Test Run:');
      expect(output).toContain('Module A');
      expect(output).toContain('should work');
      expect(output).toContain('should fail');
    });

    it('includes summary stats', () => {
      const result = createMockResult();
      const output = reporter.formatConsole(result);

      expect(output).toContain('Total: 2');
      expect(output).toContain('Passed: 1');
      expect(output).toContain('Failed: 1');
    });
  });

  describe('formatJSON', () => {
    it('formats result as JSON', () => {
      const result = createMockResult();
      const output = reporter.formatJSON(result);

      const parsed = JSON.parse(output);
      expect(parsed.id).toBe('test-run-123');
      expect(parsed.suites).toHaveLength(1);
    });
  });

  describe('formatJUnit', () => {
    it('formats result as JUnit XML', () => {
      const result = createMockResult();
      const output = reporter.formatJUnit(result);

      expect(output).toContain('<?xml version="1.0"');
      expect(output).toContain('<testsuites');
      expect(output).toContain('<testsuite');
      expect(output).toContain('<testcase');
      expect(output).toContain('<failure');
    });

    it('includes passed tests without failure tags', () => {
      const result = createMockResult();
      result.suites[0].tests[1].status = 'passed';
      result.suites[0].tests[1].error = undefined;
      result.summary.failed = 0;
      result.summary.passed = 2;

      const output = reporter.formatJUnit(result);

      expect(output).not.toContain('<failure');
    });
  });

  describe('generateReport', () => {
    it('generates report with analysis', () => {
      const result = createMockResult();
      const report = reporter.generateReport(result, 'Test Report');

      expect(report.title).toBe('Test Report');
      expect(report.runId).toBe('test-run-123');
      expect(report.analysis).toBeDefined();
    });

    it('identifies slow tests', () => {
      const result = createMockResult();
      result.suites[0].tests[0].duration = 200;

      const report = reporter.generateReport(result);

      expect(report.analysis?.slowTests.length).toBeGreaterThan(0);
    });

    it('includes gaps when tests fail', () => {
      const result = createMockResult();
      const report = reporter.generateReport(result);

      expect(report.analysis?.gaps.length).toBeGreaterThan(0);
      expect(report.analysis?.gaps[0]).toContain('failing');
    });

    it('generates recommendations', () => {
      const result = createMockResult();
      const report = reporter.generateReport(result);

      expect(report.analysis?.recommendations.length).toBeGreaterThan(0);
    });
  });
});

describe('TestOrchestrator', () => {
  let orchestrator: TestOrchestrator;

  beforeEach(() => {
    orchestrator = createTestOrchestrator();
  });

  describe('runTests', () => {
    it('runs tests', async () => {
      const result = await orchestrator.runTests();
      expect(result.summary).toBeDefined();
    });
  });

  describe('runWithCoverage', () => {
    it('runs tests with coverage enabled', async () => {
      const result = await orchestrator.runWithCoverage();
      expect(result.config.coverage).toBe(true);
    });
  });

  describe('runFiltered', () => {
    it('runs tests matching pattern', async () => {
      const result = await orchestrator.runFiltered('**/auth*.test.ts');
      expect(result.config.pattern).toBe('**/auth*.test.ts');
    });
  });

  describe('runRelated', () => {
    it('runs tests related to file', async () => {
      const result = await orchestrator.runRelated('user');
      expect(result.config.pattern).toContain('user');
    });
  });

  describe('generateReport', () => {
    it('generates console report by default', async () => {
      const result = await orchestrator.runTests();
      const output = orchestrator.generateReport(result);

      expect(output).toContain('Test Run:');
    });

    it('generates JSON report', async () => {
      const result = await orchestrator.runTests();
      const output = orchestrator.generateReport(result, 'json');

      expect(JSON.parse(output)).toBeDefined();
    });

    it('generates JUnit report', async () => {
      const result = await orchestrator.runTests();
      const output = orchestrator.generateReport(result, 'junit');

      expect(output).toContain('<?xml');
    });
  });

  describe('getRunner', () => {
    it('returns the runner instance', () => {
      expect(orchestrator.getRunner()).toBeDefined();
    });
  });

  describe('getReporter', () => {
    it('returns the reporter instance', () => {
      expect(orchestrator.getReporter()).toBeDefined();
    });
  });
});

describe('Helper Functions', () => {
  it('createTestRunner creates runner', () => {
    const runner = createTestRunner({ mode: 'ci' });
    expect(runner).toBeInstanceOf(AutonomousTestRunner);
  });

  it('createTestReporter creates reporter', () => {
    const reporter = createTestReporter();
    expect(reporter).toBeInstanceOf(TestReporter);
  });

  it('createTestOrchestrator creates orchestrator', () => {
    const orchestrator = createTestOrchestrator();
    expect(orchestrator).toBeInstanceOf(TestOrchestrator);
  });
});

describe('Zod Schemas', () => {
  it('validates valid test case', () => {
    const testCase = {
      id: 'test-1',
      name: 'should work',
      file: 'test.ts',
      line: 10,
      status: 'passed',
      duration: 100,
    };

    const result = TestCaseSchema.safeParse(testCase);
    expect(result.success).toBe(true);
  });

  it('validates valid test suite', () => {
    const suite = {
      id: 'suite-1',
      name: 'Test Suite',
      file: 'test.ts',
      status: 'passed',
      duration: 1000,
      tests: [],
    };

    const result = TestSuiteSchema.safeParse(suite);
    expect(result.success).toBe(true);
  });

  it('validates valid test run result', () => {
    const result = {
      id: 'run-1',
      timestamp: new Date().toISOString(),
      duration: 5000,
      config: { mode: 'single' },
      suites: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, error: 0 },
    };

    const parseResult = TestRunResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });
});
