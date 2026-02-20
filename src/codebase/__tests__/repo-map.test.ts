// KMS-27: Repo Map Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadNovaIgnore,
  isIgnored,
  getRelevantSymbols,
  formatRepoContext,
  type RepoMap,
  type Symbol,
} from '../repo-map.js';

// Mock fs module with hoisted functions
const mockReadFileSync = vi.fn();
const mockExistsSync = vi.fn();

vi.mock('fs', () => ({
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  existsSync: (...args: any[]) => mockExistsSync(...args),
}));

describe('Repo Map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadNovaIgnore', () => {
    it('should return empty array when .novaignore does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const patterns = loadNovaIgnore('/project');

      expect(patterns).toEqual([]);
    });

    it('should parse .novaignore file correctly', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`# This is a comment
*.test.ts
secrets/
generated/*.ts`);

      const patterns = loadNovaIgnore('/project');

      expect(patterns).toContain('*.test.ts');
      expect(patterns).toContain('secrets/');
      expect(patterns).toContain('generated/*.ts');
      expect(patterns).not.toContain('# This is a comment');
    });
  });

  describe('isIgnored', () => {
    it('should match exact file patterns', () => {
      expect(isIgnored('file.test.ts', ['file.test.ts'])).toBe(true);
      expect(isIgnored('other.ts', ['file.test.ts'])).toBe(false);
    });

    it('should match directory patterns', () => {
      expect(isIgnored('secrets/passwords.txt', ['secrets/'])).toBe(true);
      expect(isIgnored('other/passwords.txt', ['secrets/'])).toBe(false);
    });

    it('should match glob patterns', () => {
      expect(isIgnored('test.spec.ts', ['*.spec.ts'])).toBe(true);
      expect(isIgnored('src/test.spec.ts', ['*.spec.ts'])).toBe(true);
      expect(isIgnored('test.ts', ['*.spec.ts'])).toBe(false);
    });

    it('should match complex glob patterns', () => {
      expect(isIgnored('src/generated/api.ts', ['src/generated/*'])).toBe(true);
      expect(isIgnored('other/generated/api.ts', ['src/generated/*'])).toBe(false);
    });

    it('should return false when no patterns match', () => {
      expect(isIgnored('file.ts', ['*.js', '*.css'])).toBe(false);
    });
  });

  describe('getRelevantSymbols', () => {
    const mockRepoMap: RepoMap = {
      root: '/project',
      files: [],
      buildTime: 100,
      totalFiles: 2,
      totalSymbols: 3,
      symbols: [
        {
          name: 'fetchUserData',
          kind: 'function',
          file: 'src/api.ts',
          line: 1,
          exported: true,
          references: 5,
        },
        {
          name: 'UserProfile',
          kind: 'interface',
          file: 'src/types.ts',
          line: 1,
          exported: true,
          references: 10,
        },
        {
          name: 'privateHelper',
          kind: 'function',
          file: 'src/utils.ts',
          line: 1,
          exported: false,
          references: 0,
        },
      ],
    };

    it('should return symbols matching task keywords', () => {
      const relevant = getRelevantSymbols(mockRepoMap, 'fetch user data from api');

      expect(relevant.length).toBeGreaterThan(0);
      expect(relevant.some(s => s.name === 'fetchUserData')).toBe(true);
    });

    it('should limit results to maxSymbols', () => {
      const relevant = getRelevantSymbols(mockRepoMap, 'user data', 1);

      expect(relevant.length).toBeLessThanOrEqual(1);
    });

    it('should not return non-exported symbols', () => {
      const relevant = getRelevantSymbols(mockRepoMap, 'helper');

      expect(relevant.some(s => s.name === 'privateHelper')).toBe(false);
    });

    it('should score symbols by reference count', () => {
      const relevant = getRelevantSymbols(mockRepoMap, 'user');

      // UserProfile has more references, should be first
      expect(relevant[0]?.name).toBe('UserProfile');
    });

    it('should return empty array when no keywords match', () => {
      const repoMapWithNoMatches: RepoMap = {
        ...mockRepoMap,
        symbols: [
          {
            name: 'xyzFunction',
            kind: 'function',
            file: 'src/xyz.ts',
            line: 1,
            exported: true,
            references: 0,
          },
        ],
      };
      const relevant = getRelevantSymbols(repoMapWithNoMatches, 'abc def');

      expect(relevant).toEqual([]);
    });
  });

  describe('formatRepoContext', () => {
    const mockRepoMap: RepoMap = {
      root: '/project',
      files: [
        {
          path: '/project/src/index.ts',
          relativePath: 'src/index.ts',
          symbols: [],
          imports: [],
          exports: ['main'],
          lineCount: 50,
        },
      ],
      buildTime: 100,
      totalFiles: 1,
      totalSymbols: 1,
      symbols: [
        {
          name: 'main',
          kind: 'function',
          file: 'src/index.ts',
          line: 1,
          exported: true,
          references: 0,
        },
      ],
    };

    it('should format context with task description', () => {
      const context = formatRepoContext(mockRepoMap, 'test task');

      expect(context).toContain('Codebase Map');
      expect(context).toContain('1 files');
      expect(context).toContain('1 symbols');
    });

    it('should format context without task description (overview mode)', () => {
      const context = formatRepoContext(mockRepoMap);

      expect(context).toContain('Project Structure');
      expect(context).toContain('src/');
    });

    it('should truncate output to maxTokens', () => {
      const longContext = formatRepoContext(mockRepoMap, undefined, 10);

      expect(longContext).toContain('...(truncated)');
    });

    it('should include relevant symbols when task is provided', () => {
      const repoMapWithRelevant: RepoMap = {
        ...mockRepoMap,
        symbols: [
          {
            name: 'processData',
            kind: 'function',
            file: 'src/data.ts',
            line: 5,
            signature: '(data: string) => void',
            exported: true,
            references: 3,
          },
        ],
      };

      const context = formatRepoContext(repoMapWithRelevant, 'process data');

      expect(context).toContain('Relevant Symbols');
      expect(context).toContain('processData');
    });

    it('should include file exports in overview', () => {
      const context = formatRepoContext(mockRepoMap);

      expect(context).toContain('exports:');
      expect(context).toContain('main');
    });
  });
});
