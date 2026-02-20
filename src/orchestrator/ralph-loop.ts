// Ralph Loop - Core execution loop

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { pickNextTask, promotePendingTasks, updateTaskStatus, savePRD, setTaskOutput } from './task-picker.js';
import { buildPrompt, buildRetryPrompt } from './prompt-builder.js';
import { runGates, allGatesPassed, getGatesSummary } from './gate-runner.js';
import { runCouncilVote, requiresCouncilApproval } from './council-runner.js';
import { callLLM, type LLMCaller } from '../llm/ollama-client.js';
import { callLLMWithSchema, hasAgentSchema } from '../llm/structured-output.js';
import { getTracer } from '../observability/index.js';
import { ParallelRunner, getIndependentTasks } from './parallel-runner.js';
import { createEventStore, type EventStore } from './event-store.js';
import { buildMemoryContext, learnFromTask, learnFromFailure } from '../memory/session-memory.js';
import { initWorkflow } from '../git/workflow.js';
import { recordCost, checkBudgetAlerts, getTodaySpending } from '../cost/cost-tracker.js';
import { recordTaskResult } from '../analytics/agent-analytics.js';
import { createConvexSyncClient, type ConvexSyncClient } from '../convex/sync.js';
import type { PRD, Task, LLMResponse, TodoItem, PlanningPhase } from '../types/index.js';
import { AgentLoop, type AgentLoopResult } from '../agent-loop/agent-loop.js';
import { getToolRegistry, type ToolExecution } from '../tools/tool-registry.js';
import type { AutonomyLevel } from '../config/autonomy.js';
import { getTasteVault } from '../taste-vault/taste-vault.js';
import { getInjectedVaultNodeIds, clearInjectedVaultNodeIds, getInjectedPlaybookRuleIds, clearInjectedPlaybookRuleIds } from './prompt-builder.js';
import { getPlaybookManager } from '../ace/playbook.js';
import { getAceReflector } from '../ace/reflector.js';
import { getAceCurator } from '../ace/curator.js';
import { getSelfImprovementProtocol } from '../agents/self-improvement.js';
import { getRehearsalStage } from '../rehearsal/stage.js';
import type { RehearsalSession } from '../rehearsal/stage.js';
// RalphLoopOptions — single source of truth is ralph-loop-types.ts
import type { RalphLoopOptions } from './ralph-loop-types.js';
export type { RalphLoopOptions };

// --- Planning phases (pre-execution plan approval) ---

export const PLANNING_PHASES: PlanningPhase[] = [
  { name: 'UNDERSTAND', actions: ['Read task description', 'Identify dependencies', 'Check prior outputs'], exitCriteria: 'Task requirements are clear' },
  { name: 'CLARIFY', actions: ['List unknowns', 'Check codebase context', 'Review constraints'], exitCriteria: 'No open questions remain' },
  { name: 'PLAN', actions: ['Outline approach', 'Identify files to change', 'Estimate scope'], exitCriteria: 'Step-by-step plan written' },
  { name: 'APPROVE', actions: ['Present plan to user'], exitCriteria: 'User approves plan' },
  { name: 'EXECUTE', actions: ['Generate code/output following plan'], exitCriteria: 'All plan steps completed' },
  { name: 'VERIFY', actions: ['Run gates', 'Run tests', 'Self-check'], exitCriteria: 'All checks pass' },
  { name: 'DELIVER', actions: ['Save output', 'Update PRD', 'Commit if enabled'], exitCriteria: 'Output saved and task marked done' },
];

/**
 * Build a planning prompt that asks the LLM to produce a plan before execution
 */
function buildPlanPrompt(task: Task, prd: PRD): string {
  const depOutputs = task.dependencies
    .map(depId => prd.tasks.find(t => t.id === depId))
    .filter((t): t is Task => t !== null && t !== undefined && t.status === 'done' && !!t.output)
    .map(t => `[${t.id}] ${t.title}: ${t.output}`)
    .join('\n');

  return `Before implementing, create a step-by-step plan for this task.

Task: ${task.title}
Agent: ${task.agent}
Description: ${task.description}

${depOutputs ? `Dependency outputs:\n${depOutputs}\n` : ''}
Output a numbered plan with:
1. What files/code to create or modify
2. Key decisions and trade-offs
3. How to verify correctness

Format: Return ONLY the plan as a numbered list. Do NOT generate code yet.`;
}

// --- Auto test→fix→retest loop ---

interface TestResult {
  passed: boolean;
  errors: string[];
  command: string;
}

/**
 * Run TypeScript type-check on the project
 */
