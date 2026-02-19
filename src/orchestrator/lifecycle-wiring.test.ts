// KIMI-W-02: Lifecycle Wiring Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  wireFeatureHooks,
  getWiringSummary,
  FeatureLifecycleRegistry,
  DEFAULT_FEATURE_HOOKS,
} from './lifecycle-wiring.js';
import { HookRegistry, type RalphLoopOptions } from './ralph-loop-types.js';

describe('lifecycle-wiring', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  describe('wireFeatureHooks()', () => {
    it('should wire all enabled features', () => {
      const options: Partial<RalphLoopOptions> = {
        portfolioEnabled: true,
        autonomousTestingEnabled: true,
        debugEngineEnabled: true,
      };

      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.wiredCount).toBe(3);
      expect(result.featuresWired).toContain('portfolio');
      expect(result.featuresWired).toContain('autonomousTesting');
      expect(result.featuresWired).toContain('debug');
    });

    it('should skip disabled features', () => {
      const options: Partial<RalphLoopOptions> = {
        portfolioEnabled: true,
        debtScoringEnabled: false,
        migrationEnabled: undefined,
      };

      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.skippedCount).toBeGreaterThan(0);
      expect(result.featuresWired).toContain('portfolio');
      expect(result.featuresWired).not.toContain('debt');
      expect(result.featuresWired).not.toContain('migration');
    });

    it('should wire all R16 features when enabled', () => {
      const options: Partial<RalphLoopOptions> = {
        portfolioEnabled: true,
        generativeUIEnabled: true,
        autonomousTestingEnabled: true,
      };

      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.wiredCount).toBe(3);
      expect(result.featuresWired).toContain('portfolio');
      expect(result.featuresWired).toContain('generativeUI');
      expect(result.featuresWired).toContain('autonomousTesting');
    });

    it('should wire all R17 features when enabled', () => {
      const options: Partial<RalphLoopOptions> = {
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
      };

      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.wiredCount).toBe(10);
      expect(result.featuresWired).toContain('codeReview');
      expect(result.featuresWired).toContain('migration');
      expect(result.featuresWired).toContain('debug');
      expect(result.featuresWired).toContain('accessibility');
      expect(result.featuresWired).toContain('debt');
      expect(result.featuresWired).toContain('dependencyManagement');
      expect(result.featuresWired).toContain('productionFeedback');
      expect(result.featuresWired).toContain('health');
      expect(result.featuresWired).toContain('environment');
      expect(result.featuresWired).toContain('orchestration');
    });

    it('should register correct number of hooks based on phase configuration', () => {
      // debug only has onTaskError = 1 hook
      const options: Partial<RalphLoopOptions> = {
        debugEngineEnabled: true,
      };

      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.totalHooks).toBe(1);
      expect(result.featuresWired).toContain('debug');
    });

    it('should use correct priority for each feature', () => {
      const options: Partial<RalphLoopOptions> = {
        portfolioEnabled: true,
        autonomousTestingEnabled: true,
        debugEngineEnabled: true,
      };

      wireFeatureHooks(registry, options as RalphLoopOptions);

      const onBeforeBuildHooks = registry.getHooksForPhase('onBeforeBuild');
      const portfolioHook = onBeforeBuildHooks.find(h => h.moduleName === 'portfolio');
      const autonomousTestingHook = registry
        .getHooksForPhase('onTaskError')
        .find(h => h.moduleName === 'autonomous-testing');
      const debugHook = registry
        .getHooksForPhase('onTaskError')
        .find(h => h.moduleName === 'debug');

      expect(portfolioHook?.priority).toBe(DEFAULT_FEATURE_HOOKS.portfolio.priority);
      expect(autonomousTestingHook?.priority).toBe(DEFAULT_FEATURE_HOOKS.autonomousTesting.priority);
      expect(debugHook?.priority).toBe(DEFAULT_FEATURE_HOOKS.debug.priority);
    });

    it('should return empty results for no enabled features', () => {
      const options: Partial<RalphLoopOptions> = {};

      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.wiredCount).toBe(0);
      expect(result.totalHooks).toBe(0);
      expect(result.featuresWired).toEqual([]);
    });

    it('should handle all 13 feature flags', () => {
      const allEnabled: RalphLoopOptions = {
        portfolioEnabled: true,
        generativeUIEnabled: true,
        autonomousTestingEnabled: true,
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
      };

      const result = wireFeatureHooks(registry, allEnabled);
      expect(result.wiredCount).toBe(13);
    });
  });

  describe('getWiringSummary()', () => {
    it('should categorize features correctly', () => {
      const options: Partial<RalphLoopOptions> = {
        portfolioEnabled: true,
        debugEngineEnabled: true,
        debtScoringEnabled: false,
        migrationEnabled: false,
      };

      const summary = getWiringSummary(options as RalphLoopOptions);

      expect(summary.wouldWire).toContain('portfolio');
      expect(summary.wouldWire).toContain('debug');
      expect(summary.wouldSkip).toContain('debt');
      expect(summary.wouldSkip).toContain('migration');
    });

    it('should handle all feature flags', () => {
      const allEnabled: RalphLoopOptions = {
        portfolioEnabled: true,
        generativeUIEnabled: true,
        autonomousTestingEnabled: true,
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
      };

      const summary = getWiringSummary(allEnabled);

      expect(summary.wouldWire).toHaveLength(13);
      expect(summary.wouldSkip).toHaveLength(0);
    });

    it('should handle all disabled', () => {
      const options: RalphLoopOptions = {
        portfolioEnabled: false,
        generativeUIEnabled: false,
        autonomousTestingEnabled: false,
        codeReviewEnabled: false,
        migrationEnabled: false,
        debugEngineEnabled: false,
        accessibilityEnabled: false,
        debtScoringEnabled: false,
        dependencyManagementEnabled: false,
        productionFeedbackEnabled: false,
        healthDashboardEnabled: false,
        envManagementEnabled: false,
        orchestrationOptimizationEnabled: false,
      };

      const summary = getWiringSummary(options);

      expect(summary.wouldWire).toHaveLength(0);
      expect(summary.wouldSkip).toHaveLength(13);
    });
  });

  describe('FeatureLifecycleRegistry', () => {
    let featureRegistry: FeatureLifecycleRegistry;

    beforeEach(() => {
      featureRegistry = new FeatureLifecycleRegistry();
    });

    describe('register()', () => {
      it('should register a feature with handlers', () => {
        featureRegistry.register(
          'test-feature',
          true,
          {
            onBeforeBuild: async () => {},
            onBuildComplete: async () => {},
          },
          {
            moduleName: 'test-feature',
            phases: { onBeforeBuild: true, onBuildComplete: true },
            priority: 50,
          }
        );

        const feature = featureRegistry.getFeature('test-feature');
        expect(feature).toBeDefined();
        expect(feature?.enabled).toBe(true);
        expect(feature?.handlers.onBeforeBuild).toBeDefined();
        expect(feature?.handlers.onBuildComplete).toBeDefined();
      });

      it('should use default config when not provided', () => {
        featureRegistry.register('portfolio', true, {});

        const feature = featureRegistry.getFeature('portfolio');
        expect(feature?.config.moduleName).toBe('portfolio');
        expect(feature?.config.priority).toBe(DEFAULT_FEATURE_HOOKS.portfolio.priority);
      });
    });

    describe('getEnabledFeatures()', () => {
      it('should return only enabled features', () => {
        featureRegistry.register('enabled-1', true, {});
        featureRegistry.register('disabled', false, {});
        featureRegistry.register('enabled-2', true, {});

        const enabled = featureRegistry.getEnabledFeatures();
        expect(enabled).toHaveLength(2);
        expect(enabled.map(f => f.name)).toContain('enabled-1');
        expect(enabled.map(f => f.name)).toContain('enabled-2');
        expect(enabled.map(f => f.name)).not.toContain('disabled');
      });

      it('should return empty array when no features', () => {
        expect(featureRegistry.getEnabledFeatures()).toEqual([]);
      });
    });

    describe('unregister()', () => {
      it('should remove a feature', () => {
        featureRegistry.register('test', true, {});
        expect(featureRegistry.getFeature('test')).toBeDefined();

        expect(featureRegistry.unregister('test')).toBe(true);
        expect(featureRegistry.getFeature('test')).toBeUndefined();
      });

      it('should return false for non-existent feature', () => {
        expect(featureRegistry.unregister('non-existent')).toBe(false);
      });
    });

    describe('clear()', () => {
      it('should remove all features', () => {
        featureRegistry.register('a', true, {});
        featureRegistry.register('b', false, {});

        featureRegistry.clear();

        expect(featureRegistry.getEnabledFeatures()).toHaveLength(0);
        expect(featureRegistry.getFeature('a')).toBeUndefined();
      });
    });
  });

  describe('Integration with HookRegistry', () => {
    it('should wire hooks in correct priority order', () => {
      const options: Partial<RalphLoopOptions> = {
        // debug has priority 20
        debugEngineEnabled: true,
        // autonomousTesting has priority 40
        autonomousTestingEnabled: true,
        // portfolio has priority 50
        portfolioEnabled: true,
      };

      wireFeatureHooks(registry, options as RalphLoopOptions);

      // Get onTaskError phase - both debug and autonomousTesting have handlers here
      const onTaskErrorHooks = registry.getHooksForPhase('onTaskError');
      const priorities = onTaskErrorHooks.map(h => h.priority);
      
      // Should be sorted ascending
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
      }
    });

    it('should allow executing wired hooks', async () => {
      const options: Partial<RalphLoopOptions> = {
        debugEngineEnabled: true,
      };

      wireFeatureHooks(registry, options as RalphLoopOptions);

      // Should not throw
      await expect(
        registry.executePhase('onTaskError', { taskId: 'test' })
      ).resolves.not.toThrow();
    });
  });

  describe('Phase Coverage', () => {
    it('should wire hooks to all 6 phases', () => {
      // Enable all features
      const allEnabled: RalphLoopOptions = {
        portfolioEnabled: true,
        generativeUIEnabled: true,
        autonomousTestingEnabled: true,
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
      };

      wireFeatureHooks(registry, allEnabled);

      // Verify each phase has hooks
      expect(registry.getHooksForPhase('onBeforeBuild').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onBeforeTask').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onAfterTask').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onTaskError').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onHandoff').length).toBeGreaterThan(0);
      expect(registry.getHooksForPhase('onBuildComplete').length).toBeGreaterThan(0);
    });
  });
});
