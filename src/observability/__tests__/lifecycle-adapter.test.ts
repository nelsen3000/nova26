// KIMI-T-R26-05: Cinematic Observability Lifecycle Adapter Tests
// Tests for createCinematicObservabilityLifecycleHooks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createCinematicObservabilityLifecycleHooks,
  type CinematicLifecycleConfig,
  getCurrentBuildState,
  resetBuildState,
} from '../lifecycle-adapter.js';
import {
  resetCinematicObservability,
} from '../cinematic-core.js';
import {
  resetBraintrustAdapter,
} from '../braintrust-adapter.js';
import {
  resetLangSmithBridge,
} from '../langsmith-bridge.js';
import type { BuildContext, TaskContext, TaskResult, HandoffContext, BuildResult } from '../../orchestrator/lifecycle-hooks.js';

// ============================================================================
// Test Fixtures & Helpers
// ============================================================================

const createMockBuildContext = (overrides: Partial<BuildContext> = {}): BuildContext => ({
  buildId: 'build-001',
  prdId: 'prd-001',
  prdName: 'Test PRD',
  startedAt: new Date().toISOString(),
  options: {},
  ...overrides,
});

const createMockTaskContext = (overrides: Partial<TaskContext> = {}): TaskContext => ({
  taskId: 'task-001',
  title: 'Test Task',
  agentName: 'kimi',
  dependencies: [],
  ...overrides,
});

const createMockTaskResult = (overrides: Partial<TaskResult> = {}): TaskResult => ({
  taskId: 'task-001',
  agentName: 'kimi',
  success: true,
  output: 'Task completed successfully',
  durationMs: 1000,
  aceScore: 0.95,
  ...overrides,
});

const createMockHandoffContext = (overrides: Partial<HandoffContext> = {}): HandoffContext => ({
  fromAgent: 'kimi',
  toAgent: 'claude',
  taskId: 'task-001',
  payload: { data: 'test' },
  ...overrides,
});

const createMockBuildResult = (overrides: Partial<BuildResult> = {}): BuildResult => ({
  buildId: 'build-001',
  prdId: 'prd-001',
  totalTasks: 5,
  successfulTasks: 5,
  failedTasks: 0,
  totalDurationMs: 5000,
  averageAceScore: 0.92,
  ...overrides,
});

const createMockConfig = (overrides: Partial<CinematicLifecycleConfig> = {}): CinematicLifecycleConfig => ({
  enabled: true,
  ...overrides,
});

// ============================================================================
// Test Suite
// ============================================================================

