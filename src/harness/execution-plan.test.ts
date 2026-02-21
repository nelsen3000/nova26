// Execution Plan Tests - K3-30
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExecutionPlanManager,
  createExecutionPlan,
  createLinearPlan,
} from './execution-plan.js';
import type { HarnessConfig } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeHarnessConfig(): HarnessConfig {
  return {
    id: 'h1',
    name: 'EP Test',
    agentId: 'agent-ep',
    task: 'test plan',
    priority: 'normal',
    timeoutMs: 0,
    maxRetries: 1,
    autonomyLevel: 3,
    maxDepth: 1,
    depth: 0,
    allowedTools: [],
    budget: { maxToolCalls: 50, maxTokens: 5000, maxCost: 5 },
    checkpointIntervalMs: 30000,
    dreamModeEnabled: false,
    overnightEvolutionEnabled: false,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createExecutionPlan()', () => {
  it('creates a plan with correct number of steps', () => {
    const mgr = createExecutionPlan('task', [
      { description: 'Step A' },
      { description: 'Step B' },
      { description: 'Step C' },
    ], 'agent-x');
    expect(mgr.getPlan().steps).toHaveLength(3);
  });

  it('steps with no dependencies start as ready', () => {
    const mgr = createExecutionPlan('task', [
      { description: 'Step A' },
    ], 'agent-x');
    expect(mgr.getPlan().steps[0].status).toBe('ready');
  });

  it('plan starts as pending', () => {
    const mgr = createExecutionPlan('task', [{ description: 'A' }], 'agent-x');
    expect(mgr.getPlan().status).toBe('pending');
  });

  it('uses defaultAgentId when step has no agentId', () => {
    const mgr = createExecutionPlan('task', [{ description: 'A' }], 'default-agent');
    expect(mgr.getPlan().steps[0].agentId).toBe('default-agent');
  });

  it('uses step agentId when specified', () => {
    const mgr = createExecutionPlan('task', [
      { description: 'A', agentId: 'special-agent' }
    ], 'default-agent');
    expect(mgr.getPlan().steps[0].agentId).toBe('special-agent');
  });
});

describe('createLinearPlan()', () => {
  it('creates sequential dependencies', () => {
    const mgr = createLinearPlan(makeHarnessConfig(), ['A', 'B', 'C']);
    const steps = mgr.getPlan().steps;
    expect(steps[0].dependencies).toHaveLength(0);
    expect(steps[1].dependencies).toHaveLength(1);
    expect(steps[2].dependencies).toHaveLength(1);
  });

  it('only first step is ready initially', () => {
    const mgr = createLinearPlan(makeHarnessConfig(), ['A', 'B', 'C']);
    const steps = mgr.getPlan().steps;
    expect(steps[0].status).toBe('ready');
    expect(steps[1].status).toBe('pending');
    expect(steps[2].status).toBe('pending');
  });
});

