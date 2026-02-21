// KMS-06: Tests for /research CLI command

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleResearchCommand, researchCommand } from '../research-commands.js';

// Mock console.log for all tests
const mockConsoleLog = vi.fn();
const originalConsoleLog = console.log;

// Mock research results
const createMockBrief = (overrides = {}) => ({
  queryId: 'test-query-123',
  timestamp: new Date().toISOString(),
  originalQuery: 'test query',
  synthesizedAnswer: 'Test answer',
  keyFindings: ['Finding 1', 'Finding 2'],
  sources: [{ title: 'Source 1', url: 'https://example.com', reliability: 0.9, snippet: '' }],
  novaRelevanceScore: 85,
  suggestedNextActions: ['Action 1'],
  tags: ['test'],
  tasteVaultPersonalization: 'none',
  ...overrides,
});

// Track mock calls
const mockResearchCalls: Array<{ query: string; context?: string }> = [];
const mockClearCacheCalls: unknown[] = [];
let mockCacheStats = { size: 0, hitRate: 0 };
let mockResearchResult = createMockBrief();
let shouldResearchFail = false;
let researchError: unknown = null;

// Mock the perplexity module
vi.mock('../../tools/perplexity/index.js', () => ({
  PerplexityAgent: vi.fn().mockImplementation(() => ({
    research: vi.fn().mockImplementation((query: string, context?: string) => {
      mockResearchCalls.push({ query, context });
      if (shouldResearchFail) {
        return Promise.reject(researchError);
      }
      return Promise.resolve(mockResearchResult);
    }),
    clearCache: vi.fn().mockImplementation(() => {
      mockClearCacheCalls.push({});
      mockCacheStats = { size: 0, hitRate: 0 };
    }),
    getCacheStats: vi.fn().mockImplementation(() => mockCacheStats),
  })),
  createPerplexityAgent: vi.fn().mockImplementation(() => ({
    research: vi.fn().mockImplementation((query: string, context?: string) => {
      mockResearchCalls.push({ query, context });
      if (shouldResearchFail) {
        return Promise.reject(researchError);
      }
      return Promise.resolve(mockResearchResult);
    }),
    clearCache: vi.fn().mockImplementation(() => {
      mockClearCacheCalls.push({});
      mockCacheStats = { size: 0, hitRate: 0 };
    }),
    getCacheStats: vi.fn().mockImplementation(() => mockCacheStats),
  })),
}));

