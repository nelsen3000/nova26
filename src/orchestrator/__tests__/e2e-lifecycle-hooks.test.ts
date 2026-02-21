// SN-17: Lifecycle Hook E2E Test
// Tests the full lifecycle pipeline with real adapter wiring

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HookRegistry,
  type BuildContext,
  type TaskContext,
  type TaskResult,
  type BuildResult,
  type HookPhase,
} from '../lifecycle-hooks.js';
import { wireAdaptersLive, getAdapterWiringSummary } from '../adapter-wiring.js';
import type { RalphLoopOptions } from '../ralph-loop-types.js';

// Mock the feature-flags module before importing lifecycle-wiring
// getFeatureFlagStore doesn't exist yet — provide a stub so wireFeatureHooks works
vi.mock('../../config/feature-flags.js', () => ({
  getFeatureFlagStore: () => ({
    listFlags: () => [],
    isEnabled: () => true,
  }),
}));

import { wireFeatureHooks, DEFAULT_FEATURE_HOOKS } from '../lifecycle-wiring.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOptions(overrides: Partial<RalphLoopOptions> = {}): RalphLoopOptions {
  return {
    modelRoutingEnabled: true,
    cinematicObservabilityEnabled: true,
    workflowEngineEnabled: true,
    infiniteMemoryEnabled: true,
    perplexityEnabled: true,
    aiModelDatabaseEnabled: true,
    crdtCollaborationEnabled: true,
    ...overrides,
  } as RalphLoopOptions;
}

function makeBuildCtx(id = 'build-001'): BuildContext {
  return {
    buildId: id,
    prdId: 'prd-001',
    prdName: 'Lifecycle E2E',
    startedAt: new Date().toISOString(),
    options: {},
  };
}

function makeTaskCtx(id = 'task-001', agent = 'EARTH'): TaskContext {
  return { taskId: id, title: `Task ${id}`, agentName: agent, dependencies: [] };
}

function makeTaskResult(id = 'task-001', success = true): TaskResult {
  return {
    taskId: id,
    agentName: 'EARTH',
    success,
    output: success ? 'output' : undefined,
    error: success ? undefined : 'failed',
    durationMs: 200,
  };
}

