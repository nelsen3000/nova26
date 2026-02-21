// Hypervisor Process Isolation — Namespace and capability management per VM
// Sprint S2-13 | Hypervisor Integration (Reel 2)

import { z } from 'zod';
import type { IsolationLevel, VMState } from './types.js';

// ─── Isolation Context ────────────────────────────────────────────────────────

export const LinuxCapabilitySchema = z.enum([
  'CAP_CHOWN', 'CAP_DAC_OVERRIDE', 'CAP_FSETID', 'CAP_FOWNER',
  'CAP_MKNOD', 'CAP_NET_RAW', 'CAP_SETGID', 'CAP_SETUID',
  'CAP_SETFCAP', 'CAP_SETPCAP', 'CAP_NET_BIND_SERVICE',
  'CAP_SYS_CHROOT', 'CAP_KILL', 'CAP_AUDIT_WRITE',
]);
export type LinuxCapability = z.infer<typeof LinuxCapabilitySchema>;

export const NamespaceTypeSchema = z.enum(['pid', 'net', 'ipc', 'mnt', 'uts', 'user', 'cgroup']);
export type NamespaceType = z.infer<typeof NamespaceTypeSchema>;

export const IsolationContextSchema = z.object({
  vmId: z.string(),
  isolationLevel: z.enum(['none', 'process', 'namespace', 'vm', 'ultra']),
  namespaces: z.array(NamespaceTypeSchema).default([]),
  capabilities: z.array(LinuxCapabilitySchema).default([]),
  cgroupPath: z.string().optional(),
  pidNamespaceId: z.string().optional(),
  netNamespaceId: z.string().optional(),
  createdAt: z.number(),
  state: z.enum(['active', 'suspended', 'destroyed']),
});
export type IsolationContext = z.infer<typeof IsolationContextSchema>;

