// Watch Mode for NOVA26 — Auto-Rebuild on File Changes
// MEGA-06: Watch Mode implementation

import { watch, existsSync, readFileSync } from 'fs';
import { join, relative, basename } from 'path';
import type { PRD, Task } from '../types/index.js';

// Re-export types for consumers
export type { PRD, Task };

// --- Types ---

export interface WatchOptions {
  debounceMs?: number;      // default: 500
  srcDir?: string;          // default: './src'
  onChange?: (file: string, agent: string) => void;
  onTaskComplete?: (agent: string, taskId: string, success: boolean) => void;
}

export interface WatchSession {
  prdPath: string;
  srcDir: string;
  watchedFiles: Set<string>;
  lastChange: Date | null;
  tasksCompleted: number;
  tasksPending: number;
  stop(): void;
}

// --- File-to-Agent Mapping ---

/**
 * Maps file paths to agent names based on file patterns
 * Returns null if file should be ignored
 */
export function mapFileToAgent(filePath: string): string | null {
  // Normalize path separators for cross-platform compatibility
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Check ignore patterns first (dotfiles, common directories)
  if (shouldIgnoreFile(normalizedPath)) {
    return null;
  }
  
  // Test files -> SATURN
  if (normalizedPath.endsWith('.test.ts') || normalizedPath.endsWith('.test.tsx')) {
    return 'SATURN';
  }
  
  // Convex schema -> PLUTO
  // Match both convex/schema.ts and convex/_generated/schema.ts
  if (normalizedPath.endsWith('convex/schema.ts') || normalizedPath.endsWith('convex/_generated/schema.ts')) {
    return 'PLUTO';
  }
  
  // Other convex files -> MARS
  if (normalizedPath.includes('convex/') && normalizedPath.endsWith('.ts')) {
    return 'MARS';
  }
  
  // Components -> VENUS
  if (normalizedPath.includes('src/components/') && normalizedPath.endsWith('.tsx')) {
    return 'VENUS';
  }
  
  // App routes/pages -> VENUS
  if (normalizedPath.includes('src/app/') && normalizedPath.endsWith('.tsx')) {
    return 'VENUS';
  }
  
  // Hooks -> VENUS
  if (normalizedPath.includes('src/hooks/') && normalizedPath.endsWith('.ts')) {
    return 'VENUS';
  }
  
  // Lib files -> MARS
  if (normalizedPath.includes('src/lib/') && normalizedPath.endsWith('.ts')) {
    return 'MARS';
  }
  
  // Security files -> ENCELADUS
  if (normalizedPath.includes('src/security/') && normalizedPath.endsWith('.ts')) {
    return 'ENCELADUS';
  }
  
  // Integrations -> GANYMEDE
  if (normalizedPath.includes('src/integrations/') && normalizedPath.endsWith('.ts')) {
    return 'GANYMEDE';
  }
  
  // Markdown files -> CALLISTO
  if (normalizedPath.endsWith('.md')) {
    return 'CALLISTO';
  }
  
  // Default -> MARS
  if (normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.tsx')) {
    return 'MARS';
  }
  
  return null;
}

/**
 * Checks if a file should be ignored based on path patterns
 */
export function shouldIgnoreFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = basename(normalizedPath);
  const pathParts = normalizedPath.split('/');
  
  // Ignore dotfiles and dot directories (check if any path component starts with '.')
  if (fileName.startsWith('.') || pathParts.some(part => part.startsWith('.'))) {
    return true;
  }
  
  // Ignore node_modules
  if (normalizedPath.includes('node_modules/')) {
    return true;
  }
  
  // Ignore .nova directory
  if (normalizedPath.includes('.nova/')) {
    return true;
  }
  
  // Ignore dist directories
  if (normalizedPath.includes('dist/')) {
    return true;
  }
  
  // Ignore build output
  if (normalizedPath.includes('build/')) {
    return true;
  }
  
  // Ignore common non-source files
  const ignoredExtensions = ['.css', '.scss', '.sass', '.less', '.json', '.lock', '.log', '.tmp', '.temp'];
  if (ignoredExtensions.some(ext => normalizedPath.endsWith(ext))) {
    return true;
  }
  
  // Ignore additional temp file patterns (files commonly used as temp)
  const tempPatterns = ['.tmp', '.temp'];
  if (tempPatterns.some(pattern => normalizedPath.includes(pattern))) {
    return true;
  }
  
  // Ignore image and asset files
  const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
  if (assetExtensions.some(ext => normalizedPath.endsWith(ext))) {
    return true;
  }
  
  return false;
}

