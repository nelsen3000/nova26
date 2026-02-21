// Request validation layer for the dashboard API

import type { ApiRequest, ApiResponse } from './dashboard-api.js';

// ============================================================================
// Types
// ============================================================================

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  pattern?: RegExp;
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Type Guards
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// Core Validators
// ============================================================================

/**
 * Validate a request body against a set of validation rules.
 */
export function validateRequest(
  request: ApiRequest,
  rules: ValidationRule[],
): ValidationResult {
  const errors: string[] = [];
  const body = isRecord(request.body) ? request.body : undefined;

  for (const rule of rules) {
    const value: unknown = body ? body[rule.field] : undefined;

    // Required check
    if (rule.required && (value === undefined || value === null)) {
      errors.push(`Field '${rule.field}' is required`);
      continue;
    }

    // Skip further validation if the field is absent and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type check
    const actualType = typeof value;
    if (actualType !== rule.type) {
      errors.push(
        `Field '${rule.field}' must be of type '${rule.type}', got '${actualType}'`,
      );
      continue;
    }

    // String-specific validations
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(
          `Field '${rule.field}' does not match the required pattern`,
        );
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push(
          `Field '${rule.field}' exceeds maximum length of ${rule.maxLength}`,
        );
      }
    }

    // Number-specific validations
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(
          `Field '${rule.field}' must be at least ${rule.min}`,
        );
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(
          `Field '${rule.field}' must be at most ${rule.max}`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a build ID.
 * Allowed characters: alphanumeric, hyphens. Max 128 characters.
 */
export function validateBuildId(buildId: string): ValidationResult {
  const errors: string[] = [];

  if (buildId.length === 0) {
    errors.push('Build ID must not be empty');
    return { valid: false, errors };
  }

  if (buildId.length > 128) {
    errors.push('Build ID must not exceed 128 characters');
  }

  // Only allow alphanumeric and hyphens
  if (!/^[a-zA-Z0-9-]+$/.test(buildId)) {
    errors.push(
      'Build ID must contain only alphanumeric characters and hyphens',
    );
  }

  // Reject path traversal attempts
  if (buildId.includes('..') || buildId.includes('/') || buildId.includes('\\')) {
    errors.push('Build ID contains invalid path characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate query parameters against an allow-list.
 */
export function validateQueryParams(
  query: Record<string, string> | undefined,
  allowedParams: string[],
): ValidationResult {
  const errors: string[] = [];

  if (!query) {
    return { valid: true, errors };
  }

  const allowedSet = new Set(allowedParams);

  for (const key of Object.keys(query)) {
    if (!allowedSet.has(key)) {
      errors.push(`Unknown query parameter: '${key}'`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Higher-order function that wraps an API handler with request validation.
 * Returns a 400 response with validation errors if the request is invalid.
 */
export function withValidation<T>(
  handler: (request: ApiRequest) => ApiResponse<T> | Promise<ApiResponse<T>>,
  rules: ValidationRule[],
): (request: ApiRequest) => ApiResponse<T> | Promise<ApiResponse<T>> {
  return (request: ApiRequest): ApiResponse<T> | Promise<ApiResponse<T>> => {
    const result = validateRequest(request, rules);

    if (!result.valid) {
      return {
        status: 400,
        error: result.errors.join('; '),
      };
    }

    return handler(request);
  };
}
