// Task Executor - Extracted from ralph-loop.ts for maintainability
// Handles single task execution with all supporting logic

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { buildPrompt, buildRetryPrompt } from './prompt-builder.js';
import { runGates, allGatesPassed, getGatesSummary } from './gate-runner.js';
import { runCouncilVote, requiresCouncilApproval } from './council-runner.js';
import { callLLM, type LLMCaller } from '../llm/ollama-client.js';
import { callLLMWithSchema, hasAgentSchema } from '../llm/structured-output.js';
import { getTracer } from '../observability/index.js';
import type { EventStore } from './event-store.js';
import { learnFromTask, learnFromFailure } from '../memory/session-memory.js';
import type { PRD, Task, LLMResponse, TodoItem } from '../types/index.js';
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
import type { RalphLoopOptions } from './ralph-loop-types.js';
import { recordCost, checkBudgetAlerts, getTodaySpending } from '../cost/cost-tracker.js';
import { recordTaskResult } from '../analytics/agent-analytics.js';

// ============================================================================
// Types
// ============================================================================

export interface TestResult {
  passed: boolean;
  errors: string[];
  command: string;
}

export interface TaskFailureParams {
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

export interface ProcessTaskParams {
  task: Task;
  prd: PRD;
  prdPath: string;
  llmCaller: LLMCaller | undefined;
  useStructuredOutput: boolean;
  tracer: ReturnType<typeof getTracer>;
  sessionId: string | null;
  loopOptions?: RalphLoopOptions;
  eventStore?: EventStore;
  gitWf?: ReturnType<typeof import('./ralph-loop.js').ralphLoop extends (...args: any[]) => any ? never : import('../git/workflow.js').Workflow>;
  convexClient?: import('../convex/sync.js').ConvexSyncClient;
}

export interface TaskExecutorConfig {
  updateTaskStatus: (prd: PRD, taskId: string, status: string, error?: string) => void;
  savePRD: (prd: PRD, path: string) => void;
  setTaskOutput: (prd: PRD, taskId: string, output: string) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Run TypeScript type-check on the project
 */
export function runTypeCheck(): TestResult {
  try {
    execSync('npx tsc --noEmit 2>&1', {
      encoding: 'utf-8',
      timeout: 60000,
      cwd: process.cwd(),
    });
    return { passed: true, errors: [], command: 'tsc --noEmit' };
  } catch (error: unknown) {
    const output = error instanceof Error ? (error as Error & { stdout?: string }).stdout || error.message : String(error);
    const errors = output
      .split('\n')
      .filter((line: string) => line.includes('error TS'))
      .slice(0, 10);
    return { passed: false, errors, command: 'tsc --noEmit' };
  }
}

/**
 * Run test suite (vitest or jest)
 */
export function runTests(): TestResult {
  const hasVitest = existsSync(join(process.cwd(), 'node_modules', '.bin', 'vitest'));
  const cmd = hasVitest ? 'npx vitest run --reporter=verbose 2>&1' : 'npx jest --ci 2>&1';

  try {
    execSync(cmd, { encoding: 'utf-8', timeout: 120000, cwd: process.cwd() });
    return { passed: true, errors: [], command: cmd };
  } catch (error: unknown) {
    const output = error instanceof Error ? (error as Error & { stdout?: string }).stdout || error.message : String(error);
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
export function buildTestFixPrompt(task: Task, originalResponse: string, testResults: TestResult[]): string {
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
export async function testFixLoop(
  task: Task,
  response: LLMResponse,
  systemPrompt: string,
  llmCaller: LLMCaller | undefined,
  useStructuredOutput: boolean,
  maxRetries: number
): Promise<LLMResponse> {
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

/**
 * Build a planning prompt that asks the LLM to produce a plan before execution
 */
export function buildPlanPrompt(task: Task, prd: PRD): string {
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

/**
 * Determines if agentic mode should be used for this agent and options
 */
export function shouldUseAgenticMode(agent: string, options: RalphLoopOptions | undefined): boolean {
  if (!options) return false;
  
  const autonomyLevel = options.autonomyLevel ?? 3;
  const toolsAvailable = getToolRegistry().listForAgent(agent).length > 0;
  
  if (!toolsAvailable) return false;
  if (options.agenticMode === false) return false;
  if (options.agenticMode === true) return true;
  
  return autonomyLevel >= 3;
}

/**
 * Get AgentLoop configuration based on autonomy level
 */
export function getAgentLoopConfig(autonomyLevel: AutonomyLevel = 3): Partial<import('../agent-loop/agent-loop.js').AgentLoopConfig> {
  const baseConfig = {
    maxTurns: 8,
    confidenceThreshold: 0.85,
    tokenBudget: 50000,
    enableTools: true,
  };
  
  switch (autonomyLevel) {
    case 1:
      return { ...baseConfig, maxTurns: 3, enableTools: false };
    case 2:
      return { ...baseConfig, maxTurns: 5, confidenceThreshold: 0.9 };
    case 3:
      return baseConfig;
    case 4:
      return { ...baseConfig, maxTurns: 12, confidenceThreshold: 0.8 };
    case 5:
      return { ...baseConfig, maxTurns: 20, confidenceThreshold: 0.75, tokenBudget: 100000 };
    default:
      return baseConfig;
  }
}

/**
 * Record tool usage to analytics and event store
 */
export function recordToolUsage(
  agent: string,
  taskId: string,
  executions: ToolExecution[],
  eventStore?: EventStore
): void {
  if (executions.length === 0) return;
  
  for (const exec of executions) {
    const { call, result } = exec;
    
    eventStore?.emit('checkpoint', {
      description: `Tool execution: ${call.name}`,
      toolName: call.name,
      success: result.success,
      duration: result.duration,
      error: result.error,
    }, taskId, agent);
    
    console.log(`  Tool: ${call.name} ${result.success ? '✓' : '✗'} (${result.duration}ms)`);
  }
  
  const successCount = executions.filter(e => e.result.success).length;
  console.log(`Tool usage: ${successCount}/${executions.length} successful`);
}

/**
 * Save task output to disk
 */
export async function saveTaskOutput(task: Task, response: LLMResponse): Promise<string> {
  const outputDir = join(process.cwd(), '.nova', 'output');
  
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

/**
 * Determines if a task needs TodoWrite tracking based on complexity
 */
export function shouldCreateTodos(task: Task): boolean {
  return (
    task.description.length > 200 ||
    task.title.toLowerCase().includes('implement') ||
    task.title.toLowerCase().includes('create') ||
    task.agent === 'JUPITER' ||
    task.agent === 'MARS' ||
    task.agent === 'VENUS'
  );
}

/**
 * Get verification criteria based on agent type
 */
export function getVerificationCriteria(agent: string): string[] {
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
 * Creates initial todos for a task
 */
export function createInitialTodos(task: Task): TodoItem[] {
  const todos: TodoItem[] = [];
  
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
  
  todos.push({
    id: `${task.id}-todo-2`,
    content: `Implement ${task.agent} deliverable`,
    activeForm: `Implementing ${task.agent} deliverable`,
    status: 'pending',
    agent: task.agent,
    createdAt: new Date().toISOString(),
    verificationCriteria: getVerificationCriteria(task.agent)
  });
  
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
 * Update todo status ensuring exactly one in_progress at a time
 */
export function updateTodoStatus(
  task: Task,
  todoId: string,
  newStatus: TodoItem['status']
): void {
  if (!task.todos) return;
  
  if (newStatus === 'in_progress') {
    for (const todo of task.todos) {
      if (todo.status === 'in_progress' && todo.id !== todoId) {
        todo.status = 'completed';
        todo.completedAt = new Date().toISOString();
      }
    }
    task.currentTodoId = todoId;
  }
  
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
export function formatTodos(task: Task): string {
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

/**
 * Shared failure handler for processTask() failure paths
 */
export async function handleTaskFailure({
  task, prd, prdPath, response, tracer, trace,
  failedMessage, sessionId, recordVaultFailure = true,
  updateTaskStatus,
  savePRD,
}: TaskFailureParams & TaskExecutorConfig): Promise<never> {
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
      // Vault unavailable
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

// ============================================================================
// Main Task Executor Class
// ============================================================================

export class TaskExecutor {
  private config: TaskExecutorConfig;

  constructor(config: TaskExecutorConfig) {
    this.config = config;
  }

  /**
   * Process a single task - main entry point
   */
  async processTask(params: ProcessTaskParams): Promise<void> {
    const {
      task, prd, prdPath, llmCaller, useStructuredOutput,
      tracer, sessionId, loopOptions, eventStore, gitWf, convexClient
    } = params;

    const trace = tracer.startTrace(sessionId, task.id, task.agent);

    eventStore?.emit('task_start', { title: task.title, agent: task.agent, phase: task.phase }, task.id, task.agent);
    
    await convexClient?.logTask(task, 'running');
    
    if (shouldCreateTodos(task) && !task.todos) {
      task.todos = createInitialTodos(task);
    }
    
    if (task.todos && task.todos.length > 0) {
      updateTodoStatus(task, task.todos[0].id, 'in_progress');
      console.log(formatTodos(task));
    }
    
    this.config.updateTaskStatus(prd, task.id, 'running');
    this.config.savePRD(prd, prdPath);
    
    if (task.todos && task.todos.length > 1) {
      updateTodoStatus(task, task.todos[1].id, 'in_progress');
      console.log(formatTodos(task));
    }
    
    const { systemPrompt, userPrompt } = await buildPrompt(task, prd);

    const playbookManager = getPlaybookManager();
    await playbookManager.getPlaybook(task.agent);

    let rehearsalSession: RehearsalSession | null = null;
    if (process.env.NOVA26_TIER === 'premium' && getRehearsalStage().shouldRehearse(task)) {
      try {
        rehearsalSession = await getRehearsalStage().rehearse(task, task.agent);
        console.log(`  Rehearsal Stage: explored ${rehearsalSession.branches.length} branches, winner score: ${rehearsalSession.results[0]?.score.toFixed(2) ?? 'n/a'}`);
      } catch (err) {
        console.warn(`  Rehearsal Stage skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

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
      } catch (planError: unknown) {
        console.log(`Plan generation failed (non-blocking): ${planError instanceof Error ? planError.message : String(planError)}`);
      }
    }

    let response: LLMResponse;
    let agentLoopResult: AgentLoopResult | undefined;
    let useAgenticMode = false;
    
    if (shouldUseAgenticMode(task.agent, loopOptions)) {
      useAgenticMode = true;
      console.log(`  Using agentic mode (autonomy level: ${loopOptions?.autonomyLevel ?? 3})`);
    }
    
    try {
      if (useAgenticMode) {
        const registry = getToolRegistry();
        const autonomyLevel = loopOptions?.autonomyLevel ?? 3;
        const agentLoopConfig = getAgentLoopConfig(autonomyLevel);
        const agentLoop = new AgentLoop(registry, agentLoopConfig);
        
        agentLoopResult = await agentLoop.run(task.agent, systemPrompt, userPrompt, task.id);
        
        response = {
          content: agentLoopResult.output,
          model: 'agent-loop',
          tokens: agentLoopResult.totalTokens,
          duration: 0,
          fromCache: false,
        };
        
        console.log(`  Agent loop completed: ${agentLoopResult.turns} turns, ${agentLoopResult.toolExecutions.length} tool calls`);
        console.log(`  Confidence: ${(agentLoopResult.confidence * 100).toFixed(1)}% (${agentLoopResult.stoppedBecause})`);
        
        if (agentLoopResult.toolExecutions.length > 0) {
          recordToolUsage(task.agent, task.id, agentLoopResult.toolExecutions, eventStore);
        }
        
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
      
      await convexClient?.logExecution(task.id, response.model, response.tokens, response.duration);

      if (loopOptions?.costTracking) {
        const costEntry = recordCost(response.model, response.tokens, response.tokens, {
          taskId: task.id,
          agentName: task.agent,
          cached: response.fromCache,
        });
        if (costEntry.cost > 0) {
          console.log(`  Cost: $${costEntry.cost.toFixed(4)} (${response.model})`);
        }
        const alerts = checkBudgetAlerts();
        for (const alert of alerts) {
          console.log(alert);
        }
      }

      if (loopOptions?.budgetLimit) {
        const today = getTodaySpending();
        if (today.cost >= loopOptions.budgetLimit) {
          const msg = `Budget exceeded: $${today.cost.toFixed(4)} >= $${loopOptions.budgetLimit} daily limit`;
          console.log(`BUDGET HALT: ${msg}`);
          this.config.updateTaskStatus(prd, task.id, 'failed', msg);
          this.config.savePRD(prd, prdPath);
          tracer.endTrace(trace, 'failed', msg);
          throw new Error(msg);
        }
      }
    } catch (llmError: unknown) {
      const errorMessage = llmError instanceof Error ? llmError.message : String(llmError);
      console.log(`LLM call failed: ${errorMessage}`);
      eventStore?.emit('llm_call_fail', { error: errorMessage }, task.id, task.agent);
      if (loopOptions?.sessionMemory) learnFromFailure(task.agent, task.title, errorMessage);
      this.config.updateTaskStatus(prd, task.id, 'failed', errorMessage);
      this.config.savePRD(prd, prdPath);
      recordTaskResult(task.agent, task.id, false, 0, 0, task.attempts, `LLM Error: ${errorMessage}`, sessionId || undefined);
      tracer.endTrace(trace, 'failed', errorMessage);
      throw llmError;
    }
    
    console.log(`LLM response: ${response.content.substring(0, 100)}...`);
    
    if (task.todos && task.todos.length > 2) {
      updateTodoStatus(task, task.todos[2].id, 'in_progress');
      console.log(formatTodos(task));
    }
    
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
            updateTaskStatus: this.config.updateTaskStatus,
            savePRD: this.config.savePRD,
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
            updateTaskStatus: this.config.updateTaskStatus,
            savePRD: this.config.savePRD,
          });
        }
      } else {
        await handleTaskFailure({
          task, prd, prdPath, response, tracer, trace,
          failedMessage: `Gates failed: ${getGatesSummary(gateResults)}`,
          sessionId,
          updateTaskStatus: this.config.updateTaskStatus,
          savePRD: this.config.savePRD,
        });
      }
    }
    
    if (loopOptions?.autoTestFix) {
      response = await testFixLoop(
        task, response, systemPrompt,
        llmCaller, useStructuredOutput,
        loopOptions.maxTestRetries ?? 3
      );
    }

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
          updateTaskStatus: this.config.updateTaskStatus,
          savePRD: this.config.savePRD,
        });
      }
    }
    
    const outputPath = await saveTaskOutput(task, response);
    this.config.setTaskOutput(prd, task.id, outputPath);
    
    if (task.todos) {
      for (const todo of task.todos) {
        todo.status = 'completed';
        todo.completedAt = new Date().toISOString();
      }
      console.log(formatTodos(task));
    }
    
    this.config.updateTaskStatus(prd, task.id, 'done');
    this.config.savePRD(prd, prdPath);

    recordTaskResult(task.agent, task.id, true, response.tokens, response.duration, task.attempts, undefined, sessionId || undefined);

    await convexClient?.logTask(task, 'done');

    eventStore?.emit('task_complete', { outputPath }, task.id, task.agent);

    if (loopOptions?.sessionMemory) {
      learnFromTask(task.agent, task.title, task.description, response.content);
      
      if (task.agent === 'MARS' && response.content.includes('requireAuth')) {
        await convexClient?.logLearning(task.agent, 'auth_pattern:requireAuth_first');
      }
      if (task.agent === 'PLUTO' && response.content.includes('companyId')) {
        await convexClient?.logLearning(task.agent, 'pattern:multi_tenant_companyId');
      }
    }

    gitWf?.commitPhase(task.id, task.title, task.agent, task.phase);

    try {
      const vault = getTasteVault();
      await vault.learnFromBuildResult(task.title, task.description, response.content, task.agent, true);
      
      const injectedNodeIds = getInjectedVaultNodeIds(task.id);
      for (const nodeId of injectedNodeIds) {
        await vault.reinforce(nodeId);
      }
      clearInjectedVaultNodeIds(task.id);
      
      console.log(`  Taste Vault: learned from task (${injectedNodeIds.length} patterns reinforced)`);
    } catch {
      // Vault unavailable
    }

    const appliedRuleIds = getInjectedPlaybookRuleIds(task.id);
    if (appliedRuleIds.length > 0) {
      await getPlaybookManager().recordSuccess(task.agent, appliedRuleIds);
    }
    clearInjectedPlaybookRuleIds(task.id);

    await getSelfImprovementProtocol().recordOutcome(task.agent, {
      taskId: task.id,
      taskTitle: task.title,
      taskType: String(task.phase ?? task.title.split(' ')[0]),
      success: true,
      appliedRuleIds,
    });

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

    await getPlaybookManager().recordTaskApplied(task.agent);

    console.log(`\n✅ Task ${task.id} completed successfully.`);
    tracer.endTrace(trace, 'done');
  }
}

/**
 * Create a TaskExecutor with standard configuration
 */
export function createTaskExecutor(
  updateTaskStatus: TaskExecutorConfig['updateTaskStatus'],
  savePRD: TaskExecutorConfig['savePRD'],
  setTaskOutput: TaskExecutorConfig['setTaskOutput']
): TaskExecutor {
  return new TaskExecutor({ updateTaskStatus, savePRD, setTaskOutput });
}