// --- Debounce Utility ---

/**
 * Creates a debounced version of a function
 * Waits for `ms` milliseconds after the last call before executing
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, ms);
  };
}

// --- PRD Task Finding ---

/**
 * Finds the task in the PRD that corresponds to a given agent
 * Returns null if no matching task found
 */
export function findTaskForAgent(prd: PRD, agent: string): Task | null {
  if (!prd.tasks || !Array.isArray(prd.tasks)) {
    return null;
  }
  
  // Look for tasks assigned to this agent that are not done
  // Prefer 'ready' tasks, then 'pending', then any non-done
  const readyTask = prd.tasks.find(
    t => t.agent === agent && t.status === 'ready'
  );
  if (readyTask) return readyTask;
  
  const pendingTask = prd.tasks.find(
    t => t.agent === agent && t.status === 'pending'
  );
  if (pendingTask) return pendingTask;
  
  // Fall back to any non-done task for this agent
  const anyTask = prd.tasks.find(
    t => t.agent === agent && t.status !== 'done'
  );
  if (anyTask) return anyTask;
  
  return null;
}

// --- Status Line Formatting ---

/**
 * Formats the status line for display
 * [WATCHING] 3 tasks done | 2 pending | Last change: src/api/users.ts
 */
export function formatStatusLine(session: WatchSession): string {
  const lastChangeStr = session.lastChange
    ? `Last change: ${relative(process.cwd(), [...session.watchedFiles].pop() || '')}`
    : 'Waiting for changes...';
  
  return `[WATCHING] ${session.tasksCompleted} tasks done | ${session.tasksPending} pending | ${lastChangeStr}`;
}

// --- PRD Loading ---

/**
 * Loads a PRD file from the given path
 */
export function loadPRD(prdPath: string): PRD | null {
  try {
    const fullPath = join(process.cwd(), prdPath);
    if (!existsSync(fullPath)) {
      console.error(`PRD file not found: ${fullPath}`);
      return null;
    }
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as PRD;
  } catch (error) {
    console.error(`Error loading PRD: ${error}`);
    return null;
  }
}

// --- Watch Mode Implementation ---

interface PendingChange {
  filePath: string;
  agent: string;
  timestamp: Date;
}

/**
 * Starts watch mode on the src directory
 * Monitors file changes and re-runs relevant agents
 */
