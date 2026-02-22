// S3-26: Infrastructure Observability Bridge Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInfrastructureBridge,
} from '../infrastructure-bridge.js';
import {
  TelemetryCollector,
} from '../telemetry-collector.js';
import { ObservabilityLogger } from '../../hypercore/observability.js';
import { HypervisorObserver } from '../../hypervisor/observability.js';
import { A2AObservability } from '../../a2a/observability.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTelemetry() {
  return new TelemetryCollector({ enabled: true });
}

// ─── Hypercore wiring ─────────────────────────────────────────────────────────

describe('createInfrastructureBridge — hypercore', () => {
  let telemetry: TelemetryCollector;
  let logger: ObservabilityLogger;

  beforeEach(() => {
    telemetry = makeTelemetry();
    logger = new ObservabilityLogger();
  });

  it('forwards hypercore error events to telemetry', () => {
    createInfrastructureBridge({ hypercore: logger, telemetry });

    logger.record({ eventType: 'error', logName: 'main', errorCode: 'ERR_IO', message: 'disk full' });

    const events = telemetry.getPendingEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].data['errorType']).toBe('ERR_IO');
    expect(events[0].data['context']).toBe('hypercore:main');
  });

  it('does not forward non-error hypercore events', () => {
    createInfrastructureBridge({ hypercore: logger, telemetry });

    logger.record({ eventType: 'append', logName: 'main', seq: 1, bytes: 42 });
    logger.record({ eventType: 'replicate', logName: 'main', peerId: 'peer-1', direction: 'send' });

    expect(telemetry.getPendingEvents()).toHaveLength(0);
  });

  it('uses generic error type when errorCode is absent', () => {
    createInfrastructureBridge({ hypercore: logger, telemetry });

    logger.record({ eventType: 'error', logName: 'secondary' });

    const events = telemetry.getPendingEvents();
    expect(events[0].data['errorType']).toBe('hypercore-error');
  });

  it('dispose stops forwarding hypercore events', () => {
    const bridge = createInfrastructureBridge({ hypercore: logger, telemetry });
    bridge.dispose();

    logger.record({ eventType: 'error', logName: 'main' });

    expect(telemetry.getPendingEvents()).toHaveLength(0);
  });
});

// ─── Hypervisor wiring ────────────────────────────────────────────────────────

describe('createInfrastructureBridge — hypervisor', () => {
  let telemetry: TelemetryCollector;
  let observer: HypervisorObserver;

  beforeEach(() => {
    telemetry = makeTelemetry();
    observer = new HypervisorObserver();
  });

  it('forwards hypervisor error events to telemetry', () => {
    createInfrastructureBridge({ hypervisor: observer, telemetry });

    observer.recordEvent({ eventType: 'error', vmId: 'vm-1', details: { message: 'OOM' }, severity: 'error' });

    const events = telemetry.getPendingEvents();
    expect(events).toHaveLength(1);
    expect(events[0].data['errorType']).toBe('hypervisor-error');
    expect(events[0].data['context']).toBe('hypervisor:vm:vm-1');
  });

  it('forwards hypervisor security-violation events to telemetry', () => {
    createInfrastructureBridge({ hypervisor: observer, telemetry });

    observer.recordEvent({ eventType: 'security-violation', vmId: 'vm-2', details: { reason: 'escape attempt' }, severity: 'error' });

    const events = telemetry.getPendingEvents();
    expect(events).toHaveLength(1);
    expect(events[0].data['errorType']).toBe('hypervisor-security-violation');
    expect(events[0].data['context']).toBe('hypervisor:security:vm-2');
  });

  it('does not forward vm-spawned events', () => {
    createInfrastructureBridge({ hypervisor: observer, telemetry });

    observer.recordEvent({ eventType: 'vm-spawned', vmId: 'vm-3', details: {}, severity: 'info' });

    expect(telemetry.getPendingEvents()).toHaveLength(0);
  });

  it('dispose stops forwarding hypervisor events', () => {
    const bridge = createInfrastructureBridge({ hypervisor: observer, telemetry });
    bridge.dispose();

    observer.recordEvent({ eventType: 'error', vmId: 'vm-4', details: {}, severity: 'error' });

    expect(telemetry.getPendingEvents()).toHaveLength(0);
  });
});

// ─── A2A wiring ───────────────────────────────────────────────────────────────

describe('createInfrastructureBridge — a2a', () => {
  let telemetry: TelemetryCollector;
  let a2a: A2AObservability;

  beforeEach(() => {
    telemetry = makeTelemetry();
    a2a = new A2AObservability();
  });

  it('forwards a2a routing-failed events to telemetry', () => {
    createInfrastructureBridge({ a2a, telemetry });

    a2a.emit({ eventType: 'routing-failed', agentId: 'agent-A', targetAgentId: 'agent-B', error: 'not found' });

    const events = telemetry.getPendingEvents();
    expect(events).toHaveLength(1);
    expect(events[0].data['errorType']).toBe('a2a-routing-failure');
    expect(events[0].data['context']).toBe('a2a:agent-A->agent-B');
  });

  it('does not forward message-sent events', () => {
    createInfrastructureBridge({ a2a, telemetry });

    a2a.emit({ eventType: 'message-sent', agentId: 'agent-A', targetAgentId: 'agent-B' });

    expect(telemetry.getPendingEvents()).toHaveLength(0);
  });

  it('dispose stops forwarding a2a events', () => {
    const bridge = createInfrastructureBridge({ a2a, telemetry });
    bridge.dispose();

    a2a.emit({ eventType: 'routing-failed', agentId: 'agent-X' });

    expect(telemetry.getPendingEvents()).toHaveLength(0);
  });
});

// ─── Multi-source ─────────────────────────────────────────────────────────────

describe('createInfrastructureBridge — multi-source', () => {
  it('aggregates errors from all three modules', () => {
    const telemetry = makeTelemetry();
    const logger = new ObservabilityLogger();
    const observer = new HypervisorObserver();
    const a2a = new A2AObservability();

    createInfrastructureBridge({ hypercore: logger, hypervisor: observer, a2a, telemetry });

    logger.record({ eventType: 'error', logName: 'main' });
    observer.recordEvent({ eventType: 'error', vmId: 'vm-1', details: {}, severity: 'error' });
    a2a.emit({ eventType: 'routing-failed', agentId: 'agent-A' });

    expect(telemetry.getPendingEvents()).toHaveLength(3);
  });

  it('dispose cleans up all listeners', () => {
    const telemetry = makeTelemetry();
    const logger = new ObservabilityLogger();
    const observer = new HypervisorObserver();
    const a2a = new A2AObservability();

    const bridge = createInfrastructureBridge({ hypercore: logger, hypervisor: observer, a2a, telemetry });
    bridge.dispose();

    logger.record({ eventType: 'error', logName: 'main' });
    observer.recordEvent({ eventType: 'error', vmId: 'vm-1', details: {}, severity: 'error' });
    a2a.emit({ eventType: 'routing-failed' });

    expect(telemetry.getPendingEvents()).toHaveLength(0);
  });

  it('works with no options (empty bridge)', () => {
    expect(() => createInfrastructureBridge()).not.toThrow();
  });
});
