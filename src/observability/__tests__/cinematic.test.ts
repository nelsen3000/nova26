// Cinematic Observability & Eval Suite — Test Suite
// KIMI-R23-05 | Feb 2026
// Tests the actual CinematicObservability, BraintrustAdapter, and LangSmithBridge APIs

import { describe, it, expect, beforeEach } from 'vitest';
import type { CinematicSpan, SpanInput, CinematicEvalSuite, EvalDatasetEntry, EvaluatorConfig } from '../types.js';
import {
  CinematicObservability,
  createCinematicObservability,
  resetCinematicObservability,
} from '../cinematic-core.js';
import {
  BraintrustAdapter,
  createBraintrustAdapter,
  resetBraintrustAdapter,
} from '../braintrust-adapter.js';
import {
  LangSmithBridge,
  createLangSmithBridge,
  resetLangSmithBridge,
} from '../langsmith-bridge.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSpanInput(opts: Partial<SpanInput> = {}): SpanInput {
  return {
    traceId: 'trace-001',
    name: 'test-span',
    agentId: 'MARS',
    type: 'agent-call',
    startTime: new Date().toISOString(),
    status: 'running',
    metadata: {},
    ...opts,
  };
}

function makeEvalEntry(overrides: Partial<EvalDatasetEntry> = {}): EvalDatasetEntry {
  return {
    input: { query: 'test input' },
    expectedOutput: { result: 'test output' },
    tags: ['test'],
    ...overrides,
  };
}

function makeEvaluator(overrides: Partial<EvaluatorConfig> = {}): EvaluatorConfig {
  return {
    name: 'test-evaluator',
    type: 'heuristic',
    config: { rules: [{ field: 'result', expected: 'test output', weight: 1.0 }] },
    ...overrides,
  };
}

function makeSuite(overrides: Partial<CinematicEvalSuite> = {}): CinematicEvalSuite {
  return {
    id: 'suite-1',
    name: 'Test Suite',
    evaluators: [makeEvaluator()],
    dataset: [makeEvalEntry()],
    ...overrides,
  };
}

// ─── CinematicObservability — recordSpan ──────────────────────────────────────

