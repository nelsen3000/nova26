import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EventBus,
  getGlobalEventBus,
  resetGlobalEventBus,
  type EventName,
  type ModelSelectedEvent,
  type TaskStartedEvent,
  type TaskCompletedEvent,
  type TaskFailedEvent,
  type MemoryStoredEvent,
  type WorkflowTransitionedEvent,
  type CollaborationChangedEvent,
  type BuildStartedEvent,
  type BuildCompletedEvent,
} from '../event-bus.js';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = new EventBus();
  });

  // ============================================================
  // Basic Pub/Sub
  // ============================================================

  it('should emit events to subscribers', async () => {
    const handler = vi.fn();
    bus.on('task:started', handler, 'test-module');

    const payload: TaskStartedEvent = {
      taskId: 'task-1',
      agentName: 'EARTH',
      title: 'Generate code',
      buildId: 'build-1',
      startedAt: Date.now(),
    };

    await bus.emit('task:started', payload);
    expect(handler).toHaveBeenCalledWith(payload);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support multiple subscribers for same event', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('task:completed', handler1, 'module-a');
    bus.on('task:completed', handler2, 'module-b');

    const payload: TaskCompletedEvent = {
      taskId: 'task-1',
      agentName: 'MARS',
      success: true,
      durationMs: 500,
      outputSize: 1024,
      aceScore: 0.95,
    };

    await bus.emit('task:completed', payload);
    expect(handler1).toHaveBeenCalledWith(payload);
    expect(handler2).toHaveBeenCalledWith(payload);
  });

  it('should not call handler after unsubscribe', async () => {
    const handler = vi.fn();
    const unsub = bus.on('task:failed', handler, 'test');

    unsub();

    await bus.emit('task:failed', {
      taskId: 'task-1',
      agentName: 'VENUS',
      error: 'Timeout',
      durationMs: 30000,
      recoveryAttempted: false,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle emit with no subscribers', async () => {
    // Should not throw
    await bus.emit('model:selected', {
      agentName: 'EARTH',
      taskId: 'task-1',
      modelId: 'gpt-4o',
      modelName: 'GPT-4o',
      routingReason: 'Best for code generation',
    });
  });

  // ============================================================
  // Once Subscriptions
  // ============================================================

  it('should fire once-subscription only once', async () => {
    const handler = vi.fn();
    bus.once('build:started', handler, 'test');

    const payload: BuildStartedEvent = {
      buildId: 'build-1',
      prdId: 'prd-1',
      prdName: 'Test PRD',
      totalTasks: 5,
      enabledModules: ['modelRouting', 'observability'],
    };

    await bus.emit('build:started', payload);
    await bus.emit('build:started', payload);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should allow unsubscribe of once-subscription before firing', async () => {
    const handler = vi.fn();
    const unsub = bus.once('build:completed', handler, 'test');

    unsub();

    await bus.emit('build:completed', {
      buildId: 'build-1',
      totalTasks: 5,
      successfulTasks: 5,
      failedTasks: 0,
      totalDurationMs: 10000,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  // ============================================================
  // Type Safety
  // ============================================================

  it('should emit model:selected with correct payload shape', async () => {
    const handler = vi.fn();
    bus.on('model:selected', handler, 'routing');

    const payload: ModelSelectedEvent = {
      agentName: 'EARTH',
      taskId: 'task-1',
      modelId: 'claude-sonnet-4-5-20250514',
      modelName: 'Claude Sonnet',
      routingReason: 'Best for TypeScript',
      latencyMs: 120,
    };

    await bus.emit('model:selected', payload);

    const received = handler.mock.calls[0][0];
    expect(received.agentName).toBe('EARTH');
    expect(received.modelId).toBe('claude-sonnet-4-5-20250514');
    expect(received.latencyMs).toBe(120);
  });

  it('should emit memory:stored with correct payload shape', async () => {
    const handler = vi.fn();
    bus.on('memory:stored', handler, 'memory');

    const payload: MemoryStoredEvent = {
      nodeId: 'node-1',
      level: 'scene',
      taskId: 'task-1',
      agentName: 'ATLAS',
      tasteScore: 0.87,
    };

    await bus.emit('memory:stored', payload);

    const received = handler.mock.calls[0][0];
    expect(received.level).toBe('scene');
    expect(received.tasteScore).toBe(0.87);
  });

  it('should emit workflow:transitioned with correct payload shape', async () => {
    const handler = vi.fn();
    bus.on('workflow:transitioned', handler, 'workflow');

    const payload: WorkflowTransitionedEvent = {
      nodeId: 'wf-node-1',
      fromStatus: 'pending',
      toStatus: 'running',
      taskId: 'task-1',
      triggeredDownstream: ['wf-node-2', 'wf-node-3'],
    };

    await bus.emit('workflow:transitioned', payload);

    const received = handler.mock.calls[0][0];
    expect(received.triggeredDownstream).toHaveLength(2);
  });

  it('should emit collaboration:changed with correct payload shape', async () => {
    const handler = vi.fn();
    bus.on('collaboration:changed', handler, 'collab');

    const payload: CollaborationChangedEvent = {
      sessionId: 'session-1',
      changeType: 'merge',
      participantCount: 3,
      documentVersion: 7,
    };

    await bus.emit('collaboration:changed', payload);

    const received = handler.mock.calls[0][0];
    expect(received.changeType).toBe('merge');
    expect(received.documentVersion).toBe(7);
  });

  // ============================================================
  // Error Handling
  // ============================================================

  it('should continue executing handlers when one throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler1 = vi.fn().mockRejectedValue(new Error('Handler 1 failed'));
    const handler2 = vi.fn();

    bus.on('task:started', handler1, 'bad-module');
    bus.on('task:started', handler2, 'good-module');

    await bus.emit('task:started', {
      taskId: 'task-1',
      agentName: 'EARTH',
      title: 'Test',
      buildId: 'build-1',
      startedAt: Date.now(),
    });

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should call custom onError handler when subscriber throws', async () => {
    const onError = vi.fn();
    const errorBus = new EventBus({ onError });
    const badHandler = vi.fn().mockRejectedValue(new Error('Boom'));

    errorBus.on('task:failed', badHandler, 'failing-module');

    await errorBus.emit('task:failed', {
      taskId: 'task-1',
      agentName: 'VENUS',
      error: 'Timeout',
      durationMs: 30000,
      recoveryAttempted: false,
    });

    expect(onError).toHaveBeenCalledWith(
      'task:failed',
      expect.any(Error),
      'failing-module'
    );
  });

  it('should handle sync handler errors gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = vi.fn().mockImplementation(() => {
      throw new Error('Sync error');
    });

    bus.on('task:completed', handler, 'sync-error-module');

    await bus.emit('task:completed', {
      taskId: 'task-1',
      agentName: 'MARS',
      success: true,
      durationMs: 200,
      outputSize: 100,
    });

    expect(handler).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  // ============================================================
  // Event History
  // ============================================================

  it('should record event history', async () => {
    await bus.emit('task:started', {
      taskId: 'task-1',
      agentName: 'EARTH',
      title: 'Task 1',
      buildId: 'build-1',
      startedAt: Date.now(),
    });
    await bus.emit('task:completed', {
      taskId: 'task-1',
      agentName: 'EARTH',
      success: true,
      durationMs: 500,
      outputSize: 1024,
    });

    const history = bus.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].eventName).toBe('task:started');
    expect(history[1].eventName).toBe('task:completed');
  });

  it('should filter history by event name', async () => {
    await bus.emit('task:started', {
      taskId: 'task-1',
      agentName: 'EARTH',
      title: 'Task 1',
      buildId: 'build-1',
      startedAt: Date.now(),
    });
    await bus.emit('model:selected', {
      agentName: 'EARTH',
      taskId: 'task-1',
      modelId: 'gpt-4o',
      modelName: 'GPT-4o',
      routingReason: 'default',
    });
    await bus.emit('task:started', {
      taskId: 'task-2',
      agentName: 'MARS',
      title: 'Task 2',
      buildId: 'build-1',
      startedAt: Date.now(),
    });

    const filtered = bus.getHistory('task:started');
    expect(filtered).toHaveLength(2);
    expect(filtered.every(e => e.eventName === 'task:started')).toBe(true);
  });

  it('should track subscriber count in history', async () => {
    bus.on('task:started', vi.fn(), 'mod-a');
    bus.on('task:started', vi.fn(), 'mod-b');

    await bus.emit('task:started', {
      taskId: 'task-1',
      agentName: 'EARTH',
      title: 'Test',
      buildId: 'build-1',
      startedAt: Date.now(),
    });

    const history = bus.getHistory();
    expect(history[0].subscriberCount).toBe(2);
  });

  it('should respect maxHistorySize', async () => {
    const smallBus = new EventBus({ maxHistorySize: 3 });

    for (let i = 0; i < 5; i++) {
      await smallBus.emit('task:started', {
        taskId: `task-${i}`,
        agentName: 'EARTH',
        title: `Task ${i}`,
        buildId: 'build-1',
        startedAt: Date.now(),
      });
    }

    const history = smallBus.getHistory();
    expect(history).toHaveLength(3);
    // Should keep the most recent 3
    expect((history[0].payload as TaskStartedEvent).taskId).toBe('task-2');
    expect((history[2].payload as TaskStartedEvent).taskId).toBe('task-4');
  });

  it('should disable history when configured', async () => {
    const noHistoryBus = new EventBus({ enableHistory: false });

    await noHistoryBus.emit('task:started', {
      taskId: 'task-1',
      agentName: 'EARTH',
      title: 'Test',
      buildId: 'build-1',
      startedAt: Date.now(),
    });

    expect(noHistoryBus.getHistory()).toHaveLength(0);
  });

  it('should get recent events', async () => {
    for (let i = 0; i < 10; i++) {
      await bus.emit('task:started', {
        taskId: `task-${i}`,
        agentName: 'EARTH',
        title: `Task ${i}`,
        buildId: 'build-1',
        startedAt: Date.now(),
      });
    }

    const recent = bus.getRecentEvents(3);
    expect(recent).toHaveLength(3);
    expect((recent[0].payload as TaskStartedEvent).taskId).toBe('task-7');
  });

  it('should clear history', async () => {
    await bus.emit('task:started', {
      taskId: 'task-1',
      agentName: 'EARTH',
      title: 'Test',
      buildId: 'build-1',
      startedAt: Date.now(),
    });

    bus.clearHistory();
    expect(bus.getHistory()).toHaveLength(0);
  });

  // ============================================================
  // Module Management
  // ============================================================

  it('should remove all subscriptions for a module', async () => {
    bus.on('task:started', vi.fn(), 'model-routing');
    bus.on('task:completed', vi.fn(), 'model-routing');
    bus.on('task:started', vi.fn(), 'observability');

    const removed = bus.removeAllForModule('model-routing');

    expect(removed).toBe(2);
    expect(bus.subscriberCount('task:started')).toBe(1);
    expect(bus.subscriberCount('task:completed')).toBe(0);
  });

  it('should report subscribed modules', () => {
    bus.on('task:started', vi.fn(), 'model-routing');
    bus.on('task:completed', vi.fn(), 'observability');
    bus.on('memory:stored', vi.fn(), 'infinite-memory');

    const modules = bus.getSubscribedModules();
    expect(modules).toContain('model-routing');
    expect(modules).toContain('observability');
    expect(modules).toContain('infinite-memory');
    expect(modules).toHaveLength(3);
  });

  it('should report active event names', () => {
    bus.on('task:started', vi.fn(), 'test');
    bus.on('model:selected', vi.fn(), 'test');

    const active = bus.getActiveEventNames();
    expect(active).toContain('task:started');
    expect(active).toContain('model:selected');
    expect(active).toHaveLength(2);
  });

  it('should report subscriber count per event', () => {
    bus.on('task:started', vi.fn(), 'mod-a');
    bus.on('task:started', vi.fn(), 'mod-b');
    bus.on('task:started', vi.fn(), 'mod-c');

    expect(bus.subscriberCount('task:started')).toBe(3);
    expect(bus.subscriberCount('task:completed')).toBe(0);
  });

  it('should report total subscriber count', () => {
    bus.on('task:started', vi.fn(), 'mod-a');
    bus.on('task:completed', vi.fn(), 'mod-b');
    bus.on('model:selected', vi.fn(), 'mod-c');

    expect(bus.totalSubscriberCount()).toBe(3);
  });

  // ============================================================
  // Clear / Reset
  // ============================================================

  it('should clear all subscriptions and history', async () => {
    bus.on('task:started', vi.fn(), 'test');
    await bus.emit('task:started', {
      taskId: 'task-1',
      agentName: 'EARTH',
      title: 'Test',
      buildId: 'build-1',
      startedAt: Date.now(),
    });

    bus.clear();

    expect(bus.totalSubscriberCount()).toBe(0);
    expect(bus.getHistory()).toHaveLength(0);
    expect(bus.getActiveEventNames()).toHaveLength(0);
  });

  // ============================================================
  // Singleton
  // ============================================================

  it('should return same global instance', () => {
    resetGlobalEventBus();
    const bus1 = getGlobalEventBus();
    const bus2 = getGlobalEventBus();
    expect(bus1).toBe(bus2);
  });

  it('should reset global instance', () => {
    const bus1 = getGlobalEventBus();
    bus1.on('task:started', vi.fn(), 'test');

    resetGlobalEventBus();
    const bus2 = getGlobalEventBus();

    expect(bus2.totalSubscriberCount()).toBe(0);
    expect(bus1).not.toBe(bus2);
  });

  // ============================================================
  // Integration: Cross-Module Communication
  // ============================================================

  it('should support cross-module event flow: routing → observability → memory', async () => {
    const routingEvents: string[] = [];
    const observabilityEvents: string[] = [];
    const memoryEvents: string[] = [];

    // Observability listens to everything
    bus.on('model:selected', (e) => {
      observabilityEvents.push(`span:model:${e.modelId}`);
    }, 'observability');
    bus.on('task:completed', (e) => {
      observabilityEvents.push(`span:task:${e.taskId}`);
    }, 'observability');
    bus.on('memory:stored', (e) => {
      observabilityEvents.push(`span:memory:${e.nodeId}`);
    }, 'observability');

    // Model routing emits selection
    await bus.emit('model:selected', {
      agentName: 'EARTH',
      taskId: 'task-1',
      modelId: 'claude-sonnet',
      modelName: 'Claude Sonnet',
      routingReason: 'Best for code',
    });
    routingEvents.push('selected');

    // Task completes
    await bus.emit('task:completed', {
      taskId: 'task-1',
      agentName: 'EARTH',
      success: true,
      durationMs: 1000,
      outputSize: 2048,
    });

    // Memory stores result
    await bus.emit('memory:stored', {
      nodeId: 'mem-1',
      level: 'scene',
      taskId: 'task-1',
      agentName: 'EARTH',
      tasteScore: 0.92,
    });
    memoryEvents.push('stored');

    // Verify observability saw all 3 events
    expect(observabilityEvents).toHaveLength(3);
    expect(observabilityEvents[0]).toContain('model');
    expect(observabilityEvents[1]).toContain('task');
    expect(observabilityEvents[2]).toContain('memory');
  });

  it('should support build lifecycle flow: start → tasks → complete', async () => {
    const timeline: string[] = [];

    bus.on('build:started', () => timeline.push('build:start'), 'workflow');
    bus.on('task:started', (e) => timeline.push(`task:start:${e.taskId}`), 'workflow');
    bus.on('task:completed', (e) => timeline.push(`task:done:${e.taskId}`), 'workflow');
    bus.on('build:completed', () => timeline.push('build:done'), 'workflow');

    await bus.emit('build:started', {
      buildId: 'b-1',
      prdId: 'prd-1',
      prdName: 'Test PRD',
      totalTasks: 2,
      enabledModules: ['modelRouting'],
    });

    await bus.emit('task:started', {
      taskId: 't-1',
      agentName: 'EARTH',
      title: 'Task 1',
      buildId: 'b-1',
      startedAt: Date.now(),
    });
    await bus.emit('task:completed', {
      taskId: 't-1',
      agentName: 'EARTH',
      success: true,
      durationMs: 500,
      outputSize: 100,
    });

    await bus.emit('task:started', {
      taskId: 't-2',
      agentName: 'MARS',
      title: 'Task 2',
      buildId: 'b-1',
      startedAt: Date.now(),
    });
    await bus.emit('task:completed', {
      taskId: 't-2',
      agentName: 'MARS',
      success: true,
      durationMs: 300,
      outputSize: 200,
    });

    await bus.emit('build:completed', {
      buildId: 'b-1',
      totalTasks: 2,
      successfulTasks: 2,
      failedTasks: 0,
      totalDurationMs: 800,
    });

    expect(timeline).toEqual([
      'build:start',
      'task:start:t-1',
      'task:done:t-1',
      'task:start:t-2',
      'task:done:t-2',
      'build:done',
    ]);
  });
});
