# Skill: Convex Authentication with Clerk

## Domain
User authentication, session management, protected routes, auth middleware

## Agents That Use This Skill
- **ENCELADUS** - Security implementation
- **MARS** - Auth mutations and queries
- **VENUS** - Auth UI components (login, signup)
- **PLUTO** - User schema design

## When to Load
Auto-load when task description contains: `auth`, `login`, `signup`, `authentication`, `clerk`, `protected`, `session`

## Patterns Provided

### 1. Protected Route Pattern
```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/convex(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect();
});
```

### 2. Convex Auth Helper
```typescript
// convex/auth.ts
import { query, mutation } from './_generated/server';

export async function requireAuth(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

// Use in mutations
export const getUserData = query({
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    return await ctx.db
      .query('users')
      .withIndex('by_token', q => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .first();
  },
});
```

### 3. User Schema with Auth
```typescript
// convex/schema.ts
defineTable({
  tokenIdentifier: v.string(), // Clerk user ID
  email: v.string(),
  name: v.string(),
  avatar: v.optional(v.string()),
  createdAt: v.number(),
})
  .index('by_token', ['tokenIdentifier'])
  .index('by_email', ['email']);
```

### 4. Auth UI Components
```tsx
// VENUS: Login button
import { SignInButton, UserButton } from '@clerk/nextjs';

export function AuthButtons() {
  return (
    <div>
      <SignedOut>
        <SignInButton mode="modal">
          <Button>Sign In</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  );
}
```

## Required Dependencies
```bash
npm install @clerk/nextjs
```

## Required Environment Variables
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

## Security Best Practices
- ALWAYS use `auth().protect()` in middleware
- NEVER trust client-side auth state alone
- ALWAYS verify user identity in Convex mutations
- Use row-level isolation (userId filtering)

## Common Patterns
- Sync Clerk user to Convex on signup
- Protected API routes
- Role-based access control (admin, user)
