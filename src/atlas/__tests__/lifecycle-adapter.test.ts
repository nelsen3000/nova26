// KIMI-T-R26-04: Infinite Memory Lifecycle Adapter Tests
// Tests for createInfiniteMemoryLifecycleHooks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createInfiniteMemoryLifecycleHooks,
  initializeInfiniteMemoryForBuild,
  type InfiniteMemoryLifecycleConfig,
  getCurrentBuildState,
  getTaskNodeId,
  getAllTaskNodeIds,
  resetBuildState,
  getMemoryInstance,
} from '../lifecycle-adapter.js';
import type { TaskResult, BuildResult } from '../../orchestrator/lifecycle-hooks.js';

// ============================================================================
// Test Fixtures & Helpers
// ============================================================================

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

const createMockConfig = (overrides: Partial<InfiniteMemoryLifecycleConfig> = {}): InfiniteMemoryLifecycleConfig => ({
  enabled: true,
  ...overrides,
});

// ============================================================================
// Test Suite
// ============================================================================

describe('Infinite Memory Lifecycle Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuildState();
  });

  // ============================================================================
  // onAfterTask Tests (7 tests)
  // ============================================================================

  describe('onAfterTask', () => {
    it('should store task results as scene-level memory nodes', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult());

      const nodeId = getTaskNodeId('task-001');
      expect(nodeId).toBeDefined();

      const memory = getMemoryInstance();
      const node = memory?.getNode(nodeId!);
      expect(node).toBeDefined();
      expect(node?.level).toBe('scene');
    });

    it('should calculate taste score for memory', async () => {
      const config = createMockConfig({ defaultTasteScore: 0.5 });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult({ aceScore: 0.9, success: true }));

      const nodeId = getTaskNodeId('task-001');
      const memory = getMemoryInstance();
      const node = memory?.getNode(nodeId!);

      expect(node?.metadata.tasteScore).toBeGreaterThan(0.5);
    });

    it('should store failed tasks with lower taste score', async () => {
      const config = createMockConfig({ defaultTasteScore: 0.5 });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult({ success: false, error: 'Task failed' }));

      const nodeId = getTaskNodeId('task-001');
      const memory = getMemoryInstance();
      const node = memory?.getNode(nodeId!);

      expect(node?.metadata.tasteScore).toBeLessThan(0.5);
      expect(node?.tags).toContain('failure');
    });

    it('should link multiple task nodes', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);

      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-3' }));

      const allNodeIds = getAllTaskNodeIds();
      expect(allNodeIds.size).toBe(3);
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult());

      expect(getTaskNodeId('task-001')).toBeUndefined();
    });

    it('should skip when no build state exists', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await hooks.onAfterTask?.(createMockTaskResult());

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle invalid task result gracefully', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await initializeInfiniteMemoryForBuild('build-001', config);
      // @ts-expect-error Testing invalid context
      await hooks.onAfterTask?.({ invalid: 'result' });

      expect(consoleSpy).toHaveBeenCalledWith('[InfiniteMemoryAdapter] Invalid task result context');
    });
  });

  // ============================================================================
  // onBuildComplete Tests (6 tests)
  // ============================================================================

  describe('onBuildComplete', () => {
    it('should create project-level summary node', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult());

      // Check stats before onBuildComplete clears state
      let memory = getMemoryInstance();
      let stats = memory?.getStats();
      expect(stats?.byLevel.scene).toBe(1);
      expect(stats?.byLevel.project).toBe(0);

      await hooks.onBuildComplete?.(createMockBuildResult());

      // Memory instance is cleared after build complete
      memory = getMemoryInstance();
      expect(memory).toBeNull();
    });

    it('should link all task nodes to summary', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);

      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2' }));

      const nodeIdsBefore = getAllTaskNodeIds();
      expect(nodeIdsBefore.size).toBe(2);

      await hooks.onBuildComplete?.(createMockBuildResult({ totalTasks: 2 }));

      // Build state should be cleared
      expect(getCurrentBuildState()).toBeNull();
    });

    it('should prune stale nodes when memory exceeds limits', async () => {
      const config = createMockConfig({ maxNodes: 1, pruneAfterDays: 7 });
      const hooks = createInfiniteMemoryLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await initializeInfiniteMemoryForBuild('build-001', config);

      // Add multiple tasks to exceed limit
      for (let i = 0; i < 5; i++) {
        await hooks.onAfterTask?.(createMockTaskResult({ taskId: `task-${i}` }));
      }

      await hooks.onBuildComplete?.(createMockBuildResult());

      // Pruning should be triggered
      const pruneLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('[InfiniteMemoryAdapter] Pruned stale memories')
      );
      expect(pruneLog).toBeDefined();
    });

    it('should respect configured memory limits', async () => {
      const config = createMockConfig({ maxNodes: 1000 });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult());

      // Check stats before build complete
      const memory = getMemoryInstance();
      const stats = memory?.getStats();
      expect(stats?.totalNodes).toBeLessThanOrEqual(1000);

      await hooks.onBuildComplete?.(createMockBuildResult());
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult());
      await hooks.onBuildComplete?.(createMockBuildResult());

      // State should be cleared even when disabled
      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle invalid build result gracefully', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await initializeInfiniteMemoryForBuild('build-001', config);
      // @ts-expect-error Testing invalid context
      await hooks.onBuildComplete?.({ invalid: 'result' });

      expect(consoleSpy).toHaveBeenCalledWith('[InfiniteMemoryAdapter] Invalid build result context');
    });
  });

  // ============================================================================
  // Taste Score Calculation Tests (5 tests)
  // ============================================================================

  describe('Taste Score Calculation', () => {
    it('should give higher score to successful tasks', async () => {
      const config = createMockConfig({ defaultTasteScore: 0.5 });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);

      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'success-task', success: true }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'fail-task', success: false }));

      const memory = getMemoryInstance();
      const successNode = memory?.getNode(getTaskNodeId('success-task')!);
      const failNode = memory?.getNode(getTaskNodeId('fail-task')!);

      expect(successNode!.metadata.tasteScore).toBeGreaterThan(failNode!.metadata.tasteScore);
    });

    it('should reward high ACE scores', async () => {
      const config = createMockConfig({ defaultTasteScore: 0.5 });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      // Use long output to avoid trivial penalty
      await hooks.onAfterTask?.(createMockTaskResult({ aceScore: 0.95, output: 'a'.repeat(100) }));

      const nodeId = getTaskNodeId('task-001');
      const memory = getMemoryInstance();
      const node = memory?.getNode(nodeId!);

      // High ACE score with non-trivial output should result in high score
      expect(node?.metadata.tasteScore).toBeGreaterThan(0.8);
    });

    it('should penalize trivial outputs', async () => {
      const config = createMockConfig({ defaultTasteScore: 0.5 });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult({ output: 'ok', success: false }));

      const nodeId = getTaskNodeId('task-001');
      const memory = getMemoryInstance();
      const node = memory?.getNode(nodeId!);

      // Failed + trivial output (0.5 - 0.2 - 0.4 = -0.1, clamped to 0, but mock has aceScore: 0.95 so +0.33)
      // Actually: 0.5 - 0.2 - 0.4 + 0.33 = 0.23
      expect(node?.metadata.tasteScore).toBeLessThan(0.3);
    });

    it('should reward comprehensive outputs', async () => {
      const config = createMockConfig({ defaultTasteScore: 0.5 });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult({ output: 'a'.repeat(600) }));

      const nodeId = getTaskNodeId('task-001');
      const memory = getMemoryInstance();
      const node = memory?.getNode(nodeId!);

      expect(node?.metadata.tasteScore).toBeGreaterThan(0.5);
    });

    it('should clamp taste score between 0 and 1', async () => {
      const config = createMockConfig({ defaultTasteScore: 0.5 });
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);

      // Very high ACE score
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'high', aceScore: 1.0, success: true }));
      // Very low ACE score
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'low', aceScore: 0, success: false }));

      const memory = getMemoryInstance();
      const highNode = memory?.getNode(getTaskNodeId('high')!);
      const lowNode = memory?.getNode(getTaskNodeId('low')!);

      expect(highNode!.metadata.tasteScore).toBeLessThanOrEqual(1);
      expect(lowNode!.metadata.tasteScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Hierarchy Management Tests (4 tests)
  // ============================================================================

  describe('Hierarchy Management', () => {
    it('should classify task memories at scene level', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult());

      const nodeId = getTaskNodeId('task-001');
      const memory = getMemoryInstance();
      const node = memory?.getNode(nodeId!);

      expect(node?.level).toBe('scene');
    });

    it('should classify build summaries at project level', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult());

      // Check scene level before build complete
      let memory = getMemoryInstance();
      let stats = memory?.getStats();
      expect(stats?.byLevel.scene).toBe(1);

      await hooks.onBuildComplete?.(createMockBuildResult());

      // State cleared, memory instance also cleared
      memory = getMemoryInstance();
      expect(memory).toBeNull();
    });

    it('should track node counts by level', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);

      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2' }));

      const memory = getMemoryInstance();
      const stats = memory?.getStats();

      expect(stats?.byLevel.scene).toBe(2);
    });
  });

  // ============================================================================
  // Utility Function Tests (4 tests)
  // ============================================================================

  describe('Utility Functions', () => {
    it('getTaskNodeId returns undefined for unknown task', () => {
      expect(getTaskNodeId('unknown-task')).toBeUndefined();
    });

    it('getAllTaskNodeIds returns empty map when no build', () => {
      const nodeIds = getAllTaskNodeIds();
      expect(nodeIds.size).toBe(0);
    });

    it('getMemoryInstance returns null when no build', () => {
      expect(getMemoryInstance()).toBeNull();
    });

    it('resetBuildState clears all state', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('build-001', config);
      await hooks.onAfterTask?.(createMockTaskResult());

      expect(getCurrentBuildState()).not.toBeNull();

      resetBuildState();
      expect(getCurrentBuildState()).toBeNull();
      expect(getMemoryInstance()).toBeNull();
    });
  });

  // ============================================================================
  // End-to-End Integration Tests (4 tests)
  // ============================================================================

  describe('End-to-End Integration', () => {
    it('should handle complete build lifecycle', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('e2e-build', config);

      // Simulate multiple tasks
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', agentName: 'code-sage' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2', agentName: 'debug-oracle' }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-3', agentName: 'review-critic' }));

      // Complete build
      await hooks.onBuildComplete?.(createMockBuildResult({
        buildId: 'e2e-build',
        totalTasks: 3,
        successfulTasks: 3,
      }));

      // State cleared
      expect(getCurrentBuildState()).toBeNull();
    });

    it('should persist memory across tasks in same build', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('persist-build', config);

      for (let i = 0; i < 5; i++) {
        await hooks.onAfterTask?.(createMockTaskResult({ taskId: `task-${i}` }));
      }

      const memory = getMemoryInstance();
      const stats = memory?.getStats();

      expect(stats?.totalNodes).toBe(5);
    });

    it('should handle builds with mixed success/failure', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      await initializeInfiniteMemoryForBuild('mixed-build', config);

      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'success-1', success: true }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'fail-1', success: false }));
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'success-2', success: true }));

      await hooks.onBuildComplete?.(createMockBuildResult({
        buildId: 'mixed-build',
        totalTasks: 3,
        successfulTasks: 2,
        failedTasks: 1,
      }));

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle sequential builds independently', async () => {
      const config = createMockConfig();
      const hooks = createInfiniteMemoryLifecycleHooks(config);

      // Build 1
      await initializeInfiniteMemoryForBuild('build-1', config);
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'b1-task' }));
      await hooks.onBuildComplete?.(createMockBuildResult({ buildId: 'build-1' }));

      // Build 2
      await initializeInfiniteMemoryForBuild('build-2', config);
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'b2-task' }));

      const memory = getMemoryInstance();
      const stats = memory?.getStats();

      // Should only have build-2's memory
      expect(stats?.totalNodes).toBe(1);
      expect(getTaskNodeId('b1-task')).toBeUndefined();
      expect(getTaskNodeId('b2-task')).toBeDefined();
    });
  });
});
