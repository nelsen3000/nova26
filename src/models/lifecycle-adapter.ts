/**
 * Nova26 AI Model Database
 * KIMI-R24-01 - Lifecycle Adapter
 *
 * Bridges Ralph Loop lifecycle events to the AI Model Vault.
 * Handles build-time model loading and task-time model selection.
 */

import type {
  BuildContext,
  TaskContext,
} from '../orchestrator/lifecycle-hooks.js';
import type { FeatureLifecycleHandlers } from '../orchestrator/lifecycle-wiring.js';
import type { ModelRoute, TasteProfile } from './types.js';
import {
  AIModelVault,
  getAIModelVault,
} from './ai-model-vault.js';
import { ModelRouter } from './model-router.js';
import { getGlobalEventBus } from '../orchestrator/event-bus.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface AIModelDatabaseConfig {
  /** Enable provider API synchronization during build */
  syncProviders?: string[];
  /** Skip provider sync even if configured */
  skipProviderSync?: boolean;
  /** Custom taste profile for routing decisions */
  tasteProfile?: Partial<TasteProfile>;
  /** Enable detailed selection logging */
  verboseLogging?: boolean;
  /** Fallback model ID when primary selection fails */
  fallbackModelId?: string;
}

// ============================================================================
// Build State Management
// ============================================================================

interface BuildState {
  buildId: string;
  modelsLoaded: boolean;
  providerSyncResults: Array<{ provider: string; added: number; updated: number }>;
  tasteProfileApplied: boolean;
  lastModelRoute?: ModelRoute;
  errors: string[];
}

let currentBuildState: BuildState | null = null;
let lastModelSelection: ModelRoute | null = null;

// ============================================================================
// Type Guards
// ============================================================================

export function isBuildContext(context: unknown): context is BuildContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'buildId' in context &&
    typeof (context as BuildContext).buildId === 'string' &&
    'prdId' in context &&
    typeof (context as BuildContext).prdId === 'string' &&
    'prdName' in context &&
    typeof (context as BuildContext).prdName === 'string'
  );
}

export function isTaskContext(context: unknown): context is TaskContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'taskId' in context &&
    typeof (context as TaskContext).taskId === 'string' &&
    'title' in context &&
    typeof (context as TaskContext).title === 'string' &&
    'agentName' in context &&
    typeof (context as TaskContext).agentName === 'string'
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the current build state.
 * @returns Current build state or null if no build is active
 */
export function getCurrentBuildState(): BuildState | null {
  return currentBuildState ? { ...currentBuildState } : null;
}

/**
 * Get the most recent model selection.
 * @returns Last model route or null if no selection has been made
 */
export function getModelSelection(): ModelRoute | null {
  return lastModelSelection ? { ...lastModelSelection } : null;
}

/**
 * Reset the build state and model selection.
 * Useful for testing or starting a fresh build.
 */
export function resetBuildState(): void {
  currentBuildState = null;
  lastModelSelection = null;
}

// ============================================================================
// Provider Sync
// ============================================================================

async function syncProviders(
  vault: AIModelVault,
  providers: string[],
  state: BuildState
): Promise<void> {
  for (const provider of providers) {
    try {
      const result = await vault.syncFromProvider(provider);
      state.providerSyncResults.push({
        provider,
        added: result.added,
        updated: result.updated,
      });
    } catch (error) {
      const errorMsg = `Failed to sync provider ${provider}: ${error instanceof Error ? error.message : String(error)}`;
      state.errors.push(errorMsg);
      console.warn(`[ai-model-database] ${errorMsg}`);
    }
  }
}

// ============================================================================
// Taste Profile Application
// ============================================================================

function applyTasteProfile(
  vault: AIModelVault,
  profile: Partial<TasteProfile>
): void {
  // Access router through vault's internal property
  const router = (vault as unknown as { router: ModelRouter }).router;
  if (router) {
    router.updateTasteProfile(profile);
  }
}

// ============================================================================
// Model Availability Check
// ============================================================================

function isModelAvailable(vault: AIModelVault, modelId: string): boolean {
  const model = vault.getModel(modelId);
  return model !== undefined;
}

