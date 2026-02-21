# Performance Optimization

## Source
Extracted from BistroLens `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md` (Section 10)

---

## Pattern: Convex Performance Optimization

Optimize queries, mutations, and subscriptions for fast, scalable applications.

---

## Query Optimization

### Always Use Indexes

```typescript
// ❌ BAD - Full table scan (slow!)
export const listUserRecipes = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const all = await ctx.db.query("recipes").collect();
    return all.filter(r => r.userId === identity.subject);
  },
});

// ✅ GOOD - Uses index (10-100x faster)
export const listUserRecipes = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    return await ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(20);
  },
});
```

### Limit Results

```typescript
// ❌ BAD - Returns all documents
const recipes = await ctx.db
  .query("recipes")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .collect(); // Could be thousands!

// ✅ GOOD - Limits to reasonable amount
const recipes = await ctx.db
  .query("recipes")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .take(20); // Fast and efficient
```

### Use Pagination for Large Lists

```typescript
// For large datasets, use pagination
export const listRecipesPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    return await ctx.db
      .query("recipes")
      .withIndex("by_user_created", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// Client usage
const { results, status, loadMore } = usePaginatedQuery(
  api.recipes.listRecipesPaginated,
  {},
  { initialNumItems: 20 }
);
```

---

## Avoid N+1 Queries

### ❌ Bad: Sequential Queries

```typescript
// ❌ BAD - N+1 problem (slow!)
export const getRecipesWithAuthors = query({
  handler: async (ctx) => {
    const recipes = await ctx.db.query("recipes").take(10);
    
    // This runs 10 separate queries!
    const recipesWithAuthors = [];
    for (const recipe of recipes) {
      const author = await ctx.db.get(recipe.userId); // N+1!
      recipesWithAuthors.push({ ...recipe, author });
    }
    
    return recipesWithAuthors;
  },
});
```

### ✅ Good: Batch Queries

```typescript
// ✅ GOOD - Batch fetch (fast!)
export const getRecipesWithAuthors = query({
  handler: async (ctx) => {
    const recipes = await ctx.db.query("recipes").take(10);
    
    // Get unique user IDs
    const userIds = [...new Set(recipes.map(r => r.userId))];
    
    // Batch fetch all authors at once
    const authors = await Promise.all(
      userIds.map(id => ctx.db.get(id))
    );
    
    // Create lookup map
    const authorMap = new Map(
      authors.map(a => [a._id, a])
    );
    
    // Combine data
    return recipes.map(recipe => ({
      ...recipe,
      author: authorMap.get(recipe.userId),
    }));
  },
});
```

---

## Index Strategy

### Composite Indexes

```typescript
// Schema with composite indexes
export default defineSchema({
  recipes: defineTable({
    userId: v.string(),
    status: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_created", ["userId", "createdAt"]),
});

// Query uses composite index
export const listUserDrafts = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    return await ctx.db
      .query("recipes")
      .withIndex("by_user_status", (q) => 
        q.eq("userId", identity.subject).eq("status", "draft")
      )
      .take(20);
  },
});
```

### Index Order Matters

```typescript
// ✅ GOOD - Equality fields first, range fields last
.index("by_user_created", ["userId", "createdAt"])

// Query: userId = X AND createdAt > Y
// Uses index efficiently

// ❌ BAD - Range field first
.index("by_created_user", ["createdAt", "userId"])

// Query: userId = X AND createdAt > Y
// Less efficient
```

---

## Reduce Payload Size

### Select Only Needed Fields

```typescript
// ❌ BAD - Returns entire document
export const listRecipeTitles = query({
  handler: async (ctx) => {
    return await ctx.db.query("recipes").take(100);
    // Returns all fields: title, ingredients, steps, images, etc.
  },
});

// ✅ GOOD - Returns only needed fields
export const listRecipeTitles = query({
  handler: async (ctx) => {
    const recipes = await ctx.db.query("recipes").take(100);
    return recipes.map(r => ({
      _id: r._id,
      title: r.title,
      createdAt: r.createdAt,
    }));
  },
});
```

---

## Batch Operations

### Batch Inserts

```typescript
// ❌ BAD - Sequential inserts
for (const ingredient of ingredients) {
  await ctx.db.insert("ingredients", ingredient);
}

// ✅ GOOD - Parallel inserts
await Promise.all(
  ingredients.map(ingredient => 
    ctx.db.insert("ingredients", ingredient)
  )
);
```

### Batch Updates

```typescript
// ❌ BAD - Sequential updates
for (const recipeId of recipeIds) {
  await ctx.db.patch(recipeId, { status: "published" });
}

// ✅ GOOD - Parallel updates
await Promise.all(
  recipeIds.map(id => 
    ctx.db.patch(id, { status: "published" })
  )
);
```

