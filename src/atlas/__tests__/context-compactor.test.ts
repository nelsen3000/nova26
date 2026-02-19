// Context Compactor Tests — R19-02

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextCompactor, createContextCompactor } from '../context-compactor.js';
import type { ContextModule } from '../context-compactor.js';

describe('ContextCompactor', () => {
  let compactor: ContextCompactor;

  beforeEach(() => {
    compactor = new ContextCompactor(1000);
  });

  describe('estimateTokens()', () => {
    it('should estimate tokens for text', () => {
      const tokens = compactor.estimateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should scale with text length', () => {
      const short = compactor.estimateTokens('Hi');
      const long = compactor.estimateTokens('This is a much longer piece of text');
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('compact()', () => {
    it('should create compacted context', () => {
      const modules: ContextModule[] = [
        {
          name: 'auth',
          purpose: 'Authentication utilities',
          keyExports: ['login', 'logout'],
          relevanceScore: 0.9,
          tokenEstimate: 200,
        },
      ];

      const context = compactor.compact('Test project', modules, ['pattern']);

      expect(context.projectSummary).toBe('Test project');
      expect(context.keyPatterns).toContain('pattern');
      expect(context.tokenCount).toBeGreaterThan(0);
    });

    it('should include expand function', () => {
      const modules: ContextModule[] = [
        {
          name: 'auth',
          purpose: 'Authentication',
          keyExports: ['login'],
          relevanceScore: 0.9,
          tokenEstimate: 200,
        },
      ];

      const context = compactor.compact('Test', modules, []);
      expect(typeof context.expand).toBe('function');
    });

    it('should respect token budget', () => {
      const smallCompactor = new ContextCompactor(300);
      const modules: ContextModule[] = [
        { name: 'a', purpose: 'A', keyExports: [], relevanceScore: 0.9, tokenEstimate: 200 },
        { name: 'b', purpose: 'B', keyExports: [], relevanceScore: 0.8, tokenEstimate: 200 },
        { name: 'c', purpose: 'C', keyExports: [], relevanceScore: 0.7, tokenEstimate: 200 },
      ];

      const context = smallCompactor.compact('Test', modules, []);
      expect(context.relevantModules.length).toBeLessThan(3);
    });

    it('should prioritize by relevance', () => {
      const modules: ContextModule[] = [
        { name: 'low', purpose: 'Low', keyExports: [], relevanceScore: 0.3, tokenEstimate: 100 },
        { name: 'high', purpose: 'High', keyExports: [], relevanceScore: 0.9, tokenEstimate: 100 },
        { name: 'medium', purpose: 'Medium', keyExports: [], relevanceScore: 0.6, tokenEstimate: 100 },
      ];

      const context = compactor.compact('Test', modules, []);
      expect(context.relevantModules[0].name).toBe('high');
    });
  });

  describe('expandModule()', () => {
    it('should expand a module', () => {
      const modules: ContextModule[] = [
        {
          name: 'auth',
          purpose: 'Authentication',
          keyExports: ['login', 'logout'],
          relevanceScore: 0.9,
          tokenEstimate: 200,
        },
      ];

      const expanded = compactor.expandModule('auth', modules);
      expect(expanded).toContain('auth');
      expect(expanded).toContain('Authentication');
      expect(expanded).toContain('login');
    });

    it('should handle non-existent module', () => {
      const modules: ContextModule[] = [];
      const expanded = compactor.expandModule('missing', modules);
      expect(expanded).toContain('not found');
    });
  });

  describe('createFromNodes()', () => {
    it('should create context from code nodes', () => {
      const nodes = [
        {
          id: '1',
          type: 'function' as const,
          name: 'login',
          filePath: 'src/auth.ts',
          location: { line: 1, column: 0 },
          complexity: 5,
          changeFrequency: 2,
          testCoverage: 80,
          semanticTags: ['auth'],
          dependents: [],
        },
      ];

      const context = compactor.createFromNodes('MyApp', 'Test app', nodes, 'auth');
      expect(context.projectSummary).toContain('MyApp');
    });
  });

  describe('prioritizeByQuery()', () => {
    it('should prioritize matching modules', () => {
      const modules: ContextModule[] = [
        { name: 'auth', purpose: 'Auth module', keyExports: ['login'], relevanceScore: 0.5, tokenEstimate: 100 },
        { name: 'utils', purpose: 'Utilities', keyExports: ['helper'], relevanceScore: 0.5, tokenEstimate: 100 },
      ];

      const prioritized = compactor.prioritizeByQuery(modules, 'auth');
      expect(prioritized[0].name).toBe('auth');
    });

    it('should boost relevance for matches', () => {
      const modules: ContextModule[] = [
        { name: 'auth', purpose: 'Auth', keyExports: [], relevanceScore: 0.5, tokenEstimate: 100 },
      ];

      const prioritized = compactor.prioritizeByQuery(modules, 'auth');
      expect(prioritized[0].relevanceScore).toBeGreaterThan(0.5);
    });
  });

  describe('getBudgetUtilization()', () => {
    it('should calculate utilization', () => {
      const modules: ContextModule[] = [
        { name: 'a', purpose: 'A', keyExports: [], relevanceScore: 0.9, tokenEstimate: 500 },
      ];

      const context = compactor.compact('Test', modules, []);
      const utilization = compactor.getBudgetUtilization(context);

      expect(utilization.used).toBeGreaterThan(0);
      expect(utilization.total).toBe(1000);
      expect(utilization.percentage).toBeGreaterThan(0);
    });
  });

  describe('isWithinBudget()', () => {
    it('should return true for within budget', () => {
      const modules: ContextModule[] = [
        { name: 'a', purpose: 'A', keyExports: [], relevanceScore: 0.9, tokenEstimate: 100 },
      ];

      const context = compactor.compact('Test', modules, []);
      expect(compactor.isWithinBudget(context)).toBe(true);
    });
  });

  describe('createContextCompactor()', () => {
    it('should create compactor with default budget', () => {
      const compactor = createContextCompactor();
      expect(compactor).toBeInstanceOf(ContextCompactor);
    });

    it('should create compactor with custom budget', () => {
      const compactor = createContextCompactor(2000);
      expect(compactor).toBeInstanceOf(ContextCompactor);
    });
  });
});
