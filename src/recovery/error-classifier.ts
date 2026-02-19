// Error Classifier — Advanced Error Recovery (R17-01)
// Classifies, correlates, and tracks errors for intelligent recovery

import { randomUUID } from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ErrorClass =
  | 'network'
  | 'timeout'
  | 'rate-limit'
  | 'auth'
  | 'model'
  | 'resource'
  | 'validation'
  | 'filesystem'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ClassifiedError {
  id: string;
  originalError: Error;
  errorClass: ErrorClass;
  severity: ErrorSeverity;
  retryable: boolean;
  suggestedAction: string;
  timestamp: string;
  context: Record<string, string>;
}

export interface ErrorPattern {
  errorClass: ErrorClass;
  count: number;
  firstSeen: string;
  lastSeen: string;
  averageIntervalMs: number | null;
}

export interface ErrorCorrelation {
  primaryClass: ErrorClass;
  correlatedClass: ErrorClass;
  occurrences: number;
  confidence: number; // 0-1
}

// ============================================================================
// Classification Rules
// ============================================================================

interface ClassificationRule {
  patterns: string[];
  errorClass: ErrorClass;
  severity: ErrorSeverity;
  retryable: boolean;
  suggestedAction: string;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    patterns: ['econnrefused', 'econnreset', 'enotfound', 'connection refused', 'network error', 'socket hang up', 'dns'],
    errorClass: 'network',
    severity: 'medium',
    retryable: true,
    suggestedAction: 'Check network connectivity and retry',
  },
  {
    patterns: ['timeout', 'timed out', 'etimedout', 'deadline exceeded'],
    errorClass: 'timeout',
    severity: 'medium',
    retryable: true,
    suggestedAction: 'Increase timeout or retry with backoff',
  },
  {
    patterns: ['rate limit', 'too many requests', '429', 'throttle', 'quota exceeded'],
    errorClass: 'rate-limit',
    severity: 'medium',
    retryable: true,
    suggestedAction: 'Wait and retry with exponential backoff',
  },
  {
    patterns: ['unauthorized', '401', '403', 'forbidden', 'authentication', 'invalid token', 'expired token'],
    errorClass: 'auth',
    severity: 'high',
    retryable: false,
    suggestedAction: 'Check credentials and re-authenticate',
  },
  {
    patterns: ['model not found', 'invalid model', 'model error', 'context length', 'token limit', 'max tokens'],
    errorClass: 'model',
    severity: 'high',
    retryable: false,
    suggestedAction: 'Switch to a different model or reduce input size',
  },
  {
    patterns: ['out of memory', 'oom', 'heap', 'memory limit', 'insufficient resources', 'disk full', 'no space'],
    errorClass: 'resource',
    severity: 'critical',
    retryable: false,
    suggestedAction: 'Free resources or scale up infrastructure',
  },
  {
    patterns: ['validation', 'invalid input', 'schema', 'parse error', 'malformed', 'invalid json'],
    errorClass: 'validation',
    severity: 'low',
    retryable: false,
    suggestedAction: 'Fix the input data and try again',
  },
  {
    patterns: ['enoent', 'file not found', 'no such file', 'permission denied', 'eacces', 'eperm', 'eisdir'],
    errorClass: 'filesystem',
    severity: 'medium',
    retryable: false,
    suggestedAction: 'Check file paths and permissions',
  },
];

// ============================================================================
// Error History Limit
// ============================================================================

const MAX_HISTORY = 100;

// ============================================================================
// ErrorClassifier
// ============================================================================

export class ErrorClassifier {
  private readonly errorHistory: ClassifiedError[] = [];

  classifyError(error: Error, context?: Record<string, string>): ClassifiedError {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    const combined = `${name} ${message}`;

    let matched: ClassificationRule | undefined;
    for (const rule of CLASSIFICATION_RULES) {
      for (const pattern of rule.patterns) {
        if (combined.includes(pattern.toLowerCase())) {
          matched = rule;
          break;
        }
      }
      if (matched) break;
    }

    const classified: ClassifiedError = {
      id: randomUUID(),
      originalError: error,
      errorClass: matched?.errorClass ?? 'unknown',
      severity: matched?.severity ?? 'medium',
      retryable: matched?.retryable ?? false,
      suggestedAction: matched?.suggestedAction ?? 'Investigate the error and retry manually',
      timestamp: new Date().toISOString(),
      context: context ?? {},
    };

    this.errorHistory.push(classified);
    if (this.errorHistory.length > MAX_HISTORY) {
      this.errorHistory.splice(0, this.errorHistory.length - MAX_HISTORY);
    }

    return classified;
  }

  correlateErrors(windowMs: number): ErrorCorrelation[] {
    if (this.errorHistory.length < 2) return [];

    const now = Date.now();
    const windowStart = now - windowMs;
    const recent = this.errorHistory.filter(
      e => new Date(e.timestamp).getTime() >= windowStart,
    );

    const pairCounts = new Map<string, number>();
    const classCounts = new Map<ErrorClass, number>();

    for (const err of recent) {
      classCounts.set(err.errorClass, (classCounts.get(err.errorClass) ?? 0) + 1);
    }

    // Count co-occurrences (pairs that appear within the same window)
    for (let i = 0; i < recent.length; i++) {
      for (let j = i + 1; j < recent.length; j++) {
        if (recent[i].errorClass !== recent[j].errorClass) {
          const key = [recent[i].errorClass, recent[j].errorClass].sort().join(':');
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }

    const correlations: ErrorCorrelation[] = [];
    for (const [key, occurrences] of pairCounts) {
      const [classA, classB] = key.split(':') as [ErrorClass, ErrorClass];
      const totalA = classCounts.get(classA) ?? 0;
      const totalB = classCounts.get(classB) ?? 0;
      const maxPossible = Math.min(totalA, totalB);
      const confidence = maxPossible > 0 ? Math.min(occurrences / maxPossible, 1) : 0;

      correlations.push({
        primaryClass: classA,
        correlatedClass: classB,
        occurrences,
        confidence,
      });
    }

    return correlations.sort((a, b) => b.confidence - a.confidence);
  }

  detectPatterns(): ErrorPattern[] {
    const byClass = new Map<ErrorClass, ClassifiedError[]>();

    for (const err of this.errorHistory) {
      const list = byClass.get(err.errorClass) ?? [];
      list.push(err);
      byClass.set(err.errorClass, list);
    }

    const patterns: ErrorPattern[] = [];

    for (const [errorClass, errors] of byClass) {
      const sorted = errors.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      let averageIntervalMs: number | null = null;
      if (sorted.length > 1) {
        let totalInterval = 0;
        for (let i = 1; i < sorted.length; i++) {
          totalInterval +=
            new Date(sorted[i].timestamp).getTime() -
            new Date(sorted[i - 1].timestamp).getTime();
        }
        averageIntervalMs = totalInterval / (sorted.length - 1);
      }

      patterns.push({
        errorClass,
        count: sorted.length,
        firstSeen: sorted[0].timestamp,
        lastSeen: sorted[sorted.length - 1].timestamp,
        averageIntervalMs,
      });
    }

    return patterns.sort((a, b) => b.count - a.count);
  }

  isRetryable(error: ClassifiedError): boolean {
    return error.retryable;
  }

  getSuggestedAction(error: ClassifiedError): string {
    return error.suggestedAction;
  }

  getErrorHistory(): ClassifiedError[] {
    return [...this.errorHistory];
  }
}
