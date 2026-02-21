// KMS-27: Dependency Analyzer Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateMetrics,
  generateMermaidDiagram,
  generateArchitectureReport,
  analyzeDependencies,
} from '../analyzer.js';

// Mock fs module with hoisted functions
const mockReadFileSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockStatSync = vi.fn();

vi.mock('fs', () => ({
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  readdirSync: (...args: any[]) => mockReaddirSync(...args),
  statSync: (...args: any[]) => mockStatSync(...args),
}));

describe('Dependency Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateMetrics', () => {
    it('should calculate basic metrics', () => {
      const files = new Map([
        ['a.ts', {
          id: 'a.ts',
          path: 'a.ts',
          name: 'a.ts',
          extension: '.ts',
          size: 500,
          imports: [],
          exports: [],
          dependencies: ['b.ts'],
          dependents: [],
        }],
        ['b.ts', {
          id: 'b.ts',
          path: 'b.ts',
          name: 'b.ts',
          extension: '.ts',
          size: 300,
          imports: [],
          exports: [],
          dependencies: [],
          dependents: ['a.ts'],
        }],
      ]);

      const graph = {
        files,
        edges: [{ source: 'a.ts', target: './b', type: 'relative' as const, line: 1 }],
        circularDependencies: [],
        orphanFiles: [],
        coreFiles: [],
      };

      const metrics = calculateMetrics(graph);

      expect(metrics.totalFiles).toBe(2);
      expect(metrics.averageDependencies).toBe(0.5);
      expect(metrics.totalLines).toBeGreaterThan(0);
    });

    it('should calculate modularity correctly', () => {
      const graph = {
        files: new Map(),
        edges: [
          { source: 'a.ts', target: './b', type: 'relative' as const, line: 1 },
          { source: 'a.ts', target: './c', type: 'relative' as const, line: 1 },
          { source: 'b.ts', target: 'external', type: 'node_module' as const, line: 1 },
        ],
        circularDependencies: [],
        orphanFiles: [],
        coreFiles: [],
      };

      const metrics = calculateMetrics(graph);

      expect(metrics.modularity).toBe(2 / 3);
    });

    it('should calculate instability correctly', () => {
      const graph = {
        files: new Map([
          ['a.ts', { dependencies: ['b.ts'], dependents: [] } as any],
          ['b.ts', { dependencies: [], dependents: ['a.ts'] } as any],
        ]),
        edges: [],
        circularDependencies: [],
        orphanFiles: [],
        coreFiles: [],
      };

      const metrics = calculateMetrics(graph);

      expect(metrics.instability).toBe(0.5);
    });

    it('should handle empty graph', () => {
      const graph = {
        files: new Map(),
        edges: [],
        circularDependencies: [],
        orphanFiles: [],
        coreFiles: [],
      };

      const metrics = calculateMetrics(graph);

      expect(metrics.totalFiles).toBe(0);
      expect(metrics.averageDependencies).toBe(0);
      expect(metrics.modularity).toBe(0);
    });
  });

  describe('generateMermaidDiagram', () => {
    it('should generate valid Mermaid syntax', () => {
      const files = new Map([
        ['a.ts', {
          id: 'a.ts',
          path: 'src/a.ts',
          name: 'a.ts',
          extension: '.ts',
          size: 100,
          imports: [],
          exports: [],
          dependencies: ['b.ts'],
          dependents: [],
        }],
        ['b.ts', {
          id: 'b.ts',
          path: 'src/b.ts',
          name: 'b.ts',
          extension: '.ts',
          size: 100,
          imports: [],
          exports: [],
          dependencies: [],
          dependents: ['a.ts'],
        }],
      ]);

      const graph = {
        files,
        edges: [],
        circularDependencies: [],
        orphanFiles: [],
        coreFiles: [],
      };

      const diagram = generateMermaidDiagram(graph);

      expect(diagram).toContain('graph TD');
      expect(diagram).toContain('a_ts');
      expect(diagram).toContain('b_ts');
      expect(diagram).toContain('-->');
    });

    it('should style circular dependencies in red', () => {
      const files = new Map([
        ['a.ts', { id: 'a.ts', path: 'a.ts', name: 'a.ts', extension: '.ts', size: 100, imports: [], exports: [], dependencies: ['b.ts'], dependents: [] }],
        ['b.ts', { id: 'b.ts', path: 'b.ts', name: 'b.ts', extension: '.ts', size: 100, imports: [], exports: [], dependencies: ['a.ts'], dependents: [] }],
      ]);

      const graph = {
        files,
        edges: [],
        circularDependencies: [['a.ts', 'b.ts', 'a.ts']],
        orphanFiles: [],
        coreFiles: [],
      };

      const diagram = generateMermaidDiagram(graph);

      expect(diagram).toContain('linkStyle default stroke:#ff0000');
    });

    it('should avoid duplicate edges', () => {
      const files = new Map([
        ['a.ts', { id: 'a.ts', path: 'a.ts', name: 'a.ts', extension: '.ts', size: 100, imports: [], exports: [], dependencies: ['b.ts', 'b.ts'], dependents: [] }],
        ['b.ts', { id: 'b.ts', path: 'b.ts', name: 'b.ts', extension: '.ts', size: 100, imports: [], exports: [], dependencies: [], dependents: [] }],
      ]);

      const graph = {
        files,
        edges: [],
        circularDependencies: [],
        orphanFiles: [],
        coreFiles: [],
      };

      const diagram = generateMermaidDiagram(graph);

      const matches = diagram.match(/a_ts --> b_ts/g);
      expect(matches?.length).toBe(1);
    });
  });

  describe('generateArchitectureReport', () => {
    it('should include metrics section', () => {
      const graph = {
        files: new Map([['a.ts', { dependencies: [], dependents: [], name: 'a.ts' } as any]]),
        edges: [],
        circularDependencies: [],
        orphanFiles: [],
        coreFiles: [],
      };

      const report = generateArchitectureReport(graph);

      expect(report).toContain('Architecture Analysis Report');
      expect(report).toContain('Total Files:');
      expect(report).toContain('Modularity:');
    });

    it('should warn about circular dependencies', () => {
      const graph = {
        files: new Map(),
        edges: [],
        circularDependencies: [['a.ts', 'b.ts', 'a.ts']],
        orphanFiles: [],
        coreFiles: [],
      };

      const report = generateArchitectureReport(graph);

      expect(report).toContain('Circular Dependencies Found');
    });

    it('should list orphan files', () => {
      const graph = {
        files: new Map(),
        edges: [],
        circularDependencies: [],
        orphanFiles: ['unused.ts'],
        coreFiles: [],
      };

      const report = generateArchitectureReport(graph);

      expect(report).toContain('Orphan Files');
      expect(report).toContain('unused.ts');
    });

    it('should list core files', () => {
      const graph = {
        files: new Map([
          ['core.ts', { name: 'core.ts', dependents: ['a.ts', 'b.ts'], dependencies: [] } as any],
        ]),
        edges: [],
        circularDependencies: [],
        orphanFiles: [],
        coreFiles: ['core.ts'],
      };

      const report = generateArchitectureReport(graph);

      expect(report).toContain('Core Files');
      expect(report).toContain('core.ts');
    });

    it('should include recommendations', () => {
      const graph = {
        files: new Map(),
        edges: [],
        circularDependencies: [],
        orphanFiles: [],
        coreFiles: [],
      };

      const report = generateArchitectureReport(graph);

      expect(report).toContain('Recommendations:');
    });
  });

  describe('analyzeDependencies', () => {
    it('should log analysis progress', async () => {
      mockReaddirSync.mockReturnValue(['file.ts']);
      mockStatSync.mockReturnValue({
        isDirectory: () => false,
        isFile: () => true,
        size: 100,
      });
      mockReadFileSync.mockReturnValue('export const a = 1;');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await analyzeDependencies('/project');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzing'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzed'));

      consoleSpy.mockRestore();
    });
  });
});
