# CHARON Style Guide - Error UX Patterns

> Standards for error states, fallback screens, empty states, and recovery flows

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Error components | `Error[Type].tsx` | `ErrorDisplay.tsx` |
| Error messages | `[domain]-errors.ts` | `auth-errors.ts` |
| Error flows | `error-recovery-[flow].md` | `error-recovery-payment.md` |
| Empty states | `Empty[Entity]State.tsx` | `EmptyCompanyState.tsx` |
| Loading states | `Loading[Entity]State.tsx` | `LoadingDashboardState.tsx` |
| Error config | `error-config.ts` | `error-thresholds.ts` |

---

## Error Severity Levels

```typescript
export type ErrorSeverity = "critical" | "error" | "warning" | "info";

export interface ErrorConfig {
  severity: ErrorSeverity;
  title: string;
  message: string;
  actions?: ErrorAction[];
  autoDismiss?: boolean;
  dismissDelay?: number;
}

export interface ErrorAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "outline";
  icon?: LucideIcon;
}
```

---

## Error Display Component Pattern

```typescript
interface ErrorDisplayProps {
  title: string;
  message: string;
  code?: string;
  severity?: ErrorSeverity;
  actions?: ErrorAction[];
  onRetry?: () => void;
}

export function ErrorDisplay({
  title,
  message,
  code,
  severity = "error",
  actions,
  onRetry,
}: ErrorDisplayProps) {
  return (
    <Card className="border-destructive">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <h3 className="font-medium text-destructive">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
            {code && (
              <code className="text-xs bg-muted px-2 py-1 rounded mt-2">
                Error: {code}
              </code>
            )}
          </div>
          <div className="flex gap-2">
            {onRetry && (
              <Button onClick={onRetry} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            {actions?.map((action) => (
              <Button key={action.label} onClick={action.onClick} variant={action.variant}>
                {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Error Boundary Pattern (Convex Compatible)

```typescript
// WARNING: NEVER use TanStack Query error handling - Convex has different patterns

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error!, this.reset);
      }
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

---

## Empty State Pattern

```typescript
interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon className="h-12 w-12 text-muted-foreground mb-4" />}
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-6">
          <Plus className="mr-2 h-4 w-4" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

---

## Loading State Pattern (Skeleton)

```typescript
interface LoadingStateProps {
  count?: number;
  variant?: "card" | "list" | "table" | "form";
}

export function LoadingState({ count = 3, variant = "list" }: LoadingStateProps) {
  if (variant === "card") {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  // List variant
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
```

---

## Error Message Templates

```typescript
// auth-errors.ts
export const AUTH_ERRORS = {
  NOT_AUTHENTICATED: {
    title: "Authentication Required",
    message: "Please sign in to access this feature.",
    severity: "warning" as const,
  },
  PERMISSION_DENIED: {
    title: "Access Denied",
    message: "You don't have permission to perform this action.",
    severity: "error" as const,
  },
  SESSION_EXPIRED: {
    title: "Session Expired",
    message: "Your session has expired. Please sign in again.",
    severity: "warning" as const,
    actions: [{ label: "Sign In", variant: "primary" as const }],
  },
};

// network-errors.ts
export const NETWORK_ERRORS = {
  CONNECTION_LOST: {
    title: "Connection Lost",
    message: "Please check your internet connection and try again.",
    severity: "error" as const,
  },
  TIMEOUT: {
    title: "Request Timeout",
    message: "The request took too long. Please try again.",
    severity: "warning" as const,
  },
};
```

---

## Quality Checklist (20 items)

### Error Display (5)
- [ ] Clear error title (not "Error")
- [ ] Actionable message (not just "Something went wrong")
- [ ] Error code for support (if applicable)
- [ ] Retry action provided where possible
- [ ] Appropriate severity styling

### Error Boundaries (5)
- [ ] Wrap data-fetching components
- [ ] Provide reset functionality
- [ ] Log errors for debugging
- [ ] Graceful fallback UI
- [ ] No raw error messages to users

### Empty States (5)
- [ ] Contextual icon
- [ ] Clear "what's empty" explanation
- [ ] CTA to populate (if applicable)
- [ ] Helpful next steps
- [ ] Consistent with brand voice

### Loading States (5)
- [ ] Skeleton matching content shape
- [ ] Multiple variants (card/list/table)
- [ ] Accessible (aria-busy)
- [ ] No layout shift
- [ ] Timeout handling (don't load forever)

---

## Self-Check Before Responding

- [ ] Using Convex error patterns (not TanStack Query)
- [ ] Error messages are actionable
- [ ] Retry functionality provided where appropriate
- [ ] Error codes included for support
- [ ] Loading states use Skeleton components
- [ ] Empty states have clear CTAs
- [ ] Error boundaries catch and handle gracefully
- [ ] All user-facing text is clear and helpful
