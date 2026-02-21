// A2A Agent Registry — Registration, lookup, capability search
// Sprint S2-19 | A2A Agent-to-Agent Protocols

import type { AgentCard, AgentTier, CapabilityDescriptor } from './types.js';
import { AgentCardSchema } from './schemas.js';

export interface RegistryStats {
  totalAgents: number;
  localAgents: number;
  remoteAgents: number;
  byTier: Record<AgentTier, number>;
}

/**
 * AgentRegistry — manages Agent_Card registration and lookup.
 * In-memory Map storage with revision tracking for remote card merges.
 */
export class AgentRegistry {
  private cards = new Map<string, AgentCard>();

  /**
   * Register a local agent card.
   * If the ID already exists, increments revision and updates.
   */
  register(card: Partial<AgentCard> & Pick<AgentCard, 'id' | 'name' | 'tier'>): AgentCard {
    const existing = this.cards.get(card.id);
    const parsed = AgentCardSchema.parse({
      ...card,
      origin: 'local',
      revision: existing ? existing.revision + 1 : 0,
      updatedAt: Date.now(),
      registeredAt: existing?.registeredAt ?? Date.now(),
    });

    this.cards.set(parsed.id, parsed);
    return parsed;
  }

  /**
   * Merge a remote agent card discovered via Hyperswarm or other transport.
   * Sets origin to 'remote' and increments revision if newer.
   */
  mergeRemoteCard(card: Partial<AgentCard> & Pick<AgentCard, 'id' | 'name' | 'tier'>): AgentCard {
    const existing = this.cards.get(card.id);
    const parsed = AgentCardSchema.parse({
      ...card,
      origin: 'remote',
      revision: existing ? Math.max(existing.revision + 1, (card.revision ?? 0) + 1) : (card.revision ?? 0),
      updatedAt: Date.now(),
      registeredAt: existing?.registeredAt ?? Date.now(),
    });

    this.cards.set(parsed.id, parsed);
    return parsed;
  }

  /**
   * Unregister an agent by ID.
   */
  unregister(agentId: string): boolean {
    return this.cards.delete(agentId);
  }

  /**
   * Get an agent by ID.
   */
  getById(agentId: string): AgentCard | undefined {
    return this.cards.get(agentId);
  }

  /**
   * Find agents that have a capability matching the given name.
   */
  findByCapability(capabilityName: string): AgentCard[] {
    return [...this.cards.values()].filter(card =>
      card.capabilities.some(c => c.name === capabilityName),
    );
  }

  /**
   * Find agents at a specific tier.
   */
  findByTier(tier: AgentTier): AgentCard[] {
    return [...this.cards.values()].filter(card => card.tier === tier);
  }

  /**
   * List all registered agents.
   */
  listAll(): AgentCard[] {
    return [...this.cards.values()];
  }

  /**
   * Get only local agents.
   */
  getLocalCards(): AgentCard[] {
    return [...this.cards.values()].filter(c => c.origin === 'local');
  }

  /**
   * Get only remote agents.
   */
  getRemoteCards(): AgentCard[] {
    return [...this.cards.values()].filter(c => c.origin === 'remote');
  }

  /**
   * Serialize all cards to JSON.
   */
  serialize(): string {
    return JSON.stringify([...this.cards.values()]);
  }

  /**
   * Deserialize and merge cards from JSON.
   */
  deserialize(json: string): number {
    const cards = JSON.parse(json) as AgentCard[];
    let merged = 0;
    for (const card of cards) {
      this.mergeRemoteCard(card);
      merged++;
    }
    return merged;
  }

  /**
   * Registry statistics.
   */
  getStats(): RegistryStats {
    const all = [...this.cards.values()];
    const byTier: Record<AgentTier, number> = { L0: 0, L1: 0, L2: 0, L3: 0 };
    for (const card of all) {
      byTier[card.tier]++;
    }
    return {
      totalAgents: all.length,
      localAgents: all.filter(c => c.origin === 'local').length,
      remoteAgents: all.filter(c => c.origin === 'remote').length,
      byTier,
    };
  }
}
