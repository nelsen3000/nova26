# Auth Helpers

## Source
Extracted from BistroLens `.kiro/steering/39-AUTHENTICATION-AUTHORIZATION.md` (Section 6)

---

## Pattern: Reusable Auth Helper Functions

Create reusable helper functions for common auth checks to keep code DRY and consistent.

---

## Basic Auth Check

### requireAuth Helper

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from "../_generated/server";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

// Usage in query
export const getProfile = query({
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

// Usage in mutation
export const updateProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    
    await ctx.db.patch(identity.subject, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});
```

---

## Role-Based Auth

### Role Hierarchy

```typescript
// convex/lib/permissions.ts
export const ROLE_HIERARCHY = {
  user: 0,
  premium: 1,
  chef_master: 2,
  moderator: 3,
  admin: 4,
} as const;

export type UserRole = keyof typeof ROLE_HIERARCHY;

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
```

### requireRole Helper

```typescript
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  requiredRole: UserRole
) {
  const identity = await requireAuth(ctx);
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  
  if (!user) {
    throw new Error("User not found");
  }
  
  if (!hasRole(user.role, requiredRole)) {
    throw new Error(`Requires ${requiredRole} role`);
  }
  
  return { identity, user };
}

// Usage
export const moderateContent = mutation({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    // Requires moderator or admin role
    const { user } = await requireRole(ctx, "moderator");
    
    await ctx.db.patch(args.contentId, {
      moderatedBy: user._id,
      moderatedAt: Date.now(),
      status: "approved",
    });
  },
});
```

### requireAdmin Helper

```typescript
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  
  if (!user?.isAdmin) {
    throw new Error("Admin access required");
  }
  
  return { identity, user };
}

// Usage
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Soft delete user
    await ctx.db.patch(args.userId, {
      isDeleted: true,
      deletedAt: Date.now(),
    });
  },
});
```

---

## Ownership Verification

### requireOwnership Helper

```typescript
export async function requireOwnership<T extends { userId: string }>(
  ctx: QueryCtx | MutationCtx,
  resourceId: Id<any>,
  tableName: string
): Promise<{ identity: any; resource: T }> {
  const identity = await requireAuth(ctx);
  const resource = await ctx.db.get(resourceId);
  
  if (!resource) {
    throw new Error("Not found");
  }
  
  if (resource.userId !== identity.subject) {
    throw new Error("Resource not found or access denied");
  }
  
  return { identity, resource: resource as T };
}

// Usage
export const updateRecipe = mutation({
  args: {
    id: v.id("recipes"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user owns this recipe
    const { resource: recipe } = await requireOwnership(
      ctx,
      args.id,
      "recipes"
    );
    
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});
```

### requireOwnershipOrAdmin Helper

```typescript
export async function requireOwnershipOrAdmin<T extends { userId: string }>(
  ctx: QueryCtx | MutationCtx,
  resourceId: Id<any>,
  tableName: string
): Promise<{ identity: any; resource: T; user: any }> {
  const identity = await requireAuth(ctx);
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  
  if (!user) {
    throw new Error("User not found");
  }
  
  const resource = await ctx.db.get(resourceId);
  
  if (!resource) {
    throw new Error("Not found");
  }
  
  // Allow if owner OR admin
  if (resource.userId !== identity.subject && !user.isAdmin) {
    throw new Error("Resource not found or access denied");
  }
  
  return { identity, resource: resource as T, user };
}

// Usage
export const deleteRecipe = mutation({
  args: { id: v.id("recipes") },
  handler: async (ctx, args) => {
    // Owner or admin can delete
    await requireOwnershipOrAdmin(ctx, args.id, "recipes");
    
    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedAt: Date.now(),
    });
  },
});
```

---

## Feature Gate Helpers

### requireFeature Helper

```typescript
import { SUBSCRIPTION_TIERS } from "./subscriptions";

export async function requireFeature(
  ctx: QueryCtx | MutationCtx,
  feature: string
) {
  const identity = await requireAuth(ctx);
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  
  if (!user) {
    throw new Error("User not found");
  }
  
  const tier = SUBSCRIPTION_TIERS[user.subscriptionTier];
  
  if (!tier.features[feature]) {
    throw new Error(`${feature} requires subscription upgrade`);
  }
  
  return { identity, user };
}

