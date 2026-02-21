# Resilience Patterns

## Source
Extracted from BistroLens `lib/resilience.ts`, `hooks/useResilientMutation.ts`

**Category:** 07-error-handling
**Type:** Pattern
**Tags:** resilience, retry, circuit-breaker, exponential-backoff, error-recovery

---

## Overview

Resilience patterns for BistroLens: exponential backoff retry, circuit breaker state machine, and graceful degradation for Convex queries and external API calls.

---

## Pattern

```typescript
// lib/resilience.ts

// --- Exponential Backoff Retry ---

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryOn?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    retryOn = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !retryOn(error)) {
        throw error;
      }

      const delay = Math.min(
        baseDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      await sleep(delay + jitter);
    }
  }

  throw lastError;
}

// --- Circuit Breaker ---

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeMs?: number;
  halfOpenMaxRequests?: number;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenRequests = 0;

  constructor(private options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: 5,
      recoveryTimeMs: 30000,
      halfOpenMaxRequests: 1,
      ...options,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.options.recoveryTimeMs!) {
        throw new Error("Circuit breaker is OPEN — service unavailable");
      }
      // Transition to half-open
      this.state = "half-open";
      this.halfOpenRequests = 0;
    }

    if (this.state === "half-open") {
      if (this.halfOpenRequests >= this.options.halfOpenMaxRequests!) {
        throw new Error("Circuit breaker is HALF-OPEN — limiting requests");
      }
      this.halfOpenRequests++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold!) {
      this.state = "open";
      console.warn(`Circuit breaker OPENED after ${this.failureCount} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

```typescript
// hooks/useResilientMutation.ts
import { useMutation } from "convex/react";
import { useState, useCallback } from "react";
import { withRetry } from "@/lib/resilience";

export function useResilientMutation<Args, Return>(
  mutationFn: (args: Args) => Promise<Return>,
  options?: { maxAttempts?: number }
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (args: Args): Promise<Return | null> => {
      setIsLoading(true);
      setError(null);

      try {
        return await withRetry(() => mutationFn(args), {
          maxAttempts: options?.maxAttempts ?? 3,
          retryOn: (err) => {
            // Only retry network errors, not validation errors
            const msg = err instanceof Error ? err.message : "";
            return !msg.includes("Validation") && !msg.includes("Unauthorized");
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Operation failed");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, options?.maxAttempts]
  );

  return { execute, isLoading, error };
}
```

---

## Usage

```tsx
// Using withRetry for an external API call
const result = await withRetry(
  () => fetch("https://api.stripe.com/v1/customers"),
  {
    maxAttempts: 3,
    baseDelayMs: 1000,
    retryOn: (err) => err instanceof TypeError, // Only retry network errors
  }
);

// Using CircuitBreaker for a flaky service
const stripeBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTimeMs: 60000 });

async function chargeCustomer(customerId: string) {
  return stripeBreaker.execute(() => stripe.charges.create({ customer: customerId }));
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Retry without backoff — hammers the server
for (let i = 0; i < 3; i++) {
  try { return await fn(); } catch {}
}

// Retry on all errors including validation errors
await withRetry(fn, { retryOn: () => true }); // Will retry 400 Bad Request forever

// No circuit breaker — cascading failures
async function callExternalService() {
  // If service is down, every request waits for timeout
  return await fetch("https://flaky-service.com/api");
}
```

### ✅ Do This Instead

```typescript
// Exponential backoff with jitter and selective retry
const result = await withRetry(
  () => fetch("https://api.stripe.com/v1/customers"),
  {
    maxAttempts: 3,
    baseDelayMs: 1000,
    retryOn: (err) => err instanceof TypeError, // Only retry network errors
  }
);

// Circuit breaker for flaky external services
const stripeBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTimeMs: 60000 });
const charge = await stripeBreaker.execute(() => stripe.charges.create({ customer: id }));
```

---

## When to Use This Pattern

✅ **Use for:**
- External API calls (Stripe, third-party services) that may transiently fail
- Convex mutations that may fail due to network issues
- Any operation where transient failures are expected and retryable

❌ **Don't use for:**
- Validation errors or business logic failures that will never succeed on retry
- Operations where idempotency is not guaranteed

---

## Benefits

1. Exponential backoff with jitter prevents thundering herd on service recovery
2. Circuit breaker stops cascading failures by fast-failing when a service is down
3. Selective retry via `retryOn` avoids wasting retries on non-transient errors
4. `useResilientMutation` hook provides loading/error state management for free

---

## Related Patterns

- `retry-logic.md` — UI-level retry buttons
- `error-boundaries.md` — React error boundary implementation
- `error-logging.md` — Error incident tracking
