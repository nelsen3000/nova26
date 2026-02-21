/**
 * KIRO-04-04: Cross-Module Dependency Mapping
 * Builds a dependency graph from Related Patterns sections across all pattern files.
 * Detects islands, cycles, and hub patterns. Outputs JSON graph and ASCII visualization.
 */
import { writeFileSync } from "fs";
import { join, basename, dirname } from "path";
import {
  scanKnowledgeBases,
  ensureDir,
  AUDIT_REPORTS_DIR,
  type Module,
  type PatternFile,
} from "./scan-utils.js";

interface DependencyNode {
  id: string;
  name: string;
  module: string;
  knowledgeBase: "bistrolens" | "nova26";
  inDegree: number;
  outDegree: number;
}

interface DependencyEdge {
  source: string;
  target: string;
  type: "related";
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  islands: string[];
  cycles: string[][];
  hubs: { id: string; inDegree: number }[];
}

function makeNodeId(pattern: PatternFile): string {
  return `${pattern.knowledgeBase}/${pattern.module}/${pattern.name.replace(".md", "")}`;
}

function resolveRefToNodeId(
  ref: string,
  sourcePattern: PatternFile,
  nodeIndex: Map<string, string>
): string | null {
  const refFile = basename(ref).replace(".md", "");

  // Try same module first
  const sameModuleId = `${sourcePattern.knowledgeBase}/${sourcePattern.module}/${refFile}`;
  if (nodeIndex.has(sameModuleId)) return sameModuleId;

  // Try cross-module in same KB
  for (const [id] of nodeIndex) {
    if (id.endsWith(`/${refFile}`) && id.startsWith(sourcePattern.knowledgeBase)) {
      return id;
    }
  }

  // Try other KB
  for (const [id] of nodeIndex) {
    if (id.endsWith(`/${refFile}`)) {
      return id;
    }
  }

  return null;
}

function buildGraph(modules: Module[]): DependencyGraph {
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const nodeIndex = new Map<string, DependencyNode>();

  // Create all nodes
  for (const mod of modules) {
    for (const pattern of mod.patterns) {
      const id = makeNodeId(pattern);
      const node: DependencyNode = {
        id,
        name: pattern.name.replace(".md", ""),
        module: mod.name,
        knowledgeBase: mod.knowledgeBase,
        inDegree: 0,
        outDegree: 0,
      };
      nodes.push(node);
      nodeIndex.set(id, node);
    }
  }

  // Create edges from Related Patterns references
  const nodeIdSet = new Map<string, string>();
  for (const node of nodes) {
    nodeIdSet.set(node.id, node.id);
  }

  for (const mod of modules) {
    for (const pattern of mod.patterns) {
      const sourceId = makeNodeId(pattern);
      for (const ref of pattern.relatedPatterns) {
        const targetId = resolveRefToNodeId(ref, pattern, nodeIdSet);
        if (targetId && targetId !== sourceId) {
          edges.push({ source: sourceId, target: targetId, type: "related" });
          const sourceNode = nodeIndex.get(sourceId);
          const targetNode = nodeIndex.get(targetId);
          if (sourceNode) sourceNode.outDegree++;
          if (targetNode) targetNode.inDegree++;
        }
      }
    }
  }

  const islands = findIslands(nodes);
  const cycles = detectCycles(nodes, edges);
  const hubs = rankByInDegree(nodes);

  return { nodes, edges, islands, cycles, hubs };
}

function findIslands(nodes: DependencyNode[]): string[] {
  return nodes
    .filter((n) => n.inDegree === 0 && n.outDegree === 0)
    .map((n) => n.id);
}

function detectCycles(
  nodes: DependencyNode[],
  edges: DependencyEdge[]
): string[][] {
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    inStack.add(nodeId);
    stack.push(nodeId);

    for (const neighbor of adj.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = stack.indexOf(neighbor);
        if (cycleStart >= 0) {
          cycles.push(stack.slice(cycleStart));
        }
      }
    }

    stack.pop();
    inStack.delete(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return cycles;
}

function rankByInDegree(
  nodes: DependencyNode[]
): { id: string; inDegree: number }[] {
  return nodes
    .filter((n) => n.inDegree > 0)
    .sort((a, b) => b.inDegree - a.inDegree)
    .slice(0, 10)
    .map((n) => ({ id: n.id, inDegree: n.inDegree }));
}

