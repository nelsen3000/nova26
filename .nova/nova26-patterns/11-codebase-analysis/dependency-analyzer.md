# Dependency Analyzer

## Source
Extracted from Nova26 `src/dependency-analysis/analyzer.ts`

---

## Pattern: Dependency Analyzer

A static analysis system that parses import graphs from TypeScript/JavaScript source files, builds a directed dependency graph, detects circular dependencies via DFS, identifies orphan and core files, and computes architecture metrics (modularity, instability, dependency depth). Outputs include structured data, Mermaid diagrams, and human-readable architecture reports.

This pattern enables the orchestrator and agents to understand module relationships before making changes — preventing accidental circular imports and highlighting high-coupling areas.

---

## Implementation

### Code Example

```typescript
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
  dependencies: string[];  // Files this file depends on
  dependents: string[];    // Files that depend on this
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
  coreFiles: string[];
}

interface ArchitectureMetrics {
  totalFiles: number;
  totalLines: number;
  averageDependencies: number;
  maxDepth: number;
  modularity: number;   // 0–1, higher is better
  instability: number;  // 0–1, lower is better
}

// Classify import type from the module specifier
function classifyImport(modulePath: string): 'relative' | 'absolute' | 'node_module' {
  if (modulePath.startsWith('.')) return 'relative';
  if (modulePath.startsWith('/') || modulePath.startsWith('@/')) return 'absolute';
  return 'node_module';
}

// Parse ES6 imports and require() calls from file content
function parseImports(content: string, filePath: string): ImportEdge[] {
  const imports: ImportEdge[] = [];
  const lines = content.split('\n');
  const importRegex = /import\s+(?:(?:\{[^}]*\}|[^'"]*)\s+from\s+)?['"]([^'"]+)['"];?/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = importRegex.exec(line)) !== null) {
      imports.push({
        source: filePath,
        target: match[1],
        type: classifyImport(match[1]),
        moduleName: match[1],
        line: i + 1,
      });
    }
    while ((match = requireRegex.exec(line)) !== null) {
      imports.push({
        source: filePath,
        target: match[1],
        type: classifyImport(match[1]),
        moduleName: match[1],
        line: i + 1,
      });
    }
  }
  return imports;
}

/**
 * Build a full dependency graph from a project root.
 * Scans all source files, resolves relative imports, and detects cycles.
 */
export async function buildDependencyGraph(rootDir: string): Promise<DependencyGraph> {
  const files = new Map<string, FileNode>();
  const edges: ImportEdge[] = [];

  // ... recursive directory scan, file parsing, import resolution ...

  // Resolve relative imports to actual file paths
  for (const [path, node] of files) {
    for (const imp of node.imports) {
      if (imp.type === 'relative') {
        const resolved = resolveImportPath(imp.target, path);
        if (resolved && files.has(resolved)) {
          node.dependencies.push(resolved);
          files.get(resolved)!.dependents.push(path);
        }
      }
    }
  }

  const circular = detectCircularDependencies(files);
  const orphans = Array.from(files.values())
    .filter(f => f.dependencies.length === 0 && f.dependents.length === 0)
    .map(f => f.path);
  const coreFiles = Array.from(files.values())
    .sort((a, b) => b.dependents.length - a.dependents.length)
    .slice(0, 10)
    .map(f => f.path);

  return { files, edges, circularDependencies: circular, orphanFiles: orphans, coreFiles };
}

/**
 * Detect circular dependencies using depth-first search with a recursion stack.
 */
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
          const cycleStart = path.indexOf(dep);
          circular.push([...path.slice(cycleStart), dep]);
        }
      }
    }

    path.pop();
    recStack.delete(nodeId);
  }

  for (const fileId of files.keys()) {
    if (!visited.has(fileId)) dfs(fileId);
  }
  return circular;
}

/**
 * Calculate architecture health metrics from the dependency graph.
 */
export function calculateMetrics(graph: DependencyGraph): ArchitectureMetrics {
  const fileCount = graph.files.size;
  let totalLines = 0;
  let totalDeps = 0;

  for (const node of graph.files.values()) {
    totalLines += node.size / 50;
    totalDeps += node.dependencies.length;
  }

  // Modularity: ratio of internal (relative) to total imports
  let internal = 0, external = 0;
  for (const edge of graph.edges) {
    if (edge.type === 'relative') internal++;
    else external++;
  }
  const modularity = (internal + external) > 0 ? internal / (internal + external) : 0;

  // Instability: ratio of outgoing to total coupling
  let outgoing = 0, total = 0;
  for (const node of graph.files.values()) {
    outgoing += node.dependencies.length;
    total += node.dependencies.length + node.dependents.length;
  }
  const instability = total > 0 ? outgoing / total : 0;

  return {
    totalFiles: fileCount,
    totalLines: Math.round(totalLines),
    averageDependencies: fileCount > 0 ? totalDeps / fileCount : 0,
    maxDepth: calculateMaxDepth(graph),
    modularity,
    instability,
  };
}

/**
 * Generate a Mermaid diagram from the dependency graph.
 */
export function generateMermaidDiagram(graph: DependencyGraph): string {
  const lines = ['graph TD'];
  const added = new Set<string>();

  for (const [path, node] of graph.files) {
    const id = pathToId(path);
    lines.push(`  ${id}["${node.name}"]`);
  }

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

  if (graph.circularDependencies.length > 0) {
    lines.push(`  linkStyle default stroke:#ff0000,stroke-width:2px`);
  }
  return lines.join('\n');
}
```

### Key Concepts

- **Directed dependency graph**: Each file is a node; each import statement is a directed edge from consumer to provider
- **Import classification**: Imports are classified as `relative`, `absolute`, or `node_module` to separate internal architecture from external dependencies
- **Circular dependency detection**: Uses DFS with a recursion stack — when a node is revisited while still on the stack, the cycle path is captured
- **Architecture metrics**: Modularity (internal vs external coupling) and instability (Robert C. Martin's instability metric) give a quick health score
- **Mermaid output**: The graph can be rendered as a Mermaid diagram for visual architecture documentation
- **Core file identification**: Files sorted by dependent count reveal the most critical modules in the system

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Checking only direct imports without building a full graph
function hasCircularDep(fileA: string, fileB: string): boolean {
  const contentA = readFileSync(fileA, 'utf-8');
  const contentB = readFileSync(fileB, 'utf-8');
  return contentA.includes(`from './${fileB}'`) && contentB.includes(`from './${fileA}'`);
}
// Misses transitive cycles (A → B → C → A) and uses brittle string matching
```

