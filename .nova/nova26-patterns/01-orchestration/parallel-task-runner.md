# Parallel Task Runner

## Source
Extracted from Nova26 `src/orchestrator/parallel-runner.ts`

---

## Pattern: Parallel Task Runner

The `ParallelRunner` executes independent tasks concurrently using `Promise.all` with a configurable concurrency limit. Tasks are batched to avoid overwhelming the system. Each task runs with a timeout guard, and the runner falls back to sequential execution gracefully. A companion `getIndependentTasks` function filters a task set to only those with no intra-group dependencies.

---

## Implementation

### Code Example

```typescript
import type { Task } from '../types/index.js';

export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
}

export class ParallelRunner {
  private concurrency: number;
  private timeout: number;

  constructor(config: { concurrency?: number; timeout?: number } = {}) {
    this.concurrency = config.concurrency || 4;
    this.timeout = config.timeout || 5 * 60 * 1000; // 5 minutes
  }

  async runPhase(
    tasks: Task[],
    executor: (task: Task) => Promise<void>
  ): Promise<TaskResult[]> {
    if (tasks.length === 0) return [];
    const results: TaskResult[] = [];

    // Process in batches of `concurrency`
    for (let i = 0; i < tasks.length; i += this.concurrency) {
      const batch = tasks.slice(i, i + this.concurrency);
      const batchResults = await Promise.all(
        batch.map(task => this.executeWithTimeout(task, executor))
      );
      results.push(...batchResults);
    }
    return results;
  }

  private async executeWithTimeout(
    task: Task,
    executor: (task: Task) => Promise<void>
  ): Promise<TaskResult> {
    return new Promise<TaskResult>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({ taskId: task.id, status: 'timeout', error: `Task timed out after ${this.timeout}ms` });
      }, this.timeout);

      executor(task)
        .then(() => { clearTimeout(timeoutId); resolve({ taskId: task.id, status: 'completed' }); })
        .catch((error: Error) => { clearTimeout(timeoutId); resolve({ taskId: task.id, status: 'failed', error: error.message }); });
    });
  }

  async runSequential(
    tasks: Task[],
    executor: (task: Task) => Promise<void>
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    for (const task of tasks) {
      try {
        await executor(task);
        results.push({ taskId: task.id, status: 'completed' });
      } catch (error: any) {
        results.push({ taskId: task.id, status: 'failed', error: error.message });
      }
    }
    return results;
  }
}

export function getIndependentTasks(tasks: Task[]): Task[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  return tasks.filter(task =>
    !task.dependencies.some(depId => taskMap.has(depId))
  );
}
```

### Key Concepts

- Batched concurrency: tasks are sliced into batches of size `concurrency`, each batch runs via `Promise.all`
- Timeout guard: each task gets a `setTimeout` race — if the executor doesn't resolve in time, the result is `timeout`
- Never rejects: `executeWithTimeout` always resolves (with `completed`, `failed`, or `timeout`), so one failing task doesn't abort the batch
- Independence filter: `getIndependentTasks` ensures only tasks with no intra-group dependencies run in parallel

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No concurrency limit — spawns unlimited parallel tasks
await Promise.all(tasks.map(processTask)); // Can exhaust memory or API rate limits

// No timeout — hung tasks block the batch forever
await Promise.all(batch.map(executor)); // No timeout protection

// Running dependent tasks in parallel — produces incorrect results
const allReady = prd.tasks.filter(t => t.status === 'ready');
await parallelRunner.runPhase(allReady, processTask); // Must filter to independent only
```

### ✅ Do This Instead

```typescript
// Batch with concurrency limit and timeout per task
for (let i = 0; i < tasks.length; i += this.concurrency) {
  const batch = tasks.slice(i, i + this.concurrency);
  const results = await Promise.all(
    batch.map(task => this.executeWithTimeout(task, executor))
  );
}

// Filter to independent tasks first
const independent = getIndependentTasks(readyTasks);
if (independent.length > 1) {
  await parallelRunner.runPhase(independent, processTask);
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Orchestrators processing a DAG where multiple tasks in the same phase have no inter-dependencies
- Batch processing workloads where throughput matters but individual tasks may hang or fail

❌ **Don't use for:**
- Strictly sequential pipelines where every task depends on the previous one

---

## Benefits

1. Throughput improvement — independent tasks run concurrently instead of sequentially
2. Fault isolation — one failing or timing-out task doesn't crash the entire batch
3. Configurable backpressure — concurrency limit prevents resource exhaustion

---

## Related Patterns

- See `ralph-loop-execution.md` for the main loop that invokes the parallel runner
- See `task-picker.md` for the sequential task selection fallback
- See `gate-runner-pipeline.md` for quality gates that run on each task's output after parallel execution

---

*Extracted: 2025-07-15*
