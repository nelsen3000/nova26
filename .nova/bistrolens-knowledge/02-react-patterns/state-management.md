# State Management Patterns

## Source
Extracted from BistroLens `App.tsx`, `components/GrillMaster.tsx`, `components/MealPrepBatchingCard.tsx`, `components/FilterPanel.tsx`, `contexts.ts`

---

## Pattern: useState with Typed Initial State

BistroLens uses `useState` extensively with TypeScript generics and lazy initializers for expensive computations.

---

## Basic useState Patterns

### Code Example — Typed State

```typescript
import React, { useState } from 'react';
import { Recipe, GrillSession } from '../types';

const GrillMaster: React.FC = () => {
  // Primitive state
  const [selectedCut, setSelectedCut] = useState('steak');
  const [thickness, setThickness] = useState(1);

  // Nullable object state — use null as initial value
  const [activeSession, setActiveSession] = useState<GrillSession | null>(null);
  const [cookResult, setCookResult] = useState<CookTimeResult | null>(null);

  // Boolean flags
  const [showSetup, setShowSetup] = useState(false);

  // Map state (for timer tracking)
  const [activeTimers, setActiveTimers] = useState<Map<string, number>>(new Map());
};
```

### Code Example — Lazy Initializer for Expensive State

When initial state requires computation (e.g., reading from localStorage), use a function:

```typescript
const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaultSettings: AppSettings = {
      fontSize: 'base',
      mode: 'food',
      theme: 'light',
      profile: { name: '', dietaryPreferences: [], allergies: [] },
      pantry: [],
      // ... more defaults
    };

    try {
      const saved = safeLocalStorageGet('bistroLensSettings', null) as any;
      if (saved && typeof saved === 'object') {
        return {
          ...defaultSettings,
          ...saved,
          // Deep merge nested objects
          profile: { ...defaultSettings.profile, ...(saved.profile || {}) },
          pantry: Array.isArray(saved.pantry) ? saved.pantry : defaultSettings.pantry,
        };
      }
    } catch (e) {
      console.error('Failed to load settings, using defaults', e);
    }

    return defaultSettings;
  });
};
```

---

## Functional State Updates

When new state depends on previous state, always use the functional form:

```typescript
// ✅ Correct — functional update avoids stale closure
const handleFlip = useCallback((itemId: string) => {
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
}, []);

// ✅ Correct — Set state with functional update
const handleTaskCheck = (taskId: string) => {
  setCheckedTasks(prev => {
    const next = new Set(prev);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    return next;
  });
};

// ✅ Correct — Map state with functional update
setActiveTimers(prev => {
  const newTimers = new Map(prev);
  for (const item of activeSession.items) {
    if (item.status === 'cooking' && item.startedAt) {
      const elapsed = Math.floor((Date.now() - item.startedAt.getTime()) / 1000);
      newTimers.set(item.id, elapsed);
    }
  }
  return newTimers;
});
```

---

## Context for Shared State

BistroLens uses React Context for app-wide settings shared across the component tree:

```typescript
// contexts.ts — define the context shape
import React from 'react';
import { AppSettings } from './types';

export const SettingsContext = React.createContext<{
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
} | null>(null);

// App.tsx — provide the context
const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(/* ... */);

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {/* children */}
    </SettingsContext.Provider>
  );
};

// Any child component — consume the context
import { useContext } from 'react';
import { SettingsContext } from '../contexts';

const Hero: React.FC = () => {
  const context = useContext(SettingsContext);
  const settings = context?.settings;
  const setSettings = context?.setSettings;

  // Guard against null context
  if (!context) return null;

  return <div>{settings?.mode}</div>;
};
```

---

## State Grouping Strategy

BistroLens groups related state declarations together by concern:

```typescript
const App: React.FC = () => {
  // --- Recipe state ---
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [previewRecipe, setPreviewRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- Auth state ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // --- UI state ---
  const [showProfile, setShowProfile] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('finder');

  // --- Conversion Engine state ---
  const [showSaveGateModal, setShowSaveGateModal] = useState(false);
  const [saveGateResult, setSaveGateResult] = useState<GateResult | null>(null);
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Reading state directly in update (stale closure risk)
const handleAdd = () => {
  setCount(count + 1); // ❌ count may be stale
};

// Storing derived data in state
const [filteredItems, setFilteredItems] = useState([]);
useEffect(() => {
  setFilteredItems(items.filter(i => i.active)); // ❌ use useMemo instead
}, [items]);

// Mutating state directly
const handleUpdate = () => {
  settings.theme = 'dark'; // ❌ never mutate state
  setSettings(settings);
};
```

### ✅ Do This Instead

```typescript
// Functional update for derived state
const handleAdd = () => {
  setCount(prev => prev + 1); // ✅ always fresh value
};

// Derive data with useMemo, not state
const filteredItems = useMemo(
  () => items.filter(i => i.active),
  [items]
);

// Spread to create new object
const handleUpdate = () => {
  setSettings(prev => ({ ...prev, theme: 'dark' })); // ✅ new reference
};
```

---

## When to Use This Pattern

✅ **Use useState for:**
- Local UI state (open/closed, selected item, loading flags)
- Form field values
- Data fetched for this component only

✅ **Use Context for:**
- App-wide settings (theme, user preferences)
- Auth state shared across many components
- Data that many unrelated components need

❌ **Don't use Context for:**
- State that only 2-3 closely related components need (prop drilling is fine)
- Frequently changing values (causes re-renders across the tree)

---

## Benefits

1. Lazy initializers prevent expensive localStorage reads on every render
2. Functional updates eliminate stale closure bugs
3. Context avoids prop drilling for truly global state
4. Grouping state by concern makes components easier to read

---

## Related Patterns

- See `component-structure.md` for where to place state declarations
- See `effect-patterns.md` for syncing state to localStorage
- See `memo-optimization.md` for deriving data from state without extra state
- See `../13-state-management/context-patterns.md` in `13-state-management/` for advanced context usage

---

*Extracted: 2026-02-18*
