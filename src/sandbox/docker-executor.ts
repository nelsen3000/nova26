// Sandboxed Code Execution - Docker-based with Node.js child_process fallback
// Allows agents to execute generated code, observe stdout/stderr, and self-correct

import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  method: 'docker' | 'node' | 'piston';
}

export interface SandboxOptions {
  timeout?: number;       // ms, default 30000
  language?: 'typescript' | 'javascript' | 'python';
  useDocker?: boolean;    // Force docker, default auto-detect
  memoryLimit?: string;   // Docker memory limit, default '256m'
  networkDisabled?: boolean; // Disable network in sandbox, default true
}

const SANDBOX_DIR = join(process.cwd(), '.nova', 'sandbox');

// Check if Docker is available
let dockerAvailable: boolean | null = null;
function isDockerAvailable(): boolean {
  if (dockerAvailable !== null) return dockerAvailable;
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 5000 });
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
  }
  return dockerAvailable;
}

/**
 * Execute code in a sandboxed environment
 * Priority: Docker > Node.js child_process
 */
export async function executeInSandbox(
  code: string,
  options: SandboxOptions = {}
): Promise<ExecutionResult> {
  const {
    timeout = 30000,
    language = 'typescript',
    useDocker,
    memoryLimit = '256m',
    networkDisabled = true,
  } = options;

  // Auto-detect execution method
  const shouldUseDocker = useDocker ?? isDockerAvailable();

  if (shouldUseDocker) {
    return executeInDocker(code, { timeout, language, memoryLimit, networkDisabled });
  }
  return executeWithNode(code, { timeout, language });
}

/**
 * Execute code in Docker container
 */
async function executeInDocker(
  code: string,
  options: { timeout: number; language: string; memoryLimit: string; networkDisabled: boolean }
): Promise<ExecutionResult> {
  const runId = randomUUID().slice(0, 8);
  const workDir = join(SANDBOX_DIR, runId);

  if (!existsSync(SANDBOX_DIR)) mkdirSync(SANDBOX_DIR, { recursive: true });
  mkdirSync(workDir, { recursive: true });

  const start = Date.now();

  try {
    // Write code to temp file
    const ext = options.language === 'typescript' ? 'ts' : options.language === 'python' ? 'py' : 'js';
    const filename = `run.${ext}`;
    writeFileSync(join(workDir, filename), code);

    // Select Docker image and command
    let image: string;
    let cmd: string;
    if (options.language === 'typescript') {
      image = 'node:20-slim';
      // Install tsx on-the-fly for TypeScript execution
      cmd = `npx --yes tsx /work/${filename}`;
    } else if (options.language === 'python') {
      image = 'python:3.12-slim';
      cmd = `python /work/${filename}`;
    } else {
      image = 'node:20-slim';
      cmd = `node /work/${filename}`;
    }

    // Build Docker command
    const dockerArgs = [
      'run', '--rm',
      '--memory', options.memoryLimit,
      '--cpus', '1',
      options.networkDisabled ? '--network=none' : '',
      '-v', `${workDir}:/work:ro`,
      '-w', '/work',
      image,
      'sh', '-c', cmd
    ].filter(Boolean);

    return new Promise<ExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn('docker', dockerArgs, { timeout: options.timeout });

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (exitCode) => {
        resolve({
          success: exitCode === 0,
          stdout: stdout.slice(0, 10000), // Cap output
          stderr: stderr.slice(0, 10000),
          exitCode: exitCode ?? 1,
          duration: Date.now() - start,
          method: 'docker',
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          stdout: '',
          stderr: `Docker execution failed: ${err.message}`,
          exitCode: 1,
          duration: Date.now() - start,
          method: 'docker',
        });
      });
    });
  } finally {
    // Cleanup
    try { rmSync(workDir, { recursive: true }); } catch { /* ignore */ }
  }
}

/**
 * Execute code using Node.js child_process (fallback when Docker unavailable)
 */
