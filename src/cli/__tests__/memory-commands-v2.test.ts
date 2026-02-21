// KMS-03: Tests for /memory CLI command

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleMemoryCommand, memoryCommand } from '../memory-commands-v2.js';
import {
  getInfiniteMemory,
  resetInfiniteMemory,
  createInfiniteMemory,
  type MemoryLevel,
} from '../../atlas/infinite-memory-core.js';

describe('/memory CLI command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInfiniteMemory();
  });

  // ============================================================================
  // Command Definition
  // ============================================================================

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(memoryCommand.name).toBe('/memory');
    });

    it('should have description', () => {
      expect(memoryCommand.description).toBeDefined();
      expect(memoryCommand.description.length).toBeGreaterThan(0);
    });

    it('should have handler function', () => {
      expect(typeof memoryCommand.handler).toBe('function');
    });
  });

  // ============================================================================
  // Help Command
  // ============================================================================

  describe('help', () => {
    it('should show help with no args', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/memory'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('query'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('hierarchy'));
    });

    it('should show help with "help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Infinite Memory'));
    });

    it('should show help with "--help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['--help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should show help for unknown subcommand', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['unknown']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/memory'));
    });
  });

  // ============================================================================
  // Query Command
  // ============================================================================

  describe('query', () => {
    it('should show error when no search term provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['query']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'));
    });

    it('should show no results message when memory is empty', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['query', 'test']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No memories found'));
    });

    it('should query memories with search term', async () => {
      const memory = getInfiniteMemory();
      await memory.upsertWithHierarchy({
        level: 'project',
        content: 'Test content about authentication',
        metadata: {
          agentId: 'test-agent',
          timestamp: new Date().toISOString(),
          tasteScore: 0.8,
          accessCount: 1,
          lastAccessed: new Date().toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['query', 'authentication']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Querying memory'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found'));
    });

    it('should handle multi-word search terms', async () => {
      const memory = getInfiniteMemory();
      await memory.upsertWithHierarchy({
        level: 'project',
        content: 'Multi word test content',
        metadata: {
          agentId: 'test-agent',
          timestamp: new Date().toISOString(),
          tasteScore: 0.8,
          accessCount: 1,
          lastAccessed: new Date().toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['query', 'multi', 'word', 'test']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Querying memory'));
    });
  });

  // ============================================================================
  // Hierarchy Command
  // ============================================================================

  describe('hierarchy', () => {
    it('should show empty hierarchy when no memories', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['hierarchy']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Memory Hierarchy'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No memories'));
    });

    it('should show hierarchy with memories', async () => {
      const memory = getInfiniteMemory();
      await memory.upsertWithHierarchy({
        level: 'lifetime',
        content: 'Lifetime knowledge',
        metadata: {
          agentId: 'test-agent',
          timestamp: new Date().toISOString(),
          tasteScore: 0.95,
          accessCount: 10,
          lastAccessed: new Date().toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['hierarchy']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('4-Level'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Lifetime'));
    });

    it('should display all four hierarchy levels', async () => {
      const memory = getInfiniteMemory();
      const levels: MemoryLevel[] = ['scene', 'project', 'portfolio', 'lifetime'];

      for (const level of levels) {
        await memory.upsertWithHierarchy({
          level,
          content: `${level} content`,
          metadata: {
            agentId: 'test-agent',
            timestamp: new Date().toISOString(),
            tasteScore: 0.7,
            accessCount: 1,
            lastAccessed: new Date().toISOString(),
          },
          childIds: [],
        });
      }

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['hierarchy']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🌟 Lifetime'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📁 Portfolio'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📂 Project'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🎬 Scene'));
    });
  });

  // ============================================================================
  // Stats Command
  // ============================================================================

  describe('stats', () => {
    it('should show empty stats when no memories', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['stats']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Statistics'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total Memory Nodes: 0'));
    });

    it('should show stats with memory counts', async () => {
      const memory = getInfiniteMemory();
      await memory.upsertWithHierarchy({
        level: 'project',
        content: 'Project memory',
        metadata: {
          agentId: 'test-agent',
          timestamp: new Date().toISOString(),
          tasteScore: 0.85,
          accessCount: 5,
          lastAccessed: new Date().toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['stats']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total Memory Nodes: 1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Average Taste Score'));
    });

    it('should display breakdown by level', async () => {
      const memory = getInfiniteMemory();
      await memory.upsertWithHierarchy({
        level: 'lifetime',
        content: 'Lifetime memory',
        metadata: {
          agentId: 'test-agent',
          timestamp: new Date().toISOString(),
          tasteScore: 0.9,
          accessCount: 10,
          lastAccessed: new Date().toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['stats']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('By Level:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('lifetime'));
    });

    it('should show total edges count', async () => {
      const memory = getInfiniteMemory();
      await memory.upsertWithHierarchy({
        level: 'lifetime',
        content: 'Parent memory',
        metadata: {
          agentId: 'test-agent',
          timestamp: new Date().toISOString(),
          tasteScore: 0.9,
          accessCount: 10,
          lastAccessed: new Date().toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['stats']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total Edges:'));
    });
  });

  // ============================================================================
  // Prune Command
  // ============================================================================

  describe('prune', () => {
    it('should prune with default 30 days', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['prune']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Pruning memories older than 30 days'));
    });

    it('should prune with custom days', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['prune', '--days', '7']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Pruning memories older than 7 days'));
    });

    it('should show message when no stale memories', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['prune']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No stale memories found'));
    });

    it('should report pruned count', async () => {
      // Use createInfiniteMemory directly (already imported at top)
      const testMemory = createInfiniteMemory();
      
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      await testMemory.upsertWithHierarchy({
        level: 'scene',
        content: 'Old scene memory',
        metadata: {
          agentId: 'test-agent',
          timestamp: oldDate.toISOString(),
          tasteScore: 0.3,
          accessCount: 1,
          lastAccessed: oldDate.toISOString(),
        },
        childIds: [],
      });

      // Verify the memory has the node before pruning
      const statsBefore = testMemory.getStats();
      expect(statsBefore.totalNodes).toBe(1);

      // Prune directly using the memory instance
      const prunedCount = await testMemory.pruneStale(30);
      expect(prunedCount).toBe(1);
    });

    it('should preserve lifetime memories during prune', async () => {
      const memory = getInfiniteMemory();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      await memory.upsertWithHierarchy({
        level: 'lifetime',
        content: 'Old lifetime memory',
        metadata: {
          agentId: 'test-agent',
          timestamp: oldDate.toISOString(),
          tasteScore: 0.3,
          accessCount: 1,
          lastAccessed: oldDate.toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['prune', '--days', '30']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No stale memories'));
    });
  });

  // ============================================================================
  // Memory Integration
  // ============================================================================

  describe('memory integration', () => {
    it('should access memory singleton', () => {
      const memory = getInfiniteMemory();
      expect(memory).toBeDefined();
      expect(typeof memory.queryHierarchical).toBe('function');
    });

    it('should reset memory between tests', () => {
      const memory = getInfiniteMemory();
      const stats1 = memory.getStats();
      expect(stats1.totalNodes).toBe(0);
    });

    it('should create isolated memory instance', () => {
      const isolated = createInfiniteMemory();
      expect(isolated).toBeDefined();
      expect(typeof isolated.upsertWithHierarchy).toBe('function');
    });
  });

  // ============================================================================
  // Output Formatting
  // ============================================================================

  describe('output formatting', () => {
    it('should format taste scores as percentage', async () => {
      const memory = getInfiniteMemory();
      await memory.upsertWithHierarchy({
        level: 'project',
        content: 'Test memory',
        metadata: {
          agentId: 'test-agent',
          timestamp: new Date().toISOString(),
          tasteScore: 0.75,
          accessCount: 1,
          lastAccessed: new Date().toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['stats']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('75.0%'));
    });

    it('should format taste bar in query results', async () => {
      const memory = getInfiniteMemory();
      await memory.upsertWithHierarchy({
        level: 'project',
        content: 'Test content',
        metadata: {
          agentId: 'test-agent',
          timestamp: new Date().toISOString(),
          tasteScore: 0.8,
          accessCount: 1,
          lastAccessed: new Date().toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['query', 'test']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('█'));
    });

    it('should show level icons in output', async () => {
      const memory = getInfiniteMemory();
      await memory.upsertWithHierarchy({
        level: 'lifetime',
        content: 'Lifetime content',
        metadata: {
          agentId: 'test-agent',
          timestamp: new Date().toISOString(),
          tasteScore: 0.9,
          accessCount: 1,
          lastAccessed: new Date().toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['hierarchy']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🌟'));
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty search term (whitespace only)', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['query', '   ']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'));
    });

    it('should handle invalid days parameter', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['prune', '--days', 'invalid']);
      // Should fall back to default
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Pruning memories older than 30 days'));
    });

    it('should handle negative days parameter', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['prune', '--days', '-5']);
      // Should fall back to default
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Pruning memories older than 30 days'));
    });

    it('should handle high taste score memory preservation', async () => {
      const memory = getInfiniteMemory();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      await memory.upsertWithHierarchy({
        level: 'project',
        content: 'High value old memory',
        metadata: {
          agentId: 'test-agent',
          timestamp: oldDate.toISOString(),
          tasteScore: 0.9, // High taste score
          accessCount: 1,
          lastAccessed: oldDate.toISOString(),
        },
        childIds: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleMemoryCommand(['prune', '--days', '30']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No stale memories'));
    });
  });
});
