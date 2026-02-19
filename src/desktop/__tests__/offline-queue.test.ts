// Offline Queue Tests — R20-02
// Comprehensive tests for offline action queue and sync engine

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OfflineQueue,
  createOfflineQueue,
  DEFAULT_OFFLINE_CONFIG,
  type OfflineQueueConfig,
} from '../offline-queue.js';
import type { SyncQueueItem } from '../types.js';

// Mock console to reduce test noise
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('OfflineQueue', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T00:00:00.000Z'));
    queue = new OfflineQueue();
  });

  describe('Enqueue', () => {
    it('enqueue adds item to queue', async () => {
      queue = new OfflineQueue({ autoFlush: false });
      const id = await queue.enqueue('create', '/test/file.txt', 'content');

      const items = queue.getQueue();
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(id);
      expect(items[0]?.action).toBe('create');
      expect(items[0]?.path).toBe('/test/file.txt');
      expect(items[0]?.content).toBe('content');
    });

    it('enqueue returns item ID', async () => {
      queue = new OfflineQueue({ autoFlush: false });
      const id = await queue.enqueue('update', '/test/file.txt');

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^sync-\d+-[a-z0-9]+$/);
    });

    it('enqueue throws when queue is full', async () => {
      const smallQueue = new OfflineQueue({ maxQueueSize: 2, autoFlush: false });

      await smallQueue.enqueue('create', '/file1.txt');
      await smallQueue.enqueue('create', '/file2.txt');

      await expect(smallQueue.enqueue('create', '/file3.txt')).rejects.toThrow(
        'Queue is full'
      );
    });

    it('enqueue includes timestamp', async () => {
      queue = new OfflineQueue({ autoFlush: false });
      const beforeTime = Date.now();
      await queue.enqueue('delete', '/test/file.txt');
      const afterTime = Date.now();

      const items = queue.getQueue();
      expect(items[0]?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(items[0]?.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Flush', () => {
    it('flush processes pending items', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      queue = new OfflineQueue({ autoFlush: false });
      queue.onFlush(callback);

      await queue.enqueue('create', '/file1.txt', 'content1');
      await queue.enqueue('update', '/file2.txt', 'content2');

      const result = await queue.flush();

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('flush marks items as synced', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      queue = new OfflineQueue({ autoFlush: false });
      queue.onFlush(callback);

      await queue.enqueue('create', '/file.txt', 'content');
      await queue.flush();

      const pending = queue.getPending();
      expect(pending).toHaveLength(0);
    });

    it('flush calls flush callbacks', async () => {
      const callback1 = vi.fn().mockResolvedValue(undefined);
      const callback2 = vi.fn().mockResolvedValue(undefined);

      queue = new OfflineQueue({ autoFlush: false });
      queue.onFlush(callback1);
      queue.onFlush(callback2);

      await queue.enqueue('create', '/file.txt', 'content');
      await queue.flush();

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it('flush returns processed count', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      queue = new OfflineQueue({ autoFlush: false });
      queue.onFlush(callback);

      await queue.enqueue('create', '/file1.txt');
      await queue.enqueue('update', '/file2.txt');
      await queue.enqueue('delete', '/file3.txt');

      const result = await queue.flush();

      expect(result.processed).toBe(3);
    });
  });

  describe('Conflict Resolution', () => {
    it('last-write-wins strategy resolves conflicts automatically', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('conflict detected'));
      queue = new OfflineQueue({
        autoFlush: false,
        conflictStrategy: 'last-write-wins',
      });
      queue.onFlush(callback);

      await queue.enqueue('update', '/file.txt', 'new content');
      const result = await queue.flush();

      expect(result.processed).toBe(1);
      expect(result.conflicts).toHaveLength(1);
    });

    it('merge strategy resolves conflicts automatically', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('version mismatch'));
      queue = new OfflineQueue({
        autoFlush: false,
        conflictStrategy: 'merge',
      });
      queue.onFlush(callback);

      await queue.enqueue('update', '/file.txt', 'merged content');
      const result = await queue.flush();

      expect(result.processed).toBe(1);
      expect(result.conflicts).toHaveLength(1);
    });

    it('manual strategy requires resolution and marks for retry', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('conflict detected'));
      queue = new OfflineQueue({
        autoFlush: false,
        conflictStrategy: 'manual',
      });
      queue.onFlush(callback);

      await queue.enqueue('update', '/file.txt', 'content');
      const result = await queue.flush();

      // Manual strategy returns false, so item should fail
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.conflicts).toHaveLength(1);

      // Item should remain in pending state for manual resolution
      const pending = queue.getPending();
      expect(pending).toHaveLength(1);
    });

    it('conflict detection identifies conflict errors', async () => {
      const conflictErrors = [
        'conflict detected',
        'CONFLICT',
        'version mismatch',
        'VERSION MISMATCH',
      ];

      for (const errorMsg of conflictErrors) {
        const callback = vi.fn().mockRejectedValue(new Error(errorMsg));
        const testQueue = new OfflineQueue({
          autoFlush: false,
          conflictStrategy: 'last-write-wins',
        });
        testQueue.onFlush(callback);

        await testQueue.enqueue('update', '/file.txt');
        const result = await testQueue.flush();

        expect(result.conflicts).toHaveLength(1);
      }
    });

    it('non-conflict errors do not trigger conflict resolution', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('network error'));
      queue = new OfflineQueue({
        autoFlush: false,
        conflictStrategy: 'last-write-wins',
      });
      queue.onFlush(callback);

      await queue.enqueue('create', '/file.txt');
      const result = await queue.flush();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('Persistence', () => {
    it('serialize returns JSON string', async () => {
      queue = new OfflineQueue({ autoFlush: false });
      await queue.enqueue('create', '/file1.txt', 'content1');
      await queue.enqueue('update', '/file2.txt', 'content2');

      const serialized = queue.serialize();

      expect(typeof serialized).toBe('string');
      const parsed = JSON.parse(serialized);
      expect(parsed).toHaveProperty('queue');
      expect(parsed).toHaveProperty('timestamp');
      expect(Array.isArray(parsed.queue)).toBe(true);
      expect(parsed.queue).toHaveLength(2);
    });

    it('deserialize loads queue from JSON', async () => {
      const testData = {
        queue: [
          {
            id: 'sync-test-1',
            action: 'create' as const,
            path: '/loaded/file.txt',
            content: 'loaded content',
            timestamp: 1234567890,
            synced: false,
          },
        ],
        timestamp: Date.now(),
      };

      queue.deserialize(JSON.stringify(testData));

      const items = queue.getQueue();
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe('sync-test-1');
      expect(items[0]?.action).toBe('create');
      expect(items[0]?.path).toBe('/loaded/file.txt');
      expect(items[0]?.content).toBe('loaded content');
      expect(items[0]?.timestamp).toBe(1234567890);
    });

    it('getPending returns only unsynced items', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      queue = new OfflineQueue({ autoFlush: false });
      queue.onFlush(callback);

      await queue.enqueue('create', '/file1.txt');
      await queue.enqueue('update', '/file2.txt');

      // Before flush, all items are pending
      let pending = queue.getPending();
      expect(pending).toHaveLength(2);

      // After flush, no items are pending
      await queue.flush();
      pending = queue.getPending();
      expect(pending).toHaveLength(0);
    });

    it('getStats returns correct counts', async () => {
      queue = new OfflineQueue({ autoFlush: false });

      await queue.enqueue('create', '/file1.txt');
      await queue.enqueue('create', '/file2.txt');
      await queue.enqueue('update', '/file3.txt');
      await queue.enqueue('delete', '/file4.txt');

      const stats = queue.getStats();

      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(4);
      expect(stats.synced).toBe(0);
      expect(stats.byAction.create).toBe(2);
      expect(stats.byAction.update).toBe(1);
      expect(stats.byAction.delete).toBe(1);
    });

    it('clear empties the queue', async () => {
      queue = new OfflineQueue({ autoFlush: false });
      await queue.enqueue('create', '/file1.txt');
      await queue.enqueue('update', '/file2.txt');

      expect(queue.getQueue()).toHaveLength(2);

      queue.clear();

      expect(queue.getQueue()).toHaveLength(0);
      expect(queue.getStats().total).toBe(0);
    });
  });

  describe('Additional Methods', () => {
    it('getQueue returns copy of queue', async () => {
      queue = new OfflineQueue({ autoFlush: false });
      await queue.enqueue('create', '/file.txt');

      const items1 = queue.getQueue();
      const items2 = queue.getQueue();

      expect(items1).toEqual(items2);
      expect(items1).not.toBe(items2); // Different array references
    });

    it('setOnline updates online status', () => {
      queue = new OfflineQueue({ autoFlush: false });

      expect(queue.isCurrentlyOnline()).toBe(true);

      queue.setOnline(false);
      expect(queue.isCurrentlyOnline()).toBe(false);

      queue.setOnline(true);
      expect(queue.isCurrentlyOnline()).toBe(true);
    });

    it('setOnline triggers autoFlush when coming online', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      queue = new OfflineQueue({ autoFlush: true });
      queue.onFlush(callback);

      queue.setOnline(false);
      await queue.enqueue('create', '/file.txt');

      // Should not flush when offline
      expect(callback).not.toHaveBeenCalled();

      // Coming back online should trigger flush
      queue.setOnline(true);
      
      // Wait for async flush in setOnline (fire and forget with .catch)
      await vi.advanceTimersByTimeAsync(0);

      expect(callback).toHaveBeenCalledOnce();
    });

    it('remove deletes specific item', async () => {
      queue = new OfflineQueue({ autoFlush: false });

      const id1 = await queue.enqueue('create', '/file1.txt');
      const id2 = await queue.enqueue('update', '/file2.txt');

      expect(queue.getQueue()).toHaveLength(2);

      const removed = queue.remove(id1);

      expect(removed).toBe(true);
      expect(queue.getQueue()).toHaveLength(1);
      expect(queue.getQueue()[0]?.id).toBe(id2);
    });

    it('remove returns false for non-existent item', () => {
      queue = new OfflineQueue({ autoFlush: false });
      const removed = queue.remove('non-existent-id');
      expect(removed).toBe(false);
    });

    it('onFlush returns unsubscribe function', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      queue = new OfflineQueue({ autoFlush: false });

      const unsubscribe = queue.onFlush(callback);
      await queue.enqueue('create', '/file.txt');
      await queue.flush();

      expect(callback).toHaveBeenCalledOnce();

      // Unsubscribe
      callback.mockClear();
      unsubscribe();

      await queue.enqueue('update', '/file2.txt');
      await queue.flush();

      expect(callback).not.toHaveBeenCalled();
    });

    it('deserialize throws error for invalid JSON', () => {
      expect(() => queue.deserialize('invalid json')).toThrow(
        'Invalid queue data'
      );
    });

    it('deserialize ignores non-array queue property', () => {
      const invalidData = JSON.stringify({ queue: 'not an array' });
      queue.deserialize(invalidData);

      expect(queue.getQueue()).toHaveLength(0);
    });
  });
});

