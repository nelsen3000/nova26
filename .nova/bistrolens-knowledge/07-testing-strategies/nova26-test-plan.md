# Nova26 Testing Strategy

## Adapted from BistroLens QA Test Suite

**Source:** BistroLens `01-QA-TEST-SUITE.md`, `testing/TESTPLAN.md`  
**Category:** Testing & Quality Assurance  
**Priority:** P2  
**Reusability:** 8/10

---

## Overview

BistroLens has a structured test plan covering:
- Unit tests with coverage thresholds
- Integration tests for workflows
- E2E tests for critical paths
- Accessibility testing
- Performance benchmarks

Nova26 has SATURN for testing but lacks a comprehensive test plan template.

---

## Test Coverage Requirements

| Level | Minimum | Target | Agent Owner |
|-------|---------|--------|-------------|
| Unit | 70% | 80% | MARS |
| Integration | 60% | 75% | GANYMEDE |
| E2E | Critical paths | All flows | SATURN |
| Accessibility | WCAG AA | WCAG AAA | SATURN + VENUS |
| Performance | Baseline | +20% faster | IO |

---

## Unit Testing Strategy

### Test Structure

```typescript
// src/utils/__tests__/example.test.ts

describe('Feature: Description', () => {
  // Setup
  beforeEach(() => {
    // Reset state
  });
  
  describe('Scenario: Happy path', () => {
    it('should [expected behavior]', () => {
      // Arrange
      const input = { /* ... */ };
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toEqual(expected);
    });
  });
  
  describe('Scenario: Error handling', () => {
    it('should throw when [condition]', () => {
      expect(() => functionUnderTest(invalidInput))
        .toThrow('Expected error message');
    });
  });
  
  describe('Scenario: Edge cases', () => {
    it('should handle empty input', () => {
      // Test empty/null/undefined
    });
    
    it('should handle maximum input', () => {
      // Test boundary values
    });
  });
});
```

### Agent-Specific Test Requirements

```typescript
// SATURN validation checklist per agent output

const AGENT_TEST_REQUIREMENTS: Record<string, string[]> = {
  VENUS: [
    'All 5 UI states tested (loading, empty, error, success, default)',
    'Responsive breakpoints verified',
    'Keyboard navigation tested',
    'Screen reader labels present',
  ],
  
  MARS: [
    'Type definitions compile without errors',
    'All functions have unit tests',
    'Error paths tested',
    'Edge cases covered',
  ],
  
  GANYMEDE: [
    'API contract tests pass',
    'Error responses handled',
    'Rate limiting tested',
    'Timeout scenarios covered',
  ],
  
  PLUTO: [
    'Schema migrations tested',
    'Index queries verified',
    'RLS policies enforced',
  ],
  
  TITAN: [
    'Subscription updates tested',
    'Optimistic updates verified',
    'Reconnection handled',
  ],
};
```

---

## Integration Testing

### Workflow Testing

```typescript
// tests/integration/build-workflow.test.ts

describe('Integration: Full Build Workflow', () => {
  it('should complete SUN → EARTH → PLUTO → MARS → VENUS chain', async () => {
    // Arrange
    const prd = generateTestPRD();
    
    // Act - Execute Ralph Loop
    const result = await executeBuild(prd);
    
    // Assert
    expect(result.completedAgents).toContain('SUN');
    expect(result.completedAgents).toContain('EARTH');
    expect(result.completedAgents).toContain('PLUTO');
    expect(result.completedAgents).toContain('MARS');
    expect(result.completedAgents).toContain('VENUS');
    expect(result.errors).toHaveLength(0);
  });
  
  it('should handle MERCURY validation failure', async () => {
    // Arrange - PRD with intentional error
    const prd = generateInvalidPRD();
    
    // Act
    const result = await executeBuild(prd);
    
    // Assert
    expect(result.failedAt).toBe('MERCURY');
    expect(result.feedback).toBeDefined();
  });
});
```

### Agent Communication Testing

```typescript
// tests/integration/agent-communication.test.ts

describe('Integration: Agent Handoffs', () => {
  it('SUN should pass correct context to EARTH', async () => {
    const sunOutput = await SUN.execute(testInput);
    const earthInput = await prepareEarthInput(sunOutput);
    
    expect(earthInput.requirements).toBeDefined();
    expect(earthInput.acceptanceCriteria).toHaveLength > 0;
  });
  
  it('PLUTO schema should match MARS types', async () => {
    const schema = await PLUTO.generateSchema(testSpec);
    const types = await MARS.generateTypes(schema);
    
    // Verify type compatibility
    expect(validateTypeCompatibility(schema, types)).toBe(true);
  });
});
```

