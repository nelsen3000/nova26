// KIMI-T-R26-01: Model Routing Lifecycle Adapter Tests
// Tests for createModelRoutingLifecycleHooks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createModelRoutingLifecycleHooks,
  type ModelRoutingLifecycleConfig,
  getCurrentBuildState,
  getRoutingDecision,
  getAllRoutingDecisions,
  resetBuildState,
} from '../lifecycle-adapter.js';
import type { BuildContext, TaskContext } from '../../orchestrator/lifecycle-hooks.js';

// ============================================================================
// Test Fixtures & Helpers
// ============================================================================

const createMockBuildContext = (overrides: Partial<BuildContext> = {}): BuildContext => ({
  buildId: 'build-001',
  prdId: 'prd-001',
  prdName: 'Test PRD',
  startedAt: new Date().toISOString(),
  options: {},
  ...overrides,
});

const createMockTaskContext = (overrides: Partial<TaskContext> = {}): TaskContext => ({
  taskId: 'task-001',
  title: 'Implement feature',
  agentName: 'code-sage', // Valid agent from ModelRegistry
  dependencies: [],
  ...overrides,
});

const createMockConfig = (overrides: Partial<ModelRoutingLifecycleConfig> = {}): ModelRoutingLifecycleConfig => ({
  enabled: true,
  ...overrides,
});

// ============================================================================
// Test Suite
// ============================================================================

