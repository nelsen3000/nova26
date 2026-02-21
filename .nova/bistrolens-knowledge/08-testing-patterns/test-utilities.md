# Test Utilities Patterns

## Source
Extracted from BistroLens:
- `jest.setup.ts` — global test setup
- `jest.config.ts` — Jest configuration
- `__mocks__/convex.ts` — Convex mock module
- `tests/golden-pdfs/fixtures.ts` — shared recipe fixtures
- `tests/CostBreakdownPanel.test.tsx` — mock factory helpers
- `services/nudgeEngine.test.ts` — input builder helpers
- `components/PantryManager.test.tsx` — context render helpers
- `convex/__tests__/subscriptions.property.test.ts` — mock database class
- `utils/__tests__/*.property.test.ts` — fast-check arbitraries

---

## Overview

BistroLens uses **Jest + React Testing Library + fast-check** for testing.
Test utilities fall into five categories:

1. **Mock Factories** — `createMock*` helpers that build typed test objects
2. **Custom Render Helpers** — wrappers that inject React context providers
3. **Test Data Builders** — `createInput()` functions for service tests
4. **Shared Fixtures** — exported recipe objects reused across test files
5. **Fast-Check Arbitraries** — typed generators for property-based tests

---

## Mock Factories

### Pattern: `createMock*` Helper Functions

Co-locate mock factories at the top of each test file. Accept `Partial<T>` overrides
so callers only specify what matters for the test.

```typescript
// Source: tests/CostBreakdownPanel.test.tsx

import { IngredientPrice, RecipeCost } from '../services/pricingService';

const createMockIngredient = (overrides: Partial<IngredientPrice> = {}): IngredientPrice => ({
  ingredient: 'test-ingredient',
  displayName: 'Test Ingredient',
  quantity: 1,
  unit: 'cup',
  pricePerUnit: 2.50,
  totalPrice: 2.50,
  source: 'static',
  confidence: 'medium',
  lastUpdated: new Date(),
  storeInfo: { name: 'Test Store', location: 'Test Location' },
  ...overrides,
});

const createMockRecipeCost = (overrides: Partial<RecipeCost> = {}): RecipeCost => ({
  recipeId: 'test-recipe',
  totalCost: 10.00,
  costPerServing: 2.50,
  servings: 4,
  currency: 'USD',
  confidence: 'medium',
  ingredients: [
    createMockIngredient({ ingredient: 'flour', displayName: 'flour', totalPrice: 1.50 }),
    createMockIngredient({ ingredient: 'eggs',  displayName: 'eggs',  totalPrice: 3.00 }),
    createMockIngredient({ ingredient: 'milk',  displayName: 'milk',  totalPrice: 2.50 }),
  ],
  pantryDiscount: 0,
  outOfPocketCost: 10.00,
  calculatedAt: new Date(),
  ...overrides,
});
```

### Usage in Tests

```typescript
const cost = createMockRecipeCost();

const costWithDiscount = createMockRecipeCost({
  pantryDiscount: 2.50,
  outOfPocketCost: 7.50,
});

const highConfIngredient = createMockIngredient({
  ingredient: 'truffle',
  confidence: 'high',
  totalPrice: 45.00,
});
```

---

## Custom Render Helpers

### Pattern: Context-Wrapped Render Function

When components consume React context, create a `render*` helper that wraps with
the required providers. This avoids repeating provider boilerplate in every test.

```typescript
// Source: components/PantryManager.test.tsx

import { render } from '@testing-library/react';
import { SettingsContext } from '../contexts';
import { AppSettings } from '../types';

const mockAppSettings: AppSettings = {
  fontSize: 'base',
  mode: 'food',
  theme: 'light',
  drinkPreference: 'Alcoholic',
  profile: { name: 'Test User', dietaryPreferences: [], allergies: [], healthGoals: {} },
  pantry: mockPantryItems,
  voiceId: 'en-US-Standard-E',
  freezer: [],
  tasteProfile: { likes: [], dislikes: [] },
  challenges: {},
  tutorialMode: { level: 'beginner', focus: 'technique' },
  groceryList: [],
  defaultRecipeTone: 'Standard',
  defaultRecipeQualityFocus: 'Balanced',
  measurementSystem: 'Imperial',
  country: 'United States',
  defaultServings: 4,
  preparationStyle: 'From Scratch',
};

const mockSetSettings = jest.fn();

const renderPantryManager = () =>
  render(
    <SettingsContext.Provider value={{ settings: mockAppSettings, setSettings: mockSetSettings }}>
      <PantryManager />
    </SettingsContext.Provider>
  );

// Usage
it('displays existing pantry items', () => {
  renderPantryManager();
  expect(screen.getByText('2 cups Flour')).toBeInTheDocument();
});
```

