#!/usr/bin/env node

import { readJSON, writeJSON, getNovaPath } from './utils/file-io.js';
import { log, success, error, info, sectionHeader } from './utils/logger.js';
import { runRalphLoop } from './orchestrator/ralph-loop.js';
import { getTaskCounts, resetAllTasks } from './orchestrator/task-picker.js';
import { checkOllamaConnection } from './llm/ollama-client.js';
import { PRD } from './types/index.js';

const DEFAULT_PRD_PATH = '.nova/prd.json';

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'help';
  
  switch (command) {
    case 'run':
      await runCommand(args[1] ?? DEFAULT_PRD_PATH);
      break;
    case 'status':
      await statusCommand(args[1] ?? DEFAULT_PRD_PATH);
      break;
    case 'reset':
      await resetCommand(args[1] ?? DEFAULT_PRD_PATH);
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

/**
 * Run the Ralph Loop
 */
async function runCommand(prdPath: string): Promise<void> {
  sectionHeader('NOVA26 Orchestrator');
  
  // Check Ollama connection
  info('Checking Ollama connection...');
  const ollamaRunning = await checkOllamaConnection();
  
  if (!ollamaRunning) {
    error('Cannot connect to Ollama at http://localhost:11434');
    error('Please ensure Ollama is running: ollama serve');
    process.exit(1);
  }
  
  success('Ollama is running');
  
  // Run the orchestrator
  try {
    await runRalphLoop(prdPath);
    success('Build complete!');
  } catch (err) {
    error(`Build failed: ${err}`);
    process.exit(1);
  }
}

/**
 * Show task status
 */
async function statusCommand(prdPath: string): Promise<void> {
  sectionHeader('Task Status');
  
  try {
    const prd = await readJSON<PRD>(prdPath);
    const counts = getTaskCounts(prd);
    
    log(`Project: ${prd.projectName}`);
    log(`Version: ${prd.version}`);
    console.log('');
    
    console.log(`Total tasks:    ${counts.total}`);
    console.log(`Ready:          ${counts.ready}`);
    console.log(`In Progress:    ${counts.inProgress}`);
    success(`Done:          ${counts.done}`);
    error(`Blocked:        ${counts.blocked}`);
    console.log('');
    
    // Show task details by phase
    for (const phase of prd.phases) {
      console.log(`\n${'='.repeat(40)}`);
      console.log(`Phase ${phase.id}: ${phase.name}`);
      console.log('='.repeat(40));
      
      for (const task of phase.tasks) {
        const statusIcon = getStatusIcon(task.status);
        console.log(`${statusIcon} ${task.id}: ${task.title} (${task.agent})`);
        
        if (task.status === 'blocked' && task.blockedReason) {
          console.log(`   Reason: ${task.blockedReason}`);
        }
      }
    }
    
  } catch (err) {
    error(`Failed to read PRD: ${err}`);
    process.exit(1);
  }
}

/**
 * Reset all tasks to ready
 */
async function resetCommand(prdPath: string): Promise<void> {
  sectionHeader('Reset Tasks');
  
  try {
    const prd = await readJSON<PRD>(prdPath);
    const counts = getTaskCounts(prd);
    
    log(`Current status: ${counts.done} done, ${counts.blocked} blocked`);
    
    const resetPrd = resetAllTasks(prd);
    await writeJSON(prdPath, resetPrd);
    
    success('All tasks reset to ready');
    
  } catch (err) {
    error(`Failed to reset: ${err}`);
    process.exit(1);
  }
}

/**
 * Get status icon for console output
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'ready':
      return '○';
    case 'in_progress':
      return '◐';
    case 'done':
      return '●';
    case 'blocked':
      return '✗';
    case 'pending':
      return '·';
    default:
      return '?';
  }
}

/**
 * Print help text
 */
function printHelp(): void {
  console.log(`
NOVA26 Orchestrator

Usage: nova <command> [options]

Commands:
  run [prd]     Run the Ralph Loop on the PRD (default: .nova/prd.json)
  status [prd]  Show task statuses (default: .nova/prd.json)
  reset [prd]  Reset all tasks to ready (default: .nova/prd.json)
  help          Show this help message

Examples:
  nova run                    # Run default PRD
  nova run .nova/prd-test.json # Run test PRD
  nova status                 # Show task status
  nova reset                  # Reset all tasks
  `);
}

// Run the CLI
main().catch(err => {
  error(`Fatal error: ${err}`);
  process.exit(1);
});
