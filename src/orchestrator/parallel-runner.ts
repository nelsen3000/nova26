// Parallel Runner - Parallel task execution for Nova26
// Enables tasks in the same phase to run in parallel when they have no inter-dependencies

import type { Task } from '../types/index.js';

const DEFAULT_CONCURRENCY = 4;

/**
 * Task result from parallel execution
 */
export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
  output?: string;
}

/**
 * Parallel runner configuration
 */
export interface ParallelRunnerConfig {
  concurrency?: number;
  timeout?: number;
}

/**
 * ParallelRunner - Enables parallel task execution
 * Uses Promise.all for parallel execution, with graceful degradation
 */
export class ParallelRunner {
  private concurrency: number;
  private timeout: number;
  private isAvailable: boolean = true;
  
  constructor(config: ParallelRunnerConfig = {}) {
    this.concurrency = config.concurrency || DEFAULT_CONCURRENCY;
    this.timeout = config.timeout || 5 * 60 * 1000; // 5 minutes
    
    console.log('✅ Parallel runner initialized (concurrency: ' + this.concurrency + ')');
  }
  
  /**
   * Check if parallel execution is available
   */
  public checkAvailability(): boolean {
    return this.isAvailable;
  }
  
  /**
   * Get independent tasks from a phase
   * Tasks are independent if they don't depend on each other
   */
  public getIndependentTasks(tasks: Task[]): Task[] {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const independent: Task[] = [];
    
    for (const task of tasks) {
      // Check if this task depends on any other task in the group
      const hasDependencyInGroup = task.dependencies.some(depId => 
        taskMap.has(depId)
      );
      
      if (!hasDependencyInGroup) {
        independent.push(task);
      }
    }
    
    return independent;
  }
  
  /**
   * Group tasks by phase
   */
  public groupByPhase(tasks: Task[]): Map<number, Task[]> {
    const phases = new Map<number, Task[]>();
    
    for (const task of tasks) {
      const phaseTasks = phases.get(task.phase) || [];
      phaseTasks.push(task);
      phases.set(task.phase, phaseTasks);
    }
    
    return phases;
  }
  
  /**
   * Run tasks in parallel for a specific phase
   * Uses concurrency limit to avoid overwhelming the system
   * 
   * @param tasks - Tasks to execute in parallel
   * @param executor - Function to execute each task
   * @returns Array of task results
   */
  public async runPhase(
    tasks: Task[],
    executor: (task: Task) => Promise<void>
  ): Promise<TaskResult[]> {
    if (tasks.length === 0) {
      return [];
    }
    
    console.log(`Running ${tasks.length} tasks in parallel (concurrency: ${this.concurrency})`);
    
    // Process tasks in batches based on concurrency
    const results: TaskResult[] = [];
    
    for (let i = 0; i < tasks.length; i += this.concurrency) {
      const batch = tasks.slice(i, i + this.concurrency);
      const batchResults = await Promise.all(
        batch.map(task => this.executeWithTimeout(task, executor))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * Execute a single task with timeout
   */
  private async executeWithTimeout(
    task: Task,
    executor: (task: Task) => Promise<void>
  ): Promise<TaskResult> {
    return new Promise<TaskResult>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          taskId: task.id,
          status: 'timeout',
          error: `Task timed out after ${this.timeout}ms`,
        });
      }, this.timeout);
      
      // Execute the task
      executor(task)
        .then(() => {
          clearTimeout(timeoutId);
          resolve({
            taskId: task.id,
            status: 'completed',
          });
        })
        .catch((error: Error) => {
          clearTimeout(timeoutId);
          resolve({
            taskId: task.id,
            status: 'failed',
            error: error.message,
          });
        });
    });
  }
  
  /**
   * Fallback sequential execution
   */
  public async runSequential(
    tasks: Task[],
    executor: (task: Task) => Promise<void>
  ): Promise<TaskResult[]> {
    console.log('Running tasks sequentially');
    const results: TaskResult[] = [];
    
    for (const task of tasks) {
      try {
        await executor(task);
        results.push({
          taskId: task.id,
          status: 'completed',
        });
      } catch (error: any) {
        results.push({
          taskId: task.id,
          status: 'failed',
          error: error.message,
        });
      }
    }
    
    return results;
  }
}

/**
 * Singleton instance
 */
let parallelRunner: ParallelRunner | null = null;

export function getParallelRunner(config?: ParallelRunnerConfig): ParallelRunner {
  if (!parallelRunner) {
    parallelRunner = new ParallelRunner(config);
  }
  return parallelRunner;
}

/**
 * Get independent tasks from a phase (standalone function)
 * Tasks are independent if they don't depend on each other within the group
 */
export function getIndependentTasks(tasks: Task[]): Task[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const independent: Task[] = [];
  
  for (const task of tasks) {
    const hasDependencyInGroup = task.dependencies.some(depId => 
      taskMap.has(depId)
    );
    
    if (!hasDependencyInGroup) {
      independent.push(task);
    }
  }
  
  return independent;
}
