# Checkpoint System

## Source
Extracted from Nova26 `src/persistence/checkpoint-system.ts`

---

## Pattern: SQLite-Backed Build State Checkpointing

The checkpoint system saves and restores build state to a local SQLite database, preventing data loss on crashes. It tracks two complementary data structures: fine-grained checkpoints (snapshots of task progress at a point in time) and full build states (the complete picture including PRD, completed/failed tasks, phase, and logs). An auto-save timer creates periodic checkpoints, and old checkpoints are automatically pruned to keep only the 50 most recent per build.

---

## Implementation

### Code Example

```typescript
import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import type { Task, BuildLog } from '../types/index.js';

interface Checkpoint {
  id: string;
  buildId: string;
  timestamp: string;
  tasks: Task[];
  currentPhase: number;
  metadata: Record<string, unknown>;
}

interface BuildState {
  buildId: string;
  prdFile: string;
  startTime: string;
  tasks: Task[];
  completedTasks: string[];
  failedTasks: string[];
  currentPhase: number;
  logs: BuildLog[];
}

const DATA_DIR = join(process.cwd(), '.nova', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'checkpoints.db'));

// Initialize schema — idempotent with IF NOT EXISTS
db.exec(`
  CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    tasks TEXT NOT NULL,
    current_phase INTEGER NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_build_id ON checkpoints(build_id);
  CREATE INDEX IF NOT EXISTS idx_timestamp ON checkpoints(timestamp);

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

/**
 * Save a checkpoint snapshot. Automatically prunes old checkpoints
 * for the same build to keep only the 50 most recent.
 */
export function saveCheckpoint(
  checkpoint: Omit<Checkpoint, 'timestamp'>
): void {
  const stmt = db.prepare(`
    INSERT INTO checkpoints
      (id, build_id, timestamp, tasks, current_phase, metadata)
    VALUES (?, ?, datetime('now'), ?, ?, ?)
  `);
  stmt.run(
    checkpoint.id,
    checkpoint.buildId,
    JSON.stringify(checkpoint.tasks),
    checkpoint.currentPhase,
    JSON.stringify(checkpoint.metadata)
  );
  cleanupOldCheckpoints(checkpoint.buildId);
}

/**
 * Retrieve the most recent checkpoint for a build.
 * Returns null if no checkpoints exist.
 */
export function getLatestCheckpoint(
  buildId: string
): Checkpoint | null {
  const row = db.prepare(`
    SELECT * FROM checkpoints
    WHERE build_id = ?
    ORDER BY timestamp DESC LIMIT 1
  `).get(buildId) as any;

  if (!row) return null;
  return {
    id: row.id,
    buildId: row.build_id,
    timestamp: row.timestamp,
    tasks: JSON.parse(row.tasks),
    currentPhase: row.current_phase,
    metadata: JSON.parse(row.metadata || '{}'),
  };
}

/**
 * Save or update the full build state (upsert via INSERT OR REPLACE).
 */
