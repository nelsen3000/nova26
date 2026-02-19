// Offline-First Engine — SQLite-based local storage with Convex sync queue
// KIMI-FRONTIER-05: Grok R13-05 spec

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type SyncStatus = 'online' | 'offline' | 'syncing' | 'error';

export interface SyncQueueEntry {
  id: string;
  mutationPath: string;
  args: Record<string, unknown>;
  enqueuedAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
  status: 'pending' | 'retrying' | 'failed' | 'synced';
  errorMessage?: string;
}

export interface ConflictResolution {
  entityType: 'user-content' | 'tags-metadata' | 'computed-fields';
  strategy: 'local-wins' | 'union-merge' | 'server-wins';
  description: string;
}

export interface ConnectivityState {
  status: SyncStatus;
  lastCheckedAt: string;
  lastOnlineAt?: string;
  pendingMutations: number;
  failedMutations: number;
}

export interface FeatureAvailability {
  feature: string;
  requiresConnectivity: boolean;
  availableOffline: boolean;
  degradedMessage?: string;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const SyncQueueEntrySchema = z.object({
  id: z.string(),
  mutationPath: z.string(),
  args: z.record(z.unknown()),
  enqueuedAt: z.string(),
  attemptCount: z.number().int().nonnegative(),
  lastAttemptAt: z.string().optional(),
  status: z.enum(['pending', 'retrying', 'failed', 'synced']),
  errorMessage: z.string().optional(),
});

// ============================================================================
// OfflineEngine Class
// ============================================================================

class OfflineEngine {
  private db: Database.Database | null = null;
  private dbPath: string;
  private convexUrl: string;
  private convexToken: string;
  private connectivityCheckUrl: string;
  private checkIntervalMs: number;
  private maxRetryAttempts: number;
  private status: SyncStatus = 'offline';
  private lastCheckedAt: string = new Date().toISOString();
  private lastOnlineAt?: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Array<() => void>> = new Map();

  readonly conflictStrategies: ConflictResolution[] = [
    { entityType: 'user-content', strategy: 'local-wins', description: 'User-authored content (notes, vault edits, playbooks): local version always wins.' },
    { entityType: 'tags-metadata', strategy: 'union-merge', description: 'Tags and metadata: merge local and server sets (union of both).' },
    { entityType: 'computed-fields', strategy: 'server-wins', description: 'Computed fields (scores, counts, aggregates): server version wins.' },
  ];

  readonly featureMatrix: FeatureAvailability[] = [
    { feature: 'agent-loop', requiresConnectivity: false, availableOffline: true },
    { feature: 'taste-vault-read', requiresConnectivity: false, availableOffline: true },
    { feature: 'taste-vault-write', requiresConnectivity: false, availableOffline: true, degradedMessage: 'Changes will sync to Global Wisdom when reconnected.' },
    { feature: 'global-wisdom-sync', requiresConnectivity: true, availableOffline: false, degradedMessage: 'Global Wisdom sync requires connectivity. Using local vault only.' },
    { feature: 'docs-fetcher', requiresConnectivity: true, availableOffline: false, degradedMessage: 'Documentation fetching requires connectivity.' },
    { feature: 'convex-analytics', requiresConnectivity: true, availableOffline: false, degradedMessage: 'Build analytics will sync when reconnected.' },
    { feature: 'semantic-search', requiresConnectivity: false, availableOffline: true, degradedMessage: 'Search uses local index only.' },
  ];

  constructor(options?: {
    dbPath?: string;
    convexUrl?: string;
    convexToken?: string;
    connectivityCheckUrl?: string;
    checkIntervalMs?: number;
    maxRetryAttempts?: number;
  }) {
    this.dbPath = options?.dbPath ?? '.nova/offline.db';
    this.convexUrl = options?.convexUrl ?? process.env.CONVEX_URL ?? '';
    this.convexToken = options?.convexToken ?? process.env.CONVEX_TOKEN ?? '';
    this.connectivityCheckUrl = options?.connectivityCheckUrl ?? 'https://1.1.1.1';
    this.checkIntervalMs = options?.checkIntervalMs ?? 30000;
    this.maxRetryAttempts = options?.maxRetryAttempts ?? 5;
  }

  // ---- Connectivity detection ----

