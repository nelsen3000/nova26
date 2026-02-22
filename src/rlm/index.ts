// RLM Module - Recursive Language Models
// Spec: .kiro/specs/recursive-language-models/design.md

// ═══════════════════════════════════════════════════════════════════════════════
// Core Types & Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export * from './types.js';
export * from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Context Window
// ═══════════════════════════════════════════════════════════════════════════════

export {
  serialize as serializeContextWindow,
  deserialize as deserializeContextWindow,
  createContextWindow,
  filterByRelevance,
  filterByTokenBudget,
  filterSegments,
  createSegment,
  mergeContextWindows,
  getRelevanceDistribution,
  estimateTokenCount,
} from './context-window.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Model Selection
// ═══════════════════════════════════════════════════════════════════════════════

export {
  modelRegistry,
  selectReaderModel,
  hasCapability,
  validateCapabilities,
  estimateCost,
  compareCosts,
  CONTEXT_COMPRESSION_CAPABILITY,
  DEFAULT_MODELS,
} from './model-selection.js';

export type {
  SelectReaderModelOptions,
} from './model-selection.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Reader Adapter
// ═══════════════════════════════════════════════════════════════════════════════

export {
  compressWithReader,
  createMockLLMCaller,
  DEFAULT_CONFIG as READER_ADAPTER_DEFAULT_CONFIG,
} from './reader-adapter.js';

export type {
  ReaderAdapterConfig,
  LLMCallOptions,
  LLMResponse,
  LLMCaller,
  CompressionOutput,
} from './reader-adapter.js';

// ═══════════════════════════════════════════════════════════════════════════════
// RLM Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export {
  RlmPipeline,
  createRlmPipeline,
  DEFAULT_PIPELINE_CONFIG,
} from './rlm-pipeline.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Audit & Drift Detection
// ═══════════════════════════════════════════════════════════════════════════════

export {
  computeDriftScore,
  createAuditEntry,
  AuditHistory,
  globalAuditHistory,
  onDriftWarning,
  DEFAULT_CONFIG as AUDIT_DEFAULT_CONFIG,
} from './audit.js';

export type {
  AuditConfig,
} from './audit.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ATLAS Integration
// ═══════════════════════════════════════════════════════════════════════════════

export {
  RLMATLASIntegration,
  createRLMATLASIntegration,
  DEFAULT_CONFIG as ATLAS_INTEGRATION_DEFAULT_CONFIG,
} from './atlas-integration.js';

export type {
  ATLASIntegrationConfig,
  ATLASStorage,
} from './atlas-integration.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CRDT Integration
// ═══════════════════════════════════════════════════════════════════════════════

export {
  RLMCRDTIntegration,
  createRLMCRDTIntegration,
  DEFAULT_CONFIG as CRDT_INTEGRATION_DEFAULT_CONFIG,
} from './crdt-integration.js';

export type {
  CRDTIntegrationConfig,
  CompressedCRDTMessage,
  CompressedContext,
} from './crdt-integration.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Convex Integration
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  RlmConfig,
  RlmConfigInput,
  RlmAuditLog,
  RlmAuditLogInput,
  RlmAuditStats,
  RlmAuditQueryOptions,
  RlmStatsQueryOptions,
} from './convex-types.js';

export {
  getRlmConfig,
  updateRlmConfig,
  listRlmConfigs,
  deleteRlmConfig,
  logAuditEntry,
  getAuditHistory,
  getAuditStats,
  batchLogAuditEntries,
} from './convex-bridge.js';

export type { ConvexApi } from './convex-bridge.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configurations
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULTS = {
  pipeline: {
    enabled: true,
    readerModelId: null as string | null,
    relevanceThreshold: 0.3,
    highRelevanceThreshold: 0.7,
    maxOutputTokens: 2000,
    compressionTimeoutMs: 30000,
    enableAudit: true,
    auditSampleRate: 0.1,
  },
  readerAdapter: {
    timeoutMs: 30000,
    compressionTargetRatio: 0.5,
  },
  audit: {
    driftThreshold: 0.3,
    maxHistorySize: 1000,
    enableWarnings: true,
  },
  atlasIntegration: {
    enabled: true,
    storageKey: 'rlm_context_windows',
    maxRetainedWindows: 100,
  },
  crdtIntegration: {
    compressionRatio: 0.5,
    maxBroadcastSize: 10000,
    includeMetadata: true,
  },
};
