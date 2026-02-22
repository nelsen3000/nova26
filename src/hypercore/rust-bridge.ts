// Hypercore Rust Bridge — Spec Task 12.2 (Rust Eternal Engine Bridge)
// Sprint S3-08 | P2P Hypercore Protocol (Reel 1)
//
// TypeScript client that invokes Tauri commands for append, read, and length
// operations on the Rust Hypercore implementation.
//
// When the Tauri runtime is unavailable (tests, non-desktop environments),
// operations throw RustBridgeUnavailableError with a clear message.

// ─── Errors ───────────────────────────────────────────────────────────────────

export class RustBridgeUnavailableError extends Error {
  readonly code = 'RUST_BRIDGE_UNAVAILABLE';
  constructor(reason = 'Tauri runtime not available') {
    super(`RustHypercoreBridge: ${reason}`);
    this.name = 'RustBridgeUnavailableError';
  }
}

export class RustBridgeOperationError extends Error {
  readonly code = 'RUST_BRIDGE_OPERATION_FAILED';
  constructor(operation: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`RustHypercoreBridge.${operation} failed: ${msg}`);
    this.name = 'RustBridgeOperationError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RustAppendResult {
  seq: number;
  hash: string;  // hex-encoded SHA-256 of payload
}

export interface RustReadResult {
  seq: number;
  data: unknown;
  hash: string;
}

export interface RustBridgeStatus {
  available: boolean;
  version?: string;
  logName: string;
}

// ─── Tauri invoke shim ───────────────────────────────────────────────────────

/**
 * Resolve the Tauri invoke function if available in the current environment.
 * Returns null in Node.js / test / non-Tauri browser contexts.
 */
function getTauriInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null {
  // Tauri v2 exposes invoke via __TAURI_INTERNALS__ or window.__TAURI__
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (typeof w.__TAURI__?.core?.invoke === 'function') {
      return w.__TAURI__.core.invoke as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    }
    if (typeof w.__TAURI_INTERNALS__?.invoke === 'function') {
      return w.__TAURI_INTERNALS__.invoke as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    }
  }
  return null;
}

// ─── RustHypercoreBridge ─────────────────────────────────────────────────────

/**
 * RustHypercoreBridge — TypeScript client for the Tauri hypercore_bridge
 * Rust commands defined in `src-tauri/src/hypercore_bridge.rs`.
 *
 * Satisfies Spec Task 12.2:
 * - Invokes `hypercore_append`, `hypercore_read`, `hypercore_length` Tauri commands
 * - Degrades gracefully when Tauri is unavailable (throws RustBridgeUnavailableError)
 * - NanoClaw access control checked via `hypercore_check_access` command
 */
export class RustHypercoreBridge {
  private logName: string;

  constructor(logName: string) {
    this.logName = logName;
  }

  /**
   * Check if the Tauri runtime is available.
   */
  isAvailable(): boolean {
    return getTauriInvoke() !== null;
  }

  /**
   * Get bridge status.
   */
  async getStatus(): Promise<RustBridgeStatus> {
    const available = this.isAvailable();
    if (!available) {
      return { available: false, logName: this.logName };
    }
    try {
      const version = await this.invoke<string>('hypercore_version', {});
      return { available: true, version, logName: this.logName };
    } catch {
      return { available: false, logName: this.logName };
    }
  }

  /**
   * Append data to the Rust Hypercore log.
   * Throws RustBridgeUnavailableError when Tauri runtime is absent.
   */
  async append(data: unknown): Promise<RustAppendResult> {
    return this.invoke<RustAppendResult>('hypercore_append', {
      logName: this.logName,
      payload: JSON.stringify(data),
    });
  }

  /**
   * Read an entry by sequence number.
   * Throws RustBridgeUnavailableError when Tauri runtime is absent.
   */
  async read(seq: number): Promise<RustReadResult> {
    const result = await this.invoke<{ seq: number; payload: string; hash: string }>('hypercore_read', {
      logName: this.logName,
      seq,
    });
    return {
      seq: result.seq,
      data: JSON.parse(result.payload) as unknown,
      hash: result.hash,
    };
  }

  /**
   * Get the current log length.
   * Throws RustBridgeUnavailableError when Tauri runtime is absent.
   */
  async length(): Promise<number> {
    return this.invoke<number>('hypercore_length', {
      logName: this.logName,
    });
  }

  /**
   * NanoClaw access check — verifies isolation enforcement.
   * Returns true if the caller is allowed to access the log.
   */
  async checkAccess(peerId: string, operation: 'read' | 'write'): Promise<boolean> {
    return this.invoke<boolean>('hypercore_check_access', {
      logName: this.logName,
      peerId,
      operation,
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async invoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
    const invoke = getTauriInvoke();
    if (!invoke) {
      throw new RustBridgeUnavailableError();
    }
    try {
      return (await invoke(command, args)) as T;
    } catch (err) {
      throw new RustBridgeOperationError(command, err);
    }
  }
}
