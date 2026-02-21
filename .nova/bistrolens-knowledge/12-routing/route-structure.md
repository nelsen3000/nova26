# Route Structure

## Source
Extracted from BistroLens `App.tsx`

---

## Pattern: State-Based Routing (No React Router)

BistroLens uses a **custom state-based routing system** instead of React Router. Navigation is managed via a `currentView` state string in the root `App` component. There is no `BrowserRouter`, `Routes`, or `Route` — all view switching is handled by a `renderCurrentView()` switch statement.

---

## Route Hierarchy

All routes are flat (no nesting). The `currentView` state determines which component renders inside `<main>`.

```
App
├── SuperNavBar (always visible, except on auth pages)
├── AnnouncementBar (finder only)
├── ActiveCookingBar (when cooking is minimized)
├── <main> → renderCurrentView()
│   ├── finder          → LazyRecipeFinder
│   ├── pantry          → LazyPantryManager
│   ├── freezer         → LazyFreezerManager
│   ├── planner         → LazyMealPlanner
│   ├── logbook         → LazyNutritionLog
│   ├── favorites       → CollectionManager
│   ├── recipe-library  → LazyBentoRecipeLibrary
│   ├── top-100         → LazyTopRecipesView
│   ├── fusion          → LazyFusionRecipeGenerator
│   ├── marinade        → LazyMarinadeMaker
│   ├── spice           → LazySpiceSelector
│   ├── baker           → LazyBakersCorner
│   ├── bitters         → LazyBittersLab
│   ├── mixers          → LazyMixerMaster
│   ├── grill-master    → LazyGrillMaster
│   ├── bakers-calc     → LazyBakersCalculator
│   ├── marinade-builder→ LazyMarinadeBuilder
│   ├── batch-cocktail  → inline JSX (placeholder)
│   ├── cocktail-finder → LazyCocktailSearchByIngredients
│   ├── drink-profile   → LazyDrinkProfileBuilder
│   ├── public-recipes  → LazyPublicRecipesPage
│   ├── public-recipe   → LazyPublicRecipePage (uses publicRecipeSlug state)
│   ├── community       → LazySocialFeed
│   ├── profile         → LazySocialProfile (uses viewingProfileId state)
│   ├── learn           → LazyBlogPage
│   ├── guide           → LazyGuidePage
│   ├── legal           → LazyLegalHubPage
│   ├── legal-page      → LazyLegalPageView (uses legalPageType state)
│   ├── creators        → LazyAffiliateLandingPage
│   ├── admin           → LazyAdminDashboard
│   ├── image-admin     → LazyImageAdminDashboard
│   ├── image-dataset-admin → LazyImageDatasetAdmin
│   ├── bento-dataset-admin → LazyBentoDatasetAdmin
│   ├── bento-tile-admin    → LazyBentoTileAdmin
│   ├── affiliate-dashboard → LazyAffiliateDashboard
│   ├── tools           → LazyToolsPage
│   ├── meal-prep       → LazyMealPrepPro
│   ├── plan            → LazyMealPrepPro (initialTab="plan")
│   ├── batch-cook      → LazyMealPrepPro (initialTab="batch")
│   ├── track           → LazyMealPrepPro (initialTab="track")
│   ├── shop            → LazyShopTool
│   ├── fridge-rescue   → LazyFridgeRescue
│   ├── party-mode      → LazyPartyMode
│   ├── login           → LazyLoginPage
│   ├── signup          → LazySignupPage
│   ├── reset-password  → LazyPasswordResetPage
│   ├── pdf-preview     → LazyPDFPreviewPage
│   ├── owner-blog      → LazyOwnerBlogList
│   ├── owner-blog-new  → LazyOwnerBlogEditor (postId=null)
│   ├── owner-blog-edit → LazyOwnerBlogEditor (uses editingPostId state)
│   ├── academy         → LazyAcademyPage (slug=null)
│   └── academy-post    → LazyAcademyPage (uses academySlug state)
├── MobileBottomNav (always visible, except on auth pages)
└── SuperFooter (desktop only, hidden on auth pages)
```

---

## Route Type Definition

