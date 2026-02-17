# NOVA26 PRD Reference

> Complete reference for Product Requirements Documents (PRDs) in NOVA26.

---

## Overview

A **PRD (Product Requirements Document)** is a JSON file that defines:
- All tasks to be executed
- Dependencies between tasks
- Execution phases
- Agent assignments
- Current status tracking

---

## PRD Structure

### TypeScript Interface

```typescript
interface Task {
  id: string;                    // Unique identifier (e.g., "test-001")
  title: string;               // Human-readable title
  description: string;          // Detailed task description
  agent: string;               // Agent to use (EARTH, PLUTO, etc.)
  status: TaskStatus;          // Current status
  dependencies: string[];       // Array of task IDs this depends on
  phase: number;               // Execution phase (0, 1, 2, ...)
  attempts: number;             // Retry count
  createdAt: string;            // ISO timestamp
  output?: string;             // Path to output file (filled when done)
  error?: string;              // Error message (filled if failed)
}

type TaskStatus = 'pending' | 'ready' | 'running' | 'done' | 'failed' | 'blocked';

interface PRD {
  meta: {
    name: string;             // PRD name
    version: string;           // Version string
    createdAt: string;        // ISO timestamp
  };
  tasks: Task[];
}
```

---

## Example PRD: Simple 3-Task Chain

This PRD demonstrates a typical flow: EARTH → PLUTO → MERCURY

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
      "description": "Write a product spec for the Company entity. Fields: name (string, unique, 3-50 chars), status (active/suspended). Describe each field's purpose, constraints, validation rules, and edge cases. Include the 5 UI states (loading, empty, error, partial, populated). Output plain English spec, NOT code.",
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
      "description": "Based on the Company spec from test-001, write the Convex defineTable() with validators. Use v.string(), v.number(), v.union(v.literal(...)) from convex/values. Output ONLY the defineTable code block.",
      "agent": "PLUTO",
      "status": "pending",
      "dependencies": ["test-001"],
      "phase": 1,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    },
    {
      "id": "test-003",
      "title": "Validate Company spec vs schema",
      "description": "Compare the Company spec (test-001 output) against the Company schema (test-002 output). Check: all spec fields exist in schema, types match constraints, indexes support likely queries. Return PASS with confirmation or FAIL with specific issues listed.",
      "agent": "MERCURY",
      "status": "pending",
      "dependencies": ["test-001", "test-002"],
      "phase": 2,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    }
  ]
}
```

### Execution Flow

```
Phase 0: test-001 (ready, no deps)
         ↓
       done
         ↓
Phase 1: test-002 (promotes to ready)
         ↓
       done
         ↓
Phase 2: test-003 (promotes to ready)
         ↓
       done
```

---

## Example PRD: Parallel Tasks

Tasks in the same phase can run in parallel if they have no inter-dependencies.

```json
{
  "meta": {
    "name": "Parallel Tasks PRD",
    "version": "1.0.0",
    "createdAt": "2026-02-17T10:00:00Z"
  },
  "tasks": [
    {
      "id": "task-001",
      "title": "Write Company spec",
      "agent": "EARTH",
      "status": "ready",
      "dependencies": [],
      "phase": 0,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    },
    {
      "id": "task-002",
      "title": "Write User spec",
      "agent": "EARTH",
      "status": "ready",
      "dependencies": [],
      "phase": 0,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    },
    {
      "id": "task-003",
      "title": "Create Company schema",
      "agent": "PLUTO",
      "status": "pending",
      "dependencies": ["task-001"],
      "phase": 1,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    },
    {
      "id": "task-004",
      "title": "Create User schema",
      "agent": "PLUTO",
      "status": "pending",
      "dependencies": ["task-002"],
      "phase": 1,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    }
  ]
}
```

### Execution Flow

```
Phase 0: task-001 (ready) ─┬─▶ done
         task-002 (ready) ─┘

Phase 1: task-003 (ready, dep done) ─┬─▶ done
         task-004 (ready, dep done) ─┘
