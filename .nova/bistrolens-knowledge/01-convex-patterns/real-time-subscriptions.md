# Real-Time Subscriptions

## Source
Extracted from BistroLens `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md` (Section 5)

---

## Pattern: Convex Real-Time Subscriptions

Convex provides automatic real-time updates through `useQuery`. When data changes on the server, all subscribed clients receive updates instantly via WebSocket.

---

## Basic Subscription Pattern

### Simple useQuery

```typescript
// components/RecipeList.tsx
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function RecipeList() {
  // Automatically subscribes to real-time updates
  const recipes = useQuery(api.recipes.listUserRecipes, {
    limit: 20,
  });
  
  // Handle loading state
  if (recipes === undefined) {
    return <LoadingSpinner />;
  }
  
  // Handle error state
  if (recipes instanceof Error) {
    return <ErrorMessage error={recipes} />;
  }
  
  // Render data (updates automatically)
  return (
    <div>
      {recipes.map(recipe => (
        <RecipeCard key={recipe._id} recipe={recipe} />
      ))}
    </div>
  );
}
```

### Query Definition

```typescript
// convex/recipes.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const listUserRecipes = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const limit = args.limit ?? 20;
    
    return await ctx.db
      .query("recipes")
      .withIndex("by_user_created", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .order("desc")
      .take(limit);
  },
});
```

---

## Conditional Subscriptions

### Skip Pattern

```typescript
// Only subscribe when authenticated
const user = useQuery(api.auth.getCurrentUser);
const recipes = useQuery(
  user ? api.recipes.listUserRecipes : "skip",
  user ? { limit: 20 } : undefined
);

// Only subscribe when tab is active
const [isActive, setIsActive] = useState(true);
const liveData = useQuery(
  isActive ? api.data.getLiveData : "skip"
);
```

### Conditional by Feature Flag

```typescript
const { features } = useSubscription();
const premiumData = useQuery(
  features.premiumFeature ? api.premium.getData : "skip"
);
```

---

## Scoped Subscriptions

### User-Scoped (Most Common)

```typescript
// ✅ GOOD - Scoped to current user
export const listUserRecipes = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    return await ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(20); // Always limit!
  },
});
```

### Collection-Scoped

```typescript
// Scoped to specific collection
export const listCollectionRecipes = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Verify user owns collection
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.userId !== identity.subject) {
      throw new Error("Collection not found");
    }
    
    return await ctx.db
      .query("collectionRecipes")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .take(100);
  },
});
```

---

## Subscription Limits

### Always Limit Results

```typescript
// ❌ BAD - Unbounded subscription
const allRecipes = useQuery(api.recipes.listAll);

// ✅ GOOD - Limited subscription
const recipes = useQuery(api.recipes.listUserRecipes, {
  limit: 20,
});
```

### Pagination for Large Lists

```typescript
// Use paginated query for large datasets
const { results, status, loadMore } = usePaginatedQuery(
  api.recipes.listPaginated,
  {},
  { initialNumItems: 20 }
);

// Load more on scroll
useEffect(() => {
  if (isNearBottom && status === "CanLoadMore") {
    loadMore(20);
  }
}, [isNearBottom, status, loadMore]);
```

---

## Subscription Cleanup

### Automatic Cleanup

```typescript
// React automatically unsubscribes when component unmounts
export function RecipeList() {
  const recipes = useQuery(api.recipes.list);
  // No cleanup needed!
  return <div>{/* ... */}</div>;
}
```

### Manual Subscription (Advanced)

```typescript
// Only needed for non-React contexts
import { useEffect } from "react";
import { useConvex } from "convex/react";

export function useManualSubscription() {
  const convex = useConvex();
  
  useEffect(() => {
    const unsubscribe = convex.onUpdate(
      api.recipes.list,
      {},
      (recipes) => {
        console.log("Recipes updated:", recipes);
      }
    );
    
    // Cleanup on unmount
    return () => unsubscribe();
  }, [convex]);
}
```

---

## Optimistic Updates

### Pattern for Instant UI

