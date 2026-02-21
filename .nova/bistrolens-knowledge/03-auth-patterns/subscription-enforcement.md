# Subscription Tier Enforcement

## Source
Extracted from BistroLens `.kiro/steering/39-AUTHENTICATION-AUTHORIZATION.md` (Section 4)

---

## Pattern: Subscription Tier Enforcement

Enforce subscription tier limits and feature access both client-side (for UX) and server-side (for security). This pattern ensures users can only access features and consume resources according to their subscription tier, with clear upgrade prompts when limits are reached.

---

## Tier Configuration

### Subscription Tier Definitions

```typescript
// convex/lib/subscriptionTiers.ts
export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: "Free",
    price: 0,
    limits: {
      recipesPerDay: 3,
      imagesPerDay: 9,
      liveChefMinutes: 5,
      collectionsMax: 3,
      mealPlanDays: 7,
    },
    features: {
      fusionKitchen: false,
      mixologyLab: false,
      mealPlanner: true,
      voiceCommands: false,
      adFree: false,
    },
  },
  PREMIUM: {
    name: "Premium",
    price: 7.99,
    limits: {
      recipesPerDay: 25,
      imagesPerDay: 125,
      liveChefMinutes: 0, // Not included
      collectionsMax: 50,
      mealPlanDays: 30,
    },
    features: {
      fusionKitchen: true,
      mixologyLab: true,
      mealPlanner: true,
      voiceCommands: true,
      adFree: true,
    },
  },
  CHEF_MASTER: {
    name: "Chef Master",
    price: 14.99,
    limits: {
      recipesPerDay: 50,
      imagesPerDay: 300,
      liveChefMinutes: 300,
      collectionsMax: -1, // Unlimited
      mealPlanDays: 365,
    },
    features: {
      fusionKitchen: true,
      mixologyLab: true,
      mealPlanner: true,
      voiceCommands: true,
      adFree: true,
      liveChef: true,
      prioritySupport: true,
    },
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;
export type TierConfig = typeof SUBSCRIPTION_TIERS[SubscriptionTier];
```

---

## Client-Side Feature Gating

### Feature Gate Hook

```typescript
// hooks/useFeatureGate.ts
import { SUBSCRIPTION_TIERS } from "@/convex/lib/subscriptionTiers";
import { useSubscription } from "./useSubscription";

export function useFeatureGate(feature: string): {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: string;
} {
  const { subscription } = useSubscription();
  const tier = SUBSCRIPTION_TIERS[subscription.tier];
  
  // Check if current tier has this feature
  if (tier.features[feature]) {
    return { allowed: true };
  }
  
  // Find minimum tier that includes this feature
  const requiredTier = Object.entries(SUBSCRIPTION_TIERS)
    .find(([_, t]) => t.features[feature])?.[0];
  
  return {
    allowed: false,
    reason: `${feature} requires ${requiredTier} subscription`,
    upgradeRequired: requiredTier,
  };
}

// Usage in component
export function FusionKitchenButton() {
  const { allowed, upgradeRequired } = useFeatureGate("fusionKitchen");
  
  if (!allowed) {
    return <UpgradePrompt tier={upgradeRequired} feature="Fusion Kitchen" />;
  }
  
  return <Button onClick={openFusionKitchen}>Open Fusion Kitchen</Button>;
}
```

---

## Server-Side Enforcement

### Mutation with Limit Checking

