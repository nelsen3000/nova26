// KMS-10: Error Boundary Wrappers for Lifecycle Adapters
// Wraps all lifecycle adapter calls with try/catch for graceful degradation

import type { FeatureLifecycleHandlers } from './lifecycle-wiring.js';
import type {
  BuildContext,
  TaskContext,
  TaskResult,
  HandoffContext,
  BuildResult,
} from './lifecycle-hooks.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Error information captured from adapter failures
 */
export interface AdapterErrorInfo {
  moduleName: string;
  phase: string;
  error: Error;
  timestamp: number;
  context?: unknown;
}

/**
 * Error statistics per module
 */
export interface ModuleErrorStats {
  moduleName: string;
  errorCount: number;
  lastError?: AdapterErrorInfo;
  errorsByPhase: Map<string, number>;
}

/**
 * Global error boundary configuration
 */
export interface ErrorBoundaryConfig {
  /** Enable error logging (default: true) */
  enableLogging: boolean;
  /** Maximum errors to track per module (default: 100) */
  maxErrorsPerModule: number;
  /** Callback when an error is captured */
  onError?: (errorInfo: AdapterErrorInfo) => void;
}

// ============================================================================
// Module State
// ============================================================================

// Global error tracking per module
const moduleErrorStats = new Map<string, ModuleErrorStats>();

// Global error history (circular buffer per module)
const errorHistory = new Map<string, AdapterErrorInfo[]>();

// Default configuration
let config: ErrorBoundaryConfig = {
  enableLogging: true,
  maxErrorsPerModule: 100,
};

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get or create module error stats
 */
function getOrCreateModuleStats(moduleName: string): ModuleErrorStats {
  let stats = moduleErrorStats.get(moduleName);
  if (!stats) {
    stats = {
      moduleName,
      errorCount: 0,
      errorsByPhase: new Map(),
    };
    moduleErrorStats.set(moduleName, stats);
  }
  return stats;
}

/**
 * Record an error in the tracking system
 */
function recordError(errorInfo: AdapterErrorInfo): void {
  const { moduleName, phase } = errorInfo;

  // Update module stats
  const stats = getOrCreateModuleStats(moduleName);
  stats.errorCount++;
  stats.lastError = errorInfo;

  const phaseCount = stats.errorsByPhase.get(phase) ?? 0;
  stats.errorsByPhase.set(phase, phaseCount + 1);

  // Add to history with size limit
  let history = errorHistory.get(moduleName);
  if (!history) {
    history = [];
    errorHistory.set(moduleName, history);
  }
  history.push(errorInfo);

  // Trim history if exceeds max
  if (history.length > config.maxErrorsPerModule) {
    history.shift();
  }

  // Call custom handler if configured
  if (config.onError) {
    try {
      config.onError(errorInfo);
    } catch {
      // Don't let custom handler failures break the boundary
    }
  }
}

/**
 * Log error to console if logging is enabled
 */
function logAdapterError(errorInfo: AdapterErrorInfo): void {
  if (!config.enableLogging) return;

  const { moduleName, phase, error } = errorInfo;
  console.error(
    `[AdapterErrorBoundary] ${moduleName}.${phase} failed:`,
    error.message
  );
}

/**
 * Wrap a single handler with error boundary protection
 */
