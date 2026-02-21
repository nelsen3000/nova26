# Convex Validators

## Source
Extracted from BistroLens `convex/schema.ts`, `convex/auth.ts`, `convex/social.ts`, `convex/subscriptions.ts`, `convex/ratings.ts`, `convex/admin.ts`

---

## Pattern: Convex Validators

Convex validators provide runtime type validation for mutations and queries using the `v` object from `convex/values`. They ensure type safety at the API boundary and generate TypeScript types automatically.

---

## Basic Validators

### Primitive Types

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// String validator
export const updateEmail = mutation({
  args: {
    userId: v.string(),
    email: v.string()
  },
  handler: async (ctx, args) => {
    // args.userId and args.email are guaranteed to be strings
    return await ctx.db.patch(args.userId, { email: args.email });
  }
});

// Number validator
export const updateAge = mutation({
  args: {
    userId: v.string(),
    age: v.number()
  },
  handler: async (ctx, args) => {
    // args.age is guaranteed to be a number
    return await ctx.db.patch(args.userId, { age: args.age });
  }
});

// Boolean validator
export const toggleFeature = mutation({
  args: {
    userId: v.string(),
    enabled: v.boolean()
  },
  handler: async (ctx, args) => {
    // args.enabled is guaranteed to be a boolean
    return await ctx.db.patch(args.userId, { featureEnabled: args.enabled });
  }
});
```

---

## Optional Fields

### Using v.optional()

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Optional fields allow undefined values
export const upsertProfile = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    settings: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    // fullName, avatarUrl, and settings can be undefined
    const profile = {
      userId: args.userId,
      email: args.email,
      fullName: args.fullName, // string | undefined
      avatarUrl: args.avatarUrl, // string | undefined
      settings: args.settings || defaultSettings
    };
    
    return await ctx.db.insert("profiles", profile);
  }
});
```

---

## Union Types (Enums)

### Literal Unions for Type-Safe Enums

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Union of literal values creates a type-safe enum
export const updateSubscription = mutation({
  args: {
    userId: v.string(),
    tier: v.union(
      v.literal("free"), 
      v.literal("premium"), 
      v.literal("chef_master")
    ),
    status: v.union(
      v.literal("active"), 
      v.literal("canceled"), 
      v.literal("past_due")
    )
  },
  handler: async (ctx, args) => {
    // args.tier can only be "free", "premium", or "chef_master"
    // args.status can only be "active", "canceled", or "past_due"
    // TypeScript will enforce these at compile time
    
    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      tier: args.tier,
      status: args.status,
      createdAt: Date.now()
    });
  }
});

// Multi-level union for skill levels
export const rateRecipe = mutation({
  args: {
    recipeId: v.string(),
    rating: v.number(),
    skillLevel: v.optional(v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ))
  },
  handler: async (ctx, args) => {
    // skillLevel is optional but when provided must be one of the three values
    return await ctx.db.insert("recipeRatings", {
      recipeId: args.recipeId,
      rating: args.rating,
      skillLevel: args.skillLevel,
      createdAt: Date.now()
    });
  }
});
```

---

## Array Validators

### Arrays of Primitives and Objects

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Array of strings
export const updateTags = mutation({
  args: {
    recipeId: v.string(),
    tags: v.array(v.string())
  },
  handler: async (ctx, args) => {
    // args.tags is guaranteed to be string[]
    return await ctx.db.patch(args.recipeId, { tags: args.tags });
  }
});

// Array of objects with structure
export const updateGroceryList = mutation({
  args: {
    userId: v.string(),
    items: v.array(v.object({
      id: v.string(),
      name: v.string(),
      checked: v.boolean(),
      category: v.optional(v.string())
    }))
  },
  handler: async (ctx, args) => {
    // args.items is an array of structured objects
    // Each item has id, name, checked, and optional category
    return await ctx.db.patch(args.userId, { 
      groceryList: args.items 
    });
  }
});

// Optional array (can be undefined)
export const addComment = mutation({
  args: {
    postId: v.string(),
    content: v.string(),
    mentions: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    // mentions can be undefined or string[]
    return await ctx.db.insert("comments", {
      postId: args.postId,
      content: args.content,
      mentions: args.mentions || [],
      createdAt: Date.now()
    });
  }
});
```

---

## Object Validators

### Nested Object Structures

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Simple object validator
export const updateProfile = mutation({
  args: {
    userId: v.string(),
    tasteProfile: v.object({
      likes: v.array(v.string()),
      dislikes: v.array(v.string())
    })
  },
  handler: async (ctx, args) => {
    // args.tasteProfile has guaranteed structure
    return await ctx.db.patch(args.userId, {
      tasteProfile: args.tasteProfile
    });
  }
});

