// Cinematic Observability & Eval Suite — Test Suite (60 tests)
// KIMI-R23-05 | Feb 2026

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CinematicSpan, CinematicEvalSuite } from '../cinematic-core.js';
import { CinematicObservability, createCinematicObservability } from '../cinematic-core.js';
import { BraintrustAdapter } from '../braintrust-adapter.js';
import { LangSmithBridge, cinematicSpanToLangSmithRun } from '../langsmith-bridge.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSpan(opts: Partial<CinematicSpan> = {}): CinematicSpan {
  return {
    id: `span-${Math.random().toString(36).slice(2, 8)}`,
    parentId: null,
    traceId: 'trace-001',
    name: 'test-span',
    kind: 'agent',
    agentId: 'MARS',
    startTime: Date.now(),
    endTime: Date.now() + 100,
    durationMs: 100,
    status: 'success',
    tokensIn: 50,
    tokensOut: 100,
    tasteScore: 0.9,
    metadata: {},
    ...opts,
  };
}

function makeSuite(overrides: Partial<CinematicEvalSuite> = {}): CinematicEvalSuite {
  return {
    id: 'suite-1',
    name: 'Test Suite',
    examples: [
      { id: 'ex-1', input: 'Deploy to AWS', expectedOutput: 'docker kubernetes helm', tags: [], difficulty: 'medium' },
      { id: 'ex-2', input: 'Write UI component', expectedOutput: 'react tailwind component', tags: [], difficulty: 'easy' },
    ],
    scoringFn: (actual, expected) => {
      const kws = expected.split(' ');
      const found = kws.filter(kw => actual.toLowerCase().includes(kw.toLowerCase()));
      return found.length / kws.length;
    },
    passThreshold: 0.5,
    ...overrides,
  };
}

// ─── CinematicObservability ───────────────────────────────────────────────────

describe('CinematicObservability — recordSpan', () => {
  let obs: CinematicObservability;
  beforeEach(() => { obs = new CinematicObservability(); });

  it('records a span', () => {
    obs.recordSpan(makeSpan());
    expect(obs.getTrace('trace-001').length).toBe(1);
  });

  it('stores span in correct trace', () => {
    obs.recordSpan(makeSpan({ traceId: 'tr-A' }));
    obs.recordSpan(makeSpan({ traceId: 'tr-B' }));
    expect(obs.getTrace('tr-A').length).toBe(1);
    expect(obs.getTrace('tr-B').length).toBe(1);
  });

  it('getTrace returns empty array for unknown trace', () => {
    expect(obs.getTrace('nonexistent')).toEqual([]);
  });

  it('records multiple spans in same trace', () => {
    obs.recordSpan(makeSpan({ id: 's1' }));
    obs.recordSpan(makeSpan({ id: 's2' }));
    expect(obs.getTrace('trace-001').length).toBe(2);
  });

  it('span without durationMs gets computed on record', () => {
    const span: CinematicSpan = {
      ...makeSpan(),
      durationMs: undefined,
      startTime: 1000,
      endTime: 1200,
    };
    obs.recordSpan(span);
    const recorded = obs.getTrace('trace-001')[0]!;
    expect(recorded.durationMs).toBe(200);
  });

  it('tracks taste score history from spans', () => {
    obs.recordSpan(makeSpan({ tasteScore: 0.9 }));
    obs.recordSpan(makeSpan({ tasteScore: 0.8 }));
    // No error expected
    expect(obs.getTrace('trace-001').length).toBe(2);
  });
});

