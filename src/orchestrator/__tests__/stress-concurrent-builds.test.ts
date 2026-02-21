// SN-09: Concurrent Build Stress Test
// Simulates 10 builds running simultaneously, verifying isolation

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HookRegistry,
  type BuildContext,
  type TaskContext,
  type TaskResult,
  type BuildResult,
} from '../lifecycle-hooks.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ConcurrentBuildResult {
  buildId: string;
  taskResults: TaskResult[];
  buildResult: BuildResult;
}

async function runBuild(
  buildId: string,
  taskCount: number,
  registry: HookRegistry,
): Promise<ConcurrentBuildResult> {
  const buildCtx: BuildContext = {
    buildId,
    prdId: `prd-${buildId}`,
    prdName: `Build ${buildId}`,
    startedAt: new Date().toISOString(),
    options: {},
  };

  await registry.executePhase('onBeforeBuild', buildCtx);

  const taskResults: TaskResult[] = [];
  for (let i = 0; i < taskCount; i++) {
    const taskCtx: TaskContext = {
      taskId: `${buildId}-task-${i}`,
      title: `Task ${i} of ${buildId}`,
      agentName: ['EARTH', 'MARS', 'VENUS', 'SATURN', 'JUPITER'][i % 5],
      dependencies: i > 0 ? [`${buildId}-task-${i - 1}`] : [],
    };

    await registry.executePhase('onBeforeTask', taskCtx);

    const result: TaskResult = {
      taskId: taskCtx.taskId,
      agentName: taskCtx.agentName,
      success: true,
      output: `Output for ${taskCtx.title}`,
      durationMs: 50 + Math.floor(Math.random() * 200),
    };

    await registry.executePhase('onAfterTask', result);
    taskResults.push(result);
  }

  const buildResult: BuildResult = {
    buildId,
    prdId: `prd-${buildId}`,
    totalTasks: taskCount,
    successfulTasks: taskResults.filter(r => r.success).length,
    failedTasks: taskResults.filter(r => !r.success).length,
    totalDurationMs: taskResults.reduce((s, r) => s + r.durationMs, 0),
    averageAceScore: 0,
  };

  await registry.executePhase('onBuildComplete', buildResult);

  return { buildId, taskResults, buildResult };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stress: Concurrent Builds', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new HookRegistry();
  });

  describe('Isolation between concurrent builds', () => {
    it('should run 10 builds concurrently without errors', async () => {
      const builds = Array.from({ length: 10 }, (_, i) =>
        runBuild(`build-${i}`, 3, registry),
      );

      const results = await Promise.all(builds);
      expect(results).toHaveLength(10);
      results.forEach(r => {
        expect(r.buildResult.successfulTasks).toBe(3);
      });
    });

    it('should produce unique task IDs across concurrent builds', async () => {
      const builds = Array.from({ length: 5 }, (_, i) =>
        runBuild(`b-${i}`, 4, registry),
      );
      const results = await Promise.all(builds);

      const allTaskIds = results.flatMap(r => r.taskResults.map(t => t.taskId));
      const uniqueIds = new Set(allTaskIds);
      expect(uniqueIds.size).toBe(allTaskIds.length);
    });

    it('should track per-build task counts independently', async () => {
      const buildTaskCounts: Record<string, number> = {};
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => {
          const br = ctx as BuildResult;
          buildTaskCounts[br.buildId] = br.totalTasks;
        },
      });

      const builds = [
        runBuild('small', 2, registry),
        runBuild('medium', 5, registry),
        runBuild('large', 8, registry),
      ];
      await Promise.all(builds);

      expect(buildTaskCounts['small']).toBe(2);
      expect(buildTaskCounts['medium']).toBe(5);
      expect(buildTaskCounts['large']).toBe(8);
    });

    it('should not cross-contaminate build results', async () => {
      const results = await Promise.all([
        runBuild('alpha', 3, registry),
        runBuild('beta', 3, registry),
      ]);

      const alphaTaskIds = results[0].taskResults.map(t => t.taskId);
      const betaTaskIds = results[1].taskResults.map(t => t.taskId);

      alphaTaskIds.forEach(id => expect(id).toContain('alpha'));
      betaTaskIds.forEach(id => expect(id).toContain('beta'));
    });

    it('should maintain correct build IDs in results', async () => {
      const builds = Array.from({ length: 10 }, (_, i) =>
        runBuild(`concurrent-${i}`, 2, registry),
      );
      const results = await Promise.all(builds);

      results.forEach((r, i) => {
        expect(r.buildId).toBe(`concurrent-${i}`);
        expect(r.buildResult.buildId).toBe(`concurrent-${i}`);
      });
    });
  });

  describe('Hook execution under concurrency', () => {
    it('should fire onBeforeBuild for each concurrent build', async () => {
      const buildStarts: string[] = [];
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'counter',
        priority: 50,
        handler: async (ctx) => {
          buildStarts.push((ctx as BuildContext).buildId);
        },
      });

      const builds = Array.from({ length: 5 }, (_, i) =>
        runBuild(`hook-${i}`, 1, registry),
      );
      await Promise.all(builds);

      expect(buildStarts).toHaveLength(5);
    });

    it('should fire onBuildComplete for each concurrent build', async () => {
      const completions: string[] = [];
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'counter',
        priority: 50,
        handler: async (ctx) => {
          completions.push((ctx as BuildResult).buildId);
        },
      });

      const builds = Array.from({ length: 8 }, (_, i) =>
        runBuild(`comp-${i}`, 2, registry),
      );
      await Promise.all(builds);

      expect(completions).toHaveLength(8);
    });

    it('should execute all task hooks across concurrent builds', async () => {
      let totalBeforeTasks = 0;
      let totalAfterTasks = 0;
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { totalBeforeTasks++; },
      });
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { totalAfterTasks++; },
      });

      // 5 builds x 4 tasks = 20 total tasks
      const builds = Array.from({ length: 5 }, (_, i) =>
        runBuild(`tasks-${i}`, 4, registry),
      );
      await Promise.all(builds);

      expect(totalBeforeTasks).toBe(20);
      expect(totalAfterTasks).toBe(20);
    });

    it('should handle hooks that take variable time', async () => {
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'slow-hook',
        priority: 50,
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        },
      });

      const builds = Array.from({ length: 5 }, (_, i) =>
        runBuild(`timing-${i}`, 3, registry),
      );

      const results = await Promise.all(builds);
      expect(results).toHaveLength(5);
      results.forEach(r => {
        expect(r.buildResult.totalTasks).toBe(3);
      });
    });
  });

  describe('Memory and state isolation', () => {
    it('should accumulate memory per build without cross-talk', async () => {
      const buildMemory: Record<string, string[]> = {};

      registry.register({
        phase: 'onAfterTask',
        moduleName: 'memory',
        priority: 50,
        handler: async (ctx) => {
          const tr = ctx as TaskResult;
          const buildId = tr.taskId.split('-task-')[0];
          if (!buildMemory[buildId]) buildMemory[buildId] = [];
          buildMemory[buildId].push(tr.taskId);
        },
      });

      await Promise.all([
        runBuild('mem-a', 3, registry),
        runBuild('mem-b', 3, registry),
      ]);

      expect(buildMemory['mem-a']).toHaveLength(3);
      expect(buildMemory['mem-b']).toHaveLength(3);
      buildMemory['mem-a'].forEach(id => expect(id).toContain('mem-a'));
      buildMemory['mem-b'].forEach(id => expect(id).toContain('mem-b'));
    });

    it('should produce independent durations per build', async () => {
      const results = await Promise.all([
        runBuild('dur-a', 5, registry),
        runBuild('dur-b', 5, registry),
      ]);

      expect(results[0].buildResult.totalDurationMs).toBeGreaterThan(0);
      expect(results[1].buildResult.totalDurationMs).toBeGreaterThan(0);
    });

    it('should handle different task counts across concurrent builds', async () => {
      const results = await Promise.all([
        runBuild('vary-1', 1, registry),
        runBuild('vary-5', 5, registry),
        runBuild('vary-10', 10, registry),
      ]);

      expect(results[0].taskResults).toHaveLength(1);
      expect(results[1].taskResults).toHaveLength(5);
      expect(results[2].taskResults).toHaveLength(10);
    });
  });

  describe('Agent distribution under load', () => {
    it('should distribute agents correctly across concurrent builds', async () => {
      const agentUsage: Record<string, number> = {};
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => {
          const tc = ctx as TaskContext;
          agentUsage[tc.agentName] = (agentUsage[tc.agentName] ?? 0) + 1;
        },
      });

      // 3 builds x 5 tasks each, cycling through 5 agents
      await Promise.all([
        runBuild('agent-a', 5, registry),
        runBuild('agent-b', 5, registry),
        runBuild('agent-c', 5, registry),
      ]);

      // Each agent should appear 3 times (once per build)
      expect(agentUsage['EARTH']).toBe(3);
      expect(agentUsage['MARS']).toBe(3);
      expect(agentUsage['VENUS']).toBe(3);
      expect(agentUsage['SATURN']).toBe(3);
      expect(agentUsage['JUPITER']).toBe(3);
    });
  });

  describe('Registry isolation', () => {
    it('should allow separate registries per build for full isolation', async () => {
      const reg1 = new HookRegistry();
      const reg2 = new HookRegistry();
      const log1: string[] = [];
      const log2: string[] = [];

      reg1.register({
        phase: 'onAfterTask',
        moduleName: 'build1',
        priority: 50,
        handler: async (ctx) => { log1.push((ctx as TaskResult).taskId); },
      });
      reg2.register({
        phase: 'onAfterTask',
        moduleName: 'build2',
        priority: 50,
        handler: async (ctx) => { log2.push((ctx as TaskResult).taskId); },
      });

      await Promise.all([
        runBuild('iso-a', 3, reg1),
        runBuild('iso-b', 3, reg2),
      ]);

      log1.forEach(id => expect(id).toContain('iso-a'));
      log2.forEach(id => expect(id).toContain('iso-b'));
    });

    it('should not leak hooks between separate registries', async () => {
      const reg1 = new HookRegistry();
      const reg2 = new HookRegistry();

      reg1.register({
        phase: 'onBeforeBuild',
        moduleName: 'only-in-reg1',
        priority: 50,
        handler: async () => {},
      });

      expect(reg1.getHookCount()).toBe(1);
      expect(reg2.getHookCount()).toBe(0);
    });
  });

  describe('Error recovery in concurrent builds', () => {
    it('should complete healthy builds when one build has hook errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let errorBuildSeen = false;

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'selective-error',
        priority: 50,
        handler: async (ctx) => {
          if ((ctx as BuildContext).buildId === 'error-build') {
            errorBuildSeen = true;
            throw new Error('Build-specific error');
          }
        },
      });

      const results = await Promise.all([
        runBuild('good-build', 3, registry),
        runBuild('error-build', 3, registry),
        runBuild('another-good', 3, registry),
      ]);

      expect(results).toHaveLength(3);
      expect(errorBuildSeen).toBe(true);
      results.forEach(r => {
        expect(r.buildResult.successfulTasks).toBe(3);
      });

      consoleSpy.mockRestore();
    });

    it('should count total tasks across all concurrent builds', async () => {
      let totalTasks = 0;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'aggregator',
        priority: 50,
        handler: async (ctx) => {
          totalTasks += (ctx as BuildResult).totalTasks;
        },
      });

      await Promise.all([
        runBuild('agg-1', 3, registry),
        runBuild('agg-2', 5, registry),
        runBuild('agg-3', 7, registry),
      ]);

      expect(totalTasks).toBe(15);
    });
  });

  describe('Timing consistency', () => {
    it('should report positive duration for every build', async () => {
      const builds = Array.from({ length: 5 }, (_, i) =>
        runBuild(`time-${i}`, 3, registry),
      );
      const results = await Promise.all(builds);

      results.forEach(r => {
        expect(r.buildResult.totalDurationMs).toBeGreaterThan(0);
      });
    });

    it('should report positive duration for every task across builds', async () => {
      const builds = Array.from({ length: 3 }, (_, i) =>
        runBuild(`td-${i}`, 4, registry),
      );
      const results = await Promise.all(builds);

      results.forEach(r => {
        r.taskResults.forEach(tr => {
          expect(tr.durationMs).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Scale limits', () => {
    it('should handle 10 builds with 10 tasks each (100 total tasks)', async () => {
      const builds = Array.from({ length: 10 }, (_, i) =>
        runBuild(`scale-${i}`, 10, registry),
      );
      const results = await Promise.all(builds);

      const totalTasks = results.reduce(
        (s, r) => s + r.taskResults.length,
        0,
      );
      expect(totalTasks).toBe(100);
      results.forEach(r => {
        expect(r.buildResult.successfulTasks).toBe(10);
      });
    });

    it('should maintain hook correctness under high concurrency', async () => {
      let hookFires = 0;
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { hookFires++; },
      });

      // 10 builds x 5 tasks = 50 hook fires expected
      const builds = Array.from({ length: 10 }, (_, i) =>
        runBuild(`hc-${i}`, 5, registry),
      );
      await Promise.all(builds);

      expect(hookFires).toBe(50);
    });

    it('should return all build results from parallel execution', async () => {
      const builds = Array.from({ length: 10 }, (_, i) =>
        runBuild(`ret-${i}`, 2, registry),
      );
      const results = await Promise.all(builds);

      expect(results).toHaveLength(10);
      const buildIds = results.map(r => r.buildId);
      expect(new Set(buildIds).size).toBe(10);
    });

    it('should complete all builds even with zero-task builds mixed in', async () => {
      const results = await Promise.all([
        runBuild('zero-a', 0, registry),
        runBuild('normal-b', 5, registry),
        runBuild('zero-c', 0, registry),
      ]);

      expect(results[0].taskResults).toHaveLength(0);
      expect(results[1].taskResults).toHaveLength(5);
      expect(results[2].taskResults).toHaveLength(0);
    });

    it('should handle 20 concurrent single-task builds', async () => {
      const builds = Array.from({ length: 20 }, (_, i) =>
        runBuild(`single-${i}`, 1, registry),
      );
      const results = await Promise.all(builds);

      expect(results).toHaveLength(20);
      results.forEach(r => {
        expect(r.taskResults).toHaveLength(1);
        expect(r.buildResult.successfulTasks).toBe(1);
      });
    });

    it('should handle concurrent builds with shared hooks gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let errorCount = 0;

      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'flaky',
        priority: 50,
        handler: async (ctx) => {
          const tc = ctx as TaskContext;
          if (tc.taskId.includes('task-0')) {
            errorCount++;
            throw new Error('Flaky hook');
          }
        },
      });

      const builds = Array.from({ length: 5 }, (_, i) =>
        runBuild(`flaky-${i}`, 3, registry),
      );
      const results = await Promise.all(builds);

      // All builds complete despite hook errors
      expect(results).toHaveLength(5);
      expect(errorCount).toBe(5); // task-0 in each of 5 builds

      consoleSpy.mockRestore();
    });
  });
});
