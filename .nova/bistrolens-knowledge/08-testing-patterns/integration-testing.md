# Integration Testing Patterns

## Source
Extracted from BistroLens `tests/recipe-finder-integration.test.tsx`, `convex/__tests__/subscriptions.property.test.ts`, `services/__tests__/imageGovernanceReuse.test.ts`, `services/__tests__/upgradePromptManager.property.test.ts`, `services/nudgeEngine.test.ts`, and `tests/image-system.test.ts`.

---

## Overview

BistroLens uses **Jest** + **ts-jest** as its test runner. Integration tests live in the `tests/` directory (top-level) and in `__tests__/` subdirectories co-located with the modules they test. The test environment is **jsdom**.

Integration tests in BistroLens are characterized by:
- Testing **multiple real modules working together** (e.g., `recipeFilteringService` + `pricingService`)
- Testing **business logic chains** that span service → data → output
- Testing **policy/governance rules** that enforce cross-cutting constraints
- Using **property-based testing** (via `fast-check`) to verify invariants across many inputs
- Mocking only **external I/O** (Convex client, external APIs), not internal logic

---

## What Makes a Test an Integration Test

A test is an integration test when it:

1. **Exercises two or more real modules together** — not just one function in isolation
2. **Tests a complete flow** — input → processing → output across module boundaries
3. **Validates cross-cutting rules** — e.g., governance policies that span multiple services
4. **Tests the contract between modules** — how module A's output feeds module B's input

### Integration vs Unit

| Aspect | Unit Test | Integration Test |
|--------|-----------|-----------------|
| Scope | Single function/class | Multiple modules working together |
| Mocking | Mock all dependencies | Mock only external I/O (DB, APIs) |
| Purpose | Verify isolated logic | Verify modules compose correctly |
| Location | Co-located `.test.ts` | `tests/` or `__tests__/` |
| Speed | Very fast | Slightly slower (real logic runs) |

---

## Testing Multi-Component Flows

The primary integration test pattern in BistroLens is testing a **service that orchestrates other services**.

### Pattern: Service Orchestration Test

```typescript
// tests/recipe-finder-integration.test.tsx
/**
 * Integration tests for cost filtering with recipe search
 * Tests Task 6.1: Integration of cost filtering with recipe search
 */

import { recipeFilteringService } from '../services/recipeFilteringService';
import { PricingService } from '../services/pricingService';

// Mock ONLY external I/O — not internal service logic
jest.mock('../services/pricingService');
jest.mock('../data/staticPrices', () => ({
  getStaticPrice: jest.fn().mockReturnValue({ price: 2.50, unit: 'each' })
}));

describe('Cost Filtering Integration', () => {
  let service: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new (recipeFilteringService.constructor as any)();

    // Inject a mock pricing service with predictable behavior
    const mockPricingService = {
      calculateRecipeCost: jest.fn().mockImplementation((recipe) => {
        const costs = {
          'Budget Pasta':  { costPerServing: 3.50, totalCost: 14.00 },
          'Gourmet Steak': { costPerServing: 25.00, totalCost: 50.00 },
          'Quick Salad':   { costPerServing: 4.50, totalCost: 4.50 }
        };
        const cost = costs[recipe.title] ?? { costPerServing: 10.00, totalCost: 40.00 };
        return Promise.resolve({
          recipeId: recipe._id,
          ...cost,
          servings: recipe.servings,
          currency: 'USD',
          confidence: 'medium' as const,
          ingredients: [],
          pantryDiscount: 0,
          outOfPocketCost: cost.totalCost,
          calculatedAt: new Date()
        });
      })
    };

    service.pricingService = mockPricingService;
  });

  it('should filter recipes by maximum cost', async () => {
    const filters = {
      cuisines: [],
      cookingTime: null,
      difficulty: null,
      dietary: [],
      pantryOnly: false,
      sortBy: 'relevance' as const,
      mealType: null,
      michelinMode: false,
      budgetLevel: 'standard' as const,
      maxCost: 5.00
    };

    const result = await service.filterRecipes(mockRecipes, filters);

    expect(result.recipes).toHaveLength(2);
    expect(result.recipes.map(r => r.title)).toContain('Budget Pasta');
    expect(result.recipes.map(r => r.title)).toContain('Quick Salad');
  });

  it('should combine cost filters with other filters', async () => {
    const filters = {
      cuisines: ['Italian'],
      maxCost: 10.00,
      // ... other filter fields
    };

    const result = await service.filterRecipes(mockRecipes, filters);

    // Integration: cuisine filter AND cost filter both applied
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0].title).toBe('Budget Pasta');
  });

  it('should handle recipes without cost data gracefully', async () => {
    // Mock one recipe to fail cost calculation
    service.pricingService.calculateRecipeCost.mockImplementation((recipe) => {
      if (recipe.title === 'Budget Pasta') {
        return Promise.reject(new Error('Cost calculation failed'));
      }
      // ... return costs for others
    });

    const result = await service.filterRecipes(mockRecipes, { maxCost: 10.00 });

    // Integration: error in one service should not break the whole flow
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0].title).toBe('Quick Salad');
  });
});
```

