# NOVA26 Orchestrator Reference

> Complete reference for the Ralph Loop orchestrator, task management, and execution flow.

---

## Overview

The **Ralph Loop** is the core execution engine of NOVA26. It continuously picks and processes tasks from a PRD until completion, passing through quality gates at each step.

### High-Level Flow

```
┌──────────────────────────────────────────────────────────────┐
│                      RALPH LOOP                               │
│                                                               │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐         │
│  │  Promote   │───▶│   Pick     │───▶│   Load     │         │
│  │  Pending   │    │   Next     │    │   Agent    │         │
│  │  Tasks     │    │   Task     │    │  Template  │         │
│  └────────────┘    └────────────┘    └────────────┘         │
│                                              │                │
│                                              ▼                │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐         │
│  │   Save     │◀───│   Run      │◀───│   Call     │         │
│  │  Output    │    │   Gates    │    │   LLM      │         │
│  └────────────┘    └────────────┘    └────────────┘         │
│        │                                        │            │
│        │              ┌────────────┐             │            │
│        └─────────────▶│   Next     │─────────────┘            │
│                       │  Iteration │                          │
│                       └────────────┘                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. ralph-loop.ts

The main execution loop that orchestrates the entire process.

**Key Functions:**
- `ralphLoop(prd, prdPath, llmCaller?)` - Main entry point

**Process:**
1. Call `promotePendingTasks()` to move tasks from pending→ready
2. Call `pickNextTask()` to get the next ready task
3. Call `loadAgent()` to get the agent template
4. Call `buildPrompt()` to create the prompt with context
5. Call `callLLM()` to get the response
6. Call `runGates()` to validate the response
7. If gates pass: save output and mark done
8. If gates fail: retry once, then mark failed
9. Loop until no more ready tasks

### 2. task-picker.ts

Manages task scheduling and status transitions.

**Key Functions:**

```typescript
// Find next ready task (sorted by phase, then attempts)
pickNextTask(prd: PRD): Task | null

// Promote pending tasks to ready if dependencies met
promotePendingTasks(prd: PRD): number

// Update task status
updateTaskStatus(prd, taskId, status, error?): void

// Record output path
setTaskOutput(prd, taskId, outputPath): void

// Save PRD to disk
savePRD(prd, prdPath): void
```

### 3. agent-loader.ts

Loads agent markdown templates.

**Key Functions:**

```typescript
// Load agent template from .nova/agents/{AGENT}.md
loadAgent(agentName: string): Promise<string>

// Clear cached agents
clearAgentCache(): void

// List available agents
listAvailableAgents(): string[]
```

**Loading Logic:**
1. Check cache first
2. Look for `.nova/agents/{agentName}.md`
3. If not found, return default prompt

### 4. prompt-builder.ts

Builds prompts with dependency context injection.

**Key Functions:**

```typescript
// Build prompt with task info and dependency outputs
buildPrompt(task: Task, prd: PRD): Promise<PromptContext>

// Build retry prompt with error feedback
buildRetryPrompt(task, error, previousResponse): string
```

**Context Injection:**
When a task has dependencies, the outputs of completed dependencies are injected:

```markdown
## Context from Completed Dependencies

### test-001 — Write product spec for Company entity:

# Product Spec: Company Entity

## Fields
- name: string, unique identifier...
...
```

### 5. gate-runner.ts

Runs quality gates on LLM responses.

**Key Functions:**

```typescript
// Run all enabled gates on response
runGates(task: Task, response: LLMResponse): Promise<GateResult[]>

// Check if all gates passed
allGatesPassed(results: GateResult[]): boolean

// Get summary of gate results
getGatesSummary(results: GateResult[]): string
```

---

## Task States

| State | Description |
|-------|-------------|
| `pending` | Not yet ready (dependencies not met) |
| `ready` | Ready to execute |
| `running` | Currently being processed |
| `done` | Completed successfully |
| `failed` | Failed after retries |
| `blocked` | Manually blocked |

### State Transitions

```
pending ──(deps done)──▶ ready ──(pick)──▶ running ──(gates pass)──▶ done
                                     │
                                     └──(gates fail + retry)──▶ running
                                     │
                                     └──(gates fail after retry)──▶ failed