function generateAsciiVisualization(graph: DependencyGraph): string {
  let md = `# KIRO-04-04: Cross-Module Dependency Map\n\n`;
  md += `**Date:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Total Nodes:** ${graph.nodes.length}\n`;
  md += `**Total Edges:** ${graph.edges.length}\n`;
  md += `**Islands:** ${graph.islands.length}\n`;
  md += `**Cycles:** ${graph.cycles.length}\n\n`;

  // Group nodes by module
  const byModule = new Map<string, DependencyNode[]>();
  for (const node of graph.nodes) {
    const key = `${node.knowledgeBase}/${node.module}`;
    const list = byModule.get(key) || [];
    list.push(node);
    byModule.set(key, list);
  }

  // Module-level edge summary
  const moduleEdges = new Map<string, Map<string, number>>();
  for (const edge of graph.edges) {
    const srcNode = graph.nodes.find((n) => n.id === edge.source);
    const tgtNode = graph.nodes.find((n) => n.id === edge.target);
    if (!srcNode || !tgtNode) continue;
    const srcMod = `${srcNode.knowledgeBase}/${srcNode.module}`;
    const tgtMod = `${tgtNode.knowledgeBase}/${tgtNode.module}`;
    if (srcMod === tgtMod) continue; // skip intra-module

    if (!moduleEdges.has(srcMod)) moduleEdges.set(srcMod, new Map());
    const targets = moduleEdges.get(srcMod)!;
    targets.set(tgtMod, (targets.get(tgtMod) || 0) + 1);
  }

  md += `---\n\n## Module Connectivity\n\n`;
  md += `\`\`\`\n`;

  for (const [srcMod, targets] of moduleEdges) {
    for (const [tgtMod, count] of targets) {
      const arrow = count > 3 ? "===>" : count > 1 ? "-->" : "->";
      md += `  ${srcMod} ${arrow} ${tgtMod} (${count})\n`;
    }
  }

  md += `\`\`\`\n\n`;

  // Hub patterns
  md += `---\n\n## Top Hub Patterns (Most Referenced)\n\n`;
  md += `| Rank | Pattern | In-Degree |\n`;
  md += `|------|---------|----------|\n`;
  for (let i = 0; i < graph.hubs.length; i++) {
    md += `| ${i + 1} | ${graph.hubs[i].id} | ${graph.hubs[i].inDegree} |\n`;
  }

  // Islands
  md += `\n---\n\n## Island Patterns (No References)\n\n`;
  if (graph.islands.length === 0) {
    md += `No island patterns found.\n`;
  } else {
    for (const island of graph.islands) {
      md += `- ${island}\n`;
    }
  }

  // Cycles
  md += `\n---\n\n## Circular References\n\n`;
  if (graph.cycles.length === 0) {
    md += `No circular references detected.\n`;
  } else {
    for (let i = 0; i < graph.cycles.length; i++) {
      md += `### Cycle ${i + 1}\n`;
      md += `\`\`\`\n`;
      md += graph.cycles[i].join(" → ") + " → " + graph.cycles[i][0] + "\n";
      md += `\`\`\`\n\n`;
    }
  }

  // Per-module breakdown
  md += `---\n\n## Module Breakdown\n\n`;
  for (const [modKey, nodes] of byModule) {
    const totalIn = nodes.reduce((s, n) => s + n.inDegree, 0);
    const totalOut = nodes.reduce((s, n) => s + n.outDegree, 0);
    md += `### ${modKey} (${nodes.length} patterns, ${totalIn} in, ${totalOut} out)\n\n`;
    for (const node of nodes.sort((a, b) => b.inDegree - a.inDegree)) {
      const marker =
        node.inDegree === 0 && node.outDegree === 0 ? " 🏝️" : "";
      md += `- ${node.name} (in:${node.inDegree} out:${node.outDegree})${marker}\n`;
    }
    md += `\n`;
  }

  return md;
}

function main(): void {
  console.log("KIRO-04-04: Building cross-module dependency map...\n");
  const modules = scanKnowledgeBases();
  const graph = buildGraph(modules);

  ensureDir(AUDIT_REPORTS_DIR);

  // Write JSON
  const jsonOutput = JSON.stringify(graph, null, 2);
  writeFileSync(
    join(AUDIT_REPORTS_DIR, "kiro-04-04-dependency-graph.json"),
    jsonOutput,
    "utf-8"
  );

  // Write ASCII visualization
  const asciiReport = generateAsciiVisualization(graph);
  writeFileSync(
    join(AUDIT_REPORTS_DIR, "kiro-04-04-dependency-map.md"),
    asciiReport,
    "utf-8"
  );

  console.log(`  Nodes: ${graph.nodes.length}`);
  console.log(`  Edges: ${graph.edges.length}`);
  console.log(`  Islands: ${graph.islands.length}`);
  console.log(`  Cycles: ${graph.cycles.length}`);
  console.log(`  Top hub: ${graph.hubs[0]?.id || "none"} (${graph.hubs[0]?.inDegree || 0} refs)`);
  console.log(`\nDone. Reports:`);
  console.log(`  ${AUDIT_REPORTS_DIR}/kiro-04-04-dependency-graph.json`);
  console.log(`  ${AUDIT_REPORTS_DIR}/kiro-04-04-dependency-map.md`);
}

main();