### Key Principles

- **Inject mock dependencies** via property assignment (`service.pricingService = mockPricingService`) rather than mocking the entire module
- **Use predictable mock data** — map recipe titles to known costs so assertions are deterministic
- **Test error propagation** — verify that a failure in one service is handled gracefully by the orchestrating service
- **Test filter combinations** — integration tests are ideal for verifying that multiple filters compose correctly

---

## Testing API Integrations

BistroLens mocks external API clients (Convex, Stripe, Gemini) at the boundary, then tests the real service logic.

### Pattern: Convex Client Mock

```typescript
// tests/image-system.test.ts

// Mock the Convex generated API module
jest.mock('../convex/_generated/api', () => ({
  api: {
    pricing: {
      getCachedIngredientPrice: 'pricing:getCachedIngredientPrice',
      setCachedIngredientPrice: 'pricing:setCachedIngredientPrice',
    }
  }
}));

jest.mock('convex/react', () => ({
  ConvexReactClient: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    mutation: jest.fn(),
  }))
}));

import { PricingService } from '../services/pricingService';

describe('Integration Tests', () => {
  let pricingService: PricingService;
  let mockConvex: any;

  beforeEach(() => {
    mockConvex = {
      query: jest.fn(),
      mutation: jest.fn(),
    };
    pricingService = new PricingService(mockConvex);
  });

  it('should calculate recipe cost with multiple ingredients', async () => {
    // Mock Convex to return no cached prices (force fresh calculation)
    mockConvex.query = jest.fn().mockResolvedValue(null);
    mockConvex.mutation = jest.fn().mockResolvedValue('mock-id');

    const mockRecipe = {
      _id: 'recipe-123' as any,
      title: 'Test Recipe',
      servings: 4,
      ingredientGroups: [
        {
          title: 'Main Ingredients',
          ingredients: [
            { name: 'chicken breast', quantity: '2 lb' },
            { name: 'rice', quantity: '1 cup' },
            { name: 'onions', quantity: '1 medium' }
          ]
        }
      ]
    };

    const result = await pricingService.calculateRecipeCost(mockRecipe);

    // Verify the full output shape — not just one field
    expect(result).toBeDefined();
    expect(result.recipeId).toBe('recipe-123');
    expect(result.servings).toBe(4);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.costPerServing).toBe(result.totalCost / 4);  // Verify relationship
    expect(result.ingredients).toHaveLength(3);
    expect(result.confidence).toMatch(/^(high|medium|low)$/);
  });

  it('should handle pantry items correctly', async () => {
    mockConvex.query = jest.fn().mockResolvedValue(null);
    mockConvex.mutation = jest.fn().mockResolvedValue('mock-id');

    const mockRecipe = { /* ... */ };
    const pantryItems = ['salt'];

    const result = await pricingService.calculateRecipeCost(mockRecipe, { pantryItems });

    // Verify cross-module relationship: pantry discount affects out-of-pocket cost
    expect(result.pantryDiscount).toBeGreaterThan(0);
    expect(result.outOfPocketCost).toBeLessThan(result.totalCost);
    expect(result.outOfPocketCost).toBe(result.totalCost - result.pantryDiscount);

    const saltIngredient = result.ingredients.find(ing => ing.ingredient === 'salt');
    expect(saltIngredient?.inPantry).toBe(true);
  });
});
```

