// Eternal Engine Bridge Tests - K3-27
import { describe, it, expect, beforeEach } from 'vitest';
import {
  EternalEngineBridge,
  createEternalEngineBridge,
} from './eternal-engine-bridge.js';
import type { HarnessState } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeState(id: string): HarnessState {
  return {
    schemaVersion: 1,
    config: {
      id,
      name: 'Bridge Test Harness',
      agentId: 'agent-y',
      task: 'bridge test',
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

describe('EternalEngineBridge', () => {
  let bridge: EternalEngineBridge;

  beforeEach(() => {
    bridge = createEternalEngineBridge();
  });

  describe('isAvailable()', () => {
    it('always returns true (memory fallback)', () => {
      expect(bridge.isAvailable()).toBe(true);
    });
  });

  describe('persist()', () => {
    it('persists state and reports success', async () => {
      const result = await bridge.persist(makeState('br-1'));
      expect(result.success).toBe(true);
    });

    it('falls back to memory backend when Rust FFI unavailable', async () => {
      const result = await bridge.persist(makeState('br-2'));
      expect(result.backend).toBe('memory');
    });

    it('persists multiple states independently', async () => {
      await bridge.persist(makeState('m1'));
      await bridge.persist(makeState('m2'));
      const r1 = await bridge.restore('m1');
      const r2 = await bridge.restore('m2');
      expect(r1.state?.config.id).toBe('m1');
      expect(r2.state?.config.id).toBe('m2');
    });
  });

  describe('restore()', () => {
    it('returns null state for unknown id', async () => {
      const result = await bridge.restore('ghost');
      expect(result.state).toBeNull();
    });

    it('restores persisted state correctly', async () => {
      const state = makeState('br-restore');
      await bridge.persist(state);
      const result = await bridge.restore('br-restore');
      expect(result.state).not.toBeNull();
      expect(result.state?.config.id).toBe('br-restore');
      expect(result.backend).toBe('memory');
    });

    it('restores status field correctly', async () => {
      const state = makeState('br-status');
      state.status = 'completed';
      await bridge.persist(state);
      const result = await bridge.restore('br-status');
      expect(result.state?.status).toBe('completed');
    });
  });

  describe('delete()', () => {
    it('returns false for non-existent id', async () => {
      expect(await bridge.delete('ghost')).toBe(false);
    });

    it('deletes persisted state and returns true', async () => {
      await bridge.persist(makeState('br-del'));
      expect(await bridge.delete('br-del')).toBe(true);
    });

    it('state not recoverable after deletion', async () => {
      await bridge.persist(makeState('br-gone'));
      await bridge.delete('br-gone');
      const result = await bridge.restore('br-gone');
      expect(result.state).toBeNull();
    });
  });

  describe('list()', () => {
    it('returns empty list when no states persisted', async () => {
      expect(await bridge.list()).toEqual([]);
    });

    it('lists all persisted ids', async () => {
      await bridge.persist(makeState('l1'));
      await bridge.persist(makeState('l2'));
      await bridge.persist(makeState('l3'));
      const ids = await bridge.list();
      expect(ids.sort()).toEqual(['l1', 'l2', 'l3']);
    });

    it('excludes deleted ids', async () => {
      await bridge.persist(makeState('keep'));
      await bridge.persist(makeState('drop'));
      await bridge.delete('drop');
      const ids = await bridge.list();
      expect(ids).toContain('keep');
      expect(ids).not.toContain('drop');
    });
  });

  describe('round-trip integrity', () => {
    it('preserves toolCallCount and cost across persist/restore', async () => {
      const state = makeState('integrity');
      state.toolCallCount = 42;
      state.cost = 3.14;
      await bridge.persist(state);
      const { state: restored } = await bridge.restore('integrity');
      expect(restored?.toolCallCount).toBe(42);
      expect(restored?.cost).toBe(3.14);
    });
  });
});
