// Build Snapshot — Advanced Error Recovery (R17-01)
// Snapshot and diff management for build state persistence

import { randomUUID } from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface BuildSnapshot {
  id: string;
  buildId: string;
  createdAt: string;
  files: Record<string, string>;        // path -> content hash
  dependencies: Record<string, string>;  // package -> version
  environmentHash: string;
  metadata: Record<string, string>;
}

export interface SnapshotConfig {
  snapshotDir: string;
  maxSnapshots: number;
  autoSnapshot: boolean;
  compressionEnabled: boolean;
}

export interface SnapshotDiff {
  added: string[];
  removed: string[];
  modified: string[];
  unchangedCount: number;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_SNAPSHOT_CONFIG: SnapshotConfig = {
  snapshotDir: '.nova/snapshots',
  maxSnapshots: 50,
  autoSnapshot: true,
  compressionEnabled: false,
};

// ============================================================================
// Simple Hash (sum of char codes mod large prime, hex)
// ============================================================================

export function simpleHash(input: string): string {
  const PRIME = 2147483647; // Largest 32-bit Mersenne prime
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash + input.charCodeAt(i)) % PRIME;
  }
  return hash.toString(16);
}

// ============================================================================
// BuildSnapshotManager
// ============================================================================

export class BuildSnapshotManager {
  private readonly config: SnapshotConfig;
  private readonly snapshots: Map<string, BuildSnapshot> = new Map();

  // Dependencies for file system operations (injected for testability)
  private readonly fsOps: {
    writeFile: (path: string, data: string) => void;
    readFile: (path: string) => string;
    listFiles: (dir: string) => string[];
    exists: (path: string) => boolean;
    mkdir: (path: string) => void;
    remove: (path: string) => void;
  };

  constructor(
    config?: Partial<SnapshotConfig>,
    fsOps?: {
      writeFile: (path: string, data: string) => void;
      readFile: (path: string) => string;
      listFiles: (dir: string) => string[];
      exists: (path: string) => boolean;
      mkdir: (path: string) => void;
      remove: (path: string) => void;
    },
  ) {
    this.config = { ...DEFAULT_SNAPSHOT_CONFIG, ...config };
    this.fsOps = fsOps ?? {
      writeFile: () => { /* no-op default */ },
      readFile: () => '{}',
      listFiles: () => [],
      exists: () => false,
      mkdir: () => { /* no-op default */ },
      remove: () => { /* no-op default */ },
    };
  }

  createSnapshot(
    buildId: string,
    files: Record<string, string>,
    dependencies: Record<string, string>,
    metadata?: Record<string, string>,
  ): BuildSnapshot {
    const id = randomUUID();
    const environmentHash = this.computeEnvironmentHash(dependencies);
    const snapshot: BuildSnapshot = {
      id,
      buildId,
      createdAt: new Date().toISOString(),
      files,
      dependencies,
      environmentHash,
      metadata: metadata ?? {},
    };

    this.snapshots.set(id, snapshot);

    // Persist to disk
    this.fsOps.mkdir(this.config.snapshotDir);
    const filePath = `${this.config.snapshotDir}/${id}.json`;
    this.fsOps.writeFile(filePath, JSON.stringify(snapshot, null, 2));

    return snapshot;
  }

  loadSnapshot(id: string): BuildSnapshot | null {
    // Check in-memory cache first
    const cached = this.snapshots.get(id);
    if (cached) return cached;

    // Try to load from disk
    const filePath = `${this.config.snapshotDir}/${id}.json`;
    if (!this.fsOps.exists(filePath)) return null;

    try {
      const content = this.fsOps.readFile(filePath);
      const snapshot: BuildSnapshot = JSON.parse(content);
      this.snapshots.set(id, snapshot);
      return snapshot;
    } catch {
      return null;
    }
  }

  getLatestSnapshot(buildId?: string): BuildSnapshot | null {
    const all = Array.from(this.snapshots.values());
    const filtered = buildId ? all.filter(s => s.buildId === buildId) : all;

    if (filtered.length === 0) return null;

    return filtered.reduce((latest, current) =>
      new Date(current.createdAt).getTime() > new Date(latest.createdAt).getTime()
        ? current
        : latest,
    );
  }

  listSnapshots(buildId?: string): BuildSnapshot[] {
    const all = Array.from(this.snapshots.values());
    const filtered = buildId ? all.filter(s => s.buildId === buildId) : all;
    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  compareSnapshots(a: BuildSnapshot, b: BuildSnapshot): SnapshotDiff {
    const aFiles = new Set(Object.keys(a.files));
    const bFiles = new Set(Object.keys(b.files));

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];
    let unchangedCount = 0;

    for (const file of bFiles) {
      if (!aFiles.has(file)) {
        added.push(file);
      } else if (a.files[file] !== b.files[file]) {
        modified.push(file);
      } else {
        unchangedCount++;
      }
    }

    for (const file of aFiles) {
      if (!bFiles.has(file)) {
        removed.push(file);
      }
    }

    return { added, removed, modified, unchangedCount };
  }

  pruneOldSnapshots(maxAge?: number): number {
    const maxSnapshots = this.config.maxSnapshots;
    const sorted = this.listSnapshots();
    let pruned = 0;

    // Prune by age if specified
    if (maxAge !== undefined) {
      const cutoff = Date.now() - maxAge;
      for (const snapshot of sorted) {
        if (new Date(snapshot.createdAt).getTime() < cutoff) {
          this.snapshots.delete(snapshot.id);
          const filePath = `${this.config.snapshotDir}/${snapshot.id}.json`;
          this.fsOps.remove(filePath);
          pruned++;
        }
      }
    }

    // Prune by count
    const remaining = this.listSnapshots();
    if (remaining.length > maxSnapshots) {
      const toRemove = remaining.slice(maxSnapshots);
      for (const snapshot of toRemove) {
        this.snapshots.delete(snapshot.id);
        const filePath = `${this.config.snapshotDir}/${snapshot.id}.json`;
        this.fsOps.remove(filePath);
        pruned++;
      }
    }

    return pruned;
  }

  computeEnvironmentHash(dependencies: Record<string, string>): string {
    const sorted = Object.entries(dependencies)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}@${v}`)
      .join('|');
    return simpleHash(sorted);
  }

  isCompatible(a: BuildSnapshot, b: BuildSnapshot): boolean {
    return a.environmentHash === b.environmentHash;
  }
}
