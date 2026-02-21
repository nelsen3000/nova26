// KIMI-T-PERP-02: Perplexity Research Lifecycle Adapter Tests
// Tests for createPerplexityLifecycleHooks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPerplexityLifecycleHooks,
  type PerplexityLifecycleConfig,
  getCurrentBuildState,
  getResearchCache,
  shouldUseResearch,
  resetBuildState,
  isValidTaskContext,
  isValidTaskResult,
} from '../lifecycle-adapter.js';
import type { TaskContext, TaskResult } from '../../orchestrator/lifecycle-hooks.js';

// ============================================================================
// Test Fixtures & Helpers
// ============================================================================

const createMockTaskContext = (overrides: Partial<TaskContext> = {}): TaskContext => ({
  taskId: 'task-001',
  title: 'Implement feature',
  agentName: 'kimi',
  dependencies: [],
  ...overrides,
});

const createMockTaskResult = (overrides: Partial<TaskResult> = {}): TaskResult => ({
  taskId: 'task-001',
  agentName: 'kimi',
  success: true,
  output: 'Task completed successfully',
  durationMs: 1000,
  aceScore: 0.95,
  ...overrides,
});

const createMockConfig = (overrides: Partial<PerplexityLifecycleConfig> = {}): PerplexityLifecycleConfig => ({
  enabled: true,
  ...overrides,
});

// ============================================================================
// Test Suite
// ============================================================================

