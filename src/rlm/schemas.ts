// RLM Zod Schemas - Runtime validation for Recursive Language Models
// Spec: .kiro/specs/recursive-language-models/design.md

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// Context Segment Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const ContextSegmentSchema = z.object({
  id: z.string(),
  role: z.union([
    z.literal('user'),
    z.literal('assistant'),
    z.literal('tool'),
    z.literal('system'),
  ]),
  content: z.string(),
  originalTokens: z.number().int().min(0),
  compressedTokens: z.number().int().min(0),
  relevanceScore: z.union([z.number().min(0).max(1), z.nan()]).transform(v =>
    Number.isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v))
  ),
  sourceMessageIds: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Context Window Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const ContextWindowSchema = z.object({
  segments: z.array(ContextSegmentSchema),
  totalOriginalTokens: z.number().int().min(0),
  totalCompressedTokens: z.number().int().min(0),
  compressionRatio: z.union([z.number().min(0), z.nan()]).transform(v =>
    Number.isNaN(v) ? 1 : Math.max(0, v)
  ),
  readerModelId: z.string(),
  createdAt: z.number().int(),
  taskContext: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Pipeline Config Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const RlmPipelineConfigSchema = z.object({
  enabled: z.boolean(),
  readerModelId: z.string().nullable(),
  relevanceThreshold: z.union([z.number().min(0).max(1), z.nan()]).transform(v =>
    Number.isNaN(v) ? 0.3 : Math.max(0, Math.min(1, v))
  ),
  highRelevanceThreshold: z.union([z.number().min(0).max(1), z.nan()]).transform(v =>
    Number.isNaN(v) ? 0.7 : Math.max(0, Math.min(1, v))
  ),
  maxOutputTokens: z.number().int().positive(),
  compressionTimeoutMs: z.number().int().positive(),
  enableAudit: z.boolean(),
  auditSampleRate: z.union([z.number().min(0).max(1), z.nan()]).transform(v =>
    Number.isNaN(v) ? 0.1 : Math.max(0, Math.min(1, v))
  ),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Audit Entry Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const RelevanceDistributionSchema = z.object({
  high: z.number().int().min(0),
  medium: z.number().int().min(0),
  low: z.number().int().min(0),
});

export const AuditEntrySchema = z.object({
  turnId: z.string(),
  timestamp: z.number().int(),
  readerModelId: z.string(),
  compressionRatio: z.union([z.number(), z.nan()]).transform(v =>
    Number.isNaN(v) ? 1 : v
  ),
  driftScore: z.union([z.number().min(0).max(1), z.nan()]).transform(v =>
    Number.isNaN(v) ? 0 : Math.max(0, Math.min(1, v))
  ),
  relevanceDistribution: RelevanceDistributionSchema,
  totalOriginalTokens: z.number().int().min(0),
  totalCompressedTokens: z.number().int().min(0),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Compression Result Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const CompressionResultSchema = z.object({
  contextWindow: ContextWindowSchema,
  success: z.boolean(),
  fallbackUsed: z.boolean(),
  compressionTimeMs: z.number().int().min(0),
  auditEntry: AuditEntrySchema.optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scratchpad Message Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const ScratchpadMessageSchema = z.object({
  id: z.string(),
  role: z.union([
    z.literal('user'),
    z.literal('assistant'),
    z.literal('tool'),
    z.literal('system'),
  ]),
  content: z.string(),
  timestamp: z.number().int(),
  metadata: z.record(z.unknown()).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Serialized Context Window Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const SerializedContextWindowSchema = z.object({
  schemaVersion: z.number().int().positive(),
  data: z.string(),
  checksum: z.string(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Serialization / Deserialization
// ═══════════════════════════════════════════════════════════════════════════════

const CURRENT_SCHEMA_VERSION = 1;

export function serializeContextWindow(contextWindow: ContextWindow): string {
  const validated = ContextWindowSchema.parse(contextWindow);
  const serialized: SerializedContextWindow = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: JSON.stringify(validated),
    checksum: computeChecksum(validated),
  };
  return JSON.stringify(serialized);
}

export function deserializeContextWindow(json: string): ContextWindow {
  const parsed = JSON.parse(json);
  const serialized = SerializedContextWindowSchema.parse(parsed);

  if (serialized.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Invalid context window schema version: ${serialized.schemaVersion}. Expected: ${CURRENT_SCHEMA_VERSION}`
    );
  }

  const data = JSON.parse(serialized.data);
  const contextWindow = ContextWindowSchema.parse(data);

  // Verify checksum
  const expectedChecksum = computeChecksum(contextWindow);
  if (serialized.checksum !== expectedChecksum) {
    throw new Error('Context window checksum mismatch - data may be corrupted');
  }

  return contextWindow;
}

function computeChecksum(contextWindow: ContextWindow): string {
  // Simple checksum based on content
  const content = contextWindow.segments.map(s => s.content).join('');
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
