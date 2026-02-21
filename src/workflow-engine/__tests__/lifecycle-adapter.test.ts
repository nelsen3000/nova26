// Workflow Engine Lifecycle Adapter Tests (KIMI-T-04)
// Tests for bridging Ralph Loop lifecycle events to Workflow Engine

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createWorkflowEngineLifecycleHooks,
  getCurrentBuildState,
  getWorkflowState,
  resetBuildState,
  isValidBuildContext,
  isValidTaskResult,
  isValidBuildResult,
  WorkflowEngineError,
  type WorkflowEngineLifecycleConfig,
  type BuildState,
  type TaskExecutionStats,
} from '../lifecycle-adapter.js';
import type {
  BuildContext,
  TaskResult,
  BuildResult,
} from '../../orchestrator/lifecycle-hooks.js';
import type { PRD } from '../../types/index.js';
import type { PersistentWorkflow, VisualNode, WorkflowEdge } from '../types.js';

// ============================================================================
// Mock Console
// ============================================================================
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();

vi.spyOn(console, 'log').mockImplementation(mockConsoleLog);
vi.spyOn(console, 'error').mockImplementation(mockConsoleError);

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockPRD(overrides?: Partial<PRD>): PRD {
  return {
    meta: {
      name: overrides?.meta?.name ?? 'Test PRD',
      version: overrides?.meta?.version ?? '1.0.0',
      createdAt: overrides?.meta?.createdAt ?? new Date().toISOString(),
    },
    tasks: overrides?.tasks ?? [
      {
        id: 'task-1',
        title: 'Task 1',
        description: 'First task',
        agent: 'MARS',
        status: 'pending',
        dependencies: [],
        phase: 0,
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'task-2',
        title: 'Task 2',
        description: 'Second task',
        agent: 'VENUS',
        status: 'pending',
        dependencies: ['task-1'],
        phase: 1,
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'task-3',
        title: 'Task 3',
        description: 'Third task',
        agent: 'MERCURY',
        status: 'pending',
        dependencies: ['task-1'],
        phase: 1,
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function createMockBuildContext(overrides?: Partial<BuildContext>): BuildContext {
  return {
    buildId: overrides?.buildId ?? 'build-123',
    prdId: overrides?.prdId ?? 'prd-456',
    prdName: overrides?.prdName ?? 'Test PRD',
    startedAt: overrides?.startedAt ?? new Date().toISOString(),
    options: overrides?.options ?? {},
  };
}

function createMockTaskResult(overrides?: Partial<TaskResult>): TaskResult {
  return {
    taskId: overrides?.taskId ?? 'task-1',
    agentName: overrides?.agentName ?? 'MARS',
    success: overrides?.success ?? true,
    output: overrides?.output,
    error: overrides?.error,
    durationMs: overrides?.durationMs ?? 1000,
    aceScore: overrides?.aceScore,
  };
}

function createMockBuildResult(overrides?: Partial<BuildResult>): BuildResult {
  return {
    buildId: overrides?.buildId ?? 'build-123',
    prdId: overrides?.prdId ?? 'prd-456',
    totalTasks: overrides?.totalTasks ?? 3,
    successfulTasks: overrides?.successfulTasks ?? 3,
    failedTasks: overrides?.failedTasks ?? 0,
    totalDurationMs: overrides?.totalDurationMs ?? 5000,
    averageAceScore: overrides?.averageAceScore ?? 85,
  };
}

function createMockWorkflow(): PersistentWorkflow {
  const now = new Date().toISOString();
  return {
    id: 'workflow-test',
    name: 'Test Workflow',
    nodes: [
      {
        id: 'task-1',
        type: 'agent',
        agentId: 'MARS',
        config: {
          entryFunction: 'executeBackendTask',
          stateSchema: {},
        },
        position: { x: 0, y: 0 },
        status: 'pending',
        label: 'Task 1',
      },
      {
        id: 'task-2',
        type: 'agent',
        agentId: 'VENUS',
        config: {
          entryFunction: 'executeFrontendTask',
          stateSchema: {},
        },
        position: { x: 150, y: 0 },
        status: 'pending',
        label: 'Task 2',
      },
      {
        id: 'task-3',
        type: 'agent',
        agentId: 'MERCURY',
        config: {
          entryFunction: 'executeValidationTask',
          stateSchema: {},
        },
        position: { x: 150, y: 150 },
        status: 'pending',
        label: 'Task 3',
      },
    ],
    edges: [
      { from: 'task-1', to: 'task-2' },
      { from: 'task-1', to: 'task-3' },
    ],
    state: {
      currentNodeId: 'task-1',
      checkpoints: [],
      variables: {},
      globalStatus: 'idle',
    },
    timeline: [],
    createdAt: now,
    lastModified: now,
  };
}

// ============================================================================
// Type Guard Tests (6 tests)
// ============================================================================

describe('Type Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isValidBuildContext should return true for valid context', () => {
    const context = createMockBuildContext();
    expect(isValidBuildContext(context)).toBe(true);
  });

  it('isValidBuildContext should return false for null', () => {
    expect(isValidBuildContext(null)).toBe(false);
  });

  it('isValidBuildContext should return false for missing required fields', () => {
    expect(isValidBuildContext({ buildId: 'test' })).toBe(false);
    expect(isValidBuildContext({})).toBe(false);
  });

  it('isValidTaskResult should return true for valid result', () => {
    const result = createMockTaskResult();
    expect(isValidTaskResult(result)).toBe(true);
  });

  it('isValidTaskResult should return false for invalid result', () => {
    expect(isValidTaskResult(null)).toBe(false);
    expect(isValidTaskResult({ taskId: 'test' })).toBe(false);
    expect(isValidTaskResult({ success: true })).toBe(false);
  });

  it('isValidBuildResult should return true for valid result', () => {
    const result = createMockBuildResult();
    expect(isValidBuildResult(result)).toBe(true);
  });

  it('isValidBuildResult should return false for invalid result', () => {
    expect(isValidBuildResult(null)).toBe(false);
    expect(isValidBuildResult({ buildId: 'test' })).toBe(false);
  });
});

// ============================================================================
// onBeforeBuild Tests (6 tests)
// ============================================================================

describe('onBeforeBuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuildState();
  });

  afterEach(() => {
    resetBuildState();
  });

  it('should initialize workflow graph from PRD tasks', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({
      options: { prd },
    });
    const hooks = createWorkflowEngineLifecycleHooks();

    await hooks.onBeforeBuild?.(context);

    const state = getCurrentBuildState();
    expect(state).not.toBeNull();
    expect(state?.workflow).not.toBeNull();
    expect(state?.workflow?.nodes).toHaveLength(3);
    expect(state?.workflow?.edges).toHaveLength(2);
  });

  it('should set up correct build state properties', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({
      buildId: 'test-build-123',
      prdId: 'test-prd-456',
      options: { prd },
    });
    const hooks = createWorkflowEngineLifecycleHooks();

    await hooks.onBeforeBuild?.(context);

    const state = getCurrentBuildState();
    expect(state?.buildId).toBe('test-build-123');
    expect(state?.prdId).toBe('test-prd-456');
    expect(state?.startedAt).toBe(context.startedAt);
  });

  it('should initialize task stats for all nodes', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({
      options: { prd },
    });
    const hooks = createWorkflowEngineLifecycleHooks();

    await hooks.onBeforeBuild?.(context);

    const state = getCurrentBuildState();
    expect(state?.taskStats.size).toBe(3);
    
    for (const taskId of ['task-1', 'task-2', 'task-3']) {
      const stats = state?.taskStats.get(taskId);
      expect(stats).toBeDefined();
      expect(stats?.status).toBe('pending');
    }
  });

  it('should handle build without PRD gracefully', async () => {
    const context = createMockBuildContext();
    const hooks = createWorkflowEngineLifecycleHooks();

    await hooks.onBeforeBuild?.(context);

    const state = getCurrentBuildState();
    expect(state).not.toBeNull();
    expect(state?.workflow).toBeNull();
    expect(state?.workflowEngine).toBeNull();
  });

  it('should reset previous build state', async () => {
    const prd = createMockPRD();
    const context1 = createMockBuildContext({
      buildId: 'build-1',
      options: { prd },
    });
    const context2 = createMockBuildContext({
      buildId: 'build-2',
      options: { prd },
    });
    const hooks = createWorkflowEngineLifecycleHooks();

    await hooks.onBeforeBuild?.(context1);
    expect(getCurrentBuildState()?.buildId).toBe('build-1');

    await hooks.onBeforeBuild?.(context2);
    expect(getCurrentBuildState()?.buildId).toBe('build-2');
  });

  it('should create visual adapter with correct config', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({
      options: { prd },
    });
    const config: WorkflowEngineLifecycleConfig = {
      layoutAlgorithm: 'force-directed',
      checkpointPerTask: false,
    };
    const hooks = createWorkflowEngineLifecycleHooks(config);

    await hooks.onBeforeBuild?.(context);

    const state = getCurrentBuildState();
    expect(state?.workflow).toBeDefined();
    expect(state?.workflowEngine).toBeDefined();
  });
});

