# NOVA26 Database Schema Reference

> Complete reference for the Convex database schema (10 tables).

---

## Overview

NOVA26 uses **Convex** as its database. The schema defines 10 tables:

- **ATLAS Tables (6)**: Learning system for build logs and patterns
- **UA Dashboard Tables (4)**: Application data for the dashboard

---

## Schema File Location

```
convex/schema.ts
```

---

## ATLAS Tables (6)

These tables support the learning and tracking system.

### 1. builds

Tracks PRD build runs.

```typescript
builds: defineTable({
  prdId: v.string(),           // Reference to PRD
  prdName: v.string(),        // PRD name
  status: v.union(            // Build status
    v.literal('running'),
    v.literal('completed'),
    v.literal('failed')
  ),
  startedAt: v.string(),      // ISO timestamp
  completedAt: v.optional(v.string()), // ISO timestamp
  error: v.optional(v.string()),       // Error message if failed
}).index('by_prd', ['prdId'])
  .index('by_status', ['status'])
```

**Indexes:**
- `by_prd`: Query builds by PRD ID
- `by_status`: Query builds by status

---

### 2. patterns

Stores reusable code patterns discovered during builds.

```typescript
patterns: defineTable({
  name: v.string(),           // Pattern name
  description: v.string(),     // Pattern description
  code: v.string(),            // Code snippet
  language: v.string(),        // Programming language
  tags: v.array(v.string()),   // Tags for categorization
  createdAt: v.string(),      // ISO timestamp
}).index('by_language', ['language'])
  .index('by_tags', ['tags'])
```

**Use Case:** ATLAS learns successful code patterns and stores them for reuse.

---

### 3. agents

Stores agent configuration and templates.

```typescript
agents: defineTable({
  name: v.string(),            // Agent name (SUN, EARTH, etc.)
  role: v.string(),            // Agent role
  domain: v.string(),           // Domain expertise
  systemPrompt: v.string(),   // Full prompt template
  model: v.string(),           // Recommended model
  gates: v.array(v.string()), // Quality gates to run
  createdAt: v.string(),       // ISO timestamp
}).index('by_name', ['name'])
  .index('by_domain', ['domain'])
```

---

### 4. tasks

Tracks individual task execution within a build.

```typescript
tasks: defineTable({
  buildId: v.id('builds'),    // Reference to build
  taskId: v.string(),         // Task ID from PRD
  title: v.string(),           // Task title
  agent: v.string(),           // Agent used
  status: v.union(            // Task status
    v.literal('pending'),
    v.literal('ready'),
    v.literal('running'),
    v.literal('done'),
    v.literal('failed'),
    v.literal('blocked')
  ),
  dependencies: v.array(v.string()), // Task dependencies
  phase: v.number(),           // Execution phase
  attempts: v.number(),         // Retry count
  createdAt: v.string(),       // ISO timestamp
  output: v.optional(v.string()),    // Output file path
  error: v.optional(v.string()),     // Error message
}).index('by_build', ['buildId'])
  .index('by_status', ['status'])
  .index('by_agent', ['agent'])
```

---

### 5. executions

Logs individual LLM calls.

```typescript
executions: defineTable({
  taskId: v.id('tasks'),      // Reference to task
  agent: v.string(),            // Agent used
  model: v.string(),            // LLM model used
  prompt: v.string(),           // Full prompt sent
  response: v.string(),        // LLM response
  gatesPassed: v.boolean(),    // Whether gates passed
  duration: v.number(),        // Duration in ms
  timestamp: v.string(),       // ISO timestamp
  error: v.optional(v.string()), // Error if failed
}).index('by_task', ['taskId'])
  .index('by_timestamp', ['timestamp'])
```

---

### 6. learnings

Stores insights and retrospectives from builds.

```typescript
learnings: defineTable({
  buildId: v.id('builds'),     // Reference to build
  taskId: v.string(),          // Task ID
  pattern: v.string(),          // Pattern identified
  insight: v.string(),          // Insight description
  code: v.optional(v.string()), // Code example
  createdAt: v.string(),       // ISO timestamp
}).index('by_build', ['buildId'])
  .index('by_task', ['taskId'])
```

---

## UA Dashboard Tables (4)

These tables store application data for the User Analytics Dashboard.

### 7. companies

Company entities.

```typescript
companies: defineTable({
  name: v.string(),                    // Company name
  sector: v.string(),                   // Industry sector
  ceoPersona: v.string(),              // CEO description
  status: v.union(                     // Company status
    v.literal('active'),
    v.literal('suspended'),
    v.literal('bankrupt')
  ),
  createdAt: v.string(),               // ISO timestamp
}).index("by_status", ["status"])
  .index("by_sector", ["sector"])
```

---

### 8. chipAccounts

Financial accounts for companies.

```typescript
chipAccounts: defineTable({
  companyId: v.id("companies"),       // Foreign key to company
  type: v.union(                      // Account type
    v.literal("savings"),
    v.literal("spending"),
    v.literal("investment")
  ),
  balance: v.number(),                 // Account balance
  lastTransactionAt: v.string(),      // ISO timestamp
}).index("by_company", ["companyId"])
  .index("by_company_type", ["companyId", "type"])
```

---

### 9. divisions

Company divisions/departments.