```typescript
// convex/recipes.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { SUBSCRIPTION_TIERS } from "./lib/subscriptionTiers";

export const generateRecipe = mutation({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    // ALWAYS authenticate first
    const { user } = await requireAuth(ctx);
    
    // Get user's subscription tier configuration
    const tier = SUBSCRIPTION_TIERS[user.subscriptionTier];
    
    // Check daily limit
    const todayCount = await getDailyRecipeCount(ctx, user._id);
    if (todayCount >= tier.limits.recipesPerDay) {
      throw new Error(
        `Daily recipe limit reached (${tier.limits.recipesPerDay}). ` +
        `Upgrade for more!`
      );
    }
    
    // Check feature access
    if (args.useFusion && !tier.features.fusionKitchen) {
      throw new Error("Fusion Kitchen requires Premium or Chef Master subscription");
    }
    
    // Proceed with generation...
    const recipe = await generateRecipeWithAI(args.prompt);
    
    // Track usage for limit enforcement
    await ctx.db.insert("recipeGenerations", {
      userId: user._id,
      timestamp: Date.now(),
      tier: user.subscriptionTier,
    });
    
    return recipe;
  },
});
```

### Helper: Get Daily Usage Count

```typescript
// convex/lib/usageLimits.ts
import { QueryCtx, MutationCtx } from "../_generated/server";

export async function getDailyRecipeCount(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const generations = await ctx.db
    .query("recipeGenerations")
    .withIndex("by_user_time", (q) =>
      q.eq("userId", userId).gte("timestamp", startOfDay.getTime())
    )
    .collect();
  
  return generations.length;
}

export async function checkFeatureAccess(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  feature: string
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  
  const tier = SUBSCRIPTION_TIERS[user.subscriptionTier];
  return tier.features[feature] === true;
}
```

---

## Usage Tracking

### Track Resource Consumption

```typescript
// convex/lib/usageTracking.ts
import { MutationCtx } from "../_generated/server";

export async function trackUsage(
  ctx: MutationCtx,
  userId: string,
  resourceType: "recipe" | "image" | "liveChefMinutes",
  amount: number = 1
) {
  await ctx.db.insert("usageLog", {
    userId,
    resourceType,
    amount,
    timestamp: Date.now(),
  });
}

export async function getRemainingLimit(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  resourceType: "recipe" | "image" | "liveChefMinutes"
): Promise<{ used: number; limit: number; remaining: number }> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  
  const tier = SUBSCRIPTION_TIERS[user.subscriptionTier];
  const limitKey = `${resourceType}PerDay` as keyof typeof tier.limits;
  const limit = tier.limits[limitKey] as number;
  
  // Get today's usage
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const usage = await ctx.db
    .query("usageLog")
    .withIndex("by_user_resource_time", (q) =>
      q.eq("userId", userId)
       .eq("resourceType", resourceType)
       .gte("timestamp", startOfDay.getTime())
    )
    .collect();
  
  const used = usage.reduce((sum, log) => sum + log.amount, 0);
  const remaining = limit === -1 ? Infinity : Math.max(0, limit - used);
  
  return { used, limit, remaining };
}
```

---

## UI Components

### Upgrade Prompt Component

```typescript
// components/UpgradePrompt.tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SUBSCRIPTION_TIERS } from "@/convex/lib/subscriptionTiers";

interface UpgradePromptProps {
  tier: string;
  feature: string;
}

export function UpgradePrompt({ tier, feature }: UpgradePromptProps) {
  const tierConfig = SUBSCRIPTION_TIERS[tier];
  
  return (
    <Card className="p-6 text-center">
      <h3 className="text-xl font-semibold mb-2">
        {feature} is a {tierConfig.name} Feature
      </h3>
      <p className="text-muted-foreground mb-4">
        Upgrade to {tierConfig.name} for ${tierConfig.price}/month to unlock this feature
      </p>
      <Button onClick={() => navigateToUpgrade(tier)}>
        Upgrade to {tierConfig.name}
      </Button>
    </Card>
  );
}
```

### Usage Meter Component

