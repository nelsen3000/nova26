// MEGA-01: Swarm Mode Engine Tests
// Comprehensive test suite for the multi-agent collaboration engine

import { describe, it, expect, vi } from 'vitest';
import {
  SwarmOrchestrator,
  runSwarm,
  formatSwarmReport,
  type SwarmResult,
} from './swarm-mode.js';
import type { PRD, Task, LLMResponse } from '../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function createMockLLMCaller(
  responseGenerator?: (task: Task) => LLMResponse
) {
  return vi.fn(async (_systemPrompt: string, userPrompt: string, agentName?: string): Promise<LLMResponse> => {
    // Extract task ID from user prompt if available
    const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
    const taskId = taskIdMatch?.[1] || 'unknown';

    if (responseGenerator) {
      // Create a minimal task object for the generator
      const mockTask: Task = {
        id: taskId,
        title: 'Mock Task',
        description: userPrompt,
        agent: agentName || 'MARS',
        status: 'running',
        dependencies: [],
        phase: 0,
        attempts: 0,
        createdAt: new Date().toISOString(),
      };
      return responseGenerator(mockTask);
    }

    return {
      content: `Mock output for ${taskId} by ${agentName}`,
      model: 'mock',
      duration: 50,
      tokens: 100,
      fromCache: false,
    };
  });
}

