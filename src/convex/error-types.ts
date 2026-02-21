// Nova26 typed error hierarchy
// All errors extend Nova26Error for consistent catch handling.

export class Nova26Error extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'Nova26Error';
    this.code = code;
  }
}

export class AuthError extends Nova26Error {
  constructor(message = 'Not authenticated') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class BridgeError extends Nova26Error {
  readonly mutation: string;
  readonly attempt: number;

  constructor(message: string, mutation: string, attempt = 1) {
    super(message, 'BRIDGE_ERROR');
    this.name = 'BridgeError';
    this.mutation = mutation;
    this.attempt = attempt;
  }
}

export class ConnectionError extends Nova26Error {
  readonly url: string;

  constructor(message: string, url: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
    this.url = url;
  }
}

export class ValidationError extends Nova26Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class RateLimitError extends Nova26Error {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs = 60_000) {
    super(message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Type guard — check if an unknown error is a Nova26Error.
 */
export function isNova26Error(error: unknown): error is Nova26Error {
  return error instanceof Nova26Error;
}

/**
 * Coerce any caught value to an Error.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'object' && value !== null) {
    try {
      return new Error(JSON.stringify(value));
    } catch {
      return new Error(String(value));
    }
  }
  return new Error(String(value));
}
