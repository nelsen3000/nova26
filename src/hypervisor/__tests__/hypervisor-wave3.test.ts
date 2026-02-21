// Hypervisor Wave 3 — Process Isolation, Network Policy, Resource Monitor,
//                      Hypercore Bridge, Observability
// Sprint S2-13..S2-17 | Reel 2

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcessIsolationManager } from '../process-isolation.js';
import { NetworkPolicyManager } from '../network-policy.js';
import { ResourceMonitor } from '../resource-monitor.js';
import { HypercoreBridge } from '../hypercore-bridge.js';
import { HypervisorObserver } from '../observability.js';
import { HypercoreStore } from '../../hypercore/store.js';
import { SandboxManager } from '../sandbox-manager.js';

// ─── S2-13: ProcessIsolationManager ──────────────────────────────────────────

describe('ProcessIsolationManager (S2-13)', () => {
  let mgr: ProcessIsolationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new ProcessIsolationManager();
  });

  it('creates an isolation context with correct level', () => {
    const ctx = mgr.createContext('vm-1', 'namespace');
    expect(ctx.vmId).toBe('vm-1');
    expect(ctx.isolationLevel).toBe('namespace');
    expect(ctx.state).toBe('active');
    expect(ctx.namespaces).toContain('pid');
    expect(ctx.namespaces).toContain('net');
  });

  it('createContext is idempotent — returns same context', () => {
    const a = mgr.createContext('vm-x', 'vm');
    const b = mgr.createContext('vm-x', 'none'); // second call ignored
    expect(a.vmId).toBe(b.vmId);
    expect(a.isolationLevel).toBe(b.isolationLevel);
  });

  it('ultra isolation has no capabilities', () => {
    const ctx = mgr.createContext('vm-ultra', 'ultra');
    expect(ctx.capabilities).toHaveLength(0);
  });

  it('none isolation has many capabilities', () => {
    const ctx = mgr.createContext('vm-none', 'none');
    expect(ctx.capabilities.length).toBeGreaterThan(5);
  });

  it('getContext returns undefined for unknown VM', () => {
    expect(mgr.getContext('no-vm')).toBeUndefined();
  });

  it('hasCapability returns true when capability is present', () => {
    mgr.createContext('vm-2', 'process');
    expect(mgr.hasCapability('vm-2', 'CAP_KILL')).toBe(true);
  });

  it('hasCapability returns false for ultra isolation', () => {
    mgr.createContext('vm-3', 'ultra');
    expect(mgr.hasCapability('vm-3', 'CAP_NET_RAW')).toBe(false);
  });

  it('hasNamespace checks correctly', () => {
    mgr.createContext('vm-4', 'namespace');
    expect(mgr.hasNamespace('vm-4', 'net')).toBe(true);
    expect(mgr.hasNamespace('vm-4', 'cgroup')).toBe(false);
  });

  it('destroyContext removes the context', () => {
    mgr.createContext('vm-5', 'process');
    expect(mgr.destroyContext('vm-5')).toBe(true);
    expect(mgr.getContext('vm-5')).toBeUndefined();
  });

  it('destroyContext returns false for unknown VM', () => {
    expect(mgr.destroyContext('no-vm')).toBe(false);
  });

  it('suspendContext suspends active context', () => {
    mgr.createContext('vm-6', 'vm');
    expect(mgr.suspendContext('vm-6')).toBe(true);
    expect(mgr.getContext('vm-6')?.state).toBe('suspended');
  });

  it('resumeContext resumes suspended context', () => {
    mgr.createContext('vm-7', 'vm');
    mgr.suspendContext('vm-7');
    expect(mgr.resumeContext('vm-7')).toBe(true);
    expect(mgr.getContext('vm-7')?.state).toBe('active');
  });

  it('enforceCapability logs violation when denied', () => {
    mgr.createContext('vm-8', 'ultra');
    const violations: unknown[] = [];
    mgr.onViolation(v => violations.push(v));
    const result = mgr.enforceCapability('vm-8', 'CAP_NET_RAW', 'test reason');
    expect(result).toBe(false);
    expect(violations).toHaveLength(1);
  });

  it('enforceCapability returns true when allowed', () => {
    mgr.createContext('vm-9', 'none');
    expect(mgr.enforceCapability('vm-9', 'CAP_KILL', 'test')).toBe(true);
  });

  it('listContexts returns all active contexts', () => {
    mgr.createContext('a', 'process');
    mgr.createContext('b', 'vm');
    expect(mgr.listContexts()).toHaveLength(2);
  });

  it('getViolations returns violations sorted newest first', () => {
    mgr.createContext('vm-v', 'ultra');
    mgr.enforceCapability('vm-v', 'CAP_CHOWN', 'reason 1');
    mgr.enforceCapability('vm-v', 'CAP_DAC_OVERRIDE', 'reason 2');
    const violations = mgr.getViolations();
    expect(violations).toHaveLength(2);
    expect(violations[0].capability).toBe('CAP_DAC_OVERRIDE'); // most recent first
  });

  it('getStats reports violation breakdown', () => {
    mgr.createContext('vm-s', 'ultra');
    mgr.enforceCapability('vm-s', 'CAP_CHOWN', 'r');
    const stats = mgr.getStats();
    expect(stats.totalViolations).toBe(1);
    expect(stats.violationsByLevel['critical']).toBe(1);
  });

  it('reset clears all state', () => {
    mgr.createContext('vm-r', 'vm');
    mgr.reset();
    expect(mgr.listContexts()).toHaveLength(0);
    expect(mgr.getViolations()).toHaveLength(0);
  });
});

