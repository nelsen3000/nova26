// Hypervisor Observability — Observer subscribing to SandboxManager events
// Sprint S2-17 | Hypervisor Integration (Reel 2)

import { EventEmitter } from 'node:events';
import type {
  HypervisorAuditEvent,
  AggregateHypervisorMetrics,
  SecurityMetrics,
  VMInstance,
} from './types.js';
import { HypervisorAuditEventSchema } from './types.js';
import type { SandboxManager } from './sandbox-manager.js';

export type HypervisorObserverListener = (event: HypervisorAuditEvent) => void;

export interface ObserverConfig {
  maxEvents?: number;
  healthWarningThreshold?: number;
  healthWarningWindowMs?: number;
}

/**
 * HypervisorObserver — subscribes to SandboxManager events and builds
 * structured audit logs, metrics, and security telemetry.
 *
 * Attach to a SandboxManager via `attach(manager)` and detach via `detach()`.
 */
export class HypervisorObserver extends EventEmitter {
  private events: HypervisorAuditEvent[] = [];
  private maxEvents: number;
  private healthWarningThreshold: number;
  private healthWarningWindowMs: number;

  private metrics: AggregateHypervisorMetrics = {
    totalVMsSpawned: 0,
    totalVMsTerminated: 0,
    currentlyRunning: 0,
    totalTasksExecuted: 0,
    totalErrors: 0,
    avgTaskDurationMs: 0,
    providerBreakdown: {},
  };

  private securityMetrics: SecurityMetrics = {
    policyViolations: 0,
    imageVerificationFailures: 0,
    unauthorizedAccessAttempts: 0,
    sandboxEscapeAttempts: 0,
  };

  private taskDurations: number[] = [];
  private attachedManager: SandboxManager | null = null;
  private cleanupFns: Array<() => void> = [];

  constructor(config: ObserverConfig = {}) {
    super();
    this.maxEvents = config.maxEvents ?? 1000;
    this.healthWarningThreshold = config.healthWarningThreshold ?? 5;
    this.healthWarningWindowMs = config.healthWarningWindowMs ?? 60_000;
  }

  /**
   * Attach to a SandboxManager and subscribe to all its events.
   */
  attach(manager: SandboxManager): void {
    if (this.attachedManager) this.detach();
    this.attachedManager = manager;

    const onSpawned = (vm: VMInstance) => {
      this.recordEvent({
        eventType: 'vm-spawned',
        vmId: vm.vmId,
        agentId: vm.spec.agentId,
        details: { provider: vm.spec.provider, image: vm.spec.image },
        severity: 'info',
      });
      this.metrics.totalVMsSpawned++;
      this.metrics.currentlyRunning++;
      const provider = vm.spec.provider;
      this.metrics.providerBreakdown[provider] = (this.metrics.providerBreakdown[provider] ?? 0) + 1;
    };

    // vm-terminated emits (vmId: string, state: VMState)
    const onTerminated = (vmId: string) => {
      this.recordEvent({
        eventType: 'vm-terminated',
        vmId,
        details: {},
        severity: 'info',
      });
      this.metrics.totalVMsTerminated++;
      this.metrics.currentlyRunning = Math.max(0, this.metrics.currentlyRunning - 1);
    };

    // vm-state-change emits (vmId: string, prev: VMState, next: VMState)
    const onStateChange = (vmId: string, prev: string, next: string) => {
      this.recordEvent({
        eventType: 'vm-state-change',
        vmId,
        details: { from: prev, to: next },
        severity: 'info',
      });
    };

    // security-violation emits (vmId: string, reason: string)
    const onSecurityViolation = (vmId: string, reason: string) => {
      this.recordEvent({
        eventType: 'security-violation',
        vmId,
        details: { reason },
        severity: 'error',
      });
      this.securityMetrics.policyViolations++;
      this.checkHealthWarning();
    };

    // error emits (err: Error, vmId?: string)
    const onError = (err: Error, vmId?: string) => {
      this.recordEvent({
        eventType: 'error',
        vmId,
        details: { message: err.message },
        severity: 'error',
      });
      this.metrics.totalErrors++;
    };

    manager.on('vm-spawned', onSpawned);
    manager.on('vm-terminated', onTerminated);
    manager.on('vm-state-change', onStateChange);
    manager.on('security-violation', onSecurityViolation);
    manager.on('error', onError);

    this.cleanupFns = [
      () => manager.off('vm-spawned', onSpawned),
      () => manager.off('vm-terminated', onTerminated),
      () => manager.off('vm-state-change', onStateChange),
      () => manager.off('security-violation', onSecurityViolation),
      () => manager.off('error', onError),
    ];
  }

  /**
   * Detach from the current SandboxManager.
   */
  detach(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    this.attachedManager = null;
  }

  /**
   * Record an audit event manually (e.g. from external sources).
   */
  recordEvent(raw: Omit<HypervisorAuditEvent, 'timestamp'> & { timestamp?: number }): void {
    const event = HypervisorAuditEventSchema.parse({ timestamp: Date.now(), ...raw });
    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.shift();
    this.emit('event', event);
  }

  /**
   * Get current metrics snapshot.
   */
  getMetrics(): AggregateHypervisorMetrics {
    return { ...this.metrics, providerBreakdown: { ...this.metrics.providerBreakdown } };
  }

  /**
   * Get security metrics snapshot.
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.securityMetrics };
  }

  /**
   * Get recent events (most recent first).
   */
  getRecentEvents(limit = 50): HypervisorAuditEvent[] {
    return [...this.events].reverse().slice(0, limit);
  }

  /**
   * Subscribe to audit events.
   */
  onEvent(listener: HypervisorObserverListener): () => void {
    this.on('event', listener);
    return () => this.off('event', listener);
  }

  /**
   * Check if the observer is healthy (no excess errors in recent window).
   */
  isHealthy(): boolean {
    const windowStart = Date.now() - this.healthWarningWindowMs;
    const recentErrors = this.events.filter(
      e => e.timestamp >= windowStart && (e.eventType === 'error' || e.eventType === 'security-violation'),
    ).length;
    return recentErrors < this.healthWarningThreshold;
  }

  /**
   * Reset all state (for testing).
   */
  resetMetrics(): void {
    this.events = [];
    this.taskDurations = [];
    this.metrics = {
      totalVMsSpawned: 0,
      totalVMsTerminated: 0,
      currentlyRunning: 0,
      totalTasksExecuted: 0,
      totalErrors: 0,
      avgTaskDurationMs: 0,
      providerBreakdown: {},
    };
    this.securityMetrics = {
      policyViolations: 0,
      imageVerificationFailures: 0,
      unauthorizedAccessAttempts: 0,
      sandboxEscapeAttempts: 0,
    };
  }

  private checkHealthWarning(): void {
    if (!this.isHealthy()) {
      this.recordEvent({
        eventType: 'health-warning',
        details: { message: 'Exceeded error threshold in health window' },
        severity: 'warn',
      });
    }
  }
}
