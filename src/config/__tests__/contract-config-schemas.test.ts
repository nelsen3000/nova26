// SN-14: Config Schema Contract Tests
// Verifies all RalphLoopOptions fields have matching Zod schemas

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ModelRoutingConfigSchema,
  PerplexityToolConfigSchema,
  WorkflowEngineOptionsSchema,
  InfiniteMemoryModuleConfigSchema,
  CinematicConfigSchema,
  AIModelDatabaseModuleConfigSchema,
  CRDTCollaborationModuleConfigSchema,
  validateModelRoutingConfig,
  validatePerplexityToolConfig,
  validateWorkflowEngineOptions,
  validateInfiniteMemoryModuleConfig,
  validateCinematicConfig,
  validateAIModelDatabaseModuleConfig,
  validateCRDTCollaborationModuleConfig,
  safeValidateModelRoutingConfig,
  safeValidatePerplexityToolConfig,
  safeValidateWorkflowEngineOptions,
  safeValidateInfiniteMemoryModuleConfig,
  safeValidateCinematicConfig,
  safeValidateAIModelDatabaseModuleConfig,
  safeValidateCRDTCollaborationModuleConfig,
} from '../module-schemas.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const VALID_MODEL_ROUTING = {
  enabled: true,
  autoDetectHardware: true,
  defaultTier: 'mid' as const,
  agentMappings: [],
  speculativeDecoding: {
    enabled: false,
    draftModel: 'qwen2.5:1.5b',
    verifyModel: 'qwen2.5:7b',
    draftTokens: 4,
    acceptanceRateTarget: 0.8,
  },
  queueEnabled: true,
  benchmarkOnStartup: false,
};

const VALID_PERPLEXITY = {
  enabled: true,
  model: 'sonar-pro',
  maxTokens: 4096,
  temperature: 0.7,
  cacheEnabled: true,
  cacheTtlSeconds: 3600,
};

const VALID_WORKFLOW = {
  enabled: true,
  enableVisualGraph: true,
  enableCheckpoints: true,
  maxCheckpoints: 100,
};

const VALID_MEMORY = {
  enabled: true,
  maxNodes: 10000,
  pruneAfterDays: 30,
  defaultTasteScore: 0.5,
  autoClassify: true,
};

const VALID_CINEMATIC = {
  enabled: true,
  fullCapture: true,
  sampleRate: 1.0,
  maxInMemorySpans: 10000,
  remediation: {
    tasteScoreDropThreshold: 0.08,
    actions: ['alert', 'escalate'] as const,
    cooldownMs: 60000,
  },
};

const VALID_AI_MODEL_DB = {
  enabled: true,
  syncProviders: false,
  fallbackModelId: 'gpt-4o',
};

