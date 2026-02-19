// Test Pattern Library & Assertions
// KIMI-TESTING-01: R16-04 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type PatternType = 
  | 'arrange-act-assert' 
  | 'given-when-then' 
  | 'setup-exercise-verify'
  | 'builder' 
  | 'factory' 
  | 'spy'
  | 'mock';

export type AssertionStyle = 'expect' | 'assert' | 'should' | 'verify';

export interface TestPattern {
  id: string;
  name: string;
  type: PatternType;
  description: string;
  template: string;
  placeholders: string[];
  examples: string[];
}

export interface AssertionRule {
  id: string;
  name: string;
  description: string;
  matcher: string;
  category: 'equality' | 'truthiness' | 'type' | 'collection' | 'async' | 'error';
  codeExample: string;
}

export interface PatternMatchResult {
  patternId: string;
  confidence: number; // 0-100
  matchedPlaceholders: Record<string, string>;
  suggestions: string[];
}

export interface TestTemplate {
  id: string;
  name: string;
  pattern: PatternType;
  template: string;
  imports: string[];
  setupCode?: string;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const TestPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['arrange-act-assert', 'given-when-then', 'setup-exercise-verify', 'builder', 'factory', 'spy', 'mock']),
  description: z.string(),
  template: z.string(),
  placeholders: z.array(z.string()),
  examples: z.array(z.string()),
});

export const AssertionRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  matcher: z.string(),
  category: z.enum(['equality', 'truthiness', 'type', 'collection', 'async', 'error']),
  codeExample: z.string(),
});

// ============================================================================
// Pattern Library
// ============================================================================

const PATTERNS: TestPattern[] = [
  {
    id: 'aaa-unit',
    name: 'Arrange-Act-Assert (Unit)',
    type: 'arrange-act-assert',
    description: 'Classic unit test pattern with three distinct phases',
    template: `// Arrange
{arrange}

// Act
{act}

// Assert
{assert}`,
    placeholders: ['arrange', 'act', 'assert'],
    examples: [
      `// Arrange
const calculator = new Calculator();

// Act
const result = calculator.add(2, 3);

// Assert
expect(result).toBe(5);`,
    ],
  },
  {
    id: 'given-when-then',
    name: 'Given-When-Then (BDD)',
    type: 'given-when-then',
    description: 'Behavior-driven development pattern for describing scenarios',
    template: `// Given {context}
{given}

// When {event}
{when}

// Then {outcome}
{then}`,
    placeholders: ['context', 'given', 'event', 'when', 'outcome', 'then'],
    examples: [
      `// Given a logged-in user
const user = await createUser({ role: 'admin' });

// When they access the admin panel
const result = await accessAdminPanel(user);

// Then they should see the dashboard
expect(result.dashboardVisible).toBe(true);`,
    ],
  },
  {
    id: 'builder-pattern',
    name: 'Test Data Builder',
    type: 'builder',
    description: 'Builder pattern for creating test data with defaults',
    template: `const {variable} = new {BuilderClass}()
  .with{Property1}({value1})
  .with{Property2}({value2})
  .build();`,
    placeholders: ['variable', 'BuilderClass', 'Property1', 'value1', 'Property2', 'value2'],
    examples: [
      `const user = new UserBuilder()
  .withName('John')
  .withEmail('john@example.com')
  .withRole('admin')
  .build();`,
    ],
  },
  {
    id: 'factory-pattern',
    name: 'Test Data Factory',
    type: 'factory',
    description: 'Factory pattern for creating test data with traits',
    template: `const {variable} = await {factoryName}({
  traits: [{traits}],
  overrides: { overrides },
});`,
    placeholders: ['variable', 'factoryName', 'traits', 'overrides'],
    examples: [
      `const user = await userFactory({
  traits: ['admin', 'verified'],
  overrides: { name: 'Custom Name' },
});`,
    ],
  },
  {
    id: 'spy-pattern',
    name: 'Function Spy',
    type: 'spy',
    description: 'Spy pattern for tracking function calls',
    template: `const spy = vi.spyOn({object}, '{method}');
{action}
expect(spy).toHaveBeenCalledWith({expectedArgs});
expect(spy).toHaveBeenCalledTimes({times});`,
    placeholders: ['object', 'method', 'action', 'expectedArgs', 'times'],
    examples: [
      `const spy = vi.spyOn(console, 'log');
logger.info('test message');
expect(spy).toHaveBeenCalledWith('test message');
expect(spy).toHaveBeenCalledTimes(1);`,
    ],
  },
];

// ============================================================================
// Assertion Library
// ============================================================================

