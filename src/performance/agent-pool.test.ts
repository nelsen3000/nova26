// Agent Pool Tests — Comprehensive test coverage for KIMI-POLISH-06

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentPool, getAgentPool, resetAgentPool } from './agent-pool.js';

// ============================================================================
// Test Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AgentPool', () => {
  let agentPool: AgentPool;

  beforeEach(() => {
    agentPool = new AgentPool();
  });

  // ============================================================================
  // Acquire
  // ============================================================================

  describe('acquire()', () => {
    it('returns PooledAgent with isActive=true', () => {
      const agent = agentPool.acquire('test-agent');
      
      expect(agent).toBeDefined();
      expect(agent.name).toBe('test-agent');
      expect(agent.isActive).toBe(true);
      expect(agent.id).toBeDefined();
      expect(agent.createdAt).toBeDefined();
      expect(agent.lastUsedAt).toBeDefined();
    });

    it('returns same agent on second call (cache hit)', () => {
      const agent1 = agentPool.acquire('test-agent');
      const agent2 = agentPool.acquire('test-agent');
      
      expect(agent1).toBe(agent2);
      expect(agent1.id).toBe(agent2.id);
    });

    it('creates new agent for different name', () => {
      const agent1 = agentPool.acquire('agent-a');
      const agent2 = agentPool.acquire('agent-b');
      
      expect(agent1.id).not.toBe(agent2.id);
      expect(agent1.name).toBe('agent-a');
      expect(agent2.name).toBe('agent-b');
    });

    it('reactivates released agent', () => {
      const agent = agentPool.acquire('test-agent');
      expect(agent.isActive).toBe(true);
      
      agentPool.release('test-agent');
      expect(agent.isActive).toBe(false);
      
      const reacquired = agentPool.acquire('test-agent');
      expect(reacquired.isActive).toBe(true);
      expect(reacquired.id).toBe(agent.id);
    });

    it('evicts LRU idle agent when maxPoolSize reached', () => {
      // Create pool with max 3 agents
      const smallPool = new AgentPool({ maxPoolSize: 3 });
      
      // Add 3 agents
      const agent1 = smallPool.acquire('agent-1');
      smallPool.acquire('agent-2');
      smallPool.acquire('agent-3');
      
      // Release all
      smallPool.release('agent-1');
      smallPool.release('agent-2');
      smallPool.release('agent-3');
      
      // Acquire a 4th agent - should evict LRU
      smallPool.acquire('agent-4');
      
      // agent-1 should be evicted (least recently used)
      const allAgents = smallPool.getAllAgents();
      expect(allAgents).toHaveLength(3);
      expect(allAgents.map(a => a.name)).not.toContain('agent-1');
      expect(allAgents.map(a => a.name)).toContain('agent-2');
      expect(allAgents.map(a => a.name)).toContain('agent-3');
      expect(allAgents.map(a => a.name)).toContain('agent-4');
    });
  });

  // ============================================================================
  // Release
  // ============================================================================

  describe('release()', () => {
    it('sets isActive=false', () => {
      const agent = agentPool.acquire('test-agent');
      expect(agent.isActive).toBe(true);
      
      agentPool.release('test-agent');
      
      expect(agent.isActive).toBe(false);
    });

    it('updates lastUsedAt', async () => {
      const agent = agentPool.acquire('test-agent');
      const beforeRelease = agent.lastUsedAt;
      
      await sleep(10);
      agentPool.release('test-agent');
      
      expect(agent.lastUsedAt).not.toBe(beforeRelease);
    });

    it('does nothing for non-existent agent', () => {
      // Should not throw
      agentPool.release('non-existent');
      
      const stats = agentPool.stats();
      expect(stats.total).toBe(0);
    });
  });

  // ============================================================================
  // Evict
  // ============================================================================

  describe('evict()', () => {
    it('removes agent and increments evicted count', () => {
      agentPool.acquire('test-agent');
      expect(agentPool.stats().total).toBe(1);
      
      const evicted = agentPool.evict('test-agent');
      
      expect(evicted).toBe(true);
      expect(agentPool.stats().total).toBe(0);
      expect(agentPool.stats().evicted).toBe(1);
    });

    it('returns false for non-existent agent', () => {
      const result = agentPool.evict('non-existent');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Evict Idle Agents
  // ============================================================================

  describe('evictIdleAgents()', () => {
    it('removes agents idle longer than timeout', async () => {
      // Create pool with very short idle timeout
      const shortPool = new AgentPool({ idleTimeoutMs: 50 });
      
      shortPool.acquire('agent-1');
      shortPool.acquire('agent-2');
      
      // Release both
      shortPool.release('agent-1');
      shortPool.release('agent-2');
      
      // Wait for timeout
      await sleep(60);
      
      // Evict idle agents
      const evicted = shortPool.evictIdleAgents();
      
      expect(evicted).toBe(2);
      expect(shortPool.stats().total).toBe(0);
    });

    it('does not remove active agents', async () => {
      // Create pool with very short idle timeout
      const shortPool = new AgentPool({ idleTimeoutMs: 50 });
      
      shortPool.acquire('active-agent');
      shortPool.acquire('idle-agent');
      
      // Release only one
      shortPool.release('idle-agent');
      
      // Wait for timeout
      await sleep(60);
      
      // Evict idle agents
      const evicted = shortPool.evictIdleAgents();
      
      expect(evicted).toBe(1);
      expect(shortPool.stats().total).toBe(1);
      
      const remaining = shortPool.getAllAgents();
      expect(remaining[0].name).toBe('active-agent');
      expect(remaining[0].isActive).toBe(true);
    });

    it('does not remove agents not yet timed out', async () => {
      // Create pool with long idle timeout
      const longPool = new AgentPool({ idleTimeoutMs: 10000 });
      
      longPool.acquire('agent');
      longPool.release('agent');
      
      // Evict immediately - should not remove
      const evicted = longPool.evictIdleAgents();
      
      expect(evicted).toBe(0);
      expect(longPool.stats().total).toBe(1);
    });
  });

  // ============================================================================
  // Memory Budget
  // ============================================================================

  describe('checkMemoryBudget()', () => {
    it('returns withinBudget:true when small', () => {
      // Fresh pool should be within budget
      const result = agentPool.checkMemoryBudget();
      
      expect(result.withinBudget).toBe(true);
      expect(result.usagePercent).toBe(0);
    });

    it('returns correct usage percentage', () => {
      // Add agents to increase memory usage
      for (let i = 0; i < 10; i++) {
        agentPool.acquire(`agent-${i}`);
      }
      
      const result = agentPool.checkMemoryBudget();
      
      // 10 agents * 10MB each / 512MB limit = ~19.53%
      expect(result.usagePercent).toBeGreaterThan(0);
      expect(result.withinBudget).toBe(true);
    });
  });

  // ============================================================================
  // Scratchpad Collapse
  // ============================================================================

  describe('shouldCollapseScratchpad()', () => {
    it('returns false below threshold', () => {
      const pool = new AgentPool({ 
        memoryLimitMb: 100,
        warningThresholdPct: 80 
      });
      
      // Add small number of agents
      pool.acquire('agent-1');
      
      expect(pool.shouldCollapseScratchpad()).toBe(false);
    });

    it('returns true above warningThresholdPct', () => {
      const pool = new AgentPool({ 
        memoryLimitMb: 10,
        warningThresholdPct: 80 
      });
      
      // Add agents to exceed threshold (10 agents * 10MB = 100MB, limit is 10MB = 1000%)
      for (let i = 0; i < 10; i++) {
        pool.acquire(`agent-${i}`);
      }
      
      expect(pool.shouldCollapseScratchpad()).toBe(true);
    });
  });

  // ============================================================================
  // Prewarm
  // ============================================================================

  describe('prewarm()', () => {
    it('adds agents with isActive=false', () => {
      agentPool.prewarm(['agent-a', 'agent-b', 'agent-c']);
      
      const agents = agentPool.getAllAgents();
      
      expect(agents).toHaveLength(3);
      
      for (const agent of agents) {
        expect(agent.isActive).toBe(false);
      }
    });

    it('does not duplicate existing agents', () => {
      agentPool.prewarm(['agent-a', 'agent-b']);
      agentPool.prewarm(['agent-b', 'agent-c']);
      
      const agents = agentPool.getAllAgents();
      const names = agents.map(a => a.name);
      
      expect(agents).toHaveLength(3);
      expect(names).toContain('agent-a');
      expect(names).toContain('agent-b');
      expect(names).toContain('agent-c');
    });

    it('evicts LRU to make room when maxPoolSize reached', () => {
      const smallPool = new AgentPool({ maxPoolSize: 3 });
      
      // Fill pool
      smallPool.prewarm(['agent-1', 'agent-2', 'agent-3']);
      
      // Prewarm more - should evict LRU
      smallPool.prewarm(['agent-4']);
      
      const agents = smallPool.getAllAgents();
      expect(agents).toHaveLength(3);
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('stats()', () => {
    it('returns correct counts', () => {
      // Initial stats
      const initial = agentPool.stats();
      expect(initial.total).toBe(0);
      expect(initial.active).toBe(0);
      expect(initial.idle).toBe(0);
      expect(initial.evicted).toBe(0);
      
      // Add active agents
      agentPool.acquire('active-1');
      agentPool.acquire('active-2');
      
      // Add and release an agent
      agentPool.acquire('idle-1');
      agentPool.release('idle-1');
      
      const stats = agentPool.stats();
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.idle).toBe(1);
      
      // Evict one
      agentPool.evict('idle-1');
      
      const afterEvict = agentPool.stats();
      expect(afterEvict.total).toBe(2);
      expect(afterEvict.evicted).toBe(1);
    });
  });

  // ============================================================================
  // Singleton Factory
  // ============================================================================

  describe('Singleton Factory', () => {
    it('getAgentPool() returns same instance', () => {
      resetAgentPool();
      
      const instance1 = getAgentPool();
      const instance2 = getAgentPool();
      
      expect(instance1).toBe(instance2);
    });

    it('resetAgentPool() creates new instance on next get', () => {
      resetAgentPool();
      
      const instance1 = getAgentPool();
      resetAgentPool();
      const instance2 = getAgentPool();
      
      expect(instance1).not.toBe(instance2);
    });

    it('singleton instance maintains state across calls', () => {
      resetAgentPool();
      
      const instance1 = getAgentPool();
      instance1.acquire('test-agent');
      
      const instance2 = getAgentPool();
      const stats = instance2.stats();
      
      expect(stats.total).toBe(1);
    });
  });
});
