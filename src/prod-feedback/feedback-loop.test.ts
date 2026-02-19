// Tests for Production Feedback Loop
// KIMI-R17-07

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeedbackLoop,
  createFeedbackLoop,
  prioritizeFeedback,
  groupByService,
  ProductionFeedbackSchema,
} from './feedback-loop.js';

describe('FeedbackLoop', () => {
  let loop: FeedbackLoop;

  beforeEach(() => {
    loop = new FeedbackLoop({ samplingRate: 1.0 }); // No sampling for tests
  });

  describe('collect', () => {
    it('collects feedback', () => {
      const feedback = loop.collect({
        type: 'error',
        priority: 'high',
        timestamp: new Date().toISOString(),
        service: 'api',
        environment: 'production',
        version: '1.0.0',
        metadata: {},
      });

      expect(feedback.id).toBeDefined();
      expect(feedback.type).toBe('error');
    });

    it('applies sampling', () => {
      const sampledLoop = new FeedbackLoop({ samplingRate: 0 }); // Drop all
      const feedback = sampledLoop.collect({
        type: 'error',
        priority: 'high',
        timestamp: new Date().toISOString(),
        service: 'api',
        environment: 'production',
        version: '1.0.0',
        metadata: {},
      });

      expect(feedback.id).toBe('dropped');
    });
  });

  describe('analyze', () => {
    it('analyzes feedback', () => {
      const feedback = loop.collect({
        type: 'error',
        priority: 'critical',
        timestamp: new Date().toISOString(),
        service: 'api',
        environment: 'production',
        version: '1.0.0',
        metadata: {},
      });

      const analysis = loop.analyze(feedback.id);

      expect(analysis.feedbackId).toBe(feedback.id);
      expect(analysis.recommendedActions.length).toBeGreaterThan(0);
    });
  });

  describe('getFeedbackByType', () => {
    it('filters by type', () => {
      loop.collect({ type: 'error', priority: 'low', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });
      loop.collect({ type: 'performance', priority: 'low', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });

      const errors = loop.getFeedbackByType('error');

      expect(errors).toHaveLength(1);
    });
  });

  describe('getFeedbackByService', () => {
    it('filters by service', () => {
      loop.collect({ type: 'error', priority: 'low', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });
      loop.collect({ type: 'error', priority: 'low', timestamp: new Date().toISOString(), service: 'web', environment: 'prod', version: '1.0', metadata: {} });

      const api = loop.getFeedbackByService('api');

      expect(api).toHaveLength(1);
    });
  });

  describe('getCriticalFeedback', () => {
    it('returns only critical', () => {
      loop.collect({ type: 'error', priority: 'critical', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });
      loop.collect({ type: 'error', priority: 'low', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });

      const critical = loop.getCriticalFeedback();

      expect(critical).toHaveLength(1);
    });
  });

  describe('correlate', () => {
    it('correlates related feedback', () => {
      const f1 = loop.collect({ type: 'error', priority: 'high', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });
      const f2 = loop.collect({ type: 'error', priority: 'high', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });

      const correlated = loop.correlate(f1.id, f2.id);

      expect(correlated).toBe(true);
    });

    it('returns false for different services', () => {
      const f1 = loop.collect({ type: 'error', priority: 'high', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });
      const f2 = loop.collect({ type: 'error', priority: 'high', timestamp: new Date().toISOString(), service: 'web', environment: 'prod', version: '1.0', metadata: {} });

      const correlated = loop.correlate(f1.id, f2.id);

      expect(correlated).toBe(false);
    });
  });

  describe('generateIncidentReport', () => {
    it('generates report', () => {
      loop.collect({ type: 'error', priority: 'critical', timestamp: new Date().toISOString(), service: 'api', environment: 'prod', version: '1.0', metadata: {} });

      const report = loop.generateIncidentReport(3600000); // 1 hour

      expect(report.period.start).toBeDefined();
      expect(report.period.end).toBeDefined();
      expect(report.summary.error).toBeGreaterThan(0);
    });
  });
});

describe('Helper Functions', () => {
  it('createFeedbackLoop creates instance', () => {
    const instance = createFeedbackLoop();
    expect(instance).toBeInstanceOf(FeedbackLoop);
  });

  it('prioritizeFeedback sorts by priority', () => {
    const feedback = [
      { priority: 'low', type: 'error', timestamp: '', service: '', environment: '', version: '', metadata: {} } as any,
      { priority: 'critical', type: 'error', timestamp: '', service: '', environment: '', version: '', metadata: {} } as any,
      { priority: 'high', type: 'error', timestamp: '', service: '', environment: '', version: '', metadata: {} } as any,
    ];

    const sorted = prioritizeFeedback(feedback);

    expect(sorted[0].priority).toBe('critical');
    expect(sorted[1].priority).toBe('high');
  });

  it('groupByService groups correctly', () => {
    const feedback = [
      { service: 'api', type: 'error', priority: 'low', timestamp: '', environment: '', version: '', metadata: {} } as any,
      { service: 'api', type: 'error', priority: 'low', timestamp: '', environment: '', version: '', metadata: {} } as any,
      { service: 'web', type: 'error', priority: 'low', timestamp: '', environment: '', version: '', metadata: {} } as any,
    ];

    const grouped = groupByService(feedback);

    expect(grouped.get('api')).toHaveLength(2);
    expect(grouped.get('web')).toHaveLength(1);
  });
});

describe('Zod Schemas', () => {
  it('validates production feedback', () => {
    const feedback = {
      id: 'f1',
      type: 'error',
      priority: 'high',
      timestamp: new Date().toISOString(),
      service: 'api',
      environment: 'production',
      version: '1.0.0',
      metadata: {},
    };
    const result = ProductionFeedbackSchema.safeParse(feedback);
    expect(result.success).toBe(true);
  });
});
