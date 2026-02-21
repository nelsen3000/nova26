// SN-16: Test Timing Reporter Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TimingCollector,
  formatTimingReport,
  type TestTimingEntry,
} from '../timing-reporter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<TestTimingEntry> = {}): TestTimingEntry {
  return {
    name: overrides.name ?? 'test case',
    file: overrides.file ?? 'test.ts',
    durationMs: overrides.durationMs ?? 50,
    status: overrides.status ?? 'pass',
    attempt: overrides.attempt ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimingCollector', () => {
  let collector: TimingCollector;

  beforeEach(() => {
    collector = new TimingCollector();
  });

  describe('Recording', () => {
    it('should record a test entry', () => {
      collector.record(makeEntry({ name: 'test1' }));
      expect(collector.getEntries()).toHaveLength(1);
    });

    it('should preserve entry data', () => {
      const entry = makeEntry({ name: 'my test', durationMs: 123, status: 'fail' });
      collector.record(entry);
      const entries = collector.getEntries();
      expect(entries[0].name).toBe('my test');
      expect(entries[0].durationMs).toBe(123);
      expect(entries[0].status).toBe('fail');
    });

    it('should record multiple entries', () => {
      collector.record(makeEntry({ name: 'a' }));
      collector.record(makeEntry({ name: 'b' }));
      collector.record(makeEntry({ name: 'c' }));
      expect(collector.getEntries()).toHaveLength(3);
    });
  });

  describe('Slow test detection', () => {
    it('should identify tests above 500ms threshold', () => {
      collector.record(makeEntry({ name: 'fast', durationMs: 100 }));
      collector.record(makeEntry({ name: 'slow', durationMs: 600 }));
      collector.record(makeEntry({ name: 'very-slow', durationMs: 1200 }));

      const slow = collector.getSlowTests();
      expect(slow).toHaveLength(2);
      expect(slow[0].name).toBe('very-slow'); // sorted desc
      expect(slow[1].name).toBe('slow');
    });

    it('should use custom threshold', () => {
      const custom = new TimingCollector({ slowThresholdMs: 100 });
      custom.record(makeEntry({ name: 'fast', durationMs: 50 }));
      custom.record(makeEntry({ name: 'medium', durationMs: 150 }));

      expect(custom.getSlowTests()).toHaveLength(1);
      expect(custom.getSlowTests()[0].name).toBe('medium');
    });

    it('should limit slow test list to maxSlowTests', () => {
      const limited = new TimingCollector({ slowThresholdMs: 10, maxSlowTests: 2 });
      for (let i = 0; i < 5; i++) {
        limited.record(makeEntry({ name: `test-${i}`, durationMs: 100 + i * 100 }));
      }

      expect(limited.getSlowTests()).toHaveLength(2);
    });

    it('should exclude skipped tests from slow list', () => {
      collector.record(makeEntry({ name: 'skipped-slow', durationMs: 9999, status: 'skip' }));
      expect(collector.getSlowTests()).toHaveLength(0);
    });
  });

  describe('Flaky test detection', () => {
    it('should detect flaky tests with mixed pass/fail', () => {
      collector.record(makeEntry({ name: 'flaky', file: 'f.ts', status: 'pass', attempt: 1 }));
      collector.record(makeEntry({ name: 'flaky', file: 'f.ts', status: 'fail', attempt: 2 }));

      const flaky = collector.getFlakyTests();
      expect(flaky).toHaveLength(1);
      expect(flaky[0].name).toBe('flaky');
      expect(flaky[0].passCount).toBe(1);
      expect(flaky[0].failCount).toBe(1);
    });

    it('should not flag consistently passing tests as flaky', () => {
      collector.record(makeEntry({ name: 'stable', file: 's.ts', status: 'pass', attempt: 1 }));
      collector.record(makeEntry({ name: 'stable', file: 's.ts', status: 'pass', attempt: 2 }));

      expect(collector.getFlakyTests()).toHaveLength(0);
    });

    it('should not flag single-run tests as flaky', () => {
      collector.record(makeEntry({ name: 'once', file: 'o.ts', status: 'fail' }));
      expect(collector.getFlakyTests()).toHaveLength(0);
    });

    it('should compute flaky score based on ratio', () => {
      // 1 pass, 3 fails -> flakyScore = min(1,3)/4 = 0.25
      collector.record(makeEntry({ name: 'test', file: 'f.ts', status: 'pass' }));
      collector.record(makeEntry({ name: 'test', file: 'f.ts', status: 'fail' }));
      collector.record(makeEntry({ name: 'test', file: 'f.ts', status: 'fail' }));
      collector.record(makeEntry({ name: 'test', file: 'f.ts', status: 'fail' }));

      const flaky = collector.getFlakyTests();
      expect(flaky[0].flakyScore).toBe(0.25);
    });
  });

  describe('Report generation', () => {
    it('should compute correct total tests', () => {
      collector.record(makeEntry({ durationMs: 10 }));
      collector.record(makeEntry({ durationMs: 20 }));
      collector.record(makeEntry({ durationMs: 30 }));

      const report = collector.generateReport();
      expect(report.totalTests).toBe(3);
    });

    it('should compute total duration', () => {
      collector.record(makeEntry({ durationMs: 100 }));
      collector.record(makeEntry({ durationMs: 200 }));

      const report = collector.generateReport();
      expect(report.totalDurationMs).toBe(300);
    });

    it('should compute average duration', () => {
      collector.record(makeEntry({ durationMs: 100 }));
      collector.record(makeEntry({ durationMs: 300 }));

      const report = collector.generateReport();
      expect(report.averageDurationMs).toBe(200);
    });

    it('should find fastest and slowest tests', () => {
      collector.record(makeEntry({ name: 'fast', durationMs: 10 }));
      collector.record(makeEntry({ name: 'slow', durationMs: 999 }));

      const report = collector.generateReport();
      expect(report.fastestTest?.name).toBe('fast');
      expect(report.slowestTest?.name).toBe('slow');
    });

    it('should handle empty report', () => {
      const report = collector.generateReport();
      expect(report.totalTests).toBe(0);
      expect(report.totalDurationMs).toBe(0);
      expect(report.fastestTest).toBeNull();
      expect(report.slowestTest).toBeNull();
    });
  });

  describe('Clear', () => {
    it('should clear all entries', () => {
      collector.record(makeEntry());
      collector.record(makeEntry());
      collector.clear();
      expect(collector.getEntries()).toHaveLength(0);
    });

    it('should clear flaky history', () => {
      collector.record(makeEntry({ name: 'x', file: 'f.ts', status: 'pass' }));
      collector.record(makeEntry({ name: 'x', file: 'f.ts', status: 'fail' }));
      collector.clear();
      expect(collector.getFlakyTests()).toHaveLength(0);
    });
  });

  describe('Config', () => {
    it('should use default config values', () => {
      const config = collector.getConfig();
      expect(config.slowThresholdMs).toBe(500);
      expect(config.flakyThreshold).toBe(0.1);
      expect(config.maxSlowTests).toBe(20);
      expect(config.logToConsole).toBe(true);
    });

    it('should allow custom config', () => {
      const custom = new TimingCollector({ slowThresholdMs: 1000, maxSlowTests: 5 });
      const config = custom.getConfig();
      expect(config.slowThresholdMs).toBe(1000);
      expect(config.maxSlowTests).toBe(5);
    });
  });
});

describe('formatTimingReport', () => {
  it('should include total tests in output', () => {
    const collector = new TimingCollector();
    collector.record(makeEntry({ durationMs: 50 }));
    const report = collector.generateReport();
    const output = formatTimingReport(report);
    expect(output).toContain('Total tests: 1');
  });

  it('should include slow tests section when present', () => {
    const collector = new TimingCollector();
    collector.record(makeEntry({ name: 'slow-one', durationMs: 800 }));
    const report = collector.generateReport();
    const output = formatTimingReport(report);
    expect(output).toContain('Slow tests');
    expect(output).toContain('slow-one');
  });
});
