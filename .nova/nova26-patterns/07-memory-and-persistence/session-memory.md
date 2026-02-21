# Session Memory

## Source
Extracted from Nova26 `src/memory/session-memory.ts`

---

## Pattern: Persistent Cross-Session Memory with Relevance Ranking

Session memory stores user preferences, architectural decisions, error patterns, and project-specific context that persists across Nova26 sessions. Memories are categorized, confidence-scored, and ranked by relevance so the most useful context gets injected into agent prompts automatically. Agents learn from both successful and failed tasks, building an ever-improving knowledge base about the project.

---

## Implementation

### Code Example

```typescript
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
 * Initialize or load memory store from disk.
 * Uses an in-memory cache to avoid repeated file reads.
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
      // Corrupted file — start fresh rather than crash
    }
  }

  memoryCache = {
    version: '1.0.0',
    projectName: 'nova26',
    entries: [],
    lastUpdated: new Date().toISOString(),
  };
  saveMemory();
  return memoryCache;
}

function saveMemory(): void {
  if (!memoryCache) return;
  memoryCache.lastUpdated = new Date().toISOString();
  writeFileSync(MEMORY_FILE, JSON.stringify(memoryCache, null, 2));
}

/**
 * Store a memory entry. If a matching key+category already exists,
 * update it and boost confidence (never lower it).
 */
export function remember(
  category: MemoryCategory,
  key: string,
  value: string,
  agent?: string,
  confidence: number = 0.8
): MemoryEntry {
  const store = loadMemory();

  const existing = store.entries.find(
    e => e.key === key && e.category === category
  );
  if (existing) {
    existing.value = value;
    existing.updatedAt = new Date().toISOString();
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.agent = agent || existing.agent;
    saveMemory();
    return existing;
  }

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
 * Recall memories sorted by relevance (confidence × access frequency).
 * Increments access counts on returned entries for future ranking.
 */
export function recall(
  category?: MemoryCategory,
  limit: number = 20
): MemoryEntry[] {
  const store = loadMemory();
  let entries = category
    ? store.entries.filter(e => e.category === category)
    : store.entries;

  entries.sort((a, b) => {
    const scoreA = a.confidence * (a.accessCount + 1);
    const scoreB = b.confidence * (b.accessCount + 1);
    return scoreB - scoreA;
  });

  const result = entries.slice(0, limit);
  for (const entry of result) {
    entry.accessCount++;
    entry.lastAccessedAt = new Date().toISOString();
  }
  saveMemory();
  return result;
}

/**
 * Build formatted memory context for injection into agent prompts.
 * Selects critical constraints, agent-specific patterns, task-relevant
 * context, user preferences, and known error solutions.
 */
export function buildMemoryContext(
  agentName?: string,
  taskDescription?: string
): string {
  const store = loadMemory();
  if (store.entries.length === 0) return '';

  const lines: string[] = ['## Project Memory (from previous sessions)\n'];

  // Always surface high-confidence constraints and architecture decisions
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

  // Agent-specific memories
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

  // Task-relevant memories via keyword matching
  if (taskDescription) {
    const taskWords = taskDescription.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);
    const relevant = store.entries
      .filter(e => {
        const text = `${e.key} ${e.value}`.toLowerCase();
        return taskWords.some(w => text.includes(w));
      })
      .filter(e => !critical.includes(e))
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

  return lines.length > 1 ? lines.join('\n') : '';
}

/**
 * Auto-learn from a completed task — called after a successful gate pass.
 */
export function learnFromTask(
  agentName: string,
  _taskTitle: string,
  taskDescription: string,
  output: string
): void {
  if (agentName === 'MARS' && output.includes('requireAuth')) {
    remember('pattern', 'auth_pattern',
      'All mutations use requireAuth() first', agentName, 0.95);
  }
  if (agentName === 'PLUTO' && output.includes('companyId')) {
    remember('pattern', 'multi_tenant',
      'All tables include companyId for row-level isolation', agentName, 0.95);
  }
}

/**
 * Auto-learn from a failed task — store error patterns for future avoidance.
 */
export function learnFromFailure(
  agentName: string,
  taskTitle: string,
  error: string
): void {
  remember(
    'error_solution',
    `${agentName}: ${taskTitle}`,
    `Failed with: ${error.slice(0, 200)}`,
    agentName,
    0.7
  );
}
```

