// Hindsight Persistent Memory Module
// Spec: .kiro/specs/hindsight-persistent-memory/design.md

// ═══════════════════════════════════════════════════════════════════════════════
// Core Types & Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export * from './types.js';
export * from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Storage Adapters
// ═══════════════════════════════════════════════════════════════════════════════

export type { StorageAdapter, StorageAdapterConfig } from './storage-adapter.js';
export { createStorageAdapter } from './storage-adapter.js';
export { MemoryStorageAdapter } from './memory-adapter.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Vector Index
// ═══════════════════════════════════════════════════════════════════════════════

export {
  VectorIndex,
  cosineSimilarity,
  generateRandomEmbedding,
  DEFAULT_CONFIG as VECTOR_INDEX_DEFAULT_CONFIG,
} from './vector-index.js';

export type { VectorIndexConfig } from './vector-index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════════════

export {
  HindsightEngine,
  createHindsightEngine,
  DEFAULT_CONFIG as HINDSIGHT_DEFAULT_CONFIG,
} from './engine.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Consolidation Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export {
  ConsolidationPipeline,
  createConsolidationPipeline,
  DEFAULT_CONFIG as CONSOLIDATION_DEFAULT_CONFIG,
} from './consolidation.js';

export type { ConsolidationConfig } from './consolidation.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Formatter
// ═══════════════════════════════════════════════════════════════════════════════

export {
  formatRetrieval,
  prettyPrint,
  enforceTokenBudget,
  estimateTokenCount,
  DEFAULT_CONFIG as FORMATTER_DEFAULT_CONFIG,
} from './formatter.js';

export type { FormatterConfig } from './formatter.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Bridges
// ═══════════════════════════════════════════════════════════════════════════════

export {
  ATLASBridge,
  createATLASBridge,
  DEFAULT_CONFIG as ATLAS_BRIDGE_DEFAULT_CONFIG,
} from './atlas-bridge.js';

export type { ATLASBridgeConfig } from './atlas-bridge.js';

export {
  TasteVaultBridge,
  createTasteVaultBridge,
  DEFAULT_CONFIG as TASTE_VAULT_BRIDGE_DEFAULT_CONFIG,
} from './taste-vault-bridge.js';

export type { TasteVaultBridgeConfig } from './taste-vault-bridge.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Namespace Manager & Parallel Universes
// ═══════════════════════════════════════════════════════════════════════════════

export {
  NamespaceManager,
  ParallelUniverseBridge,
  createNamespaceManager,
  createParallelUniverseBridge,
  DEFAULT_CONFIG as NAMESPACE_DEFAULT_CONFIG,
} from './namespace-manager.js';

export type {
  NamespaceManagerConfig,
  ParallelUniverseContext,
} from './namespace-manager.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configurations
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULTS = {
  hindsight: {
    storageType: 'memory' as const,
    embeddingDimension: 384,
    similarityThreshold: 0.7,
    consolidationIntervalMs: 3600000,
    dedupSimilarityThreshold: 0.95,
    decayRate: 0.01,
    archiveThreshold: 0.1,
    maxFragmentsBeforeCompression: 10000,
    defaultTopK: 10,
    tokenBudget: 2000,
    recencyWeight: 0.3,
    frequencyWeight: 0.2,
    similarityWeight: 0.5,
    defaultNamespace: 'default',
    enableNamespaceIsolation: true,
    healthCheckIntervalMs: 60000,
  },
  vectorIndex: {
    similarityThreshold: 0.7,
    recencyWeight: 0.3,
    frequencyWeight: 0.2,
    similarityWeight: 0.5,
  },
  consolidation: {
    dedupSimilarityThreshold: 0.95,
    decayRate: 0.01,
    archiveThreshold: 0.1,
    maxFragmentsBeforeCompression: 10000,
  },
  formatter: {
    tokenBudget: 2000,
    includeMetadata: true,
    formatType: 'structured' as const,
  },
  atlasBridge: {
    enableEnrichment: true,
    enrichmentTimeoutMs: 5000,
  },
  tasteVaultBridge: {
    enableSupplementalSearch: true,
    supplementTopK: 5,
  },
  namespace: {
    enableIsolation: true,
    maxNamespaces: 100,
  },
};
