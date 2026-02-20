// MX-12: Lazy Module Initialization Tests
// 25 tests covering lazy adapter initialization, caching, error handling,
// registry tracking, and singleton behavior.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LazyAdapter,
  LazyAdapterRegistry,
  getLazyAdapterRegistry,
  resetLazyAdapterRegistry,
  type AdapterFactory,
} from '../lazy-adapter.js';
import type { FeatureLifecycleHandlers } from '../lifecycle-wiring.js';
import type {
  BuildContext,
  TaskContext,
  TaskResult,
  HandoffContext,
  BuildResult,
} from '../lifecycle-hooks.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockBuildContext(): BuildContext {
  return {
    buildId: 'build-123',
    prdId: 'prd-456',
    prdName: 'Test PRD',
    startedAt: new Date().toISOString(),
    options: {},
  };
}

function createMockTaskContext(): TaskContext {
  return {
    taskId: 'task-789',
    title: 'Test Task',
    agentName: 'test-agent',
    dependencies: [],
  };
}

function createMockTaskResult(success = true): TaskResult {
  return {
    taskId: 'task-789',
    agentName: 'test-agent',
    success,
    durationMs: 1000,
  };
}

function createMockHandoffContext(): HandoffContext {
  return {
    fromAgent: 'agent-a',
    toAgent: 'agent-b',
    taskId: 'task-789',
    payload: {},
  };
}

function createMockBuildResult(): BuildResult {
  return {
    buildId: 'build-123',
    prdId: 'prd-456',
    totalTasks: 5,
    successfulTasks: 4,
    failedTasks: 1,
    totalDurationMs: 10000,
    averageAceScore: 85,
  };
}

