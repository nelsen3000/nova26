// MEGA-03: nova26 init Setup Command
// One-command setup that gets users from zero to first build

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { buildRepoMap } from '../codebase/repo-map.js';
import type { PartialNovaConfig } from '../config/config.js';
import type { PRD, Task } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface InitOptions {
  yes?: boolean;        // Non-interactive mode
  tier?: string;        // Pre-select tier
  ollamaHost?: string;  // Custom Ollama host
}

interface OllamaDetectionResult {
  available: boolean;
  models: string[];
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const NOVA_DIR = '.nova';
const AGENTS_DIR = join(NOVA_DIR, 'agents');
const OUTPUT_DIR = join(NOVA_DIR, 'output');
const CACHE_DIR = join(NOVA_DIR, 'cache');
const CONFIG_DIR = join(NOVA_DIR, 'config');
const EVENTS_DIR = join(NOVA_DIR, 'events');
const DATA_DIR = join(NOVA_DIR, 'data');

const DIRECTORIES = [AGENTS_DIR, OUTPUT_DIR, CACHE_DIR, CONFIG_DIR, EVENTS_DIR, DATA_DIR];

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';

// ============================================================================
// Banner and Formatting
// ============================================================================

export function formatWelcomeBanner(): string {
  return `
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🚀  NOVA26 — AI-Powered Development Environment               ║
║                                                                  ║
║   Initialize your project for orchestrated agent-based builds   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`;
}

export function formatSuccessMessage(configPath: string, samplePrdPath: string): string {
  return `
╔══════════════════════════════════════════════════════════════════╗
║                    ✅  Setup Complete!                           ║
╚══════════════════════════════════════════════════════════════════╝

📁 Configuration: ${configPath}
📋 Sample PRD:    ${samplePrdPath}

🚀 Next Steps:
   1. Review your configuration in ${configPath}
   2. Check out the sample PRD: ${samplePrdPath}
   3. Run: nova26 generate "Your project description"
   4. Or:  nova26 run ${samplePrdPath}

📖 Documentation: https://github.com/nova26/nova26
`;
}

// ============================================================================
// User Interaction
// ============================================================================

export function promptUser(question: string, defaultValue?: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const promptText = defaultValue !== undefined 
      ? `${question} [${defaultValue}]: `
      : `${question}: `;

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

// ============================================================================
// Ollama Detection
// ============================================================================

export async function detectOllama(host: string = DEFAULT_OLLAMA_HOST): Promise<OllamaDetectionResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${host}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        available: false,
        models: [],
        error: `Ollama returned status ${response.status}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    const models: string[] = [];

    if (data.models && Array.isArray(data.models)) {
      for (const model of data.models) {
        if (model.name) {
          models.push(model.name);
        }
      }
    }

    return {
      available: true,
      models,
    };
  } catch (error) {
    return {
      available: false,
      models: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function formatOllamaStatus(result: OllamaDetectionResult): string {
  if (result.available) {
    const modelList = result.models.length > 0
      ? result.models.slice(0, 5).join(', ') + (result.models.length > 5 ? ` (+${result.models.length - 5} more)` : '')
      : 'None installed';
    return `✅ Ollama detected — ${result.models.length} models available (${modelList})`;
  } else {
    return `⚠️  Ollama not detected — Install from https://ollama.ai`;
  }
}

// ============================================================================
// Directory Structure
// ============================================================================

export function createDirectoryStructure(): void {
  for (const dir of DIRECTORIES) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// ============================================================================
// Agent Templates
// ============================================================================

export function copyAgentTemplates(sourceDirOverride?: string): { copied: number; skipped: number } {
  // Source: either the override, or look for templates in common locations
  const possibleSourceDirs = sourceDirOverride 
    ? [sourceDirOverride]
    : [
        // For tests: current directory's .nova/agents (when test creates them)
        join(process.cwd(), '.nova', 'agents'),
        // For production: nova26 installation directory
        join(process.cwd(), 'node_modules', 'nova26', '.nova', 'agents'),
        // Development: one level up from src/cli/
        join(dirname(process.argv[1] || ''), '..', '..', '.nova', 'agents'),
      ];
  
  const targetDir = join(process.cwd(), AGENTS_DIR);
  
  let copied = 0;
  let skipped = 0;

  // Create target directory if it doesn't exist
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Find the first existing source directory
  let sourceDir: string | null = null;
  for (const dir of possibleSourceDirs) {
    if (existsSync(dir)) {
      const files = readdirSync(dir).filter(f => f.endsWith('.md'));
      if (files.length > 0) {
        sourceDir = dir;
        break;
      }
    }
  }

  // If no source agents found, that's okay — user may not have them
  if (!sourceDir) {
    return { copied, skipped };
  }

  // Get all .md files from source
  const agentFiles = readdirSync(sourceDir).filter(f => f.endsWith('.md'));

  for (const file of agentFiles) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);

    if (existsSync(targetPath)) {
      skipped++;
    } else {
      copyFileSync(sourcePath, targetPath);
      copied++;
    }
  }

  return { copied, skipped };
}