```typescript
// components/UsageMeter.tsx
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function UsageMeter({ resourceType }: { resourceType: string }) {
  const usage = useQuery(api.usage.getRemainingLimit, { resourceType });
  
  if (!usage) return <div>Loading...</div>;
  
  const percentage = usage.limit === -1 
    ? 0 
    : (usage.used / usage.limit) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Recipes Today</span>
        <span>
          {usage.used} / {usage.limit === -1 ? "∞" : usage.limit}
        </span>
      </div>
      <Progress value={percentage} />
      {usage.remaining <= 3 && usage.remaining > 0 && (
        <p className="text-sm text-amber-600">
          Only {usage.remaining} recipes remaining today
        </p>
      )}
      {usage.remaining === 0 && (
        <p className="text-sm text-red-600">
          Daily limit reached. <a href="/upgrade">Upgrade for more</a>
        </p>
      )}
    </div>
  );
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// ❌ BAD - Only checking on client side
function FusionKitchen() {
  const { tier } = useSubscription();
  
  // Client-side check only - can be bypassed!
  if (tier === "FREE") {
    return <UpgradePrompt />;
  }
  
  // Directly calling API without server-side check
  return <FusionKitchenUI />;
}

// ❌ BAD - Trusting client-provided tier
export const generateRecipe = mutation({
  args: { 
    prompt: v.string(),
    userTier: v.string() // Never trust client!
  },
  handler: async (ctx, args) => {
    // Using client-provided tier - SECURITY HOLE!
    const tier = SUBSCRIPTION_TIERS[args.userTier];
    // ...
  },
});

// ❌ BAD - No usage tracking
export const generateRecipe = mutation({
  handler: async (ctx, args) => {
    // Just checking tier exists, not tracking usage
    const { user } = await requireAuth(ctx);
    if (user.subscriptionTier === "FREE") {
      throw new Error("Upgrade required");
    }
    // No limit enforcement!
  },
});
```

### ✅ Do This Instead

```typescript
// ✅ GOOD - Client-side check for UX, server-side for security
function FusionKitchen() {
  const { allowed, upgradeRequired } = useFeatureGate("fusionKitchen");
  
  // Show upgrade prompt immediately (good UX)
  if (!allowed) {
    return <UpgradePrompt tier={upgradeRequired} />;
  }
  
  // Server will also check when API is called (security)
  return <FusionKitchenUI />;
}

// ✅ GOOD - Always get tier from authenticated user
export const generateRecipe = mutation({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    // Get user from auth context (trusted source)
    const { user } = await requireAuth(ctx);
    const tier = SUBSCRIPTION_TIERS[user.subscriptionTier];
    
    // Check limits and track usage
    await enforceLimit(ctx, user._id, "recipe", tier.limits.recipesPerDay);
    // ...
  },
});

// ✅ GOOD - Track all usage
export const generateRecipe = mutation({
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    
    // Check limit before operation
    await checkLimit(ctx, user._id, "recipe");
    
    // Perform operation
    const recipe = await generateRecipeWithAI(args.prompt);
    
    // Track usage after success
    await trackUsage(ctx, user._id, "recipe", 1);
    
    return recipe;
  },
});
```

---

## When to Use This Pattern

✅ **Use for:**
- Any feature that should be gated by subscription tier
- Resource-intensive operations (AI generation, API calls)
- Premium features that differentiate subscription tiers
- Operations with daily/monthly limits
- Features that incur per-use costs

❌ **Don't use for:**
- Basic app functionality (viewing own data, navigation)
- Security-critical operations (use RBAC instead)
- One-time setup operations
- Features that should be universally accessible

---

## Benefits

1. **Revenue Protection**: Ensures users can only access features they've paid for
2. **Resource Management**: Prevents abuse and controls infrastructure costs
3. **Clear Upgrade Path**: Users understand what they get with each tier
4. **Graceful Degradation**: Free users get limited access, not blocked entirely
5. **Usage Transparency**: Users can see their consumption and limits
6. **Scalability**: Limits prevent individual users from overwhelming the system
7. **Conversion Optimization**: Strategic limits encourage upgrades at the right time

---

## Related Patterns

- See `auth-helpers.md` for authentication utilities
- See `rbac-implementation.md` for role-based access control
- See `session-management.md` for session handling
- See `../01-convex-patterns/error-handling.md` for user-friendly limit messages

---

*Extracted: 2026-02-18*
