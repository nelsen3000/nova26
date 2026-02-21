# Error Boundary Patterns

## Source
Extracted from BistroLens `components/ErrorBoundary.tsx`, `App.tsx`

---

## Pattern: Class-Based Error Boundary with Levels

BistroLens implements a single `ErrorBoundary` class component that handles errors at different severity levels (`component`, `page`, `critical`), with specialized wrapper components for common use cases.

---

## Core ErrorBoundary Class

### Code Example

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { reportError, addBreadcrumb } from '../utils/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;           // Custom fallback UI
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
  routeName?: string;             // For route-level error attribution
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  copied: boolean;
}

// Generate short event ID for support reference
const generateEventId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
};

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      copied: false,
    };
  }

  // Called during render when a child throws — update state to show fallback
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: generateEventId(),
    };
  }

  // Called after render — log the error, report to services
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const eventId = this.state.errorId || generateEventId();
    const route = this.props.routeName || window.location.pathname;

    // Structured log for monitoring (no PII)
    console.error('UI_ROUTE_ERROR', JSON.stringify({
      eventId,
      route,
      message: error.message,
      level: this.props.level || 'component',
      timestamp: new Date().toISOString(),
    }));

    // Store in localStorage for debugging (last 20 events)
    try {
      const key = '__BISTRO_ERROR_EVENTS__';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift({ eventId, route, message: error.message, timestamp: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
    } catch { /* localStorage may be unavailable */ }

    // Report to Sentry
    reportError(error, {
      errorBoundary: {
        eventId,
        level: this.props.level || 'component',
        componentStack: errorInfo.componentStack,
        url: window.location.href,
      },
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const level = this.props.level || 'component';

      // Critical errors — full page treatment
      if (level === 'critical') {
        return (
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
              <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
              <p className="text-gray-600 mb-6">
                We're sorry, but something unexpected happened. Our team has been notified.
              </p>
              {this.state.errorId && (
                <div className="bg-gray-100 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Event ID</p>
                  <p className="font-mono text-sm">{this.state.errorId}</p>
                </div>
              )}
              <button onClick={this.handleRetry} className="w-full px-4 py-2 bg-primary text-white rounded-lg">
                Retry
              </button>
              <button onClick={() => window.location.reload()} className="w-full px-4 py-2 border rounded-lg mt-2">
                Reload Page
              </button>
            </div>
          </div>
        );
      }

      // Component-level errors — inline treatment
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-2">
          <h3 className="text-sm font-medium text-red-800 mb-1">Component Error</h3>
          <p className="text-sm text-red-700 mb-2">
            This component encountered an error and couldn't render properly.
          </p>
          <button onClick={this.handleRetry} className="text-sm text-red-700 font-medium">
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

## Higher-Order Component Wrapper

```typescript
// Wrap any component with an error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Usage
const SafeRecipeCard = withErrorBoundary(RecipeCard, { level: 'component' });
```

---

## Specialized Boundary Components

BistroLens creates named boundaries for common use cases:

```typescript
// AI features — friendly message when AI service is down
export const AIErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="component"
    fallback={
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-2">
        <span className="font-medium text-yellow-800">AI Service Temporarily Unavailable</span>
        <p className="text-sm text-yellow-700 mt-1">
          Please try again in a moment. You can still browse recipes.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Recipe display errors
export const RecipeErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="component"
    fallback={
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 m-2">
        <span className="font-medium text-blue-800">Recipe Display Error</span>
        <p className="text-sm text-blue-700 mt-1">
          Try refreshing or generating a new recipe.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Navigation — critical level, full page fallback
export const NavigationErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="critical"
    fallback={
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Navigation Error</h1>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-primary text-white rounded-lg">
            Reload App
          </button>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Route-level boundary with attribution
export const RouteBoundary: React.FC<{ routeName: string; children: ReactNode }> = ({ routeName, children }) => (
  <ErrorBoundary level="page" routeName={routeName}>
    {children}
  </ErrorBoundary>
);
```

---

## Usage in App.tsx

```typescript
// Wrap the entire app navigation
<NavigationErrorBoundary>
  <Suspense fallback={<LoadingScreen task="Setting the table..." />}>
    <ViewTransition viewKey={currentView}>
      <RouteBoundary routeName={currentView}>
        {/* route content */}
      </RouteBoundary>
    </ViewTransition>
  </Suspense>
</NavigationErrorBoundary>

// Wrap AI-powered features
<AIErrorBoundary>
  <LazyCookingView recipe={recipe} />
</AIErrorBoundary>

// Wrap with Suspense for lazy-loaded components
<Suspense fallback={<LoadingScreen task="Preparing kitchen..." />}>
  <AIErrorBoundary>
    <LazyCookingView recipe={recipe} />
  </AIErrorBoundary>
</Suspense>
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Functional component as error boundary — won't work
const ErrorBoundary: React.FC = ({ children }) => {
  // ❌ Can't use getDerivedStateFromError or componentDidCatch in function components
  return <>{children}</>;
};

// One giant boundary for the whole app — too coarse
<ErrorBoundary>
  <EntireApp /> {/* ❌ one error crashes everything */}
</ErrorBoundary>

// No error boundary at all
<LazyComponent /> {/* ❌ unhandled errors crash the whole tree */}
```

### ✅ Do This Instead

```typescript
// Class component is required for error boundaries
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error) { /* ... */ }
  componentDidCatch(error: Error, info: ErrorInfo) { /* ... */ }
  render() { /* ... */ }
}

// Granular boundaries at different levels
<NavigationErrorBoundary>        {/* critical — full page */}
  <RouteBoundary routeName="finder">  {/* page — route level */}
    <AIErrorBoundary>            {/* component — AI features */}
      <RecipeGenerator />
    </AIErrorBoundary>
  </RouteBoundary>
</NavigationErrorBoundary>
```

---

## When to Use This Pattern

✅ **Use error boundaries for:**
- Lazy-loaded components (always wrap with Suspense + ErrorBoundary)
- AI/external service integrations (can fail unpredictably)
- Route-level components (isolate page crashes)
- Third-party components you don't control

❌ **Don't use error boundaries for:**
- Event handler errors (use try/catch instead)
- Async errors outside render (use try/catch + error state)
- Server-side rendering errors

---

## Benefits

1. Prevents one broken component from crashing the entire app
2. Level-based fallbacks provide appropriate UX for each severity
3. Event IDs give users a reference for support tickets
4. Sentry integration ensures errors are tracked in production
5. `withErrorBoundary` HOC makes it easy to protect any component

---

## Related Patterns

- See `suspense-patterns.md` for combining Suspense with ErrorBoundary
- See `../07-error-handling/error-messages.md` in `07-error-handling/` for error message UX
- See `../07-error-handling/error-logging.md` in `07-error-handling/` for Sentry integration details

---

*Extracted: 2026-02-18*
