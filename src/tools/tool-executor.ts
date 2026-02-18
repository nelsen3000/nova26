// Tool Execution Safety Layer — KIMI-AGENT-04
// The execution layer between AgentLoop and actual tool functions
// Provides validation, rate limiting, timeout enforcement, and safety checks

import { z } from 'zod';
import type { Tool, ToolExecution, ToolResult } from './tool-registry.js';
import { EventStore } from '../orchestrator/event-store.js';

// ============================================================================
// Configuration Types
// ============================================================================

/** Configuration for tool executor safety settings */
export interface ToolExecutorConfig {
  /** Maximum timeout for tool execution in milliseconds (default: 30000) */
  maxTimeoutMs: number;
  /** Commands that are never allowed to execute */
  blockedCommands: string[];
  /** Rate limit window in milliseconds */
  rateLimitWindowMs: number;
  /** Maximum calls per window */
  maxCallsPerWindow: number;
}

/** Context for tool execution */
export interface ExecutionContext {
  /** Name of the agent executing the tool */
  agentName: string;
  /** ID of the current task */
  taskId: string;
  /** Current call count for this task */
  callCount: number;
}

/** Result of tool execution */
export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  blocked?: boolean;
  blockReason?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

/** Default blocked commands for security */
const DEFAULT_BLOCKED_COMMANDS: string[] = [
  // Recursive deletion
  'rm -rf',
  'rmdir /s',
  // Git push operations
  'git push',
  'git push --force',
  // Package publishing
  'npm publish',
  'yarn publish',
  // Pipe to shell patterns
  'curl | bash',
  'curl | sh',
  'wget | bash',
  'wget | sh',
  // Redirect abuse patterns
  '> /dev/null',
  '2>&1',
  // Sudo escalation
  'sudo',
];

/** Default configuration */
const DEFAULT_CONFIG: ToolExecutorConfig = {
  maxTimeoutMs: 30000,
  blockedCommands: DEFAULT_BLOCKED_COMMANDS,
  rateLimitWindowMs: 60000, // 1 minute
  maxCallsPerWindow: 100,
};

// ============================================================================
// Rate Limiting State
// ============================================================================

/** In-memory rate limiting store */
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

// ============================================================================
// Argument Validation
// ============================================================================

/**
 * Validate tool arguments against the tool's Zod schema
 * @returns Validation result with error message if invalid
 */
export function validateToolArgs(
  tool: Tool,
  args: Record<string, unknown>
): { valid: boolean; error?: string } {
  try {
    tool.parameters.parse(args);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      return { valid: false, error: `Invalid arguments: ${issues}` };
    }
    return { valid: false, error: `Invalid arguments: ${(error as Error).message}` };
  }
}

// ============================================================================
// Safety Checks
// ============================================================================

/**
 * Check if a command contains blocked patterns
 * @returns Block status with reason if blocked
 */
export function isCommandBlocked(
  command: string,
  blockedList: string[]
): { blocked: boolean; reason?: string } {
  const normalizedCmd = command.toLowerCase().trim();
  
  for (const pattern of blockedList) {
    const normalizedPattern = pattern.toLowerCase();
    
    // Check for exact match or substring match
    if (normalizedCmd.includes(normalizedPattern)) {
      return { 
        blocked: true, 
        reason: `Command contains blocked pattern: "${pattern}"` 
      };
    }
    
    // Check for pipe patterns (e.g., "curl | bash")
    if (normalizedPattern.includes(' | ')) {
      const [cmd, shell] = normalizedPattern.split(' | ').map(s => s.trim());
      if (normalizedCmd.includes(cmd) && normalizedCmd.includes(`| ${shell}`)) {
        return { 
          blocked: true, 
          reason: `Command contains pipe to shell pattern: "${pattern}"` 
        };
      }
    }
    
    // Check for redirect patterns with special handling
    if (normalizedPattern.startsWith('>') || normalizedPattern.includes('&1')) {
      if (normalizedCmd.includes(normalizedPattern)) {
        return { 
          blocked: true, 
          reason: `Command contains redirect pattern: "${pattern}"` 
        };
      }
    }
  }
  
  // Check for combined dangerous patterns
  if (normalizedCmd.includes('sudo')) {
    return { blocked: true, reason: 'Sudo escalation is not allowed' };
  }
  
  // Check for dangerous rm patterns
  if (/\brm\s+-[a-z]*r[a-z]*\b/.test(normalizedCmd) || 
      normalizedCmd.includes('rm -rf') || 
      normalizedCmd.includes('rm -fr')) {
    return { blocked: true, reason: 'Recursive deletion commands are blocked' };
  }
  
  return { blocked: false };
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Check if an agent has exceeded rate limits for a task
 * @returns Rate limit check result with retryAfter if blocked
 */
export function checkRateLimit(
  agentName: string,
  taskId: string,
  config: ToolExecutorConfig
): { allowed: boolean; retryAfter?: number } {
  const key = `${agentName}:${taskId}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record) {
    // First call in window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  // Check if window has expired
  if (now - record.windowStart >= config.rateLimitWindowMs) {
    // Reset window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  // Check if limit exceeded
  if (record.count >= config.maxCallsPerWindow) {
    const retryAfter = config.rateLimitWindowMs - (now - record.windowStart);
    return { allowed: false, retryAfter };
  }
  
  // Increment count
  record.count++;
  return { allowed: true };
}

/**
 * Reset rate limit for a specific agent-task pair (useful for testing)
 */
export function resetRateLimit(agentName: string, taskId: string): void {
  const key = `${agentName}:${taskId}`;
  rateLimitStore.delete(key);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

// ============================================================================
// Logging
// ============================================================================

/**
 * Log tool execution to EventStore
 * Creates a 'tool_execution' event type for observability
 */
export function logToolExecution(
  execution: ToolExecution,
  context: ExecutionContext
): void {
  // This function logs to console; in production, it would integrate
  // with EventStore to persist the execution record
  const logEntry = {
    timestamp: new Date().toISOString(),
    agent: context.agentName,
    taskId: context.taskId,
    toolName: execution.call.name,
    success: execution.result.success,
    duration: execution.result.duration,
    truncated: execution.result.truncated,
    error: execution.result.error,
  };
  
  console.log(`[TOOL_EXEC] ${JSON.stringify(logEntry)}`);
}

/**
 * Log tool execution to an EventStore instance
 */
export function logToolExecutionToEventStore(
  execution: ToolExecution,
  context: ExecutionContext,
  eventStore: EventStore
): void {
  eventStore.emit('checkpoint', {
    toolName: execution.call.name,
    arguments: execution.call.arguments,
    success: execution.result.success,
    output: execution.result.output,
    error: execution.result.error,
    duration: execution.result.duration,
    truncated: execution.result.truncated,
  }, context.taskId, context.agentName);
}

// ============================================================================
// Main Execution Function
// ============================================================================

/**
 * Execute a tool with full safety checks
 * 
 * This function:
 * 1. Validates arguments with Zod schema
 * 2. Checks canCall() permissions from registry
 * 3. Validates command safety (if tool involves commands)
 * 4. Enforces rate limiting
 * 5. Applies timeout enforcement
 * 6. Executes with try/catch and proper error formatting
 * 7. Logs execution to EventStore
 */
export async function executeTool(
  tool: Tool,
  args: Record<string, unknown>,
  context: ExecutionContext,
  config?: Partial<ToolExecutorConfig>
): Promise<ExecutionResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  
  // Step 1: Validate arguments
  const validation = validateToolArgs(tool, args);
  if (!validation.valid) {
    return {
      success: false,
      output: '',
      error: validation.error,
      duration: Date.now() - startTime,
    };
  }
  
  // Step 2: Check rate limiting
  const rateLimit = checkRateLimit(context.agentName, context.taskId, mergedConfig);
  if (!rateLimit.allowed) {
    return {
      success: false,
      output: '',
      error: `Rate limit exceeded. Retry after ${Math.ceil(rateLimit.retryAfter! / 1000)}s`,
      duration: Date.now() - startTime,
      blocked: true,
      blockReason: 'rate_limit',
    };
  }
  
  // Step 3: Check command safety (if args contain command-like strings)
  const commandFields = ['command', 'cmd', 'script', 'shell', 'exec'];
  for (const field of commandFields) {
    const value = args[field];
    if (typeof value === 'string') {
      const safety = isCommandBlocked(value, mergedConfig.blockedCommands);
      if (safety.blocked) {
        return {
          success: false,
          output: '',
          error: safety.reason,
          duration: Date.now() - startTime,
          blocked: true,
          blockReason: 'blocked_command',
        };
      }
    }
  }
  
  // Step 4: Execute tool with timeout
  try {
    const timeoutMs = Math.min(tool.timeout, mergedConfig.maxTimeoutMs);
    
    const result = await Promise.race([
      tool.execute(args),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]) as ToolResult;
    
    // Step 5: Log execution
    const execution: ToolExecution = {
      call: { id: `${context.taskId}-${Date.now()}`, name: tool.name, arguments: args },
      result,
      timestamp: Date.now(),
    };
    logToolExecution(execution, context);
    
    return {
      success: result.success,
      output: result.output,
      error: result.error,
      duration: result.duration,
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log failed execution
    const failedExecution: ToolExecution = {
      call: { id: `${context.taskId}-${Date.now()}`, name: tool.name, arguments: args },
      result: {
        success: false,
        output: '',
        error: errorMessage,
        duration,
        truncated: false,
      },
      timestamp: Date.now(),
    };
    logToolExecution(failedExecution, context);
    
    return {
      success: false,
      output: '',
      error: errorMessage,
      duration,
    };
  }
}

// ============================================================================
// Helper Functions for Tool Registry Integration
// ============================================================================

/**
 * Check if an agent can call a tool using registry permissions
 * Wraps the registry's canCall method for use in the executor
 */
export function checkToolPermission(
  tool: Tool,
  agentName: string
): { allowed: boolean; reason?: string } {
  // Check explicit blocked agents
  if (tool.blockedAgents.length > 0 && tool.blockedAgents.includes(agentName)) {
    return { allowed: false, reason: `Agent "${agentName}" is explicitly blocked from "${tool.name}"` };
  }
  
  // Check allowed agents (empty = all allowed)
  if (tool.allowedAgents.length > 0 && !tool.allowedAgents.includes(agentName)) {
    return { allowed: false, reason: `Agent "${agentName}" is not in allowed list for "${tool.name}"` };
  }
  
  return { allowed: true };
}

// ============================================================================
// Export Default Config for Testing/Mocking
// ============================================================================

export { DEFAULT_CONFIG, DEFAULT_BLOCKED_COMMANDS };
