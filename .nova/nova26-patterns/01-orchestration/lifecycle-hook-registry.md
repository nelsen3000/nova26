# Lifecycle Hook Registry

## Source
Extracted from Nova26 `src/orchestrator/lifecycle-hooks.ts`

---

## Pattern: Lifecycle Hook Registry

The HookRegistry is a priority-ordered, error-isolated hook system that lets feature modules tap into 6 lifecycle phases of the Ralph Loop: onBeforeBuild, onBeforeTask, onAfterTask, onTaskError, onHandoff, and onBuildComplete. Hooks are sorted by priority (lower number = runs first, default 100), and individual hook failures are logged but never crash the build. The registry is exposed as a lazy-initialized singleton with a reset function for testing.

---

## Implementation

### Code Example

```typescript
import type { HookPhase, LifecycleHook } from './lifecycle-hooks.js';

// 6 lifecycle phases
export type HookPhase =
  | 'onBeforeBuild'
  | 'onBeforeTask'
  | 'onAfterTask'
  | 'onTaskError'
  | 'onHandoff'
  | 'onBuildComplete';

export interface LifecycleHook {
  id: string;
  phase: HookPhase;
  moduleName: string;
  priority: number; // Lower = runs first. Default 100.
  handler: (context: unknown) => Promise<void>;
}

export class HookRegistry {
  private hooks: LifecycleHook[] = [];

  register(hook: Omit<LifecycleHook, 'id'>): string {
    const id = crypto.randomUUID();
    const newHook: LifecycleHook = { ...hook, id };
    this.hooks.push(newHook);
    return id;
  }

  unregister(hookId: string): boolean {
    const index = this.hooks.findIndex(h => h.id === hookId);
    if (index >= 0) {
      this.hooks.splice(index, 1);
      return true;
    }
    return false;
  }

  getHooksForPhase(phase: HookPhase): LifecycleHook[] {
    return this.hooks
      .filter(h => h.phase === phase)
      .sort((a, b) => a.priority - b.priority);
  }

  async executePhase(phase: HookPhase, context: unknown): Promise<void> {
    const hooks = this.getHooksForPhase(phase);
    for (const hook of hooks) {
      try {
        await hook.handler(context);
      } catch (error) {
        // Log error but don't crash the build
        console.error(`[lifecycle] Hook ${hook.id} (${hook.moduleName}) failed in ${phase}:`, error);
      }
    }
  }

  getRegisteredModules(): string[] {
    const modules = new Set(this.hooks.map(h => h.moduleName));
    return Array.from(modules);
  }

  clear(): void {
    this.hooks = [];
  }

  getHookCount(): number {
    return this.hooks.length;
  }
}
```

```typescript
// Singleton instance with reset for testing
let globalRegistry: HookRegistry | null = null;

export function getGlobalHookRegistry(): HookRegistry {
  if (!globalRegistry) {
    globalRegistry = new HookRegistry();
  }
  return globalRegistry;
}

export function resetGlobalHookRegistry(): void {
  globalRegistry = null;
}
```

```typescript
// Typed context interfaces for each phase
export interface BuildContext {
  buildId: string;
  prdId: string;
  prdName: string;
  startedAt: string;
  options: Record<string, unknown>;
}

export interface TaskContext {
  taskId: string;
  title: string;
  agentName: string;
  dependencies: string[];
}

export interface TaskResult {
  taskId: string;
  agentName: string;
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
  aceScore?: number;
}

export interface HandoffContext {
  fromAgent: string;
  toAgent: string;
  taskId: string;
  payload: Record<string, unknown>;
}

export interface BuildResult {
  buildId: string;
  prdId: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  totalDurationMs: number;
  averageAceScore: number;
}
```

```typescript
// Lazy-loaded Zod schema validation for context objects
let zodModule: typeof import('zod') | null = null;

async function getZod(): Promise<typeof import('zod')> {
  if (!zodModule) {
    zodModule = await import('zod');
  }
  return zodModule;
}

export async function createBuildContextSchema() {
  const z = await getZod();
  return z.object({
    buildId: z.string(),
    prdId: z.string(),
    prdName: z.string(),
    startedAt: z.string(),
    options: z.record(z.unknown()),
  });
}
```

