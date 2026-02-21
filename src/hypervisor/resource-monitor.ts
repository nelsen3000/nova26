// Hypervisor Resource Monitor — CPU/memory/disk tracking and threshold alerting
// Sprint S2-15 | Hypervisor Integration (Reel 2)

import { z } from 'zod';

// ─── Snapshot types ───────────────────────────────────────────────────────────

export const ResourceSnapshotSchema = z.object({
  vmId: z.string(),
  timestamp: z.number(),
  cpuMillicores: z.number().nonnegative(),
  memoryMb: z.number().nonnegative(),
  diskMb: z.number().nonnegative(),
  networkRxKbps: z.number().nonnegative().default(0),
  networkTxKbps: z.number().nonnegative().default(0),
});
export type ResourceSnapshot = z.infer<typeof ResourceSnapshotSchema>;

export const ResourceThresholdSchema = z.object({
  vmId: z.string(),
  cpuMillicores: z.number().positive().optional(),
  memoryMb: z.number().positive().optional(),
  diskMb: z.number().positive().optional(),
  networkRxKbps: z.number().positive().optional(),
  networkTxKbps: z.number().positive().optional(),
});
export type ResourceThreshold = z.infer<typeof ResourceThresholdSchema>;

export const ResourceAlertSchema = z.object({
  vmId: z.string(),
  resource: z.enum(['cpuMillicores', 'memoryMb', 'diskMb', 'networkRxKbps', 'networkTxKbps']),
  currentValue: z.number(),
  threshold: z.number(),
  percentUsed: z.number(),
  timestamp: z.number(),
  severity: z.enum(['warning', 'critical']),
});
export type ResourceAlert = z.infer<typeof ResourceAlertSchema>;

export const ResourceUsageSummarySchema = z.object({
  vmId: z.string(),
  latest: ResourceSnapshotSchema.nullable(),
  avg: z.object({
    cpuMillicores: z.number(),
    memoryMb: z.number(),
    diskMb: z.number(),
    networkRxKbps: z.number(),
    networkTxKbps: z.number(),
  }),
  peak: z.object({
    cpuMillicores: z.number(),
    memoryMb: z.number(),
    diskMb: z.number(),
    networkRxKbps: z.number(),
    networkTxKbps: z.number(),
  }),
  snapshotCount: z.number(),
});
export type ResourceUsageSummary = z.infer<typeof ResourceUsageSummarySchema>;

// ─── ResourceMonitor ──────────────────────────────────────────────────────────

/**
 * ResourceMonitor — records resource snapshots per VM and fires alerts.
 * Pure in-memory, no real cgroup/proc polling.
 */
export class ResourceMonitor {
  private snapshots = new Map<string, ResourceSnapshot[]>();
  private thresholds = new Map<string, ResourceThreshold>();
  private alerts: ResourceAlert[] = [];
  private maxSnapshotsPerVM: number;
  private maxAlerts: number;
  private alertListeners: Array<(alert: ResourceAlert) => void> = [];

  // Warning fires at 80%, critical at 95%
  private readonly WARNING_THRESHOLD = 0.80;
  private readonly CRITICAL_THRESHOLD = 0.95;

  constructor(options: { maxSnapshotsPerVM?: number; maxAlerts?: number } = {}) {
    this.maxSnapshotsPerVM = options.maxSnapshotsPerVM ?? 1000;
    this.maxAlerts = options.maxAlerts ?? 2000;
  }

  /**
   * Record a resource snapshot for a VM. Automatically checks thresholds.
   */
  recordSnapshot(snapshot: Omit<ResourceSnapshot, 'timestamp'> & { timestamp?: number }): void {
    const full = ResourceSnapshotSchema.parse({ timestamp: Date.now(), ...snapshot });
    if (!this.snapshots.has(full.vmId)) this.snapshots.set(full.vmId, []);
    const arr = this.snapshots.get(full.vmId)!;
    arr.push(full);
    if (arr.length > this.maxSnapshotsPerVM) arr.shift();
    this.checkThresholds(full);
  }

  /**
   * Set resource thresholds for a VM (overrides existing thresholds).
   */
  setThreshold(threshold: ResourceThreshold): void {
    this.thresholds.set(threshold.vmId, ResourceThresholdSchema.parse(threshold));
  }

  /**
   * Get the threshold config for a VM.
   */
  getThreshold(vmId: string): ResourceThreshold | undefined {
    return this.thresholds.get(vmId);
  }

