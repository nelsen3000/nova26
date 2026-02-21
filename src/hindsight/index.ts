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
};
