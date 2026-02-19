// Tests for Technical Debt Scoring
// KIMI-R17-05

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DebtTracker,
  createDebtTracker,
  calculateInterest,
  prioritizeDebts,
  TechnicalDebtSchema,
} from './technical-debt.js';

describe('DebtTracker', () => {
  let tracker: DebtTracker;

  beforeEach(() => {
    tracker = new DebtTracker();
  });

  describe('addDebt', () => {
    it('adds technical debt', () => {
      const debt = tracker.addDebt({
        title: 'Legacy code',
        description: 'Old code needs refactoring',
        type: 'code',
        priority: 'high',
        status: 'identified',
        estimatedEffort: 8,
        interestPerPeriod: 2,
        tags: ['refactoring'],
        relatedIssues: [],
      });

      expect(debt.title).toBe('Legacy code');
      expect(debt.id).toBeDefined();
      expect(debt.createdAt).toBeDefined();
    });
  });

  describe('updateDebt', () => {
    it('updates debt fields', () => {
      const debt = tracker.addDebt({
        title: 'Test',
        description: 'Test',
        type: 'code',
        priority: 'low',
        status: 'identified',
        estimatedEffort: 1,
        interestPerPeriod: 0.5,
        tags: [],
        relatedIssues: [],
      });

      const updated = tracker.updateDebt(debt.id, { priority: 'high', status: 'in-progress' });

      expect(updated.priority).toBe('high');
      expect(updated.status).toBe('in-progress');
    });
  });

  describe('resolveDebt', () => {
    it('marks debt as resolved', () => {
      const debt = tracker.addDebt({
        title: 'Test',
        description: 'Test',
        type: 'code',
        priority: 'low',
        status: 'in-progress',
        estimatedEffort: 1,
        interestPerPeriod: 0.5,
        tags: [],
        relatedIssues: [],
      });

      const resolved = tracker.resolveDebt(debt.id);

      expect(resolved.status).toBe('resolved');
    });
  });

  describe('getDebtsByType', () => {
    it('filters by type', () => {
      tracker.addDebt({ title: 'Code debt', type: 'code', priority: 'low', status: 'identified', estimatedEffort: 1, interestPerPeriod: 0.5, description: '', tags: [], relatedIssues: [] });
      tracker.addDebt({ title: 'Arch debt', type: 'architecture', priority: 'low', status: 'identified', estimatedEffort: 1, interestPerPeriod: 0.5, description: '', tags: [], relatedIssues: [] });

      const codeDebts = tracker.getDebtsByType('code');

      expect(codeDebts).toHaveLength(1);
      expect(codeDebts[0].title).toBe('Code debt');
    });
  });

  describe('getDebtsByPriority', () => {
    it('filters by priority', () => {
      tracker.addDebt({ title: 'Critical', type: 'code', priority: 'critical', status: 'identified', estimatedEffort: 1, interestPerPeriod: 0.5, description: '', tags: [], relatedIssues: [] });
      tracker.addDebt({ title: 'Low', type: 'code', priority: 'low', status: 'identified', estimatedEffort: 1, interestPerPeriod: 0.5, description: '', tags: [], relatedIssues: [] });

      const critical = tracker.getDebtsByPriority('critical');

      expect(critical).toHaveLength(1);
      expect(critical[0].title).toBe('Critical');
    });
  });

  describe('getOverdueDebts', () => {
    it('finds overdue items', () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 1);

      tracker.addDebt({
        title: 'Overdue',
        type: 'code',
        priority: 'high',
        status: 'identified',
        estimatedEffort: 1,
        interestPerPeriod: 0.5,
        dueDate: pastDate.toISOString(),
        description: '',
        tags: [],
        relatedIssues: [],
      });

      const overdue = tracker.getOverdueDebts();

      expect(overdue).toHaveLength(1);
    });
  });

  describe('calculateMetrics', () => {
    it('calculates total debt', () => {
      tracker.addDebt({ title: 'D1', type: 'code', priority: 'high', status: 'identified', estimatedEffort: 1, interestPerPeriod: 0.5, description: '', tags: [], relatedIssues: [] });
      tracker.addDebt({ title: 'D2', type: 'code', priority: 'medium', status: 'identified', estimatedEffort: 1, interestPerPeriod: 0.5, description: '', tags: [], relatedIssues: [] });
      tracker.addDebt({ title: 'D3', type: 'code', priority: 'low', status: 'resolved', estimatedEffort: 1, interestPerPeriod: 0.5, description: '', tags: [], relatedIssues: [] });

      const metrics = tracker.calculateMetrics();

      expect(metrics.totalDebt).toBe(2); // Excludes resolved
    });

    it('calculates interest', () => {
      tracker.addDebt({ title: 'D1', type: 'code', priority: 'high', status: 'identified', estimatedEffort: 1, interestPerPeriod: 2, description: '', tags: [], relatedIssues: [] });
      tracker.addDebt({ title: 'D2', type: 'code', priority: 'medium', status: 'identified', estimatedEffort: 1, interestPerPeriod: 3, description: '', tags: [], relatedIssues: [] });

      const metrics = tracker.calculateMetrics();

      expect(metrics.totalInterest).toBe(5);
    });
  });

  describe('calculateScore', () => {
    it('returns score', () => {
      tracker.addDebt({ title: 'D1', type: 'code', priority: 'low', status: 'identified', estimatedEffort: 1, interestPerPeriod: 0.5, description: '', tags: [], relatedIssues: [] });

      const score = tracker.calculateScore();

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('recommendRepayment', () => {
    it('sorts by priority then interest', () => {
      const d1 = tracker.addDebt({ title: 'High', type: 'code', priority: 'high', status: 'identified', estimatedEffort: 1, interestPerPeriod: 1, description: '', tags: [], relatedIssues: [] });
      const d2 = tracker.addDebt({ title: 'Critical', type: 'code', priority: 'critical', status: 'identified', estimatedEffort: 1, interestPerPeriod: 1, description: '', tags: [], relatedIssues: [] });

      const recommended = tracker.recommendRepayment();

      expect(recommended[0].id).toBe(d2.id);
    });
  });
});

describe('Helper Functions', () => {
  it('createDebtTracker creates instance', () => {
    const instance = createDebtTracker();
    expect(instance).toBeInstanceOf(DebtTracker);
  });

  it('calculateInterest calculates compound interest', () => {
    const interest = calculateInterest(100, 10, 2);
    expect(interest).toBeGreaterThan(0);
  });

  it('prioritizeDebts sorts by priority', () => {
    const debts = [
      { priority: 'low' } as any,
      { priority: 'critical' } as any,
      { priority: 'high' } as any,
    ];

    const sorted = prioritizeDebts(debts);

    expect(sorted[0].priority).toBe('critical');
    expect(sorted[1].priority).toBe('high');
    expect(sorted[2].priority).toBe('low');
  });
});

describe('Zod Schemas', () => {
  it('validates technical debt', () => {
    const debt = {
      id: 'd1',
      title: 'Test',
      description: 'Test debt',
      type: 'code',
      priority: 'high',
      status: 'identified',
      estimatedEffort: 4,
      interestPerPeriod: 1,
      createdAt: new Date().toISOString(),
      tags: [],
      relatedIssues: [],
    };
    const result = TechnicalDebtSchema.safeParse(debt);
    expect(result.success).toBe(true);
  });
});
