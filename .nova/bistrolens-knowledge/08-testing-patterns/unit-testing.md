# Unit Testing Patterns

## Source
Extracted from BistroLens `jest.config.ts`, `jest.setup.ts`, `__mocks__/`, `tests/`, `components/__tests__/`, `services/__tests__/`, `utils/__tests__/`, `convex/__tests__/`, and co-located `.test.ts(x)` files.

---

## Overview

BistroLens uses **Jest** (not Vitest) as its test runner, with **ts-jest** for TypeScript transformation and **React Testing Library** for component tests. Tests run in a **jsdom** environment. Property-based testing is done with **fast-check**. Accessibility testing uses **jest-axe**.

The project has two distinct test styles:
1. **Unit/component tests** — verify specific behavior with concrete examples
2. **Property-based tests** — verify universal invariants across many generated inputs

---

## Setup & Configuration

### jest.config.ts

```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(convex)/)'  // Allow Convex ESM to be transformed
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^../convex/_generated/(.*)$": "<rootDir>/__mocks__/convex.ts",
  },
};
```

### jest.setup.ts

```typescript
// jest.setup.ts
import '@testing-library/jest-dom';
```

### package.json scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^15.0.7",
    "@types/jest": "^29.5.12",
    "fast-check": "^4.5.3",
    "jest": "^29.7.0",
    "jest-axe": "^8.0.0",
    "jest-environment-jsdom": "^29.7.0",
    "ts-jest": "^29.1.2"
  }
}
```

---

## Basic Test Structure

### File Naming Conventions

Tests are placed in two ways:
- **Co-located**: `ComponentName.test.tsx` next to the source file
- **Dedicated directories**: `__tests__/` subdirectory within the module folder
- **Top-level tests/**: `tests/` directory at project root for integration-style tests

```
components/
  PantryManager.tsx
  PantryManager.test.tsx          ← co-located
  __tests__/
    HeroHeadline.test.tsx         ← dedicated directory

services/
  nudgeEngine.ts
  nudgeEngine.test.ts             ← co-located
  __tests__/
    aspectRatioValidator.test.ts  ← dedicated directory

utils/
  recipeScaler.ts
  recipeScaler.test.ts            ← co-located
  __tests__/
    imageTags.test.ts             ← dedicated directory

tests/                            ← project-level tests
  pricing-basic.test.ts
  RecipeCostBadge.test.tsx
```

### Standard Test File Structure

```typescript
// Fix: Explicitly import Jest globals to resolve TypeScript errors
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

