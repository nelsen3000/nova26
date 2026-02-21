// Hindsight Zod Schemas - Runtime validation
// Spec: .kiro/specs/hindsight-persistent-memory/design.md

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// Memory Fragment Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const MemoryTypeSchema = z.union([
  z.literal('episodic'),
  z.literal('procedural'),
  z.literal('semantic'),
]);

export const MemoryProvenanceSchema = z.object({
  sourceType: z.union([
    z.literal('task'),
    z.literal('retrospective'),
    z.literal('build'),
    z.literal('pattern'),
    z.literal('user'),
    z.literal('system'),
  ]),
  sourceId: z.string(),
  timestamp: z.number().int(),
  agentId: z.string(),
  projectId: z.string().optional(),
});

export const MemoryFragmentSchema = z.object({
  id: z.string(),
  content: z.string(),
  type: MemoryTypeSchema,
  namespace: z.string(),
  agentId: z.string(),
  projectId: z.string(),
  relevance: z.union([z.number().min(0).max(1), z.nan()]).transform(v =>
    Number.isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v))
  ),
  confidence: z.union([z.number().min(0).max(1), z.nan()]).transform(v =>
    Number.isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v))
  ),
  embedding: z.array(z.number()),
  accessCount: z.number().int().min(0),
  lastAccessedAt: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  expiresAt: z.number().int().optional(),
  isPinned: z.boolean(),
  isArchived: z.boolean(),
  tags: z.array(z.string()),
  provenance: MemoryProvenanceSchema,
  extra: z.record(z.unknown()).optional(),
});