describe('CinematicObservability — recordSpan', () => {
  let obs: CinematicObservability;

  beforeEach(() => {
    resetCinematicObservability();
    obs = createCinematicObservability();
  });

  it('records a span and returns an id', () => {
    const id = obs.recordSpan(makeSpanInput());
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('stores span in correct trace', () => {
    const id = obs.recordSpan(makeSpanInput({ traceId: 'trace-abc' }));
    const trace = obs.getTraceTree('trace-abc');
    expect(trace.length).toBe(1);
    expect(trace[0].id).toBe(id);
  });

  it('getTraceTree returns empty array for unknown trace', () => {
    const trace = obs.getTraceTree('unknown-trace');
    expect(trace).toEqual([]);
  });

  it('records multiple spans in same trace', () => {
    obs.recordSpan(makeSpanInput({ traceId: 'trace-multi' }));
    obs.recordSpan(makeSpanInput({ traceId: 'trace-multi', name: 'span-2' }));
    const trace = obs.getTraceTree('trace-multi');
    expect(trace.length).toBe(2);
  });

  it('span can be retrieved by id', () => {
    const id = obs.recordSpan(makeSpanInput({ name: 'my-span' }));
    const span = obs.getSpan(id);
    expect(span).toBeDefined();
    expect(span?.name).toBe('my-span');
  });

  it('tracks taste vault score from spans', () => {
    obs.recordSpan(makeSpanInput({ tasteVaultScore: 0.95 }));
    const stats = obs.getStats();
    expect(stats.totalSpans).toBe(1);
  });
});

// ─── CinematicObservability — endSpan ─────────────────────────────────────────

describe('CinematicObservability — endSpan', () => {
  let obs: CinematicObservability;

  beforeEach(() => {
    resetCinematicObservability();
    obs = createCinematicObservability();
  });

  it('ends a running span with success', () => {
    const id = obs.recordSpan(makeSpanInput());
    obs.endSpan(id, { status: 'success' });
    const span = obs.getSpan(id);
    expect(span?.status).toBe('success');
    expect(span?.endTime).toBeDefined();
  });

  it('sets failure status', () => {
    const id = obs.recordSpan(makeSpanInput());
    obs.endSpan(id, { status: 'failure' });
    const span = obs.getSpan(id);
    expect(span?.status).toBe('failure');
  });

  it('endSpan on unknown span is a no-op', () => {
    // Should not throw
    obs.endSpan('unknown-id', { status: 'success' });
  });

  it('computes durationMs on end', () => {
    const id = obs.recordSpan(makeSpanInput({
      startTime: new Date(Date.now() - 100).toISOString(),
    }));
    obs.endSpan(id, { status: 'success' });
    const span = obs.getSpan(id);
    expect(span?.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── CinematicObservability — getStats ────────────────────────────────────────

describe('CinematicObservability — getStats', () => {
  let obs: CinematicObservability;

  beforeEach(() => {
    resetCinematicObservability();
    obs = createCinematicObservability();
  });

  it('returns zero stats initially', () => {
    const stats = obs.getStats();
    expect(stats.totalSpans).toBe(0);
    expect(stats.activeTraces).toBe(0);
    expect(stats.runningSpans).toBe(0);
    expect(stats.completedSpans).toBe(0);
    expect(stats.failedSpans).toBe(0);
    expect(stats.remediationCount).toBe(0);
  });

  it('totalSpans counts all recorded spans', () => {
    obs.recordSpan(makeSpanInput());
    obs.recordSpan(makeSpanInput({ traceId: 'trace-002' }));
    const stats = obs.getStats();
    expect(stats.totalSpans).toBe(2);
    expect(stats.activeTraces).toBe(2);
  });

  it('tracks running vs completed spans', () => {
    const id = obs.recordSpan(makeSpanInput());
    obs.recordSpan(makeSpanInput({ name: 'span-2' }));
    obs.endSpan(id, { status: 'success' });
    const stats = obs.getStats();
    expect(stats.runningSpans).toBe(1);
    expect(stats.completedSpans).toBe(1);
  });

  it('tracks failed spans', () => {
    const id = obs.recordSpan(makeSpanInput());
    obs.endSpan(id, { status: 'failure' });
    const stats = obs.getStats();
    expect(stats.failedSpans).toBe(1);
  });
});

// ─── CinematicObservability — runEvalSuite ────────────────────────────────────

describe('CinematicObservability — runEvalSuite', () => {
  let obs: CinematicObservability;

  beforeEach(() => {
    resetCinematicObservability();
    obs = createCinematicObservability();
  });

  it('runs eval suite and returns result', async () => {
    const suite = makeSuite();
    const result = await obs.runEvalSuite(suite);
    expect(result).toBeDefined();
    expect(typeof result.passed).toBe('boolean');
    expect(result.scores).toBeDefined();
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('returns entryResults for each dataset entry', async () => {
    const suite = makeSuite({
      dataset: [makeEvalEntry(), makeEvalEntry({ input: { query: 'second' } })],
    });
    const result = await obs.runEvalSuite(suite);
    expect(result.entryResults).toBeDefined();
    expect(result.entryResults?.length).toBe(2);
  });

  it('handles empty dataset', async () => {
    const suite = makeSuite({ dataset: [] });
    const result = await obs.runEvalSuite(suite);
    // With no dataset entries, evaluators have 0 avg score which is below threshold
    expect(result).toBeDefined();
    expect(result.details.length).toBeGreaterThan(0);
  });
});

// ─── CinematicObservability — remediation ─────────────────────────────────────

describe('CinematicObservability — remediation', () => {
  let obs: CinematicObservability;

  beforeEach(() => {
    resetCinematicObservability();
    obs = createCinematicObservability({
      remediation: {
        tasteScoreDropThreshold: 0.08,
        actions: ['alert', 'escalate'],
        cooldownMs: 0, // No cooldown for tests
      },
    });
  });

  it('triggers remediation on taste score drop > threshold', () => {
    // Record a span with a very low taste score to trigger remediation
    obs.recordSpan(makeSpanInput({ tasteVaultScore: 0.1 }));
    const history = obs.getRemediationHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].actionsTaken).toContain('alert');
  });

  it('getRemediationHistory returns empty initially', () => {
    const history = obs.getRemediationHistory();
    expect(history).toEqual([]);
  });
});

// ─── CinematicObservability — misc ────────────────────────────────────────────

describe('CinematicObservability — misc', () => {
  it('createCinematicObservability factory works', () => {
    const obs = createCinematicObservability();
    expect(obs).toBeInstanceOf(CinematicObservability);
  });

  it('clear resets all state', () => {
    const obs = createCinematicObservability();
    obs.recordSpan(makeSpanInput());
    obs.clear();
    const stats = obs.getStats();
    expect(stats.totalSpans).toBe(0);
    expect(stats.activeTraces).toBe(0);
  });

  it('getSpansByStatus filters correctly', () => {
    const obs = createCinematicObservability();
    const id = obs.recordSpan(makeSpanInput());
    obs.endSpan(id, { status: 'success' });
    obs.recordSpan(makeSpanInput({ name: 'running-span' }));
    expect(obs.getSpansByStatus('success').length).toBe(1);
    expect(obs.getSpansByStatus('running').length).toBe(1);
  });

  it('getSpansByAgent filters correctly', () => {
    const obs = createCinematicObservability();
    obs.recordSpan(makeSpanInput({ agentId: 'MARS' }));
    obs.recordSpan(makeSpanInput({ agentId: 'VENUS' }));
    expect(obs.getSpansByAgent('MARS').length).toBe(1);
    expect(obs.getSpansByAgent('VENUS').length).toBe(1);
  });

  it('flushOldSpans removes old spans', () => {
    const obs = createCinematicObservability();
    obs.recordSpan(makeSpanInput({
      startTime: new Date(Date.now() - 100000).toISOString(),
    }));
    obs.recordSpan(makeSpanInput());
    const removed = obs.flushOldSpans(50000);
    expect(removed).toBe(1);
    expect(obs.getStats().totalSpans).toBe(1);
  });

  it('getHierarchicalTrace builds parent-child tree', () => {
    const obs = createCinematicObservability();
    const parentId = obs.recordSpan(makeSpanInput({ traceId: 'tree-trace', name: 'parent' }));
    obs.recordSpan(makeSpanInput({ traceId: 'tree-trace', name: 'child', parentId }));
    const tree = obs.getHierarchicalTrace('tree-trace');
    expect(tree.length).toBe(1);
    expect(tree[0].name).toBe('parent');
    expect(tree[0].children.length).toBe(1);
    expect(tree[0].children[0].name).toBe('child');
  });
});

// ─── BraintrustAdapter ────────────────────────────────────────────────────────

describe('BraintrustAdapter', () => {
  let adapter: BraintrustAdapter;

  beforeEach(() => {
    resetBraintrustAdapter();
    adapter = createBraintrustAdapter({
      apiKey: 'test-key',
      projectId: 'test-project',
      projectName: 'Test Project',
    });
  });

  it('creates adapter instance', () => {
    expect(adapter).toBeInstanceOf(BraintrustAdapter);
  });

  it('isConnected returns false before initialize', () => {
    expect(adapter.isConnected()).toBe(false);
  });

  it('initialize connects the client', async () => {
    const connected = await adapter.initialize();
    expect(connected).toBe(true);
    expect(adapter.isConnected()).toBe(true);
  });

  it('convertEvalSuiteToDataset converts suite to dataset format', () => {
    const suite = makeSuite();
    const dataset = adapter.convertEvalSuiteToDataset(suite);
    expect(dataset.name).toBe('Test Suite');
    expect(dataset.projectId).toBe('test-project');
    expect(dataset.data.length).toBe(1);
    expect(dataset.data[0].input).toEqual({ query: 'test input' });
  });

  it('uploadEvalSuite uploads and returns dataset with id', async () => {
    await adapter.initialize();
    const suite = makeSuite();
    const dataset = await adapter.uploadEvalSuite(suite);
    expect(dataset.id).toBeDefined();
    expect(dataset.name).toBe('Test Suite');
  });

  it('listDatasets returns uploaded datasets', async () => {
    await adapter.initialize();
    await adapter.uploadEvalSuite(makeSuite({ id: 'ds-1', name: 'Dataset 1' }));
    await adapter.uploadEvalSuite(makeSuite({ id: 'ds-2', name: 'Dataset 2' }));
    const datasets = await adapter.listDatasets();
    expect(datasets.length).toBe(2);
  });

  it('deleteDataset removes a dataset', async () => {
    await adapter.initialize();
    const dataset = await adapter.uploadEvalSuite(makeSuite());
    const deleted = await adapter.deleteDataset(dataset.id);
    expect(deleted).toBe(true);
  });

  it('convertEvaluatorsToScores maps evaluator types', () => {
    const scores = adapter.convertEvaluatorsToScores([
      makeEvaluator({ type: 'heuristic' }),
      makeEvaluator({ name: 'llm-eval', type: 'llm-judge' }),
    ]);
    expect(scores.length).toBe(2);
    expect(scores[0].type).toBe('exact');
    expect(scores[1].type).toBe('llm');
  });

  it('compareExperiments throws when not connected', async () => {
    await expect(adapter.compareExperiments('a', 'b')).rejects.toThrow();
  });
});

// ─── LangSmithBridge ──────────────────────────────────────────────────────────

describe('LangSmithBridge', () => {
  let bridge: LangSmithBridge;

  beforeEach(() => {
    resetLangSmithBridge();
    bridge = createLangSmithBridge({
      apiKey: 'test-key',
      endpoint: 'https://api.smith.langchain.com',
      projectName: 'Test Project',
    });
  });

  it('creates bridge instance', () => {
    expect(bridge).toBeInstanceOf(LangSmithBridge);
  });

  it('isConnected returns false before initialize', () => {
    expect(bridge.isConnected()).toBe(false);
  });

  it('initialize connects the client', async () => {
    const connected = await bridge.initialize();
    expect(connected).toBe(true);
    expect(bridge.isConnected()).toBe(true);
  });

  it('exportSpan exports a span and returns run id', async () => {
    await bridge.initialize();
    const obs = createCinematicObservability();
    const spanId = obs.recordSpan(makeSpanInput({ name: 'export-test' }));
    const span = obs.getSpan(spanId)!;
    const runId = await bridge.exportSpan(span);
    expect(runId).toBeTruthy();
    expect(typeof runId).toBe('string');
  });

  it('exportSpans exports multiple spans', async () => {
    await bridge.initialize();
    const obs = createCinematicObservability();
    const id1 = obs.recordSpan(makeSpanInput({ name: 'span-1' }));
    const id2 = obs.recordSpan(makeSpanInput({ name: 'span-2' }));
    const spans = [obs.getSpan(id1)!, obs.getSpan(id2)!];
    const runIds = await bridge.exportSpans(spans);
    expect(runIds.length).toBe(2);
  });

  it('getStats returns bridge statistics', async () => {
    await bridge.initialize();
    const stats = bridge.getStats();
    expect(stats.projectName).toBe('Test Project');
    expect(stats.exportedSpans).toBe(0);
  });

  it('disconnect cleans up', async () => {
    await bridge.initialize();
    await bridge.disconnect();
    expect(bridge.isConnected()).toBe(false);
  });
});
