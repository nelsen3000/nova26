# Component Structure Patterns

## Source
Extracted from BistroLens `components/RecipeFinder.tsx`, `components/GrillMaster.tsx`, `components/MealPrepBatchingCard.tsx`, `components/NetworkStatus.tsx`

---

## Pattern: Typed Functional Component with Props Interface

BistroLens uses a consistent structure for all React components: a TypeScript interface for props, a `React.FC<Props>` typed function, and co-located helper functions/hooks.

---

## Component Structure

### Code Example

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SomeIcon } from './Icons';
import { someService } from '../services/someService';
import { playClickSound } from '../utils/sound';

// 1. Props interface — always defined before the component
interface GrillMasterProps {
  onBack: () => void;
}

// 2. Module-level constants (static data, not state)
const CUTS = [
  { id: 'steak', name: 'Steak', icon: '🥩' },
  { id: 'chicken_breast', name: 'Chicken Breast', icon: '🍗' },
];

// 3. Co-located helper functions (pure, no hooks)
const findExpiringItems = (pantry: any[]): any[] => {
  const now = new Date();
  return pantry.filter(item => {
    const purchaseDate = new Date(item.purchaseDate);
    const daysSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24);
    return daysSincePurchase > 5;
  }).slice(0, 3);
};

// 4. Co-located custom hooks (when logic is reusable within the file)
function useAutoResizeTextarea({ minHeight, maxHeight }: { minHeight: number; maxHeight?: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = useCallback((reset?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (reset) { textarea.style.height = `${minHeight}px`; return; }
    textarea.style.height = `${minHeight}px`;
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY));
    textarea.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]);
  return { textareaRef, adjustHeight };
}

// 5. The component itself
const GrillMaster: React.FC<GrillMasterProps> = ({ onBack }) => {
  // 5a. State declarations (grouped by concern)
  const [selectedCut, setSelectedCut] = useState('steak');
  const [thickness, setThickness] = useState(1);
  const [activeSession, setActiveSession] = useState<GrillSession | null>(null);

  // 5b. Effects (after state)
  useEffect(() => {
    const result = calculateCookTime(selectedCut, thickness);
    setCookResult(result);
  }, [selectedCut, thickness]);

  // 5c. Callbacks (after effects)
  const handleStartCooking = useCallback(() => {
    playClickSound();
    // ... logic
  }, [selectedCut, thickness]);

  // 5d. Early returns for guard conditions
  if (!selectedCut) return null;

  // 5e. Render
  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
};

export default GrillMaster;
```

---

## Sub-Component Pattern

Small, focused sub-components are defined in the same file when they're only used by the parent:

```typescript
// Sub-component defined above the main component
const FusionBentoOverlay = ({
  isDrinksMode,
  drinkPreference,
}: {
  isDrinksMode: boolean;
  drinkPreference: string;
}) => {
  const [index, setIndex] = useState(0);
  const combos = isDrinksMode
    ? drinkPreference === 'Non-Alcoholic'
      ? ['Cucumber + Mint', 'Hibiscus + Ginger']
      : ['Gin + Basil', 'Tequila + Chili']
    : ['Italian + Japanese', 'Mexican + Thai'];

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-sm font-medium">{combos[index]}</span>
    </div>
  );
};

// Main component uses it
const RecipeFinder: React.FC<RecipeFinderProps> = ({ isDrinksMode, drinkPreference }) => {
  return (
    <div>
      <FusionBentoOverlay isDrinksMode={isDrinksMode} drinkPreference={drinkPreference} />
    </div>
  );
};
```

---

## Feature-Flag Guard Pattern

Components that are conditionally rendered based on feature flags return `null` early:

```typescript
const MealPrepBatchingCard: React.FC<MealPrepBatchingCardProps> = ({ mealPlan }) => {
  const prepTasks = useMemo(() => analyzeRecipesForPrepTasks(recipes), [recipes]);

  // Feature flag guard — return null if disabled or no data
  if (!ENABLE_PREP_BATCHING || prepTasks.length === 0) {
    return null;
  }

  return <div>{/* ... */}</div>;
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Untyped props
const MyComponent = (props) => {
  return <div>{props.title}</div>;
};

// Inline anonymous objects as props (causes re-renders)
<MyComponent style={{ color: 'red' }} onClick={() => doSomething()} />

// Mixing concerns — one giant component doing everything
const GodComponent = () => {
  // 200 lines of state, effects, and render logic all mixed together
};
```

### ✅ Do This Instead

```typescript
// Typed props interface
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ title, onAction }) => {
  return <div onClick={onAction}>{title}</div>;
};

// Stable references with useCallback
const handleClick = useCallback(() => doSomething(), []);
<MyComponent onAction={handleClick} />

// Split into focused sub-components
const GrillSetup: React.FC<SetupProps> = ({ ... }) => { /* setup UI */ };
const GrillSession: React.FC<SessionProps> = ({ ... }) => { /* active session UI */ };
const GrillMaster: React.FC<GrillMasterProps> = ({ onBack }) => {
  return activeSession ? <GrillSession /> : <GrillSetup />;
};
```

---

## When to Use This Pattern

✅ **Use for:**
- All React components in the project
- Components with more than 2-3 props
- Components that contain business logic
- Components that will be reused

❌ **Don't use for:**
- Tiny presentational components with 0-1 props (inline JSX is fine)

---

## Benefits

1. TypeScript catches prop mismatches at compile time
2. Consistent file structure makes navigation predictable
3. Co-located helpers are easy to find and test
4. Early returns keep the render path clean

---

## Related Patterns

- See `state-management.md` for useState/useReducer patterns
- See `effect-patterns.md` for useEffect organization
- See `memo-optimization.md` for useCallback/useMemo usage
- See `error-boundaries.md` for wrapping components safely

---

*Extracted: 2026-02-18*
