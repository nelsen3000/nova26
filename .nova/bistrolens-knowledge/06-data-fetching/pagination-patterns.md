# Pagination Patterns

## Source
Extracted from BistroLens:
- `convex/social.ts` (cursor-based pagination)
- `convex/admin.ts` (offset-based pagination)
- `convex/publicRecipes.ts` (limit-based pagination)
- `components/SocialFeed.tsx` (client-side infinite scroll)

---

## Pattern 1: Cursor-Based Pagination (Timestamp)

**Best for:** Real-time feeds, social posts, activity streams

Cursor-based pagination uses a timestamp or ID from the last item to fetch the next page. This is efficient for large datasets and handles real-time updates gracefully.

### Code Example

```typescript
// convex/social.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getSocialFeed = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()) // Timestamp as string
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 20, 100); // Cap at 100
    
    let dbQuery = ctx.db
      .query("socialPosts")
      .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", "approved"))
      .order("desc");

    // Apply cursor filter - fetch items older than cursor timestamp
    if (args.cursor) {
      dbQuery = dbQuery.filter((q) => 
        q.lt(q.field("createdAt"), parseInt(args.cursor!))
      );
    }

    const posts = await dbQuery.take(limit);
    
    // Return posts with next cursor (timestamp of last item)
    return {
      posts: posts.map(post => ({
        id: post._id,
        author: {
          id: post.authorId,
          name: post.authorName,
          avatar: post.authorAvatar
        },
        recipe: post.recipe,
        caption: post.caption,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        createdAt: post.createdAt
      })),
      nextCursor: posts.length === limit 
        ? String(posts[posts.length - 1].createdAt) 
        : null
    };
  },
});
```

### Client-Side Usage (Infinite Scroll)

```typescript
// components/SocialFeed.tsx
const [feed, setFeed] = useState<Post[]>([]);
const [cursor, setCursor] = useState<string | undefined>();
const [loadingMore, setLoadingMore] = useState(false);

const loadMore = async () => {
  if (loadingMore || !cursor) return;
  
  setLoadingMore(true);
  
  const result = await getSocialFeed({ 
    limit: 20, 
    cursor 
  });
  
  setFeed(prev => [...prev, ...result.posts]);
  setCursor(result.nextCursor);
  setLoadingMore(false);
};

// Initial load
useEffect(() => {
  const loadInitial = async () => {
    const result = await getSocialFeed({ limit: 20 });
    setFeed(result.posts);
    setCursor(result.nextCursor);
  };
  loadInitial();
}, []);
```

---

## Pattern 2: Offset-Based Pagination

**Best for:** Admin panels, user lists, filtered datasets with stable ordering

Offset-based pagination uses numeric indices to slice results. Simple but can be inefficient for very large datasets.

### Code Example

```typescript
// convex/admin.ts
export const listUsers = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()), // Offset as string
    search: v.optional(v.string()),
    tier: v.optional(v.union(
      v.literal("free"), 
      v.literal("premium"), 
      v.literal("chef_master")
    ))
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const limit = Math.min(args.limit || 50, 100);
    let profiles = await ctx.db.query("profiles").order("desc").collect();
    
    // Apply search filter
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      profiles = profiles.filter(p => 
        p.email.toLowerCase().includes(searchLower) ||
        (p.fullName || "").toLowerCase().includes(searchLower)
      );
    }
    
    // Get subscriptions for tier filtering
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const subMap = new Map(subscriptions.map(s => [s.userId, s]));
    
    // Apply tier filter
    if (args.tier) {
      profiles = profiles.filter(p => {
        const sub = subMap.get(p.userId);
        return sub?.tier === args.tier;
      });
    }
    
    // Pagination with offset
    const startIndex = args.cursor ? parseInt(args.cursor) : 0;
    const paginatedProfiles = profiles.slice(startIndex, startIndex + limit);
    
    // Enrich with subscription data
    const enrichedProfiles = paginatedProfiles.map(p => {
      const sub = subMap.get(p.userId);
      return {
        id: p._id,
        userId: p.userId,
        email: p.email,
        fullName: p.fullName,
        avatarUrl: p.avatarUrl,
        subscription: {
          tier: sub?.tier || "free",
          status: sub?.status || "active",
          stripeCustomerId: sub?.stripeCustomerId
        },
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      };
    });
    
    return {
      users: enrichedProfiles,
      nextCursor: startIndex + limit < profiles.length 
        ? String(startIndex + limit) 
        : null,
      total: profiles.length
    };
  },
});
```

