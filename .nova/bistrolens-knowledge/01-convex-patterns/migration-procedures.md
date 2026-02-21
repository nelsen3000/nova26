# Migration Procedures

## Source
Extracted from BistroLens `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md` (Section 8)

---

## Pattern: Safe Schema Migrations

Convex schemas are flexible, but production migrations require careful planning to avoid data loss or downtime.

---

## Migration Types

### 1. Add Optional Field (Safe)

```typescript
// Step 1: Add to schema as optional
// convex/schema.ts
export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    // New field
    displayName: v.optional(v.string()), // ✅ Optional
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
});

// Step 2: Deploy schema
// npx convex deploy

// Step 3: Update code to use new field
export const updateProfile = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    await ctx.db.patch(identity.subject, {
      displayName: args.displayName,
      updatedAt: Date.now(),
    });
  },
});
```

### 2. Make Field Required (Multi-Step)

```typescript
// ❌ DANGEROUS - Don't make field required immediately
// This breaks existing documents!

// ✅ SAFE - Three-step process

// Step 1: Add as optional
displayName: v.optional(v.string())

// Step 2: Backfill existing documents
export const backfillDisplayNames = internalMutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    for (const user of users) {
      if (!user.displayName) {
        await ctx.db.patch(user._id, {
          displayName: user.email.split("@")[0],
          updatedAt: Date.now(),
        });
      }
    }
    
    console.log(`Backfilled ${users.length} users`);
  },
});

// Step 3: Make required after backfill complete
displayName: v.string() // Now safe
```

### 3. Rename Field (Multi-Step)

```typescript
// ❌ DANGEROUS - Don't rename directly
// Old code breaks immediately!

// ✅ SAFE - Four-step process

// Step 1: Add new field (optional)
export default defineSchema({
  recipes: defineTable({
    title: v.string(),           // Old field
    recipeTitle: v.optional(v.string()), // New field
  }),
});

// Step 2: Backfill new field from old
export const backfillRecipeTitles = internalMutation({
  handler: async (ctx) => {
    const recipes = await ctx.db.query("recipes").collect();
    
    for (const recipe of recipes) {
      if (!recipe.recipeTitle && recipe.title) {
        await ctx.db.patch(recipe._id, {
          recipeTitle: recipe.title,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

// Step 3: Update all code to use new field
// Find and replace: recipe.title → recipe.recipeTitle

// Step 4: Remove old field (after all code updated)
export default defineSchema({
  recipes: defineTable({
    recipeTitle: v.string(), // Only new field
  }),
});
```

### 4. Change Field Type (Multi-Step)

```typescript
// Example: Change status from string to enum

// Step 1: Add new field with correct type
export default defineSchema({
  recipes: defineTable({
    status: v.string(),                    // Old (any string)
    statusEnum: v.optional(                // New (enum)
      v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      )
    ),
  }),
});

// Step 2: Backfill with validation
export const backfillStatusEnum = internalMutation({
  handler: async (ctx) => {
    const recipes = await ctx.db.query("recipes").collect();
    
    const validStatuses = ["draft", "published", "archived"];
    
    for (const recipe of recipes) {
      if (!recipe.statusEnum) {
        // Validate and convert
        const status = validStatuses.includes(recipe.status)
          ? recipe.status
          : "draft"; // Default for invalid values
        
        await ctx.db.patch(recipe._id, {
          statusEnum: status as "draft" | "published" | "archived",
          updatedAt: Date.now(),
        });
      }
    }
  },
});

// Step 3: Update code to use statusEnum
// Step 4: Remove old status field
```

---

## Backfill Patterns

### Simple Backfill

```typescript
// migrations/backfillField.ts
import { internalMutation } from "./_generated/server";

export const backfillField = internalMutation({
  handler: async (ctx) => {
    const documents = await ctx.db.query("tableName").collect();
    
    for (const doc of documents) {
      if (!doc.newField) {
        await ctx.db.patch(doc._id, {
          newField: computeValue(doc),
          updatedAt: Date.now(),
        });
      }
    }
    
    return { processed: documents.length };
  },
});
```

### Batched Backfill (Large Tables)

```typescript
// For tables with 100k+ documents
export const backfillBatched = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    
    // Get batch of documents
    const page = await ctx.db
      .query("tableName")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: batchSize,
      });
    
    // Process batch
    for (const doc of page.page) {
      if (!doc.newField) {
        await ctx.db.patch(doc._id, {
          newField: computeValue(doc),
          updatedAt: Date.now(),
        });
      }
    }
    
    return {
      processed: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

// Run in batches:
// 1. Call with no cursor
// 2. Use continueCursor for next batch
// 3. Repeat until isDone = true
```

### Conditional Backfill

