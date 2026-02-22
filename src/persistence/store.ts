// Persistence Store - GLM-07
// Type-safe CRUD abstraction over SQLite (or any key-value backend).
// Used by checkpoint-system, analytics, and memory modules.

import type { SqliteDatabase } from './migration-runner.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface Store<T> {
  /** Persist a record under the given key. Upserts if the key already exists. */
  set(key: string, value: T): void;
  /** Retrieve a record by key. Returns undefined if not found. */
  get(key: string): T | undefined;
  /** Delete a record by key. Returns true if it existed. */
  delete(key: string): boolean;
  /** Check if a key exists. */
  has(key: string): boolean;
  /** List all keys in the store. */
  keys(): string[];
  /** List all values in the store. */
  values(): T[];
  /** List all entries as [key, value] tuples. */
  entries(): Array<[string, T]>;
  /** Number of records in the store. */
  count(): number;
  /** Remove all records. */
  clear(): void;
  /** Find all records matching a predicate. */
  find(predicate: (value: T, key: string) => boolean): Array<[string, T]>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SQLite Store
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SQLite-backed Store<T> implementation.
 * Stores JSON-serialized values in a single table with (key, value) columns.
 */
export class SqliteStore<T> implements Store<T> {
  private readonly db: SqliteDatabase;
  private readonly tableName: string;

  constructor(db: SqliteDatabase, tableName: string) {
    this.db = db;
    this.tableName = tableName;
    this.ensureTable();
  }

  set(key: string, value: T): void {
    this.db.prepare(
      `INSERT INTO ${this.tableName} (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, JSON.stringify(value));
  }

  get(key: string): T | undefined {
    const row = this.db.prepare(
      `SELECT value FROM ${this.tableName} WHERE key = ?`
    ).get(key) as { value: string } | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return undefined;
    }
  }

  delete(key: string): boolean {
    const result = this.db.prepare(
      `DELETE FROM ${this.tableName} WHERE key = ?`
    ).run(key);
    return result.changes > 0;
  }

  has(key: string): boolean {
    const row = this.db.prepare(
      `SELECT 1 FROM ${this.tableName} WHERE key = ?`
    ).get(key);
    return row !== undefined;
  }

  keys(): string[] {
    const rows = this.db.prepare(
      `SELECT key FROM ${this.tableName} ORDER BY key ASC`
    ).all() as Array<{ key: string }>;
    return rows.map(r => r.key);
  }

  values(): T[] {
    const rows = this.db.prepare(
      `SELECT value FROM ${this.tableName}`
    ).all() as Array<{ value: string }>;
    return rows.map(r => {
      try { return JSON.parse(r.value) as T; } catch { return undefined as unknown as T; }
    });
  }

  entries(): Array<[string, T]> {
    const rows = this.db.prepare(
      `SELECT key, value FROM ${this.tableName} ORDER BY key ASC`
    ).all() as Array<{ key: string; value: string }>;
    return rows.map(r => {
      try { return [r.key, JSON.parse(r.value) as T] as [string, T]; }
      catch { return [r.key, undefined as unknown as T] as [string, T]; }
    });
  }

  count(): number {
    const row = this.db.prepare(
      `SELECT COUNT(*) as n FROM ${this.tableName}`
    ).get() as { n: number | string } | undefined;
    return row ? Number(row.n) : 0;
  }

  clear(): void {
    this.db.prepare(`DELETE FROM ${this.tableName}`).run();
  }

  find(predicate: (value: T, key: string) => boolean): Array<[string, T]> {
    return this.entries().filter(([k, v]) => predicate(v, k));
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// In-Memory Store (for testing / in-process use)
// ═══════════════════════════════════════════════════════════════════════════════

export class MemoryStore<T> implements Store<T> {
  private readonly map: Map<string, T> = new Map();

  set(key: string, value: T): void { this.map.set(key, value); }
  get(key: string): T | undefined { return this.map.get(key); }
  delete(key: string): boolean { return this.map.delete(key); }
  has(key: string): boolean { return this.map.has(key); }
  keys(): string[] { return [...this.map.keys()]; }
  values(): T[] { return [...this.map.values()]; }
  entries(): Array<[string, T]> { return [...this.map.entries()]; }
  count(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  find(predicate: (value: T, key: string) => boolean): Array<[string, T]> {
    return this.entries().filter(([k, v]) => predicate(v, k));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createSqliteStore<T>(db: SqliteDatabase, tableName: string): SqliteStore<T> {
  return new SqliteStore<T>(db, tableName);
}

export function createMemoryStore<T>(): MemoryStore<T> {
  return new MemoryStore<T>();
}