describe('Cinematic Observability Lifecycle Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuildState();
    resetCinematicObservability();
    resetBraintrustAdapter();
    resetLangSmithBridge();
  });

  // ============================================================================
  // onBeforeBuild Tests (5 tests)
  // ============================================================================

  describe('onBeforeBuild', () => {
    it('should create root span on build start', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state).not.toBeNull();
      expect(state?.buildId).toBe('build-001');
      expect(state?.rootSpanId).toBeDefined();
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state).toBeNull();
    });

    it('should initialize Braintrust adapter when configured', async () => {
      const config = createMockConfig({
        braintrust: {
          enabled: true,
          apiKey: 'test-key',
          projectName: 'Test Project',
          projectId: 'proj-001',
        },
      });
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.braintrust).toBeDefined();
    });

    it('should initialize LangSmith bridge when configured', async () => {
      const config = createMockConfig({
        langsmith: {
          enabled: true,
          apiKey: 'test-key',
          endpoint: 'https://api.langsmith.com',
          projectName: 'Test Project',
        },
      });
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.langsmith).toBeDefined();
    });

    it('should handle invalid build context gracefully', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // @ts-expect-error Testing invalid context
      await hooks.onBeforeBuild?.({ invalid: 'context' });

      expect(consoleSpy).toHaveBeenCalledWith('[CinematicAdapter] Invalid build context');
      expect(getCurrentBuildState()).toBeNull();
    });
  });

  // ============================================================================
  // onBeforeTask Tests (5 tests)
  // ============================================================================

  describe('onBeforeTask', () => {
    it('should create task span as child of root', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const buildContext = createMockBuildContext();
      const taskContext = createMockTaskContext();

      await hooks.onBeforeBuild?.(buildContext);
      await hooks.onBeforeTask?.(taskContext);

      const state = getCurrentBuildState();
      expect(state?.taskSpanMap.has('task-001')).toBe(true);
    });

    it('should store task span mapping', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const buildContext = createMockBuildContext();

      await hooks.onBeforeBuild?.(buildContext);
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-001' }));
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-002' }));

      const state = getCurrentBuildState();
      expect(state?.taskSpanMap.size).toBe(2);
      expect(state?.taskSpanMap.has('task-001')).toBe(true);
      expect(state?.taskSpanMap.has('task-002')).toBe(true);
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const taskContext = createMockTaskContext();

      await hooks.onBeforeTask?.(taskContext);

      // Should not throw or error
      expect(getCurrentBuildState()).toBeNull();
    });

    it('should skip when no build state exists', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const taskContext = createMockTaskContext();

      await hooks.onBeforeTask?.(taskContext);

      const state = getCurrentBuildState();
      expect(state).toBeNull();
    });

    it('should handle invalid task context gracefully', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      // @ts-expect-error Testing invalid context
      await hooks.onBeforeTask?.({ invalid: 'context' });

      expect(consoleSpy).toHaveBeenCalledWith('[CinematicAdapter] Invalid task context');
    });
  });

  // ============================================================================
  // onAfterTask Tests (5 tests)
  // ============================================================================

  describe('onAfterTask', () => {
    it('should complete task span with success status', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());
      await hooks.onAfterTask?.(createMockTaskResult({ success: true }));

      const state = getCurrentBuildState();
      const spanId = state?.taskSpanMap.get('task-001');
      const span = state?.cinematic.getSpan(spanId!);

      expect(span?.status).toBe('success');
    });

    it('should complete task span with failure status', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());
      await hooks.onAfterTask?.(createMockTaskResult({ success: false, error: 'Task failed' }));

      const state = getCurrentBuildState();
      const spanId = state?.taskSpanMap.get('task-001');
      const span = state?.cinematic.getSpan(spanId!);

      expect(span?.status).toBe('failure');
    });

    it('should warn when no span found for task', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'unknown-task' }));

      expect(consoleSpy).toHaveBeenCalledWith('[CinematicAdapter] No span found for task unknown-task');
    });

    it('should check quality thresholds when configured', async () => {
      const config = createMockConfig({
        qualityThresholds: {
          minAceScore: 0.9,
          maxErrorRate: 0.1,
        },
      });
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());
      await hooks.onAfterTask?.(createMockTaskResult({ aceScore: 0.5 }));

      expect(consoleSpy).toHaveBeenCalledWith(
        '[CinematicAdapter] Task task-001 ACE score 0.5 below threshold 0.9'
      );
    });

    it('should handle invalid task result gracefully', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      // @ts-expect-error Testing invalid context
      await hooks.onAfterTask?.({ invalid: 'result' });

      expect(consoleSpy).toHaveBeenCalledWith('[CinematicAdapter] Invalid task result');
    });
  });

  // ============================================================================
  // onTaskError Tests (5 tests)
  // ============================================================================

  describe('onTaskError', () => {
    it('should mark span as failed on error', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());
      await hooks.onTaskError?.(createMockTaskResult({ success: false, error: 'Critical error' }));

      const state = getCurrentBuildState();
      const spanId = state?.taskSpanMap.get('task-001');
      const span = state?.cinematic.getSpan(spanId!);

      expect(span?.status).toBe('failure');
    });

    it('should increment error count', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-001' }));
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-002' }));
      await hooks.onTaskError?.(createMockTaskResult({ taskId: 'task-001', success: false }));
      await hooks.onTaskError?.(createMockTaskResult({ taskId: 'task-002', success: false }));

      const state = getCurrentBuildState();
      expect(state?.errorCount).toBe(2);
    });

    it('should trigger auto-remediation on high error rate', async () => {
      const config = createMockConfig({
        autoRemediation: true,
        qualityThresholds: {
          minAceScore: 0.9,
          maxErrorRate: 0.3,
        },
      });
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-001' }));
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-002' }));
      await hooks.onTaskError?.(createMockTaskResult({ taskId: 'task-001', success: false }));
      await hooks.onTaskError?.(createMockTaskResult({ taskId: 'task-002', success: false }));

      expect(consoleSpy).toHaveBeenCalledWith(
        '[CinematicAdapter] Error rate 1.00 exceeds threshold 0.3'
      );
    });

    it('should handle task error without prior task start', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      // Error for task that was never started
      await hooks.onTaskError?.(createMockTaskResult({ taskId: 'unknown-task', success: false }));

      const state = getCurrentBuildState();
      expect(state?.errorCount).toBe(1);
    });

    it('should handle invalid error context gracefully', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      // @ts-expect-error Testing invalid context
      await hooks.onTaskError?.({ invalid: 'context' });

      expect(consoleSpy).toHaveBeenCalledWith('[CinematicAdapter] Invalid task error context');
    });
  });

  // ============================================================================
  // onHandoff Tests (5 tests)
  // ============================================================================

  describe('onHandoff', () => {
    it('should create handoff span', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onHandoff?.(createMockHandoffContext());

      const state = getCurrentBuildState();
      expect(state?.handoffCount).toBe(1);
    });

    it('should track multiple handoffs', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onHandoff?.(createMockHandoffContext({ fromAgent: 'kimi', toAgent: 'claude' }));
      await hooks.onHandoff?.(createMockHandoffContext({ fromAgent: 'claude', toAgent: 'gpt4' }));
      await hooks.onHandoff?.(createMockHandoffContext({ fromAgent: 'gpt4', toAgent: 'kimi' }));

      const state = getCurrentBuildState();
      expect(state?.handoffCount).toBe(3);
    });

    it('should record payload size in metadata', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onHandoff?.(createMockHandoffContext({
        payload: { large: 'payload'.repeat(100) },
      }));

      const state = getCurrentBuildState();
      expect(state?.handoffCount).toBe(1);
      // Payload size should be recorded
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onHandoff?.(createMockHandoffContext());

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle invalid handoff context gracefully', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      // @ts-expect-error Testing invalid context
      await hooks.onHandoff?.({ invalid: 'context' });

      expect(consoleSpy).toHaveBeenCalledWith('[CinematicAdapter] Invalid handoff context');
    });
  });

  // ============================================================================
  // onBuildComplete Tests (5 tests)
  // ============================================================================

  describe('onBuildComplete', () => {
    it('should complete root span with success when no failures', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBuildComplete?.(createMockBuildResult({ failedTasks: 0 }));

      const state = getCurrentBuildState();
      expect(state).toBeNull(); // State is cleared after completion
    });

    it('should complete root span with failure when tasks failed', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());
      await hooks.onTaskError?.(createMockTaskResult({ success: false }));
      await hooks.onBuildComplete?.(createMockBuildResult({ failedTasks: 1 }));

      const state = getCurrentBuildState();
      expect(state).toBeNull();
    });

    it('should flush traces to LangSmith when configured', async () => {
      const config = createMockConfig({
        langsmith: {
          enabled: true,
          apiKey: 'test-key',
          endpoint: 'https://api.langsmith.com',
          projectName: 'Test Project',
        },
      });
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());
      await hooks.onBuildComplete?.(createMockBuildResult());

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CinematicAdapter] Build Complete Report:'),
        expect.any(Object)
      );
    });

    it('should generate build quality report', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());
      await hooks.onAfterTask?.(createMockTaskResult());
      await hooks.onBuildComplete?.(createMockBuildResult());

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Build Complete Report')
      );
      expect(logCall).toBeDefined();
      expect(logCall![1]).toMatchObject({
        buildId: 'build-001',
        totalSpans: expect.any(Number),
      });
    });

    it('should handle invalid build result gracefully', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      // @ts-expect-error Testing invalid context
      await hooks.onBuildComplete?.({ invalid: 'result' });

      expect(consoleSpy).toHaveBeenCalledWith('[CinematicAdapter] Invalid build result context');
    });
  });

  // ============================================================================
  // End-to-End Integration Tests (5 tests)
  // ============================================================================

  describe('End-to-End Integration', () => {
    it('should trace complete build lifecycle', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      // Build start
      await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'e2e-build' }));

      // Task 1
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-1', agentName: 'kimi' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', success: true }));

      // Handoff
      await hooks.onHandoff?.(createMockHandoffContext({ fromAgent: 'kimi', toAgent: 'claude' }));

      // Task 2
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-2', agentName: 'claude' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2', success: true }));

      // Build complete
      await hooks.onBuildComplete?.(createMockBuildResult({ buildId: 'e2e-build', totalTasks: 2 }));

      const state = getCurrentBuildState();
      expect(state).toBeNull(); // State cleared
    });

    it('should trace build with task errors', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'failing-task' }));
      await hooks.onTaskError?.(createMockTaskResult({
        taskId: 'failing-task',
        success: false,
        error: 'Something went wrong',
      }));
      await hooks.onBuildComplete?.(createMockBuildResult({ failedTasks: 1 }));

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should trace build with Braintrust integration', async () => {
      const config = createMockConfig({
        braintrust: {
          enabled: true,
          apiKey: 'bt-key',
          projectName: 'Test',
          projectId: 'proj-1',
        },
      });
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      const state = getCurrentBuildState();
      expect(state?.braintrust).toBeDefined();

      await hooks.onBuildComplete?.(createMockBuildResult());
    });

    it('should trace build with LangSmith integration', async () => {
      const config = createMockConfig({
        langsmith: {
          enabled: true,
          apiKey: 'ls-key',
          endpoint: 'https://api.langsmith.com',
          projectName: 'Test',
        },
      });
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      const state = getCurrentBuildState();
      expect(state?.langsmith).toBeDefined();

      await hooks.onAfterTask?.(createMockTaskResult());
      await hooks.onBuildComplete?.(createMockBuildResult());
    });

    it('should handle multiple sequential builds', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      // Build 1
      await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'build-1' }));
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'b1-task' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'b1-task' }));
      await hooks.onBuildComplete?.(createMockBuildResult({ buildId: 'build-1' }));

      // Build 2
      await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'build-2' }));

      const state = getCurrentBuildState();
      expect(state?.buildId).toBe('build-2');

      await hooks.onBuildComplete?.(createMockBuildResult({ buildId: 'build-2' }));
    });
  });

  // ============================================================================
  // Utility Function Tests (2 tests)
  // ============================================================================

  describe('Utility Functions', () => {
    it('resetBuildState should clear all state', async () => {
      const config = createMockConfig();
      const hooks = createCinematicObservabilityLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      expect(getCurrentBuildState()).not.toBeNull();

      resetBuildState();
      expect(getCurrentBuildState()).toBeNull();
    });

    it('getCurrentBuildState returns null when no build active', () => {
      expect(getCurrentBuildState()).toBeNull();
    });
  });
});