function wrapHandler<T>(
  handler: ((context: T) => Promise<void>) | undefined,
  moduleName: string,
  phase: string
): ((context: T) => Promise<void>) | undefined {
  if (!handler) return undefined;

  return async (context: T): Promise<void> => {
    try {
      await handler(context);
    } catch (error) {
      const errorInfo: AdapterErrorInfo = {
        moduleName,
        phase,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
        context,
      };

      recordError(errorInfo);
      logAdapterError(errorInfo);

      // Always resolve gracefully - build continues
      return Promise.resolve();
    }
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Wrap a lifecycle adapter with error boundary protection.
 * 
 * This function takes a lifecycle adapter and wraps all of its handlers
 * with try/catch protection. If any handler throws, the error is logged
 * and tracked, but the build continues (graceful degradation).
 * 
 * @param adapter - The lifecycle adapter to wrap
 * @param moduleName - Name of the module for error tracking
 * @returns Wrapped adapter with error boundary protection
 * 
 * @example
 * ```typescript
 * const cinematicAdapter = createCinematicObservabilityLifecycleHooks(config);
 * const protectedAdapter = wrapAdapterWithErrorBoundary(
 *   cinematicAdapter,
 *   'cinematic-observability'
 * );
 * ```
 */
export function wrapAdapterWithErrorBoundary(
  adapter: FeatureLifecycleHandlers,
  moduleName: string
): FeatureLifecycleHandlers {
  return {
    onBeforeBuild: wrapHandler<BuildContext>(
      adapter.onBeforeBuild,
      moduleName,
      'onBeforeBuild'
    ),
    onBeforeTask: wrapHandler<TaskContext>(
      adapter.onBeforeTask,
      moduleName,
      'onBeforeTask'
    ),
    onAfterTask: wrapHandler<TaskResult>(
      adapter.onAfterTask,
      moduleName,
      'onAfterTask'
    ),
    onTaskError: wrapHandler<TaskResult>(
      adapter.onTaskError,
      moduleName,
      'onTaskError'
    ),
    onHandoff: wrapHandler<HandoffContext>(
      adapter.onHandoff,
      moduleName,
      'onHandoff'
    ),
    onBuildComplete: wrapHandler<BuildResult>(
      adapter.onBuildComplete,
      moduleName,
      'onBuildComplete'
    ),
  };
}

/**
 * Get error statistics for a specific module
 * @param moduleName - Name of the module
 * @returns Module error stats or undefined if no errors recorded
 */
export function getModuleErrorStats(moduleName: string): ModuleErrorStats | undefined {
  const stats = moduleErrorStats.get(moduleName);
  if (!stats) return undefined;

  // Return a copy to prevent external mutation
  return {
    moduleName: stats.moduleName,
    errorCount: stats.errorCount,
    lastError: stats.lastError,
    errorsByPhase: new Map(stats.errorsByPhase),
  };
}

/**
 * Get error statistics for all modules
 * @returns Map of module names to error stats
 */
export function getAllErrorStats(): Map<string, ModuleErrorStats> {
  const result = new Map<string, ModuleErrorStats>();
  for (const [name, stats] of moduleErrorStats) {
    result.set(name, {
      moduleName: stats.moduleName,
      errorCount: stats.errorCount,
      lastError: stats.lastError,
      errorsByPhase: new Map(stats.errorsByPhase),
    });
  }
  return result;
}

/**
 * Get error history for a specific module
 * @param moduleName - Name of the module
 * @returns Array of captured errors (most recent last)
 */
export function getModuleErrorHistory(moduleName: string): AdapterErrorInfo[] {
  const history = errorHistory.get(moduleName);
  if (!history) return [];
  return [...history];
}

/**
 * Get total error count across all modules
 * @returns Total number of errors captured
 */
export function getTotalErrorCount(): number {
  let total = 0;
  for (const stats of moduleErrorStats.values()) {
    total += stats.errorCount;
  }
  return total;
}

/**
 * Clear all error tracking data
 */
export function clearErrorTracking(): void {
  moduleErrorStats.clear();
  errorHistory.clear();
}

/**
 * Reset error tracking for a specific module
 * @param moduleName - Name of the module to reset
 */
export function clearModuleErrorTracking(moduleName: string): void {
  moduleErrorStats.delete(moduleName);
  errorHistory.delete(moduleName);
}

/**
 * Configure the error boundary behavior
 * @param newConfig - Partial configuration to apply
 */
export function configureErrorBoundary(
  newConfig: Partial<ErrorBoundaryConfig>
): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current error boundary configuration
 * @returns Current configuration
 */
export function getErrorBoundaryConfig(): ErrorBoundaryConfig {
  return { ...config };
}

/**
 * Check if a module has any recorded errors
 * @param moduleName - Name of the module
 * @returns True if module has errors
 */
export function hasModuleErrors(moduleName: string): boolean {
  const stats = moduleErrorStats.get(moduleName);
  return stats ? stats.errorCount > 0 : false;
}

/**
 * Get list of all modules with errors
 * @returns Array of module names that have errors
 */
export function getModulesWithErrors(): string[] {
  const modules: string[] = [];
  for (const [name, stats] of moduleErrorStats) {
    if (stats.errorCount > 0) {
      modules.push(name);
    }
  }
  return modules;
}

// ============================================================================
// Convenience Wrappers for Specific Adapters
// ============================================================================

/**
 * Wrap the Cinematic Observability adapter with error boundary
 */
export function wrapCinematicObservabilityAdapter(
  adapter: FeatureLifecycleHandlers
): FeatureLifecycleHandlers {
  return wrapAdapterWithErrorBoundary(adapter, 'cinematic-observability');
}

/**
 * Wrap the Model Routing adapter with error boundary
 */
export function wrapModelRoutingAdapter(
  adapter: FeatureLifecycleHandlers
): FeatureLifecycleHandlers {
  return wrapAdapterWithErrorBoundary(adapter, 'model-routing');
}

/**
 * Wrap the Infinite Memory adapter with error boundary
 */
export function wrapInfiniteMemoryAdapter(
  adapter: FeatureLifecycleHandlers
): FeatureLifecycleHandlers {
  return wrapAdapterWithErrorBoundary(adapter, 'infinite-memory');
}

/**
 * Wrap the Workflow Engine adapter with error boundary
 */
export function wrapWorkflowEngineAdapter(
  adapter: FeatureLifecycleHandlers
): FeatureLifecycleHandlers {
  return wrapAdapterWithErrorBoundary(adapter, 'workflow-engine');
}

/**
 * Wrap the AI Model Database adapter with error boundary
 */
export function wrapAIModelDatabaseAdapter(
  adapter: FeatureLifecycleHandlers
): FeatureLifecycleHandlers {
  return wrapAdapterWithErrorBoundary(adapter, 'ai-model-database');
}

/**
 * Wrap the Perplexity adapter with error boundary
 */
export function wrapPerplexityAdapter(
  adapter: FeatureLifecycleHandlers
): FeatureLifecycleHandlers {
  return wrapAdapterWithErrorBoundary(adapter, 'perplexity');
}

/**
 * Wrap the CRDT Collaboration adapter with error boundary
 */
export function wrapCRDTAdapter(
  adapter: FeatureLifecycleHandlers
): FeatureLifecycleHandlers {
  return wrapAdapterWithErrorBoundary(adapter, 'crdt-collaboration');
}

// ============================================================================
// Batch Wrapping
// ============================================================================

/**
 * Wrapped adapters collection
 */
export interface WrappedAdapters {
  cinematicObservability: FeatureLifecycleHandlers;
  modelRouting: FeatureLifecycleHandlers;
  infiniteMemory: FeatureLifecycleHandlers;
  workflowEngine: FeatureLifecycleHandlers;
  aiModelDatabase: FeatureLifecycleHandlers;
  perplexity: FeatureLifecycleHandlers;
  crdtCollaboration: FeatureLifecycleHandlers;
}

/**
 * Wrap all 7 lifecycle adapters with error boundaries
 * 
 * @param adapters - Object containing all 7 adapters
 * @returns Object with wrapped adapters
 * 
 * @example
 * ```typescript
 * const adapters = {
 *   cinematicObservability: createCinematicObservabilityLifecycleHooks(config),
 *   modelRouting: createModelRoutingLifecycleHooks(config),
 *   // ... etc
 * };
 * const wrapped = wrapAllAdapters(adapters);
 * ```
 */
export function wrapAllAdapters(adapters: WrappedAdapters): WrappedAdapters {
  return {
    cinematicObservability: wrapCinematicObservabilityAdapter(
      adapters.cinematicObservability
    ),
    modelRouting: wrapModelRoutingAdapter(adapters.modelRouting),
    infiniteMemory: wrapInfiniteMemoryAdapter(adapters.infiniteMemory),
    workflowEngine: wrapWorkflowEngineAdapter(adapters.workflowEngine),
    aiModelDatabase: wrapAIModelDatabaseAdapter(adapters.aiModelDatabase),
    perplexity: wrapPerplexityAdapter(adapters.perplexity),
    crdtCollaboration: wrapCRDTAdapter(adapters.crdtCollaboration),
  };
}
