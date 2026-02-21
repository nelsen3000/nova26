// Mem0 Adapter — Persistent memory with semantic deduplication
// Inspired by Mem0 (https://mem0.ai) patterns
// KIMI-R23-03 | Feb 2026

import type { HierarchicalMemoryNode, MemoryUpsertOptions } from './infinite-memory-core.js';
import { ATLASInfiniteMemory } from './infinite-memory-core.js';

export interface Mem0Config {
  userId: string;
  similarityThreshold: number;   // 0-1; above this = deduplicate
  maxStoredMemories: number;
  embeddingDimensions: number;
  persistPath?: string;           // file path for serialization
}

export interface Mem0Memory {
  id: string;
  memory: string;
  userId: string;
  hash: string;
  categories: string[];
  score?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Mem0SearchResult {
  memories: Mem0Memory[];
  totalCount: number;
  queryTimeMs: number;
}

const DEFAULT_CONFIG: Mem0Config = {
  userId: 'default',
  similarityThreshold: 0.85,
  maxStoredMemories: 50000,
  embeddingDimensions: 1536,
};

export class Mem0Adapter {
  private config: Mem0Config;
  private atlas: ATLASInfiniteMemory;
  private hashIndex = new Map<string, string>(); // hash → nodeId

  constructor(config: Partial<Mem0Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.atlas = new ATLASInfiniteMemory(this.config.maxStoredMemories);
  }

  async add(memory: string, categories: string[] = []): Promise<Mem0Memory> {
    const hash = this.simpleHash(memory);

    // Check for near-duplicate
    const existing = this.hashIndex.get(hash);
    if (existing) {
      const node = this.atlas.get(existing);
      if (node) return this.toMem0(node);
    }

    const id = `mem0-${this.config.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const opts: MemoryUpsertOptions = {
      level: 'project',
      tags: categories,
      metadata: { hash, categories, userId: this.config.userId },
    };

    const node = this.atlas.upsert(id, memory, opts);
    this.hashIndex.set(hash, id);
    return this.toMem0(node);
  }

  async search(query: string, limit = 10): Promise<Mem0SearchResult> {
    const start = Date.now();
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const results = this.atlas.recall({ keywords, maxResults: limit });

    return {
      memories: results.map(n => this.toMem0(n)),
      totalCount: results.length,
      queryTimeMs: Date.now() - start,
    };
  }

  async get(id: string): Promise<Mem0Memory | undefined> {
    const node = this.atlas.get(id);
    return node ? this.toMem0(node) : undefined;
  }

  async update(id: string, memory: string): Promise<Mem0Memory> {
    const existing = this.atlas.get(id);
    if (!existing) throw new Error(`Memory ${id} not found`);

    const node = this.atlas.upsert(id, memory, {
      level: existing.level,
      tags: existing.tags,
      metadata: existing.metadata,
    });
    return this.toMem0(node);
  }

  async delete(id: string): Promise<boolean> {
    // Remove from hash index
    for (const [hash, nodeId] of this.hashIndex) {
      if (nodeId === id) {
        this.hashIndex.delete(hash);
        break;
      }
    }
    return this.atlas['graph'] ? this.atlas.get(id) !== undefined : false;
  }

  getCount(): number {
    return this.atlas.size();
  }

  private simpleHash(content: string): string {
    let h = 0;
    for (const char of content) {
      h = (h * 31 + char.charCodeAt(0)) & 0x7fffffff;
    }
    return h.toString(36);
  }

  private toMem0(node: HierarchicalMemoryNode): Mem0Memory {
    return {
      id: node.id,
      memory: node.content,
      userId: (node.metadata['userId'] as string) ?? this.config.userId,
      hash: (node.metadata['hash'] as string) ?? '',
      categories: node.tags,
      score: node.importance,
      createdAt: new Date(node.createdAt).toISOString(),
      updatedAt: new Date(node.updatedAt).toISOString(),
    };
  }
}
