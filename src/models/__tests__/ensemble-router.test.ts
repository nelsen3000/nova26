// Models Ensemble + Router Tests
// K4-14: Ensemble Engine + Router hardening

import { describe, it, expect, beforeEach } from 'vitest';
import { EnsembleEngine, createEnsembleEngine } from '../ensemble-engine.js';
import { ModelRouter, createModelRouter } from '../model-router.js';
import { AIModelVault, createModelVault } from '../ai-model-vault.js';

describe('Models Ensemble + Router', () => {
  describe('Ensemble Engine', () => {
    it('should create ensemble engine', () => {
      const engine = createEnsembleEngine();
      expect(engine).toBeDefined();
    });

    it('should combine multiple responses', async () => {
      const engine = createEnsembleEngine();
      
      const responses = [
        { content: 'Response A', confidence: 0.9, model: 'model-1' },
        { content: 'Response B', confidence: 0.8, model: 'model-2' },
      ];

      const result = await engine.combineResponses(responses, 'test-task');
      
      expect(result).toBeDefined();
      expect(typeof result.content).toBe('string');
    });

    it('should select best response by confidence', async () => {
      const engine = createEnsembleEngine();
      
      const responses = [
        { content: 'Low confidence', confidence: 0.5, model: 'model-1' },
        { content: 'High confidence', confidence: 0.95, model: 'model-2' },
        { content: 'Medium confidence', confidence: 0.7, model: 'model-3' },
      ];

      const result = await engine.selectBestResponse(responses);
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('should handle voting mechanism', async () => {
      const engine = createEnsembleEngine({ votingStrategy: 'majority' });
      
      const votes = [
        { modelId: 'model-1', vote: 'option-A', weight: 1 },
        { modelId: 'model-2', vote: 'option-A', weight: 1 },
        { modelId: 'model-3', vote: 'option-B', weight: 1 },
      ];

      const result = await engine.tallyVotes(votes);
      
      expect(result.winner).toBe('option-A');
    });
  });

  describe('Model Router', () => {
    it('should create model router', () => {
      const router = createModelRouter();
      expect(router).toBeDefined();
    });

    it('should route by task type', async () => {
      const router = createModelRouter();
      
      const route = await router.route('Implement a function', {
        taskType: 'code',
        preferredProvider: 'openai',
      });

      expect(route).toBeDefined();
      expect(route.modelId).toBeDefined();
    });

    it('should handle fallback chain', async () => {
      const router = createModelRouter();
      
      const fallbackChain = await router.buildFallbackChain('code-generation', {
        maxModels: 3,
      });

      expect(Array.isArray(fallbackChain)).toBe(true);
      expect(fallbackChain.length).toBeLessThanOrEqual(3);
    });

    it('should optimize for cost when specified', async () => {
      const router = createModelRouter({ optimizeFor: 'cost' });
      
      const route = await router.route('Simple task', {
        budgetConstraint: 'low',
      });

      expect(route).toBeDefined();
    });
  });

  describe('AI Model Vault', () => {
    it('should create model vault', () => {
      const vault = createModelVault();
      expect(vault).toBeDefined();
    });

    it('should register and retrieve models', () => {
      const vault = createModelVault();
      
      vault.registerModel({
        id: 'test-model',
        name: 'Test Model',
        provider: 'test',
        capabilities: ['code', 'reasoning'],
      });

      const model = vault.getModel('test-model');
      expect(model).toBeDefined();
      expect(model?.name).toBe('Test Model');
    });

    it('should match models by capability', () => {
      const vault = createModelVault();
      
      vault.registerModel({
        id: 'code-model',
        name: 'Code Expert',
        provider: 'openai',
        capabilities: ['code'],
      });

      vault.registerModel({
        id: 'general-model',
        name: 'General Purpose',
        provider: 'anthropic',
        capabilities: ['code', 'reasoning', 'creative'],
      });

      const codeModels = vault.findModelsByCapability('code');
      expect(codeModels.length).toBeGreaterThanOrEqual(2);
    });
  });
});
