// Autonomous Test Runner & Reporter
// KIMI-TESTING-05: R16-04 spec

import { z } from 'zod';
// spawn can be used for actual test process execution
import { EventEmitter } from 'events';

// ============================================================================
// Core Types
// ============================================================================

export type TestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped' | 'error';
export type RunnerMode = 'watch' | 'single' | 'ci';

export interface TestCase {
  id: string;
  name: string;
  file: string;
  line: number;
  status: TestStatus;
  duration?: number;
  error?: string;
  retries?: number;
}

export interface TestSuite {
  id: string;
  name: string;
  file: string;
  tests: TestCase[];
  status: TestStatus;
  duration: number;
}

export interface TestRunConfig {
  mode: RunnerMode;
  pattern?: string;
  coverage?: boolean;
  parallel?: boolean;
  bail?: number;
  retry?: number;
  timeout?: number;
}

export interface TestRunResult {
  id: string;
  timestamp: string;
  duration: number;
  config: TestRunConfig;
  suites: TestSuite[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    error: number;
  };
  coverage?: import('./coverage-analyzer.js').CoverageMetrics;
}

export interface TestReport {
  runId: string;
  title: string;
  generatedAt: string;
  result: TestRunResult;
  analysis?: {
    slowTests: TestCase[];
    flakyTests: TestCase[];
    gaps: string[];
    recommendations: string[];
  };
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const TestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  file: z.string(),
  line: z.number(),
  status: z.enum(['idle', 'running', 'passed', 'failed', 'skipped', 'error']),
  duration: z.number().optional(),
  error: z.string().optional(),
  retries: z.number().optional(),
});

export const TestSuiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  file: z.string(),
  tests: z.array(TestCaseSchema),
  status: z.enum(['idle', 'running', 'passed', 'failed', 'skipped', 'error']),
  duration: z.number(),
});

export const TestRunConfigSchema = z.object({
  mode: z.enum(['watch', 'single', 'ci']),
  pattern: z.string().optional(),
  coverage: z.boolean().optional(),
  parallel: z.boolean().optional(),
  bail: z.number().optional(),
  retry: z.number().optional(),
  timeout: z.number().optional(),
});

export const TestRunResultSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  duration: z.number(),
  config: TestRunConfigSchema,
  suites: z.array(TestSuiteSchema),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    error: z.number(),
  }),
  coverage: z.any().optional(),
});

// ============================================================================
// AutonomousTestRunner Class
// ============================================================================

export class AutonomousTestRunner extends EventEmitter {
  private config: TestRunConfig;
  private isRunning = false;
  private currentRunId: string | null = null;
  private testHistory: TestRunResult[] = [];

  constructor(config: Partial<TestRunConfig> = {}) {
    super();
    this.config = {
      mode: 'single',
      pattern: '**/*.test.ts',
      coverage: false,
      parallel: true,
      bail: 0,
      retry: 0,
      timeout: 30000,
      ...config,
    };
  }

  async run(options?: Partial<TestRunConfig>): Promise<TestRunResult> {
    if (this.isRunning) {
      throw new Error('Test run already in progress');
    }

    const runConfig = { ...this.config, ...options };
    this.isRunning = true;
    this.currentRunId = crypto.randomUUID();

    this.emit('run:start', { runId: this.currentRunId, config: runConfig });

    const startTime = Date.now();
    const suites: TestSuite[] = [];

    try {
      // In a real implementation, this would run actual tests
      // For now, we simulate the test run
      const testFiles = await this.discoverTests(runConfig.pattern!);

      for (const file of testFiles) {
        const suite = await this.runSuite(file, runConfig);
        suites.push(suite);

        this.emit('suite:complete', { suite });

        // Check bail condition
        if (runConfig.bail! > 0 && suite.status === 'failed') {
          break;
        }
      }

      const duration = Date.now() - startTime;
      const result = this.buildResult(this.currentRunId, runConfig, suites, duration);
      
      this.testHistory.push(result);
      this.emit('run:complete', { result });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const failedResult = this.buildErrorResult(this.currentRunId, runConfig, error as Error, duration);
      this.emit('run:error', { error, result: failedResult });
      return failedResult;
    } finally {
      this.isRunning = false;
      this.currentRunId = null;
    }
  }

  async watch(callback?: (result: TestRunResult) => void): Promise<void> {
    this.config.mode = 'watch';
    
    // Initial run
    let result = await this.run();
    callback?.(result);

    // In a real implementation, this would watch for file changes
    // For simulation, we just emit the watch started event
    this.emit('watch:started');
  }

  stop(): void {
    if (this.isRunning) {
      this.emit('run:stopped', { runId: this.currentRunId });
      this.isRunning = false;
    }
  }

