// SN-13: Event Payload Contract Tests
// Verifies all EventBus event types have correct payload shapes

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EventBus,
  type EventMap,
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
  type ResearchCompletedEvent,
  type SpanCreatedEvent,
} from '../event-bus.js';

// ---------------------------------------------------------------------------
// Valid Payload Fixtures
// ---------------------------------------------------------------------------

const validPayloads: Record<EventName, EventMap[EventName]> = {
  'model:selected': {
    agentName: 'EARTH',
    taskId: 'task-001',
    modelId: 'qwen2.5-7b',
    modelName: 'Qwen 2.5 7B',
    routingReason: 'hardware-match',
    latencyMs: 150,
  } satisfies ModelSelectedEvent,
  'task:started': {
    taskId: 'task-001',
    agentName: 'EARTH',
    title: 'Write spec',
    buildId: 'build-001',
    startedAt: Date.now(),
  } satisfies TaskStartedEvent,
  'task:completed': {
    taskId: 'task-001',
    agentName: 'EARTH',
    success: true,
    durationMs: 5000,
    outputSize: 1024,
    aceScore: 92,
  } satisfies TaskCompletedEvent,
  'task:failed': {
    taskId: 'task-001',
    agentName: 'MARS',
    error: 'Compilation error in output',
    durationMs: 3000,
    recoveryAttempted: true,
  } satisfies TaskFailedEvent,
  'memory:stored': {
    nodeId: 'mem-001',
    level: 'scene',
    taskId: 'task-001',
    agentName: 'EARTH',
    tasteScore: 0.85,
  } satisfies MemoryStoredEvent,
  'workflow:transitioned': {
    nodeId: 'node-001',
    fromStatus: 'pending',
    toStatus: 'running',
    taskId: 'task-001',
    triggeredDownstream: ['node-002', 'node-003'],
  } satisfies WorkflowTransitionedEvent,
  'collaboration:changed': {
    sessionId: 'session-001',
    changeType: 'merge',
    participantCount: 3,
    documentVersion: 7,
  } satisfies CollaborationChangedEvent,
  'build:started': {
    buildId: 'build-001',
    prdId: 'prd-001',
    prdName: 'Test PRD',
    totalTasks: 5,
    enabledModules: ['model-routing', 'observability'],
  } satisfies BuildStartedEvent,
  'build:completed': {
    buildId: 'build-001',
    totalTasks: 5,
    successfulTasks: 4,
    failedTasks: 1,
    totalDurationMs: 25000,
  } satisfies BuildCompletedEvent,
  'research:completed': {
    taskId: 'task-001',
    queryCount: 3,
    relevanceScore: 0.87,
    cachedResults: 1,
  } satisfies ResearchCompletedEvent,
  'span:created': {
    spanId: 'span-001',
    parentSpanId: 'span-000',
    operationName: 'agent-call',
    moduleName: 'observability',
  } satisfies SpanCreatedEvent,
};