### Global Convex Mock (`__mocks__/convex.ts`)

BistroLens provides a global mock for Convex generated files, mapped via `moduleNameMapper` in `jest.config.ts`:

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

```typescript
// jest.config.ts — maps all Convex generated imports to the mock
moduleNameMapper: {
  "^../convex/_generated/(.*)$": "<rootDir>/__mocks__/convex.ts",
}
```

---

## Testing Convex Function Chains

For testing Convex mutation/query logic without a live backend, BistroLens uses **in-memory mock databases** that replicate the Convex upsert/lookup behavior.

### Pattern: Mock Database for Idempotency Testing

```typescript
// convex/__tests__/subscriptions.property.test.ts

/**
 * In-memory mock database that simulates Convex behavior.
 * Allows testing idempotency logic without a real Convex backend.
 */
class MockSubscriptionDatabase {
  private records: Map<string, SubscriptionRecord> = new Map();
  private idCounter = 0;

  /**
   * Simulates the idempotent upsert logic from convex/subscriptions.ts
   * 
   * Per Requirements 5.1, 5.3, 5.4:
   * 1. First lookup by stripeSubscriptionId (primary idempotency key)
   * 2. Fall back to userId lookup if stripeSubscriptionId not found
   * 3. Always update updatedAt on every upsert
   */
  upsert(args: UpsertSubscriptionArgs): string {
    const now = Date.now();
    let existing: SubscriptionRecord | undefined;

    // Step 1: Try to find by stripeSubscriptionId first (primary idempotency key)
    if (args.stripeSubscriptionId) {
      existing = this.findByStripeSubscriptionId(args.stripeSubscriptionId);
    }

    // Step 2: Fall back to userId lookup
    if (!existing) {
      existing = this.findByUserId(args.userId);
    }

    if (existing) {
      const updated: SubscriptionRecord = {
        ...existing,
        ...args,
        updatedAt: now
      };
      this.records.set(existing._id, updated);
      return existing._id;
    } else {
      const id = `sub_${++this.idCounter}`;
      const newRecord: SubscriptionRecord = {
        _id: id,
        ...args,
        createdAt: now,
        updatedAt: now
      };
      this.records.set(id, newRecord);
      return id;
    }
  }

  findByStripeSubscriptionId(id: string): SubscriptionRecord | undefined {
    for (const record of this.records.values()) {
      if (record.stripeSubscriptionId === id) return record;
    }
    return undefined;
  }

  countByStripeSubscriptionId(id: string): number {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.stripeSubscriptionId === id) count++;
    }
    return count;
  }

  clear(): void {
    this.records.clear();
    this.idCounter = 0;
  }
}
```

### Property-Based Idempotency Test

```typescript
import * as fc from 'fast-check';

describe('Property 7: Idempotency Guarantee', () => {
  let db: MockSubscriptionDatabase;

  beforeEach(() => {
    db = new MockSubscriptionDatabase();
  });

  it('processing same event N times produces exactly one record', () => {
    fc.assert(
      fc.property(
        subscriptionArgsArb,
        fc.integer({ min: 1, max: 10 }), // process count
        (args, processCount) => {
          db.clear();

          const ids: string[] = [];
          for (let i = 0; i < processCount; i++) {
            ids.push(db.upsert(args));
          }

          // All upserts return the same ID
          expect(new Set(ids).size).toBe(1);

          // Only one record exists
          expect(db.countByStripeSubscriptionId(args.stripeSubscriptionId!)).toBe(1);
          expect(db.getAll().length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('stripeSubscriptionId is primary idempotency key', () => {
    fc.assert(
      fc.property(
        subscriptionArgsArb,
        fc.uuid(),       // new userId
        tierArb,
        statusArb,
        (originalArgs, newUserId, newTier, newStatus) => {
          db.clear();

          const firstId = db.upsert(originalArgs);

          // Same stripeSubscriptionId, different userId — should update, not create
          const secondId = db.upsert({
            ...originalArgs,
            userId: newUserId,
            tier: newTier,
            status: newStatus
          });

          expect(secondId).toBe(firstId);
          expect(db.getAll().length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

---

## Testing Policy/Governance Rules

BistroLens has several cross-cutting policy systems (image governance, upgrade prompt rules) that are tested as integration tests because they enforce rules across multiple modules.

### Pattern: Policy Rule Simulation

```typescript
// services/__tests__/imageGovernanceReuse.test.ts