const VALID_CRDT = {
  enabled: true,
  documentType: 'code' as const,
  conflictResolution: 'semantic-merge' as const,
  maxParticipants: 50,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Contract: Config Schemas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ModelRoutingConfigSchema', () => {
    it('should accept valid config', () => {
      const result = ModelRoutingConfigSchema.safeParse(VALID_MODEL_ROUTING);
      expect(result.success).toBe(true);
    });

    it('should apply defaults for missing optional fields', () => {
      const result = ModelRoutingConfigSchema.safeParse({
        speculativeDecoding: VALID_MODEL_ROUTING.speculativeDecoding,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.defaultTier).toBe('mid');
      }
    });

    it('should reject invalid tier value', () => {
      const result = ModelRoutingConfigSchema.safeParse({
        ...VALID_MODEL_ROUTING,
        defaultTier: 'invalid-tier',
      });
      expect(result.success).toBe(false);
    });

    it('should validate via validateModelRoutingConfig()', () => {
      const config = validateModelRoutingConfig(VALID_MODEL_ROUTING);
      expect(config.enabled).toBe(true);
    });

    it('should throw descriptive error for invalid config', () => {
      expect(() => validateModelRoutingConfig({ defaultTier: 123 })).toThrow();
    });
  });

  describe('PerplexityToolConfigSchema', () => {
    it('should accept valid config', () => {
      const result = PerplexityToolConfigSchema.safeParse(VALID_PERPLEXITY);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = PerplexityToolConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.model).toBe('sonar-pro');
        expect(result.data.maxTokens).toBe(4096);
      }
    });

    it('should reject temperature > 2', () => {
      const result = PerplexityToolConfigSchema.safeParse({
        ...VALID_PERPLEXITY,
        temperature: 3.0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowEngineOptionsSchema', () => {
    it('should accept valid config', () => {
      const result = WorkflowEngineOptionsSchema.safeParse(VALID_WORKFLOW);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = WorkflowEngineOptionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxConcurrentNodes).toBe(5);
        expect(result.data.defaultTimeoutMs).toBe(300000);
      }
    });

    it('should reject negative maxCheckpoints', () => {
      const result = WorkflowEngineOptionsSchema.safeParse({
        maxCheckpoints: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('InfiniteMemoryModuleConfigSchema', () => {
    it('should accept valid config', () => {
      const result = InfiniteMemoryModuleConfigSchema.safeParse(VALID_MEMORY);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = InfiniteMemoryModuleConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxNodes).toBe(10000);
        expect(result.data.maxQueryTimeMs).toBe(40);
      }
    });

    it('should reject tasteScore > 1', () => {
      const result = InfiniteMemoryModuleConfigSchema.safeParse({
        defaultTasteScore: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CinematicConfigSchema', () => {
    it('should accept valid config', () => {
      const result = CinematicConfigSchema.safeParse(VALID_CINEMATIC);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = CinematicConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sampleRate).toBe(1.0);
        expect(result.data.maxInMemorySpans).toBe(10000);
      }
    });

    it('should reject sampleRate > 1', () => {
      const result = CinematicConfigSchema.safeParse({
        sampleRate: 2.0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AIModelDatabaseModuleConfigSchema', () => {
    it('should accept valid config', () => {
      const result = AIModelDatabaseModuleConfigSchema.safeParse(VALID_AI_MODEL_DB);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = AIModelDatabaseModuleConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fallbackModelId).toBe('gpt-4o');
        expect(result.data.maxModelCacheSize).toBe(1000);
      }
    });
  });

  describe('CRDTCollaborationModuleConfigSchema', () => {
    it('should accept valid config', () => {
      const result = CRDTCollaborationModuleConfigSchema.safeParse(VALID_CRDT);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = CRDTCollaborationModuleConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.documentType).toBe('code');
        expect(result.data.conflictResolution).toBe('semantic-merge');
      }
    });

    it('should reject invalid documentType', () => {
      const result = CRDTCollaborationModuleConfigSchema.safeParse({
        documentType: 'spreadsheet',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid conflictResolution strategy', () => {
      const result = CRDTCollaborationModuleConfigSchema.safeParse({
        conflictResolution: 'random-pick',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Safe validation functions', () => {
    it('safeValidateModelRoutingConfig returns success for valid input', () => {
      const result = safeValidateModelRoutingConfig(VALID_MODEL_ROUTING);
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.error).toBeNull();
    });

    it('safeValidateModelRoutingConfig returns error for invalid input', () => {
      const result = safeValidateModelRoutingConfig({ defaultTier: 999 });
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it('safeValidatePerplexityToolConfig returns success for valid input', () => {
      const result = safeValidatePerplexityToolConfig(VALID_PERPLEXITY);
      expect(result.success).toBe(true);
    });

    it('safeValidateCinematicConfig returns success for valid input', () => {
      const result = safeValidateCinematicConfig(VALID_CINEMATIC);
      expect(result.success).toBe(true);
    });

    it('safeValidateWorkflowEngineOptions returns success for valid input', () => {
      const result = safeValidateWorkflowEngineOptions(VALID_WORKFLOW);
      expect(result.success).toBe(true);
    });

    it('safeValidateInfiniteMemoryModuleConfig returns success for valid input', () => {
      const result = safeValidateInfiniteMemoryModuleConfig(VALID_MEMORY);
      expect(result.success).toBe(true);
    });

    it('safeValidateAIModelDatabaseModuleConfig returns success for valid input', () => {
      const result = safeValidateAIModelDatabaseModuleConfig(VALID_AI_MODEL_DB);
      expect(result.success).toBe(true);
    });

    it('safeValidateCRDTCollaborationModuleConfig returns success for valid input', () => {
      const result = safeValidateCRDTCollaborationModuleConfig(VALID_CRDT);
      expect(result.success).toBe(true);
    });
  });
});
