// SN-01: Full Build Simulation E2E Test
// Simulates a complete 5-task build through the Ralph Loop pipeline

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HookRegistry,
  type BuildContext,
  type TaskContext,
  type TaskResult,
  type HandoffContext,
  type BuildResult,
} from '../lifecycle-hooks.js';
import { wireFeatureHooks } from '../lifecycle-wiring.js';
import type { RalphLoopOptions } from '../ralph-loop-types.js';
import type { PRD, Task } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePRD(tasks: Partial<Task>[]): PRD {
  return {
    id: 'prd-001',
    name: 'Test Build PRD',
    description: 'E2E simulation PRD',
    tasks: tasks.map((t, i) => ({
      id: t.id ?? `task-${i + 1}`,
      title: t.title ?? `Task ${i + 1}`,
      description: t.description ?? `Description for task ${i + 1}`,
      agent: t.agent ?? 'EARTH',
      status: t.status ?? 'pending',
      phase: t.phase ?? 0,
      dependencies: t.dependencies ?? [],
      output: t.output ?? undefined,
    })) as Task[],
    status: 'active',
  } as PRD;
}

function makeRegistry(): HookRegistry {
  return new HookRegistry();
}

function defaultOptions(): Partial<RalphLoopOptions> {
  return {
    portfolioEnabled: true,
    autonomousTestingEnabled: true,
    debugEngineEnabled: true,
    modelRoutingEnabled: true,
    cinematicObservabilityEnabled: true,
    workflowEngineEnabled: true,
    infiniteMemoryEnabled: true,
  };
}

// ---------------------------------------------------------------------------
// Simulated Build Pipeline
// ---------------------------------------------------------------------------

interface BuildLog {
  phase: string;
  module: string;
  context: unknown;
}

