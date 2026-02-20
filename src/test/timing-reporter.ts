// SN-16: Test Timing Reporter
// Vitest reporter plugin that logs slow tests, identifies flaky tests,
// and generates a timing report.

// ============================================================================
// Types
// ============================================================================

export interface TestTimingEntry {
  name: string;
  file: string;
  durationMs: number;
  status: 'pass' | 'fail' | 'skip';
  attempt: number;
}

export interface FlakyTestEntry {
  name: string;
  file: string;
  passCount: number;
  failCount: number;
  flakyScore: number; // 0-1, higher = more flaky
}

export interface TimingReport {
  totalTests: number;
  totalDurationMs: number;
  slowTests: TestTimingEntry[];
  flakyTests: FlakyTestEntry[];
  averageDurationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  fastestTest: TestTimingEntry | null;
  slowestTest: TestTimingEntry | null;
}

export interface TimingReporterConfig {
  /** Threshold in ms above which a test is considered slow (default: 500) */
  slowThresholdMs: number;
  /** Minimum flaky score to include in report (default: 0.1) */
  flakyThreshold: number;
  /** Maximum number of slow tests to report (default: 20) */
  maxSlowTests: number;
  /** Whether to log slow tests to console (default: true) */
  logToConsole: boolean;
}

const DEFAULT_CONFIG: TimingReporterConfig = {
  slowThresholdMs: 500,
  flakyThreshold: 0.1,
  maxSlowTests: 20,
  logToConsole: true,
};

// ============================================================================
// TimingCollector
// ============================================================================

export class TimingCollector {
  private entries: TestTimingEntry[] = [];
  private testHistory: Map<string, Array<{ status: 'pass' | 'fail' }>> = new Map();
  private config: TimingReporterConfig;

  constructor(config?: Partial<TimingReporterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a test result
   */
  record(entry: TestTimingEntry): void {
    this.entries.push(entry);

    const key = `${entry.file}::${entry.name}`;
    const history = this.testHistory.get(key) ?? [];
    history.push({ status: entry.status === 'skip' ? 'pass' : entry.status });
    this.testHistory.set(key, history);
  }

  /**
   * Get all recorded entries
   */
  getEntries(): TestTimingEntry[] {
    return [...this.entries];
  }

  /**
   * Get slow tests (above threshold)
   */
  getSlowTests(): TestTimingEntry[] {
    return this.entries
      .filter(e => e.durationMs > this.config.slowThresholdMs && e.status !== 'skip')
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, this.config.maxSlowTests);
  }

  /**
   * Identify flaky tests (tests with mixed pass/fail results)
   */
  getFlakyTests(): FlakyTestEntry[] {
    const flaky: FlakyTestEntry[] = [];

    for (const [key, history] of this.testHistory) {
      if (history.length < 2) continue;

      const passCount = history.filter(h => h.status === 'pass').length;
      const failCount = history.filter(h => h.status === 'fail').length;

      if (passCount > 0 && failCount > 0) {
        const flakyScore = Math.min(passCount, failCount) / history.length;
        if (flakyScore >= this.config.flakyThreshold) {
          const [file, name] = key.split('::');
          flaky.push({ name, file, passCount, failCount, flakyScore });
        }
      }
    }

    return flaky.sort((a, b) => b.flakyScore - a.flakyScore);
  }

  /**
   * Generate the full timing report
   */
  generateReport(): TimingReport {
    const nonSkipped = this.entries.filter(e => e.status !== 'skip');
    const durations = nonSkipped.map(e => e.durationMs).sort((a, b) => a - b);

    const totalDurationMs = durations.reduce((s, d) => s + d, 0);
    const averageDurationMs = durations.length > 0 ? totalDurationMs / durations.length : 0;
    const medianDurationMs = durations.length > 0
      ? durations[Math.floor(durations.length / 2)]
      : 0;
    const p95DurationMs = durations.length > 0
      ? durations[Math.floor(durations.length * 0.95)]
      : 0;

    const sortedByDuration = [...nonSkipped].sort((a, b) => a.durationMs - b.durationMs);
    const fastestTest = sortedByDuration.length > 0 ? sortedByDuration[0] : null;
    const slowestTest = sortedByDuration.length > 0 ? sortedByDuration[sortedByDuration.length - 1] : null;

    return {
      totalTests: this.entries.length,
      totalDurationMs,
      slowTests: this.getSlowTests(),
      flakyTests: this.getFlakyTests(),
      averageDurationMs,
      medianDurationMs,
      p95DurationMs,
      fastestTest,
      slowestTest,
    };
  }

  /**
   * Clear all recorded data
   */
  clear(): void {
    this.entries = [];
    this.testHistory.clear();
  }

  /**
   * Get the configuration
   */
  getConfig(): TimingReporterConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Report Formatter
// ============================================================================

export function formatTimingReport(report: TimingReport): string {
  const lines: string[] = [];
  lines.push('=== Test Timing Report ===');
  lines.push(`Total tests: ${report.totalTests}`);
  lines.push(`Total duration: ${report.totalDurationMs}ms`);
  lines.push(`Average: ${report.averageDurationMs.toFixed(1)}ms`);
  lines.push(`Median: ${report.medianDurationMs}ms`);
  lines.push(`P95: ${report.p95DurationMs}ms`);

  if (report.fastestTest) {
    lines.push(`Fastest: ${report.fastestTest.name} (${report.fastestTest.durationMs}ms)`);
  }
  if (report.slowestTest) {
    lines.push(`Slowest: ${report.slowestTest.name} (${report.slowestTest.durationMs}ms)`);
  }

  if (report.slowTests.length > 0) {
    lines.push('');
    lines.push(`Slow tests (>${DEFAULT_CONFIG.slowThresholdMs}ms):`);
    for (const test of report.slowTests) {
      lines.push(`  ${test.durationMs}ms - ${test.name} (${test.file})`);
    }
  }

  if (report.flakyTests.length > 0) {
    lines.push('');
    lines.push('Flaky tests:');
    for (const test of report.flakyTests) {
      lines.push(`  ${test.name} - ${test.passCount}P/${test.failCount}F (score: ${test.flakyScore.toFixed(2)})`);
    }
  }

  return lines.join('\n');
}