### Pattern: Render Helper with Parameters

When tests need different settings or viewport sizes, accept overrides:

```typescript
// Source: components/__tests__/HeroHeadline.test.tsx

const renderHero = (settings = defaultSettings, windowWidth = 1024) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: windowWidth,
  });
  window.dispatchEvent(new Event('resize'));

  return render(
    <SettingsContext.Provider value={{ settings, setSettings: jest.fn() }}>
      <Hero />
    </SettingsContext.Provider>
  );
};

// Usage
it('renders desktop layout', () => {
  const { container } = renderHero(defaultSettings, 1200);
  expect(container.querySelector('h1')).toBeInTheDocument();
});

it('renders mobile layout', () => {
  const { container } = renderHero(defaultSettings, 768);
  expect(container.querySelector('h1')).toBeInTheDocument();
});
```

---

## Test Data Builders

### Pattern: `createInput()` for Service Tests

For pure service/logic tests (no React), use a `createInput()` builder that returns
a fully-typed input with sensible defaults.

```typescript
// Source: services/nudgeEngine.test.ts

import { getEligibleNudges, type NudgeInput } from './nudgeEngine';

function createInput(overrides: Partial<NudgeInput> = {}): NudgeInput {
  return {
    userId: 'test-user',
    recipeId: 'test-recipe',
    userTier: 'free',
    userCookCount: 0,
    isTrendingTonight: false,
    recipeMeta: { prepTimeMinutes: 30, stepCount: 6 },
    lastShownMap: {},
    isInCookingMode: false,
    ...overrides,
  };
}

// Usage — only specify what the test cares about
it('shows repeat nudge when user has cooked once', () => {
  const input = createInput({ userCookCount: 1 });
  expect(getEligibleNudges(input).uiNudge).toBe('repeat');
});

it('never shows nudges in cooking mode', () => {
  const input = createInput({ userCookCount: 2, isInCookingMode: true });
  expect(getEligibleNudges(input).uiNudge).toBeUndefined();
});
```

### Pattern: Mock Database Class for Stateful Logic

When testing stateful operations (upserts, idempotency), create an in-memory mock
database class that mirrors the real storage interface:

```typescript
// Source: convex/__tests__/subscriptions.property.test.ts

class MockSubscriptionDatabase {
  private records: Map<string, SubscriptionRecord> = new Map();
  private idCounter = 0;

  upsert(args: UpsertSubscriptionArgs): string {
    const now = Date.now();
    let existing: SubscriptionRecord | undefined;

    // Primary lookup: stripeSubscriptionId
    if (args.stripeSubscriptionId) {
      existing = this.findByStripeSubscriptionId(args.stripeSubscriptionId);
    }
    // Fallback: userId
    if (!existing) {
      existing = this.findByUserId(args.userId);
    }

    if (existing) {
      const updated = { ...existing, ...args, updatedAt: now };
      this.records.set(existing._id, updated);
      return existing._id;
    }

    const id = `sub_${++this.idCounter}`;
    this.records.set(id, { _id: id, ...args, createdAt: now, updatedAt: now });
    return id;
  }

  findByStripeSubscriptionId(id: string): SubscriptionRecord | undefined {
    for (const record of this.records.values()) {
      if (record.stripeSubscriptionId === id) return record;
    }
  }

  findByUserId(userId: string): SubscriptionRecord | undefined {
    for (const record of this.records.values()) {
      if (record.userId === userId) return record;
    }
  }

  getAll(): SubscriptionRecord[] {
    return Array.from(this.records.values());
  }

  clear(): void {
    this.records.clear();
    this.idCounter = 0;
  }
}

// Usage
describe('idempotency', () => {
  let db: MockSubscriptionDatabase;

  beforeEach(() => { db = new MockSubscriptionDatabase(); });

  it('processing same event N times produces one record', () => {
    const args = { userId: 'u1', stripeSubscriptionId: 'sub_abc', /* ... */ };
    db.upsert(args);
    db.upsert(args);
    db.upsert(args);
    expect(db.getAll().length).toBe(1);
  });
});
```