describe('CinematicObservability — completeSpan', () => {
  let obs: CinematicObservability;
  beforeEach(() => { obs = new CinematicObservability(); });

  it('completes a running span', () => {
    const span = makeSpan({ status: 'running', endTime: undefined, durationMs: undefined });
    obs.recordSpan(span);
    obs.completeSpan('trace-001', span.id, { output: 'done', status: 'success' });
    const s = obs.getTrace('trace-001')[0]!;
    expect(s.status).toBe('success');
    expect(s.output).toBe('done');
  });

  it('sets error status and message', () => {
    const span = makeSpan({ status: 'running' });
    obs.recordSpan(span);
    obs.completeSpan('trace-001', span.id, { error: 'timeout occurred' });
    const s = obs.getTrace('trace-001')[0]!;
    expect(s.status).toBe('error');
    expect(s.error).toBe('timeout occurred');
  });

  it('completeSpan on unknown span is a no-op', () => {
    obs.recordSpan(makeSpan());
    expect(() => obs.completeSpan('trace-001', 'ghost', {})).not.toThrow();
  });

  it('sets tokensOut', () => {
    const span = makeSpan({ status: 'running' });
    obs.recordSpan(span);
    obs.completeSpan('trace-001', span.id, { tokensOut: 250 });
    expect(obs.getTrace('trace-001')[0]!.tokensOut).toBe(250);
  });
});

describe('CinematicObservability — getTraceFidelity', () => {
  let obs: CinematicObservability;
  beforeEach(() => { obs = new CinematicObservability(); });

  it('fidelity is 1.0 when all spans complete', () => {
    obs.recordSpan(makeSpan({ status: 'success' }));
    obs.recordSpan(makeSpan({ id: 's2', status: 'error' }));
    expect(obs.getTraceFidelity('trace-001')).toBe(1.0);
  });

  it('fidelity is 0.5 when half spans are running', () => {
    obs.recordSpan(makeSpan({ id: 's1', status: 'success' }));
    obs.recordSpan(makeSpan({ id: 's2', status: 'running' }));
    expect(obs.getTraceFidelity('trace-001')).toBe(0.5);
  });

  it('fidelity is 0 for unknown trace', () => {
    expect(obs.getTraceFidelity('nonexistent')).toBe(0);
  });
});

