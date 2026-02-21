// Checkpoint System - Save/Restore Build State
// Prevents data loss on crashes

// @ts-ignore - better-sqlite3 types installed at runtime
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

// Initialize schema
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

export function saveCheckpoint(checkpoint: Omit<Checkpoint, 'timestamp'>): void {
  const stmt = db.prepare(`
    INSERT INTO checkpoints (id, build_id, timestamp, tasks, current_phase, metadata)
    VALUES (?, ?, datetime('now'), ?, ?, ?)
  `);
  stmt.run(checkpoint.id, checkpoint.buildId, JSON.stringify(checkpoint.tasks), checkpoint.currentPhase, JSON.stringify(checkpoint.metadata));
  console.log(`💾 Checkpoint saved: ${checkpoint.id.slice(0, 8)}`);
  cleanupOldCheckpoints(checkpoint.buildId);
}

interface CheckpointRow {
  id: string;
  build_id: string;
  timestamp: string;
  tasks: string;
  current_phase: number;
  metadata: string;
}

export function getLatestCheckpoint(buildId: string): Checkpoint | null {
  const row = db.prepare(`SELECT * FROM checkpoints WHERE build_id = ? ORDER BY timestamp DESC LIMIT 1`).get(buildId) as CheckpointRow | undefined;
  if (!row) return null;
  return { id: row.id, buildId: row.build_id, timestamp: row.timestamp, tasks: JSON.parse(row.tasks), currentPhase: row.current_phase, metadata: JSON.parse(row.metadata || '{}') };
}

export function saveBuildState(state: BuildState): void {
  db.prepare(`INSERT OR REPLACE INTO build_states (build_id, prd_file, start_time, tasks, completed_tasks, failed_tasks, current_phase, logs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(state.buildId, state.prdFile, state.startTime, JSON.stringify(state.tasks), JSON.stringify(state.completedTasks), JSON.stringify(state.failedTasks), state.currentPhase, JSON.stringify(state.logs));
}

interface BuildStateRow {
  build_id: string;
  prd_file: string;
  start_time: string;
  tasks: string;
  completed_tasks: string;
  failed_tasks: string;
  current_phase: number;
  logs: string;
}

export function loadBuildState(buildId: string): BuildState | null {
  const row = db.prepare('SELECT * FROM build_states WHERE build_id = ?').get(buildId) as BuildStateRow | undefined;
  if (!row) return null;
  return { buildId: row.build_id, prdFile: row.prd_file, startTime: row.start_time, tasks: JSON.parse(row.tasks), completedTasks: JSON.parse(row.completed_tasks), failedTasks: JSON.parse(row.failed_tasks), currentPhase: row.current_phase, logs: JSON.parse(row.logs) };
}

interface SavedBuildRow {
  build_id: string;
  prd_file: string;
  start_time: string;
  updated_at: string;
}

export function listSavedBuilds(): Array<{ buildId: string; prdFile: string; startTime: string; updatedAt: string }> {
  return (db.prepare('SELECT build_id, prd_file, start_time, updated_at FROM build_states ORDER BY updated_at DESC').all() as SavedBuildRow[])
    .map(row => ({ buildId: row.build_id, prdFile: row.prd_file, startTime: row.start_time, updatedAt: row.updated_at }));
}

export function startAutoSave(buildId: string, getState: () => Omit<Checkpoint, 'id' | 'timestamp'>, intervalMs: number = 30000): () => void {
  console.log(`🔄 Auto-save enabled (${intervalMs}ms)`);
  const interval = setInterval(() => { const state = getState(); saveCheckpoint({ id: `${buildId}-${Date.now()}`, ...state }); }, intervalMs);
  return () => { clearInterval(interval); console.log('🛑 Auto-save disabled'); };
}

function cleanupOldCheckpoints(buildId: string): void {
  db.prepare(`DELETE FROM checkpoints WHERE build_id = ? AND id NOT IN (SELECT id FROM checkpoints WHERE build_id = ? ORDER BY timestamp DESC LIMIT 50)`).run(buildId, buildId);
}

export function deleteBuild(buildId: string): void {
  db.prepare('DELETE FROM checkpoints WHERE build_id = ?').run(buildId);
  db.prepare('DELETE FROM build_states WHERE build_id = ?').run(buildId);
}
