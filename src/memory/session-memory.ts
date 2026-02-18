// Persistent Cross-Session Memory
// Stores user preferences, architectural decisions, error patterns, and project-specific
// context that persists across NOVA26 sessions and gets injected into agent prompts.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  agent?: string;         // Which agent recorded this
  confidence: number;     // 0-1, higher = more verified
  createdAt: string;
  updatedAt: string;
  accessCount: number;    // Track usage for relevance ranking
  lastAccessedAt?: string;
}

export type MemoryCategory =
  | 'user_preference'     // "user prefers functional components"
  | 'architecture'        // "project uses Zustand for state management"
  | 'pattern'             // "auth pattern: requireAuth() first in all mutations"
  | 'error_solution'      // "fix for X error: do Y"
  | 'project_fact'        // "company table has fields: name, status, ownerId"
  | 'style'               // "user prefers Tailwind over CSS modules"
  | 'constraint'          // "never use REST, always use Convex"
  | 'decision';           // "chose Convex over Supabase because..."

export interface MemoryStore {
  version: string;
  projectName: string;
  entries: MemoryEntry[];
  lastUpdated: string;
}

const MEMORY_DIR = join(process.cwd(), '.nova', 'memory');
const MEMORY_FILE = join(MEMORY_DIR, 'session-memory.json');

let memoryCache: MemoryStore | null = null;

/**
 * Initialize or load memory store
 */
function loadMemory(): MemoryStore {
  if (memoryCache) return memoryCache;

  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }

  if (existsSync(MEMORY_FILE)) {
    try {
      const raw = readFileSync(MEMORY_FILE, 'utf-8');
      memoryCache = JSON.parse(raw) as MemoryStore;
      return memoryCache;
    } catch {
      // Corrupted file, start fresh
    }
  }

  // Create new store
  memoryCache = {
    version: '1.0.0',
    projectName: 'nova26',
    entries: [],
    lastUpdated: new Date().toISOString(),
  };
  saveMemory();
  return memoryCache;
}

/**
 * Persist memory to disk
 */
function saveMemory(): void {
  if (!memoryCache) return;
  memoryCache.lastUpdated = new Date().toISOString();
  writeFileSync(MEMORY_FILE, JSON.stringify(memoryCache, null, 2));
}

/**
 * Remember something across sessions
 */
export function remember(
  category: MemoryCategory,
  key: string,
  value: string,
  agent?: string,
  confidence: number = 0.8
): MemoryEntry {
  const store = loadMemory();

  // Check for existing entry with same key
  const existing = store.entries.find(e => e.key === key && e.category === category);
  if (existing) {
    existing.value = value;
    existing.updatedAt = new Date().toISOString();
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.agent = agent || existing.agent;
    saveMemory();
    return existing;
  }

  // Create new entry
  const entry: MemoryEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    key,
    value,
    agent,
    confidence,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accessCount: 0,
  };

  store.entries.push(entry);
  saveMemory();
  return entry;
}

/**
 * Recall memories by category
 */
export function recall(category?: MemoryCategory, limit: number = 20): MemoryEntry[] {
  const store = loadMemory();
  let entries = category
    ? store.entries.filter(e => e.category === category)
    : store.entries;

  // Sort by relevance: confidence * recency * access frequency
  entries.sort((a, b) => {
    const scoreA = a.confidence * (a.accessCount + 1);
    const scoreB = b.confidence * (b.accessCount + 1);
    return scoreB - scoreA;
  });

  // Update access counts
  const result = entries.slice(0, limit);
  for (const entry of result) {
    entry.accessCount++;
    entry.lastAccessedAt = new Date().toISOString();
  }
  saveMemory();

  return result;
}

/**
 * Search memories by keyword
 */
export function search(query: string, limit: number = 10): MemoryEntry[] {
  const store = loadMemory();
  const lower = query.toLowerCase();

  return store.entries
    .filter(e =>
      e.key.toLowerCase().includes(lower) ||
      e.value.toLowerCase().includes(lower)
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/**
 * Forget a specific memory
 */
export function forget(id: string): boolean {
  const store = loadMemory();
  const idx = store.entries.findIndex(e => e.id === id);
  if (idx === -1) return false;
  store.entries.splice(idx, 1);
  saveMemory();
  return true;
}

/**
 * Build memory context for injection into agent prompts
 * Returns formatted string of relevant memories for the given agent/task
 */
export function buildMemoryContext(agentName?: string, taskDescription?: string): string {
  const store = loadMemory();
  if (store.entries.length === 0) return '';

  const lines: string[] = ['## Project Memory (from previous sessions)\n'];

  // Always include high-confidence constraints and architecture decisions
  const critical = store.entries
    .filter(e =>
      e.confidence >= 0.9 &&
      (e.category === 'constraint' || e.category === 'architecture')
    )
    .slice(0, 5);

  if (critical.length > 0) {
    lines.push('### Critical Constraints');
    for (const e of critical) {
      lines.push(`- **${e.key}**: ${e.value}`);
    }
    lines.push('');
  }

  // Include agent-specific memories
  if (agentName) {
    const agentMemories = store.entries
      .filter(e => e.agent === agentName)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    if (agentMemories.length > 0) {
      lines.push(`### ${agentName} Learned Patterns`);
      for (const e of agentMemories) {
        lines.push(`- ${e.key}: ${e.value}`);
      }
      lines.push('');
    }
  }

  // Include task-relevant memories via keyword matching
  if (taskDescription) {
    const taskWords = taskDescription.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const relevant = store.entries
      .filter(e => {
        const text = `${e.key} ${e.value}`.toLowerCase();
        return taskWords.some(w => text.includes(w));
      })
      .filter(e => !critical.includes(e)) // Don't duplicate
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    if (relevant.length > 0) {
      lines.push('### Relevant Context');
      for (const e of relevant) {
        lines.push(`- [${e.category}] ${e.key}: ${e.value}`);
      }
      lines.push('');
    }
  }

  // Include user preferences
  const prefs = store.entries
    .filter(e => e.category === 'user_preference')
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, 5);

  if (prefs.length > 0) {
    lines.push('### User Preferences');
    for (const e of prefs) {
      lines.push(`- ${e.key}: ${e.value}`);
    }
    lines.push('');
  }

  // Include recent error solutions
  const errors = store.entries
    .filter(e => e.category === 'error_solution')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  if (errors.length > 0) {
    lines.push('### Known Solutions');
    for (const e of errors) {
      lines.push(`- ${e.key}: ${e.value}`);
    }
    lines.push('');
  }

  return lines.length > 1 ? lines.join('\n') : '';
}

/**
 * Auto-learn from a completed task (called after successful gate pass)
 */
export function learnFromTask(
  agentName: string,
  _taskTitle: string,
  taskDescription: string,
  output: string
): void {
  // Extract patterns from successful task completion

  // Learn agent-specific patterns
  if (agentName === 'MARS' && output.includes('requireAuth')) {
    remember('pattern', 'auth_pattern', 'All mutations use requireAuth() first', agentName, 0.95);
  }

  if (agentName === 'PLUTO' && output.includes('companyId')) {
    remember('pattern', 'multi_tenant', 'All tables include companyId for row-level isolation', agentName, 0.95);
  }

  if (agentName === 'VENUS' && output.includes('loading')) {
    remember('pattern', 'ui_states', 'Components implement all 5 UI states', agentName, 0.9);
  }

  // Learn from task description keywords
  if (taskDescription.includes('Math.floor')) {
    remember('constraint', 'chip_math', 'Always use Math.floor() for chip calculations, never Math.round()', agentName, 1.0);
  }
}

/**
 * Auto-learn from a failed task (called after gate failure)
 */
export function learnFromFailure(
  agentName: string,
  taskTitle: string,
  error: string
): void {
  // Store error patterns for future avoidance
  remember(
    'error_solution',
    `${agentName}: ${taskTitle}`,
    `Failed with: ${error.slice(0, 200)}`,
    agentName,
    0.7
  );
}

/**
 * Display memory summary
 */
export function showMemorySummary(): void {
  const store = loadMemory();

  console.log(`\n📝 Session Memory (${store.entries.length} entries)\n`);

  const byCat = new Map<string, number>();
  for (const e of store.entries) {
    byCat.set(e.category, (byCat.get(e.category) || 0) + 1);
  }

  for (const [cat, count] of byCat) {
    console.log(`  ${cat}: ${count}`);
  }

  if (store.entries.length > 0) {
    const recent = store.entries
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    console.log('\n  Recent:');
    for (const e of recent) {
      console.log(`    [${e.category}] ${e.key}: ${e.value.slice(0, 60)}...`);
    }
  }
}
