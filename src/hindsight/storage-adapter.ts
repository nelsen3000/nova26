// Storage Adapter Interface - Hindsight Persistent Memory
// Spec: .kiro/specs/hindsight-persistent-memory/design.md

import type {
  MemoryFragment,
  FragmentFilter,
  ScoredFragment,
  StorageStats,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Storage Adapter Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface StorageAdapter {
  // Core operations
  write(fragment: MemoryFragment): Promise<void>;
  read(id: string): Promise<MemoryFragment | null>;
  bulkWrite(fragments: MemoryFragment[]): Promise<void>;
  bulkRead(ids: string[]): Promise<MemoryFragment[]>;
  delete(id: string): Promise<boolean>;

  // Query operations
  query(filter: FragmentFilter): Promise<MemoryFragment[]>;
  count(filter?: FragmentFilter): Promise<number>;

  // Vector search
  searchByVector(
    embedding: number[],
    topK: number,
    filter?: FragmentFilter
  ): Promise<ScoredFragment[]>;

  // Export/Import
  exportAll(): Promise<MemoryFragment[]>;
  importAll(fragments: MemoryFragment[]): Promise<number>;

  // Health
  isAvailable(): Promise<boolean>;
  getStats(): Promise<StorageStats>;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Storage Adapter Factory
// ═══════════════════════════════════════════════════════════════════════════════

export type StorageAdapterType = 'sqlite' | 'convex' | 'memory';

export interface StorageAdapterConfig {
  type: StorageAdapterType;
  path?: string; // For SQLite
}

export async function createStorageAdapter(
  config: StorageAdapterConfig
): Promise<StorageAdapter> {
  switch (config.type) {
    case 'memory':
      const { MemoryStorageAdapter } = await import('./memory-adapter.js');
      return new MemoryStorageAdapter();
    case 'sqlite':
      // Try to load SQLite adapter, fall back to memory if unavailable
      try {
        const { SQLiteStorageAdapter } = await import('./sqlite-adapter.js');
        return new SQLiteStorageAdapter(config.path || ':memory:');
      } catch {
        console.warn('SQLite adapter not available, falling back to memory');
        const { MemoryStorageAdapter } = await import('./memory-adapter.js');
        return new MemoryStorageAdapter();
      }
    case 'convex':
      throw new Error('Convex adapter not yet implemented');
    default:
      throw new Error(`Unknown storage adapter type: ${config.type}`);
  }
}