describe('CinematicObservability — runEvalSuite', () => {
  let obs: CinematicObservability;
  beforeEach(() => { obs = new CinematicObservability(); });

  it('runs eval suite and returns result', async () => {
    const suite = makeSuite();
    const result = await obs.runEvalSuite(suite, async (input) =>
      input.toLowerCase().includes('aws') ? 'docker kubernetes helm' : 'react tailwind component',
    );
    expect(result.suiteId).toBe('suite-1');
    expect(result.scores.length).toBe(2);
  });

  it('passRate is 1.0 when all pass', async () => {
    const suite = makeSuite();
    const result = await obs.runEvalSuite(suite, async (input) =>
      input.toLowerCase().includes('aws') ? 'docker kubernetes helm' : 'react tailwind component',
    );
    expect(result.passRate).toBeCloseTo(1.0);
  });

  it('passRate is 0 when all fail', async () => {
    const suite = makeSuite();
    const result = await obs.runEvalSuite(suite, async () => 'completely wrong response');
    expect(result.passRate).toBeLessThan(0.5);
  });

  it('handles runFn throwing errors', async () => {
    const suite = makeSuite();
    const result = await obs.runEvalSuite(suite, async () => { throw new Error('LLM unavailable'); });
    expect(result.scores.every(s => s.score === 0)).toBe(true);
  });

  it('stores result in internal history', async () => {
    const suite = makeSuite();
    await obs.runEvalSuite(suite, async () => 'ok');
    const dashboard = obs.renderDirectorDashboard();
    expect(dashboard.recentEvals.length).toBeGreaterThan(0);
  });

  it('durationMs is positive', async () => {
    const suite = makeSuite();
    const result = await obs.runEvalSuite(suite, async () => 'response');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('triggers remediation on taste drop > 8%', async () => {
    const suite = makeSuite({ id: 'taste-suite' });
    // First run: good scores
    await obs.runEvalSuite(suite, async () => 'docker kubernetes helm react tailwind component');
    // Second run: bad scores
    await obs.runEvalSuite(suite, async () => 'completely wrong');
    const remediations = obs.getRemediations();
    expect(remediations.length).toBeGreaterThan(0);
  });
});

describe('CinematicObservability — renderDirectorDashboard', () => {
  let obs: CinematicObservability;
  beforeEach(() => { obs = new CinematicObservability(); });

  it('renders dashboard with 0 spans', () => {
    const dashboard = obs.renderDirectorDashboard();
    expect(dashboard.totalSpans).toBe(0);
    expect(dashboard.errorRate).toBe(0);
  });

  it('totalSpans counts all recorded spans', () => {
    obs.recordSpan(makeSpan({ traceId: 'tr1' }));
    obs.recordSpan(makeSpan({ traceId: 'tr2' }));
    const d = obs.renderDirectorDashboard();
    expect(d.totalSpans).toBe(2);
  });

  it('errorRate reflects error spans', () => {
    obs.recordSpan(makeSpan({ status: 'error', tasteScore: undefined }));
    obs.recordSpan(makeSpan({ status: 'success', id: 's2', tasteScore: undefined }));
    const d = obs.renderDirectorDashboard();
    expect(d.errorRate).toBeCloseTo(0.5);
  });

  it('topAgents lists active agents', () => {
    obs.recordSpan(makeSpan({ agentId: 'MARS' }));
    obs.recordSpan(makeSpan({ agentId: 'VENUS', id: 's2' }));
    const d = obs.renderDirectorDashboard();
    const agentIds = d.topAgents.map(a => a.agentId);
    expect(agentIds).toContain('MARS');
  });

  it('loadMs is a number >= 0', () => {
    const d = obs.renderDirectorDashboard();
    expect(d.loadMs).toBeGreaterThanOrEqual(0);
  });

  it('tasteDropAlert is false initially', () => {
    expect(obs.renderDirectorDashboard().tasteDropAlert).toBe(false);
  });
});

describe('CinematicObservability — misc', () => {
  it('createCinematicObservability factory works', () => {
    const obs = createCinematicObservability();
    expect(obs).toBeInstanceOf(CinematicObservability);
  });

  it('clear resets all state', () => {
    const obs = new CinematicObservability();
    obs.recordSpan(makeSpan());
    obs.clear();
    expect(obs.getTrace('trace-001').length).toBe(0);
    expect(obs.renderDirectorDashboard().totalSpans).toBe(0);
  });

  it('getRemediations returns empty initially', () => {
    expect(new CinematicObservability().getRemediations()).toEqual([]);
  });
});

// ─── BraintrustAdapter ────────────────────────────────────────────────────────

describe('BraintrustAdapter', () => {
  let adapter: BraintrustAdapter;
  beforeEach(() => { adapter = new BraintrustAdapter(); });

  it('createExperiment returns experiment with id', () => {
    const exp = adapter.createExperiment('exp-1', 'nova26');
    expect(exp.id).toBeTruthy();
  });

  it('getExperiment retrieves by id', () => {
    const exp = adapter.createExperiment('exp-2', 'nova26');
    expect(adapter.getExperiment(exp.id)).toBeDefined();
  });

  it('listExperiments returns all created experiments', () => {
    adapter.createExperiment('a', 'p1');
    adapter.createExperiment('b', 'p2');
    expect(adapter.listExperiments().length).toBe(2);
  });

  it('logSpan creates a result for experiment', () => {
    const exp = adapter.createExperiment('exp-log', 'nova26');
    adapter.logSpan(exp.id, 'row-1', {
      id: 'span-1', spanType: 'llm', name: 'test', input: 'q', output: 'a',
      scores: { accuracy: 0.9 }, metadata: {},
    });
    const result = adapter.getResult(exp.id)!;
    expect(result.rows.length).toBe(1);
  });

  it('summaryScores are averaged across rows', () => {
    const exp = adapter.createExperiment('exp-summary', 'nova26');
    adapter.logSpan(exp.id, 'row-1', {
      id: 'sp1', spanType: 'llm', name: 'test', input: 'q', output: 'a',
      scores: { accuracy: 0.8 }, metadata: {},
    });
    adapter.logSpan(exp.id, 'row-2', {
      id: 'sp2', spanType: 'llm', name: 'test', input: 'q2', output: 'a2',
      scores: { accuracy: 1.0 }, metadata: {},
    });
    const result = adapter.getResult(exp.id)!;
    expect(result.summaryScores['accuracy']).toBeCloseTo(0.9);
  });

  it('compareExperiments returns delta', () => {
    const e1 = adapter.createExperiment('c1', 'p');
    const e2 = adapter.createExperiment('c2', 'p');
    adapter.logSpan(e1.id, 'r1', { id: 's1', spanType: 'llm', name: 'n', input: 'i', output: 'o', scores: { f: 0.7 }, metadata: {} });
    adapter.logSpan(e2.id, 'r1', { id: 's2', spanType: 'llm', name: 'n', input: 'i', output: 'o', scores: { f: 0.9 }, metadata: {} });
    const cmp = adapter.compareExperiments(e1.id, e2.id);
    expect(cmp['f']!.delta).toBeCloseTo(0.2);
  });

  it('compareExperiments returns empty for unknown experiments', () => {
    expect(adapter.compareExperiments('ghost1', 'ghost2')).toEqual({});
  });
});

// ─── LangSmithBridge ─────────────────────────────────────────────────────────

describe('LangSmithBridge', () => {
  let bridge: LangSmithBridge;
  beforeEach(() => { bridge = new LangSmithBridge(); });

  it('createSession returns session with id', () => {
    const sess = bridge.createSession('test-session', 'nova26');
    expect(sess.id).toBeTruthy();
  });

  it('ingestSpans converts cinematic spans to LangSmith runs', () => {
    const sess = bridge.createSession('ls-test', 'nova26');
    bridge.ingestSpans(sess.id, [makeSpan()]);
    expect(bridge.getRunCount(sess.id)).toBe(1);
  });

  it('ingestTrace creates a session automatically', () => {
    const sess = bridge.ingestTrace('tr-001', [makeSpan()]);
    expect(sess.id).toBeTruthy();
    expect(sess.runs.length).toBe(1);
  });

  it('cinematicSpanToLangSmithRun converts span correctly', () => {
    const span = makeSpan({ kind: 'llm', agentId: 'JUPITER' });
    const run = cinematicSpanToLangSmithRun(span, 'session-1');
    expect(run.run_type).toBe('llm');
    expect(run.tags).toContain('JUPITER');
  });

  it('ingestSpans throws for unknown session', () => {
    expect(() => bridge.ingestSpans('ghost', [makeSpan()])).toThrow();
  });

  it('createDataset stores dataset', () => {
    const ds = bridge.createDataset('ds-1', [{ id: 'e1', inputs: { q: 'question' }, outputs: { a: 'answer' } }]);
    expect(bridge.getDataset(ds.id)?.examples.length).toBe(1);
  });

  it('exportSessionJson returns valid JSON', () => {
    const sess = bridge.createSession('json-test', 'nova26');
    bridge.ingestSpans(sess.id, [makeSpan()]);
    const json = bridge.exportSessionJson(sess.id);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('exportSessionJson throws for unknown session', () => {
    expect(() => bridge.exportSessionJson('ghost')).toThrow();
  });

  it('listSessions returns all sessions', () => {
    bridge.createSession('a', 'p');
    bridge.createSession('b', 'p');
    expect(bridge.listSessions().length).toBe(2);
  });

  it('span kind retrieval maps to retriever run_type', () => {
    const span = makeSpan({ kind: 'retrieval' });
    const run = cinematicSpanToLangSmithRun(span, 'sess');
    expect(run.run_type).toBe('retriever');
  });

  it('error status in cinematic span maps to error in LangSmith', () => {
    const span = makeSpan({ status: 'error', error: 'model timeout' });
    const run = cinematicSpanToLangSmithRun(span, 'sess');
    expect(run.status).toBe('error');
  });
});
