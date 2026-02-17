// Task Picker - Finds the next ready task to execute

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
  const { writeFileSync } = require('fs');
  writeFileSync(prdPath, JSON.stringify(prd, null, 2));
}
