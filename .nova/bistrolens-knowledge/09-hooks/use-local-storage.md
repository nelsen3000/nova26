# Safe LocalStorage Pattern

## Source
Extracted from BistroLens `utils/storageHelper.ts` and `utils/resilience.ts`

---

## Pattern: Safe LocalStorage with Quota Management

BistroLens implements a robust localStorage wrapper that handles quota exceeded errors, security exceptions, and automatic space reclamation. The pattern uses two helper functions (`safeLocalStorageGet` and `safeLocalStorageSet`) that never throw errors and gracefully degrade when storage is unavailable.

---

## Core Implementation

### Storage Helper Functions

```typescript
// utils/storageHelper.ts
import { safeJsonParse } from './resilience';

const STORAGE_KEYS = {
    SETTINGS: 'bistroLensSettings',
    MEAL_PLAN: 'bistroLensMealPlan',
    SOCIAL_FEED: 'bistro_social_feed',
    FAVORITES: 'bistroLensFavorites',
    NOTIFICATIONS: 'bistro_notifications'
};

// Order of deletion preference when disk is full
const PRUNE_PRIORITY = [
    STORAGE_KEYS.SOCIAL_FEED,   // Cached external content (safest to delete)
    STORAGE_KEYS.NOTIFICATIONS, // Transient data
];

export function safeLocalStorageGet<T>(key: string, fallback: T): T {
    try {
        const item = localStorage.getItem(key);
        return safeJsonParse(item, fallback);
    } catch (e) {
        console.warn(`[Storage] Failed to read ${key} from localStorage (SecurityError or unavailable).`, e);
        return fallback;
    }
}

export function safeLocalStorageSet(key: string, value: any): boolean {
    try {
        const stringified = JSON.stringify(value);
        localStorage.setItem(key, stringified);
        return true;
    } catch (e: any) {
        if (isQuotaExceededError(e)) {
            console.warn("[Storage] Quota exceeded. Attempting to prune data to make space...");
            const freed = pruneStorage();
            if (freed) {
                // Retry set
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (retryErr) {
                    console.error("[Storage] Failed to save even after pruning.", retryErr);
                    return false;
                }
            }
        } else {
            console.error("[Storage] Critical save error (SecurityError or other):", e);
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

function pruneStorage(): boolean {
    let spaceFreed = false;

    // Clear cached data that can be refetched
    try {
        if (localStorage.getItem(STORAGE_KEYS.SOCIAL_FEED)) {
            localStorage.removeItem(STORAGE_KEYS.SOCIAL_FEED);
            spaceFreed = true;
            console.log("[Storage] Pruned Social Feed");
        }
    } catch (e) {
        console.warn("Failed to prune social feed", e);
    }

    return spaceFreed;
}
```

### Safe JSON Parse Helper

```typescript
// utils/resilience.ts

// Safe JSON Parse that never throws
export function safeJsonParse<T>(text: string | null | undefined, fallback: T): T {
    if (!text) return fallback;
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("[Resilience] Failed to parse JSON, using fallback.", e);
        return fallback;
    }
}
```

---

## Usage Examples

### Example 1: Loading Settings with Defaults

```typescript
// App.tsx
import { safeLocalStorageGet, safeLocalStorageSet } from './utils/storageHelper';

const [settings, setSettings] = useState(() => {
    const defaultSettings = {
        pantry: [],
        groceryList: [],
        freezer: [],
        defaultServings: 4,
        measurementSystem: 'Imperial',
        country: 'United States',
        soundEffects: true,
        keepScreenOn: true,
        recipeHistory: [],
        autoContribute: true
    };

    try {
        const saved = safeLocalStorageGet('bistroLensSettings', null) as any;
        if (saved && typeof saved === 'object') {
            const safePantry = Array.isArray(saved.pantry)
                ? saved.pantry.filter((i: any) => i && typeof i === 'object' && i.name)
                : defaultSettings.pantry;

            return {
                ...defaultSettings,
                ...saved,
                pantry: safePantry,
                groceryList: Array.isArray(saved.groceryList)
                    ? saved.groceryList
                    : defaultSettings.groceryList,
            };
        }
    } catch (e) {
        console.error("Failed to load settings, using defaults", e);
    }

    return defaultSettings;
});

// Save settings whenever they change
useEffect(() => {
    safeLocalStorageSet('bistroLensSettings', settings);
}, [settings]);
```

### Example 2: Service Class with Persistent State

```typescript
// services/tasteProfileService.ts
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storageHelper';

const STORAGE_KEY = 'bistroLens_tasteProfile';

interface TasteProfileData {
    preferences: TastePreference;
    interactions: string[];
    lastUpdated: string;
    profileVersion: number;
    onboardingCompleted: boolean;
}

class TasteProfileService {
    private data: TasteProfileData;

    constructor() {
        this.data = this.loadProfile();
    }

    private loadProfile(): TasteProfileData {
        const stored = safeLocalStorageGet<TasteProfileData>(STORAGE_KEY, null);
        if (stored && stored.profileVersion === 1) {
            return stored;
        }
        return {
            preferences: { ...DEFAULT_PREFERENCES },
            interactions: [],
            lastUpdated: new Date().toISOString(),
            profileVersion: 1,
            onboardingCompleted: false,
        };
    }

    private saveProfile(): void {
        this.data.lastUpdated = new Date().toISOString();
        safeLocalStorageSet(STORAGE_KEY, this.data);
    }

    getPreferences(): TastePreference {
        return this.data.preferences;
    }

    updatePreferences(updates: Partial<TastePreference>): void {
        this.data.preferences = { ...this.data.preferences, ...updates };
        this.saveProfile();
    }
}

export const tasteProfileService = new TasteProfileService();
```

