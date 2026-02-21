# Navigation Patterns

## Source
Extracted from BistroLens `App.tsx`, `components/navigation/IntentNavigation.tsx`,
`components/ui/SuperNavBar.tsx`, `components/ui/MobileBottomNav.tsx`

---

## Pattern: Intent-Based Navigation

BistroLens organizes navigation around **user goals (intents)**, not feature names. The `IntentNavigation` component maps intents to views and enforces platform-specific item counts.

---

## Programmatic Navigation

All navigation goes through `handleTabChange` in `App.tsx`. Never call `setCurrentView` directly from child components — pass `onNavigate` as a prop.

```typescript
// App.tsx — central navigation handler
const handleTabChange = (id: string) => {
  // Track performance
  performanceMonitoringService.mark(`navigation_${id}`);

  // Handle special prefixed routes
  if (id === 'legal') {
    setCurrentView('legal');
    setLegalPageType(null);
    return;
  }

  if (id.startsWith('legal:')) {
    const page = id.split(':')[1] as 'terms' | 'privacy' | 'food-safety' | 'image-trust';
    setLegalPageType(page);
    setCurrentView('legal-page');
    return;
  }

  if (id === 'academy') {
    setAcademySlug(null);
    setCurrentView('academy');
    return;
  }

  if (id.startsWith('academy:')) {
    const slug = id.split(':')[1];
    setAcademySlug(slug);
    setCurrentView('academy-post');
    return;
  }

  // Default: set view directly
  setCurrentView(id as any);

  // Track for personalization
  personalizationEngine.trackPageView(id);
};
```

---

## Intent-to-View Mapping

```typescript
// components/navigation/IntentNavigation.tsx

export type NavigationIntent =
  | 'cook'      // → 'finder'
  | 'plan'      // → 'planner'
  | 'explore'   // → 'recipe-library' (web)
  | 'library'   // → 'recipe-library' (mobile)
  | 'tools'     // → 'tools' (web only)
  | 'profile';  // → 'profile'

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { intent: 'cook',    label: 'Cook',    platforms: ['web', 'mobile'], viewMapping: 'finder' },
  { intent: 'plan',    label: 'Plan',    platforms: ['web', 'mobile'], viewMapping: 'planner' },
  { intent: 'explore', label: 'Explore', platforms: ['web'],           viewMapping: 'recipe-library' },
  { intent: 'library', label: 'Library', platforms: ['mobile'],        viewMapping: 'recipe-library' },
  { intent: 'tools',   label: 'Tools',   platforms: ['web'],           viewMapping: 'tools' },
  { intent: 'profile', label: 'Profile', platforms: ['web', 'mobile'], viewMapping: 'profile' },
];

// Convert view name → intent (platform-aware)
export function viewToIntent(view: string, platform?: Platform): NavigationIntent {
  switch (view) {
    case 'finder':   return 'cook';
    case 'planner':  return 'plan';
    case 'recipe-library':
    case 'favorites':
    case 'top-100':
      return platform === 'mobile' ? 'library' : 'explore';
    case 'tools':    return 'tools';
    case 'profile':  return 'profile';
    default:         return 'cook';
  }
}

// Convert intent → primary view
export function intentToView(intent: NavigationIntent): string {
  const item = NAVIGATION_ITEMS.find(i => i.intent === intent);
  return item?.viewMapping || 'finder';
}
```

---

## Desktop Navigation (SuperNavBar)

The desktop nav uses dropdown menus for grouped routes:

```typescript
// components/ui/SuperNavBar.tsx

// Explore dropdown — groups recipe-related views
<button onClick={() => setShowExploreMenu(!showExploreMenu)}>
  Explore ▾
</button>

<AnimatePresence>
  {showExploreMenu && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 mt-2 w-56 rounded-xl shadow-2xl"
    >
      <button onClick={() => handleNavClick('finder')}>Recipe Generator</button>
      <button onClick={() => handleNavClick('recipe-library')}>Recipe Library</button>
      <button onClick={() => handleNavClick('planner')}>Meal Planner</button>
      <button onClick={() => handleNavClick('fusion')}>Fusion Kitchen</button>
      <button onClick={() => handleNavClick('top-100')}>Top Recipes</button>
      <button onClick={() => handleNavClick('logbook')}>Nutrition Log</button>
      <button onClick={() => handleNavClick('favorites')}>Favorites</button>
    </motion.div>
  )}
</AnimatePresence>

// Resources dropdown
<button onClick={() => setShowResourcesMenu(!showResourcesMenu)}>
  Resources ▾
</button>
{showResourcesMenu && (
  <motion.div ...>
    <button onClick={() => handleNavClick('learn')}>Academy</button>
    <button onClick={() => handleNavClick('guide')}>User Guide</button>
    <button onClick={() => handleNavClick('creators')}>Partner Program</button>
  </motion.div>
)}

// Internal nav click handler — closes dropdowns after navigation
const handleNavClick = (view: string) => {
  playClickSound();
  onNavigate(view);
  setShowExploreMenu(false);
  setShowResourcesMenu(false);
  setMobileMenuOpen(false);
};
```

---

## Mobile Bottom Navigation

Mobile uses a fixed bottom bar with 4 intent-based items:

```typescript
// components/ui/MobileBottomNav.tsx

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  onOpenAuth
}) => {
  // Convert view string → intent for active state
  const activeIntent = viewToIntent(activeTab, 'mobile');

  const handleNavigate = (intent: NavigationIntent) => {
    playClickSound();
    // Convert intent → view for App.tsx
    const view = intentToView(intent);
    onTabChange(view);
  };

  return (
    <div className="lg:hidden">
      <IntentNavigation
        platform="mobile"
        activeIntent={activeIntent}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onOpenAuth={onOpenAuth}
      />
    </div>
  );
};
```

---

## Active Link Styling

Active state is tracked via `currentView` state, not URL matching:

