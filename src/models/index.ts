/**
 * Nova26 AI Model Database
 * KIMI-R24-01 - Public Exports
 *
 * Centralized exports for the AI Model Database module.
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  ModelMetadata,
  ModelCapabilities,
  ModelRoute,
  JonFeedback,
  EnsembleDebateResult,
  ModelVote,
  SyncResult,
  ProviderModelInfo,
  ModelAffinity,
  TasteProfile,
  RoutingMetrics,
  ModelPerformance,
} from './types.js';

// ============================================================================
// Class Exports
// ============================================================================

export { AIModelVault, getAIModelVault, resetAIModelVault } from './ai-model-vault.js';
export { ModelRouter } from './model-router.js';
export { EnsembleEngine } from './ensemble-engine.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = 'KIMI-R24-01';
