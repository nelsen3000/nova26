# useQuery Patterns

## Source
Extracted from BistroLens:
- `hooks/useSocialProof.ts`
- `hooks/useRecipeActions.ts`
- `components/PublicRecipePage.tsx`
- `components/ImageAdminDashboard.tsx`

---

## Pattern: Convex useQuery Hook

The `useQuery` hook from Convex provides real-time reactive data fetching with automatic caching, subscriptions, and loading states. It's the primary way to read data from Convex databases.

---

## Basic Query Pattern

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

function RecipeList() {
  // Simple query with no parameters
  const recipes = useQuery(api.recipes.list);
  
  // Query with parameters
  const recipe = useQuery(api.recipes.getById, { id: 'recipe-123' });
  
  // Loading state: undefined while loading
  if (recipes === undefined) {
    return <LoadingSpinner />;
  }
  
  // Empty state
  if (recipes.length === 0) {
    return <EmptyState />;
  }
  
  return (
    <ul>
      {recipes.map(recipe => (
        <li key={recipe._id}>{recipe.title}</li>
      ))}
    </ul>
  );
}
```

**Key Points:**
- Returns `undefined` while loading (first render)
- Returns actual data once loaded
- Automatically re-renders when data changes
- Cached across component instances

---

## Conditional Query Pattern (Skip Pattern)

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

function UserProfile({ userId }: { userId: string | null }) {
  // Skip query if userId is null
  const userProfile = useQuery(
    api.users.getProfile,
    userId ? { userId } : 'skip'
  );
  
  // Alternative: conditional API reference
  const userStats = useQuery(
    userId ? api.users.getStats : 'skip',
    userId ? { userId } : undefined
  );
  
  if (!userId) {
    return <LoginPrompt />;
  }
  
  if (userProfile === undefined) {
    return <LoadingSpinner />;
  }
  
  return <div>{userProfile.name}</div>;
}
```

**Key Points:**
- Use `'skip'` as the API reference to skip the query
- Use conditional API reference: `condition ? api.endpoint : 'skip'`
- Use conditional parameters: `condition ? { params } : undefined`
- Prevents unnecessary queries when dependencies aren't ready

---

## Multiple Parallel Queries Pattern

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

function AdminDashboard() {
  // Multiple queries execute in parallel
  const metrics = useQuery(api.admin.getMetrics);
  const users = useQuery(api.admin.listUsers, { limit: 50 });
  const incidents = useQuery(api.admin.getIncidents, { limit: 20 });
  const config = useQuery(api.admin.getConfig);
  
  // Check if all queries have loaded
  const isLoading = 
    metrics === undefined || 
    users === undefined || 
    incidents === undefined || 
    config === undefined;
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return (
    <div>
      <MetricsPanel data={metrics} />
      <UsersList users={users} />
      <IncidentsList incidents={incidents} />
      <ConfigPanel config={config} />
    </div>
  );
}
```

**Key Points:**
- All queries execute simultaneously (parallel)
- Each query is independent
- Check all queries for loading state
- Efficient for dashboard-style components

---

## Fail-Safe Query Pattern

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

/**
 * Get "Most Cooked This Week" list with fail-safe behavior
 */
export function useMostCookedThisWeek(limit: number = 10) {
  const result = useQuery(api.socialProof.getMostCookedThisWeek, { limit });
  
  // Fail-safe: return empty array if query fails or is loading
  return result ?? [];
}

/**
 * Get social proof data with null fallback
 */
export function useRecipeSocialProof(recipeId: string | undefined) {
  const result = useQuery(
    recipeId ? api.socialProof.getRecipeSocialProof : 'skip',
    recipeId ? { recipeId } : undefined
  );
  
  // Fail-safe: return null if query fails or is loading
  if (!result) return null;
  
  return {
    ...result,
    cookedBefore: false,
  };
}
```

**Key Points:**
- Use nullish coalescing (`??`) for default values
- Return empty arrays/objects instead of undefined
- Prevents UI crashes from missing data
- Good for non-critical data (social proof, recommendations)

---

## Query with Error Handling Pattern

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useState } from 'react';

