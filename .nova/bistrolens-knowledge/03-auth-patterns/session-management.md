# Session Management

## Source
Extracted from BistroLens `.kiro/steering/39-AUTHENTICATION-AUTHORIZATION.md` (Section 2)

---

## Pattern: Session Management

Secure session handling with automatic refresh, concurrent session limits, and proper invalidation on security events. Sessions are stored in Convex with device tracking and automatic expiration.

---

## Session Configuration

### Session Rules

| Rule | Value | Reason |
|------|-------|--------|
| Session duration | 7 days | Balance security/UX |
| Refresh threshold | 1 day before expiry | Seamless renewal |
| Max concurrent sessions | 5 | Prevent sharing |
| Session invalidation | On password change | Security |

### Code Example

```typescript
// Session schema
interface Session {
  userId: string;
  deviceId: string;
  createdAt: number;
  expiresAt: number;
  lastActiveAt: number;
  userAgent: string;
  ipAddress: string; // Hashed for privacy
}

// Session validation on every request
async function validateSession(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  
  // Check session not expired
  const now = Date.now();
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_user", (q) => q.eq("userId", identity.subject))
    .first();
  
  if (!session || session.expiresAt < now) {
    return null;
  }
  
  // Update lastActiveAt
  await ctx.db.patch(session._id, {
    lastActiveAt: now,
  });
  
  return identity;
}
```

---

## Logout Handling

### Single Device Logout

```typescript
// Logout from current device only
export const logout = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== identity.subject) {
      throw new Error("Invalid session");
    }
    
    await ctx.db.delete(args.sessionId);
  },
});
```

### All Devices Logout

```typescript
// Logout from all devices (password change, security concern)
export const logoutAllDevices = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
  },
});
```

---

## Session Refresh

### Automatic Token Refresh

```typescript
// Client-side: Check token expiry and refresh proactively
export function useSessionRefresh() {
  const { isAuthenticated } = useConvexAuth();
  
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Check every hour if token needs refresh
    const interval = setInterval(async () => {
      const token = await getAuthToken();
      const payload = parseJWT(token);
      
      // Refresh if less than 1 day until expiry
      const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000;
      if (payload.exp * 1000 < oneDayFromNow) {
        await refreshAuthToken();
      }
    }, 60 * 60 * 1000); // Check every hour
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);
}
```

---

## Concurrent Session Management

### Enforce Session Limits

```typescript
// Limit concurrent sessions per user
export const createSession = mutation({
  args: {
    deviceId: v.string(),
    userAgent: v.string(),
    ipAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get existing sessions
    const existingSessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    
    // If at limit, remove oldest session
    const MAX_SESSIONS = 5;
    if (existingSessions.length >= MAX_SESSIONS) {
      const oldestSession = existingSessions.sort(
        (a, b) => a.createdAt - b.createdAt
      )[0];
      await ctx.db.delete(oldestSession._id);
    }
    
    // Create new session
    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      userId: identity.subject,
      deviceId: args.deviceId,
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
      lastActiveAt: now,
      userAgent: args.userAgent,
      ipAddress: hashIP(args.ipAddress), // Hash for privacy
    });
    
    return sessionId;
  },
});
```

---

## Security Event Invalidation

### Invalidate on Password Change

```typescript
// When password changes, invalidate all sessions
export const changePassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Verify current password
    const user = await ctx.db.get(identity.subject);
    const isValid = await verifyPassword(
      args.currentPassword,
      user.passwordHash
    );
    
    if (!isValid) {
      throw new Error("Current password is incorrect");
    }
    
    // Update password
    const newHash = await hashPassword(args.newPassword);
    await ctx.db.patch(user._id, {
      passwordHash: newHash,
    });
    
    // Invalidate ALL sessions for security
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    
    // Log security event
    await ctx.db.insert("auditLogs", {
      eventType: "password_change",
      severity: "info",
      userId: identity.subject,
      timestamp: Date.now(),
      details: { sessionsInvalidated: sessions.length },
    });
  },
});
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// ❌ BAD: Storing sessions client-side only
localStorage.setItem("session", JSON.stringify({
  userId: "123",
  expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
}));
// Problem: No server-side validation, can be tampered with

// ❌ BAD: Never expiring sessions
interface Session {
  userId: string;
  createdAt: number;
  // Missing expiresAt - session never expires!
}

// ❌ BAD: Not invalidating sessions on password change
export const changePassword = mutation({
  handler: async (ctx, args) => {
    // Update password
    await ctx.db.patch(userId, { passwordHash: newHash });
    // Missing: Session invalidation!
  },
});

// ❌ BAD: Unlimited concurrent sessions
// Allows account sharing and security risks
```

### ✅ Do This Instead

```typescript
// ✅ GOOD: Server-side session validation
async function validateSession(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  
  // Verify session exists and is valid
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_user", (q) => q.eq("userId", identity.subject))
    .first();
  
  if (!session || session.expiresAt < Date.now()) {
    return null;
  }
  
  return identity;
}

// ✅ GOOD: Sessions with expiration
interface Session {
  userId: string;
  createdAt: number;
  expiresAt: number; // Always include expiration
  lastActiveAt: number;
}

// ✅ GOOD: Invalidate sessions on security events
export const changePassword = mutation({
  handler: async (ctx, args) => {
    // Update password
    await ctx.db.patch(userId, { passwordHash: newHash });
    
    // Invalidate all sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
  },
});

// ✅ GOOD: Limit concurrent sessions
const MAX_SESSIONS = 5;
if (existingSessions.length >= MAX_SESSIONS) {
  // Remove oldest session
  const oldestSession = existingSessions.sort(
    (a, b) => a.createdAt - b.createdAt
  )[0];
  await ctx.db.delete(oldestSession._id);
}
```

---

## When to Use This Pattern

✅ **Use for:**
- User authentication systems requiring persistent login
- Applications with sensitive data requiring session tracking
- Multi-device access scenarios where you need to manage concurrent sessions
- Systems requiring automatic session refresh for better UX
- Applications needing audit trails of user sessions

❌ **Don't use for:**
- Stateless API authentication (use JWT tokens without session storage)
- Single-page applications with short-lived tokens only
- Public APIs where session state isn't needed

---

## Benefits

1. **Security**: Server-side validation prevents tampering, automatic invalidation on security events
2. **User Experience**: Automatic refresh keeps users logged in seamlessly
3. **Device Management**: Users can see and manage all active sessions
4. **Audit Trail**: Track session creation, activity, and termination
5. **Account Sharing Prevention**: Concurrent session limits discourage credential sharing
6. **Privacy**: IP addresses are hashed, sensitive data is protected

---

## Related Patterns

- See `auth-helpers.md` for authentication utility functions
- See `rbac-implementation.md` for role-based access control
- See `subscription-enforcement.md` for tier-based feature gating

---

*Extracted: 2026-02-18*
