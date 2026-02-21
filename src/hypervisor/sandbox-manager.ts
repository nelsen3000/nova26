// Hypervisor Sandbox Manager — VM lifecycle management
// Sprint S2-11 (Spec Task 4) | Hypervisor Integration (Reel 2)

import { createHash, randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import type {
  VMSpec,
  VMInstance,
  VMState,
  TaskPayload,
  TaskResult,
  HypervisorManagerConfig,
  SandboxPolicy,
  PolicyEvaluationResult,
  CleanupVerification,
} from './types.js';
import { VMSpecSchema, HypervisorManagerConfigSchema } from './types.js';

export interface SandboxManagerEvents {
  'ready': () => void;
  'vm-spawned': (instance: VMInstance) => void;
  'vm-terminated': (vmId: string, state: VMState) => void;
  'vm-state-change': (vmId: string, prev: VMState, next: VMState) => void;
  'health-warning': (message: string, errorCount: number) => void;
  'security-violation': (vmId: string, reason: string) => void;
  'error': (err: Error, vmId?: string) => void;
}

export class HypervisorTooManyVMsError extends Error {
  constructor(max: number) {
    super(`Max concurrent VMs (${max}) reached`);
  }
}

export class HypervisorVMNotFoundError extends Error {
  constructor(vmId: string) {
    super(`VM ${vmId} not found`);
  }
}

/**
 * SandboxManager — manages VM lifecycle (create, run, pause, stop, destroy).
 * In-memory simulation; wire to real Hypercore HAL binary for production.
 */
export class SandboxManager extends EventEmitter {
  private config: HypervisorManagerConfig;
  private vms = new Map<string, VMInstance>();
  private policies = new Map<string, SandboxPolicy>();
  private errorTimestamps: number[] = [];
  private startedAt = Date.now();
  private isReady = false;

  constructor(config: Partial<HypervisorManagerConfig> = {}) {
    super();
    this.config = HypervisorManagerConfigSchema.parse(config);
  }

  /**
   * Initialize the manager — emits 'ready' when done.
   */
  async initialize(): Promise<void> {
    // Simulate HAL binary check / provider detection
    await Promise.resolve();
    this.isReady = true;
    this.emit('ready');
  }

  /**
   * Spawn a new VM. Returns the VM ID.
   * Throws if max concurrent VMs exceeded.
   */
  async spawn(spec: Partial<VMSpec> & Pick<VMSpec, 'name' | 'image'>): Promise<string> {
    if (!this.isReady) throw new Error('SandboxManager not initialized');

    const runningCount = [...this.vms.values()].filter(v => v.state === 'running').length;
    if (runningCount >= this.config.maxConcurrentVMs) {
      throw new HypervisorTooManyVMsError(this.config.maxConcurrentVMs);
    }

    const parsed = VMSpecSchema.parse({ provider: this.config.defaultProvider, ...spec });
    const vmId = `vm-${randomUUID().slice(0, 8)}`;

    const instance: VMInstance = {
      vmId,
      spec: parsed,
      state: 'creating',
      createdAt: Date.now(),
      resources: parsed.resources,
    };

    this.vms.set(vmId, instance);
    this.emit('vm-state-change', vmId, 'creating' as VMState, 'creating');

    // Simulate async boot
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    this.transition(vmId, 'running');
    this.emit('vm-spawned', instance);

    return vmId;
  }

  /**
   * Terminate a VM.
   */
  async terminate(vmId: string): Promise<void> {
    const vm = this.vms.get(vmId);
    if (!vm) throw new HypervisorVMNotFoundError(vmId);

    this.transition(vmId, 'stopped');
    await Promise.resolve();
    this.transition(vmId, 'destroyed');
    this.emit('vm-terminated', vmId, 'destroyed' as VMState);
    this.vms.delete(vmId);
  }

  /**
   * Pause a running VM.
   */
  pause(vmId: string): void {
    const vm = this.vms.get(vmId);
    if (!vm) throw new HypervisorVMNotFoundError(vmId);
    if (vm.state !== 'running') throw new Error(`VM ${vmId} is not running (state: ${vm.state})`);
    this.transition(vmId, 'paused');
  }

  /**
   * Resume a paused VM.
   */
  resume(vmId: string): void {
    const vm = this.vms.get(vmId);
    if (!vm) throw new HypervisorVMNotFoundError(vmId);
    if (vm.state !== 'paused') throw new Error(`VM ${vmId} is not paused (state: ${vm.state})`);
    this.transition(vmId, 'running');
  }

  /**
   * Get status of a specific VM.
   */
  getStatus(vmId: string): VMInstance {
    const vm = this.vms.get(vmId);
    if (!vm) throw new HypervisorVMNotFoundError(vmId);
    return { ...vm };
  }

  /**
   * List all tracked VMs.
   */
  listVMs(): VMInstance[] {
    return [...this.vms.values()].map(v => ({ ...v }));
  }

  /**
   * Execute a task in a VM via simulated VSOCK (direct in-memory call).
   */
  async executeTask(vmId: string, payload: TaskPayload): Promise<TaskResult> {
    const vm = this.vms.get(vmId);
    if (!vm) throw new HypervisorVMNotFoundError(vmId);
    if (vm.state !== 'running') throw new Error(`VM ${vmId} is not running`);

    const start = Date.now();
    // Simulate task execution
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    return {
      taskId: payload.taskId,
      success: true,
      output: { result: `Task ${payload.action} completed in vm ${vmId}` },
      durationMs: Date.now() - start,
      exitCode: 0,
    };
  }

  /**
   * Register a sandbox policy for an agent.
   */
  registerPolicy(policy: SandboxPolicy): void {
    this.policies.set(policy.agentId, policy);
  }

  /**
   * Evaluate OPA-style policy for an operation.
   */
  evaluatePolicy(agentId: string, operation: string): PolicyEvaluationResult {
    const policy = this.policies.get(agentId);
    const now = Date.now();

    if (!policy) {
      return {
        allowed: false,
        agentId,
        operation,
        reasons: ['No policy registered for agent — deny by default'],
        evaluatedAt: now,
      };
    }

    const reasons: string[] = [];

    if (policy.blockedOperations.includes(operation)) {
      reasons.push(`Operation "${operation}" is explicitly blocked`);
      return { allowed: false, agentId, operation, reasons, evaluatedAt: now };
    }

    if (!policy.allowedOperations.includes(operation)) {
      reasons.push(`Operation "${operation}" not in allowed list`);
      return { allowed: false, agentId, operation, reasons, evaluatedAt: now };
    }

    reasons.push(`Operation "${operation}" permitted by policy`);
    return { allowed: true, agentId, operation, reasons, evaluatedAt: now };
  }

  /**
   * Verify cleanup after VM termination.
   */
  verifyCleanup(vmId: string): CleanupVerification {
    const stillExists = this.vms.has(vmId);
    return {
      vmId,
      cleaned: !stillExists,
      residualFiles: [],
      residualProcesses: 0,
      verifiedAt: Date.now(),
    };
  }

  /**
   * Get overall manager status.
   */
  getManagerStatus() {
    const running = [...this.vms.values()].filter(v => v.state === 'running').length;
    return {
      ready: this.isReady,
      totalVMs: this.vms.size,
      runningVMs: running,
      uptimeMs: Date.now() - this.startedAt,
      config: this.config,
    };
  }

  /**
   * Close — terminate all running VMs.
   */
  async close(): Promise<void> {
    const vmIds = [...this.vms.keys()];
    await Promise.all(vmIds.map(id => this.terminate(id).catch(() => {/* already gone */})));
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private transition(vmId: string, newState: VMState): void {
    const vm = this.vms.get(vmId);
    if (!vm) return;
    const prev = vm.state;
    vm.state = newState;
    if (newState === 'running') vm.startedAt = Date.now();
    if (newState === 'stopped' || newState === 'destroyed') vm.stoppedAt = Date.now();
    this.emit('vm-state-change', vmId, prev, newState);
  }
}
