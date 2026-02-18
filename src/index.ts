#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { cmdWatch } from './cli/watch.js';
import { cmdInit } from './cli/init.js';

// Ensure .nova directory exists
const novaDir = join(process.cwd(), '.nova');
const outputDir = join(novaDir, 'output');
const agentsDir = join(novaDir, 'agents');
const atlasDir = join(novaDir, 'atlas');

function ensureDirectories(): void {
  if (!existsSync(novaDir)) mkdirSync(novaDir, { recursive: true });
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  if (!existsSync(agentsDir)) mkdirSync(agentsDir, { recursive: true });
  if (!existsSync(atlasDir)) mkdirSync(atlasDir, { recursive: true });
}

function loadPRD(prdPath: string): any {
  const fullPath = join(process.cwd(), prdPath);
  if (!existsSync(fullPath)) {
    console.error(`PRD file not found: ${fullPath}`);
    process.exit(1);
  }
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

function savePRD(prdPath: string, prd: any): void {
  const fullPath = join(process.cwd(), prdPath);
  writeFileSync(fullPath, JSON.stringify(prd, null, 2));
}

function getTaskStatus(prd: any): { ready: number; pending: number; running: number; done: number; failed: number; blocked: number } {
  const status = { ready: 0, pending: 0, running: 0, done: 0, failed: 0, blocked: 0 };
  for (const task of prd.tasks) {
    if (status[task.status as keyof typeof status] !== undefined) {
      status[task.status as keyof typeof status]++;
    }
  }
  return status;
}

function cmdStatus(prdPath: string): void {
  const prd = loadPRD(prdPath);
  const status = getTaskStatus(prd);
  
  console.log(`\n=== PRD Status: ${prd.meta?.name || prdPath} ===\n`);
  console.log(`Total Tasks: ${prd.tasks.length}`);
  console.log(`  Ready:    ${status.ready}`);
  console.log(`  Pending:  ${status.pending}`);
  console.log(`  Running:  ${status.running}`);
  console.log(`  Done:     ${status.done}`);
  console.log(`  Failed:   ${status.failed}`);
  console.log(`  Blocked:  ${status.blocked}`);
  
  // Show tasks by phase
  const phases = new Map<number, { total: number; done: number }>();
  for (const task of prd.tasks) {
    if (!phases.has(task.phase)) {
      phases.set(task.phase, { total: 0, done: 0 });
    }
    const p = phases.get(task.phase)!;
    p.total++;
    if (task.status === 'done') p.done++;
  }
  
  console.log(`\nBy Phase:`);
  for (const [phase, stats] of phases) {
    console.log(`  Phase ${phase}: ${stats.done}/${stats.total} done`);
  }
  
  // Show ready tasks
  const readyTasks = prd.tasks.filter((t: any) => t.status === 'ready');
  if (readyTasks.length > 0) {
    console.log(`\nReady Tasks:`);
    for (const task of readyTasks) {
      const deps = task.dependencies?.length ? ` (deps: ${task.dependencies.join(', ')})` : '';
      console.log(`  - ${task.id}: ${task.title}${deps}`);
    }
  }
  
  console.log('');
}

function cmdReset(prdPath: string): void {
  const prd = loadPRD(prdPath);
  
  // Reset all tasks to pending/ready based on phase
  for (const task of prd.tasks) {
    if (task.phase === 0) {
      task.status = 'ready';
    } else {
      task.status = 'pending';
    }
    task.attempts = 0;
    task.error = undefined;
    task.output = undefined;
  }
  
  savePRD(prdPath, prd);
  console.log('PRD reset complete. Phase 0 tasks set to ready, others to pending.');
}

async function cmdRun(prdPath: string): Promise<void> {
  const prd = loadPRD(prdPath);
  
  console.log(`\n=== Running PRD: ${prd.meta?.name || prdPath} ===\n`);
  
  // Import and run the orchestrator
  try {
    const { ralphLoop } = await import('./orchestrator/ralph-loop.js');
    await ralphLoop(prd, prdPath);
  } catch (error) {
    console.error('Error running orchestrator:', error);
    process.exit(1);
  }
}

/**
 * Generate a PRD using the SUN agent
 * Takes a natural language description and creates a structured PRD
 */
async function cmdGenerate(description: string, outputPath?: string): Promise<void> {
  console.log(`\n=== Generating PRD with SUN Agent ===\n`);
  console.log(`Description: ${description}\n`);
  
  // Default output path
  const prdPath = outputPath || join(novaDir, `prd-${Date.now()}.json`);
  
  try {
    // Import the SUN agent PRD generator
    const { generatePRD } = await import('./agents/sun-prd-generator.js');
    
    const prd = await generatePRD(description);
    
    // Save the generated PRD
    savePRD(prdPath, prd);
    
    console.log(`\n✅ PRD generated successfully!`);
    console.log(`   Saved to: ${prdPath}`);
    console.log(`   Tasks: ${prd.tasks.length}`);
    console.log(`\nRun with: nova26 run ${prdPath}`);
  } catch (error) {
    console.error('Error generating PRD:', error);
    process.exit(1);
  }
}

function cmdHelp(): void {
  console.log(`
NOVA26 CLI

Usage:
  nova26 status <prd-file>    Show PRD status
  nova26 reset <prd-file>     Reset PRD tasks
  nova26 run <prd-file>       Run PRD tasks
  nova26 watch <prd-file>     Watch src/ for changes and auto-rebuild
  nova26 generate <desc>      Generate PRD using SUN agent
  nova26 init [options]       Initialize NOVA26 project
  nova26 -h, --help           Show this help

Examples:
  nova26 status .nova/prd-test.json
  nova26 reset .nova/prd-test.json
  nova26 run .nova/prd-test.json
  nova26 watch .nova/prd-test.json
  nova26 generate "Build a task management app"
  nova26 init                 # Interactive setup
  nova26 init --yes           # Non-interactive setup
`);
}

// CLI main
async function main(): Promise<void> {
  ensureDirectories();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    cmdHelp();
    process.exit(1);
  }
  
  switch (command) {
    case 'status':
      if (!args[1]) {
        console.error('Missing PRD file path');
        process.exit(1);
      }
      cmdStatus(args[1]);
      break;
      
    case 'reset':
      if (!args[1]) {
        console.error('Missing PRD file path');
        process.exit(1);
      }
      cmdReset(args[1]);
      break;
      
    case 'run':
      if (!args[1]) {
        console.error('Missing PRD file path');
        process.exit(1);
      }
      await cmdRun(args[1]);
      break;
      
    case 'generate':
      if (!args[1]) {
        console.error('Missing project description');
        console.error('Usage: nova26 generate "Build a task management app"');
        process.exit(1);
      }
      // Join remaining args as description
      const description = args.slice(1).join(' ');
      await cmdGenerate(description);
      break;
      
    case 'watch':
      if (!args[1]) {
        console.error('Missing PRD file path');
        console.error('Usage: nova26 watch <prd-file>');
        process.exit(1);
      }
      await cmdWatch(args[1]);
      break;
      
    case 'init':
      await cmdInit(args.slice(1));
      break;
      
    case '-h':
    case '--help':
      cmdHelp();
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      cmdHelp();
      process.exit(1);
  }
}

main().catch(console.error);