describe('Image Governance Reuse Rules', () => {
  /**
   * Simulates the gating logic from the findSimilarImages Convex query.
   * Tests the policy rules in isolation from the database.
   */
  function applyGatingRules(
    candidates: ImageRecord[],
    args: { imageType: string; tier: string; allowSpirited?: boolean }
  ) {
    return candidates.filter(img => {
      if (!img.embedding || img.embedding.length === 0) return false;
      if (!img.isReusable || img.isRetired) return false;
      if (img.imageType !== args.imageType) return false;
      if (img.tier !== args.tier) return false;
      if (args.allowSpirited === false && img.drinkMode === 'spirited') return false;
      return true;
    });
  }

  it('should block spirited images when allowSpirited=false', () => {
    const result = applyGatingRules([mockImages.spiritedDrink], {
      imageType: 'DRINK',
      tier: 'standard',
      allowSpirited: false
    });
    expect(result).toHaveLength(0);
  });

  it('should apply all filters correctly', () => {
    const allCandidates = Object.values(mockImages);
    const result = applyGatingRules(allCandidates, {
      imageType: 'HERO_DISH',
      tier: 'standard',
      allowSpirited: false
    });
    // Only validHero passes all filters
    expect(result).toHaveLength(1);
    expect(result[0].imageId).toBe('hero-001');
  });
});
```

---

## Test Data Setup

### Inline Mock Data

For integration tests, define mock data inline at the top of the test file. Use realistic shapes that match the actual TypeScript types:

```typescript
const mockRecipes = [
  {
    _id: 'recipe1' as any,
    title: 'Budget Pasta',
    servings: 4,
    cuisine: 'Italian',
    difficulty: 'Easy',
    prepTime: 15,
    cookTime: 20,
    mealType: 'dinner',
    dietaryInfo: ['vegetarian'],
    tags: ['quick', 'budget'],
    ingredientGroups: [
      {
        title: 'Main',
        ingredients: [
          { name: 'pasta', quantity: '1 lb' },
          { name: 'tomato sauce', quantity: '1 jar' }
        ]
      }
    ]
  },
  // ... more recipes
];
```

### Property-Based Arbitraries

For property tests, define reusable arbitraries (generators) at the module level:

```typescript
import * as fc from 'fast-check';

// Generates valid Stripe subscription IDs
const stripeSubscriptionIdArb = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 14, maxLength: 24 })
  .map(nums => `sub_${nums.map(n => n.toString(16)).join('')}`);

// Generates valid subscription tiers
const tierArb: fc.Arbitrary<SubscriptionTier> = fc.oneof(
  fc.constant('free' as const),
  fc.constant('premium' as const),
  fc.constant('chef_master' as const)
);

// Compose into a full record arbitrary
const subscriptionArgsArb: fc.Arbitrary<UpsertSubscriptionArgs> = fc.record({
  userId: fc.uuid(),
  tier: tierArb,
  status: statusArb,
  currentPeriodStart: fc.integer({ min: 1600000000000, max: 2000000000000 }),
  currentPeriodEnd: fc.integer({ min: 1600000000000, max: 2000000000000 }),
  stripeCustomerId: stripeCustomerIdArb,
  stripeSubscriptionId: stripeSubscriptionIdArb
});
```

### beforeEach Cleanup

Always reset state between tests to prevent cross-test contamination:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  db.clear();
  manager.resetSession();
  manager.clearDismissedPrompts();
});
```