// Deeply nested object with optional fields
export const updateHealthGoals = mutation({
  args: {
    userId: v.string(),
    healthGoals: v.optional(v.object({
      calories: v.optional(v.number()),
      protein: v.optional(v.number()),
      carbs: v.optional(v.number()),
      fat: v.optional(v.number()),
      activityLevel: v.optional(v.union(
        v.literal("sedentary"),
        v.literal("light"),
        v.literal("moderate"),
        v.literal("active"),
        v.literal("athlete")
      )),
      primaryGoal: v.optional(v.union(
        v.literal("lose_fat"),
        v.literal("maintain"),
        v.literal("build_muscle"),
        v.literal("endurance")
      ))
    }))
  },
  handler: async (ctx, args) => {
    // Entire healthGoals object is optional
    // When provided, each field within is also optional
    return await ctx.db.patch(args.userId, {
      healthGoals: args.healthGoals
    });
  }
});
```

---

## Complex Nested Structures

### Recipe Object with Multiple Levels

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Complex nested structure for social posts
export const createSocialPost = mutation({
  args: {
    recipe: v.object({
      id: v.string(),
      title: v.string(),
      description: v.string(),
      imageUrl: v.optional(v.string()),
      cookTime: v.string(),
      difficulty: v.union(
        v.literal("Easy"),
        v.literal("Medium"),
        v.literal("Hard")
      ),
      cuisine: v.string(),
      servings: v.number(),
      steps: v.array(v.object({
        instruction: v.string(),
        tip: v.string()
      })),
      ingredientGroups: v.array(v.object({
        title: v.string(),
        ingredients: v.array(v.object({
          name: v.string(),
          quantity: v.string()
        }))
      }))
    }),
    caption: v.string()
  },
  handler: async (ctx, args) => {
    // Full type safety for deeply nested recipe structure
    const post = {
      recipe: args.recipe,
      caption: args.caption,
      likes: 0,
      comments: 0,
      createdAt: Date.now()
    };
    
    return await ctx.db.insert("socialPosts", post);
  }
});
```

---

## ID Validators

### Convex Document IDs

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ID validator for document references
export const getPost = query({
  args: {
    postId: v.id("socialPosts")
  },
  handler: async (ctx, args) => {
    // args.postId is typed as Id<"socialPosts">
    const post = await ctx.db.get(args.postId);
    return post;
  }
});

// Multiple ID validators
export const linkRecipeToPost = mutation({
  args: {
    postId: v.id("socialPosts"),
    recipeId: v.id("recipes"),
    userId: v.string() // Note: userId is a string, not a Convex ID
  },
  handler: async (ctx, args) => {
    // Type-safe ID references
    const post = await ctx.db.get(args.postId);
    const recipe = await ctx.db.get(args.recipeId);
    
    return await ctx.db.patch(args.postId, {
      recipeId: args.recipeId,
      updatedBy: args.userId
    });
  }
});
```

---

## Float64 Arrays (Embeddings)

### Vector Embeddings

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Float64 arrays for ML embeddings
export const storeCLIPEmbedding = mutation({
  args: {
    textHash: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()), // Array of 64-bit floats
    model: v.string()
  },
  handler: async (ctx, args) => {
    // args.embedding is number[] with float64 precision
    return await ctx.db.insert("clipEmbeddingsCache", {
      textHash: args.textHash,
      text: args.text,
      embedding: args.embedding, // Typically 512 or 1024 dimensions
      model: args.model,
      createdAt: Date.now()
    });
  }
});
```

---

## Record Validators

### Key-Value Maps

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Record validator for dynamic key-value pairs
export const updateChallenges = mutation({
  args: {
    userId: v.string(),
    challenges: v.record(v.string(), v.number())
  },
  handler: async (ctx, args) => {
    // args.challenges is Record<string, number>
    // Example: { "30_day_streak": 15, "recipe_master": 42 }
    return await ctx.db.patch(args.userId, {
      challenges: args.challenges
    });
  }
});
```

---

## Any Validator (Use Sparingly)

### Flexible Data Structures

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// v.any() for unstructured data (use only when necessary)
export const logAnalyticsEvent = mutation({
  args: {
    userId: v.optional(v.string()),
    eventType: v.string(),
    eventData: v.any(), // Flexible event payload
    timestamp: v.number()
  },
  handler: async (ctx, args) => {
    // eventData can be any JSON-serializable value
    return await ctx.db.insert("analyticsEvents", {
      userId: args.userId,
      eventType: args.eventType,
      eventData: args.eventData, // Could be object, array, string, etc.
      timestamp: args.timestamp
    });
  }
});
```

---

## Schema Validators

