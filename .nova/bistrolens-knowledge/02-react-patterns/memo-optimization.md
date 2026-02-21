# Memo Optimization Patterns

## Source
Extracted from BistroLens `components/MealPrepBatchingCard.tsx`, `components/GrillMaster.tsx`, `components/CookingView.tsx`, `components/SkillProfile.tsx`, `components/Hero.tsx`, `components/CocktailSearchByIngredients.tsx`

---

## Pattern: useMemo for Expensive Derivations

BistroLens uses `useMemo` to avoid recomputing expensive derived values on every render, and `useCallback` to stabilize function references passed as props or used in dependency arrays.

---

## useMemo — Derived Data

### Code Example — Multiple Chained Memos

```typescript
import React, { useState, useMemo } from 'react';
import { Recipe, MealPlan } from '../types';
import {
  analyzeRecipesForPrepTasks,
  calculateTimeSaved,
  getPrepSchedule,
} from '../utils/prepBatching';

const MealPrepBatchingCard: React.FC<{ mealPlan: MealPlan }> = ({ mealPlan }) => {
  // Step 1: Extract recipes from the meal plan object
  const recipes = useMemo(() => {
    if (!mealPlan) return [];
    return Object.values(mealPlan)
      .filter((item): item is { recipe: Recipe; source: string } =>
        item !== null && item !== undefined && 'recipe' in item
      )
      .map(item => item.recipe);
  }, [mealPlan]); // Only recomputes when mealPlan changes

  // Step 2: Analyze recipes (depends on recipes memo)
  const prepTasks = useMemo(() => {
    return analyzeRecipesForPrepTasks(recipes);
  }, [recipes]);

  // Step 3: Derive time saved (depends on prepTasks memo)
  const timeSaved = useMemo(() => {
    return calculateTimeSaved(prepTasks);
  }, [prepTasks]);

  // Step 4: Build schedule (depends on prepTasks memo)
  const schedule = useMemo(() => {
    return getPrepSchedule(prepTasks);
  }, [prepTasks]);

  return <div>{/* render using prepTasks, timeSaved, schedule */}</div>;
};
```

### Code Example — Filtering with useMemo

```typescript
const SkillProfile: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');

  // Expensive computations memoized at component level
  const progress = useMemo(() => getOverallProgress(), []);
  const userSkills = useMemo(() => getUserSkills(), []);
  const userAchievements = useMemo(() => getUserAchievements(), []);
  const recommendations = useMemo(() => getSkillRecommendations(3), []);

  // Filtered list — recomputes only when category or skills change
  const filteredSkills = useMemo(() => {
    if (selectedCategory === 'all') return SKILLS;
    return SKILLS.filter(s => s.category === selectedCategory);
  }, [selectedCategory]); // SKILLS is a module constant, no need in deps

  return <div>{filteredSkills.map(skill => <SkillCard key={skill.id} skill={skill} />)}</div>;
};
```

---

## useCallback — Stable Function References

### Code Example — Event Handlers in Loops

```typescript
import React, { useState, useCallback } from 'react';

const GrillMaster: React.FC = () => {
  const [activeSession, setActiveSession] = useState<GrillSession | null>(null);

  // Stable reference — won't cause child re-renders
  const handleFlip = useCallback((itemId: string) => {
    playSuccessSound();
    setActiveSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map(item =>
          item.id === itemId
            ? { ...item, status: 'resting', flippedAt: new Date() }
            : item
        ),
      };
    });
  }, []); // No deps — uses functional setState, no stale closure risk

  const handleDone = useCallback((itemId: string) => {
    playSuccessSound();
    setActiveSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map(item =>
          item.id === itemId ? { ...item, status: 'done' } : item
        ),
      };
    });
  }, []);

  const handleComplete = useCallback(() => {
    playSuccessSound();
    setActiveSession(null);
  }, []);

  return (
    <div>
      {activeSession?.items.map(item => (
        <GrillItem
          key={item.id}
          item={item}
          onFlip={handleFlip}   // Stable reference
          onDone={handleDone}   // Stable reference
        />
      ))}
      <button onClick={handleComplete}>Complete Session</button>
    </div>
  );
};
```

### Code Example — useCallback with Dependencies

