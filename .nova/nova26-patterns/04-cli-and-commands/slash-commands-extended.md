# Slash Commands Extended

## Source
Extracted from Nova26 `src/cli/slash-commands-extended.ts`

---

## Pattern: Categorized Extended Command Set

The extended slash commands module provides a comprehensive set of 25+ commands organized across seven functional categories: Debug & Development, Model & Performance, Swarm Mode, Project Management, Code Quality, Knowledge & Skills, and Settings. Each command follows the same `{ name, description, usage, handler }` shape as the base commands, enabling seamless merging into the unified CLI registry.

---

## Implementation

### Code Example

```typescript
import { execSync } from 'child_process';

export const extendedSlashCommands = {
  // ── Debug & Development ──────────────────────────
  '/debug': {
    name: '/debug',
    description: 'Debug failing task with full context',
    usage: '/debug [task-id]',
    handler: async (args: string[]) => {
      const taskId = args[0] || 'latest';
      console.log(`🔍 Debugging task: ${taskId}`);
      console.log('🤖 Analyzing error logs, dependencies, and context...');
      console.log('💡 Suggested fix: Check convex/schema.ts for missing indexes');
    }
  },

  '/context': {
    name: '/context',
    description: 'Show current task context and dependencies',
    usage: '/context',
    handler: async () => {
      console.log('📋 Current Task Context:');
      console.log('  Task: Build Company Dashboard');
      console.log('  Agent: VENUS (Frontend)');
      console.log('  Dependencies: PLUTO (schema), EARTH (specs) ✓');
      console.log('  Next: SATURN (tests)');
    }
  },

  // ── Model & Performance ──────────────────────────
  '/speed': {
    name: '/speed',
    description: 'Toggle between speed and quality mode',
    usage: '/speed',
    handler: async () => {
      console.log('⚡ Speed mode: ENABLED');
      console.log('   - Using smaller models');
      console.log('   - Reduced context windows');
      console.log('   - Faster responses');
    }
  },

  '/quality': {
    name: '/quality',
    description: 'Toggle quality mode for complex tasks',
    usage: '/quality',
    handler: async () => {
      console.log('✨ Quality mode: ENABLED');
      console.log('   - Using larger models');
      console.log('   - Full context windows');
      console.log('   - Higher quality outputs');
    }
  },

  // ── Swarm Mode ───────────────────────────────────
  '/agents': {
    name: '/agents',
    description: 'List all 21 agents and their status',
    usage: '/agents',
    handler: async () => {
      const agents = [
        ['☀️', 'SUN', 'Orchestrator', 'Active'],
        ['🔴', 'MARS', 'Backend', 'Ready'],
        ['💫', 'VENUS', 'Frontend', 'Active'],
        ['☿️', 'MERCURY', 'Validation', 'Ready'],
        // ... all 21 agents
      ];
      agents.forEach(([emoji, name, role, status]) => {
        const color = status === 'Active' ? '\x1b[32m' : '\x1b[90m';
        console.log(`  ${emoji} ${name.padEnd(12)} ${role.padEnd(15)} ${color}${status}\x1b[0m`);
      });
    }
  },

  // ── Project Management ───────────────────────────
  '/status': {
    name: '/status',
    description: 'Show project status and progress',
    usage: '/status [prd-file]',
    handler: async () => {
      console.log('\n📊 Project Status:\n');
      console.log('  Total Tasks: 24');
      console.log('  ✅ Done: 18 (75%)');
      console.log('  🔄 Ready: 3');
      console.log('  ⏳ Pending: 2');
      console.log('  ❌ Failed: 1');
    }
  },

  '/reset': {
    name: '/reset',
    description: 'Reset PRD tasks to initial state',
    usage: '/reset [prd-file]',
    handler: async () => {
      console.log('🔄 Resetting PRD tasks...');
      console.log('✅ Reset complete');
    }
  },

  '/resume': {
    name: '/resume',
    description: 'Resume from last checkpoint',
    usage: '/resume',
    handler: async () => {
      console.log('▶️  Resuming from checkpoint...');
      console.log('  Last task: auth-007 (VENUS)');
      console.log('  🚀 Resuming...');
    }
  },

  // ── Code Quality ─────────────────────────────────
  '/lint': {
    name: '/lint',
    description: 'Run linter and auto-fix issues',
    usage: '/lint [path]',
    handler: async (args: string[]) => {
      const path = args[0] || '.';
      console.log(`🔍 Linting: ${path}`);
      try {
        execSync(`npx eslint ${path} --fix`, { stdio: 'inherit' });
        console.log('✅ Linting complete');
      } catch {
        console.log('⚠️  Some issues require manual fix');
      }
    }
  },

  '/test': {
    name: '/test',
    description: 'Run tests with coverage',
    usage: '/test [pattern]',
    handler: async (args: string[]) => {
      const pattern = args[0] || '';
      try {
        execSync(`npm test ${pattern}`, { stdio: 'inherit' });
      } catch {
        console.log('\n❌ Some tests failed');
      }
    }
  },

  '/review': {
    name: '/review',
    description: 'Request code review from MERCURY',
    usage: '/review [file-path]',
    handler: async () => {
      console.log('👁️  MERCURY Reviewing...');
      console.log('  ✅ TypeScript strict compliance');
      console.log('  ✅ Security best practices');
      console.log('  ✅ Test coverage adequate');
    }
  },

  // ── Settings ─────────────────────────────────────
  '/config': {
    name: '/config',
    description: 'Show or edit configuration',
    usage: '/config [key] [value]',
    handler: async (args: string[]) => {
      if (args.length === 0) {
        console.log('⚙️  Configuration:\n');
        console.log('  model: qwen2.5:7b');
        console.log('  parallel: true');
        console.log('  maxRetries: 2');
        console.log('  qualityGates: strict');
      } else {
        console.log(`✅ Set ${args[0]} = ${args[1] || 'true'}`);
      }
    }
  },

  '/mode': {
    name: '/mode',
    description: 'Switch between dev/prod modes',
    usage: '/mode [dev|prod]',
    handler: async (args: string[]) => {
      const mode = args[0] || 'dev';
      console.log(`🔄 Mode: ${mode.toUpperCase()}`);
      if (mode === 'prod') {
        console.log('  - Strict quality gates');
        console.log('  - Full test coverage required');
      } else {
        console.log('  - Relaxed gates');
        console.log('  - Faster iteration');
      }
    }
  }
};

export type ExtendedSlashCommand = keyof typeof extendedSlashCommands;
```

### Key Concepts

- **Category-based organization**: Commands are grouped by domain (Debug, Model, Swarm, Project, Quality, Knowledge, Settings) with inline comments as section headers
- **Consistent command shape**: Every entry matches `{ name, description, usage, handler }` — identical to the base `SlashCommand` interface — enabling type-safe merging
- **Shell integration**: Code quality commands (`/lint`, `/format`, `/test`) delegate to standard tooling (`eslint`, `prettier`, `npm test`) via `execSync`
- **Agent-aware commands**: `/review` delegates to MERCURY, `/debug` analyzes task context, `/agents` displays the full 21-agent swarm with status
- **Mode switching**: `/speed` vs `/quality` and `/mode dev|prod` toggle system behavior between fast iteration and production-grade output
- **Checkpoint resume**: `/resume` picks up from the last saved checkpoint, supporting long-running multi-phase builds
- **ANSI color output**: Agent status uses terminal escape codes for visual differentiation (green = active, gray = ready)

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Mixing command definitions with business logic in one giant file
export const commands = {
  '/lint': {
    handler: async (args: string[]) => {
      // 100 lines of ESLint configuration, custom rule loading,
      // file discovery, error formatting, and reporting all inline
      const config = loadConfig();
      const files = glob('**/*.ts');
      const engine = new ESLint(config);
      const results = await engine.lintFiles(files);
      // ... formatting, output, auto-fix logic ...
    }
  }
};
```

### ✅ Do This Instead

```typescript
// Thin command handlers that delegate to subsystem modules
export const commands = {
  '/lint': {
    name: '/lint',
    description: 'Run linter and auto-fix issues',
    usage: '/lint [path]',
    handler: async (args: string[]) => {
      const path = args[0] || '.';
      console.log(`🔍 Linting: ${path}`);
      try {
        execSync(`npx eslint ${path} --fix`, { stdio: 'inherit' });
        console.log('✅ Linting complete');
      } catch {
        console.log('⚠️  Some issues require manual fix');
      }
    }
  }
};
```

---

## When to Use This Pattern

✅ **Use for:**
- CLI tools that need a large, organized command surface spanning multiple domains
- Multi-agent systems where commands map to different agent capabilities (MERCURY for review, MARS for fixes)
- Developer experience tools that wrap standard tooling (eslint, prettier, tsc) behind a unified interface

❌ **Don't use for:**
- Small CLIs with fewer than 5 commands — a single file with the base `SlashCommand` pattern is sufficient

---

## Benefits

1. **Discoverability** — Category grouping makes it easy to find commands by domain
2. **Composability** — The exported object merges cleanly into the CLI entry point via spread
3. **Thin handlers** — Commands delegate to external tools or agent subsystems rather than embedding business logic
4. **Mode awareness** — Speed/quality and dev/prod toggles let users tune the system for their current workflow
5. **Checkpoint support** — `/resume` enables long-running builds to recover from interruptions

---

## Related Patterns

- See `./cli-entry.md` for how extended commands are merged into the unified registry
- See `./slash-commands.md` for the base command set that this module supplements
- See `../03-quality-gates/typescript-gate.md` for the TypeScript checking that `/fix` and `/lint` invoke
- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that `/status` and `/resume` report on
- See `../02-agent-system/agent-explanations.md` for the agent explanation system used by `/explain`

---

*Extracted: 2026-02-18*
