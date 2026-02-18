import { describe, it, expect } from 'vitest';
import {
  pickNextTask,
  promotePendingTasks,
  getBlockedTasks,
  updateTaskStatus,
  setTaskOutput,
} from './task-picker.js';
import type { PRD, Task } from '../types/index.js';

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: `Task ${overrides.id}`,
    description: `Description for ${overrides.id}`,
    agent: 'EARTH',
    status: 'pending',
    dependencies: [],
    phase: 1,
    attempts: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePRD(tasks: Task[]): PRD {
  return {
    meta: { name: 'test', version: '1.0', createdAt: new Date().toISOString() },
    tasks,
  };
}

describe('pickNextTask', () => {
  it('returns null when no tasks are ready', () => {
    const prd = makePRD([makeTask({ id: 'T1', status: 'pending' })]);
    expect(pickNextTask(prd)).toBeNull();
  });

  it('returns null when PRD has no tasks', () => {
    const prd = makePRD([]);
    expect(pickNextTask(prd)).toBeNull();
  });

  it('returns a ready task with no dependencies', () => {
    const prd = makePRD([makeTask({ id: 'T1', status: 'ready' })]);
    const task = pickNextTask(prd);
    expect(task).not.toBeNull();
    expect(task!.id).toBe('T1');
  });

  it('returns lower phase tasks first', () => {
    const prd = makePRD([
      makeTask({ id: 'T2', status: 'ready', phase: 2 }),
      makeTask({ id: 'T1', status: 'ready', phase: 1 }),
    ]);
    const task = pickNextTask(prd);
    expect(task!.id).toBe('T1');
  });

  it('returns fewer-attempt tasks first within same phase', () => {
    const prd = makePRD([
      makeTask({ id: 'T2', status: 'ready', phase: 1, attempts: 3 }),
      makeTask({ id: 'T1', status: 'ready', phase: 1, attempts: 0 }),
    ]);
    const task = pickNextTask(prd);
    expect(task!.id).toBe('T1');
  });

  it('skips ready tasks whose dependencies are not met', () => {
    const prd = makePRD([
      makeTask({ id: 'T1', status: 'ready', dependencies: ['T0'] }),
      makeTask({ id: 'T0', status: 'running' }),
    ]);
    expect(pickNextTask(prd)).toBeNull();
  });

  it('picks ready task when all dependencies are done', () => {
    const prd = makePRD([
      makeTask({ id: 'T1', status: 'ready', dependencies: ['T0'] }),
      makeTask({ id: 'T0', status: 'done' }),
    ]);
    const task = pickNextTask(prd);
    expect(task!.id).toBe('T1');
  });

  it('handles multiple dependencies correctly', () => {
    const prd = makePRD([
      makeTask({ id: 'T2', status: 'ready', dependencies: ['T0', 'T1'] }),
      makeTask({ id: 'T0', status: 'done' }),
      makeTask({ id: 'T1', status: 'done' }),
    ]);
    const task = pickNextTask(prd);
    expect(task!.id).toBe('T2');
  });

  it('skips task when one of multiple dependencies is not done', () => {
    const prd = makePRD([
      makeTask({ id: 'T2', status: 'ready', dependencies: ['T0', 'T1'] }),
      makeTask({ id: 'T0', status: 'done' }),
      makeTask({ id: 'T1', status: 'running' }),
    ]);
    expect(pickNextTask(prd)).toBeNull();
  });
});

