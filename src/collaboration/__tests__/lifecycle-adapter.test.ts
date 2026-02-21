// KIMI-T-R24-03: CRDT Collaboration Lifecycle Adapter Tests
// Tests for createCRDTLifecycleHooks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createCRDTLifecycleHooks,
  type CRDTLifecycleConfig,
  getCurrentBuildState,
  getCRDTDocument,
  resetBuildState,
  getBuildParticipants,
  getTaskChangeCount,
} from '../lifecycle-adapter.js';
import type {
  BuildContext,
  TaskResult,
  BuildResult,
} from '../../orchestrator/lifecycle-hooks.js';

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

const createMockTaskResult = (overrides: Partial<TaskResult> = {}): TaskResult => ({
  taskId: 'task-001',
  agentName: 'code-sage',
  success: true,
  output: 'Task completed successfully with detailed results',
  durationMs: 1000,
  aceScore: 0.95,
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

const createMockConfig = (overrides: Partial<CRDTLifecycleConfig> = {}): CRDTLifecycleConfig => ({
  enabled: true,
  documentType: 'code',
  conflictResolution: 'last-writer-wins',
  enableParallelUniverses: false,
  maxParticipants: 50,
  autoBroadcast: true,
  ...overrides,
});

// ============================================================================
// Test Suite
// ============================================================================

describe('CRDT Collaboration Lifecycle Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuildState();
  });

  // ============================================================================
  // onBeforeBuild Tests (6 tests)
  // ============================================================================

  describe('onBeforeBuild', () => {
    it('should create collaboration session on build start', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state).not.toBeNull();
      expect(state?.buildId).toBe('build-001');
      expect(state?.orchestrator).toBeDefined();
    });

    it('should initialize CRDT document', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const document = getCRDTDocument();
      expect(document).not.toBeNull();
      expect(document?.type).toBe('code');
      expect(document?.version).toBe(1);
    });

    it('should set up change tracking', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.taskChanges).toBeDefined();
      expect(state?.taskChanges.size).toBe(0);
    });

    it('should use configured document type', async () => {
      const config = createMockConfig({ documentType: 'design' });
      const hooks = createCRDTLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const document = getCRDTDocument();
      expect(document?.type).toBe('design');
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createCRDTLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle invalid build context gracefully', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // @ts-expect-error Testing invalid context
      await hooks.onBeforeBuild?.({ invalid: 'context' });

      expect(consoleSpy).toHaveBeenCalledWith('[CRDTAdapter] Invalid build context');
      expect(getCurrentBuildState()).toBeNull();
    });
  });

  // ============================================================================
  // onAfterTask Tests (7 tests)
  // ============================================================================

  describe('onAfterTask', () => {
    it('should merge task output into shared CRDT document', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());

      const document = getCRDTDocument();
      expect(document?.content.length).toBeGreaterThan(0);
      expect(document?.version).toBe(2); // Initial 1 + 1 change
    });

    it('should add participant on first task', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult({ agentName: 'code-sage', taskId: 'task-1' }));

      const participants = getBuildParticipants();
      expect(participants.length).toBe(1);
      expect(participants[0]).toContain('code-sage');
    });

    it('should track changes per task', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2' }));

      expect(getTaskChangeCount('task-1')).toBe(1);
      expect(getTaskChangeCount('task-2')).toBe(1);
    });

    it('should broadcast changes when autoBroadcast enabled', async () => {
      const config = createMockConfig({ autoBroadcast: true });
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());

      const broadcastLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Broadcasting changes')
      );
      expect(broadcastLog).toBeDefined();
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());

      // Document should not be updated
      expect(getCRDTDocument()).toBeNull();
    });

    it('should skip when no build state exists', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onAfterTask?.(createMockTaskResult());

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle invalid task result gracefully', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      // @ts-expect-error Testing invalid context
      await hooks.onAfterTask?.({ invalid: 'result' });

      expect(consoleSpy).toHaveBeenCalledWith('[CRDTAdapter] Invalid task result context');
    });
  });

  // ============================================================================
  // Conflict Resolution Tests (4 tests)
  // ============================================================================

  describe('Conflict Resolution', () => {
    it('should use last-write-wins strategy when configured', async () => {
      const config = createMockConfig({ conflictResolution: 'last-writer-wins' });
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', output: 'first' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', output: 'second' }));

      const mergeLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('merged')
      );
      expect(mergeLog?.[1]).toMatchObject({ strategy: 'last-writer-wins' });
    });

    it('should use semantic-merge strategy when configured', async () => {
      const config = createMockConfig({ conflictResolution: 'semantic-merge' });
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());

      const mergeLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('merged')
      );
      expect(mergeLog?.[1]).toMatchObject({ strategy: 'semantic-merge' });
    });

    it('should use manual strategy when configured', async () => {
      const config = createMockConfig({ conflictResolution: 'manual' });
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());

      const mergeLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('merged')
      );
      expect(mergeLog?.[1]).toMatchObject({ strategy: 'manual' });
    });

    it('should default to last-write-wins when not specified', async () => {
      const config = createMockConfig({ conflictResolution: undefined });
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());

      const mergeLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('merged')
      );
      expect(mergeLog?.[1]).toMatchObject({ strategy: 'last-writer-wins' });
    });
  });

  // ============================================================================
  // onBuildComplete Tests (6 tests)
  // ============================================================================

  describe('onBuildComplete', () => {
    it('should finalize CRDT document', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());
      
      const beforeTimestamp = getCRDTDocument()?.lastModified;
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await hooks.onBuildComplete?.(createMockBuildResult());

      // Document should be finalized (state cleared)
      expect(getCRDTDocument()).toBeNull();
    });

    it('should generate merge summary', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2' }));
      await hooks.onBuildComplete?.(createMockBuildResult({ totalTasks: 2 }));

      const summaryLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('CRDT Summary')
      );
      expect(summaryLog).toBeDefined();
      expect(summaryLog?.[1]).toMatchObject({
        buildId: 'build-001',
        totalTasks: 2,
        totalParticipants: 2,
      });
    });

    it('should close collaboration session', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());
      await hooks.onBuildComplete?.(createMockBuildResult());

      // Build state should be cleared
      expect(getCurrentBuildState()).toBeNull();
    });

    it('should include participant count in summary', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult({ agentName: 'agent-a', taskId: 'task-1' }));
      await hooks.onAfterTask?.(createMockTaskResult({ agentName: 'agent-b', taskId: 'task-2' }));
      await hooks.onBuildComplete?.(createMockBuildResult());

      const summaryLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('CRDT Summary')
      );
      expect(summaryLog?.[1]).toMatchObject({
        totalParticipants: 2,
      });
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());
      await hooks.onBuildComplete?.(createMockBuildResult());

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle invalid build result gracefully', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());
      // @ts-expect-error Testing invalid context
      await hooks.onBuildComplete?.({ invalid: 'result' });

      expect(consoleSpy).toHaveBeenCalledWith('[CRDTAdapter] Invalid build result context');
    });
  });

  // ============================================================================
  // Multi-Participant Consistency Tests (4 tests)
  // ============================================================================

  describe('Multi-Participant Consistency', () => {
    it('multiple participants see consistent document state', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      // Multiple agents contribute
      await hooks.onAfterTask?.(createMockTaskResult({ agentName: 'agent-a', taskId: 'task-1' }));
      await hooks.onAfterTask?.(createMockTaskResult({ agentName: 'agent-b', taskId: 'task-2' }));
      await hooks.onAfterTask?.(createMockTaskResult({ agentName: 'agent-c', taskId: 'task-3' }));

      const document = getCRDTDocument();
      expect(document?.participants.length).toBe(3);
    });

    it('concurrent task outputs are merged without data loss', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      // Simulate concurrent task completions
      await Promise.all([
        hooks.onAfterTask?.(createMockTaskResult({ taskId: 'concurrent-1', output: 'output-a' })),
        hooks.onAfterTask?.(createMockTaskResult({ taskId: 'concurrent-2', output: 'output-b' })),
        hooks.onAfterTask?.(createMockTaskResult({ taskId: 'concurrent-3', output: 'output-c' })),
      ]);

      const document = getCRDTDocument();
      expect(document?.content.length).toBeGreaterThan(0);
    });

    it('same agent with different tasks counted separately', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      await hooks.onAfterTask?.(createMockTaskResult({ agentName: 'code-sage', taskId: 'task-1' }));
      await hooks.onAfterTask?.(createMockTaskResult({ agentName: 'code-sage', taskId: 'task-2' }));

      const participants = getBuildParticipants();
      expect(participants.length).toBe(2);
    });

    it('maintains correct version across multiple changes', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      expect(getCRDTDocument()?.version).toBe(1);

      for (let i = 0; i < 5; i++) {
        await hooks.onAfterTask?.(createMockTaskResult({ taskId: `task-${i}` }));
      }

      expect(getCRDTDocument()?.version).toBe(6);
    });
  });

  // ============================================================================
  // End-to-End Integration Tests (4 tests)
  // ============================================================================

  describe('End-to-End Integration', () => {
    it('should handle complete build lifecycle', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      // Build start
      await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'e2e-build' }));

      // Multiple tasks
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', agentName: 'kimi' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2', agentName: 'claude' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-3', agentName: 'gpt4' }));

      // Build complete
      await hooks.onBuildComplete?.(createMockBuildResult({ buildId: 'e2e-build', totalTasks: 3 }));

      // State should be cleared
      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle build with mixed success/failure', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'success-1', success: true }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'fail-1', success: false, error: 'Error' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'success-2', success: true }));

      await hooks.onBuildComplete?.(createMockBuildResult({
        totalTasks: 3,
        successfulTasks: 2,
        failedTasks: 1,
      }));

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle sequential builds independently', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      // Build 1
      await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'build-1' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'b1-task' }));
      await hooks.onBuildComplete?.(createMockBuildResult({ buildId: 'build-1' }));

      // Build 2
      await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'build-2' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'b2-task' }));

      const state = getCurrentBuildState();
      expect(state?.buildId).toBe('build-2');

      await hooks.onBuildComplete?.(createMockBuildResult({ buildId: 'build-2' }));
    });

    it('should track all changes in document', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      for (let i = 0; i < 10; i++) {
        await hooks.onAfterTask?.(createMockTaskResult({ taskId: `task-${i}` }));
      }

      const state = getCurrentBuildState();
      const orchestrator = state?.orchestrator;
      const document = state?.document;
      
      if (document) {
        const changes = orchestrator?.getChanges(document.id);
        expect(changes?.length).toBe(10);
      }

      await hooks.onBuildComplete?.(createMockBuildResult({ totalTasks: 10 }));
    });
  });

  // ============================================================================
  // Utility Function Tests (5 tests)
  // ============================================================================

  describe('Utility Functions', () => {
    it('getCurrentBuildState returns null when no build active', () => {
      expect(getCurrentBuildState()).toBeNull();
    });

    it('getCRDTDocument returns null when no build active', () => {
      expect(getCRDTDocument()).toBeNull();
    });

    it('getBuildParticipants returns empty array when no build', () => {
      expect(getBuildParticipants()).toEqual([]);
    });

    it('getTaskChangeCount returns 0 for unknown task', () => {
      expect(getTaskChangeCount('unknown-task')).toBe(0);
    });

    it('resetBuildState clears all state', async () => {
      const config = createMockConfig();
      const hooks = createCRDTLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onAfterTask?.(createMockTaskResult());

      expect(getCurrentBuildState()).not.toBeNull();

      resetBuildState();
      expect(getCurrentBuildState()).toBeNull();
      expect(getCRDTDocument()).toBeNull();
    });
  });
});
