// KMS-28: WebSocket Build Events Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WSBuildEventStream,
  BuildEventStreamManager,
  getGlobalStreamManager,
  resetGlobalStreamManager,
  type BuildEvent,
} from '../ws-build-events.js';
import { EventBus } from '../../orchestrator/event-bus.js';

describe('WSBuildEventStream', () => {
  let eventBus: EventBus;
  let stream: WSBuildEventStream;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();
    stream = new WSBuildEventStream(eventBus);
  });

  describe('initialization', () => {
    it('should create with event bus', () => {
      expect(stream).toBeDefined();
      expect(stream.isActive()).toBe(false);
    });

    it('should have zero subscribers initially', () => {
      expect(stream.getSubscriberCount()).toBe(0);
    });
  });

  describe('start/stop', () => {
    it('should start listening to events', () => {
      stream.start();
      expect(stream.isActive()).toBe(true);
    });

    it('should stop listening to events', () => {
      stream.start();
      stream.stop();
      expect(stream.isActive()).toBe(false);
    });

    it('should handle multiple start calls', () => {
      stream.start();
      stream.start(); // Should not throw
      expect(stream.isActive()).toBe(true);
    });

    it('should handle stop without start', () => {
      expect(() => stream.stop()).not.toThrow();
    });
  });

  describe('subscription', () => {
    it('should subscribe to events', () => {
      const callback = vi.fn();
      const unsubscribe = stream.subscribe(callback);
      
      expect(stream.getSubscriberCount()).toBe(1);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe from events', () => {
      const callback = vi.fn();
      const unsubscribe = stream.subscribe(callback);
      
      unsubscribe();
      
      expect(stream.getSubscriberCount()).toBe(0);
    });

    it('should allow multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      stream.subscribe(callback1);
      stream.subscribe(callback2);
      
      expect(stream.getSubscriberCount()).toBe(2);
    });
  });

  describe('event emission', () => {
    it('should emit build.started event', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();

      await eventBus.emit('build:started', {
        buildId: 'build-1',
        prdId: 'prd-1',
        prdName: 'Test PRD',
        totalTasks: 10,
        enabledModules: ['model-routing'],
      });

      expect(callback).toHaveBeenCalled();
      const event = callback.mock.calls[0][0] as BuildEvent;
      expect(event.type).toBe('build.started');
      expect(event.data.buildId).toBe('build-1');
    });

    it('should emit build.completed event', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();

      await eventBus.emit('build:completed', {
        buildId: 'build-1',
        totalTasks: 10,
        successfulTasks: 9,
        failedTasks: 1,
        totalDurationMs: 60000,
      });

      expect(callback).toHaveBeenCalled();
      const event = callback.mock.calls[0][0] as BuildEvent;
      expect(event.type).toBe('build.completed');
      expect(event.data.successfulTasks).toBe(9);
    });

    it('should emit task.completed event', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();

      await eventBus.emit('task:completed', {
        taskId: 'task-1',
        agentName: 'Kimi',
        success: true,
        durationMs: 5000,
        outputSize: 1024,
      });

      expect(callback).toHaveBeenCalled();
      const event = callback.mock.calls[0][0] as BuildEvent;
      expect(event.type).toBe('task.completed');
      expect(event.data.agentName).toBe('Kimi');
    });

    it('should emit memory.stored event', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();

      await eventBus.emit('memory:stored', {
        nodeId: 'node-1',
        level: 'scene',
        taskId: 'task-1',
        agentName: 'Kimi',
        tasteScore: 0.85,
      });

      expect(callback).toHaveBeenCalled();
      const event = callback.mock.calls[0][0] as BuildEvent;
      expect(event.type).toBe('memory.stored');
      expect(event.data.level).toBe('scene');
    });

    it('should emit model.selected event', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();

      await eventBus.emit('model:selected', {
        agentName: 'Kimi',
        taskId: 'task-1',
        modelId: 'gpt-4',
        modelName: 'GPT-4',
        routingReason: 'Best for coding',
        latencyMs: 150,
      });

      expect(callback).toHaveBeenCalled();
      const event = callback.mock.calls[0][0] as BuildEvent;
      expect(event.type).toBe('model.selected');
      expect(event.data.modelId).toBe('gpt-4');
    });

    it('should not emit events before start', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      // Don't start the stream

      await eventBus.emit('build:started', {
        buildId: 'build-1',
        prdId: 'prd-1',
        prdName: 'Test',
        totalTasks: 10,
        enabledModules: [],
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not emit events after stop', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();
      stream.stop();

      await eventBus.emit('build:started', {
        buildId: 'build-1',
        prdId: 'prd-1',
        prdName: 'Test',
        totalTasks: 10,
        enabledModules: [],
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('event format', () => {
    it('should include event id', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();

      await eventBus.emit('build:started', {
        buildId: 'build-1',
        prdId: 'prd-1',
        prdName: 'Test',
        totalTasks: 10,
        enabledModules: [],
      });

      const event = callback.mock.calls[0][0] as BuildEvent;
      expect(event.id).toBeDefined();
      expect(typeof event.id).toBe('string');
    });

    it('should include timestamp', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();

      await eventBus.emit('build:started', {
        buildId: 'build-1',
        prdId: 'prd-1',
        prdName: 'Test',
        totalTasks: 10,
        enabledModules: [],
      });

      const event = callback.mock.calls[0][0] as BuildEvent;
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('should include data object', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();

      await eventBus.emit('build:started', {
        buildId: 'build-1',
        prdId: 'prd-1',
        prdName: 'Test',
        totalTasks: 10,
        enabledModules: ['model-routing'],
      });

      const event = callback.mock.calls[0][0] as BuildEvent;
      expect(event.data).toBeDefined();
      expect(event.data.buildId).toBe('build-1');
      expect(event.data.enabledModules).toEqual(['model-routing']);
    });
  });

  describe('SSE conversion', () => {
    it('should convert event to SSE format', async () => {
      const callback = vi.fn();
      stream.subscribe(callback);
      stream.start();

      await eventBus.emit('build:started', {
        buildId: 'build-1',
        prdId: 'prd-1',
        prdName: 'Test',
        totalTasks: 10,
        enabledModules: [],
      });

      const event = callback.mock.calls[0][0] as BuildEvent;
      const sse = stream.toSSE(event);

      expect(sse).toContain(`id: ${event.id}`);
      expect(sse).toContain('event: build.started');
      expect(sse).toContain('data:');
    });

    it('should return SSE headers', () => {
      const headers = stream.getSSEHeader();
      
      expect(headers['Content-Type']).toBe('text/event-stream');
      expect(headers['Cache-Control']).toBe('no-cache');
      expect(headers['Connection']).toBe('keep-alive');
    });
  });

  describe('error handling', () => {
    it('should handle subscriber errors gracefully', async () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Subscriber error');
      });
      const goodCallback = vi.fn();
      
      stream.subscribe(errorCallback);
      stream.subscribe(goodCallback);
      stream.start();

      // Should not throw
      await expect(eventBus.emit('build:started', {
        buildId: 'build-1',
        prdId: 'prd-1',
        prdName: 'Test',
        totalTasks: 10,
        enabledModules: [],
      })).resolves.not.toThrow();

      // Good callback should still be called
      expect(goodCallback).toHaveBeenCalled();
    });
  });
});

