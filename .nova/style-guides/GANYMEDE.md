# GANYMEDE Style Guide - API Integration

> Standards for external API clients, webhooks, and third-party integrations

---

## API Integration File Naming

| Type | Pattern | Example |
|------|---------|---------|
| API client | `[service]Client.ts` | `stripeClient.ts`, `sendGridClient.ts` |
| Webhook handlers | `[service]Webhook.ts` | `stripeWebhook.ts` |
| Types | `[service]Types.ts` | `stripeTypes.ts` |
| Config | `[service]Config.ts` | `stripeConfig.ts` |
| Mocks | `[service]Mocks.ts` | `stripeMocks.ts` |
| Hooks | `use[Service].ts` | `useStripe.ts` |

---

## Webhook Handler Patterns

### File Structure

```typescript
// webhook/stripeWebhook.ts

import type { Request, Response } from "express";
import { verifyStripeSignature } from "../lib/stripe";
import { handleCheckoutCompleted } from "../handlers/checkoutCompleted";
import { handleSubscriptionUpdated } from "../handlers/subscriptionUpdated";
import { logWebhookEvent, recordWebhookFailure } from "../lib/webhookLogging";

/**
 * Stripe webhook handler
 * @see https://stripe.com/docs/webhooks
 */
export async function stripeWebhookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const signature = req.headers["stripe-signature"] as string;
  const payload = req.body;

  // Step 1: Verify signature
  const event = verifyStripeSignature(payload, signature);
  if (!event) {
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  // Step 2: Log receipt
  await logWebhookEvent({
    provider: "stripe",
    eventType: event.type,
    eventId: event.id,
    receivedAt: new Date().toISOString(),
  });

  // Step 3: Route to handler
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Step 4: Acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    // Step 5: Handle failure
    await recordWebhookFailure({
      provider: "stripe",
      eventId: event.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Return 500 to trigger retry
    res.status(500).json({ error: "Processing failed" });
  }
}
```

### Webhook Handler Template

```typescript
interface WebhookHandler<T> {
  /** Verify the webhook signature */
  verify: (payload: unknown, signature: string) => T | null;
  /** Process the webhook event */
  handle: (event: T) => Promise<void>;
  /** Event types this handler supports */
  supportedEvents: string[];
}

// Implementation pattern
export const stripeWebhookHandler: WebhookHandler<StripeEvent> = {
  verify: verifyStripeSignature,
  handle: async (event) => {
    const handler = eventHandlers[event.type];
    if (handler) {
      await handler(event);
    }
  },
  supportedEvents: [
    "checkout.session.completed",
    "customer.subscription.updated",
    "invoice.payment_failed",
  ],
};
```

---

## External API Client Structure

### Client Architecture

```typescript
// lib/stripeClient.ts

interface StripeConfig {
  apiKey: string;
  apiVersion: string;
  maxRetries: number;
  timeout: number;
  webhookSecret?: string;
}

interface RequestOptions {
  retries?: number;
  timeout?: number;
  idempotencyKey?: string;
}

class StripeClient {
  private config: StripeConfig;
  private baseUrl = "https://api.stripe.com/v1";

  constructor(config: StripeConfig) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };
  }

  // Generic request method with retry logic
  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const retries = options.retries ?? this.config.maxRetries;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            ...(options.idempotencyKey && {
              "Idempotency-Key": options.idempotencyKey,
            }),
          },
          signal: AbortSignal.timeout(options.timeout ?? this.config.timeout),
        });

        if (!response.ok) {
          throw await this.parseError(response);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (attempt === retries) throw error;
        if (!this.isRetryableError(error)) throw error;
        
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    throw new Error("Max retries exceeded");
  }

  // Type-safe API methods
  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<CheckoutSession> {
    return this.request<CheckoutSession>("POST", "/checkout/sessions", {
      idempotencyKey: params.idempotencyKey,
    });
  }

  async getCustomer(customerId: string): Promise<Customer> {
    return this.request<Customer>("GET", `/customers/${customerId}`);
  }

  // Error classification
  private isRetryableError(error: unknown): boolean {
    if (error instanceof ApiError) {
      return error.status >= 500 || error.code === "ETIMEDOUT";
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async parseError(response: Response): Promise<ApiError> {
    const body = await response.json();
    return new ApiError(
      body.error?.message || "Unknown error",
      response.status,
      body.error?.code
    );
  }
}

// Error class
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Singleton export
export const stripe = new StripeClient({
  apiKey: process.env.STRIPE_SECRET_KEY!,
  apiVersion: "2024-01-01",
});
```

---

## Error Handling for External APIs

### Error Classification

