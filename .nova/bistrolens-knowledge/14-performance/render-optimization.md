# Render Optimization Patterns

## Source
Extracted from BistroLens `components/CookingView.tsx`, `components/SkillProfile.tsx`, `components/TopRecipesView.tsx`, `components/BentoRecipeLibrary.tsx`, `components/AcademySEOCollectionPage.tsx`, `components/IngredientSwapSheet.tsx`, `hooks/useFreemium.ts`, `utils/performanceOptimizer.ts`

---

## Pattern: useMemo + useCallback + Stable References

BistroLens prevents unnecessary re-renders through three complementary techniques:
1. **`useMemo`** — memoize expensive derived values
2. **`useCallback`** — stabilize event handler references passed to children
3. **Functional state updaters** — avoid stale closures without adding deps

---

## Memoizing Expensive Derived Values

### Code Example

```typescript
// components/SkillProfile.tsx
import React, { useState, useMemo } from 'react';

const SkillProfile: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');

  // These service calls are expensive — compute once on mount
  const progress = useMemo(() => getOverallProgress(), []);
  const userSkills = useMemo(() => getUserSkills(), []);
  const userAchievements = useMemo(() => getUserAchievements(), []);
  const recommendations = useMemo(() => getSkillRecommendations(3), []);
  const history = useMemo(() => getSkillHistory().slice(0, 10), []);

  // Recompute only when selectedCategory changes
  const filteredSkills = useMemo(() => {
    if (selectedCategory === 'all') return SKILLS;
    return SKILLS.filter(s => s.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div>
      <p>Progress: {progress.percentage}%</p>
      {filteredSkills.map(skill => <SkillCard key={skill.id} skill={skill} />)}
    </div>
  );
};
```

---

## Memoizing Multi-Step Data Pipelines

### Code Example

```typescript
// components/TopRecipesView.tsx
import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';

const TopRecipesView: React.FC = () => {
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest'>('popular');
  const [filterCuisine, setFilterCuisine] = useState('all');

  const bentoRecipes = useQuery(api.bentoDataset.getTopRecipes);
  const socialRecipes = getTopSocialRecipes();

  // Step 1: Convert bento format to unified Recipe format
  const convertedBentoRecipes = useMemo(() => {
    if (!bentoRecipes) return [];
    return bentoRecipes.map(r => ({
      id: r._id,
      title: r.title,
      imageUrl: r.imageUrl,
      cuisine: r.cuisine,
      saves: r.saves,
      rating: r.rating,
      createdAt: r._creationTime,
    }));
  }, [bentoRecipes]);

  // Step 2: Merge sources
  const allRecipes = useMemo(() => {
    return [...socialRecipes, ...convertedBentoRecipes];
  }, [socialRecipes, convertedBentoRecipes]);

  // Step 3: Sort and filter — only recomputes when sort/filter/data changes
  const sortedRecipes = useMemo(() => {
    let sorted = [...allRecipes];

    if (filterCuisine !== 'all') {
      sorted = sorted.filter(r => r.cuisine === filterCuisine);
    }

    switch (sortBy) {
      case 'popular': return sorted.sort((a, b) => (b.saves || 0) - (a.saves || 0));
      case 'rating': return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest': return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      default: return sorted;
    }
  }, [allRecipes, sortBy, filterCuisine]);

  return (
    <div>
      {sortedRecipes.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}
    </div>
  );
};
```

---

## Memoizing Structured Data for SEO

### Code Example

```typescript
// components/AcademySEOCollectionPage.tsx
import React, { useMemo } from 'react';

const AcademySEOCollectionPage: React.FC<{ collection: Collection | null }> = ({ collection }) => {
  // Memoize JSON-LD structured data — handles null gracefully
  const structuredData = useMemo(() => {
    if (!collection) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: collection.title,
      description: collection.description,
      numberOfItems: collection.items?.length || 0,
      itemListElement: collection.items?.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        url: `https://bistrolens.com/academy/${item.slug}`,
      })),
    };
  }, [collection]);

  return (
    <>
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
      {/* rest of component */}
    </>
  );
};
```

---

## Stable Callbacks with useCallback

### Code Example

```typescript
// components/CookingView.tsx
import React, { useState, useCallback } from 'react';