describe('promotePendingTasks', () => {
  it('promotes pending tasks with no dependencies to ready', () => {
    const prd = makePRD([makeTask({ id: 'T1', status: 'pending' })]);
    const promoted = promotePendingTasks(prd);
    expect(promoted).toBe(1);
    expect(prd.tasks[0].status).toBe('ready');
  });

  it('promotes pending tasks when all deps are done', () => {
    const prd = makePRD([
      makeTask({ id: 'T0', status: 'done' }),
      makeTask({ id: 'T1', status: 'pending', dependencies: ['T0'] }),
    ]);
    const promoted = promotePendingTasks(prd);
    expect(promoted).toBe(1);
    expect(prd.tasks[1].status).toBe('ready');
  });

  it('does not promote pending tasks with unmet dependencies', () => {
    const prd = makePRD([
      makeTask({ id: 'T0', status: 'running' }),
      makeTask({ id: 'T1', status: 'pending', dependencies: ['T0'] }),
    ]);
    const promoted = promotePendingTasks(prd);
    expect(promoted).toBe(0);
    expect(prd.tasks[1].status).toBe('pending');
  });

  it('does not promote non-pending tasks', () => {
    const prd = makePRD([makeTask({ id: 'T1', status: 'done' })]);
    const promoted = promotePendingTasks(prd);
    expect(promoted).toBe(0);
  });

  it('promotes multiple tasks at once', () => {
    const prd = makePRD([
      makeTask({ id: 'T0', status: 'done' }),
      makeTask({ id: 'T1', status: 'pending', dependencies: ['T0'] }),
      makeTask({ id: 'T2', status: 'pending', dependencies: ['T0'] }),
      makeTask({ id: 'T3', status: 'pending', dependencies: ['T1'] }), // won't promote yet
    ]);
    const promoted = promotePendingTasks(prd);
    expect(promoted).toBe(2);
    expect(prd.tasks[1].status).toBe('ready');
    expect(prd.tasks[2].status).toBe('ready');
    expect(prd.tasks[3].status).toBe('pending'); // T1 just became ready, not done
  });
});

describe('getBlockedTasks', () => {
  it('returns empty array when no tasks are blocked', () => {
    const prd = makePRD([makeTask({ id: 'T1', status: 'pending' })]);
    expect(getBlockedTasks(prd)).toHaveLength(0);
  });

  it('returns pending tasks with unmet dependencies', () => {
    const prd = makePRD([
      makeTask({ id: 'T0', status: 'running' }),
      makeTask({ id: 'T1', status: 'pending', dependencies: ['T0'] }),
    ]);
    const blocked = getBlockedTasks(prd);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].id).toBe('T1');
  });

  it('does not include non-pending tasks', () => {
    const prd = makePRD([
      makeTask({ id: 'T0', status: 'running' }),
      makeTask({ id: 'T1', status: 'ready', dependencies: ['T0'] }),
    ]);
    expect(getBlockedTasks(prd)).toHaveLength(0);
  });

  it('includes tasks with missing dependency references', () => {
    const prd = makePRD([
      makeTask({ id: 'T1', status: 'pending', dependencies: ['NONEXISTENT'] }),
    ]);
    const blocked = getBlockedTasks(prd);
    expect(blocked).toHaveLength(1);
  });
});

describe('updateTaskStatus', () => {
  it('updates task status', () => {
    const prd = makePRD([makeTask({ id: 'T1', status: 'ready' })]);
    updateTaskStatus(prd, 'T1', 'running');
    expect(prd.tasks[0].status).toBe('running');
  });

  it('increments attempts when set to running', () => {
    const prd = makePRD([makeTask({ id: 'T1', status: 'ready', attempts: 0 })]);
    updateTaskStatus(prd, 'T1', 'running');
    expect(prd.tasks[0].attempts).toBe(1);
  });

  it('does not increment attempts for other statuses', () => {
    const prd = makePRD([makeTask({ id: 'T1', status: 'running', attempts: 1 })]);
    updateTaskStatus(prd, 'T1', 'done');
    expect(prd.tasks[0].attempts).toBe(1);
  });

  it('sets error when provided', () => {
    const prd = makePRD([makeTask({ id: 'T1', status: 'running' })]);
    updateTaskStatus(prd, 'T1', 'failed', 'Something broke');
    expect(prd.tasks[0].error).toBe('Something broke');
  });

  it('handles missing task gracefully', () => {
    const prd = makePRD([]);
    updateTaskStatus(prd, 'NONEXISTENT', 'done'); // should not throw
  });
});

describe('setTaskOutput', () => {
  it('sets the output path on a task', () => {
    const prd = makePRD([makeTask({ id: 'T1' })]);
    setTaskOutput(prd, 'T1', '/output/T1.md');
    expect(prd.tasks[0].output).toBe('/output/T1.md');
  });

  it('handles missing task gracefully', () => {
    const prd = makePRD([]);
    setTaskOutput(prd, 'NONEXISTENT', '/output/x.md'); // should not throw
  });
});