const ASSERTION_RULES: AssertionRule[] = [
  // Equality
  { id: 'eq-1', name: 'toBe', description: 'Strict equality (===)', matcher: 'toBe', category: 'equality', codeExample: 'expect(value).toBe(expected)' },
  { id: 'eq-2', name: 'toEqual', description: 'Deep equality for objects', matcher: 'toEqual', category: 'equality', codeExample: 'expect(obj).toEqual({ a: 1 })' },
  { id: 'eq-3', name: 'toStrictEqual', description: 'Strict deep equality', matcher: 'toStrictEqual', category: 'equality', codeExample: 'expect(obj).toStrictEqual({ a: 1 })' },
  
  // Truthiness
  { id: 'truth-1', name: 'toBeTruthy', description: 'Value is truthy', matcher: 'toBeTruthy', category: 'truthiness', codeExample: 'expect(value).toBeTruthy()' },
  { id: 'truth-2', name: 'toBeFalsy', description: 'Value is falsy', matcher: 'toBeFalsy', category: 'truthiness', codeExample: 'expect(value).toBeFalsy()' },
  { id: 'truth-3', name: 'toBeNull', description: 'Value is null', matcher: 'toBeNull', category: 'truthiness', codeExample: 'expect(value).toBeNull()' },
  { id: 'truth-4', name: 'toBeUndefined', description: 'Value is undefined', matcher: 'toBeUndefined', category: 'truthiness', codeExample: 'expect(value).toBeUndefined()' },
  { id: 'truth-5', name: 'toBeDefined', description: 'Value is defined', matcher: 'toBeDefined', category: 'truthiness', codeExample: 'expect(value).toBeDefined()' },
  
  // Type
  { id: 'type-1', name: 'toBeInstanceOf', description: 'Instance of class', matcher: 'toBeInstanceOf', category: 'type', codeExample: 'expect(obj).toBeInstanceOf(MyClass)' },
  { id: 'type-2', name: 'toBeTypeOf', description: 'Type of value', matcher: 'toBeTypeOf', category: 'type', codeExample: 'expect(value).toBeTypeOf("string")' },
  { id: 'type-3', name: 'toMatchObject', description: 'Object matches shape', matcher: 'toMatchObject', category: 'type', codeExample: 'expect(obj).toMatchObject({ id: expect.any(String) })' },
  
  // Collection
  { id: 'coll-1', name: 'toContain', description: 'Array contains item', matcher: 'toContain', category: 'collection', codeExample: 'expect(arr).toContain(item)' },
  { id: 'coll-2', name: 'toHaveLength', description: 'Array/string length', matcher: 'toHaveLength', category: 'collection', codeExample: 'expect(arr).toHaveLength(3)' },
  { id: 'coll-3', name: 'toContainEqual', description: 'Array contains equal item', matcher: 'toContainEqual', category: 'collection', codeExample: 'expect(arr).toContainEqual({ id: 1 })' },
  
  // Async
  { id: 'async-1', name: 'resolves', description: 'Promise resolves', matcher: 'resolves', category: 'async', codeExample: 'await expect(promise).resolves.toBe(value)' },
  { id: 'async-2', name: 'rejects', description: 'Promise rejects', matcher: 'rejects', category: 'async', codeExample: 'await expect(promise).rejects.toThrow()' },
  { id: 'async-3', name: 'resolves.toEqual', description: 'Promise resolves to value', matcher: 'resolves.toEqual', category: 'async', codeExample: 'await expect(promise).resolves.toEqual(expected)' },
  
  // Error
  { id: 'err-1', name: 'toThrow', description: 'Function throws', matcher: 'toThrow', category: 'error', codeExample: 'expect(fn).toThrow()' },
  { id: 'err-2', name: 'toThrowError', description: 'Throws specific error', matcher: 'toThrowError', category: 'error', codeExample: 'expect(fn).toThrowError("message")' },
];

// ============================================================================
// TestPatternLibrary Class
// ============================================================================

export class TestPatternLibrary {
  private patterns: Map<string, TestPattern> = new Map();
  private assertions: Map<string, AssertionRule> = new Map();

  constructor() {
    // Initialize with built-in patterns
    PATTERNS.forEach(p => this.patterns.set(p.id, p));
    ASSERTION_RULES.forEach(a => this.assertions.set(a.id, a));
  }

  // ---- Pattern Methods ----

  getPattern(id: string): TestPattern | undefined {
    return this.patterns.get(id);
  }

  getAllPatterns(): TestPattern[] {
    return Array.from(this.patterns.values());
  }

