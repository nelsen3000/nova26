// ATLAS - Hindsight Integration Tests
// K4-22: Verify Hindsight integration with ATLAS

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  KronosAtlas,
} from '../index.js';
import type { BuildLog } from '../types.js';

describe('ATLAS Hindsight Integration', () => {
  let atlas: KronosAtlas;

  beforeEach(() => {
    atlas = new KronosAtlas();
  });

  describe('Build Logging', () => {
    it('should log builds with Hindsight hook support', async () => {
      const mockHook = vi.fn().mockResolvedValue(undefined);
      atlas.setHindsightHook(mockHook);

      const buildLog: BuildLog = {
        taskId: 'task-001',
        agent: 'MARS',
        response: 'Successfully implemented feature',
        timestamp: Date.now(),
        gatesPassed: true,
      };

      // Should not throw
      await expect(atlas.logBuild(buildLog, 'test-project', 1)).resolves.not.toThrow();
    });

    it('should work without Hindsight hook', async () => {
      const buildLog: BuildLog = {
        taskId: 'task-002',
        agent: 'VENUS',
        response: 'UI updated',
        timestamp: Date.now(),
        gatesPassed: true,
      };

      // Should work without hook
      await expect(atlas.logBuild(buildLog, 'test-project', 1)).resolves.not.toThrow();
    });

    it('should handle Hindsight hook failures gracefully', async () => {
      const failingHook = vi.fn().mockRejectedValue(new Error('Hindsight failed'));
      atlas.setHindsightHook(failingHook);

      const buildLog: BuildLog = {
        taskId: 'task-003',
        agent: 'MARS',
        response: 'Task completed',
        timestamp: Date.now(),
        gatesPassed: true,
      };

      // Should not throw even if hook fails
      await expect(atlas.logBuild(buildLog, 'test-project', 1)).resolves.not.toThrow();
    });
  });

  describe('Hook Management', () => {
    it('should set and clear Hindsight hook', () => {
      const mockHook = vi.fn().mockResolvedValue(undefined);
      
      atlas.setHindsightHook(mockHook);
      // Hook is set (no error)
      
      atlas.clearHindsightHook();
      // Hook is cleared (no error)
    });
  });

  describe('Availability Checks', () => {
    it('should check Kronos availability', async () => {
      const available = await atlas.isKronosAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should check Convex availability', async () => {
      const available = await atlas.isConvexAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('Pattern Search', () => {
    it('should search patterns', async () => {
      const results = await atlas.searchPatterns('test query');
      
      expect(results).toBeDefined();
      // Results structure may vary based on Kronos availability
      expect(typeof results).toBe('object');
    });
  });
});
