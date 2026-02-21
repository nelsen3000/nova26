// Cost Optimizer Tests
// Comprehensive test suite for cost optimization and budget management

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CostOptimizer,
  CostProjector,
  getCostOptimizer,
  resetCostOptimizer,
} from './cost-optimizer.js';
import type { ModelConfig } from './model-registry.js';

describe('CostOptimizer', () => {
  let optimizer: CostOptimizer;

  const cheapModel: ModelConfig = {
    id: 'cheap',
    name: 'Cheap',
    provider: 'ollama',
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxTokens: 4096,
    contextWindow: 8192,
    capabilities: ['chat'],
    latencyP50: 200,
    latencyP99: 500,
    quality: 0.7,
  };

  const expensiveModel: ModelConfig = {
    id: 'expensive',
    name: 'Expensive',
    provider: 'anthropic',
    costPerInputToken: 0.000015,
    costPerOutputToken: 0.000075,
    maxTokens: 4096,
    contextWindow: 200000,
    capabilities: ['chat'],
    latencyP50: 1000,
    latencyP99: 3000,
    quality: 0.95,
  };

  beforeEach(() => {
    optimizer = new CostOptimizer();
  });

  describe('setBudget', () => {
    it('sets daily budget', () => {
      optimizer.setBudget({ daily: 10.0 });
      expect(optimizer.getRemainingBudget()).toBe(10.0);
    });

    it('sets hourly budget', () => {
      optimizer.setBudget({ daily: 100.0, hourly: 5.0 });
      expect(optimizer.canAfford(expensiveModel, 1000)).toBe(true);
    });

    it('sets per-agent budgets', () => {
      const perAgent = new Map([['SUN', 5.0]]);
      optimizer.setBudget({ daily: 100.0, perAgent });
      expect(optimizer.canAgentAfford('SUN', expensiveModel, 1000)).toBe(true);
    });
  });

  describe('canAfford', () => {
    it('returns true when within budget', () => {
      optimizer.setBudget({ daily: 10.0 });
      expect(optimizer.canAfford(cheapModel, 1000)).toBe(true);
    });

    it('returns false when exceeding daily budget', () => {
      optimizer.setBudget({ daily: 0.0001 });
      expect(optimizer.canAfford(expensiveModel, 1000000)).toBe(false);
    });

    it('returns false when exceeding hourly budget', () => {
      optimizer.setBudget({ daily: 100.0, hourly: 0.0001 });
      expect(optimizer.canAfford(expensiveModel, 1000000)).toBe(false);
    });
  });

  describe('recordSpend', () => {
    it('records spend correctly', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      expect(optimizer.getDailySpend()).toBeGreaterThan(0);
    });

    it('accumulates spend', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      expect(optimizer.getDailySpend()).toBeGreaterThan(0);
    });

    it('tracks agent spend', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      expect(optimizer.getAgentSpend('SUN')).toBeGreaterThan(0);
    });
  });

  describe('getSpendReport', () => {
    it('returns report for hour period', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      const report = optimizer.getSpendReport('hour');

      expect(report.totalSpend).toBeGreaterThan(0);
      expect(report.byModel.has('model-1')).toBe(true);
      expect(report.byAgent.has('SUN')).toBe(true);
    });

    it('returns report for day period', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      const report = optimizer.getSpendReport('day');

      expect(report.totalSpend).toBeGreaterThan(0);
    });

    it('returns report for week period', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      const report = optimizer.getSpendReport('week');

      expect(report.totalSpend).toBeGreaterThan(0);
    });

    it('includes budget remaining', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      const report = optimizer.getSpendReport('day');

      expect(report.budgetRemaining).toBeLessThan(10.0);
      expect(report.budgetRemaining).toBeGreaterThan(0);
    });

    it('includes projection', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      const report = optimizer.getSpendReport('day');

      expect(report.projectedDaily).toBeGreaterThan(0);
    });
  });

  describe('budget thresholds', () => {
    it('shouldDowngrade returns false at 50%', () => {
      optimizer.setBudget({ daily: 10.0 });
      // Simulate 50% spend
      for (let i = 0; i < 10; i++) {
        optimizer.recordSpend('model-1', 'SUN', 1000, 500);
      }

      expect(optimizer.shouldDowngrade()).toBe(false);
    });

    it('shouldDowngrade returns true at 80%', () => {
      optimizer.setBudget({ daily: 0.001 });
      // Will exceed 80% quickly
      optimizer.recordSpend('model-1', 'SUN', 10000, 5000);

      expect(optimizer.shouldDowngrade()).toBe(true);
    });

    it('onlyCriticalAllowed returns false below 95%', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      expect(optimizer.onlyCriticalAllowed()).toBe(false);
    });

    it('onlyCriticalAllowed returns true at 95%', () => {
      optimizer.setBudget({ daily: 0.001 });
      optimizer.recordSpend('model-1', 'SUN', 10000, 5000);

      expect(optimizer.onlyCriticalAllowed()).toBe(true);
    });

    it('isBudgetExhausted returns false when under budget', () => {
      optimizer.setBudget({ daily: 10.0 });
      expect(optimizer.isBudgetExhausted()).toBe(false);
    });

    it('isBudgetExhausted returns true at 100%', () => {
      optimizer.setBudget({ daily: 0.0001 });
      optimizer.recordSpend('expensive', 'SUN', 10000, 5000);

      expect(optimizer.isBudgetExhausted()).toBe(true);
    });
  });

  describe('getBudgetStatus', () => {
    it('returns status with percentage', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      const status = optimizer.getBudgetStatus();

      expect(status.dailySpend).toBeGreaterThan(0);
      expect(status.dailyBudget).toBe(10.0);
      expect(status.percentage).toBeGreaterThan(0);
      expect(status.alerts).toBeDefined();
    });

    it('includes alert at 50%', () => {
      optimizer.setBudget({ daily: 0.001 });
      // Spend around 50%
      optimizer.recordSpend('model-1', 'SUN', 5000, 2500);

      const status = optimizer.getBudgetStatus();
      const hasAlert = status.alerts.some(a => a.threshold === 50);
      expect(hasAlert).toBe(true);
    });
  });

  describe('clear', () => {
    it('clears all records', () => {
      optimizer.setBudget({ daily: 10.0 });
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      expect(optimizer.getDailySpend()).toBeGreaterThan(0);

      optimizer.clear();

      expect(optimizer.getDailySpend()).toBe(0);
    });
  });
});

