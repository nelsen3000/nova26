# VENUS Style Guide - Frontend Components

> Standards and conventions for React/frontend code generation

---

## Component Structure

Components must follow this exact order:

```tsx
// 1. Imports (in this order)
import { useState, useEffect } from "react";                    // React
import { useQuery } from "convex/react";                        // Convex
import { Button, Card, Badge } from "@/components/ui/button";  // shadcn/ui
import { motion } from "framer-motion";                         // Animation
import { useUserData } from "@/hooks/useUserData";             // Internal hooks
import type { User } from "@/types";                           // Types

// 2. Types/Interfaces
interface UserProfileCardProps {
  userId: string;
  editable?: boolean;
  onUpdate?: (user: User) => void;
}

// 3. Helper functions/hooks (if needed)
function formatUserName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

// 4. Main component
export function UserProfileCard({ userId, editable, onUpdate }: UserProfileCardProps) {
  // Component implementation
}

// 5. Exports (named only - no default exports)
export type { UserProfileCardProps };
```

---

## Naming Conventions

| Element | Convention | Example | Bad Example |
|---------|------------|---------|-------------|
| **Components** | PascalCase | `UserProfileCard` | `userProfileCard`, `user_profile_card` |
| **Hooks** | camelCase with `use` prefix | `useUserData` | `userData`, `getUserData` |
| **Event Handlers** | `handle` + Event | `handleSubmit`, `handleClick` | `onSubmit`, `clickHandler` |
| **Boolean Props** | `is`, `has`, `should` prefix | `isLoading`, `hasError` | `loading`, `error` |
| **Callback Props** | `on` + Action | `onUpdate`, `onDelete` | `update`, `deleteHandler` |
| **Files** | PascalCase (matches component) | `UserProfileCard.tsx` | `user-profile-card.tsx` |

---

## Forbidden Patterns

These will cause immediate SEVERE gate failures:

- ❌ **Inline styles** - `style={{ color: 'red' }}`
- ❌ **console.log** in production code
- ❌ **Magic numbers** - use named constants
- ❌ **Nested ternaries** beyond 2 levels
- ❌ **Default exports** - use named exports only
- ❌ **Class components** - React 19 hooks only
- ❌ **Any type** - proper TypeScript types required

---

## Required Patterns

These are mandatory for all VENUS outputs:

### 1. Five UI States (MANDATORY)

Every component must handle all 5 states:

```tsx
export function DataComponent({ id }: { id: string }) {
  const data = useQuery(api.data.get, { id });
  const [error, setError] = useState<Error | null>(null);
  
  // 1. LOADING STATE
  if (data === undefined) {
    return <Skeleton variant="card" count={3} />;
  }
  
  // 2. ERROR STATE
  if (error) {
    return (
      <ErrorState 
        message={error.message} 
        onRetry={() => refetch()} 
      />
    );
  }
  
  // 3. EMPTY STATE
  if (data === null || data.length === 0) {
    return (
      <EmptyState 
        title="No data found"
        action={{ label: "Create New", onClick: () => {} }}
      />
    );
  }
  
  // 4. PARTIAL STATE (if applicable)
  if (data.partial) {
    return (
      <PartialState data={data.available}>
        <DataView data={data.available} />
      </PartialState>
    );
  }
  
  // 5. POPULATED STATE
  return <DataView data={data} />;
}
```

### 2. Mobile-First Responsive Design

Always use mobile-first approach:

```tsx
// ✅ GOOD - Mobile first, enhance for larger screens
<div className="w-full p-4 md:p-6 lg:p-8">

// ❌ BAD - Desktop first, reduce for mobile  
<div className="p-8 md:p-6 lg:p-4">
```

### 3. Accessibility Requirements

- Touch targets minimum **44×44px**
- All interactive elements need `aria-label` or visible text
- Keyboard navigation must work
- Focus states must be visible
- Color contrast meets WCAG 2.1 AA

```tsx
// ✅ GOOD
<button 
  aria-label="Delete user"
  className="h-11 min-w-11"  // 44px minimum
>
  <TrashIcon />
</button>

// ❌ BAD
<button className="p-1">  // Too small
  <TrashIcon />
</button>
```

### 4. Convex Data Fetching

Use standard patterns:

```tsx
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UserList() {
  // ✅ GOOD - useQuery with generated API
  const users = useQuery(api.users.list, {});
  
  // ❌ BAD - Direct fetch calls
  const users = await fetch("/api/users");
}
```

---

## Styling Standards

### Tailwind CSS Order

Order classes by category:

```tsx
<div className="
  /* Layout */
  flex flex-col items-center justify-between
  /* Spacing */
  p-4 md:p-6 gap-4
  /* Sizing */
  w-full max-w-md min-h-screen
  /* Typography */
  text-base font-medium text-foreground
  /* Visual */
  bg-card rounded-lg border shadow-sm
  /* Interactivity */
  hover:bg-accent cursor-pointer
  /* Animation */
  transition-colors duration-200
">
```

### Color Tokens (MANDATORY)

Use semantic color tokens, never hardcoded colors:

| Purpose | Token | Bad |
|---------|-------|-----|
| Background | `bg-card`, `bg-background` | `bg-white`, `bg-gray-100` |
| Text | `text-foreground`, `text-muted-foreground` | `text-black`, `text-gray-600` |
| Primary | `bg-primary`, `text-primary-foreground` | `bg-blue-500` |
| Borders | `border-border` | `border-gray-200` |

### Animation Standards

Use framer-motion for animations:

```tsx
import { motion } from "framer-motion";

// Standard fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }}
>

// Standard slide up
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>

// Stagger children
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};
```

---

## Self-Check Before Responding

Before marking VENUS task complete, verify:

### Code Quality
- [ ] No TypeScript `any` types used
- [ ] No `console.log` statements
- [ ] All imports are used (no dead code)
- [ ] Named exports only (no default exports)

### UI States
- [ ] All 5 UI states handled with real implementation
- [ ] Loading state shows skeleton or spinner
- [ ] Error state includes retry action
- [ ] Empty state includes helpful CTA

### Styling
- [ ] Mobile-first responsive classes applied
- [ ] Touch targets minimum 44×44px
- [ ] ARIA labels on interactive elements
- [ ] Semantic color tokens used (no hardcoded colors)
- [ ] Tailwind classes ordered by category

### Integration
- [ ] Component props match PLUTO schema types
- [ ] Convex queries use generated API types
- [ ] Error boundaries considered for data fetching
- [ ] No hardcoded values that should be props/config

If any check fails, fix before MERCURY review.

---

## Output Format

VENUS must output:

```markdown
## Component: {ComponentName}

### Props Interface
[TypeScript interface definition]

### UI States Handled
- [x] Loading - [description]
- [x] Empty - [description]  
- [x] Error - [description]
- [x] Partial - [description or N/A]
- [x] Populated - [description]

### Implementation
\`\`\`tsx
[Full component code]
\`\`\`

### Usage Example
\`\`\`tsx
[Example usage]
\`\`\`
```
