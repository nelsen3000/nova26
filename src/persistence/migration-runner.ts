// Migration Runner - GLM-06
// Manages SQLite schema migrations with version tracking, up/down support,
// and atomic transactions. Replaces ad-hoc db.exec() calls in checkpoint-system.ts.

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface Migration {
  /** Monotonically increasing version number (1-based). */
  version: number;
  /** Human-readable description of the migration. */
  description: string;
  /** SQL to apply the migration (up). Must be idempotent when possible. */
  up: string;
  /** SQL to undo the migration (down). Optional. */
  down?: string;
}

export interface MigrationResult {
  version: number;
  description: string;
  direction: 'up' | 'down';
  success: boolean;
  error?: string;
}

export interface MigrationState {
  currentVersion: number;
  appliedMigrations: number[];
}

// Minimal interface for the subset of better-sqlite3 we use
export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  transaction<T>(fn: () => T): () => T;
}

export interface SqliteStatement {
  run(...args: unknown[]): { changes: number };
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MigrationRunner
// ═══════════════════════════════════════════════════════════════════════════════

const SCHEMA_TABLE = '_schema_migrations';

export class MigrationRunner {
  private readonly db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
    this.ensureSchemaTable();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Apply all pending migrations in order.
   * Each migration runs in its own transaction.
   * Returns the list of migration results.
   */
  migrate(migrations: Migration[]): MigrationResult[] {
    const sorted = [...migrations].sort((a, b) => a.version - b.version);
    const applied = this.getAppliedVersions();
    const results: MigrationResult[] = [];

    for (const migration of sorted) {
      if (applied.has(migration.version)) continue;

      const result = this.applyUp(migration);
      results.push(result);

      if (!result.success) break; // Stop on first failure
    }

    return results;
  }

  /**
   * Roll back to a specific version (exclusive).
   * Applies down() in reverse order for all versions > targetVersion.
   */
  rollback(migrations: Migration[], targetVersion: number): MigrationResult[] {
    const sorted = [...migrations].sort((a, b) => b.version - a.version); // descending
    const applied = this.getAppliedVersions();
    const results: MigrationResult[] = [];

    for (const migration of sorted) {
      if (migration.version <= targetVersion) break;
      if (!applied.has(migration.version)) continue;
      if (!migration.down) {
        results.push({
          version: migration.version,
          description: migration.description,
          direction: 'down',
          success: false,
          error: 'No down migration defined',
        });
        break;
      }

      const result = this.applyDown(migration);
      results.push(result);

      if (!result.success) break;
    }

    return results;
  }

  /** Get the current schema version (0 if no migrations applied). */
  getCurrentVersion(): number {
    const row = this.db
      .prepare(`SELECT MAX(version) as v FROM ${SCHEMA_TABLE}`)
      .get() as { v: number | string | null } | undefined;
    const v = row?.v;
    return v == null ? 0 : Number(v);
  }

  /** Get all applied migration versions. */
  getAppliedVersions(): Set<number> {
    const rows = this.db
      .prepare(`SELECT version FROM ${SCHEMA_TABLE} ORDER BY version ASC`)
      .all() as Array<{ version: number | string }>;
    return new Set(rows.map(r => Number(r.version)));
  }

  /** Get full migration state. */
  getState(): MigrationState {
    const versions = this.getAppliedVersions();
    return {
      currentVersion: versions.size > 0 ? Math.max(...versions) : 0,
      appliedMigrations: [...versions].sort((a, b) => a - b),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private ensureSchemaTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLE} (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  private applyUp(migration: Migration): MigrationResult {
    try {
      const txn = this.db.transaction(() => {
        this.db.exec(migration.up);
        this.db
          .prepare(
            `INSERT INTO ${SCHEMA_TABLE} (version, description) VALUES (?, ?)`
          )
          .run(migration.version, migration.description);
      });
      txn();
      return {
        version: migration.version,
        description: migration.description,
        direction: 'up',
        success: true,
      };
    } catch (err) {
      return {
        version: migration.version,
        description: migration.description,
        direction: 'up',
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private applyDown(migration: Migration): MigrationResult {
    try {
      const txn = this.db.transaction(() => {
        this.db.exec(migration.down!);
        this.db
          .prepare(`DELETE FROM ${SCHEMA_TABLE} WHERE version = ?`)
          .run(migration.version);
      });
      txn();
      return {
        version: migration.version,
        description: migration.description,
        direction: 'down',
        success: true,
      };
    } catch (err) {
      return {
        version: migration.version,
        description: migration.description,
        direction: 'down',
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createMigrationRunner(db: SqliteDatabase): MigrationRunner {
  return new MigrationRunner(db);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Standard nova26 migrations (used by checkpoint-system.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export const NOVA26_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Create checkpoints table',
    up: `
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
    `,
    down: `DROP TABLE IF EXISTS checkpoints`,
  },
  {
    version: 2,
    description: 'Create build_states table',
    up: `
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
    `,
    down: `DROP TABLE IF EXISTS build_states`,
  },
];
