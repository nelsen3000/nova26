// Tests for Coverage Analyzer & Gap Detector
// KIMI-TESTING-04

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CoverageAnalyzer,
  GapTracker,
  createCoverageReport,
  calculateMetrics,
  CoverageMetricsSchema,
  TestGapSchema,
  RiskAreaSchema,
  type CoverageMetrics,
  type UncoveredRange,
} from './coverage-analyzer.js';

describe('CoverageAnalyzer', () => {
  let analyzer: CoverageAnalyzer;

  beforeEach(() => {
    analyzer = new CoverageAnalyzer();
  });

  const createMetrics = (overrides: Partial<CoverageMetrics> = {}): CoverageMetrics => ({
    lines: { total: 100, covered: 80, percentage: 80 },
    branches: { total: 50, covered: 35, percentage: 70 },
    functions: { total: 20, covered: 16, percentage: 80 },
    statements: { total: 100, covered: 80, percentage: 80 },
    overall: 77.5,
    ...overrides,
  });

  describe('analyze', () => {
    it('generates coverage report', () => {
      const metrics = createMetrics();
      const uncoveredRanges: UncoveredRange[] = [];

      const report = analyzer.analyze(metrics, uncoveredRanges);

      expect(report.timestamp).toBeDefined();
      expect(report.metrics).toEqual(metrics);
      expect(report.recommendations).toBeDefined();
    });

    it('detects gaps in uncovered ranges', () => {
      const metrics = createMetrics();
      const uncoveredRanges: UncoveredRange[] = [
        { file: 'src/utils.ts', startLine: 10, endLine: 15, type: 'line', severity: 'medium' },
      ];

      const report = analyzer.analyze(metrics, uncoveredRanges);

      expect(report.gaps.length).toBeGreaterThan(0);
      expect(report.gaps[0].file).toBe('src/utils.ts');
    });

    it('identifies risk areas', () => {
      const metrics = createMetrics();
      const uncoveredRanges: UncoveredRange[] = [
        { file: 'src/complex.ts', startLine: 1, endLine: 50, type: 'line', severity: 'high' },
        { file: 'src/complex.ts', startLine: 51, endLine: 100, type: 'branch', severity: 'medium' },
      ];

      const report = analyzer.analyze(metrics, uncoveredRanges);

      expect(report.riskAreas.length).toBeGreaterThan(0);
      expect(report.riskAreas[0].file).toBe('src/complex.ts');
    });

    it('generates recommendations', () => {
      const metrics = createMetrics();
      const report = analyzer.analyze(metrics, []);

      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('detectGaps', () => {
    it('groups ranges by file', () => {
      const ranges: UncoveredRange[] = [
        { file: 'src/a.ts', startLine: 1, endLine: 5, type: 'line', severity: 'low' },
        { file: 'src/b.ts', startLine: 1, endLine: 5, type: 'line', severity: 'low' },
      ];

      const gaps = analyzer.detectGaps(ranges);

      expect(gaps).toHaveLength(2);
      expect(gaps.map(g => g.file)).toContain('src/a.ts');
      expect(gaps.map(g => g.file)).toContain('src/b.ts');
    });

    it('merges adjacent ranges', () => {
      const ranges: UncoveredRange[] = [
        { file: 'src/test.ts', startLine: 1, endLine: 5, type: 'line', severity: 'low' },
        { file: 'src/test.ts', startLine: 6, endLine: 10, type: 'line', severity: 'medium' },
      ];

      const gaps = analyzer.detectGaps(ranges);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].line).toBe(1);
    });

    it('detects missing-branch type', () => {
      const ranges: UncoveredRange[] = [
        { file: 'src/test.ts', startLine: 10, endLine: 10, type: 'branch', severity: 'high' },
      ];

      const gaps = analyzer.detectGaps(ranges);

      expect(gaps[0].type).toBe('missing-branch');
    });

    it('detects missing-error-case type', () => {
      const ranges: UncoveredRange[] = [
        { file: 'src/error-handler.ts', startLine: 5, endLine: 5, type: 'line', severity: 'low' },
      ];

      const gaps = analyzer.detectGaps(ranges);

      expect(gaps[0].type).toBe('missing-error-case');
    });

    it('sorts by priority', () => {
      const ranges: UncoveredRange[] = [
        { file: 'src/low.ts', startLine: 1, endLine: 2, type: 'line', severity: 'low' },
        { file: 'src/critical.ts', startLine: 1, endLine: 2, type: 'line', severity: 'critical' },
        { file: 'src/high.ts', startLine: 1, endLine: 2, type: 'line', severity: 'high' },
      ];

      const gaps = analyzer.detectGaps(ranges);

      expect(gaps[0].priority).toBe('critical');
      expect(gaps[1].priority).toBe('high');
    });
  });

  describe('identifyRiskAreas', () => {
    it('identifies high-risk files', () => {
      const metrics = createMetrics();
      const ranges: UncoveredRange[] = [
        { file: 'src/complex.ts', startLine: 1, endLine: 100, type: 'line', severity: 'high' },
        { file: 'src/complex.ts', startLine: 101, endLine: 200, type: 'branch', severity: 'medium' },
      ];

      const riskAreas = analyzer.identifyRiskAreas(metrics, ranges);

      expect(riskAreas.length).toBeGreaterThan(0);
      expect(riskAreas[0].riskScore).toBeGreaterThan(0);
    });

    it('includes reasons for risk', () => {
      const metrics = createMetrics();
      const ranges: UncoveredRange[] = [
        { file: 'src/risk.ts', startLine: 1, endLine: 50, type: 'branch', severity: 'critical' },
        { file: 'src/risk.ts', startLine: 51, endLine: 100, type: 'line', severity: 'high' },
      ];

      const riskAreas = analyzer.identifyRiskAreas(metrics, ranges);

      expect(riskAreas.length).toBeGreaterThan(0);
      expect(riskAreas[0].reasons.length).toBeGreaterThan(0);
    });

    it('sorts by risk score descending', () => {
      const metrics = createMetrics();
      const ranges: UncoveredRange[] = [
        { file: 'src/low-risk.ts', startLine: 1, endLine: 5, type: 'line', severity: 'low' },
        { file: 'src/high-risk.ts', startLine: 1, endLine: 100, type: 'line', severity: 'high' },
      ];

      const riskAreas = analyzer.identifyRiskAreas(metrics, ranges);

      if (riskAreas.length >= 2) {
        expect(riskAreas[0].riskScore).toBeGreaterThanOrEqual(riskAreas[1].riskScore);
      }
    });
  });

  describe('generateRecommendations', () => {
    it('recommends coverage improvements when below threshold', () => {
      const metrics = createMetrics({
        lines: { total: 100, covered: 50, percentage: 50 },
      });

      const recommendations = analyzer.generateRecommendations(metrics, [], []);

      expect(recommendations.some(r => r.includes('line coverage'))).toBe(true);
    });

    it('recommends branch coverage improvements', () => {
      const metrics = createMetrics({
        branches: { total: 50, covered: 20, percentage: 40 },
      });

      const recommendations = analyzer.generateRecommendations(metrics, [], []);

      expect(recommendations.some(r => r.includes('branch coverage'))).toBe(true);
    });

    it('recommends addressing critical gaps', () => {
      const metrics = createMetrics();
      const gaps = [
        { id: '1', file: 'test.ts', line: 1, type: 'no-test' as const, priority: 'critical' as const, suggestion: 'test' },
      ];

      const recommendations = analyzer.generateRecommendations(metrics, gaps, []);

      expect(recommendations.some(r => r.includes('critical'))).toBe(true);
    });

    it('recommends error handling tests', () => {
      const metrics = createMetrics();
      const gaps = [
        { id: '1', file: 'test.ts', line: 1, type: 'missing-error-case' as const, priority: 'high' as const, suggestion: 'test' },
      ];

      const recommendations = analyzer.generateRecommendations(metrics, gaps, []);

      expect(recommendations.some(r => r.includes('error'))).toBe(true);
    });

    it('congratulates when thresholds met', () => {
      const metrics = createMetrics({
        lines: { total: 100, covered: 90, percentage: 90 },
        branches: { total: 50, covered: 45, percentage: 90 },
        functions: { total: 20, covered: 18, percentage: 90 },
        statements: { total: 100, covered: 90, percentage: 90 },
      });

      const recommendations = analyzer.generateRecommendations(metrics, [], []);

      expect(recommendations.some(r => r.includes('maintain'))).toBe(true);
    });
  });

  describe('threshold methods', () => {
    it('detects failing thresholds', () => {
      const metrics = createMetrics({
        lines: { total: 100, covered: 50, percentage: 50 },
      });

      const failing = analyzer.getFailingThresholds(metrics);
      expect(failing).toContain('line');
    });

    it('returns empty when all thresholds met', () => {
      const metrics = createMetrics({
        lines: { total: 100, covered: 90, percentage: 90 },
        branches: { total: 50, covered: 45, percentage: 90 },
        functions: { total: 20, covered: 18, percentage: 90 },
        statements: { total: 100, covered: 90, percentage: 90 },
      });

      expect(analyzer.isThresholdMet(metrics)).toBe(true);
      expect(analyzer.getFailingThresholds(metrics)).toHaveLength(0);
    });

    it('allows custom thresholds', () => {
      analyzer.setThresholds({ line: 90 });
      const metrics = createMetrics({
        lines: { total: 100, covered: 85, percentage: 85 },
      });

      expect(analyzer.isThresholdMet(metrics)).toBe(false);
    });
  });
});

describe('GapTracker', () => {
  let tracker: GapTracker;

  beforeEach(() => {
    tracker = new GapTracker();
  });

  const createGap = (id: string, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): import('./coverage-analyzer.js').TestGap => ({
    id,
    file: 'test.ts',
    line: 1,
    type: 'no-test',
    priority,
    suggestion: 'Add tests',
  });

  it('adds and retrieves gaps', () => {
    const gap = createGap('gap-1');
    tracker.addGap(gap);

    const gaps = tracker.getUnresolvedGaps();
    expect(gaps).toHaveLength(1);
    expect(gaps[0].id).toBe('gap-1');
  });

  it('resolves gaps', () => {
    const gap = createGap('gap-1');
    tracker.addGap(gap);

    const resolved = tracker.resolveGap('gap-1');
    expect(resolved).toBe(true);
    expect(tracker.getUnresolvedGaps()).toHaveLength(0);
  });

  it('returns false for unknown gap', () => {
    expect(tracker.resolveGap('unknown')).toBe(false);
  });

  it('filters gaps by priority', () => {
    tracker.addGap(createGap('g1', 'critical'));
    tracker.addGap(createGap('g2', 'low'));
    tracker.addGap(createGap('g3', 'critical'));

    const critical = tracker.getGapsByPriority('critical');
    expect(critical).toHaveLength(2);
  });

  it('filters gaps by file', () => {
    tracker.addGap({ ...createGap('g1'), file: 'a.ts' });
    tracker.addGap({ ...createGap('g2'), file: 'b.ts' });
    tracker.addGap({ ...createGap('g3'), file: 'a.ts' });

    const aGaps = tracker.getGapsByFile('a.ts');
    expect(aGaps).toHaveLength(2);
  });

  it('calculates stats', () => {
    tracker.addGap(createGap('g1', 'critical'));
    tracker.addGap(createGap('g2', 'high'));
    tracker.addGap(createGap('g3', 'medium'));
    tracker.addGap({ ...createGap('g4', 'low'), type: 'missing-branch' });

    const stats = tracker.getStats();

    expect(stats.total).toBe(4);
    expect(stats.byPriority.critical).toBe(1);
    expect(stats.byPriority.high).toBe(1);
    expect(stats.byPriority.medium).toBe(1);
    expect(stats.byPriority.low).toBe(1);
    expect(stats.byType['missing-branch']).toBe(1);
  });

  it('clears all gaps', () => {
    tracker.addGap(createGap('g1'));
    tracker.addGap(createGap('g2'));

    tracker.clear();

    expect(tracker.getUnresolvedGaps()).toHaveLength(0);
  });
});

describe('Helper Functions', () => {
  describe('createCoverageReport', () => {
    it('creates complete report', () => {
      const metrics = calculateMetrics(
        { total: 100, covered: 80 },
        { total: 50, covered: 35 },
        { total: 20, covered: 16 },
        { total: 100, covered: 80 }
      );

      const report = createCoverageReport(metrics, []);

      expect(report.timestamp).toBeDefined();
      expect(report.metrics.overall).toBeDefined();
    });
  });

  describe('calculateMetrics', () => {
    it('calculates percentages correctly', () => {
      const metrics = calculateMetrics(
        { total: 100, covered: 75 },
        { total: 50, covered: 25 },
        { total: 20, covered: 15 },
        { total: 100, covered: 80 }
      );

      expect(metrics.lines.percentage).toBe(75);
      expect(metrics.branches.percentage).toBe(50);
      expect(metrics.functions.percentage).toBe(75);
      expect(metrics.statements.percentage).toBe(80);
    });

    it('handles zero totals', () => {
      const metrics = calculateMetrics(
        { total: 0, covered: 0 },
        { total: 50, covered: 25 },
        { total: 20, covered: 15 },
        { total: 100, covered: 80 }
      );

      expect(metrics.lines.percentage).toBe(100);
    });

    it('calculates overall average', () => {
      const metrics = calculateMetrics(
        { total: 100, covered: 80 },
        { total: 100, covered: 80 },
        { total: 100, covered: 80 },
        { total: 100, covered: 80 }
      );

      expect(metrics.overall).toBe(80);
    });
  });
});

describe('Zod Schemas', () => {
  it('validates valid metrics', () => {
    const metrics = calculateMetrics(
      { total: 100, covered: 80 },
      { total: 50, covered: 35 },
      { total: 20, covered: 16 },
      { total: 100, covered: 80 }
    );

    const result = CoverageMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(true);
  });

  it('validates valid test gap', () => {
    const gap = {
      id: 'gap-1',
      file: 'test.ts',
      line: 10,
      type: 'no-test',
      priority: 'high',
      suggestion: 'Add tests',
    };

    const result = TestGapSchema.safeParse(gap);
    expect(result.success).toBe(true);
  });

  it('validates valid risk area', () => {
    const risk = {
      file: 'risky.ts',
      complexity: 25,
      coverage: 30,
      riskScore: 75,
      reasons: ['High complexity', 'Low coverage'],
    };

    const result = RiskAreaSchema.safeParse(risk);
    expect(result.success).toBe(true);
  });
});