---

## Shared Fixtures

### Pattern: Exported Recipe Fixtures

For tests that need complete domain objects, define typed fixtures in a dedicated
`fixtures.ts` file and export them for reuse across test files.

```typescript
// Source: tests/golden-pdfs/fixtures.ts

import { Recipe } from '../../types';

// Three tiers: minimal, typical, edge-case (max content)
export const shortRecipe: Recipe = {
  title: 'Simple Toast',
  description: 'Quick and easy toast',
  servings: 1,
  cookTime: '3 Min',
  prepTime: '2 Min',
  difficulty: 'Easy',
  cuisine: 'American',
  category: 'Breakfast',
  budgetPerServing: 1,
  ingredientGroups: [{
    title: 'Main',
    ingredients: [
      { name: 'Bread',   quantity: '2 slices' },
      { name: 'Butter',  quantity: '1 tbsp'   },
      { name: 'Salt',    quantity: 'pinch'     },
    ],
  }],
  kitchenTools: ['Toaster'],
  steps: [
    { instruction: 'Toast bread until golden brown', tip: '' },
    { instruction: 'Spread butter and add salt',     tip: '' },
  ],
  nutrition: { calories: '180', protein: '4g', carbs: '25g', fat: '8g' },
  flavorProfile: { sweet: 0, sour: 0, salt: 2, bitter: 0, umami: 1 },
  qualityScore: 70,
};

// typicalRecipe — 8 ingredients, 4 steps, all optional fields populated
export const typicalRecipe: Recipe = { /* ... */ };

// longRecipe — 15+ ingredients, 12 steps, triggers truncation logic
export const longRecipe: Recipe = { /* ... */ };

// Companion image URLs for each fixture
export const heroImages = {
  short:   'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
  typical: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  long:    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
};
```

### Usage

```typescript
import { shortRecipe, typicalRecipe, longRecipe } from './fixtures';

it('renders short recipe without truncation', () => {
  render(<RecipePDF recipe={shortRecipe} />);
  // ...
});

it('truncates long recipe ingredients', () => {
  render(<RecipePDF recipe={longRecipe} />);
  // ...
});
```

---

## Custom Matchers

### jest-axe Accessibility Matcher

BistroLens extends Jest with `jest-axe` for automated accessibility audits:

```typescript
// Source: components/PantryManager.test.tsx

import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('passes accessibility audit', async () => {
  const { container } = renderPantryManager();
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### jest-dom Matchers

Imported globally via `jest.setup.ts`:

```typescript
// jest.setup.ts
import '@testing-library/jest-dom';

// Enables:
// expect(el).toBeInTheDocument()
// expect(el).toHaveValue('text')
// expect(el).toBeDisabled()
// expect(el).toHaveClass('active')
// expect(el).toMatchSnapshot()
```

---

## Fast-Check Arbitraries

### Pattern: Reusable Domain Arbitraries

Define named arbitraries for domain types and compose them into complex generators:

```typescript
// Source: convex/__tests__/subscriptions.property.test.ts

import * as fc from 'fast-check';

// Primitive arbitraries
const userIdArb = fc.uuid();

const stripeCustomerIdArb = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 14, maxLength: 24 })
  .map(nums => `cus_${nums.map(n => n.toString(16)).join('')}`);

const stripeSubscriptionIdArb = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 14, maxLength: 24 })
  .map(nums => `sub_${nums.map(n => n.toString(16)).join('')}`);

// Enum arbitraries
const tierArb: fc.Arbitrary<SubscriptionTier> = fc.oneof(
  fc.constant('free'         as const),
  fc.constant('premium'      as const),
  fc.constant('chef_master'  as const)
);

const statusArb: fc.Arbitrary<SubscriptionStatus> = fc.oneof(
  fc.constant('active'    as const),
  fc.constant('canceled'  as const),
  fc.constant('past_due'  as const)
);

// Timestamp arbitrary (reasonable range)
const timestampArb = fc.integer({ min: 1600000000000, max: 2000000000000 });

