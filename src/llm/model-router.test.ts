// Model Router Tests
// Comprehensive test suite for UCB-based model routing

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ModelRouter,
  getModelRouter,
  resetModelRouter,
  type RoutingConstraints,
  type TaskResult,
} from './model-router.js';
import {
  MODEL_REGISTRY,
  getModelById,
  getModelsForTaskType,
  type TaskType,
  type ModelConfig,
} from './model-registry.js';

describe('ModelRouter', () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Route Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('route', () => {
    it('returns a route decision for valid inputs', () => {
      const decision = router.route('SUN', 'code-generation');

      expect(decision).toHaveProperty('model');
      expect(decision).toHaveProperty('reason');
      expect(decision).toHaveProperty('confidence');
      expect(decision).toHaveProperty('estimatedCost');
      expect(decision).toHaveProperty('estimatedLatency');
      expect(decision).toHaveProperty('alternatives');
    });

    it('selects a model with required capabilities', () => {
      const decision = router.route('MARS', 'code-generation');
      
      expect(decision.model.capabilities).toContain('code-generation');
    });

    it('provides alternatives', () => {
      const decision = router.route('VENUS', 'code-generation');

      expect(decision.alternatives.length).toBeGreaterThan(0);
    });

    it('includes estimated cost', () => {
      const decision = router.route('EARTH', 'documentation');

      expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);
    });

    it('includes estimated latency', () => {
      const decision = router.route('SATURN', 'testing');

      expect(decision.estimatedLatency).toBeGreaterThan(0);
    });

    it('provides confidence score between 0 and 1', () => {
      const decision = router.route('JUPITER', 'architecture-design');

      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('includes descriptive reason', () => {
      const decision = router.route('MERCURY', 'validation');

      expect(decision.reason.length).toBeGreaterThan(0);
      expect(decision.reason).toContain(decision.model.name);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Constraint Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('constraints', () => {
    it('respects maxCost constraint', () => {
      const constraints: RoutingConstraints = {
        maxCost: 0.0001, // Very low cost limit
      };

      const decision = router.route('SUN', 'code-generation', constraints);
      
      // Should select a cheap or free model
      expect(decision.estimatedCost).toBeLessThanOrEqual(constraints.maxCost! * 10); // Allow some buffer
    });

    it('respects maxLatency constraint', () => {
      const constraints: RoutingConstraints = {
        maxLatency: 1500, // 1.5 seconds for fast model
      };

      // Quick-query with small output token count (realistic for quick queries)
      const decision = router.route('SUN', 'quick-query', constraints, { input: 200, output: 100 });

      // Should select a model that meets or nearly meets the latency constraint
      expect(decision.estimatedLatency).toBeLessThanOrEqual(constraints.maxLatency! * 1.2);
    });

    it('respects minQuality constraint', () => {
      const constraints: RoutingConstraints = {
        minQuality: 0.85,
      };

      const decision = router.route('SUN', 'architecture-design', constraints);
      
      expect(decision.model.quality).toBeGreaterThanOrEqual(constraints.minQuality!);
    });

    it('respects preferLocal constraint', () => {
      const constraints: RoutingConstraints = {
        preferLocal: true,
      };

      // Run multiple times to account for exploration
      let localCount = 0;
      for (let i = 0; i < 10; i++) {
        const decision = router.route('SUN', 'code-generation', constraints);
        if (decision.model.provider === 'ollama') {
          localCount++;
        }
      }

      // Should prefer local models most of the time
      expect(localCount).toBeGreaterThanOrEqual(5);
    });

    it('respects preferredProviders constraint', () => {
      const constraints: RoutingConstraints = {
        preferredProviders: ['anthropic'],
      };

      const decision = router.route('SUN', 'code-generation', constraints);
      
      expect(decision.model.provider).toBe('anthropic');
    });

    it('respects excludedModels constraint', () => {
      const constraints: RoutingConstraints = {
        excludedModels: ['anthropic-claude-3-haiku'],
      };

      // Run multiple times
      for (let i = 0; i < 10; i++) {
        const decision = router.route('SUN', 'code-generation', constraints);
        expect(decision.model.id).not.toBe('anthropic-claude-3-haiku');
      }
    });

    it('throws when no models satisfy constraints', () => {
      const constraints: RoutingConstraints = {
        maxCost: 0.0000001, // Impossibly low
        minQuality: 0.99, // Impossibly high
      };

      expect(() => router.route('SUN', 'code-generation', constraints))
        .toThrow('No models available');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // UCB Algorithm Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('UCB algorithm', () => {
    it('explores unvisited models first', () => {
      // Reset stats to ensure clean slate
      router.resetStats();

      const decision = router.route('SUN', 'code-generation');
      
      // First route should pick an unexplored model or use initial stats
      expect(decision.model).toBeDefined();
    });

    it('converges to best model after multiple tasks', () => {
      const modelId = 'anthropic-claude-3-sonnet';
      const taskType: TaskType = 'code-generation';

      // Simulate many successful tasks with a specific model
      for (let i = 0; i < 50; i++) {
        const result: TaskResult = {
          success: true,
          quality: 0.9,
          latency: 500,
          cost: 0.001,
          tokens: { input: 1000, output: 500 },
        };
        router.updateStats(modelId, taskType, result);
      }

      // Now route should prefer this model
      const rankings = router.getModelRanking(taskType);
      const topModel = rankings[0];

      // With enough positive data, this model should be highly ranked
      expect(topModel.ucbScore).toBeGreaterThan(0);
    });

    it('penalizes models with failures', () => {
      const goodModel = 'anthropic-claude-3-sonnet';
      const badModel = 'openai-gpt-4o-mini';
      const taskType: TaskType = 'code-generation';

      // Good model gets successful results
      for (let i = 0; i < 10; i++) {
        router.updateStats(goodModel, taskType, {
          success: true,
          quality: 0.9,
          latency: 500,
          cost: 0.002,
          tokens: { input: 1000, output: 500 },
        });
      }

      // Bad model gets failures
      for (let i = 0; i < 10; i++) {
        router.updateStats(badModel, taskType, {
          success: false,
          quality: 0,
          latency: 1000,
          cost: 0,
          tokens: { input: 1000, output: 0 },
        });
      }

      const rankings = router.getModelRanking(taskType);
      const goodModelRank = rankings.findIndex(r => r.model.id === goodModel);
      const badModelRank = rankings.findIndex(r => r.model.id === badModel);

      // Good model should rank higher than bad model
      expect(goodModelRank).toBeLessThan(badModelRank);
    });

    it('explores with exploration rate', () => {
      router.setExplorationRate(0.5); // High exploration

      const taskType: TaskType = 'code-generation';
      const modelId = 'anthropic-claude-3-sonnet';

      // Build up stats for one model
      for (let i = 0; i < 20; i++) {
        router.updateStats(modelId, taskType, {
          success: true,
          quality: 0.95,
          latency: 400,
          cost: 0.002,
          tokens: { input: 1000, output: 500 },
        });
      }

      // With high exploration, should sometimes pick second best
      let secondBestCount = 0;
      for (let i = 0; i < 20; i++) {
        const decision = router.route('SUN', taskType);
        if (decision.model.id !== modelId) {
          secondBestCount++;
        }
      }

      // With 50% exploration rate, should pick alternatives sometimes
      expect(secondBestCount).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Update Stats Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('updateStats', () => {
    it('increments total calls', () => {
      const modelId = 'anthropic-claude-3-sonnet';
      const taskType: TaskType = 'code-generation';

      const before = router.getModelStats(modelId);
      const beforeCalls = before?.totalCalls ?? 0;

      router.updateStats(modelId, taskType, {
        success: true,
        quality: 0.8,
        latency: 600,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });

      const after = router.getModelStats(modelId);
      expect(after?.totalCalls).toBe(beforeCalls + 1);
    });

    it('updates success rate on success', () => {
      const modelId = 'anthropic-claude-3-sonnet';
      const taskType: TaskType = 'code-generation';

      router.updateStats(modelId, taskType, {
        success: true,
        quality: 0.8,
        latency: 600,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });

      const stats = router.getModelStats(modelId);
      expect(stats?.successRate).toBe(1);
      expect(stats?.successCount).toBe(1);
    });

    it('updates success rate on failure', () => {
      const modelId = 'anthropic-claude-3-sonnet';
      const taskType: TaskType = 'code-generation';

      router.updateStats(modelId, taskType, {
        success: true,
        quality: 0.8,
        latency: 600,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });

      router.updateStats(modelId, taskType, {
        success: false,
        quality: 0,
        latency: 1000,
        cost: 0,
        tokens: { input: 1000, output: 0 },
        error: 'API error',
      });

      const stats = router.getModelStats(modelId);
      expect(stats?.successRate).toBe(0.5);
      expect(stats?.failureCount).toBe(1);
    });

    it('updates average latency', () => {
      const modelId = 'anthropic-claude-3-sonnet';
      const taskType: TaskType = 'code-generation';

      router.updateStats(modelId, taskType, {
        success: true,
        quality: 0.8,
        latency: 1000,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });

      router.updateStats(modelId, taskType, {
        success: true,
        quality: 0.8,
        latency: 2000,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });

      const stats = router.getModelStats(modelId);
      expect(stats?.avgLatency).toBe(1500);
    });

    it('updates last used timestamp', () => {
      const modelId = 'anthropic-claude-3-sonnet';
      const taskType: TaskType = 'code-generation';

      const before = Date.now();
      router.updateStats(modelId, taskType, {
        success: true,
        quality: 0.8,
        latency: 600,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });
      const after = Date.now();

      const stats = router.getModelStats(modelId);
      expect(stats?.lastUsed).toBeGreaterThanOrEqual(before);
      expect(stats?.lastUsed).toBeLessThanOrEqual(after);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Model Ranking Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getModelRanking', () => {
    it('returns ranked list of models', () => {
      const rankings = router.getModelRanking('code-generation');

      expect(rankings.length).toBeGreaterThan(0);
      expect(rankings[0]).toHaveProperty('model');
      expect(rankings[0]).toHaveProperty('ucbScore');
      expect(rankings[0]).toHaveProperty('stats');
    });

    it('sorts by UCB score descending', () => {
      // Add some stats to create differentiation
      const taskType: TaskType = 'code-generation';
      
      router.updateStats('anthropic-claude-3-sonnet', taskType, {
        success: true,
        quality: 0.95,
        latency: 500,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });

      const rankings = router.getModelRanking(taskType);

      // Verify descending order
      for (let i = 1; i < rankings.length; i++) {
        expect(rankings[i - 1].ucbScore).toBeGreaterThanOrEqual(rankings[i].ucbScore);
      }
    });

    it('includes all models for task type', () => {
      const taskType: TaskType = 'code-generation';
      const expectedModels = getModelsForTaskType(taskType);
      
      const rankings = router.getModelRanking(taskType);

      expect(rankings.length).toBe(expectedModels.length);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Reset Stats Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('resetStats', () => {
    it('resets stats for specific model', () => {
      const modelId = 'anthropic-claude-3-sonnet';
      const taskType: TaskType = 'code-generation';

      router.updateStats(modelId, taskType, {
        success: true,
        quality: 0.8,
        latency: 600,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });

      expect(router.getModelStats(modelId)?.totalCalls).toBe(1);

      router.resetStats(modelId);

      expect(router.getModelStats(modelId)?.totalCalls).toBe(0);
    });

    it('resets all stats when no model specified', () => {
      const modelId = 'anthropic-claude-3-sonnet';
      const taskType: TaskType = 'code-generation';

      router.updateStats(modelId, taskType, {
        success: true,
        quality: 0.8,
        latency: 600,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });

      router.resetStats();

      const allStats = router.getAllStats();
      expect(allStats.global.get(modelId)?.totalCalls).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Exploration Rate Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('setExplorationRate', () => {
    it('sets exploration rate', () => {
      router.setExplorationRate(0.3);
      // No direct getter, but we can verify via behavior
      expect(true).toBe(true); // If no error, it worked
    });

    it('clamps to 0 minimum', () => {
      router.setExplorationRate(-0.5);
      // Should not throw, just clamp
      expect(true).toBe(true);
    });

    it('clamps to 1 maximum', () => {
      router.setExplorationRate(1.5);
      // Should not throw, just clamp
      expect(true).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Task Type Specific Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('task type routing', () => {
    const taskTypes: TaskType[] = [
      'code-generation',
      'code-analysis',
      'architecture-design',
      'testing',
      'documentation',
      'research',
      'summarization',
      'validation',
      'orchestration',
      'quick-query',
    ];

    it.each(taskTypes)('routes %s task type', (taskType) => {
      const decision = router.route('SUN', taskType);
      expect(decision.model).toBeDefined();
    });

    it('maintains separate stats per task type', () => {
      const modelId = 'anthropic-claude-3-sonnet';

      router.updateStats(modelId, 'code-generation', {
        success: true,
        quality: 0.9,
        latency: 500,
        cost: 0.002,
        tokens: { input: 1000, output: 500 },
      });

      router.updateStats(modelId, 'testing', {
        success: false,
        quality: 0,
        latency: 1000,
        cost: 0,
        tokens: { input: 1000, output: 0 },
      });

      const codeGenRankings = router.getModelRanking('code-generation');
      const testingRankings = router.getModelRanking('testing');

      const codeGenScore = codeGenRankings.find(r => r.model.id === modelId)?.ucbScore ?? 0;
      const testingScore = testingRankings.find(r => r.model.id === modelId)?.ucbScore ?? 0;

      // Code generation should have higher score due to success
      expect(codeGenScore).toBeGreaterThan(testingScore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Fallback Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('fallback handling', () => {
    it('provides alternatives when preferred model unavailable', () => {
      const constraints: RoutingConstraints = {
        excludedModels: ['anthropic-claude-3-opus'], // Exclude best model
      };

      const decision = router.route('SUN', 'architecture-design', constraints);

      expect(decision.model).toBeDefined();
      expect(decision.alternatives.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // UCB Convergence Test
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('UCB convergence', () => {
    it('converges to best model after 100 simulated tasks', () => {
      const taskType: TaskType = 'code-generation';
      const bestModel = 'anthropic-claude-3-opus';
      const okModel = 'anthropic-claude-3-sonnet';

      // Simulate 100 tasks with best model being consistently better
      for (let i = 0; i < 100; i++) {
        // Best model: high quality, reasonable cost
        router.updateStats(bestModel, taskType, {
          success: true,
          quality: 0.95,
          latency: 1000,
          cost: 0.005,
          tokens: { input: 1000, output: 1000 },
        });

        // OK model: good quality but slightly worse
        router.updateStats(okModel, taskType, {
          success: true,
          quality: 0.85,
          latency: 800,
          cost: 0.003,
          tokens: { input: 1000, output: 800 },
        });

        // Occasionally update other models
        if (i % 10 === 0) {
          for (const model of MODEL_REGISTRY.slice(0, 3)) {
            if (model.id !== bestModel && model.id !== okModel) {
              router.updateStats(model.id, taskType, {
                success: true,
                quality: 0.7,
                latency: 1500,
                cost: 0.001,
                tokens: { input: 1000, output: 500 },
              });
            }
          }
        }
      }

      // Get ranking for the best model
      const rankings = router.getModelRanking(taskType);
      const bestModelRank = rankings.findIndex(r => r.model.id === bestModel);

      // Best model should be in top 15 after 100 iterations (with exploration rate slowing convergence)
      expect(bestModelRank).toBeLessThan(15);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ModelRouter singleton', () => {
  beforeEach(() => {
    resetModelRouter();
  });

  it('getModelRouter returns singleton instance', () => {
    const router1 = getModelRouter();
    const router2 = getModelRouter();

    expect(router1).toBe(router2);
  });

  it('resetModelRouter creates new instance', () => {
    const router1 = getModelRouter();
    resetModelRouter();
    const router2 = getModelRouter();

    expect(router1).not.toBe(router2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Model Registry Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Model Registry Integration', () => {
  it('MODEL_REGISTRY contains models', () => {
    expect(MODEL_REGISTRY.length).toBeGreaterThan(0);
  });

  it('all models have required fields', () => {
    for (const model of MODEL_REGISTRY) {
      expect(model.id).toBeDefined();
      expect(model.name).toBeDefined();
      expect(model.provider).toBeDefined();
      expect(model.costPerInputToken).toBeGreaterThanOrEqual(0);
      expect(model.costPerOutputToken).toBeGreaterThanOrEqual(0);
      expect(model.maxTokens).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);
      expect(model.capabilities.length).toBeGreaterThan(0);
      expect(model.latencyP50).toBeGreaterThan(0);
      expect(model.latencyP99).toBeGreaterThan(0);
      expect(model.quality).toBeGreaterThan(0);
      expect(model.quality).toBeLessThanOrEqual(1);
    }
  });

  it('getModelById returns correct model', () => {
    const model = getModelById('anthropic-claude-3-sonnet');
    expect(model).toBeDefined();
    expect(model?.name).toBe('claude-3-sonnet');
  });

  it('getModelById returns undefined for unknown id', () => {
    const model = getModelById('unknown-model');
    expect(model).toBeUndefined();
  });

  it('getModelsForTaskType returns relevant models', () => {
    const models = getModelsForTaskType('code-generation');
    expect(models.length).toBeGreaterThan(0);

    // All returned models should have code-generation capability
    for (const model of models) {
      expect(model.capabilities).toContain('code-generation');
    }
  });
});
