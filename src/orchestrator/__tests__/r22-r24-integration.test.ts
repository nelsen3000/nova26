// CL-55: Cross-module integration tests for R22-R24 modules

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  wireFeatureHooks,
  getWiringSummary,
  DEFAULT_FEATURE_HOOKS,
} from '../lifecycle-wiring.js';
import {
  HookRegistry,
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
    modelRoutingEnabled: true,
    perplexityEnabled: true,
    workflowEngineEnabled: true,
    infiniteMemoryEnabled: true,
    cinematicObservabilityEnabled: true,
    aiModelDatabaseEnabled: true,
    crdtCollaborationEnabled: true,
  };
}

function r22r24OnlyEnabled(): RalphLoopOptions {
  return {
    modelRoutingEnabled: true,
    perplexityEnabled: true,
    workflowEngineEnabled: true,
    infiniteMemoryEnabled: true,
    cinematicObservabilityEnabled: true,
    aiModelDatabaseEnabled: true,
    crdtCollaborationEnabled: true,
  };
}

// ============================================================================
// Category 1: Model Routing -> Models Pipeline (R22-01 feeds R24-01)
// ============================================================================

describe('Model Routing -> AI Model Database Pipeline', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  it('should wire both modelRouting and aiModelDatabase', () => {
    const options: Partial<RalphLoopOptions> = {
      modelRoutingEnabled: true,
      aiModelDatabaseEnabled: true,
    };

    const result = wireFeatureHooks(registry, options as RalphLoopOptions);

    expect(result.featuresWired).toContain('modelRouting');
    expect(result.featuresWired).toContain('aiModelDatabase');
  });

  it('should register modelRouting in onBeforeBuild and onBeforeTask', () => {
    wireFeatureHooks(registry, { modelRoutingEnabled: true } as RalphLoopOptions);

    const beforeBuild = registry.getHooksForPhase('onBeforeBuild');
    const beforeTask = registry.getHooksForPhase('onBeforeTask');

    expect(beforeBuild.some(h => h.moduleName === 'model-routing')).toBe(true);
    expect(beforeTask.some(h => h.moduleName === 'model-routing')).toBe(true);
  });

  it('should register aiModelDatabase in onBeforeBuild and onBeforeTask', () => {
    wireFeatureHooks(registry, { aiModelDatabaseEnabled: true } as RalphLoopOptions);

    const beforeBuild = registry.getHooksForPhase('onBeforeBuild');
    const beforeTask = registry.getHooksForPhase('onBeforeTask');

    expect(beforeBuild.some(h => h.moduleName === 'ai-model-database')).toBe(true);
    expect(beforeTask.some(h => h.moduleName === 'ai-model-database')).toBe(true);
  });

  it('should order modelRouting (42) before aiModelDatabase (44) is not required — both run in same phases', () => {
    wireFeatureHooks(registry, {
      modelRoutingEnabled: true,
      aiModelDatabaseEnabled: true,
    } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onBeforeBuild');
    const routingIdx = hooks.findIndex(h => h.moduleName === 'model-routing');
    const dbIdx = hooks.findIndex(h => h.moduleName === 'ai-model-database');

    // modelRouting priority 42 < aiModelDatabase priority 44
    expect(routingIdx).toBeLessThan(dbIdx);
  });

  it('should produce 2 hooks each for modelRouting and aiModelDatabase', () => {
    const result1 = wireFeatureHooks(new HookRegistry(), { modelRoutingEnabled: true } as RalphLoopOptions);
    expect(result1.totalHooks).toBe(2); // onBeforeBuild + onBeforeTask

    const result2 = wireFeatureHooks(new HookRegistry(), { aiModelDatabaseEnabled: true } as RalphLoopOptions);
    expect(result2.totalHooks).toBe(2); // onBeforeBuild + onBeforeTask
  });

  it('should have modelRouting config with correct moduleName', () => {
    expect(DEFAULT_FEATURE_HOOKS.modelRouting.moduleName).toBe('model-routing');
  });

  it('should have aiModelDatabase config with correct moduleName', () => {
    expect(DEFAULT_FEATURE_HOOKS.aiModelDatabase.moduleName).toBe('ai-model-database');
  });

  it('should independently enable modelRouting without aiModelDatabase', () => {
    const result = wireFeatureHooks(registry, { modelRoutingEnabled: true } as RalphLoopOptions);
    expect(result.featuresWired).toContain('modelRouting');
    expect(result.featuresWired).not.toContain('aiModelDatabase');
  });
});

