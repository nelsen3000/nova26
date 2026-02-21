# Slash Commands

## Source
Extracted from Nova26 `src/cli/slash-commands.ts`

---

## Pattern: Typed Slash Command Interface

The base slash commands module defines a strongly-typed `SlashCommand` interface and a registry of core development commands (`/fix`, `/commit`, `/generate`, `/preview`, `/skills`, `/help`). Each command integrates with a specific Nova26 subsystem — TypeScript compilation, Git, PRD generation, preview server, or skill loader — through a consistent async handler signature.

---

## Implementation

### Code Example

```typescript
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { generatePRD } from '../agents/sun-prd-generator.js';
import { callLLM } from '../llm/ollama-client.js';
import { listSkills } from '../skills/skill-loader.js';

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<void>;
}

export const slashCommands: Record<string, SlashCommand> = {
  '/fix': {
    name: '/fix',
    description: 'Fix TypeScript errors using MARS agent',
    usage: '/fix',
    handler: async () => {
      console.log('🔧 Checking for TypeScript errors...\n');
      try {
        execSync('npx tsc --noEmit', { stdio: 'inherit' });
        console.log('✅ No errors found!');
      } catch {
        console.log('\n🤖 Asking MARS for fixes...');
        // Analyze errors and delegate to MARS agent
      }
    }
  },

  '/commit': {
    name: '/commit',
    description: 'Generate commit message from staged changes',
    usage: '/commit',
    handler: async () => {
      const diff = execSync('git diff --cached', { encoding: 'utf-8' });
      if (!diff.trim()) {
        console.log('⚠️ No staged changes');
        return;
      }
      const response = await callLLM(
        'Generate conventional commit message',
        diff.substring(0, 3000),
        'SUN'
      );
      console.log(`\n💬 ${response.content.trim()}`);
    }
  },

  '/generate': {
    name: '/generate',
    description: 'Generate PRD from description',
    usage: '/generate "description"',
    handler: async (args) => {
      const description = args.join(' ');
      const prd = await generatePRD(description);
      const filename = `generated-${Date.now()}.json`;
      writeFileSync(join('.nova', filename), JSON.stringify(prd, null, 2));
      console.log(`✅ Saved to .nova/${filename}`);
    }
  },

  '/skills': {
    name: '/skills',
    description: 'List available skills',
    usage: '/skills',
    handler: async () => listSkills()
  }
};

export async function executeSlashCommand(input: string): Promise<boolean> {
  const parts = input.trim().split(' ');
  const command = slashCommands[parts[0]];
  if (!command) return false;
  await command.handler(parts.slice(1));
  return true;
}
```

### Key Concepts

- **SlashCommand interface**: Enforces a uniform shape (`name`, `description`, `usage`, `handler`) so every command is self-documenting and dispatchable
- **Record-based registry**: `Record<string, SlashCommand>` enables O(1) lookup by command name and easy iteration for help output
- **Boolean return from executeSlashCommand**: Returns `true` if the command was found and executed, `false` otherwise — lets callers decide how to handle unknown input
- **Agent delegation**: Commands like `/fix` detect problems (TypeScript errors) then delegate resolution to the appropriate agent (MARS)
- **LLM integration**: `/commit` sends git diffs to the LLM for conventional commit message generation, capping input at 3000 chars to stay within context limits
- **PRD generation**: `/generate` bridges natural language descriptions to structured PRD output via the SUN agent's PRD generator

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Untyped command map with inconsistent handler signatures
const commands: any = {
  '/fix': (input: string) => { /* ... */ },           // sync, takes full input
  '/commit': async (a: string, b: string) => { },     // different arity
  '/generate': (args: string[]) => { /* ... */ },      // sync, takes array
};
```

### ✅ Do This Instead

```typescript
// Strongly-typed interface ensures consistency
export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<void>;
}

const commands: Record<string, SlashCommand> = {
  '/fix': {
    name: '/fix',
    description: 'Fix TypeScript errors',
    usage: '/fix',
    handler: async () => { /* ... */ }
  }
};
```

---

## When to Use This Pattern

✅ **Use for:**
- Defining a base set of CLI commands that other modules can extend via spread
- Commands that integrate with external tools (compilers, git, LLMs) through a uniform async interface

❌ **Don't use for:**
- Commands that need complex argument parsing with flags and subcommands — use a library like `commander` or `yargs` instead

---

## Benefits

1. **Type safety** — The `SlashCommand` interface catches missing fields at compile time
2. **Composability** — The exported `Record` can be spread into larger registries (see `cli-entry.md`)
3. **Self-documenting** — Every command carries its own `description` and `usage`, enabling auto-generated help
4. **Agent integration** — Commands bridge user intent to the appropriate Nova26 agent (MARS for fixes, SUN for PRD generation)

---

## Related Patterns

- See `./cli-entry.md` for how this command set is merged into the unified CLI registry
- See `./slash-commands-extended.md` for the extended command set that supplements these base commands
- See `../02-agent-system/prd-generator.md` for the PRD generation logic invoked by `/generate`
- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that `/fix` delegates to via MARS

---

*Extracted: 2026-02-18*