### Example 3: Simple Flag Storage

```typescript
// App.tsx - Welcome message tracking
useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('bistroLens_hasSeenWelcome');

    if (!hasSeenWelcome) {
        setTimeout(() => {
            showToast("Welcome to Bistro Lens!");
            localStorage.setItem('bistroLens_hasSeenWelcome', 'true');
        }, 1000);
    }
}, []);
```

### Example 4: Usage Tracking with Limits

```typescript
// services/tierLimits.ts
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storageHelper';

const GATE_USAGE_KEY = 'bistroLens_gateUsage';

interface DailyGateUsage {
    date: string;
    magicRecipeCount: number;
    aiImageCount: number;
}

const getDailyUsage = (): DailyGateUsage => {
    const stored = safeLocalStorageGet<DailyGateUsage>(GATE_USAGE_KEY, null);
    const today = getToday();

    // Reset if it's a new day
    if (!stored || stored.date !== today) {
        return {
            date: today,
            magicRecipeCount: 0,
            aiImageCount: 0,
        };
    }

    return stored;
};

const saveDailyUsage = (usage: DailyGateUsage): void => {
    safeLocalStorageSet(GATE_USAGE_KEY, usage);
};
```

---

## Anti-Patterns

### Don't Do This: Direct localStorage Access

```typescript
// BAD: No error handling, throws on quota exceeded or security errors
function saveSettings(settings: Settings) {
    localStorage.setItem('settings', JSON.stringify(settings));
}

function loadSettings(): Settings {
    const data = localStorage.getItem('settings');
    return JSON.parse(data); // Throws if data is null or invalid JSON
}
```

### Don't Do This: Ignoring Quota Errors

```typescript
// BAD: Silent failure without retry or cleanup
function saveData(key: string, value: any) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Failed to save'); // No recovery attempt
    }
}
```

### Don't Do This: No Fallback Values

```typescript
// BAD: Returns null/undefined, causes crashes downstream
function getData(key: string) {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null; // Null causes "Cannot read property" errors
}
```

### Do This Instead: Use Safe Wrappers

```typescript
// GOOD: Error handling, fallbacks, quota management
import { safeLocalStorageGet, safeLocalStorageSet } from './utils/storageHelper';

function saveSettings(settings: Settings) {
    const success = safeLocalStorageSet('settings', settings);
    if (!success) {
        // Handle failure (show user message, use memory-only mode, etc.)
        console.warn('Settings not persisted - using memory-only mode');
    }
}

function loadSettings(): Settings {
    return safeLocalStorageGet('settings', DEFAULT_SETTINGS);
}
```

---

## When to Use This Pattern

**Use for:**
- User preferences and settings
- Application state that should persist across sessions
- Caching data that can be refetched
- Feature flags and onboarding state
- Usage tracking and analytics
- Form draft data

**Don't use for:**
- Large datasets (>5MB) - use IndexedDB instead
- Sensitive data like passwords or tokens - use secure storage
- Real-time collaborative data - use database with sync
- Binary data or files - use File API or cloud storage
- Data that must never be lost - use server-side storage

---

## Benefits

1. **Never Crashes**: All errors are caught and handled gracefully
2. **Automatic Recovery**: Quota exceeded errors trigger automatic cleanup
3. **Type Safety**: Generic type parameter ensures type-safe reads
4. **Fallback Values**: Always returns valid data, never null/undefined
5. **Privacy Mode Support**: Works in browsers with localStorage disabled
6. **Quota Management**: Intelligent pruning of low-priority data
7. **Consistent API**: Same interface for all storage operations
8. **Debugging Support**: Comprehensive logging for troubleshooting

---

## Key Design Decisions

### 1. Prune Priority System
The pattern defines which data to delete first when quota is exceeded:
- **Cached data** (social feeds, API responses) - safest to delete
- **Transient data** (notifications, temporary state)
- **Never delete** user-created content (favorites, meal plans)

### 2. Return Boolean from Set
`safeLocalStorageSet` returns `true/false` so callers can handle failures:
```typescript
const saved = safeLocalStorageSet('key', data);
if (!saved) {
    // Fall back to memory-only mode or show user message
}
```

### 3. Generic Type Parameter
Type-safe reads with TypeScript generics:
```typescript
const settings = safeLocalStorageGet<Settings>('settings', DEFAULT_SETTINGS);
// settings is typed as Settings, not any
```

### 4. Separate JSON Parse
`safeJsonParse` is a separate utility so it can be reused for API responses, file reads, etc.

---

## Related Patterns

- See `../01-convex-patterns/convex-file-storage.md` for storing large files
- See `../01-convex-patterns/error-handling.md` for error boundary patterns
- See `../07-error-handling/resilience-patterns.md` for retry logic
- See `../13-state-management/state-persistence.md` for syncing localStorage with server state

---

*Extracted: 2026-02-18*
