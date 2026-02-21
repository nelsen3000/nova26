// Eval Registry - Registry for evaluation suites
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-05)

import { z } from 'zod';
import {
  EvalSuiteSchema,
  type EvalSuite,
  type EvalCase,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Error Classes
// ═══════════════════════════════════════════════════════════════════════════════

export class SuiteNotFoundError extends Error {
  constructor(suiteId: string) {
    super(`Evaluation suite not found: ${suiteId}`);
    this.name = 'SuiteNotFoundError';
  }
}

export class DuplicateSuiteError extends Error {
  constructor(suiteId: string) {
    super(`Evaluation suite already exists: ${suiteId}`);
    this.name = 'DuplicateSuiteError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EvalRegistry Class
// ═══════════════════════════════════════════════════════════════════════════════

export class EvalRegistry {
  private suites: Map<string, EvalSuite>;

  constructor() {
    this.suites = new Map();
  }

  /**
   * Register a new evaluation suite
   */
  registerSuite(suite: Omit<EvalSuite, 'createdAt' | 'updatedAt'>): EvalSuite {
    if (this.suites.has(suite.id)) {
      throw new DuplicateSuiteError(suite.id);
    }

    const now = new Date().toISOString();
    const fullSuite: EvalSuite = {
      ...suite,
      createdAt: now,
      updatedAt: now,
    };

    // Validate with Zod
    const validated = EvalSuiteSchema.parse(fullSuite);
    this.suites.set(validated.id, validated);

    return validated;
  }

  /**
   * Create a suite from raw data with validation
   */
  createSuite(data: {
    id: string;
    name: string;
    description?: string;
    cases: EvalCase[];
    scoringFunction?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): EvalSuite {
    const now = new Date().toISOString();
    const suite: EvalSuite = {
      ...data,
      scoringFunction: data.scoringFunction ?? 'exactMatch',
      tags: data.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    return this.registerSuite(suite);
  }

  /**
   * Get a suite by ID
   */
  getSuite(suiteId: string): EvalSuite | undefined {
    return this.suites.get(suiteId);
  }

  /**
   * Get a suite by ID (throws if not found)
   */
  getSuiteOrThrow(suiteId: string): EvalSuite {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new SuiteNotFoundError(suiteId);
    }
    return suite;
  }

  /**
   * List all registered suites
   */
  listSuites(): EvalSuite[] {
    return Array.from(this.suites.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * List suites with optional filtering
   */
  listSuitesByFilter(options: {
    tags?: string[];
    scoringFunction?: string;
  } = {}): EvalSuite[] {
    let suites = this.listSuites();

    if (options.tags && options.tags.length > 0) {
      suites = suites.filter(suite =>
        options.tags!.some(tag => suite.tags.includes(tag))
      );
    }

    if (options.scoringFunction) {
      suites = suites.filter(
        suite => suite.scoringFunction === options.scoringFunction
      );
    }

    return suites;
  }

  /**
   * Remove a suite
   */
  removeSuite(suiteId: string): boolean {
    return this.suites.delete(suiteId);
  }

  /**
   * Update an existing suite
   */
  updateSuite(
    suiteId: string,
    updates: Partial<Omit<EvalSuite, 'id' | 'createdAt' | 'updatedAt'>>
  ): EvalSuite {
    const existing = this.getSuiteOrThrow(suiteId);

    const updated: EvalSuite = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Validate updated suite
    const validated = EvalSuiteSchema.parse(updated);
    this.suites.set(suiteId, validated);

    return validated;
  }

  /**
   * Add a case to an existing suite
   */
  addCase(suiteId: string, newCase: EvalCase): EvalSuite {
    const suite = this.getSuiteOrThrow(suiteId);

    // Check for duplicate case ID
    if (suite.cases.some(c => c.id === newCase.id)) {
      throw new Error(`Case with ID "${newCase.id}" already exists in suite`);
    }

    return this.updateSuite(suiteId, {
      cases: [...suite.cases, newCase],
    });
  }

  /**
   * Remove a case from a suite
   */
  removeCase(suiteId: string, caseId: string): EvalSuite {
    const suite = this.getSuiteOrThrow(suiteId);

    const updatedCases = suite.cases.filter(c => c.id !== caseId);
    if (updatedCases.length === suite.cases.length) {
      throw new Error(`Case with ID "${caseId}" not found in suite`);
    }

    return this.updateSuite(suiteId, {
      cases: updatedCases,
    });
  }

  /**
   * Update a specific case in a suite
   */
  updateCase(
    suiteId: string,
    caseId: string,
    updates: Partial<Omit<EvalCase, 'id'>>
  ): EvalSuite {
    const suite = this.getSuiteOrThrow(suiteId);

    const updatedCases = suite.cases.map(c => {
      if (c.id === caseId) {
        return { ...c, ...updates };
      }
      return c;
    });

    if (!updatedCases.some(c => c.id === caseId)) {
      throw new Error(`Case with ID "${caseId}" not found in suite`);
    }

    return this.updateSuite(suiteId, {
      cases: updatedCases,
    });
  }

  /**
   * Get all unique tags across all suites
   */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const suite of this.suites.values()) {
      for (const tag of suite.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }

  /**
   * Get all unique scoring functions in use
   */
  getScoringFunctions(): string[] {
    const functions = new Set<string>();
    for (const suite of this.suites.values()) {
      functions.add(suite.scoringFunction);
    }
    return Array.from(functions).sort();
  }

  /**
   * Count total suites
   */
  count(): number {
    return this.suites.size;
  }

  /**
   * Clear all suites
   */
  clear(): void {
    this.suites.clear();
  }

  /**
   * Check if suite exists
   */
  hasSuite(suiteId: string): boolean {
    return this.suites.has(suiteId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalRegistry: EvalRegistry | null = null;

export function getEvalRegistry(): EvalRegistry {
  if (!globalRegistry) {
    globalRegistry = new EvalRegistry();
  }
  return globalRegistry;
}

export function resetEvalRegistry(): void {
  globalRegistry = null;
}
