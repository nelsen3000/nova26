# useDebounce Hook

## Source
Extracted from BistroLens `components/GlobalSearch.tsx`, `components/IngredientSwapSheet.tsx`, and `App.tsx`

---

## Pattern: Debounce Hook for Delayed Execution

Debouncing delays the execution of a function until after a specified time has passed since the last invocation. BistroLens uses this pattern extensively for search queries, cloud sync, and any expensive operation that shouldn't fire on every keystroke or rapid state change.

The codebase uses two forms: **inline debounce** (via `useEffect` + `setTimeout`) for one-off cases, and a **reusable `useDebounce` hook** for shared logic.

---

## Core Implementation

### Pattern 1: Inline Debounce with useEffect

The primary pattern in BistroLens — used directly in `GlobalSearch.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { globalSearchService, SearchResult, SearchFilters } from '../services/globalSearchService';
import { analyticsService } from '../services/analyticsService';

const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  // Debounced search — waits 300ms after user stops typing before firing
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.trim()) {
        setIsLoading(true);
        try {
          const searchResults = await globalSearchService.search(query, filters);
          setResults(searchResults);
          analyticsService.trackSearch(query, searchResults.length, filters);
        } catch (error) {
          console.error('Search error:', error);
          analyticsService.trackError('search_failed', { query, error: error.message });
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300); // 300ms debounce delay

    // Cleanup: cancel the timeout if query or filters change before it fires
    return () => clearTimeout(searchTimeout);
  }, [query, filters]);

  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search recipes, ingredients, help..."
    />
  );
};
```

### Pattern 2: Debounced UX Delay (IngredientSwapSheet.tsx)

A short debounce used to create a smooth skeleton loading effect:

```typescript
import { useState, useEffect } from 'react';

// Load substitution suggestions when sheet opens
useEffect(() => {
  if (!isOpen || !ENABLE_INGREDIENT_SWAP) return;

  setIsLoading(true);
  setSelectedSwap(null);

  // Small delay for skeleton effect — avoids flash of empty state
  const timer = setTimeout(() => {
    const group = findSubstitutionGroup(ingredient);

    if (group) {
      const scored = scoreSubstitutions(group, dietaryPreferences, allergies);
      setSuggestions(scored);
    } else {
      setSuggestions([]);
    }

    setIsLoading(false);
  }, 150); // 150ms — just enough for skeleton to render

  return () => clearTimeout(timer);
}, [isOpen, ingredient, dietaryPreferences, allergies]);
```

### Pattern 3: Debounced Cloud Sync (App.tsx)

Debouncing expensive sync operations while saving locally immediately:

```typescript
import { useEffect } from 'react';
import { safeLocalStorageSet } from './utils/storageHelper';

// Save settings — local immediately, cloud debounced
useEffect(() => {
  // Cheap operation: save to localStorage right away
  safeLocalStorageSet('bistroLensSettings', settings);

  // Expensive operation: debounce cloud sync to batch rapid changes
  if (isConvexConfigured() && isOnline && currentUser) {
    const timeout = setTimeout(() => {
      syncSettingsToCloud(currentUser.id, settings);
    }, 2000); // 2 second delay — batches multiple rapid changes

    return () => clearTimeout(timeout);
  }
}, [settings, isOnline, currentUser]);
```

### Pattern 4: Reusable useDebounce Hook

Extract the pattern into a reusable hook for components that need it in multiple places:

