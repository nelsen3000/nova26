# NOVA26 Technical Reference Manual

> **Purpose**: This document serves as the complete reference for AI agents and developers to understand NOVA26's architecture, goals, and implementation details.

---

## 1. Project Overview

### Mission Statement
**NOVA26** is an autonomous software engineering system that uses 21 specialized AI agents to build software through orchestrated task execution. It transforms high-level requirements into working code through a deterministic, gate-guaranteed pipeline.

### Core Goals
1. **Agent Specialization**: 21 distinct agents, each expert in a specific domain (frontend, backend, database, testing, etc.)
2. **Task-Driven Development**: All work flows through structured Product Requirements Documents (PRDs) with explicit dependencies
3. **Quality Gates**: Every agent output must pass validation before proceeding; automatic retry on failure
4. **Local-First**: Runs entirely on local infrastructure (Node.js + Ollama); no cloud dependencies
5. **Learning System**: ATLAS logs builds and patterns for future optimization

### Repository
- **GitHub**: https://github.com/nelsen3000/nova26
- **Local Path**: `/Users/jonathannelsen/.minimax-agent/projects/19`

---

## 2. Architecture

### High-Level System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                │
│  (CLI: nova run prd.json)                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRD (JSON)                                    │
│  - tasks[] with dependencies, phases, status                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 RALPH LOOP (CORE ENGINE)                        │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │Pick Next    │───▶│Load Agent   │───▶│Build Prompt │        │
│  │Ready Task   │    │Template     │    │+ Context    │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                                        │               │
│         │                                        ▼               │
│         │                              ┌─────────────┐         │
│         │                              │  Call LLM   │         │
│         │                              │(Ollama/Mock)│         │
│         │                              └─────────────┘         │
│         │                                        │               │
│         │                                        ▼               │
│         │                              ┌─────────────┐         │
│         │                              │ Run Quality │         │
│         │                              │   Gates     │         │
│         │                              └─────────────┘         │
│         │                                        │               │
│         │                    ┌──────────────────┴───────────┐   │
│         │                    │                              │   │
│         │                    ▼                              ▼   │
│         │            ┌─────────────┐              ┌──────────┐ │
│         │            │   PASS      │              │   FAIL   │ │
│         │            │Save+Log    │              │Retry 1x  │ │
│         │            └─────────────┘              └──────────┘ │
│         │                    │                              │   │
│         │                    └──────────────┬───────────────┘   │
│         │                                   │                   │
│         └───────────────────────────────────▶                   │
│              (iterate until done)                              │
└─────────────────────────────────────────────────────────────────┘
```

### Ralph Loop Details

The **Ralph Loop** is the core execution engine. Each iteration:

1. **promotePendingTasks()**: Check pending tasks; promote to "ready" if all dependencies are "done"
2. **pickNextTask()**: Find the next "ready" task (sorted by phase, then attempts)
3. **loadAgent()**: Read `.nova/agents/{AGENT}.md` template
4. **buildPrompt()**: Combine agent template + task description + dependency outputs
5. **callLLM()**: Send to Ollama (or mock for testing)
6. **runGates()**: Validate response passes quality checks
7. **saveTaskOutput()**: Write to `.nova/output/{task.id}.md`
8. **updateTaskStatus()**: Mark task as "done" or "failed"

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point (status, reset, run commands) |
| `src/orchestrator/ralph-loop.ts` | Core execution loop |
| `src/orchestrator/task-picker.ts` | Task scheduling, promotion, status updates |
| `src/orchestrator/agent-loader.ts` | Load agent markdown templates |
| `src/orchestrator/prompt-builder.ts` | Build prompts with dependency context |
| `src/orchestrator/gate-runner.ts` | Quality gate validation |
| `src/llm/ollama-client.ts` | Ollama API client |

---

## 3. The Agent System

### Overview
Agents are **NOT** code, services, or running processes. They are **markdown prompt templates** that define:
- The agent's role and responsibilities
- Input/output format expectations
- Quality checklists
- Constraints and rules

When running, the system loads an agent's template as the **system prompt** for the LLM.

### Directory
- **Location**: `.nova/agents/`
- **Format**: `{AGENT_NAME}.md` (e.g., `EARTH.md`, `PLUTO.md`)
- **Loading**: `agent-loader.ts` reads these files and injects them into LLM contexts

### 21 Agents

| Agent | Role | Domain |
|-------|------|--------|
| **SUN** | Orchestrator | Task planning, dispatch, coordination |
| **MERCURY** | Validator | Spec compliance checking |
| **VENUS** | Frontend | React 19, Tailwind, shadcn/ui, WCAG 2.1 AA |
| **EARTH** | Product | Specs, user stories, Gherkin scenarios |
| **MARS** | Backend | TypeScript strict, Convex mutations/queries |
| **PLUTO** | Database | Convex schemas, row-level isolation |
| **SATURN** | Testing | Vitest, RTL, Playwright |
| **JUPITER** | Architecture | ADRs, component hierarchy, data flow |
| **ENCELADUS** | Security | Auth, XSS prevention, input validation |
| **GANYMEDE** | API | Stripe, Ollama, external integrations |
| **NEPTUNE** | Analytics | Metrics dashboards, recharts |
| **CHARON** | Error UX | Fallback screens, empty states |
| **URANUS** | R&D | Tool evaluation, recommendations |
| **TITAN** | Real-time | Convex subscriptions, optimistic updates |
| **EUROPA** | Mobile | PWA, responsive, service workers |
| **MIMAS** | Resilience | Retry logic, circuit breakers |
| **IO** | Performance | FCP/LCP budgets, bundle analysis |
| **TRITON** | DevOps | GitHub Actions, Convex deploy |
| **CALLISTO** | Documentation | READMEs, API docs |
| **ATLAS** | Meta-learner | Build logs, patterns, retrospectives |
| **ANDROMEDA** | Ideas | Opportunity identification, research |

---

## 4. Quality Gates

Every agent output must pass validation before being accepted.

### Pipeline (stops on critical failure)

1. **Response Validation**: Basic checks
   - Non-empty response
   - Minimum length (50 chars)
   - No obvious error patterns

2. **Mercury Validator**: Agent-specific validation
   - EARTH outputs must contain "Fields", "Constraints", "Validation"
   - PLUTO outputs must contain "defineTable"
   - MERCURY outputs must start with "PASS" or "FAIL"

3. **TypeScript Check**: (stub) Would run `tsc` on generated code

4. **Test Runner**: (stub) Would run `vitest` on generated tests

### Retry Logic
- 1 retry allowed with failure feedback
- Failure message included in retry prompt
- If still failing after retry, task is marked as "failed"

---

## 5. Task Dependencies & Context Injection

### How Dependencies Work
A task is "ready" only when ALL dependencies have status "done". The system tracks:
- **pending**: Not yet ready (dependencies not met)
- **ready**: Ready to execute
- **running**: Currently being processed
- **done**: Completed successfully
- **failed**: Failed after retries

### Context Injection
When building prompts for dependent tasks, the output of completed dependencies is injected:

```markdown
## Context from Completed Dependencies

