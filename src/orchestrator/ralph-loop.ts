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
import type { PRD, Task, LLMResponse, TodoItem, PlanningPhase } from '../types/index.js';

export interface RalphLoopOptions {
  parallelMode?: boolean;
  concurrency?: number;
  autoTestFix?: boolean;       // Auto test→fix→retest loop
  maxTestRetries?: number;     // Max retries for test loop (default: 3)
  planApproval?: boolean;      // Require plan approval before execution
  eventStore?: boolean;        // Enable event-sourced session logging
  sessionMemory?: boolean;     // Enable cross-session memory (learn from tasks)
  gitWorkflow?: boolean;       // Enable auto branch/commit/PR workflow
  costTracking?: boolean;      // Enable per-call cost tracking (C-04)
  budgetLimit?: number;        // Daily budget limit in USD — halt builds when exceeded (C-05)
}

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
          await processTask(task, prd, prdPath, llmCaller, useStructuredOutput, tracer, sessionId, options, eventStore, gitWf);
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
      await processTask(task, prd, prdPath, llmCaller, useStructuredOutput, tracer, sessionId, options, eventStore, gitWf);

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

  // Git workflow: finalize (create PR if all tasks done)
  if (gitWf && allDone) {
    const taskSummary = prd.tasks.map(t => `${t.agent}: ${t.title}`);
    const prUrl = gitWf.finalize(taskSummary);
    if (prUrl) console.log(`\nPR created: ${prUrl}`);
  }

  console.log('\n=== Ralph Loop finished ===');
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
  gitWf?: ReturnType<typeof initWorkflow>
): Promise<void> {
  const trace = tracer.startTrace(sessionId, task.id, task.agent);

  // Event store: task_start
  eventStore?.emit('task_start', { title: task.title, agent: task.agent, phase: task.phase }, task.id, task.agent);
  
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

  // Call LLM
  let response: LLMResponse;
  
  try {
    if (useStructuredOutput && hasAgentSchema(task.agent)) {
      response = await callLLMWithSchema(systemPrompt, userPrompt, task.agent);
    } else if (llmCaller) {
      response = await llmCaller(systemPrompt, userPrompt, task.agent);
    } else {
      response = await callLLM(systemPrompt, userPrompt, task.agent);
    }
    tracer.logLLMCall(trace, userPrompt, response.content, response.model, response.duration, response.tokens);
    eventStore?.emit('llm_call_complete', { model: response.model, tokens: response.tokens, duration: response.duration }, task.id, task.agent);

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
        const failedMessage = `Gates failed after retry: ${getGatesSummary(gateResults)}`;
        updateTaskStatus(prd, task.id, 'failed', failedMessage);
        savePRD(prd, prdPath);
        tracer.endTrace(trace, 'failed', failedMessage);
        throw new Error(failedMessage);
      }
      
      const retryGateResults = await runGates(task, response, {
        enabled: true,
        gates: ['response-validation', 'mercury-validator'],
        llmCaller
      });
      console.log(getGatesSummary(retryGateResults));
      
      if (!allGatesPassed(retryGateResults)) {
        const failedMessage = `Gates failed after retry: ${getGatesSummary(retryGateResults)}`;
        updateTaskStatus(prd, task.id, 'failed', failedMessage);
        savePRD(prd, prdPath);
        tracer.endTrace(trace, 'failed', failedMessage);
        throw new Error(failedMessage);
      }
    } else {
      const failedMessage = `Gates failed: ${getGatesSummary(gateResults)}`;
      updateTaskStatus(prd, task.id, 'failed', failedMessage);
      savePRD(prd, prdPath);
      tracer.endTrace(trace, 'failed', failedMessage);
      throw new Error(failedMessage);
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
      updateTaskStatus(prd, task.id, 'failed', `Council rejected: ${councilDecision.summary}`);
      savePRD(prd, prdPath);
      tracer.endTrace(trace, 'failed', councilDecision.summary);
      throw new Error(`Council rejected: ${councilDecision.summary}`);
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

  // Event store: task_complete
  eventStore?.emit('task_complete', { outputPath }, task.id, task.agent);

  // Session memory: learn from success
  if (loopOptions?.sessionMemory) {
    learnFromTask(task.agent, task.title, task.description, response.content);
  }

  // Git workflow: commit phase
  gitWf?.commitPhase(task.id, task.title, task.agent, task.phase);

  console.log(`\n✅ Task ${task.id} completed successfully.`);
  tracer.endTrace(trace, 'done');
}
