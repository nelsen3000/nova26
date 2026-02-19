import crypto from 'node:crypto';
import type { ProjectProfile } from './framework-detector.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type RecommendationPriority = 'required' | 'recommended' | 'optional';

export interface DependencyRecommendation {
  id: string;
  packageName: string;
  reason: string;
  priority: RecommendationPriority;
  isDev: boolean;
  conflictsWith: string[];
}

export interface RecommendationRule {
  id: string;
  packageName: string;
  reason: string;
  priority: RecommendationPriority;
  isDev: boolean;
  conflictsWith: string[];
  condition: (profile: ProjectProfile) => boolean;
}

export interface RecommendationReport {
  id: string;
  recommendations: DependencyRecommendation[];
  conflicts: Array<{ packageA: string; packageB: string; reason: string }>;
  devTools: DependencyRecommendation[];
  generatedAt: string;
}

// ── Dependency Recommender ─────────────────────────────────────────────────

export class DependencyRecommender {
  private rules: RecommendationRule[] = [];

  constructor() {
    this.registerBuiltInRules();
  }

  private registerBuiltInRules(): void {
    this.rules = [
      {
        id: crypto.randomUUID(),
        packageName: 'vitest',
        reason: 'Modern and fast testing framework for TypeScript projects',
        priority: 'recommended',
        isDev: true,
        conflictsWith: ['jest'],
        condition: (profile) =>
          !profile.detectedFrameworks.some((f) => f.name === 'Vitest' || f.name === 'Jest'),
      },
      {
        id: crypto.randomUUID(),
        packageName: '@types/node',
        reason: 'TypeScript type definitions for Node.js APIs',
        priority: 'required',
        isDev: true,
        conflictsWith: [],
        condition: (profile) => profile.hasTypeScript,
      },
      {
        id: crypto.randomUUID(),
        packageName: 'eslint',
        reason: 'Linting for code quality and consistency',
        priority: 'recommended',
        isDev: true,
        conflictsWith: [],
        condition: () => true,
      },
      {
        id: crypto.randomUUID(),
        packageName: 'prettier',
        reason: 'Consistent code formatting across the project',
        priority: 'optional',
        isDev: true,
        conflictsWith: [],
        condition: () => true,
      },
      {
        id: crypto.randomUUID(),
        packageName: '@testing-library/react',
        reason: 'Testing utilities for React components',
        priority: 'recommended',
        isDev: true,
        conflictsWith: [],
        condition: (profile) =>
          profile.detectedFrameworks.some((f) => f.name === 'React'),
      },
      {
        id: crypto.randomUUID(),
        packageName: 'zod',
        reason: 'Runtime type validation and schema definition',
        priority: 'recommended',
        isDev: false,
        conflictsWith: [],
        condition: (profile) =>
          profile.inferredProjectType === 'api-server',
      },
      {
        id: crypto.randomUUID(),
        packageName: 'husky',
        reason: 'Git hooks for pre-commit linting and testing',
        priority: 'optional',
        isDev: true,
        conflictsWith: [],
        condition: () => true,
      },
      {
        id: crypto.randomUUID(),
        packageName: 'tsx',
        reason: 'Fast TypeScript execution without compilation step',
        priority: 'recommended',
        isDev: true,
        conflictsWith: [],
        condition: (profile) =>
          profile.hasTypeScript &&
          !profile.detectedFrameworks.some((f) => f.name === 'Next.js'),
      },
    ];
  }

  getRecommendationRules(): RecommendationRule[] {
    return [...this.rules];
  }

  recommendForProfile(profile: ProjectProfile): DependencyRecommendation[] {
    const recommendations: DependencyRecommendation[] = [];

    for (const rule of this.rules) {
      if (rule.condition(profile)) {
        recommendations.push({
          id: crypto.randomUUID(),
          packageName: rule.packageName,
          reason: rule.reason,
          priority: rule.priority,
          isDev: rule.isDev,
          conflictsWith: rule.conflictsWith,
        });
      }
    }

    return recommendations;
  }

  checkConflicts(
    recommendations: DependencyRecommendation[],
  ): Array<{ packageA: string; packageB: string; reason: string }> {
    const conflicts: Array<{ packageA: string; packageB: string; reason: string }> = [];
    const packageNames = new Set(recommendations.map((r) => r.packageName));

    for (const rec of recommendations) {
      for (const conflict of rec.conflictsWith) {
        if (packageNames.has(conflict)) {
          const alreadyLogged = conflicts.some(
            (c) =>
              (c.packageA === rec.packageName && c.packageB === conflict) ||
              (c.packageA === conflict && c.packageB === rec.packageName),
          );
          if (!alreadyLogged) {
            conflicts.push({
              packageA: rec.packageName,
              packageB: conflict,
              reason: `${rec.packageName} conflicts with ${conflict}`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  suggestDevTools(profile: ProjectProfile): DependencyRecommendation[] {
    const all = this.recommendForProfile(profile);
    return all.filter((r) => r.isDev);
  }

  rankRecommendations(recommendations: DependencyRecommendation[]): DependencyRecommendation[] {
    const priorityOrder: Record<RecommendationPriority, number> = {
      required: 0,
      recommended: 1,
      optional: 2,
    };

    return [...recommendations].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );
  }

  generateReport(profile: ProjectProfile): RecommendationReport {
    const recommendations = this.recommendForProfile(profile);
    const conflicts = this.checkConflicts(recommendations);
    const devTools = recommendations.filter((r) => r.isDev);

    return {
      id: crypto.randomUUID(),
      recommendations: this.rankRecommendations(recommendations),
      conflicts,
      devTools,
      generatedAt: new Date().toISOString(),
    };
  }
}
