// Persistence Store Tests - GLM-07
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SqliteStore,
  MemoryStore,
  createSqliteStore,
  createMemoryStore,
  type Store,
} from '../store.js';
import type { SqliteDatabase } from '../migration-runner.js';

// ─── In-memory SQLite mock (reused from migration-runner tests) ───────────────

function createInMemoryDb(): SqliteDatabase {
  const tables: Record<string, Record<string, unknown>[]> = {};

  function execSql(sql: string): void {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      if (/^CREATE TABLE/i.test(stmt)) {
        const m = stmt.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/i);
        if (m && !tables[m[1]!]) tables[m[1]!] = [];
      } else if (/^DELETE/i.test(stmt)) {
        const m = stmt.match(/DELETE FROM\s+(\w+)(?:\s+WHERE\s+(\w+)\s*=\s*(.+))?/i);
        if (m) {
          const [, tbl, col, val] = m;
          if (col && val) {
            const clean = val.trim().replace(/^['"]|['"]$/g, '');
            tables[tbl!] = (tables[tbl!] ?? []).filter(r => String(r[col]) !== clean);
          } else {
            tables[tbl!] = [];
          }
        }
      }
    }
  }

  function makeStatement(sql: string): ReturnType<SqliteDatabase['prepare']> {
    return {
      run(...args: unknown[]) {
        // Handle UPSERT (INSERT ... ON CONFLICT)
        if (/INSERT INTO/i.test(sql)) {
          const m = sql.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
          if (m) {
            const tbl = m[1]!;
            const cols = m[2]!.split(',').map(c => c.trim());
            const row: Record<string, unknown> = {};
            cols.forEach((c, i) => { row[c] = args[i]; });

            if (!tables[tbl]) tables[tbl] = [];

            const pkIdx = tables[tbl]!.findIndex(r => r['key'] === args[0]);
            if (pkIdx >= 0 && /ON CONFLICT/i.test(sql)) {
              tables[tbl]![pkIdx] = row; // upsert
            } else if (pkIdx < 0) {
              tables[tbl]!.push(row);
            }
          }
        } else if (/DELETE FROM/i.test(sql)) {
          const m = sql.match(/DELETE FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
          if (m) {
            const [, tbl, col] = m;
            const before = (tables[tbl!] ?? []).length;
            tables[tbl!] = (tables[tbl!] ?? []).filter(r => r[col!] !== args[0]);
            const after = (tables[tbl!] ?? []).length;
            return { changes: before - after };
          }
        }
        return { changes: 1 };
      },
      get(...args: unknown[]) {
        if (/SELECT 1 FROM/i.test(sql)) {
          const m = sql.match(/FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
          if (m) {
            const [, tbl, col] = m;
            const found = (tables[tbl!] ?? []).find(r => r[col!] === args[0]);
            return found ? { 1: 1 } : undefined;
          }
        }
        if (/SELECT value FROM/i.test(sql) && /WHERE key/i.test(sql)) {
          const m = sql.match(/FROM\s+(\w+)\s+WHERE/i);
          if (m) {
            const found = (tables[m[1]!] ?? []).find(r => r['key'] === args[0]);
            return found ? { value: found['value'] } : undefined;
          }
        }
        if (/COUNT\(\*\)/i.test(sql)) {
          const m = sql.match(/FROM\s+(\w+)/i);
          if (m) return { n: (tables[m[1]!] ?? []).length };
        }
        return undefined;
      },
      all(..._args: unknown[]) {
        if (/SELECT key FROM/i.test(sql)) {
          const m = sql.match(/FROM\s+(\w+)/i);
          if (m) return (tables[m[1]!] ?? []).map(r => ({ key: r['key'] }));
        }
        if (/SELECT value FROM/i.test(sql)) {
          const m = sql.match(/FROM\s+(\w+)/i);
          if (m) return (tables[m[1]!] ?? []).map(r => ({ value: r['value'] }));
        }
        if (/SELECT key, value FROM/i.test(sql) || /SELECT \* FROM/i.test(sql)) {
          const m = sql.match(/FROM\s+(\w+)/i);
          if (m) return (tables[m[1]!] ?? []).map(r => ({ key: r['key'], value: r['value'] }));
        }
        return [];
      },
    };
  }

  return {
    exec: execSql,
    prepare: makeStatement,
    transaction<T>(fn: () => T): () => T { return fn; },
  };
}

// ─── Shared behaviour tests run against any Store<T> implementation ───────────

function runStoreTests(label: string, factory: () => Store<{ name: string; score: number }>) {
  describe(label, () => {
    let store: Store<{ name: string; score: number }>;

    beforeEach(() => {
      store = factory();
    });

    it('count() is 0 on an empty store', () => {
      expect(store.count()).toBe(0);
    });

    it('set() and get() round-trip a value', () => {
      store.set('k1', { name: 'Alice', score: 99 });
      expect(store.get('k1')).toEqual({ name: 'Alice', score: 99 });
    });

    it('get() returns undefined for missing key', () => {
      expect(store.get('missing')).toBeUndefined();
    });

    it('has() returns true after set()', () => {
      store.set('k', { name: 'Bob', score: 5 });
      expect(store.has('k')).toBe(true);
    });

    it('has() returns false for missing key', () => {
      expect(store.has('nope')).toBe(false);
    });

    it('set() overwrites an existing key', () => {
      store.set('k', { name: 'A', score: 1 });
      store.set('k', { name: 'B', score: 2 });
      expect(store.get('k')).toEqual({ name: 'B', score: 2 });
      expect(store.count()).toBe(1);
    });

    it('delete() removes a key and returns true', () => {
      store.set('k', { name: 'A', score: 1 });
      expect(store.delete('k')).toBe(true);
      expect(store.has('k')).toBe(false);
    });

    it('delete() returns false for a missing key', () => {
      expect(store.delete('nope')).toBe(false);
    });

    it('keys() lists all keys', () => {
      store.set('a', { name: 'A', score: 1 });
      store.set('b', { name: 'B', score: 2 });
      expect(store.keys().sort()).toEqual(['a', 'b']);
    });

    it('values() lists all values', () => {
      store.set('x', { name: 'X', score: 10 });
      const vals = store.values();
      expect(vals).toHaveLength(1);
      expect(vals[0]).toEqual({ name: 'X', score: 10 });
    });

    it('entries() lists all [key, value] pairs', () => {
      store.set('k1', { name: 'A', score: 1 });
      const ents = store.entries();
      expect(ents[0]![0]).toBe('k1');
      expect(ents[0]![1]).toEqual({ name: 'A', score: 1 });
    });

    it('count() reflects actual item count', () => {
      store.set('a', { name: 'A', score: 1 });
      store.set('b', { name: 'B', score: 2 });
      store.set('c', { name: 'C', score: 3 });
      expect(store.count()).toBe(3);
    });

    it('clear() removes all entries', () => {
      store.set('a', { name: 'A', score: 1 });
      store.set('b', { name: 'B', score: 2 });
      store.clear();
      expect(store.count()).toBe(0);
    });

    it('find() returns matching entries', () => {
      store.set('a', { name: 'Alice', score: 90 });
      store.set('b', { name: 'Bob', score: 40 });
      store.set('c', { name: 'Carol', score: 80 });
      const high = store.find(v => v.score >= 80);
      expect(high).toHaveLength(2);
    });

    it('find() returns empty array when no match', () => {
      store.set('a', { name: 'A', score: 1 });
      expect(store.find(v => v.score > 100)).toHaveLength(0);
    });
  });
}

// ─── Run shared tests against both implementations ────────────────────────────

runStoreTests('SqliteStore', () => {
  const db = createInMemoryDb();
  return createSqliteStore<{ name: string; score: number }>(db, 'test_store');
});

runStoreTests('MemoryStore', () => {
  return createMemoryStore<{ name: string; score: number }>();
});

// ─── Factory tests ────────────────────────────────────────────────────────────

describe('factories', () => {
  it('createSqliteStore() returns SqliteStore instance', () => {
    const db = createInMemoryDb();
    expect(createSqliteStore(db, 'tbl')).toBeInstanceOf(SqliteStore);
  });

  it('createMemoryStore() returns MemoryStore instance', () => {
    expect(createMemoryStore()).toBeInstanceOf(MemoryStore);
  });
});
