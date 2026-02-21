# Prompt Builder with Dependency Injection

## Source
Extracted from Nova26 `src/orchestrator/prompt-builder.ts`

---

## Pattern: Prompt Builder with Dependency Injection

The prompt builder constructs agent prompts by combining three layers: a system prompt loaded from the agent's markdown template, a user prompt containing the task description, and dependency context injected from the outputs of completed upstream tasks. This ensures each agent has full context from prior phases without manual wiring. A separate retry prompt builder reformats gate failure details for LLM self-correction.

---

## Implementation

### Code Example

```typescript
import { readFileSync, existsSync } from 'fs';
import { loadAgent } from './agent-loader.js';
import type { Task, PRD } from '../types/index.js';

export interface PromptContext {
  systemPrompt: string;
  userPrompt: string;
}

export async function buildPrompt(task: Task, prd: PRD): Promise<PromptContext> {
  // Load the agent template from .nova/agents/{AGENT}.md
  const agentTemplate = await loadAgent(task.agent);

  // Build the user prompt with task info and dependency context
  const userPrompt = buildUserPrompt(task, prd);

  return { systemPrompt: agentTemplate, userPrompt };
}

function buildUserPrompt(task: Task, prd: PRD): string {
  let prompt = `# Task: ${task.title}\n\n## Description\n${task.description}\n\n## Agent\n${task.agent}\n\n## Phase\n${task.phase}\n\n`;

  if (task.dependencies && task.dependencies.length > 0) {
    prompt += buildDependencyContext(task, prd);
  }

  prompt += `## Instructions\nComplete this task according to your role as ${task.agent}.\nYour output will be validated against quality gates.\n`;

  return prompt;
}

function buildDependencyContext(task: Task, prd: PRD): string {
  let context = `## Context from Completed Dependencies\n\n`;

  for (const depId of task.dependencies) {
    const depTask = prd.tasks.find(t => t.id === depId);

    if (!depTask) {
      context += `### ${depId}: NOT FOUND\n\n`;
      continue;
    }

    if (depTask.status !== 'done') {
      context += `### ${depId}: ${depTask.title}\nDependency not yet available (status: ${depTask.status})\n\n`;
      continue;
    }

    context += `### ${depId} — ${depTask.title}:\n`;
    if (depTask.output && existsSync(depTask.output)) {
      try {
        context += `${readFileSync(depTask.output, 'utf-8')}\n\n`;
      } catch {
        context += `(Output file not readable)\n\n`;
      }
    } else {
      context += `(No output file found)\n\n`;
    }
  }

  return context;
}

export function buildRetryPrompt(task: Task, error: string, previousResponse: string): string {
  return `# Retry Task: ${task.title}\n\n## Previous Error\n${error}\n\n## Previous Response\n${previousResponse.substring(0, 2000)}\n\nPlease retry and provide a corrected output.`;
}
```

### Key Concepts

- Three-layer prompt: system prompt (agent identity) + user prompt (task + deps) + instructions
- Automatic dependency injection: outputs from completed upstream tasks are read from disk and included
- Graceful handling of missing deps: logs status instead of crashing when a dependency isn't done yet
- Retry prompt truncation: previous response is capped at 2000 chars to avoid exceeding context windows

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No dependency context — agents work blind
const userPrompt = `Task: ${task.description}`;
// Agent doesn't know what previous tasks produced

// Including all task outputs regardless of dependency relationship
const allOutputs = prd.tasks.filter(t => t.status === 'done').map(t => readFileSync(t.output));
// Bloats context with irrelevant information

// Hardcoded system prompts in code
const systemPrompt = "You are MARS, a backend agent...";
// Should load from .nova/agents/MARS.md for easy editing
```

### ✅ Do This Instead

```typescript
// Load agent template from file, inject only relevant dependency outputs
const systemPrompt = await loadAgent(task.agent);
const depContext = task.dependencies
  .map(depId => prd.tasks.find(t => t.id === depId))
  .filter((t): t is Task => t?.status === 'done' && !!t.output)
  .map(t => readFileSync(t.output!, 'utf-8'))
  .join('\n\n---\n\n');
```

---

## When to Use This Pattern

✅ **Use for:**
- Multi-agent pipelines where each agent needs context from upstream agents' outputs
- Systems where agent behavior is defined in editable template files rather than hardcoded prompts

❌ **Don't use for:**
- Single-shot LLM calls with no dependency chain or agent specialization

---

## Benefits

1. Automatic context propagation — downstream agents receive upstream outputs without manual wiring
2. Editable agent identities — system prompts live in markdown files, not code
3. Safe retry support — retry prompts include failure details and truncated previous output for self-correction

---

## Related Patterns

- See `ralph-loop-execution.md` for where `buildPrompt` is called in the task processing pipeline
- See `../02-agent-system/agent-loader.md` for how agent templates are loaded from `.nova/agents/`
- See `gate-runner-pipeline.md` for the quality gates whose failure messages feed into retry prompts

---

*Extracted: 2025-07-15*