  async checkConnectivity(): Promise<boolean> {
    this.lastCheckedAt = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(this.connectivityCheckUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const isOnline = response.status >= 200 && response.status < 400;
      
      if (isOnline && this.status !== 'online') {
        this.status = 'online';
        this.lastOnlineAt = this.lastCheckedAt;
        this.emit('connected');
        this.flush().catch(() => {});
      } else if (!isOnline) {
        this.status = 'offline';
      }

      return isOnline;
    } catch {
      this.status = 'offline';
      return false;
    }
  }

  getConnectivityState(): ConnectivityState {
    return {
      status: this.status,
      lastCheckedAt: this.lastCheckedAt,
      lastOnlineAt: this.lastOnlineAt,
      pendingMutations: this.getPendingCount(),
      failedMutations: this.getFailedCount(),
    };
  }

  startMonitoring(): void {
    if (this.checkInterval) {
      return; // Already monitoring
    }

    this.checkInterval = setInterval(() => {
      this.checkConnectivity().catch(() => {});
    }, this.checkIntervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  on(event: 'connected' | 'disconnected' | 'sync-complete' | 'sync-error', handler: () => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  private emit(event: 'connected' | 'disconnected' | 'sync-complete' | 'sync-error'): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler();
        } catch {
          // Ignore handler errors
        }
      }
    }
  }

  // ---- Offline store (SQLite) ----

  async initStore(): Promise<void> {
    if (this.db) {
      return; // Already initialized
    }

    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (namespace, key)
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        mutation_path TEXT NOT NULL,
        args TEXT NOT NULL,
        enqueued_at TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT
      );
    `);
  }

  storeLocal(namespace: string, key: string, value: unknown): void {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT INTO kv_store (namespace, key, value, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(namespace, key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    stmt.run(namespace, key, JSON.stringify(value), new Date().toISOString());
  }

  loadLocal(namespace: string, key: string): unknown | null {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = this.db.prepare('SELECT value FROM kv_store WHERE namespace = ? AND key = ?');
    const row = stmt.get(namespace, key) as { value: string } | undefined;

    if (!row) {
      return null;
    }

    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }

  loadAllLocal(namespace: string): Array<{ key: string; value: unknown }> {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = this.db.prepare('SELECT key, value FROM kv_store WHERE namespace = ?');
    const rows = stmt.all(namespace) as Array<{ key: string; value: string }>;

    return rows.map(row => {
      try {
        return { key: row.key, value: JSON.parse(row.value) };
      } catch {
        return { key: row.key, value: null };
      }
    });
  }

  deleteLocal(namespace: string, key: string): void {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = this.db.prepare('DELETE FROM kv_store WHERE namespace = ? AND key = ?');
    stmt.run(namespace, key);
  }

  // ---- Sync queue ----

  enqueue(mutationPath: string, args: Record<string, unknown>): SyncQueueEntry {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const entry: SyncQueueEntry = {
      id: crypto.randomUUID(),
      mutationPath,
      args,
      enqueuedAt: new Date().toISOString(),
      attemptCount: 0,
      status: 'pending',
    };

    const stmt = this.db.prepare(`
      INSERT INTO sync_queue (id, mutation_path, args, enqueued_at, attempt_count, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(entry.id, entry.mutationPath, JSON.stringify(entry.args), entry.enqueuedAt, entry.attemptCount, entry.status);

    // If online, try to flush
    if (this.status === 'online') {
      this.flush().catch(() => {});
    }

    return entry;
  }

