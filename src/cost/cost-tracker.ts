// Cost Tracker - Monitor API spending in real-time

// @ts-ignore - better-sqlite3 types installed at runtime
import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

interface SpendingReport {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  byModel: Record<string, { cost: number; tokens: number; requests: number }>;
}

const DATA_DIR = join(process.cwd(), '.nova', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'cost-tracking.db'));

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'qwen2.5:7b': { input: 0, output: 0 },
};

db.exec(`
  CREATE TABLE IF NOT EXISTS cost_entries (
    id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, model TEXT NOT NULL,
    tokens_input INTEGER NOT NULL, tokens_output INTEGER NOT NULL,
    cost REAL NOT NULL, task_id TEXT, agent_name TEXT, cached BOOLEAN DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_timestamp ON cost_entries(timestamp);
  CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, type TEXT NOT NULL, limit_amount REAL NOT NULL, threshold REAL DEFAULT 0.8, notified BOOLEAN DEFAULT 0);
`);

export function calculateCost(model: string, tokensInput: number, tokensOutput: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (tokensInput / 1000) * p.input + (tokensOutput / 1000) * p.output;
}

export function recordCost(model: string, tokensInput: number, tokensOutput: number, options?: { taskId?: string; agentName?: string; cached?: boolean }) {
  const id = `cost-${Date.now()}`;
  const cost = options?.cached ? 0 : calculateCost(model, tokensInput, tokensOutput);
  db.prepare(`INSERT INTO cost_entries (id, timestamp, model, tokens_input, tokens_output, cost, task_id, agent_name, cached) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, model, tokensInput, tokensOutput, cost, options?.taskId || null, options?.agentName || null, options?.cached ? 1 : 0);
  return { id, cost };
}

export function getTodaySpending(): { cost: number; tokens: number; requests: number } {
  const row = db.prepare(`SELECT COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(tokens_input + tokens_output), 0) as tokens, COUNT(*) as requests FROM cost_entries WHERE date(timestamp) = date('now')`).get() as any;
  return { cost: row.cost, tokens: row.tokens, requests: row.requests };
}

export function getSpendingReport(days: number = 30): SpendingReport {
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const total = db.prepare(`SELECT COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(tokens_input + tokens_output), 0) as tokens, COUNT(*) as requests FROM cost_entries WHERE timestamp > ?`).get(start) as any;
  const byModel: Record<string, any> = {};
  for (const row of db.prepare(`SELECT model, SUM(cost) as cost, SUM(tokens_input + tokens_output) as tokens, COUNT(*) as requests FROM cost_entries WHERE timestamp > ? GROUP BY model`).all(start) as any[]) {
    byModel[row.model] = { cost: row.cost, tokens: row.tokens, requests: row.requests };
  }
  return { totalCost: total.cost, totalTokens: total.tokens, requestCount: total.requests, byModel };
}

export function setBudget(type: 'daily' | 'weekly' | 'monthly', limit: number, threshold: number = 0.8) {
  db.prepare(`INSERT OR REPLACE INTO budgets (id, type, limit_amount, threshold, notified) VALUES (?, ?, ?, ?, 0)`).run(`budget-${type}`, type, limit, threshold);
  console.log(`💰 Budget set: ${type} = $${limit}`);
}

export function checkBudgetAlerts(): string[] {
  const today = getTodaySpending().cost;
  const alerts: string[] = [];
  for (const row of db.prepare('SELECT * FROM budgets').all() as any[]) {
    let current = today;
    if (row.type === 'weekly') current = getSpendingReport(7).totalCost;
    if (row.type === 'monthly') current = getSpendingReport(30).totalCost;
    const pct = (current / row.limit_amount) * 100;
    if (pct >= row.threshold * 100 && !row.notified) {
      alerts.push(`⚠️  ${row.type} budget at ${pct.toFixed(0)}% of $${row.limit_amount}`);
      db.prepare('UPDATE budgets SET notified = 1 WHERE id = ?').run(row.id);
    }
  }
  return alerts;
}

export function formatReport(r: SpendingReport): string {
  return `💰 Spending Report\n═══════════════════════════════════\nTotal: $${r.totalCost.toFixed(4)} | ${r.totalTokens.toLocaleString()} tokens | ${r.requestCount} requests\nBy Model:\n${Object.entries(r.byModel).map(([m, d]) => `  ${m}: $${(d as any).cost.toFixed(4)}`).join('\n')}\n═══════════════════════════════════`;
}
