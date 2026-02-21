# Error Boundaries

## Source
Extracted from BistroLens `components/ErrorBoundary.tsx`

---

## Pattern: React Error Boundaries with Multi-Level Handling

A comprehensive error boundary implementation that provides graceful error handling at multiple levels (critical, page, component) with built-in error tracking, debug mode, and specialized boundaries for different feature domains.

---

## Core Error Boundary Implementation

### Full Error Boundary Class

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
  routeName?: string; // For route-level error tracking
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  copied: boolean;
}

// Generate short event ID (8 chars)
const generateEventId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
};

// Store error events in localStorage (max 20)
const storeErrorEvent = (event: {
  eventId: string;
  route: string;
  message: string;
  stack?: string;
  timestamp: string;
}) => {
  try {
    const key = '__BISTRO_ERROR_EVENTS__';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(event);
    // Keep only last 20
    const trimmed = existing.slice(0, 20);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // localStorage may be unavailable
  }
};

// Check if debug mode is enabled via URL param
const isDebugMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === '1' || params.get('debug') === 'true';
};

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: generateEventId()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const eventId = this.state.errorId || generateEventId();
    const route = this.props.routeName || 
      (typeof window !== 'undefined' ? window.location.pathname : 'unknown');
    
    this.setState({
      errorInfo,
      errorId: eventId
    });

    // CRITICAL: Structured log line for monitoring (no PII)
    console.error(`UI_ROUTE_ERROR`, JSON.stringify({
      eventId,
      route,
      message: error.message,
      level: this.props.level || 'component',
      timestamp: new Date().toISOString()
    }));

    // Store in localStorage for debugging (last 20 events)
    storeErrorEvent({
      eventId,
      route,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Store crash info for debug mode
    try {
      sessionStorage.setItem('__LAST_CRASH__', JSON.stringify({
        type: 'react-error-boundary',
        errorId: eventId,
        level: this.props.level || 'component',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        timestamp: new Date().toISOString(),
      }));
    } catch {
      // sessionStorage may be unavailable
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      copied: false
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleCopyEventId = async () => {
    const { errorId } = this.state;
    if (!errorId) return;
    
    try {
      await navigator.clipboard.writeText(errorId);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = errorId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorId } = this.state;
      const level = this.props.level || 'component';
      const debugMode = isDebugMode();

      // Critical errors get full-page treatment
      if (level === 'critical') {
        return (
          <div className="min-h-screen bg-brand-white flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-brand-white rounded-xl shadow-lg p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
              </div>
              
              <h1 className="text-xl font-bold text-brand-black mb-2">
                Something went wrong
              </h1>
              
              <p className="text-brand-black/60 mb-6">
                We're sorry, but something unexpected happened. Our team has been notified.
              </p>

              {/* Show error details in dev mode OR debug mode */}
              {(debugMode || import.meta.env?.DEV) && error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
                  <p className="text-sm font-mono text-red-700 mb-2">{error.message}</p>
                  {errorId && (
                    <p className="text-xs text-red-600">Error ID: {errorId}</p>
                  )}
                </div>
              )}

              {/* Event ID - Always visible */}
              {errorId && (
                <div className="bg-gray-100 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Event ID (click to copy)</p>
                  <button
                    onClick={this.handleCopyEventId}
                    className="font-mono text-sm text-brand-black hover:text-brand-primary transition-colors"
                  >
                    {errorId} {this.state.copied ? '✓ Copied!' : '📋'}
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full px-4 py-2 bg-brand-primary text-brand-white rounded-lg hover:bg-brand-primary-hover transition-colors"
                >
                  Retry
                </button>

                <button
                  onClick={this.handleReload}
                  className="w-full px-4 py-2 border border-brand-black/20 text-brand-black rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Reload Page
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="w-full px-4 py-2 text-gray-500 hover:text-brand-black transition-colors"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Component-level errors get inline treatment
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-2">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-1">
                Component Error
              </h3>
              
              <p className="text-sm text-red-700 mb-2">
                This component encountered an error and couldn't render properly.
              </p>

              {errorId && (
                <button
                  onClick={this.handleCopyEventId}
                  className="text-xs font-mono text-red-600 hover:text-red-800 mb-3"
                >
                  ID: {errorId} {this.state.copied ? '✓' : '📋'}
                </button>
              )}

              <button
                onClick={this.handleRetry}
                className="text-sm text-red-700 hover:text-red-800 font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

## Higher-Order Component Pattern

### withErrorBoundary HOC

```typescript
// Higher-order component for wrapping components with error boundaries
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

## Specialized Error Boundaries

### Domain-Specific Error Boundaries

```typescript
// AI Feature Error Boundary
export const AIErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="component"
    fallback={
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-2">
        <div className="flex items-center gap-2 text-yellow-800">
          <ExclamationTriangleIcon className="w-5 h-5" />
          <span className="font-medium">AI Service Temporarily Unavailable</span>
        </div>
        <p className="text-sm text-yellow-700 mt-1">
          Please try again in a moment. You can still browse recipes and use other features.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Recipe Display Error Boundary
export const RecipeErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="component"
    fallback={
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 m-2">
        <div className="flex items-center gap-2 text-blue-800">
          <ExclamationTriangleIcon className="w-5 h-5" />
          <span className="font-medium">Recipe Display Error</span>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          There was a problem displaying this recipe. Try refreshing or generating a new one.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Navigation Error Boundary (Critical Level)
export const NavigationErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="critical"
    fallback={
      <div className="min-h-screen bg-brand-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-black mb-4">Navigation Error</h1>
          <p className="text-brand-black/60 mb-6">
            There was a problem with the app navigation. Please reload the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-brand-primary text-brand-white rounded-lg hover:bg-brand-primary-hover transition-colors"
          >
            Reload App
          </button>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Route-Specific Error Boundary
export const RouteBoundary: React.FC<{ routeName: string; children: ReactNode }> = ({ 
  routeName, 
  children 
}) => (
  <ErrorBoundary
    level="page"
    routeName={routeName}
  >
    {children}
  </ErrorBoundary>
);
```

---

## Usage Examples

### Basic Usage

```typescript
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary level="critical">
      <MainApp />
    </ErrorBoundary>
  );
}
```

### Component-Level Protection

```typescript
import { AIErrorBoundary } from './components/ErrorBoundary';

function RecipeFinder() {
  return (
    <AIErrorBoundary>
      <RecipeGeneratorAI />
    </AIErrorBoundary>
  );
}
```

### Route-Level Tracking

```typescript
import { RouteBoundary } from './components/ErrorBoundary';

function RecipePage() {
  return (
    <RouteBoundary routeName="/recipe">
      <RecipeContent />
    </RouteBoundary>
  );
}
```

### HOC Pattern

```typescript
import { withErrorBoundary } from './components/ErrorBoundary';

const RecipeCard = ({ recipe }) => {
  // Component implementation
};

// Wrap with error boundary
export default withErrorBoundary(RecipeCard, { 
  level: 'component',
  onError: (error, errorInfo) => {
    console.log('RecipeCard error:', error);
  }
});
```

### Custom Fallback

```typescript
<ErrorBoundary
  level="component"
  fallback={
    <div className="p-4 bg-gray-100 rounded">
      <p>Unable to load this section</p>
      <button onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  }
>
  <ComplexComponent />
</ErrorBoundary>
```

---

## Anti-Patterns

### ❌ Don't: Single Global Error Boundary

```typescript
// BAD: Only one error boundary at root level
function App() {
  return (
    <ErrorBoundary>
      <Header />
      <MainContent />
      <Footer />
    </ErrorBoundary>
  );
}
// Problem: One component error crashes entire app
```

### ✅ Do: Multiple Layered Boundaries

```typescript
// GOOD: Multiple boundaries at different levels
function App() {
  return (
    <ErrorBoundary level="critical">
      <Header />
      <ErrorBoundary level="page">
        <MainContent />
      </ErrorBoundary>
      <Footer />
    </ErrorBoundary>
  );
}
// Benefit: Isolated failures, rest of app continues working
```

### ❌ Don't: Ignore Error Context

```typescript
// BAD: No error tracking or context
componentDidCatch(error: Error) {
  console.log('Error happened');
  this.setState({ hasError: true });
}
```

### ✅ Do: Track Errors with Context

```typescript
// GOOD: Track errors with full context
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  const eventId = generateEventId();
  
  // Structured logging
  console.error('UI_ERROR', JSON.stringify({
    eventId,
    route: window.location.pathname,
    message: error.message,
    timestamp: new Date().toISOString()
  }));
  
  // Store for debugging
  storeErrorEvent({
    eventId,
    route: window.location.pathname,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  this.setState({ hasError: true, errorId: eventId });
}
```

### ❌ Don't: Show Technical Errors to Users

```typescript
// BAD: Exposing stack traces in production
{error && (
  <div>
    <pre>{error.stack}</pre>
  </div>
)}
```

### ✅ Do: User-Friendly Messages with Debug Mode

```typescript
// GOOD: Friendly message + debug mode for developers
{error && (
  <>
    <p>Something went wrong. Please try again.</p>
    {errorId && <p>Error ID: {errorId}</p>}
    
    {/* Only show technical details in debug mode */}
    {isDebugMode() && (
      <details>
        <summary>Technical Details</summary>
        <pre>{error.stack}</pre>
      </details>
    )}
  </>
)}
```

### ❌ Don't: Forget Recovery Actions

```typescript
// BAD: No way to recover from error
render() {
  if (this.state.hasError) {
    return <div>Error occurred</div>;
  }
  return this.props.children;
}
```

### ✅ Do: Provide Recovery Options

```typescript
// GOOD: Multiple recovery options
render() {
  if (this.state.hasError) {
    return (
      <div>
        <p>Error occurred</p>
        <button onClick={this.handleRetry}>Retry</button>
        <button onClick={this.handleReload}>Reload Page</button>
        <button onClick={this.handleGoHome}>Go Home</button>
      </div>
    );
  }
  return this.props.children;
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Wrapping entire app for critical errors
- Protecting individual features/components
- Isolating third-party components
- Wrapping async boundaries (Suspense)
- Route-level error handling
- Domain-specific error handling (AI, payments, etc.)

❌ **Don't use for:**
- Event handler errors (use try-catch)
- Async errors outside render (use .catch())
- Server-side rendering errors
- Error handling in useEffect (use try-catch)

---

## Benefits

1. **Graceful Degradation**: App continues working even when parts fail
2. **User Experience**: Friendly error messages instead of blank screens
3. **Error Tracking**: Automatic error logging with context
4. **Debug Support**: Built-in debug mode for developers
5. **Recovery Options**: Users can retry, reload, or navigate away
6. **Isolation**: Errors don't cascade to entire app
7. **Customization**: Different error UX for different features
8. **Event IDs**: Trackable error references for support
9. **Multi-Level**: Critical, page, and component-level handling
10. **Offline Support**: Errors stored in localStorage for debugging

---

## Related Patterns

- See `error-messages.md` for user-facing error message patterns
- See `retry-logic.md` for retry strategies
- See `error-logging.md` for error tracking and monitoring
- See `../02-react-patterns/suspense-patterns.md` for async error boundaries
- See `../04-ui-components/loading-states.md` for loading error states

---

*Extracted: 2026-02-18*
