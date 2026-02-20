// Comprehensive tests for PistonClient

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PistonClient, getPistonClient } from '../piston-client.js';
import type { PistonResult, PistonRuntime } from '../piston-client.js';

// ---------- helpers ----------

/** Build a minimal mock Response for fetch */
function mockResponse(overrides: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
}): Response {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    statusText: overrides.statusText ?? 'OK',
    json: overrides.json ?? (() => Promise.resolve({})),
    // satisfy the Response interface minimally
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(overrides),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(''),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

function makeLLMTask(): { id: string; title: string; agent: string } {
  return { id: 't-1', title: 'Test task', agent: 'MARS' };
}

// ---------- suite ----------

describe('PistonClient', () => {
  let client: PistonClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    client = new PistonClient('http://localhost:2000');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -------- constructor --------

  describe('constructor', () => {
    it('should create a client with the default URL when no argument is provided', () => {
      const defaultClient = new PistonClient();
      expect(defaultClient).toBeInstanceOf(PistonClient);
    });

    it('should create a client with a custom URL', () => {
      const customClient = new PistonClient('http://custom:3000');
      expect(customClient).toBeInstanceOf(PistonClient);
    });
  });

  // -------- isAvailable --------

  describe('isAvailable', () => {
    it('should return true when the Piston API responds with ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.isAvailable();
      expect(result).toBe(true);
    });

    it('should call the /api/v2/runtimes endpoint', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockResponse({ ok: true }));
      globalThis.fetch = fetchSpy;

      await client.isAvailable();

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toBe('http://localhost:2000/api/v2/runtimes');
    });

    it('should send a GET request with an abort signal', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockResponse({ ok: true }));
      globalThis.fetch = fetchSpy;

      await client.isAvailable();

      const options = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(options.method).toBe('GET');
      expect(options.signal).toBeDefined();
    });

    it('should return false when the Piston API responds with a non-ok status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse({ ok: false, status: 503, statusText: 'Service Unavailable' }),
      );

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when fetch throws a network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when the request is aborted', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });
  });

  // -------- getRuntimes --------

  describe('getRuntimes', () => {
    it('should return parsed runtimes on a successful response', async () => {
      const runtimes: PistonRuntime[] = [
        { language: 'typescript', version: '5.0.0', aliases: ['ts'] },
        { language: 'python', version: '3.11.0', aliases: ['py', 'py3'] },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse({ ok: true, json: () => Promise.resolve(runtimes) }),
      );

      const result = await client.getRuntimes();
      expect(result).toEqual(runtimes);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array when the API responds with a non-ok status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse({ ok: false, status: 500 }),
      );

      const result = await client.getRuntimes();
      expect(result).toEqual([]);
    });

    it('should return an empty array when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await client.getRuntimes();
      expect(result).toEqual([]);
    });
  });

  // -------- execute --------

  describe('execute', () => {
    it('should POST to /api/v2/execute with proper headers and body', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        mockResponse({
          ok: true,
          json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }),
        }),
      );
      globalThis.fetch = fetchSpy;

      await client.execute('typescript', 'const x = 1;');

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:2000/api/v2/execute');
      expect(options.method).toBe('POST');

      const headers = options.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should return stdout and exitCode 0 on successful execution', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse({
          ok: true,
          json: () => Promise.resolve({
            run: { stdout: 'Hello World\n', stderr: '', code: 0 },
          }),
        }),
      );

      const result = await client.execute('javascript', 'console.log("Hello World")');
      expect(result.stdout).toBe('Hello World\n');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should prefer compile output when compile code is 0', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse({
          ok: true,
          json: () => Promise.resolve({
            compile: { stdout: 'compile out', stderr: '', code: 0 },
            run: { stdout: 'run out', stderr: '', code: 0 },
          }),
        }),
      );

      const result = await client.execute('typescript', 'const x = 1;');
      // When compile.code === 0, the source uses compile output
      expect(result.stdout).toBe('compile out');
    });

    it('should use run output when compile code is non-zero', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse({
          ok: true,
          json: () => Promise.resolve({
            compile: { stdout: '', stderr: 'compile error', code: 1 },
            run: { stdout: 'run out', stderr: '', code: 0 },
          }),
        }),
      );

      const result = await client.execute('typescript', 'broken code');
      // compile.code !== 0, so output = data.run
      expect(result.stdout).toBe('run out');
    });

    it('should return an error result when the API responds with a non-ok status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse({ ok: false, status: 500, statusText: 'Internal Server Error' }),
      );

      const result = await client.execute('typescript', 'code');
      expect(result.exitCode).toBe(-1);
      expect(result.stderr).toBe('Piston API error: 500 Internal Server Error');
      expect(result.stdout).toBe('');
    });

    it('should return a timeout result when the request is aborted', async () => {
      const abortError: { name: string; message: string } = {
        name: 'AbortError',
        message: 'The operation was aborted.',
      };
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await client.execute('typescript', 'while(true){}', 100);
      expect(result.exitCode).toBe(-1);
      expect(result.stderr).toBe('Execution timed out');
    });

    it('should return Piston unavailable on a generic network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await client.execute('typescript', 'code');
      expect(result.exitCode).toBe(-1);
      expect(result.stderr).toContain('Piston unavailable');
      expect(result.stderr).toContain('Connection refused');
    });

    it('should use "main.ts" as the filename for TypeScript', async () => {
      let capturedBody = '';
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: unknown, opts: unknown) => {
          const reqOpts = opts as RequestInit;
          capturedBody = reqOpts.body as string;
          return Promise.resolve(
            mockResponse({
              ok: true,
              json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }),
            }),
          );
        },
      );

      await client.execute('typescript', 'const x = 1;');
      expect(capturedBody).toContain('main.ts');
    });

    it('should use "main.js" as the filename for JavaScript', async () => {
      let capturedBody = '';
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: unknown, opts: unknown) => {
          const reqOpts = opts as RequestInit;
          capturedBody = reqOpts.body as string;
          return Promise.resolve(
            mockResponse({
              ok: true,
              json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }),
            }),
          );
        },
      );

      await client.execute('javascript', 'console.log(1)');
      expect(capturedBody).toContain('main.js');
    });

    it('should use "main.py" as the filename for Python', async () => {
      let capturedBody = '';
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: unknown, opts: unknown) => {
          const reqOpts = opts as RequestInit;
          capturedBody = reqOpts.body as string;
          return Promise.resolve(
            mockResponse({
              ok: true,
              json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }),
            }),
          );
        },
      );

      await client.execute('python', 'print("hi")');
      expect(capturedBody).toContain('main.py');
    });

    it('should fall back to "main.txt" for unknown languages', async () => {
      let capturedBody = '';
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: unknown, opts: unknown) => {
          const reqOpts = opts as RequestInit;
          capturedBody = reqOpts.body as string;
          return Promise.resolve(
            mockResponse({
              ok: true,
              json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }),
            }),
          );
        },
      );

      await client.execute('brainfuck', '+++++++');
      expect(capturedBody).toContain('main.txt');
    });

    it('should handle missing stdout/stderr/code fields gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse({
          ok: true,
          json: () => Promise.resolve({ run: {} }),
        }),
      );

      const result = await client.execute('typescript', 'code');
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(-1);
    });
  });

  // -------- convenience methods --------

  describe('executeTypeScript', () => {
    it('should delegate to execute with language "typescript"', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse({
          ok: true,
          json: () => Promise.resolve({ run: { stdout: 'ts out', stderr: '', code: 0 } }),
        }),
      );

      const result = await client.executeTypeScript('const x: number = 1;');
      expect(result.stdout).toBe('ts out');
    });

    it('should pass the timeout to execute', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        mockResponse({
          ok: true,
          json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }),
        }),
      );
      globalThis.fetch = fetchSpy;

      await client.executeTypeScript('code', 5000);

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.compile_timeout).toBe(5000);
      expect(body.run_timeout).toBe(5000);
    });
  });

  describe('executeJavaScript', () => {
    it('should delegate to execute with language "javascript"', async () => {
      let capturedBody = '';
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: unknown, opts: unknown) => {
          const reqOpts = opts as RequestInit;
          capturedBody = reqOpts.body as string;
          return Promise.resolve(
            mockResponse({
              ok: true,
              json: () => Promise.resolve({ run: { stdout: 'js out', stderr: '', code: 0 } }),
            }),
          );
        },
      );

      const result = await client.executeJavaScript('console.log("hi")');
      expect(result.stdout).toBe('js out');
      expect(capturedBody).toContain('"language":"javascript"');
    });
  });

  describe('executePython', () => {
    it('should delegate to execute with language "python"', async () => {
      let capturedBody = '';
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: unknown, opts: unknown) => {
          const reqOpts = opts as RequestInit;
          capturedBody = reqOpts.body as string;
          return Promise.resolve(
            mockResponse({
              ok: true,
              json: () => Promise.resolve({ run: { stdout: 'py out', stderr: '', code: 0 } }),
            }),
          );
        },
      );

      const result = await client.executePython('print("hi")');
      expect(result.stdout).toBe('py out');
      expect(capturedBody).toContain('"language":"python"');
    });
  });

  // -------- singleton --------

  describe('getPistonClient (singleton)', () => {
    it('should return the same instance on subsequent calls', () => {
      const c1 = getPistonClient();
      const c2 = getPistonClient();
      expect(c1).toBe(c2);
    });

    it('should return a PistonClient instance', () => {
      const instance = getPistonClient();
      expect(instance).toBeInstanceOf(PistonClient);
    });
  });
});
