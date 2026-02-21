# Task Picker

## Source
Extracted from Nova26 `src/orchestrator/task-picker.ts`

---

## Pattern: Task Picker

The Task Picker selects the next task to execute from a PRD's task list. It filters for "ready" tasks, sorts by phase (lower first) then by attempt count (fewer retries first), and verifies all dependencies are met before returning a task. It also handles promoting pending tasks to ready status when their dependencies complete, and provides utilities for tracking blocked tasks and updating task state.

---

## Implementation

### Code Example

```typescript
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

/**
 * Promote pending tasks to ready if all their dependencies are done.
 * Returns the number of tasks promoted.
 */
export function promotePendingTasks(prd: PRD): number {
  let promoted = 0;

  for (const task of prd.tasks) {
    if (task.status === 'pending') {
      if (allDependenciesMet(task, prd)) {
        task.status = 'ready';
        promoted++;
      }
    }
  }

  return promoted;
}
```

### Key Concepts

- Priority sorting: phase number first, then retry count (fewer attempts = higher priority)
- Dependency gating: a task only becomes eligible when every dependency is `done`
- Promotion cycle: after each task completes, `promotePendingTasks` unlocks the next wave

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Picking a random ready task — ignores phase ordering and dependency safety
export function pickNextTask(prd: PRD): Task | null {
  const readyTasks = prd.tasks.filter(t => t.status === 'ready');
  return readyTasks[Math.floor(Math.random() * readyTasks.length)] ?? null;
}
```

### ✅ Do This Instead

```typescript
// Sort by phase then attempts, and verify dependencies before returning
readyTasks.sort((a, b) => {
  if (a.phase !== b.phase) return a.phase - b.phase;
  return a.attempts - b.attempts;
});

for (const task of readyTasks) {
  if (allDependenciesMet(task, prd)) return task;
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Orchestrators that process a DAG of tasks with dependency constraints
- Build systems or CI pipelines where task ordering matters
- Any multi-phase workflow where later phases depend on earlier ones

❌ **Don't use for:**
- Simple sequential task lists with no dependencies (just iterate the array)

---

## Benefits

1. Deterministic task ordering — same PRD always produces the same execution sequence
2. Automatic dependency resolution — tasks never run before their prerequisites complete
3. Retry-aware prioritization — tasks with fewer attempts get picked first, preventing starvation

---

## Related Patterns

- See `ralph-loop-execution.md` for the main loop that calls `pickNextTask` each iteration
- See `parallel-task-runner.md` for running multiple independent tasks concurrently instead of picking one at a time

---

*Extracted: 2025-07-15*
