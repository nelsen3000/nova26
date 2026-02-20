// KMS-21: /health CLI command for module health monitoring
// Uses src/orchestrator/module-health.ts

import {
  ModuleHealthChecker,
  type ModuleHealthResult,
  formatHealthReport,
} from '../orchestrator/module-health.js';

// ============================================================================
// Health Command Handler
// ============================================================================

interface HealthCommandArgs {
  action: 'all' | 'module' | 'help';
  moduleName?: string;
}

// Singleton health checker instance
let healthCheckerInstance: ModuleHealthChecker | null = null;

function getHealthChecker(): ModuleHealthChecker {
  if (!healthCheckerInstance) {
    healthCheckerInstance = new ModuleHealthChecker();
  }
  return healthCheckerInstance;
}

export function resetHealthState(): void {
  healthCheckerInstance = null;
}

export function setHealthChecker(checker: ModuleHealthChecker): void {
  healthCheckerInstance = checker;
}

function parseHealthArgs(args: string[]): HealthCommandArgs {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    return { action: 'help' };
  }

  const firstArg = args[0];

  // Check if it's a module name (not a command)
  if (!['all', 'help'].includes(firstArg)) {
    return { action: 'module', moduleName: firstArg };
  }

  switch (firstArg) {
    case 'all':
      return { action: 'all' };
    default:
      return { action: 'help' };
  }
}

function formatModuleStatus(result: ModuleHealthResult): string {
  const statusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '🟢';
      case 'degraded': return '🟡';
      case 'unhealthy': return '🔴';
      case 'disabled': return '⚪';
      default: return '⚪';
    }
  };

  const lines: string[] = [];
  lines.push(`${statusIcon(result.status)} ${result.moduleName}`);
  lines.push(`   Status: ${result.status}`);
  lines.push(`   Message: ${result.message}`);
  lines.push(`   Latency: ${result.latencyMs}ms`);
  lines.push(`   Checked: ${new Date(result.lastChecked).toLocaleString()}`);
  
  if (result.details && Object.keys(result.details).length > 0) {
    lines.push(`   Details: ${JSON.stringify(result.details)}`);
  }
  
  return lines.join('\n');
}

async function handleShowAllHealth(): Promise<void> {
  const checker = getHealthChecker();
  
  console.log('\n🏥 Checking module health...\n');
  
  const report = await checker.checkAll();
  
  console.log(formatHealthReport(report));
  console.log();
}

async function handleShowModuleHealth(moduleName: string): Promise<void> {
  const checker = getHealthChecker();
  
  console.log(`\n🏥 Checking health for: ${moduleName}\n`);
  
  const result = await checker.checkModule(moduleName);
  
  if (!result) {
    console.log(`❌ Module "${moduleName}" not found.`);
    console.log(`   Registered modules: ${checker.getRegisteredModules().join(', ') || 'none'}`);
    console.log();
    return;
  }
  
  console.log(formatModuleStatus(result));
  console.log();
}

function showHelp(): void {
  console.log(`
🏥 /health — Module Health Commands

Usage:
  /health                  # Show all module statuses
  /health all              # Show all module statuses (explicit)
  /health <module-name>    # Show status for specific module
  /health help

Examples:
  /health                  # Check all modules
  /health model-routing    # Check specific module
  /health workflow-engine  # Check workflow module

Modules:
  The health command checks all registered lifecycle modules:
  - model-routing, perplexity, workflow-engine
  - infinite-memory, cinematic-observability
  - ai-model-database, crdt-collaboration

Notes:
  - Status: 🟢 healthy, 🟡 degraded, 🔴 unhealthy, ⚪ disabled
  - Latency shows response time in milliseconds
  - Disabled modules are configured off in Nova26 settings
`);
}

// ============================================================================
// Main Command Export
// ============================================================================

export async function handleHealthCommand(args: string[]): Promise<void> {
  const parsed = parseHealthArgs(args);

  switch (parsed.action) {
    case 'all':
      await handleShowAllHealth();
      break;
    case 'module':
      if (parsed.moduleName) {
        await handleShowModuleHealth(parsed.moduleName);
      } else {
        showHelp();
      }
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

// Command definition for slash-commands-extended.ts
export const healthCommand = {
  name: '/health',
  description: 'Module health — check all modules or a specific module',
  usage: '/health [all|<module-name>]',
  handler: handleHealthCommand,
};
