# Error Handling

## Source
Extracted from BistroLens `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md` (Section 7)

---

## Pattern: Convex Error Handling

Proper error handling ensures users get clear feedback and developers can debug issues quickly.

---

## Standard Error Types

### Auth Errors

```typescript
// Unauthorized (not logged in)
throw new Error("Unauthorized");

// Session expired
throw new Error("Session expired");

// Insufficient permissions
throw new Error("Admin access required");
throw new Error("Premium subscription required");
```

### Validation Errors

```typescript
// Missing required field
throw new Error("Invalid input: title required");

// Invalid format
throw new Error("Invalid email format");

// Out of range
throw new Error("Title must be between 1 and 200 characters");

// Invalid enum value
throw new Error("Status must be: draft, published, or archived");
```

### Not Found Errors

```typescript
// Resource doesn't exist
throw new Error("Recipe not found");

// Resource exists but user can't access
throw new Error("Resource not found or access denied");

// Generic not found
throw new Error("Not found");
```

### Business Logic Errors

```typescript
// Rate limit
throw new Error("Rate limit exceeded. Try again in 5 minutes.");

// Quota exceeded
throw new Error("Daily recipe limit reached. Upgrade for more!");

// Feature gate
throw new Error("Subscription required for this feature");

// Duplicate
throw new Error("Recipe with this title already exists");
```

---

## Error Handling in Queries

### Query with Error Handling

```typescript
// convex/recipes.ts
export const getRecipe = query({
  args: { id: v.id("recipes") },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    
    // Get document
    const recipe = await ctx.db.get(args.id);
    
    // Not found check
    if (!recipe) {
      throw new Error("Recipe not found");
    }
    
    // Soft delete check
    if (recipe.isDeleted) {
      throw new Error("Recipe not found");
    }
    
    // Ownership check
    if (recipe.userId !== identity.subject) {
      throw new Error("Resource not found or access denied");
    }
    
    return recipe;
  },
});
```

---

## Error Handling in Mutations

### Mutation with Validation

```typescript
export const createRecipe = mutation({
  args: {
    title: v.string(),
    ingredients: v.array(v.object({
      name: v.string(),
      amount: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    
    // 2. Input validation
    if (args.title.length === 0) {
      throw new Error("Invalid input: title required");
    }
    
    if (args.title.length > 200) {
      throw new Error("Title must be between 1 and 200 characters");
    }
    
    if (args.ingredients.length === 0) {
      throw new Error("At least one ingredient required");
    }
    
    // 3. Business logic validation
    const todayCount = await getDailyRecipeCount(ctx, identity.subject);
    const user = await getUserWithSubscription(ctx, identity.subject);
    const limit = SUBSCRIPTION_TIERS[user.tier].limits.recipesPerDay;
    
    if (todayCount >= limit) {
      throw new Error("Daily recipe limit reached. Upgrade for more!");
    }
    
    // 4. Create document
    try {
      const recipeId = await ctx.db.insert("recipes", {
        ...args,
        userId: identity.subject,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      return recipeId;
    } catch (error) {
      // Database errors (rare)
      console.error("Failed to create recipe:", error);
      throw new Error("Failed to create recipe. Please try again.");
    }
  },
});
```

---

## Client-Side Error Handling

### React Component Error Handling

```typescript
// components/RecipeList.tsx
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function RecipeList() {
  const recipes = useQuery(api.recipes.listUserRecipes);
  
  // Loading state
  if (recipes === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }
  
  // Error state
  if (recipes instanceof Error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="font-semibold text-red-900">Error Loading Recipes</h3>
        <p className="text-red-700">{recipes.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }
  
  // Empty state
  if (recipes.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">No recipes yet</p>
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
          Create Your First Recipe
        </button>
      </div>
    );
  }
  
  // Success state
  return (
    <div className="grid gap-4">
      {recipes.map(recipe => (
        <RecipeCard key={recipe._id} recipe={recipe} />
      ))}
    </div>
  );
}
```

### Mutation Error Handling

```typescript
// components/CreateRecipeForm.tsx
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function CreateRecipeForm() {
  const createRecipe = useMutation(api.recipes.createRecipe);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    
    try {
      await createRecipe({
        title,
        ingredients: [{ name: "Example", amount: "1 cup" }],
      });
      
      // Success - redirect or show success message
      window.location.href = "/recipes";
    } catch (err) {
      // Error - show user-friendly message
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      <input
        type="text"
        name="title"
        placeholder="Recipe title"
        required
        disabled={isLoading}
      />
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Creating..." : "Create Recipe"}
      </button>
    </form>
  );
}
```

---

## Error Boundary Pattern

### React Error Boundary

```typescript
// components/ErrorBoundary.tsx
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Error boundary caught:", error, errorInfo);
    // Log to error tracking service (Sentry, etc.)
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600">
            Something went wrong
          </h2>
          <p className="mt-2 text-gray-600">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Reload Page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <RecipeList />
</ErrorBoundary>
```

---

## Helper Functions

### Auth Guard

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from "./_generated/server";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

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
```

### Ownership Verification

```typescript
export async function requireOwnership(
  ctx: QueryCtx | MutationCtx,
  resourceId: Id<any>,
  tableName: string
) {
  const identity = await requireAuth(ctx);
  const resource = await ctx.db.get(resourceId);
  
  if (!resource) {
    throw new Error("Not found");
  }
  
  if (resource.userId !== identity.subject) {
    throw new Error("Resource not found or access denied");
  }
  
  return { identity, resource };
}

// Usage
const { resource } = await requireOwnership(ctx, args.recipeId, "recipes");
```

---

## Anti-Patterns

### ❌ Don't Expose Internal Errors

```typescript
// ❌ BAD - Exposes internal details
catch (error) {
  throw new Error(error.stack); // Shows file paths, etc.
}

// ✅ GOOD - User-friendly message
catch (error) {
  console.error("Internal error:", error);
  throw new Error("Failed to create recipe. Please try again.");
}
```

### ❌ Don't Swallow Errors

```typescript
// ❌ BAD - Silent failure
try {
  await createRecipe();
} catch (error) {
  // Nothing - user doesn't know it failed!
}

// ✅ GOOD - Show error to user
try {
  await createRecipe();
} catch (error) {
  setError(error.message);
}
```

### ❌ Don't Use Generic Error Messages

```typescript
// ❌ BAD - Not helpful
throw new Error("Error");
throw new Error("Something went wrong");

// ✅ GOOD - Specific and actionable
throw new Error("Recipe title is required");
throw new Error("Daily limit reached. Upgrade to create more recipes.");
```

---

## When to Use This Pattern

✅ **Use for:**
- All queries and mutations
- User input validation
- Business logic enforcement
- Auth and permission checks
- Client-side error display

❌ **Don't use for:**
- Expected conditions (use if/else, not throw)
- Flow control (errors are for errors!)
- Performance-critical paths (errors are slow)

---

## Benefits

1. **Clear feedback** - Users know what went wrong
2. **Debuggable** - Developers can trace issues
3. **Secure** - Doesn't expose internal details
4. **Consistent** - Standard error format across app

---

## Error Message Guidelines

1. **Be specific** - "Title required" not "Invalid input"
2. **Be actionable** - Tell user how to fix it
3. **Be friendly** - "Oops!" not "ERROR 500"
4. **Be secure** - Don't expose internal details
5. **Be consistent** - Use same format everywhere

---

## Related Patterns

- See `mutation-patterns.md` for validation patterns
- See `query-patterns.md` for auth checks
- See `real-time-subscriptions.md` for client error handling

---

*Extracted: 2026-02-18*