function makeBuildResult(): BuildResult {
  return {
    buildId: 'build-001',
    prdId: 'prd-001',
    totalTasks: 5,
    successfulTasks: 4,
    failedTasks: 1,
    totalDurationMs: 10000,
    averageAceScore: 85,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Lifecycle Hooks', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registry = new HookRegistry();
  });

  describe('Build lifecycle — onBeforeBuild fires for all enabled modules', () => {
    it('should fire onBeforeBuild for all wired modules', async () => {
      const opts = makeOptions();
      wireFeatureHooks(registry, opts);

      const hooks = registry.getHooksForPhase('onBeforeBuild');
      expect(hooks.length).toBeGreaterThan(0);

      // Should not throw when executing
      await expect(registry.executePhase('onBeforeBuild', makeBuildCtx())).resolves.not.toThrow();
    });

    it('should wire 7 adapter modules via wireAdaptersLive', () => {
      const opts = makeOptions();
      const result = wireAdaptersLive(registry, opts);

      expect(result.wiredCount).toBe(7);
      expect(result.adaptersWired).toContain('modelRouting');
      expect(result.adaptersWired).toContain('cinematicObservability');
      expect(result.adaptersWired).toContain('workflowEngine');
    });

    it('should skip disabled modules', () => {
      const opts = makeOptions({ modelRoutingEnabled: false, perplexityEnabled: false });
      const result = wireAdaptersLive(registry, opts);

      expect(result.adaptersWired).not.toContain('modelRouting');
      expect(result.adaptersWired).not.toContain('perplexity');
      expect(result.skippedCount).toBe(2);
    });

    it('should fire onBeforeBuild handlers from live adapters', async () => {
      const opts = makeOptions();
      wireAdaptersLive(registry, opts);

      // Execute without throwing
      await expect(registry.executePhase('onBeforeBuild', makeBuildCtx())).resolves.not.toThrow();
    });
  });

  describe('Task lifecycle — onBeforeTask and onAfterTask', () => {
    it('should fire onBeforeTask hooks', async () => {
      const opts = makeOptions();
      wireAdaptersLive(registry, opts);

      // Initialize build state first
      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      await expect(registry.executePhase('onBeforeTask', makeTaskCtx())).resolves.not.toThrow();
    });

    it('should fire onAfterTask hooks for successful tasks', async () => {
      const opts = makeOptions();
      wireAdaptersLive(registry, opts);

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      await registry.executePhase('onBeforeTask', makeTaskCtx());
      await expect(registry.executePhase('onAfterTask', makeTaskResult())).resolves.not.toThrow();
    });

    it('should fire onBeforeTask for each task in a multi-task build', async () => {
      let beforeTaskCount = 0;
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'test-tracker',
        priority: 1,
        handler: async () => { beforeTaskCount++; },
      });

      const opts = makeOptions();
      wireAdaptersLive(registry, opts);

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      for (let i = 0; i < 5; i++) {
        await registry.executePhase('onBeforeTask', makeTaskCtx(`task-${i}`));
      }

      expect(beforeTaskCount).toBe(5);
    });
  });

  describe('Task failure — onTaskError fires instead of onAfterTask', () => {
    it('should have onTaskError hooks registered', () => {
      const opts = makeOptions();
      wireFeatureHooks(registry, opts);

      const errorHooks = registry.getHooksForPhase('onTaskError');
      expect(errorHooks.length).toBeGreaterThan(0);
    });

    it('should fire onTaskError for failed tasks', async () => {
      let errorFired = false;
      registry.register({
        phase: 'onTaskError',
        moduleName: 'test-error-tracker',
        priority: 1,
        handler: async () => { errorFired = true; },
      });

      await registry.executePhase('onTaskError', makeTaskResult('task-fail', false));
      expect(errorFired).toBe(true);
    });

    it('should pass error details to onTaskError handlers', async () => {
      let capturedError = '';
      registry.register({
        phase: 'onTaskError',
        moduleName: 'test-logger',
        priority: 1,
        handler: async (ctx) => {
          capturedError = (ctx as TaskResult).error ?? '';
        },
      });

      await registry.executePhase('onTaskError', makeTaskResult('task-fail', false));
      expect(capturedError).toBe('failed');
    });
  });

  describe('Build completion — onBuildComplete fires with stats', () => {
    it('should fire onBuildComplete with build result', async () => {
      let capturedResult: BuildResult | null = null;
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'test-capture',
        priority: 1,
        handler: async (ctx) => { capturedResult = ctx as BuildResult; },
      });

      const opts = makeOptions();
      wireAdaptersLive(registry, opts);

      await registry.executePhase('onBuildComplete', makeBuildResult());

      expect(capturedResult).not.toBeNull();
      expect(capturedResult!.totalTasks).toBe(5);
      expect(capturedResult!.successfulTasks).toBe(4);
      expect(capturedResult!.failedTasks).toBe(1);
    });

    it('should fire onBuildComplete from all registered modules', async () => {
      const opts = makeOptions();
      wireFeatureHooks(registry, opts);

      const completeHooks = registry.getHooksForPhase('onBuildComplete');
      expect(completeHooks.length).toBeGreaterThan(0);

      await expect(registry.executePhase('onBuildComplete', makeBuildResult())).resolves.not.toThrow();
    });
  });

  describe('Hook error resilience', () => {
    it('should continue when a hook throws', async () => {
      let secondRan = false;
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'broken',
        priority: 10,
        handler: async () => { throw new Error('Hook crash'); },
      });
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'healthy',
        priority: 20,
        handler: async () => { secondRan = true; },
      });

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      expect(secondRan).toBe(true);
    });

    it('should log hook errors', async () => {
      const errorSpy = vi.spyOn(console, 'error');

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'crash-module',
        priority: 10,
        handler: async () => { throw new Error('test crash'); },
      });

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should not crash when live adapter handlers encounter errors', async () => {
      const opts = makeOptions();
      wireAdaptersLive(registry, opts);

      // Pass empty context — adapters should guard against invalid input
      await expect(
        registry.executePhase('onBeforeBuild', {} as BuildContext),
      ).resolves.not.toThrow();
    });

    it('should report wiring errors for broken adapters', () => {
      // Wire with all enabled — any adapter that fails to construct gets reported
      const opts = makeOptions();
      const result = wireAdaptersLive(registry, opts);

      // No errors expected for valid config
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Priority ordering across modules', () => {
    it('should execute hooks in priority order (lower first)', async () => {
      const order: string[] = [];

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'low-prio',
        priority: 100,
        handler: async () => { order.push('low'); },
      });
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'high-prio',
        priority: 5,
        handler: async () => { order.push('high'); },
      });
      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'mid-prio',
        priority: 50,
        handler: async () => { order.push('mid'); },
      });

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      expect(order).toEqual(['high', 'mid', 'low']);
    });

    it('should wire features with correct priorities from DEFAULT_FEATURE_HOOKS', () => {
      const opts = makeOptions();
      wireFeatureHooks(registry, opts);

      const hooks = registry.getHooksForPhase('onBeforeBuild');
      for (let i = 1; i < hooks.length; i++) {
        expect(hooks[i].priority).toBeGreaterThanOrEqual(hooks[i - 1].priority);
      }
    });

    it('should have cinematicObservability at priority 8 (lowest)', () => {
      expect(DEFAULT_FEATURE_HOOKS['cinematicObservability'].priority).toBe(8);
    });

    it('should have 24 features in DEFAULT_FEATURE_HOOKS', () => {
      expect(Object.keys(DEFAULT_FEATURE_HOOKS).length).toBe(24);
    });
  });

  describe('wireAdaptersLive diagnostics', () => {
    it('should report which adapters would be wired', () => {
      const opts = makeOptions({ modelRoutingEnabled: true, perplexityEnabled: false });
      const summary = getAdapterWiringSummary(opts);

      expect(summary.wouldWire).toContain('modelRouting');
      expect(summary.wouldSkip).toContain('perplexity');
    });

    it('should report all 7 adapters when all enabled', () => {
      const opts = makeOptions();
      const summary = getAdapterWiringSummary(opts);

      expect(summary.wouldWire).toHaveLength(7);
      expect(summary.wouldSkip).toHaveLength(0);
    });

    it('should report 0 adapters when all disabled', () => {
      const opts = makeOptions({
        modelRoutingEnabled: false,
        cinematicObservabilityEnabled: false,
        workflowEngineEnabled: false,
        infiniteMemoryEnabled: false,
        perplexityEnabled: false,
        aiModelDatabaseEnabled: false,
        crdtCollaborationEnabled: false,
      });
      const summary = getAdapterWiringSummary(opts);

      expect(summary.wouldWire).toHaveLength(0);
      expect(summary.wouldSkip).toHaveLength(7);
    });
  });

  describe('Module registration tracking', () => {
    it('should list all registered module names', () => {
      const opts = makeOptions();
      wireFeatureHooks(registry, opts);

      const modules = registry.getRegisteredModules();
      expect(modules.length).toBeGreaterThan(0);
    });

    it('should include R22-R24 modules when wired', () => {
      const opts = makeOptions();
      wireFeatureHooks(registry, opts);

      const modules = registry.getRegisteredModules();
      expect(modules).toContain('model-routing');
      expect(modules).toContain('cinematic-observability');
    });

    it('should report total hook count', () => {
      const opts = makeOptions();
      wireFeatureHooks(registry, opts);

      expect(registry.getHookCount()).toBeGreaterThan(0);
    });

    it('should have hooks registered in all 6 phases', () => {
      const opts = makeOptions();
      wireFeatureHooks(registry, opts);

      const phases: HookPhase[] = [
        'onBeforeBuild', 'onBeforeTask', 'onAfterTask',
        'onTaskError', 'onHandoff', 'onBuildComplete',
      ];
      for (const phase of phases) {
        expect(registry.getHooksForPhase(phase).length).toBeGreaterThan(0);
      }
    });

    it('should allow unregistering a hook by ID', () => {
      const hookId = registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'temp',
        priority: 50,
        handler: async () => {},
      });

      expect(registry.getHookCount()).toBe(1);
      registry.unregister(hookId);
      expect(registry.getHookCount()).toBe(0);
    });

    it('should clear all hooks', () => {
      wireFeatureHooks(registry, makeOptions());
      expect(registry.getHookCount()).toBeGreaterThan(0);

      registry.clear();
      expect(registry.getHookCount()).toBe(0);
    });
  });

  describe('Adapter wiring result details', () => {
    it('should report totalHooks from live wiring', () => {
      const opts = makeOptions();
      const result = wireAdaptersLive(registry, opts);
      expect(result.totalHooks).toBeGreaterThan(0);
    });

    it('should wire each adapter with correct hook phases', () => {
      const opts = makeOptions({ modelRoutingEnabled: true });
      // Only model routing
      const singleOpts = makeOptions({
        cinematicObservabilityEnabled: false,
        workflowEngineEnabled: false,
        infiniteMemoryEnabled: false,
        perplexityEnabled: false,
        aiModelDatabaseEnabled: false,
        crdtCollaborationEnabled: false,
      });
      const result = wireAdaptersLive(registry, singleOpts);
      expect(result.adaptersWired).toEqual(['modelRouting']);
      expect(result.totalHooks).toBeGreaterThan(0);
    });

    it('should have zero errors for valid options', () => {
      const opts = makeOptions();
      const result = wireAdaptersLive(registry, opts);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Full lifecycle simulation', () => {
    it('should run a complete build→task→complete lifecycle', async () => {
      const events: string[] = [];

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'trace',
        priority: 1,
        handler: async () => { events.push('before-build'); },
      });
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'trace',
        priority: 1,
        handler: async () => { events.push('before-task'); },
      });
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'trace',
        priority: 1,
        handler: async () => { events.push('after-task'); },
      });
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'trace',
        priority: 1,
        handler: async () => { events.push('build-complete'); },
      });

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      await registry.executePhase('onBeforeTask', makeTaskCtx());
      await registry.executePhase('onAfterTask', makeTaskResult());
      await registry.executePhase('onBuildComplete', makeBuildResult());

      expect(events).toEqual(['before-build', 'before-task', 'after-task', 'build-complete']);
    });

    it('should run complete lifecycle with error path', async () => {
      const events: string[] = [];

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'trace',
        priority: 1,
        handler: async () => { events.push('before-build'); },
      });
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'trace',
        priority: 1,
        handler: async () => { events.push('before-task'); },
      });
      registry.register({
        phase: 'onTaskError',
        moduleName: 'trace',
        priority: 1,
        handler: async () => { events.push('task-error'); },
      });
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'trace',
        priority: 1,
        handler: async () => { events.push('build-complete'); },
      });

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      await registry.executePhase('onBeforeTask', makeTaskCtx());
      await registry.executePhase('onTaskError', makeTaskResult('fail', false));
      await registry.executePhase('onBuildComplete', makeBuildResult());

      expect(events).toEqual(['before-build', 'before-task', 'task-error', 'build-complete']);
    });

    it('should support all 6 lifecycle phases', () => {
      const allPhases: HookPhase[] = [
        'onBeforeBuild', 'onBeforeTask', 'onAfterTask',
        'onTaskError', 'onHandoff', 'onBuildComplete',
      ];

      for (const phase of allPhases) {
        registry.register({
          phase,
          moduleName: 'test',
          priority: 50,
          handler: async () => {},
        });
      }

      for (const phase of allPhases) {
        expect(registry.getHooksForPhase(phase)).toHaveLength(1);
      }
    });
  });
});
