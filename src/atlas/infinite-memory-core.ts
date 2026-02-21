// Infinite Hierarchical Memory — Core (Mem0 + Letta-inspired)
// KIMI-R23-03 | Feb 2026

export type MemoryLevel = 'scene' | 'project' | 'portfolio' | 'lifetime';

export interface HierarchicalMemoryNode {
  id: string;
  level: MemoryLevel;
  parentId: string | null;
  content: string;
  embedding?: number[];
  tags: string[];
  agentId?: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  tasteScore: number;     // 0-1; Taste Vault alignment
  importance: number;     // 0-1; computed from access + recency
  metadata: Record<string, unknown>;
}

export interface MemoryUpsertOptions {
  level: MemoryLevel;
  parentId?: string | null;
  agentId?: string;
  projectId?: string;
  tags?: string[];
  tasteScore?: number;
  metadata?: Record<string, unknown>;
}

export interface HierarchicalQueryOptions {
  level?: MemoryLevel;
  agentId?: string;
  projectId?: string;
  tags?: string[];
  minTasteScore?: number;
  maxResults?: number;
  includeChildren?: boolean;
  keywords?: string[];
}

export interface MemoryMigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
}

export class InfiniteMemoryGraph {
  private nodes = new Map<string, HierarchicalMemoryNode>();
  private childIndex = new Map<string, Set<string>>(); // parentId → childIds
  private tagIndex = new Map<string, Set<string>>();   // tag → nodeIds
  private levelIndex = new Map<MemoryLevel, Set<string>>(); // level → nodeIds

  constructor(private maxNodes = 1_000_000) {}

  upsertWithHierarchy(
    id: string,
    content: string,
    opts: MemoryUpsertOptions,
  ): HierarchicalMemoryNode {
    const existing = this.nodes.get(id);

    const node: HierarchicalMemoryNode = {
      id,
      level: opts.level,
      parentId: opts.parentId ?? null,
      content,
      tags: opts.tags ?? [],
      agentId: opts.agentId,
      projectId: opts.projectId,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      accessCount: existing?.accessCount ?? 0,
      tasteScore: opts.tasteScore ?? 1.0,
      importance: this.computeImportance(existing?.accessCount ?? 0, Date.now()),
      metadata: { ...(existing?.metadata ?? {}), ...(opts.metadata ?? {}) },
    };

    this.removeFromIndexes(node.id);
    this.nodes.set(id, node);
    this.addToIndexes(node);

    // Evict if over capacity
    if (this.nodes.size > this.maxNodes) {
      this.evictLeastImportant();
    }

    return node;
  }

  get(id: string): HierarchicalMemoryNode | undefined {
    const node = this.nodes.get(id);
    if (node) {
      node.accessCount++;
      node.importance = this.computeImportance(node.accessCount, node.createdAt);
    }
    return node;
  }

  queryHierarchical(opts: HierarchicalQueryOptions): HierarchicalMemoryNode[] {
    let candidates: HierarchicalMemoryNode[];

    if (opts.level) {
      const ids = this.levelIndex.get(opts.level) ?? new Set();
      candidates = [...ids].map(id => this.nodes.get(id)!).filter(Boolean);
    } else {
      candidates = [...this.nodes.values()];
    }

    if (opts.agentId) candidates = candidates.filter(n => n.agentId === opts.agentId);
    if (opts.projectId) candidates = candidates.filter(n => n.projectId === opts.projectId);
    if (opts.minTasteScore !== undefined) {
      candidates = candidates.filter(n => n.tasteScore >= opts.minTasteScore!);
    }

    if (opts.tags?.length) {
      candidates = candidates.filter(n =>
        opts.tags!.every(tag => n.tags.includes(tag)),
      );
    }

    if (opts.keywords?.length) {
      const kws = opts.keywords.map(k => k.toLowerCase());
      candidates = candidates.filter(n =>
        kws.some(kw => n.content.toLowerCase().includes(kw)),
      );
    }

    // Sort by importance descending
    candidates.sort((a, b) => b.importance - a.importance);

    // Include children if requested
    if (opts.includeChildren) {
      const childSet = new Set<string>();
      for (const node of candidates) {
        const children = this.getChildren(node.id);
        for (const child of children) {
          if (!candidates.find(c => c.id === child.id)) {
            childSet.add(child.id);
          }
        }
      }
      for (const childId of childSet) {
        const c = this.nodes.get(childId);
        if (c) candidates.push(c);
      }
    }

    return candidates.slice(0, opts.maxResults ?? 100);
  }

