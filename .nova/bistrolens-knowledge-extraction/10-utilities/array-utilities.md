# Array Utilities

## Source
Extracted from BistroLens:
- `components/RecipePDFLandscape/utils.ts` (truncateArray, flattenIngredients)
- `convex/savedCollections.ts` (map, collect patterns)
- `lib/utils.ts` (array-based category mapping)

---

## Pattern: Array Truncation with Metadata

Truncate arrays to a maximum length while tracking how many items were removed. Essential for UI constraints and pagination.

### Code Example

```typescript
type TruncationResult<T> = {
  items: T[];
  truncatedCount: number;
};

/**
 * Truncate array to max items, returning truncated count
 * Handles null/undefined arrays gracefully
 */
export function truncateArray<T>(
  arr: T[], 
  maxItems: number
): TruncationResult<T> {
  if (!arr || arr.length <= maxItems) {
    return { items: arr || [], truncatedCount: 0 };
  }
  return {
    items: arr.slice(0, maxItems),
    truncatedCount: arr.length - maxItems,
  };
}

/**
 * Format truncation indicator for UI display
 */
export function formatTruncationIndicator(count: number): string {
  if (count <= 0) return '';
  return `(+${count} more)`;
}
```

### Usage Example

```typescript
// Truncate ingredients for PDF export
const MAX_INGREDIENTS = 20;
const ingredientsResult = truncateArray(allIngredients, MAX_INGREDIENTS);

// Display in UI
<div>
  {ingredientsResult.items.map(ing => (
    <IngredientItem key={ing.name} ingredient={ing} />
  ))}
  {ingredientsResult.truncatedCount > 0 && (
    <p className="text-sm text-muted-foreground">
      {formatTruncationIndicator(ingredientsResult.truncatedCount)}
    </p>
  )}
</div>
```

---

## Pattern: Array Flattening with Fallback

Flatten nested array structures with graceful fallback to alternative data sources.

### Code Example

```typescript
type FlatIngredient = {
  name: string;
  quantity: string;
};

type IngredientGroup = {
  groupName: string;
  ingredients: Array<{ name: string; quantity: string }>;
};

type Recipe = {
  ingredientGroups?: IngredientGroup[];
  ingredients?: Array<{ name: string; quantity: string }>;
};

/**
 * Flatten ingredient groups into single array
 * Prefers ingredientGroups, falls back to ingredients array
 */
export function flattenIngredients(recipe: Recipe): FlatIngredient[] {
  // Try ingredientGroups first (preferred structure)
  if (recipe.ingredientGroups && recipe.ingredientGroups.length > 0) {
    return recipe.ingredientGroups.flatMap(group =>
      group.ingredients.map(ing => ({
        name: ing.name,
        quantity: ing.quantity,
      }))
    );
  }
  
  // Fall back to ingredients array (legacy structure)
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    return recipe.ingredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
    }));
  }
  
  // No ingredients found
  return [];
}
```

### Usage Example

```typescript
// Flatten and truncate in one operation
const allIngredients = flattenIngredients(recipe);
const { items, truncatedCount } = truncateArray(allIngredients, MAX_INGREDIENTS);
```

---

## Pattern: Array Transformation with Map

Transform arrays while maintaining type safety and handling edge cases.

### Code Example

```typescript
/**
 * Map saved collections to simplified format
 * Used in Convex queries to return only necessary fields
 */
export const listSaved = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      throw new Error("Unauthorized: Must be logged in");
    }
    
    const userId = identity.subject;
    
    const saved = await ctx.db
      .query("savedCollections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    
    // Transform to simplified format
    return saved.map((s) => ({
      slug: s.collectionSlug,
      savedAt: s.savedAt,
    }));
  },
});
```

---

## Pattern: Array-Based Lookup with Fallback

Use arrays to implement deterministic fallback logic for missing data.

### Code Example

```typescript
/**
 * Get category badge styles with deterministic fallback
 * Uses hash-based array lookup for unknown categories
 */
export function getCategoryBadgeStyles(category: string): string {
  // Explicit mapping for known categories
  const map: Record<string, string> = {
    'Technique': 'bg-brand-primary text-brand-white',
    'Ingredients': 'bg-brand-yellow text-brand-black',
    'Skills': 'bg-brand-black text-brand-white',
    'Science': 'bg-brand-white text-brand-primary border border-brand-primary',
    'Lifestyle': 'bg-brand-yellow text-brand-black',
  };

  const baseStyle = "rounded-full px-3 py-1 text-xs font-bold uppercase";

  if (map[category]) {
    return `${map[category]} ${baseStyle}`;
  }

  // Deterministic fallback using hash-based array lookup
  const hash = category
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const variants = [
    'bg-brand-primary text-brand-white',
    'bg-brand-yellow text-brand-black',
    'bg-brand-black text-brand-white',
    'bg-brand-white text-brand-primary border border-brand-primary',
    'bg-brand-yellow text-brand-black'
  ];
  
  return `${variants[hash % variants.length]} ${baseStyle}`;
}
```

---

## Pattern: Array Filtering with Null Safety

Filter arrays while handling null/undefined values gracefully.

### Code Example

```typescript
/**
 * Build cuisine/category string from optional fields
 * Filters out falsy values before joining
 */
function buildCuisineCategory(
  cuisine: string | undefined, 
  category: string | undefined
): string {
  const parts = [cuisine, category].filter(Boolean);
  return parts.join(' • ') || '';
}

// Usage
const cuisineCategory = buildCuisineCategory(recipe.cuisine, recipe.category);
// Result: "Italian • Dinner" or "Italian" or "" (never "undefined • Dinner")
```

---

## Pattern: Array Mapping with Metadata Enrichment

Transform arrays while adding computed metadata to each item.