const ALL_EVENT_NAMES: EventName[] = Object.keys(validPayloads) as EventName[];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Contract: Event Payloads', () => {
  let bus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = new EventBus();
  });

  describe('All event types emit and receive correctly', () => {
    for (const eventName of ALL_EVENT_NAMES) {
      it(`${eventName}: should emit and receive valid payload`, async () => {
        let received: unknown = null;
        bus.on(eventName, (payload) => { received = payload; }, 'test');

        await bus.emit(eventName, validPayloads[eventName]);

        expect(received).toEqual(validPayloads[eventName]);
      });
    }
  });

  describe('Payload shape validation', () => {
    it('model:selected should have required fields', async () => {
      let payload: ModelSelectedEvent | null = null;
      bus.on('model:selected', (p) => { payload = p; }, 'test');
      await bus.emit('model:selected', validPayloads['model:selected']);

      expect(payload).not.toBeNull();
      expect(typeof payload!.agentName).toBe('string');
      expect(typeof payload!.taskId).toBe('string');
      expect(typeof payload!.modelId).toBe('string');
      expect(typeof payload!.modelName).toBe('string');
      expect(typeof payload!.routingReason).toBe('string');
    });

    it('task:completed should include success boolean and duration number', async () => {
      let payload: TaskCompletedEvent | null = null;
      bus.on('task:completed', (p) => { payload = p; }, 'test');
      await bus.emit('task:completed', validPayloads['task:completed']);

      expect(typeof payload!.success).toBe('boolean');
      expect(typeof payload!.durationMs).toBe('number');
      expect(typeof payload!.outputSize).toBe('number');
    });

    it('memory:stored should include level from valid set', async () => {
      let payload: MemoryStoredEvent | null = null;
      bus.on('memory:stored', (p) => { payload = p; }, 'test');
      await bus.emit('memory:stored', validPayloads['memory:stored']);

      expect(['scene', 'episode', 'project', 'portfolio']).toContain(payload!.level);
    });

    it('collaboration:changed should include valid changeType', async () => {
      let payload: CollaborationChangedEvent | null = null;
      bus.on('collaboration:changed', (p) => { payload = p; }, 'test');
      await bus.emit('collaboration:changed', validPayloads['collaboration:changed']);

      expect(['merge', 'conflict', 'resolve', 'broadcast']).toContain(payload!.changeType);
    });

    it('workflow:transitioned should include string arrays for downstream', async () => {
      let payload: WorkflowTransitionedEvent | null = null;
      bus.on('workflow:transitioned', (p) => { payload = p; }, 'test');
      await bus.emit('workflow:transitioned', validPayloads['workflow:transitioned']);

      expect(Array.isArray(payload!.triggeredDownstream)).toBe(true);
      payload!.triggeredDownstream.forEach(id => {
        expect(typeof id).toBe('string');
      });
    });
  });

  describe('Event history records payloads', () => {
    it('should record all 11 event types in history', async () => {
      for (const eventName of ALL_EVENT_NAMES) {
        await bus.emit(eventName, validPayloads[eventName]);
      }

      const history = bus.getHistory();
      expect(history).toHaveLength(11);
    });

    it('should filter history by event name', async () => {
      await bus.emit('task:started', validPayloads['task:started']);
      await bus.emit('task:completed', validPayloads['task:completed']);
      await bus.emit('task:started', validPayloads['task:started']);

      const taskStartHistory = bus.getHistory('task:started');
      expect(taskStartHistory).toHaveLength(2);
    });

    it('should preserve payload in history entries', async () => {
      await bus.emit('build:started', validPayloads['build:started']);

      const history = bus.getHistory('build:started');
      expect(history[0].payload).toEqual(validPayloads['build:started']);
    });

    it('should include subscriber count in history entries', async () => {
      bus.on('task:completed', () => {}, 'sub1');
      bus.on('task:completed', () => {}, 'sub2');

      await bus.emit('task:completed', validPayloads['task:completed']);

      const history = bus.getHistory('task:completed');
      expect(history[0].subscriberCount).toBe(2);
    });
  });

  describe('Subscriber management', () => {
    it('should report correct subscriber count per event', () => {
      bus.on('model:selected', () => {}, 'mod1');
      bus.on('model:selected', () => {}, 'mod2');
      bus.on('task:started', () => {}, 'mod3');

      expect(bus.subscriberCount('model:selected')).toBe(2);
      expect(bus.subscriberCount('task:started')).toBe(1);
      expect(bus.subscriberCount('task:failed')).toBe(0);
    });

    it('should unsubscribe correctly', async () => {
      let callCount = 0;
      const unsub = bus.on('task:completed', () => { callCount++; }, 'test');

      await bus.emit('task:completed', validPayloads['task:completed']);
      expect(callCount).toBe(1);

      unsub();
      await bus.emit('task:completed', validPayloads['task:completed']);
      expect(callCount).toBe(1); // not called again
    });

    it('should support once subscriptions', async () => {
      let callCount = 0;
      bus.once('build:completed', () => { callCount++; }, 'test');

      await bus.emit('build:completed', validPayloads['build:completed']);
      await bus.emit('build:completed', validPayloads['build:completed']);

      expect(callCount).toBe(1);
    });

    it('should remove all subscriptions for a module', () => {
      bus.on('task:started', () => {}, 'myModule');
      bus.on('task:completed', () => {}, 'myModule');
      bus.on('task:failed', () => {}, 'otherModule');

      const removed = bus.removeAllForModule('myModule');
      expect(removed).toBe(2);
      expect(bus.subscriberCount('task:started')).toBe(0);
      expect(bus.subscriberCount('task:failed')).toBe(1);
    });
  });

  describe('Error resilience', () => {
    it('should continue delivering to other subscribers when one throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let healthyReceived = false;

      bus.on('task:completed', () => { throw new Error('Handler crash'); }, 'broken');
      bus.on('task:completed', () => { healthyReceived = true; }, 'healthy');

      await bus.emit('task:completed', validPayloads['task:completed']);

      expect(healthyReceived).toBe(true);
      consoleSpy.mockRestore();
    });
  });
});