### ✅ Do This Instead

```typescript
// Build the full graph, then query it for cycles of any length
const graph = await buildDependencyGraph(rootDir);

if (graph.circularDependencies.length > 0) {
  for (const cycle of graph.circularDependencies) {
    console.warn(`Circular dependency: ${cycle.join(' → ')}`);
  }
}

// Also get architecture health metrics
const metrics = calculateMetrics(graph);
console.log(`Modularity: ${(metrics.modularity * 100).toFixed(1)}%`);
console.log(`Instability: ${(metrics.instability * 100).toFixed(1)}%`);
```

---

## When to Use This Pattern

✅ **Use for:**
- Pre-flight checks before code generation — agents can verify a new import won't create a cycle
- Architecture health dashboards that track modularity and instability over time
- Generating visual dependency diagrams (Mermaid) for documentation or PR reviews

❌ **Don't use for:**
- Runtime dependency injection or module loading (this is static analysis only)
- Analyzing dynamic imports or `require()` calls with computed paths (regex parsing can't resolve those)

---

## Benefits

1. **Catches circular dependencies early** — DFS-based cycle detection finds transitive cycles that manual review misses
2. **Quantifiable architecture health** — modularity and instability metrics give objective numbers for code review discussions
3. **Visual output** — Mermaid diagrams make complex dependency relationships immediately understandable
4. **Identifies orphan and core files** — orphans may be dead code; core files need extra care during refactoring
5. **Agent-aware** — the graph data feeds into the orchestrator so agents can make informed decisions about where to place new code

---

## Related Patterns

- See `./repo-map.md` for the symbol-level codebase indexing that complements this module-level analysis
- See `../01-orchestration/ralph-loop-execution.md` for how the orchestrator uses dependency data during task planning
- See `../03-quality-gates/typescript-gate.md` for the TypeScript compilation gate that catches import errors at build time
- See `../09-observability/tracer.md` for tracing analysis operations in production

---

*Extracted: 2026-02-19*