// ─── S2-14: NetworkPolicyManager ─────────────────────────────────────────────

describe('NetworkPolicyManager (S2-14)', () => {
  let npm: NetworkPolicyManager;

  beforeEach(() => {
    vi.clearAllMocks();
    npm = new NetworkPolicyManager();
  });

  it('defaults to deny when no rules match', () => {
    const result = npm.evaluate({ vmId: 'vm-1', direction: 'egress', protocol: 'tcp', remoteHost: 'api.example.com', port: 443 });
    expect(result.allowed).toBe(false);
  });

  it('explicit allow rule permits traffic', () => {
    npm.addRule({ ruleId: 'r1', vmId: 'vm-1', direction: 'egress', action: 'allow', protocol: 'tcp', portRange: [443, 443], priority: 10 });
    const result = npm.evaluate({ vmId: 'vm-1', direction: 'egress', protocol: 'tcp', remoteHost: 'api.example.com', port: 443 });
    expect(result.allowed).toBe(true);
    expect(result.matchedRuleId).toBe('r1');
  });

  it('deny rule blocks traffic', () => {
    npm.addRule({ ruleId: 'deny-80', vmId: 'vm-2', direction: 'egress', action: 'deny', protocol: 'tcp', portRange: [80, 80], priority: 5 });
    const result = npm.evaluate({ vmId: 'vm-2', direction: 'egress', protocol: 'tcp', remoteHost: 'example.com', port: 80 });
    expect(result.allowed).toBe(false);
  });

  it('priority ordering — lower priority number wins', () => {
    npm.addRule({ ruleId: 'allow-high-pri', vmId: 'vm-p', direction: 'egress', action: 'allow', protocol: 'tcp', portRange: [443, 443], priority: 5 });
    npm.addRule({ ruleId: 'deny-low-pri', vmId: 'vm-p', direction: 'egress', action: 'deny', protocol: 'tcp', portRange: [443, 443], priority: 10 });
    const result = npm.evaluate({ vmId: 'vm-p', direction: 'egress', protocol: 'tcp', remoteHost: 'x.com', port: 443 });
    expect(result.allowed).toBe(true); // allow-high-pri fires first
    expect(result.matchedRuleId).toBe('allow-high-pri');
  });

  it('global rules apply to all VMs', () => {
    npm.addRule({ ruleId: 'global-allow', vmId: '*', direction: 'egress', action: 'allow', protocol: 'tcp', portRange: [443, 443], priority: 100 });
    const r1 = npm.evaluate({ vmId: 'vm-a', direction: 'egress', protocol: 'tcp', remoteHost: 'api.com', port: 443 });
    const r2 = npm.evaluate({ vmId: 'vm-b', direction: 'egress', protocol: 'tcp', remoteHost: 'other.com', port: 443 });
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
  });

  it('removeRule removes by ruleId', () => {
    npm.addRule({ ruleId: 'r-del', vmId: 'vm-d', direction: 'egress', action: 'allow', protocol: 'any', priority: 1 });
    expect(npm.removeRule('r-del')).toBe(true);
    const result = npm.evaluate({ vmId: 'vm-d', direction: 'egress', protocol: 'tcp', remoteHost: 'x.com', port: 80 });
    expect(result.allowed).toBe(false); // back to default deny
  });

  it('blockAll adds a blanket deny rule', () => {
    npm.blockAll('vm-b');
    const result = npm.evaluate({ vmId: 'vm-b', direction: 'egress', protocol: 'tcp', remoteHost: 'x.com', port: 80 });
    expect(result.allowed).toBe(false);
  });

  it('allowAll adds a blanket allow rule', () => {
    npm = new NetworkPolicyManager({ defaultAction: 'deny' });
    npm.allowAll('vm-c');
    const result = npm.evaluate({ vmId: 'vm-c', direction: 'ingress', protocol: 'udp', remoteHost: 'x.com', port: 1234 });
    expect(result.allowed).toBe(true);
  });

  it('direction mismatch skips rule', () => {
    npm.addRule({ ruleId: 'egress-only', vmId: 'vm-e', direction: 'egress', action: 'allow', protocol: 'any', priority: 1 });
    const result = npm.evaluate({ vmId: 'vm-e', direction: 'ingress', protocol: 'tcp', remoteHost: 'x.com', port: 80 });
    expect(result.allowed).toBe(false);
  });

  it('wildcard hostname matches any host', () => {
    npm.addRule({ ruleId: 'allow-any-host', vmId: 'vm-w', direction: 'egress', action: 'allow', protocol: 'tcp', remoteHost: '*', portRange: [80, 80], priority: 1 });
    const result = npm.evaluate({ vmId: 'vm-w', direction: 'egress', protocol: 'tcp', remoteHost: 'anything.com', port: 80 });
    expect(result.allowed).toBe(true);
  });

  it('getRules returns vm + global rules sorted by priority', () => {
    npm.addRule({ ruleId: 'g', vmId: '*', direction: 'egress', action: 'deny', protocol: 'any', priority: 200 });
    npm.addRule({ ruleId: 'v', vmId: 'vm-x', direction: 'egress', action: 'allow', protocol: 'any', priority: 50 });
    const rules = npm.getRules('vm-x');
    expect(rules[0].ruleId).toBe('v'); // lower priority number = higher priority
    expect(rules[1].ruleId).toBe('g');
  });

  it('clearRules removes all rules for a VM', () => {
    npm.addRule({ ruleId: 'r1', vmId: 'vm-clear', direction: 'egress', action: 'allow', protocol: 'any', priority: 1 });
    npm.clearRules('vm-clear');
    expect(npm.getRules('vm-clear')).toHaveLength(0); // only global (none added)
  });

  it('getEvaluationLog returns recent evaluations newest-first', () => {
    npm.evaluate({ vmId: 'vm-log', direction: 'egress', protocol: 'tcp', remoteHost: 'x.com', port: 80 });
    npm.evaluate({ vmId: 'vm-log', direction: 'egress', protocol: 'tcp', remoteHost: 'y.com', port: 443 });
    const log = npm.getEvaluationLog();
    expect(log[0].request.remoteHost).toBe('y.com');
  });

  it('getStats reports correct counts', () => {
    npm.addRule({ ruleId: 'r', vmId: 'vm-z', direction: 'egress', action: 'allow', protocol: 'any', priority: 1 });
    npm.evaluate({ vmId: 'vm-z', direction: 'egress', protocol: 'tcp', remoteHost: 'x.com', port: 80 });
    const stats = npm.getStats();
    expect(stats.perVmRules).toBe(1);
    expect(stats.totalEvaluations).toBe(1);
  });

  it('reset clears all state', () => {
    npm.addRule({ ruleId: 'r', vmId: 'vm-r', direction: 'egress', action: 'allow', protocol: 'any', priority: 1 });
    npm.reset();
    expect(npm.listAllRules()).toHaveLength(0);
  });

  it('default allow option works', () => {
    const pm = new NetworkPolicyManager({ defaultAction: 'allow' });
    const result = pm.evaluate({ vmId: 'vm-any', direction: 'egress', protocol: 'tcp', remoteHost: 'x.com', port: 80 });
    expect(result.allowed).toBe(true);
  });
});

