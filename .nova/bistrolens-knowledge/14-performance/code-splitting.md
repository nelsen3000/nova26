# Code Splitting Patterns

## Source
Extracted from BistroLens `App.tsx`, `utils/advancedLazyLoading.ts`, `utils/performanceOptimizer.ts`

---

## Pattern: Route-Level Lazy Loading with Retry Logic

BistroLens lazy-loads every non-critical component using `React.lazy` + `Suspense`. A custom `createLazyComponent` utility adds retry logic, preloading, and intersection-observer-based loading on top of the native API.

---

## Basic Lazy Loading (App.tsx Pattern)

### Code Example

```typescript
// App.tsx — all non-critical components are lazy loaded
import React, { lazy, Suspense } from 'react';

// Each lazy() call creates a separate JS chunk
const LazyRecipeFinder = lazy(() => import('./components/RecipeFinder'));
const LazyCookingView = lazy(() => import('./components/CookingView'));
const LazyMealPlanner = lazy(() => import('./components/MealPlanner'));
const LazyAdminDashboard = lazy(() => import('./components/AdminDashboard'));
const LazySubscriptionModal = lazy(() => import('./components/SubscriptionModal'));
const LazyPantryManager = lazy(() => import('./components/PantryManager'));
const LazyFusionRecipeGenerator = lazy(() => import('./components/FusionRecipeGenerator'));

// Dev-only tools are also lazy loaded
const LazyLayoutInspector = lazy(() => import('./components/dev/LayoutInspector'));
const LazyContrastInspector = lazy(() => import('./components/dev/ContrastInspector'));

// Wrap lazy components in Suspense with a fallback
const App: React.FC = () => {
  return (
    <Suspense fallback={<LoadingScreen />}>
      {currentView === 'finder' && <LazyRecipeFinder />}
      {currentView === 'planner' && <LazyMealPlanner />}
      {currentView === 'admin' && <LazyAdminDashboard />}
    </Suspense>
  );
};
```

---

## Enhanced Lazy Loading with Retry

### Code Example

```typescript
// utils/advancedLazyLoading.ts
import { lazy, ComponentType, Suspense } from 'react';
import React from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

interface LazyLoadOptions {
  retries?: number;
  retryDelay?: number;
  preload?: boolean;
  fallback?: React.ComponentType;
  chunkName?: string;
}

// Cache for preloaded components
const preloadCache = new Map<string, Promise<any>>();

export const createLazyComponent = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) => {
  const {
    retries = 3,
    retryDelay = 1000,
    preload = false,
    fallback: CustomFallback,
    chunkName,
  } = options;

  const LazyComponent = lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attemptImport = (attempt: number) => {
        const importPromise = importFunc();

        // Cache the import promise if chunk name is provided
        if (chunkName && !preloadCache.has(chunkName)) {
          preloadCache.set(chunkName, importPromise);
        }

        importPromise.then(resolve).catch((error) => {
          if (attempt < retries) {
            console.warn(`Import failed, retrying... (${attempt + 1}/${retries})`, error);
            setTimeout(() => attemptImport(attempt + 1), retryDelay * attempt);
          } else {
            console.error('Import failed after all retries:', error);
            reject(error);
          }
        });
      };

      attemptImport(0);
    });
  });

  // Preload if requested (e.g., on app start for critical paths)
  if (preload && chunkName && !preloadCache.has(chunkName)) {
    preloadCache.set(chunkName, importFunc());
  }

  // Wrap with Suspense so consumers don't need to
  const WrappedComponent = (props: any) => {
    const FallbackComponent = CustomFallback || LoadingSpinner;
    return React.createElement(
      Suspense,
      { fallback: React.createElement(FallbackComponent) },
      React.createElement(LazyComponent, props)
    );
  };

  // Expose preload method for hover/focus preloading
  (WrappedComponent as any).preload = () => {
    const cacheKey = chunkName || 'default';
    if (!preloadCache.has(cacheKey)) {
      preloadCache.set(cacheKey, importFunc());
    }
    return preloadCache.get(cacheKey);
  };

  return WrappedComponent;
};
```

---

## Route-Based Code Splitting

### Code Example

```typescript
// utils/advancedLazyLoading.ts
export const createRouteComponent = (
  importFunc: () => Promise<{ default: ComponentType<any> }>,
  routeName: string
) => {
  return createLazyComponent(importFunc, {
    chunkName: `route-${routeName}`,
    preload: false,
    retries: 3,
  });
};

// Feature-based splitting with optional preload
export const createFeatureComponent = (
  importFunc: () => Promise<{ default: ComponentType<any> }>,
  featureName: string,
  preload: boolean = false
) => {
  return createLazyComponent(importFunc, {
    chunkName: `feature-${featureName}`,
    preload,
    retries: 2,
  });
};

// Usage
const RecipeFinder = createRouteComponent(
  () => import('../components/RecipeFinder'),
  'recipe-finder'
);

const AdminDashboard = createFeatureComponent(
  () => import('../components/AdminDashboard'),
  'admin',
  false // Don't preload admin — most users never visit
);
```