---

## Subscription Optimization

### Scope Subscriptions

```typescript
// ❌ BAD - Subscribes to all recipes
const allRecipes = useQuery(api.recipes.listAll);
const userRecipes = allRecipes?.filter(r => r.userId === user.id);

// ✅ GOOD - Subscribes only to user's recipes
const userRecipes = useQuery(api.recipes.listUserRecipes);
```

### Conditional Subscriptions

```typescript
// Skip subscription when not needed
const recipes = useQuery(
  isAuthenticated ? api.recipes.list : "skip"
);

// Skip when tab is inactive
const liveData = useQuery(
  isTabActive ? api.data.getLive : "skip"
);
```

---

## Caching Strategies

### Memoize Expensive Computations

```typescript
// In query, cache computed values
export const getRecipeStats = query({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe) throw new Error("Not found");
    
    // Check if stats already computed
    if (recipe.cachedStats && recipe.statsComputedAt > Date.now() - 3600000) {
      return recipe.cachedStats;
    }
    
    // Compute stats
    const stats = await computeExpensiveStats(ctx, recipe);
    
    // Cache for 1 hour
    await ctx.db.patch(args.recipeId, {
      cachedStats: stats,
      statsComputedAt: Date.now(),
    });
    
    return stats;
  },
});
```

---

## Performance Metrics

### Query Performance Targets

| Operation | Target | Acceptable | Slow |
|-----------|--------|------------|------|
| Indexed query | <10ms | <50ms | >100ms |
| Full scan | N/A | N/A | Always slow |
| Batch fetch (10) | <20ms | <100ms | >200ms |
| Mutation | <50ms | <200ms | >500ms |

### Monitoring Query Performance

```typescript
// Add timing logs for slow queries
export const slowQuery = query({
  handler: async (ctx) => {
    const start = Date.now();
    
    const results = await ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);
    
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn(`Slow query: ${duration}ms`);
    }
    
    return results;
  },
});
```

---

## Anti-Patterns

### ❌ Don't Fetch All Then Filter

```typescript
// ❌ BAD - Fetches everything
const all = await ctx.db.query("recipes").collect();
const filtered = all.filter(r => r.status === "published");

// ✅ GOOD - Filters server-side
const filtered = await ctx.db
  .query("recipes")
  .withIndex("by_status", (q) => q.eq("status", "published"))
  .take(20);
```

### ❌ Don't Use Queries for Mutations

```typescript
// ❌ BAD - Query with side effects
export const incrementViews = query({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.recipeId);
    await ctx.db.patch(args.recipeId, {
      views: recipe.views + 1, // Side effect in query!
    });
    return recipe;
  },
});

// ✅ GOOD - Use mutation for writes
export const incrementViews = mutation({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.recipeId);
    await ctx.db.patch(args.recipeId, {
      views: recipe.views + 1,
    });
    return recipe;
  },
});
```

### ❌ Don't Over-Subscribe

```typescript
// ❌ BAD - Too many subscriptions
const user = useQuery(api.users.get);
const recipes = useQuery(api.recipes.list);
const collections = useQuery(api.collections.list);
const favorites = useQuery(api.favorites.list);
const comments = useQuery(api.comments.list);
const ratings = useQuery(api.ratings.list);
// 6 subscriptions = 6 WebSocket connections!

// ✅ GOOD - Combine related data
const dashboard = useQuery(api.dashboard.getData);
// Returns: { user, recipes, collections, favorites }
// 1 subscription = 1 WebSocket connection
```

---

## When to Use This Pattern

✅ **Use for:**
- All production queries
- Large datasets
- Frequently accessed data
- Real-time features
- Mobile apps (bandwidth matters)

❌ **Don't use for:**
- Prototypes (optimize later)
- Admin tools (small user base)
- One-time migrations

---

## Benefits

1. **Fast queries** - 10-100x faster with indexes
2. **Lower costs** - Fewer database reads
3. **Better UX** - Instant loading
4. **Scalable** - Handles growth
5. **Efficient** - Reduces bandwidth

---

## Performance Checklist

- [ ] All queries use indexes
- [ ] Results are limited (`.take(n)`)
- [ ] No N+1 queries
- [ ] Batch operations used
- [ ] Subscriptions are scoped
- [ ] Payload size minimized
- [ ] Expensive computations cached
- [ ] Performance monitored

---

## Related Patterns

- See `query-patterns.md` for index usage
- See `real-time-subscriptions.md` for subscription optimization
- See `schema-conventions.md` for index design

---

*Extracted: 2026-02-18*
