// Letta Soul Manager — Persistent agent identity and soul files
// Inspired by Letta (formerly MemGPT) soul persistence patterns
// KIMI-R23-03 | Feb 2026

import type { ATLASInfiniteMemory, HierarchicalMemoryNode } from './infinite-memory-core.js';

export interface AgentSoul {
  agentId: string;
  name: string;
  persona: string;          // Agent's self-description
  humanDescription: string; // How the agent understands the user
  coreMemories: string[];   // Key facts the agent always remembers
  archivalMemorySize: number;
  lastActiveAt: number;
  version: number;
  traits: Record<string, string>;
}

export interface SoulSnapshot {
  soul: AgentSoul;
  timestamp: number;
  snapshotId: string;
}

export interface SoulUpdateOptions {
  persona?: string;
  humanDescription?: string;
  coreMemories?: string[];
  traits?: Record<string, string>;
}

export interface TasteDriftReport {
  agentId: string;
  driftScore: number;       // 0-1; higher = more drift from baseline
  driftedTraits: string[];
  recommendation: 'stable' | 'monitor' | 'auto-resolve';
  resolvedAt?: number;
}

export class LettaSoulManager {
  private souls = new Map<string, AgentSoul>();
  private snapshots = new Map<string, SoulSnapshot[]>(); // agentId → snapshots[]
  private memory: ATLASInfiniteMemory | null;
  private maxSnapshotsPerAgent: number;

  constructor(
    memory: ATLASInfiniteMemory | null = null,
    maxSnapshotsPerAgent = 20,
  ) {
    this.memory = memory;
    this.maxSnapshotsPerAgent = maxSnapshotsPerAgent;
  }

  createSoul(agentId: string, persona: string, humanDescription: string): AgentSoul {
    const soul: AgentSoul = {
      agentId,
      name: agentId,
      persona,
      humanDescription,
      coreMemories: [],
      archivalMemorySize: 0,
      lastActiveAt: Date.now(),
      version: 1,
      traits: {},
    };
    this.souls.set(agentId, soul);
    this.takeSnapshot(agentId);
    return soul;
  }

  getSoul(agentId: string): AgentSoul | undefined {
    return this.souls.get(agentId);
  }

  updateSoul(agentId: string, opts: SoulUpdateOptions): AgentSoul {
    const existing = this.souls.get(agentId);
    if (!existing) throw new Error(`Soul for ${agentId} not found`);

    const updated: AgentSoul = {
      ...existing,
      ...(opts.persona !== undefined && { persona: opts.persona }),
      ...(opts.humanDescription !== undefined && { humanDescription: opts.humanDescription }),
      ...(opts.coreMemories !== undefined && { coreMemories: opts.coreMemories }),
      traits: { ...existing.traits, ...(opts.traits ?? {}) },
      lastActiveAt: Date.now(),
      version: existing.version + 1,
    };

    this.souls.set(agentId, updated);
    this.takeSnapshot(agentId);

    // Sync to ATLAS memory
    if (this.memory) {
      this.memory.upsert(`soul-${agentId}`, JSON.stringify(updated), {
        level: 'lifetime',
        agentId,
        tags: ['soul', 'identity'],
        metadata: { version: updated.version },
      });
    }

    return updated;
  }

  addCoreMemory(agentId: string, memory: string): void {
    const soul = this.souls.get(agentId);
    if (!soul) throw new Error(`Soul for ${agentId} not found`);
    if (!soul.coreMemories.includes(memory)) {
      soul.coreMemories.push(memory);
      soul.version++;
      soul.lastActiveAt = Date.now();
    }
  }

  removeCoreMemory(agentId: string, memory: string): void {
    const soul = this.souls.get(agentId);
    if (!soul) return;
    soul.coreMemories = soul.coreMemories.filter(m => m !== memory);
    soul.version++;
  }

  takeSnapshot(agentId: string): SoulSnapshot {
    const soul = this.souls.get(agentId);
    if (!soul) throw new Error(`Soul for ${agentId} not found`);

    const snapshot: SoulSnapshot = {
      soul: { ...soul, coreMemories: [...soul.coreMemories] },
      timestamp: Date.now(),
      snapshotId: `snap-${agentId}-v${soul.version}-${Date.now()}`,
    };

    if (!this.snapshots.has(agentId)) this.snapshots.set(agentId, []);
    const agentSnapshots = this.snapshots.get(agentId)!;
    agentSnapshots.push(snapshot);

    // Prune old snapshots
    if (agentSnapshots.length > this.maxSnapshotsPerAgent) {
      agentSnapshots.shift();
    }

    return snapshot;
  }

  getSnapshots(agentId: string): SoulSnapshot[] {
    return this.snapshots.get(agentId) ?? [];
  }

  restoreSnapshot(agentId: string, snapshotId: string): AgentSoul {
    const snapshots = this.snapshots.get(agentId) ?? [];
    const snapshot = snapshots.find(s => s.snapshotId === snapshotId);
    if (!snapshot) throw new Error(`Snapshot ${snapshotId} not found`);
    this.souls.set(agentId, { ...snapshot.soul });
    return snapshot.soul;
  }

  detectTasteDrift(agentId: string): TasteDriftReport {
    const snapshots = this.snapshots.get(agentId) ?? [];
    if (snapshots.length < 2) {
      return { agentId, driftScore: 0, driftedTraits: [], recommendation: 'stable' };
    }

    const baseline = snapshots[0]!.soul;
    const current = this.souls.get(agentId);
    if (!current) {
      return { agentId, driftScore: 0, driftedTraits: [], recommendation: 'stable' };
    }

    const driftedTraits: string[] = [];
    for (const [trait, baseValue] of Object.entries(baseline.traits)) {
      if (current.traits[trait] !== baseValue) {
        driftedTraits.push(trait);
      }
    }

    // Score based on persona change + trait changes + core memory delta
    const personaChanged = current.persona !== baseline.persona ? 0.3 : 0;
    const traitDrift = Object.keys(baseline.traits).length > 0
      ? driftedTraits.length / Object.keys(baseline.traits).length * 0.4
      : 0;
    const memDelta = Math.abs(current.coreMemories.length - baseline.coreMemories.length);
    const memDrift = Math.min(memDelta / 10, 0.3);

    const driftScore = Math.min(1, personaChanged + traitDrift + memDrift);

    let recommendation: TasteDriftReport['recommendation'] = 'stable';
    if (driftScore > 0.7) recommendation = 'auto-resolve';
    else if (driftScore > 0.3) recommendation = 'monitor';

    return { agentId, driftScore, driftedTraits, recommendation };
  }

  autoResolveDrift(agentId: string): TasteDriftReport {
    const report = this.detectTasteDrift(agentId);
    if (report.recommendation !== 'auto-resolve') return report;

    // Restore to the most recent stable snapshot (within 3 versions)
    const snapshots = this.snapshots.get(agentId) ?? [];
    const stableSnapshot = snapshots[Math.max(0, snapshots.length - 3)];
    if (stableSnapshot) {
      this.souls.set(agentId, { ...stableSnapshot.soul });
    }

    return { ...report, resolvedAt: Date.now() };
  }

  listAgents(): string[] {
    return [...this.souls.keys()];
  }
}