async function selectWithFallback(
  vault: AIModelVault,
  agentId: string,
  taskDescription: string,
  fallbackModelId?: string
): Promise<{ route: ModelRoute; usedFallback: boolean }> {
  let route = await vault.semanticSelect(agentId, taskDescription);
  let usedFallback = false;

  // Check if selected model is available
  if (!isModelAvailable(vault, route.selectedModel.id)) {
    const fallbackId = fallbackModelId ?? 'gpt-4o';
    const fallbackModel = vault.getModel(fallbackId);

    if (fallbackModel) {
      console.warn(
        `[ai-model-database] Model ${route.selectedModel.id} unavailable, falling back to ${fallbackId}`
      );
      route = {
        ...route,
        selectedModel: fallbackModel,
        reasoning: `${route.reasoning}; fallback to ${fallbackId} (original unavailable)`,
      };
      usedFallback = true;
    } else {
      // If even fallback is unavailable, try any available model
      const availableModels = vault.listModels();
      if (availableModels.length > 0) {
        const emergencyFallback = availableModels[0]!;
        route = {
          ...route,
          selectedModel: emergencyFallback,
          reasoning: `${route.reasoning}; emergency fallback to ${emergencyFallback.id}`,
        };
        usedFallback = true;
      }
    }
  }

  return { route, usedFallback };
}

// ============================================================================
// Selection Logging
// ============================================================================

function logSelectionReasoning(
  route: ModelRoute,
  context: TaskContext,
  usedFallback: boolean,
  verbose: boolean
): void {
  const logLines: string[] = [];

  logLines.push(`[ai-model-database] Model selection for task "${context.title}"`);
  logLines.push(`  Agent: ${context.agentName}`);
  logLines.push(`  Task Type: ${route.taskType}`);
  logLines.push(`  Selected: ${route.selectedModel.name} (${route.selectedModel.id})`);
  logLines.push(`  Confidence: ${(route.confidence * 100).toFixed(1)}%`);

  if (usedFallback) {
    logLines.push(`  ⚠️  Used fallback model`);
  }

  if (verbose) {
    logLines.push(`  Reasoning: ${route.reasoning}`);
    logLines.push(`  Provider: ${route.selectedModel.provider}`);
    logLines.push(`  Context Window: ${route.selectedModel.contextWindow.toLocaleString()} tokens`);
    logLines.push(`  Capabilities: code=${route.selectedModel.capabilities.code}, reasoning=${route.selectedModel.capabilities.reasoning}`);

    if (route.alternatives.length > 0) {
      logLines.push(`  Alternatives: ${route.alternatives.map(m => m.id).join(', ')}`);
    }
  }

  console.log(logLines.join('\n'));
}

// ============================================================================
// Lifecycle Handlers Factory
// ============================================================================

/**
 * Create lifecycle hooks for the AI Model Database feature.
 * @param config - Configuration for the lifecycle adapter
 * @returns FeatureLifecycleHandlers with onBeforeBuild and onBeforeTask
 */
export function createAIModelDatabaseLifecycleHooks(
  config: AIModelDatabaseConfig = {}
): FeatureLifecycleHandlers {
  const vault = getAIModelVault();

  return {
    /**
     * onBeforeBuild: Load model metadata from vault, sync with provider APIs,
     * and update taste-aware routing scores.
     */
    async onBeforeBuild(context: BuildContext): Promise<void> {
      console.log(`[ai-model-database] Initializing for build ${context.buildId}`);

      // Initialize build state
      currentBuildState = {
        buildId: context.buildId,
        modelsLoaded: true,
        providerSyncResults: [],
        tasteProfileApplied: false,
        errors: [],
      };

      // Sync with providers if configured and not skipped
      if (config.syncProviders && !config.skipProviderSync) {
        await syncProviders(vault, config.syncProviders, currentBuildState);
      }

      // Apply taste profile if provided
      if (config.tasteProfile) {
        applyTasteProfile(vault, config.tasteProfile);
        currentBuildState.tasteProfileApplied = true;
      }

      console.log(
        `[ai-model-database] Initialized with ${vault.listModels().length} models`
      );
    },

    /**
     * onBeforeTask: Select optimal model using semantic router,
     * check model availability, and log selection reasoning.
     */
    async onBeforeTask(context: TaskContext): Promise<void> {
      if (!currentBuildState) {
        console.warn(
          '[ai-model-database] No active build state, using default vault configuration'
        );
      }

      const { route, usedFallback } = await selectWithFallback(
        vault,
        context.agentName,
        context.title,
        config.fallbackModelId
      );

      // Update state
      lastModelSelection = route;
      if (currentBuildState) {
        currentBuildState.lastModelRoute = route;
      }

      // Log selection reasoning
      if (config.verboseLogging ?? true) {
        logSelectionReasoning(route, context, usedFallback, config.verboseLogging ?? false);
      }

      // Emit model:selected event to event bus
      try {
        getGlobalEventBus().emit('model:selected', {
          agentName: context.agentName,
          taskId: context.taskId,
          modelId: route.selectedModel.id,
          modelName: route.selectedModel.name,
          routingReason: route.reasoning,
        }).catch(() => { /* event bus emission fire-and-forget */ });
      } catch (_eventBusError: unknown) {
        // Event bus failure must not crash the adapter
      }
    },
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default createAIModelDatabaseLifecycleHooks;
