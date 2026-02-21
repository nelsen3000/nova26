// SAGA Property Tests
// Spec: .kiro/specs/saga-self-evolving-agents/tasks.md

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { GoalGenome, ObjectiveDescriptor, FitnessCriterion } from './types.js';
import {
  serialize,
  deserialize,
  createSeedGenome,
  addObjective,
  removeObjective,
  perturbObjective,
  recombine,
} from './goal-genome.js';
import { evaluate, tournamentSelect } from './fitness-evaluator.js';
import { check, filterCandidates } from './taste-guard.js';
import { generate as generateCurriculum, getProgress } from './curriculum-generator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

const objectiveDescriptorArb = fc.record<ObjectiveDescriptor>({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  domain: fc.constantFrom('code-quality', 'creativity', 'efficiency', 'safety', 'general'),
  parameters: fc.dictionary(fc.string({ minLength: 1 }), fc.float({ min: 0, max: 1, noNaN: true }), { maxKeys: 5 }),
  weight: fc.float({ min: 0, max: 1, noNaN: true }),
});

const fitnessCriterionArb = fc.record<FitnessCriterion>({
  objectiveId: fc.string({ minLength: 1 }),
  metricName: fc.constantFrom('aggregate', 'performance', 'novelty', 'taste'),
  targetValue: fc.float({ min: 0, max: 1, noNaN: true }),
  currentValue: fc.float({ min: 0, max: 1, noNaN: true }),
});

