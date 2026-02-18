# ENCELADUS Style Guide - Security

## Auth Helper Naming
- `requireAuth(ctx)` - authentication check
- `requireCompanyAccess(ctx, companyId)` - authorization
- `sanitizeInput(input)` - input sanitization
- `validateCSRF(token)` - CSRF protection
- `rateLimit(key, maxRequests)` - rate limiting

## Security Pattern Naming
- XSS prevention: `escapeHtml()`, `sanitizeHtml()`
- SQL injection: Use Convex validators (never string concatenation)
- Auth patterns: `[action]Auth[Resource]`
- Encryption: `encrypt[DataType]()`, `decrypt[DataType]()`

## Required Security Checks
1. Authentication - verify user identity
2. Authorization - verify user permissions
3. Input validation - validate all inputs
4. Output encoding - escape dynamic content
5. Rate limiting - prevent abuse

## Security Headers
```typescript
// CSP headers
Content-Security-Policy: default-src 'self'

// XSS protection
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

## Auth Pattern Template
```typescript
export async function requireAuth(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}
```

## Row-Level Security Pattern
```typescript
const company = await ctx.db.get(companyId);
if (!company || company.ownerId !== userId) {
  throw new Error("Not authorized");
}
```