  async flush(): Promise<{ succeeded: number; failed: number; skipped: number }> {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue WHERE status IN ('pending', 'retrying')
      ORDER BY enqueued_at ASC
    `);
    const entries = stmt.all() as Array<{
      id: string;
      mutation_path: string;
      args: string;
      enqueued_at: string;
      attempt_count: number;
      last_attempt_at: string | null;
      status: string;
      error_message: string | null;
    }>;

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of entries) {
      const entry: SyncQueueEntry = {
        id: row.id,
        mutationPath: row.mutation_path,
        args: JSON.parse(row.args),
        enqueuedAt: row.enqueued_at,
        attemptCount: row.attempt_count,
        lastAttemptAt: row.last_attempt_at ?? undefined,
        status: row.status as SyncQueueEntry['status'],
        errorMessage: row.error_message ?? undefined,
      };

      try {
        // Attempt to send to Convex
        const success = await this.sendToConvex(entry);

        if (success) {
          const updateStmt = this.db.prepare(`
            UPDATE sync_queue SET status = 'synced' WHERE id = ?
          `);
          updateStmt.run(entry.id);
          succeeded++;
        } else {
          throw new Error('Failed to sync');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const newAttemptCount = entry.attemptCount + 1;
        const newStatus = newAttemptCount >= this.maxRetryAttempts ? 'failed' : 'retrying';

        if (newStatus === 'failed') {
          failed++;
          this.emit('sync-error');
        }

        const updateStmt = this.db.prepare(`
          UPDATE sync_queue 
          SET attempt_count = ?, last_attempt_at = ?, status = ?, error_message = ?
          WHERE id = ?
        `);
        updateStmt.run(newAttemptCount, new Date().toISOString(), newStatus, errorMessage, entry.id);
      }
    }

    // Count skipped (already failed)
    const skippedStmt = this.db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'`);
    const skippedRow = skippedStmt.get() as { count: number };
    skipped = skippedRow.count;

    this.emit('sync-complete');
    return { succeeded, failed, skipped };
  }

  private async sendToConvex(entry: SyncQueueEntry): Promise<boolean> {
    if (!this.convexUrl) {
      return false;
    }

    try {
      const url = `${this.convexUrl}/api/mutation`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.convexToken) {
        headers['Authorization'] = `Bearer ${this.convexToken}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          path: entry.mutationPath,
          args: entry.args,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  getPendingCount(): number {
    if (!this.db) {
      return 0;
    }

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'retrying')
    `);
    const row = stmt.get() as { count: number };
    return row.count;
  }

  getFailedCount(): number {
    if (!this.db) {
      return 0;
    }

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'
    `);
    const row = stmt.get() as { count: number };
    return row.count;
  }

  clearSynced(): void {
    if (!this.db) {
      return;
    }

    const stmt = this.db.prepare(`DELETE FROM sync_queue WHERE status = 'synced'`);
    stmt.run();
  }

  // ---- Conflict resolution ----

  resolveConflict<T extends Record<string, unknown>>(
    entityType: ConflictResolution['entityType'],
    local: T,
    server: T
  ): T {
    const strategy = this.conflictStrategies.find(s => s.entityType === entityType)?.strategy;

    switch (strategy) {
      case 'local-wins':
        return local;
      case 'server-wins':
        return server;
      case 'union-merge':
        return this.unionMerge(local, server);
      default:
        return local;
    }
  }

  private unionMerge<T extends Record<string, unknown>>(local: T, server: T): T {
    const result: Record<string, unknown> = { ...server };

    for (const [key, value] of Object.entries(local)) {
      if (Array.isArray(value) && Array.isArray(server[key])) {
        // Merge arrays as union set
        const serverArray = server[key] as unknown[];
        result[key] = Array.from(new Set([...value, ...serverArray]));
      } else if (!(key in server)) {
        // Field only in local
        result[key] = value;
      } else {
        // Prefer local for non-array fields
        result[key] = value;
      }
    }

    return result as T;
  }

  // ---- Feature availability matrix ----

  isAvailable(feature: string): boolean {
    const featureInfo = this.featureMatrix.find(f => f.feature === feature);
    if (!featureInfo) {
      return true; // Unknown features assumed available
    }

    if (featureInfo.availableOffline) {
      return true;
    }

    return this.status === 'online';
  }

  getUnavailableMessage(feature: string): string | null {
    const featureInfo = this.featureMatrix.find(f => f.feature === feature);
    if (!featureInfo) {
      return null;
    }

    if (featureInfo.availableOffline || this.status === 'online') {
      return null;
    }

    return featureInfo.degradedMessage ?? null;
  }

  // ---- Lifecycle ----

  async close(): Promise<void> {
    this.stopMonitoring();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: OfflineEngine | null = null;

export function getOfflineEngine(options?: ConstructorParameters<typeof OfflineEngine>[0]): OfflineEngine {
  if (!instance) {
    instance = new OfflineEngine(options);
  }
  return instance;
}

export function resetOfflineEngine(): void {
  instance = null;
}

export { OfflineEngine };
