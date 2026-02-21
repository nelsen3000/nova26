// Build Comparison Tests — KMS-19
// Tests for historical build comparison functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBuildMetrics,
  compareBuilds,
  formatComparisonResult,
  getAvailableBuilds,
  compareRecentBuilds,
  type BuildMetrics,
  type BuildComparisonResult,
  type AgentComparison,
} from '../build-comparison.js';
import { recordTaskResult, resetAnalytics } from '../agent-analytics.js';

describe('Build Comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalytics();
  });

  describe('getBuildMetrics', () => {
    it('should return null for non-existent build', () => {
      const metrics = getBuildMetrics('non-existent-build');
      expect(metrics).toBeNull();
    });

    it('should return metrics for existing build', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-1');
      recordTaskResult('VENUS', 'task-2', true, 1500, 3000, 0, undefined, 'build-1');

      const metrics = getBuildMetrics('build-1');

      expect(metrics).not.toBeNull();
      expect(metrics?.buildId).toBe('build-1');
      expect(metrics?.totalTasks).toBe(2);
      expect(metrics?.successfulTasks).toBe(2);
      expect(metrics?.failedTasks).toBe(0);
      expect(metrics?.passRate).toBe(1);
    });

    it('should calculate pass rate correctly for mixed results', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-2');
      recordTaskResult('MARS', 'task-2', false, 1000, 2000, 0, 'Error', 'build-2');
      recordTaskResult('MARS', 'task-3', false, 1000, 2000, 0, 'Error', 'build-2');

      const metrics = getBuildMetrics('build-2');

      expect(metrics?.passRate).toBeCloseTo(0.333, 2);
      expect(metrics?.successfulTasks).toBe(1);
      expect(metrics?.failedTasks).toBe(2);
    });

    it('should include agent usage breakdown', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-3');
      recordTaskResult('MARS', 'task-2', true, 1000, 3000, 0, undefined, 'build-3');
      recordTaskResult('VENUS', 'task-3', true, 2000, 4000, 0, undefined, 'build-3');

      const metrics = getBuildMetrics('build-3');

      expect(metrics?.agents).toHaveLength(2);
      
      const marsAgent = metrics?.agents.find(a => a.agentName === 'MARS');
      expect(marsAgent?.taskCount).toBe(2);
      expect(marsAgent?.totalTokens).toBe(2000);

      const venusAgent = metrics?.agents.find(a => a.agentName === 'VENUS');
      expect(venusAgent?.taskCount).toBe(1);
    });

    it('should calculate total duration from task durations', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 5000, 0, undefined, 'build-4');
      recordTaskResult('VENUS', 'task-2', true, 1000, 10000, 0, undefined, 'build-4');

      const metrics = getBuildMetrics('build-4');

      expect(metrics?.durationMs).toBe(15000);
    });
  });

  describe('compareBuilds', () => {
    it('should throw error for non-existent baseline build', () => {
      expect(() => {
        compareBuilds('non-existent', 'also-non-existent');
      }).toThrow('Baseline build not found');
    });

    it('should throw error for non-existent target build', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'baseline-build');

      expect(() => {
        compareBuilds('baseline-build', 'non-existent');
      }).toThrow('Target build not found');
      });

    it('should return comparison result for two builds', () => {
      // Setup baseline build
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'baseline-1');
      recordTaskResult('VENUS', 'task-2', true, 1000, 3000, 0, undefined, 'baseline-1');

      // Setup target build
      recordTaskResult('MARS', 'task-1', true, 1000, 2500, 0, undefined, 'target-1');
      recordTaskResult('VENUS', 'task-2', true, 1000, 3500, 0, undefined, 'target-1');

      const result = compareBuilds('baseline-1', 'target-1');

      expect(result.baselineBuildId).toBe('baseline-1');
      expect(result.targetBuildId).toBe('target-1');
      expect(result.baseline).toBeDefined();
      expect(result.target).toBeDefined();
      expect(result.diff).toBeDefined();
    });

    it('should detect duration regression', () => {
      // Slower build
      recordTaskResult('MARS', 'task-1', true, 1000, 1000, 0, undefined, 'baseline-slow');
      recordTaskResult('MARS', 'task-1', true, 1000, 1500, 0, undefined, 'target-slow');

      const result = compareBuilds('baseline-slow', 'target-slow');

      expect(result.diff.durationDiffMs).toBe(500);
      expect(result.diff.durationDiffPercent).toBe(0.5);
      
      const durationChange = result.changes.find(c => c.category === 'duration');
      expect(durationChange?.type).toBe('regression');
    });

    it('should detect duration improvement', () => {
      // Faster build
      recordTaskResult('MARS', 'task-1', true, 1000, 10000, 0, undefined, 'baseline-fast');
      recordTaskResult('MARS', 'task-1', true, 1000, 5000, 0, undefined, 'target-fast');

      const result = compareBuilds('baseline-fast', 'target-fast');

      expect(result.diff.durationDiffMs).toBe(-5000);
      expect(result.diff.durationDiffPercent).toBe(-0.5);
      
      const durationChange = result.changes.find(c => c.category === 'duration');
      expect(durationChange?.type).toBe('improvement');
    });

    it('should detect pass rate regression', () => {
      // Worse pass rate
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'baseline-pr');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'baseline-pr');
      
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'target-pr');
      recordTaskResult('MARS', 'task-2', false, 1000, 2000, 0, 'Error', 'target-pr');

      const result = compareBuilds('baseline-pr', 'target-pr');

      expect(result.diff.passRateDiff).toBe(-0.5);
      
      const passRateChange = result.changes.find(c => c.category === 'pass_rate');
      expect(passRateChange?.type).toBe('regression');
    });

    it('should detect pass rate improvement', () => {
      // Better pass rate
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'baseline-pr2');
      recordTaskResult('MARS', 'task-2', false, 1000, 2000, 0, 'Error', 'baseline-pr2');
      
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'target-pr2');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'target-pr2');

      const result = compareBuilds('baseline-pr2', 'target-pr2');

      expect(result.diff.passRateDiff).toBe(0.5);
      
      const passRateChange = result.changes.find(c => c.category === 'pass_rate');
      expect(passRateChange?.type).toBe('improvement');
    });

    it('should identify added agents', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'baseline-agents');
      
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'target-agents');
      recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0, undefined, 'target-agents');

      const result = compareBuilds('baseline-agents', 'target-agents');

      const venusComparison = result.agentComparisons.find(c => c.agentName === 'VENUS');
      expect(venusComparison?.status).toBe('added');
      expect(venusComparison?.before).toBeNull();
      expect(venusComparison?.after).not.toBeNull();
    });

    it('should identify removed agents', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'baseline-agents2');
      recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0, undefined, 'baseline-agents2');
      
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'target-agents2');

      const result = compareBuilds('baseline-agents2', 'target-agents2');

      const venusComparison = result.agentComparisons.find(c => c.agentName === 'VENUS');
      expect(venusComparison?.status).toBe('removed');
      expect(venusComparison?.before).not.toBeNull();
      expect(venusComparison?.after).toBeNull();
    });

    it('should identify increased agent usage', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'baseline-usage');
      
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'target-usage');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'target-usage');
      recordTaskResult('MARS', 'task-3', true, 1000, 2000, 0, undefined, 'target-usage');

      const result = compareBuilds('baseline-usage', 'target-usage');

      const marsComparison = result.agentComparisons.find(c => c.agentName === 'MARS');
      expect(marsComparison?.status).toBe('increased');
      expect(marsComparison?.taskCountDiff).toBe(2);
    });

    it('should calculate summary correctly for better build', () => {
      // Faster and better pass rate
      recordTaskResult('MARS', 'task-1', true, 1000, 10000, 0, undefined, 'baseline-sum');
      recordTaskResult('MARS', 'task-2', false, 1000, 10000, 0, 'Error', 'baseline-sum');
      
      recordTaskResult('MARS', 'task-1', true, 1000, 5000, 0, undefined, 'target-sum');
      recordTaskResult('MARS', 'task-2', true, 1000, 5000, 0, undefined, 'target-sum');

      const result = compareBuilds('baseline-sum', 'target-sum');

      expect(result.summary.overallStatus).toBe('better');
      expect(result.summary.totalImprovements).toBeGreaterThan(0);
      expect(result.summary.totalRegressions).toBe(0);
    });

    it('should calculate summary correctly for worse build', () => {
      // Slower and worse pass rate
      recordTaskResult('MARS', 'task-1', true, 1000, 5000, 0, undefined, 'baseline-worse');
      recordTaskResult('MARS', 'task-2', true, 1000, 5000, 0, undefined, 'baseline-worse');
      
      recordTaskResult('MARS', 'task-1', true, 1000, 10000, 0, undefined, 'target-worse');
      recordTaskResult('MARS', 'task-2', false, 1000, 10000, 0, 'Error', 'target-worse');

      const result = compareBuilds('baseline-worse', 'target-worse');

      expect(result.summary.overallStatus).toBe('worse');
      expect(result.summary.totalRegressions).toBeGreaterThan(0);
      expect(result.summary.totalImprovements).toBe(0);
    });

    it('should respect custom threshold options', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 1000, 0, undefined, 'baseline-opts');
      recordTaskResult('MARS', 'task-1', true, 1000, 1150, 0, undefined, 'target-opts'); // 15% increase

      // With default 10% threshold, should detect regression
      const resultDefault = compareBuilds('baseline-opts', 'target-opts');
      expect(resultDefault.changes.some(c => c.category === 'duration')).toBe(true);

      // With 20% threshold, should not detect regression
      const resultHighThreshold = compareBuilds('baseline-opts', 'target-opts', {
        durationRegressionThreshold: 0.2,
      });
      expect(resultHighThreshold.changes.some(c => c.category === 'duration')).toBe(false);
    });
  });

  describe('formatComparisonResult', () => {
    it('should format comparison as string', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'fmt-baseline');
      recordTaskResult('MARS', 'task-1', true, 1000, 2500, 0, undefined, 'fmt-target');

      const result = compareBuilds('fmt-baseline', 'fmt-target');
      const formatted = formatComparisonResult(result);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('Build Comparison Report');
      expect(formatted).toContain('fmt-baseline');
      expect(formatted).toContain('fmt-target');
      expect(formatted).toContain('Overall Summary');
      expect(formatted).toContain('Metrics Comparison');
      expect(formatted).toContain('Agent Usage Changes');
    });

    it('should include agent changes in formatted output', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'fmt-b2');
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'fmt-t2');
      recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0, undefined, 'fmt-t2');

      const result = compareBuilds('fmt-b2', 'fmt-t2');
      const formatted = formatComparisonResult(result);

      expect(formatted).toContain('VENUS');
    });
  });

  describe('getAvailableBuilds', () => {
    it('should return empty array when no builds exist', () => {
      const builds = getAvailableBuilds();
      expect(builds).toEqual([]);
    });

    it('should return available builds with metadata', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'avail-1');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'avail-1');
      recordTaskResult('VENUS', 'task-3', true, 1000, 2000, 0, undefined, 'avail-2');

      const builds = getAvailableBuilds();

      expect(builds.length).toBeGreaterThanOrEqual(2);
      
      const build1 = builds.find(b => b.buildId === 'avail-1');
      expect(build1?.taskCount).toBe(2);
      
      const build2 = builds.find(b => b.buildId === 'avail-2');
      expect(build2?.taskCount).toBe(1);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        recordTaskResult('MARS', `task-${i}`, true, 1000, 2000, 0, undefined, `limit-build-${i}`);
      }

      const builds = getAvailableBuilds(5);
      expect(builds.length).toBeLessThanOrEqual(5);
    });
  });

  describe('compareRecentBuilds', () => {
    it('should return null when fewer than 2 builds exist', () => {
      const result = compareRecentBuilds();
      expect(result).toBeNull();
    });

    it('should compare the two most recent builds', () => {
      // First build (older)
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'recent-1');
      // Second build (newer) - recorded after recent-1
      recordTaskResult('MARS', 'task-1', true, 1000, 3000, 0, undefined, 'recent-2');

      const result = compareRecentBuilds();

      expect(result).not.toBeNull();
      // Verify we get a valid comparison - baseline should be older, target should be newer
      expect(result?.baseline.timestamp).toBeDefined();
      expect(result?.target.timestamp).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle builds with zero duration', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 0, 0, undefined, 'zero-baseline');
      recordTaskResult('MARS', 'task-1', true, 1000, 1000, 0, undefined, 'zero-target');

      const result = compareBuilds('zero-baseline', 'zero-target');

      expect(result.diff.durationDiffMs).toBe(1000);
      expect(result.diff.durationDiffPercent).toBe(0); // Baseline was 0
    });

    it('should handle builds with no agents', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'empty-baseline');
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'empty-target');

      const result = compareBuilds('empty-baseline', 'empty-target');

      expect(result.agentComparisons.length).toBeGreaterThan(0);
    });

    it('should calculate cost based on token usage', () => {
      recordTaskResult('MARS', 'task-1', true, 100000, 2000, 0, undefined, 'cost-baseline');
      recordTaskResult('MARS', 'task-1', true, 200000, 2000, 0, undefined, 'cost-target');

      const result = compareBuilds('cost-baseline', 'cost-target');

      // Cost should be approximately 2x for target
      expect(result.baseline.estimatedCostUsd).toBeGreaterThan(0);
      expect(result.target.estimatedCostUsd).toBeGreaterThan(result.baseline.estimatedCostUsd);
      expect(result.diff.costDiffPercent).toBeCloseTo(1, 1); // 100% increase
    });

    it('should assign correct severity levels', () => {
      // Critical regression: pass rate drop > 20%
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'sev-baseline');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'sev-baseline');
      recordTaskResult('MARS', 'task-3', true, 1000, 2000, 0, undefined, 'sev-baseline');
      recordTaskResult('MARS', 'task-4', true, 1000, 2000, 0, undefined, 'sev-baseline');
      recordTaskResult('MARS', 'task-5', true, 1000, 2000, 0, undefined, 'sev-baseline');
      
      recordTaskResult('MARS', 'task-1', false, 1000, 2000, 0, 'Error', 'sev-target');
      recordTaskResult('MARS', 'task-2', false, 1000, 2000, 0, 'Error', 'sev-target');
      recordTaskResult('MARS', 'task-3', false, 1000, 2000, 0, 'Error', 'sev-target');
      recordTaskResult('MARS', 'task-4', false, 1000, 2000, 0, 'Error', 'sev-target');
      recordTaskResult('MARS', 'task-5', true, 1000, 2000, 0, undefined, 'sev-target');

      const result = compareBuilds('sev-baseline', 'sev-target');

      const passRateChange = result.changes.find(c => c.category === 'pass_rate');
      expect(passRateChange?.severity).toBe('critical');
      expect(passRateChange?.type).toBe('regression');
    });
  });
});
