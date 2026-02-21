import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HandoffReceiver,
  getHandoffReceiver,
  resetHandoffReceiver,
} from '../handoff-receiver.js';
import type { HandoffPayload } from '../handoff-context.js';

describe('HandoffReceiver', () => {
  let receiver: HandoffReceiver;

  const makePayload = (overrides?: Partial<HandoffPayload>): HandoffPayload => ({
    fromAgent: 'EARTH',
    toAgent: 'MARS',
    taskId: 'task-1',
    buildId: 'build-1',
    timestamp: Date.now(),
    metadata: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    receiver = new HandoffReceiver();
  });

  // ============================================================
  // State Extraction
  // ============================================================

  it('should extract basic fields from payload', () => {
    const payload = makePayload();
    const state = receiver.extractState(payload);

    expect(state.fromAgent).toBe('EARTH');
    expect(state.toAgent).toBe('MARS');
    expect(state.taskId).toBe('task-1');
    expect(state.buildId).toBe('build-1');
  });

  it('should extract model routing state', () => {
    const payload = makePayload({
      modelRouting: {
        selectedModelId: 'claude-sonnet',
        routingReason: 'Best for testing',
        affinityScores: { 'claude-sonnet': 0.95 },
      },
    });

    const state = receiver.extractState(payload);
    expect(state.modelRouting).not.toBeNull();
    expect(state.modelRouting?.selectedModelId).toBe('claude-sonnet');
  });

  it('should extract memory state', () => {
    const payload = makePayload({
      memory: {
        recentNodeIds: ['node-1'],
        contextSummary: 'Auth module context',
        tasteScore: 0.88,
      },
    });

    const state = receiver.extractState(payload);
    expect(state.memory?.contextSummary).toBe('Auth module context');
  });

  it('should extract workflow state', () => {
    const payload = makePayload({
      workflow: {
        currentNodeId: 'wf-3',
        completedNodeIds: ['wf-1', 'wf-2'],
        pendingNodeIds: ['wf-4'],
        criticalPathPosition: 2,
      },
    });

    const state = receiver.extractState(payload);
    expect(state.workflow?.currentNodeId).toBe('wf-3');
    expect(state.workflow?.completedNodeIds).toHaveLength(2);
  });

  it('should extract task context', () => {
    const payload = makePayload({
      taskOutput: 'Generated code',
      taskDurationMs: 5000,
      aceScore: 0.91,
    });

    const state = receiver.extractState(payload);
    expect(state.taskOutput).toBe('Generated code');
    expect(state.taskDurationMs).toBe(5000);
    expect(state.aceScore).toBe(0.91);
  });

  it('should return null for missing optional states', () => {
    const payload = makePayload();
    const state = receiver.extractState(payload);

    expect(state.modelRouting).toBeNull();
    expect(state.memory).toBeNull();
    expect(state.workflow).toBeNull();
    expect(state.collaboration).toBeNull();
    expect(state.observability).toBeNull();
    expect(state.taskOutput).toBeNull();
    expect(state.taskDurationMs).toBeNull();
    expect(state.aceScore).toBeNull();
  });

  // ============================================================
  // Module State Restoration
  // ============================================================

  it('should call restorer for matching module state', async () => {
    const restorer = vi.fn();
    receiver.registerRestorer('model-routing', 'modelRouting', restorer);

    const routingState = {
      selectedModelId: 'gpt-4o',
      routingReason: 'default',
      affinityScores: {},
    };

    const payload = makePayload({ modelRouting: routingState });
    const result = await receiver.receive(payload);

    expect(restorer).toHaveBeenCalledWith(routingState, 'MARS', 'build-1');
    expect(result.restoredModules).toContain('model-routing');
  });

  it('should skip restorer when module state is missing', async () => {
    const restorer = vi.fn();
    receiver.registerRestorer('model-routing', 'modelRouting', restorer);

    const payload = makePayload(); // No modelRouting
    const result = await receiver.receive(payload);

    expect(restorer).not.toHaveBeenCalled();
    expect(result.restoredModules).toHaveLength(0);
  });

  it('should handle async restorers', async () => {
    const restorer = vi.fn().mockResolvedValue(undefined);
    receiver.registerRestorer('memory', 'memory', restorer);

    const payload = makePayload({
      memory: {
        recentNodeIds: ['n1'],
        contextSummary: 'ctx',
        tasteScore: 0.5,
      },
    });

    const result = await receiver.receive(payload);
    expect(result.restoredModules).toContain('memory');
  });

  it('should handle restorer errors without crashing', async () => {
    receiver.registerRestorer('bad-module', 'modelRouting', () => {
      throw new Error('Restorer failed');
    });

    const payload = makePayload({
      modelRouting: {
        selectedModelId: 'test',
        routingReason: 'test',
        affinityScores: {},
      },
    });

    const result = await receiver.receive(payload);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].module).toBe('bad-module');
    expect(result.errors[0].error).toBe('Restorer failed');
  });

  it('should restore multiple modules', async () => {
    receiver.registerRestorer('model-routing', 'modelRouting', vi.fn());
    receiver.registerRestorer('memory', 'memory', vi.fn());
    receiver.registerRestorer('workflow', 'workflow', vi.fn());

    const payload = makePayload({
      modelRouting: { selectedModelId: 'test', routingReason: 'test', affinityScores: {} },
      memory: { recentNodeIds: [], contextSummary: '', tasteScore: 0 },
      workflow: { currentNodeId: 'wf-1', completedNodeIds: [], pendingNodeIds: [], criticalPathPosition: 0 },
    });

    const result = await receiver.receive(payload);
    expect(result.restoredModules).toHaveLength(3);
  });

  // ============================================================
  // Unregister
  // ============================================================

  it('should unregister a restorer', () => {
    receiver.registerRestorer('model-routing', 'modelRouting', vi.fn());
    expect(receiver.getRegisteredModules()).toContain('model-routing');

    receiver.unregisterRestorer('model-routing');
    expect(receiver.getRegisteredModules()).not.toContain('model-routing');
  });

  it('should return false when unregistering unknown module', () => {
    expect(receiver.unregisterRestorer('nonexistent')).toBe(false);
  });

  // ============================================================
  // Singleton
  // ============================================================

  it('should return same global instance', () => {
    resetHandoffReceiver();
    const r1 = getHandoffReceiver();
    const r2 = getHandoffReceiver();
    expect(r1).toBe(r2);
  });

  it('should reset global instance', () => {
    const r1 = getHandoffReceiver();
    r1.registerRestorer('test', 'test', vi.fn());

    resetHandoffReceiver();
    const r2 = getHandoffReceiver();

    expect(r2.getRegisteredModules()).toHaveLength(0);
    expect(r1).not.toBe(r2);
  });
});
