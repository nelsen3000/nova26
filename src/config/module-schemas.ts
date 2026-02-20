// KMS-08: Zod schemas for all 7 new module configs
// Validation schemas for Model Routing, Perplexity, Workflow Engine,
// Infinite Memory, Cinematic Observability, AI Model DB, and CRDT Collaboration

import { z } from 'zod';

// ============================================================================
// Model Routing Config Schema
// ============================================================================

export const HardwareTierIdSchema = z.enum(['low', 'mid', 'high', 'ultra', 'apple-silicon']);

export const ModelProfileSchema = z.object({
  name: z.string().min(1),
  family: z.string().min(1),
  strength: z.string().min(1),
  quant: z.string().min(1),
  contextWindow: z.number().int().positive(),
  tokensPerSec: z.number().int().positive(),
  costFactor: z.number().nonnegative(),
  speculativeDraft: z.string().optional(),
});

export const AgentModelMappingSchema = z.object({
  agentId: z.string().min(1),
  primary: ModelProfileSchema,
  fallback: z.array(ModelProfileSchema),
  confidenceThreshold: z.number().min(0).max(1),
  maxConcurrent: z.number().int().positive(),
  tasteVaultWeight: z.number().min(0).max(1),
});

export const SpeculativeDecodingConfigSchema = z.object({
  enabled: z.boolean(),
  draftModel: z.string().min(1),
  verifyModel: z.string().min(1),
  draftTokens: z.number().int().positive(),
  acceptanceRateTarget: z.number().min(0).max(1),
});

export const ModelRoutingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoDetectHardware: z.boolean().default(true),
  defaultTier: HardwareTierIdSchema.default('mid'),
  agentMappings: z.array(AgentModelMappingSchema).default([]),
  speculativeDecoding: SpeculativeDecodingConfigSchema,
  queueEnabled: z.boolean().default(true),
  benchmarkOnStartup: z.boolean().default(false),
});

// ============================================================================
// Perplexity Tool Config Schema
// ============================================================================

export const PerplexityToolConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().default('https://api.perplexity.ai'),
  model: z.string().default('sonar-pro'),
  maxTokens: z.number().int().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  cacheEnabled: z.boolean().default(true),
  cacheTtlSeconds: z.number().int().positive().default(3600),
  researchKeywords: z.array(z.string()).default([
    'research', 'analyze', 'compare', 'evaluate', 'find', 'investigate'
  ]),
});

// ============================================================================
// Workflow Engine Config Schema
// ============================================================================

export const WorkflowEngineOptionsSchema = z.object({
  enabled: z.boolean().default(true),
  enableVisualGraph: z.boolean().default(true),
  enableCheckpoints: z.boolean().default(true),
  maxCheckpoints: z.number().int().positive().default(100),
  enableCriticalPath: z.boolean().default(true),
  enableParallelExecution: z.boolean().default(true),
  maxConcurrentNodes: z.number().int().positive().default(5),
  defaultTimeoutMs: z.number().int().positive().default(300000),
  langGraphCompatible: z.boolean().default(true),
  checkpointDir: z.string().default('.nova/checkpoints'),
});

// ============================================================================
// Infinite Memory Config Schema
// ============================================================================

export const MemoryLevelSchema = z.enum(['scene', 'project', 'portfolio', 'lifetime']);

export const InfiniteMemoryModuleConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxNodes: z.number().int().positive().default(10000),
  pruneAfterDays: z.number().int().positive().default(30),
  defaultTasteScore: z.number().min(0).max(1).default(0.5),
  autoClassify: z.boolean().default(true),
  enableHierarchy: z.boolean().default(true),
  maxQueryTimeMs: z.number().int().positive().default(40),
  defaultTasteThreshold: z.number().min(0).max(1).default(0.5),
  enableMem0Adapter: z.boolean().default(false),
  enableLettaAdapter: z.boolean().default(false),
});

// ============================================================================
// Cinematic Observability Config Schema
// ============================================================================

export const SpanTypeSchema = z.enum([
  'agent-call',
  'llm-inference',
  'tool-use',
  'gate-check',
  'user-interaction',
]);

export const SpanStatusSchema = z.enum(['running', 'success', 'failure']);

export const EvaluatorTypeSchema = z.enum([
  'llm-judge',
  'heuristic',
  'human-labeled',
  'taste-vault',
]);

export const RemediationActionSchema = z.enum([
  'alert',
  'rollback',
  'circuit-break',
  'retry',
  'escalate',
]);

export const RemediationConfigSchema = z.object({
  tasteScoreDropThreshold: z.number().min(0).max(1).default(0.08),
  actions: z.array(RemediationActionSchema).default(['alert', 'escalate']),
  cooldownMs: z.number().int().positive().default(60000),
});

export const CinematicConfigSchema = z.object({
  enabled: z.boolean().default(true),
  fullCapture: z.boolean().default(true),
  sampleRate: z.number().min(0).max(1).default(1.0),
  maxInMemorySpans: z.number().int().positive().default(10000),
  remediation: RemediationConfigSchema.default({
    tasteScoreDropThreshold: 0.08,
    actions: ['alert', 'escalate'],
    cooldownMs: 60000,
  }),
  braintrust: z.object({
    enabled: z.boolean().default(false),
    apiKey: z.string().optional(),
    projectName: z.string().default('nova26'),
  }).optional(),
  langsmith: z.object({
    enabled: z.boolean().default(false),
    apiKey: z.string().optional(),
    endpoint: z.string().url().optional(),
    projectName: z.string().default('nova26'),
  }).optional(),
});

