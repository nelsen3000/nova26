// KMS-07: Tests for /route CLI command

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleRouteCommand, routeCommand } from '../route-commands.js';
import {
  ModelRegistry,
  HardwareDetector,
  type AgentModelMapping,
  type HardwareTier,
} from '../../model-routing/index.js';

describe('/route CLI command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Command Definition
  // ============================================================================

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(routeCommand.name).toBe('/route');
    });

    it('should have description', () => {
      expect(routeCommand.description).toBeDefined();
      expect(routeCommand.description.length).toBeGreaterThan(0);
    });

    it('should have handler function', () => {
      expect(typeof routeCommand.handler).toBe('function');
    });
  });

  // ============================================================================
  // Help Command
  // ============================================================================

  describe('help', () => {
    it('should show help with no args', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/route'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('task'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('table'));
    });

    it('should show help with "help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Model Routing'));
    });

    it('should show help with "--help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['--help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should show help for unknown subcommand', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['unknown']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/route'));
    });
  });

  // ============================================================================
  // Task Command
  // ============================================================================

  describe('task', () => {
    it('should show error when no agent specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['task']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify an agent'));
    });

    it('should show error when no description provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['task', 'code-sage']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please provide a task'));
    });

    it('should show error for unknown agent', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['task', 'unknown-agent', 'test task']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No model mapping found'));
    });

    it('should route task for valid agent and description', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['task', 'code-sage', 'Refactor authentication module']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Task Routed Successfully'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('code-sage'));
    });

    it('should display fallback chain when available', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['task', 'architect-alpha', 'Design new API']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Fallback Chain'));
    });

    it('should include model details in output', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['task', 'code-sage', 'Test task']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Selected Model'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Family'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Context Window'));
    });
  });

  // ============================================================================
  // Table Command
  // ============================================================================

  describe('table', () => {
    it('should show routing table', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['table']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Model Routing Table'));
    });

    it('should display agent mappings', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['table']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('code-sage'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('architect-alpha'));
    });

    it('should group by model family', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['table']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Family'));
    });

    it('should show fallback count', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['table']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('fallbacks'));
    });
  });

  // ============================================================================
  // Hardware Command
  // ============================================================================

  describe('hardware', () => {
    it('should show hardware detection results', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['hardware']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Hardware Detection Results'));
    });

    it('should display hardware tier', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['hardware']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Tier'));
    });

    it('should show RAM information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['hardware']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('RAM'));
    });

    it('should show capability assessment', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['hardware']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Capability Assessment'));
    });
  });

  // ============================================================================
  // Affinity Command
  // ============================================================================

  describe('affinity', () => {
    it('should show affinity scores', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['affinity']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Model Affinity Scores'));
    });

    it('should display hardware info in affinity', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['affinity']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Hardware'));
    });

    it('should show scoring explanation', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['affinity']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Scoring'));
    });

    it('should display affinity bars', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['affinity']);
      // Check for the block character used in affinity bars
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('█'));
    });
  });

  // ============================================================================
  // Model Registry Integration
  // ============================================================================

  describe('model registry integration', () => {
    it('should access registry for agent mappings', () => {
      const registry = new ModelRegistry();
      const mappings = registry.getDefaultMappings();
      expect(mappings.length).toBeGreaterThan(0);
    });

    it('should retrieve specific agent mapping', () => {
      const registry = new ModelRegistry();
      const mapping = registry.getForAgent('code-sage');
      expect(mapping).toBeDefined();
      expect(mapping?.agentId).toBe('code-sage');
    });

    it('should return undefined for unknown agent', () => {
      const registry = new ModelRegistry();
      const mapping = registry.getForAgent('nonexistent');
      expect(mapping).toBeUndefined();
    });

    it('should list all registered models', () => {
      const registry = new ModelRegistry();
      const models = registry.list();
      expect(models.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Hardware Detector Integration
  // ============================================================================

  describe('hardware detector integration', () => {
    it('should detect hardware tier', () => {
      const detector = new HardwareDetector();
      const hardware = detector.detect();
      expect(hardware).toBeDefined();
      expect(hardware.id).toBeDefined();
      expect(hardware.ramGB).toBeGreaterThan(0);
      expect(hardware.cpuCores).toBeGreaterThan(0);
    });

    it('should provide recommended quantization', () => {
      const detector = new HardwareDetector();
      const hardware = detector.detect();
      expect(hardware.recommendedQuant).toBeDefined();
      expect(hardware.recommendedQuant.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle task with empty quotes', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['task', 'code-sage', '']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please provide a task'));
    });

    it('should handle multiple spaces in description', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleRouteCommand(['task', 'code-sage', 'multiple   spaces   here']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Task Routed Successfully'));
    });
  });
});
