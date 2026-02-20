// SN-03: Multi-Agent Handoff E2E Test
// Simulates agent chains (SUN -> EARTH -> MARS -> VENUS) with context passing

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HookRegistry,
  type BuildContext,
  type TaskContext,
  type TaskResult,
  type HandoffContext,
  type BuildResult,
} from '../lifecycle-hooks.js';

// ---------------------------------------------------------------------------
// Handoff Simulation Types
// ---------------------------------------------------------------------------

interface AgentState {
  agent: string;
  taskId: string;
  memoryContext: string[];
  modelPreference?: string;
  accumulatedOutput: string[];
}

interface HandoffPayload {
  fromAgent: string;
  toAgent: string;
  taskId: string;
  memory: string[];
  output: string[];
  modelPreference?: string;
}

// ---------------------------------------------------------------------------
// Simulation Helpers
// ---------------------------------------------------------------------------

async function simulateHandoffChain(
  chain: Array<{ id: string; agent: string; title: string }>,
  registry: HookRegistry,
): Promise<{
  handoffs: HandoffPayload[];
  agentStates: AgentState[];
  buildResult: BuildResult;
}> {
  const handoffs: HandoffPayload[] = [];
  const agentStates: AgentState[] = [];
  let currentMemory: string[] = [];
  let accumulatedOutput: string[] = [];

  const buildCtx: BuildContext = {
    buildId: 'build-handoff-001',
    prdId: 'prd-handoff',
    prdName: 'Handoff Test PRD',
    startedAt: new Date().toISOString(),
    options: {},
  };

  await registry.executePhase('onBeforeBuild', buildCtx);

  const results: TaskResult[] = [];

  for (let i = 0; i < chain.length; i++) {
    const task = chain[i];
    const prevAgent = i > 0 ? chain[i - 1].agent : null;

    // Fire handoff if switching agents
    if (prevAgent && prevAgent !== task.agent) {
      const handoffCtx: HandoffContext = {
        fromAgent: prevAgent,
        toAgent: task.agent,
        taskId: task.id,
        payload: {
          memory: [...currentMemory],
          output: [...accumulatedOutput],
        },
      };

      await registry.executePhase('onHandoff', handoffCtx);

      handoffs.push({
        fromAgent: prevAgent,
        toAgent: task.agent,
        taskId: task.id,
        memory: [...currentMemory],
        output: [...accumulatedOutput],
      });
    }

    const taskCtx: TaskContext = {
      taskId: task.id,
      title: task.title,
      agentName: task.agent,
      dependencies: i > 0 ? [chain[i - 1].id] : [],
    };

    await registry.executePhase('onBeforeTask', taskCtx);

    // Simulate task execution
    const output = `${task.agent} output for ${task.title}`;
    currentMemory.push(`Memory from ${task.agent}: ${task.title}`);
    accumulatedOutput.push(output);

    const result: TaskResult = {
      taskId: task.id,
      agentName: task.agent,
      success: true,
      output,
      durationMs: 200,
    };

    await registry.executePhase('onAfterTask', result);
    results.push(result);

    agentStates.push({
      agent: task.agent,
      taskId: task.id,
      memoryContext: [...currentMemory],
      accumulatedOutput: [...accumulatedOutput],
    });
  }

  const buildResult: BuildResult = {
    buildId: 'build-handoff-001',
    prdId: 'prd-handoff',
    totalTasks: chain.length,
    successfulTasks: results.filter(r => r.success).length,
    failedTasks: results.filter(r => !r.success).length,
    totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
    averageAceScore: 0,
  };

  await registry.executePhase('onBuildComplete', buildResult);

  return { handoffs, agentStates, buildResult };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Multi-Agent Handoff', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new HookRegistry();
  });

  describe('Basic handoff chain', () => {
    it('should fire onHandoff when agent changes', async () => {
      const handoffEvents: HandoffContext[] = [];
      registry.register({
        phase: 'onHandoff',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => { handoffEvents.push(ctx as HandoffContext); },
      });

      const { handoffs } = await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
      ], registry);

      expect(handoffs).toHaveLength(1);
      expect(handoffs[0].fromAgent).toBe('EARTH');
      expect(handoffs[0].toAgent).toBe('MARS');
      expect(handoffEvents).toHaveLength(1);
    });

    it('should not fire onHandoff when same agent continues', async () => {
      const handoffCount = vi.fn();
      registry.register({
        phase: 'onHandoff',
        moduleName: 'tracker',
        priority: 50,
        handler: async () => { handoffCount(); },
      });

      await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec 1' },
        { id: 't2', agent: 'EARTH', title: 'Spec 2' },
      ], registry);

      expect(handoffCount).not.toHaveBeenCalled();
    });

    it('should support SUN -> EARTH -> MARS -> VENUS chain', async () => {
      const { handoffs } = await simulateHandoffChain([
        { id: 't1', agent: 'SUN', title: 'Plan' },
        { id: 't2', agent: 'EARTH', title: 'Spec' },
        { id: 't3', agent: 'MARS', title: 'Backend' },
        { id: 't4', agent: 'VENUS', title: 'Frontend' },
      ], registry);

      expect(handoffs).toHaveLength(3);
      expect(handoffs[0]).toMatchObject({ fromAgent: 'SUN', toAgent: 'EARTH' });
      expect(handoffs[1]).toMatchObject({ fromAgent: 'EARTH', toAgent: 'MARS' });
      expect(handoffs[2]).toMatchObject({ fromAgent: 'MARS', toAgent: 'VENUS' });
    });
  });

  describe('Context accumulation across handoffs', () => {
    it('should accumulate memory across agents', async () => {
      const { agentStates } = await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
        { id: 't3', agent: 'VENUS', title: 'UI' },
      ], registry);

      expect(agentStates[0].memoryContext).toHaveLength(1);
      expect(agentStates[1].memoryContext).toHaveLength(2);
      expect(agentStates[2].memoryContext).toHaveLength(3);
    });

    it('should pass previous outputs in handoff payload', async () => {
      const { handoffs } = await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
        { id: 't3', agent: 'VENUS', title: 'UI' },
      ], registry);

      // First handoff (EARTH -> MARS) carries 1 output
      expect(handoffs[0].output).toHaveLength(1);
      expect(handoffs[0].output[0]).toContain('EARTH');

      // Second handoff (MARS -> VENUS) carries 2 outputs
      expect(handoffs[1].output).toHaveLength(2);
      expect(handoffs[1].output[0]).toContain('EARTH');
      expect(handoffs[1].output[1]).toContain('MARS');
    });

    it('should include memory from all previous agents in handoff', async () => {
      const { handoffs } = await simulateHandoffChain([
        { id: 't1', agent: 'SUN', title: 'Plan' },
        { id: 't2', agent: 'EARTH', title: 'Spec' },
        { id: 't3', agent: 'MARS', title: 'Code' },
      ], registry);

      // EARTH -> MARS handoff should include memory from SUN and EARTH
      expect(handoffs[1].memory).toHaveLength(2);
      expect(handoffs[1].memory[0]).toContain('SUN');
      expect(handoffs[1].memory[1]).toContain('EARTH');
    });
  });

  describe('Handoff hooks', () => {
    it('should allow modules to observe handoff events', async () => {
      const observed: Array<{ from: string; to: string }> = [];
      registry.register({
        phase: 'onHandoff',
        moduleName: 'observability',
        priority: 8,
        handler: async (ctx) => {
          const hc = ctx as HandoffContext;
          observed.push({ from: hc.fromAgent, to: hc.toAgent });
        },
      });

      await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
        { id: 't3', agent: 'VENUS', title: 'UI' },
      ], registry);

      expect(observed).toHaveLength(2);
      expect(observed[0]).toEqual({ from: 'EARTH', to: 'MARS' });
      expect(observed[1]).toEqual({ from: 'MARS', to: 'VENUS' });
    });

    it('should run multiple handoff hooks in priority order', async () => {
      const order: string[] = [];
      registry.register({
        phase: 'onHandoff',
        moduleName: 'low-priority',
        priority: 100,
        handler: async () => { order.push('low'); },
      });
      registry.register({
        phase: 'onHandoff',
        moduleName: 'high-priority',
        priority: 5,
        handler: async () => { order.push('high'); },
      });

      await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
      ], registry);

      expect(order).toEqual(['high', 'low']);
    });

    it('should survive handoff hook failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const afterHandoff = vi.fn();

      registry.register({
        phase: 'onHandoff',
        moduleName: 'broken',
        priority: 10,
        handler: async () => { throw new Error('Handoff hook crashed'); },
      });
      registry.register({
        phase: 'onHandoff',
        moduleName: 'healthy',
        priority: 20,
        handler: async () => { afterHandoff(); },
      });

      const { handoffs } = await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
      ], registry);

      expect(handoffs).toHaveLength(1);
      expect(afterHandoff).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Full agent chain simulation', () => {
    it('should handle a full 5-agent pipeline', async () => {
      const { handoffs, agentStates, buildResult } = await simulateHandoffChain([
        { id: 'plan', agent: 'SUN', title: 'Plan project' },
        { id: 'spec', agent: 'EARTH', title: 'Write spec' },
        { id: 'code', agent: 'MARS', title: 'Write backend' },
        { id: 'ui', agent: 'VENUS', title: 'Build UI' },
        { id: 'test', agent: 'SATURN', title: 'Write tests' },
      ], registry);

      expect(handoffs).toHaveLength(4);
      expect(agentStates).toHaveLength(5);
      expect(buildResult.successfulTasks).toBe(5);
      expect(buildResult.failedTasks).toBe(0);
    });

    it('should accumulate full context through 5-agent chain', async () => {
      const { agentStates } = await simulateHandoffChain([
        { id: 't1', agent: 'SUN', title: 'Plan' },
        { id: 't2', agent: 'EARTH', title: 'Spec' },
        { id: 't3', agent: 'MARS', title: 'Code' },
        { id: 't4', agent: 'VENUS', title: 'UI' },
        { id: 't5', agent: 'SATURN', title: 'Tests' },
      ], registry);

      // Last agent should have accumulated all outputs
      const lastState = agentStates[4];
      expect(lastState.accumulatedOutput).toHaveLength(5);
      expect(lastState.memoryContext).toHaveLength(5);
    });

    it('should preserve agent order in handoff sequence', async () => {
      const { handoffs } = await simulateHandoffChain([
        { id: 't1', agent: 'SUN', title: 'Plan' },
        { id: 't2', agent: 'EARTH', title: 'Spec' },
        { id: 't3', agent: 'MARS', title: 'Code' },
        { id: 't4', agent: 'VENUS', title: 'UI' },
      ], registry);

      const fromAgents = handoffs.map(h => h.fromAgent);
      const toAgents = handoffs.map(h => h.toAgent);
      expect(fromAgents).toEqual(['SUN', 'EARTH', 'MARS']);
      expect(toAgents).toEqual(['EARTH', 'MARS', 'VENUS']);
    });
  });

  describe('Agent-specific behavior', () => {
    it('should track per-agent task counts', async () => {
      const agentTasks: Record<string, number> = {};
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => {
          const agent = (ctx as TaskResult).agentName;
          agentTasks[agent] = (agentTasks[agent] ?? 0) + 1;
        },
      });

      await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec 1' },
        { id: 't2', agent: 'EARTH', title: 'Spec 2' },
        { id: 't3', agent: 'MARS', title: 'Code' },
      ], registry);

      expect(agentTasks['EARTH']).toBe(2);
      expect(agentTasks['MARS']).toBe(1);
    });

    it('should maintain dependencies across handoffs', async () => {
      const deps: Record<string, string[]> = {};
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'dep-tracker',
        priority: 50,
        handler: async (ctx) => {
          const tc = ctx as TaskContext;
          deps[tc.taskId] = tc.dependencies;
        },
      });

      await simulateHandoffChain([
        { id: 'spec', agent: 'EARTH', title: 'Spec' },
        { id: 'code', agent: 'MARS', title: 'Code' },
        { id: 'ui', agent: 'VENUS', title: 'UI' },
      ], registry);

      expect(deps['spec']).toEqual([]);
      expect(deps['code']).toEqual(['spec']);
      expect(deps['ui']).toEqual(['code']);
    });
  });

  describe('Handoff payload validation', () => {
    it('should carry correct task ID in each handoff', async () => {
      const { handoffs } = await simulateHandoffChain([
        { id: 'spec', agent: 'EARTH', title: 'Spec' },
        { id: 'code', agent: 'MARS', title: 'Code' },
        { id: 'test', agent: 'SATURN', title: 'Tests' },
      ], registry);

      expect(handoffs[0].taskId).toBe('code');
      expect(handoffs[1].taskId).toBe('test');
    });

    it('should include growing output list in successive handoffs', async () => {
      const { handoffs } = await simulateHandoffChain([
        { id: 't1', agent: 'SUN', title: 'Plan' },
        { id: 't2', agent: 'EARTH', title: 'Spec' },
        { id: 't3', agent: 'MARS', title: 'Code' },
        { id: 't4', agent: 'VENUS', title: 'UI' },
      ], registry);

      expect(handoffs[0].output).toHaveLength(1);
      expect(handoffs[1].output).toHaveLength(2);
      expect(handoffs[2].output).toHaveLength(3);
    });
  });

  describe('Handoff with multiple tasks per agent', () => {
    it('should only fire handoff on agent transitions, not within agent', async () => {
      const handoffCount = vi.fn();
      registry.register({
        phase: 'onHandoff',
        moduleName: 'tracker',
        priority: 50,
        handler: async () => { handoffCount(); },
      });

      await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec 1' },
        { id: 't2', agent: 'EARTH', title: 'Spec 2' },
        { id: 't3', agent: 'MARS', title: 'Code 1' },
        { id: 't4', agent: 'MARS', title: 'Code 2' },
        { id: 't5', agent: 'VENUS', title: 'UI' },
      ], registry);

      expect(handoffCount).toHaveBeenCalledTimes(2); // EARTH->MARS, MARS->VENUS
    });

    it('should accumulate outputs from multiple tasks within same agent', async () => {
      const { handoffs } = await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec 1' },
        { id: 't2', agent: 'EARTH', title: 'Spec 2' },
        { id: 't3', agent: 'MARS', title: 'Code' },
      ], registry);

      expect(handoffs).toHaveLength(1);
      expect(handoffs[0].output).toHaveLength(2);
      expect(handoffs[0].output[0]).toContain('Spec 1');
      expect(handoffs[0].output[1]).toContain('Spec 2');
    });
  });

  describe('Build result from handoff chain', () => {
    it('should report all tasks successful in clean chain', async () => {
      const { buildResult } = await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
        { id: 't3', agent: 'VENUS', title: 'UI' },
      ], registry);

      expect(buildResult.totalTasks).toBe(3);
      expect(buildResult.successfulTasks).toBe(3);
      expect(buildResult.failedTasks).toBe(0);
    });

    it('should report correct total duration', async () => {
      const { buildResult } = await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
      ], registry);

      // Each task duration is 200ms in the simulation
      expect(buildResult.totalDurationMs).toBe(400);
    });

    it('should fire onBuildComplete after handoff chain finishes', async () => {
      let buildCompleted = false;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'tracker',
        priority: 50,
        handler: async () => { buildCompleted = true; },
      });

      await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
      ], registry);

      expect(buildCompleted).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle single-agent chain (no handoffs)', async () => {
      const { handoffs, agentStates } = await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Task 1' },
      ], registry);

      expect(handoffs).toHaveLength(0);
      expect(agentStates).toHaveLength(1);
    });

    it('should handle agent returning to a previous agent', async () => {
      const { handoffs } = await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
        { id: 't3', agent: 'EARTH', title: 'Revise spec' },
      ], registry);

      expect(handoffs).toHaveLength(2);
      expect(handoffs[0]).toMatchObject({ fromAgent: 'EARTH', toAgent: 'MARS' });
      expect(handoffs[1]).toMatchObject({ fromAgent: 'MARS', toAgent: 'EARTH' });
    });

    it('should handle rapid agent switching', async () => {
      const agents = ['SUN', 'EARTH', 'MARS', 'VENUS', 'MERCURY', 'JUPITER', 'SATURN'];
      const chain = agents.map((agent, i) => ({
        id: `t${i}`,
        agent,
        title: `Task ${i}`,
      }));

      const { handoffs } = await simulateHandoffChain(chain, registry);

      expect(handoffs).toHaveLength(6);
    });

    it('should handle empty handoff payload gracefully', async () => {
      let payloadReceived = false;
      registry.register({
        phase: 'onHandoff',
        moduleName: 'receiver',
        priority: 50,
        handler: async (ctx) => {
          const hc = ctx as HandoffContext;
          payloadReceived = hc.payload !== undefined;
        },
      });

      await simulateHandoffChain([
        { id: 't1', agent: 'EARTH', title: 'Spec' },
        { id: 't2', agent: 'MARS', title: 'Code' },
      ], registry);

      expect(payloadReceived).toBe(true);
    });
  });
});
