# Rate Limiting

## Source
Extracted from BistroLens `convex/lib/rateLimiter.ts`, `convex/schema.ts`, `convex/auth.ts`

**Category:** 11-validation
**Type:** Pattern
**Tags:** rate-limiting, api, convex, security, throttle, abuse-prevention

---

## Overview

Server-side rate limiting in Convex mutations using a sliding window counter stored in the database. Prevents API abuse, brute-force attacks, and runaway automation.

---

## Pattern

```typescript
// convex/lib/rateLimiter.ts
import { MutationCtx } from "../_generated/server";

interface RateLimitOptions {
  key: string;           // Unique key per action (e.g., "login:userId")
  limit: number;         // Max requests allowed
  windowMs: number;      // Time window in milliseconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;       // Unix timestamp when window resets
}

/**
 * Check and increment rate limit counter.
 * Uses Convex DB as the backing store — no Redis required.
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { key, limit, windowMs } = options;
  const now = Date.now();
  const windowStart = now - windowMs;

  // Find existing rate limit record
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!existing) {
    // First request — create record
    await ctx.db.insert("rateLimits", {
      key,
      count: 1,
      windowStart: now,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  // Check if window has expired
  if (existing.windowStart < windowStart) {
    // Reset window
    await ctx.db.patch(existing._id, {
      count: 1,
      windowStart: now,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  // Within window — check count
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  // Increment counter
  await ctx.db.patch(existing._id, { count: existing.count + 1 });
  return {
    allowed: true,
    remaining: limit - existing.count - 1,
    resetAt: existing.resetAt,
  };
}
```

```typescript
// convex/schema.ts — add rateLimits table
rateLimits: defineTable({
  key: v.string(),
  count: v.number(),
  windowStart: v.number(),
  resetAt: v.number(),
}).index("by_key", ["key"]),
```

```typescript
// convex/auth.ts — usage in a mutation
import { checkRateLimit } from "./lib/rateLimiter";
import { ConvexError } from "convex/values";

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const identity = await ctx.auth.getUserIdentity();

    // Rate limit: 5 login attempts per 15 minutes per email
    const rateLimit = await checkRateLimit(ctx, {
      key: `login:${email}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      throw new ConvexError(
        `Too many login attempts. Try again in ${resetIn} seconds.`
      );
    }

    // Proceed with login logic...
  },
});
```

---

## Usage

```typescript
// Rate limit by user ID (authenticated actions)
const rateLimit = await checkRateLimit(ctx, {
  key: `api:${identity.subject}`,
  limit: 100,
  windowMs: 60 * 1000, // 100 requests per minute
});

// Rate limit by IP (for public endpoints)
const rateLimit = await checkRateLimit(ctx, {
  key: `public:${clientIp}`,
  limit: 20,
  windowMs: 60 * 1000,
});

if (!rateLimit.allowed) {
  throw new ConvexError("Rate limit exceeded");
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Client-side rate limiting only — trivially bypassed
function LoginForm() {
  const [attempts, setAttempts] = useState(0);
  if (attempts > 5) return <p>Too many attempts</p>; // Bypassed on page refresh
}

// No rate limiting on sensitive mutations
export const resetPassword = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    // No rate limit — allows email flooding
    await sendPasswordResetEmail(email);
  },
});

// Rate limiting without proper key scoping
await checkRateLimit(ctx, { key: "login", limit: 5, windowMs: 60000 });
// Shared key means 5 total logins across ALL users
```

### ✅ Do This Instead

```typescript
// Server-side rate limiting with per-user key scoping
const rateLimit = await checkRateLimit(ctx, {
  key: `login:${email}`,       // Scoped per user
  limit: 5,
  windowMs: 15 * 60 * 1000,   // 15-minute window
});

if (!rateLimit.allowed) {
  throw new ConvexError(`Too many attempts. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s.`);
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Login and signup endpoints to prevent brute-force attacks
- Password reset and email verification to prevent flooding
- Public API endpoints exposed to unauthenticated users

❌ **Don't use for:**
- Internal server-to-server calls where trust is established
- Read-only queries that don't have side effects

---

## Benefits

1. Prevents brute-force attacks and API abuse without external infrastructure
2. Uses Convex DB as the backing store — no Redis or external rate limiter required
3. Sliding window counter provides smooth rate limiting without hard resets
4. Per-key scoping ensures one user's abuse doesn't affect others

---

## Related Patterns

- `business-rules.md` — Business logic validation
- `../03-auth-patterns/auth-helpers.md` — Authentication helpers
- `../01-convex-patterns/mutation-patterns.md` — Convex mutation conventions
