// Hypervisor Integration Tests (S2-10 to S2-12)
// Covers: types/schemas, sandbox manager lifecycle

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  VMSpecSchema,
  IsolationLevelSchema,
  VMStateSchema,
  HypervisorProviderSchema,
  ResourceLimitsSchema,
  TaskPayloadSchema,
  SandboxPolicySchema,
  PolicyEvaluationResultSchema,
  TrustedManifestSchema,
  HypervisorManagerConfigSchema,
  HypervisorAuditEventSchema,
} from '../types.js';
import {
  SandboxManager,
  HypervisorTooManyVMsError,
  HypervisorVMNotFoundError,
} from '../sandbox-manager.js';

// ─── S2-10: Types & Schemas ───────────────────────────────────────────────────

describe('Hypervisor Types & Schemas (S2-10)', () => {
  it('VMSpecSchema validates a valid spec', () => {
    const spec = { name: 'test-vm', image: 'ubuntu:22.04' };
    const parsed = VMSpecSchema.parse(spec);
    expect(parsed.provider).toBe('docker');
    expect(parsed.isolationLevel).toBe('process');
    expect(parsed.bootTimeoutMs).toBe(30_000);
  });

  it('VMSpecSchema rejects spec with missing required fields', () => {
    expect(() => VMSpecSchema.parse({ image: 'ubuntu' })).toThrow(); // missing name
  });

  it('IsolationLevelSchema validates all levels', () => {
    for (const level of ['none', 'process', 'namespace', 'vm', 'ultra']) {
      expect(() => IsolationLevelSchema.parse(level)).not.toThrow();
    }
  });

  it('VMStateSchema validates all states', () => {
    for (const state of ['creating', 'running', 'paused', 'stopped', 'destroyed', 'error']) {
      expect(() => VMStateSchema.parse(state)).not.toThrow();
    }
  });

  it('ResourceLimitsSchema applies defaults', () => {
    const limits = ResourceLimitsSchema.parse({});
    expect(limits.cpuMillicores).toBe(500);
    expect(limits.memoryMb).toBe(256);
    expect(limits.networkKbps).toBe(1024);
  });

  it('TaskPayloadSchema validates a task', () => {
    const payload = {
      taskId: 'task-1',
      agentId: 'MARS',
      action: 'generateCode',
      args: {},
    };
    expect(() => TaskPayloadSchema.parse(payload)).not.toThrow();
  });

  it('SandboxPolicySchema validates a policy', () => {
    const policy = {
      agentId: 'MARS',
      allowedOperations: ['read', 'write'],
      isolationLevel: 'vm',
    };
    expect(() => SandboxPolicySchema.parse(policy)).not.toThrow();
  });

  it('HypervisorManagerConfigSchema applies defaults', () => {
    const config = HypervisorManagerConfigSchema.parse({});
    expect(config.maxConcurrentVMs).toBe(10);
    expect(config.defaultProvider).toBe('docker');
    expect(config.storagePath).toBe('.nova/hypervisor');
  });

  it('HypervisorAuditEventSchema validates an event', () => {
    const event = { eventType: 'vm-spawned', vmId: 'vm-1', timestamp: Date.now() };
    expect(() => HypervisorAuditEventSchema.parse(event)).not.toThrow();
  });

  it('TrustedManifestSchema validates a manifest', () => {
    const manifest = {
      version: '1.0',
      images: { 'ubuntu:22.04': 'abc123' },
      kernels: {},
      plugins: {},
      updatedAt: Date.now(),
    };
    expect(() => TrustedManifestSchema.parse(manifest)).not.toThrow();
  });
});

// ─── S2-11: SandboxManager ────────────────────────────────────────────────────

