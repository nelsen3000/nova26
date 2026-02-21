// Build Status Emitter Tests - KMS-18

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BuildStatusEmitter,
  createBuildStatusEmitter,
  buildStatusEmitter,
  type BuildInfo,
  type TaskInfo,
  type BuildStartedPayload,
  type TaskProgressPayload,
  type BuildCompletedPayload,
} from '../build-status.js';

describe('BuildStatusEmitter', () => {
  let emitter: BuildStatusEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    emitter = createBuildStatusEmitter();
  });

  describe('Event subscription', () => {
    it('should allow subscribing to build:started events', () => {
      const handler = vi.fn();
      emitter.on('build:started', handler);

      emitter.startBuild('test-project');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          build: expect.objectContaining({
            projectName: 'test-project',
            status: 'running',
          }),
          timestamp: expect.any(Date),
        })
      );
    });

    it('should allow subscribing to task:progress events', () => {
      const handler = vi.fn();
      emitter.on('task:progress', handler);

      const build = emitter.startBuild('test-project');
      emitter.updateTaskProgress(build.buildId, 'compile', 50, 'Compiling...');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({
            taskName: 'compile',
            progress: 50,
            message: 'Compiling...',
          }),
          buildId: build.buildId,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should allow subscribing to build:completed events', () => {
      const handler = vi.fn();
      emitter.on('build:completed', handler);

      const build = emitter.startBuild('test-project');
      emitter.completeBuild(build.buildId, true);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          build: expect.objectContaining({
            buildId: build.buildId,
            status: 'completed',
          }),
          duration: expect.any(Number),
          success: true,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should allow multiple subscribers for the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('build:started', handler1);
      emitter.on('build:started', handler2);

      emitter.startBuild('test-project');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing from events', () => {
      const handler = vi.fn();
      const handle = emitter.on('build:started', handler);

      handle.unsubscribe();
      emitter.startBuild('test-project');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support once subscription that auto-unsubscribes', () => {
      const handler = vi.fn();
      emitter.once('build:started', handler);

      emitter.startBuild('test-project');
      emitter.startBuild('test-project-2');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Build lifecycle', () => {
    it('should create a build with unique ID', () => {
      const build1 = emitter.startBuild('project-a');
      const build2 = emitter.startBuild('project-b');

      expect(build1.buildId).not.toBe(build2.buildId);
      expect(build1.buildId).toMatch(/^build-\d+-[a-z0-9]+$/);
    });

    it('should track build start time', () => {
      const beforeStart = Date.now();
      const build = emitter.startBuild('test-project');
      const afterStart = Date.now();

      expect(build.startTime.getTime()).toBeGreaterThanOrEqual(beforeStart);
      expect(build.startTime.getTime()).toBeLessThanOrEqual(afterStart);
    });

    it('should complete a successful build', () => {
      const build = emitter.startBuild('test-project');
      const completed = emitter.completeBuild(build.buildId, true);

      expect(completed).not.toBeNull();
      expect(completed?.status).toBe('completed');
      expect(completed?.endTime).toBeDefined();
    });

    it('should complete a failed build', () => {
      const build = emitter.startBuild('test-project');
      const completed = emitter.completeBuild(build.buildId, false);

      expect(completed).not.toBeNull();
      expect(completed?.status).toBe('failed');
    });

    it('should calculate build duration correctly', () => {
      const completedHandler = vi.fn();
      emitter.on('build:completed', completedHandler);

      const build = emitter.startBuild('test-project');
      emitter.completeBuild(build.buildId, true);

      const payload = completedHandler.mock.calls[0][0] as BuildCompletedPayload;
      expect(payload.duration).toBeGreaterThanOrEqual(0);
      expect(payload.duration).toBeLessThan(1000); // Should be very fast in tests
    });

    it('should return null when completing non-existent build', () => {
      const result = emitter.completeBuild('non-existent', true);
      expect(result).toBeNull();
    });

    it('should allow cancelling a build', () => {
      const build = emitter.startBuild('test-project');
      const cancelled = emitter.cancelBuild(build.buildId);

      expect(cancelled).not.toBeNull();
      expect(cancelled?.status).toBe('cancelled');
    });

    it('should return null when cancelling non-existent build', () => {
      const result = emitter.cancelBuild('non-existent');
      expect(result).toBeNull();
    });

    it('should return null when cancelling already completed build', () => {
      const build = emitter.startBuild('test-project');
      emitter.completeBuild(build.buildId, true);
      const cancelled = emitter.cancelBuild(build.buildId);

      expect(cancelled).toBeNull();
    });
  });

  describe('Task progress tracking', () => {
    it('should create task on first progress update', () => {
      const build = emitter.startBuild('test-project');
      const task = emitter.updateTaskProgress(build.buildId, 'compile', 25);

      expect(task.taskId).toBe(`${build.buildId}:compile`);
      expect(task.taskName).toBe('compile');
      expect(task.progress).toBe(25);
      expect(task.status).toBe('running');
    });

    it('should clamp progress to 0-100 range', () => {
      const build = emitter.startBuild('test-project');
      const taskNegative = emitter.updateTaskProgress(build.buildId, 'task1', -10);
      const taskOver = emitter.updateTaskProgress(build.buildId, 'task2', 150);

      expect(taskNegative.progress).toBe(0);
      expect(taskOver.progress).toBe(100);
    });

    it('should mark task as completed at 100% progress', () => {
      const build = emitter.startBuild('test-project');
      const task = emitter.updateTaskProgress(build.buildId, 'compile', 100);

      expect(task.status).toBe('completed');
      expect(task.endTime).toBeDefined();
    });

    it('should fail a task', () => {
      const build = emitter.startBuild('test-project');
      const task = emitter.failTask(build.buildId, 'compile', 'Compilation error');

      expect(task).not.toBeNull();
      expect(task?.status).toBe('failed');
      expect(task?.message).toBe('Compilation error');
      expect(task?.endTime).toBeDefined();
    });

    it('should update existing task on subsequent progress calls', () => {
      const progressHandler = vi.fn();
      emitter.on('task:progress', progressHandler);

      const build = emitter.startBuild('test-project');
      emitter.updateTaskProgress(build.buildId, 'compile', 25);
      emitter.updateTaskProgress(build.buildId, 'compile', 50);
      emitter.updateTaskProgress(build.buildId, 'compile', 75);

      expect(progressHandler).toHaveBeenCalledTimes(3);
      const lastCall = progressHandler.mock.calls[2][0] as TaskProgressPayload;
      expect(lastCall.task.progress).toBe(75);
    });
  });

  describe('State management', () => {
    it('should retrieve build by ID', () => {
      const build = emitter.startBuild('test-project');
      const retrieved = emitter.getBuild(build.buildId);

      expect(retrieved).toEqual(build);
    });

    it('should retrieve task by build ID and task name', () => {
      const build = emitter.startBuild('test-project');
      const task = emitter.updateTaskProgress(build.buildId, 'compile', 50);
      const retrieved = emitter.getTask(build.buildId, 'compile');

      expect(retrieved).toEqual(task);
    });

    it('should get all tasks for a build', () => {
      const build = emitter.startBuild('test-project');
      emitter.updateTaskProgress(build.buildId, 'task1', 50);
      emitter.updateTaskProgress(build.buildId, 'task2', 75);
      emitter.updateTaskProgress(build.buildId, 'task3', 100);

      const tasks = emitter.getBuildTasks(build.buildId);
      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.taskName)).toContain('task1');
      expect(tasks.map(t => t.taskName)).toContain('task2');
      expect(tasks.map(t => t.taskName)).toContain('task3');
    });

    it('should get only active (running) builds', () => {
      const build1 = emitter.startBuild('project-a');
      const build2 = emitter.startBuild('project-b');
      emitter.completeBuild(build1.buildId, true);

      const activeBuilds = emitter.getActiveBuilds();
      expect(activeBuilds).toHaveLength(1);
      expect(activeBuilds[0].buildId).toBe(build2.buildId);
    });

    it('should cleanup build and associated tasks', () => {
      const build = emitter.startBuild('test-project');
      emitter.updateTaskProgress(build.buildId, 'task1', 50);
      emitter.updateTaskProgress(build.buildId, 'task2', 75);

      const removed = emitter.cleanupBuild(build.buildId);

      expect(removed).toBe(true);
      expect(emitter.getBuild(build.buildId)).toBeUndefined();
      expect(emitter.getBuildTasks(build.buildId)).toHaveLength(0);
    });

    it('should return false when cleaning up non-existent build', () => {
      const result = emitter.cleanupBuild('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Listener management', () => {
    it('should track listener count', () => {
      expect(emitter.getListenerCount('build:started')).toBe(0);

      const handle1 = emitter.on('build:started', () => {});
      expect(emitter.getListenerCount('build:started')).toBe(1);

      const handle2 = emitter.on('build:started', () => {});
      expect(emitter.getListenerCount('build:started')).toBe(2);

      handle1.unsubscribe();
      expect(emitter.getListenerCount('build:started')).toBe(1);

      handle2.unsubscribe();
      expect(emitter.getListenerCount('build:started')).toBe(0);
    });

    it('should remove all listeners for a specific event', () => {
      emitter.on('build:started', () => {});
      emitter.on('build:started', () => {});
      emitter.on('build:completed', () => {});

      emitter.removeAllListeners('build:started');

      expect(emitter.getListenerCount('build:started')).toBe(0);
      expect(emitter.getListenerCount('build:completed')).toBe(1);
    });

    it('should remove all listeners for all events', () => {
      emitter.on('build:started', () => {});
      emitter.on('task:progress', () => {});
      emitter.on('build:completed', () => {});

      emitter.removeAllListeners();

      expect(emitter.getListenerCount('build:started')).toBe(0);
      expect(emitter.getListenerCount('task:progress')).toBe(0);
      expect(emitter.getListenerCount('build:completed')).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should not break other handlers when one throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();

      emitter.on('build:started', errorHandler);
      emitter.on('build:started', goodHandler);

      // Should not throw
      expect(() => emitter.startBuild('test-project')).not.toThrow();

      expect(errorHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();
    });

    it('should throw error for unknown event type in on()', () => {
      // Using type assertion to test runtime behavior
      expect(() => {
        emitter.on('unknown' as keyof BuildStartedPayload, () => {});
      }).toThrow('Unknown event type');
    });

    it('should throw error for unknown event type in emit()', () => {
      expect(() => {
        emitter.emit('unknown' as keyof BuildStartedPayload, {} as BuildStartedPayload);
      }).toThrow('Unknown event type');
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(buildStatusEmitter).toBeInstanceOf(BuildStatusEmitter);
    });

    it('should reset state when reset() is called', () => {
      const localEmitter = createBuildStatusEmitter();
      localEmitter.on('build:started', () => {});
      const build = localEmitter.startBuild('test-project');
      localEmitter.updateTaskProgress(build.buildId, 'task1', 50);

      localEmitter.reset();

      expect(localEmitter.getListenerCount('build:started')).toBe(0);
      expect(localEmitter.getBuild(build.buildId)).toBeUndefined();
      expect(localEmitter.getActiveBuilds()).toHaveLength(0);
    });
  });

  describe('Build statistics', () => {
    it('should track completed and failed task counts on build completion', () => {
      const completedHandler = vi.fn();
      emitter.on('build:completed', completedHandler);

      const build = emitter.startBuild('test-project');
      emitter.updateTaskProgress(build.buildId, 'task1', 100); // completed
      emitter.updateTaskProgress(build.buildId, 'task2', 100); // completed
      emitter.failTask(build.buildId, 'task3', 'Failed'); // failed

      const completed = emitter.completeBuild(build.buildId, true);

      expect(completed?.completedTasks).toBe(2);
      expect(completed?.failedTasks).toBe(1);
    });

    it('should increment totalTasks when creating new tasks', () => {
      const build = emitter.startBuild('test-project');
      expect(build.totalTasks).toBe(0);

      emitter.updateTaskProgress(build.buildId, 'task1', 50);
      expect(emitter.getBuild(build.buildId)?.totalTasks).toBe(1);

      emitter.updateTaskProgress(build.buildId, 'task2', 75);
      expect(emitter.getBuild(build.buildId)?.totalTasks).toBe(2);
    });
  });
});