```typescript
// types/apiErrors.ts

export enum ApiErrorType {
  // Client errors (4xx)
  BAD_REQUEST = "BAD_REQUEST",           // 400
  UNAUTHORIZED = "UNAUTHORIZED",         // 401
  FORBIDDEN = "FORBIDDEN",               // 403
  NOT_FOUND = "NOT_FOUND",               // 404
  RATE_LIMITED = "RATE_LIMITED",         // 429
  
  // Server errors (5xx)
  SERVER_ERROR = "SERVER_ERROR",         // 500
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE", // 503
  
  // Network errors
  TIMEOUT = "TIMEOUT",
  NETWORK_ERROR = "NETWORK_ERROR",
  
  // Unknown
  UNKNOWN = "UNKNOWN",
}

export interface ApiErrorDetails {
  type: ApiErrorType;
  message: string;
  statusCode?: number;
  provider: string;
  retryable: boolean;
  requestId?: string;
}

// Error mapper
export function classifyApiError(
  error: unknown,
  provider: string
): ApiErrorDetails {
  if (error instanceof Response) {
    const type = mapStatusToErrorType(error.status);
    return {
      type,
      message: `HTTP ${error.status}: ${error.statusText}`,
      statusCode: error.status,
      provider,
      retryable: isRetryableStatus(error.status),
    };
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return {
      type: ApiErrorType.NETWORK_ERROR,
      message: "Network request failed",
      provider,
      retryable: true,
    };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return {
      type: ApiErrorType.TIMEOUT,
      message: "Request timeout",
      provider,
      retryable: true,
    };
  }

  return {
    type: ApiErrorType.UNKNOWN,
    message: error instanceof Error ? error.message : "Unknown error",
    provider,
    retryable: false,
  };
}

function mapStatusToErrorType(status: number): ApiErrorType {
  switch (status) {
    case 400: return ApiErrorType.BAD_REQUEST;
    case 401: return ApiErrorType.UNAUTHORIZED;
    case 403: return ApiErrorType.FORBIDDEN;
    case 404: return ApiErrorType.NOT_FOUND;
    case 429: return ApiErrorType.RATE_LIMITED;
    case 503: return ApiErrorType.SERVICE_UNAVAILABLE;
    default:
      return status >= 500 ? ApiErrorType.SERVER_ERROR : ApiErrorType.BAD_REQUEST;
  }
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}
```

### Error Handling Pattern

```typescript
// hooks/useExternalApi.ts

import { useState, useCallback } from "react";
import { classifyApiError, type ApiErrorDetails } from "../types/apiErrors";

interface UseExternalApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiErrorDetails) => void;
  retryCount?: number;
}

interface UseExternalApiResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiErrorDetails | null;
  execute: (...args: unknown[]) => Promise<void>;
  retry: () => Promise<void>;
}

export function useExternalApi<T>(
  apiCall: (...args: unknown[]) => Promise<T>,
  options: UseExternalApiOptions<T> = {}
): UseExternalApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetails | null>(null);
  const [lastArgs, setLastArgs] = useState<unknown[]>([]);

  const execute = useCallback(
    async (...args: unknown[]) => {
      setLoading(true);
      setError(null);
      setLastArgs(args);

      try {
        const result = await apiCall(...args);
        setData(result);
        options.onSuccess?.(result);
      } catch (err) {
        const classifiedError = classifyApiError(err, "external");
        setError(classifiedError);
        options.onError?.(classifiedError);
      } finally {
        setLoading(false);
      }
    },
    [apiCall, options]
  );

  const retry = useCallback(async () => {
    if (lastArgs.length > 0) {
      await execute(...lastArgs);
    }
  }, [execute, lastArgs]);

  return { data, loading, error, execute, retry };
}
```

---

## Integration Testing Patterns

### Mock Patterns

```typescript
// __mocks__/stripeMocks.ts

import type { Customer, CheckoutSession } from "../types/stripe";

export const mockCustomer: Customer = {
  id: "cus_test123",
  email: "test@example.com",
  name: "Test User",
  created: 1640995200,
};

export const mockCheckoutSession: CheckoutSession = {
  id: "cs_test_123",
  customer: "cus_test123",
  status: "complete",
  amount_total: 5000,
  currency: "usd",
  url: "https://checkout.stripe.com/pay/cs_test_123",
};

// MSW handler
export const stripeHandlers = [
  http.post("https://api.stripe.com/v1/checkout/sessions", () => {
    return HttpResponse.json(mockCheckoutSession);
  }),
  
  http.get("https://api.stripe.com/v1/customers/:id", ({ params }) => {
    return HttpResponse.json({
      ...mockCustomer,
      id: params.id,
    });
  }),
];
```

---

## Quality Checklist (25+ items)

### API Client (5)
- [ ] Retry logic with exponential backoff
- [ ] Timeout configuration
- [ ] Idempotency key support
- [ ] Request/response logging
- [ ] Type-safe methods

### Webhook Handlers (5)
- [ ] Signature verification
- [ ] Event logging
- [ ] Idempotent processing
- [ ] Error handling with retry
- [ ] Event routing pattern

### Error Handling (5)
- [ ] Error classification
- [ ] Retryable vs non-retryable
- [ ] User-friendly messages
- [ ] Error tracking integration
- [ ] Fallback behavior

### Security (5)
- [ ] API keys in environment variables
- [ ] Webhook signature verification
- [ ] Request validation
- [ ] Rate limit handling
- [ ] Audit logging

### Testing (5)
- [ ] Mock implementations
- [ ] Error scenario tests
- [ ] Webhook payload tests
- [ ] Retry logic tests
- [ ] Integration tests

---

## Self-Check Before Responding

- [ ] Client has retry logic with backoff
- [ ] Webhook signature verification implemented
- [ ] All errors classified and typed
- [ ] Timeout configured for all requests
- [ ] Idempotency keys used for mutations
- [ ] API keys not hardcoded
- [ ] Error messages are user-friendly
- [ ] Mocks available for testing

---

## Output Format Template

```markdown
## Integration: [Service Name]

### Client Structure
- **File:** `[service]Client.ts`
- **Base URL:** [URL]
- **Auth:** [Method]

### Supported Operations
| Operation | Method | Endpoint |
|-----------|--------|----------|
| [Name] | [GET/POST] | [Path] |

### Error Handling
| Error | Retryable | Handler |
|-------|-----------|---------|
| [Type] | [Yes/No] | [Action] |

### Webhook Events
- [event.type]: [Handler function]

### Usage Example
\`\`\`typescript
[Code example]
\`\`\`
```