// ─── S2-15: ResourceMonitor ───────────────────────────────────────────────────

describe('ResourceMonitor (S2-15)', () => {
  let monitor: ResourceMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new ResourceMonitor();
  });

  it('recordSnapshot stores snapshots', () => {
    monitor.recordSnapshot({ vmId: 'vm-1', cpuMillicores: 200, memoryMb: 128, diskMb: 512 });
    const usage = monitor.getUsage('vm-1');
    expect(usage.snapshotCount).toBe(1);
    expect(usage.latest?.cpuMillicores).toBe(200);
  });

  it('avg and peak are computed correctly', () => {
    monitor.recordSnapshot({ vmId: 'vm-2', cpuMillicores: 100, memoryMb: 100, diskMb: 100 });
    monitor.recordSnapshot({ vmId: 'vm-2', cpuMillicores: 300, memoryMb: 200, diskMb: 200 });
    const usage = monitor.getUsage('vm-2');
    expect(usage.avg.cpuMillicores).toBe(200);
    expect(usage.peak.cpuMillicores).toBe(300);
  });

  it('getAllUsage returns all VMs', () => {
    monitor.recordSnapshot({ vmId: 'a', cpuMillicores: 100, memoryMb: 100, diskMb: 100 });
    monitor.recordSnapshot({ vmId: 'b', cpuMillicores: 200, memoryMb: 200, diskMb: 200 });
    expect(monitor.getAllUsage()).toHaveLength(2);
  });

  it('fires warning alert at 80% threshold', () => {
    monitor.setThreshold({ vmId: 'vm-t', cpuMillicores: 1000 });
    const alerts: unknown[] = [];
    monitor.onAlert(a => alerts.push(a));
    monitor.recordSnapshot({ vmId: 'vm-t', cpuMillicores: 850, memoryMb: 100, diskMb: 100 });
    expect(alerts).toHaveLength(1);
    expect((alerts[0] as { severity: string }).severity).toBe('warning');
  });

  it('fires critical alert at 95% threshold', () => {
    monitor.setThreshold({ vmId: 'vm-c', cpuMillicores: 1000 });
    const alerts: unknown[] = [];
    monitor.onAlert(a => alerts.push(a));
    monitor.recordSnapshot({ vmId: 'vm-c', cpuMillicores: 980, memoryMb: 100, diskMb: 100 });
    expect((alerts[0] as { severity: string }).severity).toBe('critical');
  });

  it('no alert below 80% threshold', () => {
    monitor.setThreshold({ vmId: 'vm-ok', memoryMb: 1000 });
    const alerts: unknown[] = [];
    monitor.onAlert(a => alerts.push(a));
    monitor.recordSnapshot({ vmId: 'vm-ok', cpuMillicores: 100, memoryMb: 500, diskMb: 100 });
    expect(alerts).toHaveLength(0);
  });

  it('no threshold = no alerts', () => {
    const alerts: unknown[] = [];
    monitor.onAlert(a => alerts.push(a));
    monitor.recordSnapshot({ vmId: 'vm-no-t', cpuMillicores: 9999, memoryMb: 9999, diskMb: 9999 });
    expect(alerts).toHaveLength(0);
  });

  it('getAlerts filters by vmId', () => {
    monitor.setThreshold({ vmId: 'vm-a', cpuMillicores: 100 });
    monitor.setThreshold({ vmId: 'vm-b', cpuMillicores: 100 });
    monitor.recordSnapshot({ vmId: 'vm-a', cpuMillicores: 99, memoryMb: 10, diskMb: 10 });
    monitor.recordSnapshot({ vmId: 'vm-b', cpuMillicores: 99, memoryMb: 10, diskMb: 10 });
    expect(monitor.getAlerts('vm-a')).toHaveLength(1);
    expect(monitor.getAlerts('vm-b')).toHaveLength(1);
    expect(monitor.getAlerts()).toHaveLength(2);
  });

  it('getSnapshots returns last N snapshots', () => {
    for (let i = 0; i < 10; i++) {
      monitor.recordSnapshot({ vmId: 'vm-s', cpuMillicores: i * 10, memoryMb: 100, diskMb: 100 });
    }
    expect(monitor.getSnapshots('vm-s', 5)).toHaveLength(5);
  });

  it('removeVM clears snapshots and threshold', () => {
    monitor.setThreshold({ vmId: 'vm-rm', cpuMillicores: 500 });
    monitor.recordSnapshot({ vmId: 'vm-rm', cpuMillicores: 100, memoryMb: 100, diskMb: 100 });
    monitor.removeVM('vm-rm');
    expect(monitor.getUsage('vm-rm').snapshotCount).toBe(0);
  });

  it('getAggregatedMetrics sums across VMs', () => {
    monitor.recordSnapshot({ vmId: 'x', cpuMillicores: 100, memoryMb: 200, diskMb: 300 });
    monitor.recordSnapshot({ vmId: 'y', cpuMillicores: 50, memoryMb: 100, diskMb: 150 });
    const agg = monitor.getAggregatedMetrics();
    expect(agg.vmCount).toBe(2);
    expect(agg.totalCpuMillicores).toBe(150);
  });

  it('unsubscribe from alert listener', () => {
    monitor.setThreshold({ vmId: 'vm-un', cpuMillicores: 100 });
    const alerts: unknown[] = [];
    const unsubscribe = monitor.onAlert(a => alerts.push(a));
    unsubscribe();
    monitor.recordSnapshot({ vmId: 'vm-un', cpuMillicores: 99, memoryMb: 10, diskMb: 10 });
    expect(alerts).toHaveLength(0);
  });

  it('reset clears all state', () => {
    monitor.recordSnapshot({ vmId: 'vm-r', cpuMillicores: 100, memoryMb: 100, diskMb: 100 });
    monitor.reset();
    expect(monitor.getAllUsage()).toHaveLength(0);
  });
});