### Key Concepts

- 6 lifecycle phases spanning the full build lifecycle: before/after build, before/after task, error handling, and agent handoff
- Priority-based ordering: hooks with lower priority numbers execute first (default 100)
- Error isolation: try/catch around every handler so one failing hook never takes down the build
- Singleton pattern with `resetGlobalHookRegistry()` for clean test teardown
- Lazy-loaded Zod: schemas are only imported when validation is actually needed, keeping the module lightweight
- Typed context interfaces: each phase receives a purpose-built context object (BuildContext, TaskContext, TaskResult, HandoffContext, BuildResult)

---

## Anti-Patterns

### Don't Do This

```typescript
// No error isolation — one broken hook crashes the entire build
async executePhase(phase: HookPhase, context: unknown): Promise<void> {
  const hooks = this.getHooksForPhase(phase);
  for (const hook of hooks) {
    await hook.handler(context); // Throws and kills the loop
  }
}

// No priority sorting — hooks run in registration order
getHooksForPhase(phase: HookPhase): LifecycleHook[] {
  return this.hooks.filter(h => h.phase === phase);
  // Missing: .sort((a, b) => a.priority - b.priority)
}

// Eager Zod import — pays the cost even when validation is never used
import { z } from 'zod'; // Loaded on module init regardless
export const BuildContextSchema = z.object({ ... });

// No singleton reset — test pollution between test suites
const globalRegistry = new HookRegistry(); // No way to reset
export { globalRegistry };
```

### Do This Instead

```typescript
// Error-isolated execution — logs failures, keeps running
async executePhase(phase: HookPhase, context: unknown): Promise<void> {
  const hooks = this.getHooksForPhase(phase);
  for (const hook of hooks) {
    try {
      await hook.handler(context);
    } catch (error) {
      console.error(`[lifecycle] Hook ${hook.id} (${hook.moduleName}) failed in ${phase}:`, error);
    }
  }
}

// Priority-sorted retrieval
getHooksForPhase(phase: HookPhase): LifecycleHook[] {
  return this.hooks
    .filter(h => h.phase === phase)
    .sort((a, b) => a.priority - b.priority);
}

// Lazy-loaded Zod with singleton caching
let zodModule: typeof import('zod') | null = null;
async function getZod() {
  if (!zodModule) zodModule = await import('zod');
  return zodModule;
}

// Resettable singleton for test isolation
let globalRegistry: HookRegistry | null = null;
export function getGlobalHookRegistry(): HookRegistry {
  if (!globalRegistry) globalRegistry = new HookRegistry();
  return globalRegistry;
}
export function resetGlobalHookRegistry(): void {
  globalRegistry = null;
}
```

---

## When to Use This Pattern

**Use for:**
- Any orchestration system with multiple feature modules that need to react to lifecycle events
- Systems where hook failures must be tolerated (build reliability over feature completeness)
- Pipelines that require deterministic execution ordering across independently registered modules

**Don't use for:**
- Simple event emitters where priority ordering is unnecessary
- Cases where a hook failure should halt execution (use a gate pipeline instead)

---

## Benefits

1. Build resilience -- individual hook failures are logged but never crash the orchestrator
2. Deterministic ordering -- priority numbers guarantee environment setup (10) runs before dependency checks (100)
3. Test-friendly -- singleton reset function prevents cross-test contamination
4. Lightweight by default -- Zod schemas are lazy-loaded, so the module stays fast when validation is not needed
5. Self-documenting -- `getRegisteredModules()` and `getHookCount()` provide runtime introspection

---

## Related Patterns

- See `feature-lifecycle-wiring.md` for the configuration-driven system that registers feature hooks into this registry
- See `ralph-loop-execution.md` for the main execution loop that calls `executePhase()` at each lifecycle point
- See `gate-runner-pipeline.md` for the fail-fast gate pattern (contrast: gates halt on failure, hooks do not)
- See `event-store.md` for the event-sourced session log that hooks can write to

---

*Extracted: 2026-02-19*
