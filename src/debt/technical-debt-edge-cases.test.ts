// Technical Debt Edge Cases — R17-07
// KIMI-W-04: 8 edge case tests for debt tracking system

import { describe, it, expect, vi } from 'vitest';
import {
  DebtTracker,
  createDebtTracker,
} from './technical-debt.js';

describe('Technical Debt Edge Cases', () => {
  describe('DebtTracker Edge Cases', () => {
    it('should handle debt with empty title', () => {
      const tracker = new DebtTracker();
      const debt = tracker.addDebt({
        title: '',
        description: 'test',
        type: 'code',
        priority: 'medium',
        status: 'identified',
        estimatedEffort: 1,
        interestPerPeriod: 1,
        tags: [],
        relatedIssues: [],
      });
      expect(debt).toBeDefined();
    });

    it('should handle debt with very long title', () => {
      const tracker = new DebtTracker();
      const longTitle = 'a'.repeat(1000);
      const debt = tracker.addDebt({
        title: longTitle,
        description: 'test',
        type: 'code',
        priority: 'medium',
        status: 'identified',
        estimatedEffort: 1,
        interestPerPeriod: 1,
        tags: [],
        relatedIssues: [],
      });
      expect(debt.title).toBe(longTitle);
    });

    it('should handle many debt items', () => {
      const tracker = new DebtTracker();

      // Add 1000 debt items
      for (let i = 0; i < 1000; i++) {
        tracker.addDebt({
          title: `Debt ${i}`,
          description: 'test',
          type: i % 2 === 0 ? 'code' : 'architecture',
          priority: ['low', 'medium', 'high', 'critical'][i % 4] as 'low' | 'medium' | 'high' | 'critical',
          status: 'identified',
          estimatedEffort: 1,
          interestPerPeriod: 1,
          tags: [],
          relatedIssues: [],
        });
      }

      const all = tracker.getAllDebts();
      expect(all).toHaveLength(1000);
    });

    it('should handle missing debt gracefully', () => {
      const tracker = new DebtTracker();
      const result = tracker.getDebt('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should handle empty debt list for metrics', () => {
      const tracker = new DebtTracker();
      const metrics = tracker.calculateMetrics();
      expect(metrics).toBeDefined();
    });

    it('should handle rapid debt status changes', () => {
      const tracker = new DebtTracker();
      const debt = tracker.addDebt({
        title: 'Test',
        description: 'test',
        type: 'code',
        priority: 'medium',
        status: 'identified',
        estimatedEffort: 1,
        interestPerPeriod: 1,
        tags: [],
        relatedIssues: [],
      });

      tracker.updateDebt(debt.id, { priority: 'high' });
      tracker.updateDebt(debt.id, { priority: 'critical' });
      tracker.resolveDebt(debt.id);

      const resolved = tracker.getDebt(debt.id);
      expect(resolved?.status).toBe('resolved');
    });

    it('should handle overdue debts', () => {
      const tracker = new DebtTracker();

      // Add overdue debt
      tracker.addDebt({
        title: 'Overdue',
        description: 'test',
        type: 'code',
        priority: 'high',
        status: 'identified',
        estimatedEffort: 1,
        interestPerPeriod: 1,
        dueDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        tags: [],
        relatedIssues: [],
      });

      const overdue = tracker.getOverdueDebts();
      expect(overdue).toHaveLength(1);
    });

    it('should handle trend calculation with single data point', () => {
      const tracker = new DebtTracker();
      tracker.addDebt({
        title: 'Test',
        description: 'test',
        type: 'code',
        priority: 'medium',
        status: 'identified',
        estimatedEffort: 1,
        interestPerPeriod: 1,
        tags: [],
        relatedIssues: [],
      });

      const trends = tracker.getTrends(1);
      expect(trends).toBeDefined();
    });
  });

  describe('createDebtTracker Edge Cases', () => {
    it('should handle custom thresholds', () => {
      const tracker = createDebtTracker({
        thresholds: {
          low: 0,
          medium: 1,
          high: 2,
          critical: 3,
        },
      });
      expect(tracker).toBeDefined();
    });

    it('should handle custom interest rates', () => {
      const tracker = createDebtTracker({
        interestRates: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
      });
      expect(tracker).toBeDefined();
    });
  });
});
