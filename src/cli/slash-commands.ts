// Slash Commands for NOVA26 CLI
// Provides quick access to common operations

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// Agent metadata mapping
const AGENT_METADATA: Record<string, { emoji: string; tier: 'fast' | 'balanced' | 'quality' }> = {
  'SUN': { emoji: '☀️', tier: 'balanced' },
  'EARTH': { emoji: '🌍', tier: 'balanced' },
  'PLUTO': { emoji: '🪐', tier: 'fast' },
  'MARS': { emoji: '🔴', tier: 'quality' },
  'VENUS': { emoji: '💫', tier: 'quality' },
  'MERCURY': { emoji: '☿️', tier: 'fast' },
  'SATURN': { emoji: '🪐', tier: 'balanced' },
  'JUPITER': { emoji: '🟠', tier: 'quality' },
  'TITAN': { emoji: '🌙', tier: 'balanced' },
  'EUROPA': { emoji: '🌊', tier: 'balanced' },
  'CHARON': { emoji: '🌑', tier: 'fast' },
  'NEPTUNE': { emoji: '🔵', tier: 'balanced' },
  'ATLAS': { emoji: '📚', tier: 'balanced' },
  'URANUS': { emoji: '🔭', tier: 'quality' },
  'TRITON': { emoji: '🚀', tier: 'fast' },
  'ENCELADUS': { emoji: '⭐', tier: 'quality' },
  'GANYMEDE': { emoji: '🛰️', tier: 'balanced' },
  'IO': { emoji: '⚡', tier: 'fast' },
  'MIMAS': { emoji: '🛡️', tier: 'balanced' },
  'CALLISTO': { emoji: '📝', tier: 'fast' },
  'ANDROMEDA': { emoji: '🌌', tier: 'balanced' },
};
import { generatePRD } from '../agents/sun-prd-generator.js';
import { callLLM } from '../llm/ollama-client.js';
import { listSkills } from '../skills/skill-loader.js';
import { handleTemplateCommand } from '../template/template-engine.js';
import { quickSecurityScan, formatSecurityReport } from '../security/security-scanner.js';
import { getSpendingReport, formatReport, getTodaySpending } from '../cost/cost-tracker.js';
import { getCacheStats, formatCacheStats } from '../llm/response-cache.js';
import { startPreviewServer, previewComponent } from '../preview/server.js';

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<void>;
}