export function startWatchMode(
  prdPath: string,
  options: WatchOptions = {}
): WatchSession {
  const {
    debounceMs = 500,
    srcDir = './src',
    onChange,
    onTaskComplete,
  } = options;
  
  const fullSrcDir = join(process.cwd(), srcDir);
  
  // Verify src directory exists
  if (!existsSync(fullSrcDir)) {
    console.error(`Source directory not found: ${fullSrcDir}`);
    process.exit(1);
  }
  
  // Load PRD
  const prd = loadPRD(prdPath);
  if (!prd) {
    process.exit(1);
  }
  
  // Create session object
  const session: WatchSession = {
    prdPath,
    srcDir: fullSrcDir,
    watchedFiles: new Set<string>(),
    lastChange: null,
    tasksCompleted: 0,
    tasksPending: 0,
    stop: () => {
      // Will be replaced with actual stop function
    },
  };
  
  // Track pending changes for debouncing
  let pendingChange: PendingChange | null = null;
  
  // Process a file change (called after debounce)
  const processChange = async (change: PendingChange): Promise<void> => {
    const { filePath, agent } = change;
    
    console.log(`\n🔄 Change detected: ${relative(process.cwd(), filePath)}`);
    console.log(`   Agent: ${agent}`);
    
    // Find task for this agent
    const task = findTaskForAgent(prd, agent);
    
    if (!task) {
      console.log(`   No pending tasks for ${agent}`);
      return;
    }
    
    console.log(`   Task: ${task.id} - ${task.title}`);
    
    session.tasksPending++;
    
    try {
      // Dynamically import to avoid circular dependencies
      const { ralphLoop } = await import('../orchestrator/ralph-loop.js');
      
      // Create a mini PRD with just this task
      const miniPRD: PRD = {
        meta: { ...prd.meta },
        tasks: [task],
      };
      
      // Run the task
      await ralphLoop(miniPRD, prdPath);
      
      // Update stats
      session.tasksCompleted++;
      session.tasksPending--;
      
      console.log(`   ✅ Task ${task.id} completed`);
      
      if (onTaskComplete) {
        onTaskComplete(agent, task.id, true);
      }
    } catch (error) {
      session.tasksPending--;
      console.error(`   ❌ Task ${task.id} failed:`, error);
      
      if (onTaskComplete) {
        onTaskComplete(agent, task.id, false);
      }
    }
    
    // Print status line
    console.log(`\n${formatStatusLine(session)}`);
  };
  
  // Debounced version of processChange
  const debouncedProcessChange = debounce((change: PendingChange) => {
    void processChange(change);
  }, debounceMs);
  
  // Handle file change event
  const handleFileChange = (filePath: string): void => {
    const agent = mapFileToAgent(filePath);
    
    if (!agent) {
      return; // File is ignored
    }
    
    // Update session state
    session.watchedFiles.add(filePath);
    session.lastChange = new Date();
    
    // Track pending change
    pendingChange = {
      filePath,
      agent,
      timestamp: new Date(),
    };
    
    // Call user callback if provided
    if (onChange) {
      onChange(filePath, agent);
    }
    
    // Trigger debounced processing
    debouncedProcessChange(pendingChange);
  };
  
  // Set up file watchers recursively
  const watchers: ReturnType<typeof watch>[] = [];
  
  const setupWatcher = (dirPath: string): void => {
    try {
      const watcher = watch(dirPath, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        
        const fullPath = join(dirPath, filename);
        handleFileChange(fullPath);
      });
      
      watchers.push(watcher);
    } catch (error) {
      console.error(`Error watching ${dirPath}:`, error);
    }
  };
  
  // Set up main watcher on src directory
  setupWatcher(fullSrcDir);
  
  // Handle graceful shutdown
  const stop = (): void => {
    console.log('\n\n👋 Stopping watch mode...');
    
    for (const watcher of watchers) {
      watcher.close();
    }
    
    process.exit(0);
  };
  
  // Update session with stop function
  session.stop = stop;
  
  // Register signal handlers
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  
  // Print initial status
  console.log(`\n👀 Watch mode started`);
  console.log(`   PRD: ${prdPath}`);
  console.log(`   Source: ${srcDir}`);
  console.log(`   Debounce: ${debounceMs}ms`);
  console.log(`\n${formatStatusLine(session)}\n`);
  
  return session;
}

// --- CLI Command Handler ---

/**
 * CLI command handler for watch mode
 */
export async function cmdWatch(prdPath: string, options?: Partial<WatchOptions>): Promise<void> {
  startWatchMode(prdPath, {
    debounceMs: options?.debounceMs ?? 500,
    srcDir: options?.srcDir ?? './src',
    onChange: options?.onChange,
    onTaskComplete: options?.onTaskComplete,
  });
  
  // Keep the process running
  // The session will handle SIGINT/SIGTERM
  await new Promise(() => {
    // Infinite wait - user must Ctrl+C to exit
  });
}