---

## E2E Testing

### Critical Paths

```typescript
// e2e/critical-paths.test.ts

const CRITICAL_PATHS = [
  {
    name: 'Generate new feature',
    steps: [
      'User submits PRD',
      'SUN creates spec',
      'EARTH refines requirements',
      'PLUTO designs schema',
      'MARS implements logic',
      'VENUS builds UI',
      'SATURN runs tests',
      'User sees result',
    ],
  },
  {
    name: 'Fix TypeScript errors',
    steps: [
      'MARS detects error',
      'MARS generates fix',
      'MERCURY validates',
      'Build continues',
    ],
  },
  {
    name: 'Handle build failure',
    steps: [
      'Agent fails',
      'CHARON captures error',
      'MIMAS applies retry',
      'Build resumes or fails gracefully',
    ],
  },
];
```

---

## Mock Testing Utilities

```typescript
// src/testing/mock-agents.ts

export function mockAgent<T>(
  agentName: string,
  response: T
): jest.Mock {
  return jest.fn().mockImplementation(() => Promise.resolve({
    agent: agentName,
    output: response,
    tokensUsed: 1000,
    duration: 5000,
  }));
}

export function mockAgentFailure(
  agentName: string,
  error: Error
): jest.Mock {
  return jest.fn().mockImplementation(() => Promise.reject(error));
}

export const MOCK_RESPONSES = {
  SUN: {
    spec: '## Specification\n\nFeature: Test\n\n## Tasks\n- [ ] Task 1',
    agentChain: ['EARTH', 'PLUTO', 'MARS', 'VENUS'],
  },
  
  PLUTO: {
    schema: `defineTable({ name: v.string() })`,
    indexes: ['by_user'],
  },
  
  VENUS: {
    component: `export function Component() { return <div /> }`,
    styles: 'tailwind classes',
  },
};
```

---

## Performance Testing

```typescript
// tests/performance/agent-performance.test.ts

const PERFORMANCE_THRESHOLDS = {
  SUN: { maxDuration: 30000, maxTokens: 4000 },
  VENUS: { maxDuration: 60000, maxTokens: 8000 },
  MARS: { maxDuration: 45000, maxTokens: 6000 },
  PLUTO: { maxDuration: 20000, maxTokens: 2000 },
};

describe('Performance: Agent Execution', () => {
  for (const [agent, thresholds] of Object.entries(PERformance_THRESHOLDS)) {
    it(`${agent} should complete within ${thresholds.maxDuration}ms`, async () => {
      const start = Date.now();
      await executeAgent(agent, testInput);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(thresholds.maxDuration);
    });
    
    it(`${agent} should use less than ${thresholds.maxTokens} tokens`, async () => {
      const result = await executeAgent(agent, testInput);
      
      expect(result.tokensUsed).toBeLessThan(thresholds.maxTokens);
    });
  }
});
```

---

## Test Execution Strategy

### Parallel Testing (Swarm Mode)

```typescript
// src/testing/swarm-test-runner.ts

interface TestBatch {
  name: string;
  tests: TestCase[];
  priority: number;
}

export async function runSwarmTests(
  batches: TestBatch[],
  maxConcurrency: number = 5
): Promise<TestResult[]> {
  // Sort by priority
  batches.sort((a, b) => a.priority - b.priority);
  
  // Execute in parallel
  const results = await Promise.all(
    batches.map(batch => 
      runTestBatch(batch, maxConcurrency)
    )
  );
  
  return results.flat();
}
```

### Smart Test Selection

```typescript
// src/testing/smart-test-selection.ts

export function selectRelevantTests(
  changedFiles: string[]
): string[] {
  const testsToRun: string[] = [];
  
  for (const file of changedFiles) {
    // Find corresponding test file
    const testFile = file.replace(/\.ts$/, '.test.ts');
    if (fileExists(testFile)) {
      testsToRun.push(testFile);
    }
    
    // Find integration tests that reference this file
    const integrationTests = findIntegrationTestsReferencing(file);
    testsToRun.push(...integrationTests);
  }
  
  return [...new Set(testsToRun)];
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `tests/integration/build-workflow.test.ts` | New - full workflow tests |
| `tests/performance/agent-performance.test.ts` | New - performance tests |
| `src/testing/mock-agents.ts` | New - agent mocking utilities |
| `src/testing/swarm-test-runner.ts` | New - parallel test execution |
| `.nova/agents/SATURN.md` | Update with test plan templates |

---

*Adapted from BistroLens QA test suite*
*For Nova26 testing strategy*
