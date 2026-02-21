// Real-time Build Status Emitter - KMS-18
// Provides typed events for build lifecycle monitoring

/**
 * Build status types
 */
export type BuildStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Task status types
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Build information
 */
export interface BuildInfo {
  buildId: string;
  projectName: string;
  startTime: Date;
  endTime?: Date;
  status: BuildStatus;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}

/**
 * Task information
 */
export interface TaskInfo {
  taskId: string;
  buildId: string;
  taskName: string;
  status: TaskStatus;
  progress: number; // 0-100
  message?: string;
  startTime?: Date;
  endTime?: Date;
}

/**
 * Event payload for build:started
 */
export interface BuildStartedPayload {
  build: BuildInfo;
  timestamp: Date;
}

/**
 * Event payload for task:progress
 */
export interface TaskProgressPayload {
  task: TaskInfo;
  buildId: string;
  timestamp: Date;
}

/**
 * Event payload for build:completed
 */
export interface BuildCompletedPayload {
  build: BuildInfo;
  duration: number; // milliseconds
  success: boolean;
  timestamp: Date;
}

/**
 * Event map for type-safe event handling
 */
export interface BuildStatusEvents {
  'build:started': BuildStartedPayload;
  'task:progress': TaskProgressPayload;
  'build:completed': BuildCompletedPayload;
}

/**
 * Event handler type
 */
export type EventHandler<T> = (payload: T) => void;

/**
 * Subscription handle for managing listener lifecycle
 */
export interface SubscriptionHandle {
  unsubscribe: () => void;
}

/**
 * BuildStatusEmitter - Real-time build status with typed events
 * 
 * Features:
 * - Typed events: build:started, task:progress, build:completed
 * - Subscription-based updates
 * - Multiple listeners per event
 * - Memory-efficient listener management
 */
export class BuildStatusEmitter {
  private listeners: Map<keyof BuildStatusEvents, Set<EventHandler<unknown>>> = new Map();
  private activeBuilds: Map<string, BuildInfo> = new Map();
  private activeTasks: Map<string, TaskInfo> = new Map();

  constructor() {
    // Initialize listener sets for all event types
    this.listeners.set('build:started', new Set());
    this.listeners.set('task:progress', new Set());
    this.listeners.set('build:completed', new Set());
  }

  /**
   * Subscribe to a specific event type
   * @param event - Event name
   * @param handler - Event handler function
   * @returns SubscriptionHandle for unsubscribing
   */
  public on<K extends keyof BuildStatusEvents>(
    event: K,
    handler: EventHandler<BuildStatusEvents[K]>
  ): SubscriptionHandle {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      throw new Error(`Unknown event type: ${event}`);
    }

    handlers.add(handler as EventHandler<unknown>);

