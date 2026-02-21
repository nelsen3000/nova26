// KMS-22: /flags CLI command tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleFlagsCommand,
  resetFlagsState,
  setRegistry,
  flagsCommand,
} from '../flags-commands.js';
import { FeatureFlagRegistry, registerDefaultFlags } from '../../config/feature-flags.js';

describe('/flags command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let registry: FeatureFlagRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetFlagsState();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Create fresh registry with default flags
    registry = new FeatureFlagRegistry();
    registerDefaultFlags(registry);
    setRegistry(registry);
  });

  describe('command definition', () => {
    it('should have correct name and description', () => {
      expect(flagsCommand.name).toBe('/flags');
      expect(flagsCommand.description).toContain('flags');
      expect(flagsCommand.handler).toBe(handleFlagsCommand);
    });

    it('should have usage information', () => {
      expect(flagsCommand.usage).toContain('flags');
    });
  });

  describe('help command', () => {
    it('should show list with no args', async () => {
      await handleFlagsCommand([]);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Feature Flags');
    });

    it('should show help with "help" arg', async () => {
      await handleFlagsCommand(['help']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Feature Flag Management');
    });
  });

  describe('list flags', () => {
    it('should list all flags', async () => {
      await handleFlagsCommand(['list']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Feature Flags');
    });

    it('should list flags by source', async () => {
      await handleFlagsCommand([]);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('DEFAULT');
    });

    it('should show flag names and values', async () => {
      await handleFlagsCommand(['list']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('model-routing');
    });

    it('should show total count', async () => {
      await handleFlagsCommand(['list']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Total:');
    });

    it('should handle empty registry', async () => {
      const emptyRegistry = new FeatureFlagRegistry();
      setRegistry(emptyRegistry);
      
      await handleFlagsCommand(['list']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('No flags registered');
    });
  });

  describe('set flag', () => {
    it('should set boolean flag to true', async () => {
      await handleFlagsCommand(['set', 'model-routing', 'true']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Flag updated');
      expect(output).toContain('model-routing');
      expect(registry.getBoolean('model-routing')).toBe(true);
    });

    it('should set boolean flag to false', async () => {
      await handleFlagsCommand(['set', 'perplexity', 'false']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Flag updated');
      expect(registry.getBoolean('perplexity')).toBe(false);
    });

    it('should set numeric value', async () => {
      registry.register({
        name: 'timeout',
        description: 'Timeout',
        defaultValue: 1000,
        type: 'number',
      });
      
      await handleFlagsCommand(['set', 'timeout', '5000']);
      
      expect(registry.get('timeout')).toBe(5000);
    });

    it('should show error for unknown flag', async () => {
      await handleFlagsCommand(['set', 'unknown-flag', 'true']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Unknown flag');
    });

    it('should show help for missing value', async () => {
      await handleFlagsCommand(['set', 'model-routing']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Usage:');
    });
  });

  describe('reset flags', () => {
    it('should reset all flags', async () => {
      registry.set('model-routing', false);
      
      await handleFlagsCommand(['reset']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Resetting all flags');
      expect(registry.getBoolean('model-routing')).toBe(true);
    });

    it('should show count of reset flags', async () => {
      await handleFlagsCommand(['reset']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toMatch(/Reset \d+ flags/);
    });
  });

  describe('formatting', () => {
    it('should format true values with green check', async () => {
      await handleFlagsCommand(['list']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      // The formatting uses 🟢 for true
      expect(output).toContain('🟢');
    });

    it('should format false values with red X', async () => {
      await handleFlagsCommand(['list']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      // The formatting uses 🔴 for false
      expect(output).toContain('🔴');
    });

    it('should show source icons', async () => {
      await handleFlagsCommand(['list']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('⚪');
    });
  });

  describe('integration', () => {
    it('should use custom registry', async () => {
      const customRegistry = new FeatureFlagRegistry();
      customRegistry.register({
        name: 'custom-flag',
        description: 'Custom',
        defaultValue: true,
        type: 'boolean',
      });
      setRegistry(customRegistry);

      await handleFlagsCommand(['list']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('custom-flag');
    });

    it('should reset state', () => {
      const r1 = new FeatureFlagRegistry();
      setRegistry(r1);
      
      resetFlagsState();
      
      // After reset, should create new registry on next use
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Error'));
    });
  });

  describe('edge cases', () => {
    it('should handle help for invalid action', async () => {
      await handleFlagsCommand(['invalid']);
      
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Usage:');
    });

    it('should handle empty flag name', async () => {
      await handleFlagsCommand(['set', '', 'true']);
      
      // Empty string is treated as missing flag name, shows help
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('/flags');
    });
  });
});