---

## Examples

### Example 1: Multi-Filter Integration (Service + Service)

```typescript
// tests/recipe-finder-integration.test.tsx
it('should sort recipes by cost ascending', async () => {
  const filters = {
    sortBy: 'cost_asc' as const,
    // ... other required fields
  };

  const result = await service.filterRecipes(mockRecipes, filters);

  expect(result.recipes).toHaveLength(3);
  expect(result.recipes[0].title).toBe('Budget Pasta');  // $3.50
  expect(result.recipes[1].title).toBe('Quick Salad');   // $4.50
  expect(result.recipes[2].title).toBe('Gourmet Steak'); // $25.00
});
```

### Example 2: Convex Mutation Chain (Property-Based)

```typescript
// convex/__tests__/subscriptions.property.test.ts
it('field values identical after duplicate processing', () => {
  fc.assert(
    fc.property(
      subscriptionArgsArb,
      fc.integer({ min: 1, max: 10 }),
      (args, processCount) => {
        // Process once
        const singleDb = new MockSubscriptionDatabase();
        singleDb.upsert(args);
        const singleRecord = singleDb.findByStripeSubscriptionId(args.stripeSubscriptionId!);

        // Process N times
        const multiDb = new MockSubscriptionDatabase();
        for (let i = 0; i < processCount; i++) {
          multiDb.upsert(args);
        }
        const multiRecord = multiDb.findByStripeSubscriptionId(args.stripeSubscriptionId!);

        // Core fields must be identical regardless of how many times processed
        expect(multiRecord!.userId).toBe(singleRecord!.userId);
        expect(multiRecord!.tier).toBe(singleRecord!.tier);
        expect(multiRecord!.status).toBe(singleRecord!.status);
        expect(multiRecord!.stripeSubscriptionId).toBe(singleRecord!.stripeSubscriptionId);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Example 3: Business Logic Chain (Service with Suppression)

```typescript
// services/nudgeEngine.test.ts
it('shows repeat nudge over efficiency when both eligible', () => {
  const input = createInput({
    userCookCount: 2,
    userTier: 'free',
    recipeMeta: { prepTimeMinutes: 30, stepCount: 6 },
  });
  const result = getEligibleNudges(input);
  // Integration: priority rules across multiple eligibility checks
  expect(result.uiNudge).toBe('repeat');
});

it('suppresses nudge shown within 7 days', () => {
  const recentTimestamp = Date.now() - (3 * 24 * 60 * 60 * 1000);
  const input = createInput({
    userCookCount: 1,
    lastShownMap: { 'test-recipe:repeat': recentTimestamp },
  });
  const result = getEligibleNudges(input);
  // Integration: suppression map interacts with eligibility logic
  expect(result.uiNudge).toBeUndefined();
});
```

### Example 4: Cost Statistics Across Multiple Recipes

```typescript
// tests/recipe-finder-integration.test.tsx
describe('Cost Statistics', () => {
  it('should calculate cost statistics for recipe set', async () => {
    const stats = await service.getCostStatistics(mockRecipes);

    expect(stats.minCost).toBe(3.50);
    expect(stats.maxCost).toBe(25.00);
    expect(stats.averageCost).toBeCloseTo(11.00, 1);
    expect(stats.medianCost).toBe(4.50);
  });

  it('should handle empty recipe arrays for statistics', async () => {
    const stats = await service.getCostStatistics([]);

    expect(stats.minCost).toBe(0);
    expect(stats.maxCost).toBe(0);
    expect(stats.averageCost).toBe(0);
    expect(stats.medianCost).toBe(0);
  });
});
```

---

## Anti-Patterns

### ❌ Mocking Internal Service Logic

```typescript
// BAD: Mocking the service you're trying to test
jest.mock('../services/recipeFilteringService');
const mockFilter = recipeFilteringService as jest.Mocked<typeof recipeFilteringService>;
mockFilter.filterRecipes.mockResolvedValue({ recipes: [] });