// ─── S2-16: HypercoreBridge ───────────────────────────────────────────────────

describe('HypercoreBridge (S2-16)', () => {
  let bridge: HypercoreBridge;
  let store: HypercoreStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new HypercoreStore({ name: 'hypervisor-audit' });
    bridge = new HypercoreBridge(store);
  });

  it('logs an event to the store', async () => {
    bridge.attachVM('vm-1');
    bridge.logEvent({ eventType: 'vm-spawned', vmId: 'vm-1', severity: 'info' });
    expect(store.length()).toBe(1);
  });

  it('skips event for non-attached VM', async () => {
    bridge.logEvent({ eventType: 'vm-spawned', vmId: 'vm-unknown', severity: 'info' });
    expect(store.length()).toBe(0);
  });

  it('logs event without vmId always', async () => {
    bridge.logEvent({ eventType: 'health-warning', severity: 'warn' });
    expect(store.length()).toBe(1);
  });

  it('readAllEvents returns all logged events', async () => {
    bridge.attachVM('vm-2');
    bridge.logEvent({ eventType: 'vm-spawned', vmId: 'vm-2', severity: 'info' });
    bridge.logEvent({ eventType: 'vm-terminated', vmId: 'vm-2', severity: 'info' });
    const events = bridge.readAllEvents();
    expect(events).toHaveLength(2);
  });

  it('readVMEvents filters by vmId', async () => {
    bridge.attachVM('vm-a');
    bridge.attachVM('vm-b');
    bridge.logEvent({ eventType: 'vm-spawned', vmId: 'vm-a', severity: 'info' });
    bridge.logEvent({ eventType: 'vm-spawned', vmId: 'vm-b', severity: 'info' });
    const aEvents = bridge.readVMEvents('vm-a');
    expect(aEvents).toHaveLength(1);
    expect(aEvents[0].vmId).toBe('vm-a');
  });

  it('readEventsByType filters by eventType', async () => {
    bridge.attachVM('vm-3');
    bridge.logEvent({ eventType: 'vm-spawned', vmId: 'vm-3', severity: 'info' });
    bridge.logEvent({ eventType: 'task-executed', vmId: 'vm-3', severity: 'info' });
    const spawned = bridge.readEventsByType('vm-spawned');
    expect(spawned).toHaveLength(1);
  });

  it('detachVM stops logging events', async () => {
    bridge.attachVM('vm-4');
    bridge.detachVM('vm-4');
    bridge.logEvent({ eventType: 'vm-spawned', vmId: 'vm-4', severity: 'info' });
    expect(store.length()).toBe(0);
  });

  it('isAttached returns correct state', () => {
    bridge.attachVM('vm-5');
    expect(bridge.isAttached('vm-5')).toBe(true);
    expect(bridge.isAttached('vm-other')).toBe(false);
    bridge.detachVM('vm-5');
    expect(bridge.isAttached('vm-5')).toBe(false);
  });

  it('syncAll returns synced count', async () => {
    bridge.attachVM('vm-6');
    bridge.logEvent({ eventType: 'vm-spawned', vmId: 'vm-6', severity: 'info' });
    bridge.logEvent({ eventType: 'vm-terminated', vmId: 'vm-6', severity: 'info' });
    const { synced, errors } = bridge.syncAll();
    expect(synced).toBe(2);
    expect(errors).toBe(0);
  });

  it('getStats reports correct counts', async () => {
    bridge.attachVM('vm-7');
    bridge.logEvent({ eventType: 'vm-spawned', vmId: 'vm-7', severity: 'info' });
    const stats = bridge.getStats();
    expect(stats.totalEventsLogged).toBe(1);
    expect(stats.eventsByType['vm-spawned']).toBe(1);
    expect(stats.attachedVMs).toBe(1);
    expect(stats.storeLength).toBe(1);
  });

  it('listAttachedVMs returns all attached', () => {
    bridge.attachVM('a');
    bridge.attachVM('b');
    const list = bridge.listAttachedVMs();
    expect(list).toContain('a');
    expect(list).toContain('b');
  });
});

