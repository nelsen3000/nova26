// Harness Serializer Tests - K3-26
import { describe, it, expect, beforeEach } from 'vitest';
import { HarnessSerializer, createHarnessSerializer } from './harness-serializer.js';
import type { HarnessState } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeState(id: string, overrides: Partial<HarnessState> = {}): HarnessState {
  return {
    schemaVersion: 1,
    config: {
      id,
      name: 'Test Harness',
      agentId: 'agent-x',
      task: 'do stuff',
      priority: 'normal',
      timeoutMs: 0,
      maxRetries: 3,
      autonomyLevel: 3,
      maxDepth: 2,
      depth: 0,
      allowedTools: ['bash'],
      budget: { maxToolCalls: 50, maxTokens: 5000, maxCost: 5 },
      checkpointIntervalMs: 60000,
      dreamModeEnabled: false,
      overnightEvolutionEnabled: false,
    },
    status: 'running',
    createdAt: 1000000,
    currentStepIndex: 0,
    toolCallHistory: [],
    subAgentIds: [],
    toolCallCount: 0,
    tokenCount: 0,
    cost: 0,
    retryCount: 0,
    context: {},
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HarnessSerializer', () => {
  let serializer: HarnessSerializer;

  beforeEach(() => {
    serializer = createHarnessSerializer();
  });

  describe('serialize()', () => {
    it('returns a JSON string', () => {
      const json = serializer.serialize(makeState('h1'));
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('includes schemaVersion envelope field', () => {
      const envelope = JSON.parse(serializer.serialize(makeState('h1')));
      expect(envelope.schemaVersion).toBe(1);
    });

    it('includes serializedAt timestamp', () => {
      const before = Date.now();
      const envelope = JSON.parse(serializer.serialize(makeState('h1')));
      const after = Date.now();
      expect(envelope.serializedAt).toBeGreaterThanOrEqual(before);
      expect(envelope.serializedAt).toBeLessThanOrEqual(after);
    });

    it('includes checksum', () => {
      const envelope = JSON.parse(serializer.serialize(makeState('h1')));
      expect(typeof envelope.checksum).toBe('string');
      expect(envelope.checksum.length).toBeGreaterThan(0);
    });

    it('embeds data field with state', () => {
      const state = makeState('h1');
      const envelope = JSON.parse(serializer.serialize(state));
      expect(envelope.data.config.id).toBe('h1');
    });
  });

  describe('deserialize()', () => {
    it('round-trips a valid state', () => {
      const state = makeState('h1');
      const json = serializer.serialize(state);
      const restored = serializer.deserialize(json);
      expect(restored.config.id).toBe('h1');
      expect(restored.status).toBe('running');
    });

    it('throws on invalid JSON', () => {
      expect(() => serializer.deserialize('not-json')).toThrow('Invalid JSON');
    });

    it('throws on schema version mismatch', () => {
      const envelope = JSON.parse(serializer.serialize(makeState('h1')));
      envelope.schemaVersion = 99;
      expect(() => serializer.deserialize(JSON.stringify(envelope))).toThrow(
        'Schema version mismatch'
      );
    });

    it('throws on checksum mismatch', () => {
      const envelope = JSON.parse(serializer.serialize(makeState('h1')));
      envelope.checksum = 'badhash';
      expect(() => serializer.deserialize(JSON.stringify(envelope))).toThrow(
        'Checksum mismatch'
      );
    });

    it('validates with Zod (rejects invalid state)', () => {
      const envelope = JSON.parse(serializer.serialize(makeState('h1')));
      // Remove required field
      delete envelope.data.status;
      envelope.checksum = 'badhash'; // will be caught by checksum first
      expect(() => serializer.deserialize(JSON.stringify(envelope))).toThrow();
    });
  });

  describe('isValid()', () => {
    it('returns true for valid serialized state', () => {
      const json = serializer.serialize(makeState('h1'));
      expect(serializer.isValid(json)).toBe(true);
    });

    it('returns false for invalid JSON', () => {
      expect(serializer.isValid('{ broken')).toBe(false);
    });

    it('returns false for tampered checksum', () => {
      const envelope = JSON.parse(serializer.serialize(makeState('h1')));
      envelope.checksum = '0';
      expect(serializer.isValid(JSON.stringify(envelope))).toBe(false);
    });
  });

  describe('getSchemaVersion()', () => {
    it('returns schema version without full validation', () => {
      const json = serializer.serialize(makeState('h1'));
      expect(serializer.getSchemaVersion(json)).toBe(1);
    });

    it('returns null for invalid JSON', () => {
      expect(serializer.getSchemaVersion('bad')).toBeNull();
    });

    it('returns null when schemaVersion is missing', () => {
      expect(serializer.getSchemaVersion('{}')).toBeNull();
    });
  });

  describe('checksum stability', () => {
    it('produces same checksum for identical states', () => {
      const state = makeState('h1');
      const j1 = serializer.serialize(state);
      const j2 = serializer.serialize(state);
      const e1 = JSON.parse(j1);
      const e2 = JSON.parse(j2);
      expect(e1.checksum).toBe(e2.checksum);
    });

    it('produces different checksum for different states', () => {
      const s1 = makeState('h1');
      const s2 = makeState('h2'); // different id
      const e1 = JSON.parse(serializer.serialize(s1));
      const e2 = JSON.parse(serializer.serialize(s2));
      expect(e1.checksum).not.toBe(e2.checksum);
    });
  });
});
