# Nova26 Convex Pattern Improvements

## Adapted from BistroLens Database Patterns

**Source:** BistroLens `38-CONVEX-DATABASE-PATTERNS.md`, `convex/schema.ts`  
**Category:** Database Architecture  
**Priority:** P2  
**Reusability:** 9/10

---

## Overview

BistroLens has mature Convex patterns:
- Field naming conventions (camelCase)
- Required audit fields (createdAt, updatedAt, isDeleted)
- Index strategy with query optimization
- Soft delete pattern
- Auth guard helpers
- Pagination patterns

Nova26's PLUTO agent can be enhanced with these patterns.

---

## Pattern 1: Standard Table Structure

**Source:** BistroLens schema conventions  
**Nova26 Enhancement:** Add to PLUTO style guide

### Schema Template

```typescript
// convex/schema.ts - Enhanced Pattern

defineTable({
  // === REQUIRED FIELDS (All tables) ===
  createdAt: v.number(),
  updatedAt: v.number(),
  isDeleted: v.optional(v.boolean()),
  deletedAt: v.optional(v.number()),
  
  // === ENTITY-SPECIFIC FIELDS ===
  // Use camelCase
  userId: v.id("users"),
  displayName: v.string(),
  
  // Enums use string literals
  status: v.union(
    v.literal("active"),
    v.literal("inactive"),
    v.literal("pending")
  ),
  
  // Arrays with type safety
  tags: v.array(v.string()),
  
  // Nested objects with v.object
  metadata: v.optional(v.object({
    source: v.string(),
    version: v.number(),
  })),
})
  // === INDEXES ===
  // Always index userId lookups
  .index("by_user", ["userId"])
  .index("by_user_created", ["userId", "createdAt"])
  
  // Status-based queries
  .index("by_status", ["status"])
  .index("by_user_status", ["userId", "status"])
```

---

## Pattern 2: Auth Guard Helpers

**Source:** BistroLens `38-CONVEX-DATABASE-PATTERNS.md` (Security section)  
**Nova26 Enhancement:** Create `convex/lib/auth.ts`

### Implementation

```typescript
// convex/lib/auth.ts

import { QueryCtx, MutationCtx } from "../_generated/server";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: Please sign in");
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
    throw new Error("Forbidden: Admin access required");
  }
  
  return { identity, user };
}

export async function requireOwnership(
  ctx: QueryCtx | MutationCtx,
  resourceId: Id<any>,
  tableName: string
) {
  const identity = await requireAuth(ctx);
  const resource = await ctx.db.get(resourceId);
  
  if (!resource || resource.userId !== identity.subject) {
    throw new Error("Not found or access denied");
  }
  
  return { identity, resource };
}

// Ownership OR admin access
export async function requireOwnershipOrAdmin(
  ctx: QueryCtx | MutationCtx,
  resourceId: Id<any>,
  tableName: string
) {
  const identity = await requireAuth(ctx);
  const resource = await ctx.db.get(resourceId);
  
  if (!resource) {
    throw new Error("Not found");
  }
  
  if (resource.userId === identity.subject) {
    return { identity, resource, role: "owner" };
  }
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  
  if (user?.isAdmin) {
    return { identity, resource, role: "admin" };
  }
  
  throw new Error("Access denied");
}
```

---

## Pattern 3: Soft Delete Pattern

**Source:** BistroLens mutation patterns  
**Nova26 Enhancement:** Standardize across all tables

### Soft Delete Mutation

```typescript
// convex/lib/softDelete.ts

export async function softDelete(
  ctx: MutationCtx,
  tableName: string,
  id: Id<any>,
  userId: string
): Promise<void> {
  const resource = await ctx.db.get(id);
  
  if (!resource || resource.userId !== userId) {
    throw new Error("Not found or access denied");
  }
  
  await ctx.db.patch(id, {
    isDeleted: true,
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// Query helper to exclude soft-deleted
export function excludeDeleted<T extends { isDeleted?: boolean }>(
  items: T[]
): T[] {
  return items.filter(item => !item.isDeleted);
}

// Convex query filter
export const notDeleted = (q: any) => q.neq(q.field("isDeleted"), true);
```

### Usage in Queries

```typescript
export const listUserItems = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("items")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("isDeleted"), true)) // Exclude deleted
      .order("desc")
      .take(100);
  },
});
```

---

## Pattern 4: Pagination Helper

**Source:** BistroLens pagination pattern  
**Nova26 Enhancement:** Reusable pagination wrapper

### Implementation

```typescript
// convex/lib/pagination.ts

import { paginationOptsValidator } from "convex/server";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

interface PaginationResult<T> {
  page: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function paginateQuery<T>(
  ctx: QueryCtx,
  query: any,
  opts: { cursor?: string; limit?: number }
): Promise<PaginationResult<T>> {
  const limit = Math.min(opts.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  
  const result = await query
    .paginate({
      cursor: opts.cursor,
      numItems: limit,
    });
  
  return {
    page: result.page,
    nextCursor: result.continueCursor,
    hasMore: result.hasMore,
  };
}
```

---

