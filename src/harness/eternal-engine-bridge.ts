// Eternal Engine Bridge - K3-27
// Persistence bridge: Rust FFI stub (primary) + SQLite fallback (secondary)
// Spec: .kiro/specs/agent-harnesses/tasks.md

import type { HarnessState } from './types.js';
import { HarnessSerializer } from './harness-serializer.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface PersistenceResult {
  success: boolean;
  backend: 'rust' | 'sqlite' | 'memory';
  error?: string;
}

export interface RestoreResult {
  state: HarnessState | null;
  backend: 'rust' | 'sqlite' | 'memory' | null;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Eternal Engine Bridge
// ═══════════════════════════════════════════════════════════════════════════════

export class EternalEngineBridge {
  private serializer: HarnessSerializer;
  private memoryStore = new Map<string, string>(); // In-memory fallback
  private sqliteAvailable = false;

  constructor() {
    this.serializer = new HarnessSerializer();
    // SQLite would be initialized here in production
    this.sqliteAvailable = false;
  }

  /**
   * Check if any persistence backend is available.
   */
  isAvailable(): boolean {
    return true; // Memory fallback is always available
  }

  /**
   * Persist a harness state.
   * Tries Rust FFI → SQLite → Memory in order.
   */
  async persist(state: HarnessState): Promise<PersistenceResult> {
    const serialized = this.serializer.serialize(state);
    const id = state.config.id;

    // 1. Try Rust FFI (stub — not available in Node)
    const rustResult = await this.tryRustPersist(id, serialized);
    if (rustResult.success) {
      return rustResult;
    }

    // 2. Try SQLite
    if (this.sqliteAvailable) {
      const sqliteResult = await this.trySQLitePersist(id, serialized);
      if (sqliteResult.success) {
        return sqliteResult;
      }
    }

    // 3. Memory fallback
    this.memoryStore.set(id, serialized);
    return { success: true, backend: 'memory' };
  }

  /**
   * Restore a harness state by ID.
   */
  async restore(id: string): Promise<RestoreResult> {
    // 1. Try Rust FFI
    const rustResult = await this.tryRustRestore(id);
    if (rustResult.state !== null) {
      return rustResult;
    }

    // 2. Try SQLite
    if (this.sqliteAvailable) {
      const sqliteResult = await this.trySQLiteRestore(id);
      if (sqliteResult.state !== null) {
        return sqliteResult;
      }
    }

    // 3. Memory fallback
    const serialized = this.memoryStore.get(id);
    if (serialized) {
      try {
        const state = this.serializer.deserialize(serialized);
        return { state, backend: 'memory' };
      } catch (err) {
        return { state: null, backend: null, error: String(err) };
      }
    }

    return { state: null, backend: null };
  }

  /**
   * Delete a persisted harness state by ID.
   */
  async delete(id: string): Promise<boolean> {
    let deleted = false;

    // Try Rust FFI
    const rustDeleted = await this.tryRustDelete(id);
    if (rustDeleted) deleted = true;

    // Try SQLite
    if (this.sqliteAvailable) {
      const sqliteDeleted = await this.trySQLiteDelete(id);
      if (sqliteDeleted) deleted = true;
    }

    // Memory fallback
    if (this.memoryStore.delete(id)) {
      deleted = true;
    }

    return deleted;
  }

  /**
   * List all persisted harness IDs.
   */
  async list(): Promise<string[]> {
    return Array.from(this.memoryStore.keys());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Rust FFI Stubs (unavailable in Node.js environment)
  // ═══════════════════════════════════════════════════════════════════════════

  private async tryRustPersist(
    _id: string,
    _serialized: string
  ): Promise<PersistenceResult> {
    // Rust FFI not available in Node.js — return unavailable
    return { success: false, backend: 'rust', error: 'Rust FFI not available' };
  }

  private async tryRustRestore(_id: string): Promise<RestoreResult> {
    return { state: null, backend: null, error: 'Rust FFI not available' };
  }

  private async tryRustDelete(_id: string): Promise<boolean> {
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SQLite Stubs (would use checkpoint-system.ts in production)
  // ═══════════════════════════════════════════════════════════════════════════

  private async trySQLitePersist(
    _id: string,
    _serialized: string
  ): Promise<PersistenceResult> {
    return { success: false, backend: 'sqlite', error: 'SQLite not initialized' };
  }

  private async trySQLiteRestore(_id: string): Promise<RestoreResult> {
    return { state: null, backend: null };
  }

  private async trySQLiteDelete(_id: string): Promise<boolean> {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createEternalEngineBridge(): EternalEngineBridge {
  return new EternalEngineBridge();
}
