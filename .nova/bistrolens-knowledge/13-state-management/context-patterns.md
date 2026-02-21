# Context Patterns

## Source
Extracted from BistroLens `contexts.ts` and `App.tsx`

---

## Pattern: Typed React Context with Null Safety

BistroLens uses a minimal `contexts.ts` file to define typed React contexts, then provides them at the app root. The context is initialized to `null` and consumers must check for null before use.

---

## Context Definition

### Code Example

```typescript
// contexts.ts
import React from 'react';
import { AppSettings } from './types';

export const SettingsContext = React.createContext<{
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
} | null>(null);
```

The context type is a union of the actual shape and `null`. This forces consumers to handle the uninitialized case explicitly.

---

## Context Provider (App Root)

### Code Example

```typescript
// App.tsx
import { SettingsContext } from './contexts';

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Lazy initializer: load from localStorage on first render
    const defaultSettings: AppSettings = {
      fontSize: 'base',
      mode: 'food',
      theme: 'light',
      drinkPreference: 'Alcoholic',
      profile: { name: '', dietaryPreferences: [], allergies: [], healthGoals: {}, kitchenEquipment: [] },
      pantry: [],
      voiceId: 'voice-uk-alistair',
      freezer: [],
      tasteProfile: { likes: [], dislikes: [] },
      challenges: {},
      tutorialMode: { level: 'beginner', focus: 'technique' },
      groceryList: [],
      defaultRecipeTone: 'Standard',
      defaultRecipeQualityFocus: 'Balanced',
      preparationStyle: 'From Scratch',
      defaultServings: 4,
      measurementSystem: 'Imperial',
      country: 'United States',
      soundEffects: true,
      keepScreenOn: true,
      recipeHistory: [],
      autoContribute: true,
    };

    try {
      const saved = safeLocalStorageGet('bistroLensSettings', null) as any;
      if (saved && typeof saved === 'object') {
        return {
          ...defaultSettings,
          ...saved,
          // Deep merge nested objects to avoid losing defaults
          challenges: { ...defaultSettings.challenges, ...(saved.challenges || {}) },
          tutorialMode: { ...defaultSettings.tutorialMode, ...(saved.tutorialMode || {}) },
          profile: {
            ...defaultSettings.profile,
            ...(saved.profile || {}),
            healthGoals: { ...defaultSettings.profile.healthGoals, ...(saved.profile?.healthGoals || {}) },
          },
          tasteProfile: { ...defaultSettings.tasteProfile, ...(saved.tasteProfile || {}) },
          pantry: Array.isArray(saved.pantry)
            ? saved.pantry.filter((i: any) => i && typeof i === 'object' && i.name)
            : defaultSettings.pantry,
          groceryList: Array.isArray(saved.groceryList) ? saved.groceryList : defaultSettings.groceryList,
          freezer: Array.isArray(saved.freezer) ? saved.freezer : defaultSettings.freezer,
          recipeHistory: Array.isArray(saved.recipeHistory) ? saved.recipeHistory : defaultSettings.recipeHistory,
        };
      }
    } catch (e) {
      console.error('Failed to load settings, using defaults', e);
    }

    return defaultSettings;
  });

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {/* rest of app */}
    </SettingsContext.Provider>
  );
};
```

---

## Context Consumer

### Code Example

```typescript
// Any component that needs settings
import React, { useContext } from 'react';
import { SettingsContext } from '../contexts';

const ToolsPage: React.FC = () => {
  const context = useContext(SettingsContext);

  // Guard: context is null when used outside the provider
  if (!context) return null;

  const { settings, setSettings } = context;

  const handleModeChange = (mode: 'food' | 'drinks') => {
    setSettings(prev => ({ ...prev, mode }));
  };

  return (
    <div>
      <p>Current mode: {settings.mode}</p>
      <button onClick={() => handleModeChange('drinks')}>Switch to Drinks</button>
    </div>
  );
};
```

---

## Anti-Patterns

### ❌ Don't Do This — Untyped context

```typescript
// Bad: no type safety, no null check
const MyContext = React.createContext({} as any);
```

### ✅ Do This Instead

```typescript
// Good: typed, nullable, forces consumers to handle uninitialized state
const MyContext = React.createContext<{ value: string; setValue: (v: string) => void } | null>(null);
```

---

### ❌ Don't Do This — Shallow merge on nested state

```typescript
// Bad: wipes out nested defaults when merging saved settings
setSettings(prev => ({ ...prev, ...savedSettings }));
```

### ✅ Do This Instead

```typescript
// Good: deep merge nested objects to preserve defaults
setSettings(prev => ({
  ...prev,
  ...savedSettings,
  profile: { ...prev.profile, ...(savedSettings.profile || {}) },
  tutorialMode: { ...prev.tutorialMode, ...(savedSettings.tutorialMode || {}) },
}));
```

---

## When to Use This Pattern

✅ **Use for:**
- App-wide settings that many components need (theme, user profile, mode)
- Avoiding prop drilling more than 2–3 levels deep
- State that changes infrequently (settings, auth user)

❌ **Don't use for:**
- High-frequency updates (every keystroke, animation frames) — use local state
- Server data — use Convex `useQuery` instead
- Deeply nested, complex state trees — consider `useReducer` + context

---

## Benefits

1. Single source of truth for app-wide settings
2. TypeScript enforces the shape at every consumer
3. Null initialization prevents silent bugs when used outside provider
4. Lazy `useState` initializer avoids re-reading localStorage on every render

---

## Related Patterns

- See `local-state.md` for component-scoped state
- See `global-state.md` for patterns that span multiple contexts
- See `state-persistence.md` for the localStorage persistence layer used here

---

*Extracted: 2026-02-18*