```typescript
divisions: defineTable({
  companyId: v.id("companies"),        // Foreign key to company
  name: v.string(),                    // Division name
  revenue: v.number(),                // Revenue
  expenses: v.number(),                // Expenses
  agentCount: v.number(),              // Number of agents
  status: v.union(                    // Division status
    v.literal("active"),
    v.literal("paused")
  ),
}).index("by_company", ["companyId"])
  .index("by_company_revenue", ["companyId", "revenue"])
```

---

### 10. agents

AI agent instances within divisions.

```typescript
agents: defineTable({
  companyId: v.id("companies"),        // Foreign key to company
  divisionId: v.id("divisions"),      // Foreign key to division
  name: v.string(),                    // Agent name
  role: v.string(),                    // Agent role
  status: v.union(                    // Agent status
    v.literal("active"),
    v.literal("idle"),
    v.literal("suspended")
  ),
  currentTaskId: v.optional(v.string()), // Current task ID
  idleMinutes: v.number(),              // Minutes idle
}).index("by_company", ["companyId"])
  .index("by_division", ["divisionId"])
  .index("by_status", ["companyId", "status"])
```

---

## Complete Schema

```typescript
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // =====================
  // ATLAS Tables (6)
  // =====================
  
  builds: defineTable({
    prdId: v.string(),
    prdName: v.string(),
    status: v.union(v.literal('running'), v.literal('completed'), v.literal('failed')),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index('by_prd', ['prdId'])
    .index('by_status', ['status']),

  patterns: defineTable({
    name: v.string(),
    description: v.string(),
    code: v.string(),
    language: v.string(),
    tags: v.array(v.string()),
    createdAt: v.string(),
  }).index('by_language', ['language'])
    .index('by_tags', ['tags']),

  agents: defineTable({
    name: v.string(),
    role: v.string(),
    domain: v.string(),
    systemPrompt: v.string(),
    model: v.string(),
    gates: v.array(v.string()),
    createdAt: v.string(),
  }).index('by_name', ['name'])
    .index('by_domain', ['domain']),

  tasks: defineTable({
    buildId: v.id('builds'),
    taskId: v.string(),
    title: v.string(),
    agent: v.string(),
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('running'), v.literal('done'), v.literal('failed'), v.literal('blocked')),
    dependencies: v.array(v.string()),
    phase: v.number(),
    attempts: v.number(),
    createdAt: v.string(),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index('by_build', ['buildId'])
    .index('by_status', ['status'])
    .index('by_agent', ['agent']),

  executions: defineTable({
    taskId: v.id('tasks'),
    agent: v.string(),
    model: v.string(),
    prompt: v.string(),
    response: v.string(),
    gatesPassed: v.boolean(),
    duration: v.number(),
    timestamp: v.string(),
    error: v.optional(v.string()),
  }).index('by_task', ['taskId'])
    .index('by_timestamp', ['timestamp']),

  learnings: defineTable({
    buildId: v.id('builds'),
    taskId: v.string(),
    pattern: v.string(),
    insight: v.string(),
    code: v.optional(v.string()),
    createdAt: v.string(),
  }).index('by_build', ['buildId'])
    .index('by_task', ['taskId']),

  // =====================
  // UA Dashboard Tables (4)
  // =====================

  companies: defineTable({
    name: v.string(),
    sector: v.string(),
    ceoPersona: v.string(),
    status: v.union(v.literal('active'), v.literal('suspended'), v.literal('bankrupt')),
    createdAt: v.string(),
  }).index("by_status", ["status"])
    .index("by_sector", ["sector"]),

  chipAccounts: defineTable({
    companyId: v.id("companies"),
    type: v.union(v.literal("savings"), v.literal("spending"), v.literal("investment")),
    balance: v.number(),
    lastTransactionAt: v.string(),
  }).index("by_company", ["companyId"])
    .index("by_company_type", ["companyId", "type"]),

  divisions: defineTable({
    companyId: v.id("companies"),
    name: v.string(),
    revenue: v.number(),
    expenses: v.number(),
    agentCount: v.number(),
    status: v.union(v.literal("active"), v.literal("paused")),
  }).index("by_company", ["companyId"])
    .index("by_company_revenue", ["companyId", "revenue"]),

  agents: defineTable({
    companyId: v.id("companies"),
    divisionId: v.id("divisions"),
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("active"), v.literal("idle"), v.literal("suspended")),
    currentTaskId: v.optional(v.string()),
    idleMinutes: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_division", ["divisionId"])
    .index("by_status", ["companyId", "status"]),
});
```

---

## Convex Value Types

| Type | Description |
|------|-------------|
| `v.string()` | String value |
| `v.number()` | Number value |
| `v.boolean()` | Boolean value |
| `v.id("tableName")` | Reference to another table |
| `v.array(T)` | Array of type T |
| `v.optional(T)` | Optional value of type T |
| `v.union(v.literal("a"), v.literal("b"))` | Union of literal types |

---

## Indexes

Indexes improve query performance:

```typescript
// Single field index
.index('by_status', ['status'])

// Composite index (multiple fields)
.index('by_company_type', ['companyId', 'type'])
```

**When to create indexes:**
- Fields used in WHERE clauses
- Fields used for sorting
- Fields used for JOINs

---

## Relationships

```
companies
  ├── chipAccounts (1:N)
  └── divisions (1:N)
       └── agents (1:N)

builds
  ├── tasks (1:N)
  └── learnings (1:N)
```

---

*Last Updated: 2026-02-18*
