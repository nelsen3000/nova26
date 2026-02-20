// KIMI-W-02: Lifecycle Wiring - Feature Integration
// Connects R16/R17 feature modules to lifecycle hooks

import type { HookRegistry } from './lifecycle-hooks.js';
import type { RalphLoopOptions } from './ralph-loop-types.js';
import { getFeatureFlagStore } from '../config/feature-flags.js';

// ============================================================================
// Feature Module Hook Configurations
// ============================================================================

export interface FeatureHookConfig {
  moduleName: string;
  phases: {
    onBeforeBuild?: boolean;
    onBeforeTask?: boolean;
    onAfterTask?: boolean;
    onTaskError?: boolean;
    onHandoff?: boolean;
    onBuildComplete?: boolean;
  };
  priority: number;
}

// Default hook configurations for each R16/R17 feature
export const DEFAULT_FEATURE_HOOKS: Record<string, FeatureHookConfig> = {
  // R16 Features
  portfolio: {
    moduleName: 'portfolio',
    phases: { onBeforeBuild: true, onBuildComplete: true },
    priority: 50,
  },
  agentMemory: {
    moduleName: 'agent-memory',
    phases: { onBeforeBuild: true, onAfterTask: true },
    priority: 45,
  },
  generativeUI: {
    moduleName: 'generative-ui',
    phases: { onBeforeBuild: true, onAfterTask: true },
    priority: 60,
  },
  autonomousTesting: {
    moduleName: 'autonomous-testing',
    phases: { onAfterTask: true, onTaskError: true, onBuildComplete: true },
    priority: 40,
  },
  wellbeing: {
    moduleName: 'wellbeing',
    phases: { onBeforeTask: true, onAfterTask: true, onBuildComplete: true },
    priority: 35,
  },
  
  // R17 Features
  advancedRecovery: {
    moduleName: 'advanced-recovery',
    phases: { onTaskError: true },
    priority: 15,
  },
  advancedInit: {
    moduleName: 'advanced-init',
    phases: { onBeforeBuild: true },
    priority: 5,
  },
  codeReview: {
    moduleName: 'code-review',
    phases: { onAfterTask: true, onBuildComplete: true },
    priority: 70,
  },
  migration: {
    moduleName: 'migration',
    phases: { onBeforeBuild: true, onAfterTask: true },
    priority: 80,
  },
  debug: {
    moduleName: 'debug',
    phases: { onTaskError: true },
    priority: 20,
  },
  accessibility: {
    moduleName: 'accessibility',
    phases: { onAfterTask: true, onBuildComplete: true },
    priority: 55,
  },
  debt: {
    moduleName: 'debt',
    phases: { onBeforeBuild: true, onBuildComplete: true },
    priority: 90,
  },
  dependencyManagement: {
    moduleName: 'dependency-management',
    phases: { onBeforeBuild: true },
    priority: 100,
  },
  productionFeedback: {
    moduleName: 'production-feedback',
    phases: { onBuildComplete: true },
    priority: 110,
  },
  health: {
    moduleName: 'health',
    phases: { onBeforeBuild: true, onBuildComplete: true },
    priority: 30,
  },
  environment: {
    moduleName: 'environment',
    phases: { onBeforeBuild: true },
    priority: 10,
  },
  orchestration: {
    moduleName: 'orchestration',
    phases: { onHandoff: true, onBeforeTask: true },
    priority: 25,
  },

  // R22-R24 Features
  modelRouting: {
    moduleName: 'model-routing',
    phases: { onBeforeBuild: true, onBeforeTask: true },
    priority: 42,
  },
  perplexity: {
    moduleName: 'perplexity',
    phases: { onBeforeTask: true, onAfterTask: true },
    priority: 65,
  },
  workflowEngine: {
    moduleName: 'workflow-engine',
    phases: { onBeforeBuild: true, onAfterTask: true, onBuildComplete: true },
    priority: 38,
  },
  infiniteMemory: {
    moduleName: 'infinite-memory',
    phases: { onAfterTask: true, onBuildComplete: true },
    priority: 48,
  },
  cinematicObservability: {
    moduleName: 'cinematic-observability',
    phases: { onBeforeBuild: true, onBeforeTask: true, onAfterTask: true, onTaskError: true, onHandoff: true, onBuildComplete: true },
    priority: 8,
  },
  aiModelDatabase: {
    moduleName: 'ai-model-database',
    phases: { onBeforeBuild: true, onBeforeTask: true },
    priority: 44,
  },
  crdtCollaboration: {
    moduleName: 'crdt-collaboration',
    phases: { onBeforeBuild: true, onAfterTask: true, onBuildComplete: true },
    priority: 52,
  },
};