## Pattern 5: Rate Limiting at DB Level

**Source:** BistroLens RLS patterns  
**Nova26 Enhancement:** Convex-native rate limiting

### Implementation

```typescript
// convex/lib/rateLimit.ts

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  api_call: { maxRequests: 100, windowMs: 60 * 1000 },
  message_send: { maxRequests: 50, windowMs: 60 * 1000 },
  login_attempt: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
};

export async function checkRateLimit(
  ctx: MutationCtx,
  userId: string,
  action: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const config = RATE_LIMITS[action];
  if (!config) return { allowed: true, remaining: Infinity, resetAt: 0 };
  
  const windowStart = Date.now() - config.windowMs;
  
  // Count recent actions
  const recentCount = await ctx.db
    .query("rate_limit_events")
    .withIndex("by_user_action_time", (q) => 
      q.eq("userId", userId).eq("action", action).gt("timestamp", windowStart)
    )
    .collect()
    .then(events => events.length);
  
  const allowed = recentCount < config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - recentCount - 1);
  const resetAt = Date.now() + config.windowMs;
  
  if (allowed) {
    // Log this action
    await ctx.db.insert("rate_limit_events", {
      userId,
      action,
      timestamp: Date.now(),
    });
  }
  
  return { allowed, remaining, resetAt };
}

// Add to schema:
// rate_limit_events: defineTable({
//   userId: v.id("users"),
//   action: v.string(),
//   timestamp: v.number(),
// }).index("by_user_action_time", ["userId", "action", "timestamp"]),
```

---

## Pattern 6: Validation Helpers

**Source:** BistroLens input validation patterns  
**Nova26 Enhancement:** Centralized validators

```typescript
// convex/lib/validators.ts

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateString(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; pattern?: RegExp }
): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`, field);
  }
  
  if (options.min !== undefined && value.length < options.min) {
    throw new ValidationError(
      `${field} must be at least ${options.min} characters`,
      field
    );
  }
  
  if (options.max !== undefined && value.length > options.max) {
    throw new ValidationError(
      `${field} must be at most ${options.max} characters`,
      field
    );
  }
  
  if (options.pattern && !options.pattern.test(value)) {
    throw new ValidationError(`${field} format is invalid`, field);
  }
  
  return value;
}

export function validateEmail(value: unknown, field: string): string {
  const email = validateString(value, field, { min: 5, max: 254 });
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailPattern.test(email)) {
    throw new ValidationError(`${field} must be a valid email`, field);
  }
  
  return email.toLowerCase();
}

export function validateNumber(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; integer?: boolean }
): number {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError(`${field} must be a number`, field);
  }
  
  if (options.integer && !Number.isInteger(value)) {
    throw new ValidationError(`${field} must be an integer`, field);
  }
  
  if (options.min !== undefined && value < options.min) {
    throw new ValidationError(
      `${field} must be at least ${options.min}`,
      field
    );
  }
  
  if (options.max !== undefined && value > options.max) {
    throw new ValidationError(
      `${field} must be at most ${options.max}`,
      field
    );
  }
  
  return value;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `convex/lib/auth.ts` | New - auth guard helpers |
| `convex/lib/softDelete.ts` | New - soft delete pattern |
| `convex/lib/pagination.ts` | New - pagination helpers |
| `convex/lib/rateLimit.ts` | New - rate limiting |
| `convex/lib/validators.ts` | New - input validation |
| `.nova/style-guides/PLUTO.md` | Add patterns |

---

## Source

Adapted from BistroLens Convex patterns. See `38-CONVEX-DATABASE-PATTERNS.md`, `convex/schema.ts`.

## Anti-Patterns

- Don't use hard delete -- always use the soft delete pattern with `isDeleted` and `deletedAt` fields
- Don't skip audit fields (`createdAt`, `updatedAt`) on any table -- they are required for every entity
- Don't query without indexes -- always define and use indexes for `userId`, `status`, and common query paths
- Don't trust client input -- always validate with auth guards (`requireAuth`, `requireOwnership`) before mutations

## When to Use

- When PLUTO generates new Convex schema definitions or table structures
- When implementing CRUD operations that need auth guards and ownership checks
- When adding pagination, rate limiting, or soft delete to existing queries and mutations
- When standardizing validation patterns across all Convex functions

## Benefits

- Standardized table structure ensures every entity has audit fields, soft delete support, and proper indexes
- Auth guard helpers (`requireAuth`, `requireAdmin`, `requireOwnership`) eliminate boilerplate and prevent access control gaps
- Pagination helpers enforce consistent page sizes and prevent unbounded queries
- Database-level rate limiting provides a second defense layer beyond application-level limits

## Related Patterns

- See `nova26-security-enforcement.md` for application-level rate limiting that complements DB-level limits
- See `nova26-code-governance.md` for governance rules that enforce schema conventions
- See `nova26-expanded-gates.md` for the schema-validation gate that checks generated database code
- See `soft-delete-pattern.md` for the extracted BistroLens soft delete implementation

---

*Adapted from BistroLens Convex patterns*
*For Nova26 database best practices*
