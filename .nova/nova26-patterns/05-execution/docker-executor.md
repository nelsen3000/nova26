# Docker Executor

## Source
Extracted from Nova26 `src/sandbox/docker-executor.ts`

---

## Pattern: Sandboxed Code Execution with Fallback

The Docker Executor pattern provides safe, isolated code execution for AI-generated code. It uses Docker containers as the primary sandbox with an automatic fallback to Node.js child processes when Docker is unavailable. This strategy-based execution model lets agents run generated code, observe stdout/stderr, and self-correct — all without risking the host system.

The pattern implements three key concerns: environment detection (Docker availability caching), execution isolation (container resource limits, network disabling, read-only mounts), and output normalization (unified `ExecutionResult` interface regardless of execution method).

---

## Implementation

### Code Example

```typescript
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

// Cached Docker availability check — only runs once
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
 * Execute code in a sandboxed environment.
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

  const shouldUseDocker = useDocker ?? isDockerAvailable();

  if (shouldUseDocker) {
    return executeInDocker(code, { timeout, language, memoryLimit, networkDisabled });
  }
  return executeWithNode(code, { timeout, language });
}
```

### Docker Execution with Resource Limits

```typescript
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
    const ext = options.language === 'typescript' ? 'ts' : options.language === 'python' ? 'py' : 'js';
    const filename = `run.${ext}`;
    writeFileSync(join(workDir, filename), code);

    // Select Docker image and command based on language
    let image: string;
    let cmd: string;
    if (options.language === 'typescript') {
      image = 'node:20-slim';
      cmd = `npx --yes tsx /work/${filename}`;
    } else if (options.language === 'python') {
      image = 'python:3.12-slim';
      cmd = `python /work/${filename}`;
    } else {
      image = 'node:20-slim';
      cmd = `node /work/${filename}`;
    }

    // Build Docker command with security constraints
    const dockerArgs = [
      'run', '--rm',
      '--memory', options.memoryLimit,
      '--cpus', '1',
      options.networkDisabled ? '--network=none' : '',
      '-v', `${workDir}:/work:ro`,  // Read-only mount
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
          stdout: stdout.slice(0, 10000),
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
    try { rmSync(workDir, { recursive: true }); } catch { /* ignore */ }
  }
}
```

### Code Block Extraction and Batch Execution

```typescript
/**
 * Extract code blocks from LLM response and execute them sequentially.
 * Stops on first failure for fast feedback.
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

    const tag = match[0].split('\n')[0].replace('```', '').trim();
    const language = tag.includes('python') || tag === 'py' ? 'python' as const :
                     tag.includes('typescript') || tag === 'ts' ? 'typescript' as const :
                     'javascript' as const;

    const result = await executeInSandbox(code, { ...options, language });
    results.push(result);

    if (!result.success) break; // Stop on first failure
  }

  return results;
}
```

### Key Concepts

- **Strategy Pattern with auto-detection**: Docker is preferred but the system gracefully falls back to Node.js child processes
- **Cached capability check**: `isDockerAvailable()` runs `docker info` once and caches the result for the process lifetime
- **Resource isolation**: Docker containers run with memory limits (`256m`), CPU limits (`1`), network disabled, and read-only volume mounts
- **Ephemeral work directories**: Each execution gets a UUID-based temp directory, cleaned up in `finally` blocks
- **Output capping**: stdout/stderr are truncated to 10,000 characters to prevent memory issues from runaway output
- **Fail-fast batch execution**: `executeCodeBlocks` stops at the first failure, giving agents immediate feedback

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Running untrusted code directly in the host process
import { exec } from 'child_process';

function runCode(code: string): void {
  // DANGEROUS: No isolation, no timeout, no resource limits
  exec(`node -e "${code}"`, (err, stdout, stderr) => {
    console.log(stdout);
  });
}

// No cleanup of temp files
function executeUnsafe(code: string): void {
  const dir = '/tmp/run';
  writeFileSync(`${dir}/code.js`, code);
  execSync(`node ${dir}/code.js`);
  // Temp files left behind forever
}
```

### ✅ Do This Instead

```typescript
// Use the sandbox with proper isolation and cleanup
const result = await executeInSandbox(code, {
  timeout: 30000,
  memoryLimit: '256m',
  networkDisabled: true,
});

// Unified result interface regardless of execution method
if (!result.success) {
  console.error(`Execution failed (${result.method}): ${result.stderr}`);
}
// Temp directories are automatically cleaned up in finally blocks
```

---

## When to Use This Pattern

✅ **Use for:**
- Executing AI-generated code that needs verification before integration
- Running untrusted or dynamically generated code in a safe environment
- Building self-correcting agent loops that observe execution output and retry
- Type-checking generated TypeScript without executing it

❌ **Don't use for:**
- Running trusted application code that's part of the build pipeline (use standard build tools)
- Long-running services or daemons (the sandbox has hard timeouts)
- Code that requires persistent state between executions (each run is ephemeral)

---

## Benefits

1. **Security by default** — Docker containers with network disabled, memory limits, CPU limits, and read-only mounts prevent malicious code from affecting the host
2. **Graceful degradation** — Automatic fallback from Docker to Node.js child processes means the system works in any environment
3. **Unified interface** — `ExecutionResult` normalizes output across all execution methods, simplifying downstream consumption
4. **Automatic cleanup** — Ephemeral work directories with `finally`-block cleanup prevent disk space leaks
5. **Agent-friendly feedback** — `formatExecutionFeedback()` converts results into markdown that agents can parse and act on

---

## Related Patterns

- See `../03-quality-gates/typescript-gate.md` for the quality gate that uses type-checking to validate generated code
- See `../03-quality-gates/piston-client.md` for an alternative remote code execution service (Piston API)
- See `../03-quality-gates/test-runner-gate.md` for running test suites as a quality gate after code generation
- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that triggers sandboxed execution

---

*Extracted: 2025-07-18*
