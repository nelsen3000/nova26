# Optimistic Mutation Pattern

## Source
Extracted from BistroLens `hooks/useOptimisticMutation.ts`

**Category:** 01-convex-patterns
**Type:** Pattern
**Tags:** convex, optimistic-update, mutation, ux, real-time, rollback

---

## Overview

Optimistic mutations update local UI state immediately before the server confirms, giving instant feedback. Convex's `useMutation` supports optimistic updates via the `optimisticUpdate` option, with automatic rollback on failure.

---

## Pattern

```typescript
// hooks/useOptimisticMutation.ts
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { OptimisticLocalStore } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";

// --- Toggle like with optimistic update ---

export function useLikeMenuItem() {
  return useMutation(api.menuItems.toggleLike).withOptimisticUpdate(
    (localStore: OptimisticLocalStore, args: { menuItemId: Id<"menuItems"> }) => {
      const { menuItemId } = args;

      // Read current cached value
      const currentItem = localStore.getQuery(api.menuItems.getById, { menuItemId });
      if (!currentItem) return;

      // Optimistically toggle the like
      localStore.setQuery(
        api.menuItems.getById,
        { menuItemId },
        {
          ...currentItem,
          isLiked: !currentItem.isLiked,
          likeCount: currentItem.isLiked
            ? currentItem.likeCount - 1
            : currentItem.likeCount + 1,
        }
      );
    }
  );
}

// --- Optimistic list item addition ---

export function useAddMenuItem() {
  return useMutation(api.menuItems.create).withOptimisticUpdate(
    (localStore: OptimisticLocalStore, args: { name: string; price: number; companyId: Id<"companies"> }) => {
      const currentList = localStore.getQuery(api.menuItems.list, {
        companyId: args.companyId,
      });

      if (currentList === undefined) return;

      // Add a temporary item to the list
      localStore.setQuery(
        api.menuItems.list,
        { companyId: args.companyId },
        [
          ...currentList,
          {
            _id: `temp-${Date.now()}` as Id<"menuItems">,
            _creationTime: Date.now(),
            name: args.name,
            price: args.price,
            companyId: args.companyId,
            isDeleted: false,
          },
        ]
      );
    }
  );
}
```

```tsx
// Usage in component
function MenuItemCard({ item }: { item: MenuItem }) {
  const toggleLike = useLikeMenuItem();

  return (
    <div className="flex items-center justify-between p-4">
      <span>{item.name}</span>
      <button
        onClick={() => toggleLike({ menuItemId: item._id })}
        className={item.isLiked ? "text-red-500" : "text-gray-400"}
      >
        ♥ {item.likeCount}
      </button>
    </div>
  );
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Manual optimistic state with useState — gets out of sync
const [liked, setLiked] = useState(item.isLiked);
const toggleLike = async () => {
  setLiked(!liked); // Optimistic
  try {
    await toggleLikeMutation({ menuItemId: item._id });
  } catch {
    setLiked(liked); // Manual rollback — error-prone
  }
};

// No optimistic update — UI feels slow
const toggleLike = useMutation(api.menuItems.toggleLike);
// User clicks, waits 200-500ms for server round-trip before UI updates

// Optimistic update without matching query key
localStore.setQuery(
  api.menuItems.list,
  { companyId: "wrong-id" }, // Wrong args — update doesn't apply
  updatedList
);
```

### ✅ Do This Instead

```typescript
// Use Convex's built-in optimistic update with automatic rollback
const toggleLike = useMutation(api.menuItems.toggleLike).withOptimisticUpdate(
  (localStore, args) => {
    const currentItem = localStore.getQuery(api.menuItems.getById, { menuItemId: args.menuItemId });
    if (!currentItem) return;
    localStore.setQuery(api.menuItems.getById, { menuItemId: args.menuItemId }, {
      ...currentItem,
      isLiked: !currentItem.isLiked,
      likeCount: currentItem.isLiked ? currentItem.likeCount - 1 : currentItem.likeCount + 1,
    });
  }
);
```

---

## When to Use This Pattern

✅ **Use for:**
- Toggle actions (like/unlike, bookmark, follow) where instant feedback matters
- Adding items to lists where the user expects immediate visual confirmation
- Any mutation where the expected outcome is predictable from the input

❌ **Don't use for:**
- Complex mutations with server-side validation that may reject the input
- Operations where the result depends on server state unknown to the client

---

## Benefits

1. Instant UI feedback — no perceived latency for the user
2. Automatic rollback on server failure via Convex's `OptimisticLocalStore`
3. No manual state management — avoids useState/try/catch rollback bugs
4. Works with Convex's real-time subscriptions for consistent cache updates

---

## Related Patterns

- `mutation-patterns.md` — Convex mutation conventions
- `real-time-subscriptions.md` — useQuery subscription patterns
- `../05-form-patterns/form-submission.md` — Form submit with optimistic updates