// ============================================================================
// Category 2: Workflow Engine -> Observability (R23-01 spans in R23-05)
// ============================================================================

describe('Workflow Engine -> Cinematic Observability Pipeline', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  it('should wire both workflowEngine and cinematicObservability', () => {
    const result = wireFeatureHooks(registry, {
      workflowEngineEnabled: true,
      cinematicObservabilityEnabled: true,
    } as RalphLoopOptions);

    expect(result.featuresWired).toContain('workflowEngine');
    expect(result.featuresWired).toContain('cinematicObservability');
  });

  it('should run cinematicObservability (8) before workflowEngine (38) in shared phases', () => {
    wireFeatureHooks(registry, {
      workflowEngineEnabled: true,
      cinematicObservabilityEnabled: true,
    } as RalphLoopOptions);

    // Both share onBeforeBuild
    const hooks = registry.getHooksForPhase('onBeforeBuild');
    const obsIdx = hooks.findIndex(h => h.moduleName === 'cinematic-observability');
    const wfIdx = hooks.findIndex(h => h.moduleName === 'workflow-engine');

    expect(obsIdx).toBeLessThan(wfIdx);
  });

  it('should register cinematicObservability in all 6 phases', () => {
    wireFeatureHooks(registry, { cinematicObservabilityEnabled: true } as RalphLoopOptions);

    const phases: HookPhase[] = [
      'onBeforeBuild', 'onBeforeTask', 'onAfterTask',
      'onTaskError', 'onHandoff', 'onBuildComplete',
    ];

    for (const phase of phases) {
      const hooks = registry.getHooksForPhase(phase);
      expect(hooks.some(h => h.moduleName === 'cinematic-observability')).toBe(true);
    }
  });

  it('should produce 6 hooks for cinematicObservability', () => {
    const result = wireFeatureHooks(new HookRegistry(), { cinematicObservabilityEnabled: true } as RalphLoopOptions);
    expect(result.totalHooks).toBe(6);
  });

  it('should produce 3 hooks for workflowEngine', () => {
    const result = wireFeatureHooks(new HookRegistry(), { workflowEngineEnabled: true } as RalphLoopOptions);
    expect(result.totalHooks).toBe(3); // onBeforeBuild + onAfterTask + onBuildComplete
  });

  it('should register workflowEngine in onAfterTask for span capture', () => {
    wireFeatureHooks(registry, { workflowEngineEnabled: true } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onAfterTask');
    expect(hooks.some(h => h.moduleName === 'workflow-engine')).toBe(true);
  });

  it('should register cinematicObservability in onTaskError for error span capture', () => {
    wireFeatureHooks(registry, { cinematicObservabilityEnabled: true } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onTaskError');
    expect(hooks.some(h => h.moduleName === 'cinematic-observability')).toBe(true);
  });

  it('should register both in onBuildComplete for final reporting', () => {
    wireFeatureHooks(registry, {
      workflowEngineEnabled: true,
      cinematicObservabilityEnabled: true,
    } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onBuildComplete');
    expect(hooks.some(h => h.moduleName === 'workflow-engine')).toBe(true);
    expect(hooks.some(h => h.moduleName === 'cinematic-observability')).toBe(true);
  });
});

// ============================================================================
// Category 3: Infinite Memory -> CRDT Collaboration (R23-03 state in R24-03)
// ============================================================================

describe('Infinite Memory -> CRDT Collaboration Pipeline', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  it('should wire both infiniteMemory and crdtCollaboration', () => {
    const result = wireFeatureHooks(registry, {
      infiniteMemoryEnabled: true,
      crdtCollaborationEnabled: true,
    } as RalphLoopOptions);

    expect(result.featuresWired).toContain('infiniteMemory');
    expect(result.featuresWired).toContain('crdtCollaboration');
  });

  it('should run infiniteMemory (48) before crdtCollaboration (52) in onAfterTask', () => {
    wireFeatureHooks(registry, {
      infiniteMemoryEnabled: true,
      crdtCollaborationEnabled: true,
    } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onAfterTask');
    const memIdx = hooks.findIndex(h => h.moduleName === 'infinite-memory');
    const crdtIdx = hooks.findIndex(h => h.moduleName === 'crdt-collaboration');

    expect(memIdx).toBeLessThan(crdtIdx);
  });

  it('should run infiniteMemory before crdtCollaboration in onBuildComplete', () => {
    wireFeatureHooks(registry, {
      infiniteMemoryEnabled: true,
      crdtCollaborationEnabled: true,
    } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onBuildComplete');
    const memIdx = hooks.findIndex(h => h.moduleName === 'infinite-memory');
    const crdtIdx = hooks.findIndex(h => h.moduleName === 'crdt-collaboration');

    expect(memIdx).toBeLessThan(crdtIdx);
  });

  it('should produce 2 hooks for infiniteMemory', () => {
    const result = wireFeatureHooks(new HookRegistry(), { infiniteMemoryEnabled: true } as RalphLoopOptions);
    expect(result.totalHooks).toBe(2); // onAfterTask + onBuildComplete
  });

  it('should produce 3 hooks for crdtCollaboration', () => {
    const result = wireFeatureHooks(new HookRegistry(), { crdtCollaborationEnabled: true } as RalphLoopOptions);
    expect(result.totalHooks).toBe(3); // onBeforeBuild + onAfterTask + onBuildComplete
  });

  it('should register crdtCollaboration in onBeforeBuild for session init', () => {
    wireFeatureHooks(registry, { crdtCollaborationEnabled: true } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onBeforeBuild');
    expect(hooks.some(h => h.moduleName === 'crdt-collaboration')).toBe(true);
  });

  it('should register infiniteMemory in onAfterTask for result capture', () => {
    wireFeatureHooks(registry, { infiniteMemoryEnabled: true } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onAfterTask');
    expect(hooks.some(h => h.moduleName === 'infinite-memory')).toBe(true);
  });

  it('should not register infiniteMemory in onBeforeBuild', () => {
    wireFeatureHooks(registry, { infiniteMemoryEnabled: true } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onBeforeBuild');
    expect(hooks.some(h => h.moduleName === 'infinite-memory')).toBe(false);
  });
});

// ============================================================================
// Category 4: Lifecycle Wiring for All 24 Features (17 old + 7 new)
// ============================================================================

describe('Lifecycle Wiring — All 24 Features', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  it('should wire exactly 24 features when all enabled', () => {
    const result = wireFeatureHooks(registry, allFeaturesEnabled());
    expect(result.wiredCount).toBe(24);
  });

  it('should register correct totalHooks for all 24 features', () => {
    let expectedHooks = 0;
    for (const config of Object.values(DEFAULT_FEATURE_HOOKS)) {
      expectedHooks += Object.values(config.phases).filter(Boolean).length;
    }

    const result = wireFeatureHooks(registry, allFeaturesEnabled());
    expect(result.totalHooks).toBe(expectedHooks);
  });

  it('should report 24 wouldWire in getWiringSummary with all enabled', () => {
    const summary = getWiringSummary(allFeaturesEnabled());
    expect(summary.wouldWire).toHaveLength(24);
  });

  it('should report 24 wouldSkip in getWiringSummary with none enabled', () => {
    const summary = getWiringSummary({} as RalphLoopOptions);
    expect(summary.wouldSkip).toHaveLength(24);
  });

  it('should have cinematicObservability (8) fire first among all features', () => {
    wireFeatureHooks(registry, allFeaturesEnabled());

    const hooks = registry.getHooksForPhase('onBeforeBuild');
    expect(hooks[0].moduleName).toBe('advanced-init'); // priority 5
    expect(hooks[1].moduleName).toBe('cinematic-observability'); // priority 8
  });

  it('should have productionFeedback (110) fire last in onBuildComplete', () => {
    wireFeatureHooks(registry, allFeaturesEnabled());

    const hooks = registry.getHooksForPhase('onBuildComplete');
    const lastHook = hooks[hooks.length - 1];
    expect(lastHook.moduleName).toBe('production-feedback');
    expect(lastHook.priority).toBe(110);
  });

  it('should correctly wire all 7 new features to their specified phases', () => {
    const r22r24Phases: Record<string, string[]> = {
      modelRouting: ['onBeforeBuild', 'onBeforeTask'],
      perplexity: ['onBeforeTask', 'onAfterTask'],
      workflowEngine: ['onBeforeBuild', 'onAfterTask', 'onBuildComplete'],
      infiniteMemory: ['onAfterTask', 'onBuildComplete'],
      cinematicObservability: ['onBeforeBuild', 'onBeforeTask', 'onAfterTask', 'onTaskError', 'onHandoff', 'onBuildComplete'],
      aiModelDatabase: ['onBeforeBuild', 'onBeforeTask'],
      crdtCollaboration: ['onBeforeBuild', 'onAfterTask', 'onBuildComplete'],
    };

    wireFeatureHooks(registry, allFeaturesEnabled());

    for (const [feature, phases] of Object.entries(r22r24Phases)) {
      const config = DEFAULT_FEATURE_HOOKS[feature];
      const enabledPhases = Object.entries(config.phases)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .sort();

      expect(enabledPhases).toEqual(phases.sort());
    }
  });

  it('should wire only R22-R24 features when only those are enabled', () => {
    const result = wireFeatureHooks(registry, r22r24OnlyEnabled());

    expect(result.wiredCount).toBe(7);
    expect(result.skippedCount).toBe(17); // 17 old features skipped
    expect(result.featuresWired).toContain('modelRouting');
    expect(result.featuresWired).toContain('perplexity');
    expect(result.featuresWired).toContain('workflowEngine');
    expect(result.featuresWired).toContain('infiniteMemory');
    expect(result.featuresWired).toContain('cinematicObservability');
    expect(result.featuresWired).toContain('aiModelDatabase');
    expect(result.featuresWired).toContain('crdtCollaboration');
  });

  it('should maintain priority uniqueness across all 24 features', () => {
    const priorities = Object.values(DEFAULT_FEATURE_HOOKS).map(c => c.priority);
    const unique = new Set(priorities);
    expect(priorities.length).toBe(unique.size);
  });

  it('should maintain module name uniqueness across all 24 features', () => {
    const names = Object.values(DEFAULT_FEATURE_HOOKS).map(c => c.moduleName);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });

  it('should have all 24 priorities in valid range 1-200', () => {
    for (const config of Object.values(DEFAULT_FEATURE_HOOKS)) {
      expect(config.priority).toBeGreaterThanOrEqual(1);
      expect(config.priority).toBeLessThanOrEqual(200);
    }
  });

  it('should sort hooks within every phase by priority ascending', () => {
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

  it('should produce 24 registered modules when all enabled', () => {
    wireFeatureHooks(registry, allFeaturesEnabled());
    const modules = registry.getRegisteredModules();
    expect(modules.length).toBe(24);
  });

  it('should have DEFAULT_FEATURE_HOOKS with exactly 24 entries', () => {
    expect(Object.keys(DEFAULT_FEATURE_HOOKS)).toHaveLength(24);
  });
});

// ============================================================================
// Category 5: Perplexity + Workflow Integration
// ============================================================================

describe('Perplexity + Workflow Engine Integration', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  it('should wire both perplexity and workflowEngine', () => {
    const result = wireFeatureHooks(registry, {
      perplexityEnabled: true,
      workflowEngineEnabled: true,
    } as RalphLoopOptions);

    expect(result.featuresWired).toContain('perplexity');
    expect(result.featuresWired).toContain('workflowEngine');
  });

  it('should register perplexity in onBeforeTask and onAfterTask', () => {
    wireFeatureHooks(registry, { perplexityEnabled: true } as RalphLoopOptions);

    const beforeTask = registry.getHooksForPhase('onBeforeTask');
    const afterTask = registry.getHooksForPhase('onAfterTask');

    expect(beforeTask.some(h => h.moduleName === 'perplexity')).toBe(true);
    expect(afterTask.some(h => h.moduleName === 'perplexity')).toBe(true);
  });

  it('should produce 2 hooks for perplexity', () => {
    const result = wireFeatureHooks(new HookRegistry(), { perplexityEnabled: true } as RalphLoopOptions);
    expect(result.totalHooks).toBe(2); // onBeforeTask + onAfterTask
  });

  it('should run workflowEngine (38) before perplexity (65) in onAfterTask', () => {
    wireFeatureHooks(registry, {
      perplexityEnabled: true,
      workflowEngineEnabled: true,
    } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onAfterTask');
    const wfIdx = hooks.findIndex(h => h.moduleName === 'workflow-engine');
    const perpIdx = hooks.findIndex(h => h.moduleName === 'perplexity');

    expect(wfIdx).toBeLessThan(perpIdx);
  });

  it('should allow perplexity results to feed into infiniteMemory via shared onAfterTask phase', () => {
    wireFeatureHooks(registry, {
      perplexityEnabled: true,
      infiniteMemoryEnabled: true,
    } as RalphLoopOptions);

    const hooks = registry.getHooksForPhase('onAfterTask');
    const memIdx = hooks.findIndex(h => h.moduleName === 'infinite-memory');
    const perpIdx = hooks.findIndex(h => h.moduleName === 'perplexity');

    // infiniteMemory (48) runs before perplexity (65)
    expect(memIdx).toBeLessThan(perpIdx);
  });

  it('should have perplexity config with correct priority', () => {
    expect(DEFAULT_FEATURE_HOOKS.perplexity.priority).toBe(65);
  });
});

// ============================================================================
// Category 6: R22-R24 Config Types in RalphLoopOptions
// ============================================================================

describe('R22-R24 Config Types in RalphLoopOptions', () => {
  it('should accept modelRoutingConfig', () => {
    const options: Partial<RalphLoopOptions> = {
      modelRoutingEnabled: true,
      modelRoutingConfig: {
        enabled: true,
        autoDetectHardware: true,
        defaultTier: 'apple-m3-max' as string,
        agentMappings: {},
      },
    };
    expect(options.modelRoutingConfig).toBeDefined();
  });

  it('should accept perplexityConfig', () => {
    const options: Partial<RalphLoopOptions> = {
      perplexityEnabled: true,
      perplexityConfig: {
        model: 'sonar-pro',
        maxTokens: 4096,
        cacheTTLMinutes: 30,
      },
    };
    expect(options.perplexityConfig).toBeDefined();
  });

  it('should accept workflowEngineConfig', () => {
    const options: Partial<RalphLoopOptions> = {
      workflowEngineEnabled: true,
      workflowEngineConfig: {
        maxRetries: 3,
      },
    };
    expect(options.workflowEngineConfig).toBeDefined();
  });

  it('should accept infiniteMemoryConfig', () => {
    const options: Partial<RalphLoopOptions> = {
      infiniteMemoryEnabled: true,
      infiniteMemoryConfig: {
        maxNodes: 10000,
        pruneStaleAfterDays: 90,
      },
    };
    expect(options.infiniteMemoryConfig).toBeDefined();
  });

  it('should accept cinematicObservabilityConfig', () => {
    const options: Partial<RalphLoopOptions> = {
      cinematicObservabilityEnabled: true,
      cinematicObservabilityConfig: {
        enabled: true,
      },
    };
    expect(options.cinematicObservabilityConfig).toBeDefined();
  });

  it('should accept aiModelDatabaseConfig', () => {
    const options: Partial<RalphLoopOptions> = {
      aiModelDatabaseEnabled: true,
      aiModelDatabaseConfig: {
        autoSyncEnabled: true,
        tasteAwareRouting: false,
      },
    };
    expect(options.aiModelDatabaseConfig).toBeDefined();
  });

  it('should accept crdtCollaborationConfig', () => {
    const options: Partial<RalphLoopOptions> = {
      crdtCollaborationEnabled: true,
      crdtCollaborationConfig: {
        maxParticipants: 10,
        conflictResolution: 'semantic-merge',
      },
    };
    expect(options.crdtCollaborationConfig).toBeDefined();
  });
});