export function saveBuildState(state: BuildState): void {
  db.prepare(`
    INSERT OR REPLACE INTO build_states
      (build_id, prd_file, start_time, tasks, completed_tasks,
       failed_tasks, current_phase, logs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    state.buildId,
    state.prdFile,
    state.startTime,
    JSON.stringify(state.tasks),
    JSON.stringify(state.completedTasks),
    JSON.stringify(state.failedTasks),
    state.currentPhase,
    JSON.stringify(state.logs)
  );
}

/**
 * Load a saved build state by ID.
 */
export function loadBuildState(buildId: string): BuildState | null {
  const row = db.prepare(
    'SELECT * FROM build_states WHERE build_id = ?'
  ).get(buildId) as any;

  if (!row) return null;
  return {
    buildId: row.build_id,
    prdFile: row.prd_file,
    startTime: row.start_time,
    tasks: JSON.parse(row.tasks),
    completedTasks: JSON.parse(row.completed_tasks),
    failedTasks: JSON.parse(row.failed_tasks),
    currentPhase: row.current_phase,
    logs: JSON.parse(row.logs),
  };
}

/**
 * Start periodic auto-save. Returns a cleanup function to stop the timer.
 */
export function startAutoSave(
  buildId: string,
  getState: () => Omit<Checkpoint, 'id' | 'timestamp'>,
  intervalMs: number = 30000
): () => void {
  const interval = setInterval(() => {
    const state = getState();
    saveCheckpoint({ id: `${buildId}-${Date.now()}`, ...state });
  }, intervalMs);

  return () => clearInterval(interval);
}

/**
 * Prune old checkpoints, keeping only the 50 most recent per build.
 */
function cleanupOldCheckpoints(buildId: string): void {
  db.prepare(`
    DELETE FROM checkpoints
    WHERE build_id = ?
    AND id NOT IN (
      SELECT id FROM checkpoints
      WHERE build_id = ?
      ORDER BY timestamp DESC LIMIT 50
    )
  `).run(buildId, buildId);
}

/**
 * Delete all data for a build (checkpoints + build state).
 */
export function deleteBuild(buildId: string): void {
  db.prepare('DELETE FROM checkpoints WHERE build_id = ?').run(buildId);
  db.prepare('DELETE FROM build_states WHERE build_id = ?').run(buildId);
}

/**
 * List all saved builds for the resume-build UI.
 */
export function listSavedBuilds(): Array<{
  buildId: string;
  prdFile: string;
  startTime: string;
  updatedAt: string;
}> {
  return (db.prepare(
    'SELECT build_id, prd_file, start_time, updated_at FROM build_states ORDER BY updated_at DESC'
  ).all() as any[]).map(row => ({
    buildId: row.build_id,
    prdFile: row.prd_file,
    startTime: row.start_time,
    updatedAt: row.updated_at,
  }));
}
```

### Key Concepts

- **Two-tier persistence**: Checkpoints capture lightweight task snapshots at a point in time; build states capture the full picture (PRD, completed/failed tasks, logs). Together they support both fine-grained rollback and full session resume.
- **SQLite for local persistence**: `better-sqlite3` provides synchronous, zero-config embedded storage — no external database server needed
- **Idempotent schema initialization**: `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` make the module safe to import multiple times
- **Upsert for build state**: `INSERT OR REPLACE` ensures only one build state row per `buildId`, always reflecting the latest progress
- **Auto-save with cleanup function**: `startAutoSave()` returns a `() => void` teardown function, following the disposable resource pattern for clean shutdown
- **Automatic pruning**: `cleanupOldCheckpoints()` runs after every save, keeping only the 50 most recent checkpoints per build to bound disk usage
- **JSON serialization for complex fields**: Tasks, logs, and metadata are stored as JSON strings in TEXT columns — simple and flexible for evolving schemas

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Writing build state to a flat JSON file — no concurrent access safety,
// no indexing, corruption risk on crash mid-write
import { writeFileSync } from 'fs';
writeFileSync('build-state.json', JSON.stringify(state));
// If the process crashes during write, the file is corrupted and unrecoverable

// No checkpoint pruning — disk usage grows unbounded
function saveCheckpoint(cp: Checkpoint): void {
  db.prepare('INSERT INTO checkpoints ...').run(cp);
  // Never deletes old checkpoints — thousands accumulate over time
}

// Storing tasks as separate rows with complex joins — over-engineering
// for a local dev tool that just needs to snapshot and restore
db.exec(`
  CREATE TABLE checkpoint_tasks (
    checkpoint_id TEXT, task_id TEXT, status TEXT, ...
  );
`);
// Now every save/load requires multi-table joins for no real benefit
```

### ✅ Do This Instead

```typescript
// SQLite with atomic writes — crash-safe by default
const db = new Database(join(DATA_DIR, 'checkpoints.db'));
saveBuildState(state); // Single atomic INSERT OR REPLACE

// Automatic pruning after every save
function saveCheckpoint(checkpoint: Omit<Checkpoint, 'timestamp'>): void {
  stmt.run(checkpoint.id, checkpoint.buildId, ...);
  cleanupOldCheckpoints(checkpoint.buildId); // Keep only 50 most recent
}

// JSON columns for complex nested data — simple, flexible, fast
db.prepare('INSERT INTO checkpoints (tasks, metadata) VALUES (?, ?)')
  .run(JSON.stringify(tasks), JSON.stringify(metadata));
// Easy to evolve: add fields to the JSON without schema migrations
```

---

## When to Use This Pattern

✅ **Use for:**
- Long-running multi-phase build pipelines that need crash recovery and resume capability
- Local developer tools where an embedded database (no server) is preferred over external infrastructure
- Systems that need both point-in-time snapshots (checkpoints) and full state persistence (build states)

❌ **Don't use for:**
- Distributed systems where multiple processes write concurrently (SQLite has a single-writer lock)
- High-frequency writes (thousands per second) where WAL mode or a dedicated database would be more appropriate

---

## Benefits

1. **Crash recovery** — if the process dies mid-build, `getLatestCheckpoint()` restores the last known good state
2. **Zero infrastructure** — `better-sqlite3` is an embedded database; no server setup, no connection strings, no Docker containers
3. **Bounded disk usage** — automatic pruning keeps only the 50 most recent checkpoints per build
4. **Resume workflow** — `listSavedBuilds()` powers a "resume previous build" UI, letting developers pick up where they left off
5. **Auto-save safety net** — `startAutoSave()` creates periodic checkpoints without manual intervention, with a clean teardown function

---

## Related Patterns

- See `../07-memory-and-persistence/session-memory.md` for cross-session key-value memory (preferences, decisions, error solutions) — complementary to checkpoint's full build state persistence
- See `../06-llm-integration/response-cache.md` for another SQLite-backed persistence pattern focused on caching LLM responses
- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that calls `saveCheckpoint()` between phases
- See `../01-orchestration/event-store.md` for the event log that records task execution events alongside checkpoint snapshots

---

*Extracted: 2026-02-19*