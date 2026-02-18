// Dependency Analysis - Architecture visualization and circular detection
// Auto-generate architecture diagrams and analyze code relationships

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';

interface FileNode {
  id: string;
  path: string;
  name: string;
  extension: string;
  size: number;
  imports: ImportEdge[];
  exports: string[];
  dependencies: string[]; // Files this file depends on
  dependents: string[];   // Files that depend on this
}

interface ImportEdge {
  source: string;
  target: string;
  type: 'relative' | 'absolute' | 'node_module';
  moduleName?: string;
  line: number;
}

interface DependencyGraph {
  files: Map<string, FileNode>;
  edges: ImportEdge[];
  circularDependencies: string[][];
  orphanFiles: string[];
  coreFiles: string[]; // Most depended upon
}

interface ArchitectureMetrics {
  totalFiles: number;
  totalLines: number;
  averageDependencies: number;
  maxDepth: number;
  modularity: number; // 0-1, higher is better
  instability: number; // 0-1, lower is better
}

// Parse imports from TypeScript/JavaScript files
function parseImports(content: string, filePath: string): ImportEdge[] {
  const imports: ImportEdge[] = [];
  const lines = content.split('\n');

  // Match ES6 imports
  const importRegex = /import\s+(?:(?:\{[^}]*\}|[^'"]*)\s+from\s+)?['"]([^'"]+)['"];?/g;
  
  // Match require()
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;

    // ES6 imports
    while ((match = importRegex.exec(line)) !== null) {
      const modulePath = match[1];
      imports.push({
        source: filePath,
        target: modulePath,
        type: classifyImport(modulePath),
        moduleName: modulePath,
        line: i + 1,
      });
    }

    // Require
    while ((match = requireRegex.exec(line)) !== null) {
      const modulePath = match[1];
      imports.push({
        source: filePath,
        target: modulePath,
        type: classifyImport(modulePath),
        moduleName: modulePath,
        line: i + 1,
      });
    }
  }

  return imports;
}

// Classify import type
function classifyImport(modulePath: string): 'relative' | 'absolute' | 'node_module' {
  if (modulePath.startsWith('.')) return 'relative';
  if (modulePath.startsWith('/')) return 'absolute';
  if (modulePath.startsWith('@/')) return 'absolute';
  return 'node_module';
}

// Parse exports
function parseExports(content: string): string[] {
  const exports: string[] = [];
  
  // Named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Default export
  if (/export\s+default/.test(content)) {
    exports.push('default');
  }

  return exports;
}

// Resolve import path to actual file
function resolveImportPath(importPath: string, fromFile: string): string | null {
  if (importPath.startsWith('.')) {
    const dir = dirname(fromFile);
    const resolved = join(dir, importPath);
    
    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
    for (const ext of extensions) {
      try {
        const fullPath = resolved + ext;
        statSync(fullPath);
        return fullPath;
      } catch {
        continue;
      }
    }
  }
  return null;
}

