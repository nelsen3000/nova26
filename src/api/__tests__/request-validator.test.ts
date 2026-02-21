import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateRequest,
  validateBuildId,
  validateQueryParams,
  withValidation,
  type ValidationRule,
} from '../request-validator.js';
import type { ApiRequest, ApiResponse } from '../dashboard-api.js';

describe('Request Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Helper to create ApiRequest objects
  // ========================================================================
  function makeRequest(overrides?: Partial<ApiRequest>): ApiRequest {
    return {
      method: 'POST',
      path: '/api/test',
      body: {},
      ...overrides,
    };
  }

  // ========================================================================
  // validateRequest
  // ========================================================================
  describe('validateRequest', () => {
    it('should pass validation for a valid request', () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
        { field: 'count', type: 'number', required: true },
      ];
      const request = makeRequest({
        body: { name: 'test-build', count: 5 },
      });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when a required field is missing', () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
      ];
      const request = makeRequest({ body: {} });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'name' is required");
    });

    it('should fail when a field has the wrong type', () => {
      const rules: ValidationRule[] = [
        { field: 'count', type: 'number', required: true },
      ];
      const request = makeRequest({ body: { count: 'not-a-number' } });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("must be of type 'number'");
    });

    it('should fail when a string does not match the pattern', () => {
      const rules: ValidationRule[] = [
        {
          field: 'email',
          type: 'string',
          required: true,
          pattern: /^[^@]+@[^@]+\.[^@]+$/,
        },
      ];
      const request = makeRequest({ body: { email: 'not-an-email' } });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('does not match the required pattern');
    });

    it('should pass when a string matches the pattern', () => {
      const rules: ValidationRule[] = [
        {
          field: 'email',
          type: 'string',
          required: true,
          pattern: /^[^@]+@[^@]+\.[^@]+$/,
        },
      ];
      const request = makeRequest({ body: { email: 'user@example.com' } });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(true);
    });

    it('should fail when a number is below min', () => {
      const rules: ValidationRule[] = [
        { field: 'age', type: 'number', required: true, min: 0 },
      ];
      const request = makeRequest({ body: { age: -1 } });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be at least 0');
    });

    it('should fail when a number exceeds max', () => {
      const rules: ValidationRule[] = [
        { field: 'age', type: 'number', required: true, max: 150 },
      ];
      const request = makeRequest({ body: { age: 200 } });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be at most 150');
    });

    it('should pass when a number is within min/max range', () => {
      const rules: ValidationRule[] = [
        { field: 'age', type: 'number', required: true, min: 0, max: 150 },
      ];
      const request = makeRequest({ body: { age: 25 } });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(true);
    });

    it('should fail when a string exceeds maxLength', () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true, maxLength: 5 },
      ];
      const request = makeRequest({ body: { name: 'toolongname' } });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum length of 5');
    });

    it('should pass when a string is within maxLength', () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true, maxLength: 10 },
      ];
      const request = makeRequest({ body: { name: 'hello' } });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(true);
    });

    it('should collect multiple validation errors', () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
        { field: 'count', type: 'number', required: true },
        { field: 'active', type: 'boolean', required: true },
      ];
      const request = makeRequest({ body: {} });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    it('should skip optional fields that are absent', () => {
      const rules: ValidationRule[] = [
        { field: 'optional', type: 'string', required: false },
      ];
      const request = makeRequest({ body: {} });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle request with no body', () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
      ];
      const request = makeRequest({ body: undefined });

      const result = validateRequest(request, rules);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'name' is required");
    });
  });

  // ========================================================================
  // validateBuildId
  // ========================================================================
  describe('validateBuildId', () => {
    it('should accept a valid alphanumeric build ID', () => {
      const result = validateBuildId('build-123-abc');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept a simple numeric ID', () => {
      const result = validateBuildId('12345');
      expect(result.valid).toBe(true);
    });

    it('should accept a build ID with hyphens', () => {
      const result = validateBuildId('my-build-2024-01-15');
      expect(result.valid).toBe(true);
    });

    it('should reject an empty build ID', () => {
      const result = validateBuildId('');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must not be empty');
    });

    it('should reject a build ID exceeding 128 characters', () => {
      const longId = 'a'.repeat(129);
      const result = validateBuildId(longId);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must not exceed 128 characters');
    });

    it('should accept a build ID of exactly 128 characters', () => {
      const maxId = 'a'.repeat(128);
      const result = validateBuildId(maxId);
      expect(result.valid).toBe(true);
    });

    it('should reject SQL injection attempts', () => {
      const result = validateBuildId("'; DROP TABLE builds;--");
      expect(result.valid).toBe(false);
    });

    it('should reject path traversal attempts with ../', () => {
      const result = validateBuildId('../../etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('should reject path traversal with backslashes', () => {
      const result = validateBuildId('..\\..\\windows\\system32');
      expect(result.valid).toBe(false);
    });

    it('should reject build IDs with special characters', () => {
      const result = validateBuildId('build<script>alert(1)</script>');
      expect(result.valid).toBe(false);
    });

    it('should reject build IDs with spaces', () => {
      const result = validateBuildId('build with spaces');
      expect(result.valid).toBe(false);
    });
  });

  // ========================================================================
  // validateQueryParams
  // ========================================================================
  describe('validateQueryParams', () => {
    it('should pass when all params are allowed', () => {
      const result = validateQueryParams(
        { page: '1', limit: '20' },
        ['page', 'limit', 'sort'],
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when query is undefined', () => {
      const result = validateQueryParams(undefined, ['page']);
      expect(result.valid).toBe(true);
    });

    it('should pass when query is empty', () => {
      const result = validateQueryParams({}, ['page']);
      expect(result.valid).toBe(true);
    });

    it('should reject unknown query parameters', () => {
      const result = validateQueryParams(
        { page: '1', hacked: 'true' },
        ['page', 'limit'],
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Unknown query parameter: 'hacked'");
    });

    it('should collect multiple unknown parameter errors', () => {
      const result = validateQueryParams(
        { foo: '1', bar: '2', baz: '3' },
        [],
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  // ========================================================================
  // withValidation
  // ========================================================================
  describe('withValidation', () => {
    it('should call the handler when validation passes', () => {
      const handler = vi.fn<(req: ApiRequest) => ApiResponse<string>>().mockReturnValue({
        status: 200,
        data: 'success',
      });

      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
      ];

      const wrapped = withValidation(handler, rules);
      const request = makeRequest({ body: { name: 'test' } });
      const response = wrapped(request);

      expect(handler).toHaveBeenCalledWith(request);
      expect(response).toEqual({ status: 200, data: 'success' });
    });

    it('should return 400 when validation fails', () => {
      const handler = vi.fn<(req: ApiRequest) => ApiResponse<string>>();

      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
      ];

      const wrapped = withValidation(handler, rules);
      const request = makeRequest({ body: {} });
      const response = wrapped(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response).toEqual({
        status: 400,
        error: expect.stringContaining("Field 'name' is required"),
      });
    });

    it('should include all validation errors in the 400 response', () => {
      const handler = vi.fn<(req: ApiRequest) => ApiResponse<string>>();

      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
        { field: 'count', type: 'number', required: true },
      ];

      const wrapped = withValidation(handler, rules);
      const request = makeRequest({ body: {} });
      const response = wrapped(request);

      expect(handler).not.toHaveBeenCalled();
      const apiResponse = response as ApiResponse<string>;
      expect(apiResponse.status).toBe(400);
      expect(apiResponse.error).toContain("Field 'name' is required");
      expect(apiResponse.error).toContain("Field 'count' is required");
    });

    it('should work with async handlers', async () => {
      const handler = vi.fn<(req: ApiRequest) => Promise<ApiResponse<string>>>()
        .mockResolvedValue({
          status: 201,
          data: 'created',
        });

      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
      ];

      const wrapped = withValidation(handler, rules);
      const request = makeRequest({ body: { name: 'test' } });
      const response = await wrapped(request);

      expect(handler).toHaveBeenCalledWith(request);
      expect(response).toEqual({ status: 201, data: 'created' });
    });

    it('should return sync 400 even when handler is async', () => {
      const handler = vi.fn<(req: ApiRequest) => Promise<ApiResponse<string>>>();

      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
      ];

      const wrapped = withValidation(handler, rules);
      const request = makeRequest({ body: {} });
      const response = wrapped(request);

      // Should be a plain object, not a promise
      expect(handler).not.toHaveBeenCalled();
      expect(response).toEqual({
        status: 400,
        error: expect.stringContaining("Field 'name' is required"),
      });
    });
  });
});
