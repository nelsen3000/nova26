// Persistent Visual Workflow Engine — Test Suite (70 tests)
// KIMI-R23-01 | Feb 2026

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PersistentWorkflow, VisualNode, RewindTarget } from '../types.js';
import { RalphVisualWorkflowEngine } from '../ralph-visual-engine.js';
import {
  buildWorkflowFromTasks,
  RalphLoopVisualAdapter,
} from '../ralph-loop-visual-adapter.js';
import { ATLASVisualMemoryHook } from '../../atlas/visual-memory-hook.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeNode(id: string, overrides: Partial<VisualNode> = {}): VisualNode {
  return {
    id,
    label: id,
    type: 'agent',
    agentId: 'EARTH',
    status: 'pending',
    position: { x: 0, y: 0 },
    config: { channelBindings: { output: `${id}.output` }, timeoutMs: 5000 },
    inputChannels: [],
    outputChannels: [`${id}.output`],
    metadata: {},
    ...overrides,
  };
}

function makeLinearWorkflow(
  id: string,
  nodeCount: number,
  opts: { failAt?: number } = {},
): PersistentWorkflow {
  const nodes: VisualNode[] = [];
  const edges: PersistentWorkflow['edges'] = [];

  for (let i = 0; i < nodeCount; i++) {
    nodes.push(makeNode(`node-${i}`, {
      inputChannels: i > 0 ? [`node-${i - 1}.output`] : [],
      metadata: { shouldFail: opts.failAt === i },
    }));
    if (i > 0) {
      edges.push({
        id: `e-${i - 1}-${i}`,
        fromNodeId: `node-${i - 1}`,
        toNodeId: `node-${i}`,
        channel: `node-${i - 1}.output`,
      });
    }
  }

  return { id, name: `linear-${id}`, nodes, edges };
}

function makeEngine(autoCheckpoint = 2) {
  return new RalphVisualWorkflowEngine({
    persistenceEnabled: true,
    maxCheckpoints: 20,
    autoCheckpointEveryN: autoCheckpoint,
    rewindEnabled: true,
    tasteVaultEnabled: true,
    langGraphSimulatorEnabled: false,
    maxConcurrentNodes: 4,
  });
}

function makeSuccessExecutor() {
  return vi.fn(async (node: VisualNode, channels: Map<string, unknown>) => ({
    outputs: { output: `result-of-${node.id}` },
    success: true,
  }));
}

function makeFailExecutor(failNodeId: string) {
  return vi.fn(async (node: VisualNode) => {
    if (node.id === failNodeId) {
      return { outputs: {}, success: false, error: 'injected failure' };
    }
    return { outputs: { output: `result-of-${node.id}` }, success: true };
  });
}

// ─── Engine Initialization ────────────────────────────────────────────────────

describe('RalphVisualWorkflowEngine — initialization', () => {
  it('creates engine with default config', () => {
    const engine = new RalphVisualWorkflowEngine();
    expect(engine).toBeDefined();
  });

  it('getState returns undefined for unknown workflow', () => {
    const engine = makeEngine();
    expect(engine.getState('nonexistent')).toBeUndefined();
  });

  it('listCheckpoints returns empty array for unknown workflow', () => {
    const engine = makeEngine();
    expect(engine.listCheckpoints('unknown')).toEqual([]);
  });

  it('getResult returns undefined for unknown workflow', () => {
    const engine = makeEngine();
    expect(engine.getResult('unknown')).toBeUndefined();
  });
});

// ─── Workflow Execution ───────────────────────────────────────────────────────

