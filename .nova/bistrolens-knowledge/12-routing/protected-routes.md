# Protected Routes

## Source
Extracted from BistroLens `App.tsx`, `services/simpleAuth.ts`,
`hooks/useTierGates.ts`, `components/UpgradeGateModal.tsx`,
`components/navigation/IntentNavigation.tsx`

---

## Pattern: Inline Auth Guard (No PrivateRoute Component)

BistroLens does **not** use a `PrivateRoute` wrapper component. Instead, auth protection is applied inline at the point of action — either by redirecting to the login view or by showing an upgrade modal. This keeps the routing logic centralized in `App.tsx`.

---

## Auth State Initialization

```typescript
// App.tsx — auth state is initialized from localStorage on mount
const [currentUser, setCurrentUser] = useState<any>(null);
const [isAuthenticated, setIsAuthenticated] = useState(false);

useEffect(() => {
  // Initialize from persisted session
  const user = initializeAuth();
  setCurrentUser(user);
  setIsAuthenticated(!!user);

  // Subscribe to auth changes
  const unsubscribe = onAuthStateChange((user) => {
    setCurrentUser(user);
    setIsAuthenticated(!!user);
  });

  return unsubscribe;
}, []);
```

```typescript
// services/simpleAuth.ts — session persisted in localStorage
export const initializeAuth = (): User | null => {
  try {
    const userData = safeStorage.getItem('currentUser');
    if (userData) {
      const user = JSON.parse(userData);
      notifyAuthListeners(user);
      return user;
    }
  } catch (error) {
    console.error('[Auth] Failed to initialize auth:', error);
  }
  return null;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  authListeners.push(callback);
  return () => {
    authListeners = authListeners.filter(l => l !== callback);
  };
};
```

---

## Redirect to Login

Auth-required actions redirect to the login view, passing the user back to `finder` on success:

```typescript
// App.tsx — handleOpenAuth navigates to login/signup views
const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin') => {
  playClickSound();
  if (mode === 'signin') {
    setCurrentView('login');
  } else {
    setCurrentView('signup');
  }
};

// Login page redirects back to finder on success
case 'login':
  return (
    <LazyLoginPage
      onClose={() => setCurrentView('finder')}
      onSuccess={(user) => {
        setCurrentUser(user);
        setCurrentView('finder');  // Return to home after login
        showToast(`Welcome back, ${user.email}!`);
      }}
      onSwitchToSignup={() => setCurrentView('signup')}
    />
  );

case 'signup':
  return (
    <LazySignupPage
      onClose={() => setCurrentView('finder')}
      onSuccess={(user) => {
        setCurrentUser(user);
        setCurrentView('finder');  // Return to home after signup
        showToast(`Welcome to Bistro Lens, ${user.email}!`);
      }}
      onSwitchToLogin={() => setCurrentView('login')}
    />
  );
```

---

## Navigation Guard (Profile Route)

The profile nav item redirects unauthenticated users to sign in instead of navigating:

```typescript
// components/navigation/IntentNavigation.tsx
const handleItemClick = (item: NavigationItem) => {
  // Guard: profile requires auth
  if (item.intent === 'profile' && !currentUser && onOpenAuth) {
    onOpenAuth(); // Show auth instead of navigating
    return;
  }
  onNavigate(item.intent);
};

// Mobile nav shows "Sign In" label for unauthenticated profile item
const showSignIn = item.intent === 'profile' && !currentUser;

<motion.button
  aria-label={showSignIn ? 'Sign In' : item.label}
>
  {showSignIn ? 'Sign In' : item.label}
</motion.button>
```

---

## Conditional Rendering Guard

Some components only render for authenticated users:

```typescript
// components/TonightCTA.tsx — skips render entirely if not authenticated
const TonightCTA: React.FC<TonightCTAProps> = ({ isAuthenticated, ... }) => {
  // Skip Convex query if not authenticated
  const resumeState = useQuery(
    isAuthenticated ? api.cookingResumeState.getResumeState : "skip"
  );

  // Don't render for unauthenticated users
  if (!isAuthenticated) {
    return null;
  }

  return <div>...</div>;
};
```

---

## Tier Gate Pattern (Subscription-Based Route Guard)

Feature access is controlled by subscription tier. When a user hits a limit, an `UpgradeGateModal` blocks the action:

```typescript
// App.tsx — tier gates for save recipe action
const {
  tier,
  checkSaveRecipe,
  handleGateHit: logGateHit
} = useTierGates();

// State for gate modal
const [showSaveGateModal, setShowSaveGateModal] = useState(false);
const [saveGateResult, setSaveGateResult] = useState<GateResult | null>(null);

const handleToggleFavorite = (targetRecipe: Recipe) => {
  const isFav = favorites.some(r => r.title === targetRecipe.title);

  // Removing is always allowed
  if (isFav) {
    const newFavorites = favorites.filter(r => r.title !== targetRecipe.title);
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
    return;
  }

  // CHECK GATE before allowing save
  const gateResult = checkSaveRecipe(favorites.length);
  if (!gateResult.allowed) {
    logGateHit('save_recipe', gateResult.currentCount, gateResult.limit);
    setSaveGateResult(gateResult);
    setShowSaveGateModal(true);
    return; // Block the action
  }

  // Allowed — proceed
  const newFavorites = [...favorites, targetRecipe];
  setFavorites(newFavorites);
  saveFavorites(newFavorites);
};
```

---

## useTierGates Hook

```typescript
// hooks/useTierGates.ts
export function useTierGates(): UseTierGatesReturn {
  const { tier: subscriptionTier } = useSubscription();
  const [tier, setTier] = useState<'free' | 'premium' | 'chef_master'>('free');

  // Sync tier with subscription service
  useEffect(() => {
    const normalizedTier = subscriptionTier === 'premium' || subscriptionTier === 'chef_master'
      ? subscriptionTier
      : 'free';
    setTier(normalizedTier);
    tierGateService.setTier(normalizedTier);
  }, [subscriptionTier]);

  // Gate check — returns { allowed, currentCount, limit, upgradeMessage, unlockFeatures }
  const checkSaveRecipe = useCallback((currentCount: number): GateResult => {
    return tierGateService.checkSaveRecipe(currentCount);
  }, []);

  const checkRecipeGeneration = useCallback((): GateResult => {
    return tierGateService.checkRecipeGeneration();
  }, []);

  const checkStepImageView = useCallback((): GateResult => {
    return tierGateService.checkStepImageView();
  }, []);

  // Log gate hit event
  const handleGateHit = useCallback((gateType: GateType, currentCount: number, limit: number) => {
    logGateEvent('gate_hit', gateType, tier, currentCount, limit);
  }, [tier]);

  return {
    tier,
    isPaid: tier !== 'free',
    limits: TIER_LIMITS[tier],
    checkSaveRecipe,
    checkRecipeGeneration,
    checkStepImageView,
    handleGateHit,
    // ... other checks
  };
}
```

---

## UpgradeGateModal (Upgrade Prompt)

When a gate blocks an action, this modal is shown:

```typescript
// App.tsx — gate modal wired up
{showSaveGateModal && saveGateResult && (
  <UpgradeGateModal
    feature="save_recipe"
    isOpen={showSaveGateModal}
    onClose={() => setShowSaveGateModal(false)}
    onUpgrade={() => {
      setShowSaveGateModal(false);
      setShowSubscriptionModal(true); // Fallback to pricing modal
    }}
    gateResult={saveGateResult}
    tier={tier}
  />
)}

// components/UpgradeGateModal.tsx — shows usage progress + upgrade CTA
export const UpgradeGateModal: React.FC<UpgradeGateModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  gateResult,
  tier,
}) => {
  const handleUpgrade = async () => {
    // Log upgrade click
    logGateEvent('upgrade_clicked', gateResult.feature, tier, gateResult.currentCount, gateResult.limit);

    // Start Stripe checkout
    const result = await startCheckout({
      targetTier,
      source: gateResult.feature,
      currentTier: tier
    });

    if (!result.success) {
      onUpgrade(); // Fall back to pricing modal
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Usage progress bar */}
      <div>
        {gateResult.currentCount} / {gateResult.limit} used
      </div>

      {/* Upgrade message */}
      <p>{gateResult.upgradeMessage}</p>

      {/* Unlock features list */}
      {gateResult.unlockFeatures.map((feature, i) => (
        <div key={i}>{feature}</div>
      ))}

      <button onClick={handleUpgrade}>Upgrade Now</button>
    </Modal>
  );
};
```

---

## GateWarningBanner (Near-Limit Warning)

Shows a warning banner when a user is approaching their limit:

```typescript
// components/UpgradeGateModal.tsx
export const GateWarningBanner: React.FC<GateWarningBannerProps> = ({
  gateResult,
  onUpgrade,
}) => {
  // Only show when at limit or ≤2 remaining
  if (gateResult.allowed && gateResult.remaining > 2) {
    return null;
  }

  const isAtLimit = gateResult.atLimit;
  const isNearLimit = !isAtLimit && gateResult.remaining <= 2;

  return (
    <div className={isAtLimit ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}>
      <span>
        {isAtLimit
          ? `Limit reached (${gateResult.currentCount}/${gateResult.limit})`
          : `${gateResult.remaining} remaining today`}
      </span>
      <button onClick={onUpgrade}>Upgrade</button>
    </div>
  );
};
```

