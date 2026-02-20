// Retry utility with exponential backoff for external API calls

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Type guard: checks if a value is an object with a numeric `status` property.
 */
function hasStatusCode(value: unknown): value is { status: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as Record<string, unknown>).status === 'number'
  );
}

/**
 * Default predicate for retryable errors.
 * Retries on: TypeError (network errors), and HTTP 429 / 500-599 status codes.
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors surface as TypeError in fetch
  if (error instanceof TypeError) {
    return true;
  }

  // Check for status code on the error object itself
  if (hasStatusCode(error)) {
    const status = error.status;
    return status === 429 || (status >= 500 && status <= 599);
  }

  // Check for a nested `response` with a status code (e.g. axios-style errors)
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response: unknown = (error as Record<string, unknown>).response;
    if (hasStatusCode(response)) {
      const status = response.status;
      return status === 429 || (status >= 500 && status <= 599);
    }
  }

  return false;
}

/**
 * Calculate delay for a given attempt using exponential backoff with jitter.
 * `attempt` is 1-based (first retry = attempt 1).
 */
export function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponentialDelay =
    options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);

  // Add jitter: random value between 0 and cappedDelay
  const jitter = Math.random() * cappedDelay;
  return Math.min(Math.floor((cappedDelay + jitter) / 2), options.maxDelayMs);
}

/**
 * Internal sleep helper — extracted so tests can mock it.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn` with retry logic and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const resolved: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = resolved.retryableErrors ?? isRetryableError;

  let lastError: unknown;

  for (let attempt = 1; attempt <= resolved.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // If this was the last attempt, throw immediately
      if (attempt >= resolved.maxAttempts) {
        throw error;
      }

      // If the error is not retryable, throw immediately
      if (!shouldRetry(error)) {
        throw error;
      }

      const delayMs = calculateDelay(attempt, resolved);

      if (resolved.onRetry) {
        resolved.onRetry(attempt, error, delayMs);
      }

      await sleep(delayMs);
    }
  }

  // This should never be reached, but satisfies the type checker
  throw lastError;
}
