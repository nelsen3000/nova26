# PLUTO Style Guide - Database Schema

## Convex Schema Conventions

### Table Naming
- Plural nouns: `companies`, `divisions`, `users`
- camelCase: `chipAccounts`, `userSettings`

### Field Naming
- camelCase: `createdAt`, `companyId`
- Boolean prefix: `is[State]`, `has[Feature]`, `should[Action]`
- Timestamp suffix: `At` (e.g., `createdAt`, `updatedAt`)

### Index Naming
Format: `[purpose]_[fields]`
- `by_company` - single field
- `by_company_status` - compound
- `by_createdAt` - timestamp queries

### Required Fields (every table)
```typescript
companyId: v.id("companies"),  // Row-level isolation
createdAt: v.number(),          // Unix timestamp
updatedAt: v.number(),          // Unix timestamp
```

### Index Patterns
```typescript
.index("by_company", ["companyId"])
.index("by_company_status", ["companyId", "status"])
.index("by_created", ["createdAt"])
```

### Validator Patterns
```typescript
// Enum
status: v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("completed")
)

// Optional
avatar: v.optional(v.string())

// ID reference
divisionId: v.id("divisions")

// Array
tags: v.array(v.string())
```

### Schema File Structure
```typescript
export default defineSchema({
  // Core entities
  companies: defineTable({...}).index(...),
  
  // Related entities
  divisions: defineTable({...}).index(...),
  
  // ATLAS tables (if defined here)
  builds: defineTable({...}).index(...),
});
```
