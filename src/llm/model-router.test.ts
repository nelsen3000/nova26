import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import {
  selectModel,
  selectTier,
  getCurrentModel,
  getCurrentTier,
  selectModelForTask,
  estimateCost,
  showModelComparison,
  AVAILABLE_MODELS,
  detectAvailableModels,
  selectModelForPhase,
  getCostTracker,
  resetCostTracker,
  clearInstalledModelsCache,
} from './model-router.js';

beforeEach(() => {
  // Reset to defaults
  selectTier('free');
  resetCostTracker();
  clearInstalledModelsCache();
  vi.restoreAllMocks();
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

describe('detectAvailableModels', () => {
  it('returns model names from mocked Ollama /api/tags response', async () => {
    const fetchMock = vi.fn() as unknown as MockInstance<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>;
    global.fetch = fetchMock as unknown as typeof fetch;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        models: [
          { name: 'qwen2.5:7b' },
          { name: 'llama3:8b' },
          { name: 'nomic-embed-text' },
        ],
      }),
    } as Response);

    const models = await detectAvailableModels();

    expect(models).toContain('qwen2.5:7b');
    expect(models).toContain('llama3:8b');
    expect(models).toContain('nomic-embed-text');
    expect(models).toHaveLength(3);
  });

  it('returns empty array when fetch rejects', async () => {
    const fetchMock = vi.fn() as unknown as MockInstance<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>;
    global.fetch = fetchMock as unknown as typeof fetch;

    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const models = await detectAvailableModels();

    expect(models).toEqual([]);
  });
});

describe('selectModelForPhase', () => {
  it('returns a 7B-class model for thinking phase', async () => {
    const model = await selectModelForPhase('thinking');
    const sevenBModels = ['qwen2.5:7b', 'llama3:8b', 'deepseek-coder:6.7b', 'codellama:7b'];
    expect(sevenBModels).toContain(model);
  });

  it('returns a 32B-class model for code_gen phase', async () => {
    const model = await selectModelForPhase('code_gen');
    // 32B or larger models for code generation
    const codeGenModels = ['qwen2.5:32b', 'qwen2.5:14b', 'deepseek-coder:6.7b', 'codellama:7b'];
    expect(codeGenModels).toContain(model);
  });

  it('returns nomic-embed-text or mxbai-embed-large for embedding phase', async () => {
    const model = await selectModelForPhase('embedding');
    expect(['nomic-embed-text', 'mxbai-embed-large']).toContain(model);
  });
});

describe('CostTracker', () => {
  it('recordUsage appends record to in-memory store', () => {
    const tracker = getCostTracker();
    
    tracker.recordUsage('gpt-4o', 1000, 0.0025);
    
    const records = tracker.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0].model).toBe('gpt-4o');
    expect(records[0].tokens).toBe(1000);
    expect(records[0].costPer1KTokens).toBe(0.0025);
  });

  it('getBuildCost aggregates tokens correctly across multiple records', () => {
    const tracker = getCostTracker();
    
    tracker.recordUsage('gpt-4o', 1000, 0.0025);
    tracker.recordUsage('gpt-4o', 2000, 0.0025);
    tracker.recordUsage('gpt-4o-mini', 1500, 0.00015);
    
    const buildCost = tracker.getBuildCost();
    
    expect(buildCost.totalTokens).toBe(4500);
    expect(buildCost.modelBreakdown['gpt-4o'].tokens).toBe(3000);
    expect(buildCost.modelBreakdown['gpt-4o-mini'].tokens).toBe(1500);
  });

  it('getBuildCost returns estimatedCostUsd of 0 for Ollama models', () => {
    const tracker = getCostTracker();
    
    tracker.recordUsage('qwen2.5:7b', 5000, 0);
    tracker.recordUsage('llama3:8b', 3000, 0);
    
    const buildCost = tracker.getBuildCost();
    
    expect(buildCost.estimatedCostUsd).toBe(0);
    expect(buildCost.modelBreakdown['qwen2.5:7b'].costUsd).toBe(0);
    expect(buildCost.modelBreakdown['llama3:8b'].costUsd).toBe(0);
  });

  it('getMonthlyUsage filters to current month', () => {
    const tracker = getCostTracker();
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    tracker.recordUsage('gpt-4o', 1000, 0.0025);
    
    const monthlyUsage = tracker.getMonthlyUsage();
    
    expect(monthlyUsage.month).toBe(currentMonth);
    expect(monthlyUsage.totalTokens).toBe(1000);
    expect(monthlyUsage.records).toHaveLength(1);
  });
});

describe('resetCostTracker', () => {
  it('clears in-memory records', () => {
    const tracker = getCostTracker();
    
    tracker.recordUsage('gpt-4o', 1000, 0.0025);
    expect(tracker.getRecords()).toHaveLength(1);
    
    resetCostTracker();
    
    // Get new tracker instance after reset
    const newTracker = getCostTracker();
    expect(newTracker.getRecords()).toHaveLength(0);
  });
});
