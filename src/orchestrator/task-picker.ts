// Task Picker - Finds the next ready task to execute

import { writeFileSync } from 'fs';
import type { Task, PRD } from '../types/index.js';

export function pickNextTask(prd: PRD): Task | null {
  // Get all tasks that are in "ready" status
  const readyTasks = prd.tasks.filter(t => t.status === 'ready');
  
  if (readyTasks.length === 0) {
    return null;
  }
  
  // Sort by phase (lower phases first), then by attempts (less attempts = higher priority for retry)
  readyTasks.sort((a, b) => {
    if (a.phase !== b.phase) {
      return a.phase - b.phase;
    }
    return a.attempts - b.attempts;
  });
  
  // Return the first ready task that has all dependencies met
  for (const task of readyTasks) {
    if (allDependenciesMet(task, prd)) {
      return task;
    }
  }
  
  return null;
}

function allDependenciesMet(task: Task, prd: PRD): boolean {
  if (!task.dependencies || task.dependencies.length === 0) {
    return true;
  }
  
  for (const depId of task.dependencies) {
    const depTask = prd.tasks.find(t => t.id === depId);
    if (!depTask || depTask.status !== 'done') {
      return false;
    }
  }
  
  return true;
}

export function getBlockedTasks(prd: PRD): Task[] {
  const blocked: Task[] = [];
  
  for (const task of prd.tasks) {
    if (task.status === 'pending' && !allDependenciesMet(task, prd)) {
      blocked.push(task);
    }
  }
  
  return blocked;
}

export function updateTaskStatus(prd: PRD, taskId: string, status: Task['status'], error?: string): void {
  const task = prd.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    if (error) {
      task.error = error;
    }
    if (status === 'running') {
      task.attempts++;
    }
  }
}

export function setTaskOutput(prd: PRD, taskId: string, outputPath: string): void {
  const task = prd.tasks.find(t => t.id === taskId);
  if (task) {
    task.output = outputPath;
  }
}

export function savePRD(prd: PRD, prdPath: string): void {
  writeFileSync(prdPath, JSON.stringify(prd, null, 2));
}

/**
 * Promote pending tasks to ready if all their dependencies are done.
 * Returns the number of tasks promoted.
 */
export function promotePendingTasks(prd: PRD): number {
  let promoted = 0;
  
  for (const task of prd.tasks) {
    if (task.status === 'pending') {
      const allDepsDone = allDependenciesMet(task, prd);
      if (allDepsDone) {
        task.status = 'ready';
        promoted++;
      }
    }
  }
  
  return promoted;
}
