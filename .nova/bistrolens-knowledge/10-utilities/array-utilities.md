# Array Utilities

## Source
Extracted from BistroLens `services/recipeFilteringService.ts`, `utils/prepBatching.ts`, `utils/bakersCalculator.ts`, `convex/imageDataset.ts`, `convex/bentoDataset.ts`, and `services/unifiedShoppingListService.ts`.

---

## Pattern: Array Utility Patterns

BistroLens uses native JavaScript array methods throughout — no lodash or utility libraries. Patterns cover filtering, sorting, grouping, deduplication, and aggregation.

---

## Core Patterns

### 1. Multi-Criteria Filtering

```typescript
// services/recipeFilteringService.ts — chained filter pipeline
async filterRecipes(recipes: Recipe[], filters: FilterState): Promise<Recipe[]> {
  let filtered = [...recipes]; // Always copy — never mutate the original

  // Filter by cuisine (OR logic — any match)
  if (filters.cuisines.length > 0) {
    filtered = filtered.filter(recipe =>
      filters.cuisines.some(cuisine =>
        recipe.cuisine?.toLowerCase().includes(cuisine.toLowerCase()) ||
        recipe.tags?.some(tag => tag.toLowerCase().includes(cuisine.toLowerCase()))
      )
    );
  }

  // Filter by dietary (AND logic — all must match)
  if (filters.dietary.length > 0) {
    filtered = filtered.filter(recipe =>
      filters.dietary.every(diet =>
        recipe.dietaryInfo?.some(info => info.toLowerCase().includes(diet.toLowerCase())) ||
        recipe.tags?.some(tag => tag.toLowerCase().includes(diet.toLowerCase()))
      )
    );
  }

  // Filter by cooking time
  if (filters.cookingTime) {
    const maxTime = parseInt(filters.cookingTime);
    filtered = filtered.filter(recipe => {
      const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
      return totalTime <= maxTime;
    });
  }

  return filtered;
}
```

### 2. Multi-Criteria Sorting

```typescript
// services/recipeFilteringService.ts — sort by multiple criteria
const sortRecipes = (recipes: Recipe[], sortBy: string): Recipe[] => {
  switch (sortBy) {
    case 'time':
      return [...recipes].sort((a, b) => {
        const timeA = (a.prepTime || 0) + (a.cookTime || 0);
        const timeB = (b.prepTime || 0) + (b.cookTime || 0);
        return timeA - timeB;
      });

    case 'difficulty':
      const difficultyOrder = { 'easy': 1, 'medium': 2, 'hard': 3 };
      return [...recipes].sort((a, b) => {
        const diffA = difficultyOrder[a.difficulty?.toLowerCase() as keyof typeof difficultyOrder] || 2;
        const diffB = difficultyOrder[b.difficulty?.toLowerCase() as keyof typeof difficultyOrder] || 2;
        return diffA - diffB;
      });

    case 'rating':
      return [...recipes].sort((a, b) => (b.rating || 0) - (a.rating || 0));

    default:
      return recipes; // Keep original order
  }
};
```

### 3. GroupBy Pattern (reduce to Record)

```typescript
// convex/imageDataset.ts — group items by a property
const byImageType = allImages.reduce((acc, img) => {
  acc[img.imageType] = (acc[img.imageType] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// convex/bentoDataset.ts — group recipes by category
const recipesByCategory = recipes.reduce((acc, recipe) => {
  acc[recipe.category] = (acc[recipe.category] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// Generic groupBy utility
function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// Usage
const recipesByMealType = groupBy(recipes, 'mealType');
// → { breakfast: [...], lunch: [...], dinner: [...] }
```

### 4. Deduplication with Set

```typescript
// services/unifiedShoppingListService.ts — merge arrays without duplicates
existingItem.recipes = [...new Set([...existingItem.recipes, ...newRecipes])];

// convex/editorialPromotion.ts — set intersection for tag matching
const setA = new Set(tagsA);
const setB = new Set(tagsB);
const intersection = new Set([...setA].filter(x => setB.has(x)));
const union = new Set([...setA, ...setB]);
const jaccardSimilarity = intersection.size / union.size;

// Generic deduplication
const unique = <T>(arr: T[]): T[] => [...new Set(arr)];

// Dedup by property
const uniqueById = <T extends { id: string }>(arr: T[]): T[] => {
  const seen = new Set<string>();
  return arr.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};
```

### 5. Aggregation (sum, average, min, max)

