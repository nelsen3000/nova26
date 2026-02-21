// KMS-22: /flags CLI command for feature flag management
// Uses src/config/feature-flags.ts

import {
  FeatureFlagRegistry,
  type FlagValue,
  registerDefaultFlags,
  getGlobalRegistry,
  resetGlobalRegistry,
} from '../config/feature-flags.js';

// ============================================================================
// Flags Command Handler
// ============================================================================

interface FlagsCommandArgs {
  action: 'list' | 'set' | 'reset' | 'help';
  flagName?: string;
  flagValue?: FlagValue;
}

// Singleton registry instance
let registryInstance: FeatureFlagRegistry | null = null;

function getRegistry(): FeatureFlagRegistry {
  if (!registryInstance) {
    registryInstance = getGlobalRegistry();
    registerDefaultFlags(registryInstance);
    registryInstance.loadFromEnv();
  }
  return registryInstance;
}

export function resetFlagsState(): void {
  registryInstance = null;
  resetGlobalRegistry();
}

export function setRegistry(registry: FeatureFlagRegistry): void {
  registryInstance = registry;
}

function parseFlagsArgs(args: string[]): FlagsCommandArgs {
  if (args.length === 0) {
    return { action: 'list' };
  }
  
  if (args[0] === 'help' || args[0] === '--help') {
    return { action: 'help' };
  }

  const action = args[0] as FlagsCommandArgs['action'];

  switch (action) {
    case 'list':
      return { action: 'list' };

    case 'set': {
      const flagName = args[1];
      const valueStr = args[2];
      
      if (!flagName || valueStr === undefined) {
        return { action: 'help' };
      }
      
      // Parse value
      let flagValue: FlagValue = valueStr;
      if (valueStr === 'true') flagValue = true;
      else if (valueStr === 'false') flagValue = false;
      else if (!isNaN(Number(valueStr))) flagValue = Number(valueStr);
      
      return { action: 'set', flagName, flagValue };
    }

    case 'reset':
      return { action: 'reset' };

    default:
      return { action: 'help' };
  }
}

function formatFlagValue(value: FlagValue): string {
  if (typeof value === 'boolean') {
    return value ? '🟢 true' : '🔴 false';
  }
  return String(value);
}

function getSourceIcon(source: string): string {
  switch (source) {
    case 'env': return '🌐';
    case 'file': return '📄';
    case 'programmatic': return '⚡';
    case 'default':
    default: return '⚪';
  }
}

async function handleListFlags(): Promise<void> {
  const registry = getRegistry();
  const states = registry.getAllStates();

  console.log('\n🏳️  Feature Flags\n');

  if (states.length === 0) {
    console.log('   No flags registered\n');
    return;
  }

  // Group by source
  const grouped = states.reduce((acc, state) => {
    acc[state.source] = acc[state.source] ?? [];
    acc[state.source].push(state);
    return acc;
  }, {} as Record<string, typeof states>);

  const sourceOrder = ['env', 'file', 'programmatic', 'default'];

  for (const source of sourceOrder) {
    const flags = grouped[source];
    if (!flags || flags.length === 0) continue;

    console.log(`   ${getSourceIcon(source)} ${source.toUpperCase()}`);
    
    for (const flag of flags.sort((a, b) => a.name.localeCompare(b.name))) {
      const valueStr = formatFlagValue(flag.value);
      console.log(`      ${flag.name.padEnd(25)} ${valueStr}`);
      if (flag.description) {
        console.log(`         ${flag.description}`);
      }
    }
    console.log();
  }

  console.log(`   Total: ${states.length} flags\n`);
}

async function handleSetFlag(name: string, value: FlagValue): Promise<void> {
  const registry = getRegistry();

  if (!registry.has(name)) {
    console.log(`\n❌ Unknown flag: "${name}"`);
    console.log(`   Use "/flags" to see available flags\n`);
    return;
  }

  const success = registry.set(name, value);

  if (success) {
    console.log(`\n✅ Flag updated`);
    console.log(`   ${name} = ${formatFlagValue(value)}`);
    console.log(`   Source: programmatic\n`);
  } else {
    console.log(`\n❌ Failed to set flag: invalid value type\n`);
  }
}

async function handleResetFlags(): Promise<void> {
  const registry = getRegistry();
  
  console.log('\n🔄 Resetting all flags to defaults...\n');
  
  registry.resetAll();
  
  const states = registry.getAllStates();
  console.log(`   Reset ${states.length} flags to default values\n`);
}

function showHelp(): void {
  console.log(`
🏳️  /flags — Feature Flag Management

Usage:
  /flags                    # List all flags with sources
  /flags list               # Same as above
  /flags set <name> <value> # Set a flag value
  /flags reset              # Reset all flags to defaults
  /flags help

Examples:
  /flags                           # Show all flags
  /flags set model-routing true    # Enable model routing
  /flags set perplexity false      # Disable perplexity
  /flags reset                     # Reset everything

Flag Sources:
  🌐 env            # From environment variable (NOVA26_FF_*)
  📄 file           # From .nova/flags.json
  ⚡ programmatic   # Set via code or CLI
  ⚪ default        # Built-in default value

Value Types:
  - Booleans: true, false
  - Numbers: 42, 3.14
  - Strings: any text

Available Flags:
  model-routing, perplexity, workflow-engine
  infinite-memory, cinematic-observability
  ai-model-database, crdt-collaboration
  experimental-features
`);
}

// ============================================================================
// Main Command Export
// ============================================================================

export async function handleFlagsCommand(args: string[]): Promise<void> {
  const parsed = parseFlagsArgs(args);

  switch (parsed.action) {
    case 'list':
      await handleListFlags();
      break;
    case 'set':
      if (parsed.flagName && parsed.flagValue !== undefined) {
        await handleSetFlag(parsed.flagName, parsed.flagValue);
      } else {
        showHelp();
      }
      break;
    case 'reset':
      await handleResetFlags();
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

// Command definition for slash-commands-extended.ts
export const flagsCommand = {
  name: '/flags',
  description: 'Feature flags — list, set, reset configuration flags',
  usage: '/flags [list|set <name> <value>|reset]',
  handler: handleFlagsCommand,
};
