// Persistent Visual Workflow Engine — Test Suite
// KIMI-R23-01 | Feb 2026

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  PersistentWorkflow,
  VisualNode,
  WorkflowEdge,
  WorkflowState,
  WorkflowEngineOptions,
} from '../types.js';
import type { Task, PRD } from '../../types/index.js';
import { RalphVisualWorkflowEngine, WorkflowEngineError } from '../ralph-visual-engine.js';
import { RalphLoopVisualAdapter } from '../ralph-loop-visual-adapter.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeNode(id: string, overrides: Partial<VisualNode> = {}): VisualNode {
  return {
    id,
    type: 'agent',
    agentId: 'EARTH',
    status: 'pending',
    position: { x: 0, y: 0 },
    config: { entryFunction: `run_${id}`, stateSchema: {}, timeoutMs: 5000 },
    label: id,
    metadata: {},
    ...overrides,
  };
}

function makeState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    currentNodeId: '',
    checkpoints: [],
    variables: {},
    globalStatus: 'idle',
    ...overrides,
  };
}

function makeWorkflow(id: string, nodes: VisualNode[], edges: WorkflowEdge[] = []): PersistentWorkflow {
  return {
    id,
    name: `workflow-${id}`,
    nodes,
    edges,
    state: makeState(),
    timeline: [],
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

function makeLinearWorkflow(id: string, nodeCount: number): PersistentWorkflow {
  const nodes: VisualNode[] = [];
  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(makeNode(`node-${i}`));
    if (i > 0) {
      edges.push({ from: `node-${i - 1}`, to: `node-${i}` });
    }
  }
  return makeWorkflow(id, nodes, edges);
}

// ─── RalphVisualWorkflowEngine — initialization ──────────────────────────────

describe('RalphVisualWorkflowEngine — initialization', () => {
  it('creates engine with a workflow', () => {
    const wf = makeWorkflow('wf-1', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    expect(engine).toBeDefined();
  });

  it('getWorkflow returns the workflow', () => {
    const wf = makeWorkflow('wf-1', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    expect(engine.getWorkflow().id).toBe('wf-1');
  });

  it('getWorkflowState returns initial state', () => {
    const wf = makeWorkflow('wf-1', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    const state = engine.getWorkflowState();
    expect(state.globalStatus).toBe('idle');
  });

  it('getStats returns initial stats', () => {
    const wf = makeWorkflow('wf-1', [makeNode('n1'), makeNode('n2')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    const stats = engine.getStats();
    expect(stats.totalNodes).toBe(2);
    expect(stats.completedNodes).toBe(0);
  });
});

// ─── RalphVisualWorkflowEngine — execution ───────────────────────────────────

describe('RalphVisualWorkflowEngine — execution', () => {
  it('startWorkflow returns workflow id', async () => {
    const wf = makeLinearWorkflow('exec-1', 2);
    const engine = new RalphVisualWorkflowEngine(wf);
    const id = await engine.startWorkflow();
    expect(id).toBe('exec-1');
  });

  it('startWorkflow sets state to running', async () => {
    const wf = makeLinearWorkflow('exec-2', 1);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    const state = engine.getWorkflowState();
    expect(state.globalStatus).toBe('running');
  });

  it('executeNode returns a result', async () => {
    const wf = makeWorkflow('exec-3', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    const result = await engine.executeNode('n1');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('executeNode on unknown node throws', async () => {
    const wf = makeWorkflow('exec-4', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    await expect(engine.executeNode('unknown')).rejects.toThrow();
  });
});

// ─── RalphVisualWorkflowEngine — checkpoints ─────────────────────────────────

describe('RalphVisualWorkflowEngine — checkpoints', () => {
  it('createCheckpoint returns checkpoint id', async () => {
    const wf = makeWorkflow('ckpt-1', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    const ckptId = engine.createCheckpoint('test-checkpoint');
    expect(ckptId).toBeTruthy();
    expect(typeof ckptId).toBe('string');
  });

  it('checkpoint is stored in state', async () => {
    const wf = makeWorkflow('ckpt-2', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    // startWorkflow already creates 'workflow-start' checkpoint
    engine.createCheckpoint('cp-1');
    const state = engine.getWorkflowState();
    // 1 from startWorkflow + 1 manual = 2
    expect(state.checkpoints.length).toBe(2);
    expect(state.checkpoints[1].label).toBe('cp-1');
  });

  it('multiple checkpoints are stored', async () => {
    const wf = makeWorkflow('ckpt-3', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    // startWorkflow creates 1, then we add 2 more
    engine.createCheckpoint('cp-1');
    engine.createCheckpoint('cp-2');
    const state = engine.getWorkflowState();
    expect(state.checkpoints.length).toBe(3);
  });

  it('rewindTo restores to checkpoint', async () => {
    const wf = makeWorkflow('ckpt-4', [makeNode('n1'), makeNode('n2')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    const ckptId = engine.createCheckpoint('before-n2');
    // rewindTo throws if isExecuting is true, so stop first
    engine.stop();
    await engine.rewindTo(ckptId);
    // rewindTo sets 'rewinding' then immediately 'running'
    const state = engine.getWorkflowState();
    expect(state.globalStatus).toBe('running');
  });

  it('rewindTo unknown checkpoint throws', async () => {
    const wf = makeWorkflow('ckpt-5', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    engine.stop();
    await expect(engine.rewindTo('unknown-ckpt')).rejects.toThrow();
  });
});

// ─── RalphVisualWorkflowEngine — pause/resume/stop ───────────────────────────

describe('RalphVisualWorkflowEngine — lifecycle', () => {
  it('pause sets state to paused', async () => {
    const wf = makeWorkflow('lc-1', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    engine.pause();
    expect(engine.getWorkflowState().globalStatus).toBe('paused');
  });

  it('resume sets state back to running', async () => {
    const wf = makeWorkflow('lc-2', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    engine.pause();
    engine.resume();
    expect(engine.getWorkflowState().globalStatus).toBe('running');
  });

  it('stop sets state to idle', async () => {
    const wf = makeWorkflow('lc-3', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    engine.stop();
    expect(engine.getWorkflowState().globalStatus).toBe('idle');
  });

  it('dispose cleans up', async () => {
    const wf = makeWorkflow('lc-4', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    await engine.startWorkflow();
    engine.dispose();
    // Should not throw
  });
});

// ─── RalphVisualWorkflowEngine — events ──────────────────────────────────────

describe('RalphVisualWorkflowEngine — events', () => {
  it('onEvent registers handler and returns unsubscribe', async () => {
    const wf = makeWorkflow('ev-1', [makeNode('n1')]);
    const engine = new RalphVisualWorkflowEngine(wf);
    const events: string[] = [];
    const unsub = engine.onEvent((e) => { events.push(e.type); });
    expect(typeof unsub).toBe('function');
    unsub();
  });
});

// ─── RalphLoopVisualAdapter ──────────────────────────────────────────────────

describe('RalphLoopVisualAdapter', () => {
  it('creates adapter instance', () => {
    const adapter = new RalphLoopVisualAdapter();
    expect(adapter).toBeDefined();
  });

  it('convertTaskToNode converts a task to visual node', () => {
    const adapter = new RalphLoopVisualAdapter();
    const task: Task = {
      id: 't1',
      title: 'Write backend code',
      description: 'Implement the API',
      agent: 'MARS',
      status: 'pending',
      dependencies: [],
      phase: 0,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    const node = adapter.convertTaskToNode(task);
    expect(node.id).toBe('t1');
    expect(node.agentId).toBe('MARS');
    expect(node.status).toBe('pending');
  });

  it('convertPRDToWorkflow creates a workflow from PRD', () => {
    const adapter = new RalphLoopVisualAdapter();
    const prd: PRD = {
      meta: {
        name: 'Test PRD',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
      },
      tasks: [{
        id: 't1',
        title: 'Write backend code',
        description: 'Implement the API',
        agent: 'MARS',
        status: 'pending',
        dependencies: [],
        phase: 0,
        attempts: 0,
        createdAt: new Date().toISOString(),
      }],
    };
    const workflow = adapter.convertPRDToWorkflow(prd);
    expect(workflow.id).toBeDefined();
    expect(workflow.nodes.length).toBeGreaterThan(0);
  });

  it('extractTaskStats returns statistics', () => {
    const adapter = new RalphLoopVisualAdapter();
    const wf = makeWorkflow('stats-1', [
      makeNode('n1', { status: 'complete' }),
      makeNode('n2', { status: 'pending' }),
      makeNode('n3', { status: 'failed' }),
    ]);
    const stats = adapter.extractTaskStats(wf);
    expect(stats).toBeDefined();
  });
});