```typescript
// services/recipeFilteringService.ts — cost statistics
const getCostStatistics = (costs: number[]) => {
  if (costs.length === 0) return { min: 0, max: 0, avg: 0, median: 0 };

  const sorted = [...costs].sort((a, b) => a - b);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sorted.reduce((sum, cost) => sum + cost, 0) / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
  };
};

// utils/bakersCalculator.ts — sum with filter
const flourWeight = ingredients
  .filter(i => i.type === 'flour')
  .reduce((sum, i) => sum + toGrams(i.weight, i.unit), 0);

// utils/prepBatching.ts — total time calculation
const totalTime = tasks.reduce((sum, task) => sum + task.estimatedTime, 0);
```

### 6. Priority Sorting (multi-key)

```typescript
// utils/prepBatching.ts — sort by count first, then priority
const sortedTasks = tasks
  .filter(task => task.recipeCount >= 2)
  .sort((a, b) => {
    // Primary sort: recipe count (descending)
    if (b.recipeCount !== a.recipeCount) {
      return b.recipeCount - a.recipeCount;
    }
    // Secondary sort: priority score (descending)
    return b.priority - a.priority;
  });
```

### 7. Phase Partitioning (categorize into buckets)

```typescript
// utils/prepBatching.ts — partition tasks into phases
const getPrepSchedule = (tasks: PrepTask[]) => {
  const longCooking = tasks.filter(t => ['cook_rice', 'cook_beans'].includes(t.id));
  const roasting = tasks.filter(t => ['roast_vegetables'].includes(t.id));
  const chopping = tasks.filter(t =>
    ['chop_onions', 'chop_garlic', 'dice_vegetables'].includes(t.id)
  );
  const quick = tasks.filter(t => ['boil_eggs', 'prep_citrus'].includes(t.id));

  return [
    { phase: 'Start first', tasks: longCooking },
    { phase: 'While that cooks', tasks: roasting },
    { phase: 'Chop & prep', tasks: chopping },
    { phase: 'Quick tasks', tasks: quick },
  ].filter(phase => phase.tasks.length > 0);
};
```

### 8. Safe Array Operations

```typescript
// Always guard against undefined/null arrays
const safeFilter = <T>(arr: T[] | undefined | null, predicate: (item: T) => boolean): T[] => {
  return (arr || []).filter(predicate);
};

// Safe find with fallback
const findOrDefault = <T>(arr: T[], predicate: (item: T) => boolean, fallback: T): T => {
  return arr.find(predicate) ?? fallback;
};

// Usage patterns from BistroLens
const tags = recipe.tags?.some(tag => tag.includes(query)) ?? false;
const steps = recipe.steps?.map(s => s.instruction || s) || [];
const ingredients = recipe.ingredients || [];
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't mutate the original array
recipes.sort((a, b) => a.rating - b.rating); // ❌ Mutates in place

// Don't use for loops for transformations
const names = [];
for (const recipe of recipes) {
  names.push(recipe.title); // ❌ Use .map() instead
}

// Don't use indexOf for existence checks
const hasItem = arr.indexOf(item) !== -1; // ❌ Use .includes() or Set
```

### ✅ Do This Instead

```typescript
// Always copy before sorting
const sorted = [...recipes].sort((a, b) => a.rating - b.rating); // ✅

// Use functional methods
const names = recipes.map(r => r.title); // ✅

// Use .includes() or Set for lookups
const hasItem = arr.includes(item); // ✅ O(n)
const hasItemFast = itemSet.has(item); // ✅ O(1) for large arrays
```

---

## When to Use This Pattern

✅ **Use for:**
- Filtering recipe lists by multiple criteria (chain `.filter()` calls)
- Sorting by multiple keys (primary + secondary sort)
- Grouping items by category (`.reduce()` to `Record<string, T[]>`)
- Deduplicating arrays (spread + `new Set()`)
- Computing statistics (min, max, avg, median)

❌ **Don't use for:**
- Very large datasets (>10k items) — consider server-side pagination
- Complex tree structures — use recursive functions
- Real-time streaming data — use Convex subscriptions

---

## Benefits

1. Zero dependencies — all native JavaScript array methods
2. Functional style (`.filter().map().reduce()`) is composable and readable
3. `Set` provides O(1) lookups for deduplication
4. Copying before sort (`[...arr].sort()`) prevents subtle mutation bugs
5. Optional chaining (`?.`) + nullish coalescing (`??`) handles missing data safely

---

## Related Patterns

- See `../06-data-fetching/usequery-patterns.md` for server-side filtering with Convex
- See `validation-helpers.md` for validating array contents
- See `number-formatting.md` for formatting aggregated values
- See `utils/prepBatching.ts` for full prep task analysis implementation

---

*Extracted: 2026-02-18*
