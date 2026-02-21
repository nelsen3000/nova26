# Local State Patterns

## Source
Extracted from BistroLens `components/CookingView.tsx`, `components/SkillProfile.tsx`, `components/TopRecipesView.tsx`, `components/SmartNotificationCenter.tsx`, `hooks/useFreemium.ts`

---

## Pattern: Component-Scoped State with Memoization

BistroLens uses local `useState` for UI state that doesn't need to be shared, and `useMemo`/`useCallback` to avoid expensive recomputation and unnecessary re-renders.

---

## Basic Local State

### Code Example

```typescript
// components/SmartNotificationCenter.tsx
import React, { useState, useCallback } from 'react';

const SmartNotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Stable callback reference — won't cause child re-renders
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []); // No deps: uses functional updater, doesn't close over stale state

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <div>
      {notifications.map(n => (
        <div key={n.id}>
          <span>{n.title}</span>
          <button onClick={() => markAsRead(n.id)}>Mark read</button>
          <button onClick={() => deleteNotification(n.id)}>Delete</button>
        </div>
      ))}
      <button onClick={markAllAsRead}>Mark all read</button>
      <button onClick={clearAll}>Clear all</button>
    </div>
  );
};
```

---

## Memoized Derived State

Use `useMemo` for values derived from props or state that are expensive to compute.

### Code Example

```typescript
// components/SkillProfile.tsx
import React, { useState, useMemo } from 'react';
import { getUserSkills, getUserAchievements, getOverallProgress, getSkillRecommendations, getSkillHistory } from '../services/skillProgressionService';

const SkillProfile: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');

  // Computed once on mount — these don't change during the component's lifetime
  const progress = useMemo(() => getOverallProgress(), []);
  const userSkills = useMemo(() => getUserSkills(), []);
  const userAchievements = useMemo(() => getUserAchievements(), []);
  const recommendations = useMemo(() => getSkillRecommendations(3), []);
  const history = useMemo(() => getSkillHistory().slice(0, 10), []);

  // Recomputed only when selectedCategory changes
  const filteredSkills = useMemo(() => {
    if (selectedCategory === 'all') return SKILLS;
    return SKILLS.filter(s => s.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div>
      <p>Progress: {progress.percentage}%</p>
      <select onChange={e => setSelectedCategory(e.target.value as SkillCategory)}>
        <option value="all">All</option>
        {/* categories */}
      </select>
      {filteredSkills.map(skill => (
        <div key={skill.id}>{skill.name}</div>
      ))}
    </div>
  );
};
```

---

## Complex Local State with Multiple Derived Values

### Code Example

```typescript
// components/TopRecipesView.tsx
import React, { useState, useContext, useMemo } from 'react';
import { useQuery } from 'convex/react';

const TopRecipesView: React.FC = () => {
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest'>('popular');
  const [filterCuisine, setFilterCuisine] = useState<string>('all');

  const bentoRecipes = useQuery(api.bentoDataset.getTopRecipes);
  const socialRecipes = getTopSocialRecipes();

  // Convert bento recipes to unified Recipe format
  const convertedBentoRecipes = useMemo(() => {
    if (!bentoRecipes) return [];
    return bentoRecipes.map(r => ({
      id: r._id,
      title: r.title,
      imageUrl: r.imageUrl,
      // ... other fields
    }));
  }, [bentoRecipes]);

  // Combine sources
  const allRecipes = useMemo(() => {
    return [...socialRecipes, ...convertedBentoRecipes];
  }, [socialRecipes, convertedBentoRecipes]);

  // Sort and filter — recomputes only when deps change
  const sortedRecipes = useMemo(() => {
    let sorted = [...allRecipes];

    if (filterCuisine !== 'all') {
      sorted = sorted.filter(r => r.cuisine === filterCuisine);
    }

    switch (sortBy) {
      case 'popular':
        return sorted.sort((a, b) => (b.saves || 0) - (a.saves || 0));
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest':
        return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      default:
        return sorted;
    }
  }, [allRecipes, sortBy, filterCuisine]);

  return (
    <div>
      <select onChange={e => setSortBy(e.target.value as any)}>
        <option value="popular">Most Popular</option>
        <option value="rating">Top Rated</option>
        <option value="newest">Newest</option>
      </select>
      {sortedRecipes.map(recipe => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
};
```

