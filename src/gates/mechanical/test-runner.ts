import { GateResult, LLMResponse } from '../../types/index.js';
import { log } from '../../utils/logger.js';

/**
 * Test runner gate (stub for Phase 0)
 * 
 * In Phase 0: Always passes with info message
 * Real implementation will run vitest on output files
 */
export async function runTestRunner(_llmResponse: LLMResponse): Promise<GateResult> {
  log('Gate skipped: test-runner - no test files to run (Phase 0)');
  
  return {
    gateName: 'test-runner',
    passed: true,
    message: 'Skipped: no test files to run in Phase 0',
    severity: 'info',
  };
}

/**
 * Check if there are test files to run
 */
export async function hasTestFiles(): Promise<boolean> {
  // Stub for Phase 0 - always returns false
  return false;
}

/**
 * Run tests for a specific file
 */
export async function runTestsForFile(_filePath: string): Promise<GateResult> {
  // Stub for Phase 0
  return {
    gateName: 'test-runner',
    passed: true,
    message: 'Skipped: Phase 0 does not run tests',
    severity: 'info',
  };
}