describe('CostProjector', () => {
  let optimizer: CostOptimizer;
  let projector: CostProjector;

  beforeEach(() => {
    optimizer = new CostOptimizer();
    optimizer.setBudget({ daily: 100.0 });
    projector = new CostProjector(optimizer);
  });

  describe('projectExhaustion', () => {
    it('returns not exhausted when under budget', () => {
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      const projection = projector.projectExhaustion();

      expect(projection.willExhaust).toBe(false);
    });

    it('returns exhausted when over budget', () => {
      optimizer.setBudget({ daily: 0.0001 });
      optimizer.recordSpend('expensive', 'SUN', 10000, 5000);

      const projection = projector.projectExhaustion();

      expect(projection.willExhaust).toBe(true);
      expect(projection.hoursRemaining).toBe(0);
    });

    it('returns recommendation', () => {
      const projection = projector.projectExhaustion();

      expect(projection.recommendation).toBeDefined();
    });
  });

  describe('projectNextHours', () => {
    it('projects next 4 hours', () => {
      optimizer.recordSpend('model-1', 'SUN', 1000, 500);

      const projection = projector.projectNextHours(4);

      expect(projection.projectedSpend).toBeGreaterThanOrEqual(0);
      expect(projection.projectedRemaining).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(projection.risk);
    });

    it('returns high risk when will exceed budget', () => {
      optimizer.setBudget({ daily: 0.001 });
      optimizer.recordSpend('expensive', 'SUN', 10000, 5000);

      const projection = projector.projectNextHours(4);

      expect(projection.risk).toBe('high');
    });
  });
});

describe('CostOptimizer singleton', () => {
  beforeEach(() => {
    resetCostOptimizer();
  });

  it('getCostOptimizer returns singleton', () => {
    const opt1 = getCostOptimizer();
    const opt2 = getCostOptimizer();

    expect(opt1).toBe(opt2);
  });

  it('resetCostOptimizer creates new instance', () => {
    const opt1 = getCostOptimizer();
    resetCostOptimizer();
    const opt2 = getCostOptimizer();

    expect(opt1).not.toBe(opt2);
  });
});
