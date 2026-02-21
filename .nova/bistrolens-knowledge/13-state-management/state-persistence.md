# State Persistence Patterns

## Source
Extracted from BistroLens `utils/storageHelper.ts`, `utils/cookingSessionStorage.ts`, `utils/idb.ts`, `App.tsx`, `hooks/useSubscription.ts`

---

## Pattern: Layered Persistence (localStorage + IndexedDB)

BistroLens uses a two-tier persistence strategy:
- **localStorage** for small, frequently-accessed data (settings, session state, subscription tier)
- **IndexedDB** via a thin `idb` wrapper for large/heavy data (nutrition logs, social feed cache)

Both layers have error handling for private browsing, quota exceeded, and Safari restrictions.

---

## Tier 1: Safe localStorage Wrapper

### Code Example

```typescript
// utils/storageHelper.ts
import { safeJsonParse } from './resilience';

const STORAGE_KEYS = {
  SETTINGS: 'bistroLensSettings',
  MEAL_PLAN: 'bistroLensMealPlan',
  SOCIAL_FEED: 'bistro_social_feed',   // Heavy cache — safe to prune
  FAVORITES: 'bistroLensFavorites',
  NOTIFICATIONS: 'bistro_notifications',
};

export function safeLocalStorageGet<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return safeJsonParse(item, fallback);
  } catch (e) {
    // SecurityError in private browsing or when storage is blocked
    console.warn(`[Storage] Failed to read ${key}`, e);
    return fallback;
  }
}

export function safeLocalStorageSet(key: string, value: any): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e: any) {
    if (isQuotaExceededError(e)) {
      console.warn('[Storage] Quota exceeded. Pruning data...');
      const freed = pruneStorage();
      if (freed) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch {
          console.error('[Storage] Failed to save even after pruning.');
          return false;
        }
      }
    }
    return false;
  }
}

function isQuotaExceededError(e: any): boolean {
  return (
    e instanceof DOMException &&
    (e.code === 22 ||
      e.code === 1014 ||
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

// LRU-style pruning: delete least important data first
function pruneStorage(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEYS.SOCIAL_FEED)) {
      localStorage.removeItem(STORAGE_KEYS.SOCIAL_FEED);
      console.log('[Storage] Pruned Social Feed cache');
      return true;
    }
  } catch {}
  return false;
}
```

---

## Tier 2: IndexedDB for Heavy Data

### Code Example

```typescript
// utils/idb.ts
const DB_NAME = 'BistroLensDB';
const DB_VERSION = 1;
const STORE_NAME = 'heavy_data';

interface IDBHelper {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: any) => Promise<void>;
  del: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
      request.onerror = (event) => {
        dbPromise = null; // Reset so we can retry
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }
  return dbPromise;
};

export const idb: IDBHelper = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as T || null);
        request.onerror = () => resolve(null); // Graceful fallback
      });
    } catch {
      return null;
    }
  },

  set: async (key: string, value: any): Promise<void> => {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve(); // Don't reject — log and continue
      });
    } catch {
      // Silent fail — app continues without persistence
    }
  },

  del: async (key: string): Promise<void> => {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    } catch {}
  },

  clear: async (): Promise<void> => {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    } catch {}
  },
};
```

---

## Session State with Expiry

### Code Example

```typescript
// utils/cookingSessionStorage.ts
export interface CookingSession {
  recipeId: string;
  recipeTitle: string;
  currentStepIndex: number;
  totalSteps: number;
  startedAt: number;
  lastActiveAt: number;
  recipeCategory?: string;
}

const STORAGE_KEY = 'bistro_cooking_session';

export function saveCookingSession(session: CookingSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...session,
      lastActiveAt: Date.now(), // Always update timestamp on save
    }));
  } catch {
    // Ignore quota/private browsing errors
  }
}

export function getCookingSession(): CookingSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as CookingSession;

    // Expire sessions older than 24 hours
    const EXPIRY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - session.lastActiveAt > EXPIRY_MS) {
      clearCookingSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function clearCookingSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function hasResumableSession(): boolean {
  const session = getCookingSession();
  if (!session) return false;
  return session.currentStepIndex < session.totalSteps;
}

export function updateSessionStep(stepIndex: number): void {
  const session = getCookingSession();
  if (session) {
    saveCookingSession({ ...session, currentStepIndex: stepIndex });
  }
}
```

---

## Persisting Settings with Cloud Sync

### Code Example

