# Cost Tracker

## Source
Extracted from Nova26 `src/cost/cost-tracker.ts`

---

## Pattern: LLM API Cost Tracking with Budget Alerts

The Cost Tracker pattern provides real-time monitoring of LLM API token usage and costs across multiple models. It persists every API call's token counts and computed cost to a local SQLite database, enabling per-build and per-agent breakdowns, configurable budget limits with threshold-based alerts, and formatted spending reports.

The key design choices are **local persistence** (SQLite via `better-sqlite3` for zero-config storage), **per-model pricing tables** (supporting both commercial and free local models), and **threshold-based budget alerts** that fire once when spending crosses a configurable percentage of the limit.

---

## Implementation

### Code Example

```typescript
import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

// --- Types ---

interface SpendingReport {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  byModel: Record<string, { cost: number; tokens: number; requests: number }>;
}

// --- Storage Setup ---

const DATA_DIR = join(process.cwd(), '.nova', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'cost-tracking.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS cost_entries (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_input INTEGER NOT NULL,
    tokens_output INTEGER NOT NULL,
    cost REAL NOT NULL,
    task_id TEXT,
    agent_name TEXT,
    cached BOOLEAN DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_timestamp ON cost_entries(timestamp);
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    limit_amount REAL NOT NULL,
    threshold REAL DEFAULT 0.8,
    notified BOOLEAN DEFAULT 0
  );
`);

// --- Per-Model Pricing (per 1K tokens) ---

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':          { input: 0.0025,  output: 0.01   },
  'gpt-4o-mini':     { input: 0.00015, output: 0.0006 },
  'claude-3-opus':   { input: 0.015,   output: 0.075  },
  'claude-3-sonnet': { input: 0.003,   output: 0.015  },
  'qwen2.5:7b':      { input: 0,       output: 0      }, // local model — free
};

// --- Cost Calculation ---

export function calculateCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return (tokensInput / 1000) * pricing.input
       + (tokensOutput / 1000) * pricing.output;
}

// --- Recording ---

