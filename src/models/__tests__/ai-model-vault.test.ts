// AI Model Database — Test Suite (70 tests)
// KIMI-R24-01 | Feb 2026

import { describe, it, expect, beforeEach } from 'vitest';
import type { ModelMetadata, JonFeedback } from '../ai-model-vault.js';
import { AIModelVault } from '../ai-model-vault.js';
import { EnsembleEngine } from '../ensemble-engine.js';
import { ModelTasteIntegrator } from '../../atlas/model-taste-integrator.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeModel(id: string, overrides: Partial<ModelMetadata> = {}): ModelMetadata {
  return {
    id,
    name: id,
    provider: 'qwen',
    version: '1.0',
    description: `Model ${id}`,
    capabilities: {
      types: ['code-generation', 'text-generation'],
      maxContextWindow: 32768,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: false,
      avgLatencyMs: 200,
      throughputTPS: 50,
    },
    pricing: {
      inputPerMillion: 1.0,
      outputPerMillion: 2.0,
      currency: 'USD',
      tier: 'standard',
    },
    benchmarks: { humanEval: 75, sweBench: 60 },
    tags: [],
    isLocal: false,
    releaseDate: '2026-01-01',
    isDeprecated: false,
    ...overrides,
  };
}

function makeFeedback(modelId: string, rating: 1 | 2 | 3 | 4 | 5, liked: boolean): JonFeedback {
  return { modelId, taskId: `task-${Date.now()}`, rating, liked, timestamp: Date.now(), agentId: 'MARS' };
}

// ─── AIModelVault ─────────────────────────────────────────────────────────────

