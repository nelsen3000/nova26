// Hypervisor Hypercore Bridge — Routes VM events to Hypercore append-only audit log
// Sprint S2-16 | Hypervisor Integration (Reel 2)

import type { HypercoreStore } from '../hypercore/store.js';
import type { HypervisorAuditEvent } from './types.js';
import { HypervisorAuditEventSchema } from './types.js';

// ─── Bridge entry stored in Hypercore ─────────────────────────────────────────

export interface HypercoreBridgeEntry {
  source: 'hypervisor';
  vmId?: string;
  agentId?: string;
  event: HypervisorAuditEvent;
}

export interface BridgeStats {
  totalEventsLogged: number;
  eventsByType: Record<string, number>;
  attachedVMs: number;
  storeLength: number;
}

/**
 * HypercoreBridge — persists hypervisor audit events to a Hypercore append-only log.
 *
 * Each VM can be attached to a shared store. Events are validated via Zod before
 * being written, ensuring the audit log only contains well-formed entries.
 */
export class HypercoreBridge {
  private store: HypercoreStore;
  private attachedVMs = new Set<string>();
  private eventCounts = new Map<string, number>();
  private totalEvents = 0;

  constructor(store: HypercoreStore) {
    this.store = store;
  }

  /**
   * Attach a VM to this bridge so its events get logged.
   */
  attachVM(vmId: string): void {
    this.attachedVMs.add(vmId);
  }

  /**
   * Detach a VM from this bridge (stop logging its events).
   */
  detachVM(vmId: string): void {
    this.attachedVMs.delete(vmId);
  }

  /**
   * Check if a VM is attached.
   */
  isAttached(vmId: string): boolean {
    return this.attachedVMs.has(vmId);
  }

  /**
   * Log a hypervisor audit event to the Hypercore store.
   * Validates the event and skips logging for detached VMs (unless no vmId).
   */
  logEvent(rawEvent: Omit<HypervisorAuditEvent, 'timestamp'> & { timestamp?: number }): void {
    const event = HypervisorAuditEventSchema.parse({ timestamp: Date.now(), ...rawEvent });

    // Skip if vmId is specified and VM is not attached
    if (event.vmId && !this.attachedVMs.has(event.vmId)) return;

    const entry: HypercoreBridgeEntry = {
      source: 'hypervisor',
      vmId: event.vmId,
      agentId: event.agentId,
      event,
    };

    this.store.append(entry);
    this.totalEvents++;
    const count = this.eventCounts.get(event.eventType) ?? 0;
    this.eventCounts.set(event.eventType, count + 1);
  }

  /**
   * Read all logged events from the Hypercore store.
   * Returns events in chronological order (oldest first).
   */
  readAllEvents(): HypervisorAuditEvent[] {
    const events: HypervisorAuditEvent[] = [];
    const length = this.store.length();

    for (let i = 0; i < length; i++) {
      const storeEntry = this.store.get(i);
      if (storeEntry && this.isHypercoreBridgeEntry(storeEntry.data)) {
        events.push(storeEntry.data.event);
      }
    }

    return events;
  }

  /**
   * Read events for a specific VM.
   */
  readVMEvents(vmId: string): HypervisorAuditEvent[] {
    return this.readAllEvents().filter(e => e.vmId === vmId);
  }

  /**
   * Read events of a specific type.
   */
  readEventsByType(eventType: HypervisorAuditEvent['eventType']): HypervisorAuditEvent[] {
    return this.readAllEvents().filter(e => e.eventType === eventType);
  }

  /**
   * Sync all attached VM events (replays from log — useful after replication).
   */
  syncAll(): { synced: number; errors: number } {
    const all = this.readAllEvents();
    let synced = 0, errors = 0;
    for (const event of all) {
      try {
        const parsed = HypervisorAuditEventSchema.safeParse(event);
        if (parsed.success) synced++;
        else errors++;
      } catch {
        errors++;
      }
    }
    return { synced, errors };
  }

  /**
   * Get bridge statistics.
   */
  getStats(): BridgeStats {
    const eventsByType: Record<string, number> = {};
    for (const [k, v] of this.eventCounts) eventsByType[k] = v;

    return {
      totalEventsLogged: this.totalEvents,
      eventsByType,
      attachedVMs: this.attachedVMs.size,
      storeLength: this.store.length(),
    };
  }

  /**
   * List all attached VM IDs.
   */
  listAttachedVMs(): string[] {
    return [...this.attachedVMs];
  }

  private isHypercoreBridgeEntry(entry: unknown): entry is HypercoreBridgeEntry {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      (entry as HypercoreBridgeEntry).source === 'hypervisor' &&
      typeof (entry as HypercoreBridgeEntry).event === 'object'
    );
  }
}
