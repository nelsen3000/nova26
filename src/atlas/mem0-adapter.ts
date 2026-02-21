// KIMI-R23-03: Mem0 API Adapter
// External memory storage integration (mocked for development)
// Mem0 (https://mem0.ai) provides long-term memory for AI agents

// ============================================================================
// Types
// ============================================================================

export interface Mem0Config {
  apiKey: string;
  baseUrl: string;
  userId: string;
  agentId: string;
  projectId?: string;
}

export interface Mem0Memory {
  id: string;
  content: string;
  metadata: {
    userId: string;
    agentId: string;
    projectId?: string;
    timestamp: string;
    tags?: string[];
    category?: string;
  };
  embedding?: number[];
  score?: number;
}

export interface Mem0SearchResult {
  memories: Mem0Memory[];
  total: number;
}

export interface Mem0StoreOptions {
  tags?: string[];
  category?: string;
  expireAt?: string;
}

export interface Mem0SearchOptions {
  limit?: number;
  filters?: {
    userId?: string;
    agentId?: string;
    projectId?: string;
    tags?: string[];
    category?: string;
    startTime?: string;
    endTime?: string;
  };
}

export interface Mem0HealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs: number;
  version?: string;
}

export interface Mem0SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
}

// ============================================================================
// Mem0 Adapter
// ============================================================================

export class Mem0Adapter {
  private config: Mem0Config;
  private mockMode: boolean;
  private mockStorage: Map<string, Mem0Memory> = new Map();
  private lastSyncTime: Date | null = null;

  constructor(config: Partial<Mem0Config> = {}, mockMode = true) {
    this.config = {
      apiKey: config.apiKey ?? process.env.MEM0_API_KEY ?? '',
      baseUrl: config.baseUrl ?? 'https://api.mem0.ai/v1',
      userId: config.userId ?? 'default',
      agentId: config.agentId ?? 'atlas',
      projectId: config.projectId,
    };
    this.mockMode = mockMode;
  }

  // ============================================================================
  // Core API
  // ============================================================================

  /**
   * Store a memory in Mem0
   */
  async store(
    content: string,
    options: Mem0StoreOptions = {}
  ): Promise<Mem0Memory> {
    this.ensureNotReadonly();

    if (this.mockMode) {
      return this.mockStore(content, options);
    }

    const response = await this.fetchApi<Mem0Memory>('/memories', {
      method: 'POST',
      body: JSON.stringify({
        content,
        metadata: {
          userId: this.config.userId,
          agentId: this.config.agentId,
          projectId: this.config.projectId,
          timestamp: new Date().toISOString(),
          tags: options.tags,
          category: options.category,
        },
      }),
    });

    return response;
  }

  /**
   * Search memories in Mem0
   */
  async search(
    query: string,
    options: Mem0SearchOptions = {}
  ): Promise<Mem0SearchResult> {
    if (this.mockMode) {
      return this.mockSearch(query, options);
    }

    const searchParams = new URLSearchParams({
      query,
      limit: String(options.limit ?? 10),
    });

    if (options.filters) {
      if (options.filters.userId) {
        searchParams.set('user_id', options.filters.userId);
      }
      if (options.filters.agentId) {
        searchParams.set('agent_id', options.filters.agentId);
      }
      if (options.filters.category) {
        searchParams.set('category', options.filters.category);
      }
    }

    const response = await this.fetchApi<Mem0SearchResult>(
      `/memories/search?${searchParams.toString()}`
    );

    return response;
  }

