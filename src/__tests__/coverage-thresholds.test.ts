// SN-15: Coverage Threshold Verification
// Ensures vitest coverage config exists and critical modules are testable

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dirname, '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readVitestConfig(): string {
  const configPath = join(rootDir, 'vitest.config.ts');
  return readFileSync(configPath, 'utf-8');
}

function readPackageJson(): Record<string, unknown> {
  const pkgPath = join(rootDir, 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf-8'));
}

function countTestFiles(dir: string): number {
  // Simplified: check key directories have test files
  const { readdirSync, statSync } = require('fs') as typeof import('fs');
  let count = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countTestFiles(fullPath);
      } else if (entry.name.endsWith('.test.ts')) {
        count++;
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Coverage Configuration', () => {
  describe('vitest.config.ts setup', () => {
    it('should have vitest.config.ts at project root', () => {
      expect(existsSync(join(rootDir, 'vitest.config.ts'))).toBe(true);
    });

    it('should configure v8 coverage provider', () => {
      const config = readVitestConfig();
      expect(config).toContain("provider: 'v8'");
    });

    it('should include src/**/*.ts in coverage', () => {
      const config = readVitestConfig();
      expect(config).toContain("include: ['src/**/*.ts']");
    });

    it('should exclude test files from coverage', () => {
      const config = readVitestConfig();
      expect(config).toContain('src/**/*.test.ts');
    });

    it('should set statement coverage threshold to 70%', () => {
      const config = readVitestConfig();
      expect(config).toContain('statements: 70');
    });

    it('should set branch coverage threshold to 60%', () => {
      const config = readVitestConfig();
      expect(config).toContain('branches: 60');
    });

    it('should set function coverage threshold to 70%', () => {
      const config = readVitestConfig();
      expect(config).toContain('functions: 70');
    });

    it('should set line coverage threshold to 70%', () => {
      const config = readVitestConfig();
      expect(config).toContain('lines: 70');
    });
  });

  describe('package.json scripts', () => {
    it('should have test:coverage script', () => {
      const pkg = readPackageJson();
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['test:coverage']).toBeDefined();
    });

    it('test:coverage should run vitest with --coverage', () => {
      const pkg = readPackageJson();
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['test:coverage']).toContain('--coverage');
    });

    it('should have base test script', () => {
      const pkg = readPackageJson();
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['test']).toBeDefined();
    });
  });

  describe('Critical modules have test files', () => {
    const criticalModules = [
      { module: 'orchestrator', dir: 'src/orchestrator' },
      { module: 'model-routing', dir: 'src/model-routing' },
      { module: 'observability', dir: 'src/observability' },
      { module: 'atlas', dir: 'src/atlas' },
      { module: 'workflow-engine', dir: 'src/workflow-engine' },
    ];

    for (const { module, dir } of criticalModules) {
      it(`${module} should have test files`, () => {
        const moduleDir = join(rootDir, dir);
        const testCount = countTestFiles(moduleDir);
        expect(testCount).toBeGreaterThan(0);
      });
    }
  });
});
