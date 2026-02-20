// KMS-01: Tests for /models CLI command

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleModelsCommand, modelsCommand } from '../models-commands.js';
import {
  getAIModelVault,
  resetAIModelVault,
  type ModelMetadata,
} from '../../models/index.js';

describe('/models CLI command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAIModelVault();
  });

  // ============================================================================
  // Command Definition
  // ============================================================================

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(modelsCommand.name).toBe('/models');
    });

    it('should have description', () => {
      expect(modelsCommand.description).toBeDefined();
      expect(modelsCommand.description.length).toBeGreaterThan(0);
    });

    it('should have handler function', () => {
      expect(typeof modelsCommand.handler).toBe('function');
    });
  });

  // ============================================================================
  // Help Command
  // ============================================================================

  describe('help', () => {
    it('should show help with no args', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/models'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('list'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('show'));
    });

    it('should show help with "help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AI Model Database'));
    });

    it('should show help with "--help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['--help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });
  });

  // ============================================================================
  // List Command
  // ============================================================================

  describe('list', () => {
    it('should list all models', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['list']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AI Models'));
    });

    it('should filter by provider', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['list', '--provider', 'openai']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('OPENAI'));
    });

    it('should filter by local availability', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['list', '--local']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AI Models'));
    });

    it('should filter by min code score', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['list', '--min-code', '85']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AI Models'));
    });
  });

  // ============================================================================
  // Show Command
  // ============================================================================

  describe('show', () => {
    it('should show error when no model specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['show']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'));
    });

    it('should show error for unknown model', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['show', 'unknown-model']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should show model details', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['show', 'gpt-4o']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('GPT-4o'));
    });

    it('should show multiple models', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['show', 'gpt-4o', 'claude-3-5-sonnet']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('GPT-4o'));
    });
  });

  // ============================================================================
  // Compare Command
  // ============================================================================

  describe('compare', () => {
    it('should show error with less than 2 models', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['compare', 'gpt-4o']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('at least 2 models'));
    });

    it('should show error with no valid models', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['compare', 'fake1', 'fake2']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Need at least 2'));
    });

    it('should compare two models', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['compare', 'gpt-4o', 'claude-3-5-sonnet']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Model Comparison'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Code'));
    });

    it('should compare multiple models', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['compare', 'gpt-4o', 'claude-3-5-sonnet', 'llama-3.1-70b']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Model Comparison'));
    });
  });

  // ============================================================================
  // Debate Command
  // ============================================================================

  describe('debate', () => {
    it('should show error with less than 2 models', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['debate', 'gpt-4o']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('at least 2 models'));
    });

    it('should show error with no prompt', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['debate', 'gpt-4o,claude-3-5-sonnet']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('provide a prompt'));
    });

    it('should run debate with valid models and prompt', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand([
        'debate',
        'gpt-4o,claude-3-5-sonnet',
        'Best way to handle errors in TypeScript',
      ]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Ensemble Debate'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Debating...'));
    });

    it('should handle invalid models in debate', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['debate', 'gpt-4o,fake-model', 'Test prompt']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });
  });

  // ============================================================================
  // Model Data Access
  // ============================================================================

  describe('model data access', () => {
    it('should access vault singleton', () => {
      const vault = getAIModelVault();
      expect(vault).toBeDefined();
      expect(typeof vault.listModels).toBe('function');
    });

    it('should list models from vault', () => {
      const vault = getAIModelVault();
      const models = vault.listModels();
      expect(models.length).toBeGreaterThan(0);
    });

    it('should get model by id', () => {
      const vault = getAIModelVault();
      const model = vault.getModel('gpt-4o');
      expect(model).toBeDefined();
      expect(model?.id).toBe('gpt-4o');
    });

    it('should return undefined for unknown model', () => {
      const vault = getAIModelVault();
      const model = vault.getModel('nonexistent');
      expect(model).toBeUndefined();
    });
  });

  // ============================================================================
  // Output Formatting
  // ============================================================================

  describe('output formatting', () => {
    it('should format capabilities with bars', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['show', 'gpt-4o']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('█'));
    });

    it('should format pricing correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['show', 'gpt-4o']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('$'));
    });

    it('should show context window in comparison', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['compare', 'gpt-4o', 'claude-3-5-sonnet']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('k'));
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle unknown subcommand', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['unknown']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/models'));
    });

    it('should handle empty model id in show', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['show', '']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should handle debate with all invalid models', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['debate', 'fake1,fake2', 'Test prompt']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Need at least 2'));
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration', () => {
    it('should complete full workflow: list -> show -> compare', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // List models
      await handleModelsCommand(['list']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AI Models'));

      // Show details
      await handleModelsCommand(['show', 'gpt-4o']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('GPT-4o'));

      // Compare
      await handleModelsCommand(['compare', 'gpt-4o', 'claude-3-5-sonnet']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Model Comparison'));
    });

    it('should handle local models filter correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleModelsCommand(['list', '--local']);
      // Should still show header even if no local models
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AI Models'));
    });
  });
});
