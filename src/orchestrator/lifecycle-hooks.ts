// RalphLoop Lifecycle Hooks System
// KIMI-W-02: Lifecycle Hooks + HookRegistry

// ============================================================================
// Core Context Types
// ============================================================================

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

// ============================================================================
// Hook Types
// ============================================================================

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

export interface RalphLoopLifecycle {
  onBeforeBuild: ((context: BuildContext) => Promise<void>)[];
  onBeforeTask: ((context: TaskContext) => Promise<void>)[];
  onAfterTask: ((context: TaskResult) => Promise<void>)[];
  onTaskError: ((context: TaskResult) => Promise<void>)[];
  onHandoff: ((context: HandoffContext) => Promise<void>)[];
  onBuildComplete: ((context: BuildResult) => Promise<void>)[];
}

// ============================================================================
// Zod Schemas (lazy loaded)
// ============================================================================

let zodModule: typeof import('zod') | null = null;

async function getZod(): Promise<typeof import('zod')> {
  if (!zodModule) {
    try {
      zodModule = await import('zod');
    } catch {
      throw new Error('zod is required for schema validation');
    }
  }
  return zodModule;
}

// Export schema creators (async to allow lazy zod loading)
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

export async function createTaskContextSchema() {
  const z = await getZod();
  return z.object({
    taskId: z.string(),
    title: z.string(),
    agentName: z.string(),
    dependencies: z.array(z.string()),
  });
}

export async function createTaskResultSchema() {
  const z = await getZod();
  return z.object({
    taskId: z.string(),
    agentName: z.string(),
    success: z.boolean(),
    output: z.string().optional(),
    error: z.string().optional(),
    durationMs: z.number(),
    aceScore: z.number().optional(),
  });
}

export async function createHandoffContextSchema() {
  const z = await getZod();
  return z.object({
    fromAgent: z.string(),
    toAgent: z.string(),
    taskId: z.string(),
    payload: z.record(z.unknown()),
  });
}

export async function createBuildResultSchema() {
  const z = await getZod();
  return z.object({
    buildId: z.string(),
    prdId: z.string(),
    totalTasks: z.number(),
    successfulTasks: z.number(),
    failedTasks: z.number(),
    totalDurationMs: z.number(),
    averageAceScore: z.number(),
  });
}

export async function createLifecycleHookSchema() {
  const z = await getZod();
  return z.object({
    id: z.string(),
    phase: z.enum(['onBeforeBuild', 'onBeforeTask', 'onAfterTask', 'onTaskError', 'onHandoff', 'onBuildComplete']),
    moduleName: z.string(),
    priority: z.number(),
    handler: z.function().args(z.unknown()).returns(z.promise(z.void())),
  });
}

// ============================================================================
// HookRegistry Class
// ============================================================================

export class HookRegistry {
  private hooks: LifecycleHook[] = [];

  /**
   * Register a new hook
   * @param hook - Hook definition (without id)
   * @returns The generated hook ID
   */
  register(hook: Omit<LifecycleHook, 'id'>): string {
    const id = crypto.randomUUID();
    const newHook: LifecycleHook = { ...hook, id };
    this.hooks.push(newHook);
    return id;
  }

  /**
   * Unregister a hook by ID
   * @param hookId - The hook ID to remove
   * @returns True if removed, false if not found
   */
  unregister(hookId: string): boolean {
    const index = this.hooks.findIndex(h => h.id === hookId);
    if (index >= 0) {
      this.hooks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all hooks for a specific phase, sorted by priority
   * @param phase - The lifecycle phase
   * @returns Sorted array of hooks
   */
  getHooksForPhase(phase: HookPhase): LifecycleHook[] {
    return this.hooks
      .filter(h => h.phase === phase)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute all hooks for a phase
   * @param phase - The lifecycle phase to execute
   * @param context - Context data passed to hooks
   */
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

  /**
   * Get list of unique module names that have registered hooks
   * @returns Array of module names
   */
  getRegisteredModules(): string[] {
    const modules = new Set(this.hooks.map(h => h.moduleName));
    return Array.from(modules);
  }

  /**
   * Clear all registered hooks
   */
  clear(): void {
    this.hooks = [];
  }

  /**
   * Get total number of registered hooks
   */
  getHookCount(): number {
    return this.hooks.length;
  }

  /**
   * Get all registered hooks
   */
  getAllHooks(): LifecycleHook[] {
    return [...this.hooks];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

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
