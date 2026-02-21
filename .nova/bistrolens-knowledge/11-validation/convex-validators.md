# Convex Validators

## Source
Extracted from BistroLens `convex/schema.ts`, `convex/auth.ts`, `convex/securityGuards.ts`

---

## Pattern: Convex Schema Validators

BistroLens uses Convex's built-in `v` validator library to define type-safe schemas and mutation arguments. Validators run server-side and are enforced at the database layer.

---

## Core Validator Types

### Code Example

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // String fields
  profiles: defineTable({
    userId: v.string(),
    email: v.string(),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),

    // Nested object validator
    settings: v.object({
      // Union of string literals (enum pattern)
      fontSize: v.union(v.literal("sm"), v.literal("base"), v.literal("lg")),
      mode: v.union(v.literal("food"), v.literal("drinks")),
      theme: v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),

      // Nested object with optional fields
      profile: v.object({
        name: v.string(),
        zipCode: v.optional(v.string()),
        dietaryPreferences: v.array(v.string()),
        allergies: v.array(v.string()),
        // Deeply nested optional object
        healthGoals: v.optional(v.object({
          calories: v.optional(v.number()),
          activityLevel: v.optional(v.union(
            v.literal("sedentary"),
            v.literal("light"),
            v.literal("moderate"),
            v.literal("active"),
            v.literal("athlete")
          )),
        })),
      }),

      // Array of objects
      pantry: v.array(v.object({
        name: v.string(),
        purchaseDate: v.string(),
        quantity: v.string()
      })),

      // Number field
      defaultServings: v.number(),

      // Optional boolean
      soundEffects: v.optional(v.boolean()),
    }),

    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  // Subscription table with enum status
  subscriptions: defineTable({
    userId: v.string(),
    tier: v.union(v.literal("free"), v.literal("premium"), v.literal("chef_master")),
    status: v.union(v.literal("active"), v.literal("canceled"), v.literal("past_due")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_userId", ["userId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"]),
});
```

---

## Validators in Mutation Args

### Code Example

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Mutation with typed args
export const updateSubscription = mutation({
  args: {
    userId: v.string(),
    // Enum via union of literals
    tier: v.union(
      v.literal("free"),
      v.literal("premium"),
      v.literal("chef_master")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due")
    ),
    // Optional fields
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // args are fully typed — TypeScript knows tier is "free" | "premium" | "chef_master"
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        status: args.status,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        updatedAt: Date.now()
      });
      return existing._id;
    }
    // ...
  },
});

// Query with typed args
export const getRecipeById = query({
  args: {
    id: v.id("recipes"), // Typed Convex document ID
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Optional number arg with default
export const getFeaturedRecipes = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 15; // Safe default
    return await ctx.db
      .query("recipes")
      .withIndex("by_isFeatured", (q) => q.eq("isFeatured", true))
      .take(limit);
  },
});
```

---

## ConvexError for Validation Failures

### Code Example

```typescript
import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";

// Throw structured errors from guards
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Authentication required"
    });
  }

  return {
    userId: identity.subject,
    email: identity.email,
  };
}

// Subscription tier validation
export async function requireSubscription(
  ctx: QueryCtx | MutationCtx,
  minimumTier: "free" | "premium" | "chef_master"
) {
  const user = await requireAuth(ctx);

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", user.userId))
    .first();

  const tierHierarchy = { free: 0, premium: 1, chef_master: 2 };
  const currentTier = subscription?.tier || "free";

  if (tierHierarchy[currentTier] < tierHierarchy[minimumTier]) {
    throw new ConvexError({
      code: "SUBSCRIPTION_REQUIRED",
      message: `This feature requires ${minimumTier} subscription`,
      currentTier,
      requiredTier: minimumTier
    });
  }

  return { userId: user.userId, tier: currentTier };
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Using v.any() for structured data — loses type safety
export const updateProfile = mutation({
  args: {
    userId: v.string(),
    settings: v.any() // ❌ No validation, no types
  },
  handler: async (ctx, args) => {
    // args.settings could be anything — no safety
  }
});

// Throwing plain Error instead of ConvexError
if (!identity) {
  throw new Error("Not authenticated"); // ❌ Loses structured error data
}
```

### ✅ Do This Instead

```typescript
// Define the full shape with v.object()
export const updateProfile = mutation({
  args: {
    userId: v.string(),
    settings: v.object({
      fontSize: v.union(v.literal("sm"), v.literal("base"), v.literal("lg")),
      theme: v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),
    })
  },
  handler: async (ctx, args) => {
    // args.settings is fully typed
  }
});

// Use ConvexError for structured error data
throw new ConvexError({
  code: "UNAUTHORIZED",
  message: "Authentication required"
});
```

---

## When to Use This Pattern

✅ **Use for:**
- All Convex schema table definitions
- Mutation and query argument validation
- Enforcing enum values at the database layer
- Structured error responses from server functions

❌ **Don't use for:**
- Client-side form validation (use local state + regex)
- Complex cross-field business rules (use a service layer)
- Runtime type checking outside Convex context

---

## Benefits

1. Type safety flows from schema → mutation args → TypeScript types automatically
2. Validation runs server-side — cannot be bypassed by clients
3. `v.union(v.literal(...))` creates exhaustive enum types
4. `v.optional()` makes fields nullable without extra checks
5. `ConvexError` carries structured metadata for client error handling

---

## Related Patterns

- See `schema-validation.md` for Zod-based validation in services
- See `business-rules.md` for tier/subscription enforcement
- See `../03-auth-patterns/auth-helpers.md` for `requireAuth` usage

---

*Extracted: 2026-02-18*