// ============================================================================
// Type-safe Feature Handlers
// ============================================================================

import type {
  BuildContext,
  TaskContext,
  TaskResult,
  HandoffContext,
  BuildResult,
} from './lifecycle-hooks.js';

export type LifecycleHandler<T> = (context: T) => Promise<void>;

export interface FeatureLifecycleHandlers {
  onBeforeBuild?: LifecycleHandler<BuildContext>;
  onBeforeTask?: LifecycleHandler<TaskContext>;
  onAfterTask?: LifecycleHandler<TaskResult>;
  onTaskError?: LifecycleHandler<TaskResult>;
  onHandoff?: LifecycleHandler<HandoffContext>;
  onBuildComplete?: LifecycleHandler<BuildResult>;
}

// ============================================================================
// Feature Registry
// ============================================================================

export interface RegisteredFeature {
  name: string;
  enabled: boolean;
  handlers: FeatureLifecycleHandlers;
  config: FeatureHookConfig;
}

export class FeatureLifecycleRegistry {
  private features: Map<string, RegisteredFeature> = new Map();

  register(
    name: string,
    enabled: boolean,
    handlers: FeatureLifecycleHandlers,
    config: FeatureHookConfig = DEFAULT_FEATURE_HOOKS[name]
  ): void {
    this.features.set(name, {
      name,
      enabled,
      handlers,
      config: config ?? DEFAULT_FEATURE_HOOKS[name] ?? {
        moduleName: name,
        phases: {},
        priority: 100,
      },
    });
  }

  getFeature(name: string): RegisteredFeature | undefined {
    return this.features.get(name);
  }

  getEnabledFeatures(): RegisteredFeature[] {
    return Array.from(this.features.values()).filter(f => f.enabled);
  }

  unregister(name: string): boolean {
    return this.features.delete(name);
  }

  clear(): void {
    this.features.clear();
  }
}

// ============================================================================
// Main Wiring Function
// ============================================================================

/**
 * Wire enabled features into the hook registry
 * @param registry - HookRegistry to wire features into
 * @param options - RalphLoopOptions containing feature enablement flags
 * @returns Object with wiring stats
 */
