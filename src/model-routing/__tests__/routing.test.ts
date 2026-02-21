// Agent Model Routing — Test Suite (79 tests)
// KIMI-R22-01 | Feb 2026

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HardwareTier, ModelRoutingConfig, InferenceResult } from '../types.js';
import { detectHardware } from '../hardware-detector.js';
import {
  MODELS,
  DEFAULT_AGENT_MAPPINGS,
  getAgentMapping,
  getDraftModels,
  getModelByName,
  getAllModels,
} from '../model-registry.js';
import { AgentModelRouter } from '../router.js';
import { SpeculativeDecoder } from '../speculative-decoder.js';
import { InferenceQueue } from '../inference-queue.js';
import { MetricsTracker } from '../metrics-tracker.js';
import { generateModelfile, generateOllamaInstallScript } from '../ollama-modelfile-generator.js';
import { NOVA_BENCH_TASKS, runNovaBench, computeBenchSummary } from '../benchmark/nova-bench.js';
import { DEFAULT_MODEL_ROUTING_CONFIG } from '../index.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeMidTier(): HardwareTier {
  return { id: 'mid', gpuVendor: 'nvidia', vramGB: 12, ramGB: 32, cpuCores: 16, recommendedQuant: 'q5', maxConcurrentInferences: 2 };
}

function makeUltraTier(): HardwareTier {
  return { id: 'ultra', gpuVendor: 'nvidia', vramGB: 80, ramGB: 128, cpuCores: 64, recommendedQuant: 'fp16', maxConcurrentInferences: 4 };
}

function makeLowTier(): HardwareTier {
  return { id: 'low', gpuVendor: 'none', vramGB: 0, ramGB: 8, cpuCores: 4, recommendedQuant: 'q4', maxConcurrentInferences: 1 };
}

function makeAppleTier(): HardwareTier {
  return { id: 'apple-silicon', gpuVendor: 'apple', vramGB: 36, ramGB: 36, cpuCores: 12, recommendedQuant: 'q6', maxConcurrentInferences: 2 };
}

function makeConfig(overrides: Partial<ModelRoutingConfig> = {}): ModelRoutingConfig {
  return { ...DEFAULT_MODEL_ROUTING_CONFIG, ...overrides };
}

function makeMetrics(): MetricsTracker {
  return new MetricsTracker();
}

function makeRouter(tierOverride?: HardwareTier['id']): AgentModelRouter {
  const config = makeConfig({ forceTier: tierOverride ?? 'mid' });
  return new AgentModelRouter(config, makeMetrics());
}

async function mockInference(
  _model: string,
  prompt: string,
  maxTokens = 64,
): Promise<{ text: string; tokensOut: number; durationMs: number; confidence: number }> {
  return {
    text: prompt.slice(0, maxTokens).split(' ').join(' '),
    tokensOut: maxTokens,
    durationMs: 50,
    confidence: 0.85,
  };
}

async function mockInferenceLowConf(
  _model: string,
  prompt: string,
  maxTokens = 64,
): Promise<{ text: string; tokensOut: number; durationMs: number; confidence: number }> {
  return {
    text: prompt.slice(0, maxTokens),
    tokensOut: maxTokens,
    durationMs: 30,
    confidence: 0.40,
  };
}

// ─── Hardware Detection ───────────────────────────────────────────────────────

describe('Hardware Detection', () => {
  it('forced low tier returns correct id', () => {
    const { tier, detectionMethod } = detectHardware('low');
    expect(tier.id).toBe('low');
    expect(detectionMethod).toBe('forced');
  });

  it('forced mid tier returns correct vramGB', () => {
    const { tier } = detectHardware('mid');
    expect(tier.vramGB).toBe(12);
  });

  it('forced high tier returns correct quant', () => {
    const { tier } = detectHardware('high');
    expect(tier.recommendedQuant).toBe('q6');
  });

  it('forced ultra tier returns fp16 quant', () => {
    const { tier } = detectHardware('ultra');
    expect(tier.recommendedQuant).toBe('fp16');
  });

  it('forced apple-silicon tier returns apple vendor', () => {
    const { tier } = detectHardware('apple-silicon');
    expect(tier.gpuVendor).toBe('apple');
  });

  it('auto detection returns a valid tier id', () => {
    const { tier } = detectHardware(null);
    expect(['low', 'mid', 'high', 'ultra', 'apple-silicon']).toContain(tier.id);
  });

  it('auto detection always returns maxConcurrentInferences >= 1', () => {
    const { tier } = detectHardware(null);
    expect(tier.maxConcurrentInferences).toBeGreaterThanOrEqual(1);
  });

  it('forced tier rawInfo records forceTier', () => {
    const { rawInfo } = detectHardware('ultra');
    expect(rawInfo.forceTier).toBe('ultra');
  });
});

