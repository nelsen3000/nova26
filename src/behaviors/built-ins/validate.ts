// Validation Behavior - Result validation
// KIMI-W-03: Built-in behavior

import type {
  Behavior,
  BehaviorContext,
  BehaviorResult,
  ValidationConfig,
} from '../types.js';

/**
 * Validation error - thrown when result fails validation
 */
export class ValidationError extends Error {
  constructor(
    public readonly failedValidators: number,
    public readonly details: string[]
  ) {
    super(`${failedValidators} validator(s) failed: ${details.join(', ')}`);
    this.name = 'ValidationError';
  }
}

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  name: 'validate',
  validators: [],
  throwOnInvalid: true,
  enabled: true,
  timeoutMs: 30000,
};

/**
 * Validation behavior implementation
 */
export class ValidationBehavior implements Behavior<ValidationConfig> {
  readonly name = 'validate';
  config: ValidationConfig;
  private validationHistory: Map<string, { passed: boolean; failed: number }> = new Map();

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  }

  async execute<T>(
    operation: (ctx: BehaviorContext) => Promise<T>,
    context: BehaviorContext
  ): Promise<BehaviorResult<T>> {
    const startTime = Date.now();
    
    try {
      // Execute the operation first
      const data = await operation(context);
      
      // Run validators
      const results = await Promise.all(
        this.config.validators.map(async validator => {
          try {
            return await validator(data);
          } catch {
            return false;
          }
        })
      );
      
      const failedCount = results.filter(r => !r).length;
      
      // Track validation result
      this.validationHistory.set(context.executionId, {
        passed: failedCount === 0,
        failed: failedCount,
      });
      
      if (failedCount > 0) {
        const details = results.map((r, i) => `validator-${i + 1}: ${r ? 'pass' : 'fail'}`);
        const error = new ValidationError(failedCount, details);
        
        if (this.config.throwOnInvalid) {
          return {
            success: false,
            error,
            durationMs: Date.now() - startTime,
            attempts: 1,
            metadata: {
              validated: true,
              passed: false,
              failedValidators: failedCount,
              totalValidators: this.config.validators.length,
            },
          };
        }
      }
      
      return {
        success: true,
        data,
        durationMs: Date.now() - startTime,
        attempts: 1,
        metadata: {
          validated: true,
          passed: failedCount === 0,
          failedValidators: failedCount,
          totalValidators: this.config.validators.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - startTime,
        attempts: 1,
        metadata: {
          validated: false,
          operationFailed: true,
        },
      };
    }
  }

  reset(): void {
    this.validationHistory.clear();
  }

  /**
   * Add a validator dynamically
   */
  addValidator(validator: (result: unknown) => boolean | Promise<boolean>): void {
    this.config.validators.push(validator);
  }

  /**
   * Remove all validators
   */
  clearValidators(): void {
    this.config.validators = [];
  }

  /**
   * Get validation result for an execution
   */
  getValidationResult(executionId: string): { passed: boolean; failed: number } | undefined {
    return this.validationHistory.get(executionId);
  }

  /**
   * Get validation statistics
   */
  getStats(): {
    total: number;
    passed: number;
    failed: number;
  } {
    const results = Array.from(this.validationHistory.values());
    return {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
    };
  }
}

/**
 * Create validation behavior factory
 */
export function createValidationBehavior(
  config?: Partial<ValidationConfig>
): ValidationBehavior {
  return new ValidationBehavior(config);
}

/**
 * Common validators
 */
export const CommonValidators = {
  /** Validate result is not null or undefined */
  notNull: (result: unknown): boolean => result !== null && result !== undefined,
  
  /** Validate result is not empty (for arrays, strings, objects) */
  notEmpty: (result: unknown): boolean => {
    if (Array.isArray(result)) return result.length > 0;
    if (typeof result === 'string') return result.length > 0;
    if (typeof result === 'object' && result !== null) {
      return Object.keys(result).length > 0;
    }
    return true;
  },
  
  /** Validate result is an array */
  isArray: (result: unknown): boolean => Array.isArray(result),
  
  /** Validate result is an object */
  isObject: (result: unknown): boolean => 
    typeof result === 'object' && result !== null && !Array.isArray(result),
  
  /** Validate result has specific properties */
  hasProperties: (...props: string[]) => 
    (result: unknown): boolean => {
      if (typeof result !== 'object' || result === null) return false;
      return props.every(prop => prop in result);
    },
};
