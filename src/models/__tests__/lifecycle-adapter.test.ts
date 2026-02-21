/**
 * Nova26 AI Model Database
 * KIMI-T-07 - Lifecycle Adapter Tests
 *
 * Tests covering:
 * - Vault loads on build start
 * - Provider sync respects config
 * - Model selection uses taste profiles
 * - Unavailable models fall back correctly
 * - Selection reasoning is logged
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAIModelDatabaseLifecycleHooks,
  isBuildContext,
  isTaskContext,
  getCurrentBuildState,
  getModelSelection,
  resetBuildState,
  type AIModelDatabaseConfig,
} from '../lifecycle-adapter.js';
import {
  getAIModelVault,
  resetAIModelVault,
} from '../ai-model-vault.js';
import type { BuildContext, TaskContext } from '../../orchestrator/lifecycle-hooks.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockBuildContext = (overrides: Partial<BuildContext> = {}): BuildContext => ({
  buildId: 'build-123',
  prdId: 'prd-456',
  prdName: 'Test PRD',
  startedAt: new Date().toISOString(),
  options: {},
  ...overrides,
});

const createMockTaskContext = (overrides: Partial<TaskContext> = {}): TaskContext => ({
  taskId: 'task-789',
  title: 'Implement feature',
  agentName: 'agent-alpha',
  dependencies: [],
  ...overrides,
});

// ============================================================================
// Suite: createAIModelDatabaseLifecycleHooks
// ============================================================================

describe('createAIModelDatabaseLifecycleHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAIModelVault();
    resetBuildState();
  });

  // --------------------------------------------------------------------------
  // Vault loads on build start
  // --------------------------------------------------------------------------

  describe('onBeforeBuild - Vault Loading', () => {
    it('should load vault on build start', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const vault = getAIModelVault();
      expect(vault.listModels().length).toBeGreaterThan(0);
    });

    it('should initialize build state with correct build ID', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      const context = createMockBuildContext({ buildId: 'build-abc' });

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.buildId).toBe('build-abc');
    });

    it('should mark models as loaded in build state', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.modelsLoaded).toBe(true);
    });

    it('should log initialization message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const hooks = createAIModelDatabaseLifecycleHooks({});
      const context = createMockBuildContext({ buildId: 'build-test' });

      await hooks.onBeforeBuild?.(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('build-test')
      );
      consoleSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // Provider sync respects config
  // --------------------------------------------------------------------------

  describe('onBeforeBuild - Provider Sync', () => {
    it('should sync with configured providers', async () => {
      const config: AIModelDatabaseConfig = {
        syncProviders: ['openai'],
      };
      const hooks = createAIModelDatabaseLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.providerSyncResults).toHaveLength(1);
      expect(state?.providerSyncResults[0]?.provider).toBe('openai');
    });

    it('should sync with multiple providers', async () => {
      const config: AIModelDatabaseConfig = {
        syncProviders: ['openai', 'anthropic', 'google'],
      };
      const hooks = createAIModelDatabaseLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.providerSyncResults).toHaveLength(3);
    });

    it('should skip provider sync when skipProviderSync is true', async () => {
      const config: AIModelDatabaseConfig = {
        syncProviders: ['openai'],
        skipProviderSync: true,
      };
      const hooks = createAIModelDatabaseLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.providerSyncResults).toHaveLength(0);
    });

    it('should handle provider sync errors gracefully', async () => {
      const vault = getAIModelVault();
      vi.spyOn(vault, 'syncFromProvider').mockRejectedValue(new Error('API Error'));

      const config: AIModelDatabaseConfig = {
        syncProviders: ['openai'],
      };
      const hooks = createAIModelDatabaseLifecycleHooks(config);
      const context = createMockBuildContext();

      // Should not throw
      await expect(hooks.onBeforeBuild?.(context)).resolves.not.toThrow();

      const state = getCurrentBuildState();
      expect(state?.errors.length).toBeGreaterThan(0);
    });

    it('should record added and updated counts from sync', async () => {
      const config: AIModelDatabaseConfig = {
        syncProviders: ['openai'],
      };
      const hooks = createAIModelDatabaseLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      const openaiResult = state?.providerSyncResults.find(r => r.provider === 'openai');
      expect(openaiResult).toBeDefined();
      expect(typeof openaiResult?.added).toBe('number');
      expect(typeof openaiResult?.updated).toBe('number');
    });
  });

  // --------------------------------------------------------------------------
  // Taste profile application
  // --------------------------------------------------------------------------

  describe('onBeforeBuild - Taste Profile', () => {
    it('should apply taste profile when provided', async () => {
      const config: AIModelDatabaseConfig = {
        tasteProfile: {
          preferredProviders: ['openai'],
        },
      };
      const hooks = createAIModelDatabaseLifecycleHooks(config);
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.tasteProfileApplied).toBe(true);
    });

    it('should not apply taste profile when not provided', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      const context = createMockBuildContext();

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state?.tasteProfileApplied).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Model selection uses taste profiles
  // --------------------------------------------------------------------------

  describe('onBeforeTask - Model Selection with Taste Profiles', () => {
    it('should select a model for the task', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext();
      await hooks.onBeforeTask?.(taskContext);

      const selection = getModelSelection();
      expect(selection).toBeDefined();
      expect(selection?.selectedModel).toBeDefined();
    });

    it('should use agent name from task context', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext({ agentName: 'custom-agent' });
      await hooks.onBeforeTask?.(taskContext);

      const selection = getModelSelection();
      expect(selection?.agentId).toBe('custom-agent');
    });

    it('should classify task type based on title', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext({ title: 'Implement a React component' });
      await hooks.onBeforeTask?.(taskContext);

      const selection = getModelSelection();
      expect(selection?.taskType).toBe('code');
    });

    it('should work without prior build state', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      // Skip onBeforeBuild

      const taskContext = createMockTaskContext();
      await expect(hooks.onBeforeTask?.(taskContext)).resolves.not.toThrow();

      const selection = getModelSelection();
      expect(selection).toBeDefined();
    });

    it('should update build state with last route', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext();
      await hooks.onBeforeTask?.(taskContext);

      const state = getCurrentBuildState();
      expect(state?.lastModelRoute).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Unavailable models fall back correctly
  // --------------------------------------------------------------------------

  describe('onBeforeTask - Fallback Handling', () => {
    it('should use fallback when selected model is unavailable', async () => {
      const vault = getAIModelVault();
      // Remove most models, keep only fallback
      const models = vault.listModels();
      models.forEach(m => vault.removeModel(m.id));

      // Add only the fallback model
      vault.upsertModel({
        id: 'fallback-model',
        name: 'Fallback Model',
        provider: 'test',
        family: 'test',
        version: '1.0',
        capabilities: {
          code: 80,
          reasoning: 80,
          multimodal: 80,
          speed: 80,
          cost: 80,
          localAvailable: false,
          quantizations: [],
        },
        contextWindow: 128000,
        pricing: { inputPerMToken: 1, outputPerMToken: 1 },
        benchmarks: {},
        lastUpdated: '2024-01-01',
      });

      const hooks = createAIModelDatabaseLifecycleHooks({
        fallbackModelId: 'fallback-model',
      });
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext();
      await hooks.onBeforeTask?.(taskContext);

      const selection = getModelSelection();
      expect(selection?.selectedModel.id).toBe('fallback-model');
    });

    it('should use emergency fallback when configured fallback is also unavailable', async () => {
      const vault = getAIModelVault();
      // Keep only gpt-4o as emergency fallback
      const models = vault.listModels();
      models.forEach(m => {
        if (m.id !== 'gpt-4o') {
          vault.removeModel(m.id);
        }
      });

      const hooks = createAIModelDatabaseLifecycleHooks({
        fallbackModelId: 'non-existent-model',
      });
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext();
      await hooks.onBeforeTask?.(taskContext);

      const selection = getModelSelection();
      expect(selection?.selectedModel).toBeDefined();
    });

    it('should indicate fallback usage in reasoning', async () => {
      const vault = getAIModelVault();
      const models = vault.listModels();
      models.forEach(m => vault.removeModel(m.id));

      vault.upsertModel({
        id: 'fallback-model',
        name: 'Fallback Model',
        provider: 'test',
        family: 'test',
        version: '1.0',
        capabilities: {
          code: 80,
          reasoning: 80,
          multimodal: 80,
          speed: 80,
          cost: 80,
          localAvailable: false,
          quantizations: [],
        },
        contextWindow: 128000,
        pricing: { inputPerMToken: 1, outputPerMToken: 1 },
        benchmarks: {},
        lastUpdated: '2024-01-01',
      });

      const hooks = createAIModelDatabaseLifecycleHooks({
        fallbackModelId: 'fallback-model',
      });
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext();
      await hooks.onBeforeTask?.(taskContext);

      const selection = getModelSelection();
      expect(selection?.reasoning.toLowerCase()).toContain('fallback');
    });
  });

  // --------------------------------------------------------------------------
  // Selection reasoning is logged
  // --------------------------------------------------------------------------

  describe('onBeforeTask - Selection Logging', () => {
    it('should log selection by default', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext({ title: 'Test task' });
      await hooks.onBeforeTask?.(taskContext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test task')
      );
      consoleSpy.mockRestore();
    });

    it('should include agent name in log', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext({ agentName: 'test-agent' });
      await hooks.onBeforeTask?.(taskContext);

      const logCall = consoleSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('test-agent')
      );
      expect(logCall).toBeDefined();
      consoleSpy.mockRestore();
    });

    it('should include confidence score in log when verbose', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const hooks = createAIModelDatabaseLifecycleHooks({ verboseLogging: true });
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext();
      await hooks.onBeforeTask?.(taskContext);

      const logCall = consoleSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('Confidence')
      );
      expect(logCall).toBeDefined();
      consoleSpy.mockRestore();
    });

    it('should include model capabilities in verbose log', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const hooks = createAIModelDatabaseLifecycleHooks({ verboseLogging: true });
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext();
      await hooks.onBeforeTask?.(taskContext);

      const logCall = consoleSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('Capabilities')
      );
      expect(logCall).toBeDefined();
      consoleSpy.mockRestore();
    });

    it('should warn when using fallback model', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const vault = getAIModelVault();
      
      // First add the fallback model
      vault.upsertModel({
        id: 'fallback-model',
        name: 'Fallback Model',
        provider: 'test',
        family: 'test',
        version: '1.0',
        capabilities: {
          code: 99, // High code score to ensure it would normally be selected
          reasoning: 80,
          multimodal: 80,
          speed: 80,
          cost: 80,
          localAvailable: false,
          quantizations: [],
        },
        contextWindow: 128000,
        pricing: { inputPerMToken: 1, outputPerMToken: 1 },
        benchmarks: {},
        lastUpdated: '2024-01-01',
      });

      // Now mock getModel to return undefined for the top model (gpt-4o)
      // but return the fallback model when requested
      const originalGetModel = vault.getModel.bind(vault);
      vi.spyOn(vault, 'getModel').mockImplementation((id: string) => {
        if (id === 'gpt-4o') {
          return undefined; // Simulate unavailable
        }
        return originalGetModel(id);
      });

      const hooks = createAIModelDatabaseLifecycleHooks({
        fallbackModelId: 'fallback-model',
      });
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const taskContext = createMockTaskContext();
      await hooks.onBeforeTask?.(taskContext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('fallback')
      );
      consoleSpy.mockRestore();
    });
  });
});

// ============================================================================
// Suite: Type Guards
// ============================================================================

describe('Type Guards', () => {
  describe('isBuildContext', () => {
    it('should return true for valid BuildContext', () => {
      const context = createMockBuildContext();
      expect(isBuildContext(context)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isBuildContext(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBuildContext(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isBuildContext('string')).toBe(false);
    });

    it('should return false when buildId is missing', () => {
      const context = { prdId: 'prd', prdName: 'name' };
      expect(isBuildContext(context)).toBe(false);
    });

    it('should return false when prdId is missing', () => {
      const context = { buildId: 'build', prdName: 'name' };
      expect(isBuildContext(context)).toBe(false);
    });

    it('should return false when prdName is missing', () => {
      const context = { buildId: 'build', prdId: 'prd' };
      expect(isBuildContext(context)).toBe(false);
    });

    it('should return false when buildId is not a string', () => {
      const context = { buildId: 123, prdId: 'prd', prdName: 'name' };
      expect(isBuildContext(context)).toBe(false);
    });
  });

  describe('isTaskContext', () => {
    it('should return true for valid TaskContext', () => {
      const context = createMockTaskContext();
      expect(isTaskContext(context)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isTaskContext(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isTaskContext(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isTaskContext(123)).toBe(false);
    });

    it('should return false when taskId is missing', () => {
      const context = { title: 'title', agentName: 'agent' };
      expect(isTaskContext(context)).toBe(false);
    });

    it('should return false when title is missing', () => {
      const context = { taskId: 'task', agentName: 'agent' };
      expect(isTaskContext(context)).toBe(false);
    });

    it('should return false when agentName is missing', () => {
      const context = { taskId: 'task', title: 'title' };
      expect(isTaskContext(context)).toBe(false);
    });

    it('should return false when taskId is not a string', () => {
      const context = { taskId: 123, title: 'title', agentName: 'agent' };
      expect(isTaskContext(context)).toBe(false);
    });
  });
});

// ============================================================================
// Suite: Utility Functions
// ============================================================================

describe('Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAIModelVault();
    resetBuildState();
  });

  describe('getCurrentBuildState', () => {
    it('should return null when no build is active', () => {
      expect(getCurrentBuildState()).toBeNull();
    });

    it('should return build state after onBeforeBuild', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      const context = createMockBuildContext({ buildId: 'test-build' });

      await hooks.onBeforeBuild?.(context);

      const state = getCurrentBuildState();
      expect(state).not.toBeNull();
      expect(state?.buildId).toBe('test-build');
    });

    it('should return a copy of the state', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());

      const state1 = getCurrentBuildState();
      const state2 = getCurrentBuildState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('getModelSelection', () => {
    it('should return null when no selection has been made', () => {
      expect(getModelSelection()).toBeNull();
    });

    it('should return selection after onBeforeTask', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      const selection = getModelSelection();
      expect(selection).not.toBeNull();
      expect(selection?.selectedModel).toBeDefined();
    });

    it('should return a copy of the selection', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      const selection1 = getModelSelection();
      const selection2 = getModelSelection();

      expect(selection1).not.toBe(selection2);
      expect(selection1).toEqual(selection2);
    });
  });

  describe('resetBuildState', () => {
    it('should clear build state', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());

      expect(getCurrentBuildState()).not.toBeNull();

      resetBuildState();

      expect(getCurrentBuildState()).toBeNull();
    });

    it('should clear model selection', async () => {
      const hooks = createAIModelDatabaseLifecycleHooks({});
      await hooks.onBeforeBuild?.(createMockBuildContext());
      await hooks.onBeforeTask?.(createMockTaskContext());

      expect(getModelSelection()).not.toBeNull();

      resetBuildState();

      expect(getModelSelection()).toBeNull();
    });
  });
});

// ============================================================================
// Suite: Integration
// ============================================================================

describe('Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAIModelVault();
    resetBuildState();
  });

  it('should complete full lifecycle: build then task', async () => {
    const hooks = createAIModelDatabaseLifecycleHooks({
      syncProviders: ['openai'],
      tasteProfile: { preferredProviders: ['openai'] },
    });

    // Build phase
    await hooks.onBeforeBuild?.(createMockBuildContext({ buildId: 'integration-build' }));
    const buildState = getCurrentBuildState();
    expect(buildState?.modelsLoaded).toBe(true);
    expect(buildState?.providerSyncResults).toHaveLength(1);
    expect(buildState?.tasteProfileApplied).toBe(true);

    // Task phase
    await hooks.onBeforeTask?.(createMockTaskContext({
      taskId: 'integration-task',
      title: 'Write TypeScript code',
      agentName: 'code-agent',
    }));

    const selection = getModelSelection();
    expect(selection).toBeDefined();
    expect(selection?.agentId).toBe('code-agent');
    expect(selection?.taskType).toBe('code');
  });

  it('should handle multiple tasks in sequence', async () => {
    const hooks = createAIModelDatabaseLifecycleHooks({});
    await hooks.onBeforeBuild?.(createMockBuildContext());

    // First task
    await hooks.onBeforeTask?.(createMockTaskContext({
      taskId: 'task-1',
      title: 'Write code',
    }));
    const selection1 = getModelSelection();

    // Second task
    await hooks.onBeforeTask?.(createMockTaskContext({
      taskId: 'task-2',
      title: 'Analyze architecture',
    }));
    const selection2 = getModelSelection();

    // Selection should be updated
    expect(selection2).not.toEqual(selection1);
  });

  it('should respect verboseLogging configuration', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const hooks = createAIModelDatabaseLifecycleHooks({
      verboseLogging: false,
    });
    await hooks.onBeforeBuild?.(createMockBuildContext());
    await hooks.onBeforeTask?.(createMockTaskContext());

    // Should still log basic selection but not detailed capabilities
    const capabilityLogs = consoleSpy.mock.calls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('Capabilities')
    );
    expect(capabilityLogs).toHaveLength(0);

    consoleSpy.mockRestore();
  });
});
