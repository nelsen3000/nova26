// Graph Memory Core — KIMI-VAULT-01
// Low-level graph engine for the Taste Vault

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Core Types
// ============================================================================

export type NodeType = 'Strategy' | 'Mistake' | 'Preference' | 'Pattern' | 'Decision';

export interface GraphNode {
  id: string;
  type: NodeType;
  content: string;
  confidence: number;
  helpfulCount: number;
  userId: string;
  isGlobal: boolean;
  globalSuccessCount: number;
  language?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type EdgeRelation = 'supports' | 'contradicts' | 'refines' | 'replaces' | 'depends_on';

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: EdgeRelation;
  strength: number;
  createdAt: string;
}

// ============================================================================
// Graph Memory Engine
// ============================================================================

export class GraphMemory {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // nodeId -> Set of edgeIds
  private userId: string;

  constructor(userId: string = 'default') {
    this.userId = userId;
  }

  /** Get the persistence path for this user */
  private getPersistPath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.nova', 'taste-vault', `graph-${this.userId}.json`);
  }

  /** Generate a unique ID */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /** Get current ISO timestamp */
  private now(): string {
    return new Date().toISOString();
  }

  // ============================================================================
  // Node Operations
  // ============================================================================

  /** Add a new node to the graph */
  addNode(node: Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): GraphNode {
    if (!node.content || node.content.trim() === '') {
      throw new Error('Content cannot be empty');
    }

    const id = node.id ?? this.generateId();
    const now = this.now();

    const newNode: GraphNode = {
      ...node,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.nodes.set(id, newNode);
    this.adjacencyList.set(id, new Set());

    return newNode;
  }

  /** Get a node by ID */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /** Update a node's fields */
  updateNode(id: string, updates: Partial<Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>>): GraphNode | undefined {
    const node = this.nodes.get(id);
    if (!node) return undefined;

    const updatedNode: GraphNode = {
      ...node,
      ...updates,
      updatedAt: this.now(),
    };

    this.nodes.set(id, updatedNode);
    return updatedNode;
  }

  /** Remove a node and all connected edges */
  removeNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove all connected edges
    const connectedEdgeIds = this.adjacencyList.get(id) ?? new Set();
    for (const edgeId of connectedEdgeIds) {
      this.removeEdge(edgeId);
    }

    // Remove edges where this node is the target
    const edgesToRemove: string[] = [];
    for (const [edgeId, edge] of this.edges) {
      if (edge.targetId === id) {
        edgesToRemove.push(edgeId);
      }
    }
    for (const edgeId of edgesToRemove) {
      this.removeEdge(edgeId);
    }

    this.nodes.delete(id);
    this.adjacencyList.delete(id);

    return true;
  }

  // ============================================================================
  // Edge Operations
  // ============================================================================

  /** Add a directed edge between nodes */
  addEdge(edge: Omit<GraphEdge, 'id' | 'createdAt'> & { id?: string }): GraphEdge {
    // Validate nodes exist
    if (!this.nodes.has(edge.sourceId)) {
      throw new Error('Source node not found');
    }
    if (!this.nodes.has(edge.targetId)) {
      throw new Error('Target node not found');
    }

    const id = edge.id ?? this.generateId();
    const now = this.now();

    const newEdge: GraphEdge = {
      ...edge,
      id,
      createdAt: now,
    };

    this.edges.set(id, newEdge);

    // Update adjacency list for source node
    const sourceEdges = this.adjacencyList.get(edge.sourceId) ?? new Set();
    sourceEdges.add(id);
    this.adjacencyList.set(edge.sourceId, sourceEdges);

    return newEdge;
  }

  /** Get an edge by ID */
  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  /** Remove an edge */
  removeEdge(id: string): boolean {
    const edge = this.edges.get(id);
    if (!edge) return false;

    // Remove from adjacency list
    const sourceEdges = this.adjacencyList.get(edge.sourceId);
    if (sourceEdges) {
      sourceEdges.delete(id);
    }

    this.edges.delete(id);
    return true;
  }

  /** Get all outgoing edges from a node */
  getEdgesFrom(nodeId: string): GraphEdge[] {
    const edgeIds = this.adjacencyList.get(nodeId) ?? new Set();
    const result: GraphEdge[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (edge) result.push(edge);
    }
    return result;
  }

  /** Get all incoming edges to a node */
  getEdgesTo(nodeId: string): GraphEdge[] {
    const result: GraphEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.targetId === nodeId) {
        result.push(edge);
      }
    }
    return result;
  }

  /** Get related nodes (adjacent via edges) */
  getRelated(nodeId: string, relation?: EdgeRelation): GraphNode[] {
    const outgoing = this.getEdgesFrom(nodeId);
    const incoming = this.getEdgesTo(nodeId);

    const relatedNodes: GraphNode[] = [];
    const seen = new Set<string>();

    for (const edge of outgoing) {
      if (relation && edge.relation !== relation) continue;
      const target = this.nodes.get(edge.targetId);
      if (target && !seen.has(target.id)) {
        relatedNodes.push(target);
        seen.add(target.id);
      }
    }

    for (const edge of incoming) {
      if (relation && edge.relation !== relation) continue;
      const source = this.nodes.get(edge.sourceId);
      if (source && !seen.has(source.id)) {
        relatedNodes.push(source);
        seen.add(source.id);
      }
    }

    return relatedNodes;
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /** Get all nodes of a specific type */
  getByType(type: NodeType): GraphNode[] {
    const result: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.type === type) {
        result.push(node);
      }
    }
    return result;
  }

  /** Get nodes with confidence above threshold (default 0.8) */
  getHighConfidence(threshold: number = 0.8): GraphNode[] {
    const result: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.confidence >= threshold) {
        result.push(node);
      }
    }
    return result;
  }

  /** Get nodes with a specific tag */
  getByTag(tag: string): GraphNode[] {
    const result: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.tags.includes(tag)) {
        result.push(node);
      }
    }
    return result;
  }

  /** Search nodes by content substring */
  search(query: string): GraphNode[] {
    const lowerQuery = query.toLowerCase();
    const result: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.content.toLowerCase().includes(lowerQuery)) {
        result.push(node);
      }
    }
    return result;
  }

  /** Traverse graph using BFS, optionally filtering by relation */
  traverse(startId: string, depth: number = 3, relation?: EdgeRelation): GraphNode[] {
    const startNode = this.nodes.get(startId);
    if (!startNode) return [];

    const visited = new Set<string>([startId]);
    const result: GraphNode[] = [];
    let currentLevel: string[] = [startId];

    for (let i = 0; i < depth && currentLevel.length > 0; i++) {
      const nextLevel: string[] = [];

      for (const nodeId of currentLevel) {
        const outgoing = this.getEdgesFrom(nodeId);
        const incoming = this.getEdgesTo(nodeId);

        for (const edge of outgoing) {
          if (relation && edge.relation !== relation) continue;
          if (!visited.has(edge.targetId)) {
            visited.add(edge.targetId);
            const target = this.nodes.get(edge.targetId);
            if (target) {
              result.push(target);
              nextLevel.push(edge.targetId);
            }
          }
        }

        for (const edge of incoming) {
          if (relation && edge.relation !== relation) continue;
          if (!visited.has(edge.sourceId)) {
            visited.add(edge.sourceId);
            const source = this.nodes.get(edge.sourceId);
            if (source) {
              result.push(source);
              nextLevel.push(edge.sourceId);
            }
          }
        }
      }

      currentLevel = nextLevel;
    }

    return result;
  }

  // ============================================================================
  // Confidence & Helpfulness Operations
  // ============================================================================

  /** Reinforce a node (increase confidence by delta, default 0.05, max 1.0) */
  reinforce(nodeId: string, delta: number = 0.05): GraphNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    const newConfidence = Math.min(1.0, node.confidence + delta);
    return this.updateNode(nodeId, { confidence: newConfidence });
  }

  /** Demote a node (decrease confidence by delta, default 0.1, min 0.0) */
  demote(nodeId: string, delta: number = 0.1): GraphNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    const newConfidence = Math.max(0.0, node.confidence - delta);
    return this.updateNode(nodeId, { confidence: newConfidence });
  }

  /** Increment the helpful count for a node */
  incrementHelpful(nodeId: string): GraphNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    return this.updateNode(nodeId, { helpfulCount: node.helpfulCount + 1 });
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /** Get total node count */
  nodeCount(): number {
    return this.nodes.size;
  }

  /** Get total edge count */
  edgeCount(): number {
    return this.edges.size;
  }

  /** Get comprehensive statistics */
  stats(): {
    nodes: number;
    edges: number;
    byType: Record<NodeType, number>;
    avgConfidence: number;
  } {
    const byType: Record<NodeType, number> = {
      Strategy: 0,
      Mistake: 0,
      Preference: 0,
      Pattern: 0,
      Decision: 0,
    };

    let totalConfidence = 0;
    for (const node of this.nodes.values()) {
      byType[node.type]++;
      totalConfidence += node.confidence;
    }

    const avgConfidence = this.nodes.size > 0 ? totalConfidence / this.nodes.size : 0;

    return {
      nodes: this.nodes.size,
      edges: this.edges.size,
      byType,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
    };
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /** Persist graph to disk */
  persist(): void {
    const persistPath = this.getPersistPath();
    const dir = path.dirname(persistPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      userId: this.userId,
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };

    fs.writeFileSync(persistPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Load graph from disk */
  load(): boolean {
    const persistPath = this.getPersistPath();

    if (!fs.existsSync(persistPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(persistPath, 'utf-8');
      const data = JSON.parse(content);

      this.clear();

      // Load nodes
      for (const node of data.nodes) {
        this.nodes.set(node.id, node);
        this.adjacencyList.set(node.id, new Set());
      }

      // Load edges and rebuild adjacency list
      for (const edge of data.edges) {
        this.edges.set(edge.id, edge);
        const sourceEdges = this.adjacencyList.get(edge.sourceId) ?? new Set();
        sourceEdges.add(edge.id);
        this.adjacencyList.set(edge.sourceId, sourceEdges);
      }

      return true;
    } catch {
      return false;
    }
  }

  /** Clear all data (useful for tests) */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

const graphMemoryInstances: Map<string, GraphMemory> = new Map();

export function getGraphMemory(userId: string = 'default'): GraphMemory {
  if (!graphMemoryInstances.has(userId)) {
    graphMemoryInstances.set(userId, new GraphMemory(userId));
  }
  return graphMemoryInstances.get(userId)!;
}

export function resetGraphMemory(): void {
  graphMemoryInstances.clear();
}