function createTestPRD(tasks: Partial<Task>[] = []): PRD {
  const now = new Date().toISOString();

  return {
    meta: {
      name: 'Test Project',
      version: '1.0.0',
      createdAt: now,
    },
    tasks: tasks.map((t, i) => ({
      id: t.id || `task-${i.toString().padStart(3, '0')}`,
      title: t.title || `Task ${i}`,
      description: t.description || 'Test description',
      agent: t.agent || 'MARS',
      status: t.status || 'pending',
      dependencies: t.dependencies || [],
      phase: t.phase ?? 0,
      attempts: t.attempts ?? 0,
      createdAt: t.createdAt || now,
      ...t,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SwarmOrchestrator Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('SwarmOrchestrator', () => {
  describe('initialization', () => {
    it('initializes with a PRD and options', () => {
      const prd = createTestPRD([{ id: 't1', title: 'Test Task' }]);
      const orchestrator = new SwarmOrchestrator(prd);

      expect(orchestrator.getSessionId()).toMatch(/^swarm-\d+-/);
      expect(orchestrator.getContext().prd.tasks).toHaveLength(1);
    });

    it('applies default options correctly', () => {
      const prd = createTestPRD();
      const orchestrator = new SwarmOrchestrator(prd);

      // Run with mock to verify defaults work
      const context = orchestrator.getContext();
      expect(context.sharedMemory).toBeInstanceOf(Map);
      expect(context.channel).toEqual([]);
      expect(context.results).toBeInstanceOf(Map);
    });

    it('accepts custom options', () => {
      const prd = createTestPRD();
      const mockLLM = createMockLLMCaller();

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 2,
        timeoutPerAgent: 5000,
        continueOnFailure: false,
        llmCaller: mockLLM,
      });

      expect(orchestrator.getSessionId()).toBeDefined();
    });
  });

  describe('parallel execution', () => {
    it('executes independent tasks in parallel', async () => {
      const executionOrder: string[] = [];
      const mockLLM = createMockLLMCaller(() => ({
        content: 'done',
        model: 'mock',
        duration: 10,
        tokens: 50,
      }));

      // Track when each task starts
      const trackedMockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string, agentName?: string) => {
        const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
        const taskId = taskIdMatch?.[1] || 'unknown';
        executionOrder.push(`start:${taskId}`);
        const result = await mockLLM(_systemPrompt, userPrompt, agentName);
        executionOrder.push(`end:${taskId}`);
        return result;
      });

      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
        { id: 't2', dependencies: [] },
        { id: 't3', dependencies: [] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 3,
        llmCaller: trackedMockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.done).toBe(3);
      expect(result.summary.total).toBe(3);

      // All tasks should start before any end (parallel execution)
      const startIndices = executionOrder
        .map((e, i) => ({ e, i }))
        .filter(x => x.e.startsWith('start:'))
        .map(x => x.i);
      const endIndices = executionOrder
        .map((e, i) => ({ e, i }))
        .filter(x => x.e.startsWith('end:'))
        .map(x => x.i);

      // Max start index should be less than min end index for true parallel
      expect(Math.max(...startIndices)).toBeLessThan(Math.min(...endIndices));
    });

    it('respects maxConcurrency limit', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const mockLLM = vi.fn(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(r => setTimeout(r, 50));
        concurrentCount--;
        return {
          content: 'done',
          model: 'mock',
          duration: 50,
          tokens: 100,
        };
      });

      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
        { id: 't2', dependencies: [] },
        { id: 't3', dependencies: [] },
        { id: 't4', dependencies: [] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 2,
        llmCaller: mockLLM,
      });

      await orchestrator.run();

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('dependency scheduling', () => {
    it('executes tasks in dependency order', async () => {
      const executionOrder: string[] = [];
      const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string) => {
        const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
        const taskId = taskIdMatch?.[1] || 'unknown';
        executionOrder.push(taskId);
        return {
          content: `output-${taskId}`,
          model: 'mock',
          duration: 10,
          tokens: 50,
        };
      });

      const prd = createTestPRD([
        { id: 't1', dependencies: [], phase: 0 },
        { id: 't2', dependencies: ['t1'], phase: 1 },
        { id: 't3', dependencies: ['t2'], phase: 2 },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 3,
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.done).toBe(3);
      // t1 must come before t2, t2 before t3
      const t1Index = executionOrder.indexOf('t1');
      const t2Index = executionOrder.indexOf('t2');
      const t3Index = executionOrder.indexOf('t3');
      expect(t1Index).toBeLessThan(t2Index);
      expect(t2Index).toBeLessThan(t3Index);
    });

    it('executes parallel branches correctly', async () => {
      const executionOrder: string[] = [];
      const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string) => {
        const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
        const taskId = taskIdMatch?.[1] || 'unknown';
        executionOrder.push(taskId);
        return {
          content: `output-${taskId}`,
          model: 'mock',
          duration: 10,
          tokens: 50,
        };
      });

      // Diamond dependency pattern:
      //     t1
      //    /  \
      //   t2  t3
      //    \  /
      //     t4
      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
        { id: 't2', dependencies: ['t1'] },
        { id: 't3', dependencies: ['t1'] },
        { id: 't4', dependencies: ['t2', 't3'] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 4,
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.done).toBe(4);

      const t1Index = executionOrder.indexOf('t1');
      const t2Index = executionOrder.indexOf('t2');
      const t3Index = executionOrder.indexOf('t3');
      const t4Index = executionOrder.indexOf('t4');

      expect(t1Index).toBeLessThan(t2Index);
      expect(t1Index).toBeLessThan(t3Index);
      expect(t2Index).toBeLessThan(t4Index);
      expect(t3Index).toBeLessThan(t4Index);
    });

    it('handles complex dependency chains', async () => {
      const mockLLM = createMockLLMCaller();

      const prd = createTestPRD([
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
        { id: 'c', dependencies: ['a'] },
        { id: 'd', dependencies: ['b', 'c'] },
        { id: 'e', dependencies: ['c'] },
        { id: 'f', dependencies: ['d', 'e'] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 6,
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.done).toBe(6);
      expect(result.summary.failed).toBe(0);
    });
  });

  describe('error isolation', () => {
    it('continues execution when one agent fails (continueOnFailure: true)', async () => {
      const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string) => {
        const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
        const taskId = taskIdMatch?.[1] || 'unknown';

        if (taskId === 't2') {
          throw new Error('Simulated agent failure');
        }

        return {
          content: `output-${taskId}`,
          model: 'mock',
          duration: 10,
          tokens: 50,
        };
      });

      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
        { id: 't2', dependencies: [] },
        { id: 't3', dependencies: [] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 3,
        continueOnFailure: true,
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.done).toBe(2);
      expect(result.summary.failed).toBe(1);

      const t2Result = result.agentResults.find(r => r.taskId === 't2');
      expect(t2Result?.status).toBe('failed');
      expect(t2Result?.error).toBe('Simulated agent failure');
    });

    it('stops execution on failure when continueOnFailure is false', async () => {
      const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string) => {
        const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
        const taskId = taskIdMatch?.[1] || 'unknown';

        if (taskId === 't1') {
          throw new Error('Critical failure');
        }

        return {
          content: `output-${taskId}`,
          model: 'mock',
          duration: 10,
          tokens: 50,
        };
      });

      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
        { id: 't2', dependencies: ['t1'] },
        { id: 't3', dependencies: [] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 3,
        continueOnFailure: false,
        llmCaller: mockLLM,
      });

      // Should throw or handle the error gracefully
      await expect(orchestrator.run()).rejects.toThrow('Critical failure');
    });

    it('allows dependent tasks to run when dependency fails with continueOnFailure', async () => {
      const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string) => {
        const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
        const taskId = taskIdMatch?.[1] || 'unknown';

        if (taskId === 't1') {
          throw new Error('Dependency failed');
        }

        return {
          content: `output-${taskId}`,
          model: 'mock',
          duration: 10,
          tokens: 50,
        };
      });

      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
        { id: 't2', dependencies: ['t1'] },
        { id: 't3', dependencies: [] }, // Independent task
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 3,
        continueOnFailure: true,
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      // With continueOnFailure=true, t3 completes (independent), t1 fails, t2 still runs (dependency satisfied via continueOnFailure)
      expect(result.summary.done).toBe(2); // t2 and t3 complete
      expect(result.summary.failed).toBe(1); // t1 fails

      const t2Result = result.agentResults.find(r => r.taskId === 't2');
      expect(t2Result?.status).toBe('done'); // t2 runs because continueOnFailure treats failed deps as satisfied
    });

    it('handles multiple agent failures gracefully', async () => {
      const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string) => {
        const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
        const taskId = taskIdMatch?.[1] || 'unknown';

        if (taskId === 't1' || taskId === 't3') {
          throw new Error(`Failure in ${taskId}`);
        }

        return {
          content: `output-${taskId}`,
          model: 'mock',
          duration: 10,
          tokens: 50,
        };
      });

      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
        { id: 't2', dependencies: [] },
        { id: 't3', dependencies: [] },
        { id: 't4', dependencies: [] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 4,
        continueOnFailure: true,
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.done).toBe(2);
      expect(result.summary.failed).toBe(2);
    });
  });

  describe('message passing', () => {
    it('posts messages to the channel', async () => {
      const mockLLM = createMockLLMCaller();
      const prd = createTestPRD([
        { id: 't1', agent: 'EARTH' },
        { id: 't2', agent: 'MARS' },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.messages.length).toBeGreaterThan(0);

      // Should have orchestrator start message
      const startMsg = result.messages.find(m => m.type === 'inform' && m.from === 'ORCHESTRATOR');
      expect(startMsg).toBeDefined();

      // Should have completion message
      const completeMsg = result.messages.find(m => m.type === 'complete' && m.from === 'ORCHESTRATOR');
      expect(completeMsg).toBeDefined();
    });

    it('includes handoff messages for task delegation', async () => {
      const mockLLM = createMockLLMCaller();
      const prd = createTestPRD([
        { id: 't1', agent: 'EARTH' },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      const handoffMsg = result.messages.find(m => m.type === 'handoff');
      expect(handoffMsg).toBeDefined();
      expect(handoffMsg?.to).toBe('EARTH');
      expect(handoffMsg?.content).toContain('t1');
    });

    it('broadcasts completion messages to all', async () => {
      const mockLLM = createMockLLMCaller();
      const prd = createTestPRD([
        { id: 't1', agent: 'EARTH' },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      const agentCompleteMsg = result.messages.find(
        m => m.type === 'complete' && m.from === 'EARTH'
      );
      expect(agentCompleteMsg).toBeDefined();
      expect(agentCompleteMsg?.to).toBe('*');
    });
  });

  describe('timeout handling', () => {
    it('times out slow agents', async () => {
      const mockLLM = vi.fn(async () => {
        // Simulate slow response that exceeds timeout
        await new Promise(r => setTimeout(r, 200));
        return {
          content: 'slow output',
          model: 'mock',
          duration: 200,
          tokens: 50,
        };
      });

      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        timeoutPerAgent: 50, // Very short timeout
        llmCaller: mockLLM,
        continueOnFailure: true,
      });

      const result = await orchestrator.run();

      expect(result.summary.failed).toBe(1);

      const t1Result = result.agentResults.find(r => r.taskId === 't1');
      expect(t1Result?.error).toContain('timeout');
    });

    it('completes fast agents before timeout', async () => {
      const mockLLM = vi.fn(async () => {
        return {
          content: 'fast output',
          model: 'mock',
          duration: 10,
          tokens: 50,
        };
      });

      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        timeoutPerAgent: 5000, // Long timeout
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.done).toBe(1);
      expect(result.summary.failed).toBe(0);
    });
  });

  describe('result aggregation', () => {
    it('aggregates results from all agents', async () => {
      const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string) => {
        const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
        const taskId = taskIdMatch?.[1] || 'unknown';

        return {
          content: `output-for-${taskId}`,
          model: 'mock',
          duration: 10 + (taskId.charCodeAt(0) % 10), // Vary duration
          tokens: 50 + (taskId.charCodeAt(0) % 50), // Vary tokens
        };
      });

      const prd = createTestPRD([
        { id: 't1', agent: 'EARTH' },
        { id: 't2', agent: 'MARS' },
        { id: 't3', agent: 'VENUS' },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 3,
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.agentResults).toHaveLength(3);
      expect(result.summary.total).toBe(3);
      expect(result.summary.done).toBe(3);

      // Verify each result has the expected structure
      for (const agentResult of result.agentResults) {
        expect(agentResult.agent).toBeDefined();
        expect(agentResult.taskId).toBeDefined();
        expect(agentResult.status).toBe('done');
        expect(agentResult.output).toContain('output-for-');
        expect(agentResult.tokens).toBeGreaterThan(0);
        expect(agentResult.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('tracks total duration correctly', async () => {
      const mockLLM = createMockLLMCaller();
      const prd = createTestPRD([
        { id: 't1', dependencies: [] },
        { id: 't2', dependencies: [] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.sessionId).toMatch(/^swarm-/);
    });

    it('updates shared memory with agent outputs', async () => {
      const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string) => {
        const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
        const taskId = taskIdMatch?.[1] || 'unknown';

        return {
          content: `shared-memory-value-${taskId}`,
          model: 'mock',
          duration: 10,
          tokens: 50,
        };
      });

      const prd = createTestPRD([
        { id: 't1', agent: 'EARTH' },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        llmCaller: mockLLM,
      });

      await orchestrator.run();
      const context = orchestrator.getContext();

      expect(context.sharedMemory.get('t1')).toBe('shared-memory-value-t1');
    });
  });

  describe('edge cases', () => {
    it('handles empty PRD', async () => {
      const mockLLM = createMockLLMCaller();
      const prd = createTestPRD([]);

      const orchestrator = new SwarmOrchestrator(prd, {
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.total).toBe(0);
      expect(result.summary.done).toBe(0);
    });

    it('handles single task PRD', async () => {
      const mockLLM = createMockLLMCaller();
      const prd = createTestPRD([{ id: 'solo', agent: 'SUN' }]);

      const orchestrator = new SwarmOrchestrator(prd, {
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.total).toBe(1);
      expect(result.summary.done).toBe(1);

      const soloResult = result.agentResults.find(r => r.taskId === 'solo');
      expect(soloResult?.agent).toBe('SUN');
    });

    it('detects deadlock with circular dependencies', async () => {
      const mockLLM = createMockLLMCaller();
      const prd = createTestPRD([
        { id: 'a', dependencies: ['b'] },
        { id: 'b', dependencies: ['a'] },
      ]);

      const orchestrator = new SwarmOrchestrator(prd, {
        llmCaller: mockLLM,
        continueOnFailure: true,
      });

      const result = await orchestrator.run();

      // Both should be marked as failed/skipped due to deadlock
      expect(result.summary.total).toBe(2);
      expect(result.summary.done).toBe(0);
    });

    it('handles very long dependency chains', async () => {
      const mockLLM = createMockLLMCaller();

      // Create a chain of 10 tasks
      const tasks: Partial<Task>[] = [];
      for (let i = 0; i < 10; i++) {
        tasks.push({
          id: `chain-${i}`,
          dependencies: i === 0 ? [] : [`chain-${i - 1}`],
        });
      }

      const prd = createTestPRD(tasks);

      const orchestrator = new SwarmOrchestrator(prd, {
        maxConcurrency: 10,
        llmCaller: mockLLM,
      });

      const result = await orchestrator.run();

      expect(result.summary.total).toBe(10);
      expect(result.summary.done).toBe(10);
    });
  });

  describe('getContext', () => {
    it('returns a copy of the context, not a reference', async () => {
      const mockLLM = createMockLLMCaller();
      const prd = createTestPRD([{ id: 't1' }]);

      const orchestrator = new SwarmOrchestrator(prd, {
        llmCaller: mockLLM,
      });

      const context1 = orchestrator.getContext();
      await orchestrator.run();
      const context2 = orchestrator.getContext();

      // Before run(), context has empty results (tasks initialized during run())
      expect(context1.results.size).toBe(0);
      
      // After run(), context2 has the completed results
      expect(context2.results.size).toBe(1);
      expect(context2.results.get('t1')?.status).toBe('done');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Convenience Functions Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('runSwarm', () => {
  it('is a convenience wrapper for SwarmOrchestrator', async () => {
    const mockLLM = createMockLLMCaller();
    const prd = createTestPRD([
      { id: 't1', agent: 'MARS' },
    ]);

    const result = await runSwarm(prd, {
      llmCaller: mockLLM,
    });

    expect(result.summary.total).toBe(1);
    expect(result.summary.done).toBe(1);
  });

  it('passes options through to the orchestrator', async () => {
    const mockLLM = createMockLLMCaller();
    const prd = createTestPRD([
      { id: 't1' },
      { id: 't2' },
    ]);

    const result = await runSwarm(prd, {
      maxConcurrency: 1,
      llmCaller: mockLLM,
    });

    expect(result.summary.done).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// formatSwarmReport Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatSwarmReport', () => {
  it('formats a successful result', () => {
    const result: SwarmResult = {
      sessionId: 'swarm-test-123',
      totalDuration: 5000,
      agentResults: [
        {
          agent: 'EARTH',
          taskId: 't1',
          status: 'done',
          output: 'Data model complete',
          tokens: 150,
          duration: 1200,
        },
        {
          agent: 'MARS',
          taskId: 't2',
          status: 'done',
          output: 'Tests passing',
          tokens: 200,
          duration: 1500,
        },
      ],
      messages: [
        {
          id: 'msg-1',
          from: 'ORCHESTRATOR',
          to: '*',
          type: 'inform',
          content: 'Swarm started',
          timestamp: new Date().toISOString(),
        },
      ],
      summary: {
        total: 2,
        done: 2,
        failed: 0,
        skipped: 0,
      },
    };

    const report = formatSwarmReport(result);

    expect(report).toContain('SWARM EXECUTION REPORT');
    expect(report).toContain('swarm-test-123');
    expect(report).toContain('5.00s');
    expect(report).toContain('Total Tasks:');
    expect(report).toContain('Done:');
    expect(report).toContain('EARTH');
    expect(report).toContain('MARS');
    expect(report).toContain('All tasks completed successfully');
  });

  it('formats a result with failures', () => {
    const result: SwarmResult = {
      sessionId: 'swarm-test-456',
      totalDuration: 3000,
      agentResults: [
        {
          agent: 'EARTH',
          taskId: 't1',
          status: 'done',
          output: 'Complete',
          tokens: 100,
          duration: 800,
        },
        {
          agent: 'PLUTO',
          taskId: 't2',
          status: 'failed',
          output: '',
          tokens: 0,
          duration: 500,
          error: 'Database connection failed',
        },
      ],
      messages: [],
      summary: {
        total: 2,
        done: 1,
        failed: 1,
        skipped: 0,
      },
    };

    const report = formatSwarmReport(result);

    expect(report).toContain('PLUTO');
    expect(report).toContain('Database connection failed');
    expect(report).toContain('Partial success');
  });

  it('formats a result with skipped tasks', () => {
    const result: SwarmResult = {
      sessionId: 'swarm-test-789',
      totalDuration: 2000,
      agentResults: [
        {
          agent: 'EARTH',
          taskId: 't1',
          status: 'failed',
          output: '',
          tokens: 0,
          duration: 100,
          error: 'Failed',
        },
        {
          agent: 'PLUTO',
          taskId: 't2',
          status: 'skipped',
          output: '',
          tokens: 0,
          duration: 0,
          error: 'Skipped due to failed dependencies',
        },
      ],
      messages: [],
      summary: {
        total: 2,
        done: 0,
        failed: 1,
        skipped: 1,
      },
    };

    const report = formatSwarmReport(result);

    expect(report).toContain('Skipped');
  });

  it('handles empty results gracefully', () => {
    const result: SwarmResult = {
      sessionId: 'swarm-empty',
      totalDuration: 0,
      agentResults: [],
      messages: [],
      summary: {
        total: 0,
        done: 0,
        failed: 0,
        skipped: 0,
      },
    };

    const report = formatSwarmReport(result);

    expect(report).toContain('SWARM EXECUTION REPORT');
    expect(report).toContain('swarm-empty');
  });

  it('truncates long content in messages', () => {
    const result: SwarmResult = {
      sessionId: 'swarm-test',
      totalDuration: 1000,
      agentResults: [],
      messages: [
        {
          id: 'msg-1',
          from: 'ORCHESTRATOR',
          to: '*',
          type: 'inform',
          content: 'A'.repeat(100), // Very long content
          timestamp: new Date().toISOString(),
        },
      ],
      summary: {
        total: 0,
        done: 0,
        failed: 0,
        skipped: 0,
      },
    };

    const report = formatSwarmReport(result);

    // Should show the message section but truncated
    expect(report).toContain('RECENT MESSAGES');
    expect(report.length).toBeLessThan(2000); // Should be reasonably sized
  });

  it('shows success rate for partial completions', () => {
    const result: SwarmResult = {
      sessionId: 'swarm-test',
      totalDuration: 4000,
      agentResults: [
        { agent: 'A1', taskId: 't1', status: 'done', output: '', tokens: 10, duration: 100 },
        { agent: 'A2', taskId: 't2', status: 'done', output: '', tokens: 10, duration: 100 },
        { agent: 'A3', taskId: 't3', status: 'failed', output: '', tokens: 0, duration: 50, error: 'fail' },
        { agent: 'A4', taskId: 't4', status: 'failed', output: '', tokens: 0, duration: 50, error: 'fail' },
      ],
      messages: [],
      summary: {
        total: 4,
        done: 2,
        failed: 2,
        skipped: 0,
      },
    };

    const report = formatSwarmReport(result);

    expect(report).toContain('50.0%');
    expect(report).toContain('Partial success');
  });

  it('shows failure message when all tasks fail', () => {
    const result: SwarmResult = {
      sessionId: 'swarm-test',
      totalDuration: 1000,
      agentResults: [
        { agent: 'A1', taskId: 't1', status: 'failed', output: '', tokens: 0, duration: 100, error: 'fail' },
      ],
      messages: [],
      summary: {
        total: 1,
        done: 0,
        failed: 1,
        skipped: 0,
      },
    };

    const report = formatSwarmReport(result);

    expect(report).toContain('All tasks failed or were skipped');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: Full Swarm Workflows', () => {
  it('executes a realistic multi-phase workflow', async () => {
    const sharedOutputs: Record<string, string> = {};

    const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string, _agentName?: string) => {
      const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
      const taskId = taskIdMatch?.[1] || 'unknown';

      // Simulate realistic workflow outputs
      const output = `[${_agentName}] Completed ${taskId}`;
      sharedOutputs[taskId] = output;

      return {
        content: output,
        model: 'mock',
        duration: 50,
        tokens: 100,
      };
    });

    // Simulate a real project workflow
    const prd = createTestPRD([
      // Phase 0: Planning (parallel)
      { id: 'earth-specs', agent: 'EARTH', dependencies: [], phase: 0 },
      { id: 'jupiter-arch', agent: 'JUPITER', dependencies: [], phase: 0 },

      // Phase 1: Schema (depends on specs)
      { id: 'pluto-schema', agent: 'PLUTO', dependencies: ['earth-specs'], phase: 1 },

      // Phase 2: Implementation (depends on schema and arch)
      { id: 'venus-api', agent: 'VENUS', dependencies: ['pluto-schema', 'jupiter-arch'], phase: 2 },
      { id: 'mars-backend', agent: 'MARS', dependencies: ['pluto-schema'], phase: 2 },

      // Phase 3: Validation (depends on implementation)
      { id: 'mercury-tests', agent: 'MERCURY', dependencies: ['venus-api', 'mars-backend'], phase: 3 },
    ]);

    const orchestrator = new SwarmOrchestrator(prd, {
      maxConcurrency: 4,
      llmCaller: mockLLM,
    });

    const result = await orchestrator.run();

    expect(result.summary.total).toBe(6); // 6 tasks in the test PRD
    expect(result.summary.done).toBe(6);
    expect(result.summary.failed).toBe(0);

    // Verify all agents participated
    const agents = new Set(result.agentResults.map(r => r.agent));
    expect(agents).toContain('EARTH');
    expect(agents).toContain('JUPITER');
    expect(agents).toContain('PLUTO');
    expect(agents).toContain('VENUS');
    expect(agents).toContain('MARS');
    expect(agents).toContain('MERCURY');
  });

  it('handles mixed success/failure in complex workflow', async () => {
    const mockLLM = vi.fn(async (_systemPrompt: string, userPrompt: string, _agentName?: string) => {
      const taskIdMatch = userPrompt.match(/Task ID: (\S+)/);
      const taskId = taskIdMatch?.[1] || 'unknown';

      // Simulate PLUTO failing
      if (taskId === 'pluto-schema') {
        throw new Error('Schema validation failed');
      }

      return {
        content: `Output for ${taskId}`,
        model: 'mock',
        duration: 50,
        tokens: 100,
      };
    });

    const prd = createTestPRD([
      { id: 'earth-specs', agent: 'EARTH', dependencies: [] },
      { id: 'pluto-schema', agent: 'PLUTO', dependencies: ['earth-specs'] },
      { id: 'venus-api', agent: 'VENUS', dependencies: ['pluto-schema'] },
      { id: 'mercury-tests', agent: 'MERCURY', dependencies: ['venus-api'] },
    ]);

    const orchestrator = new SwarmOrchestrator(prd, {
      maxConcurrency: 4,
      llmCaller: mockLLM,
      continueOnFailure: true,
    });

    const result = await orchestrator.run();

    expect(result.summary.total).toBe(4);
    // With continueOnFailure=true, dependent tasks still run after pluto-schema fails
    expect(result.summary.done).toBe(3); // earth-specs, venus-api, mercury-tests all complete
    expect(result.summary.failed).toBe(1); // pluto-schema
    expect(result.summary.skipped).toBe(0); // Nothing skipped with continueOnFailure
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy Compatibility Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Legacy Compatibility', () => {
  it('exports swarmAgents array', async () => {
    // Import the legacy exports dynamically
    const mod = await import('./swarm-mode.js');
    const swarmAgents = mod.swarmAgents;

    expect(Array.isArray(swarmAgents)).toBe(true);
    expect(swarmAgents.length).toBeGreaterThan(0);
    expect(swarmAgents[0]).toHaveProperty('name');
    expect(swarmAgents[0]).toHaveProperty('emoji');
    expect(swarmAgents[0]).toHaveProperty('swarmRole');
  });

  it('executeSwarmMode logs to console', async () => {
    // Import the legacy exports dynamically
    const mod = await import('./swarm-mode.js');
    const executeSwarmMode = mod.executeSwarmMode;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Use a shorter timeout since this is just testing console output
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 100);
    });
    
    const execPromise = executeSwarmMode({
      id: 'test',
      description: 'Test task',
      complexity: 'simple',
      requiredAgents: ['SUN', 'MARS'],
      deliverables: ['code'],
    });

    // Either complete or timeout is fine for this test
    try {
      await Promise.race([execPromise, timeoutPromise]);
    } catch {
      // Timeout is expected due to mock delays
    }

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SWARM MODE ACTIVATED'));
    consoleSpy.mockRestore();
  }, 1000);
});
