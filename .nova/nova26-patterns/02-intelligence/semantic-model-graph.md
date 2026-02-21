# Deep Project Semantic Model

## Overview

The Deep Project Semantic Model builds a persistent CodeGraph that maps every file, function, class, interface, type, export, component, hook, and page in the codebase as CodeNode entries, connected by typed CodeEdge relationships (imports, calls, extends, implements, uses-type, renders, depends-on). The graph powers three downstream capabilities: impact analysis (which files and tests are affected by a change), semantic diff summaries (PR intent analysis with safe-to-merge confidence), and context compaction (shrinking the full graph to fit within an LLM token budget while preserving the most relevant modules). The graph is built and refreshed using ts-morph, persisted to Convex with a local cache, and injected into every agent's context by the Ralph Loop before task execution.

---

## Source

- `src/atlas/semantic-model.ts` — CodeGraph builder and query engine
- `src/atlas/impact-analyzer.ts` — Impact analysis with Mermaid visualization
- `src/atlas/semantic-differ.ts` — Semantic diff summary for PRs
- `src/atlas/context-compactor.ts` — Token-budgeted context compaction for LLM consumption
- `src/atlas/types.ts` — Shared type definitions (CodeNode, CodeEdge, CodeGraph)

## Pattern

### Core Interfaces

```typescript
export interface SemanticModelConfig {
  analysisDepth: 'shallow' | 'standard' | 'deep';
  updateStrategy: 'on-change' | 'periodic' | 'manual';
  cacheLocation: string;
  maxCacheSizeMB: number;
  tsMorphProjectRoot: string;
  enableContextCompaction: boolean;
  compactionTokenBudget: number;
  semanticTagSources: string[];
  refreshIntervalMinutes: number;
}

export type CodeNodeType =
  | 'file' | 'function' | 'class' | 'interface'
  | 'type' | 'export' | 'component' | 'hook' | 'page';

export type CodeEdgeType =
  | 'imports' | 'calls' | 'extends' | 'implements'
  | 'uses-type' | 'renders' | 'depends-on';

export interface CodeNode {
  id: string;
  type: CodeNodeType;
  name: string;
  filePath: string;
  location: { line: number; column: number };
  complexity: number;
  changeFrequency: number;
  testCoverage: number;
  semanticTags: string[];
  dependents: string[];
}

export interface CodeEdge {
  fromId: string;
  toId: string;
  type: CodeEdgeType;
  weight: number;
}

export interface CodeGraph {
  nodes: Map<string, CodeNode>;
  edges: CodeEdge[];

  queryWhatDependsOn(nodeId: string): CodeNode[];
  queryImpactRadius(nodeId: string, depth?: number): CodeNode[];
  findBySemanticTag(tag: string): CodeNode[];
  refreshFile(filePath: string): Promise<void>;
}
```

### Impact Analysis

```typescript
export interface ImpactAnalysisResult {
  changedNode: CodeNode;
  affectedNodes: CodeNode[];
  affectedFiles: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  visualization: string; // Mermaid diagram
  suggestedTests: string[];
}

export function analyzeImpact(
  graph: CodeGraph,
  changedFilePath: string
): ImpactAnalysisResult {
  const changedNodes = [...graph.nodes.values()]
    .filter(n => n.filePath === changedFilePath);

  const affectedSet = new Set<string>();
  const affectedFiles = new Set<string>();

  for (const node of changedNodes) {
    const impacted = graph.queryImpactRadius(node.id, 3);
    for (const impactedNode of impacted) {
      affectedSet.add(impactedNode.id);
      affectedFiles.add(impactedNode.filePath);
    }
  }

  const affectedNodes = [...affectedSet]
    .map(id => graph.nodes.get(id)!)
    .filter(Boolean);

  // Risk assessment based on graph centrality and test coverage
  const avgCoverage = affectedNodes.reduce(
    (sum, n) => sum + n.testCoverage, 0
  ) / (affectedNodes.length || 1);
  const riskLevel = avgCoverage > 80 ? 'low'
    : avgCoverage > 50 ? 'medium'
    : avgCoverage > 20 ? 'high'
    : 'critical';

  // Generate Mermaid visualization
  const visualization = generateMermaid(changedNodes, affectedNodes, graph.edges);

  const suggestedTests = affectedNodes
    .filter(n => n.type === 'function' || n.type === 'component')
    .map(n => `${n.filePath}:${n.name}`);

  return {
    changedNode: changedNodes[0],
    affectedNodes,
    affectedFiles: [...affectedFiles],
    riskLevel,
    confidence: Math.min(0.95, avgCoverage / 100),
    visualization,
    suggestedTests,
  };
}

function generateMermaid(
  changed: CodeNode[],
  affected: CodeNode[],
  edges: CodeEdge[]
): string {
  const lines = ['graph TD'];
  for (const node of changed) {
    lines.push(`  ${node.id}["${node.name}"]:::changed`);
  }
  for (const node of affected) {
    lines.push(`  ${node.id}["${node.name}"]:::affected`);
  }
  const relevantIds = new Set([
    ...changed.map(n => n.id),
    ...affected.map(n => n.id),
  ]);
  for (const edge of edges) {
    if (relevantIds.has(edge.fromId) && relevantIds.has(edge.toId)) {
      lines.push(`  ${edge.fromId} -->|${edge.type}| ${edge.toId}`);
    }
  }
  return lines.join('\n');
}
```