  isWatchMode(): boolean {
    return this.config.mode === 'watch';
  }

  getHistory(): TestRunResult[] {
    return [...this.testHistory];
  }

  getLastRun(): TestRunResult | undefined {
    return this.testHistory[this.testHistory.length - 1];
  }

  clearHistory(): void {
    this.testHistory = [];
  }

  // ---- Private Methods ----

  private async discoverTests(pattern: string): Promise<string[]> {
    // Simulate test discovery
    // In a real implementation, this would glob for test files
    this.emit('discovery:started', { pattern });
    
    // Simulate some test files
    const files = [
      'src/module-a.test.ts',
      'src/module-b.test.ts',
      'src/module-c.test.ts',
    ];

    this.emit('discovery:complete', { files });
    return files;
  }

  private async runSuite(file: string, config: TestRunConfig): Promise<TestSuite> {
    const suiteId = crypto.randomUUID();
    const suiteStartTime = Date.now();

    this.emit('suite:started', { suiteId, file });

    // Simulate running tests in the suite
    const tests: TestCase[] = [];
    const testNames = this.generateTestNames(file);

    for (const name of testNames) {
      const test = await this.runTest(suiteId, file, name, config);
      tests.push(test);
      this.emit('test:complete', { test });
    }

    const duration = Date.now() - suiteStartTime;
    const status = this.determineSuiteStatus(tests);

    return {
      id: suiteId,
      name: file.replace('.test.ts', ''),
      file,
      tests,
      status,
      duration,
    };
  }

  private async runTest(
    suiteId: string, 
    file: string, 
    name: string, 
    _config: TestRunConfig
  ): Promise<TestCase> {
    const testId = crypto.randomUUID();
    const startTime = Date.now();

    this.emit('test:started', { testId, suiteId, name });

    // Simulate test execution time
    await this.delay(Math.random() * 50);

    // Simulate test result (mostly pass, some fail)
    const rand = Math.random();
    let status: TestStatus = 'passed';
    let error: string | undefined;

    if (rand > 0.95) {
      status = 'failed';
      error = 'Assertion error: expected true but got false';
    } else if (rand > 0.90) {
      status = 'skipped';
    }

    const duration = Date.now() - startTime;

    return {
      id: testId,
      name,
      file,
      line: Math.floor(Math.random() * 100) + 1,
      status,
      duration,
      error,
      retries: 0,
    };
  }

  private generateTestNames(file: string): string[] {
    // Generate realistic test names based on file
    const base = file.replace('.test.ts', '').split('/').pop() || 'module';
    return [
      `${base} > should work correctly`,
      `${base} > should handle errors`,
      `${base} > should validate input`,
      `${base} > should return expected result`,
    ];
  }

  private determineSuiteStatus(tests: TestCase[]): TestStatus {
    if (tests.some(t => t.status === 'error')) return 'error';
    if (tests.some(t => t.status === 'failed')) return 'failed';
    if (tests.every(t => t.status === 'skipped')) return 'skipped';
    if (tests.some(t => t.status === 'running')) return 'running';
    return 'passed';
  }

  private buildResult(
    runId: string,
    config: TestRunConfig,
    suites: TestSuite[],
    duration: number
  ): TestRunResult {
    const summary = {
      total: suites.reduce((sum, s) => sum + s.tests.length, 0),
      passed: suites.reduce((sum, s) => sum + s.tests.filter(t => t.status === 'passed').length, 0),
      failed: suites.reduce((sum, s) => sum + s.tests.filter(t => t.status === 'failed').length, 0),
      skipped: suites.reduce((sum, s) => sum + s.tests.filter(t => t.status === 'skipped').length, 0),
      error: suites.reduce((sum, s) => sum + s.tests.filter(t => t.status === 'error').length, 0),
    };

    return {
      id: runId,
      timestamp: new Date().toISOString(),
      duration,
      config,
      suites,
      summary,
    };
  }

