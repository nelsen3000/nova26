// MEGA-01: Real Swarm Mode Engine for NOVA26
// Multi-agent collaboration engine with dependency scheduling, error isolation, and parallel execution

import type { PRD, Task, LLMCaller, LLMResponse } from '../types/index.js';
import { generatePRD } from '../agents/sun-prd-generator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Core Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface SwarmContext {
  prd: PRD;
  sharedMemory: Map<string, string>;
  channel: SwarmMessage[];
  results: Map<string, SwarmAgentResult>;
}

export interface SwarmMessage {
  id: string;
  from: string;
  to: string | '*';
  type: 'handoff' | 'request' | 'inform' | 'block' | 'complete';
  content: string;
  timestamp: string;
}

export interface SwarmAgentResult {
  agent: string;
  taskId: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  output: string;
  tokens: number;
  duration: number;
  error?: string;
}

export interface SwarmResult {
  sessionId: string;
  totalDuration: number;
  agentResults: SwarmAgentResult[];
  messages: SwarmMessage[];
  summary: { total: number; done: number; failed: number; skipped: number };
}

export interface SwarmOptions {
  maxConcurrency?: number; // default: 4
  timeoutPerAgent?: number; // default: 120000ms
  continueOnFailure?: boolean; // default: true
  llmCaller?: LLMCaller;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SwarmOrchestrator - Core Engine
// ═══════════════════════════════════════════════════════════════════════════════

export class SwarmOrchestrator {
  private prd: PRD;
  private options: Required<SwarmOptions>;
  private context: SwarmContext;
  private sessionId: string;
  private startTime: number;
  private runningAgents: Set<string> = new Set();
  private completedTasks: Set<string> = new Set();
  private failedTasks: Set<string> = new Set();
  private shouldStop = false;
  private stopError?: string;
  private messageCounter = 0;

  // Default LLM caller - can be overridden for testing
  private defaultLLMCaller: LLMCaller = async (
    _systemPrompt: string,
    _userPrompt: string,
    agentName?: string
  ): Promise<LLMResponse> => {
    // Mock response for when no LLM is configured
    return {
      content: `[MOCK] Agent ${agentName || 'unknown'} processed task`,
      model: 'mock',
      duration: 100,
      tokens: 100,
      fromCache: false,
    };
  };

