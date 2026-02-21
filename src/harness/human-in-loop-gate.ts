// Human-in-Loop Gate - K3-29
// Gate management with autonomy level logic
// Autonomy 1-2: gate all actions, 3: gate critical only, 4-5: no gates
// Spec: .kiro/specs/agent-harnesses/tasks.md

import type { HarnessState, HumanGateRequest, HumanGateResponse } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface GateEntry {
  request: HumanGateRequest;
  response?: HumanGateResponse;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  createdAt: number;
  resolvedAt?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Human-in-Loop Gate
// ═══════════════════════════════════════════════════════════════════════════════

export class HumanInLoopGate {
  private gates = new Map<string, GateEntry>();
  private pendingResolvers = new Map<string, {
    resolve: (response: HumanGateResponse) => void;
    reject: (err: Error) => void;
  }>();

  /**
   * Determine whether a gate should be placed for the given autonomy level and criticality.
   * Autonomy 1-2: always gate
   * Autonomy 3: gate critical actions only
   * Autonomy 4-5: never gate
   */
  static shouldGate(autonomyLevel: number, isCritical: boolean): boolean {
    if (autonomyLevel <= 2) return true;
    if (autonomyLevel === 3) return isCritical;
    return false; // 4-5: no gates
  }

  /**
   * Create a gate request and suspend execution until approved/rejected.
   * Returns the human's decision.
   */
  async requestApproval(
    stepId: string,
    reason: string,
    proposedAction: string,
    stateSnapshot: HarnessState
  ): Promise<HumanGateResponse> {
    const gateId = `gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const request: HumanGateRequest = {
      id: gateId,
      stepId,
      reason,
      stateSnapshot,
      proposedAction,
      timestamp: Date.now(),
    };

    const entry: GateEntry = {
      request,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.gates.set(gateId, entry);

    // Return a promise that resolves when a human responds
    return new Promise<HumanGateResponse>((resolve, reject) => {
      this.pendingResolvers.set(gateId, { resolve, reject });
    });
  }

  /**
   * Check if a gate is pending (awaiting human decision).
   */
  isPending(gateId: string): boolean {
    const entry = this.gates.get(gateId);
    return entry?.status === 'pending' ?? false;
  }

  /**
   * Get all pending gate IDs.
   */
  getPendingGates(): HumanGateRequest[] {
    const pending: HumanGateRequest[] = [];
    for (const entry of this.gates.values()) {
      if (entry.status === 'pending') {
        pending.push(entry.request);
      }
    }
    return pending;
  }

  /**
   * Approve a pending gate.
   */
  approve(gateId: string, respondedBy?: string): void {
    const entry = this.gates.get(gateId);
    if (!entry || entry.status !== 'pending') {
      throw new Error(`Gate "${gateId}" is not pending`);
    }

    const response: HumanGateResponse = {
      gateId,
      decision: 'approve',
      respondedBy,
      respondedAt: Date.now(),
    };

    entry.response = response;
    entry.status = 'approved';
    entry.resolvedAt = Date.now();

    const resolver = this.pendingResolvers.get(gateId);
    if (resolver) {
      resolver.resolve(response);
      this.pendingResolvers.delete(gateId);
    }
  }

  /**
   * Reject a pending gate with a reason.
   */
  reject(gateId: string, reason: string, respondedBy?: string): void {
    const entry = this.gates.get(gateId);
    if (!entry || entry.status !== 'pending') {
      throw new Error(`Gate "${gateId}" is not pending`);
    }

    const response: HumanGateResponse = {
      gateId,
      decision: 'reject',
      rejectionReason: reason,
      respondedBy,
      respondedAt: Date.now(),
    };

    entry.response = response;
    entry.status = 'rejected';
    entry.resolvedAt = Date.now();

    const resolver = this.pendingResolvers.get(gateId);
    if (resolver) {
      resolver.resolve(response);
      this.pendingResolvers.delete(gateId);
    }
  }

  /**
   * Approve with modifications.
   */
  modify(gateId: string, modification: string, respondedBy?: string): void {
    const entry = this.gates.get(gateId);
    if (!entry || entry.status !== 'pending') {
      throw new Error(`Gate "${gateId}" is not pending`);
    }

    const response: HumanGateResponse = {
      gateId,
      decision: 'modify',
      modification,
      respondedBy,
      respondedAt: Date.now(),
    };

    entry.response = response;
    entry.status = 'modified';
    entry.resolvedAt = Date.now();

    const resolver = this.pendingResolvers.get(gateId);
    if (resolver) {
      resolver.resolve(response);
      this.pendingResolvers.delete(gateId);
    }
  }

  /**
   * Cancel (reject with timeout) a pending gate.
   */
  timeout(gateId: string): void {
    const entry = this.gates.get(gateId);
    if (!entry || entry.status !== 'pending') return;

    const resolver = this.pendingResolvers.get(gateId);
    if (resolver) {
      resolver.reject(new Error(`Gate "${gateId}" timed out`));
      this.pendingResolvers.delete(gateId);
    }

    entry.status = 'rejected';
    entry.resolvedAt = Date.now();
  }

  /**
   * Get a gate entry by ID.
   */
  getGate(gateId: string): GateEntry | undefined {
    return this.gates.get(gateId);
  }

  /**
   * Get all gate entries.
   */
  listGates(): GateEntry[] {
    return Array.from(this.gates.values());
  }

  /**
   * Count pending gates.
   */
  pendingCount(): number {
    let count = 0;
    for (const entry of this.gates.values()) {
      if (entry.status === 'pending') count++;
    }
    return count;
  }

  /**
   * Clear all resolved gates.
   */
  clearResolved(): void {
    for (const [id, entry] of this.gates) {
      if (entry.status !== 'pending') {
        this.gates.delete(id);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createHumanInLoopGate(): HumanInLoopGate {
  return new HumanInLoopGate();
}
