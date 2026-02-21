# CLI Entry Point

## Source
Extracted from Nova26 `src/cli/index.ts`

---

## Pattern: CLI Entry Point with Command Registry

The CLI entry point pattern provides a unified command registry that merges multiple command sources (base slash commands, extended commands, swarm commands, model commands) into a single dispatch table. It combines a command-object map with an interactive REPL loop, supporting both slash-command input and natural language fallback to swarm mode.

---

## Implementation

### Code Example

```typescript
import { extendedSlashCommands } from './slash-commands-extended.js';
import { executeSwarmMode, quickSwarm, fullSwarm, type SwarmTask } from '../swarm/swarm-mode.js';
import { selectTier, selectModel, getCurrentModel, getCurrentTier, AVAILABLE_MODELS } from '../llm/model-router.js';
import { getAgentExplanation, formatExplanation } from '../orchestrator/agent-explanations.js';

// Merge all command sources into a single registry
const allCommands = {
  ...extendedSlashCommands,

  '/swarm': {
    name: '/swarm',
    description: 'Enter swarm mode for task completion',
    usage: '/swarm "task description" [--quick|--full]',
    handler: async (args: string[]) => {
      const taskDesc = args.filter(a => !a.startsWith('--')).join(' ');
      const mode = args.find(a => a === '--full') ? 'full'
        : args.find(a => a === '--quick') ? 'quick' : 'adaptive';

      if (!taskDesc) {
        console.log('❌ Usage: /swarm "your task description" [--quick|--full]');
        return;
      }

      if (mode === 'quick') await quickSwarm(taskDesc);
      else if (mode === 'full') await fullSwarm(taskDesc);
      else {
        const task: SwarmTask = {
          id: `swarm-${Date.now()}`,
          description: taskDesc,
          complexity: taskDesc.length > 100 ? 'complex' : 'medium',
          requiredAgents: ['SUN', 'EARTH', 'MARS', 'VENUS', 'MERCURY'],
          deliverables: ['Implementation', 'Tests']
        };
        await executeSwarmMode(task);
      }
    }
  },

  '/tier': {
    name: '/tier',
    description: 'Switch between free/paid/hybrid model tiers',
    usage: '/tier [free|paid|hybrid]',
    handler: async (args: string[]) => {
      if (args.length === 0) {
        console.log(`Current tier: ${getCurrentTier().toUpperCase()}`);
        console.log(`Current model: ${getCurrentModel().name}`);
        return;
      }
      selectTier(args[0] as 'free' | 'paid' | 'hybrid');
    }
  },

  '/help': {
    name: '/help',
    description: 'Show all available commands',
    usage: '/help [command]',
    handler: async (args: string[]) => {
      if (args.length > 0) {
        const cmd = args[0].startsWith('/') ? args[0] : '/' + args[0];
        const command = allCommands[cmd as keyof typeof allCommands];
        if (command) {
          console.log(`\n${command.name} - ${command.description}`);
          console.log(`Usage: ${command.usage}\n`);
        } else {
          console.log(`Unknown command: ${cmd}`);
        }
        return;
      }
      // Categorized help output
      const categories = {
        'Swarm Mode': ['/swarm', '/agents'],
        'Model Control': ['/tier', '/model', '/models'],
        'Development': ['/generate', '/fix', '/debug', '/preview', '/test'],
        'Help': ['/help']
      };
      Object.entries(categories).forEach(([category, commands]) => {
        console.log(`${category}:`);
        commands.forEach(cmdName => {
          const cmd = allCommands[cmdName as keyof typeof allCommands];
          if (cmd) console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
        });
      });
    }
  }
};

/** Parse and execute a command */
export async function executeCommand(input: string): Promise<void> {
  const parts = input.trim().split(/\s+/);
  const commandName = parts[0];
  const args = parts.slice(1);

  const command = allCommands[commandName as keyof typeof allCommands];
  if (!command) {
    console.log(`Unknown command: ${commandName}`);
    console.log('Type /help to see available commands');
    return;
  }

  try {
    await command.handler(args);
  } catch (error) {
    console.error(`Error executing ${commandName}:`, error);
  }
}

/** Start interactive CLI with REPL loop */
export function startCLI(): void {
  console.log('\n🚀 NOVA26 AI Development Environment');
  console.log('Type /help for commands or describe what you want to build\n');

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => {
    rl.question('nova26> ', async (input: string) => {
      if (input.trim() === 'exit' || input.trim() === 'quit') {
        rl.close();
        return;
      }
      if (input.startsWith('/')) {
        await executeCommand(input);
      } else if (input.trim()) {
        // Natural language fallback → swarm mode
        await quickSwarm(input);
      }
      prompt();
    });
  };
  prompt();
}
```

### Key Concepts

- **Merged command registry**: Spread multiple command sources into one flat object so every command is accessible from a single lookup
- **Command-object shape**: Each command carries `name`, `description`, `usage`, and an async `handler(args)` — uniform interface for dispatch and help generation
- **Natural language fallback**: Non-slash input is routed to swarm mode, making the CLI approachable for users who don't know the commands
- **Categorized help**: `/help` groups commands by domain (Swarm, Model, Dev, etc.) for discoverability
- **Error isolation**: Each handler is wrapped in try/catch so one failing command doesn't crash the REPL

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Giant switch statement for command dispatch
async function handleInput(input: string) {
  const parts = input.split(' ');
  switch (parts[0]) {
    case '/fix':
      // 30 lines of inline logic
      break;
    case '/commit':
      // 40 lines of inline logic
      break;
    case '/swarm':
      // 50 lines of inline logic
      break;
    // ... 20 more cases
    default:
      console.log('Unknown command');
  }
}
```

### ✅ Do This Instead

```typescript
// Command-object registry with handler functions
const commands: Record<string, { handler: (args: string[]) => Promise<void> }> = {
  '/fix': { handler: fixHandler },
  '/commit': { handler: commitHandler },
  '/swarm': { handler: swarmHandler },
};

async function executeCommand(input: string): Promise<void> {
  const [name, ...args] = input.trim().split(/\s+/);
  const command = commands[name];
  if (!command) { console.log('Unknown command'); return; }
  await command.handler(args);
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Building interactive CLI tools that need extensible command sets
- Multi-agent systems where different subsystems contribute their own commands
- Developer tools that benefit from both structured commands and natural language input

❌ **Don't use for:**
- Simple single-purpose CLI scripts that only need `process.argv` parsing
- GUI applications where command dispatch is handled by UI frameworks

---

## Benefits

1. **Extensibility** — New command sources are merged via spread, no central file needs editing
2. **Self-documenting** — Each command carries its own description and usage, enabling auto-generated help
3. **Uniform dispatch** — Single `executeCommand` function handles all routing, error handling, and argument parsing
4. **Natural language bridge** — Non-command input falls through to AI-powered swarm mode, lowering the barrier to entry

---

## Related Patterns

- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that swarm mode invokes
- See `./slash-commands.md` for the base slash command definitions merged into this registry
- See `./slash-commands-extended.md` for the extended command set merged here
- See `../02-agent-system/agent-explanations.md` for the `/explain` and `/reasoning` command implementations

---

*Extracted: 2026-02-18*
