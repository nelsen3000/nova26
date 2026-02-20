// KMS-10: Adapter Error Boundary Tests
// 30 tests covering error scenarios for all 7 lifecycle adapters

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  wrapAdapterWithErrorBoundary,
  wrapCinematicObservabilityAdapter,
  wrapModelRoutingAdapter,
  wrapInfiniteMemoryAdapter,
  wrapWorkflowEngineAdapter,
  wrapAIModelDatabaseAdapter,
  wrapPerplexityAdapter,
  wrapCRDTAdapter,
  wrapAllAdapters,
  getModuleErrorStats,
  getAllErrorStats,
  getModuleErrorHistory,
  getTotalErrorCount,
  clearErrorTracking,
  clearModuleErrorTracking,
  configureErrorBoundary,
  getErrorBoundaryConfig,
  hasModuleErrors,
  getModulesWithErrors,
  type WrappedAdapters,
} from '../adapter-error-boundary.js';
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
    totalDurationMs: 5000,
    averageAceScore: 0.85,
  };
}

function createMockAdapter(
  overrides: Partial<FeatureLifecycleHandlers> = {}
): FeatureLifecycleHandlers {
  return {
    onBeforeBuild: vi.fn().mockResolvedValue(undefined),
    onBeforeTask: vi.fn().mockResolvedValue(undefined),
    onAfterTask: vi.fn().mockResolvedValue(undefined),
    onTaskError: vi.fn().mockResolvedValue(undefined),
    onHandoff: vi.fn().mockResolvedValue(undefined),
    onBuildComplete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ============================================================================
// Setup
// ============================================================================

describe('Adapter Error Boundary', () => {
  beforeEach(() => {
    clearErrorTracking();
    configureErrorBoundary({ enableLogging: false });
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Core Functionality (1-8)
  // ============================================================================

  describe('wrapAdapterWithErrorBoundary() - Core', () => {
    it('1. should return an adapter with all 6 lifecycle handlers', () => {
      const adapter = createMockAdapter();
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      expect(wrapped.onBeforeBuild).toBeDefined();
      expect(wrapped.onBeforeTask).toBeDefined();
      expect(wrapped.onAfterTask).toBeDefined();
      expect(wrapped.onTaskError).toBeDefined();
      expect(wrapped.onHandoff).toBeDefined();
      expect(wrapped.onBuildComplete).toBeDefined();
    });

    it('2. should preserve undefined handlers', () => {
      const adapter: FeatureLifecycleHandlers = {
        onBeforeBuild: vi.fn().mockResolvedValue(undefined),
      };
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      expect(wrapped.onBeforeBuild).toBeDefined();
      expect(wrapped.onBeforeTask).toBeUndefined();
      expect(wrapped.onAfterTask).toBeUndefined();
    });

    it('3. should call original handler when no error occurs', async () => {
      const onBeforeBuild = vi.fn().mockResolvedValue(undefined);
      const adapter = createMockAdapter({ onBeforeBuild });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      const context = createMockBuildContext();
      await wrapped.onBeforeBuild?.(context);

      expect(onBeforeBuild).toHaveBeenCalledWith(context);
      expect(onBeforeBuild).toHaveBeenCalledTimes(1);
    });

    it('4. should not throw when handler throws (graceful degradation)', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Build failed')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await expect(
        wrapped.onBeforeBuild?.(createMockBuildContext())
      ).resolves.not.toThrow();
    });

    it('5. should resolve to undefined when handler throws', async () => {
      const adapter = createMockAdapter({
        onAfterTask: vi.fn().mockRejectedValue(new Error('Task failed')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      const result = await wrapped.onAfterTask?.(createMockTaskResult());

      expect(result).toBeUndefined();
    });

    it('6. should track error count per module', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Error 1')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onBeforeBuild?.(createMockBuildContext());

      const stats = getModuleErrorStats('test-module');
      expect(stats?.errorCount).toBe(1);
    });

    it('7. should track multiple errors per module', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Error 1')),
        onBeforeTask: vi.fn().mockRejectedValue(new Error('Error 2')),
        onAfterTask: vi.fn().mockRejectedValue(new Error('Error 3')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onBeforeBuild?.(createMockBuildContext());
      await wrapped.onBeforeTask?.(createMockTaskContext());
      await wrapped.onAfterTask?.(createMockTaskResult());

      const stats = getModuleErrorStats('test-module');
      expect(stats?.errorCount).toBe(3);
    });

    it('8. should isolate errors between different modules', async () => {
      const adapter1 = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Module 1 error')),
      });
      const adapter2 = createMockAdapter({
        onBeforeBuild: vi.fn().mockResolvedValue(undefined),
      });

      const wrapped1 = wrapAdapterWithErrorBoundary(adapter1, 'module-1');
      const wrapped2 = wrapAdapterWithErrorBoundary(adapter2, 'module-2');

      await wrapped1.onBeforeBuild?.(createMockBuildContext());
      await wrapped2.onBeforeBuild?.(createMockBuildContext());

      expect(getModuleErrorStats('module-1')?.errorCount).toBe(1);
      expect(getModuleErrorStats('module-2')).toBeUndefined();
    });
  });

  // ============================================================================
  // Phase-Specific Error Handling (9-14)
  // ============================================================================

  describe('Phase-specific error handling', () => {
    it('9. should track onBeforeBuild errors separately', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('BeforeBuild error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onBeforeBuild?.(createMockBuildContext());

      const stats = getModuleErrorStats('test-module');
      expect(stats?.errorsByPhase.get('onBeforeBuild')).toBe(1);
    });

    it('10. should track onBeforeTask errors separately', async () => {
      const adapter = createMockAdapter({
        onBeforeTask: vi.fn().mockRejectedValue(new Error('BeforeTask error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onBeforeTask?.(createMockTaskContext());

      const stats = getModuleErrorStats('test-module');
      expect(stats?.errorsByPhase.get('onBeforeTask')).toBe(1);
    });

    it('11. should track onAfterTask errors separately', async () => {
      const adapter = createMockAdapter({
        onAfterTask: vi.fn().mockRejectedValue(new Error('AfterTask error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onAfterTask?.(createMockTaskResult());

      const stats = getModuleErrorStats('test-module');
      expect(stats?.errorsByPhase.get('onAfterTask')).toBe(1);
    });

    it('12. should track onTaskError errors separately', async () => {
      const adapter = createMockAdapter({
        onTaskError: vi.fn().mockRejectedValue(new Error('TaskError error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onTaskError?.(createMockTaskResult(false));

      const stats = getModuleErrorStats('test-module');
      expect(stats?.errorsByPhase.get('onTaskError')).toBe(1);
    });

    it('13. should track onHandoff errors separately', async () => {
      const adapter = createMockAdapter({
        onHandoff: vi.fn().mockRejectedValue(new Error('Handoff error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onHandoff?.(createMockHandoffContext());

      const stats = getModuleErrorStats('test-module');
      expect(stats?.errorsByPhase.get('onHandoff')).toBe(1);
    });

    it('14. should track onBuildComplete errors separately', async () => {
      const adapter = createMockAdapter({
        onBuildComplete: vi.fn().mockRejectedValue(new Error('BuildComplete error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onBuildComplete?.(createMockBuildResult());

      const stats = getModuleErrorStats('test-module');
      expect(stats?.errorsByPhase.get('onBuildComplete')).toBe(1);
    });
  });

  // ============================================================================
  // Error Information Tracking (15-18)
  // ============================================================================

  describe('Error information tracking', () => {
    it('15. should capture error message in history', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Specific error message')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onBeforeBuild?.(createMockBuildContext());

      const history = getModuleErrorHistory('test-module');
      expect(history).toHaveLength(1);
      expect(history[0]?.error.message).toBe('Specific error message');
    });

    it('16. should capture phase name in error info', async () => {
      const adapter = createMockAdapter({
        onBeforeTask: vi.fn().mockRejectedValue(new Error('Task error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onBeforeTask?.(createMockTaskContext());

      const history = getModuleErrorHistory('test-module');
      expect(history[0]?.phase).toBe('onBeforeTask');
    });

    it('17. should capture module name in error info', async () => {
      const adapter = createMockAdapter({
        onAfterTask: vi.fn().mockRejectedValue(new Error('After error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'custom-module');

      await wrapped.onAfterTask?.(createMockTaskResult());

      const history = getModuleErrorHistory('custom-module');
      expect(history[0]?.moduleName).toBe('custom-module');
    });

    it('18. should capture timestamp for each error', async () => {
      const beforeTime = Date.now();
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Timed error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onBeforeBuild?.(createMockBuildContext());
      const afterTime = Date.now();

      const history = getModuleErrorHistory('test-module');
      expect(history[0]?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(history[0]?.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  // ============================================================================
  // Non-Error Values (19-20)
  // ============================================================================

  describe('Non-error value handling', () => {
    it('19. should handle string errors gracefully', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue('string error'),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await expect(
        wrapped.onBeforeBuild?.(createMockBuildContext())
      ).resolves.not.toThrow();

      const history = getModuleErrorHistory('test-module');
      expect(history[0]?.error.message).toBe('string error');
    });

    it('20. should handle object errors gracefully', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue({ key: 'value' }),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await expect(
        wrapped.onBeforeBuild?.(createMockBuildContext())
      ).resolves.not.toThrow();

      const history = getModuleErrorHistory('test-module');
      expect(history[0]?.error.message).toBe('[object Object]');
    });
  });

  // ============================================================================
  // Convenience Wrappers (21-27)
  // ============================================================================

  describe('Convenience wrapper functions', () => {
    it('21. wrapCinematicObservabilityAdapter should use correct module name', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Cinematic error')),
      });
      const wrapped = wrapCinematicObservabilityAdapter(adapter);

      await wrapped.onBeforeBuild?.(createMockBuildContext());

      expect(hasModuleErrors('cinematic-observability')).toBe(true);
    });

    it('22. wrapModelRoutingAdapter should use correct module name', async () => {
      const adapter = createMockAdapter({
        onBeforeTask: vi.fn().mockRejectedValue(new Error('Routing error')),
      });
      const wrapped = wrapModelRoutingAdapter(adapter);

      await wrapped.onBeforeTask?.(createMockTaskContext());

      expect(hasModuleErrors('model-routing')).toBe(true);
    });

    it('23. wrapInfiniteMemoryAdapter should use correct module name', async () => {
      const adapter = createMockAdapter({
        onAfterTask: vi.fn().mockRejectedValue(new Error('Memory error')),
      });
      const wrapped = wrapInfiniteMemoryAdapter(adapter);

      await wrapped.onAfterTask?.(createMockTaskResult());

      expect(hasModuleErrors('infinite-memory')).toBe(true);
    });

    it('24. wrapWorkflowEngineAdapter should use correct module name', async () => {
      const adapter = createMockAdapter({
        onBuildComplete: vi.fn().mockRejectedValue(new Error('Workflow error')),
      });
      const wrapped = wrapWorkflowEngineAdapter(adapter);

      await wrapped.onBuildComplete?.(createMockBuildResult());

      expect(hasModuleErrors('workflow-engine')).toBe(true);
    });

    it('25. wrapAIModelDatabaseAdapter should use correct module name', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('AI DB error')),
      });
      const wrapped = wrapAIModelDatabaseAdapter(adapter);

      await wrapped.onBeforeBuild?.(createMockBuildContext());

      expect(hasModuleErrors('ai-model-database')).toBe(true);
    });

    it('26. wrapPerplexityAdapter should use correct module name', async () => {
      const adapter = createMockAdapter({
        onBeforeTask: vi.fn().mockRejectedValue(new Error('Perplexity error')),
      });
      const wrapped = wrapPerplexityAdapter(adapter);

      await wrapped.onBeforeTask?.(createMockTaskContext());

      expect(hasModuleErrors('perplexity')).toBe(true);
    });

    it('27. wrapCRDTAdapter should use correct module name', async () => {
      const adapter = createMockAdapter({
        onHandoff: vi.fn().mockRejectedValue(new Error('CRDT error')),
      });
      const wrapped = wrapCRDTAdapter(adapter);

      await wrapped.onHandoff?.(createMockHandoffContext());

      expect(hasModuleErrors('crdt-collaboration')).toBe(true);
    });
  });

  // ============================================================================
  // Batch Wrapping (28)
  // ============================================================================

  describe('wrapAllAdapters()', () => {
    it('28. should wrap all 7 adapters with error boundaries', async () => {
      const adapters: WrappedAdapters = {
        cinematicObservability: createMockAdapter({
          onBeforeBuild: vi.fn().mockRejectedValue(new Error('Cinematic error')),
        }),
        modelRouting: createMockAdapter({
          onBeforeTask: vi.fn().mockRejectedValue(new Error('Routing error')),
        }),
        infiniteMemory: createMockAdapter({
          onAfterTask: vi.fn().mockRejectedValue(new Error('Memory error')),
        }),
        workflowEngine: createMockAdapter({
          onBuildComplete: vi.fn().mockRejectedValue(new Error('Workflow error')),
        }),
        aiModelDatabase: createMockAdapter({
          onBeforeBuild: vi.fn().mockRejectedValue(new Error('AI DB error')),
        }),
        perplexity: createMockAdapter({
          onBeforeTask: vi.fn().mockRejectedValue(new Error('Perplexity error')),
        }),
        crdtCollaboration: createMockAdapter({
          onHandoff: vi.fn().mockRejectedValue(new Error('CRDT error')),
        }),
      };

      const wrapped = wrapAllAdapters(adapters);

      // Trigger errors in all adapters
      await wrapped.cinematicObservability.onBeforeBuild?.(createMockBuildContext());
      await wrapped.modelRouting.onBeforeTask?.(createMockTaskContext());
      await wrapped.infiniteMemory.onAfterTask?.(createMockTaskResult());
      await wrapped.workflowEngine.onBuildComplete?.(createMockBuildResult());
      await wrapped.aiModelDatabase.onBeforeBuild?.(createMockBuildContext());
      await wrapped.perplexity.onBeforeTask?.(createMockTaskContext());
      await wrapped.crdtCollaboration.onHandoff?.(createMockHandoffContext());

      // Verify all modules have errors tracked
      const modulesWithErrors = getModulesWithErrors();
      expect(modulesWithErrors).toContain('cinematic-observability');
      expect(modulesWithErrors).toContain('model-routing');
      expect(modulesWithErrors).toContain('infinite-memory');
      expect(modulesWithErrors).toContain('workflow-engine');
      expect(modulesWithErrors).toContain('ai-model-database');
      expect(modulesWithErrors).toContain('perplexity');
      expect(modulesWithErrors).toContain('crdt-collaboration');
      expect(getTotalErrorCount()).toBe(7);
    });
  });

  // ============================================================================
  // Configuration and Utilities (29-30)
  // ============================================================================

  describe('Configuration and utilities', () => {
    it('29. should respect enableLogging configuration', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Test with logging enabled
      configureErrorBoundary({ enableLogging: true });
      const adapter1 = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Logged error')),
      });
      const wrapped1 = wrapAdapterWithErrorBoundary(adapter1, 'logged-module');
      await wrapped1.onBeforeBuild?.(createMockBuildContext());

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockClear();

      // Reset and test with logging disabled
      clearErrorTracking();
      configureErrorBoundary({ enableLogging: false });
      const adapter2 = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Silent error')),
      });
      const wrapped2 = wrapAdapterWithErrorBoundary(adapter2, 'silent-module');
      await wrapped2.onBeforeBuild?.(createMockBuildContext());

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('30. should clear tracking data correctly', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Error 1')),
        onBeforeTask: vi.fn().mockRejectedValue(new Error('Error 2')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'test-module');

      await wrapped.onBeforeBuild?.(createMockBuildContext());
      await wrapped.onBeforeTask?.(createMockTaskContext());

      expect(getTotalErrorCount()).toBe(2);

      // Clear specific module
      clearModuleErrorTracking('test-module');
      expect(getTotalErrorCount()).toBe(0);
      expect(hasModuleErrors('test-module')).toBe(false);

      // Add more errors
      const adapter2 = createMockAdapter({
        onAfterTask: vi.fn().mockRejectedValue(new Error('Error 3')),
      });
      const wrapped2 = wrapAdapterWithErrorBoundary(adapter2, 'test-module-2');
      await wrapped2.onAfterTask?.(createMockTaskResult());

      expect(getTotalErrorCount()).toBe(1);

      // Clear all
      clearErrorTracking();
      expect(getTotalErrorCount()).toBe(0);
      expect(getAllErrorStats().size).toBe(0);
    });
  });

  // ============================================================================
  // Additional Edge Cases
  // ============================================================================

  describe('Edge cases', () => {
    it('should handle custom error callback', async () => {
      const customHandler = vi.fn();
      configureErrorBoundary({
        enableLogging: false,
        onError: customHandler,
      });

      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Custom handled')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'callback-test');

      await wrapped.onBeforeBuild?.(createMockBuildContext());

      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleName: 'callback-test',
          phase: 'onBeforeBuild',
          error: expect.objectContaining({ message: 'Custom handled' }),
        })
      );
    });

    it('should handle errors in custom callback gracefully', async () => {
      configureErrorBoundary({
        enableLogging: false,
        onError: () => {
          throw new Error('Callback error');
        },
      });

      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('Original error')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'callback-error-test');

      // Should not throw even when callback throws
      await expect(
        wrapped.onBeforeBuild?.(createMockBuildContext())
      ).resolves.not.toThrow();

      // Error should still be tracked
      expect(hasModuleErrors('callback-error-test')).toBe(true);
    });

    it('should limit error history per module', async () => {
      configureErrorBoundary({ maxErrorsPerModule: 3 });

      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockImplementation(() => {
          throw new Error('Repeated error');
        }),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'limited-module');

      // Trigger more errors than the limit
      for (let i = 0; i < 5; i++) {
        await wrapped.onBeforeBuild?.(createMockBuildContext());
      }

      const history = getModuleErrorHistory('limited-module');
      expect(history.length).toBe(3);
      expect(getModuleErrorStats('limited-module')?.errorCount).toBe(5);
    });

    it('should preserve getErrorBoundaryConfig values', () => {
      configureErrorBoundary({ enableLogging: true, maxErrorsPerModule: 50 });
      const config = getErrorBoundaryConfig();

      expect(config.enableLogging).toBe(true);
      expect(config.maxErrorsPerModule).toBe(50);
    });

    it('should return undefined stats for unknown modules', () => {
      const stats = getModuleErrorStats('non-existent-module');
      expect(stats).toBeUndefined();
    });

    it('should return empty history for unknown modules', () => {
      const history = getModuleErrorHistory('non-existent-module');
      expect(history).toEqual([]);
    });

    it('should return empty array for getModulesWithErrors when no errors', () => {
      expect(getModulesWithErrors()).toEqual([]);
    });

    it('should correctly identify last error in stats', async () => {
      const adapter = createMockAdapter({
        onBeforeBuild: vi.fn().mockRejectedValue(new Error('First')),
        onBeforeTask: vi.fn().mockRejectedValue(new Error('Second')),
      });
      const wrapped = wrapAdapterWithErrorBoundary(adapter, 'last-error-test');

      await wrapped.onBeforeBuild?.(createMockBuildContext());
      await wrapped.onBeforeTask?.(createMockTaskContext());

      const stats = getModuleErrorStats('last-error-test');
      expect(stats?.lastError?.error.message).toBe('Second');
      expect(stats?.lastError?.phase).toBe('onBeforeTask');
    });
  });
});