function PublicRecipePage({ slug }: { slug: string }) {
  const [convexError, setConvexError] = useState<string | null>(null);
  
  // Wrap queries in try-catch for error handling
  let recipeData, jsonLdData;
  try {
    recipeData = useQuery(api.publicRecipes.getPublicRecipeBySlug, { slug });
    jsonLdData = useQuery(api.publicRecipes.getRecipeJsonLd, { slug });
  } catch (error) {
    console.error('Convex query error:', error);
    if (!convexError) {
      setConvexError(error instanceof Error ? error.message : 'Failed to load recipe');
    }
  }
  
  // Error state
  if (convexError) {
    return (
      <div className="error-container">
        <h1>Connection Issue</h1>
        <p>{convexError}</p>
        <button onClick={() => { setConvexError(null); window.location.reload(); }}>
          Try Again
        </button>
      </div>
    );
  }
  
  // Loading state
  if (recipeData === undefined && !convexError) {
    return <LoadingSkeleton />;
  }
  
  // Not found state
  if (!recipeData) {
    return <NotFoundPage />;
  }
  
  return <RecipeDisplay recipe={recipeData.recipe} />;
}
```

**Key Points:**
- Wrap queries in try-catch for connection errors
- Store error state separately
- Distinguish between loading, error, and not-found states
- Provide retry mechanism

---

## Batch Query Pattern with useMemo

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useMemo } from 'react';

/**
 * Batch check social proof for multiple recipes
 * More efficient than individual queries
 */
export function useBatchSocialProof(
  recipeIds: string[],
  userId?: string
): Map<string, SocialProofData> {
  // Query aggregate lists once
  const mostCooked = useQuery(api.socialProof.getMostCookedThisWeek, { limit: 10 });
  const trending = useQuery(api.socialProof.getTrendingTonight, { limit: 10 });
  
  // Batch query for user's cooked recipes
  const userCookedBatch = useQuery(
    userId && recipeIds.length > 0 ? api.socialProof.getUserCookedBeforeBatch : 'skip',
    userId && recipeIds.length > 0 ? { userId, recipeIds } : undefined
  );
  
  // Combine results into a lookup map
  return useMemo(() => {
    const proofMap = new Map<string, SocialProofData>();
    
    // Initialize all requested recipes with empty data
    for (const id of recipeIds) {
      proofMap.set(id, {
        isMostCooked: false,
        mostCookedRank: null,
        isTrending: false,
        trendingRank: null,
        cookedBefore: false,
      });
    }
    
    // Mark recipes in "Most Cooked" list
    if (mostCooked) {
      for (const item of mostCooked) {
        const existing = proofMap.get(item.recipeId);
        if (existing) {
          existing.isMostCooked = true;
          existing.mostCookedRank = item.rank;
        }
      }
    }
    
    // Mark recipes in "Trending" list
    if (trending) {
      for (const item of trending) {
        const existing = proofMap.get(item.recipeId);
        if (existing) {
          existing.isTrending = true;
          existing.trendingRank = item.rank;
        }
      }
    }
    
    // Mark recipes user has cooked before
    if (userCookedBatch) {
      for (const [recipeId, data] of Object.entries(userCookedBatch)) {
        const existing = proofMap.get(recipeId);
        if (existing && data.cookedBefore) {
          existing.cookedBefore = true;
        }
      }
    }
    
    return proofMap;
  }, [recipeIds, mostCooked, trending, userCookedBatch]);
}
```

**Key Points:**
- Query aggregate data once, not per-item
- Use batch endpoints when available
- Combine results with `useMemo` for performance
- Return lookup structures (Map/Object) for O(1) access
- Dependencies array includes all query results

---

## Query Readiness Check Pattern

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

/**
 * Check if social proof data is available (queries have loaded)
 */
export function useSocialProofReady(): boolean {
  const mostCooked = useQuery(api.socialProof.getMostCookedThisWeek, { limit: 1 });
  const trending = useQuery(api.socialProof.getTrendingTonight, { limit: 1 });
  
  // Ready when both queries have returned (even if empty)
  return mostCooked !== undefined && trending !== undefined;
}

/**
 * Use readiness check to show loading state
 */
function SocialProofWidget() {
  const isReady = useSocialProofReady();
  const mostCooked = useQuery(api.socialProof.getMostCookedThisWeek, { limit: 10 });
  
  if (!isReady) {
    return <LoadingSpinner />;
  }
  
  return <MostCookedList items={mostCooked ?? []} />;
}
```

**Key Points:**
- Query minimal data (limit: 1) to check readiness
- Check for `!== undefined` (not truthiness)
- Useful for coordinating multiple dependent queries
- Prevents flash of empty state

---

## Custom Hook Wrapper Pattern

### Code Example

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

interface RecipeActionState {
  isFavorited: boolean;
  hasMade: boolean;
  rating: number | undefined;
  viewCount: number;
  isLoading: boolean;
}

/**
 * Custom hook that wraps useQuery with computed state
 */
export function useRecipeActions({ 
  userId, 
  recipeId 
}: { 
  userId: string | null; 
  recipeId: string;
}) {
  // Query user's state for this recipe
  const userRecipeState = useQuery(
    api.recipeActions.getUserRecipeState,
    userId && recipeId ? { userId, recipeId } : 'skip'
  );
  
  // Computed state with defaults
  const state: RecipeActionState = {
    isFavorited: userRecipeState?.isFavorited ?? false,
    hasMade: userRecipeState?.hasMade ?? false,
    rating: userRecipeState?.rating,
    viewCount: userRecipeState?.viewCount ?? 0,
    isLoading: userRecipeState === undefined,
  };
  
  return { state };
}

/**
 * Hook to get user's favorite recipes with loading state
 */
export function useUserFavorites(userId: string | null) {
  const favorites = useQuery(
    api.recipeActions.getUserFavorites,
    userId ? { userId, limit: 100 } : 'skip'
  );
  
  return {
    favorites: favorites ?? [],
    isLoading: favorites === undefined,
  };
}
```

**Key Points:**
- Wrap `useQuery` in custom hooks for reusability
- Provide computed state and defaults
- Include explicit `isLoading` flag
- Return structured objects with data + metadata
- Handle conditional queries internally