// ============================================================================
// Sample PRD Generation
// ============================================================================

export function generateSamplePRD(): PRD {
  const now = new Date().toISOString();
  
  const tasks: Task[] = [
    {
      id: 'task-001',
      title: 'Create project structure',
      description: 'Set up the basic directory structure with src/, tests/, and config files. Initialize package.json with required dependencies.',
      agent: 'EARTH',
      status: 'ready',
      dependencies: [],
      phase: 0,
      attempts: 0,
      createdAt: now,
    },
    {
      id: 'task-002',
      title: 'Implement hello world module',
      description: 'Create a simple hello world module in src/hello.ts that exports a greet() function. Add TypeScript types and basic documentation.',
      agent: 'MARS',
      status: 'pending',
      dependencies: ['task-001'],
      phase: 1,
      attempts: 0,
      createdAt: now,
    },
    {
      id: 'task-003',
      title: 'Write tests for hello module',
      description: 'Create unit tests for the hello module using vitest. Test the greet() function with various inputs and edge cases.',
      agent: 'SATURN',
      status: 'pending',
      dependencies: ['task-002'],
      phase: 1,
      attempts: 0,
      createdAt: now,
    },
  ];

  return {
    meta: {
      name: 'Hello World Example',
      version: '1.0.0',
      createdAt: now,
    },
    tasks,
  };
}

// ============================================================================
// .novaignore Creation
// ============================================================================

function createNovaignore(): boolean {
  const targetPath = join(process.cwd(), '.novaignore');
  
  if (existsSync(targetPath)) {
    return false; // Already exists, skip
  }

  // Try to copy from project root template
  const templatePath = join(process.cwd(), '.nova', '.novaignore');
  
  if (existsSync(templatePath)) {
    copyFileSync(templatePath, targetPath);
    return true;
  }

  // Create default .novaignore content
  const defaultContent = `# NOVA26 Ignore Patterns
# Files and directories to exclude from agent context and processing

# Environment and Secrets
.env
.env.*
*.key
*.pem
secrets/

# Dependencies
node_modules/

# Build Output
build/
dist/
.out/
.next/

# Testing
coverage/

# IDE and Editor
.vscode/
.idea/
*.swp
.DS_Store

# Logs
*.log
logs/

# Cache
.nova/cache/
*.cache
`;

  writeFileSync(targetPath, defaultContent, 'utf-8');
  return true;
}

// ============================================================================
// API Keys Configuration
// ============================================================================

async function configurePaidTier(options: InitOptions): Promise<PartialNovaConfig> {
  const config: PartialNovaConfig = {
    models: { tier: 'paid' },
  };

  if (options.yes) {
    // Non-interactive mode — don't prompt for keys
    return config;
  }

  console.log('\n💳 Paid Tier Configuration (press Enter to skip):\n');

  const openaiKey = await promptUser('OpenAI API Key', '');
  if (openaiKey) {
    // Write to .env file
    const envPath = join(process.cwd(), '.env');
    const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
    const newEnvLine = `OPENAI_API_KEY=${openaiKey}\n`;
    
    if (!envContent.includes('OPENAI_API_KEY')) {
      writeFileSync(envPath, envContent + newEnvLine, 'utf-8');
    }
  }

  const anthropicKey = await promptUser('Anthropic API Key', '');
  if (anthropicKey) {
    const envPath = join(process.cwd(), '.env');
    const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
    const newEnvLine = `ANTHROPIC_API_KEY=${anthropicKey}\n`;
    
    if (!envContent.includes('ANTHROPIC_API_KEY')) {
      writeFileSync(envPath, envContent + newEnvLine, 'utf-8');
    }
  }

  return config;
}

// ============================================================================
// Config File Utilities (direct file operations for runtime path resolution)
// ============================================================================

function getConfigPath(): string {
  return join(process.cwd(), '.nova', 'config.json');
}

function loadExistingConfig(): PartialNovaConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as PartialNovaConfig;
  } catch {
    return {};
  }
}

