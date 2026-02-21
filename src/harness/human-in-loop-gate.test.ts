// Human-in-Loop Gate Tests - K3-29
import { describe, it, expect, beforeEach } from 'vitest';
import {
  HumanInLoopGate,
  createHumanInLoopGate,
} from './human-in-loop-gate.js';
import type { HarnessState } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSnapshot(id: string): HarnessState {
  return {
    schemaVersion: 1,
    config: {
      id,
      name: 'Gate Test',
      agentId: 'agent-gate',
      task: 'gate test',
      priority: 'normal',
      timeoutMs: 0,
      maxRetries: 1,
      autonomyLevel: 3,
      maxDepth: 1,
      depth: 0,
      allowedTools: [],
      budget: { maxToolCalls: 10, maxTokens: 1000, maxCost: 1 },
      checkpointIntervalMs: 30000,
      dreamModeEnabled: false,
      overnightEvolutionEnabled: false,
    },
    status: 'running',
    createdAt: Date.now(),
    currentStepIndex: 0,
    toolCallHistory: [],
    subAgentIds: [],
    toolCallCount: 0,
    tokenCount: 0,
    cost: 0,
    retryCount: 0,
    context: {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HumanInLoopGate.shouldGate()', () => {
  it('gates at autonomy 1', () => {
    expect(HumanInLoopGate.shouldGate(1, false)).toBe(true);
    expect(HumanInLoopGate.shouldGate(1, true)).toBe(true);
  });

  it('gates at autonomy 2', () => {
    expect(HumanInLoopGate.shouldGate(2, false)).toBe(true);
    expect(HumanInLoopGate.shouldGate(2, true)).toBe(true);
  });

  it('gates only critical at autonomy 3', () => {
    expect(HumanInLoopGate.shouldGate(3, false)).toBe(false);
    expect(HumanInLoopGate.shouldGate(3, true)).toBe(true);
  });

  it('never gates at autonomy 4', () => {
    expect(HumanInLoopGate.shouldGate(4, false)).toBe(false);
    expect(HumanInLoopGate.shouldGate(4, true)).toBe(false);
  });

  it('never gates at autonomy 5', () => {
    expect(HumanInLoopGate.shouldGate(5, false)).toBe(false);
    expect(HumanInLoopGate.shouldGate(5, true)).toBe(false);
  });
});

describe('HumanInLoopGate', () => {
  let gate: HumanInLoopGate;

  beforeEach(() => {
    gate = createHumanInLoopGate();
  });

  describe('requestApproval()', () => {
    it('creates a pending gate entry', async () => {
      const snapshot = makeSnapshot('h1');
      const promise = gate.requestApproval('step-1', 'needs review', 'delete file', snapshot);
      expect(gate.pendingCount()).toBe(1);
      // resolve it to avoid hanging
      const [request] = gate.getPendingGates();
      gate.approve(request.id);
      await promise;
    });

    it('returns a promise that resolves on approve', async () => {
      const snapshot = makeSnapshot('h1');
      const promise = gate.requestApproval('step-1', 'reason', 'action', snapshot);
      const [req] = gate.getPendingGates();
      gate.approve(req.id, 'admin');
      const response = await promise;
      expect(response.decision).toBe('approve');
      expect(response.respondedBy).toBe('admin');
    });

    it('returns a promise that resolves on reject', async () => {
      const snapshot = makeSnapshot('h1');
      const promise = gate.requestApproval('step-1', 'reason', 'action', snapshot);
      const [req] = gate.getPendingGates();
      gate.reject(req.id, 'not safe');
      const response = await promise;
      expect(response.decision).toBe('reject');
      expect(response.rejectionReason).toBe('not safe');
    });

    it('returns a promise that resolves on modify', async () => {
      const snapshot = makeSnapshot('h1');
      const promise = gate.requestApproval('step-1', 'reason', 'action', snapshot);
      const [req] = gate.getPendingGates();
      gate.modify(req.id, 'use safer approach');
      const response = await promise;
      expect(response.decision).toBe('modify');
      expect(response.modification).toBe('use safer approach');
    });
  });

  describe('isPending()', () => {
    it('returns true for pending gate', async () => {
      const snapshot = makeSnapshot('h1');
      gate.requestApproval('s1', 'r', 'a', snapshot);
      const [req] = gate.getPendingGates();
      expect(gate.isPending(req.id)).toBe(true);
      gate.approve(req.id);
    });

    it('returns false for non-existent gate', () => {
      expect(gate.isPending('ghost')).toBe(false);
    });

    it('returns false after resolution', async () => {
      const snapshot = makeSnapshot('h1');
      const promise = gate.requestApproval('s1', 'r', 'a', snapshot);
      const [req] = gate.getPendingGates();
      gate.approve(req.id);
      await promise;
      expect(gate.isPending(req.id)).toBe(false);
    });
  });

  describe('getPendingGates()', () => {
    it('returns empty array initially', () => {
      expect(gate.getPendingGates()).toEqual([]);
    });

    it('returns pending gate requests', async () => {
      const snapshot = makeSnapshot('h1');
      gate.requestApproval('s1', 'r1', 'a1', snapshot);
      gate.requestApproval('s2', 'r2', 'a2', snapshot);
      expect(gate.getPendingGates()).toHaveLength(2);
      for (const req of gate.getPendingGates()) {
        gate.approve(req.id);
      }
    });
  });

  describe('approve()', () => {
    it('throws when gate not pending', () => {
      expect(() => gate.approve('non-existent')).toThrow('not pending');
    });

    it('sets gate status to approved', async () => {
      const snapshot = makeSnapshot('h1');
      const promise = gate.requestApproval('s1', 'r', 'a', snapshot);
      const [req] = gate.getPendingGates();
      gate.approve(req.id);
      const entry = gate.getGate(req.id);
      expect(entry?.status).toBe('approved');
      await promise;
    });
  });

  describe('reject()', () => {
    it('throws when gate not pending', () => {
      expect(() => gate.reject('non-existent', 'reason')).toThrow('not pending');
    });

    it('sets gate status to rejected', async () => {
      const snapshot = makeSnapshot('h1');
      const promise = gate.requestApproval('s1', 'r', 'a', snapshot);
      const [req] = gate.getPendingGates();
      gate.reject(req.id, 'unsafe');
      const entry = gate.getGate(req.id);
      expect(entry?.status).toBe('rejected');
      await promise;
    });
  });

  describe('modify()', () => {
    it('sets gate status to modified', async () => {
      const snapshot = makeSnapshot('h1');
      const promise = gate.requestApproval('s1', 'r', 'a', snapshot);
      const [req] = gate.getPendingGates();
      gate.modify(req.id, 'use read-only');
      const entry = gate.getGate(req.id);
      expect(entry?.status).toBe('modified');
      await promise;
    });
  });

  describe('timeout()', () => {
    it('rejects the pending promise with timeout error', async () => {
      const snapshot = makeSnapshot('h1');
      const promise = gate.requestApproval('s1', 'r', 'a', snapshot);
      const [req] = gate.getPendingGates();
      gate.timeout(req.id);
      await expect(promise).rejects.toThrow('timed out');
    });

    it('is a no-op for non-pending gate', () => {
      expect(() => gate.timeout('ghost')).not.toThrow();
    });
  });

  describe('pendingCount()', () => {
    it('starts at 0', () => {
      expect(gate.pendingCount()).toBe(0);
    });

    it('increments on requestApproval', async () => {
      const s = makeSnapshot('h1');
      gate.requestApproval('s1', 'r', 'a', s);
      gate.requestApproval('s2', 'r', 'a', s);
      expect(gate.pendingCount()).toBe(2);
      for (const r of gate.getPendingGates()) gate.approve(r.id);
    });

    it('decrements on resolution', async () => {
      const s = makeSnapshot('h1');
      const p = gate.requestApproval('s1', 'r', 'a', s);
      const [req] = gate.getPendingGates();
      gate.approve(req.id);
      await p;
      expect(gate.pendingCount()).toBe(0);
    });
  });

  describe('clearResolved()', () => {
    it('removes resolved gates', async () => {
      const s = makeSnapshot('h1');
      const p = gate.requestApproval('s1', 'r', 'a', s);
      const [req] = gate.getPendingGates();
      gate.approve(req.id);
      await p;
      gate.clearResolved();
      expect(gate.listGates()).toHaveLength(0);
    });

    it('keeps pending gates', async () => {
      const s = makeSnapshot('h1');
      gate.requestApproval('s1', 'r', 'a', s); // pending
      gate.clearResolved();
      expect(gate.listGates()).toHaveLength(1);
      for (const r of gate.getPendingGates()) gate.approve(r.id);
    });
  });
});