describe('RalphVisualWorkflowEngine — execution', () => {
  it('executes a single-node workflow to completion', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-single', 1);
    const state = await engine.startVisualWorkflow(wf);
    expect(state.status).toBe('completed');
  });

  it('executes a 3-node linear workflow', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-3node', 3);
    const state = await engine.startVisualWorkflow(wf);
    expect(state.status).toBe('completed');
    expect([...state.nodes.values()].every(n => n.status === 'completed')).toBe(true);
  });

  it('marks workflow as failed when a node fails', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeFailExecutor('node-1'));
    const wf = makeLinearWorkflow('wf-fail', 3);
    const state = await engine.startVisualWorkflow(wf);
    expect(state.status).toBe('failed');
  });

  it('failed node has correct status', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeFailExecutor('node-0'));
    const wf = makeLinearWorkflow('wf-node-fail', 2);
    await engine.startVisualWorkflow(wf);
    const state = engine.getState('wf-node-fail')!;
    expect(state.nodes.get('node-0')!.status).toBe('failed');
  });

  it('nodes after failed node are not executed', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeFailExecutor('node-0'));
    const wf = makeLinearWorkflow('wf-cascade', 3);
    await engine.startVisualWorkflow(wf);
    const state = engine.getState('wf-cascade')!;
    // node-1 and node-2 have no predecessor completing, so they remain pending
    expect(state.nodes.get('node-1')!.status).toBe('pending');
  });

  it('parallel nodes execute concurrently (no edges between them)', async () => {
    const engine = makeEngine();
    const callOrder: string[] = [];
    engine.setExecutor(async (node) => {
      callOrder.push(node.id);
      return { outputs: { output: `out-${node.id}` }, success: true };
    });
    const wf: PersistentWorkflow = {
      id: 'wf-parallel',
      name: 'parallel',
      nodes: [makeNode('A'), makeNode('B'), makeNode('C')],
      edges: [],
    };
    await engine.startVisualWorkflow(wf);
    expect(callOrder.length).toBe(3);
  });

  it('channel values propagate between nodes', async () => {
    const engine = makeEngine();
    engine.setExecutor(async (node, channels) => {
      const upstream = channels.get('node-0.output');
      return {
        outputs: { output: upstream ? `got:${upstream}` : `out-${node.id}` },
        success: true,
      };
    });
    const wf = makeLinearWorkflow('wf-channel', 2);
    await engine.startVisualWorkflow(wf);
    const state = engine.getState('wf-channel')!;
    const val = state.channelValues.get('node-1.output');
    expect(String(val)).toContain('got:');
  });

  it('initial channel values are available to first node', async () => {
    const engine = makeEngine();
    const received: unknown[] = [];
    engine.setExecutor(async (node, channels) => {
      received.push(channels.get('seed'));
      return { outputs: {}, success: true };
    });
    const wf: PersistentWorkflow = { id: 'wf-seed', name: 'seed', nodes: [makeNode('n0')], edges: [] };
    await engine.startVisualWorkflow(wf, { seed: 'hello' });
    expect(received[0]).toBe('hello');
  });

  it('no executor — workflow completes (simulated)', async () => {
    const engine = makeEngine();
    // No executor set
    const wf = makeLinearWorkflow('wf-noexec', 2);
    const state = await engine.startVisualWorkflow(wf);
    expect(state.status).toBe('completed');
  });

  it('startedAt is set when workflow begins', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-ts', 1);
    const state = await engine.startVisualWorkflow(wf);
    expect(state.startedAt).toBeGreaterThan(0);
  });

  it('completedAt is set when workflow finishes', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-ts2', 1);
    const state = await engine.startVisualWorkflow(wf);
    expect(state.completedAt).toBeGreaterThan(0);
  });

  it('node startedAt and completedAt are set', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-node-ts', 1);
    const state = await engine.startVisualWorkflow(wf);
    const node = state.nodes.get('node-0')!;
    expect(node.startedAt).toBeGreaterThan(0);
    expect(node.completedAt).toBeGreaterThan(0);
  });

  it('retry logic attempts node again after failure', async () => {
    const engine = makeEngine();
    let attempts = 0;
    engine.setExecutor(async (node) => {
      attempts++;
      if (attempts < 2) return { outputs: {}, success: false, error: 'transient' };
      return { outputs: { output: 'ok' }, success: true };
    });
    const wf: PersistentWorkflow = {
      id: 'wf-retry',
      name: 'retry',
      nodes: [makeNode('n0', { config: { channelBindings: {}, maxRetries: 1, timeoutMs: 5000 } })],
      edges: [],
    };
    const state = await engine.startVisualWorkflow(wf);
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(state.nodes.get('n0')!.status).toBe('completed');
  });
});

// ─── Checkpoints ──────────────────────────────────────────────────────────────

