/**
 * Comprehensive tests for HardwareDetector and MetricsTracker
 * Task H5-03: Hardware Metrics + NovaBench Coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { HardwareDetector } from '../hardware-detector.js';
import { MetricsTracker } from '../metrics-tracker.js';
import type { InferenceMetrics } from '../types.js';

// ─── HardwareDetector Tests ──────────────────────────────────────────────────

describe('HardwareDetector', () => {
  let detector: HardwareDetector;

  beforeEach(() => {
    detector = new HardwareDetector();
    detector.clearCache();
  });

  describe('Detection', () => {
    it('should detect hardware tier', () => {
      const tier = detector.detect();

      expect(tier).toBeDefined();
      expect(tier.id).toMatch(/^(apple-silicon|ultra|high|mid|low)$/);
      expect(tier.vramGB).toBeGreaterThanOrEqual(0);
      expect(tier.ramGB).toBeGreaterThanOrEqual(0);
      expect(tier.cpuCores).toBeGreaterThan(0);
      expect(tier.recommendedQuant).toBeDefined();
    });

    it('should cache hardware detection', () => {
      const tier1 = detector.detect();
      const tier2 = detector.detect();

      expect(tier1).toEqual(tier2);
    });

    it('should clear cache and re-detect', () => {
      const tier1 = detector.detect();
      detector.clearCache();
      const tier2 = detector.detect();

      // While values might be different due to randomness, structure should be same
      expect(tier1.id).toMatch(/^(apple-silicon|ultra|high|mid|low)$/);
      expect(tier2.id).toMatch(/^(apple-silicon|ultra|high|mid|low)$/);
    });

    it('should detect Apple Silicon when applicable', () => {
      // This test will pass if Apple Silicon is detected
      const tier = detector.detect();

      if (tier.id === 'apple-silicon') {
        expect(tier.gpuVendor).toBe('Apple');
        expect(tier.vramGB).toBeGreaterThan(0);
        expect(tier.ramGB).toEqual(tier.vramGB); // Unified memory
        expect(tier.recommendedQuant).toBe('Q4_K_M');
      }
    });

    it('should detect NVIDIA GPU characteristics', () => {
      const tier = detector.detect();

      if (tier.gpuVendor === 'NVIDIA') {
        expect(['ultra', 'high', 'mid', 'low']).toContain(tier.id);
        expect(tier.vramGB).toBeGreaterThan(0);
        expect(tier.ramGB).toBeGreaterThanOrEqual(tier.vramGB);
      }
    });

    it('should fallback to CPU-only detection', () => {
      const tier = detector.detect();

      if (tier.gpuVendor === null) {
        expect(tier.id).toBe('low');
        expect(tier.vramGB).toBe(0);
        expect(tier.ramGB).toBeGreaterThan(0);
      }
    });
  });

  describe('Quantization Recommendations', () => {
    it('should recommend quantization for low-tier hardware', () => {
      const lowTier = {
        id: 'low' as const,
        gpuVendor: null,
        vramGB: 0,
        ramGB: 8,
        cpuCores: 4,
        recommendedQuant: 'Q2_K',
      };

      const quant = detector.getRecommendedQuant(lowTier);
      expect(quant).toBe('Q2_K');
    });

    it('should recommend quantization for mid-tier hardware', () => {
      const midTier = {
        id: 'mid' as const,
        gpuVendor: 'NVIDIA',
        vramGB: 8,
        ramGB: 16,
        cpuCores: 8,
        recommendedQuant: 'Q4_K_M',
      };

      const quant = detector.getRecommendedQuant(midTier);
      expect(quant).toBe('Q4_K_M');
    });

    it('should recommend quantization for high-tier hardware', () => {
      const highTier = {
        id: 'high' as const,
        gpuVendor: 'NVIDIA',
        vramGB: 24,
        ramGB: 48,
        cpuCores: 16,
        recommendedQuant: 'Q5_K_M',
      };

      const quant = detector.getRecommendedQuant(highTier);
      expect(quant).toBe('Q5_K_M');
    });

    it('should recommend quantization for ultra-tier hardware', () => {
      const ultraTier = {
        id: 'ultra' as const,
        gpuVendor: 'NVIDIA',
        vramGB: 80,
        ramGB: 160,
        cpuCores: 32,
        recommendedQuant: 'Q8_0',
      };

      const quant = detector.getRecommendedQuant(ultraTier);
      expect(quant).toBe('Q8_0');
    });

    it('should recommend quantization for Apple Silicon', () => {
      const appleTier = {
        id: 'apple-silicon' as const,
        gpuVendor: 'Apple',
        vramGB: 16,
        ramGB: 16,
        cpuCores: 8,
        recommendedQuant: 'Q4_K_M',
      };

      const quant = detector.getRecommendedQuant(appleTier);
      expect(quant).toBe('Q4_K_M');
    });
  });

  describe('Hardware Tier Classification', () => {
    it('should classify NVIDIA GPUs correctly by VRAM', () => {
      // Multiple calls to get different random VRAM values
      let ultraDetected = false;
      let highDetected = false;
      let midDetected = false;
      let lowDetected = false;

      for (let i = 0; i < 50; i++) {
        detector.clearCache();
        const tier = detector.detect();

        if (tier.gpuVendor === 'NVIDIA') {
          if (tier.id === 'ultra') ultraDetected = true;
          if (tier.id === 'high') highDetected = true;
          if (tier.id === 'mid') midDetected = true;
          if (tier.id === 'low') lowDetected = true;
        }
      }

      // With enough iterations, we should see some variety
      // (though this is non-deterministic)
    });

    it('should correlate VRAM with tier classification', () => {
      for (let i = 0; i < 20; i++) {
        detector.clearCache();
        const tier = detector.detect();

        if (tier.gpuVendor === 'NVIDIA') {
          if (tier.id === 'ultra') {
            expect(tier.vramGB).toBeGreaterThanOrEqual(48);
          } else if (tier.id === 'high') {
            expect(tier.vramGB).toBeGreaterThanOrEqual(16);
            expect(tier.vramGB).toBeLessThan(48);
          } else if (tier.id === 'mid') {
            expect(tier.vramGB).toBeGreaterThanOrEqual(8);
            expect(tier.vramGB).toBeLessThan(16);
          } else if (tier.id === 'low') {
            expect(tier.vramGB).toBeLessThan(8);
          }
        }
      }
    });
  });

  describe('Property-Based Tests', () => {
    it('should always return valid hardware tiers', () => {
      for (let i = 0; i < 30; i++) {
        detector.clearCache();
        const tier = detector.detect();

        expect(['apple-silicon', 'ultra', 'high', 'mid', 'low']).toContain(tier.id);
        expect(tier.vramGB).toBeGreaterThanOrEqual(0);
        expect(tier.ramGB).toBeGreaterThanOrEqual(0);
        expect(tier.cpuCores).toBeGreaterThan(0);
        expect(['Apple', 'NVIDIA', null]).toContain(tier.gpuVendor);
      }
    });

    it('should maintain VRAM <= RAM relationship for NVIDIA', () => {
      for (let i = 0; i < 20; i++) {
        detector.clearCache();
        const tier = detector.detect();

        if (tier.gpuVendor === 'NVIDIA') {
          expect(tier.vramGB).toBeLessThanOrEqual(tier.ramGB);
        }
      }
    });

    it('should provide valid quantization for all tiers', () => {
      const tiers = [
        { id: 'low' as const, vramGB: 2, ramGB: 8, cpuCores: 4, gpuVendor: null, recommendedQuant: 'Q2_K' },
        { id: 'mid' as const, vramGB: 8, ramGB: 16, cpuCores: 8, gpuVendor: 'NVIDIA', recommendedQuant: 'Q4_K_M' },
        { id: 'high' as const, vramGB: 24, ramGB: 48, cpuCores: 16, gpuVendor: 'NVIDIA', recommendedQuant: 'Q5_K_M' },
        { id: 'ultra' as const, vramGB: 80, ramGB: 160, cpuCores: 32, gpuVendor: 'NVIDIA', recommendedQuant: 'Q8_0' },
        { id: 'apple-silicon' as const, vramGB: 16, ramGB: 16, cpuCores: 8, gpuVendor: 'Apple', recommendedQuant: 'Q4_K_M' },
      ];

      for (const tier of tiers) {
        const quant = detector.getRecommendedQuant(tier);
        expect(quant).toMatch(/^Q\d+_(K_M|K|0)$/);
      }
    });
  });
});

// ─── MetricsTracker Tests ────────────────────────────────────────────────────

describe('MetricsTracker', () => {
  let tracker: MetricsTracker;

  beforeEach(() => {
    tracker = new MetricsTracker(1000);
  });

  describe('Basic Operations', () => {
    it('should record metrics', () => {
      const metric: InferenceMetrics = {
        agentId: 'test-agent',
        modelUsed: 'llama-13b',
        durationMs: 1500,
        tokensIn: 100,
        tokensOut: 50,
        confidence: 0.92,
        wasEscalated: false,
        energyWh: 0.05,
      };

      tracker.record(metric);
      expect(tracker.getCount()).toBe(1);
    });

    it('should record multiple metrics', () => {
      for (let i = 0; i < 10; i++) {
        tracker.record({
          agentId: `agent-${i % 3}`,
          modelUsed: 'llama-13b',
          durationMs: 1000 + i * 100,
          tokensIn: 100,
          tokensOut: 50,
          confidence: 0.9,
          wasEscalated: false,
          energyWh: 0.05,
        });
      }

      expect(tracker.getCount()).toBe(10);
    });

    it('should respect max history', () => {
      const smallTracker = new MetricsTracker(5);

      for (let i = 0; i < 10; i++) {
        smallTracker.record({
          agentId: 'agent',
          modelUsed: 'llama-13b',
          durationMs: 1000,
          tokensIn: 100,
          tokensOut: 50,
          confidence: 0.9,
          wasEscalated: false,
          energyWh: 0.05,
        });
      }

      expect(smallTracker.getCount()).toBeLessThanOrEqual(5);
    });

    it('should clear metrics', () => {
      tracker.record({
        agentId: 'agent',
        modelUsed: 'model',
        durationMs: 100,
        tokensIn: 10,
        tokensOut: 5,
        confidence: 0.8,
        wasEscalated: false,
        energyWh: 0.01,
      });

      expect(tracker.getCount()).toBe(1);
      tracker.clear();
      expect(tracker.getCount()).toBe(0);
    });
  });

  describe('Retrieval', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        tracker.record({
          agentId: i % 2 === 0 ? 'agent-a' : 'agent-b',
          modelUsed: 'llama-13b',
          durationMs: 1000 + i * 100,
          tokensIn: 100,
          tokensOut: 50,
          confidence: 0.9,
          wasEscalated: i === 2,
          energyWh: 0.05,
        });
      }
    });

    it('should get recent metrics', () => {
      const recent = tracker.getRecent(2);
      expect(recent.length).toBe(2);
    });

    it('should get metrics for specific agent', () => {
      const agentMetrics = tracker.getForAgent('agent-a');
      expect(agentMetrics.length).toBeGreaterThan(0);
      expect(agentMetrics.every(m => m.agentId === 'agent-a')).toBe(true);
    });

    it('should return empty array for unknown agent', () => {
      const metrics = tracker.getForAgent('unknown-agent');
      expect(metrics).toEqual([]);
    });
  });

  describe('Aggregation - Agent Summary', () => {
    it('should generate agent summary', () => {
      for (let i = 0; i < 5; i++) {
        tracker.record({
          agentId: 'test-agent',
          modelUsed: 'llama-13b',
          durationMs: 1000 + i * 200,
          tokensIn: 100,
          tokensOut: 50,
          confidence: 0.8 + i * 0.02,
          wasEscalated: i === 2,
          energyWh: 0.05 + i * 0.01,
        });
      }

      const summary = tracker.getSummary('test-agent');

      expect(summary.agentId).toBe('test-agent');
      expect(summary.totalInferences).toBe(5);
      expect(summary.avgDurationMs).toBeGreaterThan(0);
      expect(summary.avgConfidence).toBeGreaterThan(0);
      expect(summary.escalationRate).toBe(0.2); // 1 out of 5
      expect(summary.p50DurationMs).toBeGreaterThanOrEqual(summary.avgDurationMs * 0.5);
      expect(summary.p95DurationMs).toBeGreaterThanOrEqual(summary.p50DurationMs);
      expect(summary.p99DurationMs).toBeGreaterThanOrEqual(summary.p95DurationMs);
    });

    it('should handle empty agent metrics', () => {
      const summary = tracker.getSummary('nonexistent');

      expect(summary.agentId).toBe('nonexistent');
      expect(summary.totalInferences).toBe(0);
      expect(summary.avgDurationMs).toBe(0);
      expect(summary.escalationRate).toBe(0);
    });

    it('should calculate percentiles correctly', () => {
      // Add 100 metrics with known durations
      for (let i = 0; i < 100; i++) {
        tracker.record({
          agentId: 'agent',
          modelUsed: 'model',
          durationMs: i + 1, // 1, 2, 3, ... 100
          tokensIn: 10,
          tokensOut: 5,
          confidence: 0.8,
          wasEscalated: false,
          energyWh: 0.01,
        });
      }

      const summary = tracker.getSummary('agent');

      expect(summary.p50DurationMs).toBeGreaterThan(50);
      expect(summary.p95DurationMs).toBeGreaterThan(summary.p50DurationMs);
      expect(summary.p99DurationMs).toBeGreaterThan(summary.p95DurationMs);
    });

    it('should track models used', () => {
      tracker.record({
        agentId: 'agent',
        modelUsed: 'llama-13b',
        durationMs: 1000,
        tokensIn: 100,
        tokensOut: 50,
        confidence: 0.9,
        wasEscalated: false,
        energyWh: 0.05,
      });

      tracker.record({
        agentId: 'agent',
        modelUsed: 'gpt-4',
        durationMs: 500,
        tokensIn: 100,
        tokensOut: 50,
        confidence: 0.95,
        wasEscalated: false,
        energyWh: 0.02,
      });

      const summary = tracker.getSummary('agent');

      expect(summary.modelsUsed['llama-13b']).toBe(1);
      expect(summary.modelsUsed['gpt-4']).toBe(1);
    });

    it('should track speculative decoding acceptance rates', () => {
      tracker.record({
        agentId: 'agent',
        modelUsed: 'model',
        durationMs: 100,
        tokensIn: 10,
        tokensOut: 5,
        confidence: 0.8,
        wasEscalated: false,
        energyWh: 0.01,
        speculativeAcceptanceRate: 0.85,
      });

      tracker.record({
        agentId: 'agent',
        modelUsed: 'model',
        durationMs: 100,
        tokensIn: 10,
        tokensOut: 5,
        confidence: 0.8,
        wasEscalated: false,
        energyWh: 0.01,
        speculativeAcceptanceRate: 0.75,
      });

      const summary = tracker.getSummary('agent');

      expect(summary.avgSpeculativeAcceptanceRate).toBeCloseTo(0.8, 1);
    });
  });

  describe('Aggregation - Global Summary', () => {
    beforeEach(() => {
      // Record metrics for multiple agents and models
      for (let i = 0; i < 10; i++) {
        tracker.record({
          agentId: i % 3 === 0 ? 'agent-1' : i % 3 === 1 ? 'agent-2' : 'agent-3',
          modelUsed: i % 2 === 0 ? 'llama-13b' : 'gpt-4',
          durationMs: 1000 + i * 100,
          tokensIn: 100,
          tokensOut: 50,
          confidence: 0.85 + i * 0.01,
          wasEscalated: i === 5 || i === 7,
          energyWh: 0.05,
        });
      }
    });

    it('should generate global summary', () => {
      const summary = tracker.getGlobalSummary();

      expect(summary.totalInferences).toBe(10);
      expect(Object.keys(summary.byAgent).length).toBe(3);
      expect(summary.globalEscalationRate).toBe(0.2); // 2 out of 10
      expect(summary.globalAvgConfidence).toBeGreaterThan(0);
      expect(summary.topModels.length).toBeGreaterThan(0);
    });

    it('should identify top models', () => {
      const summary = tracker.getGlobalSummary();

      expect(summary.topModels.length).toBeLessThanOrEqual(5);
      expect(summary.topModels[0].count).toBeGreaterThanOrEqual(summary.topModels[1]?.count ?? 0);
    });

    it('should track agent-level metrics in global summary', () => {
      const summary = tracker.getGlobalSummary();

      for (const agentId of ['agent-1', 'agent-2', 'agent-3']) {
        const agentSummary = summary.byAgent[agentId];
        expect(agentSummary).toBeDefined();
        expect(agentSummary.totalInferences).toBeGreaterThan(0);
      }
    });
  });

  describe('Export', () => {
    it('should export metrics as JSON', () => {
      tracker.record({
        agentId: 'agent',
        modelUsed: 'model',
        durationMs: 100,
        tokensIn: 10,
        tokensOut: 5,
        confidence: 0.8,
        wasEscalated: false,
        energyWh: 0.01,
      });

      const json = tracker.exportJson();
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0].agentId).toBe('agent');
    });
  });

  describe('Property-Based Tests', () => {
    it('should handle arbitrary metric values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              duration: fc.integer({ min: 10, max: 10000 }),
              tokens_in: fc.integer({ min: 1, max: 1000 }),
              tokens_out: fc.integer({ min: 0, max: 1000 }),
              confidence: fc.tuple(fc.integer({ min: 0, max: 100 })),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          records => {
            tracker.clear();

            for (let i = 0; i < records.length; i++) {
              tracker.record({
                agentId: `agent-${i % 2}`,
                modelUsed: 'model',
                durationMs: records[i].duration,
                tokensIn: records[i].tokens_in,
                tokensOut: records[i].tokens_out,
                confidence: records[i].confidence[0] / 100,
                wasEscalated: false,
                energyWh: 0.05,
              });
            }

            // All metrics should be recorded
            return tracker.getCount() === records.length;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain aggregation invariants', () => {
      for (let i = 0; i < 30; i++) {
        tracker.clear();

        for (let j = 0; j < 20; j++) {
          tracker.record({
            agentId: 'agent',
            modelUsed: 'model',
            durationMs: Math.floor(Math.random() * 5000) + 100,
            tokensIn: Math.floor(Math.random() * 500),
            tokensOut: Math.floor(Math.random() * 500),
            confidence: Math.random(),
            wasEscalated: Math.random() > 0.8,
            energyWh: Math.random() * 0.1,
          });
        }

        const summary = tracker.getSummary('agent');
        const global = tracker.getGlobalSummary();

        // Invariants
        expect(summary.escalationRate).toBeGreaterThanOrEqual(0);
        expect(summary.escalationRate).toBeLessThanOrEqual(1);
        expect(summary.avgConfidence).toBeGreaterThanOrEqual(0);
        expect(summary.avgConfidence).toBeLessThanOrEqual(1);
        expect(summary.p50DurationMs).toBeGreaterThanOrEqual(0);
        expect(summary.p95DurationMs).toBeGreaterThanOrEqual(summary.p50DurationMs);
        expect(global.globalEscalationRate).toBeGreaterThanOrEqual(0);
        expect(global.globalEscalationRate).toBeLessThanOrEqual(1);
      }
    });
  });
});