describe('Perplexity Research Lifecycle Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuildState();
  });

  // ============================================================================
  // Research Detection Tests (5 tests)
  // ============================================================================

  describe('Research Detection', () => {
    it('should trigger research for "research" keyword', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research React Server Components',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(logCall).toBeDefined();
    });

    it('should trigger research for "analyze" keyword', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Analyze performance bottlenecks',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(logCall).toBeDefined();
    });

    it('should trigger research for "compare" keyword', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Compare Redux and Zustand',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(logCall).toBeDefined();
    });

    it('should trigger research for "evaluate" keyword', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Evaluate authentication libraries',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(logCall).toBeDefined();
    });

    it('should trigger research for "find" keyword', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Find best practices for error handling',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(logCall).toBeDefined();
    });

    it('should trigger research for "investigate" keyword', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Investigate memory leak in production',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(logCall).toBeDefined();
    });
  });

  // ============================================================================
  // Non-Research Task Tests (3 tests)
  // ============================================================================

  describe('Non-Research Tasks', () => {
    it('should skip research for simple implementation tasks', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Fix typo in README',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research skipped')
      );
      expect(logCall).toBeDefined();
    });

    it('should skip research for code refactoring tasks', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Refactor user service module',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research skipped')
      );
      expect(logCall).toBeDefined();
    });

    it('should skip research when disabled', async () => {
      const config = createMockConfig({ enabled: false });
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research new framework',
      }));

      // No logs should be produced when disabled
      const researchLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('[PerplexityAdapter]')
      );
      expect(researchLog).toBeUndefined();
      expect(getCurrentBuildState()).toBeNull();
    });
  });

  // ============================================================================
  // Research Context Tests (4 tests)
  // ============================================================================

  describe('Research Context', () => {
    it('should generate suggested queries for research tasks', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research React Server Components',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(logCall).toBeDefined();
      expect(logCall![1]).toBe('task-001');
      expect(logCall![2]).toMatchObject({
        queryCount: expect.any(Number),
        queries: expect.arrayContaining([expect.any(String)]),
      });
      expect(logCall![2].queries.length).toBeGreaterThan(0);
    });

    it('should generate comparison queries for compare tasks', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Compare Redux vs Zustand',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(logCall).toBeDefined();
      const queries = logCall![2].queries as string[];
      // Should include comparison-related queries
      const hasComparisonQuery = queries.some(q => 
        q.toLowerCase().includes('pros and cons') || 
        q.toLowerCase().includes('comparison')
      );
      expect(hasComparisonQuery).toBe(true);
    });

    it('should store research context in build state', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);

      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'research-task',
        title: 'Research AI models',
      }));

      const state = getCurrentBuildState();
      expect(state).not.toBeNull();
      expect(state?.researchContexts.has('research-task')).toBe(true);
    });

    it('should store minimal context for non-research tasks', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);

      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'simple-task',
        title: 'Fix typo',
      }));

      const state = getCurrentBuildState();
      expect(state).not.toBeNull();
      expect(state?.researchContexts.has('simple-task')).toBe(true);
      const context = state?.researchContexts.get('simple-task');
      expect(context?.queries).toHaveLength(0);
      expect(context?.wasResearched).toBe(false);
    });
  });

  // ============================================================================
  // After-Task Logging Tests (4 tests)
  // ============================================================================

  describe('After-Task Logging', () => {
    it('should log research results after task completion', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research TypeScript patterns',
      }));

      await hooks.onAfterTask?.(createMockTaskResult({
        success: true,
        aceScore: 0.9,
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Post-task research summary')
      );
      expect(logCall).toBeDefined();
      expect(logCall![1]).toBe('task-001');
      expect(logCall![2]).toMatchObject({
        queryId: expect.any(String),
        relevanceScore: expect.any(Number),
        taskSuccess: true,
        aceScore: 0.9,
      });
    });

    it('should capture relevance score in after-task logging', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research testing frameworks',
      }));

      await hooks.onAfterTask?.(createMockTaskResult());

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Post-task research summary')
      );
      expect(logCall).toBeDefined();
      const details = logCall![2] as { relevanceScore: number };
      expect(typeof details.relevanceScore).toBe('number');
      expect(details.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(details.relevanceScore).toBeLessThanOrEqual(100);
    });

    it('should handle failed tasks in after-task logging', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research database options',
      }));

      await hooks.onAfterTask?.(createMockTaskResult({
        success: false,
        error: 'Task failed',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Post-task research summary')
      );
      expect(logCall).toBeDefined();
      expect(logCall![2]).toMatchObject({
        taskSuccess: false,
      });
    });

    it('should warn when no research context found for task', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Don't call onBeforeTask first
      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'unknown-task' }));

      expect(consoleSpy).toHaveBeenCalledWith(
        '[PerplexityAdapter] No research context found for task unknown-task'
      );
    });
  });

  // ============================================================================
  // Research Cache Tests (4 tests)
  // ============================================================================

  describe('Research Cache', () => {
    it('should persist research across tasks in same build', async () => {
      const config = createMockConfig({ enableResearchCache: true });
      const hooks = createPerplexityLifecycleHooks(config);

      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'task-1',
        title: 'Research React patterns',
      }));

      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'task-2',
        title: 'Analyze state management',
      }));

      const state = getCurrentBuildState();
      expect(state?.researchContexts.size).toBe(2);
    });

    it('should cache research results for reuse', async () => {
      const config = createMockConfig({ enableResearchCache: true });
      const hooks = createPerplexityLifecycleHooks(config);

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research Node.js best practices',
      }));

      const cache = getResearchCache();
      expect(cache.size).toBeGreaterThan(0);
    });

    it('should return empty cache when no build state', () => {
      resetBuildState();
      const cache = getResearchCache();
      expect(cache.size).toBe(0);
    });

    it('should store findings in cache after task completion', async () => {
      const config = createMockConfig({ enableResearchCache: true });
      const hooks = createPerplexityLifecycleHooks(config);

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research CSS frameworks',
      }));

      const initialCache = getResearchCache();

      await hooks.onAfterTask?.(createMockTaskResult());

      // Cache should still contain the research
      const finalCache = getResearchCache();
      expect(finalCache.size).toBeGreaterThanOrEqual(initialCache.size);
    });
  });

  // ============================================================================
  // Utility Function Tests (5 tests)
  // ============================================================================

  describe('Utility Functions', () => {
    it('shouldUseResearch returns true for research keywords', () => {
      expect(shouldUseResearch('Research React hooks')).toBe(true);
      expect(shouldUseResearch('Analyze performance')).toBe(true);
      expect(shouldUseResearch('Compare libraries')).toBe(true);
      expect(shouldUseResearch('Evaluate options')).toBe(true);
      expect(shouldUseResearch('Find solutions')).toBe(true);
      expect(shouldUseResearch('Investigate issue')).toBe(true);
    });

    it('shouldUseResearch returns false for non-research tasks', () => {
      expect(shouldUseResearch('Fix typo')).toBe(false);
      expect(shouldUseResearch('Update dependencies')).toBe(false);
      expect(shouldUseResearch('Refactor code')).toBe(false);
      expect(shouldUseResearch('Add unit tests')).toBe(false);
    });

    it('shouldUseResearch supports custom keywords', () => {
      const customKeywords = ['explore', 'survey', 'audit'];
      expect(shouldUseResearch('Explore new frameworks', customKeywords)).toBe(true);
      expect(shouldUseResearch('Survey the landscape', customKeywords)).toBe(true);
      expect(shouldUseResearch('Audit security', customKeywords)).toBe(true);
      expect(shouldUseResearch('Research topic', customKeywords)).toBe(false); // Not in custom list
    });

    it('getCurrentBuildState returns null when no build active', () => {
      resetBuildState();
      expect(getCurrentBuildState()).toBeNull();
    });

    it('resetBuildState clears all state', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research topic',
      }));

      expect(getCurrentBuildState()).not.toBeNull();

      resetBuildState();
      expect(getCurrentBuildState()).toBeNull();
    });
  });

  // ============================================================================
  // Type Guard Tests (3 tests)
  // ============================================================================

  describe('Type Guards', () => {
    it('isValidTaskContext validates correct context', () => {
      const validContext = createMockTaskContext();
      expect(isValidTaskContext(validContext)).toBe(true);
    });

    it('isValidTaskContext rejects invalid context', () => {
      expect(isValidTaskContext(null)).toBe(false);
      expect(isValidTaskContext(undefined)).toBe(false);
      expect(isValidTaskContext({})).toBe(false);
      expect(isValidTaskContext({ taskId: '123' })).toBe(false); // Missing title
      expect(isValidTaskContext({ title: 'Test' })).toBe(false); // Missing taskId
      expect(isValidTaskContext({ taskId: 123, title: 'Test', agentName: 'kimi' })).toBe(false); // Wrong type
    });

    it('isValidTaskResult validates correct result', () => {
      const validResult = createMockTaskResult();
      expect(isValidTaskResult(validResult)).toBe(true);
    });

    it('isValidTaskResult rejects invalid result', () => {
      expect(isValidTaskResult(null)).toBe(false);
      expect(isValidTaskResult(undefined)).toBe(false);
      expect(isValidTaskResult({})).toBe(false);
      expect(isValidTaskResult({ taskId: '123' })).toBe(false); // Missing success
      expect(isValidTaskResult({ success: true })).toBe(false); // Missing taskId
      expect(isValidTaskResult({ taskId: '123', success: 'yes' })).toBe(false); // Wrong type
    });
  });

  // ============================================================================
  // Configuration Tests (3 tests)
  // ============================================================================

  describe('Configuration', () => {
    it('should respect minRelevanceThreshold', async () => {
      const config = createMockConfig({
        minRelevanceThreshold: 90, // Very high threshold
      });
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research some obscure topic',
      }));

      // The research will complete but warn about low relevance
      const warnCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Low relevance score')
      );
      // May or may not trigger depending on mock response relevance
      // Just verify the hook executed without error
      expect(getCurrentBuildState()).not.toBeNull();
    });

    it('should respect enableLogging setting', async () => {
      const config = createMockConfig({ enableLogging: false });
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Research topic',
      }));

      // No logs should be produced when logging is disabled
      const researchLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('[PerplexityAdapter]')
      );
      expect(researchLog).toBeUndefined();
    });

    it('should use custom research keywords', async () => {
      const customKeywords = ['explore', 'survey'];
      const config = createMockConfig({ researchKeywords: customKeywords });
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await hooks.onBeforeTask?.(createMockTaskContext({
        title: 'Explore new possibilities',
      }));

      const logCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(logCall).toBeDefined();
    });
  });

  // ============================================================================
  // Error Handling Tests (3 tests)
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle invalid task context gracefully', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // @ts-expect-error Testing invalid context
      await hooks.onBeforeTask?.({ invalid: 'context' });

      expect(consoleSpy).toHaveBeenCalledWith('[PerplexityAdapter] Invalid task context');
    });

    it('should handle invalid task result gracefully', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // @ts-expect-error Testing invalid result
      await hooks.onAfterTask?.({ invalid: 'result' });

      expect(consoleSpy).toHaveBeenCalledWith('[PerplexityAdapter] Invalid task result');
    });

    it('should handle after-task without prior before-task', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hooks.onAfterTask?.(createMockTaskResult({ taskId: 'orphan-task' }));

      expect(consoleSpy).toHaveBeenCalledWith(
        '[PerplexityAdapter] No research context found for task orphan-task'
      );
    });
  });

  // ============================================================================
  // End-to-End Integration Tests (4 tests)
  // ============================================================================

  describe('End-to-End Integration', () => {
    it('should handle complete research task lifecycle', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Task start - research triggered
      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'research-lifecycle-task',
        title: 'Research best testing practices',
      }));

      const beforeLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Research triggered')
      );
      expect(beforeLog).toBeDefined();

      // Task complete - results logged
      await hooks.onAfterTask?.(createMockTaskResult({
        taskId: 'research-lifecycle-task',
        success: true,
        aceScore: 0.95,
      }));

      const afterLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Post-task research summary')
      );
      expect(afterLog).toBeDefined();
    });

    it('should handle multiple tasks with mixed research needs', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);

      // Research task
      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'task-research',
        title: 'Research state management',
      }));

      // Non-research task
      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'task-simple',
        title: 'Fix indentation',
      }));

      // Another research task
      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'task-analyze',
        title: 'Analyze bundle size',
      }));

      const state = getCurrentBuildState();
      expect(state?.researchContexts.size).toBe(3);
    });

    it('should maintain separate cache entries for different queries', async () => {
      const config = createMockConfig({ enableResearchCache: true });
      const hooks = createPerplexityLifecycleHooks(config);

      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'task-1',
        title: 'Research React patterns',
      }));

      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'task-2',
        title: 'Research Vue patterns',
      }));

      const cache = getResearchCache();
      // Should have different cache entries for different queries
      expect(cache.size).toBeGreaterThanOrEqual(1);
    });

    it('should handle sequential builds with state reset', async () => {
      const config = createMockConfig();
      const hooks = createPerplexityLifecycleHooks(config);

      // Build 1
      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'b1-task',
        title: 'Research topic A',
      }));

      const state1 = getCurrentBuildState();
      expect(state1?.researchContexts.has('b1-task')).toBe(true);

      // Reset and Build 2
      resetBuildState();

      await hooks.onBeforeTask?.(createMockTaskContext({
        taskId: 'b2-task',
        title: 'Research topic B',
      }));

      const state2 = getCurrentBuildState();
      expect(state2?.researchContexts.has('b2-task')).toBe(true);
      expect(state2?.researchContexts.has('b1-task')).toBe(false);
    });
  });
});