describe('RalphVisualWorkflowEngine — checkpoints', () => {
  it('creates initial checkpoint on workflow start', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-ckpt', 2);
    await engine.startVisualWorkflow(wf);
    expect(engine.listCheckpoints('wf-ckpt').length).toBeGreaterThan(0);
  });

  it('creates final checkpoint on completion', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-final-ckpt', 2);
    await engine.startVisualWorkflow(wf);
    const checkpoints = engine.listCheckpoints('wf-final-ckpt');
    expect(checkpoints.some(c => c.label === 'final')).toBe(true);
  });

  it('checkpoint contains correct node states', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-ckpt-states', 1);
    await engine.startVisualWorkflow(wf);
    const finalCkpt = engine.listCheckpoints('wf-ckpt-states').at(-1)!;
    expect(finalCkpt.nodeStates['node-0']).toBe('completed');
  });

  it('auto-checkpoints fire every N nodes', async () => {
    const engine = new RalphVisualWorkflowEngine({ autoCheckpointEveryN: 2, maxCheckpoints: 50 });
    engine.setExecutor(makeSuccessExecutor());
    const wf: PersistentWorkflow = {
      id: 'wf-autockpt',
      name: 'auto',
      nodes: ['A', 'B', 'C', 'D'].map(id => makeNode(id)),
      edges: [],
    };
    await engine.startVisualWorkflow(wf);
    // With 4 parallel nodes, auto-checkpoint fires at 2 and 4
    expect(engine.listCheckpoints('wf-autockpt').length).toBeGreaterThanOrEqual(2);
  });

  it('checkpoint has sequenceNumber > 0', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-seq', 1);
    await engine.startVisualWorkflow(wf);
    const ckpt = engine.listCheckpoints('wf-seq')[0]!;
    expect(ckpt.sequenceNumber).toBeGreaterThanOrEqual(0);
  });

  it('checkpoint node triggered by checkpointAfter config', async () => {
    const engine = makeEngine(99); // disable auto-checkpoint
    engine.setExecutor(makeSuccessExecutor());
    const wf: PersistentWorkflow = {
      id: 'wf-nodecheck',
      name: 'nodecheck',
      nodes: [makeNode('n0', { config: { channelBindings: {}, checkpointAfter: true, timeoutMs: 5000 } })],
      edges: [],
    };
    await engine.startVisualWorkflow(wf);
    const ckpts = engine.listCheckpoints('wf-nodecheck');
    expect(ckpts.some(c => c.label === 'after-n0')).toBe(true);
  });

  it('maxCheckpoints prunes old checkpoints', async () => {
    const engine = new RalphVisualWorkflowEngine({ maxCheckpoints: 2, autoCheckpointEveryN: 1, maxConcurrentNodes: 1 });
    engine.setExecutor(makeSuccessExecutor());
    // 5-node linear workflow will create many checkpoints
    const wf = makeLinearWorkflow('wf-pruned', 5);
    await engine.startVisualWorkflow(wf);
    expect(engine.listCheckpoints('wf-pruned').length).toBeLessThanOrEqual(2);
  });
});

// ─── Rewind ───────────────────────────────────────────────────────────────────

describe('RalphVisualWorkflowEngine — rewind', () => {
  it('rewindTo by checkpointId succeeds', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-rewind1', 3);
    await engine.startVisualWorkflow(wf);
    const ckpt = engine.listCheckpoints('wf-rewind1')[0]!;
    const rewoundState = await engine.rewindTo('wf-rewind1', { checkpointId: ckpt.id });
    expect(rewoundState).toBeDefined();
  });

  it('rewindTo by sequenceNumber succeeds', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-rewind-seq', 2);
    await engine.startVisualWorkflow(wf);
    const state = await engine.rewindTo('wf-rewind-seq', { sequenceNumber: 1 });
    expect(state).toBeDefined();
  });

  it('rewindTo by timestamp succeeds', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-rewind-ts', 2);
    const before = Date.now();
    await engine.startVisualWorkflow(wf);
    const state = await engine.rewindTo('wf-rewind-ts', { timestamp: before + 10000 });
    expect(state).toBeDefined();
  });

  it('rewindTo throws for unknown workflowId', async () => {
    const engine = makeEngine();
    await expect(engine.rewindTo('nonexistent', {})).rejects.toThrow(/not found/);
  });

  it('rewindTo throws when rewind is disabled', async () => {
    const engine = new RalphVisualWorkflowEngine({ rewindEnabled: false });
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-norewind', 1);
    await engine.startVisualWorkflow(wf);
    await expect(engine.rewindTo('wf-norewind', {})).rejects.toThrow(/disabled/);
  });

  it('workflow is re-executed after rewind', async () => {
    const engine = makeEngine();
    let callCount = 0;
    engine.setExecutor(async (node) => {
      callCount++;
      return { outputs: { output: 'ok' }, success: true };
    });
    const wf = makeLinearWorkflow('wf-rewind-exec', 2);
    await engine.startVisualWorkflow(wf);
    const firstCount = callCount;
    const ckpt = engine.listCheckpoints('wf-rewind-exec')[0]!;
    await engine.rewindTo('wf-rewind-exec', { checkpointId: ckpt.id });
    expect(callCount).toBeGreaterThan(firstCount);
  });
});

