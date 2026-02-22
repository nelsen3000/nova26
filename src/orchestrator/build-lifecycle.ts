// Build Lifecycle - GLM-02
// Encapsulates build-level start/complete logic extracted from ralph-loop.ts
// ralph-loop.ts delegates to this module so it remains a thin coordinator.

import { createEventStore, type EventStore } from './event-store.js';
import { buildMemoryContext } from '../memory/session-memory.js';
import { initWorkflow } from '../git/workflow.js';
import { createConvexSyncClient, type ConvexSyncClient } from '../convex/sync.js';
import { HookRegistry } from './lifecycle-hooks.js';
import { wireFeatureHooks } from './lifecycle-wiring.js';
import { wireAdaptersLive } from './adapter-wiring.js';
import { getTasteVault } from '../taste-vault/taste-vault.js';
import { getSelfImprovementProtocol } from '../agents/self-improvement.js';
import type { BuildContext, BuildResult } from './lifecycle-hooks.js';
import type { RalphLoopOptions } from './ralph-loop-types.js';
import type { PRD } from '../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface BuildStartResult {
  buildId: string;
  buildStartTime: number;
  hookRegistry: HookRegistry;
  convexClient: ConvexSyncClient | undefined;
  gitWf: ReturnType<typeof initWorkflow> | undefined;
  eventStore: EventStore | undefined;
}

export interface BuildCompleteOptions {
  buildId: string;
  buildStartTime: number;
  hookRegistry: HookRegistry;
  convexClient: ConvexSyncClient | undefined;
  gitWf: ReturnType<typeof initWorkflow> | undefined;
  eventStore: EventStore | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Build Lifecycle Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize all build-level systems and execute onBeforeBuild hooks.
 * Called once at the start of a ralph-loop execution.
 */
export async function startBuild(
  prd: PRD,
  prdPath: string,
  options?: RalphLoopOptions
): Promise<BuildStartResult> {
  // --- Initialize event store ---
  let eventStore: EventStore | undefined;
  if (options?.eventStore) {
    eventStore = createEventStore(prdPath);
    console.log(`Event store: session ${eventStore.getState().sessionId}`);
  }

  // --- Initialize session memory ---
  if (options?.sessionMemory) {
    const memoryCtx = buildMemoryContext(prd.meta.name);
    if (memoryCtx) {
      console.log('Session memory: loaded prior knowledge');
    }
  }

  // --- Initialize git workflow ---
  let gitWf: ReturnType<typeof initWorkflow> | undefined;
  if (options?.gitWorkflow) {
    gitWf = initWorkflow(prd.meta.name);
    console.log(`Git workflow: branch ${gitWf.branch}`);
  }

  // --- Initialize Convex sync client ---
  let convexClient: ConvexSyncClient | undefined;
  if (options?.convexSync) {
    convexClient = createConvexSyncClient({ enabled: true });
    if (convexClient.enabled) {
      await convexClient.startBuild(prd.meta.name);
      console.log(`Convex sync: build ${convexClient.buildId}`);
    }
  }

  // --- Initialize lifecycle hooks ---
  const hookRegistry = new HookRegistry();
  const buildId = crypto.randomUUID();
  const buildStartTime = Date.now();

  if (options) {
    // Wire R16/R17 feature stubs
    const featureResult = wireFeatureHooks(hookRegistry, options);
    if (featureResult.wiredCount > 0) {
      console.log(`Lifecycle hooks: ${featureResult.wiredCount} features wired (${featureResult.totalHooks} hooks)`);
    }

    // Wire R22-R24 real adapters
    const adapterResult = wireAdaptersLive(hookRegistry, options);
    if (adapterResult.wiredCount > 0) {
      console.log(`Live adapters: ${adapterResult.wiredCount} modules wired (${adapterResult.totalHooks} hooks)`);
    }
    for (const err of adapterResult.errors) {
      console.error(`  Adapter wiring error [${err.module}]: ${err.error}`);
    }
  }

  // --- Execute onBeforeBuild hooks ---
  const buildContext: BuildContext = {
    buildId,
    prdId: prd.meta.name,
    prdName: prd.meta.name,
    startedAt: new Date().toISOString(),
    options: (options ?? {}) as Record<string, unknown>,
  };
  await hookRegistry.executePhase('onBeforeBuild', buildContext);

  return { buildId, buildStartTime, hookRegistry, convexClient, gitWf, eventStore };
}

/**
 * Finalize the build: flush hooks, complete Convex sync, git PR, Taste Vault, ACE.
 * Called once at the end of a ralph-loop execution.
 */
export async function completeBuild(
  prd: PRD,
  ctx: BuildCompleteOptions
): Promise<void> {
  const { buildId, buildStartTime, hookRegistry, convexClient, gitWf, eventStore } = ctx;
  const allDone = prd.tasks.every(t => t.status === 'done');

  // Event store: session end
  eventStore?.emit('session_end', {
    success: allDone,
    tasksCompleted: prd.tasks.filter(t => t.status === 'done').length,
  });

  // Convex sync: complete build
  await convexClient?.completeBuild(allDone);

  // Execute onBuildComplete hooks
  const buildResult: BuildResult = {
    buildId,
    prdId: prd.meta.name,
    totalTasks: prd.tasks.length,
    successfulTasks: prd.tasks.filter(t => t.status === 'done').length,
    failedTasks: prd.tasks.filter(t => t.status === 'failed').length,
    totalDurationMs: Date.now() - buildStartTime,
    averageAceScore: 0,
  };
  await hookRegistry.executePhase('onBuildComplete', buildResult);

  // Git workflow: finalize (create PR if all tasks done)
  if (gitWf && allDone) {
    const taskSummary = prd.tasks.map(t => `${t.agent}: ${t.title}`);
    const prUrl = gitWf.finalize(taskSummary);
    if (prUrl) console.log(`\nPR created: ${prUrl}`);
  }

  console.log('\n=== Ralph Loop finished ===');

  // Log taste vault wisdom impact (best-effort)
  try {
    const vault = getTasteVault();
    const summary = vault.summary();
    console.log(
      `Taste Vault: ${summary.nodeCount} nodes, ${summary.edgeCount} edges, avg confidence: ${summary.avgConfidence.toFixed(2)}`
    );
  } catch {
    // Vault unavailable — skip silently
  }

  // ACE: run self-improvement reviews for all agents (best-effort)
  try {
    const protocol = getSelfImprovementProtocol();
    const uniqueAgents = new Set(prd.tasks.map(t => t.agent));
    for (const agentName of uniqueAgents) {
      const profile = await protocol.getProfile(agentName);
      if (profile.totalTasks >= 5) {
        const review = await protocol.runReview(agentName);
        if (review.rulesAdded > 0 || review.rulesModified > 0) {
          console.log(`  ACE Self-Improvement [${agentName}]: ${review.reviewSummary}`);
        }
      }
    }
  } catch {
    // Self-improvement unavailable — skip silently
  }
}
