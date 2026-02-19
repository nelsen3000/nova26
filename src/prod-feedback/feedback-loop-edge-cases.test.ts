// Feedback Loop Edge Cases — R17-09
// KIMI-W-04: 8 edge case tests for production feedback system

import { describe, it, expect, vi } from 'vitest';
import {
  FeedbackLoop,
  createFeedbackLoop,
} from './feedback-loop.js';

function makeFeedback(overrides: Record<string, unknown> = {}) {
  return {
    type: 'error' as const,
    priority: 'medium' as const,
    timestamp: new Date().toISOString(),
    service: 'api',
    environment: 'test',
    version: '1.0.0',
    metadata: {},
    ...overrides,
  };
}

describe('Feedback Loop Edge Cases', () => {
  describe('FeedbackLoop Edge Cases', () => {
    it('should handle feedback with empty service', () => {
      const loop = new FeedbackLoop();
      const feedback = loop.collect(makeFeedback({ service: '' }));
      expect(feedback).toBeDefined();
    });

    it('should handle feedback with very long service name', () => {
      const loop = new FeedbackLoop();
      const longService = 'a'.repeat(10000);
      const feedback = loop.collect(makeFeedback({ service: longService }));
      expect(feedback.service).toBe(longService);
    });

    it('should handle many feedback items', () => {
      const loop = new FeedbackLoop();

      // Add 1000 feedback items
      for (let i = 0; i < 1000; i++) {
        loop.collect(makeFeedback({
          type: i % 2 === 0 ? 'error' : 'performance',
          service: `service-${i % 10}`,
          priority: ['low', 'medium', 'high', 'critical'][i % 4] as 'low' | 'medium' | 'high' | 'critical',
        }));
      }

      const all = loop.getFeedbackByType('error');
      expect(all.length).toBeGreaterThan(0);
    });

    it('should handle missing feedback gracefully', () => {
      const loop = new FeedbackLoop();
      const result = loop.getFeedback('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should handle feedback correlation with same item', () => {
      const loop = new FeedbackLoop();
      const fb1 = loop.collect(makeFeedback());

      // Correlating with self should return true or false based on criteria
      const correlated = loop.correlate(fb1.id, fb1.id);
      expect(typeof correlated).toBe('boolean');
    });

    it('should handle critical feedback filtering', () => {
      const loop = new FeedbackLoop();

      loop.collect(makeFeedback({ priority: 'critical' }));
      loop.collect(makeFeedback({ priority: 'high' }));
      loop.collect(makeFeedback({ priority: 'medium' }));

      const critical = loop.getCriticalFeedback();
      expect(critical).toBeDefined();
      expect(critical.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle trend calculation with single point', () => {
      const loop = new FeedbackLoop();
      loop.collect(makeFeedback());

      const trend = loop.getTrend(3600000);
      expect(trend).toBeDefined();
    });

    it('should handle incident report with no feedback', () => {
      const loop = new FeedbackLoop();
      const report = loop.generateIncidentReport(3600000);
      expect(report).toBeDefined();
    });
  });

  describe('createFeedbackLoop Edge Cases', () => {
    it('should handle disabled types', () => {
      const loop = createFeedbackLoop({
        enabledTypes: [],
      });
      expect(loop).toBeDefined();
    });

    it('should handle extreme sampling rates', () => {
      const loop = createFeedbackLoop({
        samplingRate: 0,
      });
      expect(loop).toBeDefined();

      const loop2 = createFeedbackLoop({
        samplingRate: 1,
      });
      expect(loop2).toBeDefined();
    });

    it('should handle very short retention', () => {
      const loop = createFeedbackLoop({
        retentionDays: 0,
      });
      expect(loop).toBeDefined();
    });
  });
});
