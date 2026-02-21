// KMS-24: Notification integration with lifecycle hooks
// Wires notifications/dispatcher.ts into lifecycle hooks

import {
  NotificationDispatcher,
  ConsoleHandler,
  type NotificationPayload,
  type NotificationType,
  type PriorityLevel,
} from './dispatcher.js';

// ============================================================================
// Types
// ============================================================================

export interface LifecycleNotifierConfig {
  /** Budget threshold in dollars for budget:exceeded notification */
  budgetThreshold: number;
  /** Enable build:complete notifications */
  notifyOnBuildComplete: boolean;
  /** Enable task:failed notifications */
  notifyOnTaskFailed: boolean;
  /** Enable budget:exceeded notifications */
  notifyOnBudgetExceeded: boolean;
  /** Minimum priority for notifications */
  minPriority: PriorityLevel;
}

export interface BuildCompleteData {
  buildId: string;
  duration: number;
  taskCount: { total: number; completed: number; failed: number };
  passRate: number;
  costEstimate: number;
}

export interface TaskFailedData {
  taskId: string;
  agentName: string;
  error: string;
  attempt: number;
  maxAttempts: number;
}

export interface BudgetExceededData {
  currentCost: number;
  threshold: number;
  buildId: string;
}

// ============================================================================
// Lifecycle Notifier
// ============================================================================

export class LifecycleNotifier {
  private dispatcher: NotificationDispatcher;
  private config: LifecycleNotifierConfig;
  private currentBuildCost: number = 0;
  private budgetNotified: boolean = false;

  constructor(
    dispatcher: NotificationDispatcher,
    config: Partial<LifecycleNotifierConfig> = {}
  ) {
    this.dispatcher = dispatcher;
    this.config = {
      budgetThreshold: config.budgetThreshold ?? 10.0,
      notifyOnBuildComplete: config.notifyOnBuildComplete ?? true,
      notifyOnTaskFailed: config.notifyOnTaskFailed ?? true,
      notifyOnBudgetExceeded: config.notifyOnBudgetExceeded ?? true,
      minPriority: config.minPriority ?? 'medium',
    };

    // Register default console handler if none exist
    if (this.dispatcher.getHandlerNames().length === 0) {
      this.dispatcher.registerHandler(new ConsoleHandler({ minPriority: 'low' }));
    }
  }

  /**
   * Notify when a build completes
   */
  async notifyBuildComplete(data: BuildCompleteData): Promise<void> {
    if (!this.config.notifyOnBuildComplete) return;

    const status = data.passRate >= 0.9 ? 'success' : data.passRate >= 0.5 ? 'partial' : 'failed';
    const priority: PriorityLevel = data.passRate < 0.5 ? 'high' : 'medium';

    const payload: NotificationPayload = {
      type: 'build:complete',
      priority,
      title: `Build ${status.toUpperCase()}: ${data.buildId}`,
      message: `Build completed with ${data.taskCount.completed}/${data.taskCount.total} tasks passed (${Math.round(data.passRate * 100)}% pass rate)`,
      metadata: {
        buildId: data.buildId,
        duration: data.duration,
        taskCount: data.taskCount,
        passRate: data.passRate,
        costEstimate: data.costEstimate,
        status,
      },
    };

    await this.dispatcher.dispatch(payload);
  }

  /**
   * Notify when a task fails
   */
  async notifyTaskFailed(data: TaskFailedData): Promise<void> {
    if (!this.config.notifyOnTaskFailed) return;

    const isFinalAttempt = data.attempt >= data.maxAttempts;
    const priority: PriorityLevel = isFinalAttempt ? 'high' : 'medium';

    const payload: NotificationPayload = {
      type: 'task:failed',
      priority,
      title: `Task Failed: ${data.taskId}`,
      message: isFinalAttempt
        ? `Task ${data.taskId} failed after ${data.attempt} attempts on agent ${data.agentName}`
        : `Task ${data.taskId} failed (attempt ${data.attempt}/${data.maxAttempts}) on agent ${data.agentName}`,
      metadata: {
        taskId: data.taskId,
        agentName: data.agentName,
        error: data.error,
        attempt: data.attempt,
        maxAttempts: data.maxAttempts,
        isFinalAttempt,
      },
    };

    await this.dispatcher.dispatch(payload);
  }

