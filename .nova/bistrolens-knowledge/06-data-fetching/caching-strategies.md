# Caching Strategies

## Source
Extracted from BistroLens:
- `components/AdminDashboard.tsx`
- `components/ImageAdminDashboard.tsx`
- `components/AcademySEOCollectionPage.tsx`
- `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md`

---

## Pattern: Convex Real-Time Caching

Convex provides automatic caching and real-time updates through its reactive query system. Queries are cached client-side and automatically invalidated when server data changes.

---

## 1. Automatic Query Caching

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

const AdminDashboard: React.FC = () => {
  // Each useQuery call is automatically cached
  // Convex tracks dependencies and updates only when data changes
  const dashboardStats = useQuery(api.admin.getDashboardStats);
  const users = useQuery(api.admin.listUsers, { 
    search: userSearch || undefined,
    tier: selectedTier as any || undefined,
    limit: 50 
  });
  const affiliates = useQuery(api.admin.getAffiliatesWithStats, {});
  const moderationQueue = useQuery(api.admin.getModerationQueue, { status: 'pending' });
  
  // All queries are cached and automatically updated in real-time
  // No manual cache invalidation needed
  
  if (!dashboardStats) return <LoadingScreen />;
  
  return (
    <div>
      <StatCard value={dashboardStats.users.total} />
      {/* Data automatically updates when server changes */}
    </div>
  );
};
```

**Key Points:**
- Each `useQuery` call creates a cached subscription
- Cache is automatically invalidated when server data changes
- Multiple components can share the same cached query
- No manual cache management required

---

## 2. Conditional Query Caching

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

const SaveCollectionCTA: React.FC<{
  slug: string;
  isAuthenticated: boolean;
}> = ({ slug, isAuthenticated }) => {
  // Skip query when not authenticated - saves bandwidth and prevents errors
  // Query returns false for unauthenticated users instead of throwing
  const isSaved = useQuery(api.savedCollections.isSaved, { slug });
  
  // Conditional query execution based on auth state
  const userProfile = useQuery(
    isAuthenticated ? api.users.getCurrentUser : "skip",
    isAuthenticated ? {} : undefined
  );
  
  // Loading state - undefined means query is loading
  if (isSaved === undefined && isAuthenticated) {
    return <LoadingSpinner />;
  }
  
  return (
    <button onClick={handleSave}>
      {isSaved ? "Saved ✓" : "Save"}
    </button>
  );
};
```

**Key Points:**
- Use `"skip"` to conditionally disable queries
- Prevents unnecessary network requests
- Useful for auth-gated queries
- Query returns `undefined` while loading

---

## 3. Multi-Query Caching Pattern

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

const ImageAdminDashboard: React.FC = () => {
  // Multiple related queries - each cached independently
  // Convex optimizes by batching requests and deduplicating
  const metrics = useQuery(api.imageDataset.getAdminMetrics);
  const metrics7Day = useQuery(api.imageDataset.get7DayMetrics);
  const recentGenerations = useQuery(api.imageDataset.getRecentGenerations, { limit: 10 });
  const recentHealthChecks = useQuery(api.imageDataset.getRecentHealthChecks, { limit: 10 });
  const timeToFirstImageStats = useQuery(api.imageDataset.getTimeToFirstImageStats, { windowDays: 7 });
  const blockedReasonTrend = useQuery(api.imageDataset.getBlockedReasonTrend7d);
  const recentAudits = useQuery(api.imageDataset.getRecentAudits, { limit: 10 });
  const topReused7d = useQuery(api.imageDataset.getTopReused7d, { limit: 10 });
  
  // All queries are cached and updated independently
  // If one query's data changes, only that query re-renders
  
  return (
    <div>
      {metrics && <MetricsCard data={metrics} />}
      {metrics7Day && <TrendChart data={metrics7Day} />}
      {recentGenerations && <GenerationsFeed data={recentGenerations} />}
    </div>
  );
};
```

**Key Points:**
- Each query is cached independently
- Convex batches multiple queries in a single request
- Only affected components re-render when data changes
- No need to combine queries manually

---

## 4. Error Handling with Caching

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

const AdminDashboard: React.FC = () => {
  const [convexError, setConvexError] = useState<string | null>(null);
  
  // Wrap queries in try-catch for error handling
  let dashboardStats, users, affiliates;
  try {
    dashboardStats = useQuery(api.admin.getDashboardStats);
    users = useQuery(api.admin.listUsers, { limit: 50 });
    affiliates = useQuery(api.admin.getAffiliatesWithStats, {});
  } catch (error) {
    console.error('Convex query error:', error);
    if (!convexError) {
      setConvexError(error instanceof Error ? error.message : 'Failed to connect to Convex');
    }
  }
  
  // Show error UI if queries fail
  if (convexError) {
    return (
      <div className="error-container">
        <h2>Connection Issue</h2>
        <p>{convexError}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }
  
  // Show loading state
  if (!dashboardStats) return <LoadingScreen />;
  
  return <Dashboard data={dashboardStats} />;
};
```

**Key Points:**
- Wrap queries in try-catch for connection errors
- Cache persists across errors (stale data still available)
- Provide retry mechanism for users
- Show loading state while queries resolve

---

## 5. Server-Side Query Optimization

### Code Example

