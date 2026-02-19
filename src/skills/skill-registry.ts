// Skill Registry — Manages agent-executable skills for multi-step workflows
// KIMI-INTEGRATE-02: Grok R11 Skills Framework spec

// ============================================================================
// Core Types
// ============================================================================

export interface SkillStep {
  name: string;
  tool: string;
  buildArgs: (context: SkillContext) => Record<string, unknown>;
  validateResult?: (result: string) => boolean;
}

export interface Skill {
  name: string;
  description: string;
  agents: string[];
  steps: SkillStep[];
  requiredTools: string[];
  version: string;
}

export interface SkillContext {
  agentName: string;
  taskDescription: string;
  workingDir: string;
  inputs: Record<string, unknown>;
  stepResults: Record<string, string>;
}

export interface SkillRegistration {
  skill: Skill;
  registeredAt: string;
  source: 'builtin' | 'marketplace' | 'user';
}

// ============================================================================
// SkillRegistry Class
// ============================================================================

class SkillRegistry {
  private skills: Map<string, SkillRegistration> = new Map();

  register(skill: Skill, source: 'builtin' | 'marketplace' | 'user' = 'user'): void {
    this.skills.set(skill.name, {
      skill,
      registeredAt: new Date().toISOString(),
      source,
    });
    console.log(`SkillRegistry: registered skill "${skill.name}" (${source})`);
  }

  get(name: string): Skill | null {
    const registration = this.skills.get(name);
    return registration?.skill ?? null;
  }

  listForAgent(agentName: string): Skill[] {
    const result: Skill[] = [];
    for (const reg of this.skills.values()) {
      // Empty agents array = available to all
      if (reg.skill.agents.length === 0 || reg.skill.agents.includes(agentName)) {
        result.push(reg.skill);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  listAll(): Skill[] {
    const result = Array.from(this.skills.values()).map(r => r.skill);
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  clear(): void {
    this.skills.clear();
  }
}

// ============================================================================
// Built-in Skills
// ============================================================================

const builtinSkills: Skill[] = [
  {
    name: 'debug-root-cause',
    description: 'Analyze an error message, search the codebase for its source, identify the root cause, and suggest a fix.',
    agents: [],
    version: '1.0.0',
    requiredTools: ['readFile', 'searchCode'],
    steps: [
      {
        name: 'read-error-context',
        tool: 'readFile',
        buildArgs: (ctx) => ({ path: (ctx.inputs['errorFile'] as string) ?? ctx.workingDir }),
        validateResult: (r) => r.length > 0,
      },
      {
        name: 'search-for-source',
        tool: 'searchCode',
        buildArgs: (ctx) => ({
          pattern: (ctx.inputs['errorPattern'] as string) ?? '',
        }),
      },
      {
        name: 'identify-cause',
        tool: 'readFile',
        buildArgs: (ctx) => {
          const searchResult = ctx.stepResults['search-for-source'] ?? '';
          const firstFile = searchResult.split('\n')[0]?.split(':')[0]?.trim() ?? ctx.workingDir;
          return { path: firstFile };
        },
      },
    ],
  },
  {
    name: 'refactor-safely',
    description: 'Analyze code to be refactored, propose changes, and verify no regressions by checking test files.',
    agents: ['MARS', 'EARTH', 'SATURN'],
    version: '1.0.0',
    requiredTools: ['readFile', 'searchCode'],
    steps: [
      {
        name: 'analyze-target',
        tool: 'readFile',
        buildArgs: (ctx) => ({ path: ctx.inputs['targetFile'] as string }),
        validateResult: (r) => r.length > 0,
      },
      {
        name: 'find-usages',
        tool: 'searchCode',
        buildArgs: (ctx) => ({
          pattern: (ctx.inputs['symbolName'] as string) ?? '',
        }),
      },
      {
        name: 'check-test-coverage',
        tool: 'searchCode',
        buildArgs: (ctx) => ({
          pattern: (ctx.inputs['targetFile'] as string ?? '').replace(/\.\w+$/, '.test.'),
        }),
      },
    ],
  },
  {
    name: 'generate-tests',
    description: 'Read an implementation file and generate a comprehensive test file covering happy path, edge cases, and error cases.',
    agents: ['SATURN'],
    version: '1.0.0',
    requiredTools: ['readFile', 'searchCode'],
    steps: [
      {
        name: 'read-implementation',
        tool: 'readFile',
        buildArgs: (ctx) => ({ path: ctx.inputs['targetFile'] as string }),
        validateResult: (r) => r.length > 0,
      },
      {
        name: 'find-existing-tests',
        tool: 'searchCode',
        buildArgs: (_ctx) => ({
          pattern: '.test.',
        }),
      },
      {
        name: 'read-related-types',
        tool: 'searchCode',
        buildArgs: (ctx) => ({
          pattern: (ctx.inputs['targetFile'] as string ?? '').replace(/\.\w+$/, '.'),
        }),
      },
    ],
  },
];

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: SkillRegistry | null = null;

export function getSkillRegistry(): SkillRegistry {
  if (!instance) {
    instance = new SkillRegistry();
    // Register built-in skills on first initialization
    for (const skill of builtinSkills) {
      instance.register(skill, 'builtin');
    }
  }
  return instance;
}

export function resetSkillRegistry(): void {
  instance = null;
}

export { SkillRegistry, builtinSkills };