// Composed record arbitrary
const subscriptionArgsArb: fc.Arbitrary<UpsertSubscriptionArgs> = fc.record({
  userId:               userIdArb,
  tier:                 tierArb,
  status:               statusArb,
  currentPeriodStart:   timestampArb,
  currentPeriodEnd:     timestampArb,
  stripeCustomerId:     stripeCustomerIdArb,
  stripeSubscriptionId: stripeSubscriptionIdArb,
});
```

### Pattern: Hex Color Arbitrary

```typescript
// Source: utils/__tests__/accessibilityUtils.property.test.ts

const hexColorArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([r, g, b]) =>
    `#${r.toString(16).padStart(2, '0')}` +
    `${g.toString(16).padStart(2, '0')}` +
    `${b.toString(16).padStart(2, '0')}`
  );

// Usage — test contrast ratio symmetry
fc.assert(
  fc.property(hexColorArb, hexColorArb, (c1, c2) => {
    const r1 = getContrastRatio(c1, c2);
    const r2 = getContrastRatio(c2, c1);
    return Math.abs(r1 - r2) < 0.001;
  }),
  { numRuns: 50 }
);
```

### Pattern: Constrained Float Arbitraries

For numeric domain values, use `fc.float` with `noNaN: true` and `Math.fround()` for bounds:

```typescript
// Source: tests/pricing-basic.test.ts

// Safe float range — avoids NaN and Infinity edge cases
const priceArb    = fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true });
const servingsArb = fc.integer({ min: 1, max: 20 });

fc.assert(
  fc.property(
    fc.record({ totalCost: priceArb, servings: servingsArb }),
    ({ totalCost, servings }) => {
      const costPerServing = totalCost / servings;
      expect(costPerServing).toBeGreaterThan(0);
      expect(costPerServing).toBeLessThanOrEqual(totalCost);
    }
  ),
  { numRuns: 100 }
);
```

### Pattern: `fc.constantFrom` for Enum Values

```typescript
// Pick from a fixed set of valid values
const sourceArb     = fc.constantFrom('kroger', 'spoonacular', 'static');
const ingredientArb = fc.constantFrom('chicken', 'milk', 'bread', 'apples');
const locationArb   = fc.constantFrom('10001-NY-US', '90210-CA-US', '60601-IL-US');

// Pick from typed enum keys
const presetArb = fc.constantFrom<keyof typeof TRANSITION_PRESETS>('standard', 'fast', 'slow');
```

---

## Jest Configuration

### `jest.config.ts`

```typescript
// Source: jest.config.ts

export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // Allow Convex ESM to be transformed
  transformIgnorePatterns: ['node_modules/(?!(convex)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Redirect Convex generated files to mock
    '^../convex/_generated/(.*)$': '<rootDir>/__mocks__/convex.ts',
  },
};
```

### `jest.setup.ts`

```typescript
// Source: jest.setup.ts
import '@testing-library/jest-dom';
```

---

## Convex Mock Module

### `__mocks__/convex.ts`

Convex's generated API is mocked to avoid requiring a live backend in unit tests:

```typescript
// Source: __mocks__/convex.ts

export const api = {
  pricing: {
    getCachedIngredientPrice: 'pricing:getCachedIngredientPrice',
    setCachedIngredientPrice: 'pricing:setCachedIngredientPrice',
    getCachedRecipeCost:      'pricing:getCachedRecipeCost',
    setCachedRecipeCost:      'pricing:setCachedRecipeCost',
  },
};

export const Id = (table: string) =>
  `${table}_id_${Math.random().toString(36).substr(2, 9)}`;
```

Wired in `jest.config.ts`:

```typescript
moduleNameMapper: {
  '^../convex/_generated/(.*)$': '<rootDir>/__mocks__/convex.ts',
}
```

---

## Module Mocking Patterns

### Mocking External Services

```typescript
// Source: components/RecipeFinder.test.tsx

jest.mock('../services/geminiService', () => ({
  generateRecipe: jest.fn(() => Promise.resolve({
    title: 'Mock Recipe',
    description: 'Mock Description',
    steps: [],
    ingredientGroups: [],
    nutrition: { calories: '100', protein: '10g', carbs: '10g', fat: '2g' },
    kitchenTools: [],
  })),
  generateRecipeFromIngredients: jest.fn(() => Promise.resolve({})),
}));
```

### Mocking Hooks

```typescript
jest.mock('../hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    isSupported: true,
    startListening: jest.fn(),
    stopListening: jest.fn(),
    toggleListening: jest.fn(),
  }),
}));
```

### Mocking Child Components

```typescript
// Source: components/PantryManager.test.tsx