// ============================================================================
// AI Model Database Config Schema
// ============================================================================

export const AIModelDatabaseModuleConfigSchema = z.object({
  enabled: z.boolean().default(true),
  syncProviders: z.boolean().default(false),
  skipProviderSync: z.boolean().default(false),
  tasteProfile: z.string().default('default'),
  verboseLogging: z.boolean().default(false),
  fallbackModelId: z.string().default('gpt-4o'),
  maxModelCacheSize: z.number().int().positive().default(1000),
  enableSemanticRouting: z.boolean().default(true),
  enableEnsembleDebate: z.boolean().default(true),
  debateTimeoutMs: z.number().int().positive().default(30000),
});

// ============================================================================
// CRDT Collaboration Config Schema
// ============================================================================

export const CRDTDocumentTypeSchema = z.enum([
  'code',
  'design',
  'prd',
  'taste-vault',
  'config',
]);

export const ConflictResolutionStrategySchema = z.enum([
  'last-writer-wins',
  'semantic-merge',
  'manual',
]);

export const CRDTCollaborationModuleConfigSchema = z.object({
  enabled: z.boolean().default(true),
  documentType: CRDTDocumentTypeSchema.default('code'),
  conflictResolution: ConflictResolutionStrategySchema.default('semantic-merge'),
  enableParallelUniverses: z.boolean().default(true),
  maxParticipants: z.number().int().positive().default(50),
  autoBroadcast: z.boolean().default(true),
  broadcastIntervalMs: z.number().int().positive().default(100),
  enableCompression: z.boolean().default(true),
  maxDocumentSizeMB: z.number().int().positive().default(10),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ModelRoutingConfig = z.infer<typeof ModelRoutingConfigSchema>;
export type PerplexityToolConfig = z.infer<typeof PerplexityToolConfigSchema>;
export type WorkflowEngineOptions = z.infer<typeof WorkflowEngineOptionsSchema>;
export type InfiniteMemoryModuleConfig = z.infer<typeof InfiniteMemoryModuleConfigSchema>;
export type CinematicConfig = z.infer<typeof CinematicConfigSchema>;
export type AIModelDatabaseModuleConfig = z.infer<typeof AIModelDatabaseModuleConfigSchema>;
export type CRDTCollaborationModuleConfig = z.infer<typeof CRDTCollaborationModuleConfigSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateModelRoutingConfig(config: unknown): ModelRoutingConfig {
  return ModelRoutingConfigSchema.parse(config);
}

export function validatePerplexityToolConfig(config: unknown): PerplexityToolConfig {
  return PerplexityToolConfigSchema.parse(config);
}

export function validateWorkflowEngineOptions(config: unknown): WorkflowEngineOptions {
  return WorkflowEngineOptionsSchema.parse(config);
}

export function validateInfiniteMemoryModuleConfig(config: unknown): InfiniteMemoryModuleConfig {
  return InfiniteMemoryModuleConfigSchema.parse(config);
}

export function validateCinematicConfig(config: unknown): CinematicConfig {
  return CinematicConfigSchema.parse(config);
}

export function validateAIModelDatabaseModuleConfig(config: unknown): AIModelDatabaseModuleConfig {
  return AIModelDatabaseModuleConfigSchema.parse(config);
}

export function validateCRDTCollaborationModuleConfig(config: unknown): CRDTCollaborationModuleConfig {
  return CRDTCollaborationModuleConfigSchema.parse(config);
}

// Safe validation functions that return { success, data, error }
export function safeValidateModelRoutingConfig(config: unknown) {
  const result = ModelRoutingConfigSchema.safeParse(config);
  return result.success
    ? { success: true as const, data: result.data, error: null }
    : { success: false as const, data: null, error: result.error };
}

export function safeValidatePerplexityToolConfig(config: unknown) {
  const result = PerplexityToolConfigSchema.safeParse(config);
  return result.success
    ? { success: true as const, data: result.data, error: null }
    : { success: false as const, data: null, error: result.error };
}

export function safeValidateWorkflowEngineOptions(config: unknown) {
  const result = WorkflowEngineOptionsSchema.safeParse(config);
  return result.success
    ? { success: true as const, data: result.data, error: null }
    : { success: false as const, data: null, error: result.error };
}

export function safeValidateInfiniteMemoryModuleConfig(config: unknown) {
  const result = InfiniteMemoryModuleConfigSchema.safeParse(config);
  return result.success
    ? { success: true as const, data: result.data, error: null }
    : { success: false as const, data: null, error: result.error };
}

export function safeValidateCinematicConfig(config: unknown) {
  const result = CinematicConfigSchema.safeParse(config);
  return result.success
    ? { success: true as const, data: result.data, error: null }
    : { success: false as const, data: null, error: result.error };
}

export function safeValidateAIModelDatabaseModuleConfig(config: unknown) {
  const result = AIModelDatabaseModuleConfigSchema.safeParse(config);
  return result.success
    ? { success: true as const, data: result.data, error: null }
    : { success: false as const, data: null, error: result.error };
}

export function safeValidateCRDTCollaborationModuleConfig(config: unknown) {
  const result = CRDTCollaborationModuleConfigSchema.safeParse(config);
  return result.success
    ? { success: true as const, data: result.data, error: null }
    : { success: false as const, data: null, error: result.error };
}
