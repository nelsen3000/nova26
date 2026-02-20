// SN-23: Plugin System Integration Test
// Tests full plugin lifecycle: discovery, loading, validation, hook registration,
// execution, error isolation, and priority ordering.
//
// KMS-29 plugin system not yet delivered — this test defines the expected
// interface and validates the lifecycle contract using a mock implementation.
// When the real plugin system lands, this test will verify compliance.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HookRegistry,
  type BuildContext,
  type TaskContext,
  type TaskResult,
  type BuildResult,
  type HookPhase,
} from '../../orchestrator/lifecycle-hooks.js';

// ---------------------------------------------------------------------------
// Plugin interface (expected shape from KMS-29)
// ---------------------------------------------------------------------------

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  phases: HookPhase[];
  priority: number;
}

interface PluginHandlers {
  onBeforeBuild?: (ctx: BuildContext) => Promise<void> | void;
  onBeforeTask?: (ctx: TaskContext) => Promise<void> | void;
  onAfterTask?: (result: TaskResult) => Promise<void> | void;
  onTaskError?: (result: TaskResult) => Promise<void> | void;
  onBuildComplete?: (result: BuildResult) => Promise<void> | void;
}

interface Plugin {
  manifest: PluginManifest;
  handlers: PluginHandlers;
}

