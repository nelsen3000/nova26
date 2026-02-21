# RBAC Implementation

## Source
Extracted from BistroLens `.kiro/steering/39-AUTHENTICATION-AUTHORIZATION.md` (Section 3)

---

## Pattern: Role-Based Access Control (RBAC)

Implement hierarchical role-based access control with permission matrices and server-side enforcement. This pattern ensures users can only access features and data appropriate to their role level.

---

## User Roles

BistroLens defines a clear role hierarchy from basic users to administrators:

| Role | Description | Permissions |
|------|-------------|-------------|
| `user` | Standard user | Own data CRUD |
| `premium` | Paid subscriber | + Premium features |
| `chef_master` | Top tier | + All features |
| `moderator` | Content mod | + Review UGC |
| `admin` | Full access | + System management |

---

## Permission Matrix

Define explicit permissions for each role across all actions:

| Action | User | Premium | Chef Master | Moderator | Admin |
|--------|------|---------|-------------|-----------|-------|
| View own recipes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Generate recipes | 3/day | 25/day | 50/day | 25/day | ∞ |
| Live Chef | 1×5min | ❌ | 20×15min | ❌ | ∞ |
| View all users | ❌ | ❌ | ❌ | ✅ | ✅ |
| Moderate content | ❌ | ❌ | ❌ | ✅ | ✅ |
| System settings | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Role Hierarchy Implementation

### Code Example

```typescript
// convex/lib/permissions.ts
export const ROLE_HIERARCHY = {
  user: 0,
  premium: 1,
  chef_master: 2,
  moderator: 3,
  admin: 4,
} as const;

export type UserRole = keyof typeof ROLE_HIERARCHY;

/**
 * Check if user's role meets or exceeds required role
 * @param userRole - The user's current role
 * @param requiredRole - The minimum role required
 * @returns true if user has sufficient permissions
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Require a specific role or throw error
 * Use this in mutations/queries to enforce role requirements
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  requiredRole: UserRole
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  
  const user = await getUserByIdentity(ctx, identity);
  if (!hasRole(user.role, requiredRole)) {
    throw new Error(`Requires ${requiredRole} role`);
  }
  
  return { identity, user };
}
```

---

## Usage in Mutations

### Code Example

```typescript
// convex/admin/users.ts
import { mutation } from "../_generated/server";
import { requireRole } from "../lib/permissions";
import { v } from "convex/values";

/**
 * Admin-only mutation to update user roles
 */
export const updateUserRole = mutation({
  args: {
    targetUserId: v.id("users"),
    newRole: v.union(
      v.literal("user"),
      v.literal("premium"),
      v.literal("chef_master"),
      v.literal("moderator"),
      v.literal("admin")
    ),
  },
  handler: async (ctx, args) => {
    // Enforce admin role requirement
    const { user: adminUser } = await requireRole(ctx, "admin");
    
    // Get target user
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      throw new Error("User not found");
    }
    
    // Prevent self-demotion
    if (targetUser._id === adminUser._id && args.newRole !== "admin") {
      throw new Error("Cannot demote yourself");
    }
    
    // Update role
    await ctx.db.patch(args.targetUserId, {
      role: args.newRole,
    });
    
    // Audit log
    await ctx.db.insert("auditLogs", {
      eventType: "role_change",
      severity: "high",
      userId: adminUser._id,
      targetUserId: args.targetUserId,
      details: {
        oldRole: targetUser.role,
        newRole: args.newRole,
      },
      timestamp: Date.now(),
    });
    
    return { success: true };
  },
});
```

---

## Usage in Queries

### Code Example

```typescript
// convex/moderation/reports.ts
import { query } from "../_generated/server";
import { requireRole } from "../lib/permissions";

/**
 * Moderator-only query to view all user reports
 */
export const getAllReports = query({
  args: {},
  handler: async (ctx) => {
    // Enforce moderator role requirement
    await requireRole(ctx, "moderator");
    
    // Fetch all reports
    const reports = await ctx.db
      .query("reports")
      .order("desc")
      .take(100);
    
    return reports;
  },
});
```

---

## Client-Side Role Checks

### Code Example

```typescript
// hooks/useRole.ts
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { ROLE_HIERARCHY, type UserRole } from "../convex/lib/permissions";

/**
 * Hook to check if current user has required role
 */
export function useRole(requiredRole: UserRole) {
  const currentUser = useQuery(api.users.getCurrentUser);
  
  if (!currentUser) {
    return {
      hasRole: false,
      loading: true,
      userRole: null,
    };
  }
  
  const hasRole = ROLE_HIERARCHY[currentUser.role] >= ROLE_HIERARCHY[requiredRole];
  
  return {
    hasRole,
    loading: false,
    userRole: currentUser.role,
  };
}

// Usage in component
function AdminPanel() {
  const { hasRole, loading } = useRole("admin");
  
  if (loading) return <Spinner />;
  if (!hasRole) return <AccessDenied />;
  
  return <AdminDashboard />;
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// BAD: Client-only role checks
function AdminButton() {
  const user = useCurrentUser();
  
  // ❌ Client can be manipulated
  if (user.role === "admin") {
    return <button onClick={deleteAllUsers}>Delete All</button>;
  }
}

// BAD: No role validation on server
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // ❌ Anyone can call this!
    await ctx.db.delete(args.userId);
  },
});

// BAD: String comparison instead of hierarchy
function hasPermission(userRole: string, requiredRole: string) {
  // ❌ "moderator" !== "admin" but moderator should have user permissions
  return userRole === requiredRole;
}
```

### ✅ Do This Instead

```typescript
// GOOD: Server-side enforcement
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // ✅ Always validate on server
    await requireRole(ctx, "admin");
    await ctx.db.delete(args.userId);
  },
});

// GOOD: Hierarchical role checks
function hasPermission(userRole: UserRole, requiredRole: UserRole) {
  // ✅ Checks hierarchy: admin >= moderator >= premium >= user
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// GOOD: Client checks for UI only, server enforces
function AdminButton() {
  const { hasRole } = useRole("admin");
  const deleteUser = useMutation(api.admin.deleteUser);
  
  // ✅ Hide UI for non-admins
  if (!hasRole) return null;
  
  // ✅ Server will still validate
  return <button onClick={() => deleteUser({ userId })}>Delete</button>;
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Multi-tenant applications with different user types
- Applications with administrative functions
- Systems requiring content moderation
- Subscription-based features with tiered access
- Any application where users have different permission levels

❌ **Don't use for:**
- Simple apps with only one user type
- Public-only content (no auth needed)
- Attribute-based access control (ABAC) requirements (use ABAC pattern instead)

---

## Benefits

1. **Security**: Server-side enforcement prevents unauthorized access
2. **Scalability**: Easy to add new roles without changing existing code
3. **Clarity**: Permission matrix makes access rules explicit
4. **Maintainability**: Centralized role logic in one place
5. **Auditability**: Role changes can be logged for compliance
6. **Flexibility**: Hierarchical system allows role inheritance

---

## Related Patterns

- See `session-management.md` for authentication context
- See `subscription-enforcement.md` for tier-based feature gates
- See `auth-helpers.md` for user identity utilities
- See `age-verification.md` for content-specific access control

---

*Extracted: 2026-02-18*
