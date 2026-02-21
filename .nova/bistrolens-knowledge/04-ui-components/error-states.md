# Error States

## Source
Extracted from BistroLens:
- `components/ErrorBoundary.tsx`
- `components/PublicRecipePage.tsx`
- `components/MealPrepModal.tsx`
- `components/RecipeScannerModal.tsx`
- `.kiro/steering/48-ERROR-HANDLING-UX.md`

---

## Pattern: Error State Display

Error states in BistroLens follow a user-first philosophy: never blame the user, always provide an action, and use human language. The system implements multiple error display patterns depending on the error severity and context.

---

## 1. Error Boundary Pattern (Critical Errors)

### Full-Page Error Boundary

For critical errors that prevent the entire page from rendering:

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from './Icons';
import { reportError, addBreadcrumb } from '../utils/sentry';
import { BUILD_SHA_SHORT } from '../utils/buildInfo';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
  routeName?: string;
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
    const trimmed = existing.slice(0, 20);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // localStorage may be unavailable
  }
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
    const route = this.props.routeName || (typeof window !== 'undefined' ? window.location.pathname : 'unknown');
    
    this.setState({
      errorInfo,
      errorId: eventId
    });

    // Structured log for monitoring
    console.error(`UI_ROUTE_ERROR`, JSON.stringify({
      eventId,
      route,
      message: error.message,
      level: this.props.level || 'component',
      BUILD_SHA: BUILD_SHA_SHORT,
      timestamp: new Date().toISOString()
    }));

    // Store in localStorage for debugging
    storeErrorEvent({
      eventId,
      route,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Report to error tracking service
    reportError(error, {
      errorBoundary: {
        errorId: eventId,
        level: this.props.level || 'component',
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      }
    });

    // Call custom error handler
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

              {/* Show error details in dev mode */}
              {import.meta.env?.DEV && error && (
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
                    className="font-mono text-sm text-brand-black hover:text-brand-primary transition-colors flex items-center gap-2"
                  >
                    {errorId}
                    <span className="text-xs text-gray-400">
                      {this.state.copied ? '✓ Copied!' : '📋'}
                    </span>
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full px-4 py-2 bg-brand-primary text-brand-white rounded-lg hover:bg-brand-primary-hover transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Retry
                </button>

                <button
                  onClick={this.handleReload}
                  className="w-full px-4 py-2 border border-brand-black/20 text-brand-black rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Reload Page
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="w-full px-4 py-2 text-gray-500 hover:text-brand-black transition-colors flex items-center justify-center gap-2"
                >
                  <HomeIcon className="w-4 h-4" />
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

              {/* Event ID - Always visible */}
              {errorId && (
                <button
                  onClick={this.handleCopyEventId}
                  className="text-xs font-mono text-red-600 hover:text-red-800 mb-3 flex items-center gap-1"
                >
                  ID: {errorId} {this.state.copied ? '✓' : '📋'}
                </button>
              )}

              {/* Show error details in dev mode */}
              {import.meta.env?.DEV && error && (
                <div className="bg-red-100 rounded p-2 mb-3">
                  <p className="text-xs font-mono text-red-800">{error.message}</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={this.handleRetry}
                  className="text-sm text-red-700 hover:text-red-800 font-medium flex items-center gap-1"
                >
                  <ArrowPathIcon className="w-3 h-3" />
                  Retry
                </button>
              </div>
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

## 2. Specialized Error Boundaries

### Context-Specific Error Boundaries

```typescript
// AI Service Error Boundary
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

// Navigation Error Boundary
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
```

---

## 3. Inline Error States

### Connection Error State

```typescript
// From PublicRecipePage.tsx
const PublicRecipePage: React.FC<PublicRecipePageProps> = ({ slug, onBack }) => {
  const [convexError, setConvexError] = useState<string | null>(null);

  // Fetch recipe data with error handling
  let recipeData;
  try {
    recipeData = useQuery(api.publicRecipes.getPublicRecipeBySlug, { slug });
  } catch (error) {
    console.error('Convex query error:', error);
    if (!convexError) {
      setConvexError(error instanceof Error ? error.message : 'Failed to load recipe');
    }
  }

  // Error state
  if (convexError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-brand-black mb-2">Connection Issue</h1>
        <p className="text-brand-black/60 mb-6">{convexError}</p>
        <button 
          onClick={() => { setConvexError(null); window.location.reload(); }}
          className="px-6 py-3 bg-brand-primary text-brand-on-primary font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Not found state
  if (!recipeData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-brand-black mb-2">Recipe Not Found</h1>
        <p className="text-brand-black/60 mb-6">
          This recipe may have been removed or the link is incorrect.
        </p>
        <button 
          onClick={() => { playClickSound(); onBack?.(); }}
          className="px-6 py-3 bg-brand-primary text-brand-on-primary font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
        >
          Browse All Recipes
        </button>
      </div>
    );
  }

  // ... render recipe
};
```

### Modal Error State

```typescript
// From MealPrepModal.tsx
const MealPrepModal: React.FC<MealPrepModalProps> = ({ onClose, mealPlan }) => {
  const [guide, setGuide] = useState<MealPrepGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generate = async () => {
      try {
        const result = await generateMealPrepGuide(mealPlan);
        setGuide(result);
        playSuccessSound();
      } catch (err) {
        setError("Failed to generate prep guide. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    generate();
  }, [mealPlan]);

  return (
    <Modal onClose={onClose} title="Sunday Batch Prep" size="lg">
      {isLoading ? (
        <LoadingScreen task="Analyzing your week's menu..." />
      ) : error ? (
        <div className="p-8 text-center text-red-500 font-bold">{error}</div>
      ) : guide ? (
        // ... render guide
      ) : null}
    </Modal>
  );
};
```

### Inline Error with Retry

```typescript
// From RecipeScannerModal.tsx
const RecipeScannerModal: React.FC<RecipeScannerModalProps> = ({ onClose, onRecipeScanned }) => {
  const [error, setError] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>('selection');

  const handleProcessImage = async () => {
    setScanState('loading');
    setError(null);

    try {
      const recipe = await recreateRecipeFromFoodImage(base64Data);
      playSuccessSound();
      onRecipeScanned(recipe);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to analyze image. Try again.");
      setScanState('preview');
    }
  };

  // Error display in preview state
  if (scanState === 'preview') {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex-1 bg-brand-white rounded-xl shadow-inner flex items-center justify-center overflow-hidden mb-4">
          {croppedImageUrl && <img src={croppedImageUrl} alt="Preview" className="max-w-full max-h-full object-contain"/>}
        </div>
        
        {/* Error message */}
        {error && <p className="text-red-500 text-center mb-4 text-sm font-bold">{error}</p>}
        
        <div className="flex gap-4">
          <button 
            onClick={() => { 
              playClickSound(); 
              setScanState('camera'); 
            }} 
            className="flex-1 py-3 text-sm font-bold rounded-full border border-brand-black/20 hover:bg-brand-white"
          >
            Retake
          </button>
          <button 
            onClick={handleProcessImage} 
            className="flex-1 py-3 text-sm font-bold rounded-full bg-brand-primary text-brand-white hover:bg-brand-primary-hover shadow-lg"
          >
            Analyze
          </button>
        </div>
      </div>
    );
  }
};
```

---

## 4. Error Message Patterns

### User-Facing Error Messages

```typescript
// From 48-ERROR-HANDLING-UX.md
const ERROR_MESSAGES = {
  // Network errors
  offline: {
    title: "You're offline",
    message: "Check your internet connection and try again.",
    action: { label: "Retry", handler: 'retry' },
    icon: 'wifi-off',
  },
  
  timeout: {
    title: "Taking too long",
    message: "This is taking longer than expected. Want to try again?",
    action: { label: "Try Again", handler: 'retry' },
    secondary: { label: "Cancel", handler: 'cancel' },
    icon: 'clock',
  },
  
  serverError: {
    title: "Something went wrong",
    message: "We're having some technical difficulties. Please try again in a moment.",
    action: { label: "Try Again", handler: 'retry' },
    icon: 'alert-circle',
  },
  
  // Auth errors
  sessionExpired: {
    title: "Session expired",
    message: "Please sign in again to continue.",
    action: { label: "Sign In", handler: 'login' },
    icon: 'log-in',
  },
  
  // Generation errors
  generationFailed: {
    title: "Couldn't create that",
    message: "We had trouble generating your recipe. Try a different request?",
    action: { label: "Try Again", handler: 'retry' },
    secondary: { label: "Browse Recipes", handler: 'browse' },
    icon: 'refresh-cw',
  },
  
  contentFiltered: {
    title: "Can't create that",
    message: "We couldn't create that content. Try a different request.",
    action: { label: "New Request", handler: 'clear' },
    icon: 'shield',
  },
};

// Message guidelines
const MESSAGE_GUIDELINES = {
  titleMaxLength: 30,
  messageMaxLength: 100,
  useContractions: true,        // "We're" not "We are"
  useActiveVoice: true,         // "Try again" not "The action can be retried"
  avoidTechnicalTerms: true,    // "Something went wrong" not "500 Internal Server Error"
  alwaysHaveAction: true,
  maxActions: 2,
  primaryActionFirst: true,
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// DON'T: Blame the user
<div className="error">
  <p>You entered invalid data</p>
</div>

// DON'T: Use technical jargon
<div className="error">
  <p>500 Internal Server Error</p>
  <p>Stack trace: TypeError at line 42...</p>
</div>

// DON'T: Provide no action
<div className="error">
  <p>Something went wrong</p>
  {/* No button to retry or recover */}
</div>

// DON'T: Hide errors silently
try {
  await generateRecipe();
} catch (error) {
  // Silent failure - user has no idea what happened
}

// DON'T: Show raw error messages
<div className="error">
  <p>{error.message}</p> {/* Could be "Cannot read property 'map' of undefined" */}
</div>
```

### ✅ Do This Instead

```typescript
// DO: Use friendly language
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <p className="text-red-800">Please check your input and try again</p>
</div>

// DO: Translate technical errors
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <h3 className="font-medium text-red-800">Something went wrong</h3>
  <p className="text-red-700">We're having technical difficulties. Please try again.</p>
</div>

// DO: Always provide an action
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <p className="text-red-800 mb-3">We couldn't load your recipes</p>
  <button 
    onClick={handleRetry}
    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
  >
    Try Again
  </button>
</div>

// DO: Show user-friendly errors
try {
  await generateRecipe();
} catch (error) {
  setError("We couldn't generate your recipe. Please try again.");
  // Log technical details for debugging
  console.error('Recipe generation failed:', error);
}

// DO: Translate error messages
const getUserFriendlyError = (error: Error): string => {
  if (error.message.includes('network')) {
    return "Check your internet connection and try again";
  }
  if (error.message.includes('timeout')) {
    return "This is taking too long. Please try again";
  }
  return "Something went wrong. Please try again";
};

<div className="error">
  <p>{getUserFriendlyError(error)}</p>
</div>
```

---

## When to Use This Pattern

✅ **Use for:**
- Critical application errors that prevent rendering
- Component-level errors that affect a specific feature
- Network/connection errors
- API failures
- Generation/processing errors
- Not found states
- Permission/auth errors

❌ **Don't use for:**
- Form validation errors (use inline field validation)
- Expected empty states (use empty state pattern)
- Loading states (use loading pattern)
- Success messages (use toast notifications)

---

## Benefits

1. **User-First Experience**: Never blames users, always provides next steps
2. **Graceful Degradation**: App continues to function even when parts fail
3. **Debugging Support**: Event IDs and structured logging help track issues
4. **Recovery Options**: Multiple ways to recover (retry, reload, go home)
5. **Context-Aware**: Different error displays for different severity levels
6. **Transparent**: Honest about issues while maintaining user confidence
7. **Actionable**: Always provides clear next steps for users

---

## Related Patterns

- See `loading-states.md` for loading state patterns
- See `empty-states.md` for empty state patterns
- See `toast-notifications.md` for success/info messages
- See `form-components.md` for form validation errors

---

*Extracted: 2026-02-18*
