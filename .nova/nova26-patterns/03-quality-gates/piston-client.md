# Piston Client

## Source
Extracted from Nova26 `src/gates/piston-client.ts`

---

## Pattern: Piston Client

The Piston client provides a typed HTTP wrapper around the self-hosted Piston code execution API. It manages runtime discovery, multi-language code execution with configurable timeouts, and abort-controller-based cancellation. The client uses a singleton pattern for shared access across gates and includes language-to-file-extension mapping for Piston's file-based execution model. All methods degrade gracefully — network failures and timeouts return structured error results instead of throwing.

---

## Implementation

### Code Example

```typescript
const DEFAULT_PISTON_URL = 'http://localhost:2000';

export interface PistonResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

export class PistonClient {
  private pistonUrl: string;

  constructor(pistonUrl: string = DEFAULT_PISTON_URL) {
    this.pistonUrl = pistonUrl;
  }

  /** Health check with a 5-second timeout. */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${this.pistonUrl}/api/v2/runtimes`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Discover installed language runtimes. */
  async getRuntimes(): Promise<PistonRuntime[]> {
    try {
      const response = await fetch(`${this.pistonUrl}/api/v2/runtimes`);
      if (!response.ok) return [];
      return (await response.json()) as PistonRuntime[];
    } catch {
      return [];
    }
  }

  /** Execute code in a specified language with timeout and memory limits. */
  async execute(
    language: string,
    code: string,
    timeout: number = 30000
  ): Promise<PistonResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.pistonUrl}/api/v2/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          version: '*',
          files: [{ name: `main.${this.getFileExtension(language)}`, content: code }],
          stdin: '',
          args: [],
          compile_timeout: timeout,
          run_timeout: timeout,
          compile_memory_limit: -1,
          run_memory_limit: -1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          stdout: '',
          stderr: `Piston API error: ${response.status} ${response.statusText}`,
          exitCode: -1,
        };
      }

      const data = (await response.json()) as {
        run?: { stdout?: string; stderr?: string; code?: number };
        compile?: { stdout?: string; stderr?: string; code?: number };
      };

      const output = data.compile?.code === 0 ? data.compile : data.run;
      return {
        stdout: output?.stdout || '',
        stderr: output?.stderr || '',
        exitCode: output?.code ?? -1,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { stdout: '', stderr: 'Execution timed out', exitCode: -1 };
      }
      return { stdout: '', stderr: `Piston unavailable: ${error.message}`, exitCode: -1 };
    }
  }

  /** Convenience: execute TypeScript. */
  async executeTypeScript(code: string, timeout = 30000): Promise<PistonResult> {
    return this.execute('typescript', code, timeout);
  }

  /** Convenience: execute JavaScript. */
  async executeJavaScript(code: string, timeout = 30000): Promise<PistonResult> {
    return this.execute('javascript', code, timeout);
  }

  /** Convenience: execute Python. */
  async executePython(code: string, timeout = 30000): Promise<PistonResult> {
    return this.execute('python', code, timeout);
  }

  /** Map language name to file extension for Piston's file-based model. */
  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      go: 'go',
      rust: 'rs',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      ruby: 'rb',
      php: 'php',
    };
    return extensions[language.toLowerCase()] || 'txt';
  }
}

/** Singleton accessor — shared across all gates. */
let pistonClient: PistonClient | null = null;

export function getPistonClient(): PistonClient {
  if (!pistonClient) {
    pistonClient = new PistonClient();
  }
  return pistonClient;
}
```

### Key Concepts

- Singleton pattern via `getPistonClient()` for shared access across TypeScript gate and test runner gate
- AbortController-based timeouts on both health checks (5s) and code execution (configurable, default 30s)
- Compile-then-run output selection: prefers compile output when compilation succeeds, falls back to run output
- Language-to-extension mapping for Piston's file-based execution model (10 languages supported)
- Never-throw design: all methods return structured results or safe defaults on failure

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Throwing on network failure — crashes the gate pipeline
async isAvailable(): Promise<boolean> {
  const response = await fetch(`${this.pistonUrl}/api/v2/runtimes`);
  return response.ok;
  // ^^^ fetch throws on network error, crashing the caller
}

// No timeout on execution — infinite loops in user code hang forever
async execute(language: string, code: string): Promise<PistonResult> {
  const response = await fetch(`${this.pistonUrl}/api/v2/execute`, {
    method: 'POST',
    body: JSON.stringify({ language, version: '*', files: [{ content: code }] }),
  });
  // ^^^ No AbortController, no timeout — hangs indefinitely
}

// Creating a new client per call — wasteful and inconsistent
export function runTypeScript(code: string) {
  const client = new PistonClient(); // New instance every time
  return client.executeTypeScript(code);
}
```

### ✅ Do This Instead

```typescript
// Catch network errors and return false
async isAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${this.pistonUrl}/api/v2/runtimes`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// Use AbortController with configurable timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);
const response = await fetch(url, { signal: controller.signal });
clearTimeout(timeoutId);

// Use singleton for shared access
const client = getPistonClient();
```

---

## When to Use This Pattern

✅ **Use for:**
- Executing untrusted or LLM-generated code in a sandboxed environment
- Runtime validation of code blocks across multiple languages (TypeScript, JavaScript, Python, etc.)

❌ **Don't use for:**
- Production code execution — Piston is a development/CI tool, not a production runtime
- Long-running processes or stateful applications that exceed execution timeouts

---

## Benefits

1. Never-throw API — callers always get structured results, never unhandled exceptions
2. AbortController timeouts prevent infinite loops in untrusted code from hanging the pipeline
3. Multi-language support with a single unified interface (10 languages, extensible)
4. Singleton pattern ensures consistent configuration and connection reuse across gates

---

## Related Patterns

- See `typescript-gate.md` for the TypeScript compilation gate that uses this client
- See `test-runner-gate.md` for the smoke test gate that uses this client
- See `../01-orchestration/gate-runner-pipeline.md` for the pipeline that orchestrates all quality gates

---

*Extracted: 2025-07-15*