### Client-Side Usage (Page Numbers)

```typescript
// Admin panel component
const [users, setUsers] = useState<User[]>([]);
const [currentPage, setCurrentPage] = useState(1);
const [total, setTotal] = useState(0);
const pageSize = 50;

const loadPage = async (page: number) => {
  const offset = (page - 1) * pageSize;
  const result = await listUsers({ 
    limit: pageSize, 
    cursor: String(offset),
    search: searchQuery,
    tier: selectedTier
  });
  
  setUsers(result.users);
  setTotal(result.total);
  setCurrentPage(page);
};

const totalPages = Math.ceil(total / pageSize);

// Pagination controls
<div className="flex items-center justify-between">
  <button 
    onClick={() => loadPage(currentPage - 1)}
    disabled={currentPage === 1}
  >
    Previous
  </button>
  
  <span>Page {currentPage} of {totalPages}</span>
  
  <button 
    onClick={() => loadPage(currentPage + 1)}
    disabled={currentPage === totalPages}
  >
    Next
  </button>
</div>
```

---

## Pattern 3: Simple Limit-Based Pagination

**Best for:** Small datasets, category browsing, initial page loads

Simple limit-based pagination fetches a fixed number of items without cursor tracking. Good for simple use cases.

### Code Example

```typescript
// convex/publicRecipes.ts
export const getPublicRecipes = query({
  args: {
    sortBy: v.optional(v.string()),
    category: v.optional(v.string()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { sortBy = 'popular', category, limit = 20 } = args;
    
    // Query public recipes
    let recipesQuery = ctx.db
      .query("recipes")
      .withIndex("by_visibility_indexing", (q) => 
        q.eq("visibility", "public").eq("indexingEnabled", true)
      );
    
    const allRecipes = await recipesQuery.collect();
    
    // Filter by category
    let filtered = allRecipes.filter(r => !r.isDeleted);
    if (category && category !== 'All') {
      filtered = filtered.filter(r => 
        r.category?.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Sort based on option
    let sorted = [...filtered];
    switch (sortBy) {
      case 'popular':
        sorted.sort((a, b) => b.favoritesCount - a.favoritesCount);
        break;
      case 'newest':
        sorted.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
        break;
      case 'top_rated':
        sorted.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
        break;
    }
    
    // Apply limit
    const results = sorted.slice(0, limit);
    
    return {
      recipes: results,
      total: sorted.length
    };
  },
});
```

---

## Pattern 4: Client-Side Pagination (In-Memory)

**Best for:** Small datasets already loaded, admin tables, filtered views

When data is already loaded client-side, paginate in memory for instant navigation.

### Code Example

```typescript
// components/ImageDatasetAdmin.tsx
const [images, setImages] = useState<Image[]>([]);
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 12;

// Filter images based on search/filters
const filteredImages = images.filter(img => {
  if (searchQuery && !img.prompt.toLowerCase().includes(searchQuery.toLowerCase())) {
    return false;
  }
  if (selectedTier && img.tier !== selectedTier) {
    return false;
  }
  return true;
});

// Paginate in memory
const totalPages = Math.ceil(filteredImages.length / itemsPerPage);
const startIndex = (currentPage - 1) * itemsPerPage;
const paginatedImages = filteredImages.slice(
  startIndex, 
  startIndex + itemsPerPage
);

// Pagination controls
<div className="flex items-center justify-center gap-2 mt-6">
  <button
    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
    disabled={currentPage === 1}
    className="px-4 py-2 border rounded disabled:opacity-50"
  >
    Previous
  </button>
  
  <span className="text-sm">
    Page {currentPage} of {totalPages}
  </span>
  
  <button
    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
    disabled={currentPage === totalPages}
    className="px-4 py-2 border rounded disabled:opacity-50"
  >
    Next
  </button>
</div>
```

---

## Anti-Patterns

### ❌ Don't: Use Offset Pagination for Large Real-Time Feeds

```typescript
// BAD: Offset pagination on real-time data
export const getSocialFeed = query({
  args: { page: v.number() },
  handler: async (ctx, args) => {
    const limit = 20;
    const offset = args.page * limit;
    
    // Problem: New posts shift offsets, causing duplicates/gaps
    const posts = await ctx.db
      .query("socialPosts")
      .order("desc")
      .take(offset + limit);
    
    return posts.slice(offset);
  }
});
```