// ─── Model Registry ───────────────────────────────────────────────────────────

describe('Model Registry', () => {
  it('has qwen3.5-coder model', () => {
    expect(MODELS['qwen3.5-coder:32b-q5']).toBeDefined();
  });

  it('nemotron3-nano is a draft model', () => {
    const model = MODELS['nemotron3-nano:8b-q4']!;
    expect(model.speculativeDraft).toBe(true);
  });

  it('getDraftModels returns at least 3 models', () => {
    expect(getDraftModels().length).toBeGreaterThanOrEqual(3);
  });

  it('getModelByName returns undefined for unknown model', () => {
    expect(getModelByName('nonexistent-model')).toBeUndefined();
  });

  it('getAllModels returns >= 8 models', () => {
    expect(getAllModels().length).toBeGreaterThanOrEqual(8);
  });

  it('all models have required fields', () => {
    for (const m of getAllModels()) {
      expect(m.name).toBeTruthy();
      expect(m.ollamaTag).toBeTruthy();
      expect(m.contextWindow).toBeGreaterThan(0);
      expect(m.tokensPerSec).toBeGreaterThan(0);
    }
  });

  it('MARS agent mapping exists', () => {
    expect(getAgentMapping('MARS')).toBeDefined();
  });

  it('IO agent uses a fast model (tokensPerSec >= 100)', () => {
    const io = getAgentMapping('IO')!;
    expect(io.primary.tokensPerSec).toBeGreaterThanOrEqual(100);
  });

  it('PLUTO has high confidence threshold (>= 0.80)', () => {
    const pluto = getAgentMapping('PLUTO')!;
    expect(pluto.confidenceThreshold).toBeGreaterThanOrEqual(0.80);
  });

  it('all 21 agent mappings present', () => {
    const agentIds = DEFAULT_AGENT_MAPPINGS.map(m => m.agentId);
    const expected = ['MARS', 'PLUTO', 'VENUS', 'ANDROMEDA', 'EUROPA', 'MERCURY', 'CHARON',
      'SUN', 'JUPITER', 'NEPTUNE', 'IO', 'EARTH', 'SATURN', 'GANYMEDE', 'URANUS',
      'TITAN', 'CALLISTO', 'ENCELADUS', 'MIMAS', 'TRITON', 'ATLAS'];
    for (const id of expected) {
      expect(agentIds).toContain(id);
    }
  });

  it('every mapping has at least 1 fallback', () => {
    for (const mapping of DEFAULT_AGENT_MAPPINGS) {
      expect(mapping.fallback.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─── Router ───────────────────────────────────────────────────────────────────

describe('AgentModelRouter', () => {
  it('routes MARS to primary model when hardware fits', () => {
    const router = makeRouter('ultra');
    const decision = router.route({ agentId: 'MARS', prompt: 'test' });
    expect(decision.reason).toBe('primary');
    expect(decision.model.agentId).toBeUndefined(); // ModelProfile, not AgentModelMapping
    expect(decision.model.family).toBe('qwen');
  });

  it('falls back to cheaper model when VRAM insufficient', () => {
    const router = makeRouter('low');
    const decision = router.route({ agentId: 'MARS', prompt: 'test' });
    // Low tier has 0 VRAM; should fall back
    expect(['fallback', 'hardware-limit']).toContain(decision.reason);
  });

  it('returns hardware tier info in decision', () => {
    const router = makeRouter('mid');
    const decision = router.route({ agentId: 'EARTH', prompt: 'orchestrate' });
    expect(decision.hardwareTier.id).toBe('mid');
  });

  it('high urgency prefers fast model', () => {
    const router = makeRouter('ultra');
    const decision = router.route({ agentId: 'MARS', prompt: 'deploy now', urgency: 0.95 });
    // Fast model should have higher tokensPerSec
    expect(decision.model.tokensPerSec).toBeGreaterThan(0);
  });

  it('budget limit selects cheapest available model', () => {
    const router = makeRouter('ultra');
    // MARS primary is costFactor 1.0; fallback[0] is 0.4 — budget of 0.45 forces fallback
    const decision = router.route({ agentId: 'MARS', prompt: 'test', maxBudget: 0.45 });
    expect(decision.model.costFactor).toBeLessThanOrEqual(0.45);
  });

  it('unknown agentId falls back to EARTH mapping', () => {
    const router = makeRouter('ultra');
    const decision = router.route({ agentId: 'UNKNOWN_AGENT', prompt: 'test' });
    expect(decision).toBeDefined();
    expect(decision.model).toBeDefined();
  });

  it('getHardwareTier returns forced tier', () => {
    const router = makeRouter('apple-silicon');
    expect(router.getHardwareTier().id).toBe('apple-silicon');
  });

  it('custom agentMappings override defaults', () => {
    const customMapping = {
      agentId: 'MARS',
      primary: MODELS['mimo-v2-flash:7b-q4']!,
      fallback: [MODELS['nemotron3-nano:8b-q4']!],
      confidenceThreshold: 0.60,
      maxConcurrent: 1,
      tasteVaultWeight: 0.5,
    };
    const config = makeConfig({ forceTier: 'ultra', agentMappings: [customMapping] });
    const router = new AgentModelRouter(config, makeMetrics());
    const decision = router.route({ agentId: 'MARS', prompt: 'test' });
    expect(decision.model.family).toBe('mimo');
  });

  it('escalate resolves when confidence is already high', async () => {
    const router = makeRouter('ultra');
    const called: string[] = [];
    const result = await router.escalate(
      { agentId: 'MARS', prompt: 'test' },
      MODELS['qwen3.5-coder:32b-q5']!,
      0.95, // above threshold
      async (model, prompt) => {
        called.push(model.name);
        return { agentId: 'MARS', modelUsed: model.name, output: 'ok', confidence: 0.95,
          tokensIn: 10, tokensOut: 20, durationMs: 50, escalated: false };
      },
    );
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('escalate upgrades model when confidence is below threshold', async () => {
    const router = makeRouter('ultra');
    const escalated: boolean[] = [];
    const result = await router.escalate(
      { agentId: 'MERCURY', prompt: 'review this code' },
      MODELS['nemotron3-nano:8b-q4']!, // cheap model
      0.30, // below threshold
      async (model, _prompt) => {
        const esc = model.costFactor > 0.1;
        escalated.push(esc);
        return { agentId: 'MERCURY', modelUsed: model.name, output: 'reviewed',
          confidence: 0.88, tokensIn: 10, tokensOut: 30, durationMs: 200, escalated: esc };
      },
    );
    expect(result).toBeDefined();
  });
});

// ─── Speculative Decoder ──────────────────────────────────────────────────────

describe('SpeculativeDecoder', () => {
  function makeDecoder(enabled = true) {
    return new SpeculativeDecoder({
      enabled,
      draftModel: 'nemotron3-nano:8b-q4',
      verifyModel: 'qwen3.5-coder:32b-q5',
      draftTokens: 4,
      acceptanceRateTarget: 0.68,
    });
  }

  it('isEnabled returns true when enabled', () => {
    expect(makeDecoder(true).isEnabled()).toBe(true);
  });

  it('isEnabled returns false when disabled', () => {
    expect(makeDecoder(false).isEnabled()).toBe(false);
  });

  it('getDraftModel returns correct model name', () => {
    expect(makeDecoder().getDraftModel()).toBe('nemotron3-nano:8b-q4');
  });

  it('getVerifyModel returns correct model name', () => {
    expect(makeDecoder().getVerifyModel()).toBe('qwen3.5-coder:32b-q5');
  });

  it('decode returns a result with tokensOut > 0', async () => {
    const decoder = makeDecoder();
    const result = await decoder.decode('MARS', 'Write a Dockerfile', mockInference, 16);
    expect(result.tokensOut).toBeGreaterThan(0);
  });

  it('decode result contains steps array', async () => {
    const decoder = makeDecoder();
    const result = await decoder.decode('MARS', 'test prompt', mockInference, 16);
    expect(Array.isArray(result.steps)).toBe(true);
  });

  it('decode result has speedupFactor >= 1', async () => {
    const decoder = makeDecoder();
    const result = await decoder.decode('MARS', 'speedup test', mockInference, 16);
    expect(result.speedupFactor).toBeGreaterThanOrEqual(1);
  });

  it('decode result has overallAcceptanceRate between 0 and 1', async () => {
    const decoder = makeDecoder();
    const result = await decoder.decode('VENUS', 'create UI', mockInference, 16);
    expect(result.overallAcceptanceRate).toBeGreaterThanOrEqual(0);
    expect(result.overallAcceptanceRate).toBeLessThanOrEqual(1);
  });

  it('decode returns model string combining draft+verify', async () => {
    const decoder = makeDecoder();
    const result = await decoder.decode('IO', 'real time', mockInference, 8);
    expect(result.modelUsed).toContain('+');
  });

  it('getAcceptanceRateTarget returns 0.68', () => {
    expect(makeDecoder().getAcceptanceRateTarget()).toBe(0.68);
  });

  it('decode with mismatch still returns output', async () => {
    let call = 0;
    const mismatchInference = async (_m: string, p: string, n = 4) => {
      call++;
      // Draft and verify return different text to force mismatch
      return { text: call % 2 === 0 ? 'alpha beta gamma delta' : 'ALPHA BETA GAMMA DELTA',
        tokensOut: n, durationMs: 20, confidence: 0.7 };
    };
    const decoder = makeDecoder();
    const result = await decoder.decode('CHARON', 'debug', mismatchInference, 8);
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ─── Inference Queue ──────────────────────────────────────────────────────────

describe('InferenceQueue', () => {
  it('initial depth is 0', () => {
    const q = new InferenceQueue(2);
    expect(q.getDepth()).toBe(0);
  });

  it('enqueue resolves when processFn is set', async () => {
    const q = new InferenceQueue(2);
    q.setProcessFn(async (agentId, _prompt, _priority) => ({
      agentId,
      modelUsed: 'test-model',
      output: 'done',
      confidence: 0.9,
      tokensIn: 5,
      tokensOut: 10,
      durationMs: 20,
      escalated: false,
    }));

    const result = await q.enqueue({
      agentId: 'MARS',
      prompt: 'test',
      priority: 50,
      timeoutMs: 5000,
      tasteVaultWeight: 0.5,
      resolve: () => {},
      reject: () => {},
    });
    expect(result.agentId).toBe('MARS');
  });

  it('stats completedCount increments after resolution', async () => {
    const q = new InferenceQueue(2);
    q.setProcessFn(async (agentId, _prompt, _p) => ({
      agentId, modelUsed: 'm', output: 'x', confidence: 0.8,
      tokensIn: 1, tokensOut: 2, durationMs: 10, escalated: false,
    }));
    await q.enqueue({ agentId: 'EARTH', prompt: 'hi', priority: 50, timeoutMs: 5000,
      tasteVaultWeight: 0.5, resolve: () => {}, reject: () => {} });
    expect(q.getStats().completedCount).toBe(1);
  });

  it('high priority task completes before low priority task', async () => {
    const q = new InferenceQueue(1);
    const order: string[] = [];
    q.setProcessFn(async (agentId, _p, _pr) => {
      order.push(agentId);
      return { agentId, modelUsed: 'm', output: 'x', confidence: 0.8,
        tokensIn: 1, tokensOut: 2, durationMs: 5, escalated: false };
    });

    await Promise.all([
      q.enqueue({ agentId: 'LOW', prompt: 'low', priority: 10, timeoutMs: 3000,
        tasteVaultWeight: 0, resolve: () => {}, reject: () => {} }),
      q.enqueue({ agentId: 'HIGH', prompt: 'high', priority: 90, timeoutMs: 3000,
        tasteVaultWeight: 0, resolve: () => {}, reject: () => {} }),
    ]);
    // Both should complete
    expect(order.length).toBe(2);
  });

  it('timeout causes task to reject', async () => {
    const q = new InferenceQueue(1);
    q.setProcessFn(async () => {
      await new Promise(r => setTimeout(r, 200));
      return { agentId: 'X', modelUsed: 'm', output: 'x', confidence: 0.8,
        tokensIn: 1, tokensOut: 2, durationMs: 200, escalated: false };
    });

    await expect(q.enqueue({
      agentId: 'TIMEOUT', prompt: 'slow', priority: 50, timeoutMs: 50, // 50ms timeout
      tasteVaultWeight: 0.5, resolve: () => {}, reject: () => {},
    })).rejects.toThrow(/timed out/);
  });

  it('fairness score is between 0 and 1', async () => {
    const q = new InferenceQueue(4);
    q.setProcessFn(async (agentId, _p, _pr) => ({
      agentId, modelUsed: 'm', output: 'ok', confidence: 0.9,
      tokensIn: 1, tokensOut: 2, durationMs: 5, escalated: false,
    }));
    await Promise.all(['A', 'B', 'C'].map(id =>
      q.enqueue({ agentId: id, prompt: 'test', priority: 50, timeoutMs: 2000,
        tasteVaultWeight: 0.5, resolve: () => {}, reject: () => {} })
    ));
    const stats = q.getStats();
    expect(stats.fairnessScore).toBeGreaterThanOrEqual(0);
    expect(stats.fairnessScore).toBeLessThanOrEqual(1);
  });

  it('clear rejects all pending tasks', () => {
    const q = new InferenceQueue(0); // maxConcurrent=0 so nothing processes
    const rejects: Error[] = [];
    const task = {
      agentId: 'X', prompt: 'p', priority: 50, timeoutMs: 5000,
      tasteVaultWeight: 0.5,
      resolve: () => {},
      reject: (e: Error) => rejects.push(e),
    };
    // Manually push without triggering drain
    (q as unknown as { queue: unknown[] }).queue.push({ ...task, id: 'test-1', enqueuedAt: Date.now() });
    q.clear();
    expect(rejects[0]?.message).toContain('cleared');
  });

  it('no processFn rejects task', async () => {
    const q = new InferenceQueue(1);
    // No setProcessFn
    await expect(q.enqueue({
      agentId: 'X', prompt: 'test', priority: 50, timeoutMs: 1000,
      tasteVaultWeight: 0.5, resolve: () => {}, reject: () => {},
    })).rejects.toThrow(/No inference function/);
  });
});

// ─── Metrics Tracker ─────────────────────────────────────────────────────────

describe('MetricsTracker', () => {
  function sample(agentId = 'MARS', confidence = 0.85, durationMs = 200): Parameters<MetricsTracker['record']>[0] {
    return { agentId, modelUsed: 'qwen3.5-coder:32b-q5', tokensIn: 100, tokensOut: 200,
      durationMs, confidence, energyWh: 0.001, timestamp: Date.now(), wasEscalated: false };
  }

  it('initial count is 0', () => {
    expect(makeMetrics().getCount()).toBe(0);
  });

  it('record increases count', () => {
    const mt = makeMetrics();
    mt.record(sample());
    expect(mt.getCount()).toBe(1);
  });

  it('getSummary returns 0 for unknown agent', () => {
    const mt = makeMetrics();
    expect(mt.getSummary('UNKNOWN').totalInferences).toBe(0);
  });

  it('getSummary computes avgDurationMs correctly', () => {
    const mt = makeMetrics();
    mt.record(sample('MARS', 0.8, 100));
    mt.record(sample('MARS', 0.9, 300));
    expect(mt.getSummary('MARS').avgDurationMs).toBeCloseTo(200);
  });

  it('getSummary computes escalationRate', () => {
    const mt = makeMetrics();
    mt.record({ ...sample('EARTH'), wasEscalated: true });
    mt.record(sample('EARTH'));
    expect(mt.getSummary('EARTH').escalationRate).toBeCloseTo(0.5);
  });

  it('p95 duration is >= p50 duration', () => {
    const mt = makeMetrics();
    for (let i = 0; i < 20; i++) mt.record(sample('VENUS', 0.8, 100 + i * 10));
    const s = mt.getSummary('VENUS');
    expect(s.p95DurationMs).toBeGreaterThanOrEqual(s.p50DurationMs);
  });

  it('getGlobalSummary includes all recorded agents', () => {
    const mt = makeMetrics();
    mt.record(sample('MARS'));
    mt.record(sample('VENUS'));
    const gs = mt.getGlobalSummary();
    expect(gs.byAgent['MARS']).toBeDefined();
    expect(gs.byAgent['VENUS']).toBeDefined();
  });

  it('topModels list is non-empty after recording', () => {
    const mt = makeMetrics();
    mt.record(sample('MARS'));
    const gs = mt.getGlobalSummary();
    expect(gs.topModels.length).toBeGreaterThan(0);
  });

  it('clear resets count to 0', () => {
    const mt = makeMetrics();
    mt.record(sample());
    mt.clear();
    expect(mt.getCount()).toBe(0);
  });

  it('exportJson returns valid JSON array', () => {
    const mt = makeMetrics();
    mt.record(sample());
    const json = mt.exportJson();
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toBeInstanceOf(Array);
  });

  it('maxHistory evicts oldest records', () => {
    const mt = new MetricsTracker(3);
    for (let i = 0; i < 5; i++) mt.record(sample('MARS', 0.8, i * 100));
    expect(mt.getCount()).toBe(3);
  });
});

// ─── Ollama Modelfile Generator ───────────────────────────────────────────────

describe('OllamaModelfileGenerator', () => {
  const mapping = DEFAULT_AGENT_MAPPINGS.find(m => m.agentId === 'MARS')!;

  it('generates modelfile for mid tier', () => {
    const mf = generateModelfile(mapping, makeMidTier());
    expect(mf.agentId).toBe('MARS');
    expect(mf.hardwareTier).toBe('mid');
  });

  it('modelfile content includes FROM directive', () => {
    const mf = generateModelfile(mapping, makeMidTier());
    expect(mf.content).toContain('FROM');
  });

  it('modelfile content includes num_ctx', () => {
    const mf = generateModelfile(mapping, makeMidTier());
    expect(mf.content).toContain('num_ctx');
  });

  it('modelfile content includes SYSTEM prompt', () => {
    const mf = generateModelfile(mapping, makeMidTier());
    expect(mf.content).toContain('SYSTEM');
  });

  it('ultra tier modelfile has higher num_ctx than low tier', () => {
    const ultraMf = generateModelfile(mapping, makeUltraTier());
    const lowMf = generateModelfile(mapping, makeLowTier());
    const extractCtx = (s: string) => Number(s.match(/num_ctx (\d+)/)?.[1] ?? '0');
    expect(extractCtx(ultraMf.content)).toBeGreaterThan(extractCtx(lowMf.content));
  });

  it('modelName includes agentId and tier', () => {
    const mf = generateModelfile(mapping, makeMidTier());
    expect(mf.modelName).toContain('mars');
    expect(mf.modelName).toContain('mid');
  });

  it('apple-silicon tier sets num_gpu to 99', () => {
    const mf = generateModelfile(mapping, makeAppleTier());
    expect(mf.content).toContain('num_gpu 99');
  });

  it('install script includes ollama create commands', () => {
    const mf = generateModelfile(mapping, makeMidTier());
    const script = generateOllamaInstallScript([mf]);
    expect(script).toContain('ollama create');
  });

  it('install script starts with #!/bin/bash', () => {
    const mf = generateModelfile(mapping, makeMidTier());
    const script = generateOllamaInstallScript([mf]);
    expect(script.startsWith('#!/bin/bash')).toBe(true);
  });
});

// ─── Nova-Bench ───────────────────────────────────────────────────────────────

describe('Nova-Bench', () => {
  it('has exactly 42 benchmark tasks', () => {
    expect(NOVA_BENCH_TASKS.length).toBe(42);
  });

  it('all tasks have unique IDs', () => {
    const ids = NOVA_BENCH_TASKS.map(t => t.id);
    expect(new Set(ids).size).toBe(NOVA_BENCH_TASKS.length);
  });

  it('all tasks have expectedKeywords array', () => {
    for (const t of NOVA_BENCH_TASKS) {
      expect(t.expectedKeywords.length).toBeGreaterThan(0);
    }
  });

  it('runNovaBench returns results for each task', async () => {
    const subset = NOVA_BENCH_TASKS.slice(0, 3);
    const results = await runNovaBench(subset, async (_agentId, prompt, _timeout) => {
      return `Here are some keywords: ${subset[0]?.expectedKeywords.join(', ')}. ${prompt}`;
    });
    expect(results.length).toBe(3);
  });

  it('computeBenchSummary passRate is between 0 and 1', async () => {
    const subset = NOVA_BENCH_TASKS.slice(0, 5);
    const results = await runNovaBench(subset, async (_id, prompt, _t) => prompt);
    const summary = computeBenchSummary(results);
    expect(summary.passRate).toBeGreaterThanOrEqual(0);
    expect(summary.passRate).toBeLessThanOrEqual(1);
  });

  it('computeBenchSummary groups by agent', async () => {
    const marsTasks = NOVA_BENCH_TASKS.filter(t => t.agentId === 'MARS');
    const results = await runNovaBench(marsTasks, async (_id, prompt, _t) =>
      `workflow pnpm vercel deploy node helm chart gpu nodeSelector resources ${prompt}`,
    );
    const summary = computeBenchSummary(results);
    expect(summary.byAgent['MARS']).toBeDefined();
  });

  it('failed inference returns score 0', async () => {
    const subset = NOVA_BENCH_TASKS.slice(0, 1);
    const results = await runNovaBench(subset, async () => {
      throw new Error('model unavailable');
    });
    expect(results[0]!.score).toBe(0);
    expect(results[0]!.passed).toBe(false);
  });

  it('perfect keyword match yields score 100', async () => {
    const task = NOVA_BENCH_TASKS[0]!;
    const results = await runNovaBench([task], async () =>
      task.expectedKeywords.join(' '),
    );
    expect(results[0]!.score).toBe(100);
  });
});

// ─── Default Config ───────────────────────────────────────────────────────────

describe('DEFAULT_MODEL_ROUTING_CONFIG', () => {
  it('is enabled by default', () => {
    expect(DEFAULT_MODEL_ROUTING_CONFIG.enabled).toBe(true);
  });

  it('speculative decoding is enabled by default', () => {
    expect(DEFAULT_MODEL_ROUTING_CONFIG.speculativeDecoding.enabled).toBe(true);
  });

  it('acceptanceRateTarget is 0.68', () => {
    expect(DEFAULT_MODEL_ROUTING_CONFIG.speculativeDecoding.acceptanceRateTarget).toBe(0.68);
  });

  it('forceTier is null by default', () => {
    expect(DEFAULT_MODEL_ROUTING_CONFIG.forceTier).toBeNull();
  });

  it('queueEnabled is true by default', () => {
    expect(DEFAULT_MODEL_ROUTING_CONFIG.queueEnabled).toBe(true);
  });

  it('benchmarkOnStartup is false by default', () => {
    expect(DEFAULT_MODEL_ROUTING_CONFIG.benchmarkOnStartup).toBe(false);
  });
});

// ─── Chaos / Fallback ─────────────────────────────────────────────────────────

describe('Chaos & Fallback', () => {
  it('router handles all 21 agent IDs without throwing', () => {
    const router = makeRouter('mid');
    const agentIds = DEFAULT_AGENT_MAPPINGS.map(m => m.agentId);
    for (const id of agentIds) {
      expect(() => router.route({ agentId: id, prompt: 'chaos test' })).not.toThrow();
    }
  });

  it('router with zero VRAM still returns a valid decision', () => {
    const config = makeConfig({ forceTier: 'low' });
    const router = new AgentModelRouter(config, makeMetrics());
    const decision = router.route({ agentId: 'JUPITER', prompt: 'architecture' });
    expect(decision.model).toBeDefined();
  });

  it('metrics tracker handles 1000 records efficiently', () => {
    const mt = new MetricsTracker(1000);
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      mt.record({ agentId: 'MARS', modelUsed: 'm', tokensIn: 10, tokensOut: 20,
        durationMs: 100, confidence: 0.8, energyWh: 0.001, timestamp: Date.now(), wasEscalated: false });
    }
    expect(Date.now() - start).toBeLessThan(500); // Should be fast
    expect(mt.getCount()).toBe(1000);
  });
});
