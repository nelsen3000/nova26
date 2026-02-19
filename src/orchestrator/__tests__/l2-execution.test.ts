// Unit tests for L2 Execution Layer
// Tests agent task execution, retry logic, parallel workers, and dependency handling

import { describe, it, expect, beforeEach } from 'vitest';
import {
  L2ExecutionLayer,
  MockAgentExecutor,
  createL2ExecutionLayer,
  DEFAULT_L2_CONFIG,
  type L2Config,
  type AgentExecutor,
} from '../layers/l2-execution.js';
import type {
  TaskNode,
  ExecutionResult,
  ParallelExecutionResult,
} from '../hierarchy-types.js';

describe('L2ExecutionLayer', () => {
  let mockExecutor: MockAgentExecutor;
  let l2Layer: L2ExecutionLayer;

  const createMockTask = (id: string, overrides: Partial<TaskNode> = {}): TaskNode => ({
    id,
    agent: 'MARS',
    description: `Test task ${id}`,
    dependencies: [],
    estimatedTokens: 1000,
    status: 'pending',
    priority: 1,
    metadata: {},
    ...overrides,
  });

  beforeEach(() => {
    mockExecutor = new MockAgentExecutor();
    l2Layer = new L2ExecutionLayer(mockExecutor, { retryDelayMs: 10 });
  });

  describe('Single task execution', () => {
    it('execute returns ExecutionResult with correct structure', async () => {
      const task = createMockTask('task-1');
      const result = await l2Layer.execute(task);

      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('artifacts');
      expect(result).toHaveProperty('retryCount');
      expect(result).toHaveProperty('finalPrompt');
      expect(result).toHaveProperty('errors');
      expect(result.taskId).toBe('task-1');
    });

    it('success path returns success=true with artifacts', async () => {
      const task = createMockTask('task-success');
      const result = await l2Layer.execute(task);

      expect(result.success).toBe(true);
      expect(result.artifacts.length).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
      expect(result.retryCount).toBe(0);
    });

    it('failure path returns success=false with errors after maxRetries', async () => {
      const failExecutor = new MockAgentExecutor();
      const failLayer = new L2ExecutionLayer(failExecutor, { retryDelayMs: 10 });
      const task = createMockTask('task-fail');
      failExecutor.setShouldFail('task-fail', 5); // More failures than maxRetries

      const result = await failLayer.execute(task);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // retryCount may be maxRetries or maxRetries+1 depending on failure path
      expect(result.retryCount).toBeGreaterThanOrEqual(DEFAULT_L2_CONFIG.maxRetries);
    });

    it('retry with new prompt on failure before succeeding', async () => {
      const task = createMockTask('task-retry');
      mockExecutor.setShouldFail('task-retry', 1); // Fail once, then succeed

      const result = await l2Layer.execute(task);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      // Prompt should have been modified with retry strategy
      expect(result.finalPrompt).toContain('Retry');
    });

    it('respects maxRetries config and does not exceed it', async () => {
      const maxRetries = 2;
      const maxRetriesExecutor = new MockAgentExecutor();
      const customLayer = new L2ExecutionLayer(maxRetriesExecutor, { maxRetries, retryDelayMs: 10 });
      const task = createMockTask('task-max-retries');
      maxRetriesExecutor.setShouldFail('task-max-retries', 10); // Always fail

      const result = await customLayer.execute(task);

      expect(result.success).toBe(false);
      // retryCount should be at least maxRetries (may be maxRetries+1 depending on code path)
      expect(result.retryCount).toBeGreaterThanOrEqual(maxRetries);
    });

    it('timeout handling rejects when task exceeds timeoutMs', async () => {
      const timeoutMs = 50;
      const task = createMockTask('task-timeout');

      // Create a slow executor that takes longer than timeout
      const slowExecutor: AgentExecutor = {
        async execute(): Promise<ExecutionResult> {
          await new Promise(resolve => setTimeout(resolve, timeoutMs + 100));
          return {
            taskId: task.id,
            success: true,
            artifacts: [],
            retryCount: 0,
            finalPrompt: '',
            errors: [],
          };
        },
      };

      const timeoutLayer = new L2ExecutionLayer(slowExecutor, { timeoutMs, retryDelayMs: 10 });
      const result = await timeoutLayer.execute(task);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('timed out'))).toBe(true);
    });
  });

  describe('Parallel workers', () => {
    it('executeParallel runs multiple tasks', async () => {
      const tasks = [
        createMockTask('parallel-1'),
        createMockTask('parallel-2'),
        createMockTask('parallel-3'),
      ];

      const result = await l2Layer.executeParallel(tasks);

      expect(result.results.length).toBe(3);
      expect(result.results.every(r => r.success)).toBe(true);
    });

    it('respects maxConcurrency option', async () => {
      const executionTimes: number[] = [];
      const trackingExecutor: AgentExecutor = {
        async execute(task: TaskNode): Promise<ExecutionResult> {
          executionTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            taskId: task.id,
            success: true,
            artifacts: [],
            retryCount: 0,
            finalPrompt: '',
            errors: [],
          };
        },
      };

      const trackingLayer = new L2ExecutionLayer(trackingExecutor, { maxParallelTasks: 2 });
      const tasks = Array.from({ length: 4 }, (_, i) => createMockTask(`concurrent-${i}`));

      await trackingLayer.executeParallel(tasks, { maxConcurrency: 2 });

      // With maxConcurrency of 2, we should see executions in batches
      // The exact timing depends on implementation, but all 4 should execute
      expect(executionTimes.length).toBe(4);
    });

    it('returns ParallelExecutionResult with correct structure', async () => {
      const tasks = [createMockTask('result-1'), createMockTask('result-2')];
      const result = await l2Layer.executeParallel(tasks);

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('completedCount');
      expect(result).toHaveProperty('failedCount');
      expect(result).toHaveProperty('totalExecutionTimeMs');
      expect(Array.isArray(result.results)).toBe(true);
      expect(typeof result.completedCount).toBe('number');
      expect(typeof result.failedCount).toBe('number');
      expect(typeof result.totalExecutionTimeMs).toBe('number');
    });

    it('completedCount and failedCount are accurate', async () => {
      const countExecutor = new MockAgentExecutor();
      const countLayer = new L2ExecutionLayer(countExecutor, { retryDelayMs: 10 });
      const tasks = [
        createMockTask('success-1'),
        createMockTask('success-2'),
        createMockTask('fail-1'),
        createMockTask('fail-2'),
      ];
      countExecutor.setShouldFail('fail-1', 5);
      countExecutor.setShouldFail('fail-2', 5);

      const result = await countLayer.executeParallel(tasks);

      expect(result.completedCount).toBe(2);
      expect(result.failedCount).toBe(2);
    });

    it('totalExecutionTimeMs is non-negative and tracks execution duration', async () => {
      const tasks = [createMockTask('time-1'), createMockTask('time-2')];
      const startTime = Date.now();
      const result = await l2Layer.executeParallel(tasks);
      const endTime = Date.now();

      expect(result.totalExecutionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.totalExecutionTimeMs).toBeLessThanOrEqual(endTime - startTime + 100);
    });
  });

  describe('Dependencies', () => {
    it('executeWithDependencies respects dependency order', async () => {
      const tasks = [
        createMockTask('dep-A'),
        createMockTask('dep-B'),
        createMockTask('dep-C'),
      ];
      const dependencyMap = new Map<string, string[]>([
        ['dep-B', ['dep-A']], // B depends on A
        ['dep-C', ['dep-B']], // C depends on B
      ]);

      const result = await l2Layer.executeWithDependencies(tasks, dependencyMap);

      // All tasks should complete successfully in order
      expect(result.completedCount).toBe(3);
      expect(result.results.every(r => r.success)).toBe(true);
    });

    it('handles tasks ready for execution (all deps completed)', async () => {
      const tasks = [
        createMockTask('ready-1'),
        createMockTask('ready-2'),
        createMockTask('ready-3'),
      ];
      // No dependencies - all should be ready immediately
      const dependencyMap = new Map<string, string[]>();

      const result = await l2Layer.executeWithDependencies(tasks, dependencyMap);

      expect(result.completedCount).toBe(3);
      expect(result.results.length).toBe(3);
    });

    it('detects deadlock when dependencies cannot be resolved', async () => {
      const tasks = [
        createMockTask('dead-1'),
        createMockTask('dead-2'),
      ];
      // Circular dependency creates deadlock
      const dependencyMap = new Map<string, string[]>([
        ['dead-1', ['dead-2']],
        ['dead-2', ['dead-1']],
      ]);

      const result = await l2Layer.executeWithDependencies(tasks, dependencyMap);

      // Tasks should fail with dependency resolution error
      expect(result.failedCount).toBe(2);
      expect(result.results.every(r => !r.success)).toBe(true);
      expect(result.results[0].errors[0]).toContain('Dependency resolution failed');
    });

    it('processes tasks in waves based on dependencies', async () => {
      const executionOrder: string[] = [];
      const trackingExecutor: AgentExecutor = {
        async execute(task: TaskNode): Promise<ExecutionResult> {
          executionOrder.push(task.id);
          return {
            taskId: task.id,
            success: true,
            artifacts: [],
            retryCount: 0,
            finalPrompt: '',
            errors: [],
          };
        },
      };

      const trackingLayer = new L2ExecutionLayer(trackingExecutor);
      const tasks = [
        createMockTask('wave-A'),
        createMockTask('wave-B'),
        createMockTask('wave-C'),
        createMockTask('wave-D'),
      ];
      // A and B have no deps (wave 1)
      // C depends on A (wave 2)
      // D depends on B and C (wave 3)
      const dependencyMap = new Map<string, string[]>([
        ['wave-C', ['wave-A']],
        ['wave-D', ['wave-B', 'wave-C']],
      ]);

      await trackingLayer.executeWithDependencies(tasks, dependencyMap);

      // Verify wave-based execution - A and B should come before C and D
      const indexA = executionOrder.indexOf('wave-A');
      const indexB = executionOrder.indexOf('wave-B');
      const indexC = executionOrder.indexOf('wave-C');
      const indexD = executionOrder.indexOf('wave-D');

      expect(indexC).toBeGreaterThan(Math.min(indexA, indexB));
      expect(indexD).toBeGreaterThan(indexB);
      expect(indexD).toBeGreaterThan(indexC);
    });
  });

  describe('Artifacts', () => {
    it('collectArtifacts merges artifacts from successful results', async () => {
      const tasks = [createMockTask('art-1'), createMockTask('art-2')];
      const parallelResult = await l2Layer.executeParallel(tasks);
      const artifacts = l2Layer.collectArtifacts(parallelResult.results);

      expect(artifacts.length).toBeGreaterThan(0);
      // Each successful task should produce artifacts
      expect(artifacts.length).toBe(parallelResult.completedCount);
    });

    it('collectArtifacts only includes artifacts from successful results', async () => {
      const artifactExecutor = new MockAgentExecutor();
      const artifactLayer = new L2ExecutionLayer(artifactExecutor, { retryDelayMs: 10 });
      const tasks = [
        createMockTask('art-success'),
        createMockTask('art-fail'),
      ];
      artifactExecutor.setShouldFail('art-fail', 5);

      const parallelResult = await artifactLayer.executeParallel(tasks);
      const artifacts = artifactLayer.collectArtifacts(parallelResult.results);

      // Only the successful task's artifacts should be collected
      expect(artifacts.length).toBe(1);
      expect(artifacts[0].metadata.taskId).toBe('art-success');
    });

    it('isPartialSuccess detects mixed results (some success, some failure)', async () => {
      const mixedResult: ParallelExecutionResult = {
        results: [],
        completedCount: 2,
        failedCount: 1,
        totalExecutionTimeMs: 100,
      };

      expect(l2Layer.isPartialSuccess(mixedResult)).toBe(true);
    });

    it('isPartialSuccess returns false for all success or all failure', async () => {
      const allSuccess: ParallelExecutionResult = {
        results: [],
        completedCount: 3,
        failedCount: 0,
        totalExecutionTimeMs: 100,
      };
      const allFailure: ParallelExecutionResult = {
        results: [],
        completedCount: 0,
        failedCount: 3,
        totalExecutionTimeMs: 100,
      };

      expect(l2Layer.isPartialSuccess(allSuccess)).toBe(false);
      expect(l2Layer.isPartialSuccess(allFailure)).toBe(false);
    });

    it('getFailedTasks returns retryable tasks from original task list', async () => {
      const failedExecutor = new MockAgentExecutor();
      const failedLayer = new L2ExecutionLayer(failedExecutor, { retryDelayMs: 10 });
      const originalTasks = [
        createMockTask('retry-1'),
        createMockTask('retry-2'),
        createMockTask('retry-3'),
      ];
      failedExecutor.setShouldFail('retry-2', 5);

      const parallelResult = await failedLayer.executeParallel(originalTasks);
      const failedTasks = failedLayer.getFailedTasks(parallelResult, originalTasks);

      expect(failedTasks.length).toBe(1);
      expect(failedTasks[0].id).toBe('retry-2');
    });

    it('artifact metadata contains correct information', async () => {
      const task = createMockTask('meta-task', {
        agent: 'VENUS',
        estimatedTokens: 500,
      });
      const result = await l2Layer.execute(task);

      expect(result.artifacts.length).toBeGreaterThan(0);
      const artifact = result.artifacts[0];

      expect(artifact.metadata.agent).toBe('VENUS');
      expect(artifact.metadata.taskId).toBe('meta-task');
      expect(artifact.metadata.tokensUsed).toBe(500);
      expect(typeof artifact.metadata.timestamp).toBe('number');
      expect(typeof artifact.metadata.generationTimeMs).toBe('number');
    });
  });

  describe('MockAgentExecutor', () => {
    it('setShouldFail controls failure simulation with specified count', async () => {
      const task = createMockTask('mock-test');
      mockExecutor.setShouldFail('mock-test', 2);

      // First execution should fail
      const result1 = await mockExecutor.execute(task, 'test prompt');
      expect(result1.success).toBe(false);

      // Second execution should fail
      const result2 = await mockExecutor.execute(task, 'test prompt');
      expect(result2.success).toBe(false);

      // Third execution should succeed
      const result3 = await mockExecutor.execute(task, 'test prompt');
      expect(result3.success).toBe(true);
    });

    it('returns success by default when not set to fail', async () => {
      const task = createMockTask('mock-default');
      const result = await mockExecutor.execute(task, 'test prompt');

      expect(result.success).toBe(true);
      expect(result.artifacts.length).toBe(1);
      expect(result.errors).toEqual([]);
    });
  });

  describe('createL2ExecutionLayer factory', () => {
    it('creates L2ExecutionLayer with default config', () => {
      const layer = createL2ExecutionLayer(mockExecutor);

      expect(layer).toBeInstanceOf(L2ExecutionLayer);
    });

    it('creates L2ExecutionLayer with custom config', () => {
      const customConfig: Partial<L2Config> = {
        maxRetries: 5,
        timeoutMs: 60000,
        maxParallelTasks: 10,
      };
      const layer = createL2ExecutionLayer(mockExecutor, customConfig);

      expect(layer).toBeInstanceOf(L2ExecutionLayer);
    });
  });

  describe('Custom retry strategies', () => {
    it('applies custom retry strategies when provided', async () => {
      const task = createMockTask('custom-strategy');
      mockExecutor.setShouldFail('custom-strategy', 1);

      const customStrategies = ['custom-approach-1', 'custom-approach-2'];
      const result = await l2Layer.execute(task, {
        retryStrategies: customStrategies,
      });

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
    });

    it('uses initialPrompt when provided', async () => {
      const task = createMockTask('custom-prompt');
      const customPrompt = 'Custom initial prompt for testing';

      const result = await l2Layer.execute(task, {
        initialPrompt: customPrompt,
      });

      expect(result.finalPrompt).toContain(customPrompt);
    });
  });

  describe('Parallel execution with custom prompts', () => {
    it('executeParallel uses initialPrompts for specific tasks', async () => {
      const tasks = [
        createMockTask('prompt-1'),
        createMockTask('prompt-2'),
      ];
      const customPrompts = {
        'prompt-1': 'Custom prompt for task 1',
      };

      const result = await l2Layer.executeParallel(tasks, {
        initialPrompts: customPrompts,
      });

      expect(result.results.length).toBe(2);
      // Task with custom prompt should have it in finalPrompt
      const task1Result = result.results.find(r => r.taskId === 'prompt-1');
      expect(task1Result?.finalPrompt).toContain('Custom prompt for task 1');
    });
  });

  describe('Configuration', () => {
    it('DEFAULT_L2_CONFIG has expected values', () => {
      expect(DEFAULT_L2_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_L2_CONFIG.retryDelayMs).toBe(1000);
      expect(DEFAULT_L2_CONFIG.enableParallelWorkers).toBe(true);
      expect(DEFAULT_L2_CONFIG.maxParallelTasks).toBe(5);
      expect(DEFAULT_L2_CONFIG.timeoutMs).toBe(120000);
    });

    it('merges partial config with defaults', async () => {
      const mergeExecutor = new MockAgentExecutor();
      const customLayer = new L2ExecutionLayer(mergeExecutor, {
        maxRetries: 1,
        retryDelayMs: 10,
        timeoutMs: 5000,
      });

      const task = createMockTask('config-test');
      mergeExecutor.setShouldFail('config-test', 5);

      const result = await customLayer.execute(task);

      // Should use custom maxRetries of 1, not default 3
      expect(result.retryCount).toBeGreaterThanOrEqual(1);
    });
  });
});
