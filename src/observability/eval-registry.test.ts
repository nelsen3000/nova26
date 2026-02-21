// Eval Registry and Scoring Tests
// Comprehensive test suite for Task K8

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EvalRegistry,
  getEvalRegistry,
  resetEvalRegistry,
  SuiteNotFoundError,
  DuplicateSuiteError,
} from './eval-registry.js';
import {
  exactMatch,
  fuzzyMatch,
  containsMatch,
  jsonMatch,
  semanticSimilarity,
  codeMatch,
  compositeScore,
  getScorer,
  listScorers,
  hasScorer,
  registerScorer,
} from './scoring.js';
import type { EvalCase, EvalSuite } from './types.js';

describe('EvalRegistry', () => {
  let registry: EvalRegistry;

  const createCase = (id: string, name: string): EvalCase => ({
    id,
    name,
    input: 'test input',
    expectedOutput: 'test output',
    tags: ['test'],
  });

  beforeEach(() => {
    registry = new EvalRegistry();
  });

  describe('registerSuite', () => {
    it('registers a new suite', () => {
      const suite = registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [createCase('c1', 'Case 1')],
      });

      expect(suite.id).toBe('suite-1');
      expect(suite.name).toBe('Test Suite');
      expect(suite.createdAt).toBeDefined();
    });

    it('throws on duplicate suite', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      expect(() =>
        registry.registerSuite({
          id: 'suite-1',
          name: 'Another Suite',
          cases: [],
        })
      ).toThrow(DuplicateSuiteError);
    });
  });

  describe('getSuite', () => {
    it('returns suite by id', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      const suite = registry.getSuite('suite-1');
      expect(suite).toBeDefined();
      expect(suite?.name).toBe('Test Suite');
    });

    it('returns undefined for unknown suite', () => {
      const suite = registry.getSuite('unknown');
      expect(suite).toBeUndefined();
    });
  });

  describe('getSuiteOrThrow', () => {
    it('returns suite if exists', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      const suite = registry.getSuiteOrThrow('suite-1');
      expect(suite.id).toBe('suite-1');
    });

    it('throws if suite not found', () => {
      expect(() => registry.getSuiteOrThrow('unknown')).toThrow(SuiteNotFoundError);
    });
  });

  describe('listSuites', () => {
    it('returns empty array when no suites', () => {
      expect(registry.listSuites()).toHaveLength(0);
    });

    it('returns all suites sorted by updatedAt', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Suite 1',
        cases: [],
      });
      registry.registerSuite({
        id: 'suite-2',
        name: 'Suite 2',
        cases: [],
      });

      const suites = registry.listSuites();
      expect(suites).toHaveLength(2);
    });
  });

  describe('listSuitesByFilter', () => {
    it('filters by tags', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Suite 1',
        cases: [],
        tags: ['tag-a'],
      });
      registry.registerSuite({
        id: 'suite-2',
        name: 'Suite 2',
        cases: [],
        tags: ['tag-b'],
      });

      const suites = registry.listSuitesByFilter({ tags: ['tag-a'] });
      expect(suites).toHaveLength(1);
      expect(suites[0].id).toBe('suite-1');
    });

    it('filters by scoring function', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Suite 1',
        cases: [],
        scoringFunction: 'exactMatch',
      });
      registry.registerSuite({
        id: 'suite-2',
        name: 'Suite 2',
        cases: [],
        scoringFunction: 'fuzzyMatch',
      });

      const suites = registry.listSuitesByFilter({ scoringFunction: 'exactMatch' });
      expect(suites).toHaveLength(1);
    });
  });

  describe('removeSuite', () => {
    it('removes existing suite', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      expect(registry.removeSuite('suite-1')).toBe(true);
      expect(registry.getSuite('suite-1')).toBeUndefined();
    });

    it('returns false for non-existent suite', () => {
      expect(registry.removeSuite('unknown')).toBe(false);
    });
  });

  describe('updateSuite', () => {
    it('updates suite fields', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Original Name',
        cases: [],
      });

      const updated = registry.updateSuite('suite-1', { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('updates timestamp', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      const before = registry.getSuite('suite-1')?.updatedAt;
      const updated = registry.updateSuite('suite-1', { name: 'New Name' });

      expect(updated.updatedAt).not.toBe(before);
    });
  });

  describe('addCase', () => {
    it('adds case to suite', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      const newCase = createCase('c1', 'New Case');
      const updated = registry.addCase('suite-1', newCase);

      expect(updated.cases).toHaveLength(1);
      expect(updated.cases[0].id).toBe('c1');
    });

    it('throws on duplicate case id', () => {
      const case1 = createCase('c1', 'Case 1');
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [case1],
      });

      expect(() => registry.addCase('suite-1', case1)).toThrow('already exists');
    });
  });

  describe('removeCase', () => {
    it('removes case from suite', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [createCase('c1', 'Case 1'), createCase('c2', 'Case 2')],
      });

      const updated = registry.removeCase('suite-1', 'c1');
      expect(updated.cases).toHaveLength(1);
      expect(updated.cases[0].id).toBe('c2');
    });

    it('throws if case not found', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [],
      });

      expect(() => registry.removeCase('suite-1', 'c1')).toThrow('not found');
    });
  });

  describe('updateCase', () => {
    it('updates case fields', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Test Suite',
        cases: [createCase('c1', 'Case 1')],
      });

      const updated = registry.updateCase('suite-1', 'c1', { name: 'Updated Name' });
      expect(updated.cases[0].name).toBe('Updated Name');
    });
  });

  describe('getAllTags', () => {
    it('returns unique tags across all suites', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Suite 1',
        cases: [],
        tags: ['tag-a', 'tag-b'],
      });
      registry.registerSuite({
        id: 'suite-2',
        name: 'Suite 2',
        cases: [],
        tags: ['tag-b', 'tag-c'],
      });

      const tags = registry.getAllTags();
      expect(tags).toContain('tag-a');
      expect(tags).toContain('tag-b');
      expect(tags).toContain('tag-c');
      expect(tags).toHaveLength(3);
    });
  });

  describe('getScoringFunctions', () => {
    it('returns unique scoring functions', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Suite 1',
        cases: [],
        scoringFunction: 'exactMatch',
      });
      registry.registerSuite({
        id: 'suite-2',
        name: 'Suite 2',
        cases: [],
        scoringFunction: 'fuzzyMatch',
      });

      const functions = registry.getScoringFunctions();
      expect(functions).toContain('exactMatch');
      expect(functions).toContain('fuzzyMatch');
    });
  });

  describe('count and clear', () => {
    it('counts suites correctly', () => {
      expect(registry.count()).toBe(0);

      registry.registerSuite({
        id: 'suite-1',
        name: 'Suite 1',
        cases: [],
      });

      expect(registry.count()).toBe(1);
    });

    it('clears all suites', () => {
      registry.registerSuite({
        id: 'suite-1',
        name: 'Suite 1',
        cases: [],
      });

      registry.clear();
      expect(registry.count()).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scoring Functions Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scoring Functions', () => {
  describe('exactMatch', () => {
    it('returns 1 for exact string match', () => {
      expect(exactMatch('hello', 'hello')).toBe(1);
    });

    it('returns 0 for non-match', () => {
      expect(exactMatch('hello', 'world')).toBe(0);
    });

    it('handles null values', () => {
      expect(exactMatch(null, null)).toBe(1);
      expect(exactMatch(null, 'value')).toBe(0);
    });

    it('handles object equality', () => {
      expect(exactMatch({ a: 1 }, { a: 1 })).toBe(1);
      expect(exactMatch({ a: 1 }, { a: 2 })).toBe(0);
    });
  });

  describe('fuzzyMatch', () => {
    it('returns 1 for exact match', () => {
      expect(fuzzyMatch('hello', 'hello')).toBe(1);
    });

    it('returns high score for similar strings', () => {
      const score = fuzzyMatch('hello', 'hallo');
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThan(1);
    });

    it('handles case insensitive matching', () => {
      expect(fuzzyMatch('HELLO', 'hello', { caseSensitive: false })).toBe(1);
    });

    it('handles null values gracefully', () => {
      expect(fuzzyMatch(null, 'hello')).toBe(0);
    });

    it('calculates levenshtein correctly', () => {
      // "kitten" -> "sitting" has distance 3
      const score = fuzzyMatch('kitten', 'sitting');
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('containsMatch', () => {
    it('returns 1 when actual contains expected', () => {
      expect(containsMatch('hello world', 'world')).toBe(1);
    });

    it('returns 0 when not contained', () => {
      expect(containsMatch('hello world', 'foo')).toBe(0);
    });

    it('handles case insensitive', () => {
      expect(containsMatch('HELLO WORLD', 'hello', { caseSensitive: false })).toBe(1);
    });

    it('handles null values', () => {
      expect(containsMatch(null, 'test')).toBe(0);
    });
  });

  describe('jsonMatch', () => {
    it('matches exact JSON objects', () => {
      expect(jsonMatch('{"a":1}', '{"a":1}')).toBe(1);
    });

    it('matches partial objects', () => {
      expect(jsonMatch('{"a":1,"b":2}', '{"a":1}')).toBe(1);
    });

    it('returns 0 when key missing', () => {
      expect(jsonMatch('{"a":1}', '{"b":2}')).toBe(0);
    });

    it('handles invalid JSON', () => {
      expect(jsonMatch('not json', '{}')).toBe(0);
    });

    it('matches nested partial objects', () => {
      expect(jsonMatch('{"a":{"b":1,"c":2}}', '{"a":{"b":1}}')).toBe(1);
    });
  });

  describe('semanticSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(semanticSimilarity('hello world', 'hello world')).toBe(1);
    });

    it('returns high score for similar meaning', () => {
      const score = semanticSimilarity(
        'the quick brown fox',
        'the fast brown fox'
      );
      expect(score).toBeGreaterThan(0.5);
    });

    it('returns low score for different content', () => {
      const score = semanticSimilarity('hello', 'goodbye world');
      expect(score).toBeLessThan(0.5);
    });

    it('handles null values', () => {
      expect(semanticSimilarity(null, 'test')).toBe(0);
    });
  });

  describe('codeMatch', () => {
    it('matches identical code', () => {
      expect(codeMatch('const x = 1;', 'const x = 1;')).toBe(1);
    });

    it('ignores comments', () => {
      expect(codeMatch('const x = 1; // comment', 'const x = 1;')).toBe(1);
    });

    it('ignores extra whitespace', () => {
      expect(codeMatch('const   x   =   1;', 'const x = 1;')).toBe(1);
    });

    it('returns 0 for different code', () => {
      expect(codeMatch('const x = 1;', 'const y = 2;')).toBe(0);
    });
  });

  describe('compositeScore', () => {
    it('combines multiple scorers', () => {
      const methods = [
        { method: 'exactMatch', weight: 0.5 },
        { method: 'fuzzyMatch', weight: 0.5 },
      ];

      const score = compositeScore('hello', 'hello', methods);
      expect(score).toBe(1);
    });

    it('weights scorers correctly', () => {
      const methods = [
        { method: 'exactMatch', weight: 1.0 },
        { method: 'fuzzyMatch', weight: 0.0 },
      ];

      const score = compositeScore('hello', 'hello', methods);
      expect(score).toBe(1);
    });

    it('returns 0 for empty methods', () => {
      expect(compositeScore('a', 'b', [])).toBe(0);
    });
  });

  describe('scorer registry', () => {
    it('lists all built-in scorers', () => {
      const scorers = listScorers();
      expect(scorers).toContain('exactMatch');
      expect(scorers).toContain('fuzzyMatch');
      expect(scorers).toContain('semanticSimilarity');
    });

    it('gets scorer by name', () => {
      expect(getScorer('exactMatch')).toBeDefined();
      expect(getScorer('unknown')).toBeUndefined();
    });

    it('checks if scorer exists', () => {
      expect(hasScorer('exactMatch')).toBe(true);
      expect(hasScorer('unknown')).toBe(false);
    });

    it('allows registering custom scorer', () => {
      const customScorer = () => 0.5;
      registerScorer('custom', customScorer);

      expect(hasScorer('custom')).toBe(true);
      expect(getScorer('custom')).toBe(customScorer);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('EvalRegistry singleton', () => {
  beforeEach(() => {
    resetEvalRegistry();
  });

  it('getEvalRegistry returns singleton', () => {
    const r1 = getEvalRegistry();
    const r2 = getEvalRegistry();
    expect(r1).toBe(r2);
  });

  it('resetEvalRegistry creates new instance', () => {
    const r1 = getEvalRegistry();
    resetEvalRegistry();
    const r2 = getEvalRegistry();
    expect(r1).not.toBe(r2);
  });
});
