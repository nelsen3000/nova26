// Observability Bridge Tests
// Comprehensive test suite for logging and dashboard data

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ObservabilityBridge,
  getObservabilityBridge,
  resetObservabilityBridge,
  RoutingDecisionLogSchema,
  ModelCallLogSchema,
  SpeculativeDecodingLogSchema,
} from './observability-bridge.js';

describe('ObservabilityBridge', () => {
  let bridge: ObservabilityBridge;

  beforeEach(() => {
    bridge = new ObservabilityBridge();
  });

  describe('logRoutingDecision', () => {
    it('logs routing decision', () => {
      bridge.logRoutingDecision('SUN', 'code-generation', {
        model: { id: 'model-1', name: 'Model 1', provider: 'anthropic', costPerInputToken: 0, costPerOutputToken: 0, maxTokens: 4096, contextWindow: 8192, capabilities: [], latencyP50: 100, latencyP99: 500, quality: 0.8 },
        reason: 'Best UCB score',
        confidence: 0.9,
        estimatedCost: 0.001,
        estimatedLatency: 500,
        alternatives: [],
        ucbScore: 1.5,
      });

      expect(bridge.getRoutingLogs()).toHaveLength(1);
    });

    it('log entry has required fields', () => {
      bridge.logRoutingDecision('SUN', 'code-generation', {
        model: { id: 'model-1', name: 'Model 1', provider: 'anthropic', costPerInputToken: 0, costPerOutputToken: 0, maxTokens: 4096, contextWindow: 8192, capabilities: [], latencyP50: 100, latencyP99: 500, quality: 0.8 },
        reason: 'Best UCB score',
        confidence: 0.9,
        estimatedCost: 0.001,
        estimatedLatency: 500,
        alternatives: [],
        ucbScore: 1.5,
      });

      const log = bridge.getRoutingLogs()[0];
      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('agentId');
      expect(log).toHaveProperty('taskType');
      expect(log).toHaveProperty('selectedModel');
      expect(log).toHaveProperty('ucbScore');
      expect(log).toHaveProperty('constraints');
      expect(log).toHaveProperty('alternatives');
      expect(log).toHaveProperty('reason');
    });
  });

  describe('logModelCall', () => {
    it('logs successful model call', () => {
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 500, true, 0.001);

      expect(bridge.getModelCallLogs()).toHaveLength(1);
    });

    it('logs failed model call', () => {
      bridge.logModelCall('model-1', 'SUN', 1000, 0, 1000, false, 0, 'API error');

      const logs = bridge.getModelCallLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(false);
      expect(logs[0].error).toBe('API error');
    });

    it('log entry validates schema', () => {
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 500, true, 0.001);

      const log = bridge.getModelCallLogs()[0];
      const validated = ModelCallLogSchema.safeParse(log);
      expect(validated.success).toBe(true);
    });
  });

  describe('logSpeculativeDecoding', () => {
    it('logs speculative decoding attempt', () => {
      bridge.logSpeculativeDecoding('draft-model', 'verify-model', {
        output: 'test',
        draftAcceptRate: 0.7,
        totalLatency: 800,
        costSaved: 0.0005,
        strategy: 'speculative',
        tokensGenerated: { draft: 50, verified: 30 },
      }, 200);

      expect(bridge.getSpeculativeLogs()).toHaveLength(1);
    });

    it('log entry validates schema', () => {
      bridge.logSpeculativeDecoding('draft-model', 'verify-model', {
        output: 'test',
        draftAcceptRate: 0.7,
        totalLatency: 800,
        costSaved: 0.0005,
        strategy: 'speculative',
        tokensGenerated: { draft: 50, verified: 30 },
      }, 200);

      const log = bridge.getSpeculativeLogs()[0];
      const validated = SpeculativeDecodingLogSchema.safeParse(log);
      expect(validated.success).toBe(true);
    });
  });

  describe('getModelUsageDistribution', () => {
    it('returns empty array when no logs', () => {
      const distribution = bridge.getModelUsageDistribution();
      expect(distribution).toHaveLength(0);
    });

    it('aggregates model usage', () => {
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 500, true, 0.001);
      bridge.logModelCall('model-1', 'MERCURY', 1000, 500, 500, true, 0.001);
      bridge.logModelCall('model-2', 'VENUS', 1000, 500, 500, true, 0.001);

      const distribution = bridge.getModelUsageDistribution();

      expect(distribution).toHaveLength(2);
      expect(distribution[0].model).toBe('model-1');
      expect(distribution[0].count).toBe(2);
      expect(distribution[0].percentage).toBe(66.67);
    });
  });

  describe('getCostOverTime', () => {
    it('returns empty array when no logs', () => {
      const data = bridge.getCostOverTime();
      expect(data).toHaveLength(0);
    });

    it('aggregates cost by time bucket', () => {
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 500, true, 0.001);
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 500, true, 0.002);

      const data = bridge.getCostOverTime(60);

      expect(data).toHaveLength(1);
      expect(data[0].cost).toBe(0.003);
      expect(data[0].count).toBe(2);
    });
  });

  describe('getLatencyPercentilesByModel', () => {
    it('returns empty array when no logs', () => {
      const percentiles = bridge.getLatencyPercentilesByModel();
      expect(percentiles).toHaveLength(0);
    });

    it('calculates percentiles per model', () => {
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 100, true, 0.001);
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 200, true, 0.001);
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 300, true, 0.001);

      const percentiles = bridge.getLatencyPercentilesByModel();

      expect(percentiles).toHaveLength(1);
      expect(percentiles[0].model).toBe('model-1');
      expect(percentiles[0].p50).toBe(200);
    });
  });

  describe('getUCBScoreEvolution', () => {
    it('returns UCB scores for specific model', () => {
      bridge.logRoutingDecision('SUN', 'code-generation', {
        model: { id: 'model-1', name: 'Model 1', provider: 'anthropic', costPerInputToken: 0, costPerOutputToken: 0, maxTokens: 4096, contextWindow: 8192, capabilities: [], latencyP50: 100, latencyP99: 500, quality: 0.8 },
        reason: 'Best',
        confidence: 0.9,
        estimatedCost: 0.001,
        estimatedLatency: 500,
        alternatives: [],
        ucbScore: 1.5,
      });

      const evolution = bridge.getUCBScoreEvolution('model-1');

      expect(evolution).toHaveLength(1);
      expect(evolution[0].ucbScore).toBe(1.5);
    });

    it('filters by model id', () => {
      bridge.logRoutingDecision('SUN', 'code-generation', {
        model: { id: 'model-1', name: 'Model 1', provider: 'anthropic', costPerInputToken: 0, costPerOutputToken: 0, maxTokens: 4096, contextWindow: 8192, capabilities: [], latencyP50: 100, latencyP99: 500, quality: 0.8 },
        reason: 'Best',
        confidence: 0.9,
        estimatedCost: 0.001,
        estimatedLatency: 500,
        alternatives: [],
        ucbScore: 1.5,
      });

      const evolution = bridge.getUCBScoreEvolution('model-2');

      expect(evolution).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('returns zero stats when empty', () => {
      const stats = bridge.getStats();

      expect(stats.totalCalls).toBe(0);
      expect(stats.successfulCalls).toBe(0);
      expect(stats.totalCost).toBe(0);
    });

    it('calculates stats correctly', () => {
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 100, true, 0.001);
      bridge.logModelCall('model-2', 'MERCURY', 1000, 500, 200, false, 0, 'error');

      const stats = bridge.getStats();

      expect(stats.totalCalls).toBe(2);
      expect(stats.successfulCalls).toBe(1);
      expect(stats.failedCalls).toBe(1);
      expect(stats.totalCost).toBe(0.001);
      expect(stats.avgLatency).toBe(150);
      expect(stats.uniqueModels).toBe(2);
      expect(stats.uniqueAgents).toBe(2);
    });
  });

  describe('clear', () => {
    it('clears all logs', () => {
      bridge.logModelCall('model-1', 'SUN', 1000, 500, 100, true, 0.001);
      bridge.logRoutingDecision('SUN', 'code-generation', {
        model: { id: 'model-1', name: 'Model 1', provider: 'anthropic', costPerInputToken: 0, costPerOutputToken: 0, maxTokens: 4096, contextWindow: 8192, capabilities: [], latencyP50: 100, latencyP99: 500, quality: 0.8 },
        reason: 'Best',
        confidence: 0.9,
        estimatedCost: 0.001,
        estimatedLatency: 500,
        alternatives: [],
        ucbScore: 1.5,
      });

      bridge.clear();

      expect(bridge.getModelCallLogs()).toHaveLength(0);
      expect(bridge.getRoutingLogs()).toHaveLength(0);
    });
  });

  describe('max logs limit', () => {
    it('limits logs to maxLogs', () => {
      const smallBridge = new ObservabilityBridge(5);

      for (let i = 0; i < 10; i++) {
        smallBridge.logModelCall('model-1', 'SUN', 1000, 500, 100, true, 0.001);
      }

      expect(smallBridge.getModelCallLogs()).toHaveLength(5);
    });
  });
});

