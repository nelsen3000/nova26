# TITAN Style Guide - Real-time Patterns

> Standards for Convex subscriptions, optimistic updates, and presence systems

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Subscription hooks | `useLive[Entity].ts` | `useLiveCompanies.ts` |
| Presence hooks | `use[Entity]Presence.ts` | `useUserPresence.ts` |
| Optimistic patterns | `optimistic[Action].ts` | `optimisticCreate.ts` |
| Config | `subscription-config.ts` | `realtime-config.ts` |

---

## Import Patterns (CRITICAL - No TanStack Query)

```typescript
// ✅ CORRECT - Convex native
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

// ❌ WRONG - TanStack Query
import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
```

---

## Subscription Hook Pattern

```typescript
export function useLiveCompanies() {
  // Convex subscription - automatically updates
  const companies = useQuery(api.companies.list, {});
  
  return {
    companies,
    isLoading: companies === undefined,
    error: companies === null ? "Failed to load" : null,
  };
}
```

---

## Optimistic Update Pattern (CRITICAL)

```typescript
export const useCreateCompany = () => {
  return useMutation(api.companies.create).withOptimisticUpdate(
    (localStore, args) => {
      // Get existing data from cache
      const existing = localStore.getQuery(api.companies.list) ?? [];
      
      // Optimistically add new item
      localStore.setQuery(api.companies.list, [
        ...existing,
        { 
          ...args, 
          _id: "temp-" + Date.now(),
          _creationTime: Date.now(),
        }
      ]);
    }
  );
};
```

**⚠️ WARNING: NEVER use these TanStack patterns:**
- `queryClient.setQueryData()`
- `queryClient.invalidateQueries()`
- `ctx.cache.updateQuery()`
- `localStorageOptimisticUpdate()`

---

## Presence System Pattern

```typescript
export function useUserPresence(userId: string) {
  const status = useQuery(api.presence.getStatus, { userId });
  const updatePresence = useMutation(api.presence.update);
  
  useEffect(() => {
    // Update presence on mount
    updatePresence({ status: "online" });
    
    // Cleanup on unmount
    return () => {
      updatePresence({ status: "offline" });
    };
  }, [userId]);
  
  return {
    isOnline: status?.status === "online",
    lastSeen: status?.lastSeen,
  };
}
```

---

## Required Hook Structure

Every TITAN hook must:
1. Use `useQuery` from `convex/react` (not TanStack)
2. Handle `undefined` (loading), `null` (error), and populated states
3. Include cleanup in `useEffect` return
4. Return `{ data, isLoading, error }` shape

---

## Quality Checklist (26 items)

### Subscriptions (5)
- [ ] Uses Convex `useQuery` not TanStack
- [ ] Handles loading state (`undefined`)
- [ ] Handles error state (`null`)
- [ ] Cleanup on unmount
- [ ] Uses proper query keys (api.module.function)

### Optimistic Updates (5)
- [ ] Uses `withOptimisticUpdate()` 
- [ ] Accesses `localStore.getQuery()` / `localStore.setQuery()`
- [ ] No TanStack Query API calls
- [ ] Proper temp ID generation
- [ ] Rollback handled automatically by Convex

### Presence (5)
- [ ] Heartbeat mechanism documented
- [ ] Disconnect handling
- [ ] Status transitions defined
- [ ] Activity tracking (optional)
- [ ] Scalability considered

### Performance (5)
- [ ] No over-fetching
- [ ] Pagination for large lists
- [ ] Debouncing for rapid updates
- [ ] Selective subscriptions (not global)
- [ ] Indexes support queries

### Error Handling (6)
- [ ] Error recovery documented
- [ ] Optimistic rollback understood
- [ ] User feedback on failure
- [ ] Retry logic (if applicable)
- [ ] Graceful degradation
- [ ] Error boundaries considered

---

## Self-Check Before Responding

- [ ] Using correct Convex `useMutation` API
- [ ] No TanStack Query references anywhere
- [ ] Subscriptions use `useQuery` from `convex/react`
- [ ] Optimistic updates use `withOptimisticUpdate()`
- [ ] Presence tracking uses proper cleanup
- [ ] No memory leaks from subscriptions
- [ ] Real-time updates work without polling
- [ ] All imports are from `convex/react`
