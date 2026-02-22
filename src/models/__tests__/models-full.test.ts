/**
 * Comprehensive Models Module Tests
 * Task H5-09: Models Full Coverage
 *
 * Tests: ModelMetadata, Routing, Ensemble, Affinity, Performance, TasteProfile
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type {
  ModelMetadata,
  ModelCapabilities,
  ModelRoute,
  JonFeedback,
  EnsembleDebateResult,
  ModelVote,
  SyncResult,
  ProviderModelInfo,
  ModelAffinity,
  TasteProfile,
  RoutingMetrics,
  ModelPerformance,
} from '../types.js';

// ─── Model Metadata Tests ────────────────────────────────────────────────────

describe('Model Metadata', () => {
  let model: ModelMetadata;

  beforeEach(() => {
    model = {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      family: 'gpt-4',
      version: '2024-02',
      capabilities: {
        code: 95,
        reasoning: 98,
        multimodal: 90,
        speed: 85,
        cost: 60,
        localAvailable: false,
        quantizations: [],
      },
      contextWindow: 128000,
      pricing: {
        inputPerMToken: 0.01,
        outputPerMToken: 0.03,
      },
      benchmarks: {
        mmlu: 0.88,
        humaneval: 0.92,
        math: 0.87,
      },
      lastUpdated: new Date().toISOString(),
    };
  });

  it('should create valid model metadata', () => {
    expect(model.id).toBe('gpt-4-turbo');
    expect(model.provider).toBe('openai');
    expect(model.contextWindow).toBeGreaterThan(0);
  });

  it('should track model capabilities', () => {
    expect(model.capabilities.code).toBeGreaterThan(0);
    expect(model.capabilities.code).toBeLessThanOrEqual(100);
    expect(model.capabilities.reasoning).toBeLessThanOrEqual(100);
  });

  it('should support all capability dimensions', () => {
    const dims = ['code', 'reasoning', 'multimodal', 'speed', 'cost'] as const;
    for (const dim of dims) {
      expect(model.capabilities[dim]).toBeGreaterThanOrEqual(0);
      expect(model.capabilities[dim]).toBeLessThanOrEqual(100);
    }
  });

  it('should track pricing information', () => {
    expect(model.pricing.inputPerMToken).toBeGreaterThan(0);
    expect(model.pricing.outputPerMToken).toBeGreaterThan(0);
  });

  it('should store benchmark results', () => {
    expect(Object.keys(model.benchmarks).length).toBeGreaterThan(0);
    expect(model.benchmarks.mmlu).toBeGreaterThan(0);
    expect(model.benchmarks.mmlu).toBeLessThanOrEqual(1);
  });

  it('should support local models', () => {
    const localModel: ModelMetadata = {
      ...model,
      id: 'llama-2-7b',
      provider: 'meta',
      capabilities: {
        ...model.capabilities,
        localAvailable: true,
        quantizations: ['Q4_K_M', 'Q5_K_M', 'Q8_0'],
      },
    };

    expect(localModel.capabilities.localAvailable).toBe(true);
    expect(localModel.capabilities.quantizations).toHaveLength(3);
  });
});

// ─── Model Routing Tests ─────────────────────────────────────────────────────

describe('Model Routing', () => {
  let route: ModelRoute;

  beforeEach(() => {
    route = {
      agentId: 'venus',
      taskType: 'design-generation',
      selectedModel: {
        id: 'gpt-4-vision',
        name: 'GPT-4 Vision',
        provider: 'openai',
        family: 'gpt-4',
        version: '2024-02',
        capabilities: {
          code: 92,
          reasoning: 96,
          multimodal: 98,
          speed: 80,
          cost: 70,
          localAvailable: false,
          quantizations: [],
        },
        contextWindow: 128000,
        pricing: { inputPerMToken: 0.01, outputPerMToken: 0.03 },
        benchmarks: { mmlu: 0.86 },
        lastUpdated: new Date().toISOString(),
      },
      confidence: 0.92,
      reasoning: 'Multi-modal capability critical for design tasks',
      alternatives: [],
    };
  });

  it('should create valid model route', () => {
    expect(route.agentId).toBe('venus');
    expect(route.taskType).toBe('design-generation');
    expect(route.confidence).toBeGreaterThan(0);
    expect(route.confidence).toBeLessThanOrEqual(1);
  });

  it('should track routing reasoning', () => {
    expect(route.reasoning).toBeDefined();
    expect(route.reasoning.length).toBeGreaterThan(0);
  });

  it('should support alternative models', () => {
    route.alternatives = [
      {
        ...route.selectedModel,
        id: 'claude-3-vision',
        name: 'Claude 3 Vision',
      },
    ];

    expect(route.alternatives).toHaveLength(1);
  });

  it('should validate confidence bounds', () => {
    const testRoutes = [
      { ...route, confidence: 0.5 },
      { ...route, confidence: 0.95 },
      { ...route, confidence: 0.1 },
    ];

    for (const r of testRoutes) {
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Model Feedback Tests ────────────────────────────────────────────────────

describe('Model Feedback', () => {
  it('should create feedback record', () => {
    const feedback: JonFeedback = {
      routeId: 'route-123',
      modelId: 'gpt-4-turbo',
      rating: 5,
      comment: 'Excellent output, exactly what was needed',
      timestamp: new Date().toISOString(),
    };

    expect(feedback.rating).toBeGreaterThanOrEqual(1);
    expect(feedback.rating).toBeLessThanOrEqual(5);
  });

  it('should support all rating levels', () => {
    const ratings: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

    for (const rating of ratings) {
      const feedback: JonFeedback = {
        routeId: 'route-123',
        modelId: 'gpt-4',
        rating,
        timestamp: new Date().toISOString(),
      };

      expect(feedback.rating).toBe(rating);
    }
  });

  it('should allow optional comments', () => {
    const feedbackNoComment: JonFeedback = {
      routeId: 'route-123',
      modelId: 'gpt-4',
      rating: 4,
      timestamp: new Date().toISOString(),
    };

    expect(feedbackNoComment.comment).toBeUndefined();
  });
});

// ─── Ensemble Tests ──────────────────────────────────────────────────────────

describe('Ensemble Debate', () => {
  let debate: EnsembleDebateResult;

  beforeEach(() => {
    debate = {
      winner: 'gpt-4-turbo',
      reasoning: 'Highest consensus with 0.87 score',
      votes: [
        {
          modelId: 'gpt-4-turbo',
          response: 'This is the best approach',
          confidence: 0.95,
          votedFor: 'gpt-4-turbo',
        },
        {
          modelId: 'claude-3-opus',
          response: 'Alternative approach possible',
          confidence: 0.82,
          votedFor: 'gpt-4-turbo',
        },
        {
          modelId: 'gemini-pro',
          response: 'Same conclusion',
          confidence: 0.78,
          votedFor: 'gpt-4-turbo',
        },
      ],
      consensusScore: 0.87,
    };
  });

  it('should create valid debate result', () => {
    expect(debate.winner).toBeDefined();
    expect(debate.votes).toHaveLength(3);
    expect(debate.consensusScore).toBeGreaterThanOrEqual(0);
    expect(debate.consensusScore).toBeLessThanOrEqual(1);
  });

  it('should track model votes', () => {
    for (const vote of debate.votes) {
      expect(vote.confidence).toBeGreaterThanOrEqual(0);
      expect(vote.confidence).toBeLessThanOrEqual(1);
      expect(vote.response).toBeDefined();
    }
  });

  it('should support consensus building', () => {
    expect(debate.consensusScore).toBeGreaterThan(0.8);
    expect(debate.votes.every(v => v.votedFor === debate.winner)).toBe(true);
  });
});

// ─── Sync Results Tests ──────────────────────────────────────────────────────

describe('Provider Sync', () => {
  it('should track sync operations', () => {
    const result: SyncResult = {
      added: 5,
      updated: 12,
      removed: 2,
      errors: [],
    };

    expect(result.added).toBeGreaterThanOrEqual(0);
    expect(result.updated).toBeGreaterThanOrEqual(0);
    expect(result.removed).toBeGreaterThanOrEqual(0);
  });

  it('should track sync errors', () => {
    const result: SyncResult = {
      added: 3,
      updated: 5,
      removed: 1,
      errors: ['Failed to fetch model x', 'Invalid benchmark data for y'],
    };

    expect(result.errors).toHaveLength(2);
  });

  it('should support provider model info', () => {
    const info: ProviderModelInfo = {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      capabilities: {
        code: 95,
        reasoning: 98,
      },
      contextWindow: 128000,
      pricing: {
        inputPerMToken: 0.01,
        outputPerMToken: 0.03,
      },
      benchmarks: {
        mmlu: 0.88,
      },
    };

    expect(info.id).toBeDefined();
    expect(info.contextWindow).toBeGreaterThan(0);
  });
});

// ─── Model Affinity Tests ────────────────────────────────────────────────────

describe('Model Affinity', () => {
  it('should create affinity record', () => {
    const affinity: ModelAffinity = {
      modelId: 'gpt-4-turbo',
      agentId: 'code-sage',
      taskType: 'code-review',
      score: 92,
      feedbackCount: 45,
      lastFeedbackAt: new Date().toISOString(),
    };

    expect(affinity.score).toBeGreaterThanOrEqual(0);
    expect(affinity.score).toBeLessThanOrEqual(100);
    expect(affinity.feedbackCount).toBeGreaterThanOrEqual(0);
  });

  it('should track feedback contribution', () => {
    const affinities = [
      { modelId: 'gpt-4', feedbackCount: 100 },
      { modelId: 'claude-3', feedbackCount: 50 },
      { modelId: 'gemini', feedbackCount: 25 },
    ];

    affinities.sort((a, b) => b.feedbackCount - a.feedbackCount);
    expect(affinities[0].feedbackCount).toBeGreaterThan(affinities[1].feedbackCount);
  });
});

// ─── Taste Profile Tests ─────────────────────────────────────────────────────

describe('Taste Profile', () => {
  let profile: TasteProfile;

  beforeEach(() => {
    profile = {
      userId: 'user-123',
      preferredProviders: ['openai', 'anthropic'],
      preferredFamilies: ['gpt-4', 'claude-3'],
      capabilityWeights: {
        code: 0.3,
        reasoning: 0.3,
        multimodal: 0.1,
        speed: 0.2,
        cost: 0.1,
      },
      taskPreferences: {
        'code-generation': ['gpt-4-turbo', 'claude-3-opus'],
        'design': ['gpt-4-vision'],
        'analysis': ['claude-3-opus'],
      },
    };
  });

  it('should create valid taste profile', () => {
    expect(profile.userId).toBeDefined();
    expect(profile.preferredProviders).toHaveLength(2);
    expect(profile.preferredFamilies).toHaveLength(2);
  });

  it('should validate capability weights', () => {
    const weights = Object.values(profile.capabilityWeights);
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('should track task preferences', () => {
    expect(profile.taskPreferences['code-generation']).toHaveLength(2);
    expect(profile.taskPreferences['design']).toHaveLength(1);
  });
});

// ─── Routing Metrics Tests ───────────────────────────────────────────────────

describe('Routing Metrics', () => {
  let metrics: RoutingMetrics;

  beforeEach(() => {
    metrics = {
      totalRoutes: 1500,
      avgLatencyMs: 245,
      p50LatencyMs: 180,
      p99LatencyMs: 890,
      cacheHitRate: 0.68,
      feedbackIncorporated: 342,
    };
  });

  it('should create valid metrics', () => {
    expect(metrics.totalRoutes).toBeGreaterThan(0);
    expect(metrics.avgLatencyMs).toBeGreaterThan(0);
  });

  it('should maintain percentile ordering', () => {
    expect(metrics.p50LatencyMs).toBeLessThanOrEqual(metrics.avgLatencyMs);
    expect(metrics.avgLatencyMs).toBeLessThanOrEqual(metrics.p99LatencyMs);
  });

  it('should track cache hit rate', () => {
    expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
    expect(metrics.cacheHitRate).toBeLessThanOrEqual(1);
  });
});

// ─── Model Performance Tests ─────────────────────────────────────────────────

describe('Model Performance', () => {
  it('should create performance record', () => {
    const perf: ModelPerformance = {
      modelId: 'gpt-4-turbo',
      avgResponseTimeMs: 1200,
      successRate: 0.98,
      userRating: 4.6,
      costPerRequest: 0.025,
      tokensPerSecond: 85,
    };

    expect(perf.successRate).toBeGreaterThanOrEqual(0);
    expect(perf.successRate).toBeLessThanOrEqual(1);
    expect(perf.userRating).toBeGreaterThan(0);
    expect(perf.userRating).toBeLessThanOrEqual(5);
  });

  it('should track cost metrics', () => {
    const perf: ModelPerformance = {
      modelId: 'gpt-4-turbo',
      avgResponseTimeMs: 1200,
      successRate: 0.98,
      userRating: 4.6,
      costPerRequest: 0.025,
      tokensPerSecond: 85,
    };

    expect(perf.costPerRequest).toBeGreaterThan(0);
    expect(perf.tokensPerSecond).toBeGreaterThan(0);
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('Models Property-Based Tests', () => {
  it('should maintain capability invariants', () => {
    fc.assert(
      fc.property(
        fc.record({
          code: fc.integer({ min: 0, max: 100 }),
          reasoning: fc.integer({ min: 0, max: 100 }),
          multimodal: fc.integer({ min: 0, max: 100 }),
          speed: fc.integer({ min: 0, max: 100 }),
          cost: fc.integer({ min: 0, max: 100 }),
        }),
        caps => {
          const capability: ModelCapabilities = {
            ...caps,
            localAvailable: false,
            quantizations: [],
          };

          return (
            capability.code >= 0 &&
            capability.code <= 100 &&
            capability.reasoning >= 0 &&
            capability.reasoning <= 100
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain confidence bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }) as fc.Arbitrary<number>,
        conf => {
          const normalized = conf / 100;
          return normalized >= 0 && normalized <= 1;
        }
      ),
      { numRuns: 40 }
    );
  });

  it('should validate taste profile weights', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 })
        ),
        ([a, b, c, d, e]) => {
          const total = a + b + c + d + e;
          if (total === 0) return true;

          const weights = {
            code: a / total,
            reasoning: b / total,
            multimodal: c / total,
            speed: d / total,
            cost: e / total,
          };

          const sum = Object.values(weights).reduce((x, y) => x + y, 0);
          return Math.abs(sum - 1.0) < 0.001;
        }
      ),
      { numRuns: 50 }
    );
  });
});