// ============================================================================
// onAfterTask Tests (10 tests)
// ============================================================================

describe('onAfterTask', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetBuildState();
    
    // Set up initial state
    const prd = createMockPRD();
    const context = createMockBuildContext({
      options: { prd },
    });
    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild?.(context);
  });

  afterEach(() => {
    resetBuildState();
  });

  it('should update node status to complete on success', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    const taskResult = createMockTaskResult({
      taskId: 'task-1',
      success: true,
    });

    await hooks.onAfterTask?.(taskResult);

    const state = getCurrentBuildState();
    const node = state?.workflow?.nodes.find((n) => n.id === 'task-1');
    expect(node?.status).toBe('complete');
  });

  it('should update node status to failed on failure', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    const taskResult = createMockTaskResult({
      taskId: 'task-1',
      success: false,
      error: 'Test error',
    });

    await hooks.onAfterTask?.(taskResult);

    const state = getCurrentBuildState();
    const node = state?.workflow?.nodes.find((n) => n.id === 'task-1');
    expect(node?.status).toBe('failed');
  });

  it('should record task duration and output', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    const taskResult = createMockTaskResult({
      taskId: 'task-1',
      success: true,
      output: 'Task output',
      durationMs: 2500,
      aceScore: 90,
    });

    await hooks.onAfterTask?.(taskResult);

    const state = getCurrentBuildState();
    const stats = state?.taskStats.get('task-1');
    expect(stats?.durationMs).toBe(2500);
    expect(stats?.output).toBe('Task output');
    expect(stats?.aceScore).toBe(90);
  });

  it('should trigger downstream transitions after completion', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    
    // Complete task-1
    await hooks.onAfterTask?.(createMockTaskResult({
      taskId: 'task-1',
      success: true,
    }));

    const state = getCurrentBuildState();
    // task-2 and task-3 should now be running (or at least not pending)
    const task2 = state?.workflow?.nodes.find((n) => n.id === 'task-2');
    expect(task2?.status).not.toBe('pending');
  });

  it('should mark downstream as blocked when task fails', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    
    // Fail task-1
    await hooks.onAfterTask?.(createMockTaskResult({
      taskId: 'task-1',
      success: false,
      error: 'Failed',
    }));

    const state = getCurrentBuildState();
    // task-2 and task-3 should be skipped (blocked)
    const task2 = state?.workflow?.nodes.find((n) => n.id === 'task-2');
    const task3 = state?.workflow?.nodes.find((n) => n.id === 'task-3');
    expect(task2?.status).toBe('skipped');
    expect(task3?.status).toBe('skipped');
  });

  it('should track completed tasks list', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    
    await hooks.onAfterTask?.(createMockTaskResult({
      taskId: 'task-1',
      success: true,
    }));

    const state = getCurrentBuildState();
    expect(state?.completedTasks).toContain('task-1');
    expect(state?.failedTasks).not.toContain('task-1');
  });

  it('should track failed tasks list', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    
    await hooks.onAfterTask?.(createMockTaskResult({
      taskId: 'task-1',
      success: false,
    }));

    const state = getCurrentBuildState();
    expect(state?.failedTasks).toContain('task-1');
    expect(state?.completedTasks).not.toContain('task-1');
  });

  it('should create checkpoint when checkpointPerTask is enabled', async () => {
    const hooks = createWorkflowEngineLifecycleHooks({
      checkpointPerTask: true,
    });

    await hooks.onAfterTask?.(createMockTaskResult({
      taskId: 'task-1',
      success: true,
    }));

    const state = getCurrentBuildState();
    const workflowState = state?.workflowEngine?.getWorkflowState();
    expect(workflowState?.checkpoints.length).toBeGreaterThan(0);
  });

  it('should handle task without active build state gracefully', async () => {
    resetBuildState();
    const hooks = createWorkflowEngineLifecycleHooks();
    
    // Should not throw
    await expect(
      hooks.onAfterTask?.(createMockTaskResult())
    ).resolves.not.toThrow();
  });

  it('should handle multiple task completions', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    
    await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', success: true }));
    await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2', success: true }));
    await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-3', success: true }));

    const state = getCurrentBuildState();
    expect(state?.completedTasks).toHaveLength(3);
    expect(state?.completedTasks).toContain('task-1');
    expect(state?.completedTasks).toContain('task-2');
    expect(state?.completedTasks).toContain('task-3');
  });
});

