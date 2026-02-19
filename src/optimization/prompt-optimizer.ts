// Prompt Optimizer — R19-03
// DSPy-inspired optimization core

import type { OptimizationObjective, OptimizeResult } from './types.js';

export type OptimizerStrategy = 'bayesian' | 'genetic' | 'hill-climbing';

export interface PromptOptimizerConfig {
  maxIterations?: number;
  convergenceThreshold?: number;
}

export class PromptOptimizer {
  private maxIterations: number;
  private convergenceThreshold: number;

  constructor(config?: PromptOptimizerConfig) {
    this.maxIterations = config?.maxIterations ?? 50;
    this.convergenceThreshold = config?.convergenceThreshold ?? 0.01;
  }

  async optimize(
    currentPrompt: string,
    objective: OptimizationObjective,
    strategy: OptimizerStrategy = 'hill-climbing',
    budget: number = 1000
  ): Promise<OptimizeResult> {
    switch (strategy) {
      case 'bayesian':
        return this.bayesianOptimize(currentPrompt, objective, budget);
      case 'genetic':
        return this.geneticOptimize(currentPrompt, objective, budget);
      case 'hill-climbing':
        return this.hillClimbingOptimize(currentPrompt, objective, budget);
      default:
        return this.hillClimbingOptimize(currentPrompt, objective, budget);
    }
  }

  private async bayesianOptimize(
    currentPrompt: string,
    objective: OptimizationObjective,
    budget: number
  ): Promise<OptimizeResult> {
    const trace: OptimizeResult['trace'] = [];
    let bestPrompt = currentPrompt;
    let bestScore = await this.evaluate(bestPrompt, objective);

    for (let i = 0; i < Math.min(this.maxIterations, budget / 20); i++) {
      // Simulate Bayesian optimization step
      const mutated = this.mutatePrompt(bestPrompt, 'bayesian');
      const score = await this.evaluate(mutated, objective);

      trace.push({ iteration: i, score, mutation: 'bayesian' });

      if (score > bestScore) {
        bestScore = score;
        bestPrompt = mutated;
      }
    }

    return {
      optimizedSystemPrompt: bestPrompt,
      optimizedFewShot: this.generateFewShot(objective),
      improvementPercent: ((bestScore - await this.evaluate(currentPrompt, objective)) / await this.evaluate(currentPrompt, objective)) * 100,
      trace,
    };
  }

  private async geneticOptimize(
    currentPrompt: string,
    objective: OptimizationObjective,
    budget: number
  ): Promise<OptimizeResult> {
    const trace: OptimizeResult['trace'] = [];
    const population = [currentPrompt, this.mutatePrompt(currentPrompt, 'genetic')];

    for (let i = 0; i < Math.min(this.maxIterations, budget / 20); i++) {
      // Evaluate population
      const scores = await Promise.all(population.map(p => this.evaluate(p, objective)));
      const bestScore = Math.max(...scores);
      const bestIndex = scores.indexOf(bestScore);

      trace.push({ iteration: i, score: bestScore, mutation: 'genetic' });

      // Crossover and mutate
      const parent1 = population[bestIndex];
      const parent2 = population[(bestIndex + 1) % population.length];
      const child = this.crossover(parent1, parent2);

      population.push(this.mutatePrompt(child, 'genetic'));
      if (population.length > 5) population.shift();
    }

    const finalScores = await Promise.all(population.map(p => this.evaluate(p, objective)));
    const bestIndex = finalScores.indexOf(Math.max(...finalScores));

    return {
      optimizedSystemPrompt: population[bestIndex],
      optimizedFewShot: this.generateFewShot(objective),
      improvementPercent: ((finalScores[bestIndex] - await this.evaluate(currentPrompt, objective)) / await this.evaluate(currentPrompt, objective)) * 100,
      trace,
    };
  }

  private async hillClimbingOptimize(
    currentPrompt: string,
    objective: OptimizationObjective,
    budget: number
  ): Promise<OptimizeResult> {
    const trace: OptimizeResult['trace'] = [];
    let bestPrompt = currentPrompt;
    let bestScore = await this.evaluate(bestPrompt, objective);
    let iterationsWithoutImprovement = 0;

    for (let i = 0; i < Math.min(this.maxIterations, budget / 10); i++) {
      const neighbor = this.mutatePrompt(bestPrompt, 'hill-climbing');
      const score = await this.evaluate(neighbor, objective);

      trace.push({ iteration: i, score, mutation: 'hill-climbing' });

      if (score > bestScore) {
        bestScore = score;
        bestPrompt = neighbor;
        iterationsWithoutImprovement = 0;
      } else {
        iterationsWithoutImprovement++;
        if (iterationsWithoutImprovement > 5) break;
      }

      if (Math.abs(score - bestScore) < this.convergenceThreshold) {
        break;
      }
    }

    const initialScore = await this.evaluate(currentPrompt, objective);

    return {
      optimizedSystemPrompt: bestPrompt,
      optimizedFewShot: this.generateFewShot(objective),
      improvementPercent: initialScore > 0 ? ((bestScore - initialScore) / initialScore) * 100 : 0,
      trace,
    };
  }

  async evaluateGoldenSet(prompt: string, objective: OptimizationObjective): Promise<number> {
    return this.evaluate(prompt, objective);
  }

  detectRegression(baseline: OptimizeResult, candidate: OptimizeResult, threshold: number = 5): boolean {
    const baselineScore = baseline.improvementPercent;
    const candidateScore = candidate.improvementPercent;
    return (baselineScore - candidateScore) > threshold;
  }

  private async evaluate(_prompt: string, objective: OptimizationObjective): Promise<number> {
    let totalScore = 0;
    let totalWeight = 0;

    for (const entry of objective.goldenSet) {
      // Simulate scoring
      const score = Math.random() * 0.3 + 0.7; // Simulated 70-100% accuracy
      totalScore += score * entry.weight;
      totalWeight += entry.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private mutatePrompt(prompt: string, _strategy: string): string {
    const mutations = [
      () => prompt + '\n\nBe concise and direct.',
      () => prompt.replace(/verbose/gi, 'concise'),
      () => prompt + '\n\nFocus on code quality.',
      () => `You are an expert. ${prompt}`,
    ];

    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    return mutation();
  }

  private crossover(parent1: string, parent2: string): string {
    const mid1 = Math.floor(parent1.length / 2);
    const mid2 = Math.floor(parent2.length / 2);
    return parent1.slice(0, mid1) + parent2.slice(mid2);
  }

  private generateFewShot(objective: OptimizationObjective): Array<{ input: string; output: string }> {
    return objective.goldenSet.slice(0, 3).map(entry => ({
      input: entry.input,
      output: entry.expectedOutput,
    }));
  }
}

export function createPromptOptimizer(config?: PromptOptimizerConfig): PromptOptimizer {
  return new PromptOptimizer(config);
}
