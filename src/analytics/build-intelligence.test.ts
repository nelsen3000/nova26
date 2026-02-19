// Build Intelligence Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getBuildIntelligence,
  resetBuildIntelligence,
  type BuildTimePrediction,
  type ROISummary,
  type AgentHeatmapEntry,
} from './build-intelligence.js';
import { recordTaskResult, resetAnalytics } from './agent-analytics.js';

describe('Build Intelligence', () => {
  beforeEach(() => {
    resetAnalytics();
    resetBuildIntelligence();
  });

  afterEach(() => {
    resetAnalytics();
    resetBuildIntelligence();
  });

  describe('getBuildIntelligence', () => {
    it('should return a singleton instance', () => {
      const instance1 = getBuildIntelligence();
      const instance2 = getBuildIntelligence();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after reset', () => {
      const instance1 = getBuildIntelligence();
      resetBuildIntelligence();
      const instance2 = getBuildIntelligence();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('predictBuildTime', () => {
    it('should return heuristic prediction when no historical data', () => {
      const intelligence = getBuildIntelligence();
      const prediction = intelligence.predictBuildTime('Create a simple API endpoint', 'MARS');

      expect(prediction.basis).toBe('heuristic');
      expect(prediction.confidence).toBe(0.40);
      expect(prediction.estimatedMinutes).toBeGreaterThan(0);
    });

    it('should return historical prediction with sufficient similar tasks', () => {
      const intelligence = getBuildIntelligence();
      
      // Record multiple similar tasks
      for (let i = 0; i < 5; i++) {
        recordTaskResult('MARS', 'create user authentication endpoint', true, 1000, 120000, 0, undefined, 'build-1');
      }

      const prediction = intelligence.predictBuildTime('create user auth endpoint', 'MARS');

      expect(prediction.basis).toBe('historical');
      expect(prediction.confidence).toBe(0.75);
      expect(prediction.estimatedMinutes).toBeCloseTo(2, 0); // 120000ms = 2min
    });

    it('should calculate heuristic based on task description length', () => {
      const intelligence = getBuildIntelligence();
      
      // Short description (under 200 chars) - base 5 min
      const shortDesc = 'Create API';
      const shortPrediction = intelligence.predictBuildTime(shortDesc, 'MARS');
      expect(shortPrediction.estimatedMinutes).toBe(5);

      // Long description (over 200 chars) - base + extra
      const longDesc = 'Create a comprehensive user authentication and authorization system with JWT tokens, refresh tokens, password hashing using bcrypt, email verification, password reset functionality, rate limiting, and audit logging for all authentication events';
      const longPrediction = intelligence.predictBuildTime(longDesc, 'MARS');
      expect(longPrediction.estimatedMinutes).toBeGreaterThan(5);
    });

    it('should use similar task IDs for matching', () => {
      const intelligence = getBuildIntelligence();
      
      recordTaskResult('VENUS', 'design login form component', true, 1000, 300000, 0, undefined, 'build-1');
      recordTaskResult('VENUS', 'design signup form component', true, 1000, 300000, 0, undefined, 'build-1');
      recordTaskResult('VENUS', 'design profile form component', true, 1000, 300000, 0, undefined, 'build-1');

      const prediction = intelligence.predictBuildTime('design form component', 'VENUS');

      expect(prediction.basis).toBe('historical');
    });

    it('should return different agents independently', () => {
      const intelligence = getBuildIntelligence();
      
      // Use matching task IDs with longer keywords for better overlap
      recordTaskResult('MARS', 'create backend api', true, 1000, 180000, 0, undefined, 'build-1');
      recordTaskResult('MARS', 'create backend service', true, 1000, 180000, 0, undefined, 'build-1');
      recordTaskResult('MARS', 'create backend endpoint', true, 1000, 180000, 0, undefined, 'build-1');
      recordTaskResult('VENUS', 'design frontend component', true, 1000, 120000, 0, undefined, 'build-1');
      recordTaskResult('VENUS', 'design frontend widget', true, 1000, 120000, 0, undefined, 'build-1');
      recordTaskResult('VENUS', 'design frontend element', true, 1000, 120000, 0, undefined, 'build-1');

      const marsPrediction = intelligence.predictBuildTime('create backend api', 'MARS');
      const venusPrediction = intelligence.predictBuildTime('design frontend component', 'VENUS');

      expect(marsPrediction.basis).toBe('historical');
      expect(venusPrediction.basis).toBe('historical');
    });
  });

  describe('calculateROI', () => {
    it('should return zero ROI when no builds in period', () => {
      const intelligence = getBuildIntelligence();
      const roi = intelligence.calculateROI('user-1', 'last-30-days');

      expect(roi.userId).toBe('user-1');
      expect(roi.buildCount).toBe(0);
      expect(roi.estimatedHoursSaved).toBe(0);
      expect(roi.netROI).toBe(-299); // Just premium cost
    });

    it('should calculate ROI for single month period', () => {
      const intelligence = getBuildIntelligence();
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      // Record some builds
      for (let i = 0; i < 5; i++) {
        recordTaskResult('MARS', `task-${i}`, true, 1000, 600000, 0, undefined, `build-${i}`, 1, 1, 'implementation');
      }

      const roi = intelligence.calculateROI('user-1', currentMonth);

      expect(roi.buildCount).toBe(5);
      expect(roi.premiumCostUsd).toBe(299);
      expect(roi.estimatedHoursSaved).toBeGreaterThan(0);
      expect(roi.estimatedCostSavedUsd).toBeGreaterThan(0);
    });

    it('should calculate hours saved correctly', () => {
      const intelligence = getBuildIntelligence();

      // 10 separate builds, each taking 30 min (1800000ms) - total 5 hours
      for (let i = 0; i < 10; i++) {
        recordTaskResult('MARS', `task-${i}`, true, 1000, 1800000, 0, undefined, `build-${i}`, 0, 0, 'implementation');
      }

      const roi = intelligence.calculateROI('user-1', 'last-30-days');

      // Manual estimate: 10 builds * 2 hours = 20 hours
      // Actual time: 10 * 0.5 hours = 5 hours
      // Hours saved: 20 - 5 = 15 hours
      expect(roi.buildCount).toBe(10);
      expect(roi.estimatedHoursSaved).toBeCloseTo(15, 0);
    });

    it('should floor hours saved at zero', () => {
      const intelligence = getBuildIntelligence();

      // Many long builds that take more than manual estimate
      for (let i = 0; i < 100; i++) {
        recordTaskResult('MARS', `task-${i}`, true, 1000, 3600000, 0, undefined, `build-${i}`, 0, 0, 'implementation');
      }

      const roi = intelligence.calculateROI('user-1', 'last-30-days');
      expect(roi.estimatedHoursSaved).toBeGreaterThanOrEqual(0);
    });

    it('should cost savings be hours saved times 150', () => {
      const intelligence = getBuildIntelligence();

      for (let i = 0; i < 10; i++) {
        recordTaskResult('MARS', `task-${i}`, true, 1000, 600000, 0, undefined, `build-${i}`, 0, 0, 'implementation');
      }

      const roi = intelligence.calculateROI('user-1', 'last-30-days');
      expect(roi.estimatedCostSavedUsd).toBe(roi.estimatedHoursSaved * 150);
    });
  });

  describe('getAgentHeatmap', () => {
    it('should return empty array when no data', () => {
      const intelligence = getBuildIntelligence();
      const heatmap = intelligence.getAgentHeatmap('user-1');

      expect(heatmap).toEqual([]);
    });

    it('should group tasks by agent and build_phase', () => {
      const intelligence = getBuildIntelligence();

      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-1', 0, 0, 'implementation');
      recordTaskResult('MARS', 'task-2', true, 1000, 3000, 0, undefined, 'build-1', 0, 0, 'implementation');
      recordTaskResult('MARS', 'task-3', false, 1000, 4000, 0, 'Error', 'build-1', 0, 0, 'testing');

      const heatmap = intelligence.getAgentHeatmap('user-1');

      expect(heatmap).toHaveLength(2);
      
      const implEntry = heatmap.find(e => e.taskType === 'implementation');
      expect(implEntry).toBeDefined();
      expect(implEntry?.totalTasks).toBe(2);
      expect(implEntry?.successRate).toBe(1);

      const testEntry = heatmap.find(e => e.taskType === 'testing');
      expect(testEntry).toBeDefined();
      expect(testEntry?.totalTasks).toBe(1);
      expect(testEntry?.successRate).toBe(0);
    });

    it('should sort by agent name ascending, then success rate descending', () => {
      const intelligence = getBuildIntelligence();

      recordTaskResult('VENUS', 'task-1', false, 1000, 2000, 0, 'Error', 'build-1', 0, 0, 'implementation');
      recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0, undefined, 'build-1', 0, 0, 'design');
      recordTaskResult('MARS', 'task-3', true, 1000, 2000, 0, undefined, 'build-1', 0, 0, 'implementation');

      const heatmap = intelligence.getAgentHeatmap('user-1');

      // First by agent name
      expect(heatmap[0].agentName).toBe('MARS');
      expect(heatmap[1].agentName).toBe('VENUS');
      expect(heatmap[2].agentName).toBe('VENUS');

      // VENUS entries should be sorted by success rate (design=1.0 before implementation=0.5)
      expect(heatmap[1].taskType).toBe('design');
      expect(heatmap[1].successRate).toBe(1);
      expect(heatmap[2].taskType).toBe('implementation');
    });

    it('should use "general" as default task type when build_phase is null', () => {
      const intelligence = getBuildIntelligence();

      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-1', 0, 0);

      const heatmap = intelligence.getAgentHeatmap('user-1');

      expect(heatmap).toHaveLength(1);
      expect(heatmap[0].taskType).toBe('general');
    });

    it('should calculate average duration correctly', () => {
      const intelligence = getBuildIntelligence();

      recordTaskResult('MARS', 'task-1', true, 1000, 1000, 0, undefined, 'build-1', 0, 0, 'implementation');
      recordTaskResult('MARS', 'task-2', true, 1000, 3000, 0, undefined, 'build-1', 0, 0, 'implementation');
      recordTaskResult('MARS', 'task-3', true, 1000, 5000, 0, undefined, 'build-1', 0, 0, 'implementation');

      const heatmap = intelligence.getAgentHeatmap('user-1');

      expect(heatmap[0].avgDurationMs).toBe(3000); // Average of 1000, 3000, 5000
    });
  });

  describe('edge cases', () => {
    it('should handle very long task descriptions', () => {
      const intelligence = getBuildIntelligence();
      const longDesc = 'a'.repeat(5000);
      
      const prediction = intelligence.predictBuildTime(longDesc, 'MARS');
      
      expect(prediction.estimatedMinutes).toBeGreaterThan(5);
      expect(prediction.basis).toBe('heuristic');
    });

    it('should handle special characters in task IDs', () => {
      const intelligence = getBuildIntelligence();
      
      recordTaskResult('MARS', 'task-with-@#$%^&*()-special-chars', true, 1000, 120000, 0, undefined, 'build-1');
      
      const prediction = intelligence.predictBuildTime('task with special chars', 'MARS');
      
      expect(prediction.estimatedMinutes).toBeGreaterThan(0);
    });

    it('should handle zero duration tasks', () => {
      const intelligence = getBuildIntelligence();

      recordTaskResult('MARS', 'task-1', true, 1000, 0, 0, undefined, 'build-1');
      recordTaskResult('MARS', 'task-2', true, 1000, 0, 0, undefined, 'build-1');
      recordTaskResult('MARS', 'task-3', true, 1000, 0, 0, undefined, 'build-1');

      const prediction = intelligence.predictBuildTime('task', 'MARS');

      expect(prediction.basis).toBe('historical');
      expect(prediction.estimatedMinutes).toBe(0);
    });

    it('should handle agents with only failed tasks', () => {
      const intelligence = getBuildIntelligence();

      for (let i = 0; i < 5; i++) {
        recordTaskResult('FAILING', `task-${i}`, false, 1000, 120000, 0, 'Error', 'build-1');
      }

      const heatmap = intelligence.getAgentHeatmap('user-1');
      const failingEntry = heatmap.find(e => e.agentName === 'FAILING');

      expect(failingEntry?.successRate).toBe(0);
    });

    it('should handle multiple users independently', () => {
      const intelligence = getBuildIntelligence();

      // Both users see the same agent data (global database)
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-1');

      const heatmap1 = intelligence.getAgentHeatmap('user-1');
      const heatmap2 = intelligence.getAgentHeatmap('user-2');

      expect(heatmap1).toHaveLength(1);
      expect(heatmap2).toHaveLength(1);
    });
  });
});