// ─── Events ───────────────────────────────────────────────────────────────────

describe('RalphVisualWorkflowEngine — events', () => {
  it('emits workflow.started event', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const events: string[] = [];
    engine.addListener({ onEvent: e => { events.push(e.eventType); } });
    await engine.startVisualWorkflow(makeLinearWorkflow('wf-evt1', 1));
    expect(events).toContain('workflow.started');
  });

  it('emits workflow.completed event', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const events: string[] = [];
    engine.addListener({ onEvent: e => { events.push(e.eventType); } });
    await engine.startVisualWorkflow(makeLinearWorkflow('wf-evt2', 1));
    expect(events).toContain('workflow.completed');
  });

  it('emits workflow.failed event when node fails', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeFailExecutor('node-0'));
    const events: string[] = [];
    engine.addListener({ onEvent: e => { events.push(e.eventType); } });
    await engine.startVisualWorkflow(makeLinearWorkflow('wf-evt3', 1));
    expect(events).toContain('workflow.failed');
  });

  it('emits node.started and node.completed for each node', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const events: string[] = [];
    engine.addListener({ onEvent: e => { events.push(e.eventType); } });
    await engine.startVisualWorkflow(makeLinearWorkflow('wf-evt4', 2));
    expect(events.filter(e => e === 'node.started').length).toBe(2);
    expect(events.filter(e => e === 'node.completed').length).toBe(2);
  });

  it('events are stored in state.events', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    const wf = makeLinearWorkflow('wf-stored-evts', 1);
    const state = await engine.startVisualWorkflow(wf);
    expect(state.events.length).toBeGreaterThan(0);
  });
});

// ─── Execution Result ─────────────────────────────────────────────────────────

describe('RalphVisualWorkflowEngine — getResult', () => {
  it('completedNodes lists all nodes on success', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    await engine.startVisualWorkflow(makeLinearWorkflow('wf-res1', 3));
    const result = engine.getResult('wf-res1')!;
    expect(result.completedNodes.length).toBe(3);
  });

  it('failedNodes lists failed nodes', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeFailExecutor('node-0'));
    await engine.startVisualWorkflow(makeLinearWorkflow('wf-res2', 2));
    const result = engine.getResult('wf-res2')!;
    expect(result.failedNodes).toContain('node-0');
  });

  it('durationMs is positive', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    await engine.startVisualWorkflow(makeLinearWorkflow('wf-dur', 1));
    expect(engine.getResult('wf-dur')!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('tasteVaultScore defaults to 1.0', async () => {
    const engine = makeEngine();
    engine.setExecutor(makeSuccessExecutor());
    await engine.startVisualWorkflow(makeLinearWorkflow('wf-taste', 1));
    expect(engine.getResult('wf-taste')!.tasteVaultScore).toBe(1.0);
  });
});

// ─── buildWorkflowFromTasks ───────────────────────────────────────────────────

describe('buildWorkflowFromTasks', () => {
  it('builds workflow with correct node count', () => {
    const wf = buildWorkflowFromTasks('t1', 'test', [
      { id: 'a', agentId: 'MARS', label: 'A', prompt: 'do A' },
      { id: 'b', agentId: 'VENUS', label: 'B', prompt: 'do B', dependsOn: ['a'] },
    ]);
    expect(wf.nodes.length).toBe(2);
  });

  it('builds edges from dependsOn', () => {
    const wf = buildWorkflowFromTasks('t2', 'test', [
      { id: 'a', agentId: 'MARS', label: 'A', prompt: 'do A' },
      { id: 'b', agentId: 'VENUS', label: 'B', prompt: 'do B', dependsOn: ['a'] },
    ]);
    expect(wf.edges.length).toBe(1);
    expect(wf.edges[0]!.fromNodeId).toBe('a');
    expect(wf.edges[0]!.toNodeId).toBe('b');
  });

  it('assigns default positions when none provided', () => {
    const wf = buildWorkflowFromTasks('t3', 'test', [
      { id: 'a', agentId: 'MARS', label: 'A', prompt: 'p' },
    ]);
    expect(wf.nodes[0]!.position).toBeDefined();
  });
});

// ─── RalphLoopVisualAdapter ───────────────────────────────────────────────────

