// Migration Runner Tests - GLM-06
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MigrationRunner,
  createMigrationRunner,
  NOVA26_MIGRATIONS,
  type Migration,
  type SqliteDatabase,
  type SqliteStatement,
} from '../migration-runner.js';

// ─── In-memory SQLite mock ────────────────────────────────────────────────────
// We use a simple in-memory store instead of the real better-sqlite3 to keep
// tests fast and dependency-free.

interface Row {
  [key: string]: unknown;
}

function createInMemoryDb(): SqliteDatabase {
  // Very lightweight in-memory store
  const tables: Record<string, Row[]> = {};
  const tableDefs: Record<string, string[]> = {}; // column names

  function parseCreateTable(sql: string): void {
    const match = sql.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)\s*\(([^)]+)\)/i);
    if (!match) return;
    const [, name, cols] = match;
    if (!tables[name!]) {
      tables[name!] = [];
      tableDefs[name!] = cols!.split(',').map(c => c.trim().split(/\s+/)[0]!.trim());
    }
  }

  function parseDropTable(sql: string): void {
    const match = sql.match(/DROP TABLE(?: IF EXISTS)?\s+(\w+)/i);
    if (match) delete tables[match[1]!];
  }

  function execSql(sql: string): void {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      if (/^CREATE TABLE/i.test(stmt)) parseCreateTable(stmt);
      else if (/^CREATE INDEX/i.test(stmt)) { /* ignore */ }
      else if (/^DROP TABLE/i.test(stmt)) parseDropTable(stmt);
      else if (/^SELECT/i.test(stmt)) { /* no-op for exec() */ }
      else if (/^INSERT INTO/i.test(stmt)) {
        const m = stmt.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
        if (m) {
          const tbl = m[1]!;
          const cols = m[2]!.split(',').map(c => c.trim());
          const vals = m[3]!.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
          const row: Row = {};
          cols.forEach((c, i) => { row[c] = vals[i]; });
          if (!tables[tbl]) tables[tbl] = [];
          tables[tbl]!.push(row);
        }
      } else if (/^DELETE/i.test(stmt)) {
        const m = stmt.match(/DELETE FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*(.+)/i);
        if (m) {
          const [, tbl, col, val] = m;
          const clean = val!.trim().replace(/^['"]|['"]$/g, '');
          tables[tbl!] = (tables[tbl!] ?? []).filter(r => String(r[col!]) !== String(clean));
        }
      } else {
        // Unrecognized SQL — throw like real SQLite would
        throw new Error(`near "${stmt.split(/\s+/)[0]}": syntax error`);
      }
    }
  }

  function makeStatement(sql: string): SqliteStatement {
    return {
      run(...args: unknown[]) {
        let resolved = sql;
        for (const arg of args) {
          resolved = resolved.replace('?', String(arg));
        }
        execSql(resolved);
        return { changes: 1 };
      },
      get(...args: unknown[]) {
        // Handle MAX(version) query
        const maxMatch = sql.match(/SELECT MAX\((\w+)\) as (\w+) FROM (\w+)/i);
        if (maxMatch) {
          const [, col, alias, tbl] = maxMatch;
          const rows = tables[tbl!] ?? [];
          const max = rows.reduce((m, r) => Math.max(m, Number(r[col!]) || 0), 0);
          return { [alias!]: rows.length ? max : null };
        }
        return undefined;
      },
      all(...args: unknown[]) {
        const tblMatch = sql.match(/SELECT \* FROM (\w+)/i);
        const vMatch = sql.match(/SELECT (\w+) FROM (\w+)/i);
        if (tblMatch) return tables[tblMatch[1]!] ?? [];
        if (vMatch) {
          const [, col, tbl] = vMatch;
          return (tables[tbl!] ?? []).map(r => ({ [col!]: r[col!] }));
        }
        return [];
      },
    };
  }

  return {
    exec(sql: string) { execSql(sql); },
    prepare(sql: string) { return makeStatement(sql); },
    transaction<T>(fn: () => T): () => T {
      return fn; // no real transaction needed for tests
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMigration(version: number, opts: Partial<Migration> = {}): Migration {
  return {
    version,
    description: `migration v${version}`,
    up: `CREATE TABLE IF NOT EXISTS t${version} (id TEXT PRIMARY KEY)`,
    down: `DROP TABLE IF EXISTS t${version}`,
    ...opts,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MigrationRunner', () => {
  let db: SqliteDatabase;
  let runner: MigrationRunner;

  beforeEach(() => {
    db = createInMemoryDb();
    runner = new MigrationRunner(db);
  });

  // ── Construction ────────────────────────────────────────────────────────────

  it('creates the _schema_migrations table on construction', () => {
    // No error = table created
    expect(runner.getCurrentVersion()).toBe(0);
  });

  it('createMigrationRunner() factory returns instance', () => {
    const r = createMigrationRunner(db);
    expect(r).toBeInstanceOf(MigrationRunner);
  });

  // ── migrate() ───────────────────────────────────────────────────────────────

  it('applies a single migration', () => {
    const results = runner.migrate([makeMigration(1)]);
    expect(results).toHaveLength(1);
    expect(results[0]!.success).toBe(true);
    expect(results[0]!.direction).toBe('up');
  });

  it('getCurrentVersion() reflects applied migration', () => {
    runner.migrate([makeMigration(1)]);
    expect(runner.getCurrentVersion()).toBe(1);
  });

  it('applies multiple migrations in version order', () => {
    const results = runner.migrate([makeMigration(2), makeMigration(1)]);
    expect(results).toHaveLength(2);
    expect(results[0]!.version).toBe(1);
    expect(results[1]!.version).toBe(2);
  });

  it('skips already-applied migrations', () => {
    runner.migrate([makeMigration(1)]);
    const second = runner.migrate([makeMigration(1), makeMigration(2)]);
    expect(second).toHaveLength(1); // only v2 applied
    expect(second[0]!.version).toBe(2);
  });

  it('returns empty array when all migrations already applied', () => {
    runner.migrate([makeMigration(1)]);
    const results = runner.migrate([makeMigration(1)]);
    expect(results).toHaveLength(0);
  });

  it('stops on first failure', () => {
    const bad = makeMigration(1, { up: 'INVALID SQL !!!' });
    const results = runner.migrate([bad, makeMigration(2)]);
    // v1 fails, v2 never runs
    expect(results[0]!.success).toBe(false);
    expect(results.length).toBe(1);
  });

  it('sets error message on failure', () => {
    const bad = makeMigration(1, { up: 'NOT VALID SQL !!!' });
    const [r] = runner.migrate([bad]);
    expect(r!.success).toBe(false);
    expect(r!.error).toBeTruthy();
  });

  it('migrate() result has version and description', () => {
    const results = runner.migrate([makeMigration(1)]);
    expect(results[0]!.version).toBe(1);
    expect(results[0]!.description).toBe('migration v1');
  });

  // ── rollback() ──────────────────────────────────────────────────────────────

  it('rolls back a migration to targetVersion', () => {
    runner.migrate([makeMigration(1), makeMigration(2)]);
    const results = runner.rollback([makeMigration(1), makeMigration(2)], 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.version).toBe(2);
    expect(results[0]!.direction).toBe('down');
    expect(results[0]!.success).toBe(true);
  });

  it('rollback reduces getCurrentVersion()', () => {
    runner.migrate([makeMigration(1), makeMigration(2)]);
    runner.rollback([makeMigration(1), makeMigration(2)], 1);
    expect(runner.getCurrentVersion()).toBe(1);
  });

  it('rollback returns failure when no down migration defined', () => {
    const noDown = makeMigration(2, { down: undefined });
    runner.migrate([makeMigration(1), noDown]);
    const results = runner.rollback([makeMigration(1), noDown], 1);
    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error).toMatch(/No down/i);
  });

  it('rollback does nothing when targetVersion matches current', () => {
    runner.migrate([makeMigration(1)]);
    const results = runner.rollback([makeMigration(1)], 1);
    expect(results).toHaveLength(0);
  });

  // ── getState() ─────────────────────────────────────────────────────────────

  it('getState() returns currentVersion 0 with no migrations', () => {
    expect(runner.getState().currentVersion).toBe(0);
  });

  it('getState() returns applied migration list', () => {
    runner.migrate([makeMigration(1), makeMigration(2)]);
    const state = runner.getState();
    expect(state.appliedMigrations).toEqual([1, 2]);
  });

  it('getAppliedVersions() returns a Set', () => {
    runner.migrate([makeMigration(1)]);
    const versions = runner.getAppliedVersions();
    expect(versions.has(1)).toBe(true);
    expect(versions.has(2)).toBe(false);
  });

  // ── NOVA26_MIGRATIONS ──────────────────────────────────────────────────────

  it('NOVA26_MIGRATIONS has 2 migrations', () => {
    expect(NOVA26_MIGRATIONS).toHaveLength(2);
  });

  it('NOVA26_MIGRATIONS versions are 1 and 2', () => {
    const versions = NOVA26_MIGRATIONS.map(m => m.version);
    expect(versions).toContain(1);
    expect(versions).toContain(2);
  });

  it('all NOVA26_MIGRATIONS have description and up', () => {
    for (const m of NOVA26_MIGRATIONS) {
      expect(m.description).toBeTruthy();
      expect(m.up).toBeTruthy();
    }
  });
});