export function wireFeatureHooks(
  registry: HookRegistry,
  options: RalphLoopOptions
): {
  wiredCount: number;
  skippedCount: number;
  totalHooks: number;
  featuresWired: string[];
  flagOverrides: number;
} {
  const featuresWired: string[] = [];
  let totalHooks = 0;
  let flagOverrides = 0;

  // Get the feature flag store for additional flag checks
  const flagStore = getFeatureFlagStore();
  const storeFlagNames = new Set(flagStore.listFlags().map(f => f.name));

  // Map options to features
  const featureFlags: Record<string, boolean | undefined> = {
    portfolio: options.portfolioEnabled,
    agentMemory: options.agentMemoryEnabled,
    generativeUI: options.generativeUIEnabled,
    autonomousTesting: options.autonomousTestingEnabled,
    wellbeing: options.wellbeingEnabled,
    advancedRecovery: options.advancedRecoveryEnabled,
    advancedInit: options.advancedInitEnabled,
    codeReview: options.codeReviewEnabled,
    migration: options.migrationEnabled,
    debug: options.debugEngineEnabled,
    accessibility: options.accessibilityEnabled,
    debt: options.debtScoringEnabled,
    dependencyManagement: options.dependencyManagementEnabled,
    productionFeedback: options.productionFeedbackEnabled,
    health: options.healthDashboardEnabled,
    environment: options.envManagementEnabled,
    orchestration: options.orchestrationOptimizationEnabled,
    // R22-R24 Features
    modelRouting: options.modelRoutingEnabled,
    perplexity: options.perplexityEnabled,
    workflowEngine: options.workflowEngineEnabled,
    infiniteMemory: options.infiniteMemoryEnabled,
    cinematicObservability: options.cinematicObservabilityEnabled,
    aiModelDatabase: options.aiModelDatabaseEnabled,
    crdtCollaboration: options.crdtCollaborationEnabled,
  };

  for (const [featureName, enabled] of Object.entries(featureFlags)) {
    if (!enabled) {
      continue;
    }

    const config = DEFAULT_FEATURE_HOOKS[featureName];
    if (!config) {
      continue;
    }

    // Check the feature flag store using the module name (kebab-case)
    // If the store explicitly has this flag and it's disabled, skip the feature
    const flagKey = config.moduleName;
    if (storeFlagNames.has(flagKey) && !flagStore.isEnabled(flagKey)) {
      flagOverrides++;
      continue;
    }

    // Wire each enabled phase
    for (const [phase, phaseEnabled] of Object.entries(config.phases)) {
      if (!phaseEnabled) {
        continue;
      }

      // Create a stub handler - real implementation would call the actual module
      const handler = async (): Promise<void> => {
        // This is a stub - actual feature modules would be called here
        // e.g., await portfolioModule.onBeforeBuild(context);
      };

      registry.register({
        phase: phase as 'onBeforeBuild' | 'onBeforeTask' | 'onAfterTask' | 'onTaskError' | 'onHandoff' | 'onBuildComplete',
        moduleName: config.moduleName,
        priority: config.priority,
        handler,
      });

      totalHooks++;
    }

    featuresWired.push(featureName);
  }

  const skippedCount = Object.keys(featureFlags).length - featuresWired.length;

  return {
    wiredCount: featuresWired.length,
    skippedCount,
    totalHooks,
    featuresWired,
    flagOverrides,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a summary of which features would be wired given options
 * @param options - RalphLoopOptions
 * @returns Summary object for debugging/diagnostics
 */
export function getWiringSummary(options: RalphLoopOptions): {
  wouldWire: string[];
  wouldSkip: string[];
  unknown: string[];
} {
  const wouldWire: string[] = [];
  const wouldSkip: string[] = [];
  const unknown: string[] = [];

  const featureFlags: Record<string, boolean | undefined> = {
    portfolio: options.portfolioEnabled,
    agentMemory: options.agentMemoryEnabled,
    generativeUI: options.generativeUIEnabled,
    autonomousTesting: options.autonomousTestingEnabled,
    wellbeing: options.wellbeingEnabled,
    advancedRecovery: options.advancedRecoveryEnabled,
    advancedInit: options.advancedInitEnabled,
    codeReview: options.codeReviewEnabled,
    migration: options.migrationEnabled,
    debug: options.debugEngineEnabled,
    accessibility: options.accessibilityEnabled,
    debt: options.debtScoringEnabled,
    dependencyManagement: options.dependencyManagementEnabled,
    productionFeedback: options.productionFeedbackEnabled,
    health: options.healthDashboardEnabled,
    environment: options.envManagementEnabled,
    orchestration: options.orchestrationOptimizationEnabled,
    // R22-R24 Features
    modelRouting: options.modelRoutingEnabled,
    perplexity: options.perplexityEnabled,
    workflowEngine: options.workflowEngineEnabled,
    infiniteMemory: options.infiniteMemoryEnabled,
    cinematicObservability: options.cinematicObservabilityEnabled,
    aiModelDatabase: options.aiModelDatabaseEnabled,
    crdtCollaboration: options.crdtCollaborationEnabled,
  };

  for (const [featureName, enabled] of Object.entries(featureFlags)) {
    if (enabled) {
      if (DEFAULT_FEATURE_HOOKS[featureName]) {
        wouldWire.push(featureName);
      } else {
        unknown.push(featureName);
      }
    } else {
      wouldSkip.push(featureName);
    }
  }

  return { wouldWire, wouldSkip, unknown };
}
