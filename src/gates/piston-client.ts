// Piston Client - Code execution service
// Self-hosted code execution engine (like Docker but for code)

const DEFAULT_PISTON_URL = 'http://localhost:2000';

/**
 * Piston execution result
 */
export interface PistonResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Piston runtime information
 */
export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

/**
 * Piston API client
 */
export class PistonClient {
  private pistonUrl: string;
  
  constructor(pistonUrl: string = DEFAULT_PISTON_URL) {
    this.pistonUrl = pistonUrl;
  }
  
  /**
   * Check if Piston is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.pistonUrl}/api/v2/runtimes`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Get available runtimes
   */
  async getRuntimes(): Promise<PistonRuntime[]> {
    try {
      const response = await fetch(`${this.pistonUrl}/api/v2/runtimes`);
      if (!response.ok) {
        return [];
      }
      return await response.json() as PistonRuntime[];
    } catch {
      return [];
    }
  }
  
  /**
   * Execute code with a specific language
   */
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
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language,
          version: '*',
          files: [
            {
              name: `main.${this.getFileExtension(language)}`,
              content: code
            }
          ],
          stdin: '',
          args: [],
          compile_timeout: timeout,
          run_timeout: timeout,
          compile_memory_limit: -1,
          run_memory_limit: -1
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return {
          stdout: '',
          stderr: `Piston API error: ${response.status} ${response.statusText}`,
          exitCode: -1
        };
      }
      
      const data = await response.json() as {
        run?: { stdout?: string; stderr?: string; code?: number };
        compile?: { stdout?: string; stderr?: string; code?: number };
      };
      
      // Use compile output if available, otherwise use run output
      const output = data.compile?.code === 0 ? data.compile : data.run;
      
      return {
        stdout: output?.stdout || '',
        stderr: output?.stderr || '',
        exitCode: output?.code ?? -1
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          stdout: '',
          stderr: 'Execution timed out',
          exitCode: -1
        };
      }
      return {
        stdout: '',
        stderr: `Piston unavailable: ${error.message}`,
        exitCode: -1
      };
    }
  }
  
  /**
   * Execute TypeScript code
   */
  async executeTypeScript(code: string, timeout: number = 30000): Promise<PistonResult> {
    return this.execute('typescript', code, timeout);
  }
  
  /**
   * Execute JavaScript code
   */
  async executeJavaScript(code: string, timeout: number = 30000): Promise<PistonResult> {
    return this.execute('javascript', code, timeout);
  }
  
  /**
   * Execute Python code
   */
  async executePython(code: string, timeout: number = 30000): Promise<PistonResult> {
    return this.execute('python', code, timeout);
  }
  
  /**
   * Get file extension for language
   */
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
      php: 'php'
    };
    return extensions[language.toLowerCase()] || 'txt';
  }
}

/**
 * Singleton instance
 */
let pistonClient: PistonClient | null = null;

export function getPistonClient(): PistonClient {
  if (!pistonClient) {
    pistonClient = new PistonClient();
  }
  return pistonClient;
}