---

## Anti-Patterns

### ❌ Don't Query Inside Loops

```typescript
// BAD: Creates N queries
function RecipeList({ recipeIds }: { recipeIds: string[] }) {
  return (
    <div>
      {recipeIds.map(id => {
        // ❌ Don't do this - creates separate query per item
        const recipe = useQuery(api.recipes.getById, { id });
        return <RecipeCard recipe={recipe} />;
      })}
    </div>
  );
}
```

### ✅ Do This Instead

```typescript
// GOOD: Single batch query
function RecipeList({ recipeIds }: { recipeIds: string[] }) {
  // ✅ Query all at once
  const recipes = useQuery(api.recipes.getBatch, { ids: recipeIds });
  
  if (!recipes) return <LoadingSpinner />;
  
  return (
    <div>
      {recipes.map(recipe => (
        <RecipeCard key={recipe._id} recipe={recipe} />
      ))}
    </div>
  );
}
```

---

### ❌ Don't Use Queries Conditionally

```typescript
// BAD: Violates Rules of Hooks
function UserProfile({ userId }: { userId: string | null }) {
  if (!userId) {
    return <LoginPrompt />;
  }
  
  // ❌ Don't do this - conditional hook call
  const profile = useQuery(api.users.getProfile, { userId });
  
  return <div>{profile?.name}</div>;
}
```

### ✅ Do This Instead

```typescript
// GOOD: Always call hook, use 'skip' pattern
function UserProfile({ userId }: { userId: string | null }) {
  // ✅ Always call hook, skip when no userId
  const profile = useQuery(
    api.users.getProfile,
    userId ? { userId } : 'skip'
  );
  
  if (!userId) {
    return <LoginPrompt />;
  }
  
  if (profile === undefined) {
    return <LoadingSpinner />;
  }
  
  return <div>{profile.name}</div>;
}
```

---

### ❌ Don't Ignore Loading States

```typescript
// BAD: Assumes data is always available
function RecipeTitle({ recipeId }: { recipeId: string }) {
  const recipe = useQuery(api.recipes.getById, { recipeId });
  
  // ❌ Don't do this - will crash on first render
  return <h1>{recipe.title}</h1>;
}
```

### ✅ Do This Instead

```typescript
// GOOD: Handle loading state
function RecipeTitle({ recipeId }: { recipeId: string }) {
  const recipe = useQuery(api.recipes.getById, { recipeId });
  
  // ✅ Check for undefined
  if (recipe === undefined) {
    return <Skeleton className="h-8 w-64" />;
  }
  
  return <h1>{recipe.title}</h1>;
}
```

---

### ❌ Don't Fetch Same Data Multiple Times

```typescript
// BAD: Multiple components query same data
function RecipeHeader({ recipeId }: { recipeId: string }) {
  const recipe = useQuery(api.recipes.getById, { recipeId });
  return <h1>{recipe?.title}</h1>;
}

function RecipeBody({ recipeId }: { recipeId: string }) {
  // ❌ Duplicate query (though Convex caches it)
  const recipe = useQuery(api.recipes.getById, { recipeId });
  return <p>{recipe?.description}</p>;
}
```

### ✅ Do This Instead

```typescript
// GOOD: Query once at parent level
function RecipePage({ recipeId }: { recipeId: string }) {
  // ✅ Query once
  const recipe = useQuery(api.recipes.getById, { recipeId });
  
  if (!recipe) return <LoadingSpinner />;
  
  return (
    <>
      <RecipeHeader recipe={recipe} />
      <RecipeBody recipe={recipe} />
    </>
  );
}

// Props-based components
function RecipeHeader({ recipe }: { recipe: Recipe }) {
  return <h1>{recipe.title}</h1>;
}

function RecipeBody({ recipe }: { recipe: Recipe }) {
  return <p>{recipe.description}</p>;
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Reading data from Convex database
- Real-time data that needs automatic updates
- Data that should be cached across components
- Lists, detail views, dashboards
- User-specific data (with conditional queries)

❌ **Don't use for:**
- Write operations (use `useMutation` instead)
- Data that doesn't need reactivity (use HTTP fetch)
- Computed values (use `useMemo` instead)
- Inside loops or conditional branches

---

## Benefits

1. **Automatic Reactivity**: Components re-render when data changes
2. **Built-in Caching**: Same query across components shares cache
3. **Loading States**: `undefined` during loading, data when ready
4. **Type Safety**: Full TypeScript support with generated types
5. **Optimistic Updates**: Works with mutations for instant UI
6. **No Boilerplate**: No need for loading/error state management
7. **Real-time Subscriptions**: Automatic WebSocket connection
8. **Efficient**: Batches multiple queries, deduplicates requests

---

## Related Patterns

- See `usemutation-patterns.md` for write operations
- See `caching-strategies.md` for cache optimization
- See `pagination-patterns.md` for large datasets
- See `../09-hooks/useAuth.md` for auth-aware queries
- See `../02-react-patterns/effect-patterns.md` for side effects

---

*Extracted: 2026-02-18*
