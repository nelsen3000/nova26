# Convex Mutation Patterns

## Source
Extracted from BistroLens `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md`

## Pattern: Standard Mutation Structure

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createRecipe = mutation({
  args: {
    title: v.string(),
    ingredients: v.array(v.object({
      name: v.string(),
      amount: v.string(),
      unit: v.string(),
    })),
    instructions: v.array(v.string()),
    cookTime: v.number(),
    servings: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // 2. Input validation
    if (args.title.length > 200) {
      throw new Error("Title too long (max 200 characters)");
    }
    
    if (args.cookTime < 0 || args.cookTime > 1440) {
      throw new Error("Cook time must be between 0 and 1440 minutes");
    }
    
    // 3. Rate limit check (optional but recommended)
    await checkRateLimit(ctx, identity.subject, "recipe_create");
    
    // 4. Create with timestamps
    const recipeId = await ctx.db.insert("recipes", {
      ...args,
      userId: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
    });
    
    // 5. Return created ID
    return recipeId;
  },
});
```

## Pattern: Update with Patch

```typescript
export const updateRecipe = mutation({
  args: {
    id: v.id("recipes"),
    title: v.optional(v.string()),
    ingredients: v.optional(v.array(v.object({
      name: v.string(),
      amount: v.string(),
      unit: v.string(),
    }))),
    instructions: v.optional(v.array(v.string())),
    cookTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // 2. Verify ownership
    const recipe = await ctx.db.get(args.id);
    if (!recipe) {
      throw new Error("Recipe not found");
    }
    
    if (recipe.userId !== identity.subject) {
      throw new Error("Unauthorized: not recipe owner");
    }
    
    if (recipe.isDeleted) {
      throw new Error("Cannot update deleted recipe");
    }
    
    // 3. Validate updates
    if (args.title && args.title.length > 200) {
      throw new Error("Title too long");
    }
    
    // 4. Patch only provided fields
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    
    return id;
  },
});
```

## Pattern: Soft Delete (REQUIRED)

```typescript
export const deleteRecipe = mutation({
  args: { id: v.id("recipes") },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // 2. Verify ownership
    const recipe = await ctx.db.get(args.id);
    if (!recipe) {
      throw new Error("Recipe not found");
    }
    
    if (recipe.userId !== identity.subject) {
      throw new Error("Unauthorized: not recipe owner");
    }
    
    // 3. Soft delete (NEVER hard delete user data)
    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return { success: true };
  },
});

// ❌ NEVER do this for user data
// await ctx.db.delete(args.id);
```

## Pattern: Batch Operations

```typescript
export const batchCreateRecipes = mutation({
  args: {
    recipes: v.array(v.object({
      title: v.string(),
      ingredients: v.array(v.object({
        name: v.string(),
        amount: v.string(),
        unit: v.string(),
      })),
      instructions: v.array(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Validate batch size
    if (args.recipes.length > 50) {
      throw new Error("Maximum 50 recipes per batch");
    }
    
    // Insert all recipes
    const recipeIds = await Promise.all(
      args.recipes.map(recipe =>
        ctx.db.insert("recipes", {
          ...recipe,
          userId: identity.subject,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      )
    );
    
    return recipeIds;
  },
});
```

## Pattern: Transactional Updates

```typescript
export const transferRecipeOwnership = mutation({
  args: {
    recipeId: v.id("recipes"),
    newOwnerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // 1. Verify current ownership
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.userId !== identity.subject) {
      throw new Error("Not authorized");
    }
    
    // 2. Verify new owner exists
    const newOwner = await ctx.db.get(args.newOwnerId);
    if (!newOwner) {
      throw new Error("New owner not found");
    }
    
    // 3. Update recipe ownership
    await ctx.db.patch(args.recipeId, {
      userId: args.newOwnerId,
      previousOwnerId: identity.subject,
      transferredAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    // 4. Log the transfer
    await ctx.db.insert("auditLogs", {
      eventType: "recipe_transfer",
      fromUserId: identity.subject,
      toUserId: args.newOwnerId,
      resourceId: args.recipeId,
      timestamp: Date.now(),
    });
    
    return { success: true };
  },
});
```

## Pattern: Optimistic Updates

```typescript
// Client-side optimistic update
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function RecipeCard({ recipe }) {
  const updateRecipe = useMutation(api.recipes.updateRecipe);
  
  const handleToggleFavorite = async () => {
    // Optimistic update
    const optimisticRecipe = {
      ...recipe,
      isFavorite: !recipe.isFavorite,
    };
    
    try {
      await updateRecipe({
        id: recipe._id,
        isFavorite: !recipe.isFavorite,
      });
    } catch (error) {
      // Revert on error
      console.error("Failed to update:", error);
    }
  };
  
  return (
    <button onClick={handleToggleFavorite}>
      {recipe.isFavorite ? "★" : "☆"}
    </button>
  );
}
```

## Pattern: Idempotent Mutations

```typescript
export const createOrUpdateRecipe = mutation({
  args: {
    externalId: v.string(), // Unique ID from external system
    title: v.string(),
    ingredients: v.array(v.object({
      name: v.string(),
      amount: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Check if recipe already exists
    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
      .first();
    
    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        title: args.title,
        ingredients: args.ingredients,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new
      return await ctx.db.insert("recipes", {
        ...args,
        userId: identity.subject,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});
```

## When to Use These Patterns

✅ **Use for:**
- Every Convex mutation function
- When creating/updating/deleting data
- When implementing batch operations
- When transferring ownership
- When syncing with external systems

❌ **Don't use for:**
- Read-only data fetching (use queries instead)

## Benefits

1. **Data Integrity**: Proper validation prevents bad data
2. **Security**: Auth and ownership checks
3. **Auditability**: Timestamps and soft deletes
4. **Performance**: Batch operations reduce round trips
5. **Reliability**: Idempotent operations handle retries

## Anti-Patterns

- Using `ctx.db.delete()` for user data instead of soft delete with `isDeleted` flag
- Skipping auth checks or ownership verification before mutating records
- Omitting input validation (e.g., string length, numeric range) and relying solely on Convex validators
- Running unbounded batch operations without a maximum size limit

## Related Patterns

- See `query-patterns.md` for reading data
- See `../03-auth-patterns/auth-helpers.md` for reusable auth functions
- See `../11-validation/rate-limiting.md` for protecting mutations
