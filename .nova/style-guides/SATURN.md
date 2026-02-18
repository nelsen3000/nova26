# SATURN Style Guide - Testing

## Test File Naming
- Unit tests: `[module].test.ts`
- Component tests: `[Component].test.tsx`
- E2E tests: `[flow].spec.ts` (Playwright)
- Convex tests: `[function].test.ts`

## describe/it Conventions
```typescript
describe("[feature]", () => {
  describe("[scenario]", () => {
    it("should [expected behavior]", () => {
      // test
    });
  });
});
```

## Coverage Thresholds (NON-NEGOTIABLE)
| Category | Threshold |
|----------|-----------|
| Mutations | 95% |
| Financial calculations | 100% |
| Components | 80% |
| Queries | 90% |
| Overall | 85% |

## Test Structure (Arrange-Act-Assert)
```typescript
// Arrange
const mockCtx = createMockContext();

// Act
const result = await function(mockCtx, args);

// Assert
expect(result).toEqual(expected);
```

## Required Test Cases
- Happy path
- Authentication failure
- Validation errors
- Edge cases (null, empty, max values)
- Error handling

## Mocking Rules
- Mock external APIs
- Mock auth context
- Use Convex test utilities
- Never mock the function under test
