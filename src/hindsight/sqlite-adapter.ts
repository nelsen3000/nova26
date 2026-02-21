// SQLite Storage Adapter - SQLite + sqlite-vec implementation
// Spec: .kiro/specs/hindsight-persistent-memory/design.md
// Note: This is a stub that throws if sqlite-vec is not available

import type {
  MemoryFragment,
  FragmentFilter,
  ScoredFragment,
  StorageStats,
} from './types.js';
import type { StorageAdapter } from './storage-adapter.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SQLite Storage Adapter Stub
// ═══════════════════════════════════════════════════════════════════════════════

export class SQLiteStorageAdapter implements StorageAdapter {
  private path: string;

  constructor(path: string) {
    this.path = path;
    throw new Error(
      'SQLite adapter requires better-sqlite3 and sqlite-vec packages. ' +
      'Please install: npm install better-sqlite3 sqlite-vec\n' +
      'Falling back to MemoryStorageAdapter.'
    );
  }

  async initialize(): Promise<void> {
    throw new Error('Not implemented');
  }

  async close(): Promise<void> {
    throw new Error('Not implemented');
  }

  async write(_fragment: MemoryFragment): Promise<void> {
    throw new Error('Not implemented');
  }

  async read(_id: string): Promise<MemoryFragment | null> {
    throw new Error('Not implemented');
  }

  async bulkWrite(_fragments: MemoryFragment[]): Promise<void> {
    throw new Error('Not implemented');
  }

  async bulkRead(_ids: string[]): Promise<MemoryFragment[]> {
    throw new Error('Not implemented');
  }

  async delete(_id: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async query(_filter: FragmentFilter): Promise<MemoryFragment[]> {
    throw new Error('Not implemented');
  }

  async count(_filter?: FragmentFilter): Promise<number> {
    throw new Error('Not implemented');
  }

  async searchByVector(
    _embedding: number[],
    _topK: number,
    _filter?: FragmentFilter
  ): Promise<ScoredFragment[]> {
    throw new Error('Not implemented');
  }

  async exportAll(): Promise<MemoryFragment[]> {
    throw new Error('Not implemented');
  }

  async importAll(_fragments: MemoryFragment[]): Promise<number> {
    throw new Error('Not implemented');
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async getStats(): Promise<StorageStats> {
    throw new Error('Not implemented');
  }
}