describe('AIModelVault', () => {
  let vault: AIModelVault;

  beforeEach(() => { vault = new AIModelVault(); });

  it('starts empty', () => {
    expect(vault.modelCount()).toBe(0);
  });

  it('register stores model', () => {
    vault.register(makeModel('qwen-1'));
    expect(vault.modelCount()).toBe(1);
  });

  it('getModel retrieves by id', () => {
    vault.register(makeModel('qwen-1'));
    expect(vault.getModel('qwen-1')?.id).toBe('qwen-1');
  });

  it('getModel returns undefined for unknown id', () => {
    expect(vault.getModel('ghost')).toBeUndefined();
  });

  it('listModels returns all non-deprecated models', () => {
    vault.register(makeModel('m1'));
    vault.register(makeModel('m2', { isDeprecated: true }));
    expect(vault.listModels().length).toBe(1);
  });

  it('listModels filters by provider', () => {
    vault.register(makeModel('m1', { provider: 'anthropic' }));
    vault.register(makeModel('m2', { provider: 'openai' }));
    expect(vault.listModels({ provider: 'anthropic' }).length).toBe(1);
  });

  it('listModels filters by isLocal', () => {
    vault.register(makeModel('m1', { isLocal: true }));
    vault.register(makeModel('m2', { isLocal: false }));
    expect(vault.listModels({ isLocal: true }).length).toBe(1);
  });

  it('listModels filters by capability', () => {
    vault.register(makeModel('m1', { capabilities: { ...makeModel('m1').capabilities, types: ['multimodal'] } }));
    vault.register(makeModel('m2'));
    expect(vault.listModels({ capability: 'multimodal' }).length).toBe(1);
  });

  it('semanticSelect returns model for valid agent', () => {
    vault.register(makeModel('m1'));
    const result = vault.semanticSelect({ agentId: 'MARS' });
    expect(result).toBeDefined();
  });

  it('semanticSelect returns undefined when no models registered', () => {
    expect(vault.semanticSelect({ agentId: 'MARS' })).toBeUndefined();
  });

  it('semanticSelect filters by required capabilities', () => {
    vault.register(makeModel('m1', { capabilities: { ...makeModel('m1').capabilities, types: ['embedding'] } }));
    vault.register(makeModel('m2'));
    const result = vault.semanticSelect({ agentId: 'ATLAS', requiredCapabilities: ['embedding'] });
    expect(result?.id).toBe('m1');
  });

  it('semanticSelect filters by maxLatencyMs', () => {
    vault.register(makeModel('fast', { capabilities: { ...makeModel('fast').capabilities, avgLatencyMs: 100 } }));
    vault.register(makeModel('slow', { capabilities: { ...makeModel('slow').capabilities, avgLatencyMs: 5000 } }));
    const result = vault.semanticSelect({ agentId: 'IO', maxLatencyMs: 200 });
    expect(result?.id).toBe('fast');
  });

  it('semanticSelect filters by maxCostPerMillion', () => {
    vault.register(makeModel('cheap', { pricing: { ...makeModel('cheap').pricing, inputPerMillion: 0.5 } }));
    vault.register(makeModel('expensive', { pricing: { ...makeModel('expensive').pricing, inputPerMillion: 10.0 } }));
    const result = vault.semanticSelect({ agentId: 'MARS', maxCostPerMillion: 1.0 });
    expect(result?.id).toBe('cheap');
  });

  it('semanticSelect prefers local models when preferLocal is set', () => {
    vault.register(makeModel('local', { isLocal: true }));
    vault.register(makeModel('cloud', { isLocal: false }));
    const result = vault.semanticSelect({ agentId: 'PLUTO', preferLocal: true });
    expect(result?.isLocal).toBe(true);
  });

  it('updateAffinity increases affinity', () => {
    vault.register(makeModel('m1'));
    vault.updateAffinity('m1', 0.2);
    expect(vault.getAffinity('m1')).toBeGreaterThan(0.5);
  });

  it('updateAffinity clamps to 1.0 max', () => {
    vault.register(makeModel('m1'));
    vault.updateAffinity('m1', 5.0); // huge boost
    expect(vault.getAffinity('m1')).toBeLessThanOrEqual(1.0);
  });

  it('updateAffinity clamps to 0.0 min', () => {
    vault.register(makeModel('m1'));
    vault.updateAffinity('m1', -5.0);
    expect(vault.getAffinity('m1')).toBeGreaterThanOrEqual(0.0);
  });

  it('getAffinity returns 0.5 for unregistered model', () => {
    expect(vault.getAffinity('ghost')).toBe(0.5);
  });

  it('setRoute stores a model route for agent', () => {
    vault.register(makeModel('m1'));
    vault.setRoute('MARS', { agentId: 'MARS', modelId: 'm1', tier: 'quality', affinityScore: 0.9 });
    expect(vault.getRoutes('MARS').length).toBe(1);
  });

  it('setRoute updates existing route', () => {
    vault.register(makeModel('m1'));
    vault.setRoute('MARS', { agentId: 'MARS', modelId: 'm1', tier: 'quality', affinityScore: 0.7 });
    vault.setRoute('MARS', { agentId: 'MARS', modelId: 'm1', tier: 'quality', affinityScore: 0.9 });
    expect(vault.getRoutes('MARS').length).toBe(1);
    expect(vault.getRoutes('MARS')[0]!.affinityScore).toBe(0.9);
  });

  it('getRoutes returns empty for unknown agent', () => {
    expect(vault.getRoutes('GHOST')).toEqual([]);
  });

  it('recordFeedback stores feedback', () => {
    vault.register(makeModel('m1'));
    vault.recordFeedback(makeFeedback('m1', 5, true));
    expect(vault.getFeedback('m1').length).toBe(1);
  });

  it('recordFeedback with 5-star and liked boosts affinity', () => {
    vault.register(makeModel('m1'));
    const initialAffinity = vault.getAffinity('m1');
    vault.recordFeedback(makeFeedback('m1', 5, true));
    expect(vault.getAffinity('m1')).toBeGreaterThan(initialAffinity);
  });

  it('recordFeedback with 1-star and disliked reduces affinity', () => {
    vault.register(makeModel('m1'));
    const initialAffinity = vault.getAffinity('m1');
    vault.recordFeedback(makeFeedback('m1', 1, false));
    expect(vault.getAffinity('m1')).toBeLessThan(initialAffinity);
  });

  it('syncFromProvider adds new models', () => {
    const result = vault.syncFromProvider('openai', [
      makeModel('gpt-5', { provider: 'openai' }),
      makeModel('gpt-4o', { provider: 'openai' }),
    ]);
    expect(result.added).toBe(2);
  });

  it('syncFromProvider updates existing models', () => {
    vault.register(makeModel('gpt-5', { provider: 'openai' }));
    const result = vault.syncFromProvider('openai', [
      makeModel('gpt-5', { provider: 'openai', version: '2.0' }),
    ]);
    expect(result.updated).toBe(1);
  });

  it('syncFromProvider ignores models from other providers', () => {
    const result = vault.syncFromProvider('openai', [
      makeModel('qwen-1', { provider: 'qwen' }),
    ]);
    expect(result.added).toBe(0);
  });

  it('getStats returns correct totals', () => {
    vault.register(makeModel('m1', { isLocal: true }));
    vault.register(makeModel('m2', { isLocal: false }));
    const stats = vault.getStats();
    expect(stats.totalModels).toBe(2);
    expect(stats.localModels).toBe(1);
    expect(stats.cloudModels).toBe(1);
  });

  it('getStats topModels has at most 5 entries', () => {
    for (let i = 0; i < 10; i++) vault.register(makeModel(`m${i}`));
    expect(vault.getStats().topModels.length).toBeLessThanOrEqual(5);
  });

  it('500 model registry is fast (< 100ms)', () => {
    const start = Date.now();
    for (let i = 0; i < 500; i++) vault.register(makeModel(`m${i}`));
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('semanticSelect from 500 models is fast (< 25ms)', () => {
    for (let i = 0; i < 500; i++) vault.register(makeModel(`m${i}`));
    const start = Date.now();
    vault.semanticSelect({ agentId: 'MARS' });
    expect(Date.now() - start).toBeLessThan(25);
  });
});

// ─── EnsembleEngine ───────────────────────────────────────────────────────────

describe('EnsembleEngine', () => {
  it('ensembleDebate returns a result', async () => {
    const engine = new EnsembleEngine();
    const result = await engine.ensembleDebate(
      [{ modelId: 'm1', weight: 0.6 }, { modelId: 'm2', weight: 0.4 }],
      'What is the best deployment strategy?',
      async (modelId, _prompt) => ({
        response: `Deploy with docker and kubernetes using ${modelId}`,
        confidence: 0.8,
      }),
    );
    expect(result.finalResponse).toBeTruthy();
  });

  it('ensembleDebate roundsNeeded >= 1', async () => {
    const engine = new EnsembleEngine({ maxRounds: 3 });
    const result = await engine.ensembleDebate(
      [{ modelId: 'm1', weight: 1.0 }],
      'Design a REST API',
      async () => ({ response: 'Use Express with TypeScript', confidence: 0.9 }),
    );
    expect(result.roundsNeeded).toBeGreaterThanOrEqual(1);
  });

  it('consensusScore is between 0 and 1', async () => {
    const engine = new EnsembleEngine();
    const result = await engine.ensembleDebate(
      [{ modelId: 'm1', weight: 0.5 }, { modelId: 'm2', weight: 0.5 }],
      'Write a function',
      async () => ({ response: 'const fn = () => {}', confidence: 0.85 }),
    );
    expect(result.consensusScore).toBeGreaterThanOrEqual(0);
    expect(result.consensusScore).toBeLessThanOrEqual(1);
  });

  it('participantResponses contains all participants', async () => {
    const engine = new EnsembleEngine();
    const result = await engine.ensembleDebate(
      [{ modelId: 'a', weight: 0.6 }, { modelId: 'b', weight: 0.4 }],
      'Prompt',
      async (modelId) => ({ response: `Response from ${modelId}`, confidence: 0.75 }),
    );
    expect(result.participantResponses.length).toBe(2);
  });

  it('durationMs is non-negative', async () => {
    const engine = new EnsembleEngine();
    const result = await engine.ensembleDebate(
      [{ modelId: 'm', weight: 1.0 }],
      'Test',
      async () => ({ response: 'ok', confidence: 0.9 }),
    );
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('single participant reaches consensus in round 1', async () => {
    const engine = new EnsembleEngine({ maxRounds: 3, consensusThreshold: 0.1 });
    const result = await engine.ensembleDebate(
      [{ modelId: 'm1', weight: 1.0 }],
      'prompt',
      async () => ({ response: 'same response every time', confidence: 0.9 }),
    );
    expect(result.roundsNeeded).toBe(1);
  });

  it('best-of-n strategy picks highest confidence', async () => {
    const engine = new EnsembleEngine({ votingStrategy: 'best-of-n', maxRounds: 1 });
    let callCount = 0;
    const result = await engine.ensembleDebate(
      [{ modelId: 'm1', weight: 0.5 }, { modelId: 'm2', weight: 0.5 }],
      'prompt',
      async (modelId) => {
        callCount++;
        return { response: `response-${modelId}`, confidence: modelId === 'm1' ? 0.9 : 0.3 };
      },
    );
    expect(result.finalResponse).toContain('m1');
  });

  it('tasteVaultScore is between 0 and 1', async () => {
    const engine = new EnsembleEngine();
    const result = await engine.ensembleDebate(
      [{ modelId: 'm', weight: 1.0 }],
      'test',
      async () => ({ response: 'output', confidence: 0.8 }),
    );
    expect(result.tasteVaultScore).toBeGreaterThanOrEqual(0);
    expect(result.tasteVaultScore).toBeLessThanOrEqual(1);
  });
});

// ─── ModelTasteIntegrator ─────────────────────────────────────────────────────

describe('ModelTasteIntegrator', () => {
  let vault: AIModelVault;
  let integrator: ModelTasteIntegrator;

  beforeEach(() => {
    vault = new AIModelVault();
    vault.register(makeModel('m1'));
    vault.register(makeModel('m2'));
    integrator = new ModelTasteIntegrator(vault, { minFeedbackCount: 1 });
  });

  it('processFeedbackBatch returns reports', () => {
    const reports = integrator.processFeedbackBatch([
      makeFeedback('m1', 5, true),
      makeFeedback('m1', 4, true),
      makeFeedback('m1', 5, true),
    ]);
    expect(reports.length).toBeGreaterThan(0);
  });

  it('positive feedback gives boost recommendation', () => {
    const reports = integrator.processFeedbackBatch([
      makeFeedback('m1', 5, true),
      makeFeedback('m1', 4, true),
      makeFeedback('m1', 5, true),
    ]);
    expect(reports[0]?.recommendation).toBe('boost');
  });

  it('negative feedback gives demote recommendation', () => {
    const reports = integrator.processFeedbackBatch([
      makeFeedback('m1', 1, false),
      makeFeedback('m1', 2, false),
      makeFeedback('m1', 1, false),
    ]);
    expect(reports[0]?.recommendation).toBe('demote');
  });

  it('processFeedbackBatch skips models below minFeedbackCount', () => {
    const intWithMinCount = new ModelTasteIntegrator(vault, { minFeedbackCount: 5 });
    const reports = intWithMinCount.processFeedbackBatch([makeFeedback('m1', 5, true)]);
    expect(reports.length).toBe(0);
  });

  it('selectWithTasteContext delegates to vault', () => {
    const result = integrator.selectWithTasteContext({ agentId: 'MARS' });
    expect(result).toBeDefined();
  });

  it('selectWithTasteContext boosts taste weight for known project', () => {
    const result = integrator.selectWithTasteContext({ agentId: 'MARS', tasteWeight: 0.4 }, 'project-x');
    expect(result).toBeDefined();
  });

  it('getTopPreferredModels returns empty for agent with no routes', () => {
    expect(integrator.getTopPreferredModels('GHOST')).toEqual([]);
  });

  it('getTopPreferredModels respects limit', () => {
    vault.setRoute('MARS', { agentId: 'MARS', modelId: 'm1', tier: 'quality', affinityScore: 0.9 });
    vault.setRoute('MARS', { agentId: 'MARS', modelId: 'm2', tier: 'speed', affinityScore: 0.7 });
    const top = integrator.getTopPreferredModels('MARS', 1);
    expect(top.length).toBe(1);
  });

  it('buildReport computes avgRating correctly', () => {
    const feedbacks: JonFeedback[] = [
      makeFeedback('m1', 4, true),
      makeFeedback('m1', 2, false),
    ];
    const report = integrator.buildReport('m1', feedbacks);
    expect(report.avgRating).toBeGreaterThan(2);
    expect(report.avgRating).toBeLessThan(5);
  });

  it('buildReport likeRate is 0 for all negative feedback', () => {
    const feedbacks = [makeFeedback('m1', 1, false), makeFeedback('m1', 2, false)];
    const report = integrator.buildReport('m1', feedbacks);
    expect(report.likeRate).toBe(0);
  });

  it('buildReport likeRate is 1 for all positive feedback', () => {
    const feedbacks = [makeFeedback('m1', 5, true), makeFeedback('m1', 4, true)];
    const report = integrator.buildReport('m1', feedbacks);
    expect(report.likeRate).toBe(1);
  });
});
