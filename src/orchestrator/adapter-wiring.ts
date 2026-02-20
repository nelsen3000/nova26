// MX-01: Wire Lifecycle Adapters into Ralph Loop
// Replaces stub handlers in wireFeatureHooks() with real adapter calls

import type { HookRegistry } from './lifecycle-hooks.js';
import type { RalphLoopOptions } from './ralph-loop-types.js';
import type { FeatureLifecycleHandlers } from './lifecycle-wiring.js';
import { DEFAULT_FEATURE_HOOKS } from './lifecycle-wiring.js';
import { wrapAdapterWithErrorBoundary } from './adapter-error-boundary.js';

// Adapter imports
import { createModelRoutingLifecycleHooks } from '../model-routing/lifecycle-adapter.js';
import type { ModelRoutingLifecycleConfig } from '../model-routing/lifecycle-adapter.js';
import { createPerplexityLifecycleHooks } from '../tools/perplexity/lifecycle-adapter.js';
import type { PerplexityLifecycleConfig } from '../tools/perplexity/lifecycle-adapter.js';
import { createWorkflowEngineLifecycleHooks } from '../workflow-engine/lifecycle-adapter.js';
import type { WorkflowEngineLifecycleConfig } from '../workflow-engine/lifecycle-adapter.js';
import { createInfiniteMemoryLifecycleHooks } from '../atlas/lifecycle-adapter.js';
import type { InfiniteMemoryLifecycleConfig } from '../atlas/lifecycle-adapter.js';
import { createCinematicObservabilityLifecycleHooks } from '../observability/lifecycle-adapter.js';
import type { CinematicLifecycleConfig } from '../observability/lifecycle-adapter.js';
import { createAIModelDatabaseLifecycleHooks } from '../models/lifecycle-adapter.js';
import type { AIModelDatabaseConfig } from '../models/lifecycle-adapter.js';
import { createCRDTLifecycleHooks } from '../collaboration/lifecycle-adapter.js';
import type { CRDTLifecycleConfig } from '../collaboration/lifecycle-adapter.js';

// ============================================================================
// Adapter Factory Map
// ============================================================================

type AdapterFactory = (options: RalphLoopOptions) => FeatureLifecycleHandlers | null;

function buildModelRoutingAdapter(options: RalphLoopOptions): FeatureLifecycleHandlers | null {
  if (!options.modelRoutingEnabled) return null;

  const config: ModelRoutingLifecycleConfig = {
    enabled: true,
    routingConfig: options.modelRoutingConfig,
    confidenceThreshold: 0.7,
    enableSpeculativeDecoding: false,
  };

  return createModelRoutingLifecycleHooks(config);
}

function buildPerplexityAdapter(options: RalphLoopOptions): FeatureLifecycleHandlers | null {
  if (!options.perplexityEnabled) return null;

  const config: PerplexityLifecycleConfig = {
    enabled: true,
    perplexityConfig: options.perplexityConfig,
    enableResearchCache: true,
  };

  return createPerplexityLifecycleHooks(config);
}

function buildWorkflowEngineAdapter(options: RalphLoopOptions): FeatureLifecycleHandlers | null {
  if (!options.workflowEngineEnabled) return null;

  const config: WorkflowEngineLifecycleConfig = {
    enableCriticalPath: true,
    checkpointPerTask: true,
  };

  return createWorkflowEngineLifecycleHooks(config);
}

function buildInfiniteMemoryAdapter(options: RalphLoopOptions): FeatureLifecycleHandlers | null {
  if (!options.infiniteMemoryEnabled) return null;

  const memConfig = options.infiniteMemoryConfig;
  const config: InfiniteMemoryLifecycleConfig = {
    enabled: true,
    maxNodes: memConfig?.maxNodes ?? 10000,
    pruneAfterDays: memConfig?.pruneStaleAfterDays ?? 30,
    defaultTasteScore: 0.5,
    autoClassify: true,
  };

  return createInfiniteMemoryLifecycleHooks(config);
}

function buildCinematicObservabilityAdapter(options: RalphLoopOptions): FeatureLifecycleHandlers | null {
  if (!options.cinematicObservabilityEnabled) return null;

  const cinConfig = options.cinematicObservabilityConfig;
  const config: CinematicLifecycleConfig = {
    enabled: true,
    cinematicConfig: cinConfig,
    autoRemediation: false,
  };

  return createCinematicObservabilityLifecycleHooks(config);
}

function buildAIModelDatabaseAdapter(options: RalphLoopOptions): FeatureLifecycleHandlers | null {
  if (!options.aiModelDatabaseEnabled) return null;

  const dbConfig = options.aiModelDatabaseConfig;
  const config: AIModelDatabaseConfig = {
    skipProviderSync: !dbConfig?.autoSyncEnabled,
    verboseLogging: false,
    fallbackModelId: 'gpt-4o',
  };

  return createAIModelDatabaseLifecycleHooks(config);
}

