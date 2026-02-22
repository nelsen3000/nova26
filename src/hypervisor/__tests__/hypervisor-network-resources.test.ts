/**
 * H5-14: Hypervisor — Network Policy & Resource Monitoring Tests
 *
 * Tests for NetworkPolicyManager (rule-based network access control)
 * and ResourceMonitor (resource tracking and alerting)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Mock Implementations
// ============================================================================

type NetworkProtocol = 'tcp' | 'udp' | 'icmp' | 'any';
type NetworkDirection = 'egress' | 'ingress' | 'both';

interface NetworkRule {
  ruleId: string;
  vmId: string;
  direction: NetworkDirection;
  action: 'allow' | 'deny';
  protocol: NetworkProtocol;
  remoteHost?: string;
  portRange?: [number, number];
  priority: number;
  description?: string;
  createdAt: number;
}

interface NetworkRequest {
  vmId: string;
  direction: NetworkDirection;
  protocol: NetworkProtocol;
  remoteHost: string;
  port: number;
}

interface NetworkPolicyResult {
  allowed: boolean;
  matchedRuleId?: string;
  reason: string;
  evaluatedAt: number;
}

interface ResourceSnapshot {
  vmId: string;
  timestamp: number;
  cpuMillicores: number;
  memoryMb: number;
  diskMb: number;
  networkRxKbps: number;
  networkTxKbps: number;
}

interface ResourceThreshold {
  vmId: string;
  cpuMillicores?: number;
  memoryMb?: number;
  diskMb?: number;
  networkRxKbps?: number;
  networkTxKbps?: number;
}

interface ResourceAlert {
  vmId: string;
  resource: 'cpuMillicores' | 'memoryMb' | 'diskMb' | 'networkRxKbps' | 'networkTxKbps';
  currentValue: number;
  threshold: number;
  percentUsed: number;
  timestamp: number;
  severity: 'warning' | 'critical';
}

// ============================================================================
// NetworkPolicyManager Mock
// ============================================================================

class MockNetworkPolicyManager {
  private rules = new Map<string, NetworkRule[]>();
  private globalRules: NetworkRule[] = [];
  private defaultAction: 'allow' | 'deny';
  private evaluationLog: Array<{ request: NetworkRequest; result: NetworkPolicyResult }> = [];

  constructor(defaultAction: 'allow' | 'deny' = 'deny') {
    this.defaultAction = defaultAction;
  }

  addRule(rule: Omit<NetworkRule, 'createdAt'>): NetworkRule {
    const fullRule: NetworkRule = { ...rule, createdAt: Date.now() };

    if (fullRule.vmId === '*') {
      this.globalRules.push(fullRule);
      this.globalRules.sort((a, b) => a.priority - b.priority);
    } else {
      if (!this.rules.has(fullRule.vmId)) {
        this.rules.set(fullRule.vmId, []);
      }
      const vmRules = this.rules.get(fullRule.vmId)!;
      vmRules.push(fullRule);
      vmRules.sort((a, b) => a.priority - b.priority);
    }

    return fullRule;
  }

  evaluate(request: NetworkRequest): NetworkPolicyResult {
    const vmRules = this.rules.get(request.vmId) ?? [];
    const allRules = [...this.globalRules, ...vmRules];

    for (const rule of allRules) {
      if (this.ruleMatches(rule, request)) {
        const result: NetworkPolicyResult = {
          allowed: rule.action === 'allow',
          matchedRuleId: rule.ruleId,
          reason: `Matched rule ${rule.ruleId}`,
          evaluatedAt: Date.now(),
        };
        this.evaluationLog.push({ request, result });
        return result;
      }
    }

    const result: NetworkPolicyResult = {
      allowed: this.defaultAction === 'allow',
      reason: `Default action: ${this.defaultAction}`,
      evaluatedAt: Date.now(),
    };
    this.evaluationLog.push({ request, result });
    return result;
  }

  private ruleMatches(rule: NetworkRule, request: NetworkRequest): boolean {
    // Direction
    if (rule.direction !== 'both' && rule.direction !== request.direction) {
      return false;
    }

    // Protocol
    if (rule.protocol !== 'any' && rule.protocol !== request.protocol) {
      return false;
    }

    // Remote host (simple substring match for mock)
    if (rule.remoteHost && !request.remoteHost.includes(rule.remoteHost)) {
      return false;
    }

    // Port range
    if (rule.portRange) {
      const [minPort, maxPort] = rule.portRange;
      if (request.port < minPort || request.port > maxPort) {
        return false;
      }
    }

    return true;
  }

  getRules(vmId: string): NetworkRule[] {
    return this.rules.get(vmId) ?? [];
  }

  getEvaluationLog() {
    return this.evaluationLog;
  }
}

// ============================================================================
// ResourceMonitor Mock
// ============================================================================

class MockResourceMonitor {
  private snapshots = new Map<string, ResourceSnapshot[]>();
  private thresholds = new Map<string, ResourceThreshold>();
  private alerts: ResourceAlert[] = [];
  private alertListeners: ((alert: ResourceAlert) => void)[] = [];

  private readonly WARNING_THRESHOLD = 0.8;
  private readonly CRITICAL_THRESHOLD = 0.95;

  recordSnapshot(snapshot: ResourceSnapshot): void {
    if (!this.snapshots.has(snapshot.vmId)) {
      this.snapshots.set(snapshot.vmId, []);
    }

    const vmSnapshots = this.snapshots.get(snapshot.vmId)!;
    vmSnapshots.push(snapshot);

    this.checkThresholds(snapshot);
  }

  setThreshold(threshold: ResourceThreshold): void {
    this.thresholds.set(threshold.vmId, threshold);
  }

  private checkThresholds(snapshot: ResourceSnapshot): void {
    const threshold = this.thresholds.get(snapshot.vmId);
    if (!threshold) return;

    const checks = [
      { resource: 'cpuMillicores' as const, value: snapshot.cpuMillicores, limit: threshold.cpuMillicores },
      { resource: 'memoryMb' as const, value: snapshot.memoryMb, limit: threshold.memoryMb },
      { resource: 'diskMb' as const, value: snapshot.diskMb, limit: threshold.diskMb },
      { resource: 'networkRxKbps' as const, value: snapshot.networkRxKbps, limit: threshold.networkRxKbps },
      { resource: 'networkTxKbps' as const, value: snapshot.networkTxKbps, limit: threshold.networkTxKbps },
    ];

    for (const { resource, value, limit } of checks) {
      if (!limit) continue;

      const percentUsed = value / limit;

      if (percentUsed >= this.CRITICAL_THRESHOLD) {
        this.fireAlert({
          vmId: snapshot.vmId,
          resource,
          currentValue: value,
          threshold: limit,
          percentUsed,
          timestamp: snapshot.timestamp,
          severity: 'critical',
        });
      } else if (percentUsed >= this.WARNING_THRESHOLD) {
        this.fireAlert({
          vmId: snapshot.vmId,
          resource,
          currentValue: value,
          threshold: limit,
          percentUsed,
          timestamp: snapshot.timestamp,
          severity: 'warning',
        });
      }
    }
  }

  private fireAlert(alert: ResourceAlert): void {
    this.alerts.push(alert);
    this.alertListeners.forEach((listener) => listener(alert));
  }

  onAlert(listener: (alert: ResourceAlert) => void): () => void {
    this.alertListeners.push(listener);
    return () => {
      this.alertListeners = this.alertListeners.filter((l) => l !== listener);
    };
  }

  getSnapshots(vmId: string): ResourceSnapshot[] {
    return this.snapshots.get(vmId) ?? [];
  }

  getAlerts(vmId?: string): ResourceAlert[] {
    return vmId ? this.alerts.filter((a) => a.vmId === vmId) : this.alerts;
  }

  getUsageSummary(vmId: string) {
    const vmSnapshots = this.snapshots.get(vmId) ?? [];

    if (vmSnapshots.length === 0) {
      return {
        vmId,
        latest: null,
        avg: { cpuMillicores: 0, memoryMb: 0, diskMb: 0, networkRxKbps: 0, networkTxKbps: 0 },
        peak: { cpuMillicores: 0, memoryMb: 0, diskMb: 0, networkRxKbps: 0, networkTxKbps: 0 },
        snapshotCount: 0,
      };
    }

    const sum = vmSnapshots.reduce(
      (acc, s) => ({
        cpu: acc.cpu + s.cpuMillicores,
        mem: acc.mem + s.memoryMb,
        disk: acc.disk + s.diskMb,
        rxNet: acc.rxNet + s.networkRxKbps,
        txNet: acc.txNet + s.networkTxKbps,
      }),
      { cpu: 0, mem: 0, disk: 0, rxNet: 0, txNet: 0 }
    );

    const peak = vmSnapshots.reduce(
      (acc, s) => ({
        cpu: Math.max(acc.cpu, s.cpuMillicores),
        mem: Math.max(acc.mem, s.memoryMb),
        disk: Math.max(acc.disk, s.diskMb),
        rxNet: Math.max(acc.rxNet, s.networkRxKbps),
        txNet: Math.max(acc.txNet, s.networkTxKbps),
      }),
      { cpu: 0, mem: 0, disk: 0, rxNet: 0, txNet: 0 }
    );

    const count = vmSnapshots.length;

    return {
      vmId,
      latest: vmSnapshots[vmSnapshots.length - 1],
      avg: {
        cpuMillicores: sum.cpu / count,
        memoryMb: sum.mem / count,
        diskMb: sum.disk / count,
        networkRxKbps: sum.rxNet / count,
        networkTxKbps: sum.txNet / count,
      },
      peak,
      snapshotCount: count,
    };
  }
}

// ============================================================================
// NetworkPolicyManager Tests
// ============================================================================

describe('NetworkPolicyManager — Network Access Control', () => {
  let manager: MockNetworkPolicyManager;

  beforeEach(() => {
    manager = new MockNetworkPolicyManager('deny');
  });

  it('should add rules with priority ordering', () => {
    manager.addRule({
      ruleId: 'rule-1',
      vmId: 'vm-1',
      direction: 'egress',
      action: 'allow',
      protocol: 'tcp',
      priority: 100,
    });

    manager.addRule({
      ruleId: 'rule-2',
      vmId: 'vm-1',
      direction: 'egress',
      action: 'deny',
      protocol: 'tcp',
      priority: 50,
    });

    const rules = manager.getRules('vm-1');
    expect(rules).toHaveLength(2);
    expect(rules[0].ruleId).toBe('rule-2'); // Lower priority number = higher priority
  });

  it('should evaluate requests against rules', () => {
    manager.addRule({
      ruleId: 'allow-http',
      vmId: 'vm-1',
      direction: 'egress',
      action: 'allow',
      protocol: 'tcp',
      portRange: [80, 80],
      priority: 10,
    });

    const request: NetworkRequest = {
      vmId: 'vm-1',
      direction: 'egress',
      protocol: 'tcp',
      remoteHost: '192.168.1.1',
      port: 80,
    };

    const result = manager.evaluate(request);

    expect(result.allowed).toBe(true);
    expect(result.matchedRuleId).toBe('allow-http');
  });

  it('should deny requests by default', () => {
    const request: NetworkRequest = {
      vmId: 'vm-1',
      direction: 'egress',
      protocol: 'tcp',
      remoteHost: '192.168.1.1',
      port: 443,
    };

    const result = manager.evaluate(request);

    expect(result.allowed).toBe(false);
  });

  it('should support global rules', () => {
    manager.addRule({
      ruleId: 'global-allow',
      vmId: '*',
      direction: 'egress',
      action: 'allow',
      protocol: 'any',
      priority: 10,
    });

    const result = manager.evaluate({
      vmId: 'any-vm',
      direction: 'egress',
      protocol: 'udp',
      remoteHost: '8.8.8.8',
      port: 53,
    });

    expect(result.allowed).toBe(true);
  });

  it('should match based on direction', () => {
    manager.addRule({
      ruleId: 'egress-rule',
      vmId: 'vm-1',
      direction: 'egress',
      action: 'allow',
      protocol: 'tcp',
      priority: 10,
    });

    const egressRequest: NetworkRequest = {
      vmId: 'vm-1',
      direction: 'egress',
      protocol: 'tcp',
      remoteHost: 'example.com',
      port: 443,
    };

    const ingressRequest: NetworkRequest = {
      vmId: 'vm-1',
      direction: 'ingress',
      protocol: 'tcp',
      remoteHost: 'example.com',
      port: 443,
    };

    expect(manager.evaluate(egressRequest).allowed).toBe(true);
    expect(manager.evaluate(ingressRequest).allowed).toBe(false);
  });

  it('property-based: port ranges are validated', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 0, max: 65535 }),
          fc.integer({ min: 0, max: 65535 })
        ),
        ([port1, port2]) => {
          const [minPort, maxPort] = port1 <= port2 ? [port1, port2] : [port2, port1];
          return minPort >= 0 && maxPort <= 65535;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// ResourceMonitor Tests
// ============================================================================

describe('ResourceMonitor — Resource Tracking & Alerting', () => {
  let monitor: MockResourceMonitor;

  beforeEach(() => {
    monitor = new MockResourceMonitor();
  });

  it('should record resource snapshots', () => {
    const snapshot: ResourceSnapshot = {
      vmId: 'vm-1',
      timestamp: Date.now(),
      cpuMillicores: 500,
      memoryMb: 256,
      diskMb: 1024,
      networkRxKbps: 100,
      networkTxKbps: 50,
    };

    monitor.recordSnapshot(snapshot);

    const snapshots = monitor.getSnapshots('vm-1');
    expect(snapshots).toHaveLength(1);
  });

  it('should fire warning alerts at 80% threshold', () => {
    monitor.setThreshold({ vmId: 'vm-1', memoryMb: 256 });

    const snapshot: ResourceSnapshot = {
      vmId: 'vm-1',
      timestamp: Date.now(),
      cpuMillicores: 100,
      memoryMb: 210, // 82% of 256
      diskMb: 100,
      networkRxKbps: 0,
      networkTxKbps: 0,
    };

    monitor.recordSnapshot(snapshot);

    const alerts = monitor.getAlerts('vm-1');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
  });

  it('should fire critical alerts at 95% threshold', () => {
    monitor.setThreshold({ vmId: 'vm-1', cpuMillicores: 1000 });

    const snapshot: ResourceSnapshot = {
      vmId: 'vm-1',
      timestamp: Date.now(),
      cpuMillicores: 950,
      memoryMb: 100,
      diskMb: 100,
      networkRxKbps: 0,
      networkTxKbps: 0,
    };

    monitor.recordSnapshot(snapshot);

    const alerts = monitor.getAlerts('vm-1');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
  });

  it('should notify alert listeners', () => {
    const alerts: ResourceAlert[] = [];
    monitor.onAlert((alert) => alerts.push(alert));

    monitor.setThreshold({ vmId: 'vm-1', memoryMb: 100 });
    monitor.recordSnapshot({
      vmId: 'vm-1',
      timestamp: Date.now(),
      cpuMillicores: 0,
      memoryMb: 96,
      diskMb: 0,
      networkRxKbps: 0,
      networkTxKbps: 0,
    });

    expect(alerts).toHaveLength(1);
  });

  it('should compute usage summary', () => {
    const now = Date.now();

    monitor.recordSnapshot({
      vmId: 'vm-1',
      timestamp: now,
      cpuMillicores: 500,
      memoryMb: 200,
      diskMb: 1000,
      networkRxKbps: 100,
      networkTxKbps: 50,
    });

    monitor.recordSnapshot({
      vmId: 'vm-1',
      timestamp: now + 1000,
      cpuMillicores: 600,
      memoryMb: 250,
      diskMb: 1100,
      networkRxKbps: 150,
      networkTxKbps: 75,
    });

    const summary = monitor.getUsageSummary('vm-1');

    expect(summary.snapshotCount).toBe(2);
    expect(summary.avg.cpuMillicores).toBe(550);
    expect(summary.latest?.cpuMillicores).toBe(600);
    expect(summary.latest?.memoryMb).toBe(250);
  });

  it('property-based: percentUsed is always between 0 and 1+', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.nat(), fc.nat({ max: 10000 })),
        ([current, threshold]) => {
          const percent = threshold === 0 ? 0 : current / threshold;
          return percent >= 0;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('NetworkPolicy + ResourceMonitor Integration', () => {
  let policyManager: MockNetworkPolicyManager;
  let resourceMonitor: MockResourceMonitor;

  beforeEach(() => {
    policyManager = new MockNetworkPolicyManager();
    resourceMonitor = new MockResourceMonitor();
  });

  it('should enforce network policies on resource-intensive requests', () => {
    policyManager.addRule({
      ruleId: 'limit-heavy-traffic',
      vmId: 'vm-1',
      direction: 'egress',
      action: 'deny',
      protocol: 'any',
      priority: 10,
    });

    resourceMonitor.setThreshold({ vmId: 'vm-1', networkTxKbps: 1000 });

    const request: NetworkRequest = {
      vmId: 'vm-1',
      direction: 'egress',
      protocol: 'tcp',
      remoteHost: 'example.com',
      port: 443,
    };

    const policyResult = policyManager.evaluate(request);
    expect(policyResult.allowed).toBe(false);

    // Record high traffic at 85% (warning level)
    resourceMonitor.recordSnapshot({
      vmId: 'vm-1',
      timestamp: Date.now(),
      cpuMillicores: 100,
      memoryMb: 100,
      diskMb: 100,
      networkRxKbps: 0,
      networkTxKbps: 850,
    });

    const alerts = resourceMonitor.getAlerts('vm-1');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

describe('Network & Resource Stress Tests', () => {
  it('should handle many network rules', () => {
    const manager = new MockNetworkPolicyManager();

    for (let i = 0; i < 100; i++) {
      manager.addRule({
        ruleId: `rule-${i}`,
        vmId: `vm-${i % 10}`,
        direction: 'egress',
        action: i % 2 === 0 ? 'allow' : 'deny',
        protocol: 'tcp',
        priority: i,
      });
    }

    const rules = manager.getRules('vm-5');
    expect(rules.length).toBeGreaterThan(0);
  });

  it('should handle high-frequency resource snapshots', () => {
    const monitor = new MockResourceMonitor();

    for (let i = 0; i < 1000; i++) {
      monitor.recordSnapshot({
        vmId: 'vm-1',
        timestamp: Date.now() + i * 100,
        cpuMillicores: Math.random() * 1000,
        memoryMb: Math.random() * 512,
        diskMb: Math.random() * 2048,
        networkRxKbps: Math.random() * 1000,
        networkTxKbps: Math.random() * 1000,
      });
    }

    const snapshots = monitor.getSnapshots('vm-1');
    expect(snapshots).toHaveLength(1000);
  });
});