```typescript
import { useEffect, useState } from 'react';

/**
 * Debounces a value — delays updates until after the specified delay.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

Usage:

```typescript
function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Only fires when user pauses typing for 300ms
  useEffect(() => {
    if (debouncedSearchTerm) {
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### Pattern 5: Debounced Callback Hook (useDebouncedCallback)

For debouncing function calls rather than values — useful in event handlers:

```typescript
import { useCallback, useRef } from 'react';

/**
 * Returns a debounced version of the callback.
 * Uses useRef to persist the timeout ID across renders.
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}
```

Usage:

```typescript
function FormComponent() {
  const [formData, setFormData] = useState<FormData>({});

  const saveToServer = async (data: FormData) => {
    await api.save(data);
  };

  const debouncedSave = useDebouncedCallback(saveToServer, 1000);

  const handleChange = (field: string, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);      // Immediate local update
    debouncedSave(updated);    // Debounced server save
  };

  return <input onChange={(e) => handleChange('name', e.target.value)} />;
}
```

---

## Anti-Patterns

### Don't: Forget the Cleanup Function

```typescript
// BAD: Memory leak — timeout fires even after component unmounts
useEffect(() => {
  setTimeout(() => {
    expensiveOperation(value);
  }, 500);
  // Missing return () => clearTimeout(...)
}, [value]);
```

### Do: Always Return the Cleanup

```typescript
// GOOD: Cancels timeout on unmount or before next effect run
useEffect(() => {
  const timeout = setTimeout(() => {
    expensiveOperation(value);
  }, 500);

  return () => clearTimeout(timeout);
}, [value]);
```

### Don't: Store Timeout ID in a Regular Variable

```typescript
// BAD: timeoutId is recreated on every render — can't reliably cancel
function BadComponent() {
  let timeoutId: ReturnType<typeof setTimeout>; // Wrong scope!

  const handleChange = (value: string) => {
    clearTimeout(timeoutId); // May clear the wrong timeout
    timeoutId = setTimeout(() => save(value), 500);
  };
}
```

### Do: Use useRef to Persist the Timeout ID

```typescript
// GOOD: Timeout ID persists across renders
function GoodComponent() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (value: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(value), 500);
  };
}
```

### Don't: Debounce Immediate UI Feedback

```typescript
// BAD: Debouncing a button label makes the UI feel broken
const debouncedLabel = useDebounce(buttonLabel, 500);
return <button>{debouncedLabel}</button>;
```

### Do: Only Debounce Expensive Background Operations

```typescript
// GOOD: UI updates immediately, API call is debounced
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearchTerm) fetchResults(debouncedSearchTerm);
}, [debouncedSearchTerm]);

return (
  <div>
    <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    <span>Searching for: {searchTerm}</span> {/* Immediate feedback */}
  </div>
);
```

### Don't: Use the Same Delay for All Operations

```typescript
// BAD: One-size-fits-all — search feels slow, sync fires too often
const debouncedSearch = useDebounce(searchTerm, 2000);
const debouncedSync = useDebounce(settings, 2000);
```

### Do: Tune Delay to the Use Case

```typescript
// GOOD: Delays matched to user expectations and operation cost
const debouncedSearch = useDebounce(searchTerm, 300);   // Fast: user expects quick results
const debouncedSync = useDebounce(settings, 2000);      // Slow: expensive cloud operation
```

---

## When to Use This Pattern

**Use for:**
- Search inputs — debounce API calls while user types (300-500ms)
- Autosave — delay server writes while user edits (1-2 seconds)
- Form validation — wait until user pauses before showing errors (500ms)
- Cloud sync — batch multiple local changes into one sync (2-3 seconds)
- Resize/scroll handlers — limit expensive recalculations (150-250ms)
- Analytics batching — reduce network requests for rapid events

**Don't use for:**
- Button clicks, toggles, selections — must respond instantly
- Form submissions, payments, deletions — need immediate processing
- Real-time features — chat messages, notifications can't be delayed
- Accessibility events — focus management and screen reader announcements need immediacy
- Simple local state updates that don't trigger expensive operations

---

## Recommended Delays by Use Case

| Use Case | Delay | Reasoning |
|---|---|---|
| Search input | 300-500ms | Responsive but reduces API calls |
| Autocomplete | 200-300ms | Needs to feel instant |
| Form validation | 500-800ms | Let user finish typing before showing errors |
| Autosave | 1000-2000ms | Balance data safety vs. server load |
| Cloud sync | 2000-3000ms | Batch multiple changes, expensive operation |
| Window resize | 150-250ms | Smooth visual updates |
| Scroll events | 100-200ms | High-frequency events need shorter delay |

---

## Benefits

1. Reduces API calls — prevents excessive network requests during rapid input
2. Improves performance — delays expensive operations until activity settles
3. Better UX — responsive UI while batching background work
4. Saves server resources — fewer requests under load
5. Rate limit compliance — naturally stays within API limits
6. Battery efficiency — fewer CPU cycles on mobile

---

## Related Patterns

- See `../06-data-fetching/usemutation-patterns.md` for optimistic updates with debounced sync
- See `../06-data-fetching/caching-strategies.md` for combining debounce with cache invalidation
- See `../05-form-patterns/form-validation.md` for debounced validation patterns
- See `use-local-storage.md` for the safe storage helpers used in debounced sync

---

*Extracted: 2026-02-18*