```typescript
// convex/admin.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

// Optimized query with index and limit
export const listUsers = query({
  args: {
    search: v.optional(v.string()),
    tier: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Use index for fast lookups
    let query = ctx.db
      .query("users")
      .withIndex("by_created", (q) => q);
    
    // Filter by tier if provided
    if (args.tier) {
      query = query.filter((q) => 
        q.eq(q.field("subscription.tier"), args.tier)
      );
    }
    
    // Search by email if provided
    if (args.search) {
      query = query.filter((q) => 
        q.or(
          q.eq(q.field("email"), args.search),
          q.eq(q.field("fullName"), args.search)
        )
      );
    }
    
    // Limit results to prevent large payloads
    const users = await query
      .order("desc")
      .take(args.limit);
    
    return {
      users,
      total: users.length,
    };
  },
});
```

**Key Points:**
- Always use indexes for filtered queries
- Limit results to prevent large payloads
- Filter server-side, not client-side
- Return only necessary fields

---

## 6. Pagination for Large Datasets

### Code Example

```typescript
// convex/recipes.ts
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    let query = ctx.db
      .query("recipes")
      .withIndex("by_user_created", (q) => 
        q.eq("userId", identity.subject)
      );
    
    // Filter by category if provided
    if (args.category) {
      query = query.filter((q) => 
        q.eq(q.field("category"), args.category)
      );
    }
    
    // Use Convex pagination
    return await query.paginate(args.paginationOpts);
  },
});

// Client usage
const RecipeList: React.FC = () => {
  const { results, status, loadMore } = usePaginatedQuery(
    api.recipes.listPaginated,
    { category: "italian" },
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
};
```

**Key Points:**
- Use `usePaginatedQuery` for large datasets
- Convex handles cursor-based pagination automatically
- Cache persists across page loads
- Efficient for infinite scroll patterns

---

## 7. Subscription Cleanup

### Code Example

```typescript
import { useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

const RealtimeComponent: React.FC = () => {
  // useQuery automatically handles subscription cleanup
  // No manual cleanup needed
  const data = useQuery(api.data.list);
  
  // For manual subscriptions (rare):
  useEffect(() => {
    const unsubscribe = convex.onUpdate(
      api.data.list, 
      {}, 
      (newData) => {
        console.log('Data updated:', newData);
      }
    );
    
    // Cleanup on unmount
    return () => unsubscribe();
  }, []);
  
  return <div>{data?.length} items</div>;
};
```

**Key Points:**
- `useQuery` handles cleanup automatically
- Manual subscriptions need cleanup in `useEffect`
- Prevents memory leaks
- Unsubscribe on component unmount

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// ❌ BAD: Fetching all data then filtering client-side
const allRecipes = useQuery(api.recipes.listAll);
const filtered = allRecipes?.filter(r => r.category === "pasta");

// ❌ BAD: Multiple queries in a loop (N+1 problem)
const recipeIds = ["id1", "id2", "id3"];
const recipes = recipeIds.map(id => useQuery(api.recipes.get, { id }));

// ❌ BAD: Polling instead of using real-time subscriptions
useEffect(() => {
  const interval = setInterval(() => {
    refetch(); // Don't do this!
  }, 5000);
  return () => clearInterval(interval);
}, []);

// ❌ BAD: Unbounded query without limit
const allUsers = useQuery(api.users.listAll); // Could return millions

// ❌ BAD: Manual cache invalidation
const [cache, setCache] = useState({});
const invalidateCache = () => setCache({}); // Convex handles this!
```

### ✅ Do This Instead

```typescript
// ✅ GOOD: Filter server-side with limit
const filtered = useQuery(api.recipes.listByCategory, { 
  category: "pasta",
  limit: 20 
});

// ✅ GOOD: Batch fetch with Promise.all
const recipes = useQuery(api.recipes.getBatch, { ids: recipeIds });

// ✅ GOOD: Use real-time subscriptions (automatic)
const data = useQuery(api.data.list); // Updates automatically

// ✅ GOOD: Always limit results
const users = useQuery(api.users.list, { limit: 50 });

// ✅ GOOD: Let Convex handle caching
const data = useQuery(api.data.list); // Cached automatically
```

---

## When to Use This Pattern

✅ **Use for:**
- Real-time dashboards that need live updates
- Multi-user collaborative features
- Data that changes frequently
- Admin panels with multiple data sources
- User-specific data that needs to stay fresh

❌ **Don't use for:**
- Static content that never changes (use static generation)
- Large datasets without pagination
- Public data that doesn't need real-time updates
- One-time data fetches (use actions instead)

---

## Benefits

1. **Automatic Cache Management**: No manual invalidation needed
2. **Real-Time Updates**: Data stays fresh without polling
3. **Optimized Performance**: Convex batches and deduplicates requests
4. **Type Safety**: Full TypeScript support with generated types
5. **Offline Support**: Cache persists across page reloads
6. **Reduced Boilerplate**: No need for Redux, React Query, or similar
7. **Bandwidth Efficiency**: Only changed data is sent over the wire
8. **Consistency**: All clients see the same data at the same time

---

## Related Patterns

- See `usequery-patterns.md` for basic query usage
- See `usemutation-patterns.md` for data updates
- See `pagination-patterns.md` for large dataset handling
- See `../01-convex-patterns/query-patterns.md` for server-side optimization

---

*Extracted: 2026-02-18*
