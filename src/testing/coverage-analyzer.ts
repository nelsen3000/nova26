// Coverage Analyzer & Gap Detector
// KIMI-TESTING-04: R16-04 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type CoverageType = 'line' | 'branch' | 'function' | 'statement';

export interface CoverageMetrics {
  lines: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
  overall: number;
}

export interface UncoveredRange {
  file: string;
  startLine: number;
  endLine: number;
  type: CoverageType;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TestGap {
  id: string;
  file: string;
  function?: string;
  line: number;
  type: 'no-test' | 'partial-coverage' | 'missing-branch' | 'missing-error-case';
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

export interface RiskArea {
  file: string;
  complexity: number;
  coverage: number;
  riskScore: number; // 0-100, higher = more risk
  reasons: string[];
}

export interface CoverageReport {
  timestamp: string;
  metrics: CoverageMetrics;
  uncoveredRanges: UncoveredRange[];
  gaps: TestGap[];
  riskAreas: RiskArea[];
  recommendations: string[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const CoverageMetricsSchema = z.object({
  lines: z.object({ total: z.number(), covered: z.number(), percentage: z.number() }),
  branches: z.object({ total: z.number(), covered: z.number(), percentage: z.number() }),
  functions: z.object({ total: z.number(), covered: z.number(), percentage: z.number() }),
  statements: z.object({ total: z.number(), covered: z.number(), percentage: z.number() }),
  overall: z.number(),
});

export const UncoveredRangeSchema = z.object({
  file: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  type: z.enum(['line', 'branch', 'function', 'statement']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

export const TestGapSchema = z.object({
  id: z.string(),
  file: z.string(),
  function: z.string().optional(),
  line: z.number(),
  type: z.enum(['no-test', 'partial-coverage', 'missing-branch', 'missing-error-case']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  suggestion: z.string(),
});

export const RiskAreaSchema = z.object({
  file: z.string(),
  complexity: z.number(),
  coverage: z.number(),
  riskScore: z.number(),
  reasons: z.array(z.string()),
});

// ============================================================================
// CoverageAnalyzer Class
// ============================================================================

export class CoverageAnalyzer {
  private threshold = {
    line: 80,
    branch: 70,
    function: 80,
    statement: 80,
  };

  setThresholds(thresholds: Partial<typeof this.threshold>): void {
    this.threshold = { ...this.threshold, ...thresholds };
  }

  analyze(metrics: CoverageMetrics, uncoveredRanges: UncoveredRange[]): CoverageReport {
    const gaps = this.detectGaps(uncoveredRanges);
    const riskAreas = this.identifyRiskAreas(metrics, uncoveredRanges);
    const recommendations = this.generateRecommendations(metrics, gaps, riskAreas);

    return {
      timestamp: new Date().toISOString(),
      metrics,
      uncoveredRanges,
      gaps,
      riskAreas,
      recommendations,
    };
  }

  detectGaps(uncoveredRanges: UncoveredRange[]): TestGap[] {
    const gaps: TestGap[] = [];
    const fileGroups = this.groupByFile(uncoveredRanges);

    for (const [file, ranges] of fileGroups) {
      // Group consecutive uncovered lines
      const mergedRanges = this.mergeRanges(ranges);

      for (const range of mergedRanges) {
        const gap: TestGap = {
          id: crypto.randomUUID(),
          file,
          line: range.startLine,
          type: this.determineGapType(range),
          priority: this.calculatePriority(range),
          suggestion: this.generateSuggestion(range),
        };
        gaps.push(gap);
      }
    }

    return gaps.sort((a, b) => this.priorityWeight(b.priority) - this.priorityWeight(a.priority));
  }

  identifyRiskAreas(_metrics: CoverageMetrics, uncoveredRanges: UncoveredRange[]): RiskArea[] {
    const fileGroups = this.groupByFile(uncoveredRanges);
    const riskAreas: RiskArea[] = [];

    for (const [file, ranges] of fileGroups) {
      const coverage = this.calculateFileCoverage(ranges);
      const complexity = this.estimateComplexity(ranges);
      const riskScore = this.calculateRiskScore(complexity, coverage);

      if (riskScore > 5) {
        riskAreas.push({
          file,
          complexity,
          coverage,
          riskScore,
          reasons: this.identifyRiskReasons(complexity, coverage, ranges),
        });
      }
    }

    return riskAreas.sort((a, b) => b.riskScore - a.riskScore);
  }

  generateRecommendations(metrics: CoverageMetrics, gaps: TestGap[], riskAreas: RiskArea[]): string[] {
    const recommendations: string[] = [];

    // Overall coverage recommendations
    if (metrics.lines.percentage < this.threshold.line) {
      recommendations.push(`Increase line coverage from ${metrics.lines.percentage.toFixed(1)}% to ${this.threshold.line}%`);
    }
    if (metrics.branches.percentage < this.threshold.branch) {
      recommendations.push(`Increase branch coverage from ${metrics.branches.percentage.toFixed(1)}% to ${this.threshold.branch}%`);
    }
    if (metrics.functions.percentage < this.threshold.function) {
      recommendations.push(`Increase function coverage from ${metrics.functions.percentage.toFixed(1)}% to ${this.threshold.function}%`);
    }

    // Gap-based recommendations
    const criticalGaps = gaps.filter(g => g.priority === 'critical');
    if (criticalGaps.length > 0) {
      recommendations.push(`Address ${criticalGaps.length} critical test gaps immediately`);
    }

    const errorGaps = gaps.filter(g => g.type === 'missing-error-case');
    if (errorGaps.length > 0) {
      recommendations.push(`Add error handling tests for ${errorGaps.length} uncovered error cases`);
    }

    // Risk-based recommendations
    if (riskAreas.length > 0) {
      const topRisk = riskAreas[0];
      recommendations.push(`Prioritize testing ${topRisk.file} (risk score: ${topRisk.riskScore.toFixed(1)})`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Coverage meets all thresholds - maintain current test quality');
    }

    return recommendations;
  }

  isThresholdMet(metrics: CoverageMetrics): boolean {
    return (
      metrics.lines.percentage >= this.threshold.line &&
      metrics.branches.percentage >= this.threshold.branch &&
      metrics.functions.percentage >= this.threshold.function &&
      metrics.statements.percentage >= this.threshold.statement
    );
  }

  getFailingThresholds(metrics: CoverageMetrics): string[] {
    const failing: string[] = [];
    if (metrics.lines.percentage < this.threshold.line) failing.push('line');
    if (metrics.branches.percentage < this.threshold.branch) failing.push('branch');
    if (metrics.functions.percentage < this.threshold.function) failing.push('function');
    if (metrics.statements.percentage < this.threshold.statement) failing.push('statement');
    return failing;
  }

  // ---- Private Helpers ----

  private groupByFile(ranges: UncoveredRange[]): Map<string, UncoveredRange[]> {
    const groups = new Map<string, UncoveredRange[]>();
    for (const range of ranges) {
      if (!groups.has(range.file)) {
        groups.set(range.file, []);
      }
      groups.get(range.file)!.push(range);
    }
    return groups;
  }

  private mergeRanges(ranges: UncoveredRange[]): UncoveredRange[] {
    if (ranges.length === 0) return [];

    const sorted = [...ranges].sort((a, b) => a.startLine - b.startLine);
    const merged: UncoveredRange[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const current = sorted[i];

      if (current.startLine <= last.endLine + 1) {
        // Merge overlapping or adjacent ranges
        last.endLine = Math.max(last.endLine, current.endLine);
        last.severity = this.higherSeverity(last.severity, current.severity);
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  private determineGapType(range: UncoveredRange): TestGap['type'] {
    const size = range.endLine - range.startLine + 1;

    if (range.type === 'branch') {
      return 'missing-branch';
    }
    if (size > 20) {
      return 'no-test';
    }
    if (size > 5) {
      return 'partial-coverage';
    }

    // Check for error handling patterns
    if (range.file.includes('error') || range.file.includes('exception')) {
      return 'missing-error-case';
    }

    return 'partial-coverage';
  }

  private calculatePriority(range: UncoveredRange): TestGap['priority'] {
    const size = range.endLine - range.endLine + 1;

    if (range.severity === 'critical') return 'critical';
    if (range.severity === 'high') return 'high';
    if (size > 10) return 'medium';
    return 'low';
  }

  private generateSuggestion(range: UncoveredRange): string {
    const size = range.endLine - range.startLine + 1;

    if (range.type === 'branch') {
      return `Add tests for uncovered branch at lines ${range.startLine}-${range.endLine}`;
    }
    if (size > 20) {
      return `Create comprehensive test suite for ${range.file} (${size} lines uncovered)`;
    }
    if (size > 5) {
      return `Expand test coverage for lines ${range.startLine}-${range.endLine}`;
    }
    return `Add test case for line ${range.startLine}`;
  }

  private calculateFileCoverage(ranges: UncoveredRange[]): number {
    // Simplified: assume 100 lines per file on average
    const totalUncovered = ranges.reduce((sum, r) => sum + (r.endLine - r.startLine + 1), 0);
    return Math.max(0, 100 - totalUncovered);
  }

  private estimateComplexity(ranges: UncoveredRange[]): number {
    // Simple heuristic: more uncovered ranges = higher complexity
    return Math.min(50, ranges.length * 5);
  }

  private calculateRiskScore(complexity: number, coverage: number): number {
    // Risk = complexity * (1 - coverage/100)
    const coverageFactor = 1 - coverage / 100;
    return Math.round(complexity * coverageFactor * 10) / 10;
  }

  private identifyRiskReasons(complexity: number, _coverage: number, ranges: UncoveredRange[]): string[] {
    const reasons: string[] = [];

    if (complexity > 20) {
      reasons.push('High code complexity');
    }
    if (_coverage < 50) {
      reasons.push('Low test coverage');
    }
    if (ranges.some(r => r.type === 'branch')) {
      reasons.push('Uncovered branches');
    }
    if (ranges.some(r => r.severity === 'critical')) {
      reasons.push('Critical uncovered code');
    }

    return reasons;
  }

  private priorityWeight(priority: TestGap['priority']): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[priority];
  }

  private higherSeverity(a: UncoveredRange['severity'], b: UncoveredRange['severity']): UncoveredRange['severity'] {
    const order = ['low', 'medium', 'high', 'critical'];
    return order.indexOf(a) > order.indexOf(b) ? a : b;
  }
}

// ============================================================================
// GapTracker Class
// ============================================================================

export class GapTracker {
  private gaps = new Map<string, TestGap>();

  addGap(gap: TestGap): void {
    this.gaps.set(gap.id, gap);
  }

  resolveGap(id: string): boolean {
    return this.gaps.delete(id);
  }

  getUnresolvedGaps(): TestGap[] {
    return Array.from(this.gaps.values());
  }

  getGapsByPriority(priority: TestGap['priority']): TestGap[] {
    return this.getUnresolvedGaps().filter(g => g.priority === priority);
  }

  getGapsByFile(file: string): TestGap[] {
    return this.getUnresolvedGaps().filter(g => g.file === file);
  }

  getStats(): { total: number; byPriority: Record<TestGap['priority'], number>; byType: Record<TestGap['type'], number> } {
    const gaps = this.getUnresolvedGaps();
    
    return {
      total: gaps.length,
      byPriority: {
        critical: gaps.filter(g => g.priority === 'critical').length,
        high: gaps.filter(g => g.priority === 'high').length,
        medium: gaps.filter(g => g.priority === 'medium').length,
        low: gaps.filter(g => g.priority === 'low').length,
      },
      byType: {
        'no-test': gaps.filter(g => g.type === 'no-test').length,
        'partial-coverage': gaps.filter(g => g.type === 'partial-coverage').length,
        'missing-branch': gaps.filter(g => g.type === 'missing-branch').length,
        'missing-error-case': gaps.filter(g => g.type === 'missing-error-case').length,
      },
    };
  }

  clear(): void {
    this.gaps.clear();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createCoverageReport(
  metrics: CoverageMetrics,
  uncoveredRanges: UncoveredRange[]
): CoverageReport {
  const analyzer = new CoverageAnalyzer();
  return analyzer.analyze(metrics, uncoveredRanges);
}

export function calculateMetrics(
  lines: { total: number; covered: number },
  branches: { total: number; covered: number },
  functions: { total: number; covered: number },
  statements: { total: number; covered: number }
): CoverageMetrics {
  const calcPercentage = (covered: number, total: number) => 
    total === 0 ? 100 : Math.round((covered / total) * 1000) / 10;

  const overall = Math.round((
    calcPercentage(lines.covered, lines.total) +
    calcPercentage(branches.covered, branches.total) +
    calcPercentage(functions.covered, functions.total) +
    calcPercentage(statements.covered, statements.total)
  ) / 4 * 10) / 10;

  return {
    lines: { ...lines, percentage: calcPercentage(lines.covered, lines.total) },
    branches: { ...branches, percentage: calcPercentage(branches.covered, branches.total) },
    functions: { ...functions, percentage: calcPercentage(functions.covered, functions.total) },
    statements: { ...statements, percentage: calcPercentage(statements.covered, statements.total) },
    overall,
  };
}