describe('BuildEventStreamManager', () => {
  let eventBus: EventBus;
  let manager: BuildEventStreamManager;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();
    manager = new BuildEventStreamManager(eventBus);
  });

  describe('stream management', () => {
    it('should create a stream', () => {
      const stream = manager.createStream('stream-1');
      
      expect(stream).toBeDefined();
      expect(manager.getStreamIds()).toContain('stream-1');
    });

    it('should get a stream by id', () => {
      manager.createStream('stream-1');
      
      const stream = manager.getStream('stream-1');
      expect(stream).toBeDefined();
    });

    it('should return undefined for unknown stream', () => {
      const stream = manager.getStream('unknown');
      expect(stream).toBeUndefined();
    });

    it('should remove a stream', () => {
      manager.createStream('stream-1');
      
      const removed = manager.removeStream('stream-1');
      
      expect(removed).toBe(true);
      expect(manager.getStream('stream-1')).toBeUndefined();
    });

    it('should return false when removing unknown stream', () => {
      const removed = manager.removeStream('unknown');
      expect(removed).toBe(false);
    });
  });

  describe('bulk operations', () => {
    it('should start all streams', () => {
      const stream1 = manager.createStream('stream-1');
      const stream2 = manager.createStream('stream-2');
      
      manager.startAll();
      
      expect(stream1.isActive()).toBe(true);
      expect(stream2.isActive()).toBe(true);
    });

    it('should stop all streams', () => {
      const stream1 = manager.createStream('stream-1');
      const stream2 = manager.createStream('stream-2');
      
      manager.startAll();
      manager.stopAll();
      
      expect(stream1.isActive()).toBe(false);
      expect(stream2.isActive()).toBe(false);
    });

    it('should clear all streams', () => {
      manager.createStream('stream-1');
      manager.createStream('stream-2');
      
      manager.clear();
      
      expect(manager.getStreamIds()).toHaveLength(0);
    });
  });

  describe('subscriber counting', () => {
    it('should count subscribers across all streams', () => {
      const stream1 = manager.createStream('stream-1');
      const stream2 = manager.createStream('stream-2');
      
      stream1.subscribe(() => {});
      stream1.subscribe(() => {});
      stream2.subscribe(() => {});
      
      expect(manager.getTotalSubscriberCount()).toBe(3);
    });

    it('should return zero with no streams', () => {
      expect(manager.getTotalSubscriberCount()).toBe(0);
    });
  });
});

describe('Global stream manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalStreamManager();
  });

  it('should return same global instance', () => {
    const m1 = getGlobalStreamManager();
    const m2 = getGlobalStreamManager();
    expect(m1).toBe(m2);
  });

  it('should reset global instance', () => {
    const m1 = getGlobalStreamManager();
    resetGlobalStreamManager();
    const m2 = getGlobalStreamManager();
    expect(m1).not.toBe(m2);
  });

  it('should clear streams on reset', () => {
    const manager = getGlobalStreamManager();
    manager.createStream('test');
    
    resetGlobalStreamManager();
    
    const newManager = getGlobalStreamManager();
    expect(newManager.getStreamIds()).toHaveLength(0);
  });
});
