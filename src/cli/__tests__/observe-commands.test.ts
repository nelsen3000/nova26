// KMS-04: Tests for /observe CLI command

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleObserveCommand, observeCommand } from '../observe-commands.js';
import {
  getCinematicObservability,
  resetCinematicObservability,
  createCinematicObservability,
} from '../../observability/cinematic-core.js';

describe('/observe CLI command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCinematicObservability();
  });

  // ============================================================================
  // Command Definition (4 tests)
  // ============================================================================

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(observeCommand.name).toBe('/observe');
    });

    it('should have description', () => {
      expect(observeCommand.description).toBeDefined();
      expect(observeCommand.description.length).toBeGreaterThan(0);
    });

    it('should have handler function', () => {
      expect(typeof observeCommand.handler).toBe('function');
    });

    it('should have usage string', () => {
      expect(observeCommand.usage).toBeDefined();
      expect(observeCommand.usage).toContain('traces');
    });
  });

  // ============================================================================
  // Help Command (3 tests)
  // ============================================================================

  describe('help', () => {
    it('should show help with no args', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/observe'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('traces'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('spans'));
    });

    it('should show help with "help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cinematic Observability'));
    });

    it('should show help with "--help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['--help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });
  });

  // ============================================================================
  // Traces Command (3 tests)
  // ============================================================================

  describe('traces', () => {
    it('should show empty traces message when no spans exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['traces']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Active Traces'));
    });

    it('should show traces when spans exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const observability = getCinematicObservability();

      observability.recordSpan({
        traceId: 'trace-123',
        name: 'test-span',
        agentId: 'VENUS',
        type: 'agent-call',
        startTime: new Date().toISOString(),
        metadata: {},
        status: 'running',
      });

      await handleObserveCommand(['traces']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Active Traces'));
    });

    it('should show trace statistics summary', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const observability = getCinematicObservability();

      observability.recordSpan({
        traceId: 'trace-456',
        name: 'test-span-2',
        agentId: 'MARS',
        type: 'llm-inference',
        startTime: new Date().toISOString(),
        metadata: {},
        status: 'success',
      });

      await handleObserveCommand(['traces']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('running'));
    });
  });

  // ============================================================================
  // Spans Command (4 tests)
  // ============================================================================

  describe('spans', () => {
    it('should show error when no trace-id specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['spans']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'));
    });

    it('should show error for non-existent trace', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['spans', 'nonexistent-trace']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No spans found'));
    });

    it('should show spans for existing trace', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const observability = getCinematicObservability();
      const traceId = 'test-trace-789';

      observability.recordSpan({
        traceId,
        name: 'parent-span',
        agentId: 'SUN',
        type: 'agent-call',
        startTime: new Date().toISOString(),
        metadata: {},
        status: 'running',
      });

      await handleObserveCommand(['spans', traceId]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Spans for Trace'));
    });

    it('should display span with taste vault score', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const observability = getCinematicObservability();
      const traceId = 'test-trace-abc';

      observability.recordSpan({
        traceId,
        name: 'scored-span',
        agentId: 'EARTH',
        type: 'user-interaction',
        startTime: new Date().toISOString(),
        metadata: {},
        status: 'success',
        tasteVaultScore: 0.95,
      });

      await handleObserveCommand(['spans', traceId]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Taste Score'));
    });
  });

  // ============================================================================
  // Report Command (3 tests)
  // ============================================================================

  describe('report', () => {
    it('should show report without build-id', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['report']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Observability Report'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Span Statistics'));
    });

    it('should show report with specific build-id', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['report', 'build-123']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('build-123'));
    });

    it('should show agent performance breakdown', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const observability = getCinematicObservability();

      observability.recordSpan({
        traceId: 'trace-report',
        name: 'agent-task',
        agentId: 'VENUS',
        type: 'agent-call',
        startTime: new Date().toISOString(),
        metadata: {},
        status: 'success',
      });

      await handleObserveCommand(['report']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Agent Performance'));
    });
  });

  // ============================================================================
  // Config Command (3 tests)
  // ============================================================================

  describe('config', () => {
    it('should show config help when no backend specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['config']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Observability Configuration'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Braintrust'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('LangSmith'));
    });

    it('should configure braintrust with api key', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['config', '--braintrust', '--api-key', 'bt-test-key-12345']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Braintrust configured'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('bt-test-...'));
    });

    it('should show error for braintrust without api key', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['config', '--braintrust']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API key required'));
    });
  });

  // ============================================================================
  // Edge Cases (3 tests)
  // ============================================================================

  describe('edge cases', () => {
    it('should handle unknown subcommand gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['unknown']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/observe'));
    });

    it('should handle langsmith config without api key', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleObserveCommand(['config', '--langsmith']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API key required'));
    });

    it('should reset observability after command execution', async () => {
      const observability = getCinematicObservability();
      observability.recordSpan({
        traceId: 'cleanup-test',
        name: 'cleanup-span',
        agentId: 'MERCURY',
        type: 'gate-check',
        startTime: new Date().toISOString(),
        metadata: {},
        status: 'running',
      });

      await handleObserveCommand(['traces']);

      // After reset, stats should be cleared
      const newObservability = getCinematicObservability();
      const stats = newObservability.getStats();
      expect(stats.totalSpans).toBe(0);
    });
  });
});