### test-001 — Write product spec for Company entity:

# Product Spec: Company Entity

## Fields
- **name**: string, unique identifier...
...
```

This allows PLUTO to see EARTH's specs, MERCURY to see both, etc.

---

## 6. Data Structures

### PRD Structure (JSON)

```typescript
interface Task {
  id: string;           // e.g., "test-001"
  title: string;       // Human-readable title
  description: string;  // Detailed task description
  agent: string;        // Agent to use (e.g., "EARTH", "PLUTO")
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed' | 'blocked';
  dependencies: string[];  // Array of task IDs this depends on
  phase: number;        // Execution phase (0, 1, 2, ...)
  attempts: number;     // Retry count
  createdAt: string;    // ISO timestamp
  output?: string;      // Path to output file
  error?: string;       // Error message if failed
}

interface PRD {
  meta: {
    name: string;
    version: string;
    createdAt: string;
  };
  tasks: Task[];
}
```

### Example PRD

```json
{
  "meta": {
    "name": "Test PRD",
    "version": "1.0.0",
    "createdAt": "2026-02-17T10:00:00Z"
  },
  "tasks": [
    {
      "id": "test-001",
      "title": "Write product spec for Company entity",
      "description": "Write a product spec...",
      "agent": "EARTH",
      "status": "ready",
      "dependencies": [],
      "phase": 0,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    },
    {
      "id": "test-002",
      "title": "Create Company table schema",
      "description": "Based on the spec...",
      "agent": "PLUTO",
      "status": "pending",
      "dependencies": ["test-001"],
      "phase": 1,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    }
  ]
}
```

---

## 7. Database Schema (Convex)

### 10 Tables Total

#### ATLAS Tables (6) - Learning System

| Table | Purpose | Indexes |
|-------|---------|---------|
| `builds` | PRD build runs | by_prd, by_status |
| `patterns` | Reusable code patterns | by_language, by_tags |
| `agents` | Agent configurations | by_name, by_domain |
| `tasks` | Task execution records | by_build, by_status, by_agent |
| `executions` | LLM call logs | by_task, by_timestamp |
| `learnings` | Build insights | by_build, by_task |

#### UA Dashboard Tables (4) - Application Data

| Table | Purpose | Indexes |
|-------|---------|---------|
| `companies` | Company entities | by_status, by_sector |
| `chipAccounts` | Financial accounts | by_company, by_company_type |
| `divisions` | Company divisions | by_company, by_company_revenue |
| `agents` | AI agent instances | by_company, by_division, by_status |

---

## 8. CLI Commands

### Available Commands

```bash
# Check PRD status
npx tsx src/index.ts status .nova/prd-test.json

