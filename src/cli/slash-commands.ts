// Slash Commands for NOVA26 CLI
// Provides quick access to common operations

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { generatePRD } from '../agents/sun-prd-generator.js';
import { callLLM } from '../llm/ollama-client.js';
import { listSkills } from '../skills/skill-loader.js';

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
    handler: async () => {
      console.log('🎨 Preview server coming soon...');
    }
  },

  '/skills': {
    name: '/skills',
    description: 'List available skills',
    usage: '/skills',
    handler: async () => listSkills()
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