// ─── S2-17: HypervisorObserver ────────────────────────────────────────────────

describe('HypervisorObserver (S2-17)', () => {
  let observer: HypervisorObserver;
  let manager: SandboxManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    observer = new HypervisorObserver();
    manager = new SandboxManager({ maxConcurrentVMs: 5 });
    await manager.initialize();
  });

  it('recordEvent manually adds events', () => {
    observer.recordEvent({ eventType: 'vm-spawned', vmId: 'vm-1', severity: 'info' });
    const events = observer.getRecentEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('vm-spawned');
  });

  it('getRecentEvents returns newest first', () => {
    observer.recordEvent({ eventType: 'vm-spawned', vmId: 'vm-1', severity: 'info' });
    observer.recordEvent({ eventType: 'vm-terminated', vmId: 'vm-2', severity: 'info' });
    expect(observer.getRecentEvents()[0].eventType).toBe('vm-terminated');
  });

  it('onEvent listener is called', () => {
    const received: unknown[] = [];
    observer.onEvent(e => received.push(e));
    observer.recordEvent({ eventType: 'error', vmId: 'vm-e', severity: 'error' });
    expect(received).toHaveLength(1);
  });

  it('onEvent unsubscribe works', () => {
    const received: unknown[] = [];
    const unsub = observer.onEvent(e => received.push(e));
    unsub();
    observer.recordEvent({ eventType: 'vm-spawned', vmId: 'vm-x', severity: 'info' });
    expect(received).toHaveLength(0);
  });

  it('getMetrics tracks totalVMsSpawned when attached', async () => {
    observer.attach(manager);
    await manager.spawn({ name: 'test-vm', image: 'alpine', provider: 'docker' });
    expect(observer.getMetrics().totalVMsSpawned).toBe(1);
    expect(observer.getMetrics().currentlyRunning).toBe(1);
    observer.detach();
  });

  it('getMetrics tracks totalVMsTerminated when attached', async () => {
    observer.attach(manager);
    const vmId = await manager.spawn({ name: 'test-vm', image: 'alpine', provider: 'docker' });
    await manager.terminate(vmId);
    expect(observer.getMetrics().totalVMsTerminated).toBe(1);
    expect(observer.getMetrics().currentlyRunning).toBe(0);
    observer.detach();
  });

  it('getMetrics tracks provider breakdown', async () => {
    observer.attach(manager);
    await manager.spawn({ name: 'vm-a', image: 'alpine', provider: 'docker' });
    await manager.spawn({ name: 'vm-b', image: 'alpine', provider: 'docker' });
    expect(observer.getMetrics().providerBreakdown['docker']).toBe(2);
    observer.detach();
  });

  it('getSecurityMetrics starts at zero', () => {
    const sec = observer.getSecurityMetrics();
    expect(sec.policyViolations).toBe(0);
    expect(sec.sandboxEscapeAttempts).toBe(0);
  });

  it('isHealthy returns true with no errors', () => {
    expect(observer.isHealthy()).toBe(true);
  });

  it('isHealthy returns false after many errors', () => {
    const obs = new HypervisorObserver({ healthWarningThreshold: 2, healthWarningWindowMs: 60_000 });
    obs.recordEvent({ eventType: 'error', severity: 'error' });
    obs.recordEvent({ eventType: 'error', severity: 'error' });
    obs.recordEvent({ eventType: 'error', severity: 'error' });
    expect(obs.isHealthy()).toBe(false);
  });

  it('resetMetrics clears all counters', () => {
    observer.recordEvent({ eventType: 'vm-spawned', vmId: 'vm-1', severity: 'info' });
    observer.resetMetrics();
    expect(observer.getRecentEvents()).toHaveLength(0);
    expect(observer.getMetrics().totalVMsSpawned).toBe(0);
  });

  it('detach removes listeners', async () => {
    observer.attach(manager);
    observer.detach();
    await manager.spawn({ name: 'vm-det', image: 'alpine', provider: 'docker' });
    // No events should be recorded after detach
    expect(observer.getMetrics().totalVMsSpawned).toBe(0);
  });

  it('re-attach to a new manager replaces previous', async () => {
    const manager2 = new SandboxManager({ maxConcurrentVMs: 5 });
    await manager2.initialize();
    observer.attach(manager);
    observer.attach(manager2); // should detach from manager first
    await manager.spawn({ name: 'vm-old', image: 'alpine', provider: 'docker' });
    await manager2.spawn({ name: 'vm-new', image: 'alpine', provider: 'docker' });
    expect(observer.getMetrics().totalVMsSpawned).toBe(1); // only manager2 event
  });
});
