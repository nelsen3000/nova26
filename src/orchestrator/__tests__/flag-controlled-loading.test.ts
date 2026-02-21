// MX-10: Flag-Controlled Module Loading Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  wireFeatureHooks,
  DEFAULT_FEATURE_HOOKS,
} from '../lifecycle-wiring.js';
import { HookRegistry } from '../lifecycle-hooks.js';
import type { RalphLoopOptions } from '../ralph-loop-types.js';
import {
  FeatureFlagStore,
  FeatureFlagRegistry,
  registerDefaultFlags,
} from '../../config/feature-flags.js';

// ============================================================================
// Mock the feature flag store singleton
// ============================================================================

let mockRegistry: FeatureFlagRegistry;
let mockStore: FeatureFlagStore;

vi.mock('../../config/feature-flags.js', async () => {
  const actual = await vi.importActual<typeof import('../../config/feature-flags.js')>(
    '../../config/feature-flags.js'
  );

  return {
    ...actual,
    getFeatureFlagStore: () => mockStore,
  };
});

// ============================================================================
// Helpers
// ============================================================================

function makeOptions(overrides: Partial<RalphLoopOptions> = {}): RalphLoopOptions {
  return overrides as RalphLoopOptions;
}

function allR22R24Enabled(): RalphLoopOptions {
  return makeOptions({
    modelRoutingEnabled: true,
    perplexityEnabled: true,
    workflowEngineEnabled: true,
    infiniteMemoryEnabled: true,
    cinematicObservabilityEnabled: true,
    aiModelDatabaseEnabled: true,
    crdtCollaborationEnabled: true,
  });
}

/**
 * Create a fresh registry with default flags registered.
 * Default flags: model-routing=true, perplexity=false, workflow-engine=true,
 * infinite-memory=false, cinematic-observability=true, ai-model-database=false,
 * crdt-collaboration=false, experimental-features=false
 */
function createFreshRegistry(): FeatureFlagRegistry {
  const registry = new FeatureFlagRegistry();
  registerDefaultFlags(registry);
  return registry;
}

/**
 * Create a registry with ALL default flags set to a specific boolean value.
 */
function createRegistryWithAllFlags(value: boolean): FeatureFlagRegistry {
  const registry = new FeatureFlagRegistry();
  const flagNames = [
    'model-routing',
    'perplexity',
    'workflow-engine',
    'infinite-memory',
    'cinematic-observability',
    'ai-model-database',
    'crdt-collaboration',
  ];
  for (const name of flagNames) {
    registry.register({
      name,
      description: `Flag for ${name}`,
      defaultValue: value,
      type: 'boolean',
    });
  }
  return registry;
}

const R22_R24_MODULES = [
  { camelCase: 'modelRouting', kebabCase: 'model-routing', optionKey: 'modelRoutingEnabled' },
  { camelCase: 'perplexity', kebabCase: 'perplexity', optionKey: 'perplexityEnabled' },
  { camelCase: 'workflowEngine', kebabCase: 'workflow-engine', optionKey: 'workflowEngineEnabled' },
  { camelCase: 'infiniteMemory', kebabCase: 'infinite-memory', optionKey: 'infiniteMemoryEnabled' },
  { camelCase: 'cinematicObservability', kebabCase: 'cinematic-observability', optionKey: 'cinematicObservabilityEnabled' },
  { camelCase: 'aiModelDatabase', kebabCase: 'ai-model-database', optionKey: 'aiModelDatabaseEnabled' },
  { camelCase: 'crdtCollaboration', kebabCase: 'crdt-collaboration', optionKey: 'crdtCollaborationEnabled' },
] as const;

// ============================================================================
// Tests
// ============================================================================