  /**
   * Get usage summary (latest, average, peak) for a VM.
   */
  getUsage(vmId: string): ResourceUsageSummary {
    const snaps = this.snapshots.get(vmId) ?? [];
    const latest = snaps.length > 0 ? snaps[snaps.length - 1] : null;
    const resources: Array<keyof Omit<ResourceSnapshot, 'vmId' | 'timestamp'>> = [
      'cpuMillicores', 'memoryMb', 'diskMb', 'networkRxKbps', 'networkTxKbps',
    ];

    const avg: Record<string, number> = {};
    const peak: Record<string, number> = {};
    for (const r of resources) {
      avg[r] = snaps.length > 0 ? snaps.reduce((s, x) => s + x[r], 0) / snaps.length : 0;
      peak[r] = snaps.length > 0 ? Math.max(...snaps.map(x => x[r])) : 0;
    }

    return ResourceUsageSummarySchema.parse({
      vmId,
      latest,
      avg,
      peak,
      snapshotCount: snaps.length,
    });
  }

  /**
   * Get usage for all tracked VMs.
   */
  getAllUsage(): ResourceUsageSummary[] {
    return [...this.snapshots.keys()].map(vmId => this.getUsage(vmId));
  }

  /**
   * Get recent raw snapshots for a VM.
   */
  getSnapshots(vmId: string, limit = 100): ResourceSnapshot[] {
    const snaps = this.snapshots.get(vmId) ?? [];
    return snaps.slice(-limit);
  }

  /**
   * Get recent alerts (most recent first).
   */
  getAlerts(vmId?: string, limit = 50): ResourceAlert[] {
    const filtered = vmId
      ? this.alerts.filter(a => a.vmId === vmId)
      : this.alerts;
    return [...filtered].reverse().slice(0, limit);
  }

  /**
   * Subscribe to resource alerts.
   */
  onAlert(listener: (alert: ResourceAlert) => void): () => void {
    this.alertListeners.push(listener);
    return () => {
      this.alertListeners = this.alertListeners.filter(l => l !== listener);
    };
  }

  /**
   * Remove a VM's snapshots and threshold (called on VM termination).
   */
  removeVM(vmId: string): void {
    this.snapshots.delete(vmId);
    this.thresholds.delete(vmId);
  }

  /**
   * Get aggregated metrics across all VMs.
   */
  getAggregatedMetrics(): {
    vmCount: number;
    totalCpuMillicores: number;
    totalMemoryMb: number;
    totalDiskMb: number;
    totalAlerts: number;
  } {
    let totalCpu = 0, totalMem = 0, totalDisk = 0;
    for (const vmId of this.snapshots.keys()) {
      const summary = this.getUsage(vmId);
      if (summary.latest) {
        totalCpu += summary.latest.cpuMillicores;
        totalMem += summary.latest.memoryMb;
        totalDisk += summary.latest.diskMb;
      }
    }
    return {
      vmCount: this.snapshots.size,
      totalCpuMillicores: totalCpu,
      totalMemoryMb: totalMem,
      totalDiskMb: totalDisk,
      totalAlerts: this.alerts.length,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset(): void {
    this.snapshots.clear();
    this.thresholds.clear();
    this.alerts = [];
    this.alertListeners = [];
  }

  private checkThresholds(snapshot: ResourceSnapshot): void {
    const threshold = this.thresholds.get(snapshot.vmId);
    if (!threshold) return;

    const resources: Array<keyof Omit<ResourceSnapshot, 'vmId' | 'timestamp'>> = [
      'cpuMillicores', 'memoryMb', 'diskMb', 'networkRxKbps', 'networkTxKbps',
    ];

    for (const resource of resources) {
      const limit = threshold[resource];
      if (limit === undefined) continue;
      const current = snapshot[resource];
      const ratio = current / limit;

      if (ratio >= this.WARNING_THRESHOLD) {
        const alert = ResourceAlertSchema.parse({
          vmId: snapshot.vmId,
          resource,
          currentValue: current,
          threshold: limit,
          percentUsed: Math.round(ratio * 100),
          timestamp: snapshot.timestamp,
          severity: ratio >= this.CRITICAL_THRESHOLD ? 'critical' : 'warning',
        });
        this.alerts.push(alert);
        if (this.alerts.length > this.maxAlerts) this.alerts.shift();
        for (const listener of this.alertListeners) listener(alert);
      }
    }
  }
}