```typescript
// Only backfill documents matching criteria
export const backfillPremiumUsers = internalMutation({
  handler: async (ctx) => {
    const premiumUsers = await ctx.db
      .query("users")
      .withIndex("by_subscription", (q) => q.eq("tier", "premium"))
      .collect();
    
    for (const user of premiumUsers) {
      if (!user.premiumSince) {
        await ctx.db.patch(user._id, {
          premiumSince: user.subscriptionStartDate,
          updatedAt: Date.now(),
        });
      }
    }
    
    return { processed: premiumUsers.length };
  },
});
```

---

## Index Migrations

### Add Index (Safe)

```typescript
// Step 1: Add index to schema
export default defineSchema({
  recipes: defineTable({
    userId: v.string(),
    status: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]) // New index
    .index("by_user_status", ["userId", "status"]), // New composite
});

// Step 2: Deploy
// Convex builds index automatically (may take time for large tables)

// Step 3: Update queries to use new index
export const listByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recipes")
      .withIndex("by_status", (q) => q.eq("status", args.status)) // Use new index
      .take(20);
  },
});
```

### Remove Index (Safe)

```typescript
// Step 1: Verify no queries use the index
// Search codebase for: .withIndex("old_index_name"

// Step 2: Remove from schema
// (Remove .index("old_index_name", [...]))

// Step 3: Deploy
// Convex drops index automatically
```

---

## Table Migrations

### Add Table (Safe)

```typescript
// Just add to schema and deploy
export default defineSchema({
  // Existing tables
  users: defineTable({ ... }),
  recipes: defineTable({ ... }),
  
  // New table
  mealPlans: defineTable({
    userId: v.string(),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "startDate"]),
});
```

### Rename Table (Multi-Step)

```typescript
// ❌ DANGEROUS - Don't rename directly

// ✅ SAFE - Create new, migrate, delete old

// Step 1: Create new table
export default defineSchema({
  oldTableName: defineTable({ ... }),
  newTableName: defineTable({ ... }), // Same schema
});

// Step 2: Copy data
export const migrateToNewTable = internalMutation({
  handler: async (ctx) => {
    const oldDocs = await ctx.db.query("oldTableName").collect();
    
    for (const doc of oldDocs) {
      const { _id, _creationTime, ...data } = doc;
      await ctx.db.insert("newTableName", data);
    }
  },
});

// Step 3: Update all code to use newTableName
// Step 4: Remove oldTableName from schema
```

### Delete Table (Careful!)

```typescript
// Step 1: Verify table is unused
// Search codebase for: query("tableName")

// Step 2: Export data (backup)
export const exportTableData = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("tableName").collect();
  },
});

// Step 3: Remove from schema
// (Delete defineTable definition)

// Step 4: Deploy
// ⚠️ Data is permanently deleted!
```

---

## Anti-Patterns

### ❌ Don't Make Breaking Changes

```typescript
// ❌ BAD - Immediate breaking change
// Old: name: v.string()
// New: name: v.object({ first: v.string(), last: v.string() })
// All existing code breaks!

// ✅ GOOD - Gradual migration
// 1. Add firstName, lastName as optional
// 2. Backfill from name
// 3. Update code
// 4. Remove name field
```

### ❌ Don't Skip Backfills

```typescript
// ❌ BAD - Make field required without backfill
displayName: v.string() // Existing docs fail validation!

// ✅ GOOD - Backfill first
// 1. Add as optional
// 2. Backfill all documents
// 3. Make required
```

### ❌ Don't Migrate in Production Queries

```typescript
// ❌ BAD - Migration logic in query
export const getUser = query({
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    
    // Don't do this!
    if (!user.displayName) {
      await ctx.db.patch(user._id, {
        displayName: user.email.split("@")[0],
      });
    }
    
    return user;
  },
});

// ✅ GOOD - Separate migration mutation
export const migrateUsers = internalMutation({ ... });
```

---

## When to Use This Pattern

✅ **Use for:**
- Adding new fields
- Changing field types
- Renaming fields or tables
- Adding/removing indexes
- Data cleanup

❌ **Don't use for:**
- Frequent schema changes (design first!)
- Complex transformations (use ETL)
- Cross-database migrations (Convex only)

---

## Benefits

1. **Zero downtime** - Gradual migrations keep app running
2. **Reversible** - Can roll back if issues arise
3. **Safe** - No data loss with proper backfills
4. **Auditable** - Migration code is version controlled

---

## Migration Checklist

- [ ] Plan migration steps (write them down)
- [ ] Test migration on dev environment
- [ ] Create backfill mutation
- [ ] Run backfill and verify
- [ ] Update application code
- [ ] Deploy code changes
- [ ] Update schema
- [ ] Deploy schema changes
- [ ] Monitor for errors
- [ ] Clean up old fields (after verification)

---

## Related Patterns

- See `schema-conventions.md` for schema design
- See `mutation-patterns.md` for data updates
- See `query-patterns.md` for index usage

---

*Extracted: 2026-02-18*
