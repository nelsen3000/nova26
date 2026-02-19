# Convex Schema Conventions

## Source
Extracted from BistroLens `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md`

## Pattern: Table and Field Naming

### Table Naming Rules
```typescript
// ✅ GOOD - lowercase, plural, descriptive
defineTable({ ... })  // users, recipes, collections, mealPlans

// ❌ BAD - camelCase, singular, abbreviated
defineTable({ ... })  // User, recipe, colls
```

### Field Naming Rules
```typescript
// ✅ GOOD - camelCase, descriptive
{
  userId: v.id("users"),
  createdAt: v.number(),
  isActive: v.boolean(),
  recipeTitle: v.string(),
}

// ❌ BAD - snake_case, abbreviated
{
  user_id: v.id("users"),
  created: v.number(),
  active: v.boolean(),
  title: v.string(),
}
```

## Pattern: Required Fields for All Tables

Every table MUST include these fields:

```typescript
{
  createdAt: v.number(),              // Date.now() on creation
  updatedAt: v.number(),              // Date.now() on every update
  isDeleted: v.optional(v.boolean()), // Soft delete flag
}
```

### Implementation Example

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  recipes: defineTable({
    // Business fields
    title: v.string(),
    ingredients: v.array(v.object({
      name: v.string(),
      amount: v.string(),
      unit: v.string(),
    })),
    instructions: v.array(v.string()),
    userId: v.id("users"),
    
    // Required audit fields
    createdAt: v.number(),
    updatedAt: v.number(),
    isDeleted: v.optional(v.boolean()),
  })
  .index("by_user", ["userId"])
  .index("by_user_created", ["userId", "createdAt"]),
});
```

## Pattern: Index Strategy

### Always Index These Patterns

```typescript
// User-scoped queries (most common pattern)
.index("by_user", ["userId"])
.index("by_user_created", ["userId", "createdAt"])

// Status-based queries
.index("by_status", ["status"])
.index("by_user_status", ["userId", "status"])

// Lookup by external ID
.index("by_stripe_id", ["stripeCustomerId"])
.index("by_email", ["email"])
```

### Index Rules

| Rule | Reason |
|------|--------|
| Index fields used in `.filter()` | Avoid full table scans |
| Put equality fields first | Convex optimizes left-to-right |
| Limit to 32 indexes per table | Convex hard limit |
| Don't index rarely-queried fields | Wastes write performance |

## When to Use This Pattern

✅ **Use for:**
- Every new Convex table definition
- When adding fields to existing tables
- When designing multi-tenant schemas
- When implementing soft deletes

❌ **Don't use for:**
- Temporary or ephemeral data that doesn't need schema validation

## Benefits

1. **Consistency**: All tables follow same conventions
2. **Auditability**: createdAt/updatedAt track changes
3. **Safety**: Soft deletes prevent data loss
4. **Performance**: Proper indexes enable fast queries
5. **Maintainability**: Predictable field names

## Anti-Patterns

- Using snake_case for field names instead of camelCase (e.g., `user_id` instead of `userId`)
- Omitting `createdAt` and `updatedAt` timestamp fields from table definitions
- Creating indexes on rarely-queried fields, wasting write performance
- Using singular table names instead of plural (e.g., `recipe` instead of `recipes`)

## Related Patterns

- See `query-patterns.md` for using these indexes
- See `soft-delete-pattern.md` for isDeleted usage
- See `migration-procedures.md` for schema changes
