// Security Model — R20-02
// CSP generation, allowlist validation, fs scope checking

import type { SecurityModel } from './types.js';

export interface SecurityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SecurityManager {
  private model: SecurityModel;

  constructor(model: SecurityModel) {
    this.model = model;
  }

  /**
   * Validate a command against the allowlist
   */
  validateCommand(command: string): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if command is in allowlist
    if (!this.model.allowlist.includes(command)) {
      errors.push(`Command '${command}' is not in allowlist`);
    }

    // Check for dangerous commands
    const dangerousCommands = ['eval', 'exec', 'system', 'shell'];
    if (dangerousCommands.some(d => command.toLowerCase().includes(d))) {
      if (this.model.noShell) {
        errors.push(`Shell execution is disabled: ${command}`);
      } else {
        warnings.push(`Potentially dangerous command: ${command}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if a file path is within the allowed scope
   */
  validateFilePath(path: string): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Normalize path
    const normalizedPath = this.normalizePath(path);

    // Check against fs scope
    const inScope = this.model.fsScope.some(scope => {
      const normalizedScope = this.normalizeScope(scope);
      return normalizedPath.startsWith(normalizedScope) ||
             this.matchesGlobPattern(normalizedPath, normalizedScope);
    });

    if (!inScope) {
      errors.push(`Path '${path}' is outside of allowed filesystem scope`);
    }

    // Check for path traversal
    if (path.includes('..') || path.includes('~')) {
      warnings.push(`Path may contain traversal characters: ${path}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate Content Security Policy header
   */
  generateCSP(): string {
    return this.model.csp;
  }

  /**
   * Get allowed origins from CSP
   */
  getAllowedOrigins(): string[] {
    const csp = this.model.csp;
    const origins: string[] = [];

    // Extract from connect-src, script-src, etc.
    const srcDirectives = ['default-src', 'script-src', 'style-src', 'connect-src'];
    
    for (const directive of srcDirectives) {
      const match = csp.match(new RegExp(`${directive}([^;]+)`));
      if (match) {
        const sources = match[1].trim().split(/\s+/);
        origins.push(...sources.filter(s => s !== "'self'" && !s.startsWith("'")));
      }
    }

    return [...new Set(origins)];
  }

  /**
   * Check if shell execution is allowed
   */
  isShellAllowed(): boolean {
    return !this.model.noShell;
  }

  /**
   * Validate complete security model
   */
  validateModel(): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check allowlist
    if (this.model.allowlist.length === 0) {
      warnings.push('Allowlist is empty - all commands will be rejected');
    }

    // Check fs scope
    if (this.model.fsScope.length === 0) {
      warnings.push('Filesystem scope is empty - file operations may fail');
    }

    // Validate CSP
    if (!this.model.csp.includes("default-src")) {
      warnings.push('CSP should include default-src directive');
    }

    // Check for overly permissive patterns
    for (const scope of this.model.fsScope) {
      if (scope === '*' || scope === '/' || scope === '$HOME') {
        warnings.push(`Overly permissive filesystem scope: ${scope}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize a path for safe usage
   */
  sanitizePath(path: string): string {
    // Remove null bytes
    let sanitized = path.replace(/\0/g, '');
    
    // Normalize separators
    sanitized = sanitized.replace(/\\/g, '/');
    
    // Remove leading/trailing whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  private normalizePath(path: string): string {
    return path
      .replace(/\\/g, '/')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  private normalizeScope(scope: string): string {
    // Strip trailing slashes from env var values before interpolating
    const home = (process.env['HOME'] ?? '~').replace(/\/$/, '');
    const pwd = (process.env['PWD'] ?? '$PWD').replace(/\/$/, '');
    const tmpdir = (process.env['TMPDIR'] ?? '/tmp').replace(/\/$/, '');

    let normalized = scope
      .replace(/^~/, home)
      .replace(/\$HOME/g, home)
      .replace(/\$PWD/g, pwd)
      .replace(/\$TMPDIR/g, tmpdir)
      .replace(/\\/g, '/')
      .replace(/\/$/, '')
      .toLowerCase();

    return normalized;
  }

  private matchesGlobPattern(path: string, pattern: string): boolean {
    // Simple glob matching for ** and *
    const regex = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*');
    
    return new RegExp(`^${regex}`).test(path);
  }
}

export function createSecurityManager(model: SecurityModel): SecurityManager {
  return new SecurityManager(model);
}
