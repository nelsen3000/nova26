// S3-26: Infrastructure Observability Bridge
// Wires hypercore / hypervisor / A2A error events into TelemetryCollector.

import type { ObservabilityLogger } from '../hypercore/observability.js';
import type { HypervisorObserver } from '../hypervisor/observability.js';
import type { A2AObservability } from '../a2a/observability.js';
import {
  TelemetryCollector,
  getGlobalTelemetryCollector,
} from './telemetry-collector.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface InfrastructureBridgeOptions {
  /** Hypercore observability logger — error events are forwarded to telemetry */
  hypercore?: ObservabilityLogger;
  /** Hypervisor observer — vm-error and security-violation events are forwarded */
  hypervisor?: HypervisorObserver;
  /** A2A observability — routing-failed events are forwarded */
  a2a?: A2AObservability;
  /**
   * TelemetryCollector to receive events.
   * Defaults to the global collector returned by getGlobalTelemetryCollector().
   */
  telemetry?: TelemetryCollector;
}

export interface InfrastructureBridge {
  /** Disconnect all event listeners from the underlying modules. */
  dispose(): void;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create an InfrastructureBridge that listens to error events from
 * hypercore / hypervisor / A2A modules and forwards them to TelemetryCollector.
 */
export function createInfrastructureBridge(
  options: InfrastructureBridgeOptions = {},
): InfrastructureBridge {
  const telemetry = options.telemetry ?? getGlobalTelemetryCollector();
  const cleanupFns: Array<() => void> = [];

  // ── Hypercore ──────────────────────────────────────────────────────────────
  if (options.hypercore) {
    const unsub = options.hypercore.on((event) => {
      if (event.eventType === 'error') {
        telemetry.recordError({
          errorType: event.errorCode ?? 'hypercore-error',
          count: 1,
          context: `hypercore:${event.logName}`,
        });
      }
    });
    cleanupFns.push(unsub);
  }

  // ── Hypervisor ────────────────────────────────────────────────────────────
  if (options.hypervisor) {
    const unsub = options.hypervisor.onEvent((event) => {
      if (event.eventType === 'error') {
        telemetry.recordError({
          errorType: 'hypervisor-error',
          count: 1,
          context: `hypervisor:vm:${event.vmId ?? 'unknown'}`,
        });
      } else if (event.eventType === 'security-violation') {
        telemetry.recordError({
          errorType: 'hypervisor-security-violation',
          count: 1,
          context: `hypervisor:security:${event.vmId ?? 'unknown'}`,
        });
      }
    });
    cleanupFns.push(unsub);
  }

  // ── A2A ───────────────────────────────────────────────────────────────────
  if (options.a2a) {
    const unsub = options.a2a.on((event) => {
      if (event.eventType === 'routing-failed') {
        telemetry.recordError({
          errorType: 'a2a-routing-failure',
          count: 1,
          context: `a2a:${event.agentId ?? 'unknown'}->${event.targetAgentId ?? 'broadcast'}`,
        });
      }
    });
    cleanupFns.push(unsub);
  }

  return {
    dispose(): void {
      for (const fn of cleanupFns) fn();
      cleanupFns.length = 0;
    },
  };
}