---

## Intersection Observer Lazy Loading

Load components only when they scroll into view.

### Code Example

```typescript
// utils/advancedLazyLoading.ts
export const withIntersectionLoading = <P extends object>(
  LazyComponent: React.ComponentType<P>,
  options: IntersectionObserverInit = {}
) => {
  return React.forwardRef<any, P & { placeholder?: React.ReactNode }>((props, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const [hasLoaded, setHasLoaded] = React.useState(false);
    const elementRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasLoaded) {
            setIsVisible(true);
            setHasLoaded(true);
            observer.disconnect(); // Only load once
          }
        },
        {
          threshold: 0.1,
          rootMargin: '50px', // Start loading 50px before entering viewport
          ...options,
        }
      );

      if (elementRef.current) {
        observer.observe(elementRef.current);
      }

      return () => observer.disconnect();
    }, [hasLoaded]);

    if (!isVisible) {
      return React.createElement(
        'div',
        { ref: elementRef, className: 'min-h-[200px] flex items-center justify-center' },
        props.placeholder || React.createElement(LoadingSpinner)
      );
    }

    const { placeholder, ...componentProps } = props;
    return React.createElement(LazyComponent, { ...(componentProps as P), ref });
  });
};
```

---

## Preload on Hover/Focus

### Code Example

```typescript
// utils/advancedLazyLoading.ts
export const preloadOnInteraction = (
  importFunc: () => Promise<any>,
  events: string[] = ['mouseenter', 'focus', 'touchstart']
) => {
  let hasPreloaded = false;

  const preload = () => {
    if (!hasPreloaded) {
      hasPreloaded = true;
      importFunc().catch(console.error);
    }
  };

  const addListeners = (element: HTMLElement) => {
    events.forEach(event => {
      element.addEventListener(event, preload, { once: true, passive: true });
    });
  };

  return { addListeners, preload };
};

// Usage: preload admin dashboard when user hovers the admin nav link
const adminPreloader = preloadOnInteraction(() => import('../components/AdminDashboard'));
// adminPreloader.addListeners(adminNavLinkElement);
```

---

## Preload Critical Components on App Start

### Code Example

```typescript
// utils/advancedLazyLoading.ts
export const preloadCriticalComponents = () => {
  const criticalComponents = [
    () => import('../components/RecipeFinder'),
    () => import('../components/CookingView'),
    () => import('../components/SettingsModal'),
  ];

  return Promise.all(
    criticalComponents.map(importFunc =>
      importFunc().catch(error => {
        console.warn('Failed to preload critical component:', error);
        return null;
      })
    )
  );
};

// App.tsx — called after initial render
useEffect(() => {
  import('./utils/advancedLazyLoading').then(({ preloadCriticalComponents }) => {
    preloadCriticalComponents().catch(console.warn);
  }).catch(console.warn);
}, []);
```

---

## Anti-Patterns

### ❌ Don't Do This — Importing everything eagerly

```typescript
// Bad: all components in the initial bundle, slow first load
import RecipeFinder from './components/RecipeFinder';
import AdminDashboard from './components/AdminDashboard';
import MealPlanner from './components/MealPlanner';
// ... 50 more imports
```

### ✅ Do This Instead

```typescript
// Good: each component is a separate chunk, loaded on demand
const LazyRecipeFinder = lazy(() => import('./components/RecipeFinder'));
const LazyAdminDashboard = lazy(() => import('./components/AdminDashboard'));
const LazyMealPlanner = lazy(() => import('./components/MealPlanner'));
```

---

### ❌ Don't Do This — No retry on network failure

```typescript
// Bad: one failure = broken component forever
const LazyComponent = lazy(() => import('./HeavyComponent'));
```

### ✅ Do This Instead

```typescript
// Good: retry up to 3 times with exponential backoff
const LazyComponent = createLazyComponent(
  () => import('./HeavyComponent'),
  { retries: 3, retryDelay: 1000 }
);
```

---

## When to Use This Pattern

✅ **Use for:**
- Route-level components (each page/view is a separate chunk)
- Admin/power-user features most users never visit
- Heavy modals and dialogs
- Dev-only tools

❌ **Don't use for:**
- Components rendered on every page (nav, footer) — keep them in the main bundle
- Very small components (<5KB) — the overhead isn't worth it
- Components needed immediately on first paint

---

## Benefits

1. Dramatically reduces initial bundle size and time-to-interactive
2. Retry logic handles flaky network connections gracefully
3. Preloading on hover eliminates perceived latency for common paths
4. Intersection observer loading defers off-screen content automatically

---

## Related Patterns

- See `bundle-optimization.md` for Vite config and chunk size tuning
- See `render-optimization.md` for `React.memo` and `useMemo`
- See `image-optimization.md` for lazy loading images

---

*Extracted: 2026-02-18*