async function executeWithNode(
  code: string,
  options: { timeout: number; language: string }
): Promise<ExecutionResult> {
  const runId = randomUUID().slice(0, 8);
  const workDir = join(SANDBOX_DIR, runId);

  if (!existsSync(SANDBOX_DIR)) mkdirSync(SANDBOX_DIR, { recursive: true });
  mkdirSync(workDir, { recursive: true });

  const start = Date.now();

  try {
    const ext = options.language === 'typescript' ? 'ts' : options.language === 'python' ? 'py' : 'js';
    const filename = `run.${ext}`;
    writeFileSync(join(workDir, filename), code);

    let cmd: string;
    if (options.language === 'typescript') {
      cmd = `npx tsx ${join(workDir, filename)}`;
    } else if (options.language === 'python') {
      cmd = `python3 ${join(workDir, filename)}`;
    } else {
      cmd = `node ${join(workDir, filename)}`;
    }

    return new Promise<ExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn('sh', ['-c', cmd], {
        timeout: options.timeout,
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      });

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (exitCode) => {
        resolve({
          success: exitCode === 0,
          stdout: stdout.slice(0, 10000),
          stderr: stderr.slice(0, 10000),
          exitCode: exitCode ?? 1,
          duration: Date.now() - start,
          method: 'node',
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          stdout: '',
          stderr: `Node execution failed: ${err.message}`,
          exitCode: 1,
          duration: Date.now() - start,
          method: 'node',
        });
      });
    });
  } finally {
    try { rmSync(workDir, { recursive: true }); } catch { /* ignore */ }
  }
}

/**
 * Run TypeScript type-checking on code (no execution)
 */
export async function typeCheck(code: string): Promise<ExecutionResult> {
  const runId = randomUUID().slice(0, 8);
  const workDir = join(SANDBOX_DIR, runId);

  if (!existsSync(SANDBOX_DIR)) mkdirSync(SANDBOX_DIR, { recursive: true });
  mkdirSync(workDir, { recursive: true });

  const start = Date.now();

  try {
    writeFileSync(join(workDir, 'check.ts'), code);

    // Minimal tsconfig for checking
    writeFileSync(join(workDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        skipLibCheck: true,
      },
      include: ['check.ts'],
    }));

    return new Promise<ExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn('npx', ['tsc', '--noEmit', '-p', join(workDir, 'tsconfig.json')], {
        timeout: 15000,
      });

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (exitCode) => {
        resolve({
          success: exitCode === 0,
          stdout: stdout.slice(0, 10000),
          stderr: stderr.slice(0, 10000),
          exitCode: exitCode ?? 1,
          duration: Date.now() - start,
          method: 'node',
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          stdout: '',
          stderr: `Type check failed: ${err.message}`,
          exitCode: 1,
          duration: Date.now() - start,
          method: 'node',
        });
      });
    });
  } finally {
    try { rmSync(workDir, { recursive: true }); } catch { /* ignore */ }
  }
}

/**
 * Extract code blocks from LLM response and execute them
 */
export async function executeCodeBlocks(
  content: string,
  options: SandboxOptions = {}
): Promise<ExecutionResult[]> {
  const codeBlockRegex = /```(?:typescript|ts|javascript|js|python|py)\n([\s\S]*?)```/g;
  const results: ExecutionResult[] = [];
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const code = match[1].trim();
    if (code.length < 10) continue; // Skip trivial blocks

    // Detect language from code block tag
    const tag = match[0].split('\n')[0].replace('```', '').trim();
    const language = tag.includes('python') || tag === 'py' ? 'python' as const :
                     tag.includes('typescript') || tag === 'ts' ? 'typescript' as const :
                     'javascript' as const;

    const result = await executeInSandbox(code, { ...options, language });
    results.push(result);

    // Stop on first failure
    if (!result.success) break;
  }

  return results;
}

/**
 * Format execution results for feeding back to agent
 */
export function formatExecutionFeedback(results: ExecutionResult[]): string {
  if (results.length === 0) return 'No executable code blocks found.';

  const lines: string[] = ['## Execution Results\n'];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`### Code Block ${i + 1} (${r.method})`);
    lines.push(`**Status:** ${r.success ? 'PASSED' : 'FAILED'}`);
    lines.push(`**Duration:** ${r.duration}ms`);

    if (r.stdout) {
      lines.push(`**stdout:**\n\`\`\`\n${r.stdout.slice(0, 2000)}\n\`\`\``);
    }
    if (r.stderr) {
      lines.push(`**stderr:**\n\`\`\`\n${r.stderr.slice(0, 2000)}\n\`\`\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}