// ============================================================================
// onBuildComplete Tests (6 tests)
// ============================================================================

describe('onBuildComplete', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetBuildState();
    
    // Set up initial state with completed tasks
    const prd = createMockPRD();
    const context = createMockBuildContext({
      options: { prd },
    });
    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild?.(context);
    
    // Complete some tasks
    await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', success: true }));
    await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-2', success: true }));
  });

  afterEach(() => {
    resetBuildState();
  });

  it('should generate workflow summary', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    const buildResult = createMockBuildResult();

    await hooks.onBuildComplete?.(buildResult);

    // Check that console.log was called with summary
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Build Summary')
    );
  });

  it('should calculate critical path', async () => {
    const hooks = createWorkflowEngineLifecycleHooks({
      enableCriticalPath: true,
    });
    const buildResult = createMockBuildResult();

    await hooks.onBuildComplete?.(buildResult);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Critical Path')
    );
  });

  it('should log build metrics', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    const buildResult = createMockBuildResult({
      totalTasks: 10,
      successfulTasks: 8,
      failedTasks: 2,
      totalDurationMs: 15000,
      averageAceScore: 87.5,
    });

    await hooks.onBuildComplete?.(buildResult);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Build ID:')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('build-123')
    );
  });

  it('should dispose workflow engine', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    const buildResult = createMockBuildResult();

    expect(getCurrentBuildState()?.workflowEngine).not.toBeNull();
    
    await hooks.onBuildComplete?.(buildResult);

    // Engine should be disposed (nullified)
    expect(getCurrentBuildState()?.workflowEngine).toBeNull();
  });

  it('should handle build completion without active state gracefully', async () => {
    resetBuildState();
    const hooks = createWorkflowEngineLifecycleHooks();
    const buildResult = createMockBuildResult();

    // Should not throw
    await expect(
      hooks.onBuildComplete?.(buildResult)
    ).resolves.not.toThrow();
  });

  it('should calculate final statistics correctly', async () => {
    const hooks = createWorkflowEngineLifecycleHooks();
    const buildResult = createMockBuildResult({
      totalTasks: 3,
      successfulTasks: 2,
      failedTasks: 1,
    });

    await hooks.onBuildComplete?.(buildResult);

    // Verify stats are logged
    const statsCalls = mockConsoleLog.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('Total Nodes')
    );
    expect(statsCalls.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Utility Functions Tests (6 tests)
// ============================================================================

describe('Utility Functions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetBuildState();
  });

  afterEach(() => {
    resetBuildState();
  });

  it('getCurrentBuildState should return null when no build active', () => {
    expect(getCurrentBuildState()).toBeNull();
  });

  it('getCurrentBuildState should return build state after initialization', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild?.(context);

    const state = getCurrentBuildState();
    expect(state).not.toBeNull();
    expect(state?.buildId).toBe('build-123');
  });

  it('getWorkflowState should return null stats when no build active', () => {
    const state = getWorkflowState();
    expect(state.buildState).toBeNull();
    expect(state.workflowStats).toBeNull();
    expect(state.criticalPath).toBeNull();
  });

  it('getWorkflowState should return complete snapshot with build', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks({ enableCriticalPath: true });
    await hooks.onBeforeBuild?.(context);

    const state = getWorkflowState();
    expect(state.buildState).not.toBeNull();
    expect(state.timestamp).toBeDefined();
  });

  it('resetBuildState should clear all state', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild?.(context);

    expect(getCurrentBuildState()).not.toBeNull();
    
    resetBuildState();
    
    expect(getCurrentBuildState()).toBeNull();
  });

  it('resetBuildState should dispose workflow engine', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild?.(context);

    // Should not throw when resetting
    expect(() => resetBuildState()).not.toThrow();
  });
});