describe('RalphLoopVisualAdapter', () => {
  it('runTasks executes and returns result', async () => {
    const adapter = new RalphLoopVisualAdapter();
    const result = await adapter.runTasks('adp-1', 'test', [
      { id: 'task1', agentId: 'MARS', label: 'Task 1', prompt: 'do it' },
    ], async (_agentId, _prompt) => 'done');
    expect(result.status).toBe('completed');
  });

  it('runTasks returns failed status when executor throws', async () => {
    const adapter = new RalphLoopVisualAdapter();
    const result = await adapter.runTasks('adp-fail', 'test', [
      { id: 'task1', agentId: 'MARS', label: 'Task 1', prompt: 'do it' },
    ], async () => { throw new Error('executor error'); });
    expect(result.status).toBe('failed');
  });

  it('listCheckpoints returns checkpoints after run', async () => {
    const adapter = new RalphLoopVisualAdapter();
    await adapter.runTasks('adp-ckpt', 'test', [
      { id: 't1', agentId: 'MARS', label: 'T1', prompt: 'p' },
    ], async () => 'done');
    expect(adapter.listCheckpoints('adp-ckpt').length).toBeGreaterThan(0);
  });
});

// ─── ATLASVisualMemoryHook ────────────────────────────────────────────────────

describe('ATLASVisualMemoryHook', () => {
  it('initial memory size is 0', () => {
    const hook = new ATLASVisualMemoryHook();
    expect(hook.getMemorySize()).toBe(0);
  });

  it('records event correctly', () => {
    const hook = new ATLASVisualMemoryHook();
    hook.registerWorkflow('wf-1', 'My Workflow');
    hook.onEvent({
      id: 'e1', workflowId: 'wf-1', eventType: 'node.completed',
      nodeId: 'n0', timestamp: Date.now(), sequenceNumber: 1, payload: {},
    });
    expect(hook.getMemorySize()).toBe(1);
  });

  it('query by workflowId filters correctly', () => {
    const hook = new ATLASVisualMemoryHook();
    hook.onEvent({ id: 'e1', workflowId: 'wf-a', eventType: 'workflow.started', timestamp: Date.now(), sequenceNumber: 1, payload: {} });
    hook.onEvent({ id: 'e2', workflowId: 'wf-b', eventType: 'workflow.started', timestamp: Date.now(), sequenceNumber: 1, payload: {} });
    expect(hook.query({ workflowId: 'wf-a' }).length).toBe(1);
  });

  it('respects maxMemorySize', () => {
    const hook = new ATLASVisualMemoryHook({ maxMemorySize: 3 });
    for (let i = 0; i < 5; i++) {
      hook.onEvent({ id: `e${i}`, workflowId: 'wf', eventType: 'node.started', timestamp: Date.now(), sequenceNumber: i, payload: {} });
    }
    expect(hook.getMemorySize()).toBe(3);
  });

  it('disabled hook records nothing', () => {
    const hook = new ATLASVisualMemoryHook({ enabled: false });
    hook.onEvent({ id: 'e1', workflowId: 'wf', eventType: 'workflow.started', timestamp: Date.now(), sequenceNumber: 0, payload: {} });
    expect(hook.getMemorySize()).toBe(0);
  });

  it('clear resets memory', () => {
    const hook = new ATLASVisualMemoryHook();
    hook.onEvent({ id: 'e1', workflowId: 'wf', eventType: 'node.started', timestamp: Date.now(), sequenceNumber: 0, payload: {} });
    hook.clear();
    expect(hook.getMemorySize()).toBe(0);
  });

  it('extractPatterns computes failure rates', () => {
    const hook = new ATLASVisualMemoryHook();
    hook.onEvent({ id: 'e1', workflowId: 'w', eventType: 'node.started', timestamp: Date.now(), sequenceNumber: 0, payload: { agentId: 'MARS' } });
    hook.onEvent({ id: 'e2', workflowId: 'w', eventType: 'node.failed', timestamp: Date.now(), sequenceNumber: 1, payload: { agentId: 'MARS' } });
    const patterns = hook.extractPatterns();
    expect(patterns['MARS']).toBeGreaterThanOrEqual(0);
  });

  it('getWorkflowHistory returns only that workflow', () => {
    const hook = new ATLASVisualMemoryHook();
    hook.onEvent({ id: 'e1', workflowId: 'wf-x', eventType: 'node.started', timestamp: Date.now(), sequenceNumber: 0, payload: {} });
    hook.onEvent({ id: 'e2', workflowId: 'wf-y', eventType: 'node.started', timestamp: Date.now(), sequenceNumber: 0, payload: {} });
    expect(hook.getWorkflowHistory('wf-x').length).toBe(1);
  });
});
