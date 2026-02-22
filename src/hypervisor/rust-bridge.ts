// Hypervisor Rust Bridge — Spec Task 14
// Sprint S3-13 | Hypervisor Hypercore Integration (Reel 2)
//
// TypeScript client for the Tauri hypervisor_bridge Rust commands.
// Degrades gracefully when Tauri runtime is unavailable.

import type { VMSpec, VMInstance, VMState } from './types.js';

// ─── Errors ───────────────────────────────────────────────────────────────────

export class HypervisorBridgeUnavailableError extends Error {
  readonly code = 'HYPERVISOR_BRIDGE_UNAVAILABLE';
  constructor(reason = 'Tauri runtime not available') {
    super(`RustHypervisorBridge: ${reason}`);
    this.name = 'HypervisorBridgeUnavailableError';
  }
}

export class HypervisorBridgeOperationError extends Error {
  readonly code = 'HYPERVISOR_BRIDGE_OPERATION_FAILED';
  constructor(command: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`RustHypervisorBridge.${command} failed: ${msg}`);
    this.name = 'HypervisorBridgeOperationError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RustSpawnResult {
  vmId: string;
  state: VMState;
}

export interface HypervisorBridgeStatus {
  available: boolean;
  version?: string;
}

// ─── Tauri invoke shim ────────────────────────────────────────────────────────

function getTauriInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null {
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

// ─── RustHypervisorBridge ─────────────────────────────────────────────────────

/**
 * RustHypervisorBridge — TypeScript client for `src-tauri/src/hypervisor_bridge.rs`.
 *
 * Satisfies Spec Task 14:
 * - hypervisor_spawn, hypervisor_terminate, hypervisor_status, hypervisor_list
 * - NanoClawHypervisorScope isolation enforcement via hypervisor_check_scope
 */
export class RustHypervisorBridge {
  isAvailable(): boolean {
    return getTauriInvoke() !== null;
  }

  async getStatus(): Promise<HypervisorBridgeStatus> {
    const available = this.isAvailable();
    if (!available) return { available: false };
    try {
      const version = await this.invoke<string>('hypervisor_version', {});
      return { available: true, version };
    } catch {
      return { available: false };
    }
  }

  /**
   * Spawn a VM via the Rust bridge.
   * Throws HypervisorBridgeUnavailableError when Tauri not present.
   */
  async spawn(spec: VMSpec): Promise<RustSpawnResult> {
    return this.invoke<RustSpawnResult>('hypervisor_spawn', { spec: JSON.stringify(spec) });
  }

  /**
   * Terminate a VM via the Rust bridge.
   */
  async terminate(vmId: string): Promise<void> {
    await this.invoke<void>('hypervisor_terminate', { vmId });
  }

  /**
   * Get VM status via the Rust bridge.
   */
  async getVMStatus(vmId: string): Promise<VMInstance> {
    return this.invoke<VMInstance>('hypervisor_status', { vmId });
  }

  /**
   * List all VMs via the Rust bridge.
   */
  async listVMs(): Promise<VMInstance[]> {
    return this.invoke<VMInstance[]>('hypervisor_list', {});
  }

  /**
   * NanoClaw scope check — enforce isolation boundaries.
   */
  async checkScope(vmId: string, operation: string): Promise<boolean> {
    return this.invoke<boolean>('hypervisor_check_scope', { vmId, operation });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async invoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
    const invoke = getTauriInvoke();
    if (!invoke) {
      throw new HypervisorBridgeUnavailableError();
    }
    try {
      return (await invoke(command, args)) as T;
    } catch (err) {
      throw new HypervisorBridgeOperationError(command, err);
    }
  }
}