# Reset PRD tasks (set phase 0 to ready, others to pending)
npx tsx src/index.ts reset .nova/prd-test.json

# Run PRD through Ralph Loop
npx tsx src/index.ts run .nova/prd-test.json
```

### Output Example

```
=== PRD Status: Test PRD ===
Total Tasks: 3
  Ready:    1
  Pending: 2
  Running:  0
  Done:     0
  Failed:   0
  Blocked:  0
By Phase:
  Phase 0: 0/1 done
  Phase 1: 0/1 done
  Phase 2: 0/1 done
Ready Tasks:
  - test-001: Write product spec for Company entity
```

---

## 9. Testing

### Test Types

| Test | Command | Purpose |
|------|---------|---------|
| **Mock Test** | `npm run test:mock` | Iterates PRD JSON directly, no LLM needed |
| **Integration Test** | `npm run test:integration` | Runs full Ralph Loop with mock LLM |
| **Type Check** | `npx tsc --noEmit` | TypeScript compilation |

### Integration Test (25 Assertions)

The integration test exercises the full Ralph Loop with a mock LLM:
- Task picking and dependency resolution
- pending → ready promotion
- Context injection from dependencies
- Gate validation
- Output file writing
- PRD status updates

### Verification Commands

```bash
# Must exit 0
npx tsc --noEmit

# Must pass all assertions
npm run test:integration
```

---

## 10. Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 20+
- **LLM**: Ollama (qwen2.5:7b default, local)
- **Database**: Convex (schema defined, not deployed)
- **Testing**: Vitest

---

## 11. Directory Structure

```
nova26/
├── src/
│   ├── index.ts                 # CLI entry point
│   ├── llm/
│   │   └── ollama-client.ts    # Ollama API client
│   ├── orchestrator/
│   │   ├── agent-loader.ts     # Load agent templates
│   │   ├── gate-runner.ts      # Quality gates
│   │   ├── prompt-builder.ts   # Build prompts + context
│   │   ├── ralph-loop.ts       # Core execution loop
│   │   └── task-picker.ts     # Task scheduling
│   ├── test/
│   │   ├── integration-test.ts # Real integration test
│   │   └── mock-run.ts        # Mock test
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── .nova/
│   ├── agents/                 # 21 agent templates (markdown)
│   ├── atlas/                 # Build logs, patterns (runtime)
│   ├── output/                # Task outputs (runtime)
│   ├── prd-test.json         # 3-task test PRD
│   └── prd-ua-dashboard-v1.json # 15-task dashboard PRD
├── convex/
│   └── schema.ts              # 10-table database schema
├── README.md
├── ARCHITECTURE.md
├── CONTRIBUTING.md
└── package.json
```

---

## 12. Current Status

| Component | Status |
|-----------|--------|
| Orchestrator | ✅ Complete |
| 21 Agents | ✅ Defined |
| Convex Schema | ✅ Defined (10 tables) |
| TypeScript Compilation | ✅ 0 errors |
| Integration Test | ✅ 25/25 passing |
| Live LLM Test | 🔄 Pending |

---

## 13. For AI Context (Quick Reference)

When working on NOVA26, remember:

1. **Agents are markdown templates** in `.nova/agents/`, not code
2. **Work flows through PRDs** - always start with the PRD structure
3. **Ralph Loop handles execution** - pick → load → build → call → gate → save
4. **Quality gates validate** - response validation + mercury validator
5. **Dependencies control flow** - pending tasks promote to ready when deps are done
6. **Tests use mock LLM** - integration test injects `LLMCaller` for testing
7. **Local only** - no cloud dependencies, runs with Ollama

---

*Last Updated: 2026-02-18*
*Repository: https://github.com/nelsen3000/nova26*
