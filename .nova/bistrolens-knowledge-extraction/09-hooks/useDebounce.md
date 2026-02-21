# useDebounce Hook

## Source
Extracted from BistroLens `components/GlobalSearch.tsx` and `App.tsx`

---

## Pattern: Debounce Hook for Delayed Execution

Debouncing is a technique to delay the execution of a function until after a specified time has passed since the last time it was invoked. This is particularly useful for expensive operations like API calls, search queries, or state synchronization that shouldn't happen on every keystroke or rapid state change.

---

## Implementation Patterns

### Pattern 1: Inline Debounce with useEffect

The most common pattern in BistroLens uses `setTimeout` and cleanup within `useEffect`:

```typescript
import { useEffect, useState } from 'react';

// Example from GlobalSearch.tsx - Debounced search
const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced search - waits 300ms after user stops typing
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

    // Cleanup: cancel the timeout if query changes before it fires
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

### Pattern 2: Debounced State Synchronization

From `App.tsx` - debouncing settings sync to cloud:

```typescript
import { useEffect } from 'react';

// Debounce cloud sync to avoid excessive API calls
useEffect(() => {
  // Save to localStorage immediately (cheap operation)
  safeLocalStorageSet('bistroLensSettings', settings);
  
  // Debounce expensive cloud sync operation
  if (isConvexConfigured() && isOnline && currentUser) {
    const timeout = setTimeout(() => {
      syncSettingsToCloud(currentUser.id, settings);
    }, 2000); // 2 second delay
    
    // Cleanup: cancel pending sync if settings change again
    return () => clearTimeout(timeout);
  }
}, [settings, isOnline, currentUser]);
```

### Pattern 3: Reusable useDebounce Hook

Create a custom hook for reusability:

```typescript
import { useEffect, useState } from 'react';