```typescript
// App.tsx — currentView state type (union of all valid view strings)
const [currentView, setCurrentView] = useState<
  | 'finder' | 'pantry' | 'freezer' | 'planner' | 'logbook'
  | 'favorites' | 'recipe-library' | 'top-100' | 'fusion'
  | 'marinade' | 'spice' | 'baker' | 'bitters' | 'mixers'
  | 'community' | 'profile' | 'learn' | 'guide' | 'creators'
  | 'admin' | 'affiliate-dashboard' | 'tools' | 'login'
  | 'signup' | 'reset-password' | 'batch-cocktail' | 'meal-prep'
  | 'plan' | 'batch-cook' | 'track' | 'shop' | 'grill-master'
  | 'bakers-calc' | 'marinade-builder' | 'cocktail-finder'
  | 'drink-profile' | 'public-recipes' | 'public-recipe'
  | 'image-admin' | 'image-dataset-admin' | 'bento-dataset-admin'
  | 'bento-tile-admin' | 'fridge-rescue' | 'party-mode'
  | 'pdf-preview' | 'legal' | 'legal-page' | 'owner-blog'
  | 'owner-blog-new' | 'owner-blog-edit' | 'academy' | 'academy-post'
>('finder');
```

---

## Route Rendering Pattern

```typescript
// App.tsx — renderCurrentView() switch statement
const renderCurrentView = () => {
  switch (currentView) {
    case 'finder':
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AIErrorBoundary>
            <LazyRecipeFinder
              onRecipeGenerated={handleRecipeGenerated}
              onStartLoading={() => { setIsLoading(true); /* ... */ }}
              onStopLoading={() => { setIsLoading(false); /* ... */ }}
              isLoading={isLoading}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              // ... other props
            />
          </AIErrorBoundary>
        </div>
      );

    case 'planner':
      return (
        <LazyMealPlanner
          favorites={favorites}
          mealPlan={mealPlan}
          onUpdateMealPlan={handleUpdateMealPlan}
          onCookRecipe={(r) => { setRecipe(r); setIsRecipeMinimized(false); }}
          showToast={showToast}
          onOpenGroceryList={() => setShowGroceryListModal(true)}
          setSettings={setSettings}
        />
      );

    case 'login':
      return (
        <LazyLoginPage
          onClose={() => setCurrentView('finder')}
          onSuccess={(user) => {
            setCurrentUser(user);
            setCurrentView('finder');
            showToast(`Welcome back, ${user.email}!`);
          }}
          onSwitchToSignup={() => setCurrentView('signup')}
        />
      );

    default:
      return null;
  }
};
```

---

## Route Parameters (via State)

Routes that need parameters carry them in separate state variables:

```typescript
// Parameterized routes use companion state
const [publicRecipeSlug, setPublicRecipeSlug] = useState<string | null>(null);
const [academySlug, setAcademySlug] = useState<string | null>(null);
const [editingPostId, setEditingPostId] = useState<string | null>(null);
const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
const [legalPageType, setLegalPageType] = useState<'terms' | 'privacy' | 'food-safety' | 'image-trust' | null>(null);

// Navigate to a parameterized route
case 'public-recipe':
  return publicRecipeSlug ? (
    <LazyPublicRecipePage
      slug={publicRecipeSlug}
      onBack={() => {
        setCurrentView('public-recipes');
        setPublicRecipeSlug(null);
        window.history.pushState({}, '', '/recipes');
      }}
      onTryBistroLens={() => setCurrentView('finder')}
    />
  ) : null;

// Navigate to it
setPublicRecipeSlug(slug);
setCurrentView('public-recipe');
window.history.pushState({}, '', `/recipes/${slug}`);
```

---

## URL Synchronization

The app syncs certain routes to the browser URL manually using `window.history.pushState`:

```typescript
// Public recipe pages get real URLs
window.history.pushState({}, '', `/recipes/${slug}`);

// Recipe detail gets query param
window.history.pushState({ recipeId: newRecipe.id }, '', `/?recipeId=${newRecipe.id}`);

// Home reset
window.history.pushState({}, '', '/');
```

---

## URL-to-State Initialization

