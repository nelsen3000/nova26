// Eternal Reel Factory Tests - K3-37
import { describe, it, expect } from 'vitest';
import {
  createEternalReel,
  DEFAULT_ETERNAL_REEL_CONFIG,
} from './factory.js';

describe('createEternalReel()', () => {
  it('creates an instance with all 4 modules', () => {
    const reel = createEternalReel();
    expect(reel.harnessManager).toBeDefined();
    expect(reel.harnessSerializer).toBeDefined();
    expect(reel.persistenceBridge).toBeDefined();
    expect(reel.hindsight).toBeDefined();
  });

  it('applies default config', () => {
    const reel = createEternalReel();
    expect(reel.config.namespace).toBe(DEFAULT_ETERNAL_REEL_CONFIG.namespace);
    expect(reel.config.maxFragments).toBe(DEFAULT_ETERNAL_REEL_CONFIG.maxFragments);
    expect(reel.config.telemetryEnabled).toBe(true);
  });

  it('merges custom config over defaults', () => {
    const reel = createEternalReel({ namespace: 'my-project', maxFragments: 500 });
    expect(reel.config.namespace).toBe('my-project');
    expect(reel.config.maxFragments).toBe(500);
    expect(reel.config.telemetryEnabled).toBe(true); // default preserved
  });

  it('creates independent instances (no shared state)', () => {
    const r1 = createEternalReel();
    const r2 = createEternalReel();
    expect(r1.harnessManager).not.toBe(r2.harnessManager);
    expect(r1.hindsight).not.toBe(r2.hindsight);
  });

  it('harnessManager starts empty', () => {
    const { harnessManager } = createEternalReel();
    expect(harnessManager.count()).toBe(0);
  });

  it('persistenceBridge is available', async () => {
    const { persistenceBridge } = createEternalReel();
    expect(persistenceBridge.isAvailable()).toBe(true);
  });

  it('harnessSerializer can round-trip a minimal state', () => {
    const { harnessSerializer } = createEternalReel();
    const state = {
      schemaVersion: 1 as const,
      config: {
        id: 'er-test',
        name: 'ER Test',
        agentId: 'agent',
        task: 'test',
        priority: 'normal' as const,
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
      status: 'running' as const,
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
    const json = harnessSerializer.serialize(state);
    const restored = harnessSerializer.deserialize(json);
    expect(restored.config.id).toBe('er-test');
  });
});