describe('MX-10: Flag-Controlled Module Loading', () => {
  let hookRegistry: HookRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    hookRegistry = new HookRegistry();
    // Default: all R22-R24 flags enabled so they do not block
    mockRegistry = createRegistryWithAllFlags(true);
    mockStore = new FeatureFlagStore(mockRegistry);
  });

  // --------------------------------------------------------------------------
  // Core flag + options interaction
  // --------------------------------------------------------------------------

  describe('options + flag store interaction', () => {
    it('should load feature when both options and flag store say enabled', () => {
      // mockRegistry already has model-routing=true
      const options = makeOptions({ modelRoutingEnabled: true });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.featuresWired).toContain('modelRouting');
      expect(result.flagOverrides).toBe(0);
    });

    it('should skip feature when options disabled (flag store does not matter)', () => {
      // Flag store says enabled, but options say disabled
      const options = makeOptions({ modelRoutingEnabled: false });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.featuresWired).not.toContain('modelRouting');
      expect(result.flagOverrides).toBe(0);
    });

    it('should skip feature when flag store disables it even though options enable it', () => {
      // Set model-routing to false in the registry
      mockRegistry = createFreshRegistry();
      // registerDefaultFlags sets model-routing=true by default, override it
      mockRegistry.set('model-routing', false);
      mockStore = new FeatureFlagStore(mockRegistry);

      const options = makeOptions({ modelRoutingEnabled: true });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.featuresWired).not.toContain('modelRouting');
      expect(result.flagOverrides).toBeGreaterThanOrEqual(1);
    });

    it('should load feature when flag store has no opinion (options decides)', () => {
      // portfolio is NOT registered in the flag store at all
      const options = makeOptions({ portfolioEnabled: true });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.featuresWired).toContain('portfolio');
      expect(result.flagOverrides).toBe(0);
    });

    it('should skip feature when both options and flag store say disabled', () => {
      mockRegistry.set('model-routing', false);
      mockStore = new FeatureFlagStore(mockRegistry);

      const options = makeOptions({ modelRoutingEnabled: false });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.featuresWired).not.toContain('modelRouting');
    });
  });

  // --------------------------------------------------------------------------
  // Multiple features with mixed states
  // --------------------------------------------------------------------------

  describe('mixed flag states across multiple features', () => {
    it('should handle mixed enable/disable across features', () => {
      // model-routing enabled (default true from createRegistryWithAllFlags),
      // but set perplexity to false
      mockRegistry.set('perplexity', false);
      mockStore = new FeatureFlagStore(mockRegistry);

      const options = makeOptions({
        modelRoutingEnabled: true,
        perplexityEnabled: true,
        portfolioEnabled: true,
      });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.featuresWired).toContain('modelRouting');
      expect(result.featuresWired).not.toContain('perplexity');
      expect(result.featuresWired).toContain('portfolio');
      expect(result.flagOverrides).toBe(1);
    });

    it('should count multiple flag overrides correctly', () => {
      // Set all R22-R24 flags to false
      mockRegistry = createRegistryWithAllFlags(false);
      mockStore = new FeatureFlagStore(mockRegistry);

      const options = allR22R24Enabled();

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.flagOverrides).toBe(7);
      expect(result.featuresWired).toHaveLength(0);
    });

    it('should allow some R22-R24 through when selectively enabled in store', () => {
      // Start with all false, then enable some
      mockRegistry = createRegistryWithAllFlags(false);
      mockRegistry.set('model-routing', true);
      mockRegistry.set('perplexity', true);
      mockStore = new FeatureFlagStore(mockRegistry);

      const options = allR22R24Enabled();

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.featuresWired).toContain('modelRouting');
      expect(result.featuresWired).toContain('perplexity');
      expect(result.featuresWired).not.toContain('workflowEngine');
      expect(result.flagOverrides).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // Flag store reset does not affect already-wired hooks
  // --------------------------------------------------------------------------

  describe('flag store reset after wiring', () => {
    it('should not affect already-wired hooks when flag store is reset', () => {
      // model-routing is enabled (true)
      const options = makeOptions({ modelRoutingEnabled: true });

      const result = wireFeatureHooks(hookRegistry, options);
      expect(result.featuresWired).toContain('modelRouting');

      const hooksBeforeReset = hookRegistry.getHookCount();

      // Reset the registry — already wired hooks should remain in the hook registry
      mockRegistry.resetAll();

      expect(hookRegistry.getHookCount()).toBe(hooksBeforeReset);
      const modules = hookRegistry.getRegisteredModules();
      expect(modules).toContain('model-routing');
    });
  });

  // --------------------------------------------------------------------------
  // Env var override via flag store
  // --------------------------------------------------------------------------

  describe('environment variable overrides', () => {
    it('should override options when NOVA26_FF_MODEL_ROUTING=false', () => {
      mockRegistry = createFreshRegistry();
      // Simulate env var override
      const originalEnv = process.env['NOVA26_FF_MODEL_ROUTING'];
      process.env['NOVA26_FF_MODEL_ROUTING'] = 'false';
      mockRegistry.loadFromEnv();
      // Restore env
      if (originalEnv === undefined) {
        delete process.env['NOVA26_FF_MODEL_ROUTING'];
      } else {
        process.env['NOVA26_FF_MODEL_ROUTING'] = originalEnv;
      }

      mockStore = new FeatureFlagStore(mockRegistry);

      const options = makeOptions({ modelRoutingEnabled: true });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.featuresWired).not.toContain('modelRouting');
      expect(result.flagOverrides).toBeGreaterThanOrEqual(1);
    });

    it('should allow feature when NOVA26_FF_MODEL_ROUTING=true', () => {
      mockRegistry = createFreshRegistry();
      const originalEnv = process.env['NOVA26_FF_MODEL_ROUTING'];
      process.env['NOVA26_FF_MODEL_ROUTING'] = 'true';
      mockRegistry.loadFromEnv();
      if (originalEnv === undefined) {
        delete process.env['NOVA26_FF_MODEL_ROUTING'];
      } else {
        process.env['NOVA26_FF_MODEL_ROUTING'] = originalEnv;
      }

      mockStore = new FeatureFlagStore(mockRegistry);

      const options = makeOptions({ modelRoutingEnabled: true });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.featuresWired).toContain('modelRouting');
    });

    it('should respect env-loaded false value for perplexity override', () => {
      mockRegistry = createFreshRegistry();
      // Env sets perplexity to false (it defaults to false, env confirms)
      const originalEnv = process.env['NOVA26_FF_PERPLEXITY'];
      process.env['NOVA26_FF_PERPLEXITY'] = 'false';
      mockRegistry.loadFromEnv();
      if (originalEnv === undefined) {
        delete process.env['NOVA26_FF_PERPLEXITY'];
      } else {
        process.env['NOVA26_FF_PERPLEXITY'] = originalEnv;
      }

      mockStore = new FeatureFlagStore(mockRegistry);

      const options = makeOptions({ perplexityEnabled: true });

      const result = wireFeatureHooks(hookRegistry, options);

      // perplexity was set to false via env, so it should be overridden
      expect(result.featuresWired).not.toContain('perplexity');
      expect(result.flagOverrides).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // All 7 R22-R24 modules respect flag overrides
  // --------------------------------------------------------------------------

  describe('R22-R24 modules respect flag overrides', () => {
    it.each(R22_R24_MODULES)(
      'should skip $camelCase when flag store disables it',
      ({ camelCase, kebabCase, optionKey }) => {
        // Start with all enabled, then disable this specific one
        mockRegistry.set(kebabCase, false);
        mockStore = new FeatureFlagStore(mockRegistry);

        const options = makeOptions({ [optionKey]: true });

        const result = wireFeatureHooks(hookRegistry, options);

        expect(result.featuresWired).not.toContain(camelCase);
        expect(result.flagOverrides).toBe(1);
      }
    );

    it.each(R22_R24_MODULES)(
      'should load $camelCase when flag store enables it',
      ({ camelCase, kebabCase, optionKey }) => {
        // Ensure the flag is explicitly enabled
        mockRegistry.set(kebabCase, true);
        mockStore = new FeatureFlagStore(mockRegistry);

        const options = makeOptions({ [optionKey]: true });

        const result = wireFeatureHooks(hookRegistry, options);

        expect(result.featuresWired).toContain(camelCase);
        expect(result.flagOverrides).toBe(0);
      }
    );
  });

  // --------------------------------------------------------------------------
  // Flag override count in return stats
  // --------------------------------------------------------------------------

  describe('flagOverrides stat tracking', () => {
    it('should return flagOverrides = 0 when no overrides occur', () => {
      // No R22-R24 flags involved, portfolio/debug are not in flag store
      const options = makeOptions({ portfolioEnabled: true, debugEngineEnabled: true });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.flagOverrides).toBe(0);
    });

    it('should return flagOverrides = 0 when all options are disabled', () => {
      const options = makeOptions({});

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.flagOverrides).toBe(0);
    });

    it('should increment flagOverrides for each flag-store-disabled feature', () => {
      // Set all to false
      mockRegistry = createRegistryWithAllFlags(false);
      mockStore = new FeatureFlagStore(mockRegistry);

      // Enable 3 R22-R24 modules in options, all false in store
      const options = makeOptions({
        modelRoutingEnabled: true,
        perplexityEnabled: true,
        workflowEngineEnabled: true,
      });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.flagOverrides).toBe(3);
      expect(result.wiredCount).toBe(0);
    });

    it('should include flagOverrides in skippedCount', () => {
      // Disable model-routing in flag store
      mockRegistry.set('model-routing', false);
      mockStore = new FeatureFlagStore(mockRegistry);

      const options = makeOptions({
        modelRoutingEnabled: true,
        portfolioEnabled: true,
      });

      const result = wireFeatureHooks(hookRegistry, options);

      // modelRouting is overridden by flag store, portfolio wires
      expect(result.flagOverrides).toBe(1);
      expect(result.wiredCount).toBe(1);
      // skippedCount includes both options-disabled and flag-overridden features
      expect(result.skippedCount).toBeGreaterThanOrEqual(result.flagOverrides);
    });

    it('should correctly report stats with all features enabled but flag store blocking R22-R24', () => {
      // Set all R22-R24 flags to false
      mockRegistry = createRegistryWithAllFlags(false);
      mockStore = new FeatureFlagStore(mockRegistry);

      // Enable all 24 features in options
      const options: RalphLoopOptions = {
        portfolioEnabled: true,
        agentMemoryEnabled: true,
        generativeUIEnabled: true,
        autonomousTestingEnabled: true,
        wellbeingEnabled: true,
        advancedRecoveryEnabled: true,
        advancedInitEnabled: true,
        codeReviewEnabled: true,
        migrationEnabled: true,
        debugEngineEnabled: true,
        accessibilityEnabled: true,
        debtScoringEnabled: true,
        dependencyManagementEnabled: true,
        productionFeedbackEnabled: true,
        healthDashboardEnabled: true,
        envManagementEnabled: true,
        orchestrationOptimizationEnabled: true,
        modelRoutingEnabled: true,
        perplexityEnabled: true,
        workflowEngineEnabled: true,
        infiniteMemoryEnabled: true,
        cinematicObservabilityEnabled: true,
        aiModelDatabaseEnabled: true,
        crdtCollaborationEnabled: true,
      };

      const result = wireFeatureHooks(hookRegistry, options);

      // All 7 R22-R24 modules are blocked by false flags
      expect(result.flagOverrides).toBe(7);
      // 17 R16/R17 features wire successfully
      expect(result.wiredCount).toBe(17);
      expect(result.skippedCount).toBe(7);
      expect(result.totalHooks).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // R16/R17 features are NOT affected by flag store (no opinion)
  // --------------------------------------------------------------------------

  describe('R16/R17 features unaffected by flag store', () => {
    it('should wire R16 features regardless of flag store (no flags defined)', () => {
      const options = makeOptions({
        portfolioEnabled: true,
        agentMemoryEnabled: true,
        generativeUIEnabled: true,
        autonomousTestingEnabled: true,
        wellbeingEnabled: true,
      });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.wiredCount).toBe(5);
      expect(result.flagOverrides).toBe(0);
    });

    it('should wire R17 features regardless of flag store (no flags defined)', () => {
      const options = makeOptions({
        advancedRecoveryEnabled: true,
        advancedInitEnabled: true,
        codeReviewEnabled: true,
        migrationEnabled: true,
        debugEngineEnabled: true,
        accessibilityEnabled: true,
        debtScoringEnabled: true,
        dependencyManagementEnabled: true,
        productionFeedbackEnabled: true,
        healthDashboardEnabled: true,
        envManagementEnabled: true,
        orchestrationOptimizationEnabled: true,
      });

      const result = wireFeatureHooks(hookRegistry, options);

      expect(result.wiredCount).toBe(12);
      expect(result.flagOverrides).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Hook registration integrity
  // --------------------------------------------------------------------------

  describe('hook registration integrity with flag overrides', () => {
    it('should not register hooks for flag-overridden features', () => {
      // Disable model-routing in flag store
      mockRegistry.set('model-routing', false);
      mockStore = new FeatureFlagStore(mockRegistry);

      const options = makeOptions({ modelRoutingEnabled: true });

      wireFeatureHooks(hookRegistry, options);

      const modules = hookRegistry.getRegisteredModules();
      expect(modules).not.toContain('model-routing');
      expect(hookRegistry.getHookCount()).toBe(0);
    });

    it('should register correct hooks when feature passes both checks', () => {
      // model-routing is already true in our default mock setup
      const options = makeOptions({ modelRoutingEnabled: true });

      wireFeatureHooks(hookRegistry, options);

      const modules = hookRegistry.getRegisteredModules();
      expect(modules).toContain('model-routing');

      // modelRouting has onBeforeBuild + onBeforeTask = 2 hooks
      const config = DEFAULT_FEATURE_HOOKS['modelRouting'];
      const expectedHooks = Object.values(config.phases).filter(Boolean).length;
      expect(hookRegistry.getHookCount()).toBe(expectedHooks);
    });
  });
});