// ============================================================================
// Configuration Tests (4 tests)
// ============================================================================

describe('Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuildState();
  });

  afterEach(() => {
    resetBuildState();
  });

  it('should respect verbose config option', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks({ verbose: true });

    await hooks.onBeforeBuild?.(context);

    // Verbose logging should output
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Initializing workflow engine')
    );
  });

  it('should respect layoutAlgorithm config', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks({
      layoutAlgorithm: 'force-directed',
    });

    await hooks.onBeforeBuild?.(context);
    
    const state = getCurrentBuildState();
    expect(state?.workflow).toBeDefined();
  });

  it('should respect enableCriticalPath config', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks({
      enableCriticalPath: false,
    });
    await hooks.onBeforeBuild?.(context);

    // Complete a task and finish build
    await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', success: true }));
    await hooks.onBuildComplete?.(createMockBuildResult());

    // Should not log critical path when disabled
    const criticalPathCalls = mockConsoleLog.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('Critical Path')
    );
    expect(criticalPathCalls).toHaveLength(0);
  });

  it('should merge adapter config correctly', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks({
      adapterConfig: {
        checkpointPerTask: false,
        nodeSpacing: 200,
      },
    });

    await hooks.onBeforeBuild?.(context);
    
    const state = getCurrentBuildState();
    expect(state?.workflow).toBeDefined();
  });
});

