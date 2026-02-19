// Error Classifier Tests — R17-01 Advanced Error Recovery
// 18 tests covering classify, correlate, patterns, retryable, history

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorClassifier } from './error-classifier.js';
import type { ClassifiedError } from './error-classifier.js';

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    vi.useFakeTimers();
    classifier = new ErrorClassifier();
  });

  // 1
  it('classifies network errors', () => {
    const result = classifier.classifyError(new Error('ECONNREFUSED'));
    expect(result.errorClass).toBe('network');
    expect(result.retryable).toBe(true);
  });

  // 2
  it('classifies timeout errors', () => {
    const result = classifier.classifyError(new Error('Request timed out'));
    expect(result.errorClass).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  // 3
  it('classifies rate-limit errors', () => {
    const result = classifier.classifyError(new Error('429 Too Many Requests'));
    expect(result.errorClass).toBe('rate-limit');
  });

  // 4
  it('classifies auth errors', () => {
    const result = classifier.classifyError(new Error('401 Unauthorized'));
    expect(result.errorClass).toBe('auth');
    expect(result.retryable).toBe(false);
  });

  // 5
  it('classifies model errors', () => {
    const result = classifier.classifyError(new Error('Model not found: gpt-99'));
    expect(result.errorClass).toBe('model');
    expect(result.severity).toBe('high');
  });

  // 6
  it('classifies resource errors', () => {
    const result = classifier.classifyError(new Error('Out of memory'));
    expect(result.errorClass).toBe('resource');
    expect(result.severity).toBe('critical');
  });

  // 7
  it('classifies validation errors', () => {
    const result = classifier.classifyError(new Error('Invalid JSON in request body'));
    expect(result.errorClass).toBe('validation');
    expect(result.severity).toBe('low');
  });

  // 8
  it('classifies filesystem errors', () => {
    const result = classifier.classifyError(new Error('ENOENT: no such file'));
    expect(result.errorClass).toBe('filesystem');
  });

  // 9
  it('classifies unknown errors', () => {
    const result = classifier.classifyError(new Error('Something completely unexpected'));
    expect(result.errorClass).toBe('unknown');
    expect(result.suggestedAction).toContain('Investigate');
  });

  // 10
  it('classification is case-insensitive', () => {
    const result1 = classifier.classifyError(new Error('ECONNREFUSED'));
    const result2 = classifier.classifyError(new Error('econnrefused'));
    expect(result1.errorClass).toBe(result2.errorClass);
  });

  // 11
  it('classifyError returns a ClassifiedError with UUID id', () => {
    const result = classifier.classifyError(new Error('test'));
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  // 12
  it('classifyError stores ISO 8601 timestamp', () => {
    vi.setSystemTime(new Date('2026-02-01T12:00:00.000Z'));
    const result = classifier.classifyError(new Error('test'));
    expect(result.timestamp).toBe('2026-02-01T12:00:00.000Z');
  });

  // 13
  it('classifyError attaches context', () => {
    const result = classifier.classifyError(new Error('test'), { agent: 'JUPITER' });
    expect(result.context).toEqual({ agent: 'JUPITER' });
  });

  // 14
  it('getErrorHistory returns accumulated errors', () => {
    classifier.classifyError(new Error('timeout'));
    classifier.classifyError(new Error('ECONNREFUSED'));
    classifier.classifyError(new Error('oom'));

    const history = classifier.getErrorHistory();
    expect(history).toHaveLength(3);
  });

  // 15
  it('errorHistory is limited to 100 (FIFO)', () => {
    for (let i = 0; i < 110; i++) {
      classifier.classifyError(new Error(`error-${i}`));
    }
    const history = classifier.getErrorHistory();
    expect(history).toHaveLength(100);
    // The first 10 should have been evicted
    expect(history[0].originalError.message).toBe('error-10');
  });

  // 16
  it('correlateErrors finds correlated error classes', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    classifier.classifyError(new Error('timeout'));
    classifier.classifyError(new Error('ECONNREFUSED'));
    classifier.classifyError(new Error('timeout'));
    classifier.classifyError(new Error('ECONNREFUSED'));

    const correlations = classifier.correlateErrors(60000);
    expect(correlations.length).toBeGreaterThan(0);
    const first = correlations[0];
    expect(first.occurrences).toBeGreaterThan(0);
    expect(first.confidence).toBeGreaterThan(0);
  });

  // 17
  it('detectPatterns groups errors by class', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    classifier.classifyError(new Error('timeout'));
    vi.advanceTimersByTime(1000);
    classifier.classifyError(new Error('timeout'));
    vi.advanceTimersByTime(1000);
    classifier.classifyError(new Error('timeout'));
    classifier.classifyError(new Error('ENOENT'));

    const patterns = classifier.detectPatterns();
    const timeoutPattern = patterns.find(p => p.errorClass === 'timeout');
    expect(timeoutPattern).toBeDefined();
    expect(timeoutPattern?.count).toBe(3);
    expect(timeoutPattern?.averageIntervalMs).toBe(1000);
  });

  // 18
  it('isRetryable and getSuggestedAction work correctly', () => {
    const retryableErr = classifier.classifyError(new Error('Connection refused'));
    expect(classifier.isRetryable(retryableErr)).toBe(true);
    expect(classifier.getSuggestedAction(retryableErr)).toContain('network');

    const nonRetryable = classifier.classifyError(new Error('401 Unauthorized'));
    expect(classifier.isRetryable(nonRetryable)).toBe(false);
    expect(classifier.getSuggestedAction(nonRetryable)).toContain('credentials');
  });
});
