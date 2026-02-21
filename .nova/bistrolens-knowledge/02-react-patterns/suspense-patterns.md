# Suspense Patterns

## Source
Extracted from BistroLens `App.tsx` (lazy imports and Suspense usage throughout)

---

## Pattern: lazy() + Suspense for Code Splitting

BistroLens lazy-loads virtually every page-level and modal component using `React.lazy()` + `Suspense`. This keeps the initial bundle small and loads components on demand.

---

## Lazy Import Pattern

### Code Example — Declaring Lazy Components

```typescript
import React, { lazy, Suspense } from 'react';

// ✅ All lazy imports at the top of the file, grouped by type

// Page-level components
const LazyRecipeFinder = lazy(() => import('./components/RecipeFinder'));
const LazyCookingView = lazy(() => import('./components/CookingView'));
const LazyMealPlanner = lazy(() => import('./components/MealPlanner'));
const LazyTopRecipesView = lazy(() => import('./components/TopRecipesView'));
const LazyFusionRecipeGenerator = lazy(() => import('./components/FusionRecipeGenerator'));

// Modal components
const LazyAuthModal = lazy(() => import('./components/AuthModal'));
const LazyUserProfileModal = lazy(() => import('./components/SettingsModal'));
const LazySubscriptionModal = lazy(() => import('./components/SubscriptionModal'));
const LazyRecipeRemixerModal = lazy(() => import('./components/RecipeRemixerModal'));
const LazyGroceryListModal = lazy(() => import('./components/GroceryListModal'));

// Admin components (rarely used — always lazy)
const LazyAdminDashboard = lazy(() => import('./components/AdminDashboard'));
const LazyImageAdminDashboard = lazy(() => import('./components/ImageAdminDashboard'));
const LazyBentoDatasetAdmin = lazy(() => import('./components/BentoDatasetAdmin'));

// Dev-only tools (never in production bundle)
const LazyLayoutInspector = lazy(() => import('./components/dev/LayoutInspector'));
const LazyContrastInspector = lazy(() => import('./components/dev/ContrastInspector'));
```

---

## Suspense Fallback Strategies

BistroLens uses different fallbacks depending on context:

### Full-Page Loading (main content area)

```typescript
// Main view — show a full loading screen with a task message
<Suspense fallback={
  <div className="flex justify-center py-20">
    <LoadingScreen task="Setting the table..." className="h-64" />
  </div>
}>
  <ViewTransition viewKey={currentView}>
    <RouteBoundary routeName={currentView}>
      {renderCurrentView()}
    </RouteBoundary>
  </ViewTransition>
</Suspense>
```

### Modal Loading (null fallback)

```typescript
// Modals — use null fallback so nothing shows until ready
// The modal trigger button is already visible; no need for a loading state
{showAuth && (
  <Suspense fallback={null}>
    <LazyAuthModal
      onClose={() => setShowAuth(false)}
      initialMode={authMode}
    />
  </Suspense>
)}

{showSubscriptionModal && (
  <Suspense fallback={null}>
    <LazySubscriptionModal onClose={() => setShowSubscriptionModal(false)} />
  </Suspense>
)}
```

### Conditional Rendering with Suspense

```typescript
// Only render Suspense when the component is needed
{recipeToRemix && (
  <Suspense fallback={null}>
    <LazyRecipeRemixerModal
      recipe={recipeToRemix}
      onClose={() => setRecipeToRemix(null)}
    />
  </Suspense>
)}

{showPartyPlanner && (
  <Suspense fallback={null}>
    <LazyPartyPlannerModal
      onClose={() => setShowPartyPlanner(false)}
      userProfile={settings.profile}
    />
  </Suspense>
)}
```

### Inline Loading Fallback

```typescript
// Desktop recipe view — inline loading message
{isDesktop ? (
  <Suspense fallback={<LoadingScreen task="Loading recipe view..." />}>
    <LazyDesktopRecipeView recipe={previewRecipe} />
  </Suspense>
) : (
  /* Mobile view */
)}
```

---

## Combining Suspense with ErrorBoundary

Always wrap lazy components with both Suspense (loading) and ErrorBoundary (errors):