  getChildren(parentId: string): HierarchicalMemoryNode[] {
    const childIds = this.childIndex.get(parentId) ?? new Set();
    return [...childIds].map(id => this.nodes.get(id)!).filter(Boolean);
  }

  getParentChain(id: string): HierarchicalMemoryNode[] {
    const chain: HierarchicalMemoryNode[] = [];
    let current = this.nodes.get(id);
    while (current?.parentId) {
      const parent = this.nodes.get(current.parentId);
      if (!parent) break;
      chain.unshift(parent);
      current = parent;
    }
    return chain;
  }

  delete(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;
    this.removeFromIndexes(id);
    this.nodes.delete(id);
    return true;
  }

  size(): number {
    return this.nodes.size;
  }

  clear(): void {
    this.nodes.clear();
    this.childIndex.clear();
    this.tagIndex.clear();
    this.levelIndex.clear();
  }

  migrateLegacyGraphMemory(
    legacyEntries: Array<{ id: string; content: string; agentId?: string; tags?: string[] }>,
  ): MemoryMigrationResult {
    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const entry of legacyEntries) {
      try {
        if (this.nodes.has(entry.id)) {
          skipped++;
          continue;
        }
        this.upsertWithHierarchy(entry.id, entry.content, {
          level: 'project',
          agentId: entry.agentId,
          tags: entry.tags ?? [],
        });
        migrated++;
      } catch (err) {
        errors.push(`${entry.id}: ${String(err)}`);
      }
    }

    return { migrated, skipped, errors };
  }

  private computeImportance(accessCount: number, createdAt: number): number {
    const ageMs = Date.now() - createdAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.max(0, 1 - ageDays / 365);  // decays over 1 year
    const accessFactor = Math.min(1, accessCount / 100);    // caps at 100 accesses
    return recencyFactor * 0.6 + accessFactor * 0.4;
  }

  private addToIndexes(node: HierarchicalMemoryNode): void {
    if (node.parentId) {
      if (!this.childIndex.has(node.parentId)) this.childIndex.set(node.parentId, new Set());
      this.childIndex.get(node.parentId)!.add(node.id);
    }

    if (!this.levelIndex.has(node.level)) this.levelIndex.set(node.level, new Set());
    this.levelIndex.get(node.level)!.add(node.id);

    for (const tag of node.tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(node.id);
    }
  }

  private removeFromIndexes(id: string): void {
    const existing = this.nodes.get(id);
    if (!existing) return;

    if (existing.parentId) {
      this.childIndex.get(existing.parentId)?.delete(id);
    }
    this.levelIndex.get(existing.level)?.delete(id);
    for (const tag of existing.tags) {
      this.tagIndex.get(tag)?.delete(id);
    }
  }

  private evictLeastImportant(): void {
    let leastId = '';
    let leastImportance = Infinity;
    for (const [id, node] of this.nodes) {
      if (node.importance < leastImportance) {
        leastImportance = node.importance;
        leastId = id;
      }
    }
    if (leastId) {
      this.delete(leastId);
    }
  }
}

// Singleton facade
export class ATLASInfiniteMemory {
  private graph: InfiniteMemoryGraph;

  constructor(maxNodes = 1_000_000) {
    this.graph = new InfiniteMemoryGraph(maxNodes);
  }

  upsert(id: string, content: string, opts: MemoryUpsertOptions): HierarchicalMemoryNode {
    return this.graph.upsertWithHierarchy(id, content, opts);
  }

  recall(opts: HierarchicalQueryOptions): HierarchicalMemoryNode[] {
    return this.graph.queryHierarchical(opts);
  }

  get(id: string): HierarchicalMemoryNode | undefined {
    return this.graph.get(id);
  }

  getContext(nodeId: string): { node: HierarchicalMemoryNode; ancestors: HierarchicalMemoryNode[]; children: HierarchicalMemoryNode[] } | undefined {
    const node = this.graph.get(nodeId);
    if (!node) return undefined;
    return {
      node,
      ancestors: this.graph.getParentChain(nodeId),
      children: this.graph.getChildren(nodeId),
    };
  }

  migrate(legacyEntries: Array<{ id: string; content: string; agentId?: string; tags?: string[] }>): MemoryMigrationResult {
    return this.graph.migrateLegacyGraphMemory(legacyEntries);
  }

  size(): number {
    return this.graph.size();
  }

  clear(): void {
    this.graph.clear();
  }
}
