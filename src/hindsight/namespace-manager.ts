// Namespace Manager - Handle namespace isolation, forking, and merging
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md

import type {
  MemoryFragment,
  HindsightEngine,
  MergeReport,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface NamespaceManagerConfig {
  enableIsolation: boolean;
  maxNamespaces: number;
}

export const DEFAULT_CONFIG: NamespaceManagerConfig = {
  enableIsolation: true,
  maxNamespaces: 100,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Namespace Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class NamespaceManager {
  private engine: HindsightEngine;
  private config: NamespaceManagerConfig;
  private activeNamespaces = new Set<string>();

  constructor(engine: HindsightEngine, config?: Partial<NamespaceManagerConfig>) {
    this.engine = engine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Fork Namespace
  // ═══════════════════════════════════════════════════════════════════════════

  async forkNamespace(source: string, target: string): Promise<void> {
    if (this.config.enableIsolation && this.activeNamespaces.size >= this.config.maxNamespaces) {
      throw new Error(`Maximum number of namespaces (${this.config.maxNamespaces}) reached`);
    }

    await this.engine.forkNamespace(source, target);
    this.activeNamespaces.add(target);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Merge Namespaces
  // ═══════════════════════════════════════════════════════════════════════════

  async mergeNamespaces(source: string, target: string): Promise<MergeReport> {
    const report = await this.engine.mergeNamespaces(source, target);
    
    if (report.fragmentsMerged > 0) {
      this.activeNamespaces.delete(source);
    }

    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // List Namespaces
  // ═══════════════════════════════════════════════════════════════════════════

  async listNamespaces(): Promise<string[]> {
    const health = await this.engine.healthCheck();
    // In a real implementation, this would query storage for unique namespaces
    return Array.from(this.activeNamespaces);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-Agent Retrieval
  // ═══════════════════════════════════════════════════════════════════════════

  async retrieveCrossAgent(
    query: string,
    agentIds: string[],
    projectId?: string
  ): Promise<MemoryFragment[]> {
    const results: MemoryFragment[] = [];

    for (const agentId of agentIds) {
      const namespace = projectId ? `${projectId}:${agentId}` : `default:${agentId}`;
      const agentResults = await this.engine.retrieve({
        query,
        filter: { namespace },
        topK: 5,
      });

      results.push(...agentResults.fragments.map(f => f.fragment));
    }

    // Sort by relevance
    return results.sort((a, b) => b.relevance - a.relevance);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Parallel Universe Bridge
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParallelUniverseContext {
  universeId: string;
  baseProjectId: string;
  branchName: string;
  forkedAt: number;
  memories: MemoryFragment[];
}

export class ParallelUniverseBridge {
  private engine: HindsightEngine;
  private universes = new Map<string, ParallelUniverseContext>();

  constructor(engine: HindsightEngine) {
    this.engine = engine;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Create Universe
  // ═══════════════════════════════════════════════════════════════════════════

  async createUniverse(
    universeId: string,
    baseProjectId: string,
    branchName: string
  ): Promise<ParallelUniverseContext> {
    const namespace = `${baseProjectId}:main`;
    const forkedAt = Date.now();

    // Fork memories from base project
    const targetNamespace = `${baseProjectId}:${universeId}`;
    await this.engine.forkNamespace(namespace, targetNamespace);

    // Get forked memories
    const exported = await this.engine.exportMemories(targetNamespace);
    const memories: MemoryFragment[] = JSON.parse(exported);

    const context: ParallelUniverseContext = {
      universeId,
      baseProjectId,
      branchName,
      forkedAt,
      memories,
    };

    this.universes.set(universeId, context);
    return context;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Sync Universe
  // ═══════════════════════════════════════════════════════════════════════════

  async syncUniverse(universeId: string): Promise<void> {
    const context = this.universes.get(universeId);
    if (!context) {
      throw new Error(`Universe ${universeId} not found`);
    }

    const namespace = `${context.baseProjectId}:${universeId}`;
    const exported = await this.engine.exportMemories(namespace);
    context.memories = JSON.parse(exported);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Merge Universe Back
  // ═══════════════════════════════════════════════════════════════════════════

  async mergeUniverseBack(universeId: string): Promise<MergeReport> {
    const context = this.universes.get(universeId);
    if (!context) {
      throw new Error(`Universe ${universeId} not found`);
    }

    const sourceNamespace = `${context.baseProjectId}:${universeId}`;
    const targetNamespace = `${context.baseProjectId}:main`;

    const report = await this.engine.mergeNamespaces(sourceNamespace, targetNamespace);

    if (report.fragmentsMerged > 0) {
      this.universes.delete(universeId);
    }

    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Get Universe
  // ═══════════════════════════════════════════════════════════════════════════

  getUniverse(universeId: string): ParallelUniverseContext | undefined {
    return this.universes.get(universeId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // List Universes
  // ═══════════════════════════════════════════════════════════════════════════

  listUniverses(): string[] {
    return Array.from(this.universes.keys());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function createNamespaceManager(
  engine: HindsightEngine,
  config?: Partial<NamespaceManagerConfig>
): NamespaceManager {
  return new NamespaceManager(engine, config);
}

export function createParallelUniverseBridge(
  engine: HindsightEngine
): ParallelUniverseBridge {
  return new ParallelUniverseBridge(engine);
}
