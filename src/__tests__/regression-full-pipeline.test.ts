// SN-24: Full Regression Suite
// Exercises every major subsystem in a single build simulation pipeline

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Config layer
import {
  resolveConfig,
  getEnabledFeatures,
  getConfigSummary,
  DEFAULT_RALPH_LOOP_OPTIONS,
} from '../config/config-resolver.js';

// Feature flags
import {
  FeatureFlagRegistry,
  FeatureFlagStore,
  resetGlobalRegistry,
  resetFeatureFlagStore,
  registerDefaultFlags,
} from '../config/feature-flags.js';

// Lifecycle hooks
import {
  HookRegistry,
  type BuildContext,
  type TaskContext,
  type TaskResult,
  type BuildResult,
} from '../orchestrator/lifecycle-hooks.js';

// Adapter wiring
import { wireAdaptersLive, getAdapterWiringSummary } from '../orchestrator/adapter-wiring.js';

// Event bus
import { EventBus } from '../orchestrator/event-bus.js';

// Handoff pipeline
import {
  HandoffContextBuilder,
  resetHandoffContextBuilder,
  type ModelRoutingState,
  type MemoryState,
} from '../orchestrator/handoff-context.js';
import { HandoffReceiver, resetHandoffReceiver } from '../orchestrator/handoff-receiver.js';

// Module health
import {
  ModuleHealthChecker,
  registerDefaultHealthChecks,
  formatHealthReport,
  resetModuleHealthChecker,
  type ModuleStatus,
} from '../orchestrator/module-health.js';

// DI container
import { DIContainer, resetDIContainer } from '../orchestrator/di-container.js';

// Notifications
import {
  NotificationDispatcher,
  resetGlobalDispatcher,
  type NotificationHandler,
  type Notification,
  type NotificationPayload,
} from '../notifications/dispatcher.js';

import type { RalphLoopOptions } from '../orchestrator/ralph-loop-types.js';

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
    prdName: 'Regression Test',
    startedAt: new Date().toISOString(),
    options: {},
  };
}

function makeTaskCtx(id: string, agent: string): TaskContext {
  return { taskId: id, title: `Task ${id}`, agentName: agent, dependencies: [] };
}

function makeTaskResult(id: string, success = true): TaskResult {
  return {
    taskId: id,
    success,
    output: success ? 'Generated code' : '',
    durationMs: 100 + Math.floor(Math.random() * 400),
    error: success ? undefined : 'Compilation error',
  };
}