function runTypeCheck(): TestResult {
  try {
    execSync('npx tsc --noEmit 2>&1', {
      encoding: 'utf-8',
      timeout: 60000,
      cwd: process.cwd(),
    });
    return { passed: true, errors: [], command: 'tsc --noEmit' };
  } catch (error: any) {
    const output = error.stdout || error.message || '';
    const errors = output
      .split('\n')
      .filter((line: string) => line.includes('error TS'))
      .slice(0, 10); // Cap at 10 errors for prompt size
    return { passed: false, errors, command: 'tsc --noEmit' };
  }
}

/**
 * Run test suite (vitest or jest)
 */
function runTests(): TestResult {
  const hasVitest = existsSync(join(process.cwd(), 'node_modules', '.bin', 'vitest'));
  const cmd = hasVitest ? 'npx vitest run --reporter=verbose 2>&1' : 'npx jest --ci 2>&1';

  try {
    execSync(cmd, { encoding: 'utf-8', timeout: 120000, cwd: process.cwd() });
    return { passed: true, errors: [], command: cmd };
  } catch (error: any) {
    const output = error.stdout || error.message || '';
    const errors = output
      .split('\n')
      .filter((line: string) => /FAIL|Error|AssertionError|expected|received/i.test(line))
      .slice(0, 15);
    return { passed: false, errors, command: cmd };
  }
}

/**
 * Build a fix prompt from test failures
 */
function buildTestFixPrompt(task: Task, originalResponse: string, testResults: TestResult[]): string {
  const failureDetails = testResults
    .filter(r => !r.passed)
    .map(r => `Command: ${r.command}\nErrors:\n${r.errors.join('\n')}`)
    .join('\n\n');

  return `Your previous output for task "${task.title}" produced test failures.

## Your Previous Output (excerpt)
${originalResponse.substring(0, 2000)}

## Test Failures
${failureDetails}

Fix the issues and regenerate the complete output. The output must pass both type-checking and tests.`;
}

/**
 * Run the test→fix→retest cycle
 * Returns the final (passing) response, or the last response if retries exhausted
 */
async function testFixLoop(
  task: Task,
  response: LLMResponse,
  systemPrompt: string,
  llmCaller: LLMCaller | undefined,
  useStructuredOutput: boolean,
  maxRetries: number
): Promise<LLMResponse> {
  // Only run for code-producing agents
  const codeAgents = ['MARS', 'VENUS', 'PLUTO', 'GANYMEDE', 'IO', 'TRITON'];
  if (!codeAgents.includes(task.agent)) return response;

  let currentResponse = response;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const typeCheck = runTypeCheck();
    const testRun = runTests();

    if (typeCheck.passed && testRun.passed) {
      if (attempt > 0) {
        console.log(`Test→fix loop: passed after ${attempt} fix(es)`);
      }
      return currentResponse;
    }

    const failures = [typeCheck, testRun].filter(r => !r.passed);
    console.log(`Test→fix loop (attempt ${attempt + 1}/${maxRetries}): ${failures.length} failure(s)`);

    const fixPrompt = buildTestFixPrompt(task, currentResponse.content, [typeCheck, testRun]);

    try {
      if (useStructuredOutput && hasAgentSchema(task.agent)) {
        currentResponse = await callLLMWithSchema(systemPrompt, fixPrompt, task.agent);
      } else if (llmCaller) {
        currentResponse = await llmCaller(systemPrompt, fixPrompt, task.agent);
      } else {
        currentResponse = await callLLM(systemPrompt, fixPrompt, task.agent);
      }
    } catch {
      console.log('Test→fix loop: LLM call failed during fix attempt, using last response');
      return currentResponse;
    }
  }

  console.log('Test→fix loop: max retries exhausted');
  return currentResponse;
}

