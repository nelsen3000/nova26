import { PRD, Task, TaskStatus, Phase } from '../types/index.js';

/**
 * Pick the next task that is ready to run
 * Considers phase order and dependency resolution
 */
export function pickNextTask(prd: PRD): Task | null {
  // Sort phases by ID to ensure phase 0 runs before phase 1, etc.
  const sortedPhases = [...prd.phases].sort((a, b) => a.id - b.id);
  
  for (const phase of sortedPhases) {
    const readyTask = findReadyTaskInPhase(phase);
    if (readyTask) {
      return readyTask;
    }
  }
  
  return null;
}

/**
 * Find a ready task within a single phase
 */
function findReadyTaskInPhase(phase: Phase): Task | null {
  // Tasks must be in "ready" status
  const readyTasks = phase.tasks.filter(t => t.status === 'ready');
  
  for (const task of readyTasks) {
    if (areDependenciesMet(task, phase)) {
      return task;
    }
  }
  
  return null;
}

/**
 * Check if all dependencies for a task are satisfied
 */
function areDependenciesMet(task: Task, phase: Phase): boolean {
  if (task.dependencies.length === 0) {
    return true;
  }
  
  const completedIds = new Set(
    phase.tasks
      .filter(t => t.status === 'done')
      .map(t => t.id)
  );
  
  return task.dependencies.every(depId => completedIds.has(depId));
}

/**
 * Update a task's status in the PRD
 * Returns a new PRD object (immutable update)
 */
export function updateTaskStatus(
  prd: PRD,
  taskId: string,
  status: TaskStatus,
  extras?: Partial<Task>
): PRD {
  const newPhases = prd.phases.map(phase => ({
    ...phase,
    tasks: phase.tasks.map(task => {
      if (task.id === taskId) {
        const updated: Task = {
          ...task,
          status,
          attempts: task.attempts + (status === 'in_progress' ? 1 : 0),
          completedAt: status === 'done' ? new Date().toISOString() : task.completedAt,
          ...extras,
        };
        return updated;
      }
      return task;
    }),
  }));
  
  return {
    ...prd,
    phases: newPhases,
  };
}

/**
 * Check if all tasks are complete or blocked
 */
export function allTasksComplete(prd: PRD): boolean {
  const allTasks = prd.phases.flatMap(p => p.tasks);
  return allTasks.every(task => task.status === 'done' || task.status === 'blocked');
}

/**
 * Count tasks by status
 */
export function getTaskCounts(prd: PRD): { total: number; done: number; blocked: number; ready: number; inProgress: number } {
  const allTasks = prd.phases.flatMap(p => p.tasks);
  
  return {
    total: allTasks.length,
    done: allTasks.filter(t => t.status === 'done').length,
    blocked: allTasks.filter(t => t.status === 'blocked').length,
    ready: allTasks.filter(t => t.status === 'ready').length,
    inProgress: allTasks.filter(t => t.status === 'in_progress').length,
  };
}

/**
 * Get a task by ID
 */
export function getTaskById(prd: PRD, taskId: string): Task | null {
  for (const phase of prd.phases) {
    const task = phase.tasks.find(t => t.id === taskId);
    if (task) {
      return task;
    }
  }
  return null;
}

/**
 * Reset all tasks to "ready" status (for re-running)
 */
export function resetAllTasks(prd: PRD): PRD {
  const newPhases = prd.phases.map(phase => ({
    ...phase,
    tasks: phase.tasks.map(task => ({
      ...task,
      status: 'ready' as TaskStatus,
      attempts: 0,
      blockedReason: undefined,
      completedAt: undefined,
      output: undefined,
    })),
  }));
  
  return {
    ...prd,
    phases: newPhases,
  };
}

/**
 * Get tasks that are blocked
 */
export function getBlockedTasks(prd: PRD): Task[] {
  return prd.phases
    .flatMap(p => p.tasks)
    .filter(t => t.status === 'blocked');
}

/**
 * Get tasks waiting on dependencies
 */
export function getWaitingTasks(prd: PRD): Task[] {
  const completedIds = new Set(
    prd.phases
      .flatMap(p => p.tasks)
      .filter(t => t.status === 'done')
      .map(t => t.id)
  );
  
  return prd.phases
    .flatMap(p => p.tasks)
    .filter(t => 
      t.status === 'ready' && 
      t.dependencies.length > 0 && 
      !t.dependencies.every(depId => completedIds.has(depId))
    );
}
