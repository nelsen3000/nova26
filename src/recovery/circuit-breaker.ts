// Circuit Breaker — Advanced Error Recovery (R17-01)
// Protects downstream services with closed/open/half-open state machine

import { randomUUID } from 'crypto';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
  monitorWindowMs: number;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  trippedAt?: string;
  totalTrips: number;
}

export class CircuitOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is open — calls are being rejected`);
    this.name = 'CircuitOpenError';
  }
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
  monitorWindowMs: 60000,
};

// Suppress unused import warning — randomUUID is available for external callers
void randomUUID;

export class CircuitBreaker {
  private readonly circuitName: string;
  private readonly config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private halfOpenAttempts = 0;
  private totalTrips = 0;
  private lastFailureAt?: string;
  private lastSuccessAt?: string;
  private trippedAt?: string;
  private failureTimestamps: string[] = [];

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.circuitName = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.shouldAttempt()) {
      throw new CircuitOpenError(this.circuitName);
    }
    if (this.state === 'half-open') {
      this.halfOpenAttempts++;
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  getState(): CircuitState {
    if (this.state === 'open' && this.trippedAt) {
      const elapsed = Date.now() - new Date(this.trippedAt).getTime();
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
      }
    }
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    this.getState(); // ensure pending transitions
    return {
      name: this.circuitName,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      trippedAt: this.trippedAt,
      totalTrips: this.totalTrips,
    };
  }

  recordSuccess(): void {
    this.lastSuccessAt = new Date().toISOString();
    this.successCount++;
    if (this.state === 'half-open' && this.successCount >= this.config.halfOpenMaxAttempts) {
      this.state = 'closed';
      this.failureCount = 0;
      this.failureTimestamps = [];
    }
    if (this.state === 'closed') {
      this.failureCount = 0;
      this.failureTimestamps = [];
    }
  }

  recordFailure(_error: Error): void {
    const now = new Date();
    this.lastFailureAt = now.toISOString();
    this.failureTimestamps.push(now.toISOString());
    // Prune old failures outside window
    const windowStart = new Date(now.getTime() - this.config.monitorWindowMs).toISOString();
    this.failureTimestamps = this.failureTimestamps.filter(ts => ts >= windowStart);
    this.failureCount = this.failureTimestamps.length;

    if (this.state === 'half-open') {
      this.trip();
    } else if (this.state === 'closed' && this.failureCount >= this.config.failureThreshold) {
      this.trip();
    }
  }

  trip(): void {
    this.state = 'open';
    this.trippedAt = new Date().toISOString();
    this.totalTrips++;
    this.halfOpenAttempts = 0;
    this.successCount = 0;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.failureTimestamps = [];
    this.trippedAt = undefined;
  }

  shouldAttempt(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'half-open') return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    // open
    if (this.trippedAt) {
      const elapsed = Date.now() - new Date(this.trippedAt).getTime();
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
        this.successCount = 0;
        return true;
      }
    }
    return false;
  }
}
