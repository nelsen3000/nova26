// KMS-05: Tests for /collaborate CLI command

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleCollaborateCommand,
  collaborateCommand,
  resetCollaborateState,
} from '../collaborate-commands.js';

describe('/collaborate CLI command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCollaborateState();
  });

  // ============================================================================
  // Command Definition
  // ============================================================================

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(collaborateCommand.name).toBe('/collaborate');
    });

    it('should have description', () => {
      expect(collaborateCommand.description).toBeDefined();
      expect(collaborateCommand.description.length).toBeGreaterThan(0);
    });

    it('should have handler function', () => {
      expect(typeof collaborateCommand.handler).toBe('function');
    });
  });

  // ============================================================================
  // Help Command
  // ============================================================================

  describe('help', () => {
    it('should show help with no args', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/collaborate'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('start'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('participants'));
    });

    it('should show help with "help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CRDT Collaboration'));
    });

    it('should show help with "--help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['--help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });
  });

  // ============================================================================
  // Start Command
  // ============================================================================

  describe('start', () => {
    it('should show error when no doc-id specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'));
    });

    it('should start collaboration with doc-id', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-123']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Collaboration Session Started'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('doc-123'));
    });

    it('should create document if not exists', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'new-doc-456']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Collaboration Session Started'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('new-doc-456'));
    });

    it('should show active status after start', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-active']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Active'));
    });
  });

  // ============================================================================
  // Participants Command
  // ============================================================================

  describe('participants', () => {
    it('should show error when no active session', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['participants']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No active collaboration session'));
    });

    it('should show participants after starting session', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-participants']);
      await handleCollaborateCommand(['participants']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Active Participants'));
    });

    it('should show current user indicator', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-user']);
      await handleCollaborateCommand(['participants']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('you'));
    });
  });

  // ============================================================================
  // Changes Command
  // ============================================================================

  describe('changes', () => {
    it('should show error when no active session', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['changes']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No active collaboration session'));
    });

    it('should show changes header after starting session', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-changes']);
      await handleCollaborateCommand(['changes']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Recent Changes'));
    });

    it('should show empty changes message initially', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-empty']);
      await handleCollaborateCommand(['changes']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No changes recorded'));
    });
  });

  // ============================================================================
  // Resolve Command
  // ============================================================================

  describe('resolve', () => {
    it('should show error when no active session', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['resolve', 'change-123']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No active collaboration session'));
    });

    it('should show error when no change-id specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-resolve']);
      await handleCollaborateCommand(['resolve']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'));
    });

    it('should resolve change with valid id', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-resolve-valid']);
      await handleCollaborateCommand(['resolve', 'change-abc']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Conflict Resolved'));
    });

    it('should show resolution details', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-resolve-details']);
      await handleCollaborateCommand(['resolve', 'change-xyz']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('change-xyz'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Applied successfully'));
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle unknown subcommand', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['unknown']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/collaborate'));
    });

    it('should maintain session across commands', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-session']);
      await handleCollaborateCommand(['participants']);
      await handleCollaborateCommand(['changes']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Active Participants'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Recent Changes'));
    });

    it('should reset state correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-reset']);
      resetCollaborateState();
      await handleCollaborateCommand(['participants']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No active collaboration session'));
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration', () => {
    it('should complete full workflow: start -> participants -> changes', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Start session
      await handleCollaborateCommand(['start', 'doc-workflow']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Collaboration Session Started'));

      // Show participants
      await handleCollaborateCommand(['participants']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Active Participants'));

      // Show changes
      await handleCollaborateCommand(['changes']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Recent Changes'));
    });

    it('should handle multiple start commands', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleCollaborateCommand(['start', 'doc-first']);
      await handleCollaborateCommand(['start', 'doc-second']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Collaboration Session Started'));
    });
  });
});