const CookingView: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timers, setTimers] = useState<Timer[]>([]);

  const isDoneScreen = currentStepIndex >= recipe.steps.length;
  const isFirstStep = currentStepIndex === 0;

  // Stable references — won't cause child re-renders
  const handleNextStep = useCallback(() => {
    if (isDoneScreen) return;
    playClickSound();
    setCurrentStepIndex(prev => prev + 1); // Functional updater avoids stale closure
  }, [isDoneScreen]); // Only recreate when isDoneScreen changes

  const handlePrevStep = useCallback(() => {
    if (isFirstStep) return;
    playClickSound();
    setCurrentStepIndex(prev => prev - 1);
  }, [isFirstStep]);

  // No deps needed — functional updater doesn't close over state
  const deleteTimer = useCallback((id: number) => {
    playClickSound();
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleAddTimer = useCallback((minutes: number, label: string) => {
    playSuccessSound();
    setTimers(prev => [...prev, { id: Date.now(), minutes, label }]);
  }, []);

  return (
    <div>
      <StepNavigation
        onNext={handleNextStep}  // Stable reference — StepNavigation won't re-render
        onPrev={handlePrevStep}
        isFirst={isFirstStep}
        isDone={isDoneScreen}
      />
      <TimerList timers={timers} onDelete={deleteTimer} />
    </div>
  );
};
```

---

## Memoizing Context-Derived Values

### Code Example

```typescript
// components/IngredientSwapSheet.tsx
import React, { useMemo, useContext } from 'react';
import { SettingsContext } from '../contexts';

const IngredientSwapSheet: React.FC = () => {
  const context = useContext(SettingsContext);

  // Memoize slices of context to avoid re-renders when unrelated settings change
  const dietaryPreferences = useMemo(() => {
    return context?.settings?.profile?.dietaryPreferences || [];
  }, [context?.settings?.profile?.dietaryPreferences]);

  const allergies = useMemo(() => {
    return context?.settings?.profile?.allergies || [];
  }, [context?.settings?.profile?.allergies]);

  // Now dietaryPreferences and allergies are stable references
  // unless the actual values change
  return (
    <div>
      {/* Uses stable references */}
    </div>
  );
};
```

---

## Refresh Key Pattern for Manual Cache Invalidation

### Code Example

```typescript
// hooks/useFreemium.ts
const useFreemium = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // usageStats recomputes when refreshKey increments
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const usageStats = useMemo(() => freemiumService.getUsageStats(), [refreshKey]);

  const recordRecipe = useCallback(() => {
    freemiumService.recordRecipeGeneration();
    refresh(); // Invalidate usageStats cache
  }, [refresh]);

  return { usageStats, recordRecipe };
};
```

---

## Performance Measurement

### Code Example

```typescript
// utils/performanceOptimizer.ts
export class PerformanceMonitor {
  // Measure synchronous render time
  measureRender<T>(componentName: string, renderFunc: () => T): T {
    const start = performance.now();
    const result = renderFunc();
    const end = performance.now();
    this.recordMetric(`render_${componentName}`, end - start);
    return result;
  }

  // Measure async operations
  async measureAsync<T>(operationName: string, asyncFunc: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await asyncFunc();
      this.recordMetric(`async_${operationName}`, performance.now() - start);
      return result;
    } catch (error) {
      this.recordMetric(`async_${operationName}_error`, performance.now() - start);
      throw error;
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Usage
const result = performanceMonitor.measureRender('RecipeCard', () => {
  return processRecipeData(recipe);
});
```

---

## Collecting Image URLs for Prefetch (useMemo + useImagePrefetch)

### Code Example

```typescript
// components/BentoRecipeLibrary.tsx
import { useMemo } from 'react';
import { useImagePrefetch } from '../hooks/useImagePrefetch';

const BentoRecipeLibrary: React.FC = () => {
  const bentoRecipes = useQuery(api.bentoDataset.getTopRecipes);

  // Memoize URL collection — avoids re-running on unrelated renders
  const heroImageUrls = useMemo(() => {
    if (!bentoRecipes) return [];
    return bentoRecipes
      .map(r => r.imageUrl)
      .filter(Boolean) as string[];
  }, [bentoRecipes]);

  // Pass stable array reference to prefetch hook
  useImagePrefetch(heroImageUrls, { maxImagesPerRecipe: 6 });

  return <div>{/* recipe cards */}</div>;
};
```

---

## Anti-Patterns

### ❌ Don't Do This — useMemo with no deps (pointless)

```typescript
// Bad: recomputes on every render — same as no memo
const value = useMemo(() => expensiveComputation(), []);
// If the computation depends on props/state, those must be in the deps array
```

### ✅ Do This Instead

```typescript
// Good: include all values the computation depends on
const value = useMemo(() => expensiveComputation(data, filter), [data, filter]);
```

---

### ❌ Don't Do This — useCallback with missing deps

```typescript
// Bad: stale closure — count is always 0
const handleClick = useCallback(() => {
  console.log(count); // Always logs 0!
}, []); // Missing: count
```

### ✅ Do This Instead

```typescript
// Good option 1: add count to deps
const handleClick = useCallback(() => {
  console.log(count);
}, [count]);

// Good option 2: use functional updater to avoid the dep entirely
const handleIncrement = useCallback(() => {
  setCount(prev => prev + 1); // No need for count in deps
}, []);
```

---

### ❌ Don't Do This — Memoizing cheap operations

```typescript
// Bad: useMemo overhead > computation cost for simple operations
const doubled = useMemo(() => value * 2, [value]);
```

### ✅ Do This Instead

```typescript
// Good: just compute inline for cheap operations
const doubled = value * 2;
```

---

## When to Use This Pattern

✅ **Use `useMemo` for:**
- Filtering/sorting large arrays
- Converting data formats (e.g., Convex records → UI types)
- Generating structured data (JSON-LD, chart data)
- Slicing context values to prevent over-rendering

✅ **Use `useCallback` for:**
- Event handlers passed as props to child components
- Functions passed to `useEffect` deps
- Functions used in other hooks' deps arrays

❌ **Don't use for:**
- Simple arithmetic or string operations
- Functions that are only called in the same component (no children)
- When the component re-renders infrequently anyway

---

## Benefits

1. Prevents expensive recomputation on unrelated state changes
2. Stable callback references prevent child components from re-rendering unnecessarily
3. Functional state updaters eliminate stale closure bugs without adding deps
4. Refresh key pattern provides explicit cache invalidation without complex dependency tracking

---

## Related Patterns

- See `../13-state-management/local-state.md` for the full local state management approach
- See `code-splitting.md` for reducing the amount of JS that runs
- See `image-optimization.md` for the `useMemo` + `useImagePrefetch` combination
- See `../02-react-patterns/memo-optimization.md` for `React.memo` on components

---

*Extracted: 2026-02-18*
