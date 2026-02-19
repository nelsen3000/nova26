// NOVA26 CLI - Main entry point
// Integrates slash commands, swarm mode, model routing, and agent explanations

import { extendedSlashCommands } from './slash-commands-extended.js';
import { selectTier, selectModel, showModelComparison, getCurrentModel, getCurrentTier, AVAILABLE_MODELS } from '../llm/model-router.js';
import { getAgentExplanation, formatExplanation, formatReasoning } from '../orchestrator/agent-explanations.js';

// Combine all slash commands
const allCommands = {
  ...extendedSlashCommands,
  
  // Model Commands
  '/tier': {
    name: '/tier',
    description: 'Switch between free/paid/hybrid model tiers',
    usage: '/tier [free|paid|hybrid]',
    handler: async (args: string[]) => {
      if (args.length === 0) {
        console.log(`Current tier: ${getCurrentTier().toUpperCase()}`);
        console.log(`Current model: ${getCurrentModel().name}`);
        return;
      }
      selectTier(args[0] as 'free' | 'paid' | 'hybrid');
    }
  },
  
  '/model': {
    name: '/model',
    description: 'Select specific model',
    usage: '/model [model-name]',
    handler: async (args: string[]) => {
      if (args.length === 0) {
        const current = getCurrentModel();
        console.log(`Current model: ${current.name}`);
        console.log(`  Provider: ${current.provider}`);
        console.log(`  Context: ${current.contextWindow/1000}k tokens`);
        console.log(`  Speed: ${current.speed}`);
        console.log(`  Quality: ${current.quality}`);
        console.log('\nAvailable models:');
        AVAILABLE_MODELS.forEach(m => {
          const marker = m.name === current.name ? '→' : ' ';
          console.log(`  ${marker} ${m.name} (${m.tier})`);
        });
        return;
      }
      selectModel(args[0]);
    }
  },
  
  '/models': {
    name: '/models',
    description: 'Show detailed model comparison',
    usage: '/models',
    handler: async () => {
      showModelComparison();
    }
  },
  
  // Explanation Commands
  '/explain': {
    name: '/explain',
    description: 'Explain current or specific agent',
    usage: '/explain [agent-name] [--reasoning]',
    handler: async (args: string[]) => {
      const agentName = args.find(a => !a.startsWith('--')) || 'current';
      const showReasoning = args.includes('--reasoning');
      
      // Mock task for demonstration
      const mockTask = {
        id: 'demo-001',
        title: 'Sample Feature Implementation',
        agent: agentName === 'current' ? 'VENUS' : agentName.toUpperCase(),
        context: { taskCount: 5 }
      };
      
      const explanation = getAgentExplanation(mockTask as any);
      console.log(formatExplanation(explanation, true, showReasoning));
    }
  },
  
  '/reasoning': {
    name: '/reasoning',
    description: 'Show chain of reasoning for current agent',
    usage: '/reasoning [agent-name]',
    handler: async (args: string[]) => {
      const agentName = args[0] || 'VENUS';
      const mockTask = {
        id: 'demo-001',
        title: 'Sample Feature',
        agent: agentName.toUpperCase(),
        context: {}
      };
      
      const explanation = getAgentExplanation(mockTask as any);
      if (explanation.reasoning) {
        console.log(formatReasoning(explanation.reasoning));
      } else {
        console.log('No reasoning available for this agent');
      }
    }
  },
  
  // Help
  '/help': {
    name: '/help',
    description: 'Show all available commands',
    usage: '/help [command]',
    handler: async (args: string[]) => {
      if (args.length > 0) {
        const cmd = args[0].startsWith('/') ? args[0] : '/' + args[0];
        const command = allCommands[cmd as keyof typeof allCommands];
        if (command) {
          console.log(`\n${command.name} - ${command.description}`);
          console.log(`Usage: ${command.usage}\n`);
        } else {
          console.log(`Unknown command: ${cmd}`);
        }
        return;
      }
      
      console.log('\n🚀 NOVA26 Commands\n');
      
      const categories = {
        'Swarm Mode': ['/swarm', '/agents'],
        'Model Control': ['/tier', '/model', '/models', '/speed', '/quality'],
        'Development': ['/generate', '/fix', '/debug', '/preview', '/test'],
        'Code Quality': ['/lint', '/format', '/review', '/commit'],
        'Project': ['/status', '/reset', '/resume', '/export', '/report'],
        'Knowledge': ['/skill', '/skills', '/learn', '/explain', '/reasoning'],
        'Information': ['/context', '/compare', '/config', '/mode', '/tips', '/shortcuts'],
        'Help': ['/help', '/agents']
      };
      
      Object.entries(categories).forEach(([category, commands]) => {
        console.log(`${category}:`);
        commands.forEach(cmdName => {
          const cmd = allCommands[cmdName as keyof typeof allCommands];
          if (cmd) {
            console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
          }
        });
        console.log('');
      });
      
      console.log('💡 Type "/help <command>" for detailed usage');
      console.log('💡 Press "e" during builds to see agent explanations');
      console.log('💡 Press "r" during builds to see chain of reasoning\n');
    }
  }
};

/**
 * Parse and execute a command
 */
export async function executeCommand(input: string): Promise<void> {
  const parts = input.trim().split(/\s+/);
  const commandName = parts[0];
  const args = parts.slice(1);
  
  const command = allCommands[commandName as keyof typeof allCommands];
  if (!command) {
    console.log(`Unknown command: ${commandName}`);
    console.log('Type /help to see available commands');
    return;
  }
  
  try {
    await command.handler(args);
  } catch (error) {
    console.error(`Error executing ${commandName}:`, error);
  }
}

/**
 * Start interactive CLI
 */
export function startCLI(): void {
  console.log('\n🚀 NOVA26 AI Development Environment');
  console.log('   21 Agents • 168 Skills • Swarm Mode\n');
  console.log('Type /help for commands or describe what you want to build\n');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const prompt = () => {
    rl.question('nova26> ', async (input: string) => {
      if (input.trim() === 'exit' || input.trim() === 'quit') {
        console.log('👋 Goodbye!');
        rl.close();
        return;
      }
      
      if (input.startsWith('/')) {
        await executeCommand(input);
      } else if (input.trim()) {
        console.log(`🤔 Unknown input: "${input}". Type /help for available commands.`);
      }
      
      prompt();
    });
  };
  
  prompt();
}

// Export for use in other modules
export { allCommands };
