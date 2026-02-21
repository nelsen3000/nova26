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
};
