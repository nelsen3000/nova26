# useSubscription Hook

## Source
Extracted from BistroLens `hooks/useSubscription.ts`

---

## Pattern: Subscription State Management Hook

A custom React hook that manages user subscription state with localStorage caching, automatic refresh, and optimistic updates. Provides tier information, loading state, and manual refresh capability.

---

## Core Implementation

### Hook Interface

```typescript
import { useState, useEffect, useCallback } from 'react';
import { getUserSubscription, SubscriptionTier } from '../services/subscriptionService';

interface UseSubscriptionReturn {
    tier: SubscriptionTier;
    loading: boolean;
    refresh: () => Promise<void>;
}

export const useSubscription = (): UseSubscriptionReturn => {
    const [tier, setTier] = useState<SubscriptionTier>(() => {
        // Initialize from localStorage to prevent flash
        try {
            const stored = localStorage.getItem('bistro_subscription');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed?.tier || 'free';
            }
        } catch {}
        return 'free';
    });
    const [loading, setLoading] = useState(false);

    const fetchSubscription = useCallback(async () => {
        try {
            setLoading(true);
            const subscription = await getUserSubscription();
            const newTier = subscription?.tier || 'free';
            // Only update if tier actually changed
            setTier(prev => prev !== newTier ? newTier : prev);
        } catch (error) {
            console.error('Failed to fetch subscription:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    return {
        tier,
        loading,
        refresh: fetchSubscription
    };
};
```

### Type Definitions

```typescript
// From subscriptionService.ts
export type SubscriptionTier = 'free' | 'premium' | 'chef_master';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export const TIERS = {
    FREE: 'free' as SubscriptionTier,
    PREMIUM: 'premium' as SubscriptionTier,
    CHEF_MASTER: 'chef_master' as SubscriptionTier
};
```

---

## Usage Examples

### Basic Usage in Component

```typescript
import React from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { TIER_FEATURES } from '../services/subscriptionService';
import LoadingSpinner from './LoadingSpinner';

const SubscriptionManager: React.FC = () => {
    const { tier, loading } = useSubscription();
    const features = TIER_FEATURES[tier];

    if (loading) return <LoadingSpinner />;

    return (
        <div className="bg-brand-white p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-2">Current Plan</h3>
            <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl font-bold">{features.label}</span>
                <span className="px-3 py-1 rounded-full text-xs uppercase">
                    {tier}
                </span>
            </div>
            <div className="space-y-2 text-sm">
                <p>{features.limits.dailyRecipeGeneration} Daily Recipes</p>
                {features.limits.michelinMode && <p>Michelin Mode Active</p>}
                {features.limits.liveChef && <p>Live Chef Access</p>}
            </div>
        </div>
    );
};
```

### Composing with Other Hooks

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useSubscription } from './useSubscription';
import { tierGateService, GateResult } from '../services/tierLimits';

export function useTierGates() {
  const { tier: subscriptionTier } = useSubscription();
  const [tier, setTier] = useState<'free' | 'premium' | 'chef_master'>('free');

  // Sync tier with subscription
  useEffect(() => {
    const normalizedTier = subscriptionTier === 'premium' || subscriptionTier === 'chef_master'
      ? subscriptionTier
      : 'free';
    setTier(normalizedTier);
    tierGateService.setTier(normalizedTier);
  }, [subscriptionTier]);

  const isPaid = tier !== 'free';

  const checkFeature = useCallback((): GateResult => {
    return tierGateService.checkFeature();
  }, []);

  return {
    tier,
    isPaid,
    checkFeature
  };
}
```

### Manual Refresh After Payment

```typescript
import { useSubscription } from '../hooks/useSubscription';
import { useEffect } from 'react';

function PaymentSuccessPage() {
  const { tier, refresh } = useSubscription();

  useEffect(() => {
    // Refresh subscription after successful payment
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success') {
      refresh();
    }
  }, [refresh]);

  return (
    <div>
      <h1>Payment Successful!</h1>
      <p>Your new tier: {tier}</p>
    </div>
  );
}
```

### Conditional Feature Access

```typescript
import { useSubscription } from '../hooks/useSubscription';
import { freemiumService } from '../services/freemiumService';