describe('createOfflineQueue', () => {
  it('creates OfflineQueue instance with default config', () => {
    const queue = createOfflineQueue();

    expect(queue).toBeInstanceOf(OfflineQueue);
    expect(queue.getQueue()).toHaveLength(0);
  });

  it('creates OfflineQueue with custom config', () => {
    const customConfig: Partial<OfflineQueueConfig> = {
      maxQueueSize: 500,
      conflictStrategy: 'merge',
      autoFlush: false,
    };

    const queue = createOfflineQueue(customConfig);

    expect(queue).toBeInstanceOf(OfflineQueue);
    expect(queue.isCurrentlyOnline()).toBe(true);
  });

  it('uses default config values when not specified', () => {
    const queue = createOfflineQueue();

    // Verify defaults are applied by checking behavior
    expect(queue.isCurrentlyOnline()).toBe(true);
  });
});

describe('DEFAULT_OFFLINE_CONFIG', () => {
  it('has correct default values', () => {
    expect(DEFAULT_OFFLINE_CONFIG.queuePath).toBe('.nova/sync-queue.json');
    expect(DEFAULT_OFFLINE_CONFIG.conflictStrategy).toBe('last-write-wins');
    expect(DEFAULT_OFFLINE_CONFIG.maxQueueSize).toBe(1000);
    expect(DEFAULT_OFFLINE_CONFIG.autoFlush).toBe(true);
  });
});