export function recordCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
  options?: { taskId?: string; agentName?: string; cached?: boolean },
): { id: string; cost: number } {
  const id = `cost-${Date.now()}`;
  const cost = options?.cached ? 0 : calculateCost(model, tokensInput, tokensOutput);

  db.prepare(`
    INSERT INTO cost_entries
      (id, timestamp, model, tokens_input, tokens_output, cost, task_id, agent_name, cached)
    VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, model, tokensInput, tokensOutput, cost,
    options?.taskId || null,
    options?.agentName || null,
    options?.cached ? 1 : 0,
  );

  return { id, cost };
}

// --- Reporting ---

export function getTodaySpending(): { cost: number; tokens: number; requests: number } {
  const row = db.prepare(`
    SELECT COALESCE(SUM(cost), 0) as cost,
           COALESCE(SUM(tokens_input + tokens_output), 0) as tokens,
           COUNT(*) as requests
    FROM cost_entries
    WHERE date(timestamp) = date('now')
  `).get() as any;
  return { cost: row.cost, tokens: row.tokens, requests: row.requests };
}

export function getSpendingReport(days: number = 30): SpendingReport {
  const start = new Date(Date.now() - days * 86_400_000).toISOString();

  const total = db.prepare(`
    SELECT COALESCE(SUM(cost), 0) as cost,
           COALESCE(SUM(tokens_input + tokens_output), 0) as tokens,
           COUNT(*) as requests
    FROM cost_entries WHERE timestamp > ?
  `).get(start) as any;

  const byModel: SpendingReport['byModel'] = {};
  for (const row of db.prepare(`
    SELECT model, SUM(cost) as cost,
           SUM(tokens_input + tokens_output) as tokens,
           COUNT(*) as requests
    FROM cost_entries WHERE timestamp > ?
    GROUP BY model
  `).all(start) as any[]) {
    byModel[row.model] = { cost: row.cost, tokens: row.tokens, requests: row.requests };
  }

  return { totalCost: total.cost, totalTokens: total.tokens, requestCount: total.requests, byModel };
}

// --- Budget Management ---

export function setBudget(
  type: 'daily' | 'weekly' | 'monthly',
  limit: number,
  threshold: number = 0.8,
): void {
  db.prepare(`
    INSERT OR REPLACE INTO budgets (id, type, limit_amount, threshold, notified)
    VALUES (?, ?, ?, ?, 0)
  `).run(`budget-${type}`, type, limit, threshold);
  console.log(`💰 Budget set: ${type} = $${limit}`);
}

export function checkBudgetAlerts(): string[] {
  const todayCost = getTodaySpending().cost;
  const alerts: string[] = [];

  for (const row of db.prepare('SELECT * FROM budgets').all() as any[]) {
    let current = todayCost;
    if (row.type === 'weekly')  current = getSpendingReport(7).totalCost;
    if (row.type === 'monthly') current = getSpendingReport(30).totalCost;

    const pct = (current / row.limit_amount) * 100;
    if (pct >= row.threshold * 100 && !row.notified) {
      alerts.push(`⚠️  ${row.type} budget at ${pct.toFixed(0)}% of $${row.limit_amount}`);
      db.prepare('UPDATE budgets SET notified = 1 WHERE id = ?').run(row.id);
    }
  }

  return alerts;
}
```

### Key Concepts

- **Per-model pricing table**: A static `PRICING` map holds input/output rates per 1K tokens for each supported model. Local models (e.g. `qwen2.5:7b`) have zero cost, so they're tracked for volume but don't affect budgets.
- **Cache-aware recording**: When `options.cached` is true, cost is recorded as zero — the tokens were served from cache, not billed by the provider.
- **Per-agent and per-task attribution**: Every cost entry stores optional `task_id` and `agent_name` fields, enabling breakdowns like "How much did VENUS spend on task 3.2?"
- **Threshold-based alerts with deduplication**: Budget alerts fire once when spending crosses the threshold percentage (default 80%). The `notified` flag prevents repeated alerts for the same budget period.
- **SQLite for zero-config persistence**: Using `better-sqlite3` means no external database server — the cost database lives alongside the project in `.nova/data/`.

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// In-memory cost tracking that loses data on restart
const costs: { model: string; cost: number }[] = [];

function trackCost(model: string, tokens: number): void {
  // No input/output distinction — can't compute real cost
  const cost = tokens * 0.001;
  costs.push({ model, cost });
  // Data lost when process exits
  // No per-agent or per-task attribution
  // No budget checking
}

function getTotal(): number {
  return costs.reduce((sum, c) => sum + c.cost, 0);
}
```

### ✅ Do This Instead

```typescript
// Persistent tracking with model-specific pricing and attribution
export function recordCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
  options?: { taskId?: string; agentName?: string; cached?: boolean },
): { id: string; cost: number } {
  const cost = options?.cached ? 0 : calculateCost(model, tokensInput, tokensOutput);

  db.prepare(`
    INSERT INTO cost_entries
      (id, timestamp, model, tokens_input, tokens_output, cost, task_id, agent_name, cached)
    VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `cost-${Date.now()}`, model, tokensInput, tokensOutput, cost,
    options?.taskId || null, options?.agentName || null, options?.cached ? 1 : 0,
  );

  return { id: `cost-${Date.now()}`, cost };
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Monitoring LLM API spend across a multi-agent system where multiple agents make independent API calls
- Setting guardrails on daily/weekly/monthly spend with automatic alerts before budgets are exceeded
- Generating per-model and per-agent cost breakdowns for build retrospectives and optimization decisions

❌ **Don't use for:**
- High-frequency cost tracking in production web services — SQLite's write lock doesn't scale to concurrent writers; use a proper time-series database instead

---

## Benefits

1. **Full attribution** — every cost entry is tagged with model, agent, and task, enabling granular spend analysis across the entire Ralph Loop.
2. **Zero-config persistence** — SQLite stores cost data locally with no external dependencies, surviving process restarts and enabling historical queries.
3. **Budget safety net** — threshold-based alerts catch runaway spending before it hits the hard limit, with deduplication to avoid alert fatigue.
4. **Cache-aware accounting** — cached responses are tracked for volume metrics but correctly excluded from cost calculations.
5. **Multi-model awareness** — separate input/output pricing per model means cost calculations are accurate across GPT-4o, Claude, and free local models.

---

## Related Patterns

- See [`../06-llm-integration/model-router.md`](../06-llm-integration/model-router.md) for the model routing layer that selects which model to call — cost data feeds back into routing decisions
- See [`../06-llm-integration/response-cache.md`](../06-llm-integration/response-cache.md) for the response caching system that produces `cached: true` entries in cost tracking
- See [`../09-observability/tracer.md`](../09-observability/tracer.md) for the distributed tracing system that records token counts alongside cost entries
- See [`../01-orchestration/ralph-loop-execution.md`](../01-orchestration/ralph-loop-execution.md) for the orchestration loop that triggers cost recording after each agent task
- See [`../02-agent-system/agent-loader.md`](../02-agent-system/agent-loader.md) for the agent system whose per-agent names are used for cost attribution

---

*Extracted: 2026-02-19*