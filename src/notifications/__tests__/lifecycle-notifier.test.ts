// KMS-24: Lifecycle Notifier tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LifecycleNotifier,
  createBuildCompleteNotifier,
  createTaskFailedNotifier,
  createCostTracker,
  getGlobalLifecycleNotifier,
  resetGlobalLifecycleNotifier,
  setGlobalLifecycleNotifier,
  type BuildCompleteData,
  type TaskFailedData,
  type BudgetExceededData,
} from '../lifecycle-notifier.js';
import { NotificationDispatcher, ConsoleHandler } from '../dispatcher.js';

describe('LifecycleNotifier', () => {
  let dispatcher: NotificationDispatcher;
  let notifier: LifecycleNotifier;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new NotificationDispatcher();
    notifier = new LifecycleNotifier(dispatcher);
  });

  describe('initialization', () => {
    it('should create with default config', () => {
      expect(notifier.getConfig()).toEqual({
        budgetThreshold: 10.0,
        notifyOnBuildComplete: true,
        notifyOnTaskFailed: true,
        notifyOnBudgetExceeded: true,
        minPriority: 'medium',
      });
    });

    it('should register console handler if none exist', () => {
      const newDispatcher = new NotificationDispatcher();
      expect(newDispatcher.getHandlerNames()).toHaveLength(0);
      
      new LifecycleNotifier(newDispatcher);
      
      expect(newDispatcher.getHandlerNames()).toContain('console');
    });

    it('should use custom config values', () => {
      const customNotifier = new LifecycleNotifier(dispatcher, {
        budgetThreshold: 5.0,
        notifyOnBuildComplete: false,
        minPriority: 'high',
      });

      const config = customNotifier.getConfig();
      expect(config.budgetThreshold).toBe(5.0);
      expect(config.notifyOnBuildComplete).toBe(false);
      expect(config.minPriority).toBe('high');
    });
  });

  describe('notifyBuildComplete', () => {
    const buildData: BuildCompleteData = {
      buildId: 'test-build-123',
      duration: 60000,
      taskCount: { total: 10, completed: 9, failed: 1 },
      passRate: 0.9,
      costEstimate: 0.5,
    };

    it('should dispatch build:complete notification', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      
      await notifier.notifyBuildComplete(buildData);
      
      expect(dispatchSpy).toHaveBeenCalledOnce();
      expect(dispatchSpy.mock.calls[0][0].type).toBe('build:complete');
    });

    it('should set correct priority for successful build', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      
      await notifier.notifyBuildComplete({ ...buildData, passRate: 0.95 });
      
      expect(dispatchSpy.mock.calls[0][0].priority).toBe('medium');
    });

    it('should set high priority for failed build', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      
      await notifier.notifyBuildComplete({ ...buildData, passRate: 0.3 });
      
      expect(dispatchSpy.mock.calls[0][0].priority).toBe('high');
    });

    it('should include build metadata', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      
      await notifier.notifyBuildComplete(buildData);
      
      const payload = dispatchSpy.mock.calls[0][0];
      expect(payload.metadata.buildId).toBe('test-build-123');
      expect(payload.metadata.passRate).toBe(0.9);
      expect(payload.metadata.taskCount).toEqual(buildData.taskCount);
    });

    it('should not notify when disabled', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      notifier.updateConfig({ notifyOnBuildComplete: false });
      
      await notifier.notifyBuildComplete(buildData);
      
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  describe('notifyTaskFailed', () => {
    const taskData: TaskFailedData = {
      taskId: 'task-456',
      agentName: 'Kimi',
      error: 'Connection timeout',
      attempt: 1,
      maxAttempts: 3,
    };

    it('should dispatch task:failed notification', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      
      await notifier.notifyTaskFailed(taskData);
      
      expect(dispatchSpy).toHaveBeenCalledOnce();
      expect(dispatchSpy.mock.calls[0][0].type).toBe('task:failed');
    });

    it('should set medium priority for retryable failure', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      
      await notifier.notifyTaskFailed(taskData);
      
      expect(dispatchSpy.mock.calls[0][0].priority).toBe('medium');
    });

    it('should set high priority for final attempt', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      
      await notifier.notifyTaskFailed({ ...taskData, attempt: 3 });
      
      expect(dispatchSpy.mock.calls[0][0].priority).toBe('high');
    });

    it('should include task metadata', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      
      await notifier.notifyTaskFailed(taskData);
      
      const payload = dispatchSpy.mock.calls[0][0];
      expect(payload.metadata.taskId).toBe('task-456');
      expect(payload.metadata.agentName).toBe('Kimi');
      expect(payload.metadata.error).toBe('Connection timeout');
      expect(payload.metadata.isFinalAttempt).toBe(false);
    });

    it('should not notify when disabled', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      notifier.updateConfig({ notifyOnTaskFailed: false });
      
      await notifier.notifyTaskFailed(taskData);
      
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  describe('trackCost and notifyBudgetExceeded', () => {
    it('should track accumulated cost', async () => {
      await notifier.trackCost(2.0, 'build-1');
      await notifier.trackCost(3.0, 'build-1');
      
      expect(notifier.getCurrentCost()).toBe(5.0);
    });

    it('should notify when budget exceeded', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      notifier.updateConfig({ budgetThreshold: 5.0 });
      
      await notifier.trackCost(6.0, 'build-1');
      
      expect(dispatchSpy).toHaveBeenCalledOnce();
      expect(dispatchSpy.mock.calls[0][0].type).toBe('budget:exceeded');
    });

    it('should notify only once per build', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      notifier.updateConfig({ budgetThreshold: 5.0 });
      
      await notifier.trackCost(6.0, 'build-1');
      await notifier.trackCost(2.0, 'build-1');
      
      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it('should set high priority for budget exceeded', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      notifier.updateConfig({ budgetThreshold: 5.0 });
      
      await notifier.trackCost(10.0, 'build-1');
      
      expect(dispatchSpy.mock.calls[0][0].priority).toBe('high');
    });

    it('should include cost metadata', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      notifier.updateConfig({ budgetThreshold: 5.0 });
      
      await notifier.trackCost(8.0, 'build-1');
      
      const payload = dispatchSpy.mock.calls[0][0];
      expect(payload.metadata.currentCost).toBe(8.0);
      expect(payload.metadata.threshold).toBe(5.0);
      expect(payload.metadata.exceededBy).toBe(3.0);
    });

    it('should reset cost tracking', async () => {
      await notifier.trackCost(10.0, 'build-1');
      notifier.resetCostTracking();
      
      expect(notifier.getCurrentCost()).toBe(0);
    });

    it('should not notify when disabled', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      notifier.updateConfig({ notifyOnBudgetExceeded: false, budgetThreshold: 5.0 });
      
      await notifier.trackCost(10.0, 'build-1');
      
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should update config', () => {
      notifier.updateConfig({ budgetThreshold: 20.0 });
      
      expect(notifier.getConfig().budgetThreshold).toBe(20.0);
    });

    it('should preserve existing config when partially updating', () => {
      const original = notifier.getConfig();
      notifier.updateConfig({ minPriority: 'high' });
      
      const updated = notifier.getConfig();
      expect(updated.minPriority).toBe('high');
      expect(updated.budgetThreshold).toBe(original.budgetThreshold);
    });

    it('should check if notification type is enabled', () => {
      expect(notifier.isEnabled('build:complete')).toBe(true);
      expect(notifier.isEnabled('task:failed')).toBe(true);
      expect(notifier.isEnabled('budget:exceeded')).toBe(true);
    });

    it('should return false for unknown notification type', () => {
      expect(notifier.isEnabled('unknown:type' as any)).toBe(false);
    });

    it('should enable/disable notification types', () => {
      notifier.setEnabled('build:complete', false);
      expect(notifier.isEnabled('build:complete')).toBe(false);
      
      notifier.setEnabled('build:complete', true);
      expect(notifier.isEnabled('build:complete')).toBe(true);
    });
  });

  describe('hook creators', () => {
    it('should create build complete notifier hook', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      const hook = createBuildCompleteNotifier(notifier);
      
      await hook('build-1', {
        duration: 1000,
        taskCount: { total: 5, completed: 5, failed: 0 },
        passRate: 1.0,
        costEstimate: 0.1,
      });
      
      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it('should create task failed notifier hook', async () => {
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');
      const hook = createTaskFailedNotifier(notifier);
      
      await hook('task-1', 'Agent-A', 'Error', 1, 3);
      
      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it('should create cost tracker hook', async () => {
      const hook = createCostTracker(notifier);
      
      await hook(5.0, 'build-1');
      
      expect(notifier.getCurrentCost()).toBe(5.0);
    });
  });

  describe('singleton', () => {
    it('should return same global instance', () => {
      const n1 = getGlobalLifecycleNotifier();
      const n2 = getGlobalLifecycleNotifier();
      expect(n1).toBe(n2);
    });

    it('should reset global instance', () => {
      const n1 = getGlobalLifecycleNotifier();
      resetGlobalLifecycleNotifier();
      const n2 = getGlobalLifecycleNotifier();
      expect(n1).not.toBe(n2);
    });

    it('should set global instance', () => {
      const customNotifier = new LifecycleNotifier(dispatcher);
      setGlobalLifecycleNotifier(customNotifier);
      expect(getGlobalLifecycleNotifier()).toBe(customNotifier);
    });
  });
});