### Code Example

```typescript
type Step = {
  instruction: string;
  tip?: string;
};

type StepWithMeta = {
  instruction: string;
  tip?: string;
  hasTimer: boolean;
  timerMinutes?: number;
};

/**
 * Parse timer from step instruction text
 * Matches patterns like "8 minutes", "10 min", "5-7 minutes"
 */
function parseTimerFromStep(
  instruction: string
): { hasTimer: boolean; minutes?: number } {
  if (!instruction) return { hasTimer: false };
  
  // Match patterns: "X minutes", "X min", "X-Y minutes"
  const timerRegex = /(\d+)(?:\s*-\s*\d+)?\s*(?:minutes?|mins?)\b/i;
  const match = instruction.match(timerRegex);
  
  if (match) {
    return {
      hasTimer: true,
      minutes: parseInt(match[1], 10),
    };
  }
  
  return { hasTimer: false };
}

/**
 * Map steps with timer metadata
 * Enriches each step with computed timer information
 */
export function mapStepsWithMeta(steps: Step[]): StepWithMeta[] {
  if (!steps) return [];
  
  return steps.map(step => {
    const timerInfo = parseTimerFromStep(step.instruction);
    return {
      instruction: step.instruction,
      tip: step.tip,
      hasTimer: timerInfo.hasTimer,
      timerMinutes: timerInfo.minutes,
    };
  });
}
```

### Usage Example

```typescript
// Enrich steps with timer metadata
const enrichedSteps = mapStepsWithMeta(recipe.steps);

// Use in UI
{enrichedSteps.map((step, index) => (
  <StepCard 
    key={index} 
    step={step}
    showTimer={step.hasTimer}
    timerMinutes={step.timerMinutes}
  />
))}
```

---

## Anti-Patterns

### ❌ Don't Mutate Original Arrays

```typescript
// BAD: Mutates original array
function truncateArrayBad<T>(arr: T[], maxItems: number): T[] {
  arr.length = maxItems; // Mutates original!
  return arr;
}

// BAD: Loses truncation information
function truncateArrayBad2<T>(arr: T[], maxItems: number): T[] {
  return arr.slice(0, maxItems); // No way to know how many were removed
}
```

### ✅ Do This Instead

```typescript
// GOOD: Returns new array with metadata
function truncateArray<T>(arr: T[], maxItems: number): TruncationResult<T> {
  if (!arr || arr.length <= maxItems) {
    return { items: arr || [], truncatedCount: 0 };
  }
  return {
    items: arr.slice(0, maxItems), // New array
    truncatedCount: arr.length - maxItems, // Metadata preserved
  };
}
```

### ❌ Don't Ignore Null/Undefined Arrays

```typescript
// BAD: Crashes on null/undefined
function flattenBad(groups: IngredientGroup[]): FlatIngredient[] {
  return groups.flatMap(g => g.ingredients); // TypeError if groups is null
}

// BAD: No fallback for empty arrays
function flattenBad2(recipe: Recipe): FlatIngredient[] {
  return recipe.ingredientGroups.flatMap(g => g.ingredients);
  // TypeError if ingredientGroups is undefined
}
```

### ✅ Do This Instead

```typescript
// GOOD: Null-safe with fallback
function flattenIngredients(recipe: Recipe): FlatIngredient[] {
  if (recipe.ingredientGroups && recipe.ingredientGroups.length > 0) {
    return recipe.ingredientGroups.flatMap(group =>
      group.ingredients.map(ing => ({
        name: ing.name,
        quantity: ing.quantity,
      }))
    );
  }
  
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    return recipe.ingredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
    }));
  }
  
  return []; // Safe fallback
}
```

### ❌ Don't Use Random Fallbacks

```typescript
// BAD: Non-deterministic fallback
function getBadgeStylesBad(category: string): string {
  const variants = ['style1', 'style2', 'style3'];
  return variants[Math.floor(Math.random() * variants.length)];
  // Different style on each render!
}
```

### ✅ Do This Instead

```typescript
// GOOD: Deterministic hash-based fallback
function getCategoryBadgeStyles(category: string): string {
  const hash = category
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const variants = ['style1', 'style2', 'style3'];
  return variants[hash % variants.length];
  // Same category always gets same style
}
```

---

## When to Use This Pattern

✅ **Use truncateArray for:**
- Limiting items in UI displays (cards, lists, grids)
- PDF/print layouts with space constraints
- Pagination with "show more" functionality
- Performance optimization (render fewer items)

✅ **Use flattenIngredients for:**
- Normalizing nested data structures
- Migrating between data formats
- Simplifying complex hierarchies for display
- Combining multiple data sources

✅ **Use array mapping for:**
- Transforming API responses to UI models
- Adding computed properties to items
- Filtering unnecessary fields
- Type-safe data transformations

❌ **Don't use for:**
- Large datasets (use pagination/virtualization instead)
- Real-time streaming data (use generators/iterators)
- Performance-critical loops (consider memoization)

---

## Benefits

1. **Type Safety**: Generic types ensure compile-time safety
2. **Null Safety**: Graceful handling of null/undefined arrays
3. **Immutability**: Original arrays never mutated
4. **Metadata Preservation**: Track truncation counts, enrichment data
5. **Deterministic Behavior**: Hash-based fallbacks ensure consistency
6. **Composability**: Functions can be chained together
7. **Testability**: Pure functions are easy to unit test
8. **Performance**: Efficient array methods (map, flatMap, slice)

---

## Related Patterns

- See `pagination-patterns.md` for paginated array handling
- See `caching-strategies.md` for memoizing array transformations
- See `validation-helpers.md` for array validation utilities
- See `query-patterns.md` for Convex array queries with `.collect()`

---

*Extracted: 2026-02-18*
