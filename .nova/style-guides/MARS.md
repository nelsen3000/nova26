# MARS Style Guide - Backend/Convex Code

> Standards and conventions for TypeScript backend and Convex mutation/query generation

---

## File Structure

Files must follow this exact order:

```typescript
// 1. Imports (in this order)
import { v } from "convex/values";                              // Convex validators
import { query, mutation } from "./_generated/server";          // Convex server
import type { Doc } from "./_generated/dataModel";              // Generated types
import { requireAuth } from "./auth";                           // Internal auth

// 2. Type definitions (if needed beyond generated)
interface TransferResult {
  success: boolean;
  newBalance: number;
  transactionId: string;
}

// 3. Helper functions (private)
function calculateChips(amount: number, rate: number): number {
  return Math.floor(amount * rate);  // Always use Math.floor for chips
}

// 4. Convex functions
export const list = query({...});
export const create = mutation({...});

// 5. Exports (named only)
export type { TransferResult };
```

---

## Naming Conventions

| Element | Convention | Example | Bad Example |
|---------|------------|---------|-------------|
| **Files** | camelCase with domain | `bountySystem.ts`, `userQueries.ts` | `BountySystem.ts`, `utils.ts` |
| **Queries** | camelCase, descriptive | `listActiveUsers`, `getById` | `query1`, `getUsers` |
| **Mutations** | action verb + noun | `createCompany`, `transferChips` | `companyCreate`, `handleTransfer` |
| **Internal helpers** | camelCase | `validateInput`, `calculateTotal` | `_validate`, `calc` |
| **Type exports** | PascalCase | `TransferResult`, `UserInput` | `transferResult`, `userInput` |

---

## The MARS 5-Step Pattern (MANDATORY)

Every mutation MUST follow this pattern:

```typescript
export const transferChips = mutation({
  args: {
    fromAccountId: v.id("chipAccounts"),
    toAccountId: v.id("chipAccounts"),
    amount: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    newBalance: v.number(),
  }),
  handler: async (ctx, args) => {
    // STEP 1: AUTHENTICATE
    const userId = await requireAuth(ctx);
    
    // STEP 2: VALIDATE
    if (args.amount <= 0) {
      throw new Error("Transfer amount must be positive");
    }
    if (args.fromAccountId === args.toAccountId) {
      throw new Error("Cannot transfer to same account");
    }
    
    // STEP 3: BUSINESS LOGIC
    const fromAccount = await ctx.db.get(args.fromAccountId);
    if (!fromAccount) {
      throw new Error("Source account not found");
    }
    if (fromAccount.userId !== userId) {
      throw new Error("Not authorized to transfer from this account");
    }
    if (fromAccount.balance < args.amount) {
      throw new Error("Insufficient funds");
    }
    
    // STEP 4: EXECUTE
    await ctx.db.patch(args.fromAccountId, {
      balance: Math.floor(fromAccount.balance - args.amount),
    });
    await ctx.db.patch(args.toAccountId, {
      balance: Math.floor(fromAccount.balance + args.amount),
    });
    
    // STEP 5: RETURN
    return {
      success: true,
      newBalance: Math.floor(fromAccount.balance - args.amount),
    };
  },
});
```

---

## Forbidden Patterns

These will cause immediate SEVERE gate failures:

- ❌ **`any` type** - Use specific types or `unknown` with type guards
- ❌ **`console.log`** - Use proper error handling and logging
- ❌ **Missing `requireAuth`** - All mutations must authenticate first
- ❌ **No validator on tables** - All `defineTable` must use `.validator()`
- ❌ **Floating point chips** - Must use `Math.floor()` for all chip calculations
- ❌ **Default exports** - Named exports only
- ❌ **Implicit returns** - Always explicit return types

---

## Required Patterns

### 1. Row-Level Security (MANDATORY)

Every query/mutation must enforce authorization:

```typescript
export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // ✅ GOOD - Check auth and company access
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user || user.companyId !== args.companyId) {
      throw new Error("Not authorized");
    }
    
    return ctx.db
      .query("divisions")
      .withIndex("by_company", q => q.eq("companyId", args.companyId))
      .collect();
  },
});
```

### 2. Input Validation

Use Convex validators for all inputs:

```typescript
// ✅ GOOD - Full validation
args: {
  name: v.string(),
  email: v.string(),
  age: v.number(),
  status: v.union(v.literal("active"), v.literal("inactive")),
  tags: v.array(v.string()),
  metadata: v.optional(v.record(v.string(), v.any())),
}

// ❌ BAD - Missing validation or too permissive
args: {
  data: v.any(),  // Too permissive
}
```

### 3. Error Handling

Always wrap in try-catch with context:

```typescript
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  console.error("operationName failed:", error);
  throw new Error("User-friendly error message");
}
```

### 4. TypeScript Strict Mode

```typescript
// ✅ GOOD - Explicit types everywhere
const user: Doc<"users"> = await ctx.db.get(userId);
if (user === null) {
  throw new Error("User not found");
}

// ❌ BAD - Implicit types or null checks
const user = await ctx.db.get(userId);  // Missing type
// No null check
```

---

## Convex Schema Patterns

### Table Definition

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  companies: defineTable({
    name: v.string(),
    sector: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("bankrupt")
    ),
    createdAt: v.string(),
  })
    .index("by_status", ["status"])
    .index("by_sector", ["sector"])
    .validator(/* validation logic */),
});
```

### Index Best Practices

Always add indexes for filtered queries:

```typescript
// ✅ GOOD - Indexes for common queries
.index("by_company", ["companyId"])
.index("by_company_status", ["companyId", "status"])
.index("by_created", ["createdAt"])

// ❌ BAD - Missing indexes cause full table scans
```

---

## Chip Calculation Safety

Chip calculations MUST use `Math.floor()`:

```typescript
// ✅ GOOD
const newBalance = Math.floor(currentBalance + amount);
const reward = Math.floor(baseAmount * multiplier);
const fee = Math.floor(amount * 0.05);

// ❌ BAD - Floating point errors
const newBalance = currentBalance + amount;
```

---

## Self-Check Before Responding

Before marking MARS task complete, verify:

### Type Safety
- [ ] No `any` types used anywhere
- [ ] All function returns explicitly typed
- [ ] All Convex args use validators (v.string(), v.id(), etc.)
- [ ] Proper null checking on database lookups

### Security
- [ ] All mutations call `requireAuth(ctx)` first
- [ ] Row-level isolation verified (companyId filtering)
- [ ] Input validation on all args
- [ ] Authorization checks before data access

### Correctness
- [ ] Chip math uses `Math.floor()` exclusively
- [ ] Error handling with try-catch
- [ ] User-friendly error messages (not raw errors)
- [ ] No `console.log` statements

### Integration
- [ ] Types align with PLUTO schema
- [ ] Named exports only
- [ ] Follows 5-step mutation pattern
- [ ] Indexes added for new queries

If any check fails, fix before MERCURY review.

---

## Output Format

MARS must output:

```markdown
## Function: {functionName}

### Type Signature
[TypeScript interface/signature]

### Security
- [x] Authentication required: {yes/no}
- [x] Row-level security: {description}
- [x] Input validation: {description}

### Implementation
\`\`\`typescript
[Full Convex function code]
\`\`\`

### Tests Needed
- [ ] {test case 1}
- [ ] {test case 2}
- [ ] {edge case}
```