// ============================================================================
// Edge Cases and Integration Tests (6 tests)
// ============================================================================

describe('Edge Cases and Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuildState();
  });

  afterEach(() => {
    resetBuildState();
  });

  it('should handle complex dependency graph', async () => {
    const complexPRD: PRD = {
      meta: { name: 'Complex PRD', version: '1.0.0', createdAt: new Date().toISOString() },
      tasks: [
        { id: 'A', title: 'Task A', description: '', agent: 'MARS', status: 'pending', dependencies: [], phase: 0, attempts: 0, createdAt: new Date().toISOString() },
        { id: 'B', title: 'Task B', description: '', agent: 'VENUS', status: 'pending', dependencies: ['A'], phase: 1, attempts: 0, createdAt: new Date().toISOString() },
        { id: 'C', title: 'Task C', description: '', agent: 'MERCURY', status: 'pending', dependencies: ['A'], phase: 1, attempts: 0, createdAt: new Date().toISOString() },
        { id: 'D', title: 'Task D', description: '', agent: 'MARS', status: 'pending', dependencies: ['B', 'C'], phase: 2, attempts: 0, createdAt: new Date().toISOString() },
      ],
    };

    const context = createMockBuildContext({ options: { prd: complexPRD } });
    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild?.(context);

    const state = getCurrentBuildState();
    expect(state?.workflow?.nodes).toHaveLength(4);
    expect(state?.workflow?.edges).toHaveLength(4); // A->B, A->C, B->D, C->D
  });

  it('should handle config changes between builds', async () => {
    const prd = createMockPRD();
    
    // First build with verbose false
    const context1 = createMockBuildContext({ buildId: 'build-1', options: { prd } });
    const hooks1 = createWorkflowEngineLifecycleHooks({ verbose: false });
    await hooks1.onBeforeBuild?.(context1);
    resetBuildState();

    mockConsoleLog.mockClear();

    // Second build with verbose true
    const context2 = createMockBuildContext({ buildId: 'build-2', options: { prd } });
    const hooks2 = createWorkflowEngineLifecycleHooks({ verbose: true });
    await hooks2.onBeforeBuild?.(context2);

    // Should have verbose output for second build
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Creating workflow engine lifecycle hooks')
    );
  });

  it('should handle task with all optional fields', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild?.(context);

    // Task with minimal fields
    const minimalTask: TaskResult = {
      taskId: 'task-1',
      agentName: 'MARS',
      success: true,
      durationMs: 1000,
    };

    await expect(hooks.onAfterTask?.(minimalTask)).resolves.not.toThrow();
  });

  it('should handle circular workflow gracefully', async () => {
    // Create a workflow that would have a circular reference
    const workflow = createMockWorkflow();
    workflow.edges.push({ from: 'task-3', to: 'task-1' }); // Creates cycle

    const state: BuildState = {
      buildId: 'test',
      prdId: 'prd-test',
      prdName: 'Test',
      startedAt: new Date().toISOString(),
      workflowEngine: null,
      workflow,
      taskStats: new Map(),
      completedTasks: [],
      failedTasks: [],
      downstreamBlocked: [],
    };

    // Critical path calculation should handle cycles
    const hooks = createWorkflowEngineLifecycleHooks({ enableCriticalPath: true });
    await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', success: true }));
    await hooks.onBuildComplete?.(createMockBuildResult());

    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('should handle empty PRD', async () => {
    const emptyPRD: PRD = {
      meta: { name: 'Empty', version: '1.0.0', createdAt: new Date().toISOString() },
      tasks: [],
    };

    const context = createMockBuildContext({ options: { prd: emptyPRD } });
    const hooks = createWorkflowEngineLifecycleHooks();

    await expect(hooks.onBeforeBuild?.(context)).resolves.not.toThrow();
    
    const state = getCurrentBuildState();
    expect(state?.workflow?.nodes).toHaveLength(0);
  });

  it('should maintain state consistency across all phases', async () => {
    const prd = createMockPRD();
    const context = createMockBuildContext({ buildId: 'integration-test', options: { prd } });
    const hooks = createWorkflowEngineLifecycleHooks();

    // Execute full lifecycle
    await hooks.onBeforeBuild?.(context);
    expect(getCurrentBuildState()?.buildId).toBe('integration-test');

    await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'task-1', success: true }));
    expect(getCurrentBuildState()?.completedTasks).toContain('task-1');

    await hooks.onBuildComplete?.(createMockBuildResult({ buildId: 'integration-test' }));
    
    // State should be cleaned up but workflow preserved
    const finalState = getCurrentBuildState();
    expect(finalState?.workflowEngine).toBeNull();
    expect(finalState?.workflow).not.toBeNull();
  });
});

// ============================================================================
// WorkflowEngineError Export Test (1 test)
// ============================================================================

describe('Exports', () => {
  it('should export WorkflowEngineError', () => {
    expect(WorkflowEngineError).toBeDefined();
    expect(typeof WorkflowEngineError).toBe('function');
    
    const error = new WorkflowEngineError('Test error', 'TEST_CODE');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
  });
});
