import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectModel,
  selectTier,
  getCurrentModel,
  getCurrentTier,
  selectModelForTask,
  estimateCost,
  showModelComparison,
  AVAILABLE_MODELS,
} from './model-router.js';

beforeEach(() => {
  // Reset to defaults
  selectTier('free');
});

describe('AVAILABLE_MODELS', () => {
  it('contains free tier models', () => {
    const free = AVAILABLE_MODELS.filter(m => m.tier === 'free');
    expect(free.length).toBeGreaterThanOrEqual(3);
    expect(free.every(m => m.costPer1KTokens === 0)).toBe(true);
    expect(free.every(m => m.provider === 'ollama')).toBe(true);
  });

  it('contains paid tier models', () => {
    const paid = AVAILABLE_MODELS.filter(m => m.tier === 'paid');
    expect(paid.length).toBeGreaterThanOrEqual(3);
    expect(paid.every(m => m.costPer1KTokens > 0)).toBe(true);
  });

  it('includes both openai and anthropic providers', () => {
    const providers = new Set(AVAILABLE_MODELS.map(m => m.provider));
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('anthropic')).toBe(true);
    expect(providers.has('ollama')).toBe(true);
  });
});

describe('selectModel', () => {
  it('selects an existing model by name', () => {
    const model = selectModel('gpt-4o');
    expect(model.name).toBe('gpt-4o');
    expect(getCurrentModel().name).toBe('gpt-4o');
  });

  it('throws for unknown model name', () => {
    expect(() => selectModel('nonexistent-model')).toThrow('not found');
  });
});

describe('selectTier', () => {
  it('sets tier to free with qwen2.5:7b as default', () => {
    selectTier('free');
    expect(getCurrentTier()).toBe('free');
    expect(getCurrentModel().name).toBe('qwen2.5:7b');
  });

  it('sets tier to paid with gpt-4o as default', () => {
    selectTier('paid');
    expect(getCurrentTier()).toBe('paid');
    expect(getCurrentModel().name).toBe('gpt-4o');
  });

  it('sets tier to hybrid', () => {
    selectTier('hybrid');
    expect(getCurrentTier()).toBe('hybrid');
  });
});

describe('selectModelForTask', () => {
  it('selects fast free model for simple tasks in free tier', () => {
    selectTier('free');
    const model = selectModelForTask('simple task', 'simple');
    expect(model.name).toBe('qwen2.5:7b');
    expect(model.tier).toBe('free');
  });

  it('selects medium free model for medium tasks in free tier', () => {
    selectTier('free');
    const model = selectModelForTask('medium task', 'medium');
    expect(model.name).toBe('qwen2.5:14b');
  });

  it('selects complex free model for complex tasks in free tier', () => {
    selectTier('free');
    const model = selectModelForTask('complex task', 'complex');
    expect(model.name).toBe('deepseek-coder:6.7b');
  });

  it('selects cheap paid model for simple tasks in paid tier', () => {
    selectTier('paid');
    const model = selectModelForTask('simple task', 'simple');
    expect(model.name).toBe('gpt-4o-mini');
  });

  it('selects mid paid model for medium tasks in paid tier', () => {
    selectTier('paid');
    const model = selectModelForTask('medium task', 'medium');
    expect(model.name).toBe('gpt-4o');
  });

  it('selects top paid model for complex tasks in paid tier', () => {
    selectTier('paid');
    const model = selectModelForTask('complex task', 'complex');
    expect(model.name).toBe('claude-3-opus');
  });

  it('uses free for simple tasks in hybrid mode', () => {
    selectTier('hybrid');
    const model = selectModelForTask('simple task', 'simple');
    expect(model.provider).toBe('ollama');
  });

  it('upgrades to paid for complex tasks in hybrid mode', () => {
    selectTier('hybrid');
    const model = selectModelForTask('complex task', 'complex');
    expect(model.name).toBe('gpt-4o');
  });
});

describe('estimateCost', () => {
  it('returns Free for free tier models', () => {
    selectTier('free');
    expect(estimateCost(1000)).toBe('Free (local model)');
  });

  it('returns cost estimate for paid models', () => {
    const cost = estimateCost(1000, 'gpt-4o');
    expect(cost).toMatch(/~\$\d+\.\d+/);
  });

  it('returns Free when model name not found', () => {
    expect(estimateCost(1000, 'nonexistent')).toBe('Free (local model)');
  });

  it('scales cost with token count', () => {
    const cost1k = estimateCost(1000, 'gpt-4o');
    const cost10k = estimateCost(10000, 'gpt-4o');
    // Parse the numbers for comparison
    const val1k = parseFloat(cost1k.replace('~$', ''));
    const val10k = parseFloat(cost10k.replace('~$', ''));
    expect(val10k).toBeCloseTo(val1k * 10);
  });
});

describe('showModelComparison', () => {
  it('runs without error', () => {
    expect(() => showModelComparison()).not.toThrow();
  });
});
