# Soft Delete Pattern

## Source
Extracted from BistroLens `convex/lib/softDelete.ts`, `convex/schema.ts`, `convex/companies.ts`

**Category:** 01-convex-patterns
**Type:** Pattern
**Tags:** convex, soft-delete, audit-trail, data-recovery, mutation

---

## Overview

BistroLens never hard-deletes records. All deletes set `deletedAt` timestamp and `isDeleted: true`, enabling audit trails, data recovery, and compliance. All queries filter out soft-deleted records by default.

---

## Pattern

```typescript
// convex/schema.ts — soft delete fields on every table
companies: defineTable({
  name: v.string(),
  // ... other fields
  isDeleted: v.boolean(),
  deletedAt: v.optional(v.number()),
  deletedBy: v.optional(v.string()), // userId who deleted
}).index("by_active", ["isDeleted"]),
```

```typescript
// convex/lib/softDelete.ts
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, TableNames } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

/**
 * Soft delete a record — sets isDeleted + deletedAt instead of removing
 */
export async function softDelete<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  id: Id<T>,
  deletedBy: string
): Promise<void> {
  const record = await ctx.db.get(id);
  if (!record) throw new ConvexError("Record not found");
  if ((record as any).isDeleted) throw new ConvexError("Record already deleted");

  await ctx.db.patch(id, {
    isDeleted: true,
    deletedAt: Date.now(),
    deletedBy,
  } as any);
}

/**
 * Restore a soft-deleted record
 */
export async function restoreRecord<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  id: Id<T>
): Promise<void> {
  const record = await ctx.db.get(id);
  if (!record) throw new ConvexError("Record not found");

  await ctx.db.patch(id, {
    isDeleted: false,
    deletedAt: undefined,
    deletedBy: undefined,
  } as any);
}

/**
 * Filter helper — always exclude soft-deleted records in queries
 */
export function excludeDeleted<T extends { isDeleted: boolean }>(
  records: T[]
): T[] {
  return records.filter((r) => !r.isDeleted);
}
```

```typescript
// convex/companies.ts — usage
import { softDelete } from "./lib/softDelete";

export const deleteCompany = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    // Check ownership
    const company = await ctx.db.get(companyId);
    if (!company || company.ownerId !== identity.subject) {
      throw new ConvexError("Not authorized");
    }

    await softDelete(ctx, "companies", companyId, identity.subject);
  },
});

export const listCompanies = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return ctx.db
      .query("companies")
      .withIndex("by_active", (q) => q.eq("isDeleted", false))
      .collect();
  },
});
```

---

## Usage

```typescript
// Soft delete with audit trail
await softDelete(ctx, "menuItems", menuItemId, identity.subject);

// Query only active records
const activeItems = await ctx.db
  .query("menuItems")
  .withIndex("by_active", (q) => q.eq("isDeleted", false))
  .collect();

// Restore accidentally deleted record
await restoreRecord(ctx, "menuItems", menuItemId);

// Admin: list all including deleted (for audit)
const allItems = await ctx.db.query("menuItems").collect();
const deletedItems = allItems.filter((i) => i.isDeleted);
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Hard delete — no recovery possible
await ctx.db.delete(companyId);

// Soft delete without filtering in queries
const companies = await ctx.db.query("companies").collect();
// Returns deleted records — leaks data to UI

// Soft delete without index — full table scan
const active = await ctx.db
  .query("companies")
  .filter((q) => q.eq(q.field("isDeleted"), false)) // No index — slow
  .collect();
```

### ✅ Do This Instead

```typescript
// Soft delete with audit trail
await softDelete(ctx, "companies", companyId, identity.subject);

// Always filter with index
const active = await ctx.db
  .query("companies")
  .withIndex("by_active", (q) => q.eq("isDeleted", false))
  .collect();
```

---

## When to Use This Pattern

✅ **Use for:**
- Any user-facing data that may need recovery (companies, menu items, team members)
- Compliance-sensitive records that require audit trails

❌ **Don't use for:**
- Ephemeral data like rate limit counters or temporary tokens
- High-volume log entries where storage cost matters

---

## Benefits

1. Enables data recovery — accidentally deleted records can be restored
2. Provides audit trail with `deletedAt` and `deletedBy` fields
3. Supports compliance requirements for data retention
4. Index-based filtering keeps query performance fast

---

## Related Patterns

- `mutation-patterns.md` — Convex mutation conventions
- `schema-conventions.md` — Table and field naming
- `../03-auth-patterns/auth-helpers.md` — Authorization helpers
