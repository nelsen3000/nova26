// Semantic Model — R19-02
// Core CodeGraph class with ts-morph refresh simulation

import type { CodeNode, CodeEdge, CodeGraph, SemanticModelConfig } from './types.js';

export class SemanticModel {
  private graph: CodeGraph = {
    nodes: new Map(),
    edges: [],
  };
  readonly config: SemanticModelConfig;
  private lastRefresh: Date | null = null;

  constructor(config: Partial<SemanticModelConfig> = {}) {
    this.config = {
      analysisDepth: 'standard',
      updateStrategy: 'on-change',
      cacheLocation: '.nova/semantic-cache',
      maxCacheSizeMB: 100,
      tsMorphProjectRoot: '.',
      enableContextCompaction: true,
      compactionTokenBudget: 4000,
      semanticTagSources: ['comments', 'file-names', 'test-files'],
      refreshIntervalMinutes: 30,
      ...config,
    };
  }

  addNode(node: Omit<CodeNode, 'id'>): CodeNode {
    const id = this.generateNodeId(node);
    const fullNode: CodeNode = { ...node, id };
    this.graph.nodes.set(id, fullNode);
    return fullNode;
  }

  getNode(id: string): CodeNode | undefined {
    return this.graph.nodes.get(id);
  }

  removeNode(id: string): boolean {
    // Remove edges connected to this node
    this.graph.edges = this.graph.edges.filter(
      e => e.fromId !== id && e.toId !== id
    );
    return this.graph.nodes.delete(id);
  }

  addEdge(edge: Omit<CodeEdge, 'weight'>): CodeEdge {
    const fullEdge: CodeEdge = { ...edge, weight: this.calculateEdgeWeight(edge) };
    this.graph.edges.push(fullEdge);
    return fullEdge;
  }

  getEdgesFrom(nodeId: string): CodeEdge[] {
    return this.graph.edges.filter(e => e.fromId === nodeId);
  }

  getEdgesTo(nodeId: string): CodeEdge[] {
    return this.graph.edges.filter(e => e.toId === nodeId);
  }

  queryWhatDependsOn(nodeId: string): CodeNode[] {
    const dependentIds = new Set<string>();
    
    const traverse = (id: string, visited: Set<string> = new Set()) => {
      if (visited.has(id)) return; // Circular dependency
      visited.add(id);
      
      const edges = this.getEdgesTo(id);
      for (const edge of edges) {
        dependentIds.add(edge.fromId);
        traverse(edge.fromId, visited);
      }
    };
    
    traverse(nodeId);
    return Array.from(dependentIds).map(id => this.graph.nodes.get(id)!);
  }

  queryImpactRadius(nodeId: string, maxDepth: number = 3): {
    nodes: CodeNode[];
    depth: number;
  } {
    const impacted = new Map<string, number>();
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);
      
      if (depth > 0) {
        impacted.set(id, depth);
      }
      
      // Find all dependents
      const edges = this.getEdgesTo(id);
      for (const edge of edges) {
        if (!visited.has(edge.fromId)) {
          queue.push({ id: edge.fromId, depth: depth + 1 });
        }
      }
    }
    
    const nodes = Array.from(impacted.entries())
      .map(([id, depth]) => ({ node: this.graph.nodes.get(id)!, depth }))
      .filter(({ node }) => node !== undefined)
      .sort((a, b) => a.depth - b.depth)
      .map(({ node }) => node);
    
    return {
      nodes,
      depth: Math.max(...Array.from(impacted.values()), 0),
    };
  }

  findBySemanticTag(tag: string): CodeNode[] {
    return Array.from(this.graph.nodes.values())
      .filter(node => node.semanticTags.includes(tag));
  }

  refreshFile(filePath: string): void {
    // Simulate ts-morph refresh
    const nodesToUpdate = Array.from(this.graph.nodes.values())
      .filter(n => n.filePath === filePath);
    
    for (const node of nodesToUpdate) {
      node.changeFrequency++;
    }
    
    this.lastRefresh = new Date();
  }

  async refreshAll(): Promise<void> {
    // Simulate full project refresh
    for (const node of this.graph.nodes.values()) {
      node.changeFrequency = Math.max(0, node.changeFrequency - 1);
    }
    this.lastRefresh = new Date();
  }

  getNodesByType(type: CodeNode['type']): CodeNode[] {
    return Array.from(this.graph.nodes.values())
      .filter(n => n.type === type);
  }

  getNodesByFilePath(filePath: string): CodeNode[] {
    return Array.from(this.graph.nodes.values())
      .filter(n => n.filePath === filePath);
  }

  getComplexityDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0,
    };
    
    for (const node of this.graph.nodes.values()) {
      if (node.complexity < 5) distribution.low++;
      else if (node.complexity < 10) distribution.medium++;
      else if (node.complexity < 20) distribution.high++;
      else distribution.veryHigh++;
    }
    
    return distribution;
  }

  getGraphStats(): {
    nodeCount: number;
    edgeCount: number;
    fileCount: number;
    avgComplexity: number;
    lastRefresh: Date | null;
  } {
    const nodes = Array.from(this.graph.nodes.values());
    const uniqueFiles = new Set(nodes.map(n => n.filePath));
    
    const avgComplexity = nodes.length > 0
      ? nodes.reduce((sum, n) => sum + n.complexity, 0) / nodes.length
      : 0;
    
    return {
      nodeCount: this.graph.nodes.size,
      edgeCount: this.graph.edges.length,
      fileCount: uniqueFiles.size,
      avgComplexity: Math.round(avgComplexity * 100) / 100,
      lastRefresh: this.lastRefresh,
    };
  }

  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    
    const dfs = (nodeId: string, path: string[] = []) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);
      
      const edges = this.getEdgesFrom(nodeId);
      for (const edge of edges) {
        if (!visited.has(edge.toId)) {
          dfs(edge.toId, [...path]);
        } else if (recStack.has(edge.toId)) {
          // Found cycle
          const cycleStart = path.indexOf(edge.toId);
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
        }
      }
      
      recStack.delete(nodeId);
    };
    
    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }
    
    return cycles;
  }

  private generateNodeId(node: Omit<CodeNode, 'id'>): string {
    return `${node.filePath}:${node.type}:${node.name}`;
  }

  private calculateEdgeWeight(edge: Omit<CodeEdge, 'weight'>): number {
    const weights: Record<string, number> = {
      'imports': 1,
      'calls': 2,
      'extends': 3,
      'implements': 2,
      'uses-type': 1,
      'renders': 2,
      'depends-on': 2,
    };
    return weights[edge.type] ?? 1;
  }
}

export function createSemanticModel(config?: Partial<SemanticModelConfig>): SemanticModel {
  return new SemanticModel(config);
}
