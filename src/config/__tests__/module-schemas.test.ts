// KMS-08: Tests for module config Zod schemas

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Schemas
  ModelRoutingConfigSchema,
  PerplexityToolConfigSchema,
  WorkflowEngineOptionsSchema,
  InfiniteMemoryModuleConfigSchema,
  CinematicConfigSchema,
  AIModelDatabaseModuleConfigSchema,
  CRDTCollaborationModuleConfigSchema,
  // Validation functions
  validateModelRoutingConfig,
  validatePerplexityToolConfig,
  validateWorkflowEngineOptions,
  validateInfiniteMemoryModuleConfig,
  validateCinematicConfig,
  validateAIModelDatabaseModuleConfig,
  validateCRDTCollaborationModuleConfig,
  // Safe validation functions
  safeValidateModelRoutingConfig,
  safeValidatePerplexityToolConfig,
  safeValidateWorkflowEngineOptions,
  safeValidateInfiniteMemoryModuleConfig,
  safeValidateCinematicConfig,
  safeValidateAIModelDatabaseModuleConfig,
  safeValidateCRDTCollaborationModuleConfig,
} from '../module-schemas.js';

describe('Module Config Schemas', () => {
  beforeEach(() => {
    // No mocks needed for Zod schema tests
  });

  // ============================================================================
  // Model Routing Config Tests
  // ============================================================================

  describe('ModelRoutingConfig', () => {
    const validConfig = {
      enabled: true,
      autoDetectHardware: true,
      defaultTier: 'high' as const,
      agentMappings: [],
      speculativeDecoding: {
        enabled: true,
        draftModel: 'llama-3.1-8b-Q4_K_M',
        verifyModel: 'llama-3.1-70b-Q4_K_M',
        draftTokens: 4,
        acceptanceRateTarget: 0.7,
      },
      queueEnabled: true,
      benchmarkOnStartup: false,
    };

    it('should validate correct config', () => {
      const result = validateModelRoutingConfig(validConfig);
      expect(result.enabled).toBe(true);
      expect(result.defaultTier).toBe('high');
    });

    it('should apply defaults for missing fields', () => {
      const minimal = { speculativeDecoding: validConfig.speculativeDecoding };
      const result = validateModelRoutingConfig(minimal);
      expect(result.enabled).toBe(true);
      expect(result.autoDetectHardware).toBe(true);
      expect(result.defaultTier).toBe('mid');
    });

    it('should reject invalid tier', () => {
      const invalid = { ...validConfig, defaultTier: 'invalid' };
      expect(() => validateModelRoutingConfig(invalid)).toThrow();
    });

    it('should reject negative draft tokens', () => {
      const invalid = {
        ...validConfig,
        speculativeDecoding: { ...validConfig.speculativeDecoding, draftTokens: -1 },
      };
      expect(() => validateModelRoutingConfig(invalid)).toThrow();
    });

    it('should safe validate success', () => {
      const result = safeValidateModelRoutingConfig(validConfig);
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
    });

    it('should safe validate failure', () => {
      const result = safeValidateModelRoutingConfig({ enabled: 'not-boolean' });
      expect(result.success).toBe(false);
      expect(result.error).not.toBeNull();
    });
  });

  // ============================================================================
  // Perplexity Tool Config Tests
  // ============================================================================

  describe('PerplexityToolConfig', () => {
    const validConfig = {
      enabled: true,
      apiKey: 'test-key',
      baseUrl: 'https://api.perplexity.ai',
      model: 'sonar-pro',
      maxTokens: 4096,
      temperature: 0.7,
      cacheEnabled: true,
      cacheTtlSeconds: 3600,
      researchKeywords: ['research', 'analyze'],
    };

    it('should validate correct config', () => {
      const result = validatePerplexityToolConfig(validConfig);
      expect(result.enabled).toBe(true);
      expect(result.model).toBe('sonar-pro');
    });

    it('should apply defaults', () => {
      const minimal = {};
      const result = validatePerplexityToolConfig(minimal);
      expect(result.enabled).toBe(true);
      expect(result.baseUrl).toBe('https://api.perplexity.ai');
      expect(result.temperature).toBe(0.7);
    });

    it('should reject invalid URL', () => {
      const invalid = { ...validConfig, baseUrl: 'not-a-url' };
      expect(() => validatePerplexityToolConfig(invalid)).toThrow();
    });

    it('should reject temperature out of range', () => {
      const invalid = { ...validConfig, temperature: 3.0 };
      expect(() => validatePerplexityToolConfig(invalid)).toThrow();
    });

    it('should safe validate', () => {
      const result = safeValidatePerplexityToolConfig(validConfig);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Workflow Engine Options Tests
  // ============================================================================

  describe('WorkflowEngineOptions', () => {
    const validConfig = {
      enabled: true,
      enableVisualGraph: true,
      enableCheckpoints: true,
      maxCheckpoints: 100,
      enableCriticalPath: true,
      enableParallelExecution: true,
      maxConcurrentNodes: 5,
      defaultTimeoutMs: 300000,
      langGraphCompatible: true,
      checkpointDir: '.nova/checkpoints',
    };

    it('should validate correct config', () => {
      const result = validateWorkflowEngineOptions(validConfig);
      expect(result.enabled).toBe(true);
      expect(result.maxConcurrentNodes).toBe(5);
    });

    it('should apply defaults', () => {
      const minimal = {};
      const result = validateWorkflowEngineOptions(minimal);
      expect(result.enabled).toBe(true);
      expect(result.enableVisualGraph).toBe(true);
    });

    it('should reject zero maxConcurrentNodes', () => {
      const invalid = { ...validConfig, maxConcurrentNodes: 0 };
      expect(() => validateWorkflowEngineOptions(invalid)).toThrow();
    });

    it('should safe validate', () => {
      const result = safeValidateWorkflowEngineOptions(validConfig);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Infinite Memory Config Tests
  // ============================================================================

  describe('InfiniteMemoryModuleConfig', () => {
    const validConfig = {
      enabled: true,
      maxNodes: 10000,
      pruneAfterDays: 30,
      defaultTasteScore: 0.5,
      autoClassify: true,
      enableHierarchy: true,
      maxQueryTimeMs: 40,
      defaultTasteThreshold: 0.5,
      enableMem0Adapter: false,
      enableLettaAdapter: false,
    };

    it('should validate correct config', () => {
      const result = validateInfiniteMemoryModuleConfig(validConfig);
      expect(result.enabled).toBe(true);
      expect(result.maxNodes).toBe(10000);
    });

    it('should apply defaults', () => {
      const minimal = {};
      const result = validateInfiniteMemoryModuleConfig(minimal);
      expect(result.maxNodes).toBe(10000);
      expect(result.pruneAfterDays).toBe(30);
    });

    it('should reject taste score out of range', () => {
      const invalid = { ...validConfig, defaultTasteScore: 1.5 };
      expect(() => validateInfiniteMemoryModuleConfig(invalid)).toThrow();
    });

    it('should safe validate', () => {
      const result = safeValidateInfiniteMemoryModuleConfig(validConfig);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Cinematic Config Tests
  // ============================================================================

  describe('CinematicConfig', () => {
    const validConfig = {
      enabled: true,
      fullCapture: true,
      sampleRate: 1.0,
      maxInMemorySpans: 10000,
      remediation: {
        tasteScoreDropThreshold: 0.08,
        actions: ['alert', 'escalate'],
        cooldownMs: 60000,
      },
    };

    it('should validate correct config', () => {
      const result = validateCinematicConfig(validConfig);
      expect(result.enabled).toBe(true);
      expect(result.fullCapture).toBe(true);
    });

    it('should apply defaults', () => {
      const minimal = {};
      const result = validateCinematicConfig(minimal);
      expect(result.sampleRate).toBe(1.0);
      expect(result.maxInMemorySpans).toBe(10000);
    });

    it('should accept with braintrust config', () => {
      const withBraintrust = {
        ...validConfig,
        braintrust: {
          enabled: true,
          apiKey: 'test-key',
          projectName: 'test-project',
        },
      };
      const result = validateCinematicConfig(withBraintrust);
      expect(result.braintrust?.enabled).toBe(true);
    });

    it('should accept with langsmith config', () => {
      const withLangsmith = {
        ...validConfig,
        langsmith: {
          enabled: true,
          apiKey: 'test-key',
          endpoint: 'https://api.langsmith.com',
          projectName: 'test-project',
        },
      };
      const result = validateCinematicConfig(withLangsmith);
      expect(result.langsmith?.enabled).toBe(true);
    });

    it('should reject invalid sample rate', () => {
      const invalid = { ...validConfig, sampleRate: 1.5 };
      expect(() => validateCinematicConfig(invalid)).toThrow();
    });

    it('should safe validate', () => {
      const result = safeValidateCinematicConfig(validConfig);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // AI Model Database Config Tests
  // ============================================================================

  describe('AIModelDatabaseModuleConfig', () => {
    const validConfig = {
      enabled: true,
      syncProviders: false,
      skipProviderSync: false,
      tasteProfile: 'default',
      verboseLogging: false,
      fallbackModelId: 'gpt-4o',
      maxModelCacheSize: 1000,
      enableSemanticRouting: true,
      enableEnsembleDebate: true,
      debateTimeoutMs: 30000,
    };

    it('should validate correct config', () => {
      const result = validateAIModelDatabaseModuleConfig(validConfig);
      expect(result.enabled).toBe(true);
      expect(result.fallbackModelId).toBe('gpt-4o');
    });

    it('should apply defaults', () => {
      const minimal = {};
      const result = validateAIModelDatabaseModuleConfig(minimal);
      expect(result.fallbackModelId).toBe('gpt-4o');
      expect(result.maxModelCacheSize).toBe(1000);
    });

    it('should safe validate', () => {
      const result = safeValidateAIModelDatabaseModuleConfig(validConfig);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // CRDT Collaboration Config Tests
  // ============================================================================

  describe('CRDTCollaborationModuleConfig', () => {
    const validConfig = {
      enabled: true,
      documentType: 'code' as const,
      conflictResolution: 'semantic-merge' as const,
      enableParallelUniverses: true,
      maxParticipants: 50,
      autoBroadcast: true,
      broadcastIntervalMs: 100,
      enableCompression: true,
      maxDocumentSizeMB: 10,
    };

    it('should validate correct config', () => {
      const result = validateCRDTCollaborationModuleConfig(validConfig);
      expect(result.enabled).toBe(true);
      expect(result.documentType).toBe('code');
    });

    it('should apply defaults', () => {
      const minimal = {};
      const result = validateCRDTCollaborationModuleConfig(minimal);
      expect(result.documentType).toBe('code');
      expect(result.conflictResolution).toBe('semantic-merge');
    });

    it('should reject invalid document type', () => {
      const invalid = { ...validConfig, documentType: 'invalid' };
      expect(() => validateCRDTCollaborationModuleConfig(invalid)).toThrow();
    });

    it('should reject invalid conflict resolution', () => {
      const invalid = { ...validConfig, conflictResolution: 'invalid' };
      expect(() => validateCRDTCollaborationModuleConfig(invalid)).toThrow();
    });

    it('should safe validate', () => {
      const result = safeValidateCRDTCollaborationModuleConfig(validConfig);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle null input', () => {
      const result = safeValidateModelRoutingConfig(null);
      expect(result.success).toBe(false);
    });

    it('should handle undefined input', () => {
      const result = safeValidatePerplexityToolConfig(undefined);
      expect(result.success).toBe(false);
    });

    it('should handle array input', () => {
      const result = safeValidateWorkflowEngineOptions([]);
      expect(result.success).toBe(false);
    });

    it('should handle string input', () => {
      const result = safeValidateCinematicConfig('invalid');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Type Exports
  // ============================================================================

  describe('Type Exports', () => {
    it('should export ModelRoutingConfig type', () => {
      // Type-only test - if this compiles, the type is exported
      const _typeTest: Parameters<typeof validateModelRoutingConfig>[0] = {
        speculativeDecoding: {
          enabled: true,
          draftModel: 'test',
          verifyModel: 'test',
          draftTokens: 4,
          acceptanceRateTarget: 0.7,
        },
      };
      expect(_typeTest).toBeDefined();
    });
  });
});
