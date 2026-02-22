// Models Core Tests
// K4-14 + K4-15: Ensemble Engine + Router + Model Vault

import { describe, it, expect, beforeEach } from 'vitest';
import { EnsembleEngine } from '../ensemble-engine.js';
import { ModelRouter } from '../model-router.js';
import { AIModelVault, getAIModelVault, resetAIModelVault } from '../ai-model-vault.js';

describe('Models Core Functionality', () => {
  describe('Ensemble Engine', () => {
    it('should create ensemble engine', () => {
      const engine = new EnsembleEngine();
      expect(engine).toBeDefined();
    });
  });

  describe('Model Router', () => {
    it('should create model router', () => {
      const router = new ModelRouter();
      expect(router).toBeDefined();
    });

    it('should classify task type', () => {
      const router = new ModelRouter();
      
      const taskType = router.classifyTaskType('Implement a function');
      expect(['code', 'reasoning', 'unknown']).toContain(taskType);
    });
  });

  describe('AI Model Vault', () => {
    beforeEach(() => {
      resetAIModelVault();
    });

    it('should get singleton vault instance', () => {
      const vault = getAIModelVault();
      expect(vault).toBeDefined();
      expect(vault instanceof AIModelVault).toBe(true);
    });

    it('should return same instance', () => {
      const vault1 = getAIModelVault();
      const vault2 = getAIModelVault();
      expect(vault1).toBe(vault2);
    });
  });
});
