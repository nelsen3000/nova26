// Graph Memory — R19-02
// Convex + local sqlite sync

import type { CodeNode, CodeEdge } from './types.js';

export interface SyncStatus {
  lastSync: Date | null;
  pendingWrites: number;
  isSyncing: boolean;
  conflicts: Array<{ local: CodeNode; remote: CodeNode }>;
}

export class GraphMemory {
  private localNodes: Map<string, CodeNode> = new Map();
  private localEdges: CodeEdge[] = [];
  private syncStatus: SyncStatus = {
    lastSync: null,
    pendingWrites: 0,
    isSyncing: false,
    conflicts: [],
  };

  // Local storage operations
  writeNode(node: CodeNode): void {
    this.localNodes.set(node.id, node);
    this.syncStatus.pendingWrites++;
  }

  writeNodes(nodes: CodeNode[]): void {
    for (const node of nodes) {
      this.localNodes.set(node.id, node);
    }
    this.syncStatus.pendingWrites += nodes.length;
  }

  readNode(id: string): CodeNode | undefined {
    return this.localNodes.get(id);
  }

  readAllNodes(): CodeNode[] {
    return Array.from(this.localNodes.values());
  }

  deleteNode(id: string): boolean {
    const existed = this.localNodes.delete(id);
    if (existed) {
      this.syncStatus.pendingWrites++;
    }
    return existed;
  }

  writeEdges(edges: CodeEdge[]): void {
    this.localEdges.push(...edges);
    this.syncStatus.pendingWrites++;
  }

  readEdges(): CodeEdge[] {
    return [...this.localEdges];
  }

  // Sync operations (mock implementations)
  async syncToRemote(): Promise<{ success: boolean; synced: number }> {
    this.syncStatus.isSyncing = true;
    
    try {
      // Simulate network delay
      await this.sleep(100);
      
      const toSync = this.syncStatus.pendingWrites;
      this.syncStatus.pendingWrites = 0;
      this.syncStatus.lastSync = new Date();
      
      return { success: true, synced: toSync };
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  async syncFromRemote(): Promise<{ success: boolean; received: number }> {
    this.syncStatus.isSyncing = true;
    
    try {
      await this.sleep(100);
      
      // Simulate receiving data
      const received = 0;
      this.syncStatus.lastSync = new Date();
      
      return { success: true, received };
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  async bidirectionalSync(): Promise<{
    success: boolean;
    synced: number;
    received: number;
    conflicts: number;
  }> {
    this.syncStatus.isSyncing = true;
    this.syncStatus.conflicts = [];
    
    try {
      await this.sleep(150);
      
      const toSync = this.syncStatus.pendingWrites;
      this.syncStatus.pendingWrites = 0;
      this.syncStatus.lastSync = new Date();
      
      return {
        success: true,
        synced: toSync,
        received: 0,
        conflicts: 0,
      };
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  // Conflict resolution
  detectConflicts(remoteNodes: Map<string, CodeNode>): Array<{ local: CodeNode; remote: CodeNode }> {
    const conflicts: Array<{ local: CodeNode; remote: CodeNode }> = [];
    
    for (const [id, localNode] of this.localNodes.entries()) {
      const remoteNode = remoteNodes.get(id);
      if (remoteNode && this.hasDiverged(localNode, remoteNode)) {
        conflicts.push({ local: localNode, remote: remoteNode });
      }
    }
    
    this.syncStatus.conflicts = conflicts;
    return conflicts;
  }

  resolveConflict(
    conflict: { local: CodeNode; remote: CodeNode },
    strategy: 'local' | 'remote' | 'merge'
  ): CodeNode {
    switch (strategy) {
      case 'local':
        return conflict.local;
      case 'remote':
        return conflict.remote;
      case 'merge':
        return this.mergeNodes(conflict.local, conflict.remote);
    }
  }

  // Cache management
  clearCache(): void {
    this.localNodes.clear();
    this.localEdges = [];
    this.syncStatus.pendingWrites = 0;
  }

  getCacheSize(): {
    nodes: number;
    edges: number;
    estimatedSizeMB: number;
  } {
    const nodeSize = JSON.stringify(Array.from(this.localNodes.values())).length;
    const edgeSize = JSON.stringify(this.localEdges).length;
    const totalBytes = nodeSize + edgeSize;
    
    return {
      nodes: this.localNodes.size,
      edges: this.localEdges.length,
      estimatedSizeMB: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
    };
  }

  pruneCache(maxSizeMB: number): number {
    const size = this.getCacheSize();
    
    if (size.estimatedSizeMB <= maxSizeMB) {
      return 0;
    }
    
    // Remove oldest nodes (simple LRU approximation)
    const nodes = Array.from(this.localNodes.values());
    const toRemove = Math.ceil(nodes.length * 0.2); // Remove 20%
    
    // Sort by change frequency (keep frequently changed)
    nodes.sort((a, b) => a.changeFrequency - b.changeFrequency);
    
    let removed = 0;
    for (let i = 0; i < toRemove && i < nodes.length; i++) {
      this.localNodes.delete(nodes[i].id);
      removed++;
    }
    
    return removed;
  }

  // Status
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  isStale(maxAgeMinutes: number = 30): boolean {
    if (!this.syncStatus.lastSync) return true;
    
    const ageMs = Date.now() - this.syncStatus.lastSync.getTime();
    return ageMs > maxAgeMinutes * 60 * 1000;
  }

  // Export/Import
  exportToJSON(): string {
    return JSON.stringify({
      nodes: Array.from(this.localNodes.values()),
      edges: this.localEdges,
      syncStatus: {
        lastSync: this.syncStatus.lastSync?.toISOString(),
        pendingWrites: this.syncStatus.pendingWrites,
      },
    });
  }

  importFromJSON(json: string): boolean {
    try {
      const data = JSON.parse(json);
      
      this.localNodes.clear();
      for (const node of data.nodes) {
        this.localNodes.set(node.id, node);
      }
      
      this.localEdges = data.edges ?? [];
      this.syncStatus.pendingWrites = data.syncStatus?.pendingWrites ?? 0;
      
      if (data.syncStatus?.lastSync) {
        this.syncStatus.lastSync = new Date(data.syncStatus.lastSync);
      }
      
      return true;
    } catch {
      return false;
    }
  }

  private hasDiverged(local: CodeNode, remote: CodeNode): boolean {
    // Simple comparison - in real implementation, use version/timestamp
    return local.changeFrequency !== remote.changeFrequency ||
           local.testCoverage !== remote.testCoverage;
  }

  private mergeNodes(local: CodeNode, remote: CodeNode): CodeNode {
    return {
      ...local,
      // Take higher complexity
      complexity: Math.max(local.complexity, remote.complexity),
      // Take higher test coverage
      testCoverage: Math.max(local.testCoverage, remote.testCoverage),
      // Merge semantic tags
      semanticTags: [...new Set([...local.semanticTags, ...remote.semanticTags])],
      // Merge dependents
      dependents: [...new Set([...local.dependents, ...remote.dependents])],
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createGraphMemory(): GraphMemory {
  return new GraphMemory();
}
