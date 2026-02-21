# Checkpoint System

**Category:** 02-intelligence
**Type:** Pattern
**Tags:** persistence, sqlite, checkpoint, crash-recovery, build-state, nova26

---

## Overview

SQLite-backed checkpoint system saves build state every 30 seconds (auto-save) and after each task. On crash or restart, the latest checkpoint is loaded to resume from where execution stopped. Keeps the last 50 checkpoints per build.

---

## Source

`src/persistence/checkpoint-system.ts`

---

## Pattern
  CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    tasks TEXT NOT NULL,          -- JSON array of Task objects
    current_phase INTEGER NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_build_id ON checkpoints(build_id);

  CREATE TABLE IF NOT EXISTS build_states (
    build_id TEXT PRIMARY KEY,
    prd_file TEXT NOT NULL,
    start_time TEXT NOT NULL,
    tasks TEXT NOT NULL,
    completed_tasks TEXT NOT NULL,
    failed_tasks TEXT NOT NULL,
    current_phase INTEGER NOT NULL,
    logs TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export function saveCheckpoint(checkpoint: Omit<Checkpoint, 'timestamp'>): void {
  db.prepare(`INSERT INTO checkpoints (id, build_id, timestamp, tasks, current_phase, metadata) VALUES (?, ?, datetime('now'), ?, ?, ?)`)
    .run(checkpoint.id, checkpoint.buildId, JSON.stringify(checkpoint.tasks), checkpoint.currentPhase, JSON.stringify(checkpoint.metadata));

  cleanupOldCheckpoints(checkpoint.buildId); // Keep last 50
}

export function getLatestCheckpoint(buildId: string): Checkpoint | null {
  const row = db.prepare(`SELECT * FROM checkpoints WHERE build_id = ? ORDER BY timestamp DESC LIMIT 1`).get(buildId);
  if (!row) return null;
  return { ...row, tasks: JSON.parse(row.tasks), metadata: JSON.parse(row.metadata || '{}') };
}

// Auto-save every 30 seconds
export function startAutoSave(buildId: string, getState: () => Omit<Checkpoint, 'id' | 'timestamp'>, intervalMs = 30000): () => void {
  const interval = setInterval(() => {
    const state = getState();
    saveCheckpoint({ id: `${buildId}-${Date.now()}`, ...state });
  }, intervalMs);

  return () => clearInterval(interval); // Returns stop function
}
```

---

## Usage

```typescript
// Start auto-save at build start
const stopAutoSave = startAutoSave(buildId, () => ({
  buildId,
  tasks: prd.tasks,
  currentPhase: currentPhase,
  metadata: { prdFile: prdPath },
}));

// On crash recovery
const checkpoint = getLatestCheckpoint(buildId);
if (checkpoint) {
  console.log(`Resuming from checkpoint: ${checkpoint.timestamp}`);
  prd.tasks = checkpoint.tasks; // Restore task states
}

// Save build state for listing
saveBuildState({ buildId, prdFile, startTime, tasks, completedTasks, failedTasks, currentPhase, logs });

// List saved builds
const builds = listSavedBuilds();
// [{ buildId, prdFile, startTime, updatedAt }]

// Stop auto-save on completion
stopAutoSave();
```

---

## Anti-Patterns

```typescript
// ❌ No auto-save — state lost on crash
// Only saving at task completion misses in-progress state

// ✅ Good: Auto-save after each subtask
await saveCheckpoint(buildId, state); // Save incrementally

// ❌ Unlimited checkpoints — disk fills up
// Always call cleanupOldCheckpoints() to keep last N

// ✅ Good: Prune old checkpoints regularly
cleanupOldCheckpoints(10); // Keep only last 10

// ❌ Storing full file contents in checkpoint
// Store task metadata only, not file contents — use file paths

// ✅ Good: Store references, not content
checkpoint.files = filePaths; // Paths only, not full content
```

---

## When to Use

- Long-running multi-task builds that may crash or be interrupted
- Any orchestration loop where resuming from the last completed task saves significant time
- Builds with expensive LLM calls where re-running from scratch wastes tokens and money

---

## Benefits

- Crash recovery without losing progress on completed tasks
- Auto-save every 30 seconds catches in-progress state
- Automatic pruning keeps disk usage bounded
- Simple SQLite storage with no external dependencies

---

## Related Patterns

- `../01-orchestration/ralph-loop-execution.md` — Checkpoint used in main loop
- `langfuse-tracing.md` — Observability (complements checkpoints)
- `llm-response-cache.md` — Cache (separate SQLite DB)
