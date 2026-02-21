// Harness Manager Tests - K3-25
import { describe, it, expect, beforeEach } from 'vitest';
import {
  HarnessManager,
  createHarnessManager,
  getHarnessManager,
  resetHarnessManager,
} from './harness-manager.js';
import type { HarnessConfig, HarnessState } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(id: string, overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  return {
    id,
    name: `Harness ${id}`,
    agentId: 'agent-test',
    task: 'Test task',
    priority: 'normal',
    timeoutMs: 0,
    maxRetries: 3,
    autonomyLevel: 3,
    maxDepth: 2,
    depth: 0,
    allowedTools: ['bash', 'read'],
    budget: { maxToolCalls: 100, maxTokens: 10000, maxCost: 10 },
    checkpointIntervalMs: 60000,
    dreamModeEnabled: false,
    overnightEvolutionEnabled: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HarnessManager', () => {
  let manager: HarnessManager;

  beforeEach(() => {
    manager = createHarnessManager();
  });

  describe('create()', () => {
    it('creates and registers a harness', () => {
      const harness = manager.create(makeConfig('h1'));
      expect(harness).toBeDefined();
      expect(manager.count()).toBe(1);
    });

    it('throws on duplicate id', () => {
      manager.create(makeConfig('h1'));
      expect(() => manager.create(makeConfig('h1'))).toThrow('"h1" already exists');
    });

    it('harness state has correct id', () => {
      const harness = manager.create(makeConfig('h-abc'));
      expect(harness.getState().config.id).toBe('h-abc');
    });
  });

  describe('createWithAutoId()', () => {
    it('creates harness with unique generated id', () => {
      const { id: _id, ...rest } = makeConfig('ignored');
      const h1 = manager.createWithAutoId(rest);
      const h2 = manager.createWithAutoId(rest);
      expect(h1.getState().config.id).not.toBe(h2.getState().config.id);
      expect(manager.count()).toBe(2);
    });
  });

  describe('get()', () => {
    it('returns harness by id', () => {
      manager.create(makeConfig('h1'));
      const h = manager.get('h1');
      expect(h).toBeDefined();
      expect(h!.getState().config.id).toBe('h1');
    });

    it('returns undefined for unknown id', () => {
      expect(manager.get('missing')).toBeUndefined();
    });
  });

  describe('getOrThrow()', () => {
    it('returns harness', () => {
      manager.create(makeConfig('h1'));
      expect(() => manager.getOrThrow('h1')).not.toThrow();
    });

    it('throws for unknown id', () => {
      expect(() => manager.getOrThrow('ghost')).toThrow('"ghost" not found');
    });
  });

  describe('list()', () => {
    it('returns empty array when no harnesses', () => {
      expect(manager.list()).toEqual([]);
    });

    it('returns info for all harnesses', () => {
      manager.create(makeConfig('a'));
      manager.create(makeConfig('b'));
      const list = manager.list();
      expect(list).toHaveLength(2);
      expect(list.map(h => h.id).sort()).toEqual(['a', 'b']);
    });

    it('includes status and name', () => {
      manager.create(makeConfig('x'));
      const [info] = manager.list();
      expect(info.status).toBe('created');
      expect(info.name).toBe('Harness x');
    });
  });

  describe('stop()', () => {
    it('stops a running harness without error', async () => {
      const harness = manager.create(makeConfig('h1'));
      await harness.start();
      await expect(manager.stop('h1')).resolves.not.toThrow();
    });

    it('throws for unknown harness id', async () => {
      await expect(manager.stop('ghost')).rejects.toThrow('"ghost" not found');
    });

    it('does not throw if already stopped', async () => {
      const harness = manager.create(makeConfig('h1'));
      await harness.stop();
      await expect(manager.stop('h1')).resolves.not.toThrow();
    });
  });

  describe('resumeFromCheckpoint()', () => {
    it('restores a harness from saved state', async () => {
      const harness = manager.create(makeConfig('h1'));
      await harness.start();
      const { state } = harness.createCheckpoint();
      await harness.stop();

      const restored = manager.resumeFromCheckpoint(state as HarnessState);
      expect(restored.getState().config.id).toBe('h1');
    });

    it('replaces existing entry for same id', () => {
      manager.create(makeConfig('h1'));
      const harness2 = manager.create(makeConfig('h2'));
      const { state } = harness2.createCheckpoint();

      // Override h1 with h2's state as if it had id h1
      const stateForH1 = {
        ...(state as HarnessState),
        config: { ...(state as HarnessState).config, id: 'h1' },
      };
      manager.resumeFromCheckpoint(stateForH1);
      expect(manager.count()).toBe(2); // h1 replaced, h2 still there
    });
  });

  describe('remove()', () => {
    it('removes a harness from registry', () => {
      manager.create(makeConfig('h1'));
      expect(manager.remove('h1')).toBe(true);
      expect(manager.count()).toBe(0);
    });

    it('returns false for unknown id', () => {
      expect(manager.remove('ghost')).toBe(false);
    });
  });

  describe('count()', () => {
    it('tracks count correctly', () => {
      expect(manager.count()).toBe(0);
      manager.create(makeConfig('a'));
      expect(manager.count()).toBe(1);
      manager.create(makeConfig('b'));
      expect(manager.count()).toBe(2);
      manager.remove('a');
      expect(manager.count()).toBe(1);
    });
  });

  describe('clear()', () => {
    it('removes all harnesses', () => {
      manager.create(makeConfig('a'));
      manager.create(makeConfig('b'));
      manager.clear();
      expect(manager.count()).toBe(0);
    });
  });
});

describe('Singleton: getHarnessManager / resetHarnessManager', () => {
  beforeEach(() => {
    resetHarnessManager();
  });

  it('returns same instance on repeated calls', () => {
    const m1 = getHarnessManager();
    const m2 = getHarnessManager();
    expect(m1).toBe(m2);
  });

  it('creates fresh instance after reset', () => {
    const m1 = getHarnessManager();
    m1.create(makeConfig('x'));
    resetHarnessManager();
    const m2 = getHarnessManager();
    expect(m2.count()).toBe(0);
  });
});
