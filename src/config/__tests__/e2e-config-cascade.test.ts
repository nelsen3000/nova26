// SN-19: Config Cascade Integration Test
// Tests env → file → defaults priority, feature flags, and end-to-end resolution

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveConfig,
  readEnvOverrides,
  parseConfigFile,
  getConfigSummary,
  getEnabledFeatures,
  DEFAULT_RALPH_LOOP_OPTIONS,
  type ConfigResolverResult,
} from '../config-resolver.js';
import {
  FeatureFlagRegistry,
  FeatureFlagStore,
  getGlobalRegistry,
  resetGlobalRegistry,
  setGlobalRegistry,
  getFeatureFlagStore,
  resetFeatureFlagStore,
  registerDefaultFlags,
} from '../feature-flags.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Config Cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalRegistry();
    resetFeatureFlagStore();
  });

  describe('Cascade priority: env > file > defaults', () => {
    it('should use defaults when no env or file provided', () => {
      const result = resolveConfig(null, {});
      expect(result.options.parallelMode).toBe(false);
      expect(result.options.concurrency).toBe(1);
      expect(result.options.autoTestFix).toBe(true);
      expect(result.options.maxTestRetries).toBe(3);
    });

    it('should override defaults with file config', () => {
      const fileConfig = { options: { parallelMode: true, concurrency: 4 } };
      const result = resolveConfig(fileConfig, {});

      expect(result.options.parallelMode).toBe(true);
      expect(result.options.concurrency).toBe(4);
      // Other defaults should remain
      expect(result.options.autoTestFix).toBe(true);
    });

    it('should override file config with env vars', () => {
      const fileConfig = { options: { parallelMode: false, concurrency: 2 } };
      const env = {
        NOVA26_PARALLEL_MODE: 'true',
        NOVA26_CONCURRENCY: '8',
      };
      const result = resolveConfig(fileConfig, env);

      // Env wins over file
      expect(result.options.parallelMode).toBe(true);
      expect(result.options.concurrency).toBe(8);
    });

    it('should track source counts correctly', () => {
      const fileConfig = { options: { parallelMode: true } };
      const env = { NOVA26_CONCURRENCY: '4' };
      const result = resolveConfig(fileConfig, env);

      expect(result.sources.defaults).toBe(Object.keys(DEFAULT_RALPH_LOOP_OPTIONS).length);
      expect(result.sources.file).toBe(1);
      expect(result.sources.env).toBe(1);
    });

    it('should have zero errors for valid cascade', () => {
      const fileConfig = { options: { parallelMode: true } };
      const result = resolveConfig(fileConfig, {});
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Environment variable parsing', () => {
    it('should parse boolean env vars (true/false)', () => {
      const { overrides } = readEnvOverrides({
        NOVA26_PARALLEL_MODE: 'true',
        NOVA26_AUTO_TEST_FIX: 'false',
      });
      expect(overrides.parallelMode).toBe(true);
      expect(overrides.autoTestFix).toBe(false);
    });

    it('should parse boolean env vars (1/0/yes/no)', () => {
      const { overrides } = readEnvOverrides({
        NOVA26_PARALLEL_MODE: '1',
        NOVA26_COST_TRACKING: 'yes',
        NOVA26_GIT_WORKFLOW: '0',
      });
      expect(overrides.parallelMode).toBe(true);
      expect(overrides.costTracking).toBe(true);
      expect(overrides.gitWorkflow).toBe(false);
    });

    it('should parse numeric env vars', () => {
      const { overrides } = readEnvOverrides({
        NOVA26_CONCURRENCY: '16',
        NOVA26_MAX_TEST_RETRIES: '5',
        NOVA26_BUDGET_LIMIT: '100',
      });
      expect(overrides.concurrency).toBe(16);
      expect(overrides.maxTestRetries).toBe(5);
      expect(overrides.budgetLimit).toBe(100);
    });

    it('should ignore unknown env vars', () => {
      const { overrides, resolutions } = readEnvOverrides({
        NOVA26_UNKNOWN_FLAG: 'true',
        RANDOM_VAR: 'hello',
      });
      expect(Object.keys(overrides)).toHaveLength(0);
      expect(resolutions).toHaveLength(0);
    });

    it('should enable feature modules via env vars', () => {
      const { overrides } = readEnvOverrides({
        NOVA26_MODEL_ROUTING: 'true',
        NOVA26_PERPLEXITY: 'true',
        NOVA26_WORKFLOW_ENGINE: 'true',
      });
      expect(overrides.modelRoutingEnabled).toBe(true);
      expect(overrides.perplexityEnabled).toBe(true);
      expect(overrides.workflowEngineEnabled).toBe(true);
    });
  });

  describe('Config file parsing', () => {
    it('should parse valid config file with options', () => {
      const { config, errors } = parseConfigFile({
        options: { parallelMode: true, concurrency: 4 },
      });
      expect(errors).toHaveLength(0);
      expect(config.options).toBeDefined();
      expect(config.options!.parallelMode).toBe(true);
    });

    it('should validate module-specific configs with Zod schemas', () => {
      const { config, resolutions, errors } = parseConfigFile({
        modelRoutingConfig: {
          enabled: true,
          autoDetectHardware: true,
          defaultTier: 'mid',
          agentMappings: [],
          speculativeDecoding: {
            enabled: false,
            draftModel: 'qwen2.5:1.5b',
            verifyModel: 'qwen2.5:7b',
            draftTokens: 4,
            acceptanceRateTarget: 0.8,
          },
        },
      });
      expect(errors).toHaveLength(0);
      expect(resolutions.length).toBeGreaterThan(0);
      expect(resolutions.some(r => r.key === 'modelRoutingConfig')).toBe(true);
    });

    it('should report validation errors for invalid module configs', () => {
      const { errors } = parseConfigFile({
        modelRoutingConfig: {
          defaultTier: 'INVALID_TIER',
          speculativeDecoding: { enabled: false, draftModel: 'a', verifyModel: 'b', draftTokens: 4, acceptanceRateTarget: 0.8 },
        },
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].module).toBe('model-routing');
      expect(errors[0].source).toBe('file');
    });

    it('should handle completely empty config file', () => {
      const { config, errors } = parseConfigFile({});
      expect(errors).toHaveLength(0);
      expect(config.options).toBeUndefined();
    });

    it('should track file resolutions for options keys', () => {
      const { resolutions } = parseConfigFile({
        options: { parallelMode: true, concurrency: 4 },
      });
      expect(resolutions).toHaveLength(2);
      expect(resolutions.every(r => r.source === 'file')).toBe(true);
    });
  });

  describe('Feature flag registry', () => {
    it('should register and retrieve boolean flags', () => {
      const registry = new FeatureFlagRegistry();
      registry.register({
        name: 'test-flag',
        description: 'Test',
        defaultValue: true,
        type: 'boolean',
      });
      expect(registry.getBoolean('test-flag')).toBe(true);
    });

    it('should programmatically set flags', () => {
      const registry = new FeatureFlagRegistry();
      registry.register({
        name: 'toggle',
        description: 'Toggle',
        defaultValue: false,
        type: 'boolean',
      });
      expect(registry.set('toggle', true)).toBe(true);
      expect(registry.getBoolean('toggle')).toBe(true);
    });

    it('should reject setting unregistered flags', () => {
      const registry = new FeatureFlagRegistry();
      expect(registry.set('nonexistent', true)).toBe(false);
    });

    it('should reset flags to defaults', () => {
      const registry = new FeatureFlagRegistry();
      registry.register({
        name: 'resettable',
        description: 'Reset test',
        defaultValue: false,
        type: 'boolean',
      });
      registry.set('resettable', true);
      expect(registry.getBoolean('resettable')).toBe(true);

      registry.reset('resettable');
      expect(registry.getBoolean('resettable')).toBe(false);
    });

    it('should register default Nova26 flags', () => {
      const registry = new FeatureFlagRegistry();
      registerDefaultFlags(registry);

      const names = registry.getAllNames();
      expect(names).toContain('model-routing');
      expect(names).toContain('workflow-engine');
      expect(names).toContain('cinematic-observability');
      expect(names.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Feature flag store', () => {
    it('should list all flags via store', () => {
      const registry = new FeatureFlagRegistry();
      registerDefaultFlags(registry);
      const store = new FeatureFlagStore(registry);

      const flags = store.listFlags();
      expect(flags.length).toBeGreaterThanOrEqual(8);
      expect(flags.every(f => typeof f.name === 'string')).toBe(true);
    });

    it('should check isEnabled via store', () => {
      const registry = new FeatureFlagRegistry();
      registerDefaultFlags(registry);
      const store = new FeatureFlagStore(registry);

      // model-routing defaults to true
      expect(store.isEnabled('model-routing')).toBe(true);
      // perplexity defaults to false
      expect(store.isEnabled('perplexity')).toBe(false);
    });

    it('should use global registry singleton', () => {
      const registry = getGlobalRegistry();
      expect(registry).toBeInstanceOf(FeatureFlagRegistry);

      // Same instance on second call
      const registry2 = getGlobalRegistry();
      expect(registry2).toBe(registry);
    });

    it('should allow replacing global registry', () => {
      const custom = new FeatureFlagRegistry();
      custom.register({
        name: 'custom-flag',
        description: 'Custom',
        defaultValue: true,
        type: 'boolean',
      });
      setGlobalRegistry(custom);

      const store = getFeatureFlagStore();
      expect(store.isEnabled('custom-flag')).toBe(true);
    });
  });

  describe('End-to-end: config + feature flags', () => {
    it('should resolve full config with all layers', () => {
      const fileConfig = {
        options: { modelRoutingEnabled: true, parallelMode: true },
        perplexityConfig: {
          enabled: true,
          model: 'sonar-pro',
          maxTokens: 4096,
          temperature: 0.7,
        },
      };
      const env = { NOVA26_CONCURRENCY: '4' };
      const result = resolveConfig(fileConfig, env);

      // Env override
      expect(result.options.concurrency).toBe(4);
      // File override
      expect(result.options.modelRoutingEnabled).toBe(true);
      expect(result.options.parallelMode).toBe(true);
      // Module config passed through
      expect(result.options.perplexityConfig).toBeDefined();
      // Default preserved
      expect(result.options.maxTestRetries).toBe(3);
    });

    it('should list enabled features from resolved options', () => {
      const result = resolveConfig({
        options: {
          modelRoutingEnabled: true,
          perplexityEnabled: true,
          workflowEngineEnabled: true,
        },
      }, {});

      const enabled = getEnabledFeatures(result.options);
      expect(enabled).toContain('model-routing');
      expect(enabled).toContain('perplexity');
      expect(enabled).toContain('workflow-engine');
      expect(enabled).not.toContain('infinite-memory');
    });

    it('should generate readable config summary', () => {
      const result = resolveConfig({
        options: { modelRoutingEnabled: true },
      }, {});

      const summary = getConfigSummary(result);
      expect(summary).toContain('Nova26 Config Resolution');
      expect(summary).toContain('modelRoutingEnabled: ON');
      expect(summary).toContain('perplexityEnabled: OFF');
    });

    it('should include error details in summary', () => {
      const result = resolveConfig({
        modelRoutingConfig: { defaultTier: 'INVALID' },
      }, {});

      const summary = getConfigSummary(result);
      expect(summary).toContain('Errors:');
    });
  });

  describe('Default options completeness', () => {
    it('should have all feature enable flags defaulted to false', () => {
      const featureKeys = [
        'modelRoutingEnabled', 'perplexityEnabled', 'workflowEngineEnabled',
        'infiniteMemoryEnabled', 'cinematicObservabilityEnabled',
        'aiModelDatabaseEnabled', 'crdtCollaborationEnabled',
        'portfolioEnabled', 'agentMemoryEnabled', 'generativeUIEnabled',
        'autonomousTestingEnabled', 'wellbeingEnabled',
        'advancedRecoveryEnabled', 'advancedInitEnabled',
      ];
      for (const key of featureKeys) {
        expect(DEFAULT_RALPH_LOOP_OPTIONS[key as keyof typeof DEFAULT_RALPH_LOOP_OPTIONS]).toBe(false);
      }
    });

    it('should have sensible core defaults', () => {
      expect(DEFAULT_RALPH_LOOP_OPTIONS.parallelMode).toBe(false);
      expect(DEFAULT_RALPH_LOOP_OPTIONS.concurrency).toBe(1);
      expect(DEFAULT_RALPH_LOOP_OPTIONS.autoTestFix).toBe(true);
      expect(DEFAULT_RALPH_LOOP_OPTIONS.planApproval).toBe(true);
      expect(DEFAULT_RALPH_LOOP_OPTIONS.gitWorkflow).toBe(true);
    });
  });
});