function buildCRDTCollaborationAdapter(options: RalphLoopOptions): FeatureLifecycleHandlers | null {
  if (!options.crdtCollaborationEnabled) return null;

  const crdtConfig = options.crdtCollaborationConfig;
  const config: CRDTLifecycleConfig = {
    enabled: true,
    documentType: 'code',
    conflictResolution: crdtConfig?.conflictResolution === 'last-write-wins'
      ? 'last-writer-wins'
      : 'semantic-merge',
    maxParticipants: crdtConfig?.maxParticipants ?? 50,
  };

  return createCRDTLifecycleHooks(config);
}

// ============================================================================
// Adapter Registry
// ============================================================================

const ADAPTER_FACTORIES: Record<string, AdapterFactory> = {
  modelRouting: buildModelRoutingAdapter,
  perplexity: buildPerplexityAdapter,
  workflowEngine: buildWorkflowEngineAdapter,
  infiniteMemory: buildInfiniteMemoryAdapter,
  cinematicObservability: buildCinematicObservabilityAdapter,
  aiModelDatabase: buildAIModelDatabaseAdapter,
  crdtCollaboration: buildCRDTCollaborationAdapter,
};

// ============================================================================
// Main Wiring Function
// ============================================================================

export interface AdapterWiringResult {
  wiredCount: number;
  skippedCount: number;
  totalHooks: number;
  adaptersWired: string[];
  errors: Array<{ module: string; error: string }>;
}

/**
 * Wire real lifecycle adapters into the HookRegistry.
 *
 * Unlike wireFeatureHooks() which registers stubs, this function:
 * 1. Instantiates actual adapter objects from each module
 * 2. Wraps them with error boundaries for graceful degradation
 * 3. Registers the wrapped handlers into the HookRegistry
 *
 * @param registry - HookRegistry to register handlers into
 * @param options - RalphLoopOptions containing feature flags and configs
 * @returns Wiring results with stats and any errors
 */
export function wireAdaptersLive(
  registry: HookRegistry,
  options: RalphLoopOptions
): AdapterWiringResult {
  const adaptersWired: string[] = [];
  const errors: Array<{ module: string; error: string }> = [];
  let totalHooks = 0;

  for (const [featureName, factory] of Object.entries(ADAPTER_FACTORIES)) {
    const hookConfig = DEFAULT_FEATURE_HOOKS[featureName];
    if (!hookConfig) continue;

    let adapter: FeatureLifecycleHandlers | null = null;

    try {
      adapter = factory(options);
    } catch (error) {
      errors.push({
        module: featureName,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (!adapter) continue;

    // Wrap with error boundary
    const wrapped = wrapAdapterWithErrorBoundary(adapter, hookConfig.moduleName);

    // Register each phase handler
    const phases: Array<{
      key: keyof FeatureLifecycleHandlers;
      phase: 'onBeforeBuild' | 'onBeforeTask' | 'onAfterTask' | 'onTaskError' | 'onHandoff' | 'onBuildComplete';
    }> = [
      { key: 'onBeforeBuild', phase: 'onBeforeBuild' },
      { key: 'onBeforeTask', phase: 'onBeforeTask' },
      { key: 'onAfterTask', phase: 'onAfterTask' },
      { key: 'onTaskError', phase: 'onTaskError' },
      { key: 'onHandoff', phase: 'onHandoff' },
      { key: 'onBuildComplete', phase: 'onBuildComplete' },
    ];

    for (const { key, phase } of phases) {
      const handler = wrapped[key];
      if (!handler) continue;

      // Only register if this phase is configured for the module
      const phaseEnabled = hookConfig.phases[phase];
      if (!phaseEnabled) continue;

      registry.register({
        phase,
        moduleName: hookConfig.moduleName,
        priority: hookConfig.priority,
        handler: handler as (context: unknown) => Promise<void>,
      });

      totalHooks++;
    }

    adaptersWired.push(featureName);
  }

  const skippedCount = Object.keys(ADAPTER_FACTORIES).length - adaptersWired.length;

  return {
    wiredCount: adaptersWired.length,
    skippedCount,
    totalHooks,
    adaptersWired,
    errors,
  };
}

/**
 * Get a diagnostic summary of which adapters would be wired.
 */
export function getAdapterWiringSummary(options: RalphLoopOptions): {
  wouldWire: string[];
  wouldSkip: string[];
} {
  const wouldWire: string[] = [];
  const wouldSkip: string[] = [];

  const enabledMap: Record<string, boolean | undefined> = {
    modelRouting: options.modelRoutingEnabled,
    perplexity: options.perplexityEnabled,
    workflowEngine: options.workflowEngineEnabled,
    infiniteMemory: options.infiniteMemoryEnabled,
    cinematicObservability: options.cinematicObservabilityEnabled,
    aiModelDatabase: options.aiModelDatabaseEnabled,
    crdtCollaboration: options.crdtCollaborationEnabled,
  };

  for (const [name, enabled] of Object.entries(enabledMap)) {
    if (enabled) {
      wouldWire.push(name);
    } else {
      wouldSkip.push(name);
    }
  }

  return { wouldWire, wouldSkip };
}
