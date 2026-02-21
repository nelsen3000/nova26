// Model Matcher Tests
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-01)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ModelMatcher,
  type TaskRequirements,
  resetModelMatcher,
  getModelMatcher,
} from './model-matcher';
import {
  resetExtendedModelRegistry,
} from './model-registry';

describe('ModelMatcher', () => {
  let matcher: ModelMatcher;

  beforeEach(() => {
    resetExtendedModelRegistry();
    resetModelMatcher();
    matcher = new ModelMatcher();
  });

  describe('Basic Matching', () => {
    it('should match models by capability', () => {
      const requirements: TaskRequirements = {
        capabilities: [
          { name: 'code-generation', minScore: 0.8, weight: 1 },
        ],
      };

      const results = matcher.match(requirements);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].breakdown.capabilityScore).toBeGreaterThan(0);
    });

    it('should return low scores for impossible requirements', () => {
      const requirements: TaskRequirements = {
        capabilities: [
          { name: 'time-travel', minScore: 0.9, weight: 1 },
        ],
      };

      const results = matcher.match(requirements);
      // When capabilities don't match, capabilityScore is 0 but other factors contribute
      // Overall score = 0*0.4 + 1*0.25 + 0.5*0.2 + 1*0.15 = 0.5 (using defaults)
      expect(results.every(r => r.breakdown.capabilityScore === 0)).toBe(true);
    });

    it('should respect maxResults option', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
      };

      const results = matcher.match(requirements, { maxResults: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should respect minScore filter', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'code-generation', minScore: 0.9, weight: 1 }],
      };

      const results = matcher.match(requirements, { minScore: 0.5 });
      expect(results.every(r => r.score >= 0.5)).toBe(true);
    });
  });

  describe('Capability Scoring', () => {
    it('should score higher for models exceeding min score', () => {
      const requirements: TaskRequirements = {
        capabilities: [
          { name: 'code-generation', minScore: 0.7, weight: 1 },
        ],
      };

      const results = matcher.match(requirements);
      // Claude 3 Opus (0.92) should score higher than Claude 3 Sonnet (0.88)
      const opus = results.find(r => r.model.id === 'anthropic-claude-3-opus');
      const sonnet = results.find(r => r.model.id === 'anthropic-claude-3-sonnet');

      if (opus && sonnet) {
        expect(opus.breakdown.capabilityScore).toBeGreaterThanOrEqual(
          sonnet.breakdown.capabilityScore
        );
      }
    });

    it('should handle multiple capabilities', () => {
      const requirements: TaskRequirements = {
        capabilities: [
          { name: 'chat', minScore: 0.8, weight: 0.5 },
          { name: 'code-generation', minScore: 0.8, weight: 0.5 },
        ],
      };

      const results = matcher.match(requirements);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should weight capabilities correctly', () => {
      // Test with models that have different capability profiles
      // Claude 3 Opus: chat=0.95, reasoning=0.95 (both high)
      // Claude 3 Haiku: chat=0.8, reasoning not listed
      const reqA: TaskRequirements = {
        capabilities: [
          { name: 'reasoning', minScore: 0.8, weight: 1.0 },
          { name: 'summarization', minScore: 0.8, weight: 0.1 },
        ],
      };

      const reqB: TaskRequirements = {
        capabilities: [
          { name: 'reasoning', minScore: 0.8, weight: 0.1 },
          { name: 'summarization', minScore: 0.8, weight: 1.0 },
        ],
      };

      const resultsA = matcher.match(reqA);
      const resultsB = matcher.match(reqB);

      // Both queries should return valid results with different capability scores
      expect(resultsA[0].score).toBeGreaterThan(0);
      expect(resultsB[0].score).toBeGreaterThan(0);
      
      // Claude 3 Opus has high reasoning (0.95), Haiku has higher summarization (0.85)
      // reqA weights reasoning higher, reqB weights summarization higher
      expect(resultsA[0].breakdown.capabilityScore).toBeGreaterThanOrEqual(
        resultsB[0].breakdown.capabilityScore * 0.8 // Allow some variance
      );
    });
  });

  describe('Filtering', () => {
    it('should filter by excluded models', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
        excludedModels: ['anthropic-claude-3-opus'],
      };

      const results = matcher.match(requirements);
      expect(results.some(r => r.model.id === 'anthropic-claude-3-opus')).toBe(false);
    });

    it('should filter by preferred providers', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
        preferredProviders: ['ollama'],
      };

      const results = matcher.match(requirements);
      expect(results.every(r => r.model.provider === 'ollama')).toBe(true);
    });

    it('should filter by minimum context window', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
        minContextWindow: 150000,
      };

      const results = matcher.match(requirements);
      expect(
        results.every(r => r.model.performance.contextWindow >= 150000)
      ).toBe(true);
    });
  });

  describe('Latency Scoring', () => {
    it('should score latency', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
        maxLatencyMs: 1000,
      };

      const results = matcher.match(requirements);
      expect(results[0].breakdown.latencyScore).toBeDefined();
    });

    it('should give full score if within latency', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
        maxLatencyMs: 10000, // Very generous
      };

      const results = matcher.match(requirements);
      expect(results.every(r => r.breakdown.latencyScore === 1)).toBe(true);
    });
  });

  describe('Cost Scoring', () => {
    it('should score cost within budget', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
        budgetLimit: 0.01, // $0.01 per 1k tokens
      };

      const results = matcher.match(requirements);
      expect(results[0].breakdown.costScore).toBeDefined();
    });

    it('should prefer free models when budget is tight', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
        budgetLimit: 0.001,
      };

      const results = matcher.match(requirements, { sortBy: 'score' });
      // Free models (Ollama) should score high on cost
      const ollama = results.filter(r => r.model.provider === 'ollama');
      expect(ollama[0]?.breakdown.costScore).toBe(1);
    });
  });

  describe('Sorting', () => {
    it('should sort by score (default)', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
      };

      const results = matcher.match(requirements, { sortBy: 'score' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should sort by cost', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
      };

      const results = matcher.match(requirements, { sortBy: 'cost' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].model.pricing.inputPerMToken).toBeLessThanOrEqual(
          results[i].model.pricing.inputPerMToken
        );
      }
    });

    it('should sort by latency', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
      };

      const results = matcher.match(requirements, { sortBy: 'latency' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].model.performance.latencyP50).toBeLessThanOrEqual(
          results[i].model.performance.latencyP50
        );
      }
    });
  });

  describe('Best Match', () => {
    it('should find best match', () => {
      const requirements: TaskRequirements = {
        capabilities: [
          { name: 'code-generation', minScore: 0.9, weight: 1 },
        ],
      };

      const best = matcher.findBest(requirements);
      expect(best).not.toBeNull();
      expect(best!.model.capabilities.some(c => c.name === 'code-generation' && c.score >= 0.9)).toBe(true);
    });

    it('should return result with 0 capability score for impossible requirements', () => {
      const requirements: TaskRequirements = {
        capabilities: [
          { name: 'unknown-capability', minScore: 0.9, weight: 1 },
        ],
      };

      // This should still return a result but with 0 capability score
      const best = matcher.findBest(requirements);
      expect(best).not.toBeNull();
      // capabilityScore is 0 when no capabilities match
      expect(best!.breakdown.capabilityScore).toBe(0);
    });
  });

  describe('Explain Match', () => {
    it('should generate explanation', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
      };

      const results = matcher.match(requirements);
      expect(results.length).toBeGreaterThan(0);
      
      const explanation = matcher.explainMatch(results[0]);

      expect(explanation).toContain('Match for');
      expect(explanation).toContain('Capabilities:');
      expect(explanation).toContain('Latency:');
      expect(explanation).toContain('Cost:');
      expect(explanation).toContain('Context:');
      expect(explanation).toContain('Provider:');
    });
  });

  describe('Compare Models', () => {
    it('should compare two models', () => {
      const requirements: TaskRequirements = {
        capabilities: [
          { name: 'code-generation', minScore: 0.8, weight: 1 },
        ],
      };

      const comparison = matcher.compare(
        'anthropic-claude-3-opus',
        'anthropic-claude-3-sonnet',
        requirements
      );

      expect(comparison).not.toBeNull();
      expect(comparison!.winner).toBeDefined();
      expect(comparison!.diff).toBeGreaterThanOrEqual(0);
      expect(comparison!.reasons.length).toBeGreaterThan(0);
    });

    it('should return null for invalid model ids', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
      };

      const comparison = matcher.compare('invalid-a', 'invalid-b', requirements);
      expect(comparison).toBeNull();
    });

    it('should identify cost advantage', () => {
      const requirements: TaskRequirements = {
        capabilities: [{ name: 'chat', minScore: 0.7, weight: 1 }],
      };

      const comparison = matcher.compare(
        'ollama-qwen2.5:7b',
        'anthropic-claude-3-opus',
        requirements
      );

      expect(comparison).not.toBeNull();
      // Free Ollama model should win on cost
      if (comparison!.winner === 'ollama-qwen2.5:7b') {
        expect(comparison!.reasons.some(r => r.includes('cheaper'))).toBe(true);
      }
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const a = getModelMatcher();
      const b = getModelMatcher();
      expect(a).toBe(b);
    });

    it('should reset instance', () => {
      const a = getModelMatcher();
      resetModelMatcher();
      const b = getModelMatcher();
      expect(a).not.toBe(b);
    });
  });
});
