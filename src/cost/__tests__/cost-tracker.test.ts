// KMS-27: Cost Tracker Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to ensure mock functions are available in hoisted mock factory
const mockFns = vi.hoisted(() => ({
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
  exec: vi.fn(),
}));

// Mock better-sqlite3 with factory
vi.mock('better-sqlite3', () => {
  return {
    default: class MockDatabase {
      prepare = () => ({
        run: mockFns.run,
        get: mockFns.get,
        all: mockFns.all,
      });
      exec = mockFns.exec;
    },
  };
});

vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
}));

// Import after mocking
import {
  calculateCost,
  recordCost,
  getTodaySpending,
  getSpendingReport,
  setBudget,
  checkBudgetAlerts,
  formatReport,
} from '../cost-tracker.js';

describe('Cost Tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock return values
    mockFns.get.mockReturnValue({ cost: 0, tokens: 0, requests: 0 });
    mockFns.all.mockReturnValue([]);
  });

  describe('calculateCost', () => {
    it('should calculate cost for gpt-4o correctly', () => {
      const cost = calculateCost('gpt-4o', 1000, 500);

      // input: 1000/1000 * 0.0025 = 0.0025
      // output: 500/1000 * 0.01 = 0.005
      // total: 0.0075
      expect(cost).toBeCloseTo(0.0075, 4);
    });

    it('should calculate cost for gpt-4o-mini correctly', () => {
      const cost = calculateCost('gpt-4o-mini', 2000, 1000);

      // input: 2000/1000 * 0.00015 = 0.0003
      // output: 1000/1000 * 0.0006 = 0.0006
      // total: 0.0009
      expect(cost).toBeCloseTo(0.0009, 4);
    });

    it('should return 0 for unknown models', () => {
      const cost = calculateCost('unknown-model', 1000, 1000);

      expect(cost).toBe(0);
    });

    it('should return 0 for free models like qwen2.5:7b', () => {
      const cost = calculateCost('qwen2.5:7b', 5000, 2000);

      expect(cost).toBe(0);
    });

    it('should calculate cost for claude-3-opus correctly', () => {
      const cost = calculateCost('claude-3-opus', 1000, 500);

      // input: 1000/1000 * 0.015 = 0.015
      // output: 500/1000 * 0.075 = 0.0375
      // total: 0.0525
      expect(cost).toBeCloseTo(0.0525, 4);
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost('gpt-4o', 0, 0);

      expect(cost).toBe(0);
    });
  });

  describe('recordCost', () => {
    it('should record cost entry to database', () => {
      recordCost('gpt-4o', 1000, 500);

      expect(mockFns.run).toHaveBeenCalled();
    });

    it('should include task and agent information when provided', () => {
      recordCost('gpt-4o', 1000, 500, {
        taskId: 'task-123',
        agentName: 'TestAgent',
      });

      const callArgs = mockFns.run.mock.calls[0];
      expect(callArgs).toContain('task-123');
      expect(callArgs).toContain('TestAgent');
    });

    it('should return cost of 0 for cached requests', () => {
      const result = recordCost('gpt-4o', 1000, 500, { cached: true });

      expect(result.cost).toBe(0);
    });

    it('should set cached flag to 1 for cached requests', () => {
      recordCost('gpt-4o', 1000, 500, { cached: true });

      const callArgs = mockFns.run.mock.calls[0];
      expect(callArgs).toContain(1);
    });

    it('should generate unique id for each entry', async () => {
      const result1 = recordCost('gpt-4o', 1000, 500);
      await new Promise(resolve => setTimeout(resolve, 2));
      const result2 = recordCost('gpt-4o', 1000, 500);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('getTodaySpending', () => {
    it('should return aggregated spending for today', () => {
      mockFns.get.mockReturnValue({
        cost: 1.5,
        tokens: 5000,
        requests: 10,
      });

      const spending = getTodaySpending();

      expect(spending.cost).toBe(1.5);
      expect(spending.tokens).toBe(5000);
      expect(spending.requests).toBe(10);
    });

    it('should handle null values from database', () => {
      mockFns.get.mockReturnValue({
        cost: 0,
        tokens: 0,
        requests: 0,
      });

      const spending = getTodaySpending();

      expect(spending.cost).toBe(0);
      expect(spending.tokens).toBe(0);
      expect(spending.requests).toBe(0);
    });
  });

  describe('getSpendingReport', () => {
    it('should return report for specified days', () => {
      mockFns.get.mockReturnValue({
        cost: 10,
        tokens: 50000,
        requests: 100,
      });
      mockFns.all.mockReturnValue([
        { model: 'gpt-4o', cost: 8, tokens: 40000, requests: 80 },
        { model: 'gpt-4o-mini', cost: 2, tokens: 10000, requests: 20 },
      ]);

      const report = getSpendingReport(7);

      expect(report.totalCost).toBe(10);
      expect(report.totalTokens).toBe(50000);
      expect(report.requestCount).toBe(100);
      expect(report.byModel['gpt-4o']).toBeDefined();
      expect(report.byModel['gpt-4o-mini']).toBeDefined();
    });

    it('should handle empty results', () => {
      mockFns.get.mockReturnValue({ cost: 0, tokens: 0, requests: 0 });
      mockFns.all.mockReturnValue([]);

      const report = getSpendingReport(7);

      expect(report.totalCost).toBe(0);
      expect(report.byModel).toEqual({});
    });
  });

  describe('setBudget', () => {
    it('should insert or replace budget in database', () => {
      setBudget('daily', 10);

      expect(mockFns.run).toHaveBeenCalledWith('budget-daily', 'daily', 10, 0.8);
    });

    it('should accept custom threshold', () => {
      setBudget('weekly', 50, 0.9);

      expect(mockFns.run).toHaveBeenCalledWith('budget-weekly', 'weekly', 50, 0.9);
    });

    it('should support all budget types', () => {
      setBudget('daily', 10);
      setBudget('weekly', 50);
      setBudget('monthly', 200);

      expect(mockFns.run).toHaveBeenCalledTimes(3);
    });
  });

  describe('checkBudgetAlerts', () => {
    it('should return empty array when no budgets are set', () => {
      mockFns.all.mockReturnValue([]);

      const alerts = checkBudgetAlerts();

      expect(alerts).toEqual([]);
    });

    it('should alert when daily budget exceeds threshold', () => {
      mockFns.all.mockReturnValue([
        { id: 'budget-daily', type: 'daily', limit_amount: 10, threshold: 0.8, notified: 0 },
      ]);
      mockFns.get.mockReturnValue({ cost: 9, tokens: 1000, requests: 10 }); // 90% of budget

      const alerts = checkBudgetAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toContain('daily budget');
      expect(alerts[0]).toContain('90%');
    });

    it('should not alert if already notified', () => {
      mockFns.all.mockReturnValue([
        { id: 'budget-daily', type: 'daily', limit_amount: 10, threshold: 0.8, notified: 1 },
      ]);
      mockFns.get.mockReturnValue({ cost: 9, tokens: 1000, requests: 10 });

      const alerts = checkBudgetAlerts();

      expect(alerts).toEqual([]);
    });

    it('should not alert when under threshold', () => {
      mockFns.all.mockReturnValue([
        { id: 'budget-daily', type: 'daily', limit_amount: 10, threshold: 0.8, notified: 0 },
      ]);
      mockFns.get.mockReturnValue({ cost: 5, tokens: 1000, requests: 10 }); // 50% of budget

      const alerts = checkBudgetAlerts();

      expect(alerts).toEqual([]);
    });
  });

  describe('formatReport', () => {
    it('should format report with totals', () => {
      const report = {
        totalCost: 1.5,
        totalTokens: 5000,
        requestCount: 20,
        byModel: {
          'gpt-4o': { cost: 1, tokens: 3000, requests: 10 },
          'gpt-4o-mini': { cost: 0.5, tokens: 2000, requests: 10 },
        },
      };

      const formatted = formatReport(report);

      expect(formatted).toContain('Spending Report');
      expect(formatted).toContain('$1.5000');
      expect(formatted).toContain('5,000 tokens');
      expect(formatted).toContain('20 requests');
      expect(formatted).toContain('gpt-4o');
      expect(formatted).toContain('gpt-4o-mini');
    });

    it('should format cost with 4 decimal places', () => {
      const report = {
        totalCost: 0.123456,
        totalTokens: 1000,
        requestCount: 5,
        byModel: {},
      };

      const formatted = formatReport(report);

      expect(formatted).toContain('$0.1235');
    });

    it('should handle empty byModel', () => {
      const report = {
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        byModel: {},
      };

      const formatted = formatReport(report);

      expect(formatted).toContain('Total: $0.0000');
    });
  });
});