export const slashCommands: Record<string, SlashCommand> = {
  '/fix': {
    name: '/fix',
    description: 'Fix TypeScript errors using MARS agent',
    usage: '/fix',
    handler: async () => {
      console.log('🔧 Checking for TypeScript errors...\n');
      try {
        execSync('npx tsc --noEmit', { stdio: 'inherit' });
        console.log('✅ No errors found!');
      } catch {
        console.log('\n🤖 Asking MARS for fixes...');
        // Implementation would analyze errors and send to MARS
      }
    }
  },

  '/commit': {
    name: '/commit',
    description: 'Generate commit message from staged changes',
    usage: '/commit',
    handler: async () => {
      const diff = execSync('git diff --cached', { encoding: 'utf-8' });
      if (!diff.trim()) {
        console.log('⚠️ No staged changes');
        return;
      }
      const response = await callLLM(
        'Generate conventional commit message',
        diff.substring(0, 3000),
        'SUN'
      );
      console.log(`\n💬 ${response.content.trim()}`);
    }
  },

  '/generate': {
    name: '/generate',
    description: 'Generate PRD from description',
    usage: '/generate "description"',
    handler: async (args) => {
      if (args.length === 0 || args.join(' ').trim().length === 0) {
        console.log('❌ Error: Description required');
        console.log('Usage: /generate "description of the feature to build"');
        console.log('Example: /generate "Create a user authentication system with login and signup"');
        return;
      }
      const description = args.join(' ');
      const prd = await generatePRD(description);
      const filename = `generated-${Date.now()}.json`;
      writeFileSync(join('.nova', filename), JSON.stringify(prd, null, 2));
      console.log(`✅ Saved to .nova/${filename}`);
    }
  },

  '/preview': {
    name: '/preview',
    description: 'Start visual preview server',
    usage: '/preview [--component Name]',
    handler: async (args) => {
      const componentIndex = args.indexOf('--component');
      if (componentIndex >= 0) {
        const componentName = args[componentIndex + 1];
        if (!componentName || componentName.startsWith('--')) {
          console.log('❌ Error: Component name required after --component');
          console.log('Usage: /preview --component Button');
          return;
        }
        // Validate component name (alphanumeric and hyphens only)
        if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(componentName)) {
          console.log('❌ Error: Invalid component name');
          console.log('Component names must start with a letter and contain only letters, numbers, and hyphens');
          return;
        }
        await previewComponent(componentName);
      } else if (args.length > 0) {
        console.log('❌ Error: Unknown arguments');
        console.log('Usage: /preview [--component Name]');
        console.log('  /preview              - Start preview server');
        console.log('  /preview --component Button - Preview specific component');
      } else {
        await startPreviewServer();
      }
    }
  },

  '/template': {
    name: '/template',
    description: 'List, show, or apply agent templates',
    usage: '/template [list|show <agent>|apply <agent>]',
    handler: async (args) => {
      const validSubcommands = ['list', 'show', 'apply'];
      
      if (args.length === 0) {
        // Default to list
        handleTemplateCommand(['list']);
        return;
      }
      
      const subcommand = args[0].toLowerCase();
      
      if (!validSubcommands.includes(subcommand)) {
        console.log(`❌ Error: Unknown subcommand "${args[0]}"`);
        console.log('Usage: /template [list|show <agent>|apply <agent>]');
        console.log('  /template list         - List all templates');
        console.log('  /template show MARS    - Show MARS template details');
        console.log('  /template apply VENUS  - Apply VENUS template');
        return;
      }
      
      if ((subcommand === 'show' || subcommand === 'apply') && args.length < 2) {
        console.log(`❌ Error: Agent name required for "${subcommand}"`);
        console.log(`Usage: /template ${subcommand} <agent-name>`);
        console.log('Valid agents: SUN, EARTH, MARS, VENUS, PLUTO, MERCURY, etc.');
        return;
      }
      
      // Validate agent name format
      if (args[1] && !/^[A-Z][A-Z0-9_-]*$/i.test(args[1])) {
        console.log('❌ Error: Invalid agent name');
        console.log('Agent names should be uppercase (e.g., MARS, VENUS, PLUTO)');
        return;
      }
      
      handleTemplateCommand(args);
    }
  },

  '/scan': {
    name: '/scan',
    description: 'Run security scan on codebase',
    usage: '/scan [path]',
    handler: async (args) => {
      let path = args[0] || process.cwd();
      
      // Validate path doesn't contain dangerous patterns
      if (path.includes('..') || path.includes('~')) {
        console.log('❌ Error: Invalid path');
        console.log('Path cannot contain ".." or "~"');
        return;
      }
      
      // Resolve relative paths
      if (!path.startsWith('/')) {
        path = join(process.cwd(), path);
      }
      
      // Check path exists
      if (!existsSync(path)) {
        console.log(`❌ Error: Path does not exist: ${path}`);
        return;
      }
      
      console.log(`🔒 Running security scan on ${path}...\n`);
      const result = await quickSecurityScan(path);
      console.log(formatSecurityReport(result));
      process.exit(result.passed ? 0 : 1);
    }
  },

  '/cost': {
    name: '/cost',
    description: 'Show cost tracking and cache statistics',
    usage: '/cost [today|report <days>|cache]',
    handler: async (args) => {
      const subcommand = args[0] || 'today';
      const validSubcommands = ['today', 'report', 'cache'];
      
      if (!validSubcommands.includes(subcommand)) {
        console.log(`❌ Error: Unknown subcommand "${subcommand}"`);
        console.log('Usage: /cost [today|report <days>|cache]');
        console.log('  /cost today           - Show today\'s spending');
        console.log('  /cost report 7        - Show spending report for last 7 days');
        console.log('  /cost cache           - Show cache statistics');
        return;
      }
      
      if (subcommand === 'report' && args[1]) {
        const days = parseInt(args[1]);
        if (isNaN(days) || days < 1 || days > 365) {
          console.log('❌ Error: Days must be a number between 1 and 365');
          console.log('Usage: /cost report <days>');
          console.log('Example: /cost report 30');
          return;
        }
      }
      
      switch (subcommand) {
        case 'today':
          const today = getTodaySpending();
          console.log(`\n💰 Today's Spending`);
          console.log('═══════════════════════════════════════');
          console.log(`Cost:     $${today.cost.toFixed(4)}`);
          console.log(`Tokens:   ${today.tokens.toLocaleString()}`);
          console.log(`Requests: ${today.requests}`);
          console.log('═══════════════════════════════════════\n');
          break;
          
        case 'report': {
          const days = parseInt(args[1]) || 30;
          const report = getSpendingReport(days);
          console.log(formatReport(report));
          break;
        }
          
        case 'cache':
          const stats = getCacheStats();
          console.log(formatCacheStats(stats));
          break;
      }
    }
  },

  '/skills': {
    name: '/skills',
    description: 'List available skills',
    usage: '/skills',
    handler: async () => listSkills()
  },

  '/status': {
    name: '/status',
    description: 'Show current build status, tasks, costs, and cache stats',
    usage: '/status [prd-file]',
    handler: async (args) => {
      // Find PRD file
      let prdPath = args[0];
      if (!prdPath) {
        const novaDir = join(process.cwd(), '.nova');
        const prdFiles = readdirSync(novaDir).filter(f => f.startsWith('prd-') && f.endsWith('.json'));
        if (prdFiles.length === 0) {
          console.log('❌ No PRD file found in .nova/ directory');
          return;
        }
        // Use most recent PRD file
        prdPath = join(novaDir, prdFiles.sort().reverse()[0]);
      } else if (!prdPath.startsWith('/')) {
        prdPath = join(process.cwd(), '.nova', prdPath);
      }

      if (!existsSync(prdPath)) {
        console.log(`❌ PRD file not found: ${prdPath}`);
        return;
      }

      // Read and parse PRD
      const prdContent = readFileSync(prdPath, 'utf-8');
      const prd = JSON.parse(prdContent);

      // Calculate task statistics
      const tasks = prd.tasks || [];
      const stats = {
        total: tasks.length,
        pending: tasks.filter((t: any) => t.status === 'pending').length,
        ready: tasks.filter((t: any) => t.status === 'ready').length,
        running: tasks.filter((t: any) => t.status === 'running').length,
        done: tasks.filter((t: any) => t.status === 'done').length,
        failed: tasks.filter((t: any) => t.status === 'failed').length,
        blocked: tasks.filter((t: any) => t.status === 'blocked').length,
      };

      // Get cost and cache stats
      const today = getTodaySpending();
      const cache = getCacheStats();

      // Display status
      console.log('\n📊 NOVA26 Build Status\n');
      console.log('═══════════════════════════════════════════════════\n');
      
      console.log(`📁 PRD: ${prd.meta?.name || 'Unknown'} (v${prd.meta?.version || '?'})`);
      console.log(`📅 Created: ${prd.meta?.createdAt ? new Date(prd.meta.createdAt).toLocaleDateString() : 'Unknown'}\n`);
      
      console.log('📋 Task Summary:');
      console.log(`  Total:    ${stats.total}`);
      console.log(`  ⏳ Pending:  ${stats.pending}`);
      console.log(`  ✅ Ready:    ${stats.ready}`);
      console.log(`  🔄 Running:  ${stats.running}`);
      console.log(`  ✅ Done:     ${stats.done}`);
      console.log(`  ❌ Failed:   ${stats.failed}`);
      console.log(`  🚫 Blocked:  ${stats.blocked}`);
      
      const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
      console.log(`\n📈 Progress: ${progress}% (${stats.done}/${stats.total} tasks completed)`);
      
      console.log('\n💰 Cost Today:');
      console.log(`  $${today.cost.toFixed(4)} | ${today.tokens.toLocaleString()} tokens | ${today.requests} requests`);
      
      console.log('\n💾 Cache Stats:');
      console.log(`  Hit Rate: ${cache.hitRate.toFixed(1)}%`);
      console.log(`  Entries: ${cache.totalEntries.toLocaleString()}`);
      console.log(`  Tokens Saved: ${cache.totalTokensSaved.toLocaleString()}`);
      console.log(`  Est. Cost Saved: $${cache.estimatedCostSaved.toFixed(4)}`);
      
      console.log('\n═══════════════════════════════════════════════════\n');
    }
  },

  '/agents': {
    name: '/agents',
    description: 'List all 21 agents with domains, tiers, and hard limits',
    usage: '/agents [agent-name]',
    handler: async (args) => {
      const agentsDir = join(process.cwd(), '.nova', 'agents');
      const hardLimitsPath = join(process.cwd(), '.nova', 'config', 'hard-limits.json');
      
      // Load hard limits if available
      let hardLimits: Record<string, any> = {};
      if (existsSync(hardLimitsPath)) {
        try {
          const limitsContent = readFileSync(hardLimitsPath, 'utf-8');
          hardLimits = JSON.parse(limitsContent).agents || {};
        } catch {
          // Ignore parse errors
        }
      }

      // Show specific agent details
      if (args.length > 0) {
        const agentName = args[0].toUpperCase();
        const agentPath = join(agentsDir, `${agentName}.md`);
        
        if (!existsSync(agentPath)) {
          console.log(`❌ Agent not found: ${agentName}`);
          return;
        }

        const content = readFileSync(agentPath, 'utf-8');
        const metadata = AGENT_METADATA[agentName];
        
        // Extract domain from XML
        const domainMatch = content.match(/<domain>([\s\S]*?)<\/domain>/);
        const domain = domainMatch ? domainMatch[1].trim() : 'Unknown';
        
        // Extract role from XML
        const roleMatch = content.match(/<role>([\s\S]*?)<\/role>/);
        const role = roleMatch ? roleMatch[1].trim().slice(0, 100) + '...' : 'Unknown';
        
        const limits = hardLimits[agentName]?.limits || [];
        
        console.log(`\n${metadata?.emoji || '🤖'} ${agentName}\n`);
        console.log('═══════════════════════════════════════════════════\n');
        console.log(`🎯 Role: ${role}`);
        console.log(`📁 Domain: ${domain}`);
        console.log(`⚡ Model Tier: ${metadata?.tier || 'balanced'}`);
        console.log(`\n🚫 Hard Limits (${limits.length}):`);
        
        if (limits.length === 0) {
          console.log('  No hard limits defined');
        } else {
          for (const limit of limits.slice(0, 5)) {
            const severity = limit.severity === 'SEVERE' ? '🔴' : '🟡';
            console.log(`  ${severity} ${limit.name}: ${limit.message.slice(0, 60)}...`);
          }
          if (limits.length > 5) {
            console.log(`  ... and ${limits.length - 5} more`);
          }
        }
        
        console.log('\n═══════════════════════════════════════════════════\n');
        return;
      }

      // List all agents
      console.log('\n🤖 NOVA26 Agent Swarm\n');
      console.log('═══════════════════════════════════════════════════\n');
      
      const agents = Object.keys(AGENT_METADATA).sort();
      
      console.log(`Total: ${agents.length} agents\n`);
      
      // Group by tier
      const byTier: Record<string, string[]> = { fast: [], balanced: [], quality: [] };
      for (const agent of agents) {
        const tier = AGENT_METADATA[agent]?.tier || 'balanced';
        byTier[tier].push(agent);
      }
      
      console.log('⚡ Fast (Small Models):');
      for (const agent of byTier.fast) {
        const emoji = AGENT_METADATA[agent]?.emoji || '🤖';
        const limits = hardLimits[agent]?.limits?.length || 0;
        console.log(`  ${emoji} ${agent.padEnd(12)} ${limits} limits`);
      }
      
      console.log('\n⚖️  Balanced (Medium Models):');
      for (const agent of byTier.balanced) {
        const emoji = AGENT_METADATA[agent]?.emoji || '🤖';
        const limits = hardLimits[agent]?.limits?.length || 0;
        console.log(`  ${emoji} ${agent.padEnd(12)} ${limits} limits`);
      }
      
      console.log('\n✨ Quality (Large Models):');
      for (const agent of byTier.quality) {
        const emoji = AGENT_METADATA[agent]?.emoji || '🤖';
        const limits = hardLimits[agent]?.limits?.length || 0;
        console.log(`  ${emoji} ${agent.padEnd(12)} ${limits} limits`);
      }
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('\n💡 Tip: Use /agents <name> for detailed info\n');
    }
  },

  '/help': {
    name: '/help',
    description: 'Show available commands',
    usage: '/help',
    handler: async () => {
      console.log('\n⚡ Slash Commands:\n');
      Object.entries(slashCommands).forEach(([name, cmd]) => {
        console.log(`  ${name.padEnd(12)} ${cmd.description}`);
      });
    }
  }
};

export async function executeSlashCommand(input: string): Promise<boolean> {
  const parts = input.trim().split(' ');
  const command = slashCommands[parts[0]];
  if (!command) return false;
  await command.handler(parts.slice(1));
  return true;
}
