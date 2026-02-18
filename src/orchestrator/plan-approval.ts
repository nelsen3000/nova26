// KIMI-AUTO-03: Interactive Plan Approval System for NOVA26
// Provides file-based plan approval with timeout behavior based on autonomy level

import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  watch,
  type FSWatcher,
} from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import type { Task } from '../types/index.js';
import type { AutonomyLevel } from '../config/autonomy.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of a plan approval request
 */
export type ApprovalResult =
  | { type: 'approved' }
  | { type: 'rejected'; reason: string }
  | { type: 'modified'; plan: string };

/**
 * Options for configuring plan approval behavior
 */
export interface PlanApprovalOptions {
  /** Auto-approve after this time (0 = infinite) */
  timeoutMs?: number;
  /** How often to check for response */
  pollIntervalMs?: number;
  /** Where to write pending plan */
  planFilePath?: string;
  /** Where to read response */
  responseFilePath?: string;
}

/**
 * Represents a pending plan approval
 */
export interface PendingApproval {
  id: string;
  taskId: string;
  plan: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  response?: ApprovalResult;
}

/**
 * Response file format for external approval tools
 */
interface ApprovalResponseFile {
  approvalId: string;
  result: 'approved' | 'rejected' | 'modified';
  modifiedPlan?: string;
  reason?: string;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_NOVA_DIR = join(process.cwd(), '.nova');
const DEFAULT_PLAN_FILE = join(DEFAULT_NOVA_DIR, 'pending-approval.json');
const DEFAULT_RESPONSE_FILE = join(DEFAULT_NOVA_DIR, 'approval-response.json');

// Timeout defaults by autonomy level
const TIMEOUT_BY_LEVEL: Record<AutonomyLevel, number> = {
  1: 0, // Infinite - wait forever
  2: 0, // Infinite - wait forever
  3: 5 * 60 * 1000, // 5 minutes
  4: 60 * 1000, // 1 minute (auto-approve)
  5: 60 * 1000, // 1 minute (auto-approve)
};

// ═══════════════════════════════════════════════════════════════════════════════
// Active Polls Registry
// ═══════════════════════════════════════════════════════════════════════════════

interface ActivePoll {
  timeoutId: ReturnType<typeof setTimeout>;
  watcher?: FSWatcher;
  resolve: (value: ApprovalResult) => void;
  reject: (reason: Error) => void;
}

const activePolls = new Map<string, ActivePoll>();

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request approval for a plan. This writes the plan to a file and polls for a response.
 * Timeout behavior is determined by autonomy level if not explicitly specified.
 *
 * @param plan - The plan text to get approval for
 * @param task - The task this plan is for
 * @param options - Optional configuration for the approval request
 * @returns Promise resolving to the approval result
 */
export async function requestApproval(
  plan: string,
  task: Task,
  options?: PlanApprovalOptions
): Promise<ApprovalResult> {
  const pending = writePendingApproval(plan, task, options?.planFilePath);

  const pollOptions: PlanApprovalOptions = {
    timeoutMs: options?.timeoutMs ?? getDefaultTimeoutForTask(task),
    pollIntervalMs: options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    planFilePath: options?.planFilePath ?? DEFAULT_PLAN_FILE,
    responseFilePath: options?.responseFilePath ?? DEFAULT_RESPONSE_FILE,
  };

  try {
    const result = await pollForApproval(pending.id, pollOptions);
    cleanupApprovalFiles(pollOptions);
    return result;
  } catch (error) {
    cleanupApprovalFiles(pollOptions);
    throw error;
  }
}

/**
 * Write a pending approval to the file system.
 * Creates the necessary directories if they don't exist.
 *
 * @param plan - The plan text
 * @param task - The associated task
 * @param filePath - Optional custom file path
 * @returns The pending approval object
 */
export function writePendingApproval(
  plan: string,
  task: Task,
  filePath?: string
): PendingApproval {
  const targetPath = filePath ?? DEFAULT_PLAN_FILE;
  const approvalId = generateApprovalId();

  // Ensure directory exists
  const dir = dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const pending: PendingApproval = {
    id: approvalId,
    taskId: task.id,
    plan,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };

  writeFileSync(targetPath, JSON.stringify(pending, null, 2), 'utf-8');
  return pending;
}

/**
 * Read an approval response from the file system.
 *
 * @param approvalId - The ID of the approval to read
 * @param filePath - Optional custom response file path
 * @returns The approval result, or null if no valid response found
 */
export function readApprovalResponse(
  approvalId: string,
  filePath?: string
): ApprovalResult | null {
  const targetPath = filePath ?? DEFAULT_RESPONSE_FILE;

  if (!existsSync(targetPath)) {
    return null;
  }

  try {
    const content = readFileSync(targetPath, 'utf-8');
    const response: ApprovalResponseFile = JSON.parse(content);

    // Verify this response is for our approval
    if (response.approvalId !== approvalId) {
      return null;
    }

    switch (response.result) {
      case 'approved':
        return { type: 'approved' };
      case 'rejected':
        return { type: 'rejected', reason: response.reason ?? 'No reason provided' };
      case 'modified':
        return {
          type: 'modified',
          plan: response.modifiedPlan ?? '',
        };
      default:
        return null;
    }
  } catch {
    // File doesn't exist, isn't valid JSON, or doesn't match our approval ID
    return null;
  }
}

/**
 * Poll for an approval response.
 * Uses file watching for faster response when available, with polling fallback.
 *
 * @param approvalId - The ID to poll for
 * @param options - Polling configuration
 * @returns Promise resolving to the approval result
 */
export function pollForApproval(
  approvalId: string,
  options: PlanApprovalOptions
): Promise<ApprovalResult> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? 0;
  const responseFilePath = options.responseFilePath ?? DEFAULT_RESPONSE_FILE;