**Why it's bad:**
- New posts added between page loads cause offset drift
- User sees duplicates or misses posts
- Inefficient for large offsets (must scan all skipped records)

### ✅ Do: Use Cursor-Based Pagination Instead

```typescript
// GOOD: Cursor-based pagination
export const getSocialFeed = query({
  args: { 
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()) 
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    let query = ctx.db
      .query("socialPosts")
      .order("desc");
    
    if (args.cursor) {
      query = query.filter((q) => 
        q.lt(q.field("createdAt"), parseInt(args.cursor))
      );
    }
    
    const posts = await query.take(limit);
    
    return {
      posts,
      nextCursor: posts.length === limit 
        ? String(posts[posts.length - 1].createdAt)
        : null
    };
  }
});
```

---

### ❌ Don't: Fetch All Data Then Paginate Client-Side for Large Datasets

```typescript
// BAD: Loading thousands of records to paginate client-side
const allUsers = await ctx.db.query("users").collect(); // 10,000+ records
const page1 = allUsers.slice(0, 50); // Only showing 50!
```

**Why it's bad:**
- Wastes bandwidth loading unused data
- Slow initial load time
- High memory usage
- Poor user experience

### ✅ Do: Paginate Server-Side

```typescript
// GOOD: Server-side pagination
const users = await ctx.db
  .query("users")
  .order("desc")
  .take(50); // Only fetch what's needed
```

---

### ❌ Don't: Forget to Cap Maximum Limit

```typescript
// BAD: No limit cap
export const getItems = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    // User could request limit: 1000000
    return await ctx.db.query("items").take(args.limit);
  }
});
```

**Why it's bad:**
- Malicious users can overload server
- Accidental large requests cause timeouts
- No protection against abuse

### ✅ Do: Always Cap Limits

```typescript
// GOOD: Capped limit with sensible default
export const getItems = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 20, 100); // Cap at 100
    return await ctx.db.query("items").take(limit);
  }
});
```

---

## When to Use This Pattern

### ✅ Use Cursor-Based Pagination for:
- Social feeds and activity streams
- Real-time data with frequent updates
- Large datasets (10,000+ records)
- Infinite scroll UIs
- Time-ordered data

### ✅ Use Offset-Based Pagination for:
- Admin panels with stable data
- Search results with filters
- Small to medium datasets (< 10,000 records)
- Traditional page number navigation
- Reports and exports

### ✅ Use Limit-Based Pagination for:
- Initial page loads
- Category browsing
- "Show more" buttons
- Small datasets (< 1,000 records)
- Simple use cases without navigation

### ✅ Use Client-Side Pagination for:
- Data already loaded in memory
- Small datasets (< 500 records)
- Instant filtering/sorting
- Admin tables with local state

### ❌ Don't Use Pagination for:
- Very small datasets (< 20 items) - just show all
- Single-page views
- Data that must be shown together

---

## Benefits

### Cursor-Based Pagination
1. **Consistent results** - No duplicates or gaps from real-time updates
2. **Efficient** - Only scans from cursor position, not from start
3. **Scalable** - Performance doesn't degrade with dataset size
4. **Real-time friendly** - Handles concurrent updates gracefully

### Offset-Based Pagination
1. **Simple** - Easy to understand and implement
2. **Random access** - Can jump to any page directly
3. **Total count** - Easy to show "Page X of Y"
4. **Familiar UX** - Users understand page numbers

### Limit-Based Pagination
1. **Simplest** - Minimal code and complexity
2. **Fast** - No cursor tracking overhead
3. **Flexible** - Easy to adjust page size
4. **Good for prototypes** - Quick to implement

### Client-Side Pagination
1. **Instant** - No network latency
2. **Offline-capable** - Works without server
3. **Smooth UX** - Immediate page transitions
4. **Easy filtering** - Combine with search/sort

---

## Related Patterns

- See `usequery-patterns.md` for data fetching with Convex
- See `usemutation-patterns.md` for updating paginated data
- See `caching-strategies.md` for optimizing pagination performance
- See `../02-react-patterns/state-management.md` for managing pagination state
- See `../04-ui-components/loading-states.md` for pagination loading UX

---

*Extracted: 2025-02-18*