```typescript
const CocktailSearchByIngredients: React.FC = () => {
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [customIngredient, setCustomIngredient] = useState('');

  const toggleIngredient = useCallback((ingredient: string) => {
    playClickSound();
    setSelectedIngredients(prev =>
      prev.includes(ingredient)
        ? prev.filter(i => i !== ingredient)
        : [...prev, ingredient]
    );
  }, []); // No deps — functional update avoids stale closure

  const addCustomIngredient = useCallback(() => {
    if (customIngredient.trim() && !selectedIngredients.includes(customIngredient.trim())) {
      playClickSound();
      setSelectedIngredients(prev => [...prev, customIngredient.trim()]);
      setCustomIngredient('');
    }
  }, [customIngredient, selectedIngredients]); // Needs current values

  const removeIngredient = useCallback((ingredient: string) => {
    playClickSound();
    setSelectedIngredients(prev => prev.filter(i => i !== ingredient));
  }, []); // No deps — functional update

  return <div>{/* ... */}</div>;
};
```

---

## useCallback in Custom Hooks

```typescript
// Custom hook with stable callback
function useAutoResizeTextarea({ minHeight, maxHeight }: { minHeight: number; maxHeight?: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback((reset?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (reset) {
      textarea.style.height = `${minHeight}px`;
      return;
    }
    textarea.style.height = `${minHeight}px`;
    const newHeight = Math.max(
      minHeight,
      Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
    );
    textarea.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]); // Stable unless min/max change

  return { textareaRef, adjustHeight };
}
```

---

## useMemo for Static Data on Mount

When a value should be computed once and never change:

```typescript
const ToolsPage: React.FC = () => {
  // Computed once on mount — random tip stays stable during page visit
  const proTip = useMemo(() => getRandomProTip(), []);

  return <div className="tip">{proTip}</div>;
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Memoizing cheap operations — overhead outweighs benefit
const doubled = useMemo(() => value * 2, [value]); // ❌ too cheap

// useCallback on every function regardless of need
const handleClick = useCallback(() => {
  setOpen(true); // ❌ not passed as prop, no benefit
}, []);

// Missing deps in useMemo — stale data
const filtered = useMemo(() => {
  return items.filter(i => i.category === selectedCategory);
}, []); // ❌ selectedCategory not in deps — always stale

// Inline object/array in JSX (creates new reference every render)
<Component options={{ color: 'red' }} /> // ❌ new object every render
```

### ✅ Do This Instead

```typescript
// Only memoize expensive operations
const prepTasks = useMemo(() => analyzeRecipesForPrepTasks(recipes), [recipes]); // ✅ expensive

// useCallback when passing to child components or using in deps
const handleFlip = useCallback((id: string) => {
  setSession(prev => updateItem(prev, id)); // ✅ passed to child
}, []);

// Include all deps
const filtered = useMemo(() => {
  return items.filter(i => i.category === selectedCategory);
}, [items, selectedCategory]); // ✅ all deps listed

// Stable reference with useMemo
const options = useMemo(() => ({ color: 'red' }), []); // ✅ stable
<Component options={options} />
```

---

## When to Use This Pattern

✅ **Use useMemo for:**
- Filtering/sorting large arrays
- Complex object transformations
- Chained derivations (result A feeds into result B)
- Values computed from expensive service calls
- Static data computed once on mount

✅ **Use useCallback for:**
- Functions passed as props to child components
- Functions used in `useEffect` dependency arrays
- Event handlers in lists (to prevent child re-renders)
- Functions in custom hooks returned to consumers

❌ **Don't use either for:**
- Simple arithmetic or string operations
- Functions that are only called locally (not passed down)
- State setters (already stable from React)

---

## Benefits

1. Prevents expensive re-computations on unrelated state changes
2. Stable `useCallback` references prevent unnecessary child re-renders
3. Chained `useMemo` values update efficiently — only recompute what changed
4. Empty-dep `useMemo` is a clean way to compute once-on-mount values

---

## Related Patterns

- See `component-structure.md` for where to place memos in a component
- See `effect-patterns.md` for when to use `useEffect` vs `useMemo` for derived data
- See `../14-performance/render-optimization.md` in `14-performance/` for `React.memo` on components

---

*Extracted: 2026-02-18*
