// SN-11: Rapid Task Failure Stress Test
// Simulates 20 consecutive failures and verifies circuit breaker behavior

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

interface FailureTask {
  id: string;
  title: string;
  agent: string;
  shouldFail: boolean;
}

interface CircuitBreakerState {
  consecutiveFailures: number;
  maxConsecutive: number;
  tripped: boolean;
  tripThreshold: number;
}

async function simulateWithCircuitBreaker(
  tasks: FailureTask[],
  registry: HookRegistry,
  tripThreshold = 5,
): Promise<{
  results: TaskResult[];
  buildResult: BuildResult;
  circuitBreaker: CircuitBreakerState;
  errorLog: string[];
}> {
  const results: TaskResult[] = [];
  const errorLog: string[] = [];
  const cb: CircuitBreakerState = {
    consecutiveFailures: 0,
    maxConsecutive: 0,
    tripped: false,
    tripThreshold,
  };

  const buildCtx: BuildContext = {
    buildId: 'rapid-fail-001',
    prdId: 'prd-fail',
    prdName: 'Rapid Failure Test',
    startedAt: new Date().toISOString(),
    options: {},
  };

  await registry.executePhase('onBeforeBuild', buildCtx);

  for (const task of tasks) {
    if (cb.tripped) {
      // Circuit breaker open — skip remaining tasks
      results.push({
        taskId: task.id,
        agentName: task.agent,
        success: false,
        error: 'Circuit breaker tripped — task skipped',
        durationMs: 0,
      });
      continue;
    }

    const taskCtx: TaskContext = {
      taskId: task.id,
      title: task.title,
      agentName: task.agent,
      dependencies: [],
    };

    await registry.executePhase('onBeforeTask', taskCtx);

    const success = !task.shouldFail;
    const result: TaskResult = {
      taskId: task.id,
      agentName: task.agent,
      success,
      output: success ? `Output: ${task.title}` : undefined,
      error: success ? undefined : `Failed: ${task.title}`,
      durationMs: 50 + Math.floor(Math.random() * 100),
    };

    if (success) {
      await registry.executePhase('onAfterTask', result);
      cb.consecutiveFailures = 0;
    } else {
      await registry.executePhase('onTaskError', result);
      cb.consecutiveFailures++;
      cb.maxConsecutive = Math.max(cb.maxConsecutive, cb.consecutiveFailures);
      errorLog.push(task.id);

      if (cb.consecutiveFailures >= cb.tripThreshold) {
        cb.tripped = true;
      }
    }

    results.push(result);
  }

  const buildResult: BuildResult = {
    buildId: 'rapid-fail-001',
    prdId: 'prd-fail',
    totalTasks: tasks.length,
    successfulTasks: results.filter(r => r.success).length,
    failedTasks: results.filter(r => !r.success).length,
    totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
    averageAceScore: 0,
  };

  await registry.executePhase('onBuildComplete', buildResult);

  return { results, buildResult, circuitBreaker: cb, errorLog };
}