// Build dependency graph
export async function buildDependencyGraph(rootDir: string): Promise<DependencyGraph> {
  const files = new Map<string, FileNode>();
  const edges: ImportEdge[] = [];
  const scannedFiles = new Set<string>();

  async function scanDirectory(dir: string): Promise<void> {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      // Skip node_modules and hidden
      if (entry === 'node_modules' || entry.startsWith('.')) continue;

      if (stat.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (isSourceFile(entry)) {
        await scanFile(fullPath);
      }
    }
  }

  async function scanFile(filePath: string): Promise<void> {
    if (scannedFiles.has(filePath)) return;
    scannedFiles.add(filePath);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const imports = parseImports(content, filePath);
      const exports = parseExports(content);
      const stat = statSync(filePath);

      const node: FileNode = {
        id: filePath,
        path: filePath,
        name: filePath.split('/').pop() || '',
        extension: extname(filePath),
        size: stat.size,
        imports,
        exports,
        dependencies: [],
        dependents: [],
      };

      files.set(filePath, node);
      edges.push(...imports);
    } catch (error) {
      console.error(`Failed to scan ${filePath}:`, error);
    }
  }

  await scanDirectory(rootDir);

  // Resolve dependencies
  for (const [path, node] of files) {
    for (const imp of node.imports) {
      if (imp.type === 'relative') {
        const resolved = resolveImportPath(imp.target, path);
        if (resolved && files.has(resolved)) {
          node.dependencies.push(resolved);
          const targetNode = files.get(resolved);
          if (targetNode) {
            targetNode.dependents.push(path);
          }
        }
      }
    }
  }

  // Find circular dependencies
  const circular = detectCircularDependencies(files);

  // Find orphan files (no imports, no dependents)
  const orphans = Array.from(files.values())
    .filter(f => f.dependencies.length === 0 && f.dependents.length === 0)
    .map(f => f.path);

  // Find core files (most depended upon)
  const coreFiles = Array.from(files.values())
    .sort((a, b) => b.dependents.length - a.dependents.length)
    .slice(0, 10)
    .map(f => f.path);

  return {
    files,
    edges,
    circularDependencies: circular,
    orphanFiles: orphans,
    coreFiles,
  };
}

// Detect circular dependencies using DFS
function detectCircularDependencies(files: Map<string, FileNode>): string[][] {
  const circular: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const node = files.get(nodeId);
    if (node) {
      for (const dep of node.dependencies) {
        if (!visited.has(dep)) {
          dfs(dep);
        } else if (recStack.has(dep)) {
          // Found cycle
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart);
          circular.push([...cycle, dep]);
        }
      }
    }

    path.pop();
    recStack.delete(nodeId);
  }

  for (const fileId of files.keys()) {
    if (!visited.has(fileId)) {
      dfs(fileId);
    }
  }

  return circular;
}

// Check if file is a source file
function isSourceFile(filename: string): boolean {
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  return extensions.some(ext => filename.endsWith(ext));
}

// Calculate metrics
export function calculateMetrics(graph: DependencyGraph): ArchitectureMetrics {
  const fileCount = graph.files.size;
  let totalLines = 0;
  let totalDeps = 0;
  let maxDepth = 0;

  for (const node of graph.files.values()) {
    totalLines += node.size / 50; // Rough estimate: 50 bytes per line
    totalDeps += node.dependencies.length;
  }

  // Calculate max depth (longest dependency chain)
  for (const [startNode] of graph.files) {
    const depth = calculateDepth(startNode, graph.files, new Set());
    maxDepth = Math.max(maxDepth, depth);
  }

  return {
    totalFiles: fileCount,
    totalLines: Math.round(totalLines),
    averageDependencies: fileCount > 0 ? totalDeps / fileCount : 0,
    maxDepth,
    modularity: calculateModularity(graph),
    instability: calculateInstability(graph),
  };
}

function calculateDepth(nodeId: string, files: Map<string, FileNode>, visited: Set<string>): number {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);

  const node = files.get(nodeId);
  if (!node || node.dependencies.length === 0) return 1;

  let maxDepDepth = 0;
  for (const dep of node.dependencies) {
    const depDepth = calculateDepth(dep, files, new Set(visited));
    maxDepDepth = Math.max(maxDepDepth, depDepth);
  }

  return 1 + maxDepDepth;
}

function calculateModularity(graph: DependencyGraph): number {
  // Simplified: ratio of internal vs external dependencies
  let internal = 0;
  let external = 0;

  for (const edge of graph.edges) {
    if (edge.type === 'relative') internal++;
    else external++;
  }

  const total = internal + external;
  return total > 0 ? internal / total : 0;
}

function calculateInstability(graph: DependencyGraph): number {
  // Ratio of outgoing to total dependencies
  let outgoing = 0;
  let total = 0;

  for (const node of graph.files.values()) {
    outgoing += node.dependencies.length;
    total += node.dependencies.length + node.dependents.length;
  }

  return total > 0 ? outgoing / total : 0;
}

