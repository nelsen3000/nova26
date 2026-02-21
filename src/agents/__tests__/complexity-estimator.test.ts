// Tests for Task Complexity Estimator
// KMS-15: Comprehensive test coverage for complexity estimation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ComplexityEstimator,
  getComplexityEstimator,
  resetComplexityEstimator,
  batchEstimate,
  getComplexityDistribution,
  compareComplexity,
  type TaskInput,
  type HistoricalTask,
  type ComplexityLevel,
} from '../complexity-estimator.js';

describe('ComplexityEstimator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetComplexityEstimator();
  });

  describe('Simple task detection', () => {
    it('should classify "fix typo" as simple', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Fix typo in readme' });

      expect(result.level).toBe('simple');
      expect(result.score).toBeLessThanOrEqual(25);
    });

    it('should classify "update readme" as simple', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Update readme with new instructions' });

      expect(result.level).toBe('simple');
    });

    it('should classify minor cosmetic changes as simple', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Minor style adjustment to button' });

      expect(result.level).toBe('simple');
    });

    it('should handle quick patch tasks', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Quick patch for lint error' });

      expect(result.level).toBe('simple');
    });
  });

  describe('Medium task detection', () => {
    it('should classify "add feature" as medium', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Add feature for user authentication' });

      expect(result.level).toBe('medium');
    });

    it('should classify refactor tasks as medium', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Refactor the login component' });

      expect(result.level).toBe('medium');
    });

    it('should classify optimization tasks as medium', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Optimize database queries' });

      expect(result.level).toBe('medium');
    });

    it('should handle integration tasks', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Setup integration with payment API' });

      expect(result.level).toBe('medium');
    });
  });

  describe('Complex task detection', () => {
    it('should classify "redesign" as complex', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Redesign the user dashboard' });

      expect(result.level).toBe('complex');
    });

    it('should classify architecture changes as complex', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({
        description: 'Rearchitect the core data layer for better scalability',
      });

      expect(result.level).toBe('complex');
    });

    it('should classify security tasks as complex', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Implement security audit fixes' });

      expect(result.level).toBe('complex');
    });

    it('should classify cross-module changes as complex', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({
        description: 'Cross-module refactoring for shared utilities',
      });

      expect(result.level).toBe('complex');
    });
  });

  describe('Epic task detection', () => {
    it('should classify platform migration as epic', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Platform migration to new infrastructure' });

      expect(result.level).toBe('epic');
    });

    it('should classify ecosystem changes as epic', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({
        description: 'Transform the entire ecosystem with new paradigm',
      });

      expect(result.level).toBe('epic');
    });

    it('should classify greenfield projects as epic', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Greenfield implementation of vision' });

      expect(result.level).toBe('epic');
    });
  });

  describe('Dependency consideration', () => {
    it('should increase score with more dependencies', () => {
      const estimator = new ComplexityEstimator();

      const low = estimator.estimate({
        description: 'Update component',
        dependencies: [],
      });

      const high = estimator.estimate({
        description: 'Update component',
        dependencies: ['auth', 'api', 'db', 'ui', 'utils', 'config'],
      });

      expect(high.score).toBeGreaterThan(low.score);
      expect(high.factors.dependencyScore).toBeGreaterThan(low.factors.dependencyScore);
    });

    it('should handle empty dependencies array', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({
        description: 'Fix typo',
        dependencies: [],
      });

      expect(result.factors.dependencyScore).toBe(0);
    });

    it('should cap dependency score at maximum', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({
        description: 'Complex task',
        dependencies: Array(20).fill('dep'),
      });

      expect(result.factors.dependencyScore).toBe(85);
    });
  });

  describe('Token estimation', () => {
    it('should use provided token estimate', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({
        description: 'Test',
        estimatedTokens: 10000,
      });

      expect(result.factors.tokenScore).toBeGreaterThan(50);
    });

    it('should estimate tokens from description length', () => {
      const estimator = new ComplexityEstimator();
      const short = estimator.estimate({ description: 'Fix' });
      const long = estimator.estimate({
        description: 'This is a very long description '.repeat(50),
      });

      expect(long.factors.tokenScore).toBeGreaterThanOrEqual(short.factors.tokenScore);
    });

    it('should have correct token thresholds', () => {
      const estimator = new ComplexityEstimator();
      const thresholds = estimator.getThresholds();

      expect(thresholds.simple.max).toBe(25);
      expect(thresholds.medium.max).toBe(50);
      expect(thresholds.complex.max).toBe(75);
    });
  });

  describe('Historical data integration', () => {
    it('should start with empty historical data', () => {
      const estimator = new ComplexityEstimator();
      expect(estimator.getHistoricalData()).toEqual([]);
    });

    it('should add and retrieve historical tasks', () => {
      const estimator = new ComplexityEstimator();
      const task: HistoricalTask = {
        id: '1',
        description: 'Test task',
        actualComplexity: 'medium',
        timeSpent: 120,
        dependencies: 3,
        tokensUsed: 1000,
        timestamp: new Date().toISOString(),
      };

      estimator.addHistoricalData(task);
      expect(estimator.getHistoricalData()).toHaveLength(1);
      expect(estimator.getHistoricalData()[0].id).toBe('1');
    });

    it('should clear historical data', () => {
      const estimator = new ComplexityEstimator();
      const task: HistoricalTask = {
        id: '1',
        description: 'Test',
        actualComplexity: 'simple',
        timeSpent: 30,
        dependencies: 0,
        tokensUsed: 100,
        timestamp: new Date().toISOString(),
      };

      estimator.addHistoricalData(task);
      estimator.clearHistoricalData();
      expect(estimator.getHistoricalData()).toEqual([]);
    });

    it('should adjust estimation based on historical data', () => {
      const historicalTask: HistoricalTask = {
        id: '1',
        description: 'Implement user authentication with OAuth',
        actualComplexity: 'complex',
        timeSpent: 480,
        dependencies: 5,
        tokensUsed: 5000,
        timestamp: new Date().toISOString(),
      };

      const estimator = new ComplexityEstimator({ initialHistory: [historicalTask] });
      const result = estimator.estimate({ description: 'Implement user auth with OAuth' });

      // Should be influenced by historical match
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Keyword customization', () => {
    it('should allow updating keywords', () => {
      const estimator = new ComplexityEstimator();
      estimator.updateKeywords('simple', ['trivial', 'minor']);

      const keywords = estimator.getKeywords();
      expect(keywords.simple).toContain('trivial');
      expect(keywords.simple).toContain('minor');
    });

    it('should return copy of keywords', () => {
      const estimator = new ComplexityEstimator();
      const keywords1 = estimator.getKeywords();
      const keywords2 = estimator.getKeywords();

      expect(keywords1).not.toBe(keywords2);
      expect(keywords1).toEqual(keywords2);
    });

    it('should use custom keywords in estimation', () => {
      const estimator = new ComplexityEstimator();
      estimator.updateKeywords('simple', ['trivial']);

      const result = estimator.estimate({ description: 'Trivial update to config' });
      expect(result.level).toBe('simple');
    });
  });

  describe('Confidence calculation', () => {
    it('should have base confidence above 0.5', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Test task' });

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should increase confidence with explicit tokens', () => {
      const estimator = new ComplexityEstimator();
      const withoutTokens = estimator.estimate({ description: 'Test task' });
      const withTokens = estimator.estimate({
        description: 'Test task',
        estimatedTokens: 1000,
      });

      expect(withTokens.confidence).toBeGreaterThanOrEqual(withoutTokens.confidence);
    });

    it('should cap confidence below 1', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({
        description: 'Fix typo',
        estimatedTokens: 100,
      });

      expect(result.confidence).toBeLessThan(1);
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations for simple tasks', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Fix typo' });

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some((r) => r.includes('single session'))).toBe(true);
    });

    it('should provide recommendations for epic tasks', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Platform migration' });

      expect(result.recommendations.some((r) => r.includes('planning'))).toBe(true);
    });

    it('should recommend splitting high score tasks', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Platform ecosystem transformation' });

      expect(result.recommendations.some((r) => r.includes('splitting'))).toBe(true);
    });
  });

  describe('Score thresholds', () => {
    it('should return correct complexity for score 15', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Fix typo minor tweak' });

      expect(result.score).toBeLessThanOrEqual(25);
      expect(result.level).toBe('simple');
    });

    it('should return correct complexity for score 40', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Implement feature refactor' });

      expect(result.score).toBeGreaterThan(25);
      expect(result.score).toBeLessThanOrEqual(50);
      expect(result.level).toBe('medium');
    });

    it('should return correct complexity for score 70', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: 'Redesign architecture security' });

      expect(result.score).toBeGreaterThan(50);
      expect(result.score).toBeLessThanOrEqual(75);
      expect(result.level).toBe('complex');
    });

    it('should return correct complexity for score 90', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({
        description: 'Platform ecosystem enterprise transformation',
      });

      expect(result.score).toBeGreaterThan(75);
      expect(result.level).toBe('epic');
    });
  });

  describe('Utility functions', () => {
    it('batchEstimate should process multiple tasks', () => {
      const tasks: TaskInput[] = [
        { description: 'Fix typo' },
        { description: 'Add feature' },
        { description: 'Redesign architecture' },
      ];

      const results = batchEstimate(tasks);
      expect(results).toHaveLength(3);
      expect(results[0].level).toBe('simple');
      expect(results[1].level).toBe('medium');
    });

    it('getComplexityDistribution should count levels correctly', () => {
      const estimator = new ComplexityEstimator();
      // Use specific simple keywords to ensure correct classification
      estimator.updateKeywords('simple', ['fix typo', 'update docs', 'docs', 'update']);
      
      const tasks: TaskInput[] = [
        { description: 'Fix typo' },
        { description: 'Update docs' },
        { description: 'Add feature' },
        { description: 'Redesign' },
      ];

      const results = tasks.map(t => estimator.estimate(t));
      const distribution = getComplexityDistribution(results);

      expect(distribution.simple).toBe(2);
      expect(distribution.medium).toBe(1);
      expect(distribution.complex + distribution.epic).toBe(1);
    });

    it('compareComplexity should detect matches', () => {
      const comparison = compareComplexity('simple', 'simple');
      expect(comparison.match).toBe(true);
      expect(comparison.difference).toBe(0);
    });

    it('compareComplexity should calculate difference', () => {
      const comparison = compareComplexity('simple', 'complex');
      expect(comparison.match).toBe(false);
      expect(comparison.difference).toBe(2);
    });
  });

  describe('Singleton pattern', () => {
    it('getComplexityEstimator should return same instance', () => {
      const e1 = getComplexityEstimator();
      const e2 = getComplexityEstimator();
      expect(e1).toBe(e2);
    });

    it('resetComplexityEstimator should create new instance', () => {
      const e1 = getComplexityEstimator();
      resetComplexityEstimator();
      const e2 = getComplexityEstimator();
      expect(e1).not.toBe(e2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty description', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({ description: '' });

      expect(result.level).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long description', () => {
      const estimator = new ComplexityEstimator();
      const longDescription = 'Implement '.repeat(100);
      const result = estimator.estimate({ description: longDescription });

      expect(result.level).toBeDefined();
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle description with special characters', () => {
      const estimator = new ComplexityEstimator();
      const result = estimator.estimate({
        description: 'Fix: [BUG-123] - Security vulnerability! (CRITICAL)',
      });

      expect(result.level).toBeDefined();
    });

    it('should handle case insensitivity', () => {
      const estimator = new ComplexityEstimator();

      const lower = estimator.estimate({ description: 'fix typo' });
      const upper = estimator.estimate({ description: 'FIX TYPO' });

      expect(lower.level).toBe(upper.level);
    });
  });
});