export const MemoryFragmentInputSchema = z.object({
  content: z.string().min(1),
  type: MemoryTypeSchema,
  agentId: z.string(),
  projectId: z.string(),
  relevance: z.union([z.number().min(0).max(1), z.nan()]).optional().transform(v =>
    v === undefined || Number.isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v))
  ),
  confidence: z.union([z.number().min(0).max(1), z.nan()]).optional().transform(v =>
    v === undefined || Number.isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v))
  ),
  embedding: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  provenance: MemoryProvenanceSchema.partial().optional(),
  extra: z.record(z.unknown()).optional(),
  isPinned: z.boolean().optional(),
  expiresAt: z.number().int().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const HindsightConfigSchema = z.object({
  storageType: z.union([z.literal('sqlite'), z.literal('convex'), z.literal('memory')]),
  storagePath: z.string().optional(),
  embeddingDimension: z.number().int().positive().default(384),
  similarityThreshold: z.union([z.number().min(0).max(1), z.nan()]).default(0.7).transform(v =>
    Number.isNaN(v) ? 0.7 : Math.max(0, Math.min(1, v))
  ),
  consolidationIntervalMs: z.number().int().positive().default(3600000),
  dedupSimilarityThreshold: z.union([z.number().min(0).max(1), z.nan()]).default(0.95).transform(v =>
    Number.isNaN(v) ? 0.95 : Math.max(0, Math.min(1, v))
  ),
  decayRate: z.union([z.number().min(0), z.nan()]).default(0.01).transform(v =>
    Number.isNaN(v) ? 0.01 : Math.max(0, v)
  ),
  archiveThreshold: z.union([z.number().min(0).max(1), z.nan()]).default(0.1).transform(v =>
    Number.isNaN(v) ? 0.1 : Math.max(0, Math.min(1, v))
  ),
  maxFragmentsBeforeCompression: z.number().int().positive().default(10000),
  defaultTopK: z.number().int().positive().default(10),
  tokenBudget: z.number().int().positive().default(2000),
  recencyWeight: z.union([z.number().min(0), z.nan()]).default(0.3).transform(v =>
    Number.isNaN(v) ? 0.3 : Math.max(0, v)
  ),
  frequencyWeight: z.union([z.number().min(0), z.nan()]).default(0.2).transform(v =>
    Number.isNaN(v) ? 0.2 : Math.max(0, v)
  ),
  similarityWeight: z.union([z.number().min(0), z.nan()]).default(0.5).transform(v =>
    Number.isNaN(v) ? 0.5 : Math.max(0, v)
  ),
  defaultNamespace: z.string().default('default'),
  enableNamespaceIsolation: z.boolean().default(true),
  healthCheckIntervalMs: z.number().int().positive().default(60000),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Filter Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const FragmentFilterSchema = z.object({
  namespace: z.string().optional(),
  agentId: z.string().optional(),
  projectId: z.string().optional(),
  type: MemoryTypeSchema.optional(),
  minRelevance: z.number().min(0).max(1).optional(),
  maxRelevance: z.number().min(0).max(1).optional(),
  isArchived: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  timeRange: z.object({
    start: z.number().int(),
    end: z.number().int(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  tagsAll: z.boolean().optional(),
});

export const RetrievalQuerySchema = z.object({
  query: z.string(),
  embedding: z.array(z.number()).optional(),
  topK: z.number().int().positive().optional(),
  filter: FragmentFilterSchema.optional(),
  tokenBudget: z.number().int().positive().optional(),
});

export const SemanticSearchQuerySchema = z.object({
  embedding: z.array(z.number()),
  topK: z.number().int().positive(),
  filter: FragmentFilterSchema.optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Result Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const ScoredFragmentSchema = z.object({
  fragment: MemoryFragmentSchema,
  score: z.number(),
  similarityScore: z.number(),
  recencyScore: z.number(),
  frequencyScore: z.number(),
});

export const RetrievalResultSchema = z.object({
  fragments: z.array(ScoredFragmentSchema),
  totalTokens: z.number().int().min(0),
  query: RetrievalQuerySchema,
  durationMs: z.number().int().min(0),
});

export const ConsolidationReportSchema = z.object({
  merged: z.number().int().min(0),
  compressed: z.number().int().min(0),
  archived: z.number().int().min(0),
  decayed: z.number().int().min(0),
  deleted: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  timestamp: z.number().int(),
});

export const HealthStatusSchema = z.object({
  healthy: z.boolean(),
  storageAvailable: z.boolean(),
  indexSize: z.number().int().min(0),
  fragmentCount: z.number().int().min(0),
  lastConsolidation: z.number().int().optional(),
  errors: z.array(z.string()),
});

export const StorageStatsSchema = z.object({
  totalFragments: z.number().int().min(0),
  totalSizeBytes: z.number().int().min(0),
  indexSize: z.number().int().min(0),
  averageFragmentSize: z.number().min(0),
  namespaces: z.array(z.string()),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Serialization / Deserialization
// ═══════════════════════════════════════════════════════════════════════════════

const CURRENT_SCHEMA_VERSION = 1;

export function serializeMemoryFragment(fragment: MemoryFragment): string {
  const validated = MemoryFragmentSchema.parse(fragment);
  const envelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: validated,
    checksum: computeChecksum(validated),
  };
  return JSON.stringify(envelope);
}

export function deserializeMemoryFragment(json: string): MemoryFragment {
  const parsed = JSON.parse(json);
  
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Invalid schema version: ${parsed.schemaVersion}. Expected: ${CURRENT_SCHEMA_VERSION}`
    );
  }
  
  const fragment = MemoryFragmentSchema.parse(parsed.data);
  
  // Verify checksum
  const expectedChecksum = computeChecksum(fragment);
  if (parsed.checksum !== expectedChecksum) {
    throw new Error('Checksum mismatch - data may be corrupted');
  }
  
  return fragment;
}

function computeChecksum(fragment: MemoryFragment): string {
  const content = `${fragment.id}:${fragment.content}:${fragment.createdAt}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createMemoryFragment(
  input: MemoryFragmentInput,
  embedding: number[]
): MemoryFragment {
  const validated = MemoryFragmentInputSchema.parse(input);
  const now = Date.now();
  
  const fragment: MemoryFragment = {
    id: `frag-${now}-${Math.random().toString(36).slice(2, 9)}`,
    content: validated.content,
    type: validated.type,
    namespace: `${validated.projectId}:${validated.agentId}`,
    agentId: validated.agentId,
    projectId: validated.projectId,
    relevance: validated.relevance ?? 0.5,
    confidence: validated.confidence ?? 0.5,
    embedding,
    accessCount: 0,
    lastAccessedAt: now,
    createdAt: now,
    updatedAt: now,
    expiresAt: validated.expiresAt,
    isPinned: validated.isPinned ?? false,
    isArchived: false,
    tags: validated.tags ?? [],
    provenance: {
      sourceType: validated.provenance?.sourceType ?? 'system',
      sourceId: validated.provenance?.sourceId ?? 'unknown',
      timestamp: validated.provenance?.timestamp ?? now,
      agentId: validated.provenance?.agentId ?? validated.agentId,
      projectId: validated.provenance?.projectId ?? validated.projectId,
    },
    extra: validated.extra,
  };
  
  return MemoryFragmentSchema.parse(fragment);
}
