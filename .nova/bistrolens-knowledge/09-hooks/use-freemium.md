# useFreemium

## Source
Extracted from BistroLens `hooks/useFreemium.ts`, `components/UsageMeter.tsx`

**Category:** 09-hooks
**Type:** Pattern
**Tags:** hooks, freemium, subscription, usage-limits, upgrade-prompts

---

## Overview

`useFreemium` tracks usage against free tier limits and surfaces upgrade prompts at the right moment. Handles usage counting, limit checking, and contextual upgrade messaging.

---

## Pattern

```typescript
// hooks/useFreemium.ts
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";

interface FreemiumLimit {
  feature: string;
  used: number;
  limit: number;
  unlimited: boolean;
}

interface UseFreemiumReturn {
  limits: Record<string, FreemiumLimit>;
  isAtLimit: (feature: string) => boolean;
  isNearLimit: (feature: string, threshold?: number) => boolean;
  getUsagePercent: (feature: string) => number;
  getUpgradeMessage: (feature: string) => string;
}

// Free tier limits
const FREE_LIMITS: Record<string, number> = {
  companies: 3,
  menuItems: 50,
  teamMembers: 2,
  apiCalls: 1000,
  storageGb: 1,
};

export function useFreemium(): UseFreemiumReturn {
  const usage = useQuery(api.subscriptions.getUsage);
  const subscription = useQuery(api.subscriptions.getCurrentSubscription);

  const isPro = subscription?.tier === "pro" || subscription?.tier === "enterprise";

  const limits = useMemo<Record<string, FreemiumLimit>>(() => {
    const result: Record<string, FreemiumLimit> = {};

    for (const [feature, limit] of Object.entries(FREE_LIMITS)) {
      result[feature] = {
        feature,
        used: usage?.[feature] ?? 0,
        limit,
        unlimited: isPro,
      };
    }

    return result;
  }, [usage, isPro]);

  const isAtLimit = (feature: string): boolean => {
    const limit = limits[feature];
    if (!limit || limit.unlimited) return false;
    return limit.used >= limit.limit;
  };

  const isNearLimit = (feature: string, threshold = 0.8): boolean => {
    const limit = limits[feature];
    if (!limit || limit.unlimited) return false;
    return limit.used / limit.limit >= threshold;
  };

  const getUsagePercent = (feature: string): number => {
    const limit = limits[feature];
    if (!limit || limit.unlimited) return 0;
    return Math.min(100, Math.round((limit.used / limit.limit) * 100));
  };

  const getUpgradeMessage = (feature: string): string => {
    const limit = limits[feature];
    if (!limit) return "Upgrade to unlock this feature";

    const messages: Record<string, string> = {
      companies: `You've reached the ${limit.limit} company limit on the free plan.`,
      menuItems: `You've used ${limit.used}/${limit.limit} menu items.`,
      teamMembers: `Free plan supports up to ${limit.limit} team members.`,
      apiCalls: `You've used ${limit.used.toLocaleString()} of ${limit.limit.toLocaleString()} API calls this month.`,
    };

    return messages[feature] ?? `Upgrade to get more ${feature}.`;
  };

  return { limits, isAtLimit, isNearLimit, getUsagePercent, getUpgradeMessage };
}
```

```tsx
// components/UsageMeter.tsx
import { useFreemium } from "@/hooks/useFreemium";

export function UsageMeter({ feature }: { feature: string }) {
  const { limits, getUsagePercent, isNearLimit, isAtLimit } = useFreemium();
  const limit = limits[feature];

  if (!limit || limit.unlimited) return null;

  const percent = getUsagePercent(feature);
  const color = isAtLimit(feature)
    ? "bg-red-500"
    : isNearLimit(feature)
    ? "bg-yellow-500"
    : "bg-blue-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span className="capitalize">{feature}</span>
        <span>{limit.used} / {limit.limit}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
```

---

## Usage

```tsx
function AddCompanyButton() {
  const { isAtLimit, getUpgradeMessage } = useFreemium();

  if (isAtLimit("companies")) {
    return (
      <div>
        <p className="text-sm text-gray-500">{getUpgradeMessage("companies")}</p>
        <a href="/upgrade" className="text-blue-600">Upgrade to Pro</a>
      </div>
    );
  }

  return <button onClick={openAddCompanyModal}>Add Company</button>;
}
```

---

## Anti-Patterns

### Don't Do This

```typescript
// Only check limits client-side
if (!isAtLimit("companies")) await createCompany(); // Server must also enforce

// Hard-coded limit values in components
if (companyCount >= 3) return <UpgradePrompt />; // Use useFreemium() instead

// No near-limit warnings — users hit wall without warning
// Show isNearLimit() warnings before they hit the hard limit
```

### Do This Instead

```tsx
// Use useFreemium for centralized limit checking with near-limit warnings
const { isAtLimit, isNearLimit, getUpgradeMessage } = useFreemium();

{isNearLimit("companies") && (
  <p className="text-yellow-600">You're approaching your company limit.</p>
)}
{isAtLimit("companies") && (
  <p className="text-red-500">{getUpgradeMessage("companies")}</p>
)}
```

---

## When to Use This Pattern

**Use for:**
- Displaying usage meters on dashboards and settings pages
- Gating "create" actions when free tier limits are reached
- Showing contextual upgrade prompts before users hit hard limits

**Don't use for:**
- Server-side enforcement — always validate limits in Convex mutations too
- Enterprise tier users where all limits are unlimited

---

## Benefits

1. Centralized limit definitions — change limits in one place, not scattered across components
2. Near-limit warnings (`isNearLimit`) give users advance notice before hitting walls
3. Contextual upgrade messages explain exactly which limit was reached
4. Usage percentage calculation enables visual progress bars and meters

---

## Related Patterns

- `use-tier-gates.md` — Tier-based feature gating
- `../03-auth-patterns/subscription-enforcement.md` — Server-side enforcement
- `use-subscription.md` — Subscription data hook
