# Convex Query Patterns

## Source
Extracted from BistroLens `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md`

## Pattern: Standard Query Structure

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const listUserRecipes = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const userId = identity.subject;
    const limit = args.limit ?? 20;
    
    // 2. Query with index
    return await ctx.db
      .query("recipes")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .order("desc")
      .take(limit);
  },
});
```

## Pattern: Pagination

```typescript
import { paginationOptsValidator } from "convex/server";

export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    return await ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .paginate(args.paginationOpts);
  },
});
```

### Client-Side Usage

```typescript
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function RecipeList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.recipes.listPaginated,
    {},
    { initialNumItems: 20 }
  );
  
  return (
    <div>
      {results.map(recipe => (
        <RecipeCard key={recipe._id} recipe={recipe} />
      ))}
      {status === "CanLoadMore" && (
        <button onClick={() => loadMore(20)}>Load More</button>
      )}
    </div>
  );
}
```

## Anti-Patterns: What NOT to Do

### ❌ Full Table Scan

```typescript
// NEVER do this - scans entire table
const all = await ctx.db.query("recipes").collect();
const filtered = all.filter(r => r.userId === userId);
```

### ❌ N+1 Query Problem

```typescript
// NEVER query in a loop
for (const id of recipeIds) {
  const recipe = await ctx.db.get(id); // Separate query each iteration
}
```

### ✅ Correct: Batch Fetch

```typescript
// Fetch all at once with Promise.all
const recipes = await Promise.all(
  recipeIds.map(id => ctx.db.get(id))
);
```

## Pattern: Conditional Queries

```typescript
export const searchRecipes = query({
  args: {
    searchTerm: v.optional(v.string()),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    let query = ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.neq(q.field("isDeleted"), true));
    
    // Apply optional filters
    if (args.category) {
      query = query.filter((q) => q.eq(q.field("category"), args.category));
    }
    
    if (args.searchTerm) {
      query = query.filter((q) => 
        q.or(
          q.eq(q.field("title"), args.searchTerm),
          q.eq(q.field("description"), args.searchTerm)
        )
      );
    }
    
    return await query.take(args.limit ?? 20);
  },
});
```

## Pattern: Aggregation Queries

```typescript
export const getRecipeStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
    
    return {
      total: recipes.length,
      byCategory: recipes.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgCookTime: recipes.reduce((sum, r) => sum + r.cookTime, 0) / recipes.length,
    };
  },
});
```

## Pattern: Join-Like Queries

```typescript
export const getRecipeWithAuthor = query({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.isDeleted) {
      throw new Error("Recipe not found");
    }
    
    const author = await ctx.db.get(recipe.userId);
    
    return {
      ...recipe,
      author: {
        id: author._id,
        name: author.name,
        avatar: author.avatarUrl,
      },
    };
  },
});
```

## When to Use These Patterns

✅ **Use for:**
- Every Convex query function
- When fetching user-scoped data
- When implementing search/filter
- When paginating large datasets
- When aggregating data

❌ **Don't use for:**
- Write operations (use mutations instead)

## Benefits

1. **Performance**: Indexes make queries fast
2. **Security**: Auth checks prevent unauthorized access
3. **Scalability**: Pagination handles large datasets
4. **Maintainability**: Consistent patterns across codebase

## Related Patterns

- See `schema-conventions.md` for index definitions
- See `mutation-patterns.md` for write operations
- See `../03-auth-patterns/auth-helpers.md` for reusable auth functions
