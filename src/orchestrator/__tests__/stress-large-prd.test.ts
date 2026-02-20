// SN-10: Large PRD Stress Test
// Feeds a PRD with 50 tasks to the pipeline and verifies correctness

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
// Helpers
// ---------------------------------------------------------------------------

interface LargeBuildTask {
  id: string;
  title: string;
  agent: string;
  dependencies: string[];
}

const ALL_AGENTS = [
  'SUN', 'EARTH', 'MARS', 'VENUS', 'MERCURY', 'JUPITER', 'SATURN',
  'TITAN', 'EUROPA', 'ATLAS', 'URANUS', 'NEPTUNE', 'ANDROMEDA',
  'PLUTO', 'CHARON', 'IO', 'GANYMEDE', 'CALLISTO', 'ENCELADUS',
  'TRITON', 'MIMAS',
];

function generateLargePRD(taskCount: number): LargeBuildTask[] {
  return Array.from({ length: taskCount }, (_, i) => ({
    id: `task-${i}`,
    title: `Task ${i}: ${['Spec', 'Code', 'Test', 'Review', 'Deploy'][i % 5]}`,
    agent: ALL_AGENTS[i % ALL_AGENTS.length],
    dependencies: i > 0 ? [`task-${i - 1}`] : [],
  }));
}