function createMockHandlers(): FeatureLifecycleHandlers {
  return {
    onBeforeBuild: vi.fn<(ctx: BuildContext) => Promise<void>>().mockResolvedValue(undefined),
    onBeforeTask: vi.fn<(ctx: TaskContext) => Promise<void>>().mockResolvedValue(undefined),
    onAfterTask: vi.fn<(ctx: TaskResult) => Promise<void>>().mockResolvedValue(undefined),
    onTaskError: vi.fn<(ctx: TaskResult) => Promise<void>>().mockResolvedValue(undefined),
    onHandoff: vi.fn<(ctx: HandoffContext) => Promise<void>>().mockResolvedValue(undefined),
    onBuildComplete: vi.fn<(ctx: BuildResult) => Promise<void>>().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('LazyAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLazyAdapterRegistry();
  });

  // ---- Factory not called until first handler invocation ----

  describe('lazy initialization', () => {
    it('should not call factory on construction', () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      new LazyAdapter('test-module', factory);

      expect(factory).not.toHaveBeenCalled();
    });

    it('should not call factory when getHandlers() is called', () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test-module', factory);
      lazy.getHandlers();

      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory on first handler invocation', async () => {
      const mockHandlers = createMockHandlers();
      const factory = vi.fn<AdapterFactory>().mockReturnValue(mockHandlers);
      const lazy = new LazyAdapter('test-module', factory);
      const handlers = lazy.getHandlers();

      await handlers.onBeforeBuild!(createMockBuildContext());

      expect(factory).toHaveBeenCalledOnce();
    });
  });

  // ---- Factory called exactly once (cached) ----

  describe('caching', () => {
    it('should call factory exactly once across multiple handler calls', async () => {
      const mockHandlers = createMockHandlers();
      const factory = vi.fn<AdapterFactory>().mockReturnValue(mockHandlers);
      const lazy = new LazyAdapter('test-module', factory);
      const handlers = lazy.getHandlers();

      await handlers.onBeforeBuild!(createMockBuildContext());
      await handlers.onBeforeTask!(createMockTaskContext());
      await handlers.onAfterTask!(createMockTaskResult());

      expect(factory).toHaveBeenCalledOnce();
    });

    it('should delegate to the same cached instance on subsequent calls', async () => {
      const mockHandlers = createMockHandlers();
      const factory = vi.fn<AdapterFactory>().mockReturnValue(mockHandlers);
      const lazy = new LazyAdapter('test-module', factory);
      const handlers = lazy.getHandlers();

      const ctx = createMockBuildContext();
      await handlers.onBeforeBuild!(ctx);
      await handlers.onBeforeBuild!(ctx);

      expect(mockHandlers.onBeforeBuild).toHaveBeenCalledTimes(2);
      expect(factory).toHaveBeenCalledOnce();
    });
  });

  // ---- All handler types trigger initialization ----

  describe('all handler types trigger initialization', () => {
    it('should initialize via onBeforeBuild', async () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      await handlers.onBeforeBuild!(createMockBuildContext());
      expect(factory).toHaveBeenCalledOnce();
      expect(lazy.isInitialized()).toBe(true);
    });

    it('should initialize via onBeforeTask', async () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      await handlers.onBeforeTask!(createMockTaskContext());
      expect(factory).toHaveBeenCalledOnce();
      expect(lazy.isInitialized()).toBe(true);
    });

    it('should initialize via onAfterTask', async () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      await handlers.onAfterTask!(createMockTaskResult());
      expect(factory).toHaveBeenCalledOnce();
      expect(lazy.isInitialized()).toBe(true);
    });

    it('should initialize via onTaskError', async () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      await handlers.onTaskError!(createMockTaskResult(false));
      expect(factory).toHaveBeenCalledOnce();
      expect(lazy.isInitialized()).toBe(true);
    });

    it('should initialize via onHandoff', async () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      await handlers.onHandoff!(createMockHandoffContext());
      expect(factory).toHaveBeenCalledOnce();
      expect(lazy.isInitialized()).toBe(true);
    });

    it('should initialize via onBuildComplete', async () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      await handlers.onBuildComplete!(createMockBuildResult());
      expect(factory).toHaveBeenCalledOnce();
      expect(lazy.isInitialized()).toBe(true);
    });
  });

  // ---- Factory error handled gracefully ----

  describe('factory error handling', () => {
    it('should handle factory error gracefully without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const factory = vi.fn<AdapterFactory>().mockImplementation(() => {
        throw new Error('Module init failed');
      });
      const lazy = new LazyAdapter('broken-module', factory);
      const handlers = lazy.getHandlers();

      // Should not throw
      await expect(handlers.onBeforeBuild!(createMockBuildContext())).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('broken-module'),
        expect.stringContaining('Module init failed')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should not retry factory after failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const factory = vi.fn<AdapterFactory>().mockImplementation(() => {
        throw new Error('Init failed');
      });
      const lazy = new LazyAdapter('broken', factory);
      const handlers = lazy.getHandlers();

      await handlers.onBeforeBuild!(createMockBuildContext());
      await handlers.onBeforeTask!(createMockTaskContext());

      // Factory should only be called once (not retried after failure)
      expect(factory).toHaveBeenCalledOnce();

      consoleErrorSpy.mockRestore();
    });
  });

  // ---- isInitialized() returns false before, true after ----

  describe('isInitialized()', () => {
    it('should return false before any handler is called', () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test', factory);

      expect(lazy.isInitialized()).toBe(false);
    });

    it('should return true after a handler is called', async () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      await handlers.onBeforeBuild!(createMockBuildContext());

      expect(lazy.isInitialized()).toBe(true);
    });
  });

  // ---- reset() forces re-initialization ----

  describe('reset()', () => {
    it('should force re-initialization on next handler call', async () => {
      const factory = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      await handlers.onBeforeBuild!(createMockBuildContext());
      expect(factory).toHaveBeenCalledOnce();
      expect(lazy.isInitialized()).toBe(true);

      lazy.reset();
      expect(lazy.isInitialized()).toBe(false);

      await handlers.onBeforeBuild!(createMockBuildContext());
      expect(factory).toHaveBeenCalledTimes(2);
      expect(lazy.isInitialized()).toBe(true);
    });

    it('should allow recovery after factory failure when reset is called', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let callCount = 0;
      const factory = vi.fn<AdapterFactory>().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First call fails');
        }
        return createMockHandlers();
      });
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      // First call fails
      await handlers.onBeforeBuild!(createMockBuildContext());
      expect(lazy.isInitialized()).toBe(false);

      // Reset and retry
      lazy.reset();
      await handlers.onBeforeBuild!(createMockBuildContext());
      expect(lazy.isInitialized()).toBe(true);

      consoleErrorSpy.mockRestore();
    });
  });

  // ---- getModuleName() ----

  describe('getModuleName()', () => {
    it('should return the module name', () => {
      const lazy = new LazyAdapter('my-module', () => createMockHandlers());
      expect(lazy.getModuleName()).toBe('my-module');
    });
  });

  // ---- Handlers work correctly after initialization ----

  describe('handler delegation', () => {
    it('should pass context through to the real handler', async () => {
      const mockHandlers = createMockHandlers();
      const factory = vi.fn<AdapterFactory>().mockReturnValue(mockHandlers);
      const lazy = new LazyAdapter('test', factory);
      const handlers = lazy.getHandlers();

      const ctx = createMockBuildContext();
      await handlers.onBeforeBuild!(ctx);

      expect(mockHandlers.onBeforeBuild).toHaveBeenCalledWith(ctx);
    });
  });
});