  return new Promise((resolve, reject) => {
    // Check if already cancelled
    if (!activePolls.has(approvalId) && timeoutMs === 0) {
      // This is a fresh poll, register it
      activePolls.set(approvalId, {
        timeoutId: undefined as unknown as ReturnType<typeof setTimeout>,
        resolve,
        reject,
      });
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let watcher: FSWatcher | undefined;
    let resolved = false;

    const cleanup = (): void => {
      resolved = true;
      activePolls.delete(approvalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      if (watcher) {
        watcher.close();
      }
    };

    const checkResponse = (): void => {
      if (resolved) return;

      const result = readApprovalResponse(approvalId, responseFilePath);
      if (result) {
        cleanup();
        resolve(result);
      }
    };

    // Set up timeout if specified
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          cleanup();
          // Auto-approve on timeout
          resolve({ type: 'approved' });
        }
      }, timeoutMs);
    }

    // Try to use file watcher for faster response
    try {
      const responseDir = dirname(responseFilePath);
      if (existsSync(responseDir)) {
        watcher = watch(responseDir, (_eventType, filename) => {
          if (filename && responseFilePath.endsWith(filename)) {
            checkResponse();
          }
        });
      }
    } catch {
      // File watching not available, fall back to polling only
    }

    // Always use polling as a fallback
    intervalId = setInterval(checkResponse, pollIntervalMs);

    // Do an immediate check
    checkResponse();

    // Update the registry with cleanup function
    activePolls.set(approvalId, {
      timeoutId: timeoutId ?? (setTimeout(() => {}, 0) as ReturnType<typeof setTimeout>),
      watcher,
      resolve,
      reject,
    });
  });
}

/**
 * Cancel an active approval poll.
 * This will reject the pending promise with a cancellation error.
 *
 * @param approvalId - The ID of the approval to cancel
 */
export function cancelApproval(approvalId: string): void {
  const poll = activePolls.get(approvalId);
  if (poll) {
    activePolls.delete(approvalId);
    poll.reject(new Error(`Approval ${approvalId} was cancelled`));
    if (poll.watcher) {
      poll.watcher.close();
    }
  }
}

/**
 * Format a plan for human-readable approval display.
 * Includes task context and formatting.
 *
 * @param plan - The raw plan text
 * @param task - The task this plan is for
 * @returns Formatted plan string
 */