  getPatternsByType(type: PatternType): TestPattern[] {
    return this.getAllPatterns().filter(p => p.type === type);
  }

  addPattern(pattern: TestPattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  // ---- Assertion Methods ----

  getAssertion(id: string): AssertionRule | undefined {
    return this.assertions.get(id);
  }

  getAllAssertions(): AssertionRule[] {
    return Array.from(this.assertions.values());
  }

  getAssertionsByCategory(category: AssertionRule['category']): AssertionRule[] {
    return this.getAllAssertions().filter(a => a.category === category);
  }

  findAssertion(matcher: string): AssertionRule | undefined {
    return this.getAllAssertions().find(a => a.matcher === matcher);
  }

  // ---- Pattern Matching ----

  matchPattern(testCode: string): PatternMatchResult | null {
    // Simple heuristic matching
    if (testCode.includes('// Arrange') && testCode.includes('// Act') && testCode.includes('// Assert')) {
      return {
        patternId: 'aaa-unit',
        confidence: 95,
        matchedPlaceholders: {},
        suggestions: ['Pattern is well-formed AAA'],
      };
    }

    if (testCode.includes('// Given') && testCode.includes('// When') && testCode.includes('// Then')) {
      return {
        patternId: 'given-when-then',
        confidence: 95,
        matchedPlaceholders: {},
        suggestions: ['Pattern is well-formed BDD'],
      };
    }

    if (testCode.includes('vi.spyOn')) {
      return {
        patternId: 'spy-pattern',
        confidence: 90,
        matchedPlaceholders: {},
        suggestions: ['Consider adding toHaveBeenCalledTimes assertion'],
      };
    }

    if (testCode.includes('Builder()') || testCode.includes('.build()')) {
      return {
        patternId: 'builder-pattern',
        confidence: 85,
        matchedPlaceholders: {},
        suggestions: ['Consider using factory for simpler cases'],
      };
    }

    return null;
  }

  // ---- Template Generation ----

  generateTemplate(patternId: string, values: Record<string, string>): string {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    let template = pattern.template;
    for (const [key, value] of Object.entries(values)) {
      template = template.replaceAll(`{${key}}`, value);
    }

    return template;
  }

  // ---- Assertion Suggestions ----

  suggestAssertions(value: unknown): AssertionRule[] {
    const suggestions: AssertionRule[] = [];

    if (value === null) {
      suggestions.push(this.assertions.get('truth-3')!); // toBeNull
    } else if (value === undefined) {
      suggestions.push(this.assertions.get('truth-4')!); // toBeUndefined
    } else if (typeof value === 'boolean') {
      suggestions.push(this.assertions.get(value ? 'truth-1' : 'truth-2')!);
    } else if (typeof value === 'string' || typeof value === 'number') {
      suggestions.push(this.assertions.get('eq-1')!); // toBe
    } else if (Array.isArray(value)) {
      suggestions.push(this.assertions.get('coll-2')!); // toHaveLength
      suggestions.push(this.assertions.get('coll-1')!); // toContain
    } else if (typeof value === 'object') {
      suggestions.push(this.assertions.get('eq-2')!); // toEqual
      suggestions.push(this.assertions.get('type-3')!); // toMatchObject
    }

    return suggestions.filter(Boolean);
  }

  // ---- Code Analysis ----

  analyzeTestCode(testCode: string): {
    patterns: PatternMatchResult[];
    assertions: string[];
    suggestions: string[];
  } {
    const patterns: PatternMatchResult[] = [];
    const assertions: string[] = [];
    const suggestions: string[] = [];

    // Detect pattern
    const matched = this.matchPattern(testCode);
    if (matched) {
      patterns.push(matched);
    }

    // Extract assertions
    const assertionMatches = testCode.match(/expect\([^)]+\)\.[\w.]+/g) || [];
    assertions.push(...assertionMatches);

    // Provide suggestions
    if (!testCode.includes('describe')) {
      suggestions.push('Consider wrapping tests in describe blocks');
    }
    if (!testCode.includes('beforeEach')) {
      suggestions.push('Consider using beforeEach for common setup');
    }
    if (assertions.length === 0) {
      suggestions.push('No assertions detected - add expect() calls');
    }

    return { patterns, assertions, suggestions };
  }
}

// Singleton instance
let libraryInstance: TestPatternLibrary | null = null;

export function getTestPatternLibrary(): TestPatternLibrary {
  if (!libraryInstance) {
    libraryInstance = new TestPatternLibrary();
  }
  return libraryInstance;
}

export function resetTestPatternLibrary(): void {
  libraryInstance = null;
}