// Generate Mermaid diagram
export function generateMermaidDiagram(graph: DependencyGraph): string {
  const lines = ['graph TD'];
  const added = new Set<string>();

  // Add nodes
  for (const [path, node] of graph.files) {
    const id = pathToId(path);
    const label = node.name;
    lines.push(`  ${id}["${label}"]`);
  }

  lines.push('');

  // Add edges
  for (const [path, node] of graph.files) {
    const sourceId = pathToId(path);
    
    for (const dep of node.dependencies) {
      const targetId = pathToId(dep);
      const edgeKey = `${sourceId}->${targetId}`;
      
      if (!added.has(edgeKey)) {
        lines.push(`  ${sourceId} --> ${targetId}`);
        added.add(edgeKey);
      }
    }
  }

  // Style circular dependencies in red
  if (graph.circularDependencies.length > 0) {
    lines.push(`  linkStyle default stroke:#ff0000,stroke-width:2px`);
  }

  return lines.join('\n');
}

// Generate architecture report
export function generateArchitectureReport(graph: DependencyGraph): string {
  const metrics = calculateMetrics(graph);
  
  if (!metrics) {
    return 'Error: Could not calculate metrics';
  }
  
  const lines = [
    '🏗️  Architecture Analysis Report',
    '═══════════════════════════════════════════════════',
    '',
    '📊 Metrics',
    `  Total Files: ${metrics.totalFiles}`,
    `  Est. Lines of Code: ${metrics.totalLines.toLocaleString()}`,
    `  Avg Dependencies/File: ${metrics.averageDependencies.toFixed(2)}`,
    `  Max Dependency Depth: ${metrics.maxDepth}`,
    `  Modularity: ${(metrics.modularity * 100).toFixed(1)}%`,
    `  Instability: ${(metrics.instability * 100).toFixed(1)}%`,
    '',
  ];

  if (graph.circularDependencies.length > 0) {
    lines.push('⚠️  Circular Dependencies Found:');
    for (const cycle of graph.circularDependencies.slice(0, 5)) {
      lines.push(`  ${cycle.join(' → ')}`);
    }
    lines.push('');
  }

  if (graph.orphanFiles.length > 0) {
    lines.push('🤔 Orphan Files (no imports or dependents):');
    for (const file of graph.orphanFiles.slice(0, 5)) {
      lines.push(`  - ${file}`);
    }
    lines.push('');
  }

  lines.push('🏛️  Core Files (most depended upon):');
  for (const file of graph.coreFiles.slice(0, 5)) {
    const node = graph.files.get(file);
    lines.push(`  - ${node?.name} (${node?.dependents.length} dependents)`);
  }
  lines.push('');

  lines.push('📈 Recommendations:');
  if (metrics.maxDepth > 10) {
    lines.push('  - High dependency depth detected. Consider refactoring.');
  }
  if (graph.circularDependencies.length > 0) {
    lines.push('  - Circular dependencies found. Break these cycles.');
  }
  if (metrics.modularity < 0.5) {
    lines.push('  - Low modularity. More external dependencies than internal.');
  }
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}

// Helper to convert path to valid Mermaid ID
function pathToId(path: string): string {
  return path
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

// CLI command handler
export async function analyzeDependencies(dir: string = process.cwd()): Promise<void> {
  console.log('🔍 Analyzing dependencies...');
  
  const graph = await buildDependencyGraph(dir);
  
  // Log metrics summary
  const m = calculateMetrics(graph);
  console.log(`📊 Analyzed ${m.totalFiles} files, ~${m.totalLines} lines`);
  
  console.log(generateArchitectureReport(graph));
  console.log('');
  console.log('📊 Mermaid Diagram:');
  console.log(generateMermaidDiagram(graph));
}
