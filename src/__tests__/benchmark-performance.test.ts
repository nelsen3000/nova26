// SN-26: Performance Benchmark Tests
// Timing assertions to catch performance regressions

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Lifecycle hooks
import {
  HookRegistry,
  type BuildContext,
  type TaskContext,
  type TaskResult,
} from '../orchestrator/lifecycle-hooks.js';

// Event bus
import { EventBus } from '../orchestrator/event-bus.js';

// Config resolution
import { resolveConfig, readEnvOverrides } from '../config/config-resolver.js';

// DI container
import { DIContainer } from '../orchestrator/di-container.js';

// Module health
import { ModuleHealthChecker, type ModuleStatus } from '../orchestrator/module-health.js';

// Feature flags
import { FeatureFlagRegistry, registerDefaultFlags } from '../config/feature-flags.js';

// Handoff
import { HandoffContextBuilder } from '../orchestrator/handoff-context.js';
import { HandoffReceiver } from '../orchestrator/handoff-receiver.js';

// Notifications
import { NotificationDispatcher } from '../notifications/dispatcher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

async function timeMsAsync(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

function makeBuildCtx(): BuildContext {
  return {
    buildId: 'perf-build',
    prdId: 'prd-001',
    prdName: 'Perf Test',
    startedAt: new Date().toISOString(),
    options: {},
  };
}

function makeTaskCtx(id: string): TaskContext {
  return { taskId: id, title: `Task ${id}`, agentName: 'EARTH', dependencies: [] };
}

function makeTaskResult(id: string): TaskResult {
  return { taskId: id, success: true, output: 'output', durationMs: 100 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('HookRegistry.executePhase — <50ms for 10 hooks', () => {
    it('should execute onBeforeBuild with 10 hooks in <50ms', async () => {
      const registry = new HookRegistry();
      for (let i = 0; i < 10; i++) {
        registry.register({
          id: `hook-${i}`,
          moduleName: `mod-${i}`,
          phase: 'onBeforeBuild',
          handler: async () => {},
          priority: i,
        });
      }

      const ms = await timeMsAsync(async () => {
        await registry.executePhase('onBeforeBuild', makeBuildCtx());
      });
      expect(ms).toBeLessThan(50);
    });

    it('should execute onBeforeTask with 10 hooks in <50ms', async () => {
      const registry = new HookRegistry();
      for (let i = 0; i < 10; i++) {
        registry.register({
          id: `hook-${i}`,
          moduleName: `mod-${i}`,
          phase: 'onBeforeTask',
          handler: async () => {},
          priority: i,
        });
      }

      const ms = await timeMsAsync(async () => {
        await registry.executePhase('onBeforeTask', makeTaskCtx('t-1'));
      });
      expect(ms).toBeLessThan(50);
    });

    it('should execute onAfterTask with 10 hooks in <50ms', async () => {
      const registry = new HookRegistry();
      for (let i = 0; i < 10; i++) {
        registry.register({
          id: `hook-${i}`,
          moduleName: `mod-${i}`,
          phase: 'onAfterTask',
          handler: async () => {},
          priority: i,
        });
      }

      const ms = await timeMsAsync(async () => {
        await registry.executePhase('onAfterTask', makeTaskResult('t-1'));
      });
      expect(ms).toBeLessThan(50);
    });

    it('should execute all 6 phases with 10 hooks each in <100ms', async () => {
      const registry = new HookRegistry();
      const phases = ['onBeforeBuild', 'onBeforeTask', 'onAfterTask', 'onTaskError', 'onHandoff', 'onBuildComplete'] as const;

      for (const phase of phases) {
        for (let i = 0; i < 10; i++) {
          registry.register({
            id: `${phase}-${i}`,
            moduleName: `mod-${i}`,
            phase,
            handler: async () => {},
            priority: i,
          });
        }
      }

      const ms = await timeMsAsync(async () => {
        await registry.executePhase('onBeforeBuild', makeBuildCtx());
        await registry.executePhase('onBeforeTask', makeTaskCtx('t'));
        await registry.executePhase('onAfterTask', makeTaskResult('t'));
        await registry.executePhase('onTaskError', makeTaskResult('t'));
        await registry.executePhase('onHandoff', { fromAgent: 'A', toAgent: 'B', taskId: 't', payload: {} });
        await registry.executePhase('onBuildComplete', { buildId: 'b', totalTasks: 1, successfulTasks: 1, failedTasks: 0, totalDurationMs: 100 });
      });
      expect(ms).toBeLessThan(100);
    });
  });

  describe('EventBus emission — <10ms', () => {
    it('should emit single event in <10ms', async () => {
      const bus = new EventBus();
      bus.on('task:completed', () => {}, 'test');

      const ms = await timeMsAsync(async () => {
        await bus.emit('task:completed', {
          taskId: 't1', agentName: 'E', success: true, durationMs: 100, outputSize: 50,
        });
      });
      expect(ms).toBeLessThan(10);
    });

    it('should emit to 10 subscribers in <10ms', async () => {
      const bus = new EventBus();
      for (let i = 0; i < 10; i++) {
        bus.on('task:completed', () => {}, `sub-${i}`);
      }

      const ms = await timeMsAsync(async () => {
        await bus.emit('task:completed', {
          taskId: 't1', agentName: 'E', success: true, durationMs: 100, outputSize: 50,
        });
      });
      expect(ms).toBeLessThan(10);
    });

    it('should emit 100 events in <50ms', async () => {
      const bus = new EventBus();
      bus.on('span:created', () => {}, 'test');

      const ms = await timeMsAsync(async () => {
        for (let i = 0; i < 100; i++) {
          await bus.emit('span:created', {
            spanId: `span-${i}`, operationName: 'test', moduleName: 'obs',
          });
        }
      });
      expect(ms).toBeLessThan(50);
    });

    it('should handle event history recording without slowdown', async () => {
      const bus = new EventBus();

      const ms = await timeMsAsync(async () => {
        for (let i = 0; i < 50; i++) {
          await bus.emit('task:completed', {
            taskId: `t-${i}`, agentName: 'E', success: true, durationMs: 10, outputSize: 5,
          });
        }
      });
      expect(ms).toBeLessThan(30);
      expect(bus.getHistory()).toHaveLength(50);
    });
  });

  describe('Config resolution — <5ms', () => {
    it('should resolve defaults-only config in <5ms', () => {
      const ms = timeMs(() => {
        resolveConfig(null, {});
      });
      expect(ms).toBeLessThan(5);
    });

    it('should resolve config with file and env in <5ms', () => {
      const ms = timeMs(() => {
        resolveConfig(
          { options: { parallelMode: true, concurrency: 4 } },
          { NOVA26_CONCURRENCY: '8', NOVA26_MODEL_ROUTING: 'true' }
        );
      });
      expect(ms).toBeLessThan(5);
    });

    it('should parse env overrides in <2ms', () => {
      const ms = timeMs(() => {
        readEnvOverrides({
          NOVA26_PARALLEL_MODE: 'true',
          NOVA26_CONCURRENCY: '4',
          NOVA26_MODEL_ROUTING: 'true',
          NOVA26_PERPLEXITY: 'true',
        });
      });
      expect(ms).toBeLessThan(2);
    });
  });

  describe('DI container resolve — <1ms', () => {
    it('should resolve singleton in <1ms', () => {
      const container = new DIContainer();
      container.register('service', () => ({ name: 'test' }), 'singleton');
      // Warm up
      container.resolve('service');

      const ms = timeMs(() => {
        container.resolve('service');
      });
      expect(ms).toBeLessThan(1);
    });

    it('should resolve transient in <1ms', () => {
      const container = new DIContainer();
      container.register('service', () => ({ name: 'test' }), 'transient');

      const ms = timeMs(() => {
        container.resolve('service');
      });
      expect(ms).toBeLessThan(1);
    });

    it('should resolve 100 singletons in <5ms', () => {
      const container = new DIContainer();
      for (let i = 0; i < 100; i++) {
        container.register(`svc-${i}`, () => ({ id: i }), 'singleton');
      }

      const ms = timeMs(() => {
        for (let i = 0; i < 100; i++) {
          container.resolve(`svc-${i}`);
        }
      });
      expect(ms).toBeLessThan(5);
    });

    it('should check has() in <0.1ms for 100 entries', () => {
      const container = new DIContainer();
      for (let i = 0; i < 100; i++) {
        container.register(`svc-${i}`, () => i);
      }

      const ms = timeMs(() => {
        for (let i = 0; i < 100; i++) {
          container.has(`svc-${i}`);
        }
      });
      expect(ms).toBeLessThan(1);
    });
  });

  describe('Feature flag operations — <1ms', () => {
    it('should register 8 default flags in <2ms', () => {
      const ms = timeMs(() => {
        const reg = new FeatureFlagRegistry();
        registerDefaultFlags(reg);
      });
      expect(ms).toBeLessThan(2);
    });

    it('should check isEnabled in <0.1ms', () => {
      const reg = new FeatureFlagRegistry();
      registerDefaultFlags(reg);

      const ms = timeMs(() => {
        for (let i = 0; i < 100; i++) {
          reg.getBoolean('model-routing');
        }
      });
      expect(ms).toBeLessThan(1);
    });
  });

  describe('Handoff pipeline — <5ms', () => {
    it('should build payload with 5 collectors in <5ms', () => {
      const builder = new HandoffContextBuilder();
      for (let i = 0; i < 5; i++) {
        builder.registerCollector(`mod-${i}`, `key-${i}`, () => ({ data: i }));
      }

      const ms = timeMs(() => {
        builder.buildPayload({
          fromAgent: 'EARTH', toAgent: 'MARS',
          taskId: 't1', buildId: 'b1',
        });
      });
      expect(ms).toBeLessThan(5);
    });

    it('should receive payload with 5 restorers in <5ms', async () => {
      const receiver = new HandoffReceiver();
      for (let i = 0; i < 5; i++) {
        receiver.registerRestorer(`mod-${i}`, `key-${i}`, () => {});
      }

      const payload = {
        fromAgent: 'A', toAgent: 'B', taskId: 't1', buildId: 'b1',
        timestamp: Date.now(), metadata: {},
        'key-0': { data: 0 }, 'key-1': { data: 1 }, 'key-2': { data: 2 },
        'key-3': { data: 3 }, 'key-4': { data: 4 },
      };

      const ms = await timeMsAsync(async () => {
        await receiver.receive(payload as never);
      });
      expect(ms).toBeLessThan(5);
    });
  });

  describe('Notification dispatch — <5ms', () => {
    it('should dispatch to 5 handlers in <5ms', async () => {
      const dispatcher = new NotificationDispatcher();
      for (let i = 0; i < 5; i++) {
        dispatcher.registerHandler({
          name: `handler-${i}`,
          config: { minPriority: 'low' },
          handle: async () => {},
        });
      }

      const ms = await timeMsAsync(async () => {
        await dispatcher.dispatch({
          type: 'build:complete', priority: 'medium',
          title: 'Build Done', message: 'OK',
        });
      });
      expect(ms).toBeLessThan(5);
    });
  });

  describe('Module health checks — <50ms', () => {
    it('should run 7 instant health checks in <50ms', async () => {
      const checker = new ModuleHealthChecker();
      for (let i = 0; i < 7; i++) {
        checker.registerCheck(`mod-${i}`, async () => ({
          status: 'healthy' as ModuleStatus, message: 'OK',
        }));
      }

      const ms = await timeMsAsync(async () => {
        await checker.checkAll();
      });
      expect(ms).toBeLessThan(50);
    });

    it('should check single module in <10ms', async () => {
      const checker = new ModuleHealthChecker();
      checker.registerCheck('fast', async () => ({
        status: 'healthy' as ModuleStatus, message: 'OK',
      }));

      const ms = await timeMsAsync(async () => {
        await checker.checkModule('fast');
      });
      expect(ms).toBeLessThan(10);
    });
  });

  describe('Hook registration — <5ms', () => {
    it('should register 50 hooks in <5ms', () => {
      const registry = new HookRegistry();

      const ms = timeMs(() => {
        for (let i = 0; i < 50; i++) {
          registry.register({
            id: `hook-${i}`,
            moduleName: `mod-${i % 10}`,
            phase: 'onBeforeBuild',
            handler: async () => {},
            priority: i,
          });
        }
      });
      expect(ms).toBeLessThan(5);
    });

    it('should query hooks for phase in <1ms', () => {
      const registry = new HookRegistry();
      for (let i = 0; i < 20; i++) {
        registry.register({
          id: `hook-${i}`,
          moduleName: `mod-${i}`,
          phase: 'onBeforeTask',
          handler: async () => {},
          priority: i,
        });
      }

      const ms = timeMs(() => {
        for (let j = 0; j < 100; j++) {
          registry.getHooksForPhase('onBeforeTask');
        }
      });
      expect(ms).toBeLessThan(1);
    });

    it('should report subscriber counts in <1ms', () => {
      const bus = new EventBus();
      for (let i = 0; i < 20; i++) {
        bus.on('task:completed', () => {}, `sub-${i}`);
      }

      const ms = timeMs(() => {
        for (let j = 0; j < 100; j++) {
          bus.totalSubscriberCount();
          bus.subscriberCount('task:completed');
        }
      });
      expect(ms).toBeLessThan(1);
    });
  });
});
