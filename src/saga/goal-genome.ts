// Goal Genome - Serialization and mutation operations
// Spec: .kiro/specs/saga-self-evolving-agents/design.md

import type {
  GoalGenome,
  ObjectiveDescriptor,
  MutationType,
  GoalMutation,
} from './types.js';
import {
  serializeGenome as serialize,
  deserializeGenome as deserialize,
  GoalGenomeSchema,
} from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Serialization
// ═══════════════════════════════════════════════════════════════════════════════

export { serialize, deserialize };

export function createSeedGenome(
  agentName: string,
  objectives: ObjectiveDescriptor[]
): GoalGenome {
  const now = new Date().toISOString();
  const genome: GoalGenome = {
    id: `genome-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    schemaVersion: 1,
    agentName,
    generation: 0,
    parentId: null,
    objectives,
    fitnessCriteria: objectives.map(obj => ({
      objectiveId: obj.id,
      metricName: 'aggregate',
      targetValue: 0.8,
      currentValue: 0,
    })),
    createdAt: now,
    metadata: {},
  };

  return GoalGenomeSchema.parse(genome);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mutation Operations
// ═══════════════════════════════════════════════════════════════════════════════

export function addObjective(
  genome: GoalGenome,
  objective: ObjectiveDescriptor
): { genome: GoalGenome; mutation: GoalMutation } {
  // Validate no duplicate ID
  if (genome.objectives.some(o => o.id === objective.id)) {
    throw new Error(`Objective with id '${objective.id}' already exists`);
  }

  const child: GoalGenome = {
    ...genome,
    id: generateGenomeId(),
    generation: genome.generation + 1,
    parentId: genome.id,
    objectives: [...genome.objectives, objective],
    fitnessCriteria: [
      ...genome.fitnessCriteria,
      {
        objectiveId: objective.id,
        metricName: 'aggregate',
        targetValue: 0.8,
        currentValue: 0,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const mutation: GoalMutation = {
    type: 'add',
    parentId: genome.id,
    childId: child.id,
    timestamp: child.createdAt,
    details: { objectiveId: objective.id },
  };

  return { genome: GoalGenomeSchema.parse(child), mutation };
}

export function removeObjective(
  genome: GoalGenome,
  objectiveId: string
): { genome: GoalGenome; mutation: GoalMutation } {
  // Validate at least 1 objective remains
  if (genome.objectives.length <= 1) {
    throw new Error('Cannot remove objective: at least 1 objective required');
  }

  // Validate objective exists
  if (!genome.objectives.some(o => o.id === objectiveId)) {
    throw new Error(`Objective with id '${objectiveId}' not found`);
  }

  const child: GoalGenome = {
    ...genome,
    id: generateGenomeId(),
    generation: genome.generation + 1,
    parentId: genome.id,
    objectives: genome.objectives.filter(o => o.id !== objectiveId),
    fitnessCriteria: genome.fitnessCriteria.filter(fc => fc.objectiveId !== objectiveId),
    createdAt: new Date().toISOString(),
  };

  const mutation: GoalMutation = {
    type: 'remove',
    parentId: genome.id,
    childId: child.id,
    timestamp: child.createdAt,
    details: { objectiveId },
  };

  return { genome: GoalGenomeSchema.parse(child), mutation };
}

export function perturbObjective(
  genome: GoalGenome,
  objectiveId: string,
  delta: Record<string, number>
): { genome: GoalGenome; mutation: GoalMutation } {
  const objectiveIndex = genome.objectives.findIndex(o => o.id === objectiveId);
  if (objectiveIndex === -1) {
    throw new Error(`Objective with id '${objectiveId}' not found`);
  }

  const originalObjective = genome.objectives[objectiveIndex];
  const perturbedObjective: ObjectiveDescriptor = {
    ...originalObjective,
    parameters: { ...originalObjective.parameters },
    weight: clamp(originalObjective.weight + (delta.weight || 0), 0, 1),
  };

  // Apply parameter perturbations
  for (const [key, value] of Object.entries(delta)) {
    if (key !== 'weight' && key in originalObjective.parameters) {
      perturbedObjective.parameters[key] = originalObjective.parameters[key] + value;
    }
  }

  const newObjectives = [...genome.objectives];
  newObjectives[objectiveIndex] = perturbedObjective;

  const child: GoalGenome = {
    ...genome,
    id: generateGenomeId(),
    generation: genome.generation + 1,
    parentId: genome.id,
    objectives: newObjectives,
    createdAt: new Date().toISOString(),
  };

  const mutation: GoalMutation = {
    type: 'perturb',
    parentId: genome.id,
    childId: child.id,
    timestamp: child.createdAt,
    details: { objectiveId, delta },
  };

  return { genome: GoalGenomeSchema.parse(child), mutation };
}

export function recombine(
  parent1: GoalGenome,
  parent2: GoalGenome
): { genome: GoalGenome; mutation: GoalMutation } {
  // Take objectives from both parents (avoiding duplicates)
  const objectiveMap = new Map<string, ObjectiveDescriptor>();
  
  for (const obj of parent1.objectives) {
    objectiveMap.set(obj.id, obj);
  }
  
  for (const obj of parent2.objectives) {
    if (!objectiveMap.has(obj.id)) {
      objectiveMap.set(obj.id, obj);
    }
  }

  // If there are duplicates by description, pick randomly
  const combinedObjectives = Array.from(objectiveMap.values());
  
  // If too many objectives, randomly select subset
  const maxObjectives = Math.max(parent1.objectives.length, parent2.objectives.length);
  let selectedObjectives = combinedObjectives;
  if (combinedObjectives.length > maxObjectives) {
    selectedObjectives = shuffleArray(combinedObjectives).slice(0, maxObjectives);
  }

  // Ensure at least 1 objective
  if (selectedObjectives.length === 0) {
    selectedObjectives = [parent1.objectives[0] || parent2.objectives[0]];
  }

  const child: GoalGenome = {
    id: generateGenomeId(),
    schemaVersion: 1,
    agentName: parent1.agentName,
    generation: Math.max(parent1.generation, parent2.generation) + 1,
    parentId: parent1.id,
    objectives: selectedObjectives,
    fitnessCriteria: selectedObjectives.map(obj => ({
      objectiveId: obj.id,
      metricName: 'aggregate',
      targetValue: 0.8,
      currentValue: 0,
    })),
    createdAt: new Date().toISOString(),
    metadata: {
      ...parent1.metadata,
      parent2Id: parent2.id,
    },
  };

  const mutation: GoalMutation = {
    type: 'recombine',
    parentId: parent1.id,
    childId: child.id,
    timestamp: child.createdAt,
    details: { parent2Id: parent2.id },
  };

  return { genome: GoalGenomeSchema.parse(child), mutation };
}

export function mutate(
  genome: GoalGenome,
  mutationType?: MutationType
): { genome: GoalGenome; mutation: GoalMutation } {
  const type = mutationType || selectRandomMutationType();

  switch (type) {
    case 'add': {
      const newObjective: ObjectiveDescriptor = {
        id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        description: 'New evolved objective',
        domain: genome.objectives[0]?.domain || 'general',
        parameters: { priority: Math.random() },
        weight: Math.random(),
      };
      return addObjective(genome, newObjective);
    }

    case 'remove': {
      if (genome.objectives.length <= 1) {
        // Can't remove, perturb instead
        return mutate(genome, 'perturb');
      }
      const randomIndex = Math.floor(Math.random() * genome.objectives.length);
      return removeObjective(genome, genome.objectives[randomIndex].id);
    }

    case 'perturb': {
      const randomIndex = Math.floor(Math.random() * genome.objectives.length);
      const objective = genome.objectives[randomIndex];
      const delta: Record<string, number> = {
        weight: (Math.random() - 0.5) * 0.2,
      };
      for (const key of Object.keys(objective.parameters)) {
        delta[key] = (Math.random() - 0.5) * 0.2;
      }
      return perturbObjective(genome, objective.id, delta);
    }

    case 'recombine': {
      // For single-parent mutation, create a variant of self
      const variant: GoalGenome = {
        ...genome,
        id: generateGenomeId(),
        objectives: genome.objectives.map(o => ({
          ...o,
          weight: clamp(o.weight + (Math.random() - 0.5) * 0.1, 0, 1),
        })),
      };
      return recombine(genome, variant);
    }

    default:
      throw new Error(`Unknown mutation type: ${type}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function generateGenomeId(): string {
  return `genome-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function selectRandomMutationType(): MutationType {
  const types: MutationType[] = ['add', 'remove', 'perturb', 'recombine'];
  return types[Math.floor(Math.random() * types.length)];
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