```

---

## Dependency Resolution

### How It Works

1. **Initial State**: Tasks start in `pending` or `ready` based on their dependencies
2. **Promotion**: Each iteration calls `promotePendingTasks()` to check if any pending task now has all dependencies done
3. **Selection**: `pickNextTask()` selects from ready tasks, prioritizing lower phases

### Example

```json
{
  "tasks": [
    {
      "id": "test-001",
      "status": "ready",
      "dependencies": [],
      "phase": 0
    },
    {
      "id": "test-002", 
      "status": "pending",
      "dependencies": ["test-001"],
      "phase": 1
    },
    {
      "id": "test-003",
      "status": "pending", 
      "dependencies": ["test-001", "test-002"],
      "phase": 2
    }
  ]
}
```

**Execution Order:**
1. test-001 runs (ready, no deps)
2. test-001 completes → test-002 promotes to ready
3. test-002 runs
4. test-002 completes → test-003 promotes to ready
5. test-003 runs

---

## Quality Gates

### Gate Pipeline

1. **Response Validation** - Basic checks
2. **Mercury Validator** - Agent-specific validation

### Response Validation Gate

```typescript
// Basic checks
- Response is not empty
- Response has minimum length (50 chars)
- No obvious error patterns
```

### Mercury Validator Gate

Agent-specific validation:

| Agent | Must Contain |
|-------|--------------|
| EARTH | "Fields", "Constraints", "Validation" |
| PLUTO | "defineTable" |
| MERCURY | "PASS" or "FAIL" |
| VENUS | React component code |
| MARS | TypeScript code |

### Retry Logic

- **1 retry allowed** with failure feedback
- Failure message included in retry prompt
- If still failing after retry → mark as "failed"

---

## File Structure

```
src/orchestrator/
├── ralph-loop.ts      # Main execution loop
├── task-picker.ts     # Task scheduling
├── agent-loader.ts    # Load agent templates
├── prompt-builder.ts  # Build prompts with context
└── gate-runner.ts     # Quality gates
```

---

## Testing

### Integration Test

The integration test exercises the full Ralph Loop:

```bash
npm run test:integration
```

**What it tests:**
- Task picking and dependency resolution
- pending → ready promotion
- Context injection from dependencies
- Gate validation
- Output file writing
- PRD status updates

**Assertions (25 total):**
- All 3 tasks reach "done" status
- LLM called exactly 3 times
- Correct execution order (EARTH → PLUTO → MERCURY)
- Dependency context injected into prompts
- Output files created with proper content
- PRD output paths recorded
- State transitions work correctly

---

## CLI Integration

The CLI uses the orchestrator:

```bash
# Run PRD through Ralph Loop
npx tsx src/index.ts run .nova/prd-test.json
```

This loads the PRD, calls `ralphLoop()`, and processes all tasks.

---

## Key Functions Reference

### ralph-loop.ts

```typescript
export async function ralphLoop(
  prd: PRD, 
  prdPath: string, 
  llmCaller?: LLMCaller
): Promise<void>
```

### task-picker.ts

```typescript
export function pickNextTask(prd: PRD): Task | null
export function promotePendingTasks(prd: PRD): number
export function updateTaskStatus(prd: PRD, taskId: string, status: Task['status'], error?: string): void
export function setTaskOutput(prd: PRD, taskId: string, outputPath: string): void
export function savePRD(prd: PRD, prdPath: string): void
```

### agent-loader.ts

```typescript
export async function loadAgent(agentName: string): Promise<string>
export function clearAgentCache(): void
export function listAvailableAgents(): string[]
```

### prompt-builder.ts

```typescript
export interface PromptContext {
  systemPrompt: string
  userPrompt: string
}

export async function buildPrompt(task: Task, prd: PRD): Promise<PromptContext>
export function buildRetryPrompt(task: Task, error: string, previousResponse: string): string
```

### gate-runner.ts

```typescript
export interface GateResult {
  gate: string
  passed: boolean
  message: string
}

export async function runGates(task: Task, response: LLMResponse): Promise<GateResult[]>
export function allGatesPassed(results: GateResult[]): boolean
export function getGatesSummary(results: GateResult[]): string
```

---

*Last Updated: 2026-02-18*