describe('SandboxManager (S2-11)', () => {
  let manager: SandboxManager;

  beforeEach(async () => {
    manager = new SandboxManager({ maxConcurrentVMs: 3 });
    await manager.initialize();
  });

  it('initialize emits ready event', async () => {
    const m = new SandboxManager();
    let ready = false;
    m.on('ready', () => { ready = true; });
    await m.initialize();
    expect(ready).toBe(true);
  });

  it('spawn creates and starts a VM', async () => {
    const vmId = await manager.spawn({ name: 'test-vm', image: 'ubuntu:22.04' });
    expect(vmId).toMatch(/^vm-/);
    const status = manager.getStatus(vmId);
    expect(status.state).toBe('running');
  });

  it('spawn returns unique VM IDs', async () => {
    const id1 = await manager.spawn({ name: 'vm-a', image: 'ubuntu' });
    const id2 = await manager.spawn({ name: 'vm-b', image: 'ubuntu' });
    expect(id1).not.toBe(id2);
  });

  it('spawn emits vm-spawned event', async () => {
    const spawned: string[] = [];
    manager.on('vm-spawned', (vm) => spawned.push(vm.vmId));
    const vmId = await manager.spawn({ name: 'evt-vm', image: 'ubuntu' });
    expect(spawned).toContain(vmId);
  });

  it('spawn throws when max concurrent VMs reached', async () => {
    await manager.spawn({ name: 'vm-1', image: 'ubuntu' });
    await manager.spawn({ name: 'vm-2', image: 'ubuntu' });
    await manager.spawn({ name: 'vm-3', image: 'ubuntu' });
    await expect(manager.spawn({ name: 'vm-4', image: 'ubuntu' })).rejects.toThrow(
      HypervisorTooManyVMsError,
    );
  });

  it('terminate removes VM and emits event', async () => {
    const vmId = await manager.spawn({ name: 'to-kill', image: 'ubuntu' });
    let terminated = false;
    manager.on('vm-terminated', () => { terminated = true; });
    await manager.terminate(vmId);
    expect(terminated).toBe(true);
    expect(() => manager.getStatus(vmId)).toThrow(HypervisorVMNotFoundError);
  });

  it('terminate throws for unknown vmId', async () => {
    await expect(manager.terminate('vm-nope')).rejects.toThrow(HypervisorVMNotFoundError);
  });

  it('pause and resume cycle works', async () => {
    const vmId = await manager.spawn({ name: 'pause-vm', image: 'ubuntu' });
    manager.pause(vmId);
    expect(manager.getStatus(vmId).state).toBe('paused');
    manager.resume(vmId);
    expect(manager.getStatus(vmId).state).toBe('running');
  });

  it('pause throws if VM is not running', async () => {
    const vmId = await manager.spawn({ name: 'p-vm', image: 'ubuntu' });
    manager.pause(vmId);
    expect(() => manager.pause(vmId)).toThrow();
  });

  it('listVMs returns all tracked VMs', async () => {
    await manager.spawn({ name: 'list-1', image: 'ubuntu' });
    await manager.spawn({ name: 'list-2', image: 'ubuntu' });
    expect(manager.listVMs().length).toBeGreaterThanOrEqual(2);
  });

  it('getStatus returns a copy of VM instance', async () => {
    const vmId = await manager.spawn({ name: 'status-vm', image: 'ubuntu' });
    const status = manager.getStatus(vmId);
    expect(status.vmId).toBe(vmId);
    expect(status.spec.name).toBe('status-vm');
  });

  it('executeTask returns success result', async () => {
    const vmId = await manager.spawn({ name: 'exec-vm', image: 'ubuntu' });
    const result = await manager.executeTask(vmId, {
      taskId: 'task-1',
      agentId: 'MARS',
      action: 'generateCode',
      args: {},
      timeoutMs: 5000,
    });
    expect(result.success).toBe(true);
    expect(result.taskId).toBe('task-1');
  });

  it('evaluatePolicy allows permitted operations', () => {
    manager.registerPolicy({
      agentId: 'MARS',
      allowedOperations: ['read', 'write'],
      blockedOperations: [],
      networkAccess: false,
      fileSystemAccess: false,
      maxMemoryMb: 256,
      isolationLevel: 'vm',
    });
    const result = manager.evaluatePolicy('MARS', 'read');
    expect(result.allowed).toBe(true);
  });

  it('evaluatePolicy denies blocked operations', () => {
    manager.registerPolicy({
      agentId: 'MARS',
      allowedOperations: ['read'],
      blockedOperations: ['delete'],
      networkAccess: false,
      fileSystemAccess: false,
      maxMemoryMb: 256,
      isolationLevel: 'vm',
    });
    const result = manager.evaluatePolicy('MARS', 'delete');
    expect(result.allowed).toBe(false);
  });

  it('evaluatePolicy denies when no policy registered', () => {
    const result = manager.evaluatePolicy('UNKNOWN-AGENT', 'read');
    expect(result.allowed).toBe(false);
  });

  it('verifyCleanup returns cleaned=true after termination', async () => {
    const vmId = await manager.spawn({ name: 'cleanup-vm', image: 'ubuntu' });
    await manager.terminate(vmId);
    const verification = manager.verifyCleanup(vmId);
    expect(verification.cleaned).toBe(true);
    expect(verification.residualFiles).toHaveLength(0);
  });

  it('verifyCleanup returns cleaned=false for running VM', async () => {
    const vmId = await manager.spawn({ name: 'running-vm', image: 'ubuntu' });
    const verification = manager.verifyCleanup(vmId);
    expect(verification.cleaned).toBe(false);
  });

  it('getManagerStatus reflects initialization', () => {
    const status = manager.getManagerStatus();
    expect(status.ready).toBe(true);
    expect(status.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('close terminates all VMs', async () => {
    await manager.spawn({ name: 'c1', image: 'ubuntu' });
    await manager.spawn({ name: 'c2', image: 'ubuntu' });
    await manager.close();
    expect(manager.listVMs()).toHaveLength(0);
  });

  it('spawn throws if not initialized', async () => {
    const m = new SandboxManager();
    await expect(m.spawn({ name: 'x', image: 'ubuntu' })).rejects.toThrow('not initialized');
  });
});
