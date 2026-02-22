// Hypervisor Edge/Cloud Deployment — Spec Task 13
// Sprint S3-13 | Hypervisor Hypercore Integration (Reel 2)
//
// Remote VM provisioning for edge and cloud targets.
// Offline queuing via OfflineQueue pattern.

import type { VMSpec } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeploymentTarget {
  id: string;
  host: string;
  port?: number;
  region?: string;
  provider?: 'firecracker' | 'qemu' | 'docker';
}

export interface TargetValidation {
  reachable: boolean;
  halAvailable: boolean;
  target: DeploymentTarget;
  error?: string;
}

export interface TargetResourceMetrics {
  targetId: string;
  cpuMillicoresAvailable: number;
  memoryMbAvailable: number;
  diskMbAvailable: number;
  activeVMs: number;
  measuredAt: number;
}

export interface RemoteProvisionResult {
  vmId: string;
  targetId: string;
  status: 'running' | 'error';
  error?: string;
}

export interface QueuedRemoteOp {
  id: string;
  targetId: string;
  spec: VMSpec;
  queuedAt: number;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class TargetUnreachableError extends Error {
  readonly code = 'TARGET_UNREACHABLE';
  constructor(targetId: string) {
    super(`Remote target '${targetId}' is unreachable`);
    this.name = 'TargetUnreachableError';
  }
}

export class HALNotAvailableError extends Error {
  readonly code = 'HAL_NOT_AVAILABLE';
  constructor(targetId: string) {
    super(`Hypercore HAL binary not available on target '${targetId}'`);
    this.name = 'HALNotAvailableError';
  }
}

// ─── EdgeDeployer ─────────────────────────────────────────────────────────────

/**
 * EdgeDeployer — provisions VMs on remote edge/cloud targets.
 *
 * Satisfies Spec Task 13.1:
 * - validateTarget: check connectivity and HAL availability
 * - provisionRemote: transfer config and spawn remote VM
 * - getTargetMetrics: resource metrics for a target
 * - Offline queuing: ops queued when target unreachable, retried on reconnect
 */
export class EdgeDeployer {
  private offlineQueue: QueuedRemoteOp[] = [];
  private opIdCounter = 0;

  // Target reachability is injected for testability
  private reachabilityChecker: (target: DeploymentTarget) => Promise<boolean>;
  private halChecker: (target: DeploymentTarget) => Promise<boolean>;
  private remoteSpawner: (target: DeploymentTarget, spec: VMSpec) => Promise<string>;
  private metricsProvider: (target: DeploymentTarget) => Promise<TargetResourceMetrics>;

  constructor(opts: {
    reachabilityChecker?: (t: DeploymentTarget) => Promise<boolean>;
    halChecker?: (t: DeploymentTarget) => Promise<boolean>;
    remoteSpawner?: (t: DeploymentTarget, spec: VMSpec) => Promise<string>;
    metricsProvider?: (t: DeploymentTarget) => Promise<TargetResourceMetrics>;
  } = {}) {
    this.reachabilityChecker = opts.reachabilityChecker ?? (() => Promise.resolve(false));
    this.halChecker = opts.halChecker ?? (() => Promise.resolve(false));
    this.remoteSpawner = opts.remoteSpawner ?? (() => Promise.resolve(`remote-vm-${Date.now()}`));
    this.metricsProvider = opts.metricsProvider ?? ((t) => Promise.resolve({
      targetId: t.id, cpuMillicoresAvailable: 0, memoryMbAvailable: 0,
      diskMbAvailable: 0, activeVMs: 0, measuredAt: Date.now(),
    }));
  }

  /**
   * Validate a remote target: check connectivity and HAL availability.
   */
  async validateTarget(target: DeploymentTarget): Promise<TargetValidation> {
    try {
      const reachable = await this.reachabilityChecker(target);
      if (!reachable) {
        return { reachable: false, halAvailable: false, target, error: 'Target unreachable' };
      }
      const halAvailable = await this.halChecker(target);
      return { reachable, halAvailable, target, error: halAvailable ? undefined : 'HAL binary not found' };
    } catch (err) {
      return {
        reachable: false,
        halAvailable: false,
        target,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Provision a VM on a remote target.
   * If unreachable, queues the operation for retry.
   */
  async provisionRemote(target: DeploymentTarget, spec: VMSpec): Promise<RemoteProvisionResult> {
    const validation = await this.validateTarget(target);

    if (!validation.reachable) {
      // Queue for offline retry
      this.offlineQueue.push({
        id: `op-${++this.opIdCounter}`,
        targetId: target.id,
        spec,
        queuedAt: Date.now(),
      });
      return { vmId: '', targetId: target.id, status: 'error', error: 'Queued: target unreachable' };
    }

    if (!validation.halAvailable) {
      throw new HALNotAvailableError(target.id);
    }

    const vmId = await this.remoteSpawner(target, spec);
    return { vmId, targetId: target.id, status: 'running' };
  }

  /**
   * Get resource metrics for a remote target.
   */
  async getTargetMetrics(target: DeploymentTarget): Promise<TargetResourceMetrics> {
    return this.metricsProvider(target);
  }

  /**
   * Retry all queued operations for a target (called when target comes back online).
   */
  async retryQueued(target: DeploymentTarget): Promise<{ retried: number; failed: number }> {
    const opsForTarget = this.offlineQueue.filter(op => op.targetId === target.id);
    const remaining: QueuedRemoteOp[] = [];
    let retried = 0;
    let failed = 0;

    for (const op of this.offlineQueue) {
      if (op.targetId !== target.id) {
        remaining.push(op);
        continue;
      }
      try {
        await this.remoteSpawner(target, op.spec);
        retried++;
      } catch {
        failed++;
        remaining.push(op);
      }
    }

    this.offlineQueue = remaining;
    void opsForTarget; // suppress unused warning
    return { retried, failed };
  }

  /**
   * Get pending offline operations count.
   */
  queueSize(): number {
    return this.offlineQueue.length;
  }

  /**
   * Get all queued operations (read-only).
   */
  getQueue(): ReadonlyArray<QueuedRemoteOp> {
    return this.offlineQueue;
  }
}
