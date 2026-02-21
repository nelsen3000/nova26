import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HandoffContextBuilder,
  getHandoffContextBuilder,
  resetHandoffContextBuilder,
  type HandoffPayload,
  type ModelRoutingState,
  type MemoryState,
  type WorkflowState,
} from '../handoff-context.js';

describe('HandoffContextBuilder', () => {
  let builder: HandoffContextBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    builder = new HandoffContextBuilder();
  });

  // ============================================================
  // Basic Payload Building
  // ============================================================

  it('should build a basic payload with required fields', () => {
    const payload = builder.buildPayload({
      fromAgent: 'EARTH',
      toAgent: 'MARS',
      taskId: 'task-1',
      buildId: 'build-1',
    });

    expect(payload.fromAgent).toBe('EARTH');
    expect(payload.toAgent).toBe('MARS');
    expect(payload.taskId).toBe('task-1');
    expect(payload.buildId).toBe('build-1');
    expect(payload.timestamp).toBeGreaterThan(0);
    expect(payload.metadata).toEqual({});
  });

  it('should include optional task context', () => {
    const payload = builder.buildPayload({
      fromAgent: 'EARTH',
      toAgent: 'MARS',
      taskId: 'task-1',
      buildId: 'build-1',
      taskOutput: 'Generated auth middleware',
      taskDurationMs: 1500,
      aceScore: 0.92,
    });

    expect(payload.taskOutput).toBe('Generated auth middleware');
    expect(payload.taskDurationMs).toBe(1500);
    expect(payload.aceScore).toBe(0.92);
  });

  it('should include custom metadata', () => {
    const payload = builder.buildPayload({
      fromAgent: 'SUN',
      toAgent: 'EARTH',
      taskId: 'task-1',
      buildId: 'build-1',
      metadata: { priority: 'high', retryCount: 2 },
    });

    expect(payload.metadata).toEqual({ priority: 'high', retryCount: 2 });
  });

  // ============================================================
  // Module State Collectors
  // ============================================================

  it('should collect model routing state', () => {
    const routingState: ModelRoutingState = {
      selectedModelId: 'claude-sonnet',
      routingReason: 'Best for TypeScript',
      affinityScores: { 'claude-sonnet': 0.95, 'gpt-4o': 0.85 },
    };

    builder.registerCollector('model-routing', 'modelRouting', () => routingState);

    const payload = builder.buildPayload({
      fromAgent: 'EARTH',
      toAgent: 'MARS',
      taskId: 'task-1',
      buildId: 'build-1',
    });

    expect(payload.modelRouting).toEqual(routingState);
  });

  it('should collect memory state', () => {
    const memoryState: MemoryState = {
      recentNodeIds: ['node-1', 'node-2'],
      contextSummary: 'User prefers functional patterns',
      tasteScore: 0.88,
    };

    builder.registerCollector('infinite-memory', 'memory', () => memoryState);

    const payload = builder.buildPayload({
      fromAgent: 'EARTH',
      toAgent: 'VENUS',
      taskId: 'task-2',
      buildId: 'build-1',
    });

    expect(payload.memory).toEqual(memoryState);
  });

  it('should collect workflow state', () => {
    const workflowState: WorkflowState = {
      currentNodeId: 'wf-3',
      completedNodeIds: ['wf-1', 'wf-2'],
      pendingNodeIds: ['wf-4', 'wf-5'],
      criticalPathPosition: 2,
    };

    builder.registerCollector('workflow-engine', 'workflow', () => workflowState);

    const payload = builder.buildPayload({
      fromAgent: 'MARS',
      toAgent: 'VENUS',
      taskId: 'task-3',
      buildId: 'build-1',
    });

    expect(payload.workflow).toEqual(workflowState);
  });

  it('should skip null collector results', () => {
    builder.registerCollector('model-routing', 'modelRouting', () => null);

    const payload = builder.buildPayload({
      fromAgent: 'EARTH',
      toAgent: 'MARS',
      taskId: 'task-1',
      buildId: 'build-1',
    });

    expect(payload.modelRouting).toBeUndefined();
  });

  it('should collect from multiple modules', () => {
    builder.registerCollector('model-routing', 'modelRouting', () => ({
      selectedModelId: 'gpt-4o',
      routingReason: 'default',
      affinityScores: {},
    }));
    builder.registerCollector('infinite-memory', 'memory', () => ({
      recentNodeIds: ['n1'],
      contextSummary: 'test',
      tasteScore: 0.5,
    }));

    const payload = builder.buildPayload({
      fromAgent: 'EARTH',
      toAgent: 'MARS',
      taskId: 'task-1',
      buildId: 'build-1',
    });

    expect(payload.modelRouting).toBeDefined();
    expect(payload.memory).toBeDefined();
  });

  it('should pass agent and task info to collectors', () => {
    const collector = vi.fn().mockReturnValue(null);
    builder.registerCollector('test-module', 'test', collector);

    builder.buildPayload({
      fromAgent: 'EARTH',
      toAgent: 'MARS',
      taskId: 'task-42',
      buildId: 'build-7',
    });

    expect(collector).toHaveBeenCalledWith('EARTH', 'MARS', 'task-42', 'build-7');
  });

  it('should handle collector errors gracefully', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    builder.registerCollector('bad-module', 'bad', () => {
      throw new Error('Collector crashed');
    });
    builder.registerCollector('good-module', 'good', () => ({ data: 'ok' }));

    const payload = builder.buildPayload({
      fromAgent: 'EARTH',
      toAgent: 'MARS',
      taskId: 'task-1',
      buildId: 'build-1',
    });

    // Bad module's state is not included, but good module's is
    expect((payload as Record<string, unknown>)['bad']).toBeUndefined();
    expect((payload as Record<string, unknown>)['good']).toEqual({ data: 'ok' });

    errorSpy.mockRestore();
  });

  // ============================================================
  // Unregister
  // ============================================================

  it('should unregister a collector', () => {
    builder.registerCollector('model-routing', 'modelRouting', () => ({
      selectedModelId: 'test', routingReason: 'test', affinityScores: {},
    }));

    expect(builder.getRegisteredModules()).toContain('model-routing');

    builder.unregisterCollector('model-routing');

    expect(builder.getRegisteredModules()).not.toContain('model-routing');
  });

  it('should return false when unregistering unknown module', () => {
    expect(builder.unregisterCollector('nonexistent')).toBe(false);
  });

  // ============================================================
  // Lifecycle Context
  // ============================================================

  it('should build lifecycle context for hook system', () => {
    const ctx = builder.buildLifecycleContext({
      fromAgent: 'EARTH',
      toAgent: 'MARS',
      taskId: 'task-1',
      buildId: 'build-1',
    });

    expect(ctx.fromAgent).toBe('EARTH');
    expect(ctx.toAgent).toBe('MARS');
    expect(ctx.taskId).toBe('task-1');
    expect(ctx.payload).toBeDefined();
    expect((ctx.payload as Record<string, unknown>).buildId).toBe('build-1');
  });

  // ============================================================
  // Module Management
  // ============================================================

  it('should list registered modules', () => {
    builder.registerCollector('mod-a', 'a', () => null);
    builder.registerCollector('mod-b', 'b', () => null);

    const modules = builder.getRegisteredModules();
    expect(modules).toContain('mod-a');
    expect(modules).toContain('mod-b');
    expect(modules).toHaveLength(2);
  });

  it('should clear all collectors', () => {
    builder.registerCollector('mod-a', 'a', () => null);
    builder.registerCollector('mod-b', 'b', () => null);

    builder.clear();

    expect(builder.getRegisteredModules()).toHaveLength(0);
  });

  // ============================================================
  // Singleton
  // ============================================================

  it('should return same global instance', () => {
    resetHandoffContextBuilder();
    const b1 = getHandoffContextBuilder();
    const b2 = getHandoffContextBuilder();
    expect(b1).toBe(b2);
  });

  it('should reset global instance', () => {
    const b1 = getHandoffContextBuilder();
    b1.registerCollector('test', 'test', () => null);

    resetHandoffContextBuilder();
    const b2 = getHandoffContextBuilder();

    expect(b2.getRegisteredModules()).toHaveLength(0);
    expect(b1).not.toBe(b2);
  });

  // ============================================================
  // Integration: Full Handoff Flow
  // ============================================================

  it('should build complete handoff payload for SUN → EARTH → MARS chain', () => {
    // Simulate SUN generating a PRD, EARTH coding, handing off to MARS for testing
    builder.registerCollector('model-routing', 'modelRouting', (_from, to) => ({
      selectedModelId: to === 'MARS' ? 'claude-sonnet' : 'gpt-4o',
      routingReason: to === 'MARS' ? 'Best for testing' : 'General purpose',
      affinityScores: { 'claude-sonnet': 0.9 },
    }));
    builder.registerCollector('infinite-memory', 'memory', () => ({
      recentNodeIds: ['prd-analysis', 'code-gen'],
      contextSummary: 'Auth module generated with JWT strategy',
      tasteScore: 0.91,
    }));
    builder.registerCollector('workflow-engine', 'workflow', () => ({
      currentNodeId: 'wf-code-complete',
      completedNodeIds: ['wf-prd', 'wf-plan', 'wf-code'],
      pendingNodeIds: ['wf-test', 'wf-review', 'wf-deploy'],
      criticalPathPosition: 3,
    }));

    const payload = builder.buildPayload({
      fromAgent: 'EARTH',
      toAgent: 'MARS',
      taskId: 'task-code-auth',
      buildId: 'build-sprint-7',
      taskOutput: 'Generated src/auth/jwt-middleware.ts',
      taskDurationMs: 12000,
      aceScore: 0.94,
      metadata: { filesChanged: 3, linesAdded: 150 },
    });

    expect(payload.fromAgent).toBe('EARTH');
    expect(payload.toAgent).toBe('MARS');
    expect(payload.modelRouting?.selectedModelId).toBe('claude-sonnet');
    expect(payload.memory?.contextSummary).toContain('JWT');
    expect(payload.workflow?.completedNodeIds).toHaveLength(3);
    expect(payload.workflow?.pendingNodeIds).toContain('wf-test');
    expect(payload.aceScore).toBe(0.94);
  });
});
