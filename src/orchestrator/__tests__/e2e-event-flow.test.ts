// SN-18: Cross-Module Event Flow E2E Test
// Tests event bus integration across modules

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EventBus,
  type ModelSelectedEvent,
  type TaskCompletedEvent,
  type MemoryStoredEvent,
  type WorkflowTransitionedEvent,
  type BuildStartedEvent,
  type BuildCompletedEvent,
  type TaskFailedEvent,
  type SpanCreatedEvent,
  type EventName,
} from '../event-bus.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Cross-Module Event Flow', () => {
  let bus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    bus = new EventBus();
  });

  describe('Model routing → observability flow', () => {
    it('should deliver model:selected to observability subscriber', async () => {
      let received: ModelSelectedEvent | null = null;
      bus.on('model:selected', (p) => { received = p; }, 'observability');

      await bus.emit('model:selected', {
        agentName: 'EARTH',
        taskId: 'task-001',
        modelId: 'qwen2.5:7b',
        modelName: 'Qwen 2.5 7B',
        routingReason: 'hardware-match',
        latencyMs: 120,
      });

      expect(received).not.toBeNull();
      expect(received!.modelId).toBe('qwen2.5:7b');
      expect(received!.routingReason).toBe('hardware-match');
    });

    it('should deliver model:selected with agent context', async () => {
      let agentName = '';
      bus.on('model:selected', (p) => { agentName = p.agentName; }, 'observability');

      await bus.emit('model:selected', {
        agentName: 'JUPITER',
        taskId: 'task-002',
        modelId: 'qwen2.5:14b',
        modelName: 'Qwen 2.5 14B',
        routingReason: 'complexity-escalation',
      });

      expect(agentName).toBe('JUPITER');
    });
  });

  describe('Task completion → memory:stored flow', () => {
    it('should fire memory:stored after task completion', async () => {
      let memoryEvent: MemoryStoredEvent | null = null;

      // Simulate: task completes → memory module stores result
      bus.on('task:completed', async (tc) => {
        await bus.emit('memory:stored', {
          nodeId: `mem-${tc.taskId}`,
          level: 'scene',
          taskId: tc.taskId,
          agentName: tc.agentName,
          tasteScore: 0.85,
        });
      }, 'memory-module');

      bus.on('memory:stored', (p) => { memoryEvent = p; }, 'test-listener');

      await bus.emit('task:completed', {
        taskId: 'task-001',
        agentName: 'EARTH',
        success: true,
        durationMs: 5000,
        outputSize: 1024,
      });

      expect(memoryEvent).not.toBeNull();
      expect(memoryEvent!.nodeId).toBe('mem-task-001');
      expect(memoryEvent!.level).toBe('scene');
    });

    it('should not fire memory:stored for failed tasks', async () => {
      let memoryFired = false;

      bus.on('task:completed', async (tc) => {
        if (tc.success) {
          await bus.emit('memory:stored', {
            nodeId: `mem-${tc.taskId}`,
            level: 'scene',
            taskId: tc.taskId,
            agentName: tc.agentName,
          });
        }
      }, 'memory-module');

      bus.on('memory:stored', () => { memoryFired = true; }, 'test');

      await bus.emit('task:completed', {
        taskId: 'task-fail',
        agentName: 'MARS',
        success: false,
        durationMs: 3000,
        outputSize: 0,
      });

      expect(memoryFired).toBe(false);
    });
  });

  describe('Workflow transitions', () => {
    it('should emit workflow:transitioned with downstream triggers', async () => {
      let transition: WorkflowTransitionedEvent | null = null;
      bus.on('workflow:transitioned', (p) => { transition = p; }, 'observability');

      await bus.emit('workflow:transitioned', {
        nodeId: 'node-spec',
        fromStatus: 'running',
        toStatus: 'completed',
        taskId: 'task-001',
        triggeredDownstream: ['node-code', 'node-test'],
      });

      expect(transition).not.toBeNull();
      expect(transition!.triggeredDownstream).toEqual(['node-code', 'node-test']);
    });

    it('should emit transitions for sequential workflow steps', async () => {
      const transitions: string[] = [];
      bus.on('workflow:transitioned', (p) => {
        transitions.push(`${p.nodeId}:${p.toStatus}`);
      }, 'tracker');

      await bus.emit('workflow:transitioned', {
        nodeId: 'spec', fromStatus: 'pending', toStatus: 'running',
        taskId: 't1', triggeredDownstream: [],
      });
      await bus.emit('workflow:transitioned', {
        nodeId: 'spec', fromStatus: 'running', toStatus: 'completed',
        taskId: 't1', triggeredDownstream: ['code'],
      });
      await bus.emit('workflow:transitioned', {
        nodeId: 'code', fromStatus: 'pending', toStatus: 'running',
        taskId: 't2', triggeredDownstream: [],
      });

      expect(transitions).toEqual(['spec:running', 'spec:completed', 'code:running']);
    });
  });

  describe('Multiple subscribers receive same event', () => {
    it('should deliver to all subscribers of task:completed', async () => {
      const receivers: string[] = [];

      bus.on('task:completed', () => { receivers.push('observability'); }, 'observability');
      bus.on('task:completed', () => { receivers.push('memory'); }, 'memory');
      bus.on('task:completed', () => { receivers.push('workflow'); }, 'workflow');

      await bus.emit('task:completed', {
        taskId: 'task-001', agentName: 'EARTH',
        success: true, durationMs: 1000, outputSize: 512,
      });

      expect(receivers).toHaveLength(3);
      expect(receivers).toContain('observability');
      expect(receivers).toContain('memory');
      expect(receivers).toContain('workflow');
    });

    it('should deliver build:started to all interested modules', async () => {
      let obsReceived = false;
      let memReceived = false;

      bus.on('build:started', () => { obsReceived = true; }, 'observability');
      bus.on('build:started', () => { memReceived = true; }, 'memory');

      await bus.emit('build:started', {
        buildId: 'build-001', prdId: 'prd-001', prdName: 'Test',
        totalTasks: 5, enabledModules: ['model-routing', 'observability'],
      });

      expect(obsReceived).toBe(true);
      expect(memReceived).toBe(true);
    });
  });

  describe('Event history recording', () => {
    it('should record all emitted events', async () => {
      await bus.emit('build:started', {
        buildId: 'b1', prdId: 'p1', prdName: 'Test',
        totalTasks: 3, enabledModules: [],
      });
      await bus.emit('task:completed', {
        taskId: 't1', agentName: 'E', success: true, durationMs: 100, outputSize: 50,
      });
      await bus.emit('build:completed', {
        buildId: 'b1', totalTasks: 3, successfulTasks: 3,
        failedTasks: 0, totalDurationMs: 300,
      });

      expect(bus.getHistory()).toHaveLength(3);
    });

    it('should filter history by event name', async () => {
      await bus.emit('task:completed', {
        taskId: 't1', agentName: 'E', success: true, durationMs: 100, outputSize: 50,
      });
      await bus.emit('task:failed', {
        taskId: 't2', agentName: 'M', error: 'crash', durationMs: 200, recoveryAttempted: false,
      });
      await bus.emit('task:completed', {
        taskId: 't3', agentName: 'V', success: true, durationMs: 150, outputSize: 80,
      });

      expect(bus.getHistory('task:completed')).toHaveLength(2);
      expect(bus.getHistory('task:failed')).toHaveLength(1);
    });

    it('should include subscriber count in history', async () => {
      bus.on('model:selected', () => {}, 'sub1');
      bus.on('model:selected', () => {}, 'sub2');

      await bus.emit('model:selected', {
        agentName: 'E', taskId: 't1', modelId: 'm1',
        modelName: 'Test', routingReason: 'default',
      });

      const history = bus.getHistory('model:selected');
      expect(history[0].subscriberCount).toBe(2);
    });

    it('should return recent events via getRecentEvents', async () => {
      for (let i = 0; i < 5; i++) {
        await bus.emit('span:created', {
          spanId: `span-${i}`, operationName: 'test', moduleName: 'obs',
        });
      }

      const recent = bus.getRecentEvents(3);
      expect(recent).toHaveLength(3);
    });
  });

  describe('Module removal stops its events', () => {
    it('should stop receiving events after module unsubscribes', async () => {
      let callCount = 0;
      const unsub = bus.on('task:completed', () => { callCount++; }, 'removable-module');

      await bus.emit('task:completed', {
        taskId: 't1', agentName: 'E', success: true, durationMs: 100, outputSize: 50,
      });
      expect(callCount).toBe(1);

      unsub();

      await bus.emit('task:completed', {
        taskId: 't2', agentName: 'M', success: true, durationMs: 200, outputSize: 100,
      });
      expect(callCount).toBe(1);
    });

    it('should remove all subscriptions for a module via removeAllForModule', async () => {
      bus.on('task:completed', () => {}, 'dying-module');
      bus.on('task:started', () => {}, 'dying-module');
      bus.on('build:started', () => {}, 'surviving-module');

      const removed = bus.removeAllForModule('dying-module');
      expect(removed).toBe(2);
      expect(bus.subscriberCount('task:completed')).toBe(0);
      expect(bus.subscriberCount('build:started')).toBe(1);
    });

    it('should list only surviving modules after removal', () => {
      bus.on('task:completed', () => {}, 'modA');
      bus.on('task:completed', () => {}, 'modB');

      bus.removeAllForModule('modA');

      const modules = bus.getSubscribedModules();
      expect(modules).toContain('modB');
      expect(modules).not.toContain('modA');
    });
  });

  describe('Error resilience in event flow', () => {
    it('should continue to next subscriber when one throws', async () => {
      let healthyReceived = false;

      bus.on('task:completed', () => { throw new Error('crash'); }, 'broken');
      bus.on('task:completed', () => { healthyReceived = true; }, 'healthy');

      await bus.emit('task:completed', {
        taskId: 't1', agentName: 'E', success: true, durationMs: 100, outputSize: 50,
      });

      expect(healthyReceived).toBe(true);
    });

    it('should invoke custom onError handler when provided', async () => {
      const errors: string[] = [];
      const errorBus = new EventBus({
        onError: (eventName, _error, moduleName) => {
          errors.push(`${moduleName}:${eventName}`);
        },
      });

      errorBus.on('task:failed', () => { throw new Error('boom'); }, 'broken-mod');

      await errorBus.emit('task:failed', {
        taskId: 't1', agentName: 'E', error: 'fail', durationMs: 100, recoveryAttempted: false,
      });

      expect(errors).toEqual(['broken-mod:task:failed']);
    });
  });

  describe('Full build event flow simulation', () => {
    it('should emit events in correct order for a full build', async () => {
      const eventOrder: string[] = [];

      bus.on('build:started', () => { eventOrder.push('build:started'); }, 'test');
      bus.on('model:selected', () => { eventOrder.push('model:selected'); }, 'test');
      bus.on('task:completed', () => { eventOrder.push('task:completed'); }, 'test');
      bus.on('memory:stored', () => { eventOrder.push('memory:stored'); }, 'test');
      bus.on('build:completed', () => { eventOrder.push('build:completed'); }, 'test');

      await bus.emit('build:started', {
        buildId: 'b1', prdId: 'p1', prdName: 'Test',
        totalTasks: 1, enabledModules: ['model-routing'],
      });
      await bus.emit('model:selected', {
        agentName: 'E', taskId: 't1', modelId: 'm1',
        modelName: 'Model', routingReason: 'default',
      });
      await bus.emit('task:completed', {
        taskId: 't1', agentName: 'E', success: true, durationMs: 100, outputSize: 50,
      });
      await bus.emit('memory:stored', {
        nodeId: 'n1', level: 'scene', taskId: 't1', agentName: 'E',
      });
      await bus.emit('build:completed', {
        buildId: 'b1', totalTasks: 1, successfulTasks: 1,
        failedTasks: 0, totalDurationMs: 100,
      });

      expect(eventOrder).toEqual([
        'build:started', 'model:selected', 'task:completed',
        'memory:stored', 'build:completed',
      ]);
    });

    it('should emit task:failed for error paths', async () => {
      let failEvent: TaskFailedEvent | null = null;
      bus.on('task:failed', (p) => { failEvent = p; }, 'test');

      await bus.emit('task:failed', {
        taskId: 'bad-task', agentName: 'MARS',
        error: 'Compilation error', durationMs: 3000, recoveryAttempted: true,
      });

      expect(failEvent).not.toBeNull();
      expect(failEvent!.recoveryAttempted).toBe(true);
    });

    it('should support span:created for observability tracing', async () => {
      const spans: SpanCreatedEvent[] = [];
      bus.on('span:created', (p) => { spans.push(p); }, 'observability');

      await bus.emit('span:created', {
        spanId: 'root', operationName: 'build', moduleName: 'orchestrator',
      });
      await bus.emit('span:created', {
        spanId: 'child', parentSpanId: 'root',
        operationName: 'task', moduleName: 'orchestrator',
      });

      expect(spans).toHaveLength(2);
      expect(spans[1].parentSpanId).toBe('root');
    });

    it('should track total subscriber count across all events', () => {
      bus.on('task:completed', () => {}, 'a');
      bus.on('task:failed', () => {}, 'b');
      bus.on('build:started', () => {}, 'c');

      expect(bus.totalSubscriberCount()).toBe(3);
    });
  });

  describe('Once subscriptions', () => {
    it('should fire once handler only one time', async () => {
      let count = 0;
      bus.once('build:completed', () => { count++; }, 'test');

      await bus.emit('build:completed', {
        buildId: 'b1', totalTasks: 1, successfulTasks: 1,
        failedTasks: 0, totalDurationMs: 100,
      });
      await bus.emit('build:completed', {
        buildId: 'b2', totalTasks: 1, successfulTasks: 1,
        failedTasks: 0, totalDurationMs: 200,
      });

      expect(count).toBe(1);
    });
  });

  describe('History with disabled recording', () => {
    it('should not record history when enableHistory is false', async () => {
      const noHistoryBus = new EventBus({ enableHistory: false });

      await noHistoryBus.emit('task:completed', {
        taskId: 't1', agentName: 'E', success: true, durationMs: 100, outputSize: 50,
      });

      expect(noHistoryBus.getHistory()).toHaveLength(0);
    });
  });

  describe('Event bus lifecycle', () => {
    it('should clear all subscriptions and history', () => {
      bus.on('task:completed', () => {}, 'mod');
      bus.clear();

      expect(bus.totalSubscriberCount()).toBe(0);
      expect(bus.getHistory()).toHaveLength(0);
    });

    it('should report active event names', () => {
      bus.on('model:selected', () => {}, 'mod');
      bus.on('task:completed', () => {}, 'mod');

      const active = bus.getActiveEventNames();
      expect(active).toContain('model:selected');
      expect(active).toContain('task:completed');
    });
  });
});