export async function ralphLoop(
  prd: PRD,
  prdPath: string,
  llmCaller?: LLMCaller,
  options?: RalphLoopOptions
): Promise<void> {
  // Initialize tracer
  const tracer = getTracer();
  const sessionId = tracer.startSession(prd.meta.name);
  
  // Initialize parallel runner
  const parallelRunner = new ParallelRunner({ concurrency: options?.concurrency || 4 });
  const parallelMode = options?.parallelMode || false;
  
  // Use provided LLM caller, or structured output if available, or default callLLM
  const useStructuredOutput = !llmCaller && prd.tasks.some(t => hasAgentSchema(t.agent));
  console.log('Starting Ralph Loop...');
  console.log(useStructuredOutput ? 'Using structured output for supported agents' : 'Using standard LLM calls');
  console.log(parallelMode ? 'Parallel mode enabled' : 'Sequential mode');

  // --- Initialize event store (durable session logging) ---
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

  // --- Initialize Convex sync client (MEGA-04) ---
  let convexClient: ConvexSyncClient | undefined;
  if (options?.convexSync) {
    convexClient = createConvexSyncClient({ enabled: true });
    if (convexClient.enabled) {
      await convexClient.startBuild(prd.meta.name);
      console.log(`Convex sync: build ${convexClient.buildId}`);
    }
  }

  let maxIterations = prd.tasks.length * 3; // Prevent infinite loops
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    
    // Get all ready tasks
    const readyTasks = prd.tasks.filter(t => t.status === 'ready');
    
    if (readyTasks.length === 0) {
      console.log('\nNo more ready tasks. Checking status...');
      
      // Check if all tasks are done
      const allDone = prd.tasks.every(t => t.status === 'done');
      const anyFailed = prd.tasks.some(t => t.status === 'failed');
      const anyRunning = prd.tasks.some(t => t.status === 'running');
      
      if (allDone) {
        console.log('\n=== All tasks completed successfully! ===');
        break;
      }
      
      if (anyFailed) {
        console.log('\n=== Some tasks failed ===');
        break;
      }
      
      if (anyRunning) {
        console.log('\nTasks still running...');
        await sleep(2000);
        continue;
      }
      
      // Check for blocked tasks
      const blocked = prd.tasks.filter(t => t.status === 'pending').filter(t => {
        return !t.dependencies.every(depId => {
          const dep = prd.tasks.find(d => d.id === depId);
          return dep?.status === 'done';
        });
      });
      
      if (blocked.length > 0) {
        console.log(`\n=== ${blocked.length} tasks blocked by dependencies ===`);
        for (const t of blocked) {
          const deps = t.dependencies.map(depId => {
            const dep = prd.tasks.find(d => d.id === depId);
            return `${depId} (${dep?.status})`;
          }).join(', ');
          console.log(`  - ${t.id}: waiting on ${deps}`);
        }
        break;
      }
      
      console.log('\n=== No more tasks to process ===');
      break;
    }
    
    // In parallel mode, try to run independent tasks together
    if (parallelMode && readyTasks.length > 1) {
      const independentTasks = getIndependentTasks(readyTasks);
      
      if (independentTasks.length > 1) {
        console.log(`\n--- Running ${independentTasks.length} tasks in parallel ---`);
        
        // Process tasks in parallel
        const taskResults = await parallelRunner.runPhase(independentTasks, async (task) => {
          await processTask(task, prd, prdPath, llmCaller, useStructuredOutput, tracer, sessionId, options, eventStore, gitWf, convexClient);
        });
        
        // Check results and promote tasks
        for (const result of taskResults) {
          if (result.status === 'completed') {
            promotePendingTasks(prd);
            savePRD(prd, prdPath);
          }
        }
        
        continue;
      }
    }
    
    // Sequential: use helper function
    const task = pickNextTask(prd);
    
    if (!task) {
      continue;
    }
    
    console.log(`\n--- Processing: ${task.id} (${task.title}) [Phase ${task.phase}] ---`);
    
    try {
      await processTask(task, prd, prdPath, llmCaller, useStructuredOutput, tracer, sessionId, options, eventStore, gitWf, convexClient);

      // Promote pending tasks after each task completes
      promotePendingTasks(prd);
      savePRD(prd, prdPath);
    } catch (error: any) {
      // Error already handled in processTask
      console.error(`Task ${task.id} failed: ${error.message}`);
    }
  }
  
  // Flush tracer before exiting
  await tracer.flush();

  // Event store: session end
  const allDone = prd.tasks.every(t => t.status === 'done');
  eventStore?.emit('session_end', { success: allDone, tasksCompleted: prd.tasks.filter(t => t.status === 'done').length });

  // Convex sync: complete build at session end (MEGA-04)
  await convexClient?.completeBuild(allDone);

  // Git workflow: finalize (create PR if all tasks done)
  if (gitWf && allDone) {
    const taskSummary = prd.tasks.map(t => `${t.agent}: ${t.title}`);
    const prUrl = gitWf.finalize(taskSummary);
    if (prUrl) console.log(`\nPR created: ${prUrl}`);
  }

  console.log('\n=== Ralph Loop finished ===');
  
  // Log taste vault wisdom impact
  try {
    const vault = getTasteVault();
    const summary = vault.summary();
    console.log(`Taste Vault: ${summary.nodeCount} nodes, ${summary.edgeCount} edges, avg confidence: ${summary.avgConfidence.toFixed(2)}`);
  } catch {
    // Vault unavailable — skip silently
  }
  
  // ACE: run self-improvement reviews for all agents that have enough task history
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