    return {
      unsubscribe: () => {
        handlers.delete(handler as EventHandler<unknown>);
      },
    };
  }

  /**
   * Subscribe to a specific event type for one-time execution
   * @param event - Event name
   * @param handler - Event handler function
   * @returns SubscriptionHandle for unsubscribing
   */
  public once<K extends keyof BuildStatusEvents>(
    event: K,
    handler: EventHandler<BuildStatusEvents[K]>
  ): SubscriptionHandle {
    let handle: SubscriptionHandle | undefined;

    const wrapper = (payload: BuildStatusEvents[K]): void => {
      handler(payload);
      if (handle) {
        handle.unsubscribe();
      }
    };

    handle = this.on(event, wrapper);
    return handle;
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event name
   * @param payload - Event payload
   */
  public emit<K extends keyof BuildStatusEvents>(
    event: K,
    payload: BuildStatusEvents[K]
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      throw new Error(`Unknown event type: ${event}`);
    }

    // Execute handlers synchronously for real-time updates
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        // Don't let one handler break others
        console.error(`Error in ${event} handler:`, error);
      }
    }
  }

  /**
   * Start a new build and emit build:started event
   * @param projectName - Name of the project being built
   * @returns BuildInfo for the started build
   */
  public startBuild(projectName: string): BuildInfo {
    const buildId = `build-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const build: BuildInfo = {
      buildId,
      projectName,
      startTime: new Date(),
      status: 'running',
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
    };

    this.activeBuilds.set(buildId, build);

    this.emit('build:started', {
      build,
      timestamp: new Date(),
    });

    return build;
  }

  /**
   * Update task progress and emit task:progress event
   * @param buildId - Build identifier
   * @param taskName - Name of the task
   * @param progress - Progress percentage (0-100)
   * @param message - Optional progress message
   * @returns TaskInfo for the updated task
   */
  public updateTaskProgress(
    buildId: string,
    taskName: string,
    progress: number,
    message?: string
  ): TaskInfo {
    const taskId = `${buildId}:${taskName}`;
    let task = this.activeTasks.get(taskId);

    if (!task) {
      // Create new task
      task = {
        taskId,
        buildId,
        taskName,
        status: 'running',
        progress: 0,
        startTime: new Date(),
      };
      this.activeTasks.set(taskId, task);

      // Update build task count
      const build = this.activeBuilds.get(buildId);
      if (build) {
        build.totalTasks++;
      }
    }

    // Validate and clamp progress
    const clampedProgress = Math.max(0, Math.min(100, progress));
    task.progress = clampedProgress;
    task.message = message;

    // Update status based on progress
    if (clampedProgress === 100) {
      task.status = 'completed';
      task.endTime = new Date();
    } else if (clampedProgress > 0) {
      task.status = 'running';
    }

    this.emit('task:progress', {
      task,
      buildId,
      timestamp: new Date(),
    });

    return task;
  }

  /**
   * Complete a build and emit build:completed event
   * @param buildId - Build identifier
   * @param success - Whether the build succeeded
   * @returns BuildInfo for the completed build, or null if not found
   */
  public completeBuild(buildId: string, success: boolean): BuildInfo | null {
    const build = this.activeBuilds.get(buildId);
    if (!build) {
      return null;
    }

    build.status = success ? 'completed' : 'failed';
    build.endTime = new Date();

    const duration = build.endTime.getTime() - build.startTime.getTime();

    // Count final task states
    build.completedTasks = 0;
    build.failedTasks = 0;
    for (const task of this.activeTasks.values()) {
      if (task.buildId === buildId) {
        if (task.status === 'completed') {
          build.completedTasks++;
        } else if (task.status === 'failed') {
          build.failedTasks++;
        }
      }
    }

    this.emit('build:completed', {
      build,
      duration,
      success,
      timestamp: new Date(),
    });

    return build;
  }

  /**
   * Mark a task as failed
   * @param buildId - Build identifier
   * @param taskName - Name of the task
   * @param errorMessage - Optional error message
   * @returns TaskInfo for the failed task, or null if not found
   */
  public failTask(buildId: string, taskName: string, errorMessage?: string): TaskInfo | null {
    const taskId = `${buildId}:${taskName}`;
    let task = this.activeTasks.get(taskId);

    if (!task) {
      // Create and immediately fail the task
      task = {
        taskId,
        buildId,
        taskName,
        status: 'failed',
        progress: 0,
        message: errorMessage,
        startTime: new Date(),
        endTime: new Date(),
      };
      this.activeTasks.set(taskId, task);

      const build = this.activeBuilds.get(buildId);
      if (build) {
        build.totalTasks++;
        build.failedTasks++;
      }
    } else {
      task.status = 'failed';
      task.endTime = new Date();
      task.message = errorMessage;
    }

    this.emit('task:progress', {
      task,
      buildId,
      timestamp: new Date(),
    });

    return task;
  }

  /**
   * Get the current state of a build
   * @param buildId - Build identifier
   * @returns BuildInfo or undefined if not found
   */
  public getBuild(buildId: string): BuildInfo | undefined {
    return this.activeBuilds.get(buildId);
  }

  /**
   * Get the current state of a task
   * @param buildId - Build identifier
   * @param taskName - Name of the task
   * @returns TaskInfo or undefined if not found
   */
  public getTask(buildId: string, taskName: string): TaskInfo | undefined {
    return this.activeTasks.get(`${buildId}:${taskName}`);
  }

  /**
   * Get all tasks for a build
   * @param buildId - Build identifier
   * @returns Array of TaskInfo
   */
  public getBuildTasks(buildId: string): TaskInfo[] {
    const tasks: TaskInfo[] = [];
    for (const task of this.activeTasks.values()) {
      if (task.buildId === buildId) {
        tasks.push(task);
      }
    }
    return tasks;
  }

  /**
   * Get all active builds
   * @returns Array of BuildInfo
   */
  public getActiveBuilds(): BuildInfo[] {
    const builds: BuildInfo[] = [];
    for (const build of this.activeBuilds.values()) {
      if (build.status === 'running') {
        builds.push(build);
      }
    }
    return builds;
  }

  /**
   * Cancel a running build
   * @param buildId - Build identifier
   * @returns BuildInfo for the cancelled build, or null if not found
   */
  public cancelBuild(buildId: string): BuildInfo | null {
    const build = this.activeBuilds.get(buildId);
    if (!build || build.status !== 'running') {
      return null;
    }

    build.status = 'cancelled';
    build.endTime = new Date();

    return build;
  }

  /**
   * Remove a build and all its tasks from memory
   * @param buildId - Build identifier
   * @returns true if build was removed, false if not found
   */
  public cleanupBuild(buildId: string): boolean {
    const removed = this.activeBuilds.delete(buildId);

    // Clean up associated tasks
    for (const [taskId, task] of this.activeTasks.entries()) {
      if (task.buildId === buildId) {
        this.activeTasks.delete(taskId);
      }
    }

    return removed;
  }

  /**
   * Get the count of active listeners for an event
   * @param event - Event name
   * @returns Number of listeners
   */
  public getListenerCount<K extends keyof BuildStatusEvents>(event: K): number {
    const handlers = this.listeners.get(event);
    return handlers?.size ?? 0;
  }

  /**
   * Remove all listeners for an event, or all events if not specified
   * @param event - Optional event name to clear
   */
  public removeAllListeners<K extends keyof BuildStatusEvents>(event?: K): void {
    if (event) {
      const handlers = this.listeners.get(event);
      handlers?.clear();
    } else {
      for (const handlers of this.listeners.values()) {
        handlers.clear();
      }
    }
  }

  /**
   * Reset the emitter state (for testing)
   */
  public reset(): void {
    this.activeBuilds.clear();
    this.activeTasks.clear();
    this.removeAllListeners();
  }
}

/**
 * Create a new BuildStatusEmitter instance
 * @returns BuildStatusEmitter instance
 */
export function createBuildStatusEmitter(): BuildStatusEmitter {
  return new BuildStatusEmitter();
}

/**
 * Default singleton instance
 */
export const buildStatusEmitter = new BuildStatusEmitter();
