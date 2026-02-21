// Build Metrics Aggregator Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateBuildMetrics,
  calculateMultipleBuildMetrics,
  getBuildMetricsSummary,
  formatBuildMetrics,
  formatMetricsSummary,
  compareBuilds,
  getAllBuildIds,
  analyzeTrends,
  type BuildMetrics,
  type BuildComparison,
  type TrendAnalysis,
} from '../build-metrics.js';
import { recordTaskResult, resetAnalytics } from '../agent-analytics.js';

describe('Build Metrics Aggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalytics();
  });

  describe('calculateBuildMetrics', () => {
    it('should return null for unknown build', () => {
      const metrics = calculateBuildMetrics('unknown-build');
      expect(metrics).toBeNull();
    });

    it('should calculate duration from task timestamps', () => {
      const buildId = 'build-1';
      recordTaskResult('MARS', 'task-1', true, 1000, 5000, 0, undefined, buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      expect(metrics).not.toBeNull();
      expect(metrics?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate task count correctly', () => {
      const buildId = 'build-2';
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, buildId);
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, buildId);
      recordTaskResult('VENUS', 'task-3', false, 1000, 2000, 0, 'Error', buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      expect(metrics?.taskCount.total).toBe(3);
      expect(metrics?.taskCount.completed).toBe(2);
      expect(metrics?.taskCount.failed).toBe(1);
    });

    it('should calculate pass rate correctly', () => {
      const buildId = 'build-3';
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, buildId);
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, buildId);
      recordTaskResult('MARS', 'task-3', false, 1000, 2000, 0, 'Error', buildId);
      recordTaskResult('MARS', 'task-4', false, 1000, 2000, 0, 'Error', buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      expect(metrics?.passRate).toBe(0.5);
    });

    it('should calculate zero pass rate for all failed', () => {
      const buildId = 'build-4';
      recordTaskResult('MARS', 'task-1', false, 1000, 2000, 0, 'Error', buildId);
      recordTaskResult('MARS', 'task-2', false, 1000, 2000, 0, 'Error', buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      expect(metrics?.passRate).toBe(0);
    });

    it('should calculate 100% pass rate for all successful', () => {
      const buildId = 'build-5';
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, buildId);
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      expect(metrics?.passRate).toBe(1);
    });

    it('should sum tokens used correctly', () => {
      const buildId = 'build-6';
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, buildId);
      recordTaskResult('MARS', 'task-2', true, 2000, 2000, 0, undefined, buildId);
      recordTaskResult('MARS', 'task-3', true, 3000, 2000, 0, undefined, buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      expect(metrics?.tokensUsed).toBe(6000);
    });

    it('should estimate cost based on tokens', () => {
      const buildId = 'build-7';
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      expect(metrics?.costEstimate).toBeGreaterThan(0);
      expect(metrics?.costEstimate).toBe((1000 / 1000) * 0.002);
    });

    it('should calculate agent utilization', () => {
      const buildId = 'build-8';
      recordTaskResult('MARS', 'task-1', true, 1000, 5000, 0, undefined, buildId);
      recordTaskResult('MARS', 'task-2', true, 1000, 5000, 0, undefined, buildId);
      recordTaskResult('VENUS', 'task-3', false, 1000, 3000, 0, 'Error', buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      expect(metrics?.agentUtilization).toHaveLength(2);
      
      const marsUtil = metrics?.agentUtilization.find(a => a.agent === 'MARS');
      expect(marsUtil?.tasksAssigned).toBe(2);
      expect(marsUtil?.tasksCompleted).toBe(2);
      expect(marsUtil?.percentageOfBuild).toBe(2 / 3);
    });

    it('should calculate average agent duration', () => {
      const buildId = 'build-9';
      recordTaskResult('MARS', 'task-1', true, 1000, 1000, 0, undefined, buildId);
      recordTaskResult('MARS', 'task-2', true, 1000, 3000, 0, undefined, buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      const marsUtil = metrics?.agentUtilization.find(a => a.agent === 'MARS');
      expect(marsUtil?.avgDuration).toBe(2000);
    });

    it('should include start and end times', () => {
      const buildId = 'build-10';
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, buildId);
      
      const metrics = calculateBuildMetrics(buildId);
      expect(metrics?.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(metrics?.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('calculateMultipleBuildMetrics', () => {
    it('should handle multiple builds', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-a');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'build-b');
      
      const metrics = calculateMultipleBuildMetrics(['build-a', 'build-b', 'unknown']);
      expect(metrics).toHaveLength(3);
      expect(metrics[0]).not.toBeNull();
      expect(metrics[1]).not.toBeNull();
      expect(metrics[2]).toBeNull();
    });
  });

  describe('getBuildMetricsSummary', () => {
    it('should return zero summary for empty builds', () => {
      const summary = getBuildMetricsSummary(['unknown-1', 'unknown-2']);
      expect(summary.totalBuilds).toBe(0);
      expect(summary.avgDuration).toBe(0);
      expect(summary.totalTasks).toBe(0);
      expect(summary.overallPassRate).toBe(0);
      expect(summary.totalCost).toBe(0);
      expect(summary.totalTokens).toBe(0);
    });

    it('should calculate average duration across builds', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-1');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'build-2');
      
      const summary = getBuildMetricsSummary(['build-1', 'build-2']);
      expect(summary.totalBuilds).toBe(2);
      expect(summary.avgDuration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate overall pass rate across builds', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-1');
      recordTaskResult('MARS', 'task-2', false, 1000, 2000, 0, 'Error', 'build-2');
      recordTaskResult('MARS', 'task-3', true, 1000, 2000, 0, undefined, 'build-2');
      
      const summary = getBuildMetricsSummary(['build-1', 'build-2']);
      expect(summary.totalTasks).toBe(3);
      expect(summary.overallPassRate).toBe(2 / 3);
    });

    it('should sum total cost across builds', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-1');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'build-2');
      
      const summary = getBuildMetricsSummary(['build-1', 'build-2']);
      expect(summary.totalCost).toBeGreaterThan(0);
      expect(summary.totalTokens).toBe(2000);
    });
  });

  describe('formatBuildMetrics', () => {
    it('should format metrics with all sections', () => {
      const metrics: BuildMetrics = {
        buildId: 'test-build',
        duration: 60000,
        taskCount: { total: 5, completed: 4, failed: 1 },
        passRate: 0.8,
        agentUtilization: [
          { agent: 'MARS', tasksAssigned: 3, tasksCompleted: 3, tasksFailed: 0, avgDuration: 5000, percentageOfBuild: 0.6 },
          { agent: 'VENUS', tasksAssigned: 2, tasksCompleted: 1, tasksFailed: 1, avgDuration: 3000, percentageOfBuild: 0.4 },
        ],
        costEstimate: 0.01,
        tokensUsed: 5000,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:01:00Z',
      };
      
      const formatted = formatBuildMetrics(metrics);
      expect(formatted).toContain('test-build');
      expect(formatted).toContain('MARS');
      expect(formatted).toContain('VENUS');
      expect(formatted).toContain('80.0%');
      expect(formatted).toContain('5,000');
    });

    it('should handle empty agent utilization', () => {
      const metrics: BuildMetrics = {
        buildId: 'empty-build',
        duration: 0,
        taskCount: { total: 0, completed: 0, failed: 0 },
        passRate: 0,
        agentUtilization: [],
        costEstimate: 0,
        tokensUsed: 0,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:00Z',
      };
      
      const formatted = formatBuildMetrics(metrics);
      expect(formatted).toContain('No agents assigned');
    });
  });

  describe('formatMetricsSummary', () => {
    it('should format summary correctly', () => {
      const summary = {
        totalBuilds: 10,
        avgDuration: 60000,
        totalTasks: 50,
        overallPassRate: 0.9,
        totalCost: 0.5,
        totalTokens: 250000,
      };
      
      const formatted = formatMetricsSummary(summary);
      expect(formatted).toContain('10');
      expect(formatted).toContain('50');
      expect(formatted).toContain('90.0%');
      expect(formatted).toContain('250,000');
    });
  });

  describe('compareBuilds', () => {
    it('should return null if either build not found', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-x');
      
      expect(compareBuilds('build-x', 'unknown')).toBeNull();
      expect(compareBuilds('unknown', 'build-x')).toBeNull();
    });

    it('should calculate deltas correctly', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-a');
      recordTaskResult('MARS', 'task-2', true, 2000, 2000, 0, undefined, 'build-b');
      
      const comparison = compareBuilds('build-a', 'build-b');
      expect(comparison).not.toBeNull();
      expect(comparison?.tokenDelta).toBe(1000);
      expect(comparison?.costDelta).toBeGreaterThan(0);
    });

    it('should determine winner based on pass rate', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'winner-build');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'winner-build');
      recordTaskResult('MARS', 'task-3', false, 1000, 2000, 0, 'Error', 'loser-build');
      
      const comparison = compareBuilds('winner-build', 'loser-build');
      expect(comparison?.winner).toBe('winner-build');
    });

    it('should return tie for equal builds', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-same-1');
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-same-2');
      
      const comparison = compareBuilds('build-same-1', 'build-same-2');
      expect(comparison?.winner).toBe('tie');
    });
  });

  describe('getAllBuildIds', () => {
    it('should return empty array when no builds', () => {
      const ids = getAllBuildIds();
      expect(ids).toEqual([]);
    });

    it('should return unique build IDs', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'unique-build');
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0, undefined, 'unique-build');
      recordTaskResult('MARS', 'task-3', true, 1000, 2000, 0, undefined, 'another-build');
      
      const ids = getAllBuildIds();
      expect(ids).toContain('unique-build');
      expect(ids).toContain('another-build');
      expect(ids).toHaveLength(2);
    });
  });

  describe('analyzeTrends', () => {
    it('should return stable for single build', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'single-build');
      
      const trends = analyzeTrends(['single-build']);
      expect(trends.passRateTrend).toBe('stable');
      expect(trends.durationTrend).toBe('stable');
      expect(trends.costTrend).toBe('stable');
    });

    it('should detect improving pass rate', () => {
      // First build: 50% pass rate
      recordTaskResult('MARS', 't1', true, 1000, 2000, 0, undefined, 'trend-1');
      recordTaskResult('MARS', 't2', false, 1000, 2000, 0, 'Error', 'trend-1');
      
      // Second build: 100% pass rate  
      recordTaskResult('MARS', 't3', true, 1000, 2000, 0, undefined, 'trend-2');
      recordTaskResult('MARS', 't4', true, 1000, 2000, 0, undefined, 'trend-2');
      
      const trends = analyzeTrends(['trend-1', 'trend-2']);
      expect(trends.passRateTrend).toBe('improving');
    });

    it('should detect degrading metrics', () => {
      // First build: 100% pass rate
      recordTaskResult('MARS', 't1', true, 1000, 2000, 0, undefined, 'degrade-1');
      
      // Second build: 0% pass rate
      recordTaskResult('MARS', 't2', false, 1000, 2000, 0, 'Error', 'degrade-2');
      
      const trends = analyzeTrends(['degrade-1', 'degrade-2']);
      expect(trends.passRateTrend).toBe('degrading');
    });
  });
});