  private buildErrorResult(
    runId: string,
    _config: TestRunConfig,
    _error: Error,
    duration: number
  ): TestRunResult {
    return {
      id: runId,
      timestamp: new Date().toISOString(),
      duration,
      config: _config,
      suites: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, error: 1 },
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// TestReporter Class
// ============================================================================

export class TestReporter {
  formatConsole(result: TestRunResult): string {
    const lines: string[] = [];
    
    // Header
    lines.push('');
    lines.push(`Test Run: ${result.id.slice(0, 8)}`);
    lines.push(`Mode: ${result.config.mode}`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push('');

    // Suites
    for (const suite of result.suites) {
      const icon = suite.status === 'passed' ? '✓' : suite.status === 'failed' ? '✗' : '○';
      lines.push(`${icon} ${suite.name} (${suite.duration}ms)`);

      for (const test of suite.tests) {
        const testIcon = test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '○';
        const duration = test.duration ? `(${test.duration}ms)` : '';
        lines.push(`  ${testIcon} ${test.name} ${duration}`);
        
        if (test.error) {
          lines.push(`    Error: ${test.error}`);
        }
      }
      lines.push('');
    }

    // Summary
    const { summary } = result;
    lines.push('─'.repeat(50));
    lines.push(`Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Skipped: ${summary.skipped}`);
    
    const passRate = summary.total > 0 
      ? Math.round((summary.passed / summary.total) * 100) 
      : 0;
    lines.push(`Pass Rate: ${passRate}%`);
    lines.push('');

    return lines.join('\n');
  }

  formatJSON(result: TestRunResult): string {
    return JSON.stringify(result, null, 2);
  }

  formatJUnit(result: TestRunResult): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<testsuites name="Test Run ${result.id}" tests="${result.summary.total}" failures="${result.summary.failed}" time="${result.duration / 1000}">`);

    for (const suite of result.suites) {
      lines.push(`  <testsuite name="${suite.name}" tests="${suite.tests.length}" failures="${suite.tests.filter(t => t.status === 'failed').length}" time="${suite.duration / 1000}">`);
      
      for (const test of suite.tests) {
        lines.push(`    <testcase name="${test.name}" classname="${suite.name}" time="${(test.duration || 0) / 1000}">`);
        
        if (test.status === 'failed' && test.error) {
          lines.push(`      <failure message="${test.error}">${test.error}</failure>`);
        } else if (test.status === 'skipped') {
          lines.push('      <skipped/>');
        }
        
        lines.push('    </testcase>');
      }
      
      lines.push('  </testsuite>');
    }

    lines.push('</testsuites>');
    return lines.join('\n');
  }

  generateReport(result: TestRunResult, title?: string): TestReport {
    const analysis = this.analyzeResults(result);

    return {
      runId: result.id,
      title: title || `Test Report ${new Date().toISOString()}`,
      generatedAt: new Date().toISOString(),
      result,
      analysis,
    };
  }

  private analyzeResults(result: TestRunResult): TestReport['analysis'] {
    const allTests = result.suites.flatMap(s => s.tests);

    // Find slow tests (> 100ms)
    const slowTests = allTests
      .filter(t => (t.duration || 0) > 100)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);

    // Find potentially flaky tests (would need history in real impl)
    const flakyTests: TestCase[] = [];

    // Identify gaps
    const gaps: string[] = [];
    if (result.summary.failed > 0) {
      gaps.push(`${result.summary.failed} tests are failing`);
    }
    const errorSuites = result.suites.filter(s => s.status === 'error');
    if (errorSuites.length > 0) {
      gaps.push(`${errorSuites.length} suites have errors`);
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (slowTests.length > 0) {
      recommendations.push(`Optimize ${slowTests.length} slow tests`);
    }
    if (result.summary.failed > 0) {
      recommendations.push('Fix failing tests before merging');
    }
    if (result.summary.total < 10) {
      recommendations.push('Add more tests to improve coverage');
    }

    return {
      slowTests,
      flakyTests,
      gaps,
      recommendations,
    };
  }
}

// ============================================================================
// TestOrchestrator Class
// ============================================================================

export class TestOrchestrator {
  private runner: AutonomousTestRunner;
  private reporter: TestReporter;

  constructor() {
    this.runner = new AutonomousTestRunner();
    this.reporter = new TestReporter();
  }

  async runTests(config?: Partial<TestRunConfig>): Promise<TestRunResult> {
    return this.runner.run(config);
  }

  async runWithCoverage(): Promise<TestRunResult> {
    return this.runner.run({ coverage: true });
  }

  async runFiltered(pattern: string): Promise<TestRunResult> {
    return this.runner.run({ pattern });
  }

  async runRelated(file: string): Promise<TestRunResult> {
    // In a real implementation, this would find tests related to the file
    return this.runner.run({ pattern: `**/${file}*.test.ts` });
  }

  generateReport(result: TestRunResult, format: 'console' | 'json' | 'junit' = 'console'): string {
    switch (format) {
      case 'json':
        return this.reporter.formatJSON(result);
      case 'junit':
        return this.reporter.formatJUnit(result);
      default:
        return this.reporter.formatConsole(result);
    }
  }

  getRunner(): AutonomousTestRunner {
    return this.runner;
  }

  getReporter(): TestReporter {
    return this.reporter;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createTestRunner(config?: Partial<TestRunConfig>): AutonomousTestRunner {
  return new AutonomousTestRunner(config);
}

export function createTestReporter(): TestReporter {
  return new TestReporter();
}

export function createTestOrchestrator(): TestOrchestrator {
  return new TestOrchestrator();
}