---

## Stable Callbacks in Event Handlers

### Code Example

```typescript
// components/CookingView.tsx
import React, { useState, useCallback } from 'react';

const CookingView: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timers, setTimers] = useState<Timer[]>([]);

  const isDoneScreen = currentStepIndex >= recipe.steps.length;
  const isFirstStep = currentStepIndex === 0;

  // useCallback prevents re-creating these on every render
  // Deps array ensures they update when relevant state changes
  const handleNextStep = useCallback(() => {
    if (isDoneScreen) return;
    playClickSound();
    setCurrentStepIndex(prev => prev + 1);
  }, [isDoneScreen]);

  const handlePrevStep = useCallback(() => {
    if (isFirstStep) return;
    playClickSound();
    setCurrentStepIndex(prev => prev - 1);
  }, [isFirstStep]);

  const deleteTimer = useCallback((id: number) => {
    playClickSound();
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []); // No deps: uses functional updater

  const handleAddTimer = useCallback((minutes: number, label: string) => {
    playSuccessSound();
    setTimers(prev => [...prev, { id: Date.now(), minutes, label }]);
  }, []);

  return (
    <div>
      <button onClick={handlePrevStep} disabled={isFirstStep}>Back</button>
      <p>Step {currentStepIndex + 1} of {recipe.steps.length}</p>
      <button onClick={handleNextStep} disabled={isDoneScreen}>Next</button>
    </div>
  );
};
```

---

## Refresh Key Pattern

Force a re-render of memoized values without changing their dependencies.

### Code Example

```typescript
// hooks/useFreemium.ts
const useFreemium = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // usageStats recomputes when refreshKey increments
  const usageStats = useMemo(() => {
    return freemiumService.getUsageStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const recordRecipe = useCallback(() => {
    freemiumService.recordRecipeGeneration();
    refresh(); // Trigger usageStats recomputation
  }, [refresh]);

  return { usageStats, recordRecipe, refresh };
};
```

---

## Anti-Patterns

### ❌ Don't Do This — Recreating callbacks on every render

```typescript
// Bad: new function reference on every render, breaks React.memo on children
const handleClick = () => {
  setCount(count + 1);
};
```

### ✅ Do This Instead

```typescript
// Good: stable reference, uses functional updater
const handleClick = useCallback(() => {
  setCount(prev => prev + 1);
}, []);
```

---

### ❌ Don't Do This — Expensive computation in render

```typescript
// Bad: runs on every render
const filteredItems = items.filter(i => i.active).sort((a, b) => a.name.localeCompare(b.name));
```

### ✅ Do This Instead

```typescript
// Good: only recomputes when items changes
const filteredItems = useMemo(
  () => items.filter(i => i.active).sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);
```

---

## When to Use This Pattern

✅ **Use for:**
- UI state that doesn't need to be shared (open/closed, selected tab, form values)
- Derived values from props or state that are expensive to compute
- Event handlers passed to child components (to prevent unnecessary re-renders)

❌ **Don't use for:**
- State that multiple sibling components need — lift it up or use context
- Server data — use Convex `useQuery`
- State that needs to survive component unmount — use localStorage or context

---

## Benefits

1. Keeps components self-contained and easy to test
2. `useMemo` prevents expensive recomputation on unrelated re-renders
3. `useCallback` with functional updaters avoids stale closure bugs
4. Refresh key pattern provides manual cache invalidation without complex deps

---

## Related Patterns

- See `context-patterns.md` for sharing state across the component tree
- See `global-state.md` for app-wide state
- See `../02-react-patterns/memo-optimization.md` for `React.memo` on components
- See `../02-react-patterns/effect-patterns.md` for side effects triggered by state changes

---

*Extracted: 2026-02-18*
