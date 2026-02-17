// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Get current timestamp in ISO format
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Log a general message with timestamp
 */
export function log(message: string): void {
  console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${message}`);
}

/**
 * Log a success message with green checkmark
 */
export function success(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

/**
 * Log an error message with red X
 */
export function error(message: string): void {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

/**
 * Log a warning message with yellow warning sign
 */
export function warn(message: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

/**
 * Log an info message with blue info sign
 */
export function info(message: string): void {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

/**
 * Log a task start message
 */
export function taskStart(taskId: string, title: string, agent: string): void {
  console.log(`${colors.cyan}▶${colors.reset} Task ${taskId}: ${title} — Agent: ${agent}`);
}

/**
 * Log a task complete message
 */
export function taskComplete(taskId: string): void {
  console.log(`${colors.green}✓${colors.reset} Task ${taskId} PASSED all gates`);
}

/**
 * Log a task blocked message
 */
export function taskBlocked(taskId: string, reason: string): void {
  console.log(`${colors.red}✗${colors.reset} Task ${taskId} BLOCKED: ${reason}`);
}

/**
 * Log gate failure
 */
export function gateFailed(gateName: string, message: string): void {
  console.log(`${colors.red}✗${colors.reset} Gate failed: ${gateName}. ${message}`);
}

/**
 * Log a debug message (only in development)
 */
export function debug(message: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${colors.gray}[DEBUG]${colors.reset} ${message}`);
  }
}

/**
 * Print a section header
 */
export function sectionHeader(title: string): void {
  console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.magenta}${title}${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);
}

/**
 * Print a summary table
 */
export function summaryTable(stats: {
  total: number;
  done: number;
  blocked: number;
  durationMs: number;
}): void {
  const durationSec = (stats.durationMs / 1000).toFixed(2);
  console.log(`\n${colors.cyan}=== Build Summary ===${colors.reset}`);
  console.log(`Total tasks:   ${stats.total}`);
  console.log(`${colors.green}Done:${colors.reset}        ${stats.done}`);
  console.log(`${colors.red}Blocked:${colors.reset}     ${stats.blocked}`);
  console.log(`Duration:     ${durationSec}s\n`);
}