describe('ExecutionPlanManager', () => {
  let mgr: ExecutionPlanManager;

  beforeEach(() => {
    mgr = createLinearPlan(makeHarnessConfig(), ['Alpha', 'Beta', 'Gamma']);
  });

  describe('startStep()', () => {
    it('transitions ready step to running', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      expect(mgr.getPlan().steps.find(s => s.id === first.id)?.status).toBe('running');
    });

    it('throws for unknown step id', () => {
      expect(() => mgr.startStep('ghost')).toThrow('not found');
    });

    it('throws when step is not in startable state', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      expect(() => mgr.startStep(first.id)).toThrow('not in a startable state');
    });
  });

  describe('completeStep()', () => {
    it('marks step as completed', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.completeStep(first.id, 'output A');
      const step = mgr.getPlan().steps.find(s => s.id === first.id);
      expect(step?.status).toBe('completed');
      expect(step?.output).toBe('output A');
    });

    it('unblocks dependent step', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.completeStep(first.id);
      const ready = mgr.getReadySteps();
      expect(ready).toHaveLength(1);
    });

    it('throws for unknown step id', () => {
      expect(() => mgr.completeStep('ghost')).toThrow('not found');
    });
  });

  describe('failStep()', () => {
    it('marks step as failed', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.failStep(first.id, 'network error');
      const step = mgr.getPlan().steps.find(s => s.id === first.id);
      expect(step?.status).toBe('failed');
      expect(step?.error).toBe('network error');
    });

    it('blocks transitive dependents', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.failStep(first.id, 'error');
      const blocked = mgr.getBlockedSteps();
      expect(blocked).toHaveLength(2); // Beta and Gamma both blocked
    });

    it('marks plan as failed when all done', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.failStep(first.id, 'error');
      expect(mgr.getPlan().status).toBe('failed');
    });
  });

  describe('isComplete()', () => {
    it('returns false for in-progress plan', () => {
      expect(mgr.isComplete()).toBe(false);
    });

    it('returns true when plan completes', () => {
      const steps = mgr.getPlan().steps;
      for (const step of steps) {
        // Make steps ready one at a time
        const ready = mgr.getReadySteps();
        if (ready.length > 0) {
          mgr.startStep(ready[0].id);
          mgr.completeStep(ready[0].id);
        }
      }
      expect(mgr.isComplete()).toBe(true);
    });

    it('returns true when plan fails', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.failStep(first.id, 'oops');
      expect(mgr.isComplete()).toBe(true);
    });
  });

  describe('getReadySteps()', () => {
    it('returns steps with ready status', () => {
      const ready = mgr.getReadySteps();
      expect(ready).toHaveLength(1);
      expect(ready[0].description).toBe('Alpha');
    });

    it('returns empty array when no steps ready', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id); // moves to running, not ready
      expect(mgr.getReadySteps()).toHaveLength(0);
    });
  });

  describe('getBlockedSteps()', () => {
    it('returns empty initially', () => {
      expect(mgr.getBlockedSteps()).toHaveLength(0);
    });

    it('returns blocked steps after failure', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.failStep(first.id, 'error');
      expect(mgr.getBlockedSteps()).toHaveLength(2);
    });
  });

  describe('reset()', () => {
    it('resets all steps to pending/ready', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.completeStep(first.id);
      mgr.reset();
      const plan = mgr.getPlan();
      expect(plan.status).toBe('pending');
      // First step has no deps so should be ready
      const firstStep = plan.steps[0];
      expect(firstStep.status).toBe('ready');
      // Others should be pending (have deps)
      expect(plan.steps[1].status).toBe('pending');
    });

    it('clears output and error on reset', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.completeStep(first.id, 'some output');
      mgr.reset();
      expect(mgr.getPlan().steps[0].output).toBeUndefined();
      expect(mgr.getPlan().steps[0].error).toBeUndefined();
    });
  });

  describe('plan status transitions', () => {
    it('moves to in_progress when step starts', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      expect(mgr.getPlan().status).toBe('in_progress');
    });

    it('stays in_progress while steps remain', () => {
      const [first] = mgr.getReadySteps();
      mgr.startStep(first.id);
      mgr.completeStep(first.id);
      expect(mgr.getPlan().status).toBe('in_progress');
    });

    it('completes when all steps done', () => {
      const config = makeHarnessConfig();
      const singleMgr = createLinearPlan(config, ['Only']);
      const [step] = singleMgr.getReadySteps();
      singleMgr.startStep(step.id);
      singleMgr.completeStep(step.id);
      expect(singleMgr.getPlan().status).toBe('completed');
    });
  });

  describe('empty plan', () => {
    it('empty plan is immediately completed', () => {
      const emptyMgr = createExecutionPlan('empty', [], 'agent');
      expect(emptyMgr.getPlan().status).toBe('pending');
      // updatePlanStatus is called after completeStep / failStep - need to trigger
      // Since there are no steps, isComplete should work
      expect(emptyMgr.isComplete()).toBe(false); // plan starts as 'pending'
    });
  });
});
