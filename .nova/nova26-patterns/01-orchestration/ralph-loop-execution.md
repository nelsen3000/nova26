# Ralph Loop Execution Pattern

## Source
Extracted from Nova26 `src/orchestrator/ralph-loop.ts`

---

## Pattern: Ralph Loop Execution

The Ralph Loop is Nova26's core execution engine. It processes a PRD (Product Requirements Document) by iterating over tasks, dispatching each to the appropriate agent, running quality gates, and persisting state. Supports sequential and parallel execution modes, optional plan approval, auto test-fix-retest loops, and council consensus voting for critical tasks.

---

## Implementation

### Code Example

```typescript
import { pickNextTask, promotePendingTasks, updateTaskStatus, savePRD } from './task-picker.js';
import { buildPrompt, buildRetryPrompt } from './prompt-builder.js';
import { runGates, allGatesPassed, getGatesSummary } from './gate-runner.js';
import { runCouncilVote, requiresCouncilApproval } from './council-runner.js';
import { callLLM } from '../llm/ollama-client.js';
import { ParallelRunner, getIndependentTasks } from './parallel-runner.js';
import type { PRD, Task, LLMResponse } from '../types/index.js';

export interface RalphLoopOptions {
  parallelMode?: boolean;
  concurrency?: number;
  autoTestFix?: boolean;
  maxTestRetries?: number;
  planApproval?: boolean;
}

export async function ralphLoop(
  prd: PRD,
  prdPath: string,
  llmCaller?: LLMCaller,
  options?: RalphLoopOptions
): Promise<void> {
  const parallelRunner = new ParallelRunner({ concurrency: options?.concurrency || 4 });
  let maxIterations = prd.tasks.length * 3; // Prevent infinite loops
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    const readyTasks = prd.tasks.filter(t => t.status === 'ready');

    if (readyTasks.length === 0) {
      const allDone = prd.tasks.every(t => t.status === 'done');
      if (allDone) break;
      const anyFailed = prd.tasks.some(t => t.status === 'failed');
      if (anyFailed) break;
      break;
    }

    // Parallel mode: run independent tasks together
    if (options?.parallelMode && readyTasks.length > 1) {
      const independent = getIndependentTasks(readyTasks);
      if (independent.length > 1) {
        await parallelRunner.runPhase(independent, async (task) => {
          await processTask(task, prd, prdPath, llmCaller, options);
        });
        promotePendingTasks(prd);
        savePRD(prd, prdPath);
        continue;
      }
    }

    // Sequential: pick highest-priority task
    const task = pickNextTask(prd);
    if (!task) continue;

    await processTask(task, prd, prdPath, llmCaller, options);
    promotePendingTasks(prd);
    savePRD(prd, prdPath);
  }
}
```


```typescript
// Task processing pipeline — the core of each iteration
async function processTask(task: Task, prd: PRD, prdPath: string, ...): Promise<void> {
  // 1. Initialize todos for complex tasks
  if (shouldCreateTodos(task) && !task.todos) {
    task.todos = createInitialTodos(task);
  }

  // 2. Mark task as running
  updateTaskStatus(prd, task.id, 'running');
  savePRD(prd, prdPath);

  // 3. Build prompt with dependency context
  const { systemPrompt, userPrompt } = await buildPrompt(task, prd);

  // 4. Optional: generate plan for approval
  if (options?.planApproval) {
    const planResponse = await callLLM(systemPrompt, buildPlanPrompt(task, prd), task.agent);
    console.log(planResponse.content);
  }

  // 5. Call LLM
  const response = await callLLM(systemPrompt, userPrompt, task.agent);

  // 6. Run quality gates
  const gateResults = await runGates(task, response, {
    enabled: true,
    gates: ['response-validation', 'mercury-validator'],
  });

  if (!allGatesPassed(gateResults)) {
    // 7. Retry once with error context
    if (task.attempts < 2) {
      const retryPrompt = buildRetryPrompt(task, getGatesSummary(gateResults), response.content);
      response = await callLLM(systemPrompt, retryPrompt, task.agent);
    }
  }

  // 8. Optional: auto test→fix→retest loop
  if (options?.autoTestFix) {
    response = await testFixLoop(task, response, systemPrompt, llmCaller, maxRetries);
  }

  // 9. Optional: council approval vote
  if (requiresCouncilApproval(task)) {
    const decision = await runCouncilVote(task, response.content);
    if (decision.finalVerdict === 'rejected') {
      throw new Error(`Council rejected: ${decision.summary}`);
    }
  }

  // 10. Save output and mark done
  const outputPath = await saveTaskOutput(task, response);
  setTaskOutput(prd, task.id, outputPath);
  updateTaskStatus(prd, task.id, 'done');
  savePRD(prd, prdPath);
}
```

### Planning Phases

```typescript
export const PLANNING_PHASES: PlanningPhase[] = [
  { name: 'UNDERSTAND', exitCriteria: 'Task requirements are clear' },
  { name: 'CLARIFY',   exitCriteria: 'No open questions remain' },
  { name: 'PLAN',      exitCriteria: 'Step-by-step plan written' },
  { name: 'APPROVE',   exitCriteria: 'User approves plan' },
  { name: 'EXECUTE',   exitCriteria: 'All plan steps completed' },
  { name: 'VERIFY',    exitCriteria: 'All checks pass' },
  { name: 'DELIVER',   exitCriteria: 'Output saved and task marked done' },
];
```

### Key Concepts

- Bounded iteration: `maxIterations = tasks.length * 3` prevents infinite loops
- State persistence: PRD is saved to disk after every task completion
- Promotion cycle: `promotePendingTasks` unlocks the next wave of tasks after each completion
- Graceful termination: loop detects all-done, any-failed, and blocked states

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No iteration limit — infinite loop on blocked tasks
while (true) {
  const task = pickNextTask(prd);
  await processTask(task, prd, prdPath);
}

// Not saving PRD after each task — state lost on crash
await processTask(task, prd, prdPath);
// Missing: savePRD(prd, prdPath);

// Not promoting pending tasks — downstream tasks never become ready
await processTask(task, prd, prdPath);
// Missing: promotePendingTasks(prd);
```

### ✅ Do This Instead

```typescript
let maxIterations = prd.tasks.length * 3;
let iteration = 0;

while (iteration < maxIterations) {
  iteration++;
  const task = pickNextTask(prd);
  if (!task) break;

  await processTask(task, prd, prdPath);
  promotePendingTasks(prd);
  savePRD(prd, prdPath);
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Multi-agent orchestration systems that process a DAG of tasks
- Workflows requiring quality gates, retries, and consensus checks between steps

❌ **Don't use for:**
- Simple sequential scripts with no inter-task dependencies or quality validation

---

## Benefits

1. Crash-safe execution — PRD state is persisted after every task, enabling resumption
2. Flexible execution modes — supports sequential, parallel, plan-approval, and auto-test-fix modes
3. Built-in quality assurance — every task output passes through gates and optional council review
4. Bounded iteration — prevents infinite loops with a configurable iteration cap

---

## Related Patterns

- See `task-picker.md` for the priority-based task selection algorithm
- See `parallel-task-runner.md` for concurrent execution of independent tasks
- See `gate-runner-pipeline.md` for the quality gate validation pipeline
- See `council-consensus-voting.md` for multi-agent consensus on critical decisions
- See `prompt-builder-dependency-injection.md` for prompt construction with dependency context
- See `event-store.md` for the event-sourced session log used during execution

---

*Extracted: 2025-07-15*