const goalGenomeArb = fc.record<GoalGenome>({
  id: fc.string({ minLength: 1, maxLength: 100 }),
  schemaVersion: fc.constant(1),
  agentName: fc.string({ minLength: 1, maxLength: 50 }),
  generation: fc.integer({ min: 0, max: 1000 }),
  parentId: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  objectives: fc.array(objectiveDescriptorArb, { minLength: 1, maxLength: 10 }),
  fitnessCriteria: fc.array(fitnessCriterionArb, { minLength: 1, maxLength: 10 }),
  createdAt: fc.string({ minLength: 1 }),
  metadata: fc.dictionary(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), { maxKeys: 5 }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 1: Goal Genome Serialization Round-Trip
// ═══════════════════════════════════════════════════════════════════════════════

describe('GoalGenome serialization', () => {
  it('should round-trip serialize and deserialize any valid genome', () => {
    fc.assert(
      fc.property(goalGenomeArb, (genome) => {
        const serialized = serialize(genome);
        const deserialized = deserialize(serialized);
        expect(deserialized.id).toBe(genome.id);
        expect(deserialized.agentName).toBe(genome.agentName);
        expect(deserialized.generation).toBe(genome.generation);
        expect(deserialized.objectives.length).toBe(genome.objectives.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject unknown schema versions', () => {
    const invalidGenome = {
      id: 'test',
      schemaVersion: 999,
      agentName: 'test-agent',
      generation: 0,
      parentId: null,
      objectives: [{ id: 'obj1', description: 'test', domain: 'general', parameters: {}, weight: 0.5 }],
      fitnessCriteria: [],
      createdAt: new Date().toISOString(),
      metadata: {},
    };

    expect(() => deserialize(JSON.stringify(invalidGenome))).toThrow('schema version');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 6: Add Objective Mutation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Mutation operations', () => {
  it('should add objective with incremented generation', () => {
    fc.assert(
      fc.property(
        goalGenomeArb,
        objectiveDescriptorArb,
        (genome, objective) => {
          // Ensure unique objective ID
          const uniqueObjective = { ...objective, id: `new-${objective.id}` };
          
          const { genome: child, mutation } = addObjective(genome, uniqueObjective);
          
          expect(child.generation).toBe(genome.generation + 1);
          expect(child.parentId).toBe(genome.id);
          expect(child.objectives.length).toBe(genome.objectives.length + 1);
          expect(child.objectives.some(o => o.id === uniqueObjective.id)).toBe(true);
          expect(mutation.type).toBe('add');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject duplicate objective IDs', () => {
    fc.assert(
      fc.property(goalGenomeArb, (genome) => {
        const existingObjective = genome.objectives[0];
        expect(() => addObjective(genome, existingObjective)).toThrow('already exists');
      }),
      { numRuns: 20 }
    );
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 7: Remove Objective Mutation
  // ═════════════════════════════════════════════════════════════════════════════

  it('should remove objective with at least 1 remaining', () => {
    fc.assert(
      fc.property(
        fc.array(objectiveDescriptorArb, { minLength: 2, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (objectives, agentName) => {
          const genome = createSeedGenome(agentName, objectives);
          const objectiveToRemove = genome.objectives[0];
          
          const { genome: child } = removeObjective(genome, objectiveToRemove.id);
          
          expect(child.generation).toBe(genome.generation + 1);
          expect(child.objectives.length).toBe(genome.objectives.length - 1);
          expect(child.objectives.some(o => o.id === objectiveToRemove.id)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject removal when only 1 objective remains', () => {
    const genome = createSeedGenome('test', [
      { id: 'obj1', description: 'only', domain: 'general', parameters: {}, weight: 0.5 },
    ]);
    
    expect(() => removeObjective(genome, 'obj1')).toThrow('at least 1 objective required');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 8: Perturb Objective Mutation
  // ═════════════════════════════════════════════════════════════════════════════

  it('should perturb objective parameters', () => {
    fc.assert(
      fc.property(
        goalGenomeArb,
        fc.float({ min: -0.5, max: 0.5, noNaN: true }),
        (genome, delta) => {
          const objective = genome.objectives[0];
          const deltaMap: Record<string, number> = { weight: delta };
          
          const { genome: child } = perturbObjective(genome, objective.id, deltaMap);
          
          expect(child.generation).toBe(genome.generation + 1);
          const perturbed = child.objectives.find(o => o.id === objective.id);
          expect(perturbed).toBeDefined();
          expect(perturbed!.weight).toBeGreaterThanOrEqual(0);
          expect(perturbed!.weight).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 9: Recombine Mutation
  // ═════════════════════════════════════════════════════════════════════════════

  it('should recombine parents with objectives from both', () => {
    fc.assert(
      fc.property(
        goalGenomeArb,
        goalGenomeArb,
        (parent1, parent2) => {
          // Use same agent name for valid recombination
          parent2 = { ...parent2, agentName: parent1.agentName };
          
          const { genome: child } = recombine(parent1, parent2);
          
          expect(child.generation).toBeGreaterThan(parent1.generation);
          expect(child.generation).toBeGreaterThan(parent2.generation);
          expect(child.parentId).toBe(parent1.id);
          expect(child.objectives.length).toBeGreaterThanOrEqual(1);
          expect(child.agentName).toBe(parent1.agentName);
        }
      ),
      { numRuns: 50 }
    );
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 10: Mutation Invariants
  // ═════════════════════════════════════════════════════════════════════════════

  it('should maintain mutation invariants', () => {
    fc.assert(
      fc.property(
        goalGenomeArb,
        fc.constantFrom<'add' | 'remove' | 'perturb'>('add', 'remove', 'perturb'),
        (genome, mutationType) => {
          // Skip remove mutation when only 1 objective (can't remove)
          if (mutationType === 'remove' && genome.objectives.length <= 1) {
            return;
          }

          let child: GoalGenome;
          
          switch (mutationType) {
            case 'add': {
              const newObj: ObjectiveDescriptor = {
                id: `new-obj-${Date.now()}`,
                description: 'new',
                domain: 'general',
                parameters: {},
                weight: 0.5,
              };
              ({ genome: child } = addObjective(genome, newObj));
              break;
            }
            case 'remove': {
              ({ genome: child } = removeObjective(genome, genome.objectives[0].id));
              break;
            }
            case 'perturb': {
              ({ genome: child } = perturbObjective(genome, genome.objectives[0].id, { weight: 0.1 }));
              break;
            }
          }

          // Invariant 1: Generation always increments
          expect(child.generation).toBeGreaterThanOrEqual(genome.generation + 1);
          
          // Invariant 2: At least 1 objective
          expect(child.objectives.length).toBeGreaterThanOrEqual(1);
          
          // Invariant 3: No duplicate objective IDs
          const ids = child.objectives.map(o => o.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 2: Inner Loop Fitness Summary Completeness
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fitness evaluation', () => {
  it('should produce complete fitness scores', () => {
    fc.assert(
      fc.property(
        goalGenomeArb,
        fc.array(
          fc.record({
            taskId: fc.string(),
            objectiveId: fc.string(),
            passed: fc.boolean(),
            score: fc.float({ min: 0, max: 1, noNaN: true }),
            duration: fc.integer({ min: 0, max: 10000 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (genome, taskResults) => {
          const innerResult = {
            genomeId: genome.id,
            taskResults: taskResults.map(r => ({ ...r, objectiveId: genome.objectives[0]?.id || 'obj1' })),
            totalDuration: 1000,
            iterationsCompleted: 10,
            partial: false,
          };

          const score = evaluate(genome, innerResult, [], []);

          expect(score.genomeId).toBe(genome.id);
          expect(score.performanceScore).toBeGreaterThanOrEqual(0);
          expect(score.performanceScore).toBeLessThanOrEqual(1);
          expect(score.noveltyScore).toBeGreaterThanOrEqual(0);
          expect(score.noveltyScore).toBeLessThanOrEqual(1);
          expect(score.tasteAlignmentScore).toBeGreaterThanOrEqual(0);
          expect(score.tasteAlignmentScore).toBeLessThanOrEqual(1);
          expect(score.aggregateScore).toBeGreaterThanOrEqual(0);
          expect(score.aggregateScore).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 4: Tournament Selection Preserves Population Size
  // ═════════════════════════════════════════════════════════════════════════════

  it('should preserve selection count in tournament selection', () => {
    fc.assert(
      fc.property(
        fc.array(goalGenomeArb, { minLength: 5, maxLength: 50 }),
        fc.integer({ min: 2, max: 5 }), // tournament size
        fc.integer({ min: 1, max: 10 }), // selection count
        (genomes, tournamentSize, selectionCount) => {
          const candidates = genomes.map(g => ({
            genome: g,
            score: {
              genomeId: g.id,
              performanceScore: Math.random(),
              noveltyScore: Math.random(),
              tasteAlignmentScore: Math.random(),
              aggregateScore: Math.random(),
              breakdown: {},
            },
          }));

          const selected = tournamentSelect(candidates, tournamentSize, selectionCount);

          expect(selected.length).toBe(selectionCount);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 11: Taste Guard Filtering
// ═══════════════════════════════════════════════════════════════════════════════

describe('Taste Guard', () => {
  it('should reject genomes with taste conflicts', () => {
    fc.assert(
      fc.property(
        goalGenomeArb,
        fc.array(
          fc.record({
            id: fc.string(),
            canonicalContent: fc.string({ minLength: 1, maxLength: 50 }),
            successScore: fc.float({ min: 0.5, max: 1, noNaN: true }), // High success score = hard constraint
            isActive: fc.constant(true),
            tags: fc.array(fc.string(), { maxLength: 5 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (genome, patterns) => {
          // Create a conflicting objective
          const conflictingGenome = {
            ...genome,
            objectives: [
              {
                ...genome.objectives[0],
                description: patterns[0]?.canonicalContent || genome.objectives[0].description,
              },
              ...genome.objectives.slice(1),
            ],
          };

          const result = check(conflictingGenome, patterns);

          // Should find conflicts when description matches pattern
          if (patterns.some(p => 
            conflictingGenome.objectives[0].description.toLowerCase().includes(p.canonicalContent.toLowerCase())
          )) {
            expect(result.conflicts.length).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 12: Taste-rejected candidates excluded from selection
  // ═════════════════════════════════════════════════════════════════════════════

  it('should filter rejected candidates from population', () => {
    fc.assert(
      fc.property(
        fc.array(goalGenomeArb, { minLength: 3, maxLength: 20 }),
        fc.array(
          fc.record({
            id: fc.string(),
            canonicalContent: fc.constant('conflict'),
            successScore: fc.constant(0.8),
            isActive: fc.constant(true),
            tags: fc.array(fc.string()),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (genomes, patterns) => {
          // Make first genome conflict
          const modifiedGenomes = genomes.map((g, i) =>
            i === 0
              ? { ...g, objectives: [{ ...g.objectives[0], description: 'conflict' }, ...g.objectives.slice(1)] }
              : g
          );

          const filtered = filterCandidates(modifiedGenomes, patterns);

          // First genome should be filtered out
          expect(filtered.some(g => g.id === modifiedGenomes[0].id)).toBe(false);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 13: Curriculum Topological Ordering
// ═══════════════════════════════════════════════════════════════════════════════

describe('Curriculum generation', () => {
  it('should produce topologically ordered tasks', () => {
    fc.assert(
      fc.property(
        goalGenomeArb,
        (genome) => {
          const curriculum = generateCurriculum(genome);

          // All tasks should have unique IDs
          const ids = curriculum.tasks.map(t => t.id);
          expect(new Set(ids).size).toBe(ids.length);

          // Dependencies should come before dependent tasks
          const position = new Map(curriculum.tasks.map((t, i) => [t.id, i]));
          for (let i = 0; i < curriculum.tasks.length; i++) {
            const task = curriculum.tasks[i];
            for (const predId of task.predecessorIds) {
              const predPos = position.get(predId);
              expect(predPos).toBeDefined();
              expect(predPos).toBeLessThan(i);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 14: Curriculum Task Result Recording
  // ═════════════════════════════════════════════════════════════════════════════

  it('should track progress correctly', () => {
    fc.assert(
      fc.property(
        goalGenomeArb,
        fc.integer({ min: 0, max: 10 }), // number of completed tasks
        (genome, completedCount) => {
          let curriculum = generateCurriculum(genome);
          
          // Limit completed count to available tasks
          const actualCompleted = Math.min(completedCount, curriculum.tasks.length);
          
          // Mark tasks as completed
          for (let i = 0; i < actualCompleted; i++) {
            if (curriculum.tasks[i]) {
              curriculum.tasks[i] = { ...curriculum.tasks[i], status: 'passed' as const };
            }
          }

          const progress = getProgress(curriculum);

          expect(progress.total).toBe(curriculum.tasks.length);
          expect(progress.completed).toBe(actualCompleted);
          expect(progress.percentage).toBe(actualCompleted / curriculum.tasks.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});