  constructor(prd: PRD, options: SwarmOptions = {}) {
    this.prd = prd;
    this.sessionId = `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.startTime = Date.now();

    this.options = {
      maxConcurrency: options.maxConcurrency ?? 4,
      timeoutPerAgent: options.timeoutPerAgent ?? 120000,
      continueOnFailure: options.continueOnFailure ?? true,
      llmCaller: options.llmCaller ?? this.defaultLLMCaller,
    };

    this.context = {
      prd,
      sharedMemory: new Map(),
      channel: [],
      results: new Map(),
    };
  }

  /**
   * Execute the full swarm - main entry point
   */
  async run(): Promise<SwarmResult> {
    this.postMessage({
      id: this.generateMessageId(),
      from: 'ORCHESTRATOR',
      to: '*',
      type: 'inform',
      content: `Swarm session ${this.sessionId} started with ${this.prd.tasks.length} tasks`,
      timestamp: new Date().toISOString(),
    });

    // Initialize all tasks as pending results
    for (const task of this.prd.tasks) {
      const pendingResult: SwarmAgentResult = {
        agent: task.agent,
        taskId: task.id,
        status: 'pending',
        output: '',
        tokens: 0,
        duration: 0,
      };
      this.context.results.set(task.id, pendingResult);
    }

    // Main execution loop - process waves until all tasks complete
    while (!this.shouldStop && this.hasPendingTasks()) {
      const scheduled = await this.scheduleWave();

      if (this.shouldStop) {
        break;
      }

      if (scheduled === 0 && this.runningAgents.size === 0) {
        // Deadlock detection - no tasks scheduled and none running
        this.handleDeadlock();
        break;
      }

      // Small delay to prevent tight loop when no work is available
      if (scheduled === 0) {
        await this.delay(100);
      }
    }

    // Wait for any remaining running agents
    await this.waitForRunningAgents();

    const totalDuration = Date.now() - this.startTime;

    this.postMessage({
      id: this.generateMessageId(),
      from: 'ORCHESTRATOR',
      to: '*',
      type: 'complete',
      content: `Swarm session ${this.sessionId} completed in ${totalDuration}ms`,
      timestamp: new Date().toISOString(),
    });

    // If we stopped due to an error and continueOnFailure is false, throw
    if (this.shouldStop && !this.options.continueOnFailure && this.stopError) {
      throw new Error(this.stopError);
    }

    return this.buildResult(totalDuration);
  }

  /**
   * Schedule and execute a wave of tasks whose dependencies are satisfied
   * Returns the number of tasks scheduled in this wave
   */
  async scheduleWave(): Promise<number> {
    const readyTasks = this.findReadyTasks();
    const availableSlots = this.options.maxConcurrency - this.runningAgents.size;

    if (readyTasks.length === 0 || availableSlots <= 0) {
      return 0;
    }

    const tasksToSchedule = readyTasks.slice(0, availableSlots);

    // Launch all ready tasks in parallel
    const promises = tasksToSchedule.map(task => this.executeAgentWithTracking(task));

    // Use Promise.allSettled to ensure error isolation
    await Promise.allSettled(promises);

    return tasksToSchedule.length;
  }

  /**
   * Execute a single agent with tracking and error handling
   */
  private async executeAgentWithTracking(task: Task): Promise<void> {
    // Don't start new agents if we should stop
    if (this.shouldStop) {
      return;
    }

    this.runningAgents.add(task.id);

    try {
      await this.processAgent(task, this.context);
    } finally {
      this.runningAgents.delete(task.id);
    }
  }

  /**
   * Process a single agent task with timeout and error handling
   */
  async processAgent(task: Task, context: SwarmContext): Promise<SwarmAgentResult> {
    const agentStartTime = Date.now();

    // Mark as running
    const runningResult: SwarmAgentResult = {
      agent: task.agent,
      taskId: task.id,
      status: 'running',
      output: '',
      tokens: 0,
      duration: 0,
    };
    context.results.set(task.id, runningResult);

    // Post handoff message
    this.postMessage({
      id: this.generateMessageId(),
      from: 'ORCHESTRATOR',
      to: task.agent,
      type: 'handoff',
      content: `Task ${task.id}: ${task.title}`,
      timestamp: new Date().toISOString(),
    });

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(task, context);

      // Mark task as completed
      this.completedTasks.add(task.id);

      // Save result to context
      context.results.set(task.id, result);

      // Update shared memory with output
      if (result.output) {
        context.sharedMemory.set(task.id, result.output);
      }

      // Post completion message
      this.postMessage({
        id: this.generateMessageId(),
        from: task.agent,
        to: '*',
        type: 'complete',
        content: `Task ${task.id} completed (${result.tokens} tokens, ${result.duration}ms)`,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Mark task as failed
      this.failedTasks.add(task.id);

      const failedResult: SwarmAgentResult = {
        agent: task.agent,
        taskId: task.id,
        status: 'failed',
        output: '',
        tokens: 0,
        duration: Date.now() - agentStartTime,
        error: errorMessage,
      };
      context.results.set(task.id, failedResult);

      // Post failure message
      this.postMessage({
        id: this.generateMessageId(),
        from: task.agent,
        to: '*',
        type: 'block',
        content: `Task ${task.id} failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      });

      // If continueOnFailure is false, mark swarm to stop
      if (!this.options.continueOnFailure) {
        this.shouldStop = true;
        this.stopError = errorMessage;
      }

      return failedResult;
    }
  }

  /**
   * Execute agent with timeout protection
   */
  private async executeWithTimeout(task: Task, context: SwarmContext): Promise<SwarmAgentResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Agent timeout after ${this.options.timeoutPerAgent}ms`));
      }, this.options.timeoutPerAgent);

      this.executeAgentTask(task, context)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Actual agent task execution - calls LLM
   */
  private async executeAgentTask(task: Task, context: SwarmContext): Promise<SwarmAgentResult> {
    const agentStartTime = Date.now();

    // Build system prompt for the agent
    const systemPrompt = this.buildAgentSystemPrompt(task.agent);

    // Build user prompt with task context
    const userPrompt = this.buildAgentUserPrompt(task, context);

    // Call LLM
    const llmResponse = await this.options.llmCaller(systemPrompt, userPrompt, task.agent);

    const duration = Date.now() - agentStartTime;

    return {
      agent: task.agent,
      taskId: task.id,
      status: 'done',
      output: llmResponse.content,
      tokens: llmResponse.tokens,
      duration,
    };
  }

  /**
   * Build system prompt for an agent
   */
  private buildAgentSystemPrompt(agentName: string): string {
    return `You are ${agentName}, a specialized agent in the NOVA26 swarm.
Your role is to complete assigned tasks efficiently and accurately.
You have access to shared memory from previous agents' work.
Respond with the completed work output directly.`;
  }

  /**
   * Build user prompt for an agent task
   */
  private buildAgentUserPrompt(task: Task, context: SwarmContext): string {
    const sharedContext = Array.from(context.sharedMemory.entries())
      .filter(([key]) => task.dependencies.includes(key))
      .map(([key, value]) => `[${key}]: ${value.slice(0, 500)}...`)
      .join('\n\n');

    return `Task: ${task.title}
Description: ${task.description}
Agent: ${task.agent}
Task ID: ${task.id}

${sharedContext ? `Context from dependencies:\n${sharedContext}\n\n` : ''}Complete this task and provide your output.`;
  }

  /**
   * Post a message to the swarm channel
   */
  postMessage(msg: SwarmMessage): void {
    this.context.channel.push(msg);
    // Also log for observability
    const toStr = msg.to === '*' ? 'BROADCAST' : msg.to;
    console.log(`[${msg.type.toUpperCase()}] ${msg.from} → ${toStr}: ${msg.content.slice(0, 100)}`);
  }

  /**
   * Get current swarm context
   */
  getContext(): SwarmContext {
    return {
      prd: this.context.prd,
      sharedMemory: new Map(this.context.sharedMemory),
      channel: [...this.context.channel],
      results: new Map(this.context.results),
    };
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Find tasks ready to execute (dependencies satisfied)
   */
  private findReadyTasks(): Task[] {
    return this.prd.tasks.filter(task => {
      // Already running or completed
      if (this.runningAgents.has(task.id) || this.completedTasks.has(task.id) || this.failedTasks.has(task.id)) {
        return false;
      }

      // Check if all dependencies are satisfied
      const depsSatisfied = task.dependencies.every(dep => {
        if (this.completedTasks.has(dep)) {
          return true; // Dependency completed successfully
        }
        if (this.failedTasks.has(dep)) {
          // Dependency failed - only consider satisfied if continueOnFailure is true
          return this.options.continueOnFailure;
        }
        return false; // Dependency still pending/running
      });

      return depsSatisfied;
    });
  }

  /**
   * Check if there are any pending tasks remaining
   */
  private hasPendingTasks(): boolean {
    const processedTasks = new Set(Array.from(this.completedTasks).concat(Array.from(this.failedTasks)));

    // Check if any unprocessed tasks are not blocked by failed dependencies
    for (const task of this.prd.tasks) {
      if (processedTasks.has(task.id) || this.runningAgents.has(task.id)) {
        continue;
      }

      // Check if task is blocked by failed dependencies
      const blockedByFailed = task.dependencies.some(dep =>
        this.failedTasks.has(dep) && !this.options.continueOnFailure
      );

      if (!blockedByFailed) {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle deadlock situation (circular dependencies or all tasks blocked)
   */
  private handleDeadlock(): void {
    console.error('⚠️ Swarm deadlock detected - tasks blocked but none running');

    const unprocessedTasks = this.prd.tasks.filter(
      t => !this.completedTasks.has(t.id) && !this.failedTasks.has(t.id)
    );

    for (const task of unprocessedTasks) {
      const failedDeps = task.dependencies.filter(dep => this.failedTasks.has(dep));
      const pendingDeps = task.dependencies.filter(
        dep => !this.completedTasks.has(dep) && !this.failedTasks.has(dep)
      );

      if (failedDeps.length > 0) {
        this.postMessage({
          id: this.generateMessageId(),
          from: 'ORCHESTRATOR',
          to: task.agent,
          type: 'block',
          content: `Task ${task.id} skipped - dependencies failed: ${failedDeps.join(', ')}`,
          timestamp: new Date().toISOString(),
        });

        // Mark as skipped
        const skippedResult: SwarmAgentResult = {
          agent: task.agent,
          taskId: task.id,
          status: 'skipped',
          output: '',
          tokens: 0,
          duration: 0,
          error: `Skipped due to failed dependencies: ${failedDeps.join(', ')}`,
        };
        this.context.results.set(task.id, skippedResult);
        this.failedTasks.add(task.id);
      } else if (pendingDeps.length > 0) {
        this.postMessage({
          id: this.generateMessageId(),
          from: 'ORCHESTRATOR',
          to: task.agent,
          type: 'block',
          content: `Task ${task.id} may have circular dependencies with: ${pendingDeps.join(', ')}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Wait for all currently running agents to complete
   */
  private async waitForRunningAgents(): Promise<void> {
    while (this.runningAgents.size > 0) {
      await this.delay(100);
    }
  }

  /**
   * Build the final SwarmResult
   */
  private buildResult(totalDuration: number): SwarmResult {
    const agentResults = Array.from(this.context.results.values());

    return {
      sessionId: this.sessionId,
      totalDuration,
      agentResults,
      messages: [...this.context.channel],
      summary: {
        total: agentResults.length,
        done: agentResults.filter(r => r.status === 'done').length,
        failed: agentResults.filter(r => r.status === 'failed').length,
        skipped: agentResults.filter(r => r.status === 'skipped').length,
      },
    };
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${++this.messageCounter}`;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Convenience Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run a swarm with an existing PRD
 */
export async function runSwarm(prd: PRD, options?: SwarmOptions): Promise<SwarmResult> {
  const orchestrator = new SwarmOrchestrator(prd, options);
  return orchestrator.run();
}

/**
 * Quick swarm - generates a PRD from description then runs it
 */
export async function quickSwarm(description: string, options?: SwarmOptions): Promise<SwarmResult> {
  console.log('🌞 Generating PRD...');
  const prd = await generatePRD(description);
  console.log(`📝 Generated PRD with ${prd.tasks.length} tasks`);

  const orchestrator = new SwarmOrchestrator(prd, options);
  return orchestrator.run();
}

/**
 * Full swarm with all 21 agents - creates a comprehensive PRD then swarms it
 */
export async function fullSwarm(description: string, options?: SwarmOptions): Promise<SwarmResult> {
  console.log('🌞 Generating comprehensive PRD for full swarm...');
  const prd = await generatePRD(description);

  // Ensure we have at least representation from key agents
  const requiredAgents = ['SUN', 'EARTH', 'PLUTO', 'MERCURY', 'JUPITER', 'VENUS', 'MARS'];
  const existingAgents = new Set(prd.tasks.map(t => t.agent));

  // Add placeholder tasks for missing agents to ensure all 7 core agents participate
  const now = new Date().toISOString();
  for (const agent of requiredAgents) {
    if (!existingAgents.has(agent)) {
      prd.tasks.push({
        id: `${agent.toLowerCase()}-swarm-001`,
        title: `${agent} swarm analysis`,
        description: `Analysis and review by ${agent} agent for: ${description}`,
        agent,
        status: 'pending',
        dependencies: prd.tasks.length > 0 ? [prd.tasks[prd.tasks.length - 1].id] : [],
        phase: 1,
        attempts: 0,
        createdAt: now,
      });
    }
  }

  console.log(`📝 Full swarm PRD with ${prd.tasks.length} tasks`);
  console.log('🐝 Activating full swarm mode...');

  const orchestrator = new SwarmOrchestrator(prd, {
    ...options,
    maxConcurrency: options?.maxConcurrency ?? 7, // Higher concurrency for full swarm
  });

  return orchestrator.run();
}

/**
 * Format a swarm result into a CLI-friendly report
 */
export function formatSwarmReport(result: SwarmResult): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════════════════════╗');
  lines.push('║                    🐝 SWARM EXECUTION REPORT 🐝                  ║');
  lines.push('╚══════════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`Session ID: ${result.sessionId}`);
  lines.push(`Total Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);
  lines.push('');

  // Summary
  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│ SUMMARY                                                         │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  lines.push(`│ Total Tasks:  ${result.summary.total.toString().padEnd(47)}│`);
  lines.push(`│ ✅ Done:      ${result.summary.done.toString().padEnd(47)}│`);
  lines.push(`│ ❌ Failed:    ${result.summary.failed.toString().padEnd(47)}│`);
  lines.push(`│ ⏭️  Skipped:   ${result.summary.skipped.toString().padEnd(47)}│`);
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');

  // Agent Results
  if (result.agentResults.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────────┐');
    lines.push('│ AGENT RESULTS                                                   │');
    lines.push('├─────────────────────────────────────────────────────────────────┤');

    for (const r of result.agentResults) {
      const statusIcon = r.status === 'done' ? '✅' : r.status === 'failed' ? '❌' : r.status === 'skipped' ? '⏭️ ' : '⏳';
      const agentStr = `${r.agent}`.padEnd(8);
      const taskStr = `${r.taskId}`.slice(0, 20).padEnd(20);
      const tokenStr = `${r.tokens}tok`.padEnd(10);
      const durationStr = `${(r.duration / 1000).toFixed(2)}s`.padEnd(8);

      lines.push(`│ ${statusIcon} ${agentStr} ${taskStr} ${tokenStr} ${durationStr} │`);

      if (r.error) {
        const errorStr = r.error.slice(0, 50).padEnd(55);
        lines.push(`│    ⚠️  ${errorStr} │`);
      }
    }

    lines.push('└─────────────────────────────────────────────────────────────────┘');
    lines.push('');
  }

  // Recent Messages
  if (result.messages.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────────┐');
    lines.push('│ RECENT MESSAGES (last 10)                                       │');
    lines.push('├─────────────────────────────────────────────────────────────────┤');

    const recentMessages = result.messages.slice(-10);
    for (const msg of recentMessages) {
      const typeStr = `[${msg.type.toUpperCase()}]`.padEnd(10);
      const fromStr = msg.from.slice(0, 8).padEnd(8);
      const contentStr = msg.content.slice(0, 40).padEnd(40);
      lines.push(`│ ${typeStr} ${fromStr} → ${contentStr} │`);
    }

    lines.push('└─────────────────────────────────────────────────────────────────┘');
    lines.push('');
  }

  const successRate = result.summary.total > 0
    ? ((result.summary.done / result.summary.total) * 100).toFixed(1)
    : '0.0';

  if (result.summary.failed === 0 && result.summary.skipped === 0) {
    lines.push('🎉 All tasks completed successfully!');
  } else if (result.summary.done > 0) {
    lines.push(`⚠️  Partial success - ${successRate}% completion rate`);
  } else {
    lines.push('❌ All tasks failed or were skipped');
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy Compatibility Exports
// ═══════════════════════════════════════════════════════════════════════════════

/** @deprecated Use SwarmOrchestrator instead */
export interface SwarmTask {
  id: string;
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
  requiredAgents: string[];
  deliverables: string[];
  context?: Record<string, unknown>;
}

/** @deprecated Use SwarmOrchestrator instead */
export interface SwarmAgent {
  name: string;
  emoji: string;
  role: string;
  swarmRole: string;
  activatesWhen: (task: SwarmTask) => boolean;
}

/** @deprecated Use SwarmOrchestrator instead */
export const swarmAgents: SwarmAgent[] = [
  { name: 'SUN', emoji: '☀️', role: 'Orchestrator', swarmRole: 'Task Coordinator', activatesWhen: () => true },
  { name: 'EARTH', emoji: '🌍', role: 'Product Specs', swarmRole: 'Requirements Analyst', activatesWhen: () => true },
  { name: 'PLUTO', emoji: '🪐', role: 'Database', swarmRole: 'Data Architect', activatesWhen: () => true },
  { name: 'MARS', emoji: '🔴', role: 'Backend', swarmRole: 'Implementation Specialist', activatesWhen: () => true },
  { name: 'VENUS', emoji: '💫', role: 'Frontend', swarmRole: 'Interface Designer', activatesWhen: () => true },
  { name: 'MERCURY', emoji: '☿️', role: 'Validator', swarmRole: 'Quality Gatekeeper', activatesWhen: () => true },
  { name: 'JUPITER', emoji: '🟠', role: 'Architecture', swarmRole: 'Strategy Advisor', activatesWhen: () => true },
  { name: 'TITAN', emoji: '🌙', role: 'Real-time', swarmRole: 'Live Data Handler', activatesWhen: () => true },
  { name: 'SATURN', emoji: '🪐', role: 'Testing', swarmRole: 'Verification Specialist', activatesWhen: () => true },
  { name: 'URANUS', emoji: '🔭', role: 'Research', swarmRole: 'Knowledge Gatherer', activatesWhen: () => true },
  { name: 'NEPTUNE', emoji: '🔵', role: 'Analytics', swarmRole: 'Metrics Collector', activatesWhen: () => true }
];

/** @deprecated Use runSwarm instead */
export async function executeSwarmMode(task: SwarmTask): Promise<void> {
  console.log('\n🐝'.repeat(20));
  console.log('     SWARM MODE ACTIVATED');
  console.log('🐝'.repeat(20) + '\n');

  console.log(`🎯 Mission: ${task.description}`);
  console.log(`📊 Complexity: ${task.complexity.toUpperCase()}`);
  console.log(`👥 Active Agents: ${task.requiredAgents.join(', ')}\n`);

  const activeAgents = swarmAgents.filter(a => a.activatesWhen(task));

  for (const agent of activeAgents) {
    console.log(`${agent.emoji} ${agent.name}: ${agent.swarmRole}...`);
    await new Promise(r => setTimeout(r, 500)); // Simulate work
  }

  console.log('\n✅ Swarm mission complete!');
}
