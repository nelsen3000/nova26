# MIMAS - Resilience & Fault Tolerance Style Guide

## Retry Pattern Naming

### Function/Method Naming
```typescript
// Standard retry wrappers
withRetry(operation, options)
withExponentialBackoff(operation, options)
withLinearRetry(operation, options)
withCircuitBreaker(operation, options)

// Specific operation retries
retryWithBackoff<T>(fn: () => Promise<T>, config: RetryConfig)
retryWithJitter<T>(fn: () => Promise<T>, config: RetryConfig)
retryFixed<T>(fn: () => Promise<T>, config: RetryConfig)
```

### Configuration Object Naming
```typescript
interface RetryConfig {
  maxAttempts: number;           // Total attempts (1 = no retry)
  initialDelayMs: number;        // First delay
  maxDelayMs: number;            // Cap on delay
  backoffMultiplier: number;     // Exponential factor
  jitter: boolean;               // Add randomness
  retryableErrors: string[];     // Error codes/types to retry
  onRetry?: (attempt: number, error: Error) => void;
}

interface TimeoutConfig {
  timeoutMs: number;
  timeoutErrorMessage: string;
}
```

### Error Classification
```typescript
// Retryable errors - transient, may succeed on retry
const RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT', 
  'ECONNREFUSED',
  'ENOTFOUND',
  '503',           // Service Unavailable
  '429',           // Rate Limited
  'NETWORK_ERROR',
] as const;

// Non-retryable errors - will fail again
const NON_RETRYABLE_ERRORS = [
  '400',           // Bad Request
  '401',           // Unauthorized
  '403',           // Forbidden
  '404',           // Not Found
  '422',           // Unprocessable Entity
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
] as const;
```

## Circuit Breaker Configuration

### Naming Standards
```typescript
// Circuit breaker instances
circuitBreaker: CircuitBreaker
cbExternalAPI: CircuitBreaker
cbDatabase: CircuitBreaker

// State tracking
CircuitState.CLOSED      // Normal operation
CircuitState.OPEN        // Failing fast
CircuitState.HALF_OPEN   // Testing recovery
```

### Standard Configuration
```typescript
const CIRCUIT_BREAKER_DEFAULTS = {
  failureThreshold: 5,           // Errors before opening
  successThreshold: 3,           // Successes to close
  timeoutMs: 60000,              // Time before half-open
  halfOpenMaxCalls: 1,           // Test calls in half-open
};

// Service-specific overrides
const CIRCUIT_BREAKER_PRESETS = {
  critical: { failureThreshold: 3, timeoutMs: 30000 },
  standard: { failureThreshold: 5, timeoutMs: 60000 },
  lenient: { failureThreshold: 10, timeoutMs: 120000 },
};
```

### Circuit Breaker Events
```typescript
interface CircuitBreakerEvents {
  'open': { reason: string; failures: number; timestamp: Date };
  'halfOpen': { timestamp: Date };
  'close': { successes: number; timestamp: Date };
  'failure': { error: Error; consecutiveFailures: number };
  'success': { responseTimeMs: number };
}
```

## Timeout Standards

### Timeout Naming
```typescript
// Standard timeout suffixes
const API_TIMEOUT_MS = 30000;
const DB_TIMEOUT_MS = 10000;
const CACHE_TIMEOUT_MS = 5000;
const UPLOAD_TIMEOUT_MS = 120000;

// Per-operation timeouts
const FETCH_USER_TIMEOUT_MS = 5000;
const PROCESS_PAYMENT_TIMEOUT_MS = 15000;
```

### Timeout Hierarchy
```markdown
┌─────────────────────────────────────────┐
│  Request Timeout (gateway)  30s         │
│  ├─ API Layer Timeout       25s         │
│  │  ├─ Service Call         20s         │
│  │  │  ├─ DB Query          10s         │
│  │  │  └─ External API       8s         │
│  │  └─ Cache Lookup          2s         │
│  └─ Upload Processing      120s         │
└─────────────────────────────────────────┘
```

### Timeout Configuration Pattern
```typescript
const TIMEOUT_PRESETS = {
  instant: 1000,      // Cache, in-memory
  fast: 5000,         // Simple DB queries
  standard: 10000,    // API calls
  slow: 30000,        // Complex operations
  background: 300000, // Batch jobs
} as const;

function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  context: string
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(
        new TimeoutError(`Operation '${context}' timed out after ${timeoutMs}ms`)
      ), timeoutMs)
    ),
  ]);
}
```

## Fallback Handler Patterns

### Fallback Naming
```typescript
// Fallback functions
getUserFallback(cachedUser: User | null): User
generateFallbackResponse(request: Request): Response
provideDefaultConfig(): Config

// Fallback providers
const fallbackStrategies = {
  cache: cacheFallback,
  static: staticFallback,
  degraded: degradedModeFallback,
  none: noFallback,
};
```

### Fallback Priority Chain
```typescript
async function getDataWithFallbacks(id: string): Promise<Data> {
  return withRetry(
    () => fetchPrimary(id),
    { maxAttempts: 3 }
  ).catch(() => 
    fetchCache(id)
  ).catch(() => 
    fetchReplica(id)
  ).catch(() => 
    getDefaultData(id)
  );
}
```

### Graceful Degradation Levels
```typescript
enum DegradationLevel {
  FULL = 'full',           // All features available
  REDUCED = 'reduced',     // Non-critical features disabled
  MINIMAL = 'minimal',     // Read-only, essential only
  OFFLINE = 'offline',     // Static/cached content only
}

interface ServiceHealth {
  level: DegradationLevel;
  disabledFeatures: string[];
  message: string;
}
```

### Fallback Handler Template
```typescript
class ResilientService {
  private circuitBreaker: CircuitBreaker;
  private cache: Cache;

  async execute<T>(
    operation: () => Promise<T>,
    options: {
      fallback?: T;
      cacheKey?: string;
      degradeTo?: () => T;
    }
  ): Promise<T> {
    try {
      return await this.circuitBreaker.fire(operation);
    } catch (error) {
      // Try cache
      if (options.cacheKey) {
        const cached = await this.cache.get(options.cacheKey);
        if (cached) return cached;
      }
      
      // Use static fallback
      if (options.fallback !== undefined) {
        return options.fallback;
      }
      
      // Use degradation function
      if (options.degradeTo) {
        return options.degradeTo();
      }
      
      throw error;
    }
  }
}
```
