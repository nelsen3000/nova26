// RLM Core Types - Recursive Language Models
// Spec: .kiro/specs/recursive-language-models/design.md

// ═══════════════════════════════════════════════════════════════════════════════
// Context Window - Compressed conversation representation
// ═══════════════════════════════════════════════════════════════════════════════

export interface ContextSegment {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  originalTokens: number;
  compressedTokens: number;
  relevanceScore: number;
  sourceMessageIds: string[];
  metadata?: Record<string, unknown>;
}

export interface ContextWindow {
  segments: ContextSegment[];
  totalOriginalTokens: number;
  totalCompressedTokens: number;
  compressionRatio: number;
  readerModelId: string;
  createdAt: number;
  taskContext?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pipeline Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface RlmPipelineConfig {
  enabled: boolean;
  readerModelId: string | null;
  relevanceThreshold: number;
  highRelevanceThreshold: number;
  maxOutputTokens: number;
  compressionTimeoutMs: number;
  enableAudit: boolean;
  auditSampleRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Compression Result
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompressionResult {
  contextWindow: ContextWindow;
  success: boolean;
  fallbackUsed: boolean;
  compressionTimeMs: number;
  auditEntry?: AuditEntry;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit & Drift Detection
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuditEntry {
  turnId: string;
  timestamp: number;
  readerModelId: string;
  compressionRatio: number;
  driftScore: number;
  relevanceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  totalOriginalTokens: number;
  totalCompressedTokens: number;
}

export interface DriftWarningEvent {
  type: 'drift_warning';
  timestamp: number;
  turnId: string;
  driftScore: number;
  threshold: number;
  message: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Scratchpad Message (from AgentLoop)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScratchpadMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Serialized Context Window
// ═══════════════════════════════════════════════════════════════════════════════

export interface SerializedContextWindow {
  schemaVersion: number;
  data: string; // JSON stringified ContextWindow
  checksum: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RLM Pipeline Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface RlmPipeline {
  compress(
    messages: ScratchpadMessage[],
    config: RlmPipelineConfig
  ): Promise<CompressionResult>;
  getConfig(): RlmPipelineConfig;
  updateConfig(partial: Partial<RlmPipelineConfig>): void;
  getAuditHistory(limit?: number): AuditEntry[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Reader Model Adapter
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReaderModelAdapter {
  compress(messages: ScratchpadMessage[]): Promise<ContextSegment[]>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Model Selection
// ═══════════════════════════════════════════════════════════════════════════════

export interface ModelCapability {
  id: string;
  name: string;
  capabilities: string[];
  costPerToken: number;
}

export interface ModelSelectionResult {
  modelId: string;
  model: ModelCapability;
  autoSelected: boolean;
}
