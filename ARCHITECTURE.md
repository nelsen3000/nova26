# Architecture

## System Overview

Nova26 is an AI-powered IDE that orchestrates software development through 21 specialized agents. It uses a task-based execution model where Product Requirements Documents (PRDs) define the work to be done, and the Ralph Loop executes each task through specialized agents powered by local LLMs.

The system is designed around three core concepts:
1. **Task-Driven Development**: Work is defined as structured tasks in JSON PRD files with dependencies, phases, and status tracking
2. **Agent Specialization**: Each of the 21 agents has a specific role (EARTH for specs, PLUTO for schemas, MERCURY for validation, etc.)
3. **Quality Gates**: Every agent output passes through validation gates before being accepted, with automatic retry on failure

## Ralph Loop

The Ralph Loop is the core execution engine that continuously picks and processes tasks:

```
Pick Task → Load Agent → Build Prompt → Call LLM → Run Gates
    ↑                                                   ↓
    ←←←←← (next task) ←←←←←←←←←←←←←←←←←←←← PASS → Save + Log
                                               FAIL → Retry 1x → Block
```

Steps:
1. **Pick Task**: Find the next "ready" task (dependencies met, not blocked)
2. **Load Agent**: Read the agent template from `.nova/agents/{agent}.md`
3. **Build Prompt**: Combine agent template + task description + dependency outputs
4. **Call LLM**: Send to Ollama (or mock for testing)
5. **Run Gates**: Validate response passes quality checks
6. **Save + Log**: Write output to `.nova/output/{task.id}.md`, update PRD status

If gates fail: retry once with error feedback, then block if still failing.

## Agent System

Agents are **NOT** code, services, or running processes. They are markdown prompt templates that define:
- The agent's role and responsibilities
- Input/output format expectations
- Quality checklists
- Constraints and rules

SUN loads them as system prompts into the LLM context. The agent template determines behavior for that specific task type.

## Quality Gates

Pipeline (stops on critical failure):
1. **Response Validation**: Basic checks (non-empty, minimum length, no obvious errors)
2. **Mercury Validator**: Agent-specific validation (EARTH needs specs, PLUTO needs schemas)
3. **TypeScript Check**: (stub) Would run tsc on generated code
4. **Test Runner**: (stub) Would run vitest on generated tests

1 retry allowed with failure feedback included in retry prompt.

## Task Dependencies

Tasks chain through dependencies. A task is "ready" only when ALL dependencies have status "done".

When building prompts for dependent tasks, the output of completed dependencies is injected as context:
```
## Context from completed dependencies:

### dep-001 — Task Title:
[content of .nova/output/dep-001.md]
```

This allows PLUTO to see EARTH's specs, MERCURY to see both, etc.

## ATLAS Learning System

ATLAS logs every build attempt to learn patterns:
- 6 Convex tables: builds, patterns, agents, tasks, executions, learnings
- Currently file-based (JSON), will migrate to Convex when deployed
- Stores successful code patterns for reuse

## Model Router

Currently returns qwen2.5:7b for everything. Designed for future:
- Agent-specific models (JUPITER gets 14B for complex reasoning)
- Cloud escalation for large tasks
- Temperature tuning per agent type

## File Flow Diagram

```
User Request
     ↓
prd.json (task list)
     ↓
task-picker.ts (finds next ready task)
     ↓
agent-loader.ts (reads .nova/agents/AGENT.md)
     ↓
prompt-builder.ts (system prompt + task + dependency outputs)
     ↓
ollama-client.ts (POST to localhost:11434)
     ↓
gate-runner.ts (validate response)
     ↓
.nova/output/task-id.md (saved output)
     ↓
.nova/atlas/builds.json (logged)
     ↓
Next task (loop)
```
