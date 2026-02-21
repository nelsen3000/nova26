# Global State Patterns

## Source
Extracted from BistroLens `App.tsx`, `contexts.ts`, `hooks/useSubscription.ts`, `hooks/useFreemium.ts`

---

## Pattern: Centralized App State with Context + Hooks

BistroLens manages global state through a combination of React Context (for settings) and custom hooks that encapsulate service-layer state (subscription tier, freemium limits). There is no Redux or Zustand — state lives in the root `App` component and is distributed via context.

---

## App-Level State Shape

### Code Example

```typescript
// App.tsx — all global state declared at root
const App: React.FC = () => {
  // Core app state
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlan>({});
  const [nutritionLog, setNutritionLog] = useState<NutritionLogEntry[]>([]);

  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // UI state
  const [currentView, setCurrentView] = useState<ViewType>('finder');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Settings (persisted to localStorage + cloud)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettingsFromStorage());

  // Provide settings globally via context
  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {/* All views rendered here */}
    </SettingsContext.Provider>
  );
};
```

---

## Subscription State Hook

The subscription tier is global state managed by a custom hook that reads from a service and caches in localStorage to prevent flash on load.

### Code Example

```typescript
// hooks/useSubscription.ts
import { useState, useEffect, useCallback } from 'react';
import { getUserSubscription, SubscriptionTier } from '../services/subscriptionService';

interface UseSubscriptionReturn {
  tier: SubscriptionTier;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useSubscription = (): UseSubscriptionReturn => {
  const [tier, setTier] = useState<SubscriptionTier>(() => {
    // Initialize from localStorage to prevent flash of wrong tier
    try {
      const stored = localStorage.getItem('bistro_subscription');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.tier || 'free';
      }
    } catch {}
    return 'free';
  });
  const [loading, setLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const subscription = await getUserSubscription();
      const newTier = subscription?.tier || 'free';
      // Only update if tier actually changed — avoids unnecessary re-renders
      setTier(prev => (prev !== newTier ? newTier : prev));
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return { tier, loading, refresh: fetchSubscription };
};
```

---

## Freemium Feature Gate Hook

Composes `useSubscription` to expose feature-level access checks as a single hook.

### Code Example

```typescript
// hooks/useFreemium.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { freemiumService, FeatureCheckResult, FEATURE_LIMITS } from '../services/freemiumService';
import { useSubscription } from './useSubscription';

export const useFreemium = () => {
  const { tier } = useSubscription();
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync tier with the service singleton
  useEffect(() => {
    freemiumService.setTier(tier);
  }, [tier]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Memoize usage stats — only recompute when tier or refreshKey changes
  const usageStats = useMemo(() => {
    return freemiumService.getUsageStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, tier]);

  // Feature checks — stable references via useCallback
  const checkRecipe = useCallback(() => freemiumService.checkRecipeGeneration(), [tier]);
  const checkVoice = useCallback(() => freemiumService.checkVoiceCommand(), [tier]);

  // Record usage and trigger re-render
  const recordRecipe = useCallback(() => {
    freemiumService.recordRecipeGeneration();
    refresh();
  }, [refresh]);

  return {
    tier,
    isPremium: tier === 'premium' || tier === 'chef_master',
    isChefMaster: tier === 'chef_master',
    usageStats,
    checkRecipe,
    checkVoice,
    recordRecipe,
    limits: freemiumService.getLimits(),
    refresh,
  };
};
```

---

## Auth State Pattern

Auth state is initialized once and distributed via local state in App, not via context. Components receive `isAuthenticated` and `currentUser` as props.

### Code Example

```typescript
// App.tsx — auth initialization
useEffect(() => {
  const user = initializeAuth();
  setCurrentUser(user);
  setIsAuthenticated(!!user);

  // Subscribe to auth changes (e.g., login/logout)
  const unsubscribe = onAuthStateChange((user) => {
    setCurrentUser(user);
    setIsAuthenticated(!!user);
  });

  return unsubscribe; // Cleanup on unmount
}, []);
```

---

## Anti-Patterns

### ❌ Don't Do This — Storing derived state

```typescript
// Bad: isPremium is derived from tier, don't store it separately
const [tier, setTier] = useState('free');
const [isPremium, setIsPremium] = useState(false); // redundant!

useEffect(() => {
  setIsPremium(tier === 'premium');
}, [tier]);
```

### ✅ Do This Instead

```typescript
// Good: derive isPremium inline or in the hook return value
const { tier } = useSubscription();
const isPremium = tier === 'premium' || tier === 'chef_master';
```

---

### ❌ Don't Do This — Triggering re-renders on unchanged state

```typescript
// Bad: always sets state even if value didn't change
setTier(newTier); // causes re-render even if tier === newTier
```

### ✅ Do This Instead

```typescript
// Good: guard against unnecessary re-renders
setTier(prev => (prev !== newTier ? newTier : prev));
```

---

## When to Use This Pattern

✅ **Use for:**
- App-wide state that many components need (auth, settings, subscription tier)
- State that changes infrequently
- Feature flags and access control

❌ **Don't use for:**
- Component-local UI state (open/closed modals, form values)
- Server data — use Convex `useQuery` for real-time data
- High-frequency updates

---

## Benefits

1. No external state library needed — React's built-in primitives are sufficient
2. Custom hooks encapsulate service calls and caching logic
3. localStorage initialization prevents flash of wrong state on load
4. `useCallback` with dependency arrays prevents stale closures

---

## Related Patterns

- See `context-patterns.md` for the SettingsContext implementation
- See `local-state.md` for component-scoped state
- See `state-persistence.md` for localStorage/IndexedDB persistence
- See `../06-data-fetching/usequery-patterns.md` for server state via Convex

---

*Extracted: 2026-02-18*