```typescript
// Full-screen cooking view — needs both loading and error handling
{recipe && !isRecipeMinimized && (
  <div className="fixed inset-0 z-50 bg-white animate-in slide-in-from-bottom-10">
    <Suspense fallback={<LoadingScreen task="Preparing kitchen..." />}>
      <AIErrorBoundary>
        <LazyCookingView
          recipe={recipe}
          onClose={() => setRecipe(null)}
          settings={settings}
        />
      </AIErrorBoundary>
    </Suspense>
  </div>
)}

// Route-level — ErrorBoundary wraps Suspense content
<Suspense fallback={<LoadingScreen task="Setting the table..." />}>
  <ViewTransition viewKey={currentView}>
    <RouteBoundary routeName={currentView}>
      {renderCurrentView()}
    </RouteBoundary>
  </ViewTransition>
</Suspense>
```

---

## Dev-Only Lazy Loading

```typescript
// Dev tools are lazy-loaded AND conditionally rendered
// They never appear in the production bundle
{import.meta.env.DEV && (
  <Suspense fallback={null}>
    <LazyLayoutInspector />
  </Suspense>
)}

{import.meta.env.DEV && (
  <Suspense fallback={null}>
    <LazyContrastInspector />
  </Suspense>
)}
```

---

## Preloading Critical Components

BistroLens preloads components that are likely to be needed soon:

```typescript
useEffect(() => {
  // Preload critical components after initial render
  import('./utils/advancedLazyLoading').then(({ preloadCriticalComponents }) => {
    preloadCriticalComponents().catch(console.warn);
  }).catch(console.warn);
}, []);

// In advancedLazyLoading.ts — trigger imports to warm the cache
export const preloadCriticalComponents = async () => {
  await Promise.all([
    import('./components/RecipeFinder'),
    import('./components/CookingView'),
    import('./components/AuthModal'),
  ]);
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Lazy import inside a component — re-creates on every render
const MyPage: React.FC = () => {
  const LazyChild = lazy(() => import('./Child')); // ❌ new lazy ref every render
  return <Suspense fallback={null}><LazyChild /></Suspense>;
};

// No Suspense boundary — throws an error
const App: React.FC = () => {
  return <LazyRecipeFinder />; // ❌ must be wrapped in Suspense
};

// No ErrorBoundary around lazy components
<Suspense fallback={<Loading />}>
  <LazyComponent /> {/* ❌ if it throws, no error boundary catches it */}
</Suspense>

// Lazy-loading tiny components — overhead not worth it
const LazyButton = lazy(() => import('./Button')); // ❌ too small
```

### ✅ Do This Instead

```typescript
// Lazy imports at module level — stable references
const LazyChild = lazy(() => import('./Child')); // ✅ defined once

const MyPage: React.FC = () => {
  return <Suspense fallback={null}><LazyChild /></Suspense>;
};

// Always wrap with Suspense
<Suspense fallback={<LoadingScreen />}>
  <LazyRecipeFinder />
</Suspense>

// Combine with ErrorBoundary
<Suspense fallback={<LoadingScreen />}>
  <ErrorBoundary level="page">
    <LazyRecipeFinder />
  </ErrorBoundary>
</Suspense>

// Only lazy-load substantial components (pages, modals, admin tools)
const LazyAdminDashboard = lazy(() => import('./AdminDashboard')); // ✅ large component
```

---

## When to Use This Pattern

✅ **Use lazy() + Suspense for:**
- Page-level route components
- Modal dialogs (especially feature-rich ones)
- Admin/dashboard tools
- Dev-only components
- Components that are rarely used
- Any component > ~10KB

❌ **Don't use for:**
- Small UI primitives (buttons, inputs, icons)
- Components always rendered on initial load
- Components that need to be available immediately (e.g., navigation)

---

## Benefits

1. Initial bundle size stays small — users download only what they need
2. Modals load on demand — no cost until the user opens them
3. Admin tools never ship to regular users
4. Dev tools are completely excluded from production builds
5. `null` fallback for modals avoids jarring loading states

---

## Related Patterns

- See `error-boundaries.md` for combining ErrorBoundary with Suspense
- See `../14-performance/code-splitting.md` in `14-performance/` for Vite bundle splitting config
- See `../04-ui-components/loading-states.md` in `04-ui-components/` for LoadingScreen component

---

*Extracted: 2026-02-18*
