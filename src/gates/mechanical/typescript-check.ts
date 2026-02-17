import { GateResult, LLMResponse } from '../../types/index.js';
import { log } from '../../utils/logger.js';

/**
 * TypeScript check gate (stub for Phase 0)
 * 
 * In Phase 0: Always passes with info message
 * Real implementation will run tsc --noEmit on output files
 */
export async function runTypeScriptCheck(_llmResponse: LLMResponse): Promise<GateResult> {
  log('Gate skipped: typescript-check - no code files to check (Phase 0)');
  
  return {
    gateName: 'typescript-check',
    passed: true,
    message: 'Skipped: no code files to check in Phase 0',
    severity: 'info',
  };
}

/**
 * Check if there are TypeScript files to validate
 */
export async function hasTypeScriptFiles(): Promise<boolean> {
  // Stub for Phase 0 - always returns false
  return false;
}

/**
 * Run tsc on a specific file
 */
export async function checkTypeScriptFile(_filePath: string): Promise<GateResult> {
  // Stub for Phase 0
  return {
    gateName: 'typescript-check',
    passed: true,
    message: 'Skipped: Phase 0 does not run TypeScript checks',
    severity: 'info',
  };
}