function makeBuildResult(taskCount: number, failCount: number): BuildResult {
  return {
    buildId: 'build-001',
    totalTasks: taskCount,
    successfulTasks: taskCount - failCount,
    failedTasks: failCount,
    totalDurationMs: 5000,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Full Regression Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    resetGlobalRegistry();
    resetFeatureFlagStore();
    resetHandoffContextBuilder();
    resetHandoffReceiver();
    resetModuleHealthChecker();
    resetDIContainer();
    resetGlobalDispatcher();
  });

  describe('Phase 1: Config resolution', () => {
    it('should resolve config from defaults', () => {
      const result = resolveConfig(null, {});
      expect(result.options).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(result.sources.defaults).toBeGreaterThan(0);
    });

    it('should merge file config over defaults', () => {
      const result = resolveConfig({
        options: { modelRoutingEnabled: true, parallelMode: true },
      }, {});
      expect(result.options.modelRoutingEnabled).toBe(true);
      expect(result.options.parallelMode).toBe(true);
    });

    it('should merge env vars over file config', () => {
      const result = resolveConfig(
        { options: { concurrency: 2 } },
        { NOVA26_CONCURRENCY: '8' }
      );
      expect(result.options.concurrency).toBe(8);
    });

    it('should generate human-readable summary', () => {
      const result = resolveConfig({ options: { modelRoutingEnabled: true } }, {});
      const summary = getConfigSummary(result);
      expect(summary).toContain('Nova26 Config Resolution');
      expect(summary).toContain('modelRoutingEnabled: ON');
    });
  });

  describe('Phase 2: Feature flag check', () => {
    it('should register and check default flags', () => {
      const registry = new FeatureFlagRegistry();
      registerDefaultFlags(registry);
      const store = new FeatureFlagStore(registry);

      expect(store.isEnabled('model-routing')).toBe(true);
      expect(store.isEnabled('perplexity')).toBe(false);
      expect(store.listFlags().length).toBeGreaterThanOrEqual(8);
    });

    it('should allow programmatic flag override', () => {
      const registry = new FeatureFlagRegistry();
      registerDefaultFlags(registry);
      registry.set('perplexity', true);
      expect(registry.getBoolean('perplexity')).toBe(true);
    });
  });

  describe('Phase 3: Lifecycle wiring', () => {
    it('should wire all 7 adapters when all enabled', () => {
      const registry = new HookRegistry();
      const opts = makeOptions();
      const result = wireAdaptersLive(registry, opts);

      expect(result.wiredCount).toBe(7);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip disabled adapters', () => {
      const registry = new HookRegistry();
      const opts = makeOptions({ modelRoutingEnabled: false, perplexityEnabled: false });
      const result = wireAdaptersLive(registry, opts);

      expect(result.wiredCount).toBe(5);
    });

    it('should report wiring summary before execution', () => {
      const summary = getAdapterWiringSummary(makeOptions());
      expect(summary.wouldWire.length).toBe(7);
      expect(summary.wouldSkip.length).toBe(0);
    });
  });

  describe('Phase 4: DI container setup', () => {
    it('should register and resolve singletons', () => {
      const container = new DIContainer();
      let callCount = 0;
      container.register('bus', () => { callCount++; return new EventBus(); }, 'singleton');

      const bus1 = container.resolve<EventBus>('bus');
      const bus2 = container.resolve<EventBus>('bus');
      expect(bus1).toBe(bus2);
      expect(callCount).toBe(1);
    });

    it('should register and resolve transients', () => {
      const container = new DIContainer();
      container.register('bus', () => new EventBus(), 'transient');

      const bus1 = container.resolve<EventBus>('bus');
      const bus2 = container.resolve<EventBus>('bus');
      expect(bus1).not.toBe(bus2);
    });

    it('should throw on unregistered dependency', () => {
      const container = new DIContainer();
      expect(() => container.resolve('missing')).toThrow('No registration found');
    });

    it('should list registered names', () => {
      const container = new DIContainer();
      container.register('a', () => 1);
      container.register('b', () => 2);
      expect(container.getRegisteredNames()).toEqual(['a', 'b']);
    });
  });

  describe('Phase 5: Build start → task execution (3 tasks)', () => {
    it('should execute onBeforeBuild for all hooks', async () => {
      const registry = new HookRegistry();
      wireAdaptersLive(registry, makeOptions());

      await expect(
        registry.executePhase('onBeforeBuild', makeBuildCtx())
      ).resolves.not.toThrow();
    });

    it('should execute onBeforeTask for each task', async () => {
      const registry = new HookRegistry();
      wireAdaptersLive(registry, makeOptions());

      const agents = ['EARTH', 'MARS', 'VENUS'];
      for (let i = 0; i < 3; i++) {
        await expect(
          registry.executePhase('onBeforeTask', makeTaskCtx(`task-${i}`, agents[i]))
        ).resolves.not.toThrow();
      }
    });

    it('should execute onAfterTask for completed tasks', async () => {
      const registry = new HookRegistry();
      wireAdaptersLive(registry, makeOptions());

      for (let i = 0; i < 3; i++) {
        await expect(
          registry.executePhase('onAfterTask', makeTaskResult(`task-${i}`))
        ).resolves.not.toThrow();
      }
    });

    it('should execute onTaskError for failed tasks', async () => {
      const registry = new HookRegistry();
      wireAdaptersLive(registry, makeOptions());

      await expect(
        registry.executePhase('onTaskError', makeTaskResult('task-fail', false))
      ).resolves.not.toThrow();
    });
  });

  describe('Phase 6: Model routing + memory storage events', () => {
    it('should emit model:selected and memory:stored via event bus', async () => {
      const bus = new EventBus();
      const events: string[] = [];

      bus.on('model:selected', () => { events.push('model:selected'); }, 'test');
      bus.on('memory:stored', () => { events.push('memory:stored'); }, 'test');

      await bus.emit('model:selected', {
        agentName: 'EARTH', taskId: 'task-001', modelId: 'qwen2.5:7b',
        modelName: 'Qwen', routingReason: 'hardware-match',
      });
      await bus.emit('memory:stored', {
        nodeId: 'mem-001', level: 'scene', taskId: 'task-001', agentName: 'EARTH',
      });

      expect(events).toEqual(['model:selected', 'memory:stored']);
    });

    it('should propagate events to multiple subscribers', async () => {
      const bus = new EventBus();
      let obsCount = 0;
      let memCount = 0;

      bus.on('task:completed', () => { obsCount++; }, 'observability');
      bus.on('task:completed', () => { memCount++; }, 'memory');

      await bus.emit('task:completed', {
        taskId: 'task-001', agentName: 'EARTH', success: true,
        durationMs: 100, outputSize: 50,
      });

      expect(obsCount).toBe(1);
      expect(memCount).toBe(1);
    });

    it('should record event history', async () => {
      const bus = new EventBus();
      await bus.emit('build:started', {
        buildId: 'b1', prdId: 'p1', prdName: 'Test',
        totalTasks: 3, enabledModules: [],
      });
      await bus.emit('task:completed', {
        taskId: 't1', agentName: 'E', success: true, durationMs: 100, outputSize: 50,
      });

      expect(bus.getHistory()).toHaveLength(2);
    });
  });

  describe('Phase 7: Handoff between agents', () => {
    it('should build and receive handoff payload', async () => {
      const builder = new HandoffContextBuilder();
      const receiver = new HandoffReceiver();

      builder.registerCollector('model-routing', 'modelRouting', () => ({
        selectedModelId: 'qwen2.5:7b', routingReason: 'affinity',
        affinityScores: { EARTH: 0.9 },
      } satisfies ModelRoutingState));

      builder.registerCollector('memory', 'memory', () => ({
        recentNodeIds: ['m1'], contextSummary: 'Built API',
        tasteScore: 0.85,
      } satisfies MemoryState));

      const payload = builder.buildPayload({
        fromAgent: 'EARTH', toAgent: 'MARS',
        taskId: 'task-001', buildId: 'build-001',
      });

      const restored: Record<string, unknown> = {};
      receiver.registerRestorer('model-routing', 'modelRouting',
        (s) => { restored.modelRouting = s; });
      receiver.registerRestorer('memory', 'memory',
        (s) => { restored.memory = s; });

      const result = await receiver.receive(payload);

      expect(result.restoredModules).toContain('model-routing');
      expect(result.restoredModules).toContain('memory');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Phase 8: Build complete + notification dispatch', () => {
    it('should execute onBuildComplete hooks', async () => {
      const registry = new HookRegistry();
      wireAdaptersLive(registry, makeOptions());

      await expect(
        registry.executePhase('onBuildComplete', makeBuildResult(3, 0))
      ).resolves.not.toThrow();
    });

    it('should dispatch build:complete notification', async () => {
      const dispatcher = new NotificationDispatcher();
      const received: Notification[] = [];

      const handler: NotificationHandler = {
        name: 'test-handler',
        config: { minPriority: 'low' },
        handle: async (n) => { received.push(n); },
      };
      dispatcher.registerHandler(handler);

      await dispatcher.dispatch({
        type: 'build:complete',
        priority: 'medium',
        title: 'Build Complete',
        message: 'Build build-001 completed: 3/3 tasks passed',
      });

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('build:complete');
    });

    it('should dispatch task:failed notification for failures', async () => {
      const dispatcher = new NotificationDispatcher();
      const received: Notification[] = [];

      const handler: NotificationHandler = {
        name: 'alert-handler',
        config: { minPriority: 'low' },
        handle: async (n) => { received.push(n); },
      };
      dispatcher.registerHandler(handler);

      await dispatcher.dispatch({
        type: 'task:failed',
        priority: 'high',
        title: 'Task Failed',
        message: 'Task task-002 failed: Compilation error',
      });

      expect(received).toHaveLength(1);
      expect(received[0].priority).toBe('high');
    });
  });

  describe('Phase 9: Module health diagnostics', () => {
    it('should run health checks for all 7 modules', async () => {
      const checker = new ModuleHealthChecker();
      registerDefaultHealthChecks(checker, makeOptions());

      const report = await checker.checkAll();
      expect(report.totalModules).toBe(7);
      expect(report.healthy).toBe(7);
      expect(report.overallStatus).toBe('healthy');
    });

    it('should report disabled modules correctly', async () => {
      const checker = new ModuleHealthChecker();
      registerDefaultHealthChecks(checker, makeOptions({
        modelRoutingEnabled: false,
      }));

      const report = await checker.checkAll();
      expect(report.disabled).toBe(1);
      expect(report.healthy).toBe(6);
    });

    it('should format health report', async () => {
      const checker = new ModuleHealthChecker();
      registerDefaultHealthChecks(checker, makeOptions());
      const report = await checker.checkAll();
      const output = formatHealthReport(report);

      expect(output).toContain('Module Health Report');
      expect(output).toContain('[OK]');
    });
  });

  describe('Phase 10: Full pipeline — no subsystem interference', () => {
    it('should run entire pipeline without errors', async () => {
      // 1. Config resolution
      const configResult = resolveConfig({
        options: { modelRoutingEnabled: true, perplexityEnabled: true },
      }, {});
      expect(configResult.errors).toHaveLength(0);

      // 2. Feature flags
      const flagRegistry = new FeatureFlagRegistry();
      registerDefaultFlags(flagRegistry);
      const store = new FeatureFlagStore(flagRegistry);
      expect(store.listFlags().length).toBeGreaterThan(0);

      // 3. Lifecycle wiring
      const hookRegistry = new HookRegistry();
      const wireResult = wireAdaptersLive(hookRegistry, makeOptions());
      expect(wireResult.wiredCount).toBe(7);

      // 4. DI container
      const container = new DIContainer();
      const bus = new EventBus();
      container.register('eventBus', () => bus, 'singleton');
      expect(container.resolve('eventBus')).toBe(bus);

      // 5. Build start
      await hookRegistry.executePhase('onBeforeBuild', makeBuildCtx());

      // 6. Task execution (3 tasks)
      const agents = ['EARTH', 'MARS', 'VENUS'];
      for (let i = 0; i < 3; i++) {
        await hookRegistry.executePhase('onBeforeTask', makeTaskCtx(`t-${i}`, agents[i]));

        // Event bus propagation
        await bus.emit('model:selected', {
          agentName: agents[i], taskId: `t-${i}`, modelId: 'qwen2.5:7b',
          modelName: 'Qwen', routingReason: 'default',
        });

        await hookRegistry.executePhase('onAfterTask', makeTaskResult(`t-${i}`));

        await bus.emit('task:completed', {
          taskId: `t-${i}`, agentName: agents[i], success: true,
          durationMs: 200, outputSize: 100,
        });

        // Memory storage
        await bus.emit('memory:stored', {
          nodeId: `mem-${i}`, level: 'scene', taskId: `t-${i}`, agentName: agents[i],
        });
      }

      // 7. Handoff (EARTH → MARS)
      const builder = new HandoffContextBuilder();
      builder.registerCollector('memory', 'memory', () => ({
        recentNodeIds: ['mem-0'], contextSummary: 'API code', tasteScore: 0.9,
      }));
      const payload = builder.buildPayload({
        fromAgent: 'EARTH', toAgent: 'MARS', taskId: 't-0', buildId: 'build-001',
      });
      expect(payload.fromAgent).toBe('EARTH');

      // 8. Build complete
      await hookRegistry.executePhase('onBuildComplete', makeBuildResult(3, 0));

      // 9. Notification
      const dispatcher = new NotificationDispatcher();
      const notifications: Notification[] = [];
      dispatcher.registerHandler({
        name: 'collector',
        config: { minPriority: 'low' },
        handle: async (n) => { notifications.push(n); },
      });
      await dispatcher.dispatch({
        type: 'build:complete', priority: 'medium',
        title: 'Build Done', message: '3/3 passed',
      });
      expect(notifications).toHaveLength(1);

      // 10. Health check
      const checker = new ModuleHealthChecker();
      registerDefaultHealthChecks(checker, makeOptions());
      const report = await checker.checkAll();
      expect(report.overallStatus).toBe('healthy');

      // Verify event history covers the full build
      expect(bus.getHistory()).toHaveLength(9); // 3 model:selected + 3 task:completed + 3 memory:stored
    });

    it('should handle error path without cascading failures', async () => {
      const hookRegistry = new HookRegistry();
      wireAdaptersLive(hookRegistry, makeOptions());
      const bus = new EventBus();

      // Start build
      await hookRegistry.executePhase('onBeforeBuild', makeBuildCtx());

      // Task 1 succeeds
      await hookRegistry.executePhase('onBeforeTask', makeTaskCtx('t-1', 'EARTH'));
      await hookRegistry.executePhase('onAfterTask', makeTaskResult('t-1', true));

      // Task 2 fails
      await hookRegistry.executePhase('onBeforeTask', makeTaskCtx('t-2', 'MARS'));
      await hookRegistry.executePhase('onTaskError', makeTaskResult('t-2', false));
      await bus.emit('task:failed', {
        taskId: 't-2', agentName: 'MARS', error: 'Crash',
        durationMs: 100, recoveryAttempted: false,
      });

      // Task 3 still executes
      await hookRegistry.executePhase('onBeforeTask', makeTaskCtx('t-3', 'VENUS'));
      await hookRegistry.executePhase('onAfterTask', makeTaskResult('t-3', true));

      // Build completes with partial failure
      await hookRegistry.executePhase('onBuildComplete', makeBuildResult(3, 1));

      // Notifications still work
      const dispatcher = new NotificationDispatcher();
      const alerts: Notification[] = [];
      dispatcher.registerHandler({
        name: 'alert',
        config: { minPriority: 'low' },
        handle: async (n) => { alerts.push(n); },
      });
      await dispatcher.dispatch({
        type: 'task:failed', priority: 'high',
        title: 'Task Failed', message: 'task t-2 failed',
      });
      expect(alerts).toHaveLength(1);

      // Health still works
      const checker = new ModuleHealthChecker();
      registerDefaultHealthChecks(checker, makeOptions());
      const report = await checker.checkAll();
      expect(report.overallStatus).toBe('healthy');
    });
  });

  describe('Cross-subsystem isolation', () => {
    it('should not share state between DI container and event bus', () => {
      const container = new DIContainer();
      const bus = new EventBus();

      container.register('bus', () => bus, 'singleton');
      bus.on('test:event' as 'build:started', () => {}, 'module');

      container.clear();
      // Event bus subscriptions should be unaffected by DI clearing
      expect(bus.totalSubscriberCount()).toBe(1);
    });

    it('should not share state between hook registry and health checker', async () => {
      const registry = new HookRegistry();
      const checker = new ModuleHealthChecker();

      wireAdaptersLive(registry, makeOptions());
      registerDefaultHealthChecks(checker, makeOptions());

      registry.clear();
      // Health checks unaffected
      const report = await checker.checkAll();
      expect(report.totalModules).toBe(7);
    });

    it('should not share state between notification dispatcher and event bus', async () => {
      const bus = new EventBus();
      const dispatcher = new NotificationDispatcher();

      bus.on('build:started', () => {}, 'test');
      dispatcher.registerHandler({
        name: 'test', config: { minPriority: 'low' },
        handle: async () => {},
      });

      bus.clear();
      // Dispatcher still works
      const result = await dispatcher.dispatch({
        type: 'build:complete', priority: 'low',
        title: 'Test', message: 'Test',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Enabled features list', () => {
    it('should list enabled features from resolved options', () => {
      const result = resolveConfig({
        options: {
          modelRoutingEnabled: true,
          perplexityEnabled: true,
          workflowEngineEnabled: true,
        },
      }, {});

      const features = getEnabledFeatures(result.options);
      expect(features).toContain('model-routing');
      expect(features).toContain('perplexity');
      expect(features).toContain('workflow-engine');
      expect(features).not.toContain('infinite-memory');
    });

    it('should list all 14 feature keys in defaults', () => {
      const features = getEnabledFeatures(DEFAULT_RALPH_LOOP_OPTIONS);
      // All default to false so none enabled
      expect(features).toHaveLength(0);
    });
  });

  describe('Handoff lifecycle context', () => {
    it('should produce lifecycle-compatible context from builder', () => {
      const builder = new HandoffContextBuilder();
      const ctx = builder.buildLifecycleContext({
        fromAgent: 'EARTH', toAgent: 'MARS',
        taskId: 'task-001', buildId: 'build-001',
      });
      expect(ctx.fromAgent).toBe('EARTH');
      expect(ctx.toAgent).toBe('MARS');
      expect(ctx.taskId).toBe('task-001');
      expect(ctx.payload).toBeDefined();
    });
  });
});
