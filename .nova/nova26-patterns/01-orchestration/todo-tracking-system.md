# Todo Tracking System

## Source
Extracted from Nova26 `src/orchestrator/ralph-loop.ts` (todo functions)

---

## Pattern: Todo Tracking System

Complex tasks get broken into `TodoItem` sub-steps that are tracked through `pending → in_progress → completed` states. Only one todo can be `in_progress` at a time — advancing one automatically completes the previous. Each todo carries agent-specific verification criteria. Progress is displayed in the console during execution with emoji indicators.

---

## Implementation

### Code Example

```typescript
import type { Task } from '../types/index.js';

interface TodoItem {
  id: string;
  content: string;
  activeForm: string;       // Present-tense: "Implementing..."
  status: 'pending' | 'in_progress' | 'completed';
  agent: string;
  createdAt: string;
  completedAt?: string;
  verificationCriteria: string[];
}

function shouldCreateTodos(task: Task): boolean {
  return (
    task.description.length > 200 ||
    task.title.toLowerCase().includes('implement') ||
    task.title.toLowerCase().includes('create') ||
    task.agent === 'JUPITER' || task.agent === 'MARS' || task.agent === 'VENUS'
  );
}

function createInitialTodos(task: Task): TodoItem[] {
  return [
    {
      id: `${task.id}-todo-1`,
      content: 'Analyze requirements and dependencies',
      activeForm: 'Analyzing requirements and dependencies',
      status: 'pending', agent: task.agent, createdAt: new Date().toISOString(),
      verificationCriteria: ['All dependencies read', 'Requirements understood'],
    },
    {
      id: `${task.id}-todo-2`,
      content: `Implement ${task.agent} deliverable`,
      activeForm: `Implementing ${task.agent} deliverable`,
      status: 'pending', agent: task.agent, createdAt: new Date().toISOString(),
      verificationCriteria: getVerificationCriteria(task.agent),
    },
    {
      id: `${task.id}-todo-3`,
      content: 'Verify deliverables against requirements',
      activeForm: 'Verifying deliverables against requirements',
      status: 'pending', agent: task.agent, createdAt: new Date().toISOString(),
      verificationCriteria: ['All acceptance criteria met', 'Quality gates pass'],
    },
  ];
}

function updateTodoStatus(task: Task, todoId: string, newStatus: TodoItem['status']): void {
  if (!task.todos) return;
  if (newStatus === 'in_progress') {
    for (const todo of task.todos) {
      if (todo.status === 'in_progress' && todo.id !== todoId) {
        todo.status = 'completed';
        todo.completedAt = new Date().toISOString();
      }
    }
    task.currentTodoId = todoId;
  }
  const todo = task.todos.find(t => t.id === todoId);
  if (todo) {
    todo.status = newStatus;
    if (newStatus === 'completed') todo.completedAt = new Date().toISOString();
  }
}

function formatTodos(task: Task): string {
  if (!task.todos || task.todos.length === 0) return '';
  const lines = ['\n📋 Task Progress:'];
  for (const todo of task.todos) {
    const icon = todo.status === 'completed' ? '✅' :
                 todo.status === 'in_progress' ? '▶️' : '⏳';
    lines.push(`  ${icon} ${todo.status === 'in_progress' ? `${todo.activeForm}...` : todo.content}`);
  }
  return lines.join('\n');
}
```

### Key Concepts

- Single active constraint: only one todo can be `in_progress` at a time
- Agent-specific criteria: VENUS requires 5 UI states, MARS forbids `any` types, PLUTO needs validators
- Automatic completion: advancing to the next todo auto-completes the previous one

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Multiple todos in_progress simultaneously — confusing state
todo1.status = 'in_progress';
todo2.status = 'in_progress'; // Which step are we on?

// Todos for trivial tasks — overhead without benefit
function shouldCreateTodos(task: Task): boolean {
  return true; // Creates todos for 1-line tasks
}
```

### ✅ Do This Instead

```typescript
// Enforce single in_progress via updateTodoStatus
updateTodoStatus(task, nextTodoId, 'in_progress');
// Automatically completes any other in_progress todo

// Only create todos for complex tasks
function shouldCreateTodos(task: Task): boolean {
  return task.description.length > 200 || task.agent === 'MARS';
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Complex multi-step tasks where progress visibility helps debugging and auditing
- Agent workflows where each phase (analyze, implement, verify) has distinct verification criteria

❌ **Don't use for:**
- Simple, atomic tasks that complete in a single step

---

## Benefits

1. Progress visibility — console output shows exactly which step is active during long-running tasks
2. Verification criteria — each todo carries measurable criteria tied to the agent's domain
3. Clean state machine — single-active constraint prevents ambiguous progress states

---

## Related Patterns

- See `ralph-loop-execution.md` for where todos are created and updated in `processTask`
- See `gate-runner-pipeline.md` for how verification criteria align with gate checks

---

*Extracted: 2025-07-15*