jest.mock('./PantryScannerModal', () => ({
  __esModule: true,
  default: jest.fn(({ onClose, onAddItems }) => (
    <div data-testid="pantry-scanner-mock">
      <button onClick={() => onAddItems([
        { name: 'Milk', suggestedQuantity: '1 liter' },
        { name: 'Eggs', suggestedQuantity: '6 large' },
      ])}>
        Add Scanned Items
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  )),
}));
```

### Mocking localStorage

```typescript
// Source: components/PantryManager.test.tsx

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem:  (key: string) => store[key] || null,
    setItem:  (key: string, value: string) => { store[key] = value; },
    clear:    () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
```

### Mocking Framer Motion

```typescript
// Source: components/__tests__/HeroHeadline.test.tsx

jest.mock('framer-motion', () => ({
  motion: {
    div:  ({ children, ...props }: any) => <div  {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
```

---

## Anti-Patterns

### ❌ Don't Repeat Provider Boilerplate

```typescript
// ❌ Bad — duplicated in every test
it('test 1', () => {
  render(
    <SettingsContext.Provider value={{ settings: mockSettings, setSettings: jest.fn() }}>
      <MyComponent />
    </SettingsContext.Provider>
  );
});
```

```typescript
// ✅ Good — extract render helper once
const renderMyComponent = (overrides = {}) =>
  render(
    <SettingsContext.Provider value={{ settings: { ...mockSettings, ...overrides }, setSettings: jest.fn() }}>
      <MyComponent />
    </SettingsContext.Provider>
  );
```

### ❌ Don't Use `any` in Mock Factories

```typescript
// ❌ Bad
const createMockRecipe = (overrides: any = {}) => ({ ...defaults, ...overrides });

// ✅ Good
const createMockRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({ ...defaults, ...overrides });
```

### ❌ Don't Use `fc.float()` Without `noNaN: true`

```typescript
// ❌ Bad — can generate NaN, causing confusing failures
const priceArb = fc.float({ min: 0.01, max: 1000 });

// ✅ Good
const priceArb = fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true });
```

### ❌ Don't Mock What You're Testing

```typescript
// ❌ Bad — mocking the service under test defeats the purpose
jest.mock('../services/pricingService');
const result = pricingService.calculateCost(recipe); // always returns mock

// ✅ Good — mock only external dependencies (APIs, Convex)
jest.mock('../services/krogerApiClient');
const result = pricingService.calculateCost(recipe); // real logic runs
```

---

## When to Use This Pattern

✅ **Use mock factories when:**
- Multiple tests need the same domain object with slight variations
- The object has many required fields but tests only care about a few
- You want to avoid brittle tests that break when new fields are added

✅ **Use custom render helpers when:**
- Components require React context providers
- Multiple tests render the same component with different settings
- You need to mock `window` properties (innerWidth, localStorage)

✅ **Use fast-check arbitraries when:**
- Testing mathematical properties (cost calculations, unit conversions)
- Verifying invariants that should hold for all valid inputs
- Testing idempotency, symmetry, or monotonicity

✅ **Use shared fixtures when:**
- Multiple test files need the same complex domain object
- Testing rendering with different data sizes (short/typical/long)
- Snapshot tests that need stable, predictable data

❌ **Don't use mocks to make tests pass** — tests must validate real functionality.

---

## Benefits

1. **Reduced boilerplate** — `createMock*` helpers eliminate repetitive object construction
2. **Type safety** — `Partial<T>` overrides catch type errors at compile time
3. **Test isolation** — each test specifies only what it cares about
4. **Maintainability** — when types change, update the factory once
5. **Property coverage** — fast-check arbitraries test thousands of inputs automatically

---

## Related Patterns

- See `unit-testing.md` for unit test structure
- See `component-testing.md` for RTL patterns
- See `integration-testing.md` for service integration tests
- See `e2e-testing.md` for Playwright patterns
- See `01-convex-patterns/` for Convex-specific testing approaches

---

*Extracted: 2026-02-18*
