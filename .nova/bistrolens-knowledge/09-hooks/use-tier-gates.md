# useTierGates

## Source
Extracted from BistroLens `hooks/useTierGates.ts`, `components/TierGate.tsx`

**Category:** 09-hooks
**Type:** Pattern
**Tags:** hooks, subscription, tiers, feature-gates, freemium, access-control

---

## Overview

`useTierGates` provides client-side subscription tier checking for feature gating. Returns helper functions to check if the current user's tier allows a feature, and renders upgrade prompts when access is denied.

---

## Pattern

```typescript
// hooks/useTierGates.ts
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback } from "react";

export type SubscriptionTier = "free" | "pro" | "enterprise";

const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

interface TierGateResult {
  allowed: boolean;
  requiredTier: SubscriptionTier;
  currentTier: SubscriptionTier;
  upgradeUrl: string;
}

interface UseTierGatesReturn {
  currentTier: SubscriptionTier;
  canAccess: (requiredTier: SubscriptionTier) => boolean;
  checkGate: (requiredTier: SubscriptionTier) => TierGateResult;
  isPro: boolean;
  isEnterprise: boolean;
  isFree: boolean;
}

export function useTierGates(): UseTierGatesReturn {
  const subscription = useQuery(api.subscriptions.getCurrentSubscription);
  const currentTier: SubscriptionTier = subscription?.tier ?? "free";

  const canAccess = useCallback(
    (requiredTier: SubscriptionTier): boolean => {
      return TIER_HIERARCHY[currentTier] >= TIER_HIERARCHY[requiredTier];
    },
    [currentTier]
  );

  const checkGate = useCallback(
    (requiredTier: SubscriptionTier): TierGateResult => {
      const allowed = canAccess(requiredTier);
      return {
        allowed,
        requiredTier,
        currentTier,
        upgradeUrl: `/upgrade?from=${currentTier}&to=${requiredTier}`,
      };
    },
    [canAccess, currentTier]
  );

  return {
    currentTier,
    canAccess,
    checkGate,
    isPro: TIER_HIERARCHY[currentTier] >= TIER_HIERARCHY.pro,
    isEnterprise: currentTier === "enterprise",
    isFree: currentTier === "free",
  };
}
```

```tsx
// components/TierGate.tsx — declarative gate component
import { useTierGates, SubscriptionTier } from "@/hooks/useTierGates";

interface TierGateProps {
  requiredTier: SubscriptionTier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function TierGate({ requiredTier, children, fallback }: TierGateProps) {
  const { checkGate } = useTierGates();
  const { allowed, upgradeUrl, requiredTier: tier } = checkGate(requiredTier);

  if (allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
      <p className="text-sm text-gray-500">
        This feature requires the <strong className="capitalize">{tier}</strong> plan.
      </p>
      <a href={upgradeUrl} className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
        Upgrade now
      </a>
    </div>
  );
}
```

---

## Usage

```tsx
// Imperative check
function ExportButton() {
  const { canAccess } = useTierGates();

  if (!canAccess("pro")) {
    return <UpgradePrompt requiredTier="pro" />;
  }

  return <button onClick={exportData}>Export CSV</button>;
}

// Declarative gate
function AnalyticsDashboard() {
  return (
    <TierGate requiredTier="pro">
      <AdvancedAnalytics />
    </TierGate>
  );
}

// Boolean helpers
function Sidebar() {
  const { isPro, isEnterprise } = useTierGates();

  return (
    <nav>
      <NavItem href="/dashboard" label="Dashboard" />
      {isPro && <NavItem href="/analytics" label="Analytics" />}
      {isEnterprise && <NavItem href="/admin" label="Admin" />}
    </nav>
  );
}
```

---

## Anti-Patterns

### Don't Do This

```typescript
// Client-side only gating — security theater
// Always enforce server-side too via requireSubscription()
if (!isPro) return null; // User can bypass by modifying JS

// Hardcoded tier strings
if (subscription.tier === "pro") { ... } // Use canAccess() for hierarchy

// No fallback UI — features just disappear
{isPro && <AdvancedFeature />} // Shows nothing to free users — confusing
```

### Do This Instead

```tsx
// Use TierGate with upgrade fallback
<TierGate requiredTier="pro">
  <AdvancedFeature />
</TierGate>

// Use canAccess() for hierarchy-aware checks
const { canAccess } = useTierGates();
if (canAccess("pro")) { /* enterprise users also pass */ }
```

---

## When to Use This Pattern

**Use for:**
- Feature gating in the UI to show/hide premium features
- Rendering contextual upgrade prompts when users hit tier limits
- Navigation items that should only appear for certain tiers

**Don't use for:**
- Server-side authorization — always use `requireSubscription()` in Convex mutations
- Hiding security-sensitive data — client-side gates are bypassable

---

## Benefits

1. Hierarchy-aware tier checking — enterprise users automatically pass pro gates
2. Declarative `TierGate` component simplifies feature gating in JSX
3. Built-in upgrade URL generation guides users to the right upgrade path
4. Boolean helpers (`isPro`, `isEnterprise`) enable quick conditional rendering

---

## Related Patterns

- `use-freemium.md` — Freemium-specific patterns
- `../03-auth-patterns/subscription-enforcement.md` — Server-side enforcement
- `use-subscription.md` — Subscription data hook