describe('ModuleName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = myFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

> **Note**: Always import `describe`, `expect`, `it`, `jest` from `@jest/globals` to avoid TypeScript "Cannot find name" errors.

---

## Testing Convex Functions

Convex functions cannot be called directly in Jest tests — they require a running Convex backend. The pattern is to:

1. **Mock the generated API** via `__mocks__/convex.ts`
2. **Test business logic in isolation** using mock databases
3. **Test idempotency logic** with in-memory mock implementations

### Convex Mock (`__mocks__/convex.ts`)

```typescript
// __mocks__/convex.ts
export const api = {
  pricing: {
    getCachedIngredientPrice: 'pricing:getCachedIngredientPrice',
    setCachedIngredientPrice: 'pricing:setCachedIngredientPrice',
    getCachedRecipeCost: 'pricing:getCachedRecipeCost',
    setCachedRecipeCost: 'pricing:setCachedRecipeCost',
  }
};

export const Id = (table: string) => 
  `${table}_id_${Math.random().toString(36).substr(2, 9)}`;
```

### jest.config.ts module mapping

```typescript
moduleNameMapper: {
  "^../convex/_generated/(.*)$": "<rootDir>/__mocks__/convex.ts",
},
```

### Testing Convex Logic with Mock Database

For testing mutation logic (e.g., idempotency), create an in-memory mock that mirrors the Convex behavior:

```typescript
// convex/__tests__/subscriptions.property.test.ts
import * as fc from 'fast-check';

type SubscriptionTier = 'free' | 'premium' | 'chef_master';
type SubscriptionStatus = 'active' | 'canceled' | 'past_due';

interface SubscriptionRecord {
  _id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeSubscriptionId?: string;
  updatedAt: number;
}

// In-memory mock that simulates Convex upsert behavior
class MockSubscriptionDatabase {
  private records: Map<string, SubscriptionRecord> = new Map();

  upsert(args: UpsertSubscriptionArgs): string {
    const now = Date.now();
    let existing: SubscriptionRecord | undefined;

    // Primary idempotency key: stripeSubscriptionId
    if (args.stripeSubscriptionId) {
      existing = this.findByStripeSubscriptionId(args.stripeSubscriptionId);
    }

    if (existing) {
      // Update existing record
      existing.tier = args.tier;
      existing.status = args.status;
      existing.updatedAt = now;
      return existing._id;
    }

    // Create new record
    const id = `sub_${++this.idCounter}`;
    const record: SubscriptionRecord = { _id: id, ...args, updatedAt: now };
    this.records.set(id, record);
    return id;
  }
}

// Property test: idempotency
it('processing same event N times creates exactly one record', () => {
  fc.assert(fc.property(
    fc.integer({ min: 2, max: 10 }),
    fc.string({ minLength: 5, maxLength: 20 }),
    (repeatCount, stripeSubId) => {
      const db = new MockSubscriptionDatabase();
      const args = {
        userId: 'user-123',
        tier: 'premium' as SubscriptionTier,
        status: 'active' as SubscriptionStatus,
        stripeSubscriptionId: stripeSubId,
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      // Process same event N times
      for (let i = 0; i < repeatCount; i++) {
        db.upsert(args);
      }

      // Should still have exactly one record
      expect(db.countByStripeId(stripeSubId)).toBe(1);
    }
  ), { numRuns: 50 });
});
```

---

## Testing Utility Functions

Pure utility functions are the easiest to test — no mocking needed.

### Basic Utility Test Pattern

```typescript
// utils/recipeScaler.test.ts
import { describe, expect, it } from '@jest/globals';
import { scaleRecipe } from './recipeScaler';
import { Recipe } from '../types';

describe('scaleRecipe', () => {
  const mockRecipe: Recipe = {
    title: 'Test Recipe',
    servings: 4,
    ingredientGroups: [{
      title: 'Main',
      ingredients: [
        { name: 'Flour', quantity: '2 cups' },
        { name: 'Sugar', quantity: '1/2 cup' },
      ],
    }],
    // ... other required fields
  };

  it('should return the original recipe if newServings is the same', () => {
    const scaled = scaleRecipe(mockRecipe, 4);
    expect(scaled).toEqual(mockRecipe);
  });

  it('should scale ingredients correctly for double servings', () => {
    const scaled = scaleRecipe(mockRecipe, 8);
    expect(scaled.servings).toBe(8);
    expect(scaled.ingredientGroups[0].ingredients[0].quantity).toBe('4 cups');
  });

  it('should handle ingredients with no numeric quantity', () => {
    const recipeWithNoQuantity = {
      ...mockRecipe,
      ingredientGroups: [{ title: 'Special', ingredients: [{ name: 'Salt', quantity: 'to taste' }] }]
    };
    const scaled = scaleRecipe(recipeWithNoQuantity, 8);
    expect(scaled.ingredientGroups[0].ingredients[0].quantity).toBe('to taste');
  });

  it('should return original recipe for invalid newServings (<= 0)', () => {
    expect(scaleRecipe(mockRecipe, 0)).toEqual(mockRecipe);
    expect(scaleRecipe(mockRecipe, -2)).toEqual(mockRecipe);
    expect(scaleRecipe(mockRecipe, NaN)).toEqual(mockRecipe);
  });
});
```

### Utility Test with Multiple Describe Groups

```typescript
// utils/__tests__/imageTags.test.ts
import {
  normalizeToKey,
  extractTechnique,
  buildHeroTags,
  validateTagBundle
} from '../imageTags';

describe('imageTags', () => {
  describe('normalizeToKey', () => {
    it('converts to lowercase and removes special characters', () => {
      expect(normalizeToKey('Chicken Parmesan!')).toBe('chicken-parmesan');
    });

    it('removes stop words', () => {
      expect(normalizeToKey('The Best Homemade Pasta')).toBe('pasta');
    });

    it('handles empty input', () => {
      expect(normalizeToKey('')).toBe('');
    });
  });

  describe('buildHeroTags', () => {
    it('builds complete hero tag bundle', () => {
      const tags = buildHeroTags({
        recipeTitle: 'Chicken Parmesan',
        tier: 'standard',
        cuisine: 'Italian',
        recipeId: 'recipe-123'
      });

      expect(tags.imageType).toBe('HERO_DISH');
      expect(tags.normalizedDishKey).toBe('chicken-parmesan');
      expect(tags.cuisineKey).toBe('italian');
    });
  });

  describe('validateTagBundle', () => {
    it('throws for missing required field', () => {
      const invalidBundle = { imageType: 'HERO_DISH' } as any;
      expect(() => validateTagBundle(invalidBundle)).toThrow('Missing required field');
    });
  });
});
```

---

## Testing React Components

### Basic Component Test Pattern

```typescript
// components/PantryManager.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import PantryManager from './PantryManager';
import { SettingsContext } from '../contexts';

// Helper to render with required context
const renderPantryManager = () => {
  return render(
    <SettingsContext.Provider value={{ settings: mockSettings, setSettings: mockSetSettings }}>
      <PantryManager />
    </SettingsContext.Provider>
  );
};

describe('PantryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    renderPantryManager();
    expect(screen.getByText('Add to Pantry')).toBeInTheDocument();
  });

  it('should display existing pantry items', () => {
    renderPantryManager();
    expect(screen.getByText('2 cups Flour')).toBeInTheDocument();
  });

  it('should allow adding new items', () => {
    renderPantryManager();
    const nameInput = screen.getByLabelText('New pantry item name');
    fireEvent.change(nameInput, { target: { value: 'Rice' } });
    fireEvent.click(screen.getByLabelText('Add item to pantry'));

    expect(mockSetSettings).toHaveBeenCalledWith(expect.any(Function));
  });
});
```

### Snapshot Testing

```typescript
// components/__tests__/HeroHeadline.test.tsx
describe('HeroHeadline', () => {
  it('matches desktop snapshot', () => {
    const { container } = renderHero(defaultSettings, 1200);
    const h1 = container.querySelector('h1');
    expect(h1).toMatchSnapshot();
  });

  it('matches mobile snapshot', () => {
    const { container } = renderHero(defaultSettings, 768);
    const h1 = container.querySelector('h1');
    expect(h1).toMatchSnapshot();
  });
});
```

### Accessibility Testing with jest-axe

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('should pass accessibility audit', async () => {
  const { container } = renderPantryManager();
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## Mocking Patterns

### Mocking a Module

```typescript
// Mock analytics service
jest.mock('../services/analyticsService', () => ({
  analyticsService: {
    track: jest.fn(),
    trackPageView: jest.fn(),
  },
}));
```

### Mocking a Component

```typescript
// Mock a child component for isolation
jest.mock('./PantryScannerModal', () => ({
  __esModule: true,
  default: jest.fn(({ onClose, onAddItems }) => (
    <div data-testid="pantry-scanner-mock">
      <button onClick={() => onAddItems([{ name: 'Milk', suggestedQuantity: '1 liter' }])}>
        Add Scanned Items
      </button>
    </div>
  )),
}));
```

### Mocking framer-motion

```typescript
// Avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
```

### Mocking localStorage

```typescript
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
```

### Mocking window.innerWidth

```typescript
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1200,
});
window.dispatchEvent(new Event('resize'));
```

### Accessing Mock Call Arguments

```typescript
// Cast to jest.Mock to access .mock property
const [updateFn] = (mockSetSettings as jest.Mock).mock.calls[0];
const updatedSettings = updateFn(mockAppSettings);
expect(updatedSettings.pantry).toContainEqual({ name: 'Rice', quantity: '500g' });
```

---

## Property-Based Testing with fast-check

BistroLens uses `fast-check` for property-based tests. These are often in separate files with `.property.test.ts` suffix.

### Basic Property Test

```typescript
import * as fc from 'fast-check';

it('cost per serving is always positive', () => {
  fc.assert(fc.property(
    fc.record({
      totalCost: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
      servings: fc.integer({ min: 1, max: 20 })
    }),
    ({ totalCost, servings }) => {
      const costPerServing = totalCost / servings;
      expect(costPerServing).toBeGreaterThan(0);
      expect(costPerServing).toBeLessThanOrEqual(totalCost);
    }
  ), { numRuns: 100 });
});
```

### Common Generators

```typescript
// Floats with bounds (use Math.fround for precision)
fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true })

// Integers
fc.integer({ min: 1, max: 20 })

// Pick from a set of values
fc.constantFrom('kroger', 'spoonacular', 'static')

// Records (objects)
fc.record({
  source: fc.constantFrom('kroger', 'spoonacular'),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(50), noNaN: true }),
})

// Optional values
fc.option(fc.float({ min: Math.fround(1), max: Math.fround(20), noNaN: true }))
```

### Property Test with Requirement Annotation

```typescript
/**
 * Property 14: Upgrade Prompt Value Moment Constraint
 * **Validates: Requirements 8.1**
 */
describe('Property 14: Upgrade Prompt Value Moment Constraint', () => {
  it('prompts are only allowed at their configured value moments', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...promptsWithMoments),
        fc.constantFrom(...valueMoments),
        (entryPoint, moment) => {
          const config = PROMPT_ENTRY_POINTS[entryPoint];
          const result = manager.canShowPrompt(entryPoint, moment);
          
          if (config.allowedMoments.includes(moment)) {
            expect(result.allowed).toBe(true);
          } else {
            expect(result.allowed).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

---

## Common Assertions

```typescript
// Presence
expect(screen.getByText('Add to Pantry')).toBeInTheDocument();
expect(screen.queryByText('Hidden Text')).not.toBeInTheDocument();

// Values
expect(result).toBe('exact value');
expect(result).toEqual({ key: 'value' });  // deep equality
expect(result).toBeCloseTo(3.333, 5);       // floating point

// Numbers
expect(value).toBeGreaterThan(0);
expect(value).toBeLessThanOrEqual(100);
expect(Math.abs(a - b)).toBeLessThan(0.001); // tolerance check

// Arrays
expect(array).toContain('item');
expect(array).toContainEqual({ name: 'Rice', quantity: '500g' });
expect(array.length).toBe(3);

// Classes (RTL)
expect(container.firstChild).toHaveClass('bg-green-50', 'text-green-700');

// Errors
expect(() => validateTagBundle(invalid)).toThrow('Missing required field');

// Mocks
expect(mockFn).toHaveBeenCalledWith(expect.any(Function));
expect(mockFn).toHaveBeenCalledTimes(2);

// Async
await waitFor(() => {
  expect(screen.getByText('Loaded Content')).toBeInTheDocument();
});

// Accessibility
const results = await axe(container);
expect(results).toHaveNoViolations();

// Snapshots
expect(element).toMatchSnapshot();
```

---

## Anti-Patterns

### ❌ Don't use `any` for mock types without casting

```typescript
// Bad: TypeScript won't catch errors
const [updateFn] = mockSetSettings.mock.calls[0];
```

### ✅ Cast to jest.Mock to access .mock

```typescript
// Good: Explicit cast enables type-safe access
const [updateFn] = (mockSetSettings as jest.Mock).mock.calls[0];
```

---

### ❌ Don't forget to import Jest globals

```typescript
// Bad: Causes "Cannot find name 'describe'" TypeScript errors
describe('test', () => { ... });
```

### ✅ Always import from @jest/globals

```typescript
// Good: Explicit imports resolve TypeScript errors
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
```

---

### ❌ Don't test Convex functions directly

```typescript
// Bad: Requires running Convex backend
import { api } from '../convex/_generated/api';
const result = await convex.query(api.recipes.getAll);
```

### ✅ Mock the generated API and test logic in isolation

```typescript
// Good: Use __mocks__/convex.ts and test business logic directly
import { MockSubscriptionDatabase } from './mockDb';
const db = new MockSubscriptionDatabase();
db.upsert(args);
expect(db.count()).toBe(1);
```

---

## When to Use This Pattern

✅ **Use for:**
- Pure utility functions (math, string manipulation, data transformation)
- React components with clear inputs/outputs
- Business logic that can be extracted from Convex functions
- Idempotency and invariant verification with property tests
- Accessibility compliance checks

❌ **Don't use for:**
- Testing live Convex queries/mutations (use integration tests)
- E2E user flows (use Playwright)
- Testing third-party library internals

---

## Benefits

1. Fast feedback — Jest runs in milliseconds without a backend
2. Isolated — mocks prevent flaky tests from external dependencies
3. Property tests catch edge cases that example tests miss
4. jest-axe integrates accessibility checks into the unit test suite

---

## Related Patterns

- See `component-testing.md` for RTL-focused component patterns
- See `e2e-testing.md` for Playwright patterns
- See `integration-testing.md` for Convex integration tests
- See `01-convex-patterns/` for Convex schema and query patterns

---

*Extracted: 2026-02-18*