On mount, the app reads the URL to set the initial view:

```typescript
useEffect(() => {
  // Pathname-based routes
  if (window.location.pathname === '/recipes') {
    setCurrentView('public-recipes');
  } else if (window.location.pathname.startsWith('/recipes/')) {
    const slug = window.location.pathname.replace('/recipes/', '');
    if (slug) {
      setPublicRecipeSlug(slug);
      setCurrentView('public-recipe');
    }
  }

  if (window.location.pathname === '/academy') {
    setCurrentView('academy');
  } else if (window.location.pathname.startsWith('/academy/')) {
    const slug = window.location.pathname.replace('/academy/', '');
    if (slug) {
      setAcademySlug(slug);
      setCurrentView('academy-post');
    }
  }

  if (window.location.pathname === '/reset-password' || window.location.hash.includes('access_token')) {
    setCurrentView('reset-password');
  }

  if (window.location.pathname === '/pdf-preview') {
    setCurrentView('pdf-preview');
  }

  // Hash-based admin routes
  if (window.location.hash === '#/affiliate-dashboard') {
    setCurrentView('affiliate-dashboard');
  }
  if (window.location.hash === '#bento-dataset-admin') {
    setCurrentView('bento-dataset-admin');
  }
  if (window.location.hash === '#image-admin') {
    setCurrentView('image-admin');
  }
  // Owner blog hash routes
  if (window.location.hash === '#owner-blog') {
    setCurrentView('owner-blog');
  }
  if (window.location.hash.startsWith('#owner-blog-edit/')) {
    const postId = window.location.hash.replace('#owner-blog-edit/', '');
    setEditingPostId(postId);
    setCurrentView('owner-blog-edit');
  }
}, []);
```

---

## Lazy Loading Pattern

All views are lazy-loaded with `React.lazy` and wrapped in `<Suspense>`:

```typescript
// Lazy imports at top of App.tsx
const LazyRecipeFinder = lazy(() => import('./components/RecipeFinder'));
const LazyMealPlanner = lazy(() => import('./components/MealPlanner'));
const LazyLoginPage = lazy(() => import('./components/LoginPage'));
// ... 50+ lazy imports

// Suspense wrapper in render
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

---

## Route Error Boundaries

Each route is wrapped in a `RouteBoundary` error boundary:

```typescript
// components/ErrorBoundary.tsx
import { NavigationErrorBoundary, AIErrorBoundary, RouteBoundary } from './components/ErrorBoundary';

// App root
<NavigationErrorBoundary>
  {/* ... */}
  <RouteBoundary routeName={currentView}>
    {renderCurrentView()}
  </RouteBoundary>
</NavigationErrorBoundary>

// AI-specific routes get AIErrorBoundary
case 'finder':
  return (
    <AIErrorBoundary>
      <LazyRecipeFinder ... />
    </AIErrorBoundary>
  );
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't navigate by directly mutating the URL without updating state
window.location.href = '/recipes';

// Don't use React Router alongside this pattern — it conflicts
import { BrowserRouter, Routes, Route } from 'react-router-dom';
```

### ✅ Do This Instead

```typescript
// Always update state AND URL together
setPublicRecipeSlug(slug);
setCurrentView('public-recipe');
window.history.pushState({}, '', `/recipes/${slug}`);

// For simple navigation, just update state
setCurrentView('planner');
```

---

## When to Use This Pattern

✅ **Use for:**
- SPAs where React Router adds unnecessary complexity
- Apps with a single root component managing all state
- Projects where URL structure is secondary to app state

❌ **Don't use for:**
- Apps with deep link requirements for every route
- Server-side rendering (SSR) scenarios
- Apps where browser back/forward must work for all views

---

## Benefits

1. Simple — no router library dependency
2. All navigation logic in one place (`App.tsx`)
3. Easy to pass props between views via shared state
4. Lazy loading is straightforward with `React.lazy`

---

## Related Patterns

- See `navigation-patterns.md` for programmatic navigation helpers
- See `protected-routes.md` for auth guard implementation
- See `../02-react-patterns/suspense-patterns.md` for lazy loading details

---

*Extracted: 2026-02-18*
