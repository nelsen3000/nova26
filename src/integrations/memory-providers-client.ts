// KMS-13: Mem0/Letta Memory Providers Client
// Mock implementation for memory storage and retrieval

// ============================================================================
// Types
// ============================================================================

export type MemoryProvider = 'mem0' | 'letta';

export interface Memory {
  id: string;
  content: string;
  collection: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  embeddings?: number[];
  tags?: string[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface StoreMemoryOptions {
  content: string;
  collection?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface QueryMemoryOptions {
  query: string;
  collection?: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, unknown>;
}

export interface QueryResult {
  memory: Memory;
  score: number;
}

export interface UpdateMemoryOptions {
  id: string;
  content?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface ListCollectionsOptions {
  limit?: number;
  offset?: number;
}

// ============================================================================
// Mock Data Store
// ============================================================================

class MockMemoryStore {
  private memories: Map<string, Memory> = new Map();
  private collections: Map<string, Collection> = new Map();
  private nextId = 1;

  generateId(): string {
    return `mem-${Date.now()}-${this.nextId++}`;
  }

  generateCollectionId(): string {
    return `col-${Date.now()}-${this.nextId++}`;
  }

  saveMemory(memory: Memory): void {
    this.memories.set(memory.id, memory);
  }

  getMemory(id: string): Memory | undefined {
    return this.memories.get(id);
  }

  deleteMemory(id: string): boolean {
    return this.memories.delete(id);
  }

  listMemories(collection?: string): Memory[] {
    const all = Array.from(this.memories.values());
    if (collection) {
      return all.filter((m) => m.collection === collection);
    }
    return all;
  }

  queryMemories(options: QueryMemoryOptions): QueryResult[] {
    const all = this.listMemories(options.collection);
    
    // Simple mock similarity search based on string inclusion
    const results: QueryResult[] = all
      .map((memory) => {
        const queryLower = options.query.toLowerCase();
        const contentLower = memory.content.toLowerCase();
        let score = 0;
        
        if (contentLower.includes(queryLower)) {
          score = 0.8 + (queryLower.length / contentLower.length) * 0.2;
        } else {
          // Partial word matching
          const queryWords = queryLower.split(/\s+/);
          const contentWords = contentLower.split(/\s+/);
          const matches = queryWords.filter((w) => 
            contentWords.some((cw) => cw.includes(w) || w.includes(cw))
          );
          score = (matches.length / queryWords.length) * 0.6;
        }

        // Apply filters if provided
        if (options.filters && memory.metadata) {
          for (const [key, value] of Object.entries(options.filters)) {
            if (memory.metadata[key] !== value) {
              score = 0;
              break;
            }
          }
        }

        return { memory, score };
      })
      .filter((r) => r.score > (options.threshold || 0))
      .sort((a, b) => b.score - a.score);

    const limit = options.limit ?? 10;
    return results.slice(0, limit);
  }

  saveCollection(collection: Collection): void {
    this.collections.set(collection.id, collection);
  }

  collectionExists(name: string): boolean {
    return Array.from(this.collections.values()).some((c) => c.name === name);
  }

  getCollection(id: string): Collection | undefined {
    return this.collections.get(id);
  }

  getCollectionByName(name: string): Collection | undefined {
    return Array.from(this.collections.values()).find((c) => c.name === name);
  }

  listCollections(options: ListCollectionsOptions = {}): Collection[] {
    let cols = Array.from(this.collections.values());
    cols.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (options.offset) {
      cols = cols.slice(options.offset);
    }

    if (options.limit) {
      cols = cols.slice(0, options.limit);
    }

    return cols;
  }

  deleteCollection(id: string): boolean {
    // Also delete all memories in this collection
    const collection = this.collections.get(id);
    if (collection) {
      const memories = Array.from(this.memories.values());
      for (const memory of memories) {
        if (memory.collection === collection.name) {
          this.memories.delete(memory.id);
        }
      }
    }
    return this.collections.delete(id);
  }

  ensureDefaultCollection(): Collection {
    const existing = this.getCollectionByName('default');
    if (existing) {
      return existing;
    }

    const collection: Collection = {
      id: this.generateCollectionId(),
      name: 'default',
      description: 'Default memory collection',
      createdAt: new Date().toISOString(),
    };
    this.saveCollection(collection);
    return collection;
  }

  clear(): void {
    this.memories.clear();
    this.collections.clear();
    this.nextId = 1;
  }
}

// Separate stores for each provider
const mem0MemoryStore = new MockMemoryStore();
const lettaMemoryStore = new MockMemoryStore();

// ============================================================================
// Memory Providers Client
// ============================================================================

export interface MemoryProvidersClientConfig {
  apiKey: string;
  provider: MemoryProvider;
  baseUrl?: string;
}

export class MemoryProvidersClient {
  private config: MemoryProvidersClientConfig;
  private connected = false;
  private dataStore: MockMemoryStore;

  constructor(config: MemoryProvidersClientConfig) {
    this.config = {
      baseUrl: this.getDefaultBaseUrl(config.provider),
      ...config,
    };
    this.dataStore = config.provider === 'mem0' ? mem0MemoryStore : lettaMemoryStore;
  }

  private getDefaultBaseUrl(provider: MemoryProvider): string {
    switch (provider) {
      case 'mem0':
        return 'https://api.mem0.ai';
      case 'letta':
        return 'https://api.letta.com';
      default:
        return '';
    }
  }

  /**
   * Connect to the memory provider API (mock)
   */
  async connect(): Promise<boolean> {
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (!this.config.apiKey) {
      throw new Error(`${this.config.provider} API key is required`);
    }

    this.connected = true;
    this.dataStore.ensureDefaultCollection();
    return true;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the provider type
   */
  getProvider(): MemoryProvider {
    return this.config.provider;
  }

  /**
   * Store a new memory
   */
  async store(options: StoreMemoryOptions): Promise<Memory> {
    this.ensureConnected();

    const collectionName = options.collection || 'default';
    
    // Ensure collection exists
    const existingCollection = this.dataStore.getCollectionByName(collectionName);
    if (!existingCollection) {
      const newCollection: Collection = {
        id: this.dataStore.generateCollectionId(),
        name: collectionName,
        createdAt: new Date().toISOString(),
      };
      this.dataStore.saveCollection(newCollection);
    }

    const now = new Date().toISOString();
    const memory: Memory = {
      id: this.dataStore.generateId(),
      content: options.content,
      collection: collectionName,
      metadata: options.metadata,
      createdAt: now,
      updatedAt: now,
      tags: options.tags,
    };

    this.dataStore.saveMemory(memory);
    return memory;
  }

  /**
   * Query memories with semantic search
   */
  async query(options: QueryMemoryOptions): Promise<QueryResult[]> {
    this.ensureConnected();

    return this.dataStore.queryMemories(options);
  }

  /**
   * Update an existing memory
   */
  async update(options: UpdateMemoryOptions): Promise<Memory> {
    this.ensureConnected();

    const existing = this.dataStore.getMemory(options.id);
    if (!existing) {
      throw new Error(`Memory not found: ${options.id}`);
    }

    const updated: Memory = {
      ...existing,
      content: options.content ?? existing.content,
      metadata: options.metadata !== undefined 
        ? { ...existing.metadata, ...options.metadata }
        : existing.metadata,
      tags: options.tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
    };

    this.dataStore.saveMemory(updated);
    return updated;
  }

  /**
   * Delete a memory by ID
   */
  async delete(id: string): Promise<boolean> {
    this.ensureConnected();

    return this.dataStore.deleteMemory(id);
  }

  /**
   * List all available collections
   */
  async listCollections(options: ListCollectionsOptions = {}): Promise<Collection[]> {
    this.ensureConnected();

    return this.dataStore.listCollections(options);
  }

  /**
   * Get a specific memory by ID
   */
  async get(id: string): Promise<Memory | null> {
    this.ensureConnected();

    return this.dataStore.getMemory(id) || null;
  }

  /**
   * Get all memories in a collection
   */
  async list(collection?: string): Promise<Memory[]> {
    this.ensureConnected();

    return this.dataStore.listMemories(collection);
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(
        `${this.config.provider} client not connected. Call connect() first.`
      );
    }
  }
}

// ============================================================================
// Singleton Instances
// ============================================================================

const clients: Map<MemoryProvider, MemoryProvidersClient> = new Map();

export function getMemoryProvidersClient(
  config?: MemoryProvidersClientConfig
): MemoryProvidersClient {
  if (config) {
    const existing = clients.get(config.provider);
    if (existing) {
      return existing;
    }
    const client = new MemoryProvidersClient(config);
    clients.set(config.provider, client);
    return client;
  }

  // Return mem0 as default if no config provided and mem0 exists
  const mem0Client = clients.get('mem0');
  if (mem0Client) {
    return mem0Client;
  }

  const lettaClient = clients.get('letta');
  if (lettaClient) {
    return lettaClient;
  }

  throw new Error(
    'Memory providers client not initialized. Provide config on first call.'
  );
}

export function resetMemoryProvidersClient(provider?: MemoryProvider): void {
  if (provider) {
    clients.delete(provider);
    if (provider === 'mem0') {
      mem0MemoryStore.clear();
    } else {
      lettaMemoryStore.clear();
    }
  } else {
    clients.clear();
    mem0MemoryStore.clear();
    lettaMemoryStore.clear();
  }
}

export function createMemoryProvidersClient(
  config: MemoryProvidersClientConfig
): MemoryProvidersClient {
  return new MemoryProvidersClient(config);
}