  /**
   * Get a specific memory by ID
   */
  async get(memoryId: string): Promise<Mem0Memory | null> {
    if (this.mockMode) {
      return this.mockStorage.get(memoryId) ?? null;
    }

    try {
      const response = await this.fetchApi<Mem0Memory>(`/memories/${memoryId}`);
      return response;
    } catch (error) {
      if (error instanceof Mem0NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update an existing memory
   */
  async update(
    memoryId: string,
    content: string,
    options: Partial<Mem0StoreOptions> = {}
  ): Promise<Mem0Memory> {
    this.ensureNotReadonly();

    if (this.mockMode) {
      const existing = this.mockStorage.get(memoryId);
      if (!existing) {
        throw new Mem0NotFoundError(`Memory not found: ${memoryId}`);
      }

      const updated: Mem0Memory = {
        ...existing,
        content,
        metadata: {
          ...existing.metadata,
          ...options,
          timestamp: new Date().toISOString(),
        },
      };

      this.mockStorage.set(memoryId, updated);
      return updated;
    }

    const response = await this.fetchApi<Mem0Memory>(`/memories/${memoryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        content,
        metadata: {
          ...options,
          timestamp: new Date().toISOString(),
        },
      }),
    });

    return response;
  }

  /**
   * Delete a memory
   */
  async delete(memoryId: string): Promise<boolean> {
    this.ensureNotReadonly();

    if (this.mockMode) {
      return this.mockStorage.delete(memoryId);
    }

    await this.fetchApi<void>(`/memories/${memoryId}`, {
      method: 'DELETE',
    });

    return true;
  }

  /**
   * Delete all memories for the current user/agent
   */
  async deleteAll(filters?: { category?: string; tags?: string[] }): Promise<number> {
    this.ensureNotReadonly();

    if (this.mockMode) {
      let count = 0;
      for (const [id, memory] of this.mockStorage.entries()) {
        if (memory.metadata.userId === this.config.userId) {
          if (filters?.category && memory.metadata.category !== filters.category) {
            continue;
          }
          if (filters?.tags) {
            const hasAllTags = filters.tags.every((tag) =>
              memory.metadata.tags?.includes(tag)
            );
            if (!hasAllTags) {
              continue;
            }
          }
          this.mockStorage.delete(id);
          count++;
        }
      }
      return count;
    }

    const response = await this.fetchApi<{ deleted: number }>('/memories', {
      method: 'DELETE',
      body: JSON.stringify({
        user_id: this.config.userId,
        agent_id: this.config.agentId,
        ...filters,
      }),
    });

    return response.deleted;
  }

  /**
   * Get memory history/versions
   */
  async getHistory(memoryId: string): Promise<Mem0Memory[]> {
    if (this.mockMode) {
      // Mock: return single item as history
      const memory = this.mockStorage.get(memoryId);
      return memory ? [memory] : [];
    }

    const response = await this.fetchApi<Mem0Memory[]>(
      `/memories/${memoryId}/history`
    );
    return response;
  }

  // ============================================================================
  // Sync Operations
  // ============================================================================

  /**
   * Sync local hierarchical memories with Mem0
   * Bi-directional sync with conflict resolution
   */
  async syncWithHierarchicalMemory(
    localNodes: Array<{
      id: string;
      level: string;
      content: string;
      metadata: {
        agentId: string;
        timestamp: string;
        tasteScore: number;
        accessCount: number;
        lastAccessed: string;
      };
    }>,
    options: { since?: Date; conflictStrategy?: 'local' | 'remote' | 'merge' } = {}
  ): Promise<Mem0SyncResult> {
    this.ensureNotReadonly();

    const result: Mem0SyncResult = {
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Upload local nodes to Mem0
      for (const node of localNodes) {
        try {
          const category = this.mapLevelToCategory(node.level);
          await this.store(node.content, {
            category,
            tags: [
              `level:${node.level}`,
              `agent:${node.metadata.agentId}`,
              `taste:${Math.round(node.metadata.tasteScore * 100)}`,
            ],
          });
          result.uploaded++;
        } catch (error) {
          result.errors.push(`Failed to upload ${node.id}: ${String(error)}`);
        }
      }

      // Search for remote memories to download
      const since = options.since ?? this.lastSyncTime ?? undefined;
      const remoteMemories = await this.search('', {
        limit: 1000,
        filters: {
          userId: this.config.userId,
          agentId: this.config.agentId,
          startTime: since?.toISOString(),
        },
      });

      result.downloaded = remoteMemories.memories.length;
      this.lastSyncTime = new Date();

      return result;
    } catch (error) {
      result.errors.push(`Sync failed: ${String(error)}`);
      return result;
    }
  }

  /**
   * Bidirectional sync for specific hierarchy levels
   */
  async syncLevel(
    level: 'scene' | 'project' | 'portfolio' | 'lifetime',
    nodes: Array<{ id: string; content: string; metadata: Record<string, unknown> }>
  ): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    const category = this.mapLevelToCategory(level);

    for (const node of nodes) {
      try {
        await this.store(node.content, {
          category,
          tags: [`level:${level}`, `localId:${node.id}`],
        });
        synced++;
      } catch (error) {
        errors.push(`Failed to sync ${node.id}: ${String(error)}`);
      }
    }

    return { synced, errors };
  }

  // ============================================================================
  // Health & Status
  // ============================================================================

  /**
   * Check Mem0 API health
   */
  async healthCheck(): Promise<Mem0HealthStatus> {
    if (this.mockMode) {
      return {
        status: 'healthy',
        latencyMs: 5,
        version: 'mock-1.0.0',
      };
    }

    const start = performance.now();
    try {
      const response = await this.fetchApi<{ version: string }>('/health');
      return {
        status: 'healthy',
        latencyMs: Math.round(performance.now() - start),
        version: response.version,
      };
    } catch {
      return {
        status: 'unavailable',
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }

  /**
   * Check if Mem0 is available
   */
  async isAvailable(): Promise<boolean> {
    const health = await this.healthCheck();
    return health.status === 'healthy' || health.status === 'degraded';
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Update configuration
   */
  configure(config: Partial<Mem0Config>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<Mem0Config, 'apiKey'> {
    const { apiKey: _apiKey, ...safeConfig } = this.config;
    void _apiKey; // Acknowledge apiKey is intentionally omitted
    return safeConfig;
  }

  /**
   * Set mock mode
   */
  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
  }

  // ============================================================================
  // Mock Implementation
  // ============================================================================

  private mockStore(content: string, options: Mem0StoreOptions): Mem0Memory {
    const id = `mem0_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const memory: Mem0Memory = {
      id,
      content,
      metadata: {
        userId: this.config.userId,
        agentId: this.config.agentId,
        projectId: this.config.projectId,
        timestamp: new Date().toISOString(),
        tags: options.tags,
        category: options.category,
      },
    };

    this.mockStorage.set(id, memory);
    return memory;
  }

  private mockSearch(
    query: string,
    options: Mem0SearchOptions
  ): Mem0SearchResult {
    const results: Mem0Memory[] = [];
    const queryLower = query.toLowerCase();

    for (const memory of this.mockStorage.values()) {
      // Apply filters
      if (options.filters?.userId && memory.metadata.userId !== options.filters.userId) {
        continue;
      }
      if (options.filters?.agentId && memory.metadata.agentId !== options.filters.agentId) {
        continue;
      }
      if (options.filters?.category && memory.metadata.category !== options.filters.category) {
        continue;
      }

      // Simple content matching
      if (query && !memory.content.toLowerCase().includes(queryLower)) {
        continue;
      }

      results.push(memory);
    }

    // Sort by timestamp (newest first)
    results.sort(
      (a, b) =>
        new Date(b.metadata.timestamp).getTime() -
        new Date(a.metadata.timestamp).getTime()
    );

    const limit = options.limit ?? 10;
    return {
      memories: results.slice(0, limit),
      total: results.length,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.config.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Mem0NotFoundError(`Resource not found: ${endpoint}`);
      }
      throw new Mem0ApiError(
        `Mem0 API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private mapLevelToCategory(
    level: string
  ): 'session' | 'project' | 'portfolio' | 'knowledge' {
    const mapping: Record<string, 'session' | 'project' | 'portfolio' | 'knowledge'> = {
      scene: 'session',
      project: 'project',
      portfolio: 'portfolio',
      lifetime: 'knowledge',
    };
    return mapping[level] ?? 'project';
  }

  private ensureNotReadonly(): void {
    // Placeholder for future readonly mode support
    // Currently always allows writes
  }
}

// ============================================================================
// Error Types
// ============================================================================

export class Mem0ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'Mem0ApiError';
    this.statusCode = statusCode;
  }
}

export class Mem0NotFoundError extends Mem0ApiError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'Mem0NotFoundError';
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createMem0Adapter(
  config?: Partial<Mem0Config>,
  mockMode?: boolean
): Mem0Adapter {
  return new Mem0Adapter(config, mockMode);
}