describe('/research CLI command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = mockConsoleLog;
    mockConsoleLog.mockClear();
    
    // Reset mock state
    mockResearchCalls.length = 0;
    mockClearCacheCalls.length = 0;
    mockCacheStats = { size: 5, hitRate: 75 };
    mockResearchResult = createMockBrief();
    shouldResearchFail = false;
    researchError = null;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  // ============================================================================
  // Command Definition
  // ============================================================================

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(researchCommand.name).toBe('/research');
    });

    it('should have description', () => {
      expect(researchCommand.description).toBeDefined();
      expect(researchCommand.description.length).toBeGreaterThan(0);
    });

    it('should have handler function', () => {
      expect(typeof researchCommand.handler).toBe('function');
    });
  });

  // ============================================================================
  // Help Command
  // ============================================================================

  describe('help', () => {
    it('should show help with no args', async () => {
      await handleResearchCommand([]);
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('/research');
      expect(allOutput).toContain('search');
      expect(allOutput).toContain('deep');
    });

    it('should show help with "help" arg', async () => {
      await handleResearchCommand(['help']);
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Perplexity Research');
    });

    it('should show help with "--help" arg', async () => {
      await handleResearchCommand(['--help']);
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Usage:');
    });

    it('should show help for unknown subcommand', async () => {
      await handleResearchCommand(['unknown']);
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('/research');
    });
  });

  // ============================================================================
  // Search Command
  // ============================================================================

  describe('search', () => {
    it('should show error when no query provided', async () => {
      await handleResearchCommand(['search']);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Please provide'));
    });

    it('should perform quick search with query', async () => {
      await handleResearchCommand(['search', 'TypeScript tips']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Quick Search');
      expect(allOutput).toContain('TypeScript tips');
    });

    it('should handle multi-word search queries', async () => {
      mockResearchResult = createMockBrief({
        originalQuery: 'React best practices 2024',
        synthesizedAnswer: 'React best practices include',
      });

      await handleResearchCommand(['search', 'React', 'best', 'practices', '2024']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Quick Search');
    });

    it('should handle research errors gracefully', async () => {
      shouldResearchFail = true;
      researchError = new Error('API rate limit exceeded');

      await handleResearchCommand(['search', 'test query']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Research failed'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('API rate limit exceeded'));
    });
  });

  // ============================================================================
  // Deep Command
  // ============================================================================

  describe('deep', () => {
    it('should show error when no query provided', async () => {
      await handleResearchCommand(['deep']);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Please provide'));
    });

    it('should perform deep research with context', async () => {
      mockResearchResult = createMockBrief({
        originalQuery: 'React performance',
        synthesizedAnswer: 'Comprehensive React performance analysis',
        keyFindings: ['Finding 1', 'Finding 2', 'Finding 3'],
        sources: [
          { title: 'Source 1', url: 'https://example.com/1', reliability: 0.95, snippet: '' },
          { title: 'Source 2', url: 'https://example.com/2', reliability: 0.8, snippet: '' },
        ],
        novaRelevanceScore: 95,
        suggestedNextActions: ['Implement optimizations', 'Review code'],
        tags: ['react', 'performance'],
      });

      await handleResearchCommand(['deep', 'React performance']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Deep Research');
      expect(allOutput).toContain('React performance');
    });

    it('should display sources when available', async () => {
      mockResearchResult = createMockBrief({
        sources: [{ title: 'Test Source', url: 'https://test.com', reliability: 0.9, snippet: '' }],
      });

      await handleResearchCommand(['deep', 'test']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Sources:');
    });

    it('should display tags when available', async () => {
      mockResearchResult = createMockBrief({
        tags: ['api', 'security'],
      });

      await handleResearchCommand(['deep', 'test']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('api');
      expect(allOutput).toContain('security');
    });
  });

  // ============================================================================
  // Cache Command
  // ============================================================================

  describe('cache', () => {
    it('should show cache stats', async () => {
      mockCacheStats = { size: 5, hitRate: 75 };

      await handleResearchCommand(['cache']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Cache Stats');
      expect(allOutput).toContain('5');
    });

    it('should clear cache with --clear flag', async () => {
      await handleResearchCommand(['cache', '--clear']);
      
      expect(mockClearCacheCalls.length).toBe(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('cleared successfully'));
    });

    it('should show zero stats for empty cache', async () => {
      mockCacheStats = { size: 0, hitRate: 0 };

      await handleResearchCommand(['cache']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('0');
    });
  });

  // ============================================================================
  // Output Formatting
  // ============================================================================

  describe('output formatting', () => {
    it('should format research results with relevance score', async () => {
      mockResearchResult = createMockBrief({
        novaRelevanceScore: 92,
      });

      await handleResearchCommand(['search', 'format test']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('92%');
    });

    it('should format sources with reliability indicators', async () => {
      mockResearchResult = createMockBrief({
        sources: [
          { title: 'High Reliability', url: 'https://high.com', reliability: 0.9, snippet: '' },
          { title: 'Med Reliability', url: 'https://med.com', reliability: 0.6, snippet: '' },
          { title: 'Low Reliability', url: 'https://low.com', reliability: 0.3, snippet: '' },
        ],
      });

      await handleResearchCommand(['search', 'source test']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('High Reliability');
      expect(allOutput).toContain('Med Reliability');
      expect(allOutput).toContain('Low Reliability');
    });

    it('should display key findings correctly', async () => {
      mockResearchResult = createMockBrief({
        keyFindings: ['First important finding', 'Second important finding'],
      });

      await handleResearchCommand(['search', 'findings test']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Key Findings');
      expect(allOutput).toContain('First important finding');
      expect(allOutput).toContain('Second important finding');
    });

    it('should display suggested next actions', async () => {
      mockResearchResult = createMockBrief({
        suggestedNextActions: ['Read documentation', 'Try examples'],
      });

      await handleResearchCommand(['search', 'actions test']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Suggested Next Actions');
      expect(allOutput).toContain('Read documentation');
      expect(allOutput).toContain('Try examples');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty key findings', async () => {
      mockResearchResult = createMockBrief({
        keyFindings: [],
        novaRelevanceScore: 50,
      });

      await handleResearchCommand(['search', 'empty test']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('No key findings');
    });

    it('should handle non-Error research failures', async () => {
      shouldResearchFail = true;
      researchError = 'String error';

      await handleResearchCommand(['search', 'error test']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Research failed'));
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration', () => {
    it('should complete full workflow: search -> deep -> cache', async () => {
      mockResearchResult = createMockBrief({
        originalQuery: 'integration',
        synthesizedAnswer: 'Integration answer',
        keyFindings: ['Finding'],
        novaRelevanceScore: 88,
      });
      mockCacheStats = { size: 2, hitRate: 50 };

      // Quick search
      await handleResearchCommand(['search', 'quick topic']);
      const searchCalls = mockResearchCalls.filter(c => c.query === 'quick topic');
      expect(searchCalls.length).toBeGreaterThan(0);
      expect(searchCalls[0].context).toBeUndefined();

      // Deep research
      await handleResearchCommand(['deep', 'deep topic']);
      const deepCalls = mockResearchCalls.filter(c => c.query === 'deep topic');
      expect(deepCalls.length).toBeGreaterThan(0);
      expect(deepCalls[0].context).toBe('comprehensive detailed research');

      // Cache stats - just verify it doesn't throw
      await handleResearchCommand(['cache']);
      
      const calls = mockConsoleLog.mock.calls;
      const allOutput = calls.map(call => String(call[0])).join(' ');
      expect(allOutput).toContain('Cache Stats');
    });

    it('should process different query types correctly', async () => {
      // Test various query formats
      const queries = [
        ['search', 'simple query'],
        ['search', 'query with "quotes"'],
        ['deep', 'complex query with multiple words'],
      ];

      for (const queryArgs of queries) {
        mockResearchCalls.length = 0;
        await handleResearchCommand(queryArgs);
        expect(mockResearchCalls.length).toBeGreaterThan(0);
      }
    });
  });
});