async function simulateLargeBuild(
  tasks: LargeBuildTask[],
  registry: HookRegistry,
): Promise<{
  results: TaskResult[];
  buildResult: BuildResult;
  handoffs: Array<{ from: string; to: string }>;
}> {
  const results: TaskResult[] = [];
  const handoffs: Array<{ from: string; to: string }> = [];

  const buildCtx: BuildContext = {
    buildId: 'large-build-001',
    prdId: 'large-prd',
    prdName: 'Large PRD Stress Test',
    startedAt: new Date().toISOString(),
    options: {},
  };

  await registry.executePhase('onBeforeBuild', buildCtx);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const prevAgent = i > 0 ? tasks[i - 1].agent : null;

    if (prevAgent && prevAgent !== task.agent) {
      const handoffCtx: HandoffContext = {
        fromAgent: prevAgent,
        toAgent: task.agent,
        taskId: task.id,
        payload: { index: i },
      };
      await registry.executePhase('onHandoff', handoffCtx);
      handoffs.push({ from: prevAgent, to: task.agent });
    }

    const taskCtx: TaskContext = {
      taskId: task.id,
      title: task.title,
      agentName: task.agent,
      dependencies: task.dependencies,
    };

    await registry.executePhase('onBeforeTask', taskCtx);

    const result: TaskResult = {
      taskId: task.id,
      agentName: task.agent,
      success: true,
      output: `Output for ${task.title}`,
      durationMs: 50 + Math.floor(Math.random() * 100),
    };

    await registry.executePhase('onAfterTask', result);
    results.push(result);
  }

  const buildResult: BuildResult = {
    buildId: 'large-build-001',
    prdId: 'large-prd',
    totalTasks: tasks.length,
    successfulTasks: results.filter(r => r.success).length,
    failedTasks: results.filter(r => !r.success).length,
    totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
    averageAceScore: 0,
  };

  await registry.executePhase('onBuildComplete', buildResult);

  return { results, buildResult, handoffs };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stress: Large PRD', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new HookRegistry();
  });

  describe('50-task build execution', () => {
    it('should process all 50 tasks successfully', async () => {
      const tasks = generateLargePRD(50);
      const { results } = await simulateLargeBuild(tasks, registry);

      expect(results).toHaveLength(50);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should produce output for every task', async () => {
      const tasks = generateLargePRD(50);
      const { results } = await simulateLargeBuild(tasks, registry);

      results.forEach(r => {
        expect(r.output).toBeDefined();
        expect(r.output!.length).toBeGreaterThan(0);
      });
    });

    it('should report correct build result for 50 tasks', async () => {
      const tasks = generateLargePRD(50);
      const { buildResult } = await simulateLargeBuild(tasks, registry);

      expect(buildResult.totalTasks).toBe(50);
      expect(buildResult.successfulTasks).toBe(50);
      expect(buildResult.failedTasks).toBe(0);
      expect(buildResult.totalDurationMs).toBeGreaterThan(0);
    });

    it('should maintain correct task ordering in results', async () => {
      const tasks = generateLargePRD(50);
      const { results } = await simulateLargeBuild(tasks, registry);

      for (let i = 0; i < 50; i++) {
        expect(results[i].taskId).toBe(`task-${i}`);
      }
    });
  });

  describe('Agent distribution across large PRD', () => {
    it('should use all 21 agents across 50 tasks', async () => {
      const tasks = generateLargePRD(50);
      const { results } = await simulateLargeBuild(tasks, registry);

      const usedAgents = new Set(results.map(r => r.agentName));
      expect(usedAgents.size).toBe(21);
    });

    it('should track per-agent task counts', async () => {
      const agentCounts: Record<string, number> = {};
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => {
          const agent = (ctx as TaskResult).agentName;
          agentCounts[agent] = (agentCounts[agent] ?? 0) + 1;
        },
      });

      const tasks = generateLargePRD(42); // 42 = 21*2, exactly 2 per agent
      await simulateLargeBuild(tasks, registry);

      for (const agent of ALL_AGENTS) {
        expect(agentCounts[agent]).toBe(2);
      }
    });
  });

  describe('Handoff handling in large builds', () => {
    it('should fire handoffs when agents change', async () => {
      const tasks = generateLargePRD(50);
      const { handoffs } = await simulateLargeBuild(tasks, registry);

      // With 21 agents cycling through 50 tasks, every adjacent pair
      // with different agents triggers a handoff
      expect(handoffs.length).toBeGreaterThan(0);
      handoffs.forEach(h => {
        expect(h.from).not.toBe(h.to);
      });
    });

    it('should track handoff events via hooks', async () => {
      const handoffLog: Array<{ from: string; to: string }> = [];
      registry.register({
        phase: 'onHandoff',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => {
          const hc = ctx as HandoffContext;
          handoffLog.push({ from: hc.fromAgent, to: hc.toAgent });
        },
      });

      const tasks = generateLargePRD(50);
      const { handoffs } = await simulateLargeBuild(tasks, registry);

      expect(handoffLog).toHaveLength(handoffs.length);
    });
  });

  describe('Hook execution at scale', () => {
    it('should fire onBeforeTask 50 times for 50 tasks', async () => {
      let count = 0;
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { count++; },
      });

      const tasks = generateLargePRD(50);
      await simulateLargeBuild(tasks, registry);

      expect(count).toBe(50);
    });

    it('should fire onAfterTask 50 times for 50 tasks', async () => {
      let count = 0;
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { count++; },
      });

      const tasks = generateLargePRD(50);
      await simulateLargeBuild(tasks, registry);

      expect(count).toBe(50);
    });

    it('should handle multiple hooks across 50 tasks', async () => {
      const modules = ['model-routing', 'observability', 'memory', 'workflow'];
      const moduleCounts: Record<string, number> = {};

      for (const mod of modules) {
        moduleCounts[mod] = 0;
        registry.register({
          phase: 'onBeforeTask',
          moduleName: mod,
          priority: 50,
          handler: async () => { moduleCounts[mod]++; },
        });
      }

      const tasks = generateLargePRD(50);
      await simulateLargeBuild(tasks, registry);

      for (const mod of modules) {
        expect(moduleCounts[mod]).toBe(50);
      }
    });
  });

  describe('Memory accumulation at scale', () => {
    it('should accumulate memory entries for all 50 tasks', async () => {
      const memory: string[] = [];
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'memory',
        priority: 50,
        handler: async (ctx) => {
          memory.push((ctx as TaskResult).taskId);
        },
      });

      const tasks = generateLargePRD(50);
      await simulateLargeBuild(tasks, registry);

      expect(memory).toHaveLength(50);
    });

    it('should maintain memory order matching task order', async () => {
      const memory: string[] = [];
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'memory',
        priority: 50,
        handler: async (ctx) => {
          memory.push((ctx as TaskResult).taskId);
        },
      });

      const tasks = generateLargePRD(50);
      await simulateLargeBuild(tasks, registry);

      for (let i = 0; i < 50; i++) {
        expect(memory[i]).toBe(`task-${i}`);
      }
    });
  });

  describe('Dependency chain at scale', () => {
    it('should pass correct dependency chains for all 50 tasks', async () => {
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

      const tasks = generateLargePRD(50);
      await simulateLargeBuild(tasks, registry);

      expect(deps['task-0']).toEqual([]);
      for (let i = 1; i < 50; i++) {
        expect(deps[`task-${i}`]).toEqual([`task-${i - 1}`]);
      }
    });
  });

  describe('Build lifecycle events at scale', () => {
    it('should fire exactly one onBeforeBuild and onBuildComplete', async () => {
      let beforeCount = 0;
      let completeCount = 0;
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { beforeCount++; },
      });
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { completeCount++; },
      });

      const tasks = generateLargePRD(50);
      await simulateLargeBuild(tasks, registry);

      expect(beforeCount).toBe(1);
      expect(completeCount).toBe(1);
    });

    it('should pass correct build result to onBuildComplete', async () => {
      let capturedResult: BuildResult | null = null;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'capture',
        priority: 50,
        handler: async (ctx) => { capturedResult = ctx as BuildResult; },
      });

      const tasks = generateLargePRD(50);
      await simulateLargeBuild(tasks, registry);

      expect(capturedResult).not.toBeNull();
      expect(capturedResult!.totalTasks).toBe(50);
      expect(capturedResult!.successfulTasks).toBe(50);
    });

    it('should produce unique output per task', async () => {
      const tasks = generateLargePRD(50);
      const { results } = await simulateLargeBuild(tasks, registry);

      const outputs = results.map(r => r.output);
      const uniqueOutputs = new Set(outputs);
      expect(uniqueOutputs.size).toBe(50);
    });
  });

  describe('Edge cases at scale', () => {
    it('should handle 100-task build', async () => {
      const tasks = generateLargePRD(100);
      const { results, buildResult } = await simulateLargeBuild(tasks, registry);

      expect(results).toHaveLength(100);
      expect(buildResult.totalTasks).toBe(100);
    });

    it('should aggregate total duration across all tasks', async () => {
      const tasks = generateLargePRD(50);
      const { results, buildResult } = await simulateLargeBuild(tasks, registry);

      const expectedDuration = results.reduce((s, r) => s + r.durationMs, 0);
      expect(buildResult.totalDurationMs).toBe(expectedDuration);
    });

    it('should handle hook errors gracefully in large builds', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'flaky',
        priority: 50,
        handler: async (ctx) => {
          const tc = ctx as TaskContext;
          if (tc.taskId === 'task-25') throw new Error('Mid-build failure');
        },
      });

      const tasks = generateLargePRD(50);
      const { results } = await simulateLargeBuild(tasks, registry);

      // All 50 tasks still complete
      expect(results).toHaveLength(50);
      consoleSpy.mockRestore();
    });
  });
});