### Semantic Diff Summary for PRs

```typescript
export interface SemanticDiffSummary {
  prIntent: string;
  groupedChanges: { module: string; changes: string[] }[];
  suspiciousPatterns: string[];
  overallConfidence: number;
  safeToMerge: boolean;
  humanReadableReport: string;
}
```

### Context Compaction for LLM Consumption

```typescript
export interface CompactedContext {
  projectSummary: string;
  relevantModules: { name: string; summary: string; nodeCount: number }[];
  keyPatterns: string[];
  tokenCount: number;
  expand(moduleId: string): CodeNode[];
}

export function compactForLLM(
  graph: CodeGraph,
  taskContext: { relatedFiles: string[]; agentName: string },
  tokenBudget: number
): CompactedContext {
  // 1. Score every node by relevance to task
  const scored = [...graph.nodes.values()].map(node => ({
    node,
    score: scoreRelevance(node, taskContext),
  }));

  // 2. Sort by relevance, pack within token budget
  scored.sort((a, b) => b.score - a.score);

  let tokenCount = 0;
  const relevantModules: CompactedContext['relevantModules'] = [];

  for (const { node } of scored) {
    const estimatedTokens = estimateNodeTokens(node);
    if (tokenCount + estimatedTokens > tokenBudget) break;
    tokenCount += estimatedTokens;
    // Group by module (directory)
    addToModuleGroup(relevantModules, node);
  }

  return {
    projectSummary: generateProjectSummary(graph),
    relevantModules,
    keyPatterns: extractKeyPatterns(graph),
    tokenCount,
    expand: (moduleId: string) =>
      [...graph.nodes.values()].filter(n => n.filePath.includes(moduleId)),
  };
}
```

## Usage

### Key Concepts

- **CodeGraph as single source of truth**: All codebase understanding flows from one typed, queryable graph
- **ts-morph refresh**: The graph uses ts-morph to parse TypeScript ASTs and extract nodes/edges, with file-level incremental refresh
- **Impact radius**: `queryImpactRadius(nodeId, depth)` does a BFS traversal up to N hops to find all transitively affected nodes
- **Mermaid visualization**: Impact analysis results include a Mermaid diagram string that can be rendered in PRs, dashboards, or agent context
- **Token-budgeted compaction**: Before injecting context into an LLM prompt, the full graph is compacted to fit the token budget by scoring nodes by relevance and packing greedily
- **Dual persistence**: Graph is persisted to Convex (remote) and cached locally, with configurable sync strategy

---

## Anti-Patterns

### Don't Do This

```typescript
// Naive file-level dependency detection — misses function-level edges
function getDeps(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const imports = content.match(/from ['"](.+)['"]/g);
  return imports?.map(m => m.replace(/from ['"]|['"]/g, '')) ?? [];
}

// Dumping the entire graph into an LLM prompt
const prompt = `Here is the full codebase graph:\n${JSON.stringify(graph)}`;
// Blows token limits, wastes money, degrades quality

// Stale graph — never refreshing after file changes
const graph = buildGraph(); // Built once at startup
// 30 minutes later, half the edges are wrong
```

### Do This Instead

```typescript
// Use typed CodeGraph with ts-morph for accurate edges
const graph = await buildCodeGraph({ tsMorphProjectRoot: './src' });

// Compact before injecting into LLM context
const context = compactForLLM(graph, taskContext, 8000);
const prompt = `Project context:\n${context.projectSummary}\n...`;

// Incremental refresh on file change
graph.refreshFile(changedFilePath);
```

---

## When to Use

**Use for:**
- Impact analysis before PRs and deployments -- know exactly which files and tests are affected
- Context injection for agents -- give each agent only the relevant slice of the codebase, token-budgeted
- Semantic PR review -- generate intent summaries and suspicious pattern alerts for MERCURY
- Pattern mining -- ATLAS uses the graph to discover recurring architectural patterns across retrospectives

**Don't use for:**
- Simple single-file scripts with no cross-module dependencies
- Runtime dependency injection graphs (this is static analysis, not runtime DI)

---

## Benefits

1. **Precision impact analysis** -- function-level and component-level edges catch transitive impacts that file-level analysis misses
2. **Token-efficient context** -- compaction ensures agents get maximum relevant context within their token budget
3. **Visual communication** -- Mermaid diagrams make impact analysis results immediately understandable in PRs and dashboards
4. **Incremental performance** -- file-level refresh avoids full reparse on every change, keeping the graph fresh without high cost
5. **PR safety scoring** -- SemanticDiffSummary provides a machine-readable `safeToMerge` flag that gates can use to block risky merges

---

## Related Patterns

- See `../11-codebase-analysis/repo-map.md` for the file-level repo map that the semantic model enhances
- See `../11-codebase-analysis/dependency-analyzer.md` for the existing dependency analysis that this pattern replaces
- See `session-memory-relevance.md` for how session context interacts with the semantic model
- See `../01-orchestration/ralph-loop-execution.md` for how the Ralph Loop injects semantic snapshots into agent context
- See `../12-git-and-integrations/git-workflow.md` for the PR workflow that triggers SemanticDiffSummary

---

*Extracted: 2026-02-19*