```typescript
// App.tsx — settings persistence with cloud sync
useEffect(() => {
  // Always persist to localStorage immediately
  safeLocalStorageSet('bistroLensSettings', settings);

  // Debounce cloud sync by 2 seconds to avoid hammering the API
  if (isConvexConfigured() && isOnline && currentUser) {
    const timeout = setTimeout(() => syncSettingsToCloud(currentUser.id, settings), 2000);
    return () => clearTimeout(timeout);
  }
}, [settings, isOnline, currentUser]);

// Load from cloud on auth/network restore
useEffect(() => {
  if (isConvexConfigured() && isOnline && currentUser) {
    fetchSettingsFromCloud(currentUser.id).then(cloudSettings => {
      if (cloudSettings) {
        setSettings(prev => mergeSettings(prev, cloudSettings));
      }
    });
  }
}, [isOnline, currentUser]);
```

---

## Loading Heavy Data from IndexedDB with localStorage Fallback

### Code Example

```typescript
// App.tsx — nutrition log loading with IDB + localStorage fallback
const loadLog = async () => {
  try {
    // Try IndexedDB first (handles large datasets)
    const dbLog = await idb.get<NutritionLogEntry[]>('nutritionLog');
    if (dbLog && Array.isArray(dbLog)) {
      setNutritionLog(dbLog);
    } else {
      // Fallback to localStorage for migration
      const lsLog = safeLocalStorageGet('bistroLensNutritionLog', []);
      if (lsLog.length > 0) {
        setNutritionLog(lsLog);
        // Migrate to IndexedDB
        await idb.set('nutritionLog', lsLog);
      }
    }
  } catch (e) {
    console.error('Failed to load nutrition log', e);
  }
};
```

---

## Subscription Tier Caching

### Code Example

```typescript
// hooks/useSubscription.ts — prevent flash of wrong tier
const [tier, setTier] = useState<SubscriptionTier>(() => {
  // Read from localStorage synchronously during initialization
  try {
    const stored = localStorage.getItem('bistro_subscription');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.tier || 'free';
    }
  } catch {}
  return 'free';
});
```

---

## Anti-Patterns

### ❌ Don't Do This — Unguarded localStorage access

```typescript
// Bad: throws in private browsing, quota exceeded, or when blocked
localStorage.setItem('key', JSON.stringify(value));
const data = JSON.parse(localStorage.getItem('key')!);
```

### ✅ Do This Instead

```typescript
// Good: wrapped with error handling and fallback
safeLocalStorageSet('key', value);
const data = safeLocalStorageGet('key', defaultValue);
```

---

### ❌ Don't Do This — Storing large arrays in localStorage

```typescript
// Bad: localStorage has a ~5MB limit; large arrays will hit quota
localStorage.setItem('nutritionLog', JSON.stringify(hugeArray));
```

### ✅ Do This Instead

```typescript
// Good: use IndexedDB for large datasets
await idb.set('nutritionLog', hugeArray);
```

---

### ❌ Don't Do This — No expiry on session data

```typescript
// Bad: stale session data persists forever
localStorage.setItem('cookingSession', JSON.stringify(session));
```

### ✅ Do This Instead

```typescript
// Good: include timestamp and check expiry on read
saveCookingSession({ ...session, lastActiveAt: Date.now() });
// On read: if Date.now() - session.lastActiveAt > EXPIRY_MS, clear and return null
```

---

## When to Use This Pattern

✅ **Use localStorage for:**
- Small settings objects (<100KB)
- Session state with expiry
- Subscription tier caching (prevents flash)
- Flags like `hasSeenWelcome`, `onboardingCompleted`

✅ **Use IndexedDB for:**
- Large arrays (nutrition logs, recipe history)
- Cached external data (social feed)
- Binary data or blobs

❌ **Don't persist:**
- Sensitive data (tokens, passwords) — use httpOnly cookies
- Server data that can be re-fetched — use Convex real-time queries

---

## Benefits

1. Graceful degradation — app works even when storage is unavailable
2. LRU pruning prevents quota exceeded errors from blocking critical saves
3. Two-tier strategy keeps localStorage lean while supporting large datasets
4. Session expiry prevents stale state from confusing users

---

## Related Patterns

- See `context-patterns.md` for how persisted settings are loaded into context
- See `global-state.md` for the subscription tier caching pattern
- See `../09-hooks/use-local-storage.md` for the custom hook abstraction

---

*Extracted: 2026-02-18*
