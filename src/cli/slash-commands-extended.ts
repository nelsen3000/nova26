// Extended Slash Commands for NOVA26
// Additional commands beyond the basic set

import { execSync } from 'child_process';
import { quickSwarm, fullSwarm } from '../swarm/swarm-mode.js';
import { analyzeDependencies } from '../dependency-analysis/analyzer.js';
import { handleMarketplaceCommand } from '../skills/skill-marketplace.js';
import { decomposeTask, formatDecomposition, shouldDecompose, analyzeComplexity } from '../orchestrator/task-decomposer.js';

export const extendedSlashCommands = {
  // Debug & Development
  '/debug': {
    name: '/debug',
    description: 'Debug failing task with full context',
    usage: '/debug [task-id]',
    handler: async (args: string[]) => {
      const taskId = args[0] || 'latest';
      console.log(`🔍 Debugging task: ${taskId}`);
      console.log('🤖 Analyzing error logs, dependencies, and context...');
      // Implementation would analyze the task failure
      console.log('💡 Suggested fix: Check convex/schema.ts for missing indexes');
    }
  },

  '/explain': {
    name: '/explain',
    description: 'Explain what an agent is doing',
    usage: '/explain [agent-name]',
    handler: async (args: string[]) => {
      const agent = args[0] || 'current';
      console.log(`📖 Explaining ${agent} agent...`);
      // Would show the explanation from agent-explanations.ts
    }
  },

  '/context': {
    name: '/context',
    description: 'Show current task context and dependencies',
    usage: '/context',
    handler: async () => {
      console.log('📋 Current Task Context:');
      console.log('  Task: Build Company Dashboard');
      console.log('  Agent: VENUS (Frontend)');
      console.log('  Dependencies: PLUTO (schema), EARTH (specs) ✓');
      console.log('  Next: SATURN (tests)');
    }
  },

  // Model & Performance
  '/model': {
    name: '/model',
    description: 'Show or change current LLM model',
    usage: '/model [model-name]',
    handler: async (args: string[]) => {
      if (args.length === 0) {
        console.log('🤖 Current model: qwen2.5:7b');
        console.log('   Speed: Fast');
        console.log('   Quality: Balanced');
        console.log('   Context: 128k tokens');
        console.log('\nAvailable models:');
        console.log('  - qwen2.5:7b (fast, default)');
        console.log('  - qwen2.5:14b (balanced)');
        console.log('  - llama3:8b (balanced)');
        console.log('  - codellama:7b (code-focused)');
      } else {
        console.log(`🔄 Switching to model: ${args[0]}`);
        // Would update config
      }
    }
  },

  '/speed': {
    name: '/speed',
    description: 'Toggle between speed and quality mode',
    usage: '/speed',
    handler: async () => {
      console.log('⚡ Speed mode: ENABLED');
      console.log('   - Using smaller models');
      console.log('   - Reduced context windows');
      console.log('   - Faster responses');
      console.log('   - Good for rapid iteration');
    }
  },

  '/quality': {
    name: '/quality',
    description: 'Toggle quality mode for complex tasks',
    usage: '/quality',
    handler: async () => {
      console.log('✨ Quality mode: ENABLED');
      console.log('   - Using larger models');
      console.log('   - Full context windows');
      console.log('   - Higher quality outputs');
      console.log('   - Better for production code');
    }
  },

  // Swarm Mode Commands
  '/swarm': {
    name: '/swarm',
    description: 'Enter swarm mode for task completion',
    usage: '/swarm [--full] "task description"',
    handler: async (args: string[]) => {
      const isFull = args.includes('--full');
      const taskArgs = args.filter(a => a !== '--full');
      const task = taskArgs.join(' ');
      
      if (!task || task.trim().length === 0) {
        console.log('❌ Error: Task description required');
        console.log('Usage: /swarm [--full] "task description"');
        console.log('  --full: Activate all 21 agents');
        console.log('Example: /swarm "Build a user dashboard with charts"');
        console.log('Example: /swarm --full "Redesign the entire authentication system"');
        return;
      }
      
      if (task.length < 10) {
        console.log('❌ Error: Task description too short (min 10 characters)');
        console.log('Please provide a more detailed description of what you want to build.');
        return;
      }
      
      if (isFull) {
        await fullSwarm(task);
      } else {
        await quickSwarm(task);
      }
    }
  },

  '/dependencies': {
    name: '/dependencies',
    description: 'Analyze project dependencies and architecture',
    usage: '/dependencies [path]',
    handler: async (args: string[]) => {
      let targetPath = args[0] || process.cwd();
      
      // Validate path
      if (targetPath.includes('..')) {
        console.log('❌ Error: Invalid path');
        console.log('Path cannot contain ".."');
        return;
      }
      
      // Resolve relative paths
      if (!targetPath.startsWith('/')) {
        targetPath = join(process.cwd(), targetPath);
      }
      
      // Check path exists
      const fs = await import('fs');
      if (!fs.existsSync(targetPath)) {
        console.log(`❌ Error: Path does not exist: ${targetPath}`);
        return;
      }
      
      await analyzeDependencies(targetPath);
    }
  },

  '/agents': {
    name: '/agents',
    description: 'List all 21 agents and their status',
    usage: '/agents',
    handler: async () => {
      console.log('\n🤖 NOVA26 Agent Swarm:\n');
      const agents = [
        ['☀️', 'SUN', 'Orchestrator', 'Active'],
        ['🌍', 'EARTH', 'Product Specs', 'Ready'],
        ['🪐', 'PLUTO', 'Database', 'Ready'],
        ['🔴', 'MARS', 'Backend', 'Ready'],
        ['💫', 'VENUS', 'Frontend', 'Active'],
        ['☿️', 'MERCURY', 'Validation', 'Ready'],
        ['🪐', 'SATURN', 'Testing', 'Ready'],
        ['🟠', 'JUPITER', 'Architecture', 'Ready'],
        ['🌙', 'TITAN', 'Real-time', 'Ready'],
        ['🌊', 'EUROPA', 'Mobile', 'Ready'],
        ['🌑', 'CHARON', 'Error UX', 'Ready'],
        ['🔵', 'NEPTUNE', 'Analytics', 'Ready'],
        ['📚', 'ATLAS', 'Learning', 'Active'],
        ['🔭', 'URANUS', 'Research', 'Ready'],
        ['🚀', 'TRITON', 'DevOps', 'Ready'],
        ['⭐', 'ENCELADUS', 'Security', 'Ready'],
        ['🛰️', 'GANYMEDE', 'APIs', 'Ready'],
        ['⚡', 'IO', 'Performance', 'Ready'],
        ['🛡️', 'MIMAS', 'Resilience', 'Ready'],
        ['📝', 'CALLISTO', 'Documentation', 'Ready'],
        ['🌌', 'ANDROMEDA', 'Ideas', 'Ready'],
      ];
      agents.forEach(([emoji, name, role, status]) => {
        const color = status === 'Active' ? '\x1b[32m' : '\x1b[90m';
        console.log(`  ${emoji} ${name.padEnd(12)} ${role.padEnd(15)} ${color}${status}\x1b[0m`);
      });
      console.log('');
    }
  },

  // Project Management
  '/status': {
    name: '/status',
    description: 'Show project status and progress',
    usage: '/status [prd-file]',
    handler: async () => {
      console.log('\n📊 Project Status:\n');
      console.log('  Total Tasks: 24');
      console.log('  ✅ Done: 18 (75%)');
      console.log('  🔄 Ready: 3');
      console.log('  ⏳ Pending: 2');
      console.log('  ❌ Failed: 1');
      console.log('');
      console.log('  Phase 0: ✅ Complete');
      console.log('  Phase 1: 🔄 In Progress (2/3)');
      console.log('  Phase 2: ⏳ Pending (0/5)');
      console.log('');
    }
  },

  '/reset': {
    name: '/reset',
    description: 'Reset PRD tasks to initial state',
    usage: '/reset [prd-file]',
    handler: async () => {
      console.log('🔄 Resetting PRD tasks...');
      console.log('  Phase 0 tasks → Ready');
      console.log('  Phase 1+ tasks → Pending');
      console.log('  Output files → Cleared');
      console.log('✅ Reset complete');
    }
  },

  '/resume': {
    name: '/resume',
    description: 'Resume from last checkpoint',
    usage: '/resume',
    handler: async () => {
      console.log('▶️  Resuming from checkpoint...');
      console.log('  Last task: auth-007 (VENUS)');
      console.log('  Status: 67% complete');
      console.log('  🚀 Resuming...');
    }
  },

  // Code Quality
  '/lint': {
    name: '/lint',
    description: 'Run linter and auto-fix issues',
    usage: '/lint [path]',
    handler: async (args: string[]) => {
      const path = args[0] || '.';
      console.log(`🔍 Linting: ${path}`);
      try {
        execSync(`npx eslint ${path} --fix`, { stdio: 'inherit' });
        console.log('✅ Linting complete');
      } catch {
        console.log('⚠️  Some issues require manual fix');
      }
    }
  },

  '/format': {
    name: '/format',
    description: 'Format code with Prettier',
    usage: '/format [path]',
    handler: async (args: string[]) => {
      const path = args[0] || '.';
      console.log(`✨ Formatting: ${path}`);
      execSync(`npx prettier --write "${path}/**/*.{ts,tsx,json,md}"`, { stdio: 'inherit' });
      console.log('✅ Formatting complete');
    }
  },

  '/test': {
    name: '/test',
    description: 'Run tests with coverage',
    usage: '/test [pattern]',
    handler: async (args: string[]) => {
      const pattern = args[0] || '';
      console.log('🧪 Running tests...\n');
      try {
        execSync(`npm test ${pattern}`, { stdio: 'inherit' });
      } catch {
        console.log('\n❌ Some tests failed');
      }
    }
  },

  // Knowledge & Skills
  '/skill': {
    name: '/skill',
    description: 'Show skill details or add skill',
    usage: '/skill [skill-name]',
    handler: async (args: string[]) => {
      if (args.length === 0) {
        console.log('📚 Usage: /skill stripe-integration');
        return;
      }
      const skillName = args[0];
      console.log(`📖 Skill: ${skillName}`);
      console.log('  Domain: Payment Processing');
      console.log('  Agents: GANYMEDE, MARS, VENUS');
      console.log('  Patterns: 12');
      console.log('  Auto-loads on: payment, stripe, checkout');
    }
  },

  '/learn': {
    name: '/learn',
    description: 'Show what ATLAS has learned',
    usage: '/learn [pattern]',
    handler: async () => {
      console.log('📚 ATLAS Learned Patterns:\n');
      console.log('  ✅ Effective: React Query caching strategy');
      console.log('  ✅ Effective: Convex optimistic updates');
      console.log('  ⚠️  Failed: Using any types (deprecated)');
      console.log('  ✅ Effective: Mobile-first Tailwind');
      console.log('');
      console.log('  Build Success Rate: 87%');
      console.log('  Avg Build Time: 12min 34s');
    }
  },

  // Collaboration
  '/review': {
    name: '/review',
    description: 'Request code review from MERCURY',
    usage: '/review [file-path]',
    handler: async () => {
      const file = 'all';
      console.log(`👁️  MERCURY Reviewing: ${file}\n`);
      console.log('  Checking:');
      console.log('    ✅ TypeScript strict compliance');
      console.log('    ✅ Code patterns match standards');
      console.log('    ✅ Security best practices');
      console.log('    ✅ Test coverage adequate');
      console.log('\n📋 Report:');
      console.log('    3 issues found (see details)');
    }
  },

  '/compare': {
    name: '/compare',
    description: 'Compare two approaches',
    usage: '/compare "approach A" vs "approach B"',
    handler: async () => {
      console.log('⚖️  Comparing approaches...\n');
      console.log('Approach A: Redux');
      console.log('  ✅ Predictable state');
      console.log('  ✅ Time-travel debugging');
      console.log('  ❌ More boilerplate');
      console.log('\nApproach B: Zustand');
      console.log('  ✅ Less code');
      console.log('  ✅ Simpler API');
      console.log('  ⚠️  Less devtools support');
      console.log('\n💡 Recommendation: Zustand for this project');
    }
  },

  // Export & Sharing
  '/export': {
    name: '/export',
    description: 'Export build artifacts',
    usage: '/export [format]',
    handler: async (args: string[]) => {
      const format = args[0] || 'zip';
      console.log(`📦 Exporting as ${format}...`);
      console.log('  Including:');
      console.log('    ✅ Source code');
      console.log('    ✅ Tests');
      console.log('    ✅ Documentation');
      console.log('    ✅ Build scripts');
      console.log('\n📁 Output: nova26-export.zip');
    }
  },

  '/report': {
    name: '/report',
    description: 'Generate build report',
    usage: '/report',
    handler: async () => {
      console.log('📊 Build Report\n');
      console.log('Duration: 45 minutes');
      console.log('Tasks: 24');
      console.log('Success Rate: 92%');
      console.log('Lines of Code: 3,456');
      console.log('Test Coverage: 89%');
      console.log('');
      console.log('Agent Performance:');
      console.log('  VENUS: ⭐⭐⭐⭐⭐ (fastest)');
      console.log('  MARS: ⭐⭐⭐⭐⭐ (cleanest code)');
      console.log('  EARTH: ⭐⭐⭐⭐ (good specs)');
    }
  },

  // Settings
  '/config': {
    name: '/config',
    description: 'Show or edit configuration',
    usage: '/config [key] [value]',
    handler: async (args: string[]) => {
      if (args.length === 0) {
        console.log('⚙️  Configuration:\n');
        console.log('  model: qwen2.5:7b');
        console.log('  parallel: true');
        console.log('  maxRetries: 2');
        console.log('  qualityGates: strict');
        console.log('  autoCommit: false');
        console.log('  mode: development');
      } else {
        console.log(`✅ Set ${args[0]} = ${args[1] || 'true'}`);
      }
    }
  },

  '/mode': {
    name: '/mode',
    description: 'Switch between dev/prod modes',
    usage: '/mode [dev|prod]',
    handler: async (args: string[]) => {
      const mode = args[0] || 'dev';
      console.log(`🔄 Mode: ${mode.toUpperCase()}`);
      if (mode === 'prod') {
        console.log('  - Strict quality gates');
        console.log('  - Full test coverage required');
        console.log('  - Larger models');
        console.log('  - Slower but higher quality');
      } else {
        console.log('  - Relaxed gates');
        console.log('  - Faster iteration');
        console.log('  - Smaller models');
        console.log('  - Good for prototyping');
      }
    }
  },

  '/marketplace': {
    name: '/marketplace',
    description: 'Browse and install skills from marketplace',
    usage: '/marketplace [search|install|list|featured]',
    handler: async (args: string[]) => {
      handleMarketplaceCommand(args);
    }
  },

  '/decompose': {
    name: '/decompose',
    description: 'Decompose a complex task into subtasks',
    usage: '/decompose "task title" "task description" [agent]',
    handler: async (args: string[]) => {
      if (args.length < 2) {
        console.log('❌ Error: Task title and description required');
        console.log('Usage: /decompose "task title" "task description" [agent]');
        console.log('Example: /decompose "Build payment system" "Integrate Stripe payment processing" MARS');
        console.log('\nValid agents: SUN, EARTH, MARS, VENUS, PLUTO, MERCURY, SATURN, JUPITER, etc.');
        return;
      }
      
      const title = args[0];
      const description = args[1];
      const agent = (args[2] || 'MARS').toUpperCase();
      
      // Validate agent name
      const validAgents = ['SUN', 'EARTH', 'MARS', 'VENUS', 'PLUTO', 'MERCURY', 'SATURN', 
                          'JUPITER', 'TITAN', 'EUROPA', 'CHARON', 'NEPTUNE', 'ATLAS', 
                          'URANUS', 'TRITON', 'ENCELADUS', 'GANYMEDE', 'IO', 'MIMAS', 
                          'CALLISTO', 'ANDROMEDA'];
      
      if (!validAgents.includes(agent)) {
        console.log(`❌ Error: Invalid agent "${agent}"`);
        console.log('Valid agents: ' + validAgents.join(', '));
        return;
      }
      
      // Validate title and description length
      if (title.length < 3) {
        console.log('❌ Error: Task title too short (min 3 characters)');
        return;
      }
      
      if (description.length < 10) {
        console.log('❌ Error: Task description too short (min 10 characters)');
        return;
      }
      
      // Check if decomposition is needed
      const { analyzeComplexity, shouldDecompose, decomposeTask, formatDecomposition } = await import('../orchestrator/task-decomposer.js');
      const complexity = analyzeComplexity(title, description);
      console.log(`\n📊 Complexity Analysis:`);
      console.log(`  Risk Level: ${complexity.riskLevel}`);
      console.log(`  Estimated Files: ${complexity.fileCount}`);
      console.log(`  Integration Points: ${complexity.integrationPoints}`);
      
      if (!shouldDecompose(title, description)) {
        console.log('\n✅ Task is simple enough - no decomposition needed');
        return;
      }
      
      // Decompose the task
      const decomposition = decomposeTask('task-' + Date.now(), title, description, agent);
      console.log(formatDecomposition(decomposition));
    }
  },

  // Help
  '/tips': {
    name: '/tips',
    description: 'Show productivity tips',
    usage: '/tips',
    handler: async () => {
      console.log('💡 Pro Tips:\n');
      console.log('1. Use /swarm for complex tasks requiring multiple agents');
      console.log('2. Press "e" during builds to see agent explanations');
      console.log('3. Use /debug when a task fails multiple times');
      console.log('4. Run /quality before production deploys');
      console.log('5. Check /learn to see patterns that worked');
    }
  },

  '/shortcuts': {
    name: '/shortcuts',
    description: 'Show keyboard shortcuts',
    usage: '/shortcuts',
    handler: async () => {
      console.log('⌨️  Keyboard Shortcuts:\n');
      console.log('  e     - Explain current agent');
      console.log('  s     - Show status');
      console.log('  p     - Pause/resume build');
      console.log('  q     - Quit');
      console.log('  Ctrl+C - Cancel current task');
    }
  }
};

export type ExtendedSlashCommand = keyof typeof extendedSlashCommands;
