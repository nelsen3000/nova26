// Agent Harness Engine Tests
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  AgentHarness,
  createAgentHarness,
  InvalidStateTransitionError,
  HarnessError,
} from './engine.js';
import type { HarnessConfig, HarnessStatus } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

function createTestConfig(overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  return {
    id: `test-harness-${Date.now()}`,
    name: 'Test Harness',
    agentId: 'test-agent',
    task: 'Test task',
    priority: 'normal',
    timeoutMs: 60000,
    maxRetries: 3,
    autonomyLevel: 3,
    maxDepth: 3,
    depth: 0,
    allowedTools: ['tool1', 'tool2'],
    budget: {
      maxToolCalls: 100,
      maxTokens: 10000,
      maxCost: 10,
    },
    checkpointIntervalMs: 300000,
    dreamModeEnabled: false,
    overnightEvolutionEnabled: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unit Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('AgentHarness', () => {
  describe('State Machine', () => {
    it('should start in created state', () => {
      const harness = createAgentHarness(createTestConfig());
      expect(harness.getState().status).toBe('created');
    });

    it('should transition created → starting → running', async () => {
      const harness = createAgentHarness(createTestConfig());
      
      const stateChanges: Array<{ from: string; to: string }> = [];
      harness.on('stateChange', ({ from, to }) => {
        stateChanges.push({ from, to });
      });

      await harness.start();
      
      expect(harness.getState().status).toBe('running');
      expect(stateChanges).toContainEqual({ from: 'created', to: 'starting' });
      expect(stateChanges).toContainEqual({ from: 'starting', to: 'running' });
    });

    it('should reject invalid transition created → completed', async () => {
      const harness = createAgentHarness(createTestConfig());
      
      await expect(harness.complete()).rejects.toThrow(InvalidStateTransitionError);
    });

    it('should reject invalid transition created → paused', async () => {
      const harness = createAgentHarness(createTestConfig());
      
      await expect(harness.pause()).rejects.toThrow(InvalidStateTransitionError);
    });

    it('should transition running → paused → running', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      await harness.pause();
      expect(harness.getState().status).toBe('paused');

      await harness.resume();
      expect(harness.getState().status).toBe('running');
    });

    it('should reject pause from non-running state', async () => {
      const harness = createAgentHarness(createTestConfig());
      
      await expect(harness.pause()).rejects.toThrow(InvalidStateTransitionError);
    });

    it('should reject resume from non-paused state', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();
      
      await expect(harness.resume()).rejects.toThrow(InvalidStateTransitionError);
    });

    it('should transition running → completed', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      const result = await harness.complete('Task done');
      
      expect(harness.getState().status).toBe('completed');
      expect(result.status).toBe('completed');
      expect(result.output).toBe('Task done');
    });

    it('should transition running → stopping → stopped', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      const result = await harness.stop('User requested');
      
      expect(harness.getState().status).toBe('stopped');
      expect(result.status).toBe('stopped');
    });

    it('should transition to failed on error', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      const error = new Error('Something went wrong');
      const result = await harness.fail(error);
      
      expect(harness.getState().status).toBe('failed');
      expect(result.status).toBe('failed');
      expect(result.error?.message).toBe('Something went wrong');
    });

    it('should not allow transitions from terminal states', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();
      await harness.complete();

      await expect(harness.pause()).rejects.toThrow(InvalidStateTransitionError);
      await expect(harness.stop()).rejects.toThrow(InvalidStateTransitionError);
    });
  });

  describe('Task Queue', () => {
    it('should enqueue tasks with priority', async () => {
      const harness = createAgentHarness(createTestConfig());
      const executed: string[] = [];

      // Start first, then enqueue to control execution order
      await harness.start();
      await harness.pause();

      harness.enqueueTask({
        id: 'low-priority',
        priority: 1,
        execute: async () => { executed.push('low'); },
      });

      harness.enqueueTask({
        id: 'high-priority',
        priority: 10,
        execute: async () => { executed.push('high'); },
      });

      harness.enqueueTask({
        id: 'medium-priority',
        priority: 5,
        execute: async () => { executed.push('medium'); },
      });

      // Resume to execute tasks
      await harness.resume();

      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Higher priority tasks should execute first
      expect(executed[0]).toBe('high');
      expect(executed[1]).toBe('medium');
      expect(executed[2]).toBe('low');
    });

    it('should auto-start when task enqueued on created harness', async () => {
      const harness = createAgentHarness(createTestConfig());
      
      harness.enqueueTask({
        id: 'auto-start-task',
        priority: 5,
        execute: async () => {},
      });

      // Wait for auto-start
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(harness.getState().status).toBe('running');
    });

    it('should reject task enqueue on completed harness', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();
      await harness.complete();

      expect(() => {
        harness.enqueueTask({
          id: 'late-task',
          priority: 5,
          execute: async () => {},
        });
      }).toThrow(HarnessError);
    });

    it('should continue processing after task failure', async () => {
      const harness = createAgentHarness(createTestConfig());
      const executed: string[] = [];

      // Start, pause to control timing, then enqueue
      await harness.start();
      await harness.pause();

      harness.enqueueTask({
        id: 'failing-task',
        priority: 5,
        execute: async () => {
          executed.push('failing');
          throw new Error('Task failed');
        },
      });

      harness.enqueueTask({
        id: 'success-task',
        priority: 4,
        execute: async () => { executed.push('success'); },
      });

      // Resume to execute tasks
      await harness.resume();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(executed).toContain('failing');
      expect(executed).toContain('success');
    });
  });

  describe('State Serialization', () => {
    it('should return valid serializable state', () => {
      const harness = createAgentHarness(createTestConfig());
      const state = harness.getState();

      // Should be JSON serializable
      const json = JSON.stringify(state);
      const parsed = JSON.parse(json);

      expect(parsed.config.id).toBe(state.config.id);
      expect(parsed.status).toBe(state.status);
    });

    it('should return independent copy of state', () => {
      const harness = createAgentHarness(createTestConfig());
      const state1 = harness.getState();
      const state2 = harness.getState();

      // Mutating one should not affect the other
      state1.context.test = 'modified';
      expect(state2.context.test).toBeUndefined();
    });

    it('should support pause/resume state preservation', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      harness.setContext('key', 'value');
      await harness.pause();

      const pausedState = harness.getState();
      expect(pausedState.status).toBe('paused');
      expect(pausedState.context.key).toBe('value');

      await harness.resume();
      const resumedState = harness.getState();
      expect(resumedState.status).toBe('running');
      expect(resumedState.context.key).toBe('value');
    });
  });

  describe('Checkpoint Support', () => {
    it('should create checkpoint with current state', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      harness.setContext('progress', 50);
      const { state, timestamp } = harness.createCheckpoint();

      expect(state.context.progress).toBe(50);
      expect(timestamp).toBeGreaterThan(0);
      expect(harness.getState().lastCheckpointAt).toBe(timestamp);
    });

    it('should restore from checkpoint', async () => {
      const harness1 = createAgentHarness(createTestConfig());
      await harness1.start();
      
      harness1.setContext('data', 'important');
      await harness1.complete();
      
      // Create checkpoint after completion
      const { state: checkpoint } = harness1.createCheckpoint();

      // Create new harness and restore
      const harness2 = createAgentHarness(createTestConfig());
      harness2.restoreCheckpoint(checkpoint);

      expect(harness2.getState().context.data).toBe('important');
      expect(harness2.getState().status).toBe('completed');
    });
  });

  describe('Resource Tracking', () => {
    it('should track tool calls', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      harness.recordToolCall({
        toolName: 'test-tool',
        arguments: { arg1: 'value' },
        result: 'success',
        durationMs: 100,
        retryCount: 0,
        cost: 0.01,
        success: true,
      });

      const state = harness.getState();
      expect(state.toolCallCount).toBe(1);
      expect(state.cost).toBe(0.01);
      expect(state.toolCallHistory).toHaveLength(1);
      expect(state.toolCallHistory[0].toolName).toBe('test-tool');
    });

    it('should track token usage', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      harness.recordTokenUsage(100);
      harness.recordTokenUsage(50);

      expect(harness.getState().tokenCount).toBe(150);
    });

    it('should emit budget exceeded event', async () => {
      const harness = createAgentHarness(createTestConfig({
        budget: { maxToolCalls: 2, maxTokens: 1000, maxCost: 100 },
      }));
      await harness.start();

      const budgetEvents: string[] = [];
      harness.on('budgetExceeded', ({ type }) => {
        budgetEvents.push(type);
      });

      harness.recordToolCall({
        toolName: 'tool',
        arguments: {},
        durationMs: 10,
        retryCount: 0,
        cost: 0,
        success: true,
      });

      harness.recordToolCall({
        toolName: 'tool',
        arguments: {},
        durationMs: 10,
        retryCount: 0,
        cost: 0,
        success: true,
      });

      expect(budgetEvents).toContain('toolCalls');
    });
  });

  describe('Harness Info', () => {
    it('should provide harness info summary', async () => {
      const harness = createAgentHarness(createTestConfig({
        id: 'test-id',
        name: 'Test Name',
        priority: 'high',
      }));

      const info = harness.getInfo();
      expect(info.id).toBe('test-id');
      expect(info.name).toBe('Test Name');
      expect(info.priority).toBe('high');
      expect(info.progress).toBe(0);
    });

    it('should calculate progress from execution plan', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      harness.setExecutionPlan({
        id: 'plan-1',
        version: 1,
        createdAt: Date.now(),
        steps: [
          { id: 's1', description: 'Step 1', agentId: 'a1', status: 'completed', dependencies: [], isCritical: true, estimatedDurationMs: 1000, toolCalls: [] },
          { id: 's2', description: 'Step 2', agentId: 'a1', status: 'completed', dependencies: [], isCritical: false, estimatedDurationMs: 1000, toolCalls: [] },
          { id: 's3', description: 'Step 3', agentId: 'a1', status: 'pending', dependencies: [], isCritical: false, estimatedDurationMs: 1000, toolCalls: [] },
        ],
        status: 'in_progress',
      });

      const info = harness.getInfo();
      expect(info.progress).toBe(67); // 2/3 completed = 66.67% ≈ 67%
    });
  });

  describe('Sub-Agent Management', () => {
    it('should register sub-agents', async () => {
      const harness = createAgentHarness(createTestConfig());
      await harness.start();

      harness.registerSubAgent('sub-agent-1');
      harness.registerSubAgent('sub-agent-2');

      expect(harness.getState().subAgentIds).toContain('sub-agent-1');
      expect(harness.getState().subAgentIds).toContain('sub-agent-2');
      expect(harness.getInfo().subAgentCount).toBe(2);
    });

    it('should respect depth limit for sub-agents', () => {
      const harness = createAgentHarness(createTestConfig({
        depth: 3,
        maxDepth: 3,
      }));

      expect(harness.canSpawnSubAgent()).toBe(false);
    });

    it('should allow sub-agents when below depth limit', () => {
      const harness = createAgentHarness(createTestConfig({
        depth: 1,
        maxDepth: 3,
      }));

      expect(harness.canSpawnSubAgent()).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property-Based Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Property Tests', () => {
  const validStatusTransitions: Array<[HarnessStatus, HarnessStatus]> = [
    ['created', 'starting'],
    ['created', 'stopped'],
    ['starting', 'running'],
    ['starting', 'paused'],
    ['starting', 'failed'],
    ['starting', 'stopped'],
    ['running', 'paused'],
    ['running', 'completed'],
    ['running', 'failed'],
    ['running', 'stopping'],
    ['paused', 'running'],
    ['paused', 'stopped'],
    ['stopping', 'stopped'],
    ['stopping', 'failed'],
  ];

  const invalidStatusTransitions: Array<[HarnessStatus, HarnessStatus]> = [
    ['created', 'running'],
    ['created', 'paused'],
    ['created', 'completed'],
    ['created', 'failed'],
    ['running', 'starting'],
    ['running', 'created'],
    ['paused', 'created'],
    ['paused', 'completed'],
    ['paused', 'failed'],
    ['completed', 'running'],
    ['completed', 'paused'],
    ['failed', 'running'],
    ['stopped', 'running'],
  ];

  it('should accept valid state transitions', async () => {
    const harness = createAgentHarness(createTestConfig());
    
    // created → starting → running
    await harness.start();
    expect(harness.getState().status).toBe('running');
    
    // running → paused
    await harness.pause();
    expect(harness.getState().status).toBe('paused');
    
    // paused → running
    await harness.resume();
    expect(harness.getState().status).toBe('running');
    
    // running → completed
    await harness.complete();
    expect(harness.getState().status).toBe('completed');
  });

  it('should reject invalid state transitions', async () => {
    // Test clear invalid transitions
    const harness = createAgentHarness(createTestConfig());
    
    // created → completed (invalid)
    await expect(harness.complete()).rejects.toThrow(InvalidStateTransitionError);
    
    // created → paused (invalid)
    await expect(harness.pause()).rejects.toThrow(InvalidStateTransitionError);
    
    // Start the harness
    await harness.start();
    
    // running → starting (invalid)
    await expect(harness.start()).rejects.toThrow(InvalidStateTransitionError);
    
    // running → resume (invalid - can only resume from paused)
    await expect(harness.resume()).rejects.toThrow(InvalidStateTransitionError);
    
    // Complete and verify terminal state
    await harness.complete();
    expect(harness.getState().status).toBe('completed');
    
    // completed → anything (invalid)
    await expect(harness.pause()).rejects.toThrow(InvalidStateTransitionError);
    await expect(harness.stop()).rejects.toThrow(InvalidStateTransitionError);
  });

  it('should maintain state invariants across operations', async () => {
    const harness = createAgentHarness(createTestConfig());

    // Invariant: toolCallCount >= toolCallHistory.length
    // Wait - these should be equal, not >=. Let me fix this test.
    expect(harness.getState().toolCallCount).toBe(harness.getState().toolCallHistory.length);

    await harness.start();

    harness.recordToolCall({
      toolName: 'test',
      arguments: {},
      durationMs: 10,
      retryCount: 0,
      cost: 0.01,
      success: true,
    });

    // After recording: toolCallCount should equal history length
    expect(harness.getState().toolCallCount).toBe(harness.getState().toolCallHistory.length);

    // Invariant: cost is sum of all tool call costs
    const totalCost = harness.getState().toolCallHistory.reduce((sum, tc) => sum + tc.cost, 0);
    expect(harness.getState().cost).toBe(totalCost);
  });
});

describe('createAgentHarness', () => {
  it('should create harness with provided config', () => {
    const config = createTestConfig({ id: 'my-harness' });
    const harness = createAgentHarness(config);

    expect(harness.getState().config.id).toBe('my-harness');
  });
});
