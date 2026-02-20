# Contributing to Nova26

Nova26 is a 21-agent AI-powered IDE/orchestrator built with TypeScript, Ollama, and Convex.

## Quick Start

```bash
npm install
npx tsc --noEmit        # Type check — must be 0 errors
npx vitest run           # Tests — must be 0 failures
```

## Adding a New Module

Every feature module follows the same structure. Use `src/model-routing/` as a reference.

### 1. Create the module directory

```
src/your-module/
  types.ts                     # Config interface + type exports
  your-core.ts                 # Main implementation
  lifecycle-adapter.ts         # Lifecycle hook factory
  index.ts                     # Barrel exports
  __tests__/
    your-core.test.ts          # Unit tests (25+ tests)
    lifecycle-adapter.test.ts  # Adapter tests
```

### 2. Define your config type

```typescript
// src/your-module/types.ts
export interface YourModuleConfig {
  enabled?: boolean;
  // module-specific options
}
```

### 3. Create the lifecycle adapter

The adapter factory returns handlers for Ralph Loop lifecycle phases:

```typescript
// src/your-module/lifecycle-adapter.ts
import type { YourModuleConfig } from './types.js';

export interface YourModuleLifecycleHooks {
  onBeforeBuild?: (context: unknown) => Promise<void>;
  onBeforeTask?: (context: unknown) => Promise<void>;
  onAfterTask?: (context: unknown) => Promise<void>;
  onTaskError?: (context: unknown) => Promise<void>;
  onHandoff?: (context: unknown) => Promise<void>;
  onBuildComplete?: (context: unknown) => Promise<void>;
}

export function createYourModuleLifecycleHooks(
  config: YourModuleConfig
): YourModuleLifecycleHooks {
  return {
    onBeforeBuild: async (context) => {
      // Initialize module state for this build
    },
    onAfterTask: async (context) => {
      // Process task results
    },
  };
}
```

### 4. Create barrel exports

```typescript
// src/your-module/index.ts
export { YourCore } from './your-core.js';
export { createYourModuleLifecycleHooks } from './lifecycle-adapter.js';
export type { YourModuleConfig } from './types.js';
```

### 5. Wire into RalphLoopOptions

Add your config to the central options interface:

```typescript
// src/orchestrator/ralph-loop-types.ts
import type { YourModuleConfig } from '../your-module/types.js';

export interface RalphLoopOptions {
  // ... existing fields
  yourModuleEnabled?: boolean;
  yourModuleConfig?: YourModuleConfig;
}
```

### 6. Wire into lifecycle hooks

Add your module to three maps in `src/orchestrator/lifecycle-wiring.ts`:

1. **`DEFAULT_FEATURE_HOOKS`** — define which phases your module hooks into and its priority (lower = runs first)
2. **`wireFeatureHooks()` featureFlags map** — map your feature flag key to the hook config key
3. **`getWiringSummary()` featureFlags map** — same mapping for the dry-run summary function

### 7. Write tests

Every module needs tests. Target 25+ tests covering:

- Happy path behavior
- Error handling and edge cases
- Config validation (defaults, missing fields)
- Lifecycle adapter integration

## Coding Standards

### TypeScript Strict Mode

- **No `any` type** — use `unknown` + type guards or proper interfaces
- **ESM imports everywhere** — `import from './foo.js'` (not `./foo` or `./foo.ts`)
- **Explicit return types** on exported functions
- Strict null checks enabled

### Testing

- **vitest** for all tests — `describe`, `it`, `expect`
- **`vi.clearAllMocks()`** in every `beforeEach` block
- **Mock all I/O** — no real network calls, file system, or database access in tests
- **`vi.mock()`** for external dependencies
- Test files go in `src/module/__tests__/name.test.ts` or co-located as `src/module/name.test.ts`

### File Organization

- One module per directory under `src/`
- Types in `types.ts`, implementation in descriptive files, barrel in `index.ts`
- Tests in `__tests__/` subdirectory or co-located `.test.ts` files

## Quality Gates

Run after **every** change:

```bash
npx tsc --noEmit        # 0 errors required
npx vitest run           # 0 failures required
```

Pre-commit hooks run these automatically via lint-staged.

## Commit Format

```
<type>(<scope>): <description>

Co-Authored-By: Your Name <email>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Examples:
- `feat(model-routing): add hardware-aware model selection`
- `test(orchestrator): add E2E build simulation tests`
- `docs(contributing): add module creation guide`

## Key Files

| File | Purpose |
|------|---------|
| `src/orchestrator/ralph-loop.ts` | Core execution loop |
| `src/orchestrator/ralph-loop-types.ts` | `RalphLoopOptions` — single source of truth for all config |
| `src/orchestrator/lifecycle-wiring.ts` | Maps feature flags to lifecycle hook registrations |
| `src/orchestrator/lifecycle-hooks.ts` | `HookRegistry` — phase-based hook execution engine |
| `src/agents/templates/` | 21 agent prompt templates (EARTH XML format) |
| `src/llm/structured-output.ts` | Zod schemas for agent outputs |

## Lifecycle Hook Phases

The Ralph Loop fires hooks at 6 phases, in order:

1. **`onBeforeBuild`** — build initialization (setup state, open connections)
2. **`onBeforeTask`** — before each task starts (route models, load context)
3. **`onAfterTask`** — after each task completes (store results, emit events)
4. **`onTaskError`** — when a task fails (debug, recover, log)
5. **`onHandoff`** — when work passes between agents (transfer context)
6. **`onBuildComplete`** — build finalization (generate reports, cleanup)

Hooks run in priority order (ascending) within each phase.

## Questions?

Open an issue for discussion before starting major work.