```typescript
// IntentNavigation.tsx — Web active indicator
<motion.button
  className={`
    relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
    ${isActive ? 'text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}
  `}
  style={{
    backgroundColor: isActive ? accentColor : 'transparent',
  }}
  aria-current={isActive ? 'page' : undefined}
>
  {item.icon}
  <span>{item.label}</span>
</motion.button>

// IntentNavigation.tsx — Mobile active indicator (animated top bar)
{isActive && (
  <motion.div
    layoutId="mobileActiveTab"
    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full"
    style={{ backgroundColor: accentColor }}
    initial={false}
    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
  />
)}
```

---

## Swipe Gesture Navigation

Mobile supports swipe left/right to navigate between main tabs:

```typescript
// App.tsx
const tabOrder = ['finder', 'planner', 'learn', 'community'];

const handleSwipeNavigation = (direction: 'left' | 'right') => {
  const currentIndex = tabOrder.indexOf(currentView);
  if (currentIndex === -1) return;

  const newIndex = direction === 'left'
    ? currentIndex + 1
    : currentIndex - 1;

  if (newIndex >= 0 && newIndex < tabOrder.length) {
    handleTabChange(tabOrder[newIndex]);
  }
};

const swipeRef = useSwipeGesture({
  onSwipeLeft: () => handleSwipeNavigation('left'),
  onSwipeRight: () => handleSwipeNavigation('right'),
  threshold: 100
});

// Attach to main content area
<main ref={swipeRef} id="main-content">
  {renderCurrentView()}
</main>
```

---

## Keyboard Navigation

Global keyboard shortcuts for power users:

```typescript
// App.tsx — keyboard shortcut handler
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey) {
    switch (e.key) {
      case '1': e.preventDefault(); handleTabChange('finder');    break;
      case '2': e.preventDefault(); handleTabChange('planner');   break;
      case '3': e.preventDefault(); handleTabChange('learn');     break;
      case '4': e.preventDefault(); handleTabChange('community'); break;
      case 'h': e.preventDefault(); handleHomeClick();            break;
    }
  }
};

window.addEventListener('keydown', handleKeyDown);
```

---

## Back Navigation

Components receive an `onBack` prop that navigates to their parent view:

```typescript
// Pattern: onBack prop for sub-views
case 'pantry':
  return (
    <LazyPantryManager
      onGenerateRecipes={handleIngredientsGenerated}
      onBack={() => setCurrentView('finder')}
      onOpenGroceryList={() => setShowGroceryListModal(true)}
    />
  );

case 'grill-master':
  return <LazyGrillMaster onBack={() => setCurrentView('tools')} />;

case 'meal-prep':
  return (
    <LazyMealPrepPro
      onBack={() => setCurrentView('tools')}
      onRecipeGenerated={handleRecipeGenerated}
    />
  );
```

---

## Home Navigation

```typescript
// App.tsx — handleHomeClick resets all state
const handleHomeClick = () => {
  playClickSound();
  setRecipe(null);
  setPreviewRecipe(null);
  setRecipeToRemix(null);
  setCurrentView('finder');
  window.history.pushState({}, '', '/');
};
```

---

## Custom Event Navigation

Admin dashboards can trigger navigation via a custom DOM event:

```typescript
// App.tsx — listens for navigate events
const handleNavigate = (e: CustomEvent) => {
  const view = e.detail;
  if (view && typeof view === 'string') {
    setCurrentView(view as any);
  }
};
window.addEventListener('navigate', handleNavigate as EventListener);

// Any component can dispatch this event
window.dispatchEvent(new CustomEvent('navigate', { detail: 'admin' }));
```

---

## Navigation Guards (Auth Check)

Profile navigation prompts unauthenticated users to sign in:

```typescript
// IntentNavigation.tsx
const handleItemClick = (item: NavigationItem) => {
  if (item.intent === 'profile' && !currentUser && onOpenAuth) {
    onOpenAuth(); // Show auth modal instead of navigating
    return;
  }
  onNavigate(item.intent);
};
```

---

## View Transition Animation

All view changes are wrapped in `ViewTransition` for smooth animations:

```typescript
// App.tsx
<ViewTransition viewKey={currentView}>
  <RouteBoundary routeName={currentView}>
    {renderCurrentView()}
  </RouteBoundary>
</ViewTransition>

// Individual views can add their own entry animation
case 'finder':
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <LazyRecipeFinder ... />
    </div>
  );
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't navigate from deep in the component tree without a prop
// This creates tight coupling
const DeepComponent = () => {
  // BAD: accessing App state directly
  window.dispatchEvent(new CustomEvent('navigate', { detail: 'finder' }));
};

// Don't forget to close dropdowns after navigation
const handleNavClick = (view: string) => {
  onNavigate(view);
  // Missing: setShowExploreMenu(false) — dropdown stays open!
};
```

### ✅ Do This Instead

```typescript
// Pass onNavigate as a prop
const DeepComponent = ({ onNavigate }: { onNavigate: (view: string) => void }) => {
  return <button onClick={() => onNavigate('finder')}>Go Home</button>;
};

// Always close dropdowns after navigation
const handleNavClick = (view: string) => {
  playClickSound();
  onNavigate(view);
  setShowExploreMenu(false);
  setShowResourcesMenu(false);
  setMobileMenuOpen(false);
};
```

---

## When to Use This Pattern

✅ **Use for:**
- All in-app navigation between views
- Passing navigation capability to child components
- Platform-specific nav (mobile vs desktop)

❌ **Don't use for:**
- External links (use `<a href>` with `target="_blank"`)
- Navigation that requires URL params (use `window.history.pushState` alongside)

---

## Benefits

1. Single source of truth for navigation logic
2. Intent-based API is more semantic than view names
3. Platform-aware — mobile and desktop get appropriate nav items
4. Animated transitions built in

---

## Related Patterns

- See `route-structure.md` for the full view/route map
- See `protected-routes.md` for auth-gated navigation
- See `../09-hooks/use-swipe-gesture.md` for swipe implementation

---

*Extracted: 2026-02-18*
