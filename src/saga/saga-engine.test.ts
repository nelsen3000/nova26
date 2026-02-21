// SAGA Engine Property Tests
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSAGAEngine,
  resetSAGAEngine,
  DEFAULT_ENGINE_CONFIG,
} from './saga-engine.js';
import type { EvolutionConfig } from './types.js';
import { clearSessions } from './session-manager.js';
import { clearStore } from './atlas-goal-store.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('SAGA Engine', () => {
  beforeEach(() => {
    resetSAGAEngine();
    clearSessions();
    clearStore();
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 1: Engine factory returns valid engine instance
  // ═════════════════════════════════════════════════════════════════════════════

  it('should create valid engine instances', () => {
    const engine = createSAGAEngine({});

    expect(engine).toBeDefined();
    expect(typeof engine.startSession).toBe('function');
    expect(typeof engine.pauseSession).toBe('function');
    expect(typeof engine.resumeSession).toBe('function');
    expect(typeof engine.stopSession).toBe('function');
    expect(typeof engine.getSession).toBe('function');
    expect(typeof engine.listSessions).toBe('function');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 2: Session creation returns valid session
  // ═════════════════════════════════════════════════════════════════════════════

  it('should create sessions with correct properties', async () => {
    const engine = createSAGAEngine({});
    const config: EvolutionConfig = {
      maxIterations: 5,
      maxComputeTimeMs: 10000,
      maxMemoryBytes: 1024 * 1024,
      populationSize: 4,
      minFitnessThreshold: 0.3,
      portfolioSeedPercent: 0.2,
      checkpointIntervalMs: 5000,
      enableSwarmDebate: false,
      notableFitnessThreshold: 0.85,
    };

    const session = await engine.startSession('test-agent', config);

    // Verify session properties
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.agentName).toBe('test-agent');
    expect(session.status).toBe('running');
    expect(session.population).toBeDefined();
    expect(session.population.length).toBe(config.populationSize);
    expect(session.config).toEqual(config);
    expect(session.fitnessHistory).toEqual([]);
    expect(session.metrics).toBeDefined();
    expect(session.startedAt).toBeDefined();
    expect(new Date(session.startedAt).getTime()).toBeGreaterThan(0);

    // Clean up
    await engine.stopSession(session.id);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 3: List sessions returns all created sessions
  // ═════════════════════════════════════════════════════════════════════════════

  it('should list all created sessions', async () => {
    const engine = createSAGAEngine({});
    const config: EvolutionConfig = {
      maxIterations: 3,
      maxComputeTimeMs: 5000,
      maxMemoryBytes: 1024 * 1024,
      populationSize: 3,
      minFitnessThreshold: 0.3,
      portfolioSeedPercent: 0.2,
      checkpointIntervalMs: 5000,
      enableSwarmDebate: false,
      notableFitnessThreshold: 0.85,
    };

    const session1 = await engine.startSession('agent-1', config);
    const session2 = await engine.startSession('agent-2', config);

    const listed = engine.listSessions();
    expect(listed.length).toBe(2);
    expect(listed.map(s => s.id)).toContain(session1.id);
    expect(listed.map(s => s.id)).toContain(session2.id);

    // Clean up
    await engine.stopSession(session1.id);
    await engine.stopSession(session2.id);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 4: Get session returns correct session or undefined
  // ═════════════════════════════════════════════════════════════════════════════

  it('should retrieve sessions correctly', async () => {
    const engine = createSAGAEngine({});

    // Non-existent session returns undefined
    expect(engine.getSession('non-existent-id')).toBeUndefined();

    const config: EvolutionConfig = {
      maxIterations: 3,
      maxComputeTimeMs: 5000,
      maxMemoryBytes: 1024 * 1024,
      populationSize: 3,
      minFitnessThreshold: 0.3,
      portfolioSeedPercent: 0.2,
      checkpointIntervalMs: 5000,
      enableSwarmDebate: false,
      notableFitnessThreshold: 0.85,
    };

    const session = await engine.startSession('test-agent', config);

    // Get returns correct session
    const retrieved = engine.getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(session.id);
    expect(retrieved?.agentName).toBe('test-agent');

    // Clean up
    await engine.stopSession(session.id);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 5: Engine configuration defaults are applied correctly
  // ═════════════════════════════════════════════════════════════════════════════

  it('should apply default configuration correctly', () => {
    // Verify default config values
    expect(DEFAULT_ENGINE_CONFIG.autonomyLevel).toBe(3);
    expect(DEFAULT_ENGINE_CONFIG.enableOvernight).toBe(false);
    expect(DEFAULT_ENGINE_CONFIG.overnightDurationMs).toBe(8 * 60 * 60 * 1000);
    expect(DEFAULT_ENGINE_CONFIG.tastePatterns).toEqual([]);

    // Engine should work with empty config (uses defaults)
    const engine = createSAGAEngine({});
    expect(engine).toBeDefined();
    expect(typeof engine.startSession).toBe('function');
  });

  it('should apply custom configuration', () => {
    const customConfig = {
      autonomyLevel: 4,
      enableOvernight: true,
      overnightDurationMs: 4 * 60 * 60 * 1000,
      tastePatterns: [],
    };

    const engine = createSAGAEngine(customConfig);
    expect(engine).toBeDefined();
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 6: Reset clears all engine state
  // ═════════════════════════════════════════════════════════════════════════════

  it('should reset engine state correctly', async () => {
    const engine = createSAGAEngine({});
    const config: EvolutionConfig = {
      maxIterations: 3,
      maxComputeTimeMs: 5000,
      maxMemoryBytes: 1024 * 1024,
      populationSize: 3,
      minFitnessThreshold: 0.3,
      portfolioSeedPercent: 0.2,
      checkpointIntervalMs: 5000,
      enableSwarmDebate: false,
      notableFitnessThreshold: 0.85,
    };

    const session = await engine.startSession('test-agent', config);
    expect(engine.getSession(session.id)).toBeDefined();
    expect(engine.listSessions().length).toBeGreaterThan(0);

    // Stop and reset
    await engine.stopSession(session.id);
    resetSAGAEngine();
    clearSessions();

    // After reset, engine should be fresh
    const newEngine = createSAGAEngine({});
    expect(newEngine.listSessions()).toHaveLength(0);
  });
});