export const IsolationViolationSchema = z.object({
  vmId: z.string(),
  capability: z.string(),
  reason: z.string(),
  timestamp: z.number(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});
export type IsolationViolation = z.infer<typeof IsolationViolationSchema>;

// ─── Default namespace sets per isolation level ───────────────────────────────

const ISOLATION_NAMESPACES: Record<IsolationLevel, NamespaceType[]> = {
  none: [],
  process: ['pid'],
  namespace: ['pid', 'net', 'ipc', 'mnt', 'uts'],
  vm: ['pid', 'net', 'ipc', 'mnt', 'uts', 'user', 'cgroup'],
  ultra: ['pid', 'net', 'ipc', 'mnt', 'uts', 'user', 'cgroup'],
};

const ISOLATION_CAPABILITIES: Record<IsolationLevel, LinuxCapability[]> = {
  none: [
    'CAP_CHOWN', 'CAP_DAC_OVERRIDE', 'CAP_FSETID', 'CAP_FOWNER',
    'CAP_MKNOD', 'CAP_NET_RAW', 'CAP_SETGID', 'CAP_SETUID',
    'CAP_NET_BIND_SERVICE', 'CAP_KILL', 'CAP_AUDIT_WRITE',
  ],
  process: [
    'CAP_CHOWN', 'CAP_FSETID', 'CAP_FOWNER', 'CAP_SETGID', 'CAP_SETUID',
    'CAP_NET_BIND_SERVICE', 'CAP_KILL',
  ],
  namespace: ['CAP_CHOWN', 'CAP_FSETID', 'CAP_FOWNER', 'CAP_NET_BIND_SERVICE'],
  vm: ['CAP_NET_BIND_SERVICE'],
  ultra: [],
};

/**
 * ProcessIsolationManager — manages namespaces and capabilities per VM.
 * Pure in-memory simulation for test compatibility (no real syscalls).
 */
export class ProcessIsolationManager {
  private contexts = new Map<string, IsolationContext>();
  private violations: IsolationViolation[] = [];
  private maxViolations: number;
  private violationListeners: Array<(v: IsolationViolation) => void> = [];

  constructor(maxViolations = 1000) {
    this.maxViolations = maxViolations;
  }

  /**
   * Create an isolation context for a VM. Idempotent — returns existing if already created.
   */
  createContext(vmId: string, isolationLevel: IsolationLevel): IsolationContext {
    if (this.contexts.has(vmId)) {
      return this.contexts.get(vmId)!;
    }

    const context = IsolationContextSchema.parse({
      vmId,
      isolationLevel,
      namespaces: ISOLATION_NAMESPACES[isolationLevel],
      capabilities: ISOLATION_CAPABILITIES[isolationLevel],
      cgroupPath: `/sys/fs/cgroup/nova26/${vmId}`,
      pidNamespaceId: `pid-ns-${vmId}`,
      netNamespaceId: isolationLevel !== 'none' ? `net-ns-${vmId}` : undefined,
      createdAt: Date.now(),
      state: 'active',
    });

    this.contexts.set(vmId, context);
    return context;
  }

  /**
   * Destroy an isolation context and release all namespaces.
   */
  destroyContext(vmId: string): boolean {
    const ctx = this.contexts.get(vmId);
    if (!ctx) return false;
    const updated = { ...ctx, state: 'destroyed' as const };
    this.contexts.set(vmId, updated);
    // Clean up after marking destroyed
    this.contexts.delete(vmId);
    return true;
  }

  /**
   * Suspend an isolation context (pause namespace activity).
   */
  suspendContext(vmId: string): boolean {
    const ctx = this.contexts.get(vmId);
    if (!ctx || ctx.state !== 'active') return false;
    this.contexts.set(vmId, { ...ctx, state: 'suspended' });
    return true;
  }

  /**
   * Resume a suspended isolation context.
   */
  resumeContext(vmId: string): boolean {
    const ctx = this.contexts.get(vmId);
    if (!ctx || ctx.state !== 'suspended') return false;
    this.contexts.set(vmId, { ...ctx, state: 'active' });
    return true;
  }

  /**
   * Get the isolation context for a VM. Returns undefined if not found.
   */
  getContext(vmId: string): IsolationContext | undefined {
    return this.contexts.get(vmId);
  }

  /**
   * Check if a VM has a given capability.
   */
  hasCapability(vmId: string, capability: LinuxCapability): boolean {
    const ctx = this.contexts.get(vmId);
    if (!ctx || ctx.state !== 'active') return false;
    return ctx.capabilities.includes(capability);
  }

  /**
   * Check if a VM has a given namespace.
   */
  hasNamespace(vmId: string, namespace: NamespaceType): boolean {
    const ctx = this.contexts.get(vmId);
    if (!ctx || ctx.state !== 'active') return false;
    return ctx.namespaces.includes(namespace);
  }

  /**
   * Enforce a capability check — logs violation if denied.
   */
  enforceCapability(
    vmId: string,
    capability: LinuxCapability,
    reason: string,
  ): boolean {
    if (this.hasCapability(vmId, capability)) return true;

    const ctx = this.contexts.get(vmId);
    const isolationLevel = ctx?.isolationLevel ?? 'ultra';
    const severity = isolationLevel === 'ultra' ? 'critical'
      : isolationLevel === 'vm' ? 'high'
        : isolationLevel === 'namespace' ? 'medium'
          : 'low';

    const violation = IsolationViolationSchema.parse({
      vmId,
      capability,
      reason,
      timestamp: Date.now(),
      severity,
    });

    this.violations.push(violation);
    if (this.violations.length > this.maxViolations) this.violations.shift();
    for (const listener of this.violationListeners) listener(violation);

    return false;
  }

  /**
   * List all active isolation contexts.
   */
  listContexts(): IsolationContext[] {
    return [...this.contexts.values()];
  }

  /**
   * Get violation log (most recent first).
   */
  getViolations(limit = 50): IsolationViolation[] {
    return [...this.violations].reverse().slice(0, limit);
  }

  /**
   * Subscribe to violation events.
   */
  onViolation(listener: (v: IsolationViolation) => void): () => void {
    this.violationListeners.push(listener);
    return () => {
      this.violationListeners = this.violationListeners.filter(l => l !== listener);
    };
  }

  /**
   * Get summary stats.
   */
  getStats(): { activeContexts: number; totalViolations: number; violationsByLevel: Record<string, number> } {
    const byLevel: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const v of this.violations) byLevel[v.severity]++;
    return {
      activeContexts: this.contexts.size,
      totalViolations: this.violations.length,
      violationsByLevel: byLevel,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset(): void {
    this.contexts.clear();
    this.violations = [];
    this.violationListeners = [];
  }
}