async function saveTaskOutput(task: Task, response: LLMResponse): Promise<string> {
  const outputDir = join(process.cwd(), '.nova', 'output');
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = join(outputDir, `${task.id}.md`);
  
  const header = `# Output: ${task.title}
**Task ID:** ${task.id}
**Agent:** ${task.agent}
**Model:** ${response.model}
**Completed:** ${new Date().toISOString()}
**Gates:** all passed

---

${response.content}
`;
  
  writeFileSync(outputPath, header);
  
  return outputPath;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines if agentic mode should be used for this agent and options
 */
function shouldUseAgenticMode(agent: string, options: RalphLoopOptions | undefined): boolean {
  if (!options) return false;
  
  const autonomyLevel = options.autonomyLevel ?? 3;
  const toolsAvailable = getToolRegistry().listForAgent(agent).length > 0;
  
  if (!toolsAvailable) return false;
  if (options.agenticMode === false) return false;
  if (options.agenticMode === true) return true;
  
  // Default: use agentic mode for autonomy level >= 3
  return autonomyLevel >= 3;
}

/**
 * Get AgentLoop configuration based on autonomy level
 */
function getAgentLoopConfig(autonomyLevel: AutonomyLevel = 3): Partial<import('../agent-loop/agent-loop.js').AgentLoopConfig> {
  const baseConfig = {
    maxTurns: 8,
    confidenceThreshold: 0.85,
    tokenBudget: 50000,
    enableTools: true,
  };
  
  switch (autonomyLevel) {
    case 1: // Manual - minimal automation
      return { ...baseConfig, maxTurns: 3, enableTools: false };
    case 2: // Guided - limited tool use
      return { ...baseConfig, maxTurns: 5, confidenceThreshold: 0.9 };
    case 3: // Balanced - default
      return baseConfig;
    case 4: // Autonomous - more aggressive
      return { ...baseConfig, maxTurns: 12, confidenceThreshold: 0.8 };
    case 5: // Full Auto - maximum
      return { ...baseConfig, maxTurns: 20, confidenceThreshold: 0.75, tokenBudget: 100000 };
    default:
      return baseConfig;
  }
}

/**
 * Record tool usage to analytics and event store
 */
function recordToolUsage(
  agent: string,
  taskId: string,
  executions: ToolExecution[],
  eventStore?: EventStore
): void {
  if (executions.length === 0) return;
  
  // Log each tool execution
  for (const exec of executions) {
    const { call, result } = exec;
    
    // Log to EventStore (using checkpoint for custom events)
    eventStore?.emit('checkpoint', {
      description: `Tool execution: ${call.name}`,
      toolName: call.name,
      success: result.success,
      duration: result.duration,
      error: result.error,
    }, taskId, agent);
    
    // Log tool usage summary
    console.log(`  Tool: ${call.name} ${result.success ? '✓' : '✗'} (${result.duration}ms)`);
  }
  
  // Log summary
  const successCount = executions.filter(e => e.result.success).length;
  console.log(`Tool usage: ${successCount}/${executions.length} successful`);
}

/**
 * Process a single task - extracted for parallel execution support
 */
/**
 * Determines if a task needs TodoWrite tracking based on complexity
 */
function shouldCreateTodos(task: Task): boolean {
  // Create todos for complex tasks
  return (
    task.description.length > 200 ||  // Complex description
    task.title.toLowerCase().includes('implement') ||
    task.title.toLowerCase().includes('create') ||
    task.agent === 'JUPITER' ||  // Architecture decisions need tracking
    task.agent === 'MARS' ||     // Backend implementations need tracking
    task.agent === 'VENUS'       // Frontend components need tracking
  );
}

/**
 * Creates initial todos for a task
 */
function createInitialTodos(task: Task): TodoItem[] {
  const todos: TodoItem[] = [];
  
  // Phase 1: Understanding/Planning (for complex tasks)
  if (shouldCreateTodos(task)) {
    todos.push({
      id: `${task.id}-todo-1`,
      content: 'Analyze requirements and dependencies',
      activeForm: 'Analyzing requirements and dependencies',
      status: 'pending',
      agent: task.agent,
      createdAt: new Date().toISOString(),
      verificationCriteria: ['All dependencies read', 'Requirements understood']
    });
  }
  
  // Phase 2: Implementation
  todos.push({
    id: `${task.id}-todo-2`,
    content: `Implement ${task.agent} deliverable`,
    activeForm: `Implementing ${task.agent} deliverable`,
    status: 'pending',
    agent: task.agent,
    createdAt: new Date().toISOString(),
    verificationCriteria: getVerificationCriteria(task.agent)
  });
  
  // Phase 3: Verification (mandatory)
  todos.push({
    id: `${task.id}-todo-3`,
    content: 'Verify deliverables against requirements',
    activeForm: 'Verifying deliverables against requirements',
    status: 'pending',
    agent: task.agent,
    createdAt: new Date().toISOString(),
    verificationCriteria: ['All acceptance criteria met', 'Quality gates pass']
  });
  
  return todos;
}

/**
 * Get verification criteria based on agent type
 */
function getVerificationCriteria(agent: string): string[] {
  const criteria: Record<string, string[]> = {
    'VENUS': [
      'All 5 UI states implemented',
      'Mobile-first responsive design',
      'Accessibility requirements met'
    ],
    'MARS': [
      'No TypeScript any types',
      'All mutations authenticate first',
      'Chip math uses Math.floor()'
    ],
    'PLUTO': [
      'All tables have validators',
      'Indexes defined for queries',
      'Schema compiles without errors'
    ],
    'EARTH': [
      'Fields section complete',
      'Constraints documented',
      'Validation rules specified'
    ],
    'JUPITER': [
      'At least 3 alternatives considered',
      'Trade-offs documented',
      'Related ADRs referenced'
    ],
    'MERCURY': [
      'All criteria validated',
      'PASS/FAIL verdict clear'
    ]
  };
  
  return criteria[agent] || ['Output meets requirements'];
}

/**
 * Update todo status ensuring exactly one in_progress at a time
 */
function updateTodoStatus(
  task: Task,
  todoId: string,
  newStatus: TodoItem['status']
): void {
  if (!task.todos) return;
  
  // If marking as in_progress, mark any other in_progress as completed
  if (newStatus === 'in_progress') {
    for (const todo of task.todos) {
      if (todo.status === 'in_progress' && todo.id !== todoId) {
        todo.status = 'completed';
        todo.completedAt = new Date().toISOString();
      }
    }
    task.currentTodoId = todoId;
  }
  
  // Update the target todo
  const todo = task.todos.find(t => t.id === todoId);
  if (todo) {
    todo.status = newStatus;
    if (newStatus === 'completed') {
      todo.completedAt = new Date().toISOString();
    }
  }
}

/**
 * Format todos for display
 */
function formatTodos(task: Task): string {
  if (!task.todos || task.todos.length === 0) return '';
  
  const lines = ['\n📋 Task Progress:'];
  for (const todo of task.todos) {
    const icon = todo.status === 'completed' ? '✅' : 
                 todo.status === 'in_progress' ? '▶️' : '⏳';
    const statusText = todo.status === 'in_progress' ? 
      `${todo.activeForm}...` : todo.content;
    lines.push(`  ${icon} ${statusText}`);
  }
  return lines.join('\n');
}

// --- Shared failure handler for processTask() failure paths ---

interface TaskFailureParams {
  task: Task;
  prd: PRD;
  prdPath: string;
  response: LLMResponse;
  tracer: ReturnType<typeof getTracer>;
  trace: ReturnType<ReturnType<typeof getTracer>['startTrace']>;
  failedMessage: string;
  sessionId: string | null;
  recordVaultFailure?: boolean;
}

async function handleTaskFailure({
  task, prd, prdPath, response, tracer, trace,
  failedMessage, sessionId, recordVaultFailure = true,
}: TaskFailureParams): Promise<never> {
  updateTaskStatus(prd, task.id, 'failed', failedMessage);
  savePRD(prd, prdPath);

  recordTaskResult(
    task.agent, task.id, false, response.tokens, response.duration,
    task.attempts, failedMessage, sessionId || undefined,
  );

  if (recordVaultFailure) {
    try {
      const vault = getTasteVault();
      await vault.learnFromBuildResult(task.title, task.description, '', task.agent, false);
    } catch {
      // Vault unavailable — skip silently
    }
  }

  const appliedRuleIds = getInjectedPlaybookRuleIds(task.id);
  await getSelfImprovementProtocol().recordOutcome(task.agent, {
    taskId: task.id,
    taskTitle: task.title,
    taskType: String(task.phase ?? task.title.split(' ')[0]),
    success: false,
    appliedRuleIds,
  });
  clearInjectedPlaybookRuleIds(task.id);
  await getPlaybookManager().recordTaskApplied(task.agent);

  tracer.endTrace(trace, 'failed', failedMessage);
  throw new Error(failedMessage);
}

async function processTask(
  task: Task,
  prd: PRD,
  prdPath: string,
  llmCaller: LLMCaller | undefined,
  useStructuredOutput: boolean,
  tracer: ReturnType<typeof getTracer>,
  sessionId: string | null,
  loopOptions?: RalphLoopOptions,
  eventStore?: EventStore,
  gitWf?: ReturnType<typeof initWorkflow>,
  convexClient?: ConvexSyncClient
): Promise<void> {
  const trace = tracer.startTrace(sessionId, task.id, task.agent);

  // Event store: task_start
  eventStore?.emit('task_start', { title: task.title, agent: task.agent, phase: task.phase }, task.id, task.agent);
  
  // Convex sync: log task as running (MEGA-04)
  await convexClient?.logTask(task, 'running');
  
  // Initialize todos for complex tasks
  if (shouldCreateTodos(task) && !task.todos) {
    task.todos = createInitialTodos(task);
  }
  
  // Mark first todo as in_progress
  if (task.todos && task.todos.length > 0) {
    updateTodoStatus(task, task.todos[0].id, 'in_progress');
    console.log(formatTodos(task));
  }
  
  // Mark as running
  updateTaskStatus(prd, task.id, 'running');
  savePRD(prd, prdPath);
  
  // Move to implementation todo
  if (task.todos && task.todos.length > 1) {
    updateTodoStatus(task, task.todos[1].id, 'in_progress');
    console.log(formatTodos(task));
  }
  
  // Build prompt
  const { systemPrompt, userPrompt } = await buildPrompt(task, prd);

  // ACE: retrieve active playbook rules and inject into prompt context
  // (actual injection happens in prompt-builder.ts — this just ensures the playbook is loaded)
  const playbookManager = getPlaybookManager();
  await playbookManager.getPlaybook(task.agent);  // pre-warm cache

  // Rehearsal Stage: check if task warrants a rehearsal (premium only)
  let rehearsalSession: RehearsalSession | null = null;
  if (process.env.NOVA26_TIER === 'premium' && getRehearsalStage().shouldRehearse(task)) {
    try {
      rehearsalSession = await getRehearsalStage().rehearse(task, task.agent);
      console.log(`  Rehearsal Stage: explored ${rehearsalSession.branches.length} branches, winner score: ${rehearsalSession.results[0]?.score.toFixed(2) ?? 'n/a'}`);
    } catch (err) {
      console.warn(`  Rehearsal Stage skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Pre-execution plan approval ---
  if (loopOptions?.planApproval) {
    console.log(`\n📋 Plan approval enabled — generating plan for ${task.id}...`);
    const planPrompt = buildPlanPrompt(task, prd);

    try {
      let planResponse: LLMResponse;
      if (llmCaller) {
        planResponse = await llmCaller(systemPrompt, planPrompt, task.agent);
      } else {
        planResponse = await callLLM(systemPrompt, planPrompt, task.agent);
      }

      console.log(`\n--- Plan for ${task.id} (${task.title}) ---`);
      console.log(planResponse.content);
      console.log('--- End Plan ---\n');
      // In interactive mode this would pause for approval.
      // For automated builds the plan is logged for audit.
    } catch (planError: any) {
      console.log(`Plan generation failed (non-blocking): ${planError.message}`);
    }
  }

  // Call LLM (or use AgentLoop if agentic mode enabled)
  let response: LLMResponse;
  let agentLoopResult: AgentLoopResult | undefined;
  let useAgenticMode = false;
  
  // Check if we should use agentic mode
  if (shouldUseAgenticMode(task.agent, loopOptions)) {
    useAgenticMode = true;
    console.log(`  Using agentic mode (autonomy level: ${loopOptions?.autonomyLevel ?? 3})`);
  }
  
  try {
    if (useAgenticMode) {
      // Use AgentLoop for agentic execution
      const registry = getToolRegistry();
      const autonomyLevel = loopOptions?.autonomyLevel ?? 3;
      const agentLoopConfig = getAgentLoopConfig(autonomyLevel);
      const agentLoop = new AgentLoop(registry, agentLoopConfig);
      
      // Run the agent loop
      agentLoopResult = await agentLoop.run(task.agent, systemPrompt, userPrompt, task.id);
      
      // Convert AgentLoopResult to LLMResponse for compatibility
      response = {
        content: agentLoopResult.output,
        model: 'agent-loop',
        tokens: agentLoopResult.totalTokens,
        duration: 0, // Duration tracking is per-turn in agent loop
        fromCache: false,
      };
      
      // Log agentic mode completion
      console.log(`  Agent loop completed: ${agentLoopResult.turns} turns, ${agentLoopResult.toolExecutions.length} tool calls`);
      console.log(`  Confidence: ${(agentLoopResult.confidence * 100).toFixed(1)}% (${agentLoopResult.stoppedBecause})`);
      
      // Record tool usage to analytics and event store
      if (agentLoopResult.toolExecutions.length > 0) {
        recordToolUsage(task.agent, task.id, agentLoopResult.toolExecutions, eventStore);
      }
      
      // Emit agentic mode completion event
      eventStore?.emit('checkpoint', {
        description: 'Agent loop completed',
        turns: agentLoopResult.turns,
        toolCalls: agentLoopResult.toolExecutions.length,
        confidence: agentLoopResult.confidence,
        stoppedBecause: agentLoopResult.stoppedBecause,
      }, task.id, task.agent);
      
    } else if (useStructuredOutput && hasAgentSchema(task.agent)) {
      response = await callLLMWithSchema(systemPrompt, userPrompt, task.agent);
    } else if (llmCaller) {
      response = await llmCaller(systemPrompt, userPrompt, task.agent);
    } else {
      response = await callLLM(systemPrompt, userPrompt, task.agent);
    }
    
    tracer.logLLMCall(trace, userPrompt, response.content, response.model, response.duration, response.tokens);
    eventStore?.emit('llm_call_complete', { model: response.model, tokens: response.tokens, duration: response.duration }, task.id, task.agent);
    
    // Convex sync: log execution (MEGA-04)
    await convexClient?.logExecution(task.id, response.model, response.tokens, response.duration);

    // C-04: Record cost for every LLM call
    if (loopOptions?.costTracking) {
      const costEntry = recordCost(response.model, response.tokens, response.tokens, {
        taskId: task.id,
        agentName: task.agent,
        cached: response.fromCache,
      });
      if (costEntry.cost > 0) {
        console.log(`  Cost: $${costEntry.cost.toFixed(4)} (${response.model})`);
      }
      // Check budget alerts
      const alerts = checkBudgetAlerts();
      for (const alert of alerts) {
        console.log(alert);
      }
    }

    // C-05: Budget enforcement — halt build if daily budget exceeded
    if (loopOptions?.budgetLimit) {
      const today = getTodaySpending();
      if (today.cost >= loopOptions.budgetLimit) {
        const msg = `Budget exceeded: $${today.cost.toFixed(4)} >= $${loopOptions.budgetLimit} daily limit`;
        console.log(`BUDGET HALT: ${msg}`);
        updateTaskStatus(prd, task.id, 'failed', msg);
        savePRD(prd, prdPath);
        tracer.endTrace(trace, 'failed', msg);
        throw new Error(msg);
      }
    }
  } catch (llmError: any) {
    console.log(`LLM call failed: ${llmError.message}`);
    eventStore?.emit('llm_call_fail', { error: llmError.message }, task.id, task.agent);
    if (loopOptions?.sessionMemory) learnFromFailure(task.agent, task.title, llmError.message);
    updateTaskStatus(prd, task.id, 'failed', llmError.message);
    savePRD(prd, prdPath);
    // MEGA-05: Record failed task result for analytics
    recordTaskResult(task.agent, task.id, false, 0, 0, task.attempts, `LLM Error: ${llmError.message}`, sessionId || undefined);
    tracer.endTrace(trace, 'failed', llmError.message);
    throw llmError;
  }
  
  console.log(`LLM response: ${response.content.substring(0, 100)}...`);
  
  // Mark verification todo as in_progress before gates
  if (task.todos && task.todos.length > 2) {
    updateTodoStatus(task, task.todos[2].id, 'in_progress');
    console.log(formatTodos(task));
  }
  
  // Run gates - pass llmCaller for MERCURY validation
  const gateResults = await runGates(task, response, {
    enabled: true,
    gates: ['response-validation', 'mercury-validator'],
    llmCaller
  });
  console.log(getGatesSummary(gateResults));
  
  for (const result of gateResults) {
    tracer.logGateResult(trace, result.gate, result.passed, result.message);
  }
  
  if (!allGatesPassed(gateResults)) {
    if (task.attempts < 2) {
      console.log(`Gates failed, retrying... (attempt ${task.attempts + 1})`);
      const retryPrompt = buildRetryPrompt(task, getGatesSummary(gateResults), response.content);
      
      try {
        if (useStructuredOutput && hasAgentSchema(task.agent)) {
          response = await callLLMWithSchema(systemPrompt, retryPrompt, task.agent);
        } else if (llmCaller) {
          response = await llmCaller(systemPrompt, retryPrompt, task.agent);
        } else {
          response = await callLLM(systemPrompt, retryPrompt, task.agent);
        }
      } catch {
        await handleTaskFailure({
          task, prd, prdPath, response, tracer, trace,
          failedMessage: `Gates failed after retry: ${getGatesSummary(gateResults)}`,
          sessionId, recordVaultFailure: false,
        });
      }
      
      const retryGateResults = await runGates(task, response, {
        enabled: true,
        gates: ['response-validation', 'mercury-validator'],
        llmCaller
      });
      console.log(getGatesSummary(retryGateResults));
      
      if (!allGatesPassed(retryGateResults)) {
        await handleTaskFailure({
          task, prd, prdPath, response, tracer, trace,
          failedMessage: `Gates failed after retry: ${getGatesSummary(retryGateResults)}`,
          sessionId,
        });
      }
    } else {
      await handleTaskFailure({
        task, prd, prdPath, response, tracer, trace,
        failedMessage: `Gates failed: ${getGatesSummary(gateResults)}`,
        sessionId,
      });
    }
  }
  
  // --- Auto test→fix→retest loop ---
  if (loopOptions?.autoTestFix) {
    response = await testFixLoop(
      task, response, systemPrompt,
      llmCaller, useStructuredOutput,
      loopOptions.maxTestRetries ?? 3
    );
  }

  // Council approval
  if (requiresCouncilApproval(task)) {
    console.log('\n🏛️ Task requires Council approval...');
    const councilDecision = await runCouncilVote(task, response.content);
    tracer.logCouncilVote(trace, councilDecision.votes, councilDecision);
    
    if (councilDecision.finalVerdict === 'rejected') {
      console.log(`Council rejected: ${councilDecision.summary}`);
      await handleTaskFailure({
        task, prd, prdPath, response, tracer, trace,
        failedMessage: `Council rejected: ${councilDecision.summary}`,
        sessionId,
      });
    }
  }
  
  // Save output
  const outputPath = await saveTaskOutput(task, response);
  setTaskOutput(prd, task.id, outputPath);
  
  // Mark all todos as completed
  if (task.todos) {
    for (const todo of task.todos) {
      todo.status = 'completed';
      todo.completedAt = new Date().toISOString();
    }
    console.log(formatTodos(task));
  }
  
  // Mark as done
  updateTaskStatus(prd, task.id, 'done');
  savePRD(prd, prdPath);

  // MEGA-05: Record successful task result for analytics
  recordTaskResult(task.agent, task.id, true, response.tokens, response.duration, task.attempts, undefined, sessionId || undefined);

  // Convex sync: log task as done (MEGA-04)
  await convexClient?.logTask(task, 'done');

  // Event store: task_complete
  eventStore?.emit('task_complete', { outputPath }, task.id, task.agent);

  // Session memory: learn from success
  if (loopOptions?.sessionMemory) {
    learnFromTask(task.agent, task.title, task.description, response.content);
    
    // Convex sync: log learning when session memory learns (MEGA-04)
    // Extract key patterns that were learned
    if (task.agent === 'MARS' && response.content.includes('requireAuth')) {
      await convexClient?.logLearning(task.agent, 'auth_pattern:requireAuth_first');
    }
    if (task.agent === 'PLUTO' && response.content.includes('companyId')) {
      await convexClient?.logLearning(task.agent, 'pattern:multi_tenant_companyId');
    }
  }

  // Git workflow: commit phase
  gitWf?.commitPhase(task.id, task.title, task.agent, task.phase);

  // Taste Vault: extract patterns from successful task
  try {
    const vault = getTasteVault();
    await vault.learnFromBuildResult(task.title, task.description, response.content, task.agent, true);
    
    // Reinforce patterns that were injected into the prompt for this task
    const injectedNodeIds = getInjectedVaultNodeIds(task.id);
    for (const nodeId of injectedNodeIds) {
      await vault.reinforce(nodeId);
    }
    clearInjectedVaultNodeIds(task.id);
    
    console.log(`  Taste Vault: learned from task (${injectedNodeIds.length} patterns reinforced)`);
  } catch {
    // Vault unavailable — skip silently
  }

  // ACE: reinforce playbook rules that were applied during this task
  const appliedRuleIds = getInjectedPlaybookRuleIds(task.id);
  if (appliedRuleIds.length > 0) {
    await getPlaybookManager().recordSuccess(task.agent, appliedRuleIds);
  }
  clearInjectedPlaybookRuleIds(task.id);

  // ACE: record outcome in self-improvement protocol
  await getSelfImprovementProtocol().recordOutcome(task.agent, {
    taskId: task.id,
    taskTitle: task.title,
    taskType: String(task.phase ?? task.title.split(' ')[0]),
    success: true,
    appliedRuleIds,
  });

  // ACE: run reflector and curator to evolve the playbook
  const autonomyLevel = loopOptions?.autonomyLevel;
  if (autonomyLevel !== undefined && autonomyLevel >= 3) {
    const playbook = await getPlaybookManager().getPlaybook(task.agent);
    const deltas = await getAceReflector().reflectOnOutcome(
      task,
      { success: true, output: response.content },
      playbook
    );
    if (deltas.length > 0) {
      const curation = await getAceCurator().curate(deltas, task.agent);
      console.log(`  ACE: applied ${curation.applied.length} playbook update(s), rejected ${curation.rejected.length}`);
    }
  }

  // ACE: record task applied count
  await getPlaybookManager().recordTaskApplied(task.agent);

  console.log(`\n✅ Task ${task.id} completed successfully.`);
  tracer.endTrace(trace, 'done');
}
