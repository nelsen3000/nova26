// Model Registry Tests
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-01)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExtendedModelRegistry,
  PREPOPULATED_MODELS,
  resetExtendedModelRegistry,
  getExtendedModelRegistry,
} from './model-registry';

describe('ExtendedModelRegistry', () => {
  let registry: ExtendedModelRegistry;

  beforeEach(() => {
    resetExtendedModelRegistry();
    registry = new ExtendedModelRegistry();
  });

  describe('Pre-populated Models', () => {
    it('should load all pre-populated models', () => {
      expect(registry.count()).toBe(PREPOPULATED_MODELS.length);
    });

    it('should have Ollama models', () => {
      const ollama = registry.list({ provider: 'ollama' });
      expect(ollama.length).toBeGreaterThanOrEqual(2);
      expect(ollama.some(m => m.id === 'ollama-qwen2.5:7b')).toBe(true);
    });

    it('should have Anthropic models', () => {
      const anthropic = registry.list({ provider: 'anthropic' });
      expect(anthropic.length).toBeGreaterThanOrEqual(3);
      expect(anthropic.some(m => m.id === 'anthropic-claude-3-opus')).toBe(true);
    });

    it('should have OpenRouter models', () => {
      const openrouter = registry.list({ provider: 'openrouter' });
      expect(openrouter.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Model Registration', () => {
    it('should register a new model', () => {
      const model = {
        id: 'test-model',
        name: 'Test Model',
        provider: 'ollama' as const,
        family: 'test',
        version: '1.0',
        capabilities: [{ name: 'chat', score: 0.8 }],
        pricing: { inputPerMToken: 0, outputPerMToken: 0 },
        performance: {
          latencyP50: 500,
          latencyP95: 1000,
          throughput: 50,
          contextWindow: 10000,
          maxOutput: 4096,
        },
      };

      const registered = registry.register(model);
      expect(registered.id).toBe('test-model');
      expect(registry.get('test-model')).toBeDefined();
    });

    it('should validate model schema', () => {
      const invalid = {
        id: 'invalid',
        // Missing required fields
      };

      expect(() => registry.register(invalid as any)).toThrow();
    });

    it('should update existing model', () => {
      const model = registry.get('ollama-qwen2.5:7b')!;
      const updated = registry.update('ollama-qwen2.5:7b', {
        status: 'deprecated',
      });

      expect(updated.status).toBe('deprecated');
      expect(registry.get('ollama-qwen2.5:7b')!.status).toBe('deprecated');
    });

    it('should throw for non-existent model update', () => {
      expect(() => registry.update('non-existent', { name: 'Test' })).toThrow(
        'Model not found'
      );
    });

    it('should deprecate a model', () => {
      registry.deprecate('ollama-qwen2.5:7b');
      const model = registry.get('ollama-qwen2.5:7b');
      expect(model!.status).toBe('deprecated');
    });
  });

  describe('Model Queries', () => {
    it('should get model by id', () => {
      const model = registry.get('anthropic-claude-3-opus');
      expect(model).toBeDefined();
      expect(model!.name).toBe('Claude 3 Opus');
    });

    it('should return undefined for unknown id', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should get or throw', () => {
      expect(registry.getOrThrow('anthropic-claude-3-opus')).toBeDefined();
      expect(() => registry.getOrThrow('unknown')).toThrow();
    });

    it('should list all models', () => {
      const models = registry.list();
      expect(models.length).toBe(PREPOPULATED_MODELS.length);
    });

    it('should filter by provider', () => {
      const anthropic = registry.list({ provider: 'anthropic' });
      expect(anthropic.every(m => m.provider === 'anthropic')).toBe(true);
    });

    it('should filter by family', () => {
      const qwen = registry.list({ family: 'qwen' });
      expect(qwen.every(m => m.family === 'qwen')).toBe(true);
    });

    it('should filter by status', () => {
      const active = registry.list({ status: 'active' });
      expect(active.every(m => m.status === 'active')).toBe(true);
    });

    it('should filter by minimum capability', () => {
      const capable = registry.list({
        minCapability: { name: 'code-generation', score: 0.85 },
      });
      expect(capable.every(m =>
        m.capabilities.some(c =>
          c.name === 'code-generation' && c.score >= 0.85
        )
      )).toBe(true);
    });

    it('should get all providers', () => {
      const providers = registry.getProviders();
      expect(providers).toContain('ollama');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openrouter');
    });

    it('should get all families', () => {
      const families = registry.getFamilies();
      expect(families.length).toBeGreaterThan(0);
    });

    it('should get all capabilities', () => {
      const caps = registry.getCapabilities();
      expect(caps).toContain('chat');
      expect(caps).toContain('code-generation');
      expect(caps).toContain('reasoning');
    });

    it('should get capability score', () => {
      const score = registry.getCapabilityScore(
        'anthropic-claude-3-opus',
        'code-generation'
      );
      expect(score).toBe(0.92);
    });

    it('should return 0 for missing capability', () => {
      const score = registry.getCapabilityScore(
        'anthropic-claude-3-opus',
        'unknown-capability'
      );
      expect(score).toBe(0);
    });

    it('should return 0 for missing model', () => {
      const score = registry.getCapabilityScore('unknown', 'chat');
      expect(score).toBe(0);
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const a = getExtendedModelRegistry();
      const b = getExtendedModelRegistry();
      expect(a).toBe(b);
    });

    it('should reset instance', () => {
      const a = getExtendedModelRegistry();
      resetExtendedModelRegistry();
      const b = getExtendedModelRegistry();
      expect(a).not.toBe(b);
    });
  });
});