  /**
   * Track cost and notify when budget is exceeded
   */
  async trackCost(cost: number, buildId: string): Promise<void> {
    if (!this.config.notifyOnBudgetExceeded) return;

    this.currentBuildCost += cost;

    if (this.currentBuildCost > this.config.budgetThreshold && !this.budgetNotified) {
      await this.notifyBudgetExceeded({
        currentCost: this.currentBuildCost,
        threshold: this.config.budgetThreshold,
        buildId,
      });
      this.budgetNotified = true;
    }
  }

  /**
   * Notify when budget is exceeded
   */
  async notifyBudgetExceeded(data: BudgetExceededData): Promise<void> {
    if (!this.config.notifyOnBudgetExceeded) return;

    const payload: NotificationPayload = {
      type: 'budget:exceeded',
      priority: 'high',
      title: 'Budget Threshold Exceeded',
      message: `Current cost ($${data.currentCost.toFixed(2)}) exceeds threshold ($${data.threshold.toFixed(2)})`,
      metadata: {
        currentCost: data.currentCost,
        threshold: data.threshold,
        buildId: data.buildId,
        exceededBy: data.currentCost - data.threshold,
      },
    };

    await this.dispatcher.dispatch(payload);
  }

  /**
   * Reset cost tracking for a new build
   */
  resetCostTracking(): void {
    this.currentBuildCost = 0;
    this.budgetNotified = false;
  }

  /**
   * Get current cost
   */
  getCurrentCost(): number {
    return this.currentBuildCost;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LifecycleNotifierConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LifecycleNotifierConfig {
    return { ...this.config };
  }

  /**
   * Check if a notification type is enabled
   */
  isEnabled(type: NotificationType): boolean {
    switch (type) {
      case 'build:complete':
        return this.config.notifyOnBuildComplete;
      case 'task:failed':
        return this.config.notifyOnTaskFailed;
      case 'budget:exceeded':
        return this.config.notifyOnBudgetExceeded;
      default:
        return false;
    }
  }

  /**
   * Enable/disable a notification type
   */
  setEnabled(type: NotificationType, enabled: boolean): void {
    switch (type) {
      case 'build:complete':
        this.config.notifyOnBuildComplete = enabled;
        break;
      case 'task:failed':
        this.config.notifyOnTaskFailed = enabled;
        break;
      case 'budget:exceeded':
        this.config.notifyOnBudgetExceeded = enabled;
        break;
    }
  }
}

// ============================================================================
// Lifecycle Hook Integration Helpers
// ============================================================================

/**
 * Create a lifecycle hook that notifies on build completion
 */
export function createBuildCompleteNotifier(
  notifier: LifecycleNotifier
): (buildId: string, result: { duration: number; taskCount: { total: number; completed: number; failed: number }; passRate: number; costEstimate: number }) => Promise<void> {
  return async (buildId, result) => {
    await notifier.notifyBuildComplete({
      buildId,
      ...result,
    });
  };
}

/**
 * Create a lifecycle hook that notifies on task failure
 */
export function createTaskFailedNotifier(
  notifier: LifecycleNotifier
): (taskId: string, agentName: string, error: string, attempt: number, maxAttempts: number) => Promise<void> {
  return async (taskId, agentName, error, attempt, maxAttempts) => {
    await notifier.notifyTaskFailed({
      taskId,
      agentName,
      error,
      attempt,
      maxAttempts,
    });
  };
}

/**
 * Create a lifecycle hook that tracks build cost
 */
export function createCostTracker(
  notifier: LifecycleNotifier
): (cost: number, buildId: string) => Promise<void> {
  return async (cost, buildId) => {
    await notifier.trackCost(cost, buildId);
  };
}

// ============================================================================
// Singleton
// ============================================================================

let globalNotifier: LifecycleNotifier | null = null;

export function getGlobalLifecycleNotifier(): LifecycleNotifier {
  if (!globalNotifier) {
    const dispatcher = new NotificationDispatcher();
    globalNotifier = new LifecycleNotifier(dispatcher);
  }
  return globalNotifier;
}

export function resetGlobalLifecycleNotifier(): void {
  globalNotifier = null;
}

export function setGlobalLifecycleNotifier(notifier: LifecycleNotifier): void {
  globalNotifier = notifier;
}