// ============================================================================
// LazyAdapterRegistry Tests
// ============================================================================

describe('LazyAdapterRegistry', () => {
  let registry: LazyAdapterRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetLazyAdapterRegistry();
    registry = new LazyAdapterRegistry();
  });

  // ---- Registry tracks initialized vs uninitialized modules ----

  describe('tracking initialized vs uninitialized', () => {
    it('should track all registered modules as uninitialized initially', () => {
      registry.register('mod-a', () => createMockHandlers());
      registry.register('mod-b', () => createMockHandlers());

      expect(registry.getUninitializedModules()).toEqual(['mod-a', 'mod-b']);
      expect(registry.getInitializedModules()).toEqual([]);
    });

    it('should move module to initialized after handler call', async () => {
      registry.register('mod-a', () => createMockHandlers());
      registry.register('mod-b', () => createMockHandlers());

      const adapterA = registry.getAdapter('mod-a')!;
      const handlers = adapterA.getHandlers();
      await handlers.onBeforeBuild!(createMockBuildContext());

      expect(registry.getInitializedModules()).toEqual(['mod-a']);
      expect(registry.getUninitializedModules()).toEqual(['mod-b']);
    });
  });

  // ---- Multiple adapters initialize independently ----

  describe('independent initialization', () => {
    it('should initialize adapters independently', async () => {
      const factoryA = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());
      const factoryB = vi.fn<AdapterFactory>().mockReturnValue(createMockHandlers());

      registry.register('mod-a', factoryA);
      registry.register('mod-b', factoryB);

      const adapterA = registry.getAdapter('mod-a')!;
      await adapterA.getHandlers().onBeforeBuild!(createMockBuildContext());

      expect(factoryA).toHaveBeenCalledOnce();
      expect(factoryB).not.toHaveBeenCalled();
      expect(adapterA.isInitialized()).toBe(true);
      expect(registry.getAdapter('mod-b')!.isInitialized()).toBe(false);
    });
  });

  // ---- getAllModules ----

  describe('getAllModules()', () => {
    it('should return all registered module names', () => {
      registry.register('alpha', () => createMockHandlers());
      registry.register('beta', () => createMockHandlers());
      registry.register('gamma', () => createMockHandlers());

      expect(registry.getAllModules()).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('should return empty array when no modules registered', () => {
      expect(registry.getAllModules()).toEqual([]);
    });
  });

  // ---- getAdapter ----

  describe('getAdapter()', () => {
    it('should return undefined for unregistered module', () => {
      expect(registry.getAdapter('nonexistent')).toBeUndefined();
    });
  });

  // ---- resetAll ----

  describe('resetAll()', () => {
    it('should reset all adapters to uninitialized', async () => {
      registry.register('mod-a', () => createMockHandlers());
      registry.register('mod-b', () => createMockHandlers());

      // Initialize both
      const handlersA = registry.getAdapter('mod-a')!.getHandlers();
      const handlersB = registry.getAdapter('mod-b')!.getHandlers();
      await handlersA.onBeforeBuild!(createMockBuildContext());
      await handlersB.onBeforeBuild!(createMockBuildContext());

      expect(registry.getInitializedModules()).toEqual(['mod-a', 'mod-b']);

      registry.resetAll();

      expect(registry.getInitializedModules()).toEqual([]);
      expect(registry.getUninitializedModules()).toEqual(['mod-a', 'mod-b']);
    });
  });

  // ---- Registry clear ----

  describe('clear()', () => {
    it('should remove all registered adapters', () => {
      registry.register('mod-a', () => createMockHandlers());
      registry.register('mod-b', () => createMockHandlers());

      registry.clear();

      expect(registry.getAllModules()).toEqual([]);
      expect(registry.getAdapter('mod-a')).toBeUndefined();
    });
  });

  // ---- Singleton behavior ----

  describe('singleton', () => {
    it('should return the same instance from getLazyAdapterRegistry()', () => {
      const reg1 = getLazyAdapterRegistry();
      const reg2 = getLazyAdapterRegistry();

      expect(reg1).toBe(reg2);
    });

    it('should return a new instance after resetLazyAdapterRegistry()', () => {
      const reg1 = getLazyAdapterRegistry();
      resetLazyAdapterRegistry();
      const reg2 = getLazyAdapterRegistry();

      expect(reg1).not.toBe(reg2);
    });
  });
});
