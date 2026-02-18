// Repo Map Generator Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import {
  generateRepoMap,
  extractFileSignatures,
  formatRepoMapForPrompt,
  getCachedRepoMap,
  invalidateRepoMap,
  isRepoMapStale,
  estimateMapTokens,
  findRelevantFiles,
  getRepoMap,
  type RepoMap,
} from './repo-map.js';

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_DIR = join(process.cwd(), 'test-repo-map-temp');

function setupTestDir(): void {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, 'src', 'utils'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'src', 'components'), { recursive: true });
}

function cleanupTestDir(): void {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function createTestFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, relativePath);
  const dir = join(fullPath, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
}

// ============================================================================
// Test Suite
// ============================================================================

describe('generateRepoMap', () => {
  beforeEach(() => {
    setupTestDir();
    invalidateRepoMap(TEST_DIR);
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('creates a valid repo map', () => {
    createTestFile('src/utils/helpers.ts', `
      export const formatDate = (date: Date): string => date.toISOString();
      export function parseJSON(str: string) { return JSON.parse(str); }
    `);
    createTestFile('src/types.ts', `
      export interface User { id: string; name: string; }
      export type Config = { apiUrl: string; };
    `);

    const map = generateRepoMap(TEST_DIR, {
      includePatterns: ['src/**/*.ts'],
      excludePatterns: ['node_modules', 'dist'],
    });

    expect(map.root).toBe(TEST_DIR);
    expect(map.totalFiles).toBe(2);
    expect(map.files).toHaveLength(2);
    expect(map.generatedAt).toBeGreaterThan(0);
    expect(map.totalSize).toBeGreaterThan(0);
  });

  it('respects include patterns', () => {
    createTestFile('src/app.ts', 'export const app = {};');
    createTestFile('lib/helper.ts', 'export const helper = {};');
    createTestFile('test/test.ts', 'export const test = {};');

    const map = generateRepoMap(TEST_DIR, {
      includePatterns: ['src/**/*.ts'],
      excludePatterns: ['node_modules'],
    });

    expect(map.totalFiles).toBe(1);
    expect(map.files[0].path).toBe('src/app.ts');
  });

  it('respects exclude patterns', () => {
    createTestFile('src/app.ts', 'export const app = {};');
    createTestFile('src/test/mock.ts', 'export const mock = {};');
    createTestFile('node_modules/pkg/index.ts', 'export const pkg = {};');

    const map = generateRepoMap(TEST_DIR, {
      includePatterns: ['src/**/*.ts', 'node_modules/**/*.ts'],
      excludePatterns: ['node_modules', 'src/test'],
    });

    expect(map.totalFiles).toBe(1);
    expect(map.files[0].path).toBe('src/app.ts');
  });

  it('caches the generated map', () => {
    createTestFile('src/app.ts', 'export const app = {};');

    const map1 = generateRepoMap(TEST_DIR);
    const cached = getCachedRepoMap(TEST_DIR);

    expect(cached).not.toBeNull();
    expect(cached!.totalFiles).toBe(map1.totalFiles);
    expect(cached!.generatedAt).toBe(map1.generatedAt);
  });
});

describe('extractFileSignatures', () => {
  beforeEach(() => {
    setupTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('finds exported constants and functions', () => {
    createTestFile('src/exports.ts', `
      export const VERSION = '1.0.0';
      export const MAX_SIZE = 100;
      export let count = 0;
      export var oldCount = 0;
    `);

    const sig = extractFileSignatures(join(TEST_DIR, 'src/exports.ts'));

    expect(sig.exports).toContain('VERSION');
    expect(sig.exports).toContain('MAX_SIZE');
    expect(sig.exports).toContain('count');
    expect(sig.exports).toContain('oldCount');
  });

  it('finds exported functions', () => {
    createTestFile('src/functions.ts', `
      export function add(a: number, b: number): number { return a + b; }
      export async function fetchData(url: string) { return fetch(url); }
      export const multiply = (x: number, y: number) => x * y;
    `);

    const sig = extractFileSignatures(join(TEST_DIR, 'src/functions.ts'));

    expect(sig.exports).toContain('add');
    expect(sig.exports).toContain('fetchData');
    expect(sig.exports).toContain('multiply');
    expect(sig.functions).toContain('add(a, b)');
    expect(sig.functions).toContain('fetchData(url)');
    expect(sig.functions.some(f => f.startsWith('multiply'))).toBe(true);
  });

  it('finds class names', () => {
    createTestFile('src/classes.ts', `
      export class User {
        constructor(public name: string) {}
      }
      class InternalHelper {
        help() {}
      }
      export class UserManager {
        users: User[] = [];
      }
    `);

    const sig = extractFileSignatures(join(TEST_DIR, 'src/classes.ts'));

    expect(sig.classes).toContain('User');
    expect(sig.classes).toContain('InternalHelper');
    expect(sig.classes).toContain('UserManager');
    expect(sig.exports).toContain('User');
    expect(sig.exports).toContain('UserManager');
  });

  it('finds type and interface definitions', () => {
    createTestFile('src/types.ts', `
      export interface User {
        id: string;
        name: string;
      }
      export type Config = {
        apiUrl: string;
        timeout: number;
      };
      interface InternalState {
        loading: boolean;
      }
      export enum Status {
        Active,
        Inactive,
      }
    `);

    const sig = extractFileSignatures(join(TEST_DIR, 'src/types.ts'));

    expect(sig.types).toContain('User');
    expect(sig.types).toContain('Config');
    expect(sig.types).toContain('InternalState');
    expect(sig.types).toContain('Status');
    expect(sig.exports).toContain('User');
    expect(sig.exports).toContain('Config');
    expect(sig.exports).toContain('Status');
  });

  it('handles named exports from export blocks', () => {
    createTestFile('src/named-exports.ts', `
      const foo = 1;
      const bar = 2;
      export { foo, bar };
      export { foo as fooAlias };
    `);

    const sig = extractFileSignatures(join(TEST_DIR, 'src/named-exports.ts'));

    expect(sig.exports).toContain('foo');
    expect(sig.exports).toContain('bar');
  });

  it('includes file size and modification time', () => {
    createTestFile('src/sized.ts', 'export const x = 1;');

    const sig = extractFileSignatures(join(TEST_DIR, 'src/sized.ts'));

    expect(sig.size).toBeGreaterThan(0);
    expect(sig.lastModified).toBeGreaterThan(0);
  });

  it('deduplicates exports and functions', () => {
    createTestFile('src/duplicates.ts', `
      export const x = 1;
      export { x };
    `);

    const sig = extractFileSignatures(join(TEST_DIR, 'src/duplicates.ts'));

    const xCount = sig.exports.filter(e => e === 'x').length;
    expect(xCount).toBe(1);
  });
});

describe('formatRepoMapForPrompt', () => {
  beforeEach(() => {
    setupTestDir();
    invalidateRepoMap(TEST_DIR);
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('formats with correct structure', () => {
    createTestFile('src/utils/helpers.ts', `
      export const formatDate = (date: Date) => date.toString();
      export function parseJSON(str: string) { return JSON.parse(str); }
    `);
    createTestFile('src/types.ts', `
      export interface User { id: string; }
      export type Config = { apiUrl: string; };
    `);

    const map = generateRepoMap(TEST_DIR);
    const formatted = formatRepoMapForPrompt(map);

    expect(formatted).toContain('<repo_map>');
    expect(formatted).toContain('</repo_map>');
    expect(formatted).toContain('Project Structure');
    expect(formatted).toContain('2 files');
    expect(formatted).toContain('helpers.ts');
    expect(formatted).toContain('types.ts');
  });

  it('includes exports, functions, classes, and types', () => {
    createTestFile('src/component.ts', `
      export class Button {
        render() {}
        handleClick() {}
      }
      export interface Props {
        label: string;
      }
    `);

    const map = generateRepoMap(TEST_DIR);
    const formatted = formatRepoMapForPrompt(map);

    expect(formatted).toContain('exports:');
    expect(formatted).toContain('Button');
    expect(formatted).toContain('classes:');
    expect(formatted).toContain('types:');
    expect(formatted).toContain('Props');
  });

  it('respects token limit', () => {
    // Create many files to exceed token limit
    for (let i = 0; i < 50; i++) {
      createTestFile(`src/file${i}.ts`, `
        export const var${i} = ${i};
        export function func${i}() { return ${i}; }
      `);
    }

    const map = generateRepoMap(TEST_DIR);
    const formatted = formatRepoMapForPrompt(map, undefined, 500);

    // Should truncate with a message
    expect(formatted).toContain('... (');
    expect(formatted).toContain('more files)');
  });

  it('prioritizes files when query is provided', () => {
    createTestFile('src/utils/date.ts', `
      export const formatDate = (d: Date) => d.toString();
      export class DateHelper {}
    `);
    createTestFile('src/utils/string.ts', `
      export const trim = (s: string) => s.trim();
    `);
    createTestFile('src/api/client.ts', `
      export const fetchData = () => fetch('/api');
    `);

    const map = generateRepoMap(TEST_DIR);
    const formatted = formatRepoMapForPrompt(map, 'date formatting');

    expect(formatted).toContain('date.ts');
    expect(formatted).toContain('DateHelper');
  });

  it('groups files by directory', () => {
    createTestFile('src/a.ts', 'export const a = 1;');
    createTestFile('src/utils/b.ts', 'export const b = 2;');
    createTestFile('src/components/c.ts', 'export const c = 3;');

    const map = generateRepoMap(TEST_DIR);
    const formatted = formatRepoMapForPrompt(map);

    expect(formatted).toContain('src/');
    expect(formatted).toContain('utils/');
    expect(formatted).toContain('components/');
  });
});

describe('cache management', () => {
  beforeEach(() => {
    setupTestDir();
    invalidateRepoMap(TEST_DIR);
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('returns null for cache miss', () => {
    const cached = getCachedRepoMap(TEST_DIR);
    expect(cached).toBeNull();
  });

  it('returns map for cache hit', () => {
    createTestFile('src/app.ts', 'export const app = {};');
    generateRepoMap(TEST_DIR);

    const cached = getCachedRepoMap(TEST_DIR);
    expect(cached).not.toBeNull();
    expect(cached!.totalFiles).toBe(1);
  });

  it('detects stale cache correctly', async () => {
    createTestFile('src/app.ts', 'export const app = {};');
    generateRepoMap(TEST_DIR);

    expect(isRepoMapStale(TEST_DIR, 60000)).toBe(false);

    // Wait long enough for the cache to become older than 1ms
    await new Promise(r => setTimeout(r, 10));

    expect(isRepoMapStale(TEST_DIR, 1)).toBe(true);
  });

  it('returns stale for non-existent cache', () => {
    expect(isRepoMapStale(TEST_DIR, 60000)).toBe(true);
  });

  it('invalidates cache correctly', () => {
    createTestFile('src/app.ts', 'export const app = {};');
    generateRepoMap(TEST_DIR);

    expect(getCachedRepoMap(TEST_DIR)).not.toBeNull();
    
    invalidateRepoMap(TEST_DIR);
    
    expect(getCachedRepoMap(TEST_DIR)).toBeNull();
    expect(isRepoMapStale(TEST_DIR, 60000)).toBe(true);
  });
});

describe('estimateMapTokens', () => {
  it('estimates tokens based on content size', () => {
    const map: RepoMap = {
      root: '/test',
      files: [
        {
          path: 'src/file.ts',
          exports: ['foo', 'bar'],
          functions: ['foo()', 'bar(x)'],
          classes: ['MyClass'],
          types: ['MyType'],
          size: 100,
          lastModified: Date.now(),
        },
      ],
      totalFiles: 1,
      totalSize: 100,
      generatedAt: Date.now(),
    };

    const tokens = estimateMapTokens(map);
    expect(tokens).toBeGreaterThan(0);
    // Rough check: path + exports + functions + classes + types
    // src/file.ts + foo,bar + foo(),bar(x) + MyClass + MyType
    // ≈ 50 chars / 4 ≈ 12 tokens
    expect(tokens).toBeGreaterThanOrEqual(5);
  });

  it('returns 0 for empty map', () => {
    const map: RepoMap = {
      root: '/test',
      files: [],
      totalFiles: 0,
      totalSize: 0,
      generatedAt: Date.now(),
    };

    expect(estimateMapTokens(map)).toBe(0);
  });
});

describe('findRelevantFiles', () => {
  beforeEach(() => {
    setupTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('returns all files for empty query', () => {
    const map: RepoMap = {
      root: '/test',
      files: [
        { path: 'a.ts', exports: [], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
        { path: 'b.ts', exports: [], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
      ],
      totalFiles: 2,
      totalSize: 0,
      generatedAt: Date.now(),
    };

    const results = findRelevantFiles(map, '');
    expect(results).toHaveLength(2);
  });

  it('ranks files by path match highest', () => {
    const map: RepoMap = {
      root: '/test',
      files: [
        { path: 'utils/date.ts', exports: [], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
        { path: 'utils/string.ts', exports: [], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
        { path: 'api/client.ts', exports: [], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
      ],
      totalFiles: 3,
      totalSize: 0,
      generatedAt: Date.now(),
    };

    const results = findRelevantFiles(map, 'date');
    expect(results[0].path).toBe('utils/date.ts');
  });

  it('ranks files by export match', () => {
    const map: RepoMap = {
      root: '/test',
      files: [
        { path: 'a.ts', exports: ['formatDate'], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
        { path: 'b.ts', exports: ['trimString'], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
      ],
      totalFiles: 2,
      totalSize: 0,
      generatedAt: Date.now(),
    };

    const results = findRelevantFiles(map, 'date');
    expect(results[0].path).toBe('a.ts');
  });

  it('ranks files by class match', () => {
    const map: RepoMap = {
      root: '/test',
      files: [
        { path: 'a.ts', exports: [], functions: [], classes: ['UserController'], types: [], size: 0, lastModified: 0 },
        { path: 'b.ts', exports: [], functions: [], classes: ['AuthService'], types: [], size: 0, lastModified: 0 },
      ],
      totalFiles: 2,
      totalSize: 0,
      generatedAt: Date.now(),
    };

    const results = findRelevantFiles(map, 'auth');
    expect(results[0].path).toBe('b.ts');
  });

  it('handles multiple query terms', () => {
    const map: RepoMap = {
      root: '/test',
      files: [
        { path: 'user-auth.ts', exports: ['loginUser'], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
        { path: 'user-profile.ts', exports: ['getUser'], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
        { path: 'settings.ts', exports: ['updateSettings'], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
      ],
      totalFiles: 3,
      totalSize: 0,
      generatedAt: Date.now(),
    };

    const results = findRelevantFiles(map, 'user auth login');
    expect(results[0].path).toBe('user-auth.ts');
  });

  it('ignores short query terms', () => {
    const map: RepoMap = {
      root: '/test',
      files: [
        { path: 'ab.ts', exports: [], functions: [], classes: [], types: [], size: 0, lastModified: 0 },
      ],
      totalFiles: 1,
      totalSize: 0,
      generatedAt: Date.now(),
    };

    const results = findRelevantFiles(map, 'a ab');
    // 'a' is filtered out (length <= 2), 'ab' remains
    expect(results).toHaveLength(1);
  });
});

describe('getRepoMap', () => {
  beforeEach(() => {
    setupTestDir();
    invalidateRepoMap(TEST_DIR);
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('returns cached map if not stale', () => {
    createTestFile('src/app.ts', 'export const app = {};');
    
    const map1 = getRepoMap(TEST_DIR, { cacheDurationMs: 60000 });
    const map2 = getRepoMap(TEST_DIR, { cacheDurationMs: 60000 });

    expect(map1.generatedAt).toBe(map2.generatedAt);
  });

  it('generates new map if stale', async () => {
    createTestFile('src/app.ts', 'export const app = {};');
    
    const map1 = getRepoMap(TEST_DIR, { cacheDurationMs: 1 });
    await new Promise(r => setTimeout(r, 10)); // Wait for cache to stale
    
    // Add another file
    createTestFile('src/new.ts', 'export const newVar = 1;');
    
    const map2 = getRepoMap(TEST_DIR, { cacheDurationMs: 1 });

    expect(map2.generatedAt).toBeGreaterThan(map1.generatedAt);
    expect(map2.totalFiles).toBe(2);
  });
});
