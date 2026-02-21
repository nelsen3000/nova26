# Effect Patterns

## Source
Extracted from BistroLens `components/NetworkStatus.tsx`, `components/GrillMaster.tsx`, `components/FilterPanel.tsx`, `App.tsx`, `components/AuthModal.tsx`

---

## Pattern: useEffect with Cleanup

BistroLens uses `useEffect` for side effects like event listeners, timers, and data fetching — always with proper cleanup to prevent memory leaks.

---

## Event Listener Pattern

The most common pattern: add listeners on mount, remove on unmount.

### Code Example

```typescript
import React, { useState, useEffect } from 'react';

const NetworkStatus: React.FC = () => {
  const [isConnected, setIsConnected] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsConnected(true);
    };

    const handleOffline = () => {
      setIsConnected(false);
    };

    const handleNetworkChange = (event: CustomEvent) => {
      const { isOnline: online } = event.detail;
      if (online) handleOnline();
      else handleOffline();
    };

    // Add listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('networkStatusChange', handleNetworkChange as EventListener);

    // ✅ Cleanup — always remove listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('networkStatusChange', handleNetworkChange as EventListener);
    };
  }, []); // Empty deps — runs once on mount
};
```

---

## Interval/Timer Pattern

Timers must be cleared in the cleanup function:

```typescript
const GrillMaster: React.FC = () => {
  const [activeSession, setActiveSession] = useState<GrillSession | null>(null);
  const [activeTimers, setActiveTimers] = useState<Map<string, number>>(new Map());

  // Timer tick — only runs when there's an active session
  useEffect(() => {
    if (!activeSession || activeSession.status === 'complete') return;

    const interval = setInterval(() => {
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
    }, 1000);

    // ✅ Cleanup — clear interval when session ends or component unmounts
    return () => clearInterval(interval);
  }, [activeSession]); // Re-runs when activeSession changes
};
```

---

## Derived Computation Effect

When inputs change, recompute a derived value:

```typescript
const GrillMaster: React.FC = () => {
  const [selectedCut, setSelectedCut] = useState('steak');
  const [thickness, setThickness] = useState(1);
  const [doneness, setDoneness] = useState<SteakDoneness>('medium');
  const [cookResult, setCookResult] = useState<CookTimeResult | null>(null);

  // Recompute cook time whenever inputs change
  useEffect(() => {
    const result = calculateCookTime(selectedCut, thickness, doneness, grillType, method);
    setCookResult(result);
  }, [selectedCut, thickness, doneness, grillType, method]);
  // Note: for pure derivations, useMemo is preferred over useEffect + setState
};
```

---

## Sync to External Storage

Persist state changes to localStorage or cloud:

```typescript
const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(/* ... */);

  // Sync settings to localStorage and cloud on change
  useEffect(() => {
    safeLocalStorageSet('bistroLensSettings', settings);

    if (isConvexConfigured() && isOnline && currentUser) {
      // Debounce cloud sync — don't hammer the API on every keystroke
      const timeout = setTimeout(() => syncSettingsToCloud(currentUser.id, settings), 2000);
      return () => clearTimeout(timeout); // ✅ Cancel pending sync on next change
    }
  }, [settings, isOnline, currentUser]);

  // Apply theme class to DOM
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);
};
```

---

## One-Time Initialization Effect

Run once on mount with an empty dependency array:

```typescript
const App: React.FC = () => {
  // Initialize services on mount
  useEffect(() => {
    initSentry();

    if (convex) {
      imageGovernance.setConvexClient(convex);
      imageStorageService.setConvexClient(convex);
    }

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            handleTabChange('finder');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // ✅ Empty array — runs once on mount
};
```

---

## Reset Effect on Prop Change

Clear state when a controlling prop changes:

```typescript
const AuthModal: React.FC<{ mode: 'signin' | 'signup' }> = ({ mode }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Clear error when switching between signin/signup modes
  useEffect(() => {
    setError(null);
    setIsLoading(false);
  }, [mode]); // Re-runs whenever mode changes
};
```

---

## Async Data Fetching in Effect

Fetch data on mount or when dependencies change:

```typescript
const HealthGuidanceModal: React.FC = () => {
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await healthService.getInsights();
        setInsights(data);
      } catch (err) {
        setError('Failed to load health insights');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
  }, []); // Fetch once on mount
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Missing cleanup — memory leak
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // ❌ No return cleanup!
}, []);

// Missing dependency — stale closure
useEffect(() => {
  doSomethingWith(value); // ❌ value not in deps array
}, []);

// Async function directly in useEffect
useEffect(async () => { // ❌ useEffect callback can't be async
  const data = await fetchData();
  setData(data);
}, []);

// Infinite loop — setting state that's in deps
useEffect(() => {
  setCount(count + 1); // ❌ count in deps causes infinite loop
}, [count]);
```

### ✅ Do This Instead

```typescript
// Always return cleanup
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize); // ✅
}, []);

// Include all dependencies
useEffect(() => {
  doSomethingWith(value);
}, [value]); // ✅

// Wrap async in inner function
useEffect(() => {
  const fetchData = async () => { // ✅ inner async function
    const data = await fetchSomething();
    setData(data);
  };
  fetchData();
}, []);

// Use functional update to avoid stale deps
useEffect(() => {
  const interval = setInterval(() => {
    setCount(prev => prev + 1); // ✅ no stale closure
  }, 1000);
  return () => clearInterval(interval);
}, []); // Empty deps is fine with functional update
```

---

## When to Use This Pattern

✅ **Use useEffect for:**
- Event listener registration/cleanup
- Timer setup/teardown
- DOM mutations (adding CSS classes)
- One-time initialization (services, analytics)
- Syncing state to external systems (localStorage, cloud)
- Fetching data on mount or when deps change

❌ **Don't use useEffect for:**
- Deriving data from state/props (use `useMemo` instead)
- Handling user events (use event handlers instead)
- Transforming data for render (compute inline or with `useMemo`)

---

## Benefits

1. Cleanup functions prevent memory leaks from lingering listeners and timers
2. Dependency arrays make side effect triggers explicit and auditable
3. Debounced cloud sync (via `setTimeout` + cleanup) prevents API hammering
4. Separating concerns into multiple small effects is easier to reason about

---

## Related Patterns

- See `memo-optimization.md` for `useMemo` as an alternative to effect + setState
- See `state-management.md` for the state that effects update
- See `custom-hooks` in `09-hooks/` for extracting reusable effect logic

---

*Extracted: 2026-02-18*
