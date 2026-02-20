// SN-02: Error Recovery E2E Test
// Simulates builds where tasks fail at different stages, verifying recovery

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HookRegistry,
  type BuildContext,
  type TaskContext,
  type TaskResult,
  type BuildResult,
} from '../lifecycle-hooks.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SimTask {
  id: string;
  title: string;
  agent: string;
  shouldFail?: boolean;
  failPhase?: 'before' | 'during' | 'after';
}

interface RecoveryLog {
  event: string;
  taskId?: string;
  details?: string;
}

async function simulateBuildWithErrors(
  tasks: SimTask[],
  registry: HookRegistry,
): Promise<{ results: TaskResult[]; logs: RecoveryLog[]; buildResult: BuildResult }> {
  const results: TaskResult[] = [];
  const logs: RecoveryLog[] = [];

  const buildCtx: BuildContext = {
    buildId: 'build-err-001',
    prdId: 'prd-err',
    prdName: 'Error Recovery PRD',
    startedAt: new Date().toISOString(),
    options: {},
  };

  await registry.executePhase('onBeforeBuild', buildCtx);
  logs.push({ event: 'build:start' });

  for (const task of tasks) {
    const taskCtx: TaskContext = {
      taskId: task.id,
      title: task.title,
      agentName: task.agent,
      dependencies: [],
    };

    await registry.executePhase('onBeforeTask', taskCtx);
    logs.push({ event: 'task:start', taskId: task.id });

    const success = !task.shouldFail;
    const result: TaskResult = {
      taskId: task.id,
      agentName: task.agent,
      success,
      output: success ? `Output: ${task.title}` : undefined,
      error: success ? undefined : `Error in ${task.failPhase ?? 'execution'}: ${task.title}`,
      durationMs: 100 + Math.floor(Math.random() * 500),
    };

    if (success) {
      await registry.executePhase('onAfterTask', result);
      logs.push({ event: 'task:success', taskId: task.id });
    } else {
      await registry.executePhase('onTaskError', result);
      logs.push({ event: 'task:error', taskId: task.id, details: result.error });
    }

    results.push(result);
  }

  const buildResult: BuildResult = {
    buildId: 'build-err-001',
    prdId: 'prd-err',
    totalTasks: tasks.length,
    successfulTasks: results.filter(r => r.success).length,
    failedTasks: results.filter(r => !r.success).length,
    totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
    averageAceScore: 0,
  };

  await registry.executePhase('onBuildComplete', buildResult);
  logs.push({ event: 'build:complete' });

  return { results, logs, buildResult };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Error Recovery', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new HookRegistry();
  });

  describe('Single task failure', () => {
    it('should fire onTaskError when a task fails', async () => {
      const errors: string[] = [];
      registry.register({
        phase: 'onTaskError',
        moduleName: 'error-handler',
        priority: 20,
        handler: async (ctx) => { errors.push((ctx as TaskResult).taskId); },
      });

      const { results } = await simulateBuildWithErrors(
        [{ id: 't1', title: 'Failing', agent: 'EARTH', shouldFail: true }],
        registry,
      );

      expect(results[0].success).toBe(false);
      expect(errors).toEqual(['t1']);
    });

    it('should include error message in failed task result', async () => {
      const { results } = await simulateBuildWithErrors(
        [{ id: 't1', title: 'Bad task', agent: 'MARS', shouldFail: true, failPhase: 'during' }],
        registry,
      );

      expect(results[0].error).toContain('during');
      expect(results[0].output).toBeUndefined();
    });

    it('should not fire onAfterTask for failed tasks', async () => {
      const afterTasks: string[] = [];
      registry.register({
        phase: 'onAfterTask',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => { afterTasks.push((ctx as TaskResult).taskId); },
      });

      await simulateBuildWithErrors(
        [{ id: 't1', title: 'Fail', agent: 'EARTH', shouldFail: true }],
        registry,
      );

      expect(afterTasks).toEqual([]);
    });
  });

  describe('Multiple task failures', () => {
    it('should continue processing after a task failure', async () => {
      const processed: string[] = [];
      registry.register({
        phase: 'onBeforeTask',
        moduleName: 'tracker',
        priority: 50,
        handler: async (ctx) => { processed.push((ctx as TaskContext).taskId); },
      });

      const { results } = await simulateBuildWithErrors([
        { id: 't1', title: 'OK', agent: 'EARTH' },
        { id: 't2', title: 'Fail', agent: 'MARS', shouldFail: true },
        { id: 't3', title: 'OK', agent: 'VENUS' },
      ], registry);

      expect(processed).toEqual(['t1', 't2', 't3']);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should handle all tasks failing', async () => {
      const errorCount = vi.fn();
      registry.register({
        phase: 'onTaskError',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { errorCount(); },
      });

      const { results, buildResult } = await simulateBuildWithErrors([
        { id: 't1', title: 'F1', agent: 'EARTH', shouldFail: true },
        { id: 't2', title: 'F2', agent: 'MARS', shouldFail: true },
        { id: 't3', title: 'F3', agent: 'VENUS', shouldFail: true },
      ], registry);

      expect(results.every(r => !r.success)).toBe(true);
      expect(errorCount).toHaveBeenCalledTimes(3);
      expect(buildResult.failedTasks).toBe(3);
      expect(buildResult.successfulTasks).toBe(0);
    });

    it('should report mixed success/failure in build result', async () => {
      const { buildResult } = await simulateBuildWithErrors([
        { id: 't1', title: 'OK', agent: 'EARTH' },
        { id: 't2', title: 'Fail', agent: 'MARS', shouldFail: true },
        { id: 't3', title: 'OK', agent: 'VENUS' },
        { id: 't4', title: 'Fail', agent: 'SATURN', shouldFail: true },
        { id: 't5', title: 'OK', agent: 'PLUTO' },
      ], registry);

      expect(buildResult.totalTasks).toBe(5);
      expect(buildResult.successfulTasks).toBe(3);
      expect(buildResult.failedTasks).toBe(2);
    });
  });

  describe('Circuit breaker simulation', () => {
    it('should track consecutive failures for circuit breaker logic', async () => {
      let consecutiveFailures = 0;
      let maxConsecutive = 0;

      registry.register({
        phase: 'onAfterTask',
        moduleName: 'circuit-breaker',
        priority: 10,
        handler: async () => { consecutiveFailures = 0; },
      });
      registry.register({
        phase: 'onTaskError',
        moduleName: 'circuit-breaker',
        priority: 10,
        handler: async () => {
          consecutiveFailures++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveFailures);
        },
      });

      await simulateBuildWithErrors([
        { id: 't1', title: 'OK', agent: 'EARTH' },
        { id: 't2', title: 'F1', agent: 'MARS', shouldFail: true },
        { id: 't3', title: 'F2', agent: 'VENUS', shouldFail: true },
        { id: 't4', title: 'F3', agent: 'SATURN', shouldFail: true },
        { id: 't5', title: 'OK', agent: 'PLUTO' },
      ], registry);

      expect(maxConsecutive).toBe(3);
    });

    it('should reset consecutive failures after a success', async () => {
      let consecutiveFailures = 0;

      registry.register({
        phase: 'onAfterTask',
        moduleName: 'circuit-breaker',
        priority: 10,
        handler: async () => { consecutiveFailures = 0; },
      });
      registry.register({
        phase: 'onTaskError',
        moduleName: 'circuit-breaker',
        priority: 10,
        handler: async () => { consecutiveFailures++; },
      });

      await simulateBuildWithErrors([
        { id: 't1', title: 'F1', agent: 'EARTH', shouldFail: true },
        { id: 't2', title: 'OK', agent: 'MARS' },
        { id: 't3', title: 'F2', agent: 'VENUS', shouldFail: true },
      ], registry);

      expect(consecutiveFailures).toBe(1);
    });
  });

  describe('Error handler hook resilience', () => {
    it('should survive when an error hook itself throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.register({
        phase: 'onTaskError',
        moduleName: 'broken-handler',
        priority: 10,
        handler: async () => { throw new Error('Error handler crashed!'); },
      });

      const { results } = await simulateBuildWithErrors(
        [{ id: 't1', title: 'Fail', agent: 'EARTH', shouldFail: true }],
        registry,
      );

      expect(results).toHaveLength(1);
      consoleSpy.mockRestore();
    });

    it('should run all error hooks even if one throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const secondHandler = vi.fn();

      registry.register({
        phase: 'onTaskError',
        moduleName: 'broken',
        priority: 10,
        handler: async () => { throw new Error('Crash'); },
      });
      registry.register({
        phase: 'onTaskError',
        moduleName: 'healthy',
        priority: 20,
        handler: async () => { secondHandler(); },
      });

      await simulateBuildWithErrors(
        [{ id: 't1', title: 'Fail', agent: 'EARTH', shouldFail: true }],
        registry,
      );

      expect(secondHandler).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Error context propagation', () => {
    it('should include agent name in error results', async () => {
      let capturedAgent = '';
      registry.register({
        phase: 'onTaskError',
        moduleName: 'logger',
        priority: 50,
        handler: async (ctx) => { capturedAgent = (ctx as TaskResult).agentName; },
      });

      await simulateBuildWithErrors(
        [{ id: 't1', title: 'Fail', agent: 'JUPITER', shouldFail: true }],
        registry,
      );

      expect(capturedAgent).toBe('JUPITER');
    });

    it('should distinguish failure phases in error messages', async () => {
      const errors: string[] = [];
      registry.register({
        phase: 'onTaskError',
        moduleName: 'logger',
        priority: 50,
        handler: async (ctx) => { errors.push((ctx as TaskResult).error ?? ''); },
      });

      await simulateBuildWithErrors([
        { id: 't1', title: 'T1', agent: 'E', shouldFail: true, failPhase: 'before' },
        { id: 't2', title: 'T2', agent: 'M', shouldFail: true, failPhase: 'during' },
        { id: 't3', title: 'T3', agent: 'V', shouldFail: true, failPhase: 'after' },
      ], registry);

      expect(errors[0]).toContain('before');
      expect(errors[1]).toContain('during');
      expect(errors[2]).toContain('after');
    });

    it('should report duration even for failed tasks', async () => {
      const { results } = await simulateBuildWithErrors(
        [{ id: 't1', title: 'Fail', agent: 'EARTH', shouldFail: true }],
        registry,
      );

      expect(results[0].durationMs).toBeGreaterThan(0);
    });
  });

  describe('Build completion with errors', () => {
    it('should always fire onBuildComplete even when all tasks fail', async () => {
      const buildCompleted = vi.fn();
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'test',
        priority: 50,
        handler: async () => { buildCompleted(); },
      });

      await simulateBuildWithErrors([
        { id: 't1', title: 'F1', agent: 'E', shouldFail: true },
        { id: 't2', title: 'F2', agent: 'M', shouldFail: true },
      ], registry);

      expect(buildCompleted).toHaveBeenCalledTimes(1);
    });

    it('should include total duration in failed build result', async () => {
      const { buildResult, results } = await simulateBuildWithErrors([
        { id: 't1', title: 'F', agent: 'E', shouldFail: true },
        { id: 't2', title: 'F', agent: 'M', shouldFail: true },
      ], registry);

      const expectedDuration = results.reduce((s, r) => s + r.durationMs, 0);
      expect(buildResult.totalDurationMs).toBe(expectedDuration);
    });

    it('should report zero successful tasks when build completely fails', async () => {
      const { buildResult } = await simulateBuildWithErrors([
        { id: 't1', title: 'F', agent: 'E', shouldFail: true },
      ], registry);

      expect(buildResult.successfulTasks).toBe(0);
      expect(buildResult.failedTasks).toBe(1);
    });
  });

  describe('Recovery logging', () => {
    it('should log build start and complete events', async () => {
      const { logs } = await simulateBuildWithErrors(
        [{ id: 't1', title: 'OK', agent: 'E' }],
        registry,
      );

      expect(logs[0].event).toBe('build:start');
      expect(logs[logs.length - 1].event).toBe('build:complete');
    });

    it('should log error events with task IDs', async () => {
      const { logs } = await simulateBuildWithErrors([
        { id: 'ok-task', title: 'OK', agent: 'E' },
        { id: 'fail-task', title: 'Fail', agent: 'M', shouldFail: true },
      ], registry);

      const errorLogs = logs.filter(l => l.event === 'task:error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].taskId).toBe('fail-task');
      expect(errorLogs[0].details).toBeDefined();
    });

    it('should maintain correct log order', async () => {
      const { logs } = await simulateBuildWithErrors([
        { id: 't1', title: 'OK', agent: 'E' },
        { id: 't2', title: 'Fail', agent: 'M', shouldFail: true },
        { id: 't3', title: 'OK', agent: 'V' },
      ], registry);

      const events = logs.map(l => l.event);
      expect(events).toEqual([
        'build:start',
        'task:start', 'task:success',
        'task:start', 'task:error',
        'task:start', 'task:success',
        'build:complete',
      ]);
    });
  });

  describe('Retry simulation', () => {
    it('should simulate successful retry after initial failure', async () => {
      let attempt = 0;
      const retryResults: boolean[] = [];

      registry.register({
        phase: 'onTaskError',
        moduleName: 'retry-handler',
        priority: 10,
        handler: async () => { attempt++; },
      });

      // First attempt fails
      const { results: r1 } = await simulateBuildWithErrors(
        [{ id: 't1', title: 'Flaky', agent: 'EARTH', shouldFail: true }],
        registry,
      );
      retryResults.push(r1[0].success);

      // Second attempt succeeds
      const { results: r2 } = await simulateBuildWithErrors(
        [{ id: 't1', title: 'Flaky', agent: 'EARTH', shouldFail: false }],
        registry,
      );
      retryResults.push(r2[0].success);

      expect(retryResults).toEqual([false, true]);
      expect(attempt).toBe(1);
    });

    it('should track retry count per task', async () => {
      const retryCounts: Record<string, number> = {};

      registry.register({
        phase: 'onTaskError',
        moduleName: 'retry-tracker',
        priority: 10,
        handler: async (ctx) => {
          const taskId = (ctx as TaskResult).taskId;
          retryCounts[taskId] = (retryCounts[taskId] ?? 0) + 1;
        },
      });

      await simulateBuildWithErrors([
        { id: 't1', title: 'F1', agent: 'EARTH', shouldFail: true },
      ], registry);
      await simulateBuildWithErrors([
        { id: 't1', title: 'F1', agent: 'EARTH', shouldFail: true },
      ], registry);

      expect(retryCounts['t1']).toBe(2);
    });
  });

  describe('Error aggregation', () => {
    it('should collect all error messages from a build', async () => {
      const allErrors: string[] = [];
      registry.register({
        phase: 'onTaskError',
        moduleName: 'aggregator',
        priority: 50,
        handler: async (ctx) => {
          const err = (ctx as TaskResult).error;
          if (err) allErrors.push(err);
        },
      });

      await simulateBuildWithErrors([
        { id: 't1', title: 'Auth', agent: 'EARTH', shouldFail: true, failPhase: 'before' },
        { id: 't2', title: 'DB', agent: 'MARS', shouldFail: true, failPhase: 'during' },
        { id: 't3', title: 'OK', agent: 'VENUS' },
      ], registry);

      expect(allErrors).toHaveLength(2);
      expect(allErrors[0]).toContain('Auth');
      expect(allErrors[1]).toContain('DB');
    });

    it('should provide build-level error summary', async () => {
      const { buildResult, results } = await simulateBuildWithErrors([
        { id: 't1', title: 'A', agent: 'E', shouldFail: true },
        { id: 't2', title: 'B', agent: 'M' },
        { id: 't3', title: 'C', agent: 'V', shouldFail: true },
        { id: 't4', title: 'D', agent: 'S' },
      ], registry);

      const failedIds = results.filter(r => !r.success).map(r => r.taskId);
      expect(failedIds).toEqual(['t1', 't3']);
      expect(buildResult.failedTasks).toBe(2);
      expect(buildResult.successfulTasks).toBe(2);
    });

    it('should track error rate as percentage', async () => {
      const { buildResult } = await simulateBuildWithErrors([
        { id: 't1', title: 'A', agent: 'E', shouldFail: true },
        { id: 't2', title: 'B', agent: 'M' },
        { id: 't3', title: 'C', agent: 'V', shouldFail: true },
        { id: 't4', title: 'D', agent: 'S' },
        { id: 't5', title: 'E', agent: 'P' },
      ], registry);

      const errorRate = buildResult.failedTasks / buildResult.totalTasks;
      expect(errorRate).toBe(0.4);
    });
  });

  describe('Error isolation', () => {
    it('should not let one tasks failure corrupt another tasks result', async () => {
      const { results } = await simulateBuildWithErrors([
        { id: 't1', title: 'Good', agent: 'EARTH' },
        { id: 't2', title: 'Bad', agent: 'MARS', shouldFail: true },
        { id: 't3', title: 'Good', agent: 'VENUS' },
      ], registry);

      expect(results[0].success).toBe(true);
      expect(results[0].error).toBeUndefined();
      expect(results[1].success).toBe(false);
      expect(results[1].output).toBeUndefined();
      expect(results[2].success).toBe(true);
      expect(results[2].error).toBeUndefined();
    });

    it('should maintain separate durations for each failed task', async () => {
      const { results } = await simulateBuildWithErrors([
        { id: 't1', title: 'F1', agent: 'E', shouldFail: true },
        { id: 't2', title: 'F2', agent: 'M', shouldFail: true },
      ], registry);

      expect(results[0].durationMs).toBeGreaterThan(0);
      expect(results[1].durationMs).toBeGreaterThan(0);
      // Durations are random so they should be independent
      expect(typeof results[0].durationMs).toBe('number');
      expect(typeof results[1].durationMs).toBe('number');
    });
  });

  describe('Partial results', () => {
    it('should provide partial results when build has mixed outcomes', async () => {
      const { results } = await simulateBuildWithErrors([
        { id: 't1', title: 'OK', agent: 'EARTH' },
        { id: 't2', title: 'Fail', agent: 'MARS', shouldFail: true },
        { id: 't3', title: 'OK', agent: 'VENUS' },
      ], registry);

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(1);
      expect(successful.every(r => r.output !== undefined)).toBe(true);
      expect(failed.every(r => r.error !== undefined)).toBe(true);
    });

    it('should assign correct agent names to partial results', async () => {
      const { results } = await simulateBuildWithErrors([
        { id: 't1', title: 'OK', agent: 'EARTH' },
        { id: 't2', title: 'Fail', agent: 'MARS', shouldFail: true },
        { id: 't3', title: 'OK', agent: 'VENUS' },
      ], registry);

      expect(results[0].agentName).toBe('EARTH');
      expect(results[1].agentName).toBe('MARS');
      expect(results[2].agentName).toBe('VENUS');
    });

    it('should preserve task order in results regardless of success/failure', async () => {
      const { results } = await simulateBuildWithErrors([
        { id: 'a', title: 'A', agent: 'E' },
        { id: 'b', title: 'B', agent: 'M', shouldFail: true },
        { id: 'c', title: 'C', agent: 'V' },
        { id: 'd', title: 'D', agent: 'S', shouldFail: true },
      ], registry);

      expect(results.map(r => r.taskId)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should preserve outputs from successful tasks when others fail', async () => {
      const { results } = await simulateBuildWithErrors([
        { id: 't1', title: 'Spec', agent: 'EARTH' },
        { id: 't2', title: 'Code', agent: 'MARS', shouldFail: true },
        { id: 't3', title: 'Tests', agent: 'SATURN' },
      ], registry);

      expect(results[0].output).toContain('Spec');
      expect(results[1].output).toBeUndefined();
      expect(results[2].output).toContain('Tests');
    });
  });
});