interface PluginLoadResult {
  loaded: string[];
  failed: Array<{ name: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Mock plugin loader (simulates KMS-29)
// ---------------------------------------------------------------------------

function validatePlugin(plugin: Plugin): string[] {
  const errors: string[] = [];
  if (!plugin.manifest.name) errors.push('Plugin name is required');
  if (!plugin.manifest.version) errors.push('Plugin version is required');
  if (!plugin.manifest.phases?.length) errors.push('At least one phase required');
  if (plugin.manifest.priority < 0 || plugin.manifest.priority > 1000) {
    errors.push('Priority must be between 0 and 1000');
  }
  return errors;
}

function loadPlugins(plugins: Plugin[], registry: HookRegistry): PluginLoadResult {
  const loaded: string[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  for (const plugin of plugins) {
    const errors = validatePlugin(plugin);
    if (errors.length > 0) {
      failed.push({ name: plugin.manifest.name || 'unknown', error: errors.join(', ') });
      continue;
    }

    try {
      for (const phase of plugin.manifest.phases) {
        const handler = plugin.handlers[phase];
        if (!handler) continue;

        registry.register({
          id: `plugin:${plugin.manifest.name}:${phase}`,
          moduleName: `plugin:${plugin.manifest.name}`,
          phase,
          handler: async (ctx: unknown) => {
            try {
              await handler(ctx as never);
            } catch (error) {
              // Error isolation — bad plugin doesn't crash pipeline
              console.error(
                `[Plugin] ${plugin.manifest.name} error in ${phase}:`,
                error instanceof Error ? error.message : String(error)
              );
            }
          },
          // Plugin priority starts after core (100+)
          priority: 100 + plugin.manifest.priority,
        });
      }
      loaded.push(plugin.manifest.name);
    } catch (error) {
      failed.push({
        name: plugin.manifest.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { loaded, failed };
}

// ---------------------------------------------------------------------------
// Test plugins
// ---------------------------------------------------------------------------

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: {
      name: overrides.manifest?.name ?? 'test-plugin',
      version: overrides.manifest?.version ?? '1.0.0',
      description: overrides.manifest?.description ?? 'A test plugin',
      phases: overrides.manifest?.phases ?? ['onBeforeBuild'],
      priority: overrides.manifest?.priority ?? 0,
    },
    handlers: overrides.handlers ?? {
      onBeforeBuild: async () => {},
    },
  };
}

function makeBuildCtx(): BuildContext {
  return {
    buildId: 'build-001', prdId: 'prd-001', prdName: 'Plugin Test',
    startedAt: new Date().toISOString(), options: {},
  };
}

function makeTaskCtx(): TaskContext {
  return { taskId: 'task-001', title: 'Task 1', agentName: 'EARTH', dependencies: [] };
}

function makeTaskResult(success = true): TaskResult {
  return { taskId: 'task-001', success, output: 'out', durationMs: 100 };
}

function makeBuildResult(): BuildResult {
  return { buildId: 'build-001', totalTasks: 3, successfulTasks: 3, failedTasks: 0, totalDurationMs: 5000 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Plugin Lifecycle', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registry = new HookRegistry();
  });

  describe('Plugin discovery and loading', () => {
    it('should load a valid plugin', () => {
      const plugin = makePlugin({ manifest: { name: 'my-plugin', version: '1.0.0', description: 'Test', phases: ['onBeforeBuild'], priority: 0 } });
      const result = loadPlugins([plugin], registry);

      expect(result.loaded).toContain('my-plugin');
      expect(result.failed).toHaveLength(0);
    });

    it('should load multiple plugins', () => {
      const plugins = [
        makePlugin({ manifest: { name: 'plugin-a', version: '1.0.0', description: 'A', phases: ['onBeforeBuild'], priority: 0 } }),
        makePlugin({ manifest: { name: 'plugin-b', version: '2.0.0', description: 'B', phases: ['onAfterTask'], priority: 1 } }),
        makePlugin({ manifest: { name: 'plugin-c', version: '1.0.0', description: 'C', phases: ['onBuildComplete'], priority: 2 } }),
      ];
      const result = loadPlugins(plugins, registry);

      expect(result.loaded).toHaveLength(3);
    });

    it('should report failed plugins without crashing', () => {
      const plugins = [
        makePlugin({ manifest: { name: '', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 0 } }),
        makePlugin({ manifest: { name: 'valid', version: '1.0.0', description: 'Valid', phases: ['onBeforeBuild'], priority: 0 } }),
      ];
      const result = loadPlugins(plugins, registry);

      expect(result.loaded).toContain('valid');
      expect(result.failed.length).toBeGreaterThan(0);
    });
  });

  describe('Plugin validation', () => {
    it('should reject plugin without name', () => {
      const errors = validatePlugin(makePlugin({
        manifest: { name: '', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 0 },
      }));
      expect(errors).toContain('Plugin name is required');
    });

    it('should reject plugin without version', () => {
      const errors = validatePlugin(makePlugin({
        manifest: { name: 'test', version: '', description: '', phases: ['onBeforeBuild'], priority: 0 },
      }));
      expect(errors).toContain('Plugin version is required');
    });

    it('should reject plugin without phases', () => {
      const errors = validatePlugin(makePlugin({
        manifest: { name: 'test', version: '1.0.0', description: '', phases: [], priority: 0 },
      }));
      expect(errors).toContain('At least one phase required');
    });

    it('should reject plugin with out-of-range priority', () => {
      const errors = validatePlugin(makePlugin({
        manifest: { name: 'test', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: -1 },
      }));
      expect(errors).toContain('Priority must be between 0 and 1000');
    });

    it('should accept valid plugin', () => {
      const errors = validatePlugin(makePlugin());
      expect(errors).toHaveLength(0);
    });
  });

  describe('Hook registration', () => {
    it('should register plugin hooks into HookRegistry', () => {
      loadPlugins([
        makePlugin({ manifest: { name: 'reg-test', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 0 } }),
      ], registry);

      const hooks = registry.getHooksForPhase('onBeforeBuild');
      expect(hooks.some(h => h.moduleName === 'plugin:reg-test')).toBe(true);
    });

    it('should register multi-phase plugin hooks', () => {
      loadPlugins([
        makePlugin({
          manifest: { name: 'multi', version: '1.0.0', description: '', phases: ['onBeforeBuild', 'onAfterTask', 'onBuildComplete'], priority: 0 },
          handlers: {
            onBeforeBuild: async () => {},
            onAfterTask: async () => {},
            onBuildComplete: async () => {},
          },
        }),
      ], registry);

      expect(registry.getHooksForPhase('onBeforeBuild').some(h => h.moduleName === 'plugin:multi')).toBe(true);
      expect(registry.getHooksForPhase('onAfterTask').some(h => h.moduleName === 'plugin:multi')).toBe(true);
      expect(registry.getHooksForPhase('onBuildComplete').some(h => h.moduleName === 'plugin:multi')).toBe(true);
    });
  });

  describe('Execution within build pipeline', () => {
    it('should execute plugin hooks during build lifecycle', async () => {
      const events: string[] = [];

      loadPlugins([
        makePlugin({
          manifest: { name: 'tracker', version: '1.0.0', description: '', phases: ['onBeforeBuild', 'onBeforeTask', 'onAfterTask', 'onBuildComplete'], priority: 0 },
          handlers: {
            onBeforeBuild: async () => { events.push('build-start'); },
            onBeforeTask: async () => { events.push('task-start'); },
            onAfterTask: async () => { events.push('task-end'); },
            onBuildComplete: async () => { events.push('build-end'); },
          },
        }),
      ], registry);

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      await registry.executePhase('onBeforeTask', makeTaskCtx());
      await registry.executePhase('onAfterTask', makeTaskResult());
      await registry.executePhase('onBuildComplete', makeBuildResult());

      expect(events).toEqual(['build-start', 'task-start', 'task-end', 'build-end']);
    });

    it('should pass correct context to plugin handlers', async () => {
      let capturedBuildId = '';
      let capturedTaskId = '';

      loadPlugins([
        makePlugin({
          manifest: { name: 'ctx-test', version: '1.0.0', description: '', phases: ['onBeforeBuild', 'onBeforeTask'], priority: 0 },
          handlers: {
            onBeforeBuild: async (ctx: BuildContext) => { capturedBuildId = ctx.buildId; },
            onBeforeTask: async (ctx: TaskContext) => { capturedTaskId = ctx.taskId; },
          },
        }),
      ], registry);

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      await registry.executePhase('onBeforeTask', makeTaskCtx());

      expect(capturedBuildId).toBe('build-001');
      expect(capturedTaskId).toBe('task-001');
    });
  });

  describe('Error isolation — bad plugin does not crash build', () => {
    it('should continue pipeline when plugin throws', async () => {
      let healthyRan = false;

      loadPlugins([
        makePlugin({
          manifest: { name: 'broken', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 0 },
          handlers: {
            onBeforeBuild: async () => { throw new Error('Plugin crash'); },
          },
        }),
      ], registry);

      // Register a non-plugin hook that should still run
      registry.register({
        id: 'core-hook',
        moduleName: 'core',
        phase: 'onBeforeBuild',
        handler: async () => { healthyRan = true; },
        priority: 200,
      });

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      expect(healthyRan).toBe(true);
    });

    it('should isolate errors to the failing plugin', async () => {
      const results: string[] = [];

      loadPlugins([
        makePlugin({
          manifest: { name: 'broken', version: '1.0.0', description: '', phases: ['onAfterTask'], priority: 0 },
          handlers: {
            onAfterTask: async () => { throw new Error('Plugin error'); },
          },
        }),
        makePlugin({
          manifest: { name: 'healthy', version: '1.0.0', description: '', phases: ['onAfterTask'], priority: 1 },
          handlers: {
            onAfterTask: async () => { results.push('healthy-ran'); },
          },
        }),
      ], registry);

      await registry.executePhase('onAfterTask', makeTaskResult());
      expect(results).toContain('healthy-ran');
    });
  });

  describe('Priority ordering — plugins run after core hooks', () => {
    it('should run core hooks (priority < 100) before plugins (priority >= 100)', async () => {
      const order: string[] = [];

      // Core hook at priority 1
      registry.register({
        id: 'core',
        moduleName: 'core',
        phase: 'onBeforeBuild',
        handler: async () => { order.push('core'); },
        priority: 1,
      });

      // Plugin at priority 100+
      loadPlugins([
        makePlugin({
          manifest: { name: 'plugin', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 0 },
          handlers: {
            onBeforeBuild: async () => { order.push('plugin'); },
          },
        }),
      ], registry);

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      expect(order.indexOf('core')).toBeLessThan(order.indexOf('plugin'));
    });

    it('should order plugins by their manifest priority', async () => {
      const order: string[] = [];

      loadPlugins([
        makePlugin({
          manifest: { name: 'second', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 10 },
          handlers: { onBeforeBuild: async () => { order.push('second'); } },
        }),
        makePlugin({
          manifest: { name: 'first', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 1 },
          handlers: { onBeforeBuild: async () => { order.push('first'); } },
        }),
        makePlugin({
          manifest: { name: 'third', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 20 },
          handlers: { onBeforeBuild: async () => { order.push('third'); } },
        }),
      ], registry);

      await registry.executePhase('onBeforeBuild', makeBuildCtx());
      expect(order).toEqual(['first', 'second', 'third']);
    });
  });

  describe('Plugin metadata', () => {
    it('should track registered plugin modules', () => {
      loadPlugins([
        makePlugin({ manifest: { name: 'alpha', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 0 } }),
        makePlugin({
          manifest: { name: 'beta', version: '1.0.0', description: '', phases: ['onAfterTask'], priority: 0 },
          handlers: { onAfterTask: async () => {} },
        }),
      ], registry);

      const modules = registry.getRegisteredModules();
      expect(modules).toContain('plugin:alpha');
      expect(modules).toContain('plugin:beta');
    });

    it('should allow unloading a plugin by removing its hooks', () => {
      loadPlugins([
        makePlugin({ manifest: { name: 'removable', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 0 } }),
      ], registry);

      expect(registry.getRegisteredModules()).toContain('plugin:removable');

      // HookRegistry.register() generates a UUID — find the actual hook ID
      const hook = registry.getHooksForPhase('onBeforeBuild')
        .find(h => h.moduleName === 'plugin:removable');
      expect(hook).toBeDefined();

      registry.unregister(hook!.id);
      expect(registry.getHooksForPhase('onBeforeBuild')
        .some(h => h.moduleName === 'plugin:removable')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should skip phases with no matching handler', () => {
      // Plugin declares onBeforeBuild + onAfterTask but only provides onBeforeBuild handler
      const result = loadPlugins([
        makePlugin({
          manifest: { name: 'partial', version: '1.0.0', description: '', phases: ['onBeforeBuild', 'onAfterTask'], priority: 0 },
          handlers: { onBeforeBuild: async () => {} },
        }),
      ], registry);

      expect(result.loaded).toContain('partial');
      // Only onBeforeBuild should have a hook, onAfterTask was skipped
      expect(registry.getHooksForPhase('onBeforeBuild').some(h => h.moduleName === 'plugin:partial')).toBe(true);
      expect(registry.getHooksForPhase('onAfterTask').some(h => h.moduleName === 'plugin:partial')).toBe(false);
    });

    it('should handle plugin with maximum priority', () => {
      const errors = validatePlugin(makePlugin({
        manifest: { name: 'max-pri', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 1000 },
      }));
      expect(errors).toHaveLength(0);
    });

    it('should reject plugin with priority above 1000', () => {
      const errors = validatePlugin(makePlugin({
        manifest: { name: 'over-pri', version: '1.0.0', description: '', phases: ['onBeforeBuild'], priority: 1001 },
      }));
      expect(errors).toContain('Priority must be between 0 and 1000');
    });

    it('should handle async handler errors gracefully', async () => {
      loadPlugins([
        makePlugin({
          manifest: { name: 'async-err', version: '1.0.0', description: '', phases: ['onBeforeTask'], priority: 0 },
          handlers: {
            onBeforeTask: async () => { throw new Error('Async failure'); },
          },
        }),
      ], registry);

      // Should not throw — error is caught inside the wrapper
      await expect(registry.executePhase('onBeforeTask', makeTaskCtx())).resolves.not.toThrow();
    });

    it('should handle synchronous handler errors gracefully', async () => {
      loadPlugins([
        makePlugin({
          manifest: { name: 'sync-err', version: '1.0.0', description: '', phases: ['onAfterTask'], priority: 0 },
          handlers: {
            onAfterTask: () => { throw new Error('Sync failure'); },
          },
        }),
      ], registry);

      await expect(registry.executePhase('onAfterTask', makeTaskResult())).resolves.not.toThrow();
    });

    it('should accumulate multiple validation errors', () => {
      const errors = validatePlugin(makePlugin({
        manifest: { name: '', version: '', description: '', phases: [], priority: -5 },
      }));
      expect(errors.length).toBeGreaterThanOrEqual(3);
      expect(errors).toContain('Plugin name is required');
      expect(errors).toContain('Plugin version is required');
      expect(errors).toContain('At least one phase required');
      expect(errors).toContain('Priority must be between 0 and 1000');
    });

    it('should handle onTaskError phase in plugins', async () => {
      let errorReceived = false;

      loadPlugins([
        makePlugin({
          manifest: { name: 'err-handler', version: '1.0.0', description: '', phases: ['onTaskError'], priority: 0 },
          handlers: {
            onTaskError: async () => { errorReceived = true; },
          },
        }),
      ], registry);

      await registry.executePhase('onTaskError', makeTaskResult(false));
      expect(errorReceived).toBe(true);
    });
  });
});