---

## Auth-Conditional Convex Queries

Convex queries are skipped for unauthenticated users using the `"skip"` pattern:

```typescript
// components/ImmersiveLessonView.tsx
const { isAuthenticated } = useConvexAuth();

// Skip query if not authenticated
const lessonProgress = useQuery(
  isAuthenticated ? api.learning.getLessonProgress : "skip",
  isAuthenticated ? { userId: currentUserId } : undefined
);

// Guard before writing
const saveLessonProgress = async (...) => {
  if (isAuthenticated && currentUserId !== 'anonymous') {
    return await saveLessonProgressConvex(currentUserId, title, status, score);
  }
  // Fallback: save locally only
  console.log('Lesson progress saved locally');
};
```

---

## Auth Pages Hide Navigation

Login, signup, and reset-password views hide the nav bar and bottom nav:

```typescript
// App.tsx — nav is hidden on auth pages
{currentView !== 'login' && currentView !== 'signup' && currentView !== 'reset-password' && (
  <SuperNavBar ... />
)}

{currentView !== 'login' && currentView !== 'signup' && currentView !== 'reset-password' && (
  <MobileBottomNav ... />
)}

// Main content has no padding on auth pages
<main
  className={`
    ${currentView === 'login' || currentView === 'signup' || currentView === 'reset-password'
      ? 'pt-0 pb-0'
      : 'pt-[124px] pb-20 md:pb-0'
    }
  `}
  style={currentView === 'login' || currentView === 'signup' || currentView === 'reset-password'
    ? {}
    : { paddingLeft: 32, paddingRight: 32 }
  }
>
```

---

## Return URL Preservation

BistroLens does not preserve a return URL — after login, users always return to `finder`. For features that need post-login return, the pattern is to store the intended action in state before redirecting:

```typescript
// Pattern: store pending action, execute after auth
const handleScanWithAuth = () => {
  if (!currentUser) {
    // Store what the user wanted to do
    setPendingIngredients(scannedIngredients);
    setCurrentView('login');
    return;
  }
  // User is authenticated, proceed
  handleIngredientsGenerated(scannedIngredients);
};

// After login success, pending state is still set
onSuccess={(user) => {
  setCurrentUser(user);
  setCurrentView('finder'); // pendingIngredients still in state
  // RecipeFinder will pick up pendingIngredients automatically
}}
```

---

## Role-Based Route Access (Admin Routes)

Admin routes are accessible via hash URLs and are not guarded by a role check in the router — they rely on the admin components themselves to verify access:

```typescript
// App.tsx — admin routes are hash-based
if (window.location.hash === '#bento-dataset-admin') {
  setCurrentView('bento-dataset-admin');
}
if (window.location.hash === '#image-admin') {
  setCurrentView('image-admin');
}

// Rendered without explicit role check in App.tsx
case 'admin':
  return <LazyAdminDashboard />;  // AdminDashboard handles its own auth check

case 'image-admin':
  return <LazyImageAdminDashboard />;
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't silently fail when auth is required — always redirect or show a prompt
const handleSaveRecipe = () => {
  if (!currentUser) {
    return; // BAD: user doesn't know why nothing happened
  }
  saveRecipe();
};

// Don't run Convex mutations without checking auth
const mutation = useMutation(api.recipes.save);
mutation({ recipeId }); // BAD: will throw if not authenticated
```

### ✅ Do This Instead

```typescript
// Always give feedback when auth is required
const handleSaveRecipe = () => {
  if (!currentUser) {
    showToast('Sign in to save recipes');
    setCurrentView('login');
    return;
  }
  saveRecipe();
};

// Use "skip" pattern for Convex queries
const data = useQuery(
  isAuthenticated ? api.recipes.getSaved : "skip"
);
```

---

## When to Use This Pattern

✅ **Use for:**
- Blocking actions that require authentication (save, export, scan)
- Subscription tier enforcement (free vs paid features)
- Hiding nav on auth pages for a focused experience

❌ **Don't use for:**
- Public content that should be accessible without login
- Admin access control (use server-side checks in Convex mutations)

---

## Benefits

1. No `PrivateRoute` wrapper — simpler component tree
2. Tier gates are reusable via `useTierGates` hook
3. Auth state is centralized in `App.tsx`
4. Convex `"skip"` pattern prevents unauthorized queries

---

## Related Patterns

- See `route-structure.md` for the full view map
- See `navigation-patterns.md` for navigation guard on profile intent
- See `../03-auth-patterns/auth-helpers.md` for `simpleAuth` service details
- See `../03-auth-patterns/subscription-enforcement.md` for tier limit details

---

*Extracted: 2026-02-18*