function FeatureGate({ children }: { children: React.ReactNode }) {
  const { tier } = useSubscription();

  // Sync tier with service
  useEffect(() => {
    freemiumService.setTier(tier);
  }, [tier]);

  const isPremium = tier === 'premium' || tier === 'chef_master';
  const isChefMaster = tier === 'chef_master';

  const hasAdvancedFeatures = freemiumService.hasAdvancedNutrition();

  if (!hasAdvancedFeatures) {
    return <UpgradePrompt />;
  }

  return <>{children}</>;
}
```

---

## Anti-Patterns

### Don't Fetch Without Caching

```typescript
// BAD: No localStorage cache, causes flash of wrong tier
export const useSubscription = () => {
    const [tier, setTier] = useState<SubscriptionTier>('free');

    useEffect(() => {
        getUserSubscription().then(sub => setTier(sub.tier));
    }, []);

    return { tier };
};
```

### Don't Update on Every Fetch

```typescript
// BAD: Updates state even when tier hasn't changed, causes unnecessary re-renders
const fetchSubscription = async () => {
    const subscription = await getUserSubscription();
    setTier(subscription?.tier || 'free'); // Always updates
};
```

### Don't Ignore Error States

```typescript
// BAD: No error handling, fails silently
const fetchSubscription = async () => {
    const subscription = await getUserSubscription();
    setTier(subscription.tier);
};
```

### Do This Instead

```typescript
// GOOD: Cache in localStorage, optimistic updates, error handling
export const useSubscription = (): UseSubscriptionReturn => {
    const [tier, setTier] = useState<SubscriptionTier>(() => {
        // Initialize from localStorage to prevent flash
        try {
            const stored = localStorage.getItem('bistro_subscription');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed?.tier || 'free';
            }
        } catch {}
        return 'free';
    });
    const [loading, setLoading] = useState(false);

    const fetchSubscription = useCallback(async () => {
        try {
            setLoading(true);
            const subscription = await getUserSubscription();
            const newTier = subscription?.tier || 'free';
            // Only update if tier actually changed
            setTier(prev => prev !== newTier ? newTier : prev);
        } catch (error) {
            console.error('Failed to fetch subscription:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    return {
        tier,
        loading,
        refresh: fetchSubscription
    };
};
```

---

## When to Use This Pattern

**Use for:**
- Managing user subscription state across the application
- Preventing flash of incorrect tier on page load
- Providing manual refresh capability after payment flows
- Composing with other hooks that need tier information
- Building feature gates and upgrade prompts
- Syncing tier state with services

**Don't use for:**
- One-time tier checks (use subscriptionService directly)
- Server-side rendering (localStorage not available)
- Non-subscription user state (use different hooks)
- Complex subscription workflows (extend the pattern)

---

## Benefits

1. **Prevents UI Flash**: localStorage caching ensures correct tier displays immediately
2. **Optimistic Updates**: Only re-renders when tier actually changes
3. **Error Resilient**: Gracefully handles fetch failures, falls back to 'free'
4. **Composable**: Easy to use in other custom hooks
5. **Manual Control**: Provides refresh function for payment flows
6. **Type Safe**: Full TypeScript support with strict types
7. **Loading States**: Exposes loading state for UI feedback
8. **Single Source of Truth**: Centralizes subscription state management

---

## Key Implementation Details

### localStorage Caching Strategy

```typescript
// Initialize from cache to prevent flash
const [tier, setTier] = useState<SubscriptionTier>(() => {
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

**Why this works:**
- Lazy initialization runs only once
- Try-catch prevents JSON parse errors
- Falls back to 'free' if anything fails
- Synchronous, so no flash

### Optimistic Update Pattern

```typescript
// Only update if tier actually changed
setTier(prev => prev !== newTier ? newTier : prev);
```

**Why this works:**
- Prevents unnecessary re-renders
- Maintains referential equality when tier unchanged
- Reduces downstream effect triggers

### Stable Refresh Function

```typescript
const fetchSubscription = useCallback(async () => {
    // ... implementation
}, []); // No dependencies, stable reference
```

**Why this works:**
- useCallback with empty deps creates stable reference
- Can be safely used in useEffect dependencies
- Prevents infinite loops

---

## Related Patterns

- See `use-tier-gates.md` for tier-based feature gating
- See `use-freemium.md` for freemium feature checks
- See `../03-auth-patterns/subscription-service.md` for subscription management
- See `../03-auth-patterns/auth-helpers.md` for authentication integration
- See `use-local-storage.md` for localStorage patterns

---

*Extracted: 2026-02-18*