async function simulateBuild(
  prd: PRD,
  registry: HookRegistry,
): Promise<{ logs: BuildLog[]; results: TaskResult[] }> {
  const logs: BuildLog[] = [];
  const results: TaskResult[] = [];

  const buildCtx: BuildContext = {
    buildId: 'build-001',
    prdId: prd.id,
    prdName: prd.name,
    startedAt: new Date().toISOString(),
    options: {},
  };

  // Phase 1: onBeforeBuild
  await registry.executePhase('onBeforeBuild', buildCtx);
  logs.push({ phase: 'onBeforeBuild', module: 'pipeline', context: buildCtx });

  // Phase 2-4: Process each task
  for (const task of prd.tasks) {
    const taskCtx: TaskContext = {
      taskId: task.id,
      title: task.title,
      agentName: task.agent,
      dependencies: task.dependencies,
    };

    // onBeforeTask
    await registry.executePhase('onBeforeTask', taskCtx);
    logs.push({ phase: 'onBeforeTask', module: 'pipeline', context: taskCtx });

    // Simulate task execution
    const success = task.status !== 'blocked';
    const result: TaskResult = {
      taskId: task.id,
      agentName: task.agent,
      success,
      output: success ? `Output for ${task.title}` : undefined,
      error: success ? undefined : `Failed: ${task.title}`,
      durationMs: Math.floor(Math.random() * 5000) + 100,
    };

    if (success) {
      await registry.executePhase('onAfterTask', result);
      logs.push({ phase: 'onAfterTask', module: 'pipeline', context: result });
    } else {
      await registry.executePhase('onTaskError', result);
      logs.push({ phase: 'onTaskError', module: 'pipeline', context: result });
    }

    results.push(result);
  }

  // Phase 5: onBuildComplete
  const buildResult: BuildResult = {
    buildId: 'build-001',
    prdId: prd.id,
    totalTasks: prd.tasks.length,
    successfulTasks: results.filter(r => r.success).length,
    failedTasks: results.filter(r => !r.success).length,
    totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    averageAceScore: 0,
  };

  await registry.executePhase('onBuildComplete', buildResult);
  logs.push({ phase: 'onBuildComplete', module: 'pipeline', context: buildResult });

  return { logs, results };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Build Simulation', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = makeRegistry();
  });

  describe('Complete build lifecycle', () => {
    it('should fire onBeforeBuild before any task processing', async () => {
      const phases: string[] = [];
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'test',
        priority: 50,
        handler: async () => { phases.push('onBeforeBuild'); },
      });
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'test',
        priority: 50,
        handler: async () => { phases.push('onBeforeTask'); },
      });

      const prd = makePRD([{ title: 'Task 1' }]);
      await simulateBuild(prd, registry);

      expect(phases[0]).toBe('onBeforeBuild');
      expect(phases[1]).toBe('onBeforeTask');
    });

    it('should fire onBuildComplete after all tasks', async () => {
      const phases: string[] = [];
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'test',
        priority: 50,
        handler: async () => { phases.push('onAfterTask'); },
      });
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'test',
        priority: 50,
        handler: async () => { phases.push('onBuildComplete'); },
      });

      const prd = makePRD([{ title: 'T1' }, { title: 'T2' }, { title: 'T3' }]);
      await simulateBuild(prd, registry);

      const lastAfterTask = phases.lastIndexOf('onAfterTask');
      const buildComplete = phases.indexOf('onBuildComplete');
      expect(buildComplete).toBeGreaterThan(lastAfterTask);
    });

    it('should process all 5 tasks in a complete build', async () => {
      const taskIds: string[] = [];
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => { taskIds.push((ctx as TaskContext).taskId); },
      });

      const prd = makePRD([
        { id: 'spec', title: 'Write spec', agent: 'EARTH' },
        { id: 'schema', title: 'Design schema', agent: 'PLUTO' },
        { id: 'backend', title: 'Build backend', agent: 'MARS' },
        { id: 'frontend', title: 'Build frontend', agent: 'VENUS' },
        { id: 'test', title: 'Write tests', agent: 'SATURN' },
      ]);

      const { results } = await simulateBuild(prd, registry);

      expect(taskIds).toEqual(['spec', 'schema', 'backend', 'frontend', 'test']);
      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should pass build context with correct PRD info', async () => {
      let capturedCtx: BuildContext | null = null;
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'test',
        priority: 50,
        handler: async (ctx) => { capturedCtx = ctx as BuildContext; },
      });

      const prd = makePRD([{ title: 'Task 1' }]);
      await simulateBuild(prd, registry);

      expect(capturedCtx).not.toBeNull();
      expect(capturedCtx!.prdId).toBe('prd-001');
      expect(capturedCtx!.prdName).toBe('Test Build PRD');
      expect(capturedCtx!.buildId).toBe('build-001');
    });

    it('should pass task context with agent name and dependencies', async () => {
      const contexts: TaskContext[] = [];
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'test',
        priority: 50,
        handler: async (ctx) => { contexts.push(ctx as TaskContext); },
      });

      const prd = makePRD([
        { id: 'task-1', agent: 'EARTH', dependencies: [] },
        { id: 'task-2', agent: 'MARS', dependencies: ['task-1'] },
      ]);
      await simulateBuild(prd, registry);

      expect(contexts).toHaveLength(2);
      expect(contexts[0].agentName).toBe('EARTH');
      expect(contexts[0].dependencies).toEqual([]);
      expect(contexts[1].agentName).toBe('MARS');
      expect(contexts[1].dependencies).toEqual(['task-1']);
    });

    it('should include duration in task results', async () => {
      const prd = makePRD([{ title: 'Task 1' }]);
      const { results } = await simulateBuild(prd, registry);

      expect(results[0].durationMs).toBeGreaterThan(0);
    });
  });

  describe('Hook execution order', () => {
    it('should fire hooks in priority order within a phase', async () => {
      const order: number[] = [];
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'high',
        priority: 100,
        handler: async () => { order.push(100); },
      });
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'low',
        priority: 10,
        handler: async () => { order.push(10); },
      });
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'mid',
        priority: 50,
        handler: async () => { order.push(50); },
      });

      const prd = makePRD([{ title: 'T1' }]);
      await simulateBuild(prd, registry);

      expect(order).toEqual([10, 50, 100]);
    });

    it('should fire all 6 phases in correct order for a successful task', async () => {
      const phases: string[] = [];
      const allPhases = ['onBeforeBuild', 'onBeforeTask', 'onAfterTask', 'onBuildComplete'] as const;
      for (const phase of allPhases) {
        registry.register({
          phase,
          moduleName: 'tracker',
          priority: 50,
          handler: async () => { phases.push(phase); },
        });
      }

      const prd = makePRD([{ title: 'T1' }]);
      await simulateBuild(prd, registry);

      expect(phases).toEqual(['onBeforeBuild', 'onBeforeTask', 'onAfterTask', 'onBuildComplete']);
    });

    it('should fire onBeforeTask/onAfterTask for each task', async () => {
      let beforeCount = 0;
      let afterCount = 0;
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { beforeCount++; },
      });
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { afterCount++; },
      });

      const prd = makePRD([{ title: 'T1' }, { title: 'T2' }, { title: 'T3' }]);
      await simulateBuild(prd, registry);

      expect(beforeCount).toBe(3);
      expect(afterCount).toBe(3);
    });
  });

  describe('Multi-module participation', () => {
    it('should allow multiple modules to hook into the same phase', async () => {
      const modules: string[] = [];
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'model-routing',
        priority: 42,
        handler: async () => { modules.push('model-routing'); },
      });
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'workflow-engine',
        priority: 38,
        handler: async () => { modules.push('workflow-engine'); },
      });
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'cinematic-observability',
        priority: 8,
        handler: async () => { modules.push('cinematic-observability'); },
      });

      const prd = makePRD([{ title: 'T1' }]);
      await simulateBuild(prd, registry);

      expect(modules).toEqual(['cinematic-observability', 'workflow-engine', 'model-routing']);
    });

    it('should wire 24 features when all enabled', () => {
      const opts: RalphLoopOptions = {
        portfolioEnabled: true,
        agentMemoryEnabled: true,
        generativeUIEnabled: true,
        autonomousTestingEnabled: true,
        wellbeingEnabled: true,
        advancedRecoveryEnabled: true,
        advancedInitEnabled: true,
        codeReviewEnabled: true,
        migrationEnabled: true,
        debugEngineEnabled: true,
        accessibilityEnabled: true,
        debtScoringEnabled: true,
        dependencyManagementEnabled: true,
        productionFeedbackEnabled: true,
        healthDashboardEnabled: true,
        envManagementEnabled: true,
        orchestrationOptimizationEnabled: true,
        modelRoutingEnabled: true,
        perplexityEnabled: true,
        workflowEngineEnabled: true,
        infiniteMemoryEnabled: true,
        cinematicObservabilityEnabled: true,
        aiModelDatabaseEnabled: true,
        crdtCollaborationEnabled: true,
      };

      const result = wireFeatureHooks(registry, opts);
      expect(result.wiredCount).toBe(24);
    });

    it('should have hooks in all 6 phases after full wiring', () => {
      const opts: Partial<RalphLoopOptions> = {
        portfolioEnabled: true,
        generativeUIEnabled: true,
        autonomousTestingEnabled: true,
        codeReviewEnabled: true,
        migrationEnabled: true,
        debugEngineEnabled: true,
        accessibilityEnabled: true,
        debtScoringEnabled: true,
        dependencyManagementEnabled: true,
        productionFeedbackEnabled: true,
        healthDashboardEnabled: true,
        envManagementEnabled: true,
        orchestrationOptimizationEnabled: true,
        cinematicObservabilityEnabled: true,
      };

      wireFeatureHooks(registry, opts as RalphLoopOptions);

      expect(registry.getHooksForPhase('onBeforeBuild').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onBeforeTask').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onAfterTask').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onTaskError').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onHandoff').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onBuildComplete').length).toBeGreaterThan(0);
    });
  });

  describe('Build result aggregation', () => {
    it('should report correct task counts in build result', async () => {
      let capturedResult: BuildResult | null = null;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'test',
        priority: 50,
        handler: async (ctx) => { capturedResult = ctx as BuildResult; },
      });

      const prd = makePRD([
        { title: 'T1' },
        { title: 'T2' },
        { title: 'T3' },
        { title: 'T4' },
        { title: 'T5' },
      ]);
      const { results } = await simulateBuild(prd, registry);

      expect(capturedResult).not.toBeNull();
      expect(capturedResult!.totalTasks).toBe(5);
      expect(capturedResult!.successfulTasks).toBe(5);
      expect(capturedResult!.failedTasks).toBe(0);
    });

    it('should aggregate total duration across all tasks', async () => {
      let capturedResult: BuildResult | null = null;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'test',
        priority: 50,
        handler: async (ctx) => { capturedResult = ctx as BuildResult; },
      });

      const prd = makePRD([{ title: 'T1' }, { title: 'T2' }]);
      const { results } = await simulateBuild(prd, registry);

      const expectedDuration = results.reduce((s, r) => s + r.durationMs, 0);
      expect(capturedResult!.totalDurationMs).toBe(expectedDuration);
    });

    it('should count failed tasks when tasks are blocked', async () => {
      let capturedResult: BuildResult | null = null;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'test',
        priority: 50,
        handler: async (ctx) => { capturedResult = ctx as BuildResult; },
      });

      const prd = makePRD([
        { title: 'T1', status: 'pending' },
        { title: 'T2', status: 'blocked' },
        { title: 'T3', status: 'pending' },
      ]);
      await simulateBuild(prd, registry);

      expect(capturedResult!.successfulTasks).toBe(2);
      expect(capturedResult!.failedTasks).toBe(1);
    });
  });

  describe('Hook error resilience', () => {
    it('should continue build when a hook throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const afterHookCalled = vi.fn();

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'broken',
        priority: 10,
        handler: async () => { throw new Error('Hook crash!'); },
      });
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'healthy',
        priority: 20,
        handler: async () => { afterHookCalled(); },
      });

      const prd = makePRD([{ title: 'T1' }]);
      await expect(simulateBuild(prd, registry)).resolves.not.toThrow();
      expect(afterHookCalled).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log hook errors to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'crashing-module',
        priority: 50,
        handler: async () => { throw new Error('Module failed'); },
      });

      const prd = makePRD([{ title: 'T1' }]);
      await simulateBuild(prd, registry);

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[0]).toContain('crashing-module');

      consoleSpy.mockRestore();
    });

    it('should not skip remaining tasks when one task hook fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processedTasks: string[] = [];

      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'flaky',
        priority: 50,
        handler: async (ctx) => {
          const tc = ctx as TaskContext;
          if (tc.taskId === 'task-1') throw new Error('Hook failure on task-1');
          processedTasks.push(tc.taskId);
        },
      });

      const prd = makePRD([
        { id: 'task-0', title: 'T0' },
        { id: 'task-1', title: 'T1' },
        { id: 'task-2', title: 'T2' },
      ]);
      await simulateBuild(prd, registry);

      expect(processedTasks).toContain('task-0');
      expect(processedTasks).toContain('task-2');

      consoleSpy.mockRestore();
    });
  });

  describe('Dependency chain simulation', () => {
    it('should pass dependency info through task contexts', async () => {
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

      const prd = makePRD([
        { id: 'spec', dependencies: [] },
        { id: 'schema', dependencies: ['spec'] },
        { id: 'backend', dependencies: ['spec', 'schema'] },
      ]);
      await simulateBuild(prd, registry);

      expect(deps['spec']).toEqual([]);
      expect(deps['schema']).toEqual(['spec']);
      expect(deps['backend']).toEqual(['spec', 'schema']);
    });

    it('should produce output for each successful task', async () => {
      const prd = makePRD([
        { id: 'spec', title: 'Write spec' },
        { id: 'code', title: 'Write code' },
      ]);
      const { results } = await simulateBuild(prd, registry);

      expect(results[0].output).toContain('Write spec');
      expect(results[1].output).toContain('Write code');
    });
  });

  describe('Agent distribution', () => {
    it('should track which agents processed which tasks', async () => {
      const agentTasks: Record<string, string[]> = {};
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => {
          const tr = ctx as TaskResult;
          if (!agentTasks[tr.agentName]) agentTasks[tr.agentName] = [];
          agentTasks[tr.agentName].push(tr.taskId);
        },
      });

      const prd = makePRD([
        { id: 't1', agent: 'EARTH' },
        { id: 't2', agent: 'EARTH' },
        { id: 't3', agent: 'MARS' },
        { id: 't4', agent: 'VENUS' },
        { id: 't5', agent: 'SATURN' },
      ]);
      await simulateBuild(prd, registry);

      expect(agentTasks['EARTH']).toEqual(['t1', 't2']);
      expect(agentTasks['MARS']).toEqual(['t3']);
      expect(agentTasks['VENUS']).toEqual(['t4']);
      expect(agentTasks['SATURN']).toEqual(['t5']);
    });

    it('should support all 21 agent names', async () => {
      const agents = [
        'SUN', 'EARTH', 'MARS', 'VENUS', 'MERCURY', 'JUPITER', 'SATURN',
        'TITAN', 'EUROPA', 'ATLAS', 'URANUS', 'NEPTUNE', 'ANDROMEDA',
        'PLUTO', 'CHARON', 'IO', 'GANYMEDE', 'CALLISTO', 'ENCELADUS',
        'TRITON', 'MIMAS',
      ];

      const seenAgents: Set<string> = new Set();
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => { seenAgents.add((ctx as TaskContext).agentName); },
      });

      const prd = makePRD(agents.map(a => ({ agent: a })));
      await simulateBuild(prd, registry);

      expect(seenAgents.size).toBe(21);
      for (const agent of agents) {
        expect(seenAgents.has(agent)).toBe(true);
      }
    });
  });

  describe('Empty and edge cases', () => {
    it('should handle empty PRD with no tasks', async () => {
      const prd = makePRD([]);
      const { results, logs } = await simulateBuild(prd, registry);

      expect(results).toHaveLength(0);
      expect(logs.some(l => l.phase === 'onBeforeBuild')).toBe(true);
      expect(logs.some(l => l.phase === 'onBuildComplete')).toBe(true);
    });

    it('should handle single-task PRD', async () => {
      const prd = makePRD([{ title: 'Only task' }]);
      const { results } = await simulateBuild(prd, registry);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should handle PRD with no hooks registered', async () => {
      const prd = makePRD([{ title: 'T1' }, { title: 'T2' }]);
      const { results } = await simulateBuild(prd, registry);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should produce correct build result for single task', async () => {
      let capturedResult: BuildResult | null = null;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'test',
        priority: 50,
        handler: async (ctx) => { capturedResult = ctx as BuildResult; },
      });

      const prd = makePRD([{ title: 'Solo' }]);
      await simulateBuild(prd, registry);

      expect(capturedResult!.totalTasks).toBe(1);
      expect(capturedResult!.successfulTasks).toBe(1);
    });
  });

  describe('Observability tracing simulation', () => {
    it('should create a trace spanning the entire build', async () => {
      const traceEvents: { event: string; ts: number }[] = [];

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'observability',
        priority: 8,
        handler: async () => { traceEvents.push({ event: 'trace:start', ts: Date.now() }); },
      });
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'observability',
        priority: 8,
        handler: async () => { traceEvents.push({ event: 'span:start', ts: Date.now() }); },
      });
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'observability',
        priority: 8,
        handler: async () => { traceEvents.push({ event: 'span:end', ts: Date.now() }); },
      });
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'observability',
        priority: 8,
        handler: async () => { traceEvents.push({ event: 'trace:end', ts: Date.now() }); },
      });

      const prd = makePRD([{ title: 'T1' }, { title: 'T2' }]);
      await simulateBuild(prd, registry);

      expect(traceEvents[0].event).toBe('trace:start');
      expect(traceEvents[traceEvents.length - 1].event).toBe('trace:end');
      expect(traceEvents.filter(e => e.event === 'span:start')).toHaveLength(2);
      expect(traceEvents.filter(e => e.event === 'span:end')).toHaveLength(2);
    });

    it('should emit trace events for failed tasks via onTaskError', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorEvents: string[] = [];

      registry.register({
        phase: 'onTaskError',
        moduleName: 'observability',
        priority: 8,
        handler: async (ctx) => { errorEvents.push((ctx as TaskResult).taskId); },
      });

      const prd = makePRD([
        { id: 't1', status: 'pending' },
        { id: 't2', status: 'blocked' },
      ]);
      await simulateBuild(prd, registry);

      expect(errorEvents).toEqual(['t2']);
      consoleSpy.mockRestore();
    });
  });

  describe('Memory accumulation simulation', () => {
    it('should accumulate memory entries across tasks', async () => {
      const memory: Array<{ taskId: string; output: string }> = [];

      registry.register({
        phase: 'onAfterTask',
        moduleName: 'infinite-memory',
        priority: 48,
        handler: async (ctx) => {
          const tr = ctx as TaskResult;
          if (tr.output) memory.push({ taskId: tr.taskId, output: tr.output });
        },
      });

      const prd = makePRD([
        { id: 't1', title: 'Spec' },
        { id: 't2', title: 'Code' },
        { id: 't3', title: 'Test' },
      ]);
      await simulateBuild(prd, registry);

      expect(memory).toHaveLength(3);
      expect(memory[0].taskId).toBe('t1');
      expect(memory[2].taskId).toBe('t3');
    });
  });

  describe('Model routing simulation', () => {
    it('should record model selection per task', async () => {
      const models: Record<string, string> = {};
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'model-routing',
        priority: 42,
        handler: async (ctx) => {
          const tc = ctx as TaskContext;
          models[tc.taskId] = tc.agentName === 'JUPITER' ? 'qwen2.5:14b' : 'qwen2.5:7b';
        },
      });

      const prd = makePRD([
        { id: 't1', agent: 'EARTH' },
        { id: 't2', agent: 'JUPITER' },
      ]);
      await simulateBuild(prd, registry);

      expect(models['t1']).toBe('qwen2.5:7b');
      expect(models['t2']).toBe('qwen2.5:14b');
    });

    it('should run model routing before other onBeforeTask hooks', async () => {
      const order: string[] = [];
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'model-routing',
        priority: 10,
        handler: async () => { order.push('model-routing'); },
      });
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'perplexity',
        priority: 65,
        handler: async () => { order.push('perplexity'); },
      });

      const prd = makePRD([{ title: 'T1' }]);
      await simulateBuild(prd, registry);

      expect(order).toEqual(['model-routing', 'perplexity']);
    });
  });

  describe('CRDT collaboration simulation', () => {
    it('should track collaborative edits per build', async () => {
      const edits: string[] = [];
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'crdt-collaboration',
        priority: 52,
        handler: async (ctx) => { edits.push((ctx as TaskResult).taskId); },
      });

      const prd = makePRD([{ id: 't1' }, { id: 't2' }, { id: 't3' }]);
      await simulateBuild(prd, registry);

      expect(edits).toHaveLength(3);
    });

    it('should wire CRDT hooks at correct priority', () => {
      const opts: Partial<RalphLoopOptions> = { crdtCollaborationEnabled: true };
      wireFeatureHooks(registry, opts as RalphLoopOptions);

      const hooks = registry.getHooksForPhase('onBeforeBuild');
      const crdtHook = hooks.find(h => h.moduleName === 'crdt-collaboration');
      expect(crdtHook).toBeDefined();
      expect(crdtHook!.priority).toBe(52);
    });
  });

  describe('Perplexity research simulation', () => {
    it('should invoke research before task execution', async () => {
      const researched: string[] = [];
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'perplexity',
        priority: 65,
        handler: async (ctx) => { researched.push((ctx as TaskContext).taskId); },
      });

      const prd = makePRD([{ id: 't1' }, { id: 't2' }]);
      await simulateBuild(prd, registry);

      expect(researched).toEqual(['t1', 't2']);
    });

    it('should store research results after task', async () => {
      const stored: string[] = [];
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'perplexity',
        priority: 65,
        handler: async (ctx) => { stored.push((ctx as TaskResult).taskId); },
      });

      const prd = makePRD([{ id: 'r1' }, { id: 'r2' }]);
      await simulateBuild(prd, registry);

      expect(stored).toEqual(['r1', 'r2']);
    });
  });

  describe('Large build simulation', () => {
    it('should handle 20-task build', async () => {
      const tasks = Array.from({ length: 20 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        agent: ['EARTH', 'MARS', 'VENUS', 'SATURN'][i % 4],
      }));

      const prd = makePRD(tasks);
      const { results } = await simulateBuild(prd, registry);

      expect(results).toHaveLength(20);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should produce a valid build result for large builds', async () => {
      let capturedResult: BuildResult | null = null;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'test',
        priority: 50,
        handler: async (ctx) => { capturedResult = ctx as BuildResult; },
      });

      const tasks = Array.from({ length: 10 }, (_, i) => ({ title: `T${i}` }));
      const prd = makePRD(tasks);
      await simulateBuild(prd, registry);

      expect(capturedResult!.totalTasks).toBe(10);
      expect(capturedResult!.totalDurationMs).toBeGreaterThan(0);
    });
  });

  describe('Hook unregistration', () => {
    it('should allow unregistering hooks mid-build', async () => {
      let callCount = 0;
      const hookId = registry.register({
        phase: 'onBeforeTask',
        moduleName: 'removable',
        priority: 50,
        handler: async () => { callCount++; },
      });

      const prd = makePRD([{ title: 'T1' }]);
      await simulateBuild(prd, registry);
      expect(callCount).toBe(1);

      registry.unregister(hookId);
      await simulateBuild(prd, registry);
      expect(callCount).toBe(1); // not called again
    });

    it('should clear all hooks with registry.clear()', () => {
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'a',
        priority: 50,
        handler: async () => {},
      });
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'b',
        priority: 50,
        handler: async () => {},
      });

      expect(registry.getHookCount()).toBe(2);
      registry.clear();
      expect(registry.getHookCount()).toBe(0);
    });
  });

  describe('Workflow graph simulation', () => {
    it('should track workflow transitions', async () => {
      const transitions: Array<{ from: string; to: string }> = [];
      let lastTaskId = '';

      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'workflow-engine',
        priority: 38,
        handler: async (ctx) => {
          const tc = ctx as TaskContext;
          if (lastTaskId) transitions.push({ from: lastTaskId, to: tc.taskId });
          lastTaskId = tc.taskId;
        },
      });

      const prd = makePRD([
        { id: 'a', title: 'First' },
        { id: 'b', title: 'Second' },
        { id: 'c', title: 'Third' },
      ]);
      await simulateBuild(prd, registry);

      expect(transitions).toEqual([
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ]);
    });
  });
});