/**
 * Debounces a value by delaying updates until after the specified delay
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout to update debounced value
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: cancel the timeout if value changes before delay expires
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage example:
function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // This effect only runs when debouncedSearchTerm changes
  useEffect(() => {
    if (debouncedSearchTerm) {
      // Perform expensive search operation
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

### Pattern 4: Debounced Callback Hook

For debouncing function calls instead of values:

```typescript
import { useCallback, useRef } from 'react';

/**
 * Returns a debounced version of the callback function
 * 
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced callback function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

// Usage example:
function FormComponent() {
  const saveToServer = async (data: FormData) => {
    await api.save(data);
  };

  const debouncedSave = useDebouncedCallback(saveToServer, 1000);

  const handleChange = (field: string, value: string) => {
    // Update local state immediately
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Debounced server save
    debouncedSave({ ...formData, [field]: value });
  };

  return (
    <input onChange={(e) => handleChange('name', e.target.value)} />
  );
}
```

---

## Anti-Patterns

### ❌ Don't: Forget Cleanup Function

```typescript
// BAD: Memory leak - timeout continues even after unmount
useEffect(() => {
  setTimeout(() => {
    expensiveOperation(value);
  }, 500);
  // Missing cleanup!
}, [value]);
```

### ✅ Do: Always Clean Up Timeouts

```typescript
// GOOD: Properly cancels timeout on unmount or value change
useEffect(() => {
  const timeout = setTimeout(() => {
    expensiveOperation(value);
  }, 500);
  
  return () => clearTimeout(timeout);
}, [value]);
```

### ❌ Don't: Debounce Everything

```typescript
// BAD: Debouncing UI feedback makes app feel sluggish
const [buttonText, setButtonText] = useState('Click me');
const debouncedText = useDebounce(buttonText, 500); // Unnecessary delay

return <button>{debouncedText}</button>;
```

### ✅ Do: Only Debounce Expensive Operations

```typescript
// GOOD: Immediate UI feedback, debounced API call
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearchTerm) {
    fetchResults(debouncedSearchTerm); // Only this is debounced
  }
}, [debouncedSearchTerm]);

return (
  <div>
    {/* Immediate feedback */}
    <input 
      value={searchTerm} 
      onChange={(e) => setSearchTerm(e.target.value)} 
    />
    <span>Searching for: {searchTerm}</span>
  </div>
);
```

### ❌ Don't: Use Same Delay for All Operations

```typescript
// BAD: One-size-fits-all approach
const debouncedSearch = useDebounce(searchTerm, 500);
const debouncedSettings = useDebounce(settings, 500);
const debouncedAutosave = useDebounce(document, 500);
```

### ✅ Do: Tune Delay Based on Use Case

```typescript
// GOOD: Different delays for different operations
const debouncedSearch = useDebounce(searchTerm, 300);      // Fast: user expects quick results
const debouncedSettings = useDebounce(settings, 2000);     // Slow: infrequent, expensive sync
const debouncedAutosave = useDebounce(document, 1000);     // Medium: balance between saves
```

### ❌ Don't: Create New Timeout on Every Render

```typescript
// BAD: Creates new timeout ID on every render, can't clean up properly
function BadComponent() {
  const [value, setValue] = useState('');
  let timeoutId; // Wrong scope!
  
  const handleChange = (newValue: string) => {
    clearTimeout(timeoutId); // May clear wrong timeout
    timeoutId = setTimeout(() => save(newValue), 500);
    setValue(newValue);
  };
  
  return <input onChange={(e) => handleChange(e.target.value)} />;
}
```

### ✅ Do: Use useRef to Persist Timeout ID

```typescript
// GOOD: Timeout ID persists across renders
function GoodComponent() {
  const [value, setValue] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleChange = (newValue: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => save(newValue), 500);
    setValue(newValue);
  };
  
  return <input onChange={(e) => handleChange(e.target.value)} />;
}
```

---

## When to Use This Pattern

✅ **Use for:**
- **Search inputs**: Debounce API calls while user types (300-500ms)
- **Autosave**: Delay saving to server while user edits (1-2 seconds)
- **Form validation**: Delay expensive validation until user pauses (500ms)
- **API rate limiting**: Prevent excessive API calls during rapid state changes
- **Cloud sync**: Batch multiple local changes into single sync operation (1-3 seconds)
- **Resize/scroll handlers**: Limit expensive recalculations during continuous events
- **Analytics tracking**: Batch events to reduce network requests

❌ **Don't use for:**
- **Immediate UI feedback**: Button clicks, toggles, selections should respond instantly
- **Critical user actions**: Form submissions, payments, deletions need immediate processing
- **Real-time features**: Chat messages, notifications shouldn't be delayed
- **Accessibility**: Screen reader announcements, focus management need immediate updates
- **Simple state updates**: Local state changes that don't trigger expensive operations

---

## Benefits

1. **Reduces API Calls**: Prevents excessive network requests during rapid user input
2. **Improves Performance**: Delays expensive operations until user activity settles
3. **Better UX**: Provides responsive UI while batching background operations
4. **Saves Resources**: Reduces server load and client-side computation
5. **Rate Limit Compliance**: Helps stay within API rate limits
6. **Battery Efficiency**: Fewer operations mean less CPU usage on mobile devices
7. **Network Efficiency**: Batches multiple changes into fewer sync operations

---

## Common Debounce Delays

| Use Case | Recommended Delay | Reasoning |
|----------|------------------|-----------|
| Search input | 300-500ms | Fast enough to feel responsive, slow enough to reduce API calls |
| Autocomplete | 200-300ms | Needs to feel instant while typing |
| Form validation | 500-800ms | Give user time to finish typing before showing errors |
| Autosave | 1000-2000ms | Balance between data safety and server load |
| Cloud sync | 2000-3000ms | Batch multiple changes, expensive operation |
| Window resize | 150-250ms | Smooth visual updates without lag |
| Scroll events | 100-200ms | Frequent events need shorter delay |

---

## Related Patterns

- See `usemutation-patterns.md` for optimistic updates with debounced sync
- See `caching-strategies.md` for combining debounce with cache invalidation
- See `form-validation.md` for debounced validation patterns
- See `error-handling.md` for handling errors in debounced operations

---

## Advanced: Debounce with Leading Edge

Sometimes you want the function to execute immediately on the first call, then debounce subsequent calls:

```typescript
export function useDebounceLeading<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLeadingRef = useRef(true);

  return useCallback(
    (...args: Parameters<T>) => {
      // Execute immediately on first call
      if (isLeadingRef.current) {
        callback(...args);
        isLeadingRef.current = false;
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout to reset leading flag
      timeoutRef.current = setTimeout(() => {
        isLeadingRef.current = true;
      }, delay);
    },
    [callback, delay]
  );
}
```

---

*Extracted: 2026-02-18*
