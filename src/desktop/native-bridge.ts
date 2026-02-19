// Native Bridge — R20-02
// TypeScript wrapper for Tauri invoke commands

import type { NativeBridge, FileChangeEvent, GitStatus } from './types.js';

// Mock invoke for testing environments without Tauri
type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type ListenFn = (event: string, handler: (payload: unknown) => void) => () => void;

interface TauriAPI {
  invoke: InvokeFn;
  listen: ListenFn;
}

export class NativeBridgeImpl implements NativeBridge {
  private tauri: TauriAPI | null;
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();

  constructor(tauriApi?: TauriAPI) {
    this.tauri = tauriApi ?? this.detectTauri();
  }

  /**
   * Detect if running in Tauri environment
   */
  private detectTauri(): TauriAPI | null {
    // Check window.__TAURI__ (standard Tauri injection point)
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as unknown as { window?: { __TAURI__?: TauriAPI }; __TAURI__?: TauriAPI };
      if (g.window?.__TAURI__) {
        return g.window.__TAURI__;
      }
      if (g.__TAURI__) {
        return g.__TAURI__;
      }
    }
    return null;
  }

  /**
   * Check if Tauri API is available
   */
  isAvailable(): boolean {
    return this.tauri !== null;
  }

  /**
   * Invoke a Rust command
   */
  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (!this.tauri) {
      throw new Error(`Tauri not available. Cannot invoke command: ${command}`);
    }
    return this.tauri.invoke<T>(command, args);
  }

  /**
   * Listen to Tauri events
   */
  listen(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.tauri) {
      // Store for mock handling
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event)!.add(handler);
      
      return () => {
        this.listeners.get(event)?.delete(handler);
      };
    }

    return this.tauri.listen(event, handler);
  }

  /**
   * Emit a mock event (for testing)
   */
  emitMock(event: string, payload: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(h => h(payload));
    }
  }

  /**
   * File system operations
   */
  fileSystem = {
    readFile: async (path: string): Promise<string> => {
      return this.invoke<string>('read_project_file', { path });
    },

    writeFile: async (path: string, content: string): Promise<void> => {
      return this.invoke<void>('write_file', { path, content });
    },

    watchDir: (path: string, handler: (event: FileChangeEvent) => void): () => void => {
      // Start watching
      this.invoke('watch_project', { path }).catch(console.error);
      
      // Listen for file change events
      const unlisten = this.listen('file-change', (payload) => {
        handler(payload as FileChangeEvent);
      });

      return unlisten;
    },
  };

  /**
   * Git operations
   */
  git = {
    commit: async (message: string, files: string[]): Promise<string> => {
      return this.invoke<string>('git_commit', { message, files });
    },

    status: async (): Promise<GitStatus> => {
      return this.invoke<GitStatus>('git_status');
    },
  };

  /**
   * Notifications
   */
  notifications = {
    send: async (title: string, body: string): Promise<void> => {
      return this.invoke<void>('send_notification', { title, body });
    },
  };
}

// Mock bridge for development/testing
export class MockNativeBridge implements NativeBridge {
  private files: Map<string, string> = new Map();
  private gitState: GitStatus = {
    modified: [],
    staged: [],
    untracked: [],
    branch: 'main',
  };
  private eventHandlers: Map<string, Array<(payload: unknown) => void>> = new Map();

  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    switch (command) {
      case 'read_project_file':
        return this.readFileMock(args?.path as string) as unknown as T;
      case 'write_file':
        return this.writeFileMock(args?.path as string, args?.content as string) as unknown as T;
      case 'git_commit':
        return this.gitCommitMock(args?.message as string, args?.files as string[]) as unknown as T;
      case 'git_status':
        return Promise.resolve(this.gitState as unknown as T);
      case 'send_notification':
        return Promise.resolve(undefined as T);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  listen(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);

    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  fileSystem = {
    readFile: async (path: string): Promise<string> => {
      return this.readFileMock(path);
    },

    writeFile: async (path: string, content: string): Promise<void> => {
      return this.writeFileMock(path, content);
    },

    watchDir: (path: string, handler: (event: FileChangeEvent) => void): () => void => {
      // Simulate file changes
      const interval = setInterval(() => {
        handler({
          path: `${path}/file.ts`,
          type: 'modify',
          timestamp: Date.now(),
        });
      }, 5000);

      return () => clearInterval(interval);
    },
  };

  git = {
    commit: async (message: string, files: string[]): Promise<string> => {
      return this.gitCommitMock(message, files);
    },

    status: async (): Promise<GitStatus> => {
      return Promise.resolve(this.gitState);
    },
  };

  notifications = {
    send: async (title: string, body: string): Promise<void> => {
      console.log(`[Notification] ${title}: ${body}`);
      return Promise.resolve();
    },
  };

  // Mock control methods
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  setGitStatus(status: Partial<GitStatus>): void {
    this.gitState = { ...this.gitState, ...status };
  }

  triggerEvent(event: string, payload: unknown): void {
    this.eventHandlers.get(event)?.forEach(h => h(payload));
  }

  private async readFileMock(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  private async writeFileMock(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  private async gitCommitMock(_message: string, _files: string[]): Promise<string> {
    const hash = Math.random().toString(36).substring(2, 10);
    this.gitState.staged = [];
    return hash;
  }
}

export function createNativeBridge(): NativeBridge {
  return new NativeBridgeImpl();
}

export function createMockNativeBridge(): MockNativeBridge {
  return new MockNativeBridge();
}