### Key Concepts

- **Categorized memory entries**: Eight distinct categories (`user_preference`, `architecture`, `pattern`, `error_solution`, `project_fact`, `style`, `constraint`, `decision`) let agents store and query domain-specific knowledge
- **Confidence scoring**: Each entry carries a 0–1 confidence score; updates can only raise confidence, never lower it — reinforcing verified knowledge
- **Relevance ranking**: `recall()` sorts by `confidence × (accessCount + 1)`, surfacing frequently-used high-confidence entries first
- **In-memory cache with JSON persistence**: A module-level `memoryCache` variable avoids repeated disk reads; `saveMemory()` writes through to a JSON file on every mutation
- **Prompt injection via `buildMemoryContext()`**: Assembles a formatted markdown block of critical constraints, agent-specific patterns, task-relevant context, user preferences, and known error solutions for injection into LLM prompts
- **Automatic learning hooks**: `learnFromTask()` and `learnFromFailure()` are called by the orchestrator after gate pass/fail, building memory without manual intervention

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Flat key-value store with no categorization — impossible to query by domain
const memory: Record<string, string> = {};
memory['auth'] = 'use requireAuth()';
memory['tables'] = 'include companyId';
// No confidence, no ranking, no way to distinguish constraints from preferences

// Overwriting confidence on every update — verified knowledge gets downgraded
existing.confidence = newConfidence; // If newConfidence is 0.5, a 0.95 entry drops

// Dumping all memories into the prompt — wastes context window tokens
const context = store.entries.map(e => `${e.key}: ${e.value}`).join('\n');
// 500 entries × 100 chars = 50K chars injected into every prompt
```

### ✅ Do This Instead

```typescript
// Categorized entries with confidence scoring
remember('constraint', 'chip_math',
  'Always use Math.floor() for chip calculations', 'MARS', 1.0);

// Confidence only goes up — verified knowledge stays verified
existing.confidence = Math.max(existing.confidence, newConfidence);

// Selective context injection — only relevant, high-confidence entries
const context = buildMemoryContext('VENUS', 'Build the dashboard component');
// Returns ~10 curated entries: constraints, agent patterns, task-relevant context
```

---

## When to Use This Pattern

✅ **Use for:**
- Multi-session AI agent systems that need to remember project context across restarts
- Capturing and reinforcing architectural decisions, coding conventions, and user preferences over time
- Injecting curated context into LLM prompts without overwhelming the context window

❌ **Don't use for:**
- High-frequency transient data (use an in-memory cache or event store instead)
- Structured relational data that needs complex queries (use a proper database like SQLite)

---

## Benefits

1. **Cross-session continuity** — agents remember project constraints and patterns between runs, avoiding repeated mistakes
2. **Self-reinforcing knowledge** — confidence-only-up updates mean verified facts become increasingly prominent
3. **Token-efficient prompt injection** — `buildMemoryContext()` selects only the most relevant entries, keeping prompt sizes manageable
4. **Automatic learning** — `learnFromTask()` and `learnFromFailure()` hooks capture knowledge without manual intervention
5. **Agent-scoped recall** — each agent can query its own learned patterns, enabling specialization over time

---

## Related Patterns

- See `../07-memory-and-persistence/checkpoint-system.md` for persisting full build state (tasks, phases, logs) to SQLite — complementary to session memory's key-value knowledge store
- See `../06-llm-integration/response-cache.md` for caching LLM responses by prompt hash — reduces redundant API calls that session memory's prompt injection might otherwise cause
- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that calls `buildMemoryContext()` before dispatching tasks to agents
- See `../02-agent-system/agent-loader.md` for the agent loading system that receives memory-enriched prompts

---

*Extracted: 2026-02-19*