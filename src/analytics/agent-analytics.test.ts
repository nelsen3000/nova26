// Agent Analytics Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  recordTaskResult,
  getAgentStats,
  getAllAgentStats,
  getLeaderboard,
  getRecommendation,
  getTrends,
  resetAnalytics,
  getBuildStats,
  getTopPerformers,
  formatAgentStats,
} from './agent-analytics.js';

describe('Agent Analytics', () => {
  beforeEach(() => {
    resetAnalytics();
  });

  afterEach(() => {
    resetAnalytics();
  });

  describe('recordTaskResult', () => {
    it('should record a successful task result', () => {
      recordTaskResult('MARS', 'task-1', true, 1500, 2500, 0);
      
      const stats = getAgentStats('MARS');
      expect(stats.totalTasks).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.avgTokens).toBe(1500);
      expect(stats.avgDuration).toBe(2500);
    });

    it('should record a failed task result with failure reason', () => {
      recordTaskResult('VENUS', 'task-2', false, 2000, 3000, 1, 'TypeScript error', 'build-1');
      
      const stats = getAgentStats('VENUS');
      expect(stats.totalTasks).toBe(1);
      expect(stats.successRate).toBe(0);
      expect(stats.topFailures).toHaveLength(1);
      expect(stats.topFailures[0].reason).toBe('TypeScript error');
      expect(stats.topFailures[0].count).toBe(1);
    });

    it('should record multiple results for same agent', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'task-2', true, 2000, 3000, 0);
      recordTaskResult('MARS', 'task-3', false, 1500, 2500, 1, 'Gate failure');
      
      const stats = getAgentStats('MARS');
      expect(stats.totalTasks).toBe(3);
      expect(stats.successRate).toBeCloseTo(0.667, 2);
      expect(stats.avgTokens).toBe(1500);
      expect(stats.avgDuration).toBe(2500);
    });

    it('should track gate retries correctly', () => {
      recordTaskResult('PLUTO', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('PLUTO', 'task-2', true, 1000, 2000, 2);
      
      const stats = getAgentStats('PLUTO');
      expect(stats.gatePassRate).toBe(0.5); // 1 out of 2 passed on first try
    });

    it('should record results with optional buildId', () => {
      recordTaskResult('SUN', 'task-1', true, 1000, 2000, 0, undefined, 'build-123');
      
      const buildStats = getBuildStats('build-123');
      expect(buildStats.total).toBe(1);
      expect(buildStats.success).toBe(1);
    });
  });

  describe('getAgentStats', () => {
    it('should return empty stats for unknown agent', () => {
      const stats = getAgentStats('UNKNOWN');
      
      expect(stats.agent).toBe('UNKNOWN');
      expect(stats.totalTasks).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgTokens).toBe(0);
      expect(stats.avgDuration).toBe(0);
      expect(stats.gatePassRate).toBe(1);
      expect(stats.topFailures).toEqual([]);
    });

    it('should calculate top failures correctly', () => {
      recordTaskResult('EARTH', 'task-1', false, 1000, 2000, 0, 'Validation error');
      recordTaskResult('EARTH', 'task-2', false, 1000, 2000, 0, 'Validation error');
      recordTaskResult('EARTH', 'task-3', false, 1000, 2000, 0, 'Timeout');
      recordTaskResult('EARTH', 'task-4', false, 1000, 2000, 0, 'Timeout');
      recordTaskResult('EARTH', 'task-5', false, 1000, 2000, 0, 'Timeout');
      recordTaskResult('EARTH', 'task-6', false, 1000, 2000, 0, 'Memory error');
      
      const stats = getAgentStats('EARTH');
      expect(stats.topFailures).toHaveLength(3);
      expect(stats.topFailures[0]).toEqual({ reason: 'Timeout', count: 3 });
      expect(stats.topFailures[1]).toEqual({ reason: 'Validation error', count: 2 });
      expect(stats.topFailures[2]).toEqual({ reason: 'Memory error', count: 1 });
    });

    it('should limit top failures to 5', () => {
      for (let i = 0; i < 10; i++) {
        recordTaskResult('JUPITER', `task-${i}`, false, 1000, 2000, 0, `Error-${i}`);
      }
      
      const stats = getAgentStats('JUPITER');
      expect(stats.topFailures).toHaveLength(5);
    });
  });

  describe('getAllAgentStats', () => {
    it('should return empty array when no data', () => {
      const stats = getAllAgentStats();
      expect(stats).toEqual([]);
    });

    it('should return stats for all agents sorted by success rate', () => {
      // MARS: 100% success
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0);
      
      // VENUS: 50% success
      recordTaskResult('VENUS', 'task-3', true, 1000, 2000, 0);
      recordTaskResult('VENUS', 'task-4', false, 1000, 2000, 0);
      
      // PLUTO: 0% success
      recordTaskResult('PLUTO', 'task-5', false, 1000, 2000, 0);
      
      const stats = getAllAgentStats();
      
      expect(stats).toHaveLength(3);
      expect(stats[0].agent).toBe('MARS');
      expect(stats[0].successRate).toBe(1);
      expect(stats[1].agent).toBe('VENUS');
      expect(stats[1].successRate).toBe(0.5);
      expect(stats[2].agent).toBe('PLUTO');
      expect(stats[2].successRate).toBe(0);
    });

    it('should handle ties in success rate', () => {
      recordTaskResult('AGENT-A', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('AGENT-B', 'task-2', true, 1000, 2000, 0);
      
      const stats = getAllAgentStats();
      expect(stats).toHaveLength(2);
      expect(stats[0].successRate).toBe(1);
      expect(stats[1].successRate).toBe(1);
    });
  });

  describe('getLeaderboard', () => {
    it('should return empty state message when no data', () => {
      const leaderboard = getLeaderboard();
      expect(leaderboard).toContain('No data recorded yet');
    });

    it('should format leaderboard correctly', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2500, 0);
      recordTaskResult('MARS', 'task-2', true, 1200, 2800, 0);
      recordTaskResult('VENUS', 'task-3', true, 800, 1500, 0);
      recordTaskResult('VENUS', 'task-4', false, 900, 1600, 1, 'Error');
      
      const leaderboard = getLeaderboard();
      
      expect(leaderboard).toContain('Agent Performance Leaderboard');
      expect(leaderboard).toContain('MARS');
      expect(leaderboard).toContain('VENUS');
      expect(leaderboard).toContain('100.0%'); // MARS success rate
      expect(leaderboard).toContain('50.0%');  // VENUS success rate
      expect(leaderboard).toContain('1,100');  // MARS avg tokens
      expect(leaderboard).toContain('850');    // VENUS avg tokens
    });

    it('should include rank numbers', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0);
      
      const leaderboard = getLeaderboard();
      expect(leaderboard).toContain(' 1  ');
      expect(leaderboard).toContain(' 2  ');
    });
  });

  describe('getRecommendation', () => {
    it('should recommend based on task type patterns', () => {
      // Add some history
      recordTaskResult('MARS', 'backend-task-1', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'backend-task-2', true, 1000, 2000, 0);
      
      const rec = getRecommendation('Create a backend API endpoint for user authentication');
      
      expect(rec).toContain('MARS');
      expect(rec).toContain('Success Rate');
    });

    it('should recommend UI tasks to VENUS', () => {
      recordTaskResult('VENUS', 'ui-task-1', true, 1000, 2000, 0);
      
      const rec = getRecommendation('Build a React component with styled buttons');
      
      expect(rec).toContain('VENUS');
    });

    it('should recommend schema tasks to EARTH', () => {
      recordTaskResult('EARTH', 'schema-task-1', true, 1000, 2000, 0);
      
      const rec = getRecommendation('Design the database schema for users table');
      
      expect(rec).toContain('EARTH');
    });

    it('should recommend test tasks to MERCURY', () => {
      recordTaskResult('MERCURY', 'test-task-1', true, 1000, 2000, 0);
      
      const rec = getRecommendation('Write unit tests for the authentication module');
      
      expect(rec).toContain('MERCURY');
    });

    it('should recommend based on overall success when no pattern match', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0);
      recordTaskResult('VENUS', 'task-3', true, 1000, 2000, 0);
      recordTaskResult('VENUS', 'task-4', false, 1000, 2000, 0);
      
      // Use a description with characters that won't match any agent patterns
      const rec = getRecommendation('qqqqqqqqq xxxxxxxx pppppppp');
      
      // When no pattern matches, should recommend based on overall success
      expect(rec).toContain('Recommendation');
      expect(rec).toContain('overall performer');
    });

    it('should indicate high confidence for strong pattern match', () => {
      recordTaskResult('PLUTO', 'convex-task-1', true, 1000, 2000, 0);
      
      // Task has 'convex' + 'mutation' which matches PLUTO patterns
      const rec = getRecommendation('Create a Convex mutation for updating user profiles');
      
      expect(rec).toContain('PLUTO');
      expect(rec).toContain('Confidence');
    });

    it('should handle empty database gracefully', () => {
      // Use a description with characters that won't match any agent patterns
      const rec = getRecommendation('qqqqqqqqq xxxxxxxx vvvvvvvv');
      
      // When no data exists and no pattern matches
      expect(rec).toContain('No analytics data');
    });

    it('should include success rate and task count in recommendation', () => {
      recordTaskResult('VENUS', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0);
      
      const rec = getRecommendation('Create a React component');
      
      expect(rec).toContain('100.0%');
      expect(rec).toContain('2 tasks');
    });
  });

  describe('getTrends', () => {
    it('should return trends for specified number of days', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      
      const trends = getTrends('MARS', 7);
      
      expect(trends).toHaveLength(7);
      expect(trends[0]).toHaveProperty('date');
      expect(trends[0]).toHaveProperty('successRate');
    });

    it('should have zero success rate for days with no data', () => {
      const trends = getTrends('UNKNOWN', 7);
      
      expect(trends).toHaveLength(7);
      for (const day of trends) {
        expect(day.successRate).toBe(0);
      }
    });

    it('should calculate daily success rates correctly', () => {
      // Record tasks for today
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'task-2', false, 1000, 2000, 0);
      
      const trends = getTrends('MARS', 1);
      
      expect(trends).toHaveLength(1);
      expect(trends[0].successRate).toBe(0.5);
    });

    it('should return dates in ISO format', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      
      const trends = getTrends('MARS', 1);
      
      expect(trends[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('resetAnalytics', () => {
    it('should clear all data', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0);
      
      expect(getAllAgentStats()).toHaveLength(2);
      
      resetAnalytics();
      
      expect(getAllAgentStats()).toHaveLength(0);
      expect(getAgentStats('MARS').totalTasks).toBe(0);
      expect(getAgentStats('VENUS').totalTasks).toBe(0);
    });

    it('should allow recording after reset', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      resetAnalytics();
      recordTaskResult('MARS', 'task-2', true, 1500, 2500, 0);
      
      const stats = getAgentStats('MARS');
      expect(stats.totalTasks).toBe(1);
      expect(stats.avgTokens).toBe(1500);
    });
  });

  describe('getBuildStats', () => {
    it('should return empty stats for unknown build', () => {
      const stats = getBuildStats('unknown-build');
      
      expect(stats.total).toBe(0);
      expect(stats.success).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should aggregate stats by buildId', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0, undefined, 'build-1');
      recordTaskResult('VENUS', 'task-2', true, 1000, 2000, 0, undefined, 'build-1');
      recordTaskResult('PLUTO', 'task-3', false, 1000, 2000, 0, 'Error', 'build-1');
      recordTaskResult('MARS', 'task-4', true, 1000, 2000, 0, undefined, 'build-2');
      
      const build1Stats = getBuildStats('build-1');
      expect(build1Stats.total).toBe(3);
      expect(build1Stats.success).toBe(2);
      expect(build1Stats.failed).toBe(1);
      
      const build2Stats = getBuildStats('build-2');
      expect(build2Stats.total).toBe(1);
      expect(build2Stats.success).toBe(1);
    });
  });

  describe('getTopPerformers', () => {
    it('should filter agents by minimum task threshold', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'task-2', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'task-3', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'task-4', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'task-5', true, 1000, 2000, 0);
      recordTaskResult('VENUS', 'task-6', true, 1000, 2000, 0);
      recordTaskResult('VENUS', 'task-7', true, 1000, 2000, 0);
      
      const topPerformers = getTopPerformers(5);
      
      expect(topPerformers).toHaveLength(1);
      expect(topPerformers[0].agent).toBe('MARS');
    });

    it('should return multiple agents above threshold', () => {
      for (let i = 0; i < 5; i++) {
        recordTaskResult('MARS', `task-${i}`, true, 1000, 2000, 0);
        recordTaskResult('VENUS', `task-${i + 10}`, true, 1000, 2000, 0);
      }
      
      const topPerformers = getTopPerformers(5);
      
      expect(topPerformers).toHaveLength(2);
    });

    it('should return empty array when no agents meet threshold', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      
      const topPerformers = getTopPerformers(5);
      
      expect(topPerformers).toHaveLength(0);
    });
  });

  describe('formatAgentStats', () => {
    it('should format agent stats nicely', () => {
      recordTaskResult('MARS', 'task-1', true, 1000, 2000, 0);
      recordTaskResult('MARS', 'task-2', true, 2000, 3000, 0);
      
      const stats = getAgentStats('MARS');
      const formatted = formatAgentStats(stats);
      
      expect(formatted).toContain('MARS');
      expect(formatted).toContain('Total Tasks:     2');
      expect(formatted).toContain('Success Rate:    100.0%');
      expect(formatted).toContain('Avg Tokens:      1,500');
      expect(formatted).toContain('Avg Duration:    2,500ms');
    });

    it('should include top failures in formatted output', () => {
      recordTaskResult('EARTH', 'task-1', false, 1000, 2000, 0, 'Validation error');
      recordTaskResult('EARTH', 'task-2', false, 1000, 2000, 0, 'Validation error');
      
      const stats = getAgentStats('EARTH');
      const formatted = formatAgentStats(stats);
      
      expect(formatted).toContain('Top Failure Reasons:');
      expect(formatted).toContain('Validation error (2)');
    });
  });

  describe('edge cases', () => {
    it('should handle very long task IDs', () => {
      const longId = 'a'.repeat(500);
      recordTaskResult('MARS', longId, true, 1000, 2000, 0);
      
      const stats = getAgentStats('MARS');
      expect(stats.totalTasks).toBe(1);
    });

    it('should handle special characters in failure reasons', () => {
      recordTaskResult('MARS', 'task-1', false, 1000, 2000, 0, 'Error: "quoted" <html> & more');
      
      const stats = getAgentStats('MARS');
      expect(stats.topFailures[0].reason).toBe('Error: "quoted" <html> & more');
    });

    it('should handle zero tokens and duration', () => {
      recordTaskResult('MARS', 'task-1', true, 0, 0, 0);
      
      const stats = getAgentStats('MARS');
      expect(stats.avgTokens).toBe(0);
      expect(stats.avgDuration).toBe(0);
    });

    it('should handle very large token counts', () => {
      recordTaskResult('MARS', 'task-1', true, 1000000, 999999999, 0);
      
      const stats = getAgentStats('MARS');
      expect(stats.avgTokens).toBe(1000000);
      expect(stats.avgDuration).toBe(999999999);
    });

    it('should handle many agents', () => {
      const agents = ['SUN', 'EARTH', 'PLUTO', 'MARS', 'VENUS', 'MERCURY', 'SATURN', 'JUPITER', 'TITAN', 'EUROPA'];
      
      for (const agent of agents) {
        recordTaskResult(agent, `task-${agent}`, true, 1000, 2000, 0);
      }
      
      const stats = getAllAgentStats();
      expect(stats).toHaveLength(10);
    });

    it('should handle high gate retry counts', () => {
      // Use a unique agent to avoid state from previous tests
      recordTaskResult('HIGHRETRY', 'task-1', true, 1000, 2000, 999);
      
      const stats = getAgentStats('HIGHRETRY');
      
      // With 999 retries (not 0), gate pass rate should be 0
      // The calculation is: tasks with 0 retries / total tasks = 0/1 = 0
      expect(stats.gatePassRate).toBe(0);
    });

    it('should track multiple builds independently', () => {
      for (let i = 0; i < 5; i++) {
        recordTaskResult('MARS', `task-${i}`, true, 1000, 2000, 0, undefined, `build-${i}`);
      }
      
      for (let i = 0; i < 5; i++) {
        const stats = getBuildStats(`build-${i}`);
        expect(stats.total).toBe(1);
      }
    });
  });
});