// This tests nothing — you're just testing your mock
```

### ✅ Mock Only External I/O

```typescript
// GOOD: Mock only the external dependency (Convex client)
const mockConvex = { query: jest.fn(), mutation: jest.fn() };
const service = new PricingService(mockConvex);

// Now test the real service logic
const result = await service.calculateRecipeCost(recipe);
```

---

### ❌ Sharing State Between Tests

```typescript
// BAD: State leaks between tests
const db = new MockSubscriptionDatabase();

it('test 1', () => {
  db.upsert(args1);
  // ...
});

it('test 2', () => {
  // db still has data from test 1!
  db.upsert(args2);
});
```

### ✅ Reset State in beforeEach

```typescript
// GOOD: Fresh state for every test
let db: MockSubscriptionDatabase;

beforeEach(() => {
  db = new MockSubscriptionDatabase();
  // or: db.clear();
});
```

---

### ❌ Testing Only the Happy Path

```typescript
// BAD: Only tests success
it('filters recipes', async () => {
  const result = await service.filterRecipes(mockRecipes, filters);
  expect(result.recipes).toHaveLength(2);
});
```

### ✅ Test Error Propagation Too

```typescript
// GOOD: Also tests what happens when a dependency fails
it('handles cost calculation failure gracefully', async () => {
  service.pricingService.calculateRecipeCost.mockRejectedValueOnce(
    new Error('API unavailable')
  );

  const result = await service.filterRecipes(mockRecipes, { maxCost: 10 });

  // Should degrade gracefully, not throw
  expect(result.recipes).toBeDefined();
});
```

---

### ❌ Asserting Only One Field

```typescript
// BAD: Doesn't verify the full contract
expect(result.totalCost).toBeGreaterThan(0);
```

### ✅ Assert the Full Output Contract

```typescript
// GOOD: Verifies the complete output shape and relationships
expect(result.recipeId).toBe('recipe-123');
expect(result.servings).toBe(4);
expect(result.totalCost).toBeGreaterThan(0);
expect(result.costPerServing).toBe(result.totalCost / 4);  // Verify relationship
expect(result.ingredients).toHaveLength(3);
expect(result.confidence).toMatch(/^(high|medium|low)$/);
```

---

## Approaching Integration Testing with This Stack

Since BistroLens uses Convex (a serverless backend), true end-to-end integration tests against a live Convex deployment are not part of the Jest suite. Instead, the project uses these strategies:

### 1. In-Memory Mock Databases
Replicate Convex's upsert/lookup semantics in a plain TypeScript class. This lets you test the full mutation logic (idempotency, field validation, fallback lookups) without a live backend.

### 2. Property-Based Testing for Invariants
Use `fast-check` to verify that invariants hold across thousands of generated inputs. This is especially valuable for:
- Idempotency (same input N times = same result)
- Data integrity (required fields always present)
- Business rules (tier/status always valid enum values)

### 3. Service Injection for Dependency Control
Pass mock services via constructor injection or property assignment rather than module-level mocking. This keeps the real orchestration logic running while controlling the data returned by dependencies.

### 4. Playwright for True E2E
Full browser-level integration tests (auth flows, Stripe checkout, real Convex mutations) live in `tests/e2e/` and use Playwright. These are separate from the Jest suite and require a running dev environment.

---

## Related Patterns

- See `unit-testing.md` for single-module test patterns and Jest configuration
- See `component-testing.md` for React Testing Library patterns
- See `e2e-testing.md` for Playwright end-to-end test patterns
- See `test-utilities.md` for shared test helpers and mock factories

## When to Use

- When testing multiple real modules working together across service boundaries
- When verifying that filter, sort, and policy rules compose correctly
- When testing Convex mutation chains for idempotency and data integrity
- When validating cross-cutting governance rules that span multiple services

## Benefits

- Catches composition bugs that unit tests miss by exercising real service logic
- Property-based testing verifies invariants across thousands of generated inputs
- In-memory mock databases enable testing Convex semantics without a live backend
- Service injection keeps orchestration logic real while controlling dependency data

---

*Extracted: 2026-02-18*
