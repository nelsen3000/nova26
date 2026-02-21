# Retry Logic Patterns

## Source
Extracted from BistroLens:
- `utils/resilience.ts` - Generic retry wrapper with exponential backoff
- `components/ErrorBoundary.tsx` - UI retry patterns for React errors
- `.nova/reference-components/DataTable.reference.tsx` - Data fetching retry
- `.nova/reference-components/DashboardCard.reference.tsx` - Metric refresh retry
- `api/stripe/webhook.ts` - Webhook retry strategy with HTTP status codes

---

## Pattern 1: Generic Retry Wrapper with Exponential Backoff

### Description
A reusable retry wrapper that handles transient failures with exponential backoff and jitter to prevent thundering herd problems.

### Code Example

```typescript
/**
 * Generic retry wrapper with exponential backoff
 * Handles API instability, rate limiting, and transient errors
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            // Check if error is fatal (e.g., 400 Bad Request, 401 Unauthorized)
            // We only retry transient errors (503, 429, network issues)
            const status = error?.status || error?.response?.status;
            if (status && (status >= 400 && status < 500 && status !== 429)) {
                throw error; // Don't retry client errors (except rate limits)
            }

            // Calculate delay with jitter to prevent thundering herd
            const delay = baseDelay * Math.pow(2, attempt) + (Math.random() * 100);
            
            console.warn(
                `[Resilience] Operation failed (Attempt ${attempt + 1}/${maxRetries}). ` +
                `Retrying in ${Math.round(delay)}ms...`, 
                error.message
            );
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError; // All retries exhausted
}
```

### Usage Example

```typescript
import { withRetry } from '../utils/resilience';

// Wrap AI API calls with retry logic
export const generateRecipe = async (params: RecipeParams): Promise<Recipe> => {
    return withRetry(async () => {
        const ai = createAiClient();
        const response = await ai.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ role: 'user', parts: [{ text: params.prompt }] }]
        });
        return parseRecipeResponse(response);
    });
};

// Wrap database mutations with retry
export const saveRecipe = async (recipe: Recipe): Promise<Id<'recipes'>> => {
    return withRetry(
        async () => await db.insert('recipes', recipe),
        3,  // maxRetries
        500 // baseDelay in ms
    );
};
```

---

## Pattern 2: React Error Boundary with Retry

### Description
Error boundary component that catches React errors and provides retry functionality with state reset.

### Code Example

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ArrowPathIcon } from './Icons';

interface Props {
  children: ReactNode;
  level?: 'page' | 'component' | 'critical';
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with context
    console.error('[ErrorBoundary] Component crashed:', {
      errorId: this.state.errorId,
      level: this.props.level || 'component',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorId } = this.state;
      const level = this.props.level || 'component';

      // Critical errors get full-page treatment
      if (level === 'critical') {
        return (
          <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
              <h1 className="text-xl font-bold text-black mb-2">
                Something went wrong
              </h1>
              
              <p className="text-gray-600 mb-6">
                We're sorry, but something unexpected happened. Our team has been notified.
              </p>

              {errorId && (
                <div className="bg-gray-100 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Error ID</p>
                  <p className="font-mono text-sm text-black">{errorId}</p>
                </div>
              )}

              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        );
      }

      // Component-level errors get inline treatment
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-2">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-1">
                Component Error
              </h3>
              
              <p className="text-sm text-red-700 mb-2">
                This component encountered an error and couldn't render properly.
              </p>

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
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

## Pattern 3: Data Fetching Retry with Loading State

### Description
Retry pattern for data fetching failures with loading state management and user feedback.

### Code Example

```typescript
import { useState, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

export function DataTable() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Convex query with automatic retry
  const users = useQuery(api.users.list);

  const handleRetry = useCallback(async () => {
    setIsRefreshing(true);
    // Trigger re-fetch by invalidating query
    await new Promise(resolve => setTimeout(resolve, 500));
    window.location.reload(); // Force full refresh
  }, []);

  // ERROR STATE: Show retry button
  if (users === null) {
    return (
      <div className="border border-red-200 rounded-lg p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-red-100 p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Failed to load data
          </h3>
          
          <p className="text-sm text-gray-600 mb-6 max-w-sm">
            There was an error loading the data. Please try again.
          </p>
          
          <Button
            variant="outline"
            onClick={handleRetry}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // LOADING STATE
  if (users === undefined) {
    return <div>Loading...</div>;
  }

  // SUCCESS STATE
  return <div>{/* Render data */}</div>;
}
```

---

## Pattern 4: Manual Refresh with Optimistic UI

### Description
User-triggered refresh with optimistic UI updates and loading indicators.

### Code Example

```typescript
import { useState, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function DashboardCard({ metricKey }: { metricKey: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const metric = useQuery(api.metrics.get, { key: metricKey });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    try {
      // In real app, would invalidate query cache
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Optionally show success feedback
      console.log('Data refreshed successfully');
    } catch (error) {
      console.error('Refresh failed:', error);
      // Show error toast
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Metric</h3>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh data"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {metric && <div>{metric.value}</div>}
    </div>
  );
}
```

---

## Pattern 5: Webhook Retry Strategy with HTTP Status Codes

### Description
Server-side retry strategy using HTTP status codes to control webhook retry behavior.

### Code Example

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Configuration error - don't retry (500)
  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ 
      error: 'Webhook secret not configured',
      code: 'WEBHOOK_SECRET_MISSING'
    });
  }

  // Missing signature - client error, don't retry (400)
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    console.error('[Webhook] Missing stripe-signature header');
    return res.status(400).json({ 
      error: 'Missing stripe-signature header',
      code: 'SIGNATURE_HEADER_MISSING'
    });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    // Signature verification failed - client error, don't retry (400)
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ 
      error: 'Webhook signature verification failed',
      code: 'SIGNATURE_VERIFICATION_FAILED'
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      default:
        // Unknown event type - acknowledge without retry (200)
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    // Success - don't retry (200)
    return res.status(200).json({ received: true });
    
  } catch (error: any) {
    // Transient failure - trigger Stripe retry (500)
    console.error('[Webhook] Handler error:', {
      error: error.message,
      eventType: event.type,
      eventId: event.id
    });
    return res.status(500).json({ 
      error: error.message,
      code: 'WEBHOOK_HANDLER_ERROR'
    });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;

  // Missing userId - data error, don't retry (return without throwing)
  if (!userId) {
    console.error('[Webhook] No userId in session metadata');
    return; // Returns 200, won't trigger retry
  }

  try {
    // Database operation that might fail transiently
    await convex.mutation('subscriptions:upsertSubscription', {
      userId,
      tier: 'premium',
      status: 'active'
    });
  } catch (error: any) {
    console.error('[Webhook] Failed to upsert subscription:', error.message);
    throw error; // Re-throw to trigger retry (returns 500)
  }
}
```

### HTTP Status Code Strategy

```typescript
// Retry Strategy Guide:

// 200 OK - Success, don't retry
return res.status(200).json({ received: true });

// 400 Bad Request - Client error, don't retry
// Use for: invalid signature, missing required data, malformed request
return res.status(400).json({ error: 'Invalid request' });

// 500 Internal Server Error - Server error, DO retry
// Use for: database failures, API timeouts, transient errors
return res.status(500).json({ error: 'Transient failure' });

// Return without throwing for data errors (returns 200)
if (!userId) {
  console.error('Missing userId');
  return; // Stripe won't retry
}

// Throw for transient errors (returns 500)
try {
  await database.save(data);
} catch (error) {
  throw error; // Stripe will retry
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// BAD: Retry all errors including client errors
async function badRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await operation();
    } catch (error) {
      // Retrying 400 Bad Request is pointless
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Failed');
}

// BAD: No exponential backoff (thundering herd)
async function badBackoff<T>(operation: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await operation();
    } catch (error) {
      // Fixed delay causes all clients to retry simultaneously
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Failed');
}

// BAD: No jitter (synchronized retries)
async function badJitter<T>(operation: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await operation();
    } catch (error) {
      // Exponential backoff without jitter
      const delay = 1000 * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed');
}

// BAD: Infinite retries
async function infiniteRetry<T>(operation: () => Promise<T>): Promise<T> {
  while (true) {
    try {
      return await operation();
    } catch (error) {
      // Never gives up, can hang forever
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// BAD: No user feedback during retry
function BadComponent() {
  const data = useQuery(api.data.get);
  
  if (data === null) {
    // User has no way to retry or know what happened
    return null;
  }
  
  return <div>{data}</div>;
}

// BAD: Retry button without loading state
function BadRetryButton() {
  const handleRetry = () => {
    window.location.reload(); // No loading indicator
  };
  
  return <button onClick={handleRetry}>Retry</button>;
}
```

### ✅ Do This Instead

```typescript
// GOOD: Only retry transient errors
async function goodRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await operation();
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      
      // Don't retry client errors (except rate limits)
      if (status && (status >= 400 && status < 500 && status !== 429)) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = 1000 * Math.pow(2, i) + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// GOOD: Clear user feedback with retry option
function GoodComponent() {
  const [isRetrying, setIsRetrying] = useState(false);
  const data = useQuery(api.data.get);
  
  const handleRetry = async () => {
    setIsRetrying(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    window.location.reload();
  };
  
  if (data === null) {
    return (
      <div className="error-state">
        <p>Failed to load data</p>
        <button onClick={handleRetry} disabled={isRetrying}>
          {isRetrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    );
  }
  
  return <div>{data}</div>;
}

// GOOD: Webhook retry with proper HTTP status codes
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await processWebhook(req);
    return res.status(200).json({ received: true }); // Success, don't retry
  } catch (error: any) {
    if (error.code === 'INVALID_SIGNATURE') {
      return res.status(400).json({ error: 'Invalid signature' }); // Don't retry
    }
    return res.status(500).json({ error: 'Server error' }); // Do retry
  }
}
```

---

## When to Use This Pattern

✅ **Use retry logic for:**
- Network failures and timeouts
- Rate limiting (429 errors)
- Server errors (5xx status codes)
- Transient database failures
- API quota exceeded errors
- Webhook delivery failures
- React component rendering errors
- Data fetching failures

❌ **Don't use retry logic for:**
- Authentication failures (401)
- Authorization failures (403)
- Not found errors (404)
- Validation errors (400)
- Malformed requests
- Business logic errors
- User input errors
- Permanent failures

---

## Benefits

1. **Resilience**: Automatically recovers from transient failures
2. **User Experience**: Reduces perceived errors by handling temporary issues
3. **Scalability**: Exponential backoff with jitter prevents thundering herd
4. **Debugging**: Structured logging helps diagnose retry patterns
5. **Cost Efficiency**: Avoids unnecessary retries of permanent failures
6. **Webhook Reliability**: Proper HTTP status codes ensure correct retry behavior
7. **State Management**: Error boundaries isolate failures to components
8. **User Control**: Manual retry buttons give users control over recovery

---

## Related Patterns

- See `error-boundaries.md` for React error isolation
- See `error-messages.md` for user-friendly error communication
- See `error-logging.md` for error tracking and monitoring
- See `../04-ui-components/loading-states.md` for loading indicators during retries
- See `../04-ui-components/toast-notifications.md` for retry success/failure feedback

---

*Extracted: 2026-02-18*