```

---

## Example PRD: UA Dashboard (15 Tasks)

Real PRD with 15 tasks across 4 phases:

```json
{
  "meta": {
    "name": "UA Dashboard PRD",
    "version": "1.0.0",
    "createdAt": "2026-02-17T10:00:00Z"
  },
  "tasks": [
    // Phase 0: Core entities (2 tasks)
    {
      "id": "dash-001",
      "title": "Company entity spec",
      "agent": "EARTH",
      "status": "ready",
      "dependencies": [],
      "phase": 0,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    },
    {
      "id": "dash-002", 
      "title": "ChipAccount entity spec",
      "agent": "EARTH",
      "status": "pending",
      "dependencies": ["dash-001"],
      "phase": 0,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    },
    
    // Phase 1: Schemas (3 tasks)
    {
      "id": "dash-003",
      "title": "Company schema",
      "agent": "PLUTO",
      "status": "pending",
      "dependencies": ["dash-001"],
      "phase": 1,
      "attempts": 0,
      "createdAt": "2026-02-17T10:00:00Z"
    },
    // ... more schema tasks
    
    // Phase 2: Validation (4 tasks)
    // ... MERCURY validates
    
    // Phase 3: Frontend (6 tasks)
    // ... VENUS builds UI
  ]
}
```

---

## Task Properties

### id
- **Type**: string
- **Format**: `{prefix}-{number}` (e.g., `test-001`, `dash-001`)
- **Must be unique** within the PRD

### title
- **Type**: string
- **Purpose**: Human-readable task name
- **Example**: "Write product spec for Company entity"

### description
- **Type**: string
- **Purpose**: Detailed instructions for the agent
- **Should include**:
  - What to produce
  - What inputs to use
  - Output format requirements
  - Any constraints

### agent
- **Type**: string
- **Must match** an agent name (EARTH, PLUTO, MERCURY, VENUS, MARS, etc.)
- **Determines** which agent template is loaded

### status
- **Type**: TaskStatus
- **Values**: `pending` | `ready` | `running` | `done` | `failed` | `blocked`
- **Managed by** the orchestrator

### dependencies
- **Type**: string[]
- **Array of task IDs** this task depends on
- **Empty array** (`[]`) means no dependencies, starts as "ready"
- **Non-empty** starts as "pending" until all deps are "done"

### phase
- **Type**: number
- **Purpose**: Control execution order
- **Lower phases** run first
- **Same phase** tasks can run in parallel (if no direct deps)

### attempts
- **Type**: number
- **Default**: 0
- **Incremented** each time the task runs
- **Used for** retry logic

### createdAt
- **Type**: string (ISO 8601)
- **Example**: "2026-02-17T10:00:00Z"

### output (filled when done)
- **Type**: string (file path)
- **Filled by** orchestrator when task completes
- **Example**: ".nova/output/test-001.md"

### error (filled if failed)
- **Type**: string
- **Filled by** orchestrator if task fails
- **Contains** error message

---

## Best Practices

### 1. Start Phase 0 with Independent Tasks
```json
// ✅ Good: Phase 0 has no dependencies
{ "phase": 0, "dependencies": [] }

// ❌ Bad: Phase 0 has dependencies
{ "phase": 0, "dependencies": ["other-task"] }
```

### 2. Use Clear Task IDs
```json
// ✅ Good
"id": "company-spec"
"id": "user-auth-001"

// ❌ Bad  
"id": "task1"
"id": "a"
```

### 3. Write Detailed Descriptions
Include:
- What output to produce
- What inputs to reference
- Format requirements
- Constraints

### 4. Keep Dependencies Explicit
```json
// ✅ Good: Clear dependency
"dependencies": ["spec-001"]

// ❌ Bad: Missing dependency
"dependencies": []
```

### 5. Group Related Tasks in Same Phase
```json
// ✅ Good: Related tasks in same phase
{ "phase": 1, "id": "company-schema" }
{ "phase": 1, "id": "user-schema" }

// ❌ Bad: Unnecessarily split
{ "phase": 1, "id": "company-schema" }
{ "phase": 2, "id": "user-schema" }
```

---

## File Location

PRDs are stored in:
```
.nova/
  prd-test.json           # 3-task test PRD
  prd-ua-dashboard-v1.json # 15-task dashboard PRD
```

---

## CLI Commands

```bash
# Check PRD status
npx tsx src/index.ts status .nova/prd-test.json

# Reset PRD (set phase 0 to ready, others to pending)
npx tsx src/index.ts reset .nova/prd-test.json

# Run PRD through Ralph Loop
npx tsx src/index.ts run .nova/prd-test.json
```

---

## Status Tracking

The orchestrator updates PRD status during execution:

1. **Initial**: Tasks set to `ready` or `pending` based on deps
2. **Running**: When picked, status → `running`
3. **Done**: When gates pass, status → `done`, output filled
4. **Failed**: When gates fail after retry, status → `failed`, error filled

---

*Last Updated: 2026-02-18*