```typescript
// components/RecipeActions.tsx
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function RecipeActions({ recipeId }: { recipeId: Id<"recipes"> }) {
  const recipe = useQuery(api.recipes.get, { id: recipeId });
  const toggleFavorite = useMutation(api.recipes.toggleFavorite);
  
  async function handleToggle() {
    // Optimistic update (instant UI feedback)
    const optimisticValue = !recipe?.isFavorite;
    
    try {
      await toggleFavorite({ id: recipeId });
      // Real-time subscription updates UI automatically
    } catch (error) {
      // Revert on error (subscription reverts automatically)
      console.error("Failed to toggle favorite:", error);
    }
  }
  
  return (
    <button onClick={handleToggle}>
      {recipe?.isFavorite ? "★" : "☆"}
    </button>
  );
}
```

---

## Multiple Subscriptions

### Parallel Queries

```typescript
export function Dashboard() {
  // All subscribe independently
  const user = useQuery(api.users.getCurrent);
  const recipes = useQuery(api.recipes.listRecent, { limit: 5 });
  const collections = useQuery(api.collections.list);
  const stats = useQuery(api.stats.getUserStats);
  
  // Handle loading states
  if (!user || !recipes || !collections || !stats) {
    return <LoadingSpinner />;
  }
  
  return (
    <div>
      <UserProfile user={user} />
      <RecentRecipes recipes={recipes} />
      <Collections collections={collections} />
      <Stats stats={stats} />
    </div>
  );
}
```

### Dependent Queries

```typescript
export function RecipeDetails({ recipeId }: { recipeId: Id<"recipes"> }) {
  // First query
  const recipe = useQuery(api.recipes.get, { id: recipeId });
  
  // Second query depends on first
  const author = useQuery(
    recipe ? api.users.get : "skip",
    recipe ? { id: recipe.userId } : undefined
  );
  
  if (!recipe) return <LoadingSpinner />;
  
  return (
    <div>
      <h1>{recipe.title}</h1>
      {author && <p>By {author.name}</p>}
    </div>
  );
}
```

---

## Anti-Patterns

### ❌ Don't Subscribe to All Data

```typescript
// ❌ BAD - Subscribes to entire table
const allUsers = useQuery(api.users.listAll);

// ✅ GOOD - Scoped and limited
const recentUsers = useQuery(api.users.listRecent, { limit: 10 });
```

### ❌ Don't Poll Instead of Subscribe

```typescript
// ❌ BAD - Manual polling
useEffect(() => {
  const interval = setInterval(() => {
    fetchRecipes();
  }, 1000);
  return () => clearInterval(interval);
}, []);

// ✅ GOOD - Real-time subscription
const recipes = useQuery(api.recipes.list);
```

### ❌ Don't Forget Loading States

```typescript
// ❌ BAD - No loading state
const recipes = useQuery(api.recipes.list);
return <div>{recipes.map(...)}</div>; // Crashes if undefined

// ✅ GOOD - Handle loading
const recipes = useQuery(api.recipes.list);
if (recipes === undefined) return <LoadingSpinner />;
return <div>{recipes.map(...)}</div>;
```

---

## When to Use This Pattern

✅ **Use for:**
- User-specific data (recipes, collections, settings)
- Collaborative features (shared meal plans)
- Live updates (chat, notifications)
- Dashboard metrics
- Form data that changes frequently

❌ **Don't use for:**
- Static content (help docs, terms of service)
- Rarely changing data (system config)
- Large datasets without pagination
- Public data that doesn't need real-time updates

---

## Benefits

1. **Automatic updates** - No polling or manual refresh
2. **Efficient** - WebSocket connection, not HTTP polling
3. **Type-safe** - Full TypeScript support
4. **Simple API** - Just `useQuery`, no complex setup
5. **Optimistic updates** - Instant UI feedback
6. **Automatic cleanup** - No memory leaks

---

## Performance Tips

1. **Limit results** - Always use `.take(n)` or pagination
2. **Scope queries** - Filter by userId, not client-side
3. **Skip when inactive** - Use conditional subscriptions
4. **Batch queries** - Combine related data in one query
5. **Use indexes** - Ensure queries use proper indexes

---

## Related Patterns

- See `query-patterns.md` for query optimization
- See `mutation-patterns.md` for optimistic updates
- See `performance-optimization.md` for scaling tips

---

*Extracted: 2026-02-18*