function makeFailingTasks(count: number): FailureTask[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `fail-${i}`,
    title: `Failing Task ${i}`,
    agent: ['EARTH', 'MARS', 'VENUS'][i % 3],
    shouldFail: true,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stress: Rapid Task Failures', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new HookRegistry();
  });

  describe('20 consecutive failures', () => {
    it('should process all 20 failures', async () => {
      const tasks = makeFailingTasks(20);
      const { results } = await simulateWithCircuitBreaker(tasks, registry, 25);

      expect(results).toHaveLength(20);
      expect(results.every(r => !r.success)).toBe(true);
    });

    it('should fire onTaskError for each failure', async () => {
      let errorCount = 0;
      registry.register({
        phase: 'onTaskError',
        moduleName: 'counter',
        priority: 50,
        handler: async () => { errorCount++; },
      });

      const tasks = makeFailingTasks(20);
      await simulateWithCircuitBreaker(tasks, registry, 25);

      expect(errorCount).toBe(20);
    });

    it('should log all 20 failures in error log', async () => {
      const tasks = makeFailingTasks(20);
      const { errorLog } = await simulateWithCircuitBreaker(tasks, registry, 25);

      expect(errorLog).toHaveLength(20);
    });

    it('should track max consecutive failures as 20', async () => {
      const tasks = makeFailingTasks(20);
      const { circuitBreaker } = await simulateWithCircuitBreaker(tasks, registry, 25);

      expect(circuitBreaker.maxConsecutive).toBe(20);
    });
  });

  describe('Circuit breaker activation', () => {
    it('should trip circuit breaker after threshold consecutive failures', async () => {
      const tasks = makeFailingTasks(10);
      const { circuitBreaker } = await simulateWithCircuitBreaker(tasks, registry, 5);

      expect(circuitBreaker.tripped).toBe(true);
      expect(circuitBreaker.consecutiveFailures).toBe(5);
    });

    it('should skip remaining tasks after circuit breaker trips', async () => {
      const tasks = makeFailingTasks(10);
      const { results } = await simulateWithCircuitBreaker(tasks, registry, 5);

      // First 5 fail normally, remaining 5 are skipped
      const skipped = results.filter(r => r.error?.includes('Circuit breaker'));
      expect(skipped).toHaveLength(5);
    });

    it('should give skipped tasks zero duration', async () => {
      const tasks = makeFailingTasks(10);
      const { results } = await simulateWithCircuitBreaker(tasks, registry, 5);

      const skipped = results.slice(5);
      skipped.forEach(r => {
        expect(r.durationMs).toBe(0);
      });
    });

    it('should not trip with threshold higher than failure count', async () => {
      const tasks = makeFailingTasks(4);
      const { circuitBreaker } = await simulateWithCircuitBreaker(tasks, registry, 5);

      expect(circuitBreaker.tripped).toBe(false);
      expect(circuitBreaker.maxConsecutive).toBe(4);
    });

    it('should reset consecutive count on success', async () => {
      const tasks: FailureTask[] = [
        { id: 'f1', title: 'Fail', agent: 'E', shouldFail: true },
        { id: 'f2', title: 'Fail', agent: 'M', shouldFail: true },
        { id: 's1', title: 'OK', agent: 'V', shouldFail: false },
        { id: 'f3', title: 'Fail', agent: 'E', shouldFail: true },
      ];
      const { circuitBreaker } = await simulateWithCircuitBreaker(tasks, registry, 5);

      expect(circuitBreaker.consecutiveFailures).toBe(1);
      expect(circuitBreaker.maxConsecutive).toBe(2);
      expect(circuitBreaker.tripped).toBe(false);
    });
  });

  describe('Error hook resilience under rapid failures', () => {
    it('should survive when error hooks throw during rapid failures', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.register({
        phase: 'onTaskError',
        moduleName: 'crashing-handler',
        priority: 10,
        handler: async () => { throw new Error('Error handler crashed'); },
      });

      const tasks = makeFailingTasks(10);
      const { results } = await simulateWithCircuitBreaker(tasks, registry, 15);

      expect(results).toHaveLength(10);
      consoleSpy.mockRestore();
    });

    it('should run all error hooks even when one fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let healthyCount = 0;

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
        handler: async () => { healthyCount++; },
      });

      const tasks = makeFailingTasks(5);
      await simulateWithCircuitBreaker(tasks, registry, 10);

      expect(healthyCount).toBe(5);
      consoleSpy.mockRestore();
    });
  });

  describe('Build result accuracy', () => {
    it('should report correct failure count including skipped tasks', async () => {
      const tasks = makeFailingTasks(10);
      const { buildResult } = await simulateWithCircuitBreaker(tasks, registry, 5);

      expect(buildResult.totalTasks).toBe(10);
      expect(buildResult.failedTasks).toBe(10); // 5 failed + 5 skipped
      expect(buildResult.successfulTasks).toBe(0);
    });

    it('should always fire onBuildComplete even when all tasks fail', async () => {
      const completeFn = vi.fn();
      registry.register({
        phase: 'onBuildComplete',
        moduleName: 'tracker',
        priority: 50,
        handler: async () => { completeFn(); },
      });

      const tasks = makeFailingTasks(20);
      await simulateWithCircuitBreaker(tasks, registry, 25);

      expect(completeFn).toHaveBeenCalledTimes(1);
    });

    it('should report mixed results when success interrupts failures', async () => {
      const tasks: FailureTask[] = [
        ...makeFailingTasks(3),
        { id: 'ok-1', title: 'Success', agent: 'EARTH', shouldFail: false },
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `fail-late-${i}`,
          title: `Late Fail ${i}`,
          agent: 'MARS',
          shouldFail: true,
        })),
      ];
      const { buildResult } = await simulateWithCircuitBreaker(tasks, registry, 10);

      expect(buildResult.successfulTasks).toBe(1);
      expect(buildResult.failedTasks).toBe(6);
    });
  });

  describe('Circuit breaker threshold variations', () => {
    it('should trip at threshold of 3', async () => {
      const tasks = makeFailingTasks(10);
      const { circuitBreaker } = await simulateWithCircuitBreaker(tasks, registry, 3);

      expect(circuitBreaker.tripped).toBe(true);
      expect(circuitBreaker.consecutiveFailures).toBe(3);
    });

    it('should trip at threshold of 1', async () => {
      const tasks = makeFailingTasks(5);
      const { circuitBreaker, results } = await simulateWithCircuitBreaker(tasks, registry, 1);

      expect(circuitBreaker.tripped).toBe(true);
      // First task fails and trips, rest are skipped
      const skipped = results.filter(r => r.error?.includes('Circuit breaker'));
      expect(skipped).toHaveLength(4);
    });

    it('should not trip at threshold of 10 with only 5 failures', async () => {
      const tasks = makeFailingTasks(5);
      const { circuitBreaker } = await simulateWithCircuitBreaker(tasks, registry, 10);

      expect(circuitBreaker.tripped).toBe(false);
    });
  });

  describe('Error context under stress', () => {
    it('should include distinct error messages for each failure', async () => {
      const errors: string[] = [];
      registry.register({
        phase: 'onTaskError',
        moduleName: 'logger',
        priority: 50,
        handler: async (ctx) => {
          const err = (ctx as TaskResult).error;
          if (err) errors.push(err);
        },
      });

      const tasks = makeFailingTasks(10);
      await simulateWithCircuitBreaker(tasks, registry, 15);

      expect(errors).toHaveLength(10);
      const uniqueErrors = new Set(errors);
      expect(uniqueErrors.size).toBe(10);
    });

    it('should preserve agent names in error results', async () => {
      const tasks = makeFailingTasks(6); // cycles through EARTH, MARS, VENUS
      const { results } = await simulateWithCircuitBreaker(tasks, registry, 10);

      expect(results[0].agentName).toBe('EARTH');
      expect(results[1].agentName).toBe('MARS');
      expect(results[2].agentName).toBe('VENUS');
      expect(results[3].agentName).toBe('EARTH');
    });

    it('should track duration even for failed tasks', async () => {
      const tasks = makeFailingTasks(5);
      const { results } = await simulateWithCircuitBreaker(tasks, registry, 10);

      results.forEach(r => {
        expect(r.durationMs).toBeGreaterThan(0);
      });
    });
  });
});
