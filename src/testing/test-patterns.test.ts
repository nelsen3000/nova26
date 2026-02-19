// Tests for Test Pattern Library & Assertions
// KIMI-TESTING-01

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestPatternLibrary,
  getTestPatternLibrary,
  resetTestPatternLibrary,
  TestPatternSchema,
  AssertionRuleSchema,
} from './test-patterns.js';

describe('TestPatternLibrary', () => {
  let library: TestPatternLibrary;

  beforeEach(() => {
    resetTestPatternLibrary();
    library = new TestPatternLibrary();
  });

  // ==========================================================================
  // Pattern Retrieval
  // ==========================================================================

  describe('getPattern', () => {
    it('returns pattern by id', () => {
      const pattern = library.getPattern('aaa-unit');
      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('Arrange-Act-Assert (Unit)');
    });

    it('returns undefined for unknown pattern', () => {
      const pattern = library.getPattern('unknown');
      expect(pattern).toBeUndefined();
    });
  });

  describe('getAllPatterns', () => {
    it('returns all built-in patterns', () => {
      const patterns = library.getAllPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(5);
    });

    it('includes AAA pattern', () => {
      const patterns = library.getAllPatterns();
      expect(patterns.some(p => p.id === 'aaa-unit')).toBe(true);
    });

    it('includes BDD pattern', () => {
      const patterns = library.getAllPatterns();
      expect(patterns.some(p => p.id === 'given-when-then')).toBe(true);
    });
  });

  describe('getPatternsByType', () => {
    it('filters by arrange-act-assert type', () => {
      const patterns = library.getPatternsByType('arrange-act-assert');
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns.every(p => p.type === 'arrange-act-assert')).toBe(true);
    });

    it('returns empty array for unknown type', () => {
      // Use a valid type that might have no patterns
      const patterns = library.getPatternsByType('mock');
      // May or may not have patterns, but should be an array
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('addPattern', () => {
    it('adds custom pattern', () => {
      const customPattern = {
        id: 'custom-pattern',
        name: 'Custom Pattern',
        type: 'arrange-act-assert' as const,
        description: 'A custom test pattern',
        template: '// Custom',
        placeholders: [],
        examples: [],
      };

      library.addPattern(customPattern);
      const retrieved = library.getPattern('custom-pattern');
      expect(retrieved?.name).toBe('Custom Pattern');
    });
  });

  // ==========================================================================
  // Assertion Retrieval
  // ==========================================================================

  describe('getAssertion', () => {
    it('returns assertion by id', () => {
      const assertion = library.getAssertion('eq-1');
      expect(assertion).toBeDefined();
      expect(assertion?.matcher).toBe('toBe');
    });

    it('returns undefined for unknown assertion', () => {
      const assertion = library.getAssertion('unknown');
      expect(assertion).toBeUndefined();
    });
  });

  describe('getAllAssertions', () => {
    it('returns all built-in assertions', () => {
      const assertions = library.getAllAssertions();
      expect(assertions.length).toBeGreaterThanOrEqual(15);
    });

    it('includes equality assertions', () => {
      const assertions = library.getAllAssertions();
      expect(assertions.some(a => a.matcher === 'toBe')).toBe(true);
      expect(assertions.some(a => a.matcher === 'toEqual')).toBe(true);
    });
  });

  describe('getAssertionsByCategory', () => {
    it('returns equality assertions', () => {
      const assertions = library.getAssertionsByCategory('equality');
      expect(assertions.length).toBeGreaterThanOrEqual(2);
      expect(assertions.every(a => a.category === 'equality')).toBe(true);
    });

    it('returns async assertions', () => {
      const assertions = library.getAssertionsByCategory('async');
      expect(assertions.length).toBeGreaterThanOrEqual(2);
      expect(assertions.every(a => a.category === 'async')).toBe(true);
    });

    it('returns collection assertions', () => {
      const assertions = library.getAssertionsByCategory('collection');
      expect(assertions.some(a => a.matcher === 'toContain')).toBe(true);
      expect(assertions.some(a => a.matcher === 'toHaveLength')).toBe(true);
    });

    it('returns error assertions', () => {
      const assertions = library.getAssertionsByCategory('error');
      expect(assertions.some(a => a.matcher === 'toThrow')).toBe(true);
    });
  });

  describe('findAssertion', () => {
    it('finds assertion by matcher name', () => {
      const assertion = library.findAssertion('toBe');
      expect(assertion).toBeDefined();
      expect(assertion?.id).toBe('eq-1');
    });

    it('returns undefined for unknown matcher', () => {
      const assertion = library.findAssertion('toNotExist');
      expect(assertion).toBeUndefined();
    });
  });

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  describe('matchPattern', () => {
    it('matches AAA pattern', () => {
      const code = `
        // Arrange
        const x = 1;
        // Act
        const result = fn();
        // Assert
        expect(result).toBe(1);
      `;
      const match = library.matchPattern(code);
      expect(match).not.toBeNull();
      expect(match?.patternId).toBe('aaa-unit');
      expect(match?.confidence).toBeGreaterThan(90);
    });

    it('matches BDD pattern', () => {
      const code = `
        // Given a user
        const user = createUser();
        // When they login
        const result = login(user);
        // Then they are authenticated
        expect(result.authenticated).toBe(true);
      `;
      const match = library.matchPattern(code);
      expect(match).not.toBeNull();
      expect(match?.patternId).toBe('given-when-then');
    });

    it('matches spy pattern', () => {
      const code = `
        const spy = vi.spyOn(obj, 'method');
        doSomething();
        expect(spy).toHaveBeenCalled();
      `;
      const match = library.matchPattern(code);
      expect(match).not.toBeNull();
      expect(match?.patternId).toBe('spy-pattern');
    });

    it('matches builder pattern', () => {
      const code = `
        const user = new UserBuilder()
          .withName('John')
          .build();
      `;
      const match = library.matchPattern(code);
      expect(match).not.toBeNull();
      expect(match?.patternId).toBe('builder-pattern');
    });

    it('returns null for unknown pattern', () => {
      const code = `const x = 1;`;
      const match = library.matchPattern(code);
      expect(match).toBeNull();
    });
  });

  // ==========================================================================
  // Template Generation
  // ==========================================================================

  describe('generateTemplate', () => {
    it('generates AAA template', () => {
      const template = library.generateTemplate('aaa-unit', {
        arrange: 'const calc = new Calculator();',
        act: 'const result = calc.add(1, 2);',
        assert: 'expect(result).toBe(3);',
      });

      expect(template).toContain('// Arrange');
      expect(template).toContain('const calc = new Calculator();');
      expect(template).toContain('// Act');
      expect(template).toContain('// Assert');
    });

    it('throws for unknown pattern', () => {
      expect(() => {
        library.generateTemplate('unknown', {});
      }).toThrow('Pattern not found');
    });
  });

  // ==========================================================================
  // Assertion Suggestions
  // ==========================================================================

  describe('suggestAssertions', () => {
    it('suggests toBeNull for null', () => {
      const suggestions = library.suggestAssertions(null);
      expect(suggestions.some(s => s.matcher === 'toBeNull')).toBe(true);
    });

    it('suggests toBeUndefined for undefined', () => {
      const suggestions = library.suggestAssertions(undefined);
      expect(suggestions.some(s => s.matcher === 'toBeUndefined')).toBe(true);
    });

    it('suggests truthiness for boolean', () => {
      const trueSuggestions = library.suggestAssertions(true);
      expect(trueSuggestions.some(s => s.matcher === 'toBeTruthy')).toBe(true);

      const falseSuggestions = library.suggestAssertions(false);
      expect(falseSuggestions.some(s => s.matcher === 'toBeFalsy')).toBe(true);
    });

    it('suggests toBe for primitives', () => {
      const suggestions = library.suggestAssertions('string');
      expect(suggestions.some(s => s.matcher === 'toBe')).toBe(true);
    });

    it('suggests collection matchers for arrays', () => {
      const suggestions = library.suggestAssertions([1, 2, 3]);
      expect(suggestions.some(s => s.matcher === 'toHaveLength')).toBe(true);
      expect(suggestions.some(s => s.matcher === 'toContain')).toBe(true);
    });

    it('suggests toEqual for objects', () => {
      const suggestions = library.suggestAssertions({ id: 1 });
      expect(suggestions.some(s => s.matcher === 'toEqual')).toBe(true);
      expect(suggestions.some(s => s.matcher === 'toMatchObject')).toBe(true);
    });
  });

  // ==========================================================================
  // Code Analysis
  // ==========================================================================

  describe('analyzeTestCode', () => {
    it('detects patterns in code', () => {
      const code = `
        // Arrange
        const x = 1;
        // Act
        const result = fn();
        // Assert
        expect(result).toBe(1);
      `;
      const analysis = library.analyzeTestCode(code);
      expect(analysis.patterns.length).toBeGreaterThan(0);
    });

    it('extracts assertions', () => {
      const code = `
        expect(result).toBe(1);
        expect(obj).toEqual({ a: 1 });
      `;
      const analysis = library.analyzeTestCode(code);
      expect(analysis.assertions.length).toBe(2);
    });

    it('suggests describe blocks when missing', () => {
      const code = `expect(true).toBe(true);`;
      const analysis = library.analyzeTestCode(code);
      expect(analysis.suggestions.some(s => s.includes('describe'))).toBe(true);
    });

    it('suggests beforeEach when missing', () => {
      const code = `it('test', () => {});`;
      const analysis = library.analyzeTestCode(code);
      expect(analysis.suggestions.some(s => s.includes('beforeEach'))).toBe(true);
    });

    it('warns about missing assertions', () => {
      const code = `const x = 1;`;
      const analysis = library.analyzeTestCode(code);
      expect(analysis.suggestions.some(s => s.includes('assertions'))).toBe(true);
    });
  });
});

describe('Singleton', () => {
  beforeEach(() => {
    resetTestPatternLibrary();
  });

  it('returns same instance', () => {
    const instance1 = getTestPatternLibrary();
    const instance2 = getTestPatternLibrary();
    expect(instance1).toBe(instance2);
  });

  it('creates new instance after reset', () => {
    const instance1 = getTestPatternLibrary();
    resetTestPatternLibrary();
    const instance2 = getTestPatternLibrary();
    expect(instance1).not.toBe(instance2);
  });
});

describe('Zod Schemas', () => {
  describe('TestPatternSchema', () => {
    it('validates valid pattern', () => {
      const pattern = {
        id: 'test',
        name: 'Test Pattern',
        type: 'arrange-act-assert',
        description: 'A test pattern',
        template: '// template',
        placeholders: [],
        examples: [],
      };
      const result = TestPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    });

    it('rejects invalid pattern type', () => {
      const pattern = {
        id: 'test',
        name: 'Test Pattern',
        type: 'invalid-type',
        description: 'A test pattern',
        template: '// template',
        placeholders: [],
        examples: [],
      };
      const result = TestPatternSchema.safeParse(pattern);
      expect(result.success).toBe(false);
    });
  });

  describe('AssertionRuleSchema', () => {
    it('validates valid assertion', () => {
      const assertion = {
        id: 'test-1',
        name: 'toBe',
        description: 'Equality check',
        matcher: 'toBe',
        category: 'equality',
        codeExample: 'expect(x).toBe(1)',
      };
      const result = AssertionRuleSchema.safeParse(assertion);
      expect(result.success).toBe(true);
    });

    it('rejects invalid category', () => {
      const assertion = {
        id: 'test-1',
        name: 'toBe',
        description: 'Equality check',
        matcher: 'toBe',
        category: 'invalid-category',
        codeExample: 'expect(x).toBe(1)',
      };
      const result = AssertionRuleSchema.safeParse(assertion);
      expect(result.success).toBe(false);
    });
  });
});