// Usage
export const generateFusionRecipe = mutation({
  args: { cuisines: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Requires fusionKitchen feature
    await requireFeature(ctx, "fusionKitchen");
    
    // Generate fusion recipe...
  },
});
```

### checkDailyLimit Helper

```typescript
export async function checkDailyLimit(
  ctx: QueryCtx | MutationCtx,
  limitType: "recipesPerDay" | "imagesPerDay" | "liveChefMinutes"
) {
  const identity = await requireAuth(ctx);
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  
  if (!user) {
    throw new Error("User not found");
  }
  
  const tier = SUBSCRIPTION_TIERS[user.subscriptionTier];
  const limit = tier.limits[limitType];
  
  // Get today's usage
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const usage = await ctx.db
    .query("usage")
    .withIndex("by_user_date", (q) => 
      q.eq("userId", user._id).gte("date", todayStart)
    )
    .first();
  
  const currentUsage = usage?.[limitType] ?? 0;
  
  if (currentUsage >= limit) {
    throw new Error(`Daily ${limitType} limit reached. Upgrade for more!`);
  }
  
  return { identity, user, currentUsage, limit };
}

// Usage
export const generateRecipe = mutation({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    // Check daily limit
    await checkDailyLimit(ctx, "recipesPerDay");
    
    // Generate recipe...
    
    // Increment usage counter
    await incrementUsage(ctx, "recipesPerDay");
  },
});
```

---

## Rate Limiting

### checkRateLimit Helper

```typescript
export async function checkRateLimit(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  action: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
  const windowStart = Date.now() - windowMs;
  
  const recentAttempts = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_action_time", (q) => 
      q.eq("userId", userId)
       .eq("action", action)
       .gte("timestamp", windowStart)
    )
    .collect();
  
  if (recentAttempts.length >= limit) {
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(windowMs / 60000)} minutes.`);
  }
  
  // Record this attempt
  await ctx.db.insert("rateLimits", {
    userId,
    action,
    timestamp: Date.now(),
  });
}

// Usage
export const sendMessage = mutation({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    
    // Rate limit: 10 messages per minute
    await checkRateLimit(ctx, identity.subject, "send_message", 10, 60000);
    
    // Send message...
  },
});
```

---

## Age Verification

### requireAgeVerification Helper

```typescript
export async function requireAgeVerification(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);
  
  const verification = await ctx.db
    .query("ageVerifications")
    .withIndex("by_user", (q) => q.eq("userId", identity.subject))
    .first();
  
  if (!verification || !verification.isOfAge) {
    throw new Error("Age verification required for spirited content");
  }
  
  return { identity, verification };
}

// Usage
export const generateCocktail = mutation({
  args: { ingredients: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Requires age verification
    await requireAgeVerification(ctx);
    
    // Generate cocktail recipe...
  },
});
```

---

## Combined Helpers

### getUserWithPermissions

```typescript
export async function getUserWithPermissions(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  
  if (!user) {
    throw new Error("User not found");
  }
  
  const tier = SUBSCRIPTION_TIERS[user.subscriptionTier];
  
  return {
    identity,
    user,
    tier,
    hasFeature: (feature: string) => tier.features[feature] ?? false,
    hasRole: (role: UserRole) => hasRole(user.role, role),
  };
}

// Usage
export const createCollection = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const { user, tier, hasFeature } = await getUserWithPermissions(ctx);
    
    // Check collection limit
    const collectionCount = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()
      .then(c => c.length);
    
    if (collectionCount >= tier.limits.collectionsMax) {
      throw new Error("Collection limit reached. Upgrade for more!");
    }
    
    // Create collection...
  },
});
```

---

## Anti-Patterns

### ❌ Don't Repeat Auth Checks

```typescript
// ❌ BAD - Repeated code
export const updateRecipe = mutation({
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    // ... repeated in every function
  },
});

// ✅ GOOD - Use helper
export const updateRecipe = mutation({
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    // ...
  },
});
```

### ❌ Don't Check Permissions Client-Side Only

```typescript
// ❌ BAD - Client-side only
if (user.role === "admin") {
  await deleteUser(userId); // No server check!
}

// ✅ GOOD - Server-side enforcement
export const deleteUser = mutation({
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // Server enforces
    // ...
  },
});
```

---

## When to Use This Pattern

✅ **Use for:**
- All authenticated endpoints
- Role-based access control
- Resource ownership verification
- Feature gating
- Rate limiting

❌ **Don't use for:**
- Public endpoints (no auth needed)
- Internal mutations (already trusted)

---

## Benefits

1. **DRY code** - No repeated auth logic
2. **Consistent** - Same checks everywhere
3. **Type-safe** - TypeScript enforced
4. **Testable** - Easy to unit test
5. **Maintainable** - Change once, apply everywhere

---

## Related Patterns

- See `session-management.md` for session handling
- See `rbac-implementation.md` for role details
- See `subscription-enforcement.md` for feature gates

---

*Extracted: 2026-02-18*
