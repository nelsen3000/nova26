// ATLAS Goal Store - In-memory persistence layer for goal genomes
// Spec: .kiro/specs/saga-self-evolving-agents/design.md
// Note: Convex integration would be added here for production

import type {
  GoalGenome,
  FitnessScore,
  EvolutionSession,
} from './types.js';
import { serialize, deserialize } from './goal-genome.js';

// ═══════════════════════════════════════════════════════════════════════════════
// In-Memory Store (replaces Convex for local development)
// ═══════════════════════════════════════════════════════════════════════════════

interface StoredGenome {
  genome: GoalGenome;
  fitnessScore: number;
  storedAt: string;
}

interface StoredSession {
  session: EvolutionSession;
  storedAt: string;
}

const genomeStore = new Map<string, StoredGenome>();
const generationStore = new Map<string, StoredGenome[]>(); // agentName -> genomes
const sessionStore = new Map<string, StoredSession>();

// ═══════════════════════════════════════════════════════════════════════════════
// Genome Persistence
// ═══════════════════════════════════════════════════════════════════════════════

export async function persistGenome(
  genome: GoalGenome,
  fitnessScore: number
): Promise<void> {
  const stored: StoredGenome = {
    genome,
    fitnessScore,
    storedAt: new Date().toISOString(),
  };

  genomeStore.set(genome.id, stored);

  // Also add to generation store
  const existing = generationStore.get(genome.agentName) || [];
  generationStore.set(genome.agentName, [...existing, stored]);
}

export async function persistGeneration(
  genomes: GoalGenome[],
  fitnessScores: FitnessScore[]
): Promise<void> {
  for (const genome of genomes) {
    const score = fitnessScores.find(f => f.genomeId === genome.id);
    if (score) {
      await persistGenome(genome, score.aggregateScore);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Genome Queries
// ═══════════════════════════════════════════════════════════════════════════════

export async function getLatestPopulation(agentName: string): Promise<GoalGenome[]> {
  const stored = generationStore.get(agentName) || [];

  // Get the most recent generation
  const byGeneration = new Map<number, StoredGenome[]>();
  for (const s of stored) {
    const gen = s.genome.generation;
    const existing = byGeneration.get(gen) || [];
    existing.push(s);
    byGeneration.set(gen, existing);
  }

  const maxGeneration = Math.max(...byGeneration.keys(), 0);
  return (byGeneration.get(maxGeneration) || []).map(s => s.genome);
}

export async function getGenomesByFitness(
  agentName: string,
  minFitness: number
): Promise<GoalGenome[]> {
  const stored = generationStore.get(agentName) || [];
  return stored
    .filter(s => s.fitnessScore >= minFitness)
    .map(s => s.genome)
    .sort((a, b) => {
      const scoreA = stored.find(s => s.genome.id === a.id)?.fitnessScore || 0;
      const scoreB = stored.find(s => s.genome.id === b.id)?.fitnessScore || 0;
      return scoreB - scoreA;
    });
}

export async function getGenomeByGeneration(
  agentName: string,
  generation: number
): Promise<GoalGenome[]> {
  const stored = generationStore.get(agentName) || [];
  return stored
    .filter(s => s.genome.generation === generation)
    .map(s => s.genome);
}

export async function getGenomeLineage(genomeId: string): Promise<GoalGenome[]> {
  const lineage: GoalGenome[] = [];
  const visited = new Set<string>();

  let currentId: string | null = genomeId;
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const stored = genomeStore.get(currentId);
    if (stored) {
      lineage.push(stored.genome);
      currentId = stored.genome.parentId;
    } else {
      break;
    }
  }

  return lineage;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Portfolio Learning
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPortfolioSeeds(
  excludeAgent: string,
  minFitness: number,
  limit: number
): Promise<GoalGenome[]> {
  const candidates: StoredGenome[] = [];

  for (const [agentName, genomes] of generationStore) {
    if (agentName === excludeAgent) continue;

    for (const stored of genomes) {
      if (stored.fitnessScore >= minFitness) {
        candidates.push(stored);
      }
    }
  }

  // Sort by fitness and take top N
  return candidates
    .sort((a, b) => b.fitnessScore - a.fitnessScore)
    .slice(0, limit)
    .map(s => s.genome);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Retention Management
// ═══════════════════════════════════════════════════════════════════════════════

export async function pruneOldGenomes(retentionDays: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  let pruned = 0;

  for (const [id, stored] of genomeStore) {
    const storedDate = new Date(stored.storedAt);
    if (storedDate < cutoff) {
      genomeStore.delete(id);
      pruned++;
    }
  }

  // Clean up generation store
  for (const [agentName, genomes] of generationStore) {
    const filtered = genomes.filter(s => {
      const storedDate = new Date(s.storedAt);
      return storedDate >= cutoff;
    });
    generationStore.set(agentName, filtered);
  }

  return pruned;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Session Persistence
// ═══════════════════════════════════════════════════════════════════════════════

export async function persistSessionState(session: EvolutionSession): Promise<void> {
  const stored: StoredSession = {
    session,
    storedAt: new Date().toISOString(),
  };
  sessionStore.set(session.id, stored);
}

export async function restoreSessionState(
  sessionId: string
): Promise<EvolutionSession | null> {
  const stored = sessionStore.get(sessionId);
  return stored?.session || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Statistics
// ═══════════════════════════════════════════════════════════════════════════════

export interface StoreStatistics {
  totalGenomes: number;
  totalAgents: number;
  totalSessions: number;
  averageFitness: number;
  generationsPerAgent: Record<string, number>;
}

export async function getStatistics(): Promise<StoreStatistics> {
  const allGenomes = Array.from(genomeStore.values());
  const fitnesses = allGenomes.map(g => g.fitnessScore);

  const generationsPerAgent: Record<string, number> = {};
  for (const [agentName, genomes] of generationStore) {
    const uniqueGenerations = new Set(genomes.map(g => g.genome.generation));
    generationsPerAgent[agentName] = uniqueGenerations.size;
  }

  return {
    totalGenomes: allGenomes.length,
    totalAgents: generationStore.size,
    totalSessions: sessionStore.size,
    averageFitness:
      fitnesses.length > 0
        ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length
        : 0,
    generationsPerAgent,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════════════════════════════

export function clearStore(): void {
  genomeStore.clear();
  generationStore.clear();
  sessionStore.clear();
}