function saveConfigDirect(config: PartialNovaConfig): void {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);
  
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ============================================================================
// Main Init Function
// ============================================================================

export async function init(options: InitOptions = {}): Promise<void> {
  const startTime = Date.now();

  // 1. Print welcome banner
  console.log(formatWelcomeBanner());

  // 2. Detect Ollama
  const ollamaHost = options.ollamaHost || DEFAULT_OLLAMA_HOST;
  process.stdout.write('🔍 Checking Ollama... ');
  const ollamaResult = await detectOllama(ollamaHost);
  console.log(formatOllamaStatus(ollamaResult));
  console.log();

  // 3. Ask tier preference
  let tier = options.tier || 'free';
  
  if (!options.yes && !options.tier) {
    const tierInput = await promptUser('Select tier (free/paid/hybrid)', 'free');
    if (['free', 'paid', 'hybrid'].includes(tierInput)) {
      tier = tierInput;
    }
  }

  console.log(`📋 Using tier: ${tier}\n`);

  // 4. If paid tier, prompt for API keys
  let paidConfig: PartialNovaConfig = {};
  if (tier === 'paid') {
    paidConfig = await configurePaidTier(options);
  }

  // 5. Create directory structure
  process.stdout.write('📁 Creating directories... ');
  createDirectoryStructure();
  console.log('✅');

  // 6. Copy agent templates
  process.stdout.write('🤖 Setting up agent templates... ');
  const agentResult = copyAgentTemplates();
  console.log(`✅ (${agentResult.copied} copied, ${agentResult.skipped} skipped)`);

  // 7. Create .novaignore if not exists
  process.stdout.write('📝 Creating .novaignore... ');
  const novaignoreCreated = createNovaignore();
  console.log(novaignoreCreated ? '✅' : '⏭️  (already exists)');

  // 8. Create config.json with user choices
  process.stdout.write('⚙️  Creating configuration... ');
  
  const config: PartialNovaConfig = {
    models: {
      tier: tier as 'free' | 'paid' | 'hybrid',
      default: ollamaResult.models.includes('qwen2.5:7b') ? 'qwen2.5:7b' : 
               ollamaResult.models.length > 0 ? ollamaResult.models[0] : 'qwen2.5:7b',
    },
    ollama: {
      host: ollamaHost,
    },
  };

  // Merge with paid tier config if applicable
  if (paidConfig.models) {
    config.models = { ...config.models, ...paidConfig.models };
  }

  // Check if config already exists and merge
  const existingConfig = loadExistingConfig();
  const mergedConfig: PartialNovaConfig = {
    ollama: { ...existingConfig.ollama, ...config.ollama },
    models: { ...existingConfig.models, ...config.models },
  };

  saveConfigDirect(mergedConfig);
  console.log('✅');

  // 9. Run buildRepoMap to index codebase
  process.stdout.write('🔎 Indexing codebase... ');
  try {
    const repoMap = buildRepoMap(process.cwd(), 500);
    console.log(`✅ (${repoMap.totalFiles} files indexed)`);
  } catch {
    console.log('⚠️  (indexing skipped)');
  }

  // 10. Generate sample PRD
  process.stdout.write('📋 Creating sample PRD... ');
  const samplePrd = generateSamplePRD();
  const samplePrdPath = join(process.cwd(), NOVA_DIR, 'sample-prd.json');
  
  // Only create if doesn't exist (idempotent)
  if (!existsSync(samplePrdPath)) {
    writeFileSync(samplePrdPath, JSON.stringify(samplePrd, null, 2) + '\n', 'utf-8');
    console.log('✅');
  } else {
    console.log('⏭️  (already exists)');
  }

  // Print success message
  const duration = Date.now() - startTime;
  console.log();
  console.log(`⏱️  Setup completed in ${duration}ms`);
  console.log();
  
  const configPath = join(process.cwd(), NOVA_DIR, 'config.json');
  console.log(formatSuccessMessage(configPath, samplePrdPath));
}

// ============================================================================
// CLI Command Handler
// ============================================================================

export function parseInitArgs(args: string[]): InitOptions {
  const options: InitOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--yes':
      case '-y':
        options.yes = true;
        break;
      case '--tier':
        options.tier = args[++i];
        break;
      case '--ollama-host':
        options.ollamaHost = args[++i];
        break;
    }
  }

  return options;
}

export async function cmdInit(args: string[] = []): Promise<void> {
  const options = parseInitArgs(args);
  await init(options);
}
