// S-01-05: Integration tests for lifecycle wiring system

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  wireFeatureHooks,
  getWiringSummary,
  DEFAULT_FEATURE_HOOKS,
  FeatureLifecycleRegistry,
} from '../lifecycle-wiring.js';
import {
  HookRegistry,
  getGlobalHookRegistry,
  resetGlobalHookRegistry,
  type HookPhase,
} from '../lifecycle-hooks.js';
import type { RalphLoopOptions } from '../ralph-loop-types.js';

// ============================================================================
// Helpers
// ============================================================================

function allFeaturesEnabled(): RalphLoopOptions {
  return {
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
    // R22-R24 Features
    modelRoutingEnabled: true,
    perplexityEnabled: true,
    workflowEngineEnabled: true,
    infiniteMemoryEnabled: true,
    cinematicObservabilityEnabled: true,
    aiModelDatabaseEnabled: true,
    crdtCollaborationEnabled: true,
  };
}

function noFeaturesEnabled(): RalphLoopOptions {
  return {};
}

// ============================================================================
// Tests
// ============================================================================

describe('Lifecycle Wiring Integration Tests', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
    resetGlobalHookRegistry();
  });

  // --------------------------------------------------------------------------
  // wireFeatureHooks() — all features
  // --------------------------------------------------------------------------

  describe('wireFeatureHooks() — all 24 features enabled', () => {
    it('should wire exactly 24 features', () => {
      const result = wireFeatureHooks(registry, allFeaturesEnabled());
      expect(result.wiredCount).toBe(24);
      expect(result.skippedCount).toBe(0);
    });

    it('should register the correct total number of hooks', () => {
      // Count expected hooks from DEFAULT_FEATURE_HOOKS phase configs
      let expectedHooks = 0;
      for (const config of Object.values(DEFAULT_FEATURE_HOOKS)) {
        expectedHooks += Object.values(config.phases).filter(Boolean).length;
      }

      const result = wireFeatureHooks(registry, allFeaturesEnabled());
      expect(result.totalHooks).toBe(expectedHooks);
    });

    it('should return all 24 feature names in featuresWired', () => {
      const result = wireFeatureHooks(registry, allFeaturesEnabled());
      const expected = Object.keys(DEFAULT_FEATURE_HOOKS);
      expect(result.featuresWired).toHaveLength(expected.length);
      for (const name of expected) {
        expect(result.featuresWired).toContain(name);
      }
    });
  });

  // --------------------------------------------------------------------------
  // wireFeatureHooks() — no features
  // --------------------------------------------------------------------------

  describe('wireFeatureHooks() — no features enabled', () => {
    it('should wire 0 features', () => {
      const result = wireFeatureHooks(registry, noFeaturesEnabled());
      expect(result.wiredCount).toBe(0);
    });

    it('should register 0 hooks', () => {
      const result = wireFeatureHooks(registry, noFeaturesEnabled());
      expect(result.totalHooks).toBe(0);
    });

    it('should return empty featuresWired', () => {
      const result = wireFeatureHooks(registry, noFeaturesEnabled());
      expect(result.featuresWired).toEqual([]);
    });

    it('should skip all 24 features', () => {
      const result = wireFeatureHooks(registry, noFeaturesEnabled());
      expect(result.skippedCount).toBe(24);
    });
  });

  // --------------------------------------------------------------------------
  // wireFeatureHooks() — partial features
  // --------------------------------------------------------------------------

  describe('wireFeatureHooks() — partial features', () => {
    it('should only wire enabled features', () => {
      const options: Partial<RalphLoopOptions> = {
        portfolioEnabled: true,
        debugEngineEnabled: true,
      };

      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.wiredCount).toBe(2);
      expect(result.featuresWired).toContain('portfolio');
      expect(result.featuresWired).toContain('debug');
      expect(result.featuresWired).not.toContain('agentMemory');
    });

    it('should treat false and undefined as disabled', () => {
      const options: Partial<RalphLoopOptions> = {
        portfolioEnabled: true,
        debtScoringEnabled: false,
        migrationEnabled: undefined,
      };

      const result = wireFeatureHooks(registry, options as RalphLoopOptions);

      expect(result.featuresWired).toContain('portfolio');
      expect(result.featuresWired).not.toContain('debt');
      expect(result.featuresWired).not.toContain('migration');
    });

    it('should wire R16-02 agentMemory with correct phases', () => {
      const result = wireFeatureHooks(registry, { agentMemoryEnabled: true } as RalphLoopOptions);

      expect(result.wiredCount).toBe(1);
      expect(result.featuresWired).toContain('agentMemory');
      expect(result.totalHooks).toBe(2); // onBeforeBuild + onAfterTask
    });

    it('should wire R16-05 wellbeing with correct phases', () => {
      const result = wireFeatureHooks(registry, { wellbeingEnabled: true } as RalphLoopOptions);

      expect(result.wiredCount).toBe(1);
      expect(result.featuresWired).toContain('wellbeing');
      expect(result.totalHooks).toBe(3); // onBeforeTask + onAfterTask + onBuildComplete
    });

    it('should wire R17-01 advancedRecovery with correct phases', () => {
      const result = wireFeatureHooks(registry, { advancedRecoveryEnabled: true } as RalphLoopOptions);

      expect(result.wiredCount).toBe(1);
      expect(result.featuresWired).toContain('advancedRecovery');
      expect(result.totalHooks).toBe(1); // onTaskError only
    });

    it('should wire R17-02 advancedInit with correct phases', () => {
      const result = wireFeatureHooks(registry, { advancedInitEnabled: true } as RalphLoopOptions);

      expect(result.wiredCount).toBe(1);
      expect(result.featuresWired).toContain('advancedInit');
      expect(result.totalHooks).toBe(1); // onBeforeBuild only
    });
  });

  // --------------------------------------------------------------------------
  // Priority ordering
  // --------------------------------------------------------------------------

  describe('Priority ordering', () => {
    it('should order advancedInit (5) before productionFeedback (110)', () => {
      const options: Partial<RalphLoopOptions> = {
        advancedInitEnabled: true,
        productionFeedbackEnabled: true,
        portfolioEnabled: true,
      };

      wireFeatureHooks(registry, options as RalphLoopOptions);

      // advancedInit is in onBeforeBuild, productionFeedback is in onBuildComplete
      // Across phases, priority is used within each phase
      const onBeforeBuild = registry.getHooksForPhase('onBeforeBuild');
      const advancedInitHook = onBeforeBuild.find(h => h.moduleName === 'advanced-init');
      expect(advancedInitHook?.priority).toBe(5);

      const onBuildComplete = registry.getHooksForPhase('onBuildComplete');
      const prodFeedbackHook = onBuildComplete.find(h => h.moduleName === 'production-feedback');
      expect(prodFeedbackHook?.priority).toBe(110);
    });

    it('should sort hooks within a phase by priority ascending', () => {
      wireFeatureHooks(registry, allFeaturesEnabled());

      const phases: HookPhase[] = [
        'onBeforeBuild', 'onBeforeTask', 'onAfterTask',
        'onTaskError', 'onHandoff', 'onBuildComplete',
      ];

      for (const phase of phases) {
        const hooks = registry.getHooksForPhase(phase);
        for (let i = 1; i < hooks.length; i++) {
          expect(hooks[i].priority).toBeGreaterThanOrEqual(hooks[i - 1].priority);
        }
      }
    });

    it('should run environment (10) before dependencyManagement (100) in onBeforeBuild', () => {
      const options: Partial<RalphLoopOptions> = {
        envManagementEnabled: true,
        dependencyManagementEnabled: true,
      };

      wireFeatureHooks(registry, options as RalphLoopOptions);

      const hooks = registry.getHooksForPhase('onBeforeBuild');
      const envIdx = hooks.findIndex(h => h.moduleName === 'environment');
      const depIdx = hooks.findIndex(h => h.moduleName === 'dependency-management');

      expect(envIdx).toBeLessThan(depIdx);
    });

    it('should run advancedRecovery (15) before debug (20) in onTaskError', () => {
      const options: Partial<RalphLoopOptions> = {
        advancedRecoveryEnabled: true,
        debugEngineEnabled: true,
      };

      wireFeatureHooks(registry, options as RalphLoopOptions);

      const hooks = registry.getHooksForPhase('onTaskError');
      const recoveryIdx = hooks.findIndex(h => h.moduleName === 'advanced-recovery');
      const debugIdx = hooks.findIndex(h => h.moduleName === 'debug');

      expect(recoveryIdx).toBeLessThan(debugIdx);
    });

    it('should have correct priority for all 24 features', () => {
      const expectedPriorities: Record<string, number> = {
        advancedInit: 5,
        cinematicObservability: 8,
        environment: 10,
        advancedRecovery: 15,
        debug: 20,
        orchestration: 25,
        health: 30,
        wellbeing: 35,
        workflowEngine: 38,
        autonomousTesting: 40,
        modelRouting: 42,
        aiModelDatabase: 44,
        agentMemory: 45,
        infiniteMemory: 48,
        portfolio: 50,
        crdtCollaboration: 52,
        accessibility: 55,
        generativeUI: 60,
        perplexity: 65,
        codeReview: 70,
        migration: 80,
        debt: 90,
        dependencyManagement: 100,
        productionFeedback: 110,
      };

      for (const [name, expectedPriority] of Object.entries(expectedPriorities)) {
        expect(DEFAULT_FEATURE_HOOKS[name]?.priority).toBe(expectedPriority);
      }
    });
  });

  // --------------------------------------------------------------------------
  // getWiringSummary()
  // --------------------------------------------------------------------------

  describe('getWiringSummary()', () => {
    it('should categorize all enabled as wouldWire', () => {
      const summary = getWiringSummary(allFeaturesEnabled());
      expect(summary.wouldWire).toHaveLength(24);
      expect(summary.wouldSkip).toHaveLength(0);
      expect(summary.unknown).toHaveLength(0);
    });

    it('should categorize all disabled as wouldSkip', () => {
      const summary = getWiringSummary(noFeaturesEnabled());
      expect(summary.wouldWire).toHaveLength(0);
      expect(summary.wouldSkip).toHaveLength(24);
    });

    it('should correctly split mixed enabled/disabled', () => {
      const options: Partial<RalphLoopOptions> = {
        portfolioEnabled: true,
        debugEngineEnabled: true,
        wellbeingEnabled: true,
      };

      const summary = getWiringSummary(options as RalphLoopOptions);

      expect(summary.wouldWire).toHaveLength(3);
      expect(summary.wouldSkip).toHaveLength(21);
      expect(summary.wouldWire).toContain('portfolio');
      expect(summary.wouldWire).toContain('debug');
      expect(summary.wouldWire).toContain('wellbeing');
    });

    it('should include new R16-02/R16-05/R17-01/R17-02 features', () => {
      const options: Partial<RalphLoopOptions> = {
        agentMemoryEnabled: true,
        wellbeingEnabled: true,
        advancedRecoveryEnabled: true,
        advancedInitEnabled: true,
      };

      const summary = getWiringSummary(options as RalphLoopOptions);

      expect(summary.wouldWire).toContain('agentMemory');
      expect(summary.wouldWire).toContain('wellbeing');
      expect(summary.wouldWire).toContain('advancedRecovery');
      expect(summary.wouldWire).toContain('advancedInit');
    });

    it('should match wireFeatureHooks results', () => {
      const options = allFeaturesEnabled();
      const summary = getWiringSummary(options);
      const result = wireFeatureHooks(registry, options);

      expect(summary.wouldWire.sort()).toEqual(result.featuresWired.sort());
    });
  });

  // --------------------------------------------------------------------------
  // HookRegistry phase execution
  // --------------------------------------------------------------------------

  describe('HookRegistry phase execution', () => {
    it('should execute hooks in priority order', async () => {
      const executionOrder: string[] = [];

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'high-priority',
        priority: 10,
        handler: async () => { executionOrder.push('high'); },
      });

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'low-priority',
        priority: 100,
        handler: async () => { executionOrder.push('low'); },
      });

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'mid-priority',
        priority: 50,
        handler: async () => { executionOrder.push('mid'); },
      });

      await registry.executePhase('onBeforeBuild', { buildId: 'test' });

      expect(executionOrder).toEqual(['high', 'mid', 'low']);
    });

    it('should only execute hooks for the requested phase', async () => {
      const executed: string[] = [];

      registry.register({
        phase: 'onBeforeBuild',
        moduleName: 'before-build',
        priority: 10,
        handler: async () => { executed.push('onBeforeBuild'); },
      });

      registry.register({
        phase: 'onAfterTask',
        moduleName: 'after-task',
        priority: 10,
        handler: async () => { executed.push('onAfterTask'); },
      });

      await registry.executePhase('onBeforeBuild', {});

      expect(executed).toEqual(['onBeforeBuild']);
    });
  });

  // --------------------------------------------------------------------------
  // Error isolation
  // --------------------------------------------------------------------------

  describe('Error isolation', () => {
    it('should not crash when one hook throws', async () => {
      const executed: string[] = [];

      registry.register({
        phase: 'onAfterTask',
        moduleName: 'first',
        priority: 10,
        handler: async () => { executed.push('first'); },
      });

      registry.register({
        phase: 'onAfterTask',
        moduleName: 'failing',
        priority: 20,
        handler: async () => { throw new Error('hook failure'); },
      });

      registry.register({
        phase: 'onAfterTask',
        moduleName: 'third',
        priority: 30,
        handler: async () => { executed.push('third'); },
      });

      // Should not throw
      await expect(registry.executePhase('onAfterTask', {})).resolves.not.toThrow();

      // First and third should still execute
      expect(executed).toContain('first');
      expect(executed).toContain('third');
    });

    it('should log error from failing hook', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.register({
        phase: 'onTaskError',
        moduleName: 'bad-hook',
        priority: 10,
        handler: async () => { throw new Error('intentional'); },
      });

      await registry.executePhase('onTaskError', {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bad-hook'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // getRegisteredModules()
  // --------------------------------------------------------------------------

  describe('getRegisteredModules()', () => {
    it('should return unique module names', () => {
      wireFeatureHooks(registry, allFeaturesEnabled());

      const modules = registry.getRegisteredModules();
      const uniqueModules = new Set(modules);

      expect(modules.length).toBe(uniqueModules.size);
    });

    it('should include all 24 module names when all enabled', () => {
      wireFeatureHooks(registry, allFeaturesEnabled());

      const modules = registry.getRegisteredModules();

      expect(modules).toContain('portfolio');
      expect(modules).toContain('agent-memory');
      expect(modules).toContain('wellbeing');
      expect(modules).toContain('advanced-recovery');
      expect(modules).toContain('advanced-init');
      expect(modules).toContain('model-routing');
      expect(modules).toContain('perplexity');
      expect(modules).toContain('workflow-engine');
      expect(modules).toContain('infinite-memory');
      expect(modules).toContain('cinematic-observability');
      expect(modules).toContain('ai-model-database');
      expect(modules).toContain('crdt-collaboration');
      expect(modules.length).toBe(24);
    });

    it('should return empty array when no features wired', () => {
      wireFeatureHooks(registry, noFeaturesEnabled());
      expect(registry.getRegisteredModules()).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Singleton registry
  // --------------------------------------------------------------------------

  describe('Singleton registry', () => {
    it('should return same instance from getGlobalHookRegistry()', () => {
      const a = getGlobalHookRegistry();
      const b = getGlobalHookRegistry();
      expect(a).toBe(b);
    });

    it('should return new instance after resetGlobalHookRegistry()', () => {
      const a = getGlobalHookRegistry();
      resetGlobalHookRegistry();
      const b = getGlobalHookRegistry();
      expect(a).not.toBe(b);
    });

    it('should clear hooks on reset', () => {
      const reg = getGlobalHookRegistry();
      reg.register({
        phase: 'onBeforeBuild',
        moduleName: 'test',
        priority: 10,
        handler: async () => {},
      });
      expect(reg.getHookCount()).toBe(1);

      resetGlobalHookRegistry();
      const newReg = getGlobalHookRegistry();
      expect(newReg.getHookCount()).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Phase configuration per feature
  // --------------------------------------------------------------------------

  describe('Phase configuration per feature', () => {
    it('debug should only have onTaskError', () => {
      const config = DEFAULT_FEATURE_HOOKS.debug;
      const enabledPhases = Object.entries(config.phases).filter(([, v]) => v).map(([k]) => k);
      expect(enabledPhases).toEqual(['onTaskError']);
    });

    it('advancedInit should only have onBeforeBuild', () => {
      const config = DEFAULT_FEATURE_HOOKS.advancedInit;
      const enabledPhases = Object.entries(config.phases).filter(([, v]) => v).map(([k]) => k);
      expect(enabledPhases).toEqual(['onBeforeBuild']);
    });

    it('wellbeing should have onBeforeTask, onAfterTask, onBuildComplete', () => {
      const config = DEFAULT_FEATURE_HOOKS.wellbeing;
      const enabledPhases = Object.entries(config.phases).filter(([, v]) => v).map(([k]) => k).sort();
      expect(enabledPhases).toEqual(['onAfterTask', 'onBeforeTask', 'onBuildComplete']);
    });

    it('orchestration should have onHandoff and onBeforeTask', () => {
      const config = DEFAULT_FEATURE_HOOKS.orchestration;
      const enabledPhases = Object.entries(config.phases).filter(([, v]) => v).map(([k]) => k).sort();
      expect(enabledPhases).toEqual(['onBeforeTask', 'onHandoff']);
    });

    it('productionFeedback should only have onBuildComplete', () => {
      const config = DEFAULT_FEATURE_HOOKS.productionFeedback;
      const enabledPhases = Object.entries(config.phases).filter(([, v]) => v).map(([k]) => k);
      expect(enabledPhases).toEqual(['onBuildComplete']);
    });

    it('autonomousTesting should have onAfterTask, onTaskError, onBuildComplete', () => {
      const config = DEFAULT_FEATURE_HOOKS.autonomousTesting;
      const enabledPhases = Object.entries(config.phases).filter(([, v]) => v).map(([k]) => k).sort();
      expect(enabledPhases).toEqual(['onAfterTask', 'onBuildComplete', 'onTaskError']);
    });
  });

  // --------------------------------------------------------------------------
  // FeatureLifecycleRegistry integration
  // --------------------------------------------------------------------------

  describe('FeatureLifecycleRegistry integration', () => {
    it('should register and retrieve features with default configs', () => {
      const featureReg = new FeatureLifecycleRegistry();
      featureReg.register('portfolio', true, {});
      featureReg.register('debug', false, {});

      const portfolio = featureReg.getFeature('portfolio');
      expect(portfolio?.enabled).toBe(true);
      expect(portfolio?.config.priority).toBe(50);

      const debug = featureReg.getFeature('debug');
      expect(debug?.enabled).toBe(false);
    });

    it('should filter only enabled features', () => {
      const featureReg = new FeatureLifecycleRegistry();
      featureReg.register('a', true, {});
      featureReg.register('b', false, {});
      featureReg.register('c', true, {});

      expect(featureReg.getEnabledFeatures()).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // DEFAULT_FEATURE_HOOKS structure
  // --------------------------------------------------------------------------

  describe('DEFAULT_FEATURE_HOOKS structure', () => {
    it('should have exactly 24 entries', () => {
      expect(Object.keys(DEFAULT_FEATURE_HOOKS)).toHaveLength(24);
    });

    it('should have unique module names for each feature', () => {
      const moduleNames = Object.values(DEFAULT_FEATURE_HOOKS).map(c => c.moduleName);
      const unique = new Set(moduleNames);
      expect(moduleNames.length).toBe(unique.size);
    });

    it('should have unique priorities for each feature', () => {
      const priorities = Object.values(DEFAULT_FEATURE_HOOKS).map(c => c.priority);
      const unique = new Set(priorities);
      expect(priorities.length).toBe(unique.size);
    });

    it('should have all priorities between 1 and 200', () => {
      for (const config of Object.values(DEFAULT_FEATURE_HOOKS)) {
        expect(config.priority).toBeGreaterThanOrEqual(1);
        expect(config.priority).toBeLessThanOrEqual(200);
      }
    });
  });
});