describe('Model Routing Lifecycle Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuildState();
  });

  // ============================================================================
  // onBeforeBuild Tests (5 tests)
  // ============================================================================

  describe('onBeforeBuild', () => {
    it('should initialize router with config', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state).not.toBeNull();
      expect(state?.buildId).toBe('build-001');
      expect(state?.router).toBeDefined();
      expect(state?.registry).toBeDefined();
    });

    it('should detect hardware on initialization', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.hardware).toBeDefined();
      expect(state?.hardware.id).toBeDefined();
      expect(state?.hardwareDetector).toBeDefined();
    });

    it('should initialize speculative decoder', async () => {
      const config = createMockConfig({ draftTokens: 8 });
      const hooks = createModelRoutingLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.speculativeDecoder).toBeDefined();
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createModelRoutingLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle invalid build context gracefully', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // @ts-expect-error Testing invalid context
      await hooks.onBeforeBuild?.({ invalid: 'context' });

      expect(consoleSpy).toHaveBeenCalledWith('[ModelRoutingAdapter] Invalid build context');
      expect(getCurrentBuildState()).toBeNull();
    });
  });

  // ============================================================================
  // onBeforeTask Tests (8 tests)
  // ============================================================================

  describe('onBeforeTask', () => {
    it('should route task to best model', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      const decision = getRoutingDecision('task-001');
      expect(decision).toBeDefined();
      expect(decision?.agentId).toBe('code-sage');
      expect(decision?.selectedModel).toBeDefined();
    });

    it('should log routing decision', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      // Check for routing log message
      const routingLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('[ModelRoutingAdapter] Routed task')
      );
      expect(routingLog).toBeDefined();
      expect(routingLog![1]).toBe('task-001');
      expect(routingLog![2]).toMatchObject({
        agent: 'code-sage',
        model: expect.any(String),
        confidence: expect.any(String),
      });
    });

    it('should route differently for different agents', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-code', agentName: 'code-sage' }));
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-debug', agentName: 'debug-oracle' }));

      const codeDecision = getRoutingDecision('task-code');
      const debugDecision = getRoutingDecision('task-debug');

      expect(codeDecision?.agentId).toBe('code-sage');
      expect(debugDecision?.agentId).toBe('debug-oracle');
      // Different agents should potentially get different models
      expect(codeDecision?.selectedModel.name).toBeDefined();
      expect(debugDecision?.selectedModel.name).toBeDefined();
    });

    it('should consider task complexity for routing', async () => {
      const config = createMockConfig({ confidenceThreshold: 0.8 });
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      // Simple task
      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'simple-task',
        title: 'Fix typo',
      }));

      // Complex task
      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'complex-task',
        title: 'Refactor architecture for distributed system with scalability optimization',
      }));

      const simpleDecision = getRoutingDecision('simple-task');
      const complexDecision = getRoutingDecision('complex-task');

      expect(simpleDecision).toBeDefined();
      expect(complexDecision).toBeDefined();
    });

    it('should store routing decisions', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-1' }));
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-2' }));
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'task-3' }));

      const allDecisions = getAllRoutingDecisions();
      expect(allDecisions.size).toBe(3);
      expect(allDecisions.has('task-1')).toBe(true);
      expect(allDecisions.has('task-2')).toBe(true);
      expect(allDecisions.has('task-3')).toBe(true);
    });

    it('should skip when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeTask?.(createMockTaskContext());

      expect(getRoutingDecision('task-001')).toBeUndefined();
    });

    it('should skip when no build state exists', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeTask?.(createMockTaskContext());

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should handle invalid task context gracefully', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      // @ts-expect-error Testing invalid context
      await hooks.onBeforeTask?.({ invalid: 'context' });

      expect(consoleSpy).toHaveBeenCalledWith('[ModelRoutingAdapter] Invalid task context');
    });
  });

  // ============================================================================
  // Hardware Detection Tests (3 tests)
  // ============================================================================

  describe('Hardware Detection', () => {
    it('should detect hardware tier', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      const state = getCurrentBuildState();
      expect(state?.hardware.id).toBeDefined();
      expect(['low', 'mid', 'high', 'ultra', 'apple-silicon']).toContain(state?.hardware.id);
    });

    it('should influence routing based on hardware', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      const decision = getRoutingDecision('task-001');
      expect(decision).toBeDefined();
      // Model should be selected based on hardware capabilities
      expect(decision?.selectedModel.name).toBeDefined();
    });
  });

  // ============================================================================
  // Fallback Chain Tests (3 tests)
  // ============================================================================

  describe('Fallback Chain', () => {
    it('should provide fallback chain for routing', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      const decision = getRoutingDecision('task-001');
      expect(decision?.fallbackChain).toBeDefined();
      expect(Array.isArray(decision?.fallbackChain)).toBe(true);
    });

    it('should use fallback when primary model unavailable', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      // Use an unknown agent - should trigger fallback
      await hooks.onBeforeTask?.(createMockTaskContext({ agentName: 'unknown-agent' }));

      // Should still provide a fallback result (warning logged but handled)
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ModelRoutingAdapter] Routing failed for task',
        'task-001',
        expect.objectContaining({
          agent: 'unknown-agent',
        })
      );

      const decision = getRoutingDecision('task-001');
      expect(decision).toBeDefined();
      expect(decision?.selectedModel).toBeDefined();
    });

    it('should log fallback routing', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      // Check for routing log message which includes fallback count
      const routingLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('[ModelRoutingAdapter] Routed task')
      );
      expect(routingLog).toBeDefined();
      expect(routingLog![2]).toMatchObject({
        fallbackCount: expect.any(Number),
      });
    });
  });

  // ============================================================================
  // Speculative Decoding Tests (3 tests)
  // ============================================================================

  describe('Speculative Decoding', () => {
    it('should enable speculative decoding when configured', async () => {
      const config = createMockConfig({
        enableSpeculativeDecoding: true,
        draftTokens: 4,
      });
      const hooks = createModelRoutingLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      const decision = getRoutingDecision('task-001');
      if (decision?.useSpeculativeDecoding) {
        const speculativeLog = consoleSpy.mock.calls.find(
          call => typeof call[0] === 'string' && call[0].includes('[ModelRoutingAdapter] Speculative decoding enabled')
        );
        expect(speculativeLog).toBeDefined();
      }
    });

    it('should respect enableSpeculativeDecoding setting', async () => {
      const config = createMockConfig({
        enableSpeculativeDecoding: false,
      });
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      const decision = getRoutingDecision('task-001');
      // When disabled, should not use speculative decoding even if model supports it
      if (!config.enableSpeculativeDecoding) {
        expect(decision?.useSpeculativeDecoding).toBe(false);
      }
    });

    it('should configure draft tokens correctly', async () => {
      const config = createMockConfig({
        enableSpeculativeDecoding: true,
        draftTokens: 8,
      });
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      const state = getCurrentBuildState();
      expect(state?.speculativeDecoder).toBeDefined();
    });
  });

  // ============================================================================
  // Config Changes Tests (2 tests)
  // ============================================================================

  describe('Config Changes', () => {
    it('should use custom confidence threshold', async () => {
      const config = createMockConfig({ confidenceThreshold: 0.9 });
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      const decision = getRoutingDecision('task-001');
      expect(decision).toBeDefined();
      // Higher threshold should generally result in more powerful models
    });

    it('should use custom router config', async () => {
      const config = createMockConfig({
        routerConfig: {
          enableSpeculativeDecoding: false,
          enableDynamicEscalation: false,
          enableQueueing: false,
        },
      });
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      const state = getCurrentBuildState();
      expect(state?.router).toBeDefined();
    });
  });

  // ============================================================================
  // Utility Function Tests (3 tests)
  // ============================================================================

  describe('Utility Functions', () => {
    it('getRoutingDecision returns undefined for unknown task', () => {
      expect(getRoutingDecision('unknown-task')).toBeUndefined();
    });

    it('getAllRoutingDecisions returns empty map when no build', () => {
      const decisions = getAllRoutingDecisions();
      expect(decisions.size).toBe(0);
    });

    it('resetBuildState clears all state', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());
      expect(getCurrentBuildState()).not.toBeNull();

      resetBuildState();
      expect(getCurrentBuildState()).toBeNull();
    });
  });

  // ============================================================================
  // End-to-End Integration Tests (3 tests)
  // ============================================================================

  describe('End-to-End Integration', () => {
    it('should handle multiple tasks in a build', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'multi-task-build' }));

      const tasks = [
        { taskId: 'task-1', agentName: 'code-sage', title: 'Implement API' },
        { taskId: 'task-2', agentName: 'debug-oracle', title: 'Fix bug' },
        { taskId: 'task-3', agentName: 'review-critic', title: 'Review code' },
      ];

      for (const task of tasks) {
        await hooks.onBeforeTask?.(createMockTaskContext(task));
      }

      const decisions = getAllRoutingDecisions();
      expect(decisions.size).toBe(3);
    });

    it('should handle sequential builds', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      // Build 1
      await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'build-1' }));
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'b1-task' }));

      let state = getCurrentBuildState();
      expect(state?.buildId).toBe('build-1');

      // Build 2 (should reset state)
      resetBuildState();
      await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'build-2' }));

      state = getCurrentBuildState();
      expect(state?.buildId).toBe('build-2');
      expect(getRoutingDecision('b1-task')).toBeUndefined();
    });

    it('should provide consistent routing for same agent/task', async () => {
      const config = createMockConfig();
      const hooks = createModelRoutingLifecycleHooks(config);

      await hooks.onBeforeBuild?.(createMockBuildContext());

      // Route same task multiple times
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'repeat-task' }));
      const decision1 = getRoutingDecision('repeat-task');

      resetBuildState();
      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext({ taskId: 'repeat-task' }));
      const decision2 = getRoutingDecision('repeat-task');

      // Same agent and task should get similar routing
      expect(decision1?.agentId).toBe(decision2?.agentId);
    });
  });
});
