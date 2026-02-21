# Session Memory with Relevance Ranking

**Category:** 02-intelligence
**Type:** Pattern
**Tags:** memory, persistence, cross-session, relevance, context-injection, nova26

---

## Overview

`session-memory.ts` provides cross-session persistent memory stored in `.nova/memory/session-memory.json`. Memories are ranked by `confidence × accessCount` for relevance. `buildMemoryContext()` injects the most relevant memories into agent prompts.

---

## Source

`src/memory/session-memory.ts`

---

## Pattern
  | 'user_preference'   // "user prefers functional components"
  | 'architecture'      // "project uses Zustand for state"
  | 'pattern'           // "auth pattern: requireAuth() first"
  | 'error_solution'    // "fix for X error: do Y"
  | 'project_fact'      // "company table has fields: name, status"
  | 'style'             // "user prefers Tailwind over CSS modules"
  | 'constraint'        // "never use REST, always use Convex"
  | 'decision';         // "chose Convex over Supabase because..."

// Store a memory
export function remember(category: MemoryCategory, key: string, value: string, agent?: string, confidence = 0.8): MemoryEntry {
  const store = loadMemory();
  const existing = store.entries.find(e => e.key === key && e.category === category);

  if (existing) {
    existing.value = value;
    existing.confidence = Math.max(existing.confidence, confidence);
    saveMemory();
    return existing;
  }

  const entry = { id: `mem-${Date.now()}`, category, key, value, agent, confidence, accessCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  store.entries.push(entry);
  saveMemory();
  return entry;
}

// Recall with relevance ranking: confidence × (accessCount + 1)
export function recall(category?: MemoryCategory, limit = 20): MemoryEntry[] {
  const store = loadMemory();
  let entries = category ? store.entries.filter(e => e.category === category) : store.entries;

  entries.sort((a, b) => (b.confidence * (b.accessCount + 1)) - (a.confidence * (a.accessCount + 1)));

  const result = entries.slice(0, limit);
  for (const entry of result) {
    entry.accessCount++;
    entry.lastAccessedAt = new Date().toISOString();
  }
  saveMemory();
  return result;
}
```

```typescript
// Build memory context for prompt injection
export function buildMemoryContext(agentName?: string, taskDescription?: string): string {
  const lines = ['## Project Memory (from previous sessions)\n'];

  // 1. High-confidence constraints (always included)
  const critical = store.entries.filter(e => e.confidence >= 0.9 && ['constraint', 'architecture'].includes(e.category)).slice(0, 5);

  // 2. Agent-specific learned patterns
  const agentMemories = store.entries.filter(e => e.agent === agentName).slice(0, 5);

  // 3. Task-relevant memories via keyword matching
  const taskWords = taskDescription?.toLowerCase().split(/\s+/).filter(w => w.length > 3) ?? [];
  const relevant = store.entries.filter(e => taskWords.some(w => `${e.key} ${e.value}`.toLowerCase().includes(w))).slice(0, 5);

  // 4. User preferences
  const prefs = store.entries.filter(e => e.category === 'user_preference').slice(0, 5);

  // 5. Recent error solutions
  const errors = store.entries.filter(e => e.category === 'error_solution').slice(0, 3);

  return lines.join('\n');
}
```

---

## Usage

```typescript
// Auto-learn from successful task
learnFromTask('MARS', task.title, task.description, response.content);
// Detects patterns: requireAuth → stores auth_pattern memory

// Manual memory storage
remember('constraint', 'chip_math', 'Always use Math.floor() for chip calculations', 'MARS', 1.0);
remember('architecture', 'state_management', 'Project uses Zustand for global state', undefined, 0.9);

// Search memories
const results = search('authentication');
// Returns entries where key or value contains "authentication"

// Inject into prompt
const memoryContext = buildMemoryContext('MARS', task.description);
const userPrompt = `${taskDescription}\n\n${memoryContext}`;
```

---

## Anti-Patterns

```typescript
// ❌ No relevance ranking — inject all memories regardless of relevance
const allMemories = store.entries.map(e => `${e.key}: ${e.value}`).join('\n');
// Bloats context with irrelevant memories

// ✅ Good: Rank by relevance and inject only top matches
const relevant = rankByRelevance(memories, currentTask).slice(0, 5);

// ❌ No confidence threshold for critical constraints
// Low-confidence memories should not be treated as hard constraints

// ✅ Good: Filter by confidence before injecting
const trusted = memories.filter(m => m.confidence >= 0.7);

// ❌ Storing sensitive data in memory
remember('project_fact', 'api_key', 'sk-abc123...'); // Never store secrets

// ✅ Good: Store only non-sensitive project facts
remember('project_fact', 'framework', 'React 19');
```

---

## When to Use

- Multi-session projects where agents need to remember user preferences and past decisions
- Complex builds where learned error solutions prevent repeated failures
- Teams with consistent coding conventions that should persist across sessions

---

## Benefits

- Cross-session persistence — knowledge survives restarts
- Relevance ranking ensures only the most useful memories are injected into prompts
- Category-based organization makes memories queryable and manageable
- Confidence scoring prevents low-quality memories from polluting agent context

---

## Related Patterns

- `../01-orchestration/prompt-builder-dependency-injection.md` — Memory injected into prompts
- `checkpoint-system.md` — Build state (separate from memory)
- `langfuse-tracing.md` — Observability for memory-augmented calls