export function formatPlanForApproval(plan: string, task: Task): string {
  const lines: string[] = [
    '╔══════════════════════════════════════════════════════════════════════════════╗',
    `║  PLAN APPROVAL REQUEST: ${task.id.padEnd(53)}║`,
    '╠══════════════════════════════════════════════════════════════════════════════╣',
    `║  Title: ${task.title.substring(0, 58).padEnd(58)}║`,
    `║  Agent: ${task.agent.padEnd(58)}║`,
    '╠══════════════════════════════════════════════════════════════════════════════╣',
    '║  Description:                                                                ║',
  ];

  // Wrap description
  const descLines = wrapLines(task.description, 64);
  for (const line of descLines) {
    lines.push(`║  ${line.padEnd(76)}║`);
  }

  lines.push(
    '╠══════════════════════════════════════════════════════════════════════════════╣',
    '║  PLAN:                                                                       ║'
  );

  // Format the plan with proper indentation
  const planLines = plan.split('\n');
  for (const line of planLines) {
    const wrapped = wrapLines(line, 74);
    for (const wrappedLine of wrapped) {
      lines.push(`║  ${wrappedLine.padEnd(76)}║`);
    }
  }

  lines.push(
    '╠══════════════════════════════════════════════════════════════════════════════╣',
    '║  ACTIONS:                                                                    ║',
    '║    [APPROVE]  - Execute this plan as written                                 ║',
    '║    [REJECT]   - Cancel this task (provide reason)                            ║',
    '║    [MODIFY]   - Edit the plan and then approve                               ║',
    '╚══════════════════════════════════════════════════════════════════════════════╝'
  );

  return lines.join('\n');
}

/**
 * Get the default timeout for a task based on its autonomy level.
 * Uses environment variable or falls back to level 3 (balanced).
 *
 * @param task - The task to get timeout for
 * @returns Timeout in milliseconds (0 = infinite)
 */
export function getDefaultTimeoutForTask(task: Task): number {
  // Check for task-specific autonomy level in context
  const taskLevel = task.context?.autonomyLevel as AutonomyLevel | undefined;
  if (taskLevel && isValidAutonomyLevel(taskLevel)) {
    return TIMEOUT_BY_LEVEL[taskLevel];
  }

  // Check environment variable
  const envLevel = process.env.NOVA26_AUTONOMY_LEVEL;
  if (envLevel) {
    const level = parseInt(envLevel, 10);
    if (isValidAutonomyLevel(level)) {
      return TIMEOUT_BY_LEVEL[level];
    }
  }

  // Default to level 3 (balanced)
  return TIMEOUT_BY_LEVEL[3];
}

/**
 * Check if a value is a valid autonomy level (1-5)
 */
function isValidAutonomyLevel(level: unknown): level is AutonomyLevel {
  return typeof level === 'number' && level >= 1 && level <= 5;
}

/**
 * Generate a unique approval ID
 */
function generateApprovalId(): string {
  return `approval-${randomUUID()}`;
}

/**
 * Clean up approval files after processing
 */
function cleanupApprovalFiles(options: PlanApprovalOptions): void {
  const planFile = options.planFilePath ?? DEFAULT_PLAN_FILE;
  const responseFile = options.responseFilePath ?? DEFAULT_RESPONSE_FILE;

  try {
    if (existsSync(planFile)) {
      unlinkSync(planFile);
    }
  } catch {
    // Ignore cleanup errors
  }

  try {
    if (existsSync(responseFile)) {
      unlinkSync(responseFile);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Wrap text into lines of maximum width
 */
function wrapLines(text: string, maxWidth: number): string[] {
  if (!text) return [''];

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxWidth) {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Exports for Testing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all active poll IDs (for testing/debugging)
 */
export function getActivePollIds(): string[] {
  return Array.from(activePolls.keys());
}

/**
 * Clear all active polls (for testing)
 */
export function clearAllPolls(): void {
  for (const [, poll] of activePolls) {
    try {
      poll.reject(new Error('Poll cleared'));
      if (poll.watcher) {
        poll.watcher.close();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  activePolls.clear();
}

/**
 * Write an approval response file (for testing and external tools)
 */
export function writeApprovalResponse(
  approvalId: string,
  result: ApprovalResult,
  filePath?: string
): void {
  const targetPath = filePath ?? DEFAULT_RESPONSE_FILE;
  const dir = dirname(targetPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const response: ApprovalResponseFile = {
    approvalId,
    result: result.type,
    timestamp: new Date().toISOString(),
  };

  if (result.type === 'rejected') {
    response.reason = result.reason;
  } else if (result.type === 'modified') {
    response.modifiedPlan = result.plan;
  }

  writeFileSync(targetPath, JSON.stringify(response, null, 2), 'utf-8');
}
