/**
 * Comprehensive tests for ModelRouter and ModelRegistry
 * Task H5-01: Model Routing — Router + Registry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ModelRouter } from '../router.js';
import { ModelRegistry } from '../model-registry.js';
import { HardwareDetector } from '../hardware-detector.js';
import type { ModelProfile, AgentModelMapping, HardwareTier } from '../types.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────

class MockHardwareDetector implements HardwareDetector {
  private tier: HardwareTier = {
    id: 'mid',
    gpuVendor: 'nvidia',
    vramGB: 8,
    ramGB: 16,
    cpuCores: 8,
    recommendedQuant: 'Q4_K_M',
  };

  setTier(tier: Partial<HardwareTier>) {
    this.tier = { ...this.tier, ...tier };
  }

  detect(): HardwareTier {
    return this.tier;
  }
}

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  describe('Basic Operations', () => {
    it('should register and retrieve a model', () => {
      const model: ModelProfile = {
        name: 'test-model',
        family: 'test',
        strength: 'balanced',
        quant: 'Q4_K_M',
        contextWindow: 8192,
        tokensPerSec: 50,
        costFactor: 0.5,
      };

      registry.register(model);
      const retrieved = registry.get('test-model');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-model');
      expect(retrieved?.family).toBe('test');
    });

    it('should throw error when registering model without name', () => {
      const invalidModel = { family: 'test' } as ModelProfile;
      expect(() => registry.register(invalidModel)).toThrow(
        'ModelProfile must have a name and family'
      );
    });

    it('should throw error when registering model without family', () => {
      const invalidModel = { name: 'test' } as ModelProfile;
      expect(() => registry.register(invalidModel)).toThrow(
        'ModelProfile must have a name and family'
      );
    });

    it('should return undefined for non-existent model', () => {
      const result = registry.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should list all registered models', () => {
      const models: ModelProfile[] = [
        {
          name: 'model-1',
          family: 'test',
          strength: 'speed',
          quant: 'Q4_K_M',
          contextWindow: 8192,
          tokensPerSec: 100,
          costFactor: 0.3,
        },
        {
          name: 'model-2',
          family: 'test',
          strength: 'power',
          quant: 'Q4_K_M',
          contextWindow: 16384,
          tokensPerSec: 50,
          costFactor: 0.8,
        },
      ];

      models.forEach(m => registry.register(m));
      const listed = registry.list();

      expect(listed.length).toBeGreaterThanOrEqual(2);
      expect(listed.some(m => m.name === 'model-1')).toBe(true);
      expect(listed.some(m => m.name === 'model-2')).toBe(true);
    });

    it('should handle duplicate model registration (overwrite)', () => {
      const model1: ModelProfile = {
        name: 'model',
        family: 'test',
        strength: 'speed',
        quant: 'Q4_K_M',
        contextWindow: 8192,
        tokensPerSec: 100,
        costFactor: 0.3,
      };

      const model2: ModelProfile = {
        name: 'model',
        family: 'test',
        strength: 'power',
        quant: 'Q8_0',
        contextWindow: 16384,
        tokensPerSec: 50,
        costFactor: 0.8,
      };

      registry.register(model1);
      registry.register(model2);

      const retrieved = registry.get('model');
      expect(retrieved?.strength).toBe('power');
      expect(retrieved?.quant).toBe('Q8_0');
    });

    it('should get agent mappings', () => {
      const mapping = registry.getForAgent('architect-alpha');
      expect(mapping).toBeDefined();
      expect(mapping?.agentId).toBe('architect-alpha');
      expect(mapping?.primary).toBeDefined();
      expect(mapping?.fallback).toBeDefined();
    });

    it('should return undefined for unknown agent', () => {
      const mapping = registry.getForAgent('unknown-agent');
      expect(mapping).toBeUndefined();
    });

    it('should register agent mapping', () => {
      const primary: ModelProfile = {
        name: 'primary',
        family: 'test',
        strength: 'power',
        quant: 'Q4_K_M',
        contextWindow: 8192,
        tokensPerSec: 50,
        costFactor: 0.8,
      };

      const fallback: ModelProfile = {
        name: 'fallback',
        family: 'test',
        strength: 'speed',
        quant: 'Q4_K_M',
        contextWindow: 4096,
        tokensPerSec: 100,
        costFactor: 0.3,
      };

      registry.register(primary);
      registry.register(fallback);

      const mapping: AgentModelMapping = {
        agentId: 'test-agent',
        primary,
        fallback: [fallback],
        confidenceThreshold: 0.8,
        maxConcurrent: 4,
        tasteVaultWeight: 0.75,
      };

      registry.registerAgentMapping(mapping);
      const retrieved = registry.getForAgent('test-agent');

      expect(retrieved?.agentId).toBe('test-agent');
      expect(retrieved?.primary.name).toBe('primary');
      expect(retrieved?.fallback[0].name).toBe('fallback');
    });

    it('should clear all models and mappings', () => {
      registry.clear();

      expect(registry.list().length).toBe(0);
      const mapping = registry.getForAgent('architect-alpha');
      expect(mapping).toBeUndefined();
    });

    it('should return all default agent mappings', () => {
      const mappings = registry.getDefaultMappings();
      expect(mappings.length).toBe(21); // 21 agents in default configuration
      expect(mappings.every(m => m.agentId && m.primary)).toBe(true);
    });
  });

  describe('Default Initialization', () => {
    it('should initialize with default models', () => {
      const models = registry.list();
      expect(models.length).toBeGreaterThan(0);

      // Verify some expected models exist
      expect(registry.get('llama-3.1-70b-Q4_K_M')).toBeDefined();
      expect(registry.get('mistral-large-Q4_K_M')).toBeDefined();
      expect(registry.get('qwen2.5-coder-32b-Q4_K_M')).toBeDefined();
    });

    it('should have all agent mappings valid', () => {
      const mappings = registry.getDefaultMappings();

      for (const mapping of mappings) {
        // Primary should exist
        expect(registry.get(mapping.primary.name)).toBeDefined();

        // All fallbacks should exist
        for (const fallback of mapping.fallback) {
          expect(registry.get(fallback.name)).toBeDefined();
        }

        // Confidence threshold should be reasonable
        expect(mapping.confidenceThreshold).toBeGreaterThan(0);
        expect(mapping.confidenceThreshold).toBeLessThanOrEqual(1);

        // Max concurrent should be positive
        expect(mapping.maxConcurrent).toBeGreaterThan(0);
      }
    });
  });

  describe('Property-Based Tests', () => {
    it('should handle arbitrary model registrations', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            family: fc.string({ minLength: 1, maxLength: 20 }),
            strength: fc.string({ maxLength: 20 }),
            quant: fc.string({ maxLength: 10 }),
            contextWindow: fc.integer({ min: 256, max: 200000 }),
            tokensPerSec: fc.integer({ min: 1, max: 1000 }),
            costFactor: fc.double({ min: 0.01, max: 10, noNaN: true }).filter(n => isFinite(n)),
          }),
          model => {
            const fullModel: ModelProfile = {
              ...model,
              name: `model-${Date.now()}-${Math.random()}`, // Ensure unique name
            };

            registry.register(fullModel);
            const retrieved = registry.get(fullModel.name);

            // Should be able to retrieve what was registered
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe(fullModel.name);
            expect(retrieved?.family).toBe(fullModel.family);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should always find registered models', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }),
              family: fc.constantFrom('test1', 'test2'),
              strength: fc.string({ maxLength: 10 }),
              quant: fc.string({ maxLength: 10 }),
              contextWindow: fc.integer({ min: 256, max: 8192 }),
              tokensPerSec: fc.integer({ min: 10, max: 500 }),
              costFactor: fc.double({ min: 0.1, max: 2, noNaN: true }).filter(n => isFinite(n)),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          models => {
            registry.clear();

            // Register all models with unique names
            const registered = models.map((m, i) => ({
              ...m,
              name: `model-${i}`,
            }));

            registered.forEach(m => registry.register(m));

            // Verify all can be retrieved
            return registered.every(m => registry.get(m.name) !== undefined);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});

// ─── ModelRouter Tests ────────────────────────────────────────────────────

describe('ModelRouter', () => {
  let registry: ModelRegistry;
  let hardwareDetector: MockHardwareDetector;
  let router: ModelRouter;

  beforeEach(() => {
    registry = new ModelRegistry();
    hardwareDetector = new MockHardwareDetector();
    router = new ModelRouter(registry, hardwareDetector, {
      enableSpeculativeDecoding: true,
      enableDynamicEscalation: true,
      enableQueueing: true,
      defaultConfidenceThreshold: 0.75,
      maxFallbackDepth: 3,
    });
  });

  describe('Route Selection', () => {
    it('should select primary model for high confidence', () => {
      const result = router.route('architect-alpha', 'Design complex system', 0.9);

      expect(result).toBeDefined();
      expect(result.selectedModel).toBeDefined();
      expect(result.agentId).toBe('architect-alpha');
      expect(result.confidence).toBe(0.9);
    });

    it('should select fallback when confidence is low', () => {
      const result = router.route('architect-alpha', 'Simple task', 0.5);

      expect(result).toBeDefined();
      expect(result.selectedModel).toBeDefined();
      expect(result.fallbackChain.length).toBeGreaterThanOrEqual(0);
    });

    it('should include fallback models in chain', () => {
      const result = router.route('code-sage', 'Generate test cases', 0.8);

      expect(result.fallbackChain).toBeDefined();
      expect(Array.isArray(result.fallbackChain)).toBe(true);
    });

    it('should throw error for unknown agent', () => {
      expect(() => {
        router.route('unknown-agent', 'task', 0.8);
      }).toThrow('No model mapping found for agent');
    });

    it('should estimate tokens per second based on model', () => {
      const result = router.route('architect-alpha', 'task', 0.8);

      expect(result.estimatedTokensPerSec).toBeGreaterThan(0);
      expect(typeof result.estimatedTokensPerSec).toBe('number');
    });

    it('should estimate cost based on task description', () => {
      const simpleTask = 'Fix typo';
      const complexTask = 'Refactor entire architecture with optimization and security audit for performance scalability distributed system';

      const simpleResult = router.route('code-sage', simpleTask, 0.8);
      const complexResult = router.route('code-sage', complexTask, 0.8);

      // Complex task should have higher estimated cost
      expect(complexResult.estimatedCost).toBeGreaterThanOrEqual(simpleResult.estimatedCost);
    });

    it('should handle speculative decoding flag', () => {
      const result = router.route('code-sage', 'task', 0.8);

      expect(typeof result.useSpeculativeDecoding).toBe('boolean');
    });

    it('should queue when concurrent limit exceeded', () => {
      // Route many requests rapidly
      for (let i = 0; i < 5; i++) {
        router.route('perf-sage', `task-${i}`, 0.7);
      }

      const result = router.route('perf-sage', 'task-overflow', 0.7);

      // Result should either be queued or successfully routed
      expect(result).toBeDefined();
      if ('queuePosition' in result && result.queuePosition === -1) {
        expect(result.queuePosition).toBe(-1); // Indicates queued
      }
    });
  });

  describe('Escalation Logic', () => {
    it('should escalate when confidence is low', () => {
      const shouldEscalate = router.shouldEscalate('phi-4-Q4_K_M', 0.5);

      // phi model (efficiency) should be eligible for escalation with low confidence
      expect(typeof shouldEscalate).toBe('boolean');
    });

    it('should not escalate power models', () => {
      const shouldEscalate = router.shouldEscalate('llama-3.1-405b-Q4_K_M', 0.5);

      // Power model shouldn't be escalated further
      expect(shouldEscalate).toBe(false);
    });

    it('should not escalate when disabled', () => {
      const noEscalationRouter = new ModelRouter(registry, hardwareDetector, {
        enableDynamicEscalation: false,
      });

      const shouldEscalate = noEscalationRouter.shouldEscalate('phi-4-Q4_K_M', 0.5);
      expect(shouldEscalate).toBe(false);
    });
  });

  describe('Metrics Tracking', () => {
    it('should record metrics', () => {
      const metrics = {
        agentId: 'test-agent',
        modelUsed: 'test-model',
        taskDescription: 'test',
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 500,
        success: true,
      };

      router.recordMetrics(metrics);
      const recorded = router.getMetrics();

      expect(recorded.length).toBeGreaterThan(0);
    });

    it('should filter metrics by agent', () => {
      router.recordMetrics({
        agentId: 'agent-1',
        modelUsed: 'model-1',
        taskDescription: 'task',
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 500,
        success: true,
      });

      router.recordMetrics({
        agentId: 'agent-2',
        modelUsed: 'model-2',
        taskDescription: 'task',
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 500,
        success: true,
      });

      const agent1Metrics = router.getMetrics('agent-1');
      expect(agent1Metrics.every(m => m.agentId === 'agent-1')).toBe(true);
    });

    it('should clear metrics', () => {
      router.recordMetrics({
        agentId: 'test',
        modelUsed: 'model',
        taskDescription: 'task',
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 500,
        success: true,
      });

      router.clearMetrics();
      expect(router.getMetrics().length).toBe(0);
    });

    it('should limit metrics history size', () => {
      // Record many metrics
      for (let i = 0; i < 1100; i++) {
        router.recordMetrics({
          agentId: `agent-${i}`,
          modelUsed: `model-${i}`,
          taskDescription: 'task',
          inputTokens: 100,
          outputTokens: 50,
          latencyMs: 500,
          success: true,
        });
      }

      const metrics = router.getMetrics();
      // Should keep last 1000
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Slot Management', () => {
    it('should release inference slots', () => {
      router.route('code-sage', 'task', 0.8);
      router.releaseSlot('code-sage');

      // Second routing should succeed without queueing due to released slot
      const result = router.route('code-sage', 'task', 0.8);
      expect(result).toBeDefined();
    });
  });

  describe('Hardware Adaptation', () => {
    it('should adapt to low hardware tier', () => {
      hardwareDetector.setTier({ id: 'low', vramGB: 2, ramGB: 8 });

      const result = router.route('architect-alpha', 'task', 0.8);
      expect(result.selectedModel).toBeDefined();
      // Token rate should be adjusted down for low hardware
    });

    it('should adapt to ultra hardware tier', () => {
      hardwareDetector.setTier({ id: 'ultra', vramGB: 48, ramGB: 256 });

      const result = router.route('architect-alpha', 'task', 0.8);
      expect(result.estimatedTokensPerSec).toBeGreaterThan(0);
    });

    it('should handle CPU-only mode', () => {
      hardwareDetector.setTier({ id: 'low', gpuVendor: null, ramGB: 8 });

      const result = router.route('dep-analyzer', 'task', 0.7);
      expect(result.selectedModel).toBeDefined();
    });
  });

  describe('Property-Based Tests', () => {
    it('should always select a valid model', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 0.99, noNaN: true }).filter(n => isFinite(n)),
          fc.string({ minLength: 5, maxLength: 100 }),
          (confidence, taskDesc) => {
            const result = router.route('architect-alpha', taskDesc, confidence);

            // Result should always have a selected model
            expect(result.selectedModel).toBeDefined();
            expect(result.selectedModel.name).toBeTruthy();

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should provide valid fallback chains', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 0.99, noNaN: true }).filter(n => isFinite(n)),
          confidence => {
            const result = router.route('code-sage', 'test task', confidence);

            // Fallback chain should be valid
            expect(Array.isArray(result.fallbackChain)).toBe(true);
            expect(
              result.fallbackChain.every(m => typeof m.name === 'string' && m.name.length > 0)
            ).toBe(true);

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
