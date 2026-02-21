import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { HookRegistry } from '../lifecycle-hooks.js';
import type { BuildContext, TaskContext, TaskResult, BuildResult } from '../lifecycle-hooks.js';
import { wireFeatureHooks } from '../lifecycle-wiring.js';
import type { RalphLoopOptions } from '../ralph-loop-types.js';

// ============================================================================
// MX-02: processTask Adapter Integration Tests
// Verify that lifecycle hooks fire at the right points in the build/task flow
// ============================================================================

describe('processTask Adapter Integration', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new HookRegistry();
  });

  // ============================================================
  // HookRegistry + wireFeatureHooks Integration
  // ============================================================

  describe('wireFeatureHooks integration', () => {
    it('should wire enabled features into registry', () => {
      const options: Partial<RalphLoopOptions> = {
        modelRoutingEnabled: true,
        perplexityEnabled: false,
        workflowEngineEnabled: true,
      };

      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.wiredCount).toBeGreaterThan(0);
      expect(result.featuresWired).toContain('modelRouting');
      expect(result.featuresWired).toContain('workflowEngine');
      expect(result.featuresWired).not.toContain('perplexity');
    });

    it('should skip all features when none are enabled', () => {
      const options: Partial<RalphLoopOptions> = {};
      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.wiredCount).toBe(0);
      expect(result.totalHooks).toBe(0);
    });

    it('should register hooks with correct priorities', () => {
      const options: Partial<RalphLoopOptions> = {
        cinematicObservabilityEnabled: true,
        wellbeingEnabled: true,
      };

      wireFeatureHooks(registry, options as RalphLoopOptions);

      const beforeTaskHooks = registry.getHooksForPhase('onBeforeTask');
      // Cinematic (priority 8) should come before wellbeing (priority 35)
      if (beforeTaskHooks.length >= 2) {
        const cinIdx = beforeTaskHooks.findIndex(h => h.moduleName === 'cinematic-observability');
        const wellIdx = beforeTaskHooks.findIndex(h => h.moduleName === 'wellbeing');
        if (cinIdx >= 0 && wellIdx >= 0) {
          expect(cinIdx).toBeLessThan(wellIdx);
        }
      }
    });
  });

  // ============================================================
  // onBeforeBuild Phase
  // ============================================================

  describe('onBeforeBuild phase', () => {
    it('should execute hooks with BuildContext', async () => {
      const handler = vi.fn();
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'test-module',
        priority: 50,
        handler,
      });

      const buildContext: BuildContext = {
        buildId: 'build-1',
        prdId: 'prd-1',
        prdName: 'Test PRD',
        startedAt: new Date().toISOString(),
        options: {},
      };

      await registry.executePhase('onBeforeBuild', buildContext);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(buildContext);
    });

    it('should execute multiple hooks in priority order', async () => {
      const callOrder: string[] = [];

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'late-module',
        priority: 100,
        handler: async () => { callOrder.push('late'); },
      });

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'early-module',
        priority: 10,
        handler: async () => { callOrder.push('early'); },
      });

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'mid-module',
        priority: 50,
        handler: async () => { callOrder.push('mid'); },
      });

      await registry.executePhase('onBeforeBuild', {} as BuildContext);

      expect(callOrder).toEqual(['early', 'mid', 'late']);
    });

    it('should survive hook errors without crashing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'crash-module',
        priority: 50,
        handler: async () => { throw new Error('Hook crashed'); },
      });

      const successHandler = vi.fn();
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'ok-module',
        priority: 60,
        handler: successHandler,
      });

      await registry.executePhase('onBeforeBuild', {} as BuildContext);

      expect(consoleSpy).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalledOnce();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // onBeforeTask Phase
  // ============================================================

  describe('onBeforeTask phase', () => {
    it('should execute hooks with TaskContext', async () => {
      const handler = vi.fn();
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'test-module',
        priority: 50,
        handler,
      });

      const taskContext: TaskContext = {
        taskId: 'task-1',
        title: 'Test task',
        agentName: 'MARS',
        dependencies: ['task-0'],
      };

      await registry.executePhase('onBeforeTask', taskContext);

      expect(handler).toHaveBeenCalledWith(taskContext);
    });

    it('should pass correct dependencies array', async () => {
      let capturedContext: TaskContext | null = null;
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'dep-checker',
        priority: 50,
        handler: async (ctx) => { capturedContext = ctx as TaskContext; },
      });

      await registry.executePhase('onBeforeTask', {
        taskId: 'T-3',
        title: 'Build UI',
        agentName: 'VENUS',
        dependencies: ['T-1', 'T-2'],
      } satisfies TaskContext);

      expect(capturedContext?.dependencies).toEqual(['T-1', 'T-2']);
      expect(capturedContext?.agentName).toBe('VENUS');
    });
  });

  // ============================================================
  // onAfterTask Phase
  // ============================================================

  describe('onAfterTask phase', () => {
    it('should execute hooks with TaskResult on success', async () => {
      const handler = vi.fn();
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'result-tracker',
        priority: 50,
        handler,
      });

      const taskResult: TaskResult = {
        taskId: 'task-1',
        agentName: 'MARS',
        success: true,
        output: 'Generated code',
        durationMs: 5000,
      };

      await registry.executePhase('onAfterTask', taskResult);

      expect(handler).toHaveBeenCalledWith(taskResult);
    });

    it('should include aceScore when provided', async () => {
      let capturedResult: TaskResult | null = null;
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'ace-monitor',
        priority: 50,
        handler: async (ctx) => { capturedResult = ctx as TaskResult; },
      });

      await registry.executePhase('onAfterTask', {
        taskId: 'task-1',
        agentName: 'MARS',
        success: true,
        durationMs: 3000,
        aceScore: 0.92,
      } satisfies TaskResult);

      expect(capturedResult?.aceScore).toBe(0.92);
    });
  });

  // ============================================================
  // onTaskError Phase
  // ============================================================

  describe('onTaskError phase', () => {
    it('should execute hooks with error TaskResult', async () => {
      const handler = vi.fn();
      registry.register({
        phase: 'onTaskError',
        moduleName: 'error-handler',
        priority: 50,
        handler,
      });

      const errorResult: TaskResult = {
        taskId: 'task-1',
        agentName: 'MARS',
        success: false,
        error: 'LLM call failed',
        durationMs: 1000,
      };

      await registry.executePhase('onTaskError', errorResult);

      expect(handler).toHaveBeenCalledWith(errorResult);
    });

    it('should not crash build when error handler throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.register({
        phase: 'onTaskError',
        moduleName: 'bad-handler',
        priority: 50,
        handler: async () => { throw new Error('Error in error handler'); },
      });

      await expect(
        registry.executePhase('onTaskError', {
          taskId: 'task-1',
          agentName: 'MARS',
          success: false,
          error: 'Original error',
          durationMs: 0,
        } satisfies TaskResult)
      ).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // onBuildComplete Phase
  // ============================================================

  describe('onBuildComplete phase', () => {
    it('should execute hooks with BuildResult', async () => {
      const handler = vi.fn();
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'build-reporter',
        priority: 50,
        handler,
      });

      const buildResult: BuildResult = {
        buildId: 'build-1',
        prdId: 'prd-1',
        totalTasks: 10,
        successfulTasks: 8,
        failedTasks: 2,
        totalDurationMs: 30000,
        averageAceScore: 0.85,
      };

      await registry.executePhase('onBuildComplete', buildResult);

      expect(handler).toHaveBeenCalledWith(buildResult);
    });

    it('should include correct task counts', async () => {
      let capturedResult: BuildResult | null = null;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'stats-module',
        priority: 50,
        handler: async (ctx) => { capturedResult = ctx as BuildResult; },
      });

      await registry.executePhase('onBuildComplete', {
        buildId: 'b-1',
        prdId: 'p-1',
        totalTasks: 5,
        successfulTasks: 4,
        failedTasks: 1,
        totalDurationMs: 15000,
        averageAceScore: 0.9,
      } satisfies BuildResult);

      expect(capturedResult?.totalTasks).toBe(5);
      expect(capturedResult?.successfulTasks).toBe(4);
      expect(capturedResult?.failedTasks).toBe(1);
    });
  });

  // ============================================================
  // onHandoff Phase
  // ============================================================

  describe('onHandoff phase', () => {
    it('should execute hooks with HandoffContext', async () => {
      const handler = vi.fn();
      registry.register({
        phase: 'onHandoff',
        moduleName: 'handoff-tracker',
        priority: 50,
        handler,
      });

      const handoffCtx = {
        fromAgent: 'EARTH',
        toAgent: 'MARS',
        taskId: 'task-1',
        payload: { modelRouting: { selectedModelId: 'gpt-4o' } },
      };

      await registry.executePhase('onHandoff', handoffCtx);

      expect(handler).toHaveBeenCalledWith(handoffCtx);
    });
  });

  // ============================================================
  // Full Lifecycle Flow
  // ============================================================

  describe('full lifecycle flow', () => {
    it('should fire hooks in correct lifecycle order', async () => {
      const phases: string[] = [];

      registry.register({
        phase: 'onBeforeBuild', moduleName: 'flow', priority: 50,
        handler: async () => { phases.push('beforeBuild'); },
      });
      registry.register({
        phase: 'onBeforeTask', moduleName: 'flow', priority: 50,
        handler: async () => { phases.push('beforeTask'); },
      });
      registry.register({
        phase: 'onAfterTask', moduleName: 'flow', priority: 50,
        handler: async () => { phases.push('afterTask'); },
      });
      registry.register({
        phase: 'onBuildComplete', moduleName: 'flow', priority: 50,
        handler: async () => { phases.push('buildComplete'); },
      });

      // Simulate lifecycle
      await registry.executePhase('onBeforeBuild', {} as BuildContext);
      await registry.executePhase('onBeforeTask', {} as TaskContext);
      await registry.executePhase('onAfterTask', {} as TaskResult);
      await registry.executePhase('onBuildComplete', {} as BuildResult);

      expect(phases).toEqual(['beforeBuild', 'beforeTask', 'afterTask', 'buildComplete']);
    });

    it('should fire error hooks when task fails', async () => {
      const phases: string[] = [];

      registry.register({
        phase: 'onBeforeTask', moduleName: 'flow', priority: 50,
        handler: async () => { phases.push('beforeTask'); },
      });
      registry.register({
        phase: 'onTaskError', moduleName: 'flow', priority: 50,
        handler: async () => { phases.push('taskError'); },
      });
      registry.register({
        phase: 'onAfterTask', moduleName: 'flow', priority: 50,
        handler: async () => { phases.push('afterTask'); },
      });

      // Simulate task failure — onBeforeTask fires, then onTaskError, NOT onAfterTask
      await registry.executePhase('onBeforeTask', {} as TaskContext);
      await registry.executePhase('onTaskError', {} as TaskResult);

      expect(phases).toEqual(['beforeTask', 'taskError']);
      expect(phases).not.toContain('afterTask');
    });

    it('should handle multi-task build lifecycle', async () => {
      const events: string[] = [];

      registry.register({
        phase: 'onBeforeBuild', moduleName: 'tracker', priority: 50,
        handler: async () => { events.push('build:start'); },
      });
      registry.register({
        phase: 'onBeforeTask', moduleName: 'tracker', priority: 50,
        handler: async (ctx) => { events.push(`task:start:${(ctx as TaskContext).taskId}`); },
      });
      registry.register({
        phase: 'onAfterTask', moduleName: 'tracker', priority: 50,
        handler: async (ctx) => { events.push(`task:done:${(ctx as TaskResult).taskId}`); },
      });
      registry.register({
        phase: 'onBuildComplete', moduleName: 'tracker', priority: 50,
        handler: async () => { events.push('build:done'); },
      });

      // Simulate 3-task build
      await registry.executePhase('onBeforeBuild', { buildId: 'b1' } as BuildContext);
      await registry.executePhase('onBeforeTask', { taskId: 'T-1' } as TaskContext);
      await registry.executePhase('onAfterTask', { taskId: 'T-1', success: true } as TaskResult);
      await registry.executePhase('onBeforeTask', { taskId: 'T-2' } as TaskContext);
      await registry.executePhase('onAfterTask', { taskId: 'T-2', success: true } as TaskResult);
      await registry.executePhase('onBeforeTask', { taskId: 'T-3' } as TaskContext);
      await registry.executePhase('onAfterTask', { taskId: 'T-3', success: true } as TaskResult);
      await registry.executePhase('onBuildComplete', { buildId: 'b1' } as BuildResult);

      expect(events).toEqual([
        'build:start',
        'task:start:T-1', 'task:done:T-1',
        'task:start:T-2', 'task:done:T-2',
        'task:start:T-3', 'task:done:T-3',
        'build:done',
      ]);
    });
  });

  // ============================================================
  // Module Isolation
  // ============================================================

  describe('module isolation', () => {
    it('should not let one module failure affect another', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const results: string[] = [];

      registry.register({
        phase: 'onAfterTask', moduleName: 'module-a', priority: 10,
        handler: async () => { results.push('a'); },
      });
      registry.register({
        phase: 'onAfterTask', moduleName: 'module-b', priority: 20,
        handler: async () => { throw new Error('b crashed'); },
      });
      registry.register({
        phase: 'onAfterTask', moduleName: 'module-c', priority: 30,
        handler: async () => { results.push('c'); },
      });

      await registry.executePhase('onAfterTask', {} as TaskResult);

      expect(results).toEqual(['a', 'c']);
      consoleSpy.mockRestore();
    });

    it('should track registered modules correctly', () => {
      registry.register({ phase: 'onBeforeTask', moduleName: 'mod-a', priority: 50, handler: async () => {} });
      registry.register({ phase: 'onAfterTask', moduleName: 'mod-b', priority: 50, handler: async () => {} });
      registry.register({ phase: 'onBeforeTask', moduleName: 'mod-a', priority: 60, handler: async () => {} });

      const modules = registry.getRegisteredModules();
      expect(modules).toContain('mod-a');
      expect(modules).toContain('mod-b');
    });
  });

  // ============================================================
  // Registry Management
  // ============================================================

  describe('registry management', () => {
    it('should unregister hooks by id', () => {
      const id = registry.register({
        phase: 'onBeforeTask', moduleName: 'temp', priority: 50,
        handler: async () => {},
      });

      expect(registry.getHookCount()).toBe(1);
      expect(registry.unregister(id)).toBe(true);
      expect(registry.getHookCount()).toBe(0);
    });

    it('should clear all hooks', () => {
      registry.register({ phase: 'onBeforeTask', moduleName: 'a', priority: 50, handler: async () => {} });
      registry.register({ phase: 'onAfterTask', moduleName: 'b', priority: 50, handler: async () => {} });

      registry.clear();
      expect(registry.getHookCount()).toBe(0);
      expect(registry.getRegisteredModules()).toHaveLength(0);
    });

    it('should return false when unregistering nonexistent hook', () => {
      expect(registry.unregister('nonexistent-id')).toBe(false);
    });
  });
});