### Database Schema Definition

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  profiles: defineTable({
    userId: v.string(),
    email: v.string(),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    settings: v.object({
      fontSize: v.union(v.literal("sm"), v.literal("base"), v.literal("lg")),
      mode: v.union(v.literal("food"), v.literal("drinks")),
      theme: v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),
      profile: v.object({
        name: v.string(),
        zipCode: v.optional(v.string()),
        dietaryPreferences: v.array(v.string()),
        allergies: v.array(v.string())
      }),
      pantry: v.array(v.object({
        name: v.string(),
        purchaseDate: v.string(),
        quantity: v.string()
      })),
      tasteProfile: v.object({
        likes: v.array(v.string()),
        dislikes: v.array(v.string())
      }),
      defaultServings: v.number(),
      measurementSystem: v.union(v.literal("Metric"), v.literal("Imperial")),
      country: v.string()
    }),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  subscriptions: defineTable({
    userId: v.string(),
    tier: v.union(v.literal("free"), v.literal("premium"), v.literal("chef_master")),
    status: v.union(v.literal("active"), v.literal("canceled"), v.literal("past_due")),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_userId", ["userId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"])
});
```

---

## Anti-Patterns

### ❌ Don't Use v.any() When Structure is Known

```typescript
// BAD: Using v.any() for structured data
export const updateSettings = mutation({
  args: {
    userId: v.string(),
    settings: v.any() // Too permissive!
  },
  handler: async (ctx, args) => {
    // No type safety, runtime errors likely
    return await ctx.db.patch(args.userId, { settings: args.settings });
  }
});
```

### ✅ Do Define Explicit Structure

```typescript
// GOOD: Explicit structure with type safety
export const updateSettings = mutation({
  args: {
    userId: v.string(),
    settings: v.object({
      fontSize: v.union(v.literal("sm"), v.literal("base"), v.literal("lg")),
      theme: v.union(v.literal("light"), v.literal("dark")),
      notifications: v.boolean()
    })
  },
  handler: async (ctx, args) => {
    // Full type safety and autocomplete
    return await ctx.db.patch(args.userId, { settings: args.settings });
  }
});
```

### ❌ Don't Forget Optional for Nullable Fields

```typescript
// BAD: Required field that might not exist
export const updateProfile = mutation({
  args: {
    userId: v.string(),
    avatarUrl: v.string() // What if user has no avatar?
  },
  handler: async (ctx, args) => {
    // Will fail if avatarUrl is undefined
    return await ctx.db.patch(args.userId, { avatarUrl: args.avatarUrl });
  }
});
```

### ✅ Do Use v.optional() for Nullable Fields

```typescript
// GOOD: Optional field for nullable data
export const updateProfile = mutation({
  args: {
    userId: v.string(),
    avatarUrl: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Handles undefined gracefully
    return await ctx.db.patch(args.userId, { 
      avatarUrl: args.avatarUrl 
    });
  }
});
```

### ❌ Don't Use Strings for Enums

```typescript
// BAD: String allows any value
export const updateTier = mutation({
  args: {
    userId: v.string(),
    tier: v.string() // Could be "premium", "Premium", "PREMIUM", "gold", etc.
  },
  handler: async (ctx, args) => {
    // No compile-time validation
    return await ctx.db.patch(args.userId, { tier: args.tier });
  }
});
```

### ✅ Do Use Literal Unions for Enums

```typescript
// GOOD: Type-safe enum with literal union
export const updateTier = mutation({
  args: {
    userId: v.string(),
    tier: v.union(
      v.literal("free"),
      v.literal("premium"),
      v.literal("chef_master")
    )
  },
  handler: async (ctx, args) => {
    // TypeScript enforces valid values
    return await ctx.db.patch(args.userId, { tier: args.tier });
  }
});
```

---

## When to Use This Pattern

✅ **Use for:**
- All Convex mutation and query arguments
- Database schema definitions
- Type-safe API boundaries
- Runtime validation of user input
- Generating TypeScript types automatically
- Ensuring data consistency across client and server

❌ **Don't use for:**
- Client-side form validation (use Zod or similar)
- Complex business logic validation (use custom validators)
- Data transformation (validators only validate, don't transform)

---

## Benefits

1. **Type Safety**: Automatic TypeScript type generation from validators
2. **Runtime Validation**: Catches invalid data at the API boundary
3. **Self-Documenting**: Validators serve as API documentation
4. **Autocomplete**: Full IDE support for validated types
5. **Compile-Time Errors**: TypeScript catches type mismatches before runtime
6. **No Boilerplate**: No need to write separate type definitions
7. **Convex Integration**: Seamless integration with Convex database and queries

---

## Related Patterns

- See `client-validation.md` for client-side form validation patterns
- See `schema-validation.md` for Zod schema validation
- See `business-rules.md` for complex validation logic
- See `query-patterns.md` for using validators in queries
- See `mutation-patterns.md` for using validators in mutations

---

*Extracted: 2026-02-18*
