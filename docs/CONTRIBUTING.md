# Contributing to NOVA26

We welcome contributions! NOVA26 is designed to be extensible. This guide covers how to add new agents, commands, skills, and models.

## Code Standards

- **Language**: TypeScript 5.x (Strict Mode).
- **Modules**: ESM (use `.js` extensions in imports).
- **Testing**: `vitest` for unit tests.
- **Validation**: `zod` for all schemas.

## 1. Adding a New Agent

Agents are defined by **Prompt Templates** and **Metadata**.

### Create the Template

Add `[AGENT_NAME].md` to `.nova/agents/`. Follow the standard XML-like structure:

```markdown
<agent>
  <name>VULCAN</name>
  <role>Infrastructure specialist</role>
  <domain>Terraform & Kubernetes</domain>
  ...
</agent>
```

### Register Metadata

Update `AGENT_METADATA` in `src/cli/slash-commands.ts`:

```typescript
'VULCAN': { emoji: '🔨', tier: 'balanced' },
```

### Define Hard Limits

Add defaults to `.nova/config/hard-limits.json` to prevent the agent from destructive actions (e.g., deleting production databases).

## 2. Adding a Slash Command

Slash commands are handled in `src/cli/slash-commands.ts`.

### Define the Command

```typescript
'/deploy': {
  name: '/deploy',
  description: 'Trigger deployment workflow',
  usage: '/deploy [env]',
  handler: async (args) => {
    // Your logic here
    console.log('Deploying to', args[0]);
  }
}
```

### Register
Add it to the `slashCommands` export.

### Test
Add a unit test in `src/cli/slash-commands.test.ts`.

## 3. Adding a New Model

To support a new LLM (e.g., Llama 4 or GPT-5):

### Update Router

Edit `src/llm/model-router.ts` and add to `AVAILABLE_MODELS`:

```typescript
{
  name: 'llama4:70b',
  provider: 'ollama',
  tier: 'free',
  contextWindow: 128000,
  costPer1KTokens: 0,
  speed: 'medium',
  quality: 'excellent',
  bestFor: ['complex reasoning']
}
```

### Update Fallbacks
Add the new model to `FALLBACK_CHAINS` if it should be part of the retry logic.

## 4. Adding a Quality Gate

Gates prevent bad code from progressing.

### Implement Gate Logic

Add a function to `src/orchestrator/gate-runner.ts`:

```typescript
export async function styleGate(content: string): Promise<GateResult> {
  // Check code style
  return { passed: true, message: 'Style OK' };
}
```

### Register
Add to the `runGates` function switch case.

## Pull Request Process

- **Branch Naming**: `feature/add-vulcan-agent` or `fix/router-bug`.
- **Commit Messages**: Use Conventional Commits (e.g., `feat: add VULCAN agent`).
- **Tests**: Run `npm test` before pushing.
- **Lint**: Run `npm run lint` (`tsc --noEmit`).