describe('ObservabilityBridge singleton', () => {
  beforeEach(() => {
    resetObservabilityBridge();
  });

  it('getObservabilityBridge returns singleton', () => {
    const b1 = getObservabilityBridge();
    const b2 = getObservabilityBridge();

    expect(b1).toBe(b2);
  });

  it('resetObservabilityBridge creates new instance', () => {
    const b1 = getObservabilityBridge();
    resetObservabilityBridge();
    const b2 = getObservabilityBridge();

    expect(b1).not.toBe(b2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Schema Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Log Schema Validation', () => {
  describe('RoutingDecisionLogSchema', () => {
    it('validates correct log', () => {
      const log = {
        timestamp: new Date().toISOString(),
        agentId: 'SUN',
        taskType: 'code-generation',
        selectedModel: 'model-1',
        ucbScore: 1.5,
        constraints: { maxCost: 0.001 },
        alternatives: ['model-2'],
        reason: 'Best UCB score',
      };

      const result = RoutingDecisionLogSchema.safeParse(log);
      expect(result.success).toBe(true);
    });

    it('rejects invalid log', () => {
      const log = {
        timestamp: 'invalid',
        agentId: 'SUN',
      };

      const result = RoutingDecisionLogSchema.safeParse(log);
      expect(result.success).toBe(false);
    });
  });

  describe('ModelCallLogSchema', () => {
    it('validates correct log', () => {
      const log = {
        timestamp: new Date().toISOString(),
        model: 'model-1',
        agentId: 'SUN',
        inputTokens: 1000,
        outputTokens: 500,
        latency: 500,
        success: true,
        cost: 0.001,
      };

      const result = ModelCallLogSchema.safeParse(log);
      expect(result.success).toBe(true);
    });

    it('rejects invalid log', () => {
      const log = {
        timestamp: new Date().toISOString(),
        success: 'not-a-boolean',
      };

      const result = ModelCallLogSchema.safeParse(log);
      expect(result.success).toBe(false);
    });
  });

  describe('SpeculativeDecodingLogSchema', () => {
    it('validates correct log', () => {
      const log = {
        timestamp: new Date().toISOString(),
        draftModel: 'draft',
        verifyModel: 'verify',
        acceptanceRate: 0.7,
        latencySaved: 200,
        costSaved: 0.0005,
        strategy: 'speculative' as const,
      };

      const result = SpeculativeDecodingLogSchema.safeParse(log);
      expect(result.success).toBe(true);
    });

    it('rejects invalid strategy', () => {
      const log = {
        timestamp: new Date().toISOString(),
        draftModel: 'draft',
        verifyModel: 'verify',
        acceptanceRate: 0.7,
        latencySaved: 200,
        costSaved: 0.0005,
        strategy: 'invalid',
      };

      const result = SpeculativeDecodingLogSchema.safeParse(log);
      expect(result.success).toBe(false);
    });
  });
});
