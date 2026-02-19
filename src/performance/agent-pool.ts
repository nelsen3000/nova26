// Agent Pool - Pooled agent lifecycle management
// KIMI-POLISH-06: Production Polish Sprint

// ============================================================================
// Types
// ============================================================================

export interface PooledAgent {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string;
  metadata: Record<string, unknown>;
}

export interface AgentPoolStats {
  total: number;
  active: number;
  idle: number;
  evicted: number;
  memoryUsage: {
    current: number;
    limit: number;
  };
}

export interface AgentPoolOptions {
  maxPoolSize: number;
  idleTimeoutMs: number;
  memoryLimitMb: number;
  warningThresholdPct: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_OPTIONS: AgentPoolOptions = {
  maxPoolSize: 10,
  idleTimeoutMs: 300_000, // 5 minutes
  memoryLimitMb: 512,
  warningThresholdPct: 80,
};

// ============================================================================
// Agent Pool
// ============================================================================

export class AgentPool {
  private agents: Map<string, PooledAgent> = new Map();
  private options: AgentPoolOptions;
  private evictedCount = 0;
  private memoryUsage = {
    current: 0,
    limit: 0,
  };

  constructor(options?: Partial<AgentPoolOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.memoryUsage.limit = this.options.memoryLimitMb;
  }

  /**
   * Acquire an agent from the pool
   */
  acquire(name: string): PooledAgent {
    // Check if agent already exists
    const existingAgent = this.agents.get(name);
    
    if (existingAgent) {
      // Reactivate existing agent
      existingAgent.isActive = true;
      existingAgent.lastUsedAt = new Date().toISOString();
      return existingAgent;
    }

    // Check if we need to evict to make room
    if (this.agents.size >= this.options.maxPoolSize) {
      this.evictLRUAgent();
    }

    // Create new agent
    const now = new Date().toISOString();
    const agent: PooledAgent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      isActive: true,
      createdAt: now,
      lastUsedAt: now,
      metadata: {},
    };

    this.agents.set(name, agent);
    this.updateMemoryUsage();
    
    return agent;
  }

  /**
   * Release an agent back to the pool
   */
  release(name: string): void {
    const agent = this.agents.get(name);
    
    if (agent) {
      agent.isActive = false;
      agent.lastUsedAt = new Date().toISOString();
    }
  }

  /**
   * Evict a specific agent from the pool
   */
  evict(name: string): boolean {
    const existed = this.agents.delete(name);
    
    if (existed) {
      this.evictedCount++;
      this.updateMemoryUsage();
    }
    
    return existed;
  }

  /**
   * Evict all idle agents that have been idle longer than timeout
   */
  evictIdleAgents(): number {
    const now = Date.now();
    const timeoutMs = this.options.idleTimeoutMs;
    let evicted = 0;

    const toEvict: string[] = [];

    for (const [name, agent] of this.agents.entries()) {
      if (!agent.isActive) {
        const lastUsed = new Date(agent.lastUsedAt).getTime();
        if (now - lastUsed > timeoutMs) {
          toEvict.push(name);
        }
      }
    }

    for (const name of toEvict) {
      this.agents.delete(name);
      evicted++;
      this.evictedCount++;
    }

    if (evicted > 0) {
      this.updateMemoryUsage();
    }

    return evicted;
  }

  /**
   * Check if memory budget is within limits
   */
  checkMemoryBudget(): { withinBudget: boolean; usagePercent: number } {
    const usagePercent = (this.memoryUsage.current / this.memoryUsage.limit) * 100;
    
    return {
      withinBudget: usagePercent < 100,
      usagePercent: Math.round(usagePercent * 100) / 100,
    };
  }

  /**
   * Check if scratchpad should be collapsed based on memory pressure
   */
  shouldCollapseScratchpad(): boolean {
    const { usagePercent } = this.checkMemoryBudget();
    return usagePercent >= this.options.warningThresholdPct;
  }

  /**
   * Prewarm the pool with inactive agents
   */
  prewarm(agentNames: string[]): void {
    for (const name of agentNames) {
      if (!this.agents.has(name)) {
        // Check if we need to evict to make room
        if (this.agents.size >= this.options.maxPoolSize) {
          this.evictLRUAgent();
        }

        const now = new Date().toISOString();
        const agent: PooledAgent = {
          id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          isActive: false, // Prewarmed agents are inactive
          createdAt: now,
          lastUsedAt: now,
          metadata: {},
        };

        this.agents.set(name, agent);
      }
    }
    
    this.updateMemoryUsage();
  }

  /**
   * Get pool statistics
   */
  stats(): AgentPoolStats {
    let active = 0;
    let idle = 0;

    for (const agent of this.agents.values()) {
      if (agent.isActive) {
        active++;
      } else {
        idle++;
      }
    }

    // Memory budget stats included in return
    return {
      total: this.agents.size,
      active,
      idle,
      evicted: this.evictedCount,
      memoryUsage: {
        current: this.memoryUsage.current,
        limit: this.memoryUsage.limit,
      },
    };
  }

  /**
   * Get all agents (for testing)
   */
  getAllAgents(): PooledAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Clear all agents from the pool
   */
  clear(): void {
    this.agents.clear();
    this.evictedCount = 0;
    this.updateMemoryUsage();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private evictLRUAgent(): void {
    // Find the least recently used idle agent
    let lruAgent: { name: string; lastUsedAt: number } | null = null;

    for (const [name, agent] of this.agents.entries()) {
      if (!agent.isActive) {
        const lastUsed = new Date(agent.lastUsedAt).getTime();
        if (!lruAgent || lastUsed < lruAgent.lastUsedAt) {
          lruAgent = { name, lastUsedAt: lastUsed };
        }
      }
    }

    // If no idle agent, evict the oldest agent regardless of state
    if (!lruAgent) {
      let oldestAgent: { name: string; createdAt: number } | null = null;
      
      for (const [name, agent] of this.agents.entries()) {
        const created = new Date(agent.createdAt).getTime();
        if (!oldestAgent || created < oldestAgent.createdAt) {
          oldestAgent = { name, createdAt: created };
        }
      }
      
      if (oldestAgent) {
        this.agents.delete(oldestAgent.name);
        this.evictedCount++;
      }
    } else {
      this.agents.delete(lruAgent.name);
      this.evictedCount++;
    }

    this.updateMemoryUsage();
  }

  private updateMemoryUsage(): void {
    // Estimate memory usage based on agent count
    // Assume ~10MB per agent as a rough estimate
    const bytesPerAgent = 10 * 1024 * 1024;
    this.memoryUsage.current = (this.agents.size * bytesPerAgent) / (1024 * 1024);
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

let agentPoolInstance: AgentPool | null = null;

export function getAgentPool(): AgentPool {
  if (!agentPoolInstance) {
    agentPoolInstance = new AgentPool();
  }
  return agentPoolInstance;
}

export function resetAgentPool(): void {
  agentPoolInstance = null;
}
