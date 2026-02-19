// Native Bridge Tests — R20-02
// Comprehensive vitest suite for NativeBridgeImpl and MockNativeBridge

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NativeBridgeImpl,
  MockNativeBridge,
  createNativeBridge,
  createMockNativeBridge,
} from '../native-bridge.js';
import type { NativeBridge, FileChangeEvent, GitStatus } from '../types.js';

describe('NativeBridgeImpl', () => {
  describe('invoke wrapper', () => {
    it('returns result when Tauri is available', async () => {
      const mockInvoke = vi.fn().mockResolvedValue('test-result');
      const mockTauri = {
        invoke: mockInvoke,
        listen: vi.fn(),
      };
      const bridge = new NativeBridgeImpl(mockTauri);

      const result = await bridge.invoke<string>('test_command', { key: 'value' });

      expect(result).toBe('test-result');
      expect(mockInvoke).toHaveBeenCalledWith('test_command', { key: 'value' });
    });

    it('throws when Tauri is unavailable', async () => {
      const bridge = new NativeBridgeImpl(null);

      await expect(bridge.invoke('test_command')).rejects.toThrow(
        'Tauri not available. Cannot invoke command: test_command'
      );
    });

    it('passes correct arguments to invoke', async () => {
      const mockInvoke = vi.fn().mockResolvedValue(42);
      const mockTauri = {
        invoke: mockInvoke,
        listen: vi.fn(),
      };
      const bridge = new NativeBridgeImpl(mockTauri);
      const args = { path: '/test/file.txt', content: 'hello' };

      await bridge.invoke<number>('write_file', args);

      expect(mockInvoke).toHaveBeenCalledExactlyOnceWith('write_file', args);
    });

    it('handles errors from Tauri invoke', async () => {
      const mockInvoke = vi.fn().mockRejectedValue(new Error('Permission denied'));
      const mockTauri = {
        invoke: mockInvoke,
        listen: vi.fn(),
      };
      const bridge = new NativeBridgeImpl(mockTauri);

      await expect(bridge.invoke('read_file', { path: '/etc/passwd' })).rejects.toThrow(
        'Permission denied'
      );
    });

    it('detects Tauri from window.__TAURI__ when not provided', () => {
      const mockTauri = {
        invoke: vi.fn(),
        listen: vi.fn(),
      };
      vi.stubGlobal('window', { __TAURI__: mockTauri });

      const bridge = new NativeBridgeImpl();

      expect(bridge.isAvailable()).toBe(true);
      vi.unstubAllGlobals();
    });

    it('returns correct types for different commands', async () => {
      const mockInvoke = vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'git_status') {
          return Promise.resolve({
            modified: ['file1.ts'],
            staged: ['file2.ts'],
            untracked: ['file3.ts'],
            branch: 'main',
          });
        }
        if (cmd === 'read_project_file') {
          return Promise.resolve('file content');
        }
        return Promise.resolve(null);
      });
      const mockTauri = {
        invoke: mockInvoke,
        listen: vi.fn(),
      };
      const bridge = new NativeBridgeImpl(mockTauri);

      const gitStatus = await bridge.invoke<GitStatus>('git_status');
      expect(gitStatus.branch).toBe('main');
      expect(Array.isArray(gitStatus.modified)).toBe(true);

      const content = await bridge.invoke<string>('read_project_file', { path: 'test.ts' });
      expect(typeof content).toBe('string');
    });
  });

  describe('listen/unlisten', () => {
    it('registers handler and returns unlisten function when Tauri unavailable', () => {
      const bridge = new NativeBridgeImpl(null);
      const handler = vi.fn();

      const unlisten = bridge.listen('test-event', handler);

      expect(typeof unlisten).toBe('function');
    });

    it('emits events to registered handlers via emitMock', () => {
      const bridge = new NativeBridgeImpl(null);
      const handler = vi.fn();
      const payload = { data: 'test' };

      bridge.listen('test-event', handler);
      bridge.emitMock('test-event', payload);

      expect(handler).toHaveBeenCalledExactlyOnceWith(payload);
    });

    it('removes handler when unlisten is called', () => {
      const bridge = new NativeBridgeImpl(null);
      const handler = vi.fn();

      const unlisten = bridge.listen('test-event', handler);
      unlisten();
      bridge.emitMock('test-event', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple listeners for the same event', () => {
      const bridge = new NativeBridgeImpl(null);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const payload = { message: 'hello' };

      bridge.listen('test-event', handler1);
      bridge.listen('test-event', handler2);
      bridge.emitMock('test-event', payload);

      expect(handler1).toHaveBeenCalledExactlyOnceWith(payload);
      expect(handler2).toHaveBeenCalledExactlyOnceWith(payload);
    });

    it('delegates to Tauri listen when available', () => {
      const unlistenFn = vi.fn();
      const mockListen = vi.fn().mockReturnValue(unlistenFn);
      const mockTauri = {
        invoke: vi.fn(),
        listen: mockListen,
      };
      const bridge = new NativeBridgeImpl(mockTauri);
      const handler = vi.fn();

      const unlisten = bridge.listen('file-change', handler);

      expect(mockListen).toHaveBeenCalledExactlyOnceWith('file-change', handler);
      expect(unlisten).toBe(unlistenFn);
    });
  });

  describe('fileSystem operations', () => {
    it('readFile invokes correct command with path', async () => {
      const mockInvoke = vi.fn().mockResolvedValue('file content');
      const mockTauri = {
        invoke: mockInvoke,
        listen: vi.fn(),
      };
      const bridge = new NativeBridgeImpl(mockTauri);

      const content = await bridge.fileSystem.readFile('/project/test.ts');

      expect(content).toBe('file content');
      expect(mockInvoke).toHaveBeenCalledWith('read_project_file', { path: '/project/test.ts' });
    });

    it('writeFile invokes correct command with path and content', async () => {
      const mockInvoke = vi.fn().mockResolvedValue(undefined);
      const mockTauri = {
        invoke: mockInvoke,
        listen: vi.fn(),
      };
      const bridge = new NativeBridgeImpl(mockTauri);

      await bridge.fileSystem.writeFile('/project/test.ts', 'const x = 1;');

      expect(mockInvoke).toHaveBeenCalledWith('write_file', {
        path: '/project/test.ts',
        content: 'const x = 1;',
      });
    });

    it('watchDir invokes watch_project and listens for file-change events', async () => {
      const mockInvoke = vi.fn().mockResolvedValue(undefined);
      const mockListen = vi.fn().mockReturnValue(vi.fn());
      const mockTauri = {
        invoke: mockInvoke,
        listen: mockListen,
      };
      const bridge = new NativeBridgeImpl(mockTauri);
      const handler = vi.fn();

      bridge.fileSystem.watchDir('/project', handler);

      expect(mockInvoke).toHaveBeenCalledWith('watch_project', { path: '/project' });
      expect(mockListen).toHaveBeenCalledWith('file-change', expect.any(Function));
    });

    it('watchDir returns unlisten function', async () => {
      const mockUnlisten = vi.fn();
      const mockInvoke = vi.fn().mockResolvedValue(undefined);
      const mockListen = vi.fn().mockReturnValue(mockUnlisten);
      const mockTauri = {
        invoke: mockInvoke,
        listen: mockListen,
      };
      const bridge = new NativeBridgeImpl(mockTauri);

      const unwatch = bridge.fileSystem.watchDir('/project', vi.fn());

      expect(typeof unwatch).toBe('function');
      unwatch();
      expect(mockUnlisten).toHaveBeenCalled();
    });
  });

  describe('git operations', () => {
    it('commit invokes git_commit with message and files', async () => {
      const mockInvoke = vi.fn().mockResolvedValue('abc123');
      const mockTauri = {
        invoke: mockInvoke,
        listen: vi.fn(),
      };
      const bridge = new NativeBridgeImpl(mockTauri);

      const hash = await bridge.git.commit('Initial commit', ['file1.ts', 'file2.ts']);

      expect(hash).toBe('abc123');
      expect(mockInvoke).toHaveBeenCalledWith('git_commit', {
        message: 'Initial commit',
        files: ['file1.ts', 'file2.ts'],
      });
    });

    it('status invokes git_status and returns GitStatus', async () => {
      const gitStatus: GitStatus = {
        modified: ['modified.ts'],
        staged: ['staged.ts'],
        untracked: ['untracked.ts'],
        branch: 'feature-branch',
      };
      const mockInvoke = vi.fn().mockResolvedValue(gitStatus);
      const mockTauri = {
        invoke: mockInvoke,
        listen: vi.fn(),
      };
      const bridge = new NativeBridgeImpl(mockTauri);

      const status = await bridge.git.status();

      expect(status).toEqual(gitStatus);
      expect(mockInvoke).toHaveBeenCalledWith('git_status', undefined);
    });
  });
});

describe('MockNativeBridge', () => {
  let mockBridge: MockNativeBridge;

  beforeEach(() => {
    mockBridge = new MockNativeBridge();
  });

  describe('interface compliance', () => {
    it('implements NativeBridge interface', () => {
      const bridge: NativeBridge = mockBridge;
      expect(bridge.invoke).toBeDefined();
      expect(bridge.listen).toBeDefined();
      expect(bridge.fileSystem).toBeDefined();
      expect(bridge.git).toBeDefined();
      expect(bridge.notifications).toBeDefined();
    });
  });

  describe('invoke wrapper', () => {
    it('returns result for read_project_file command', async () => {
      mockBridge.setFile('/test.txt', 'Hello World');

      const result = await mockBridge.invoke<string>('read_project_file', { path: '/test.txt' });

      expect(result).toBe('Hello World');
    });

    it('throws for unknown command', async () => {
      await expect(mockBridge.invoke('unknown_command')).rejects.toThrow('Unknown command: unknown_command');
    });
  });

  describe('listen/unlisten', () => {
    it('registers handler via listen', () => {
      const handler = vi.fn();

      const unlisten = mockBridge.listen('test-event', handler);

      expect(typeof unlisten).toBe('function');
    });

    it('triggers event handlers via triggerEvent', () => {
      const handler = vi.fn();
      const payload = { data: 'test payload' };

      mockBridge.listen('custom-event', handler);
      mockBridge.triggerEvent('custom-event', payload);

      expect(handler).toHaveBeenCalledExactlyOnceWith(payload);
    });

    it('unlisten removes handler', () => {
      const handler = vi.fn();

      const unlisten = mockBridge.listen('test-event', handler);
      unlisten();
      mockBridge.triggerEvent('test-event', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      mockBridge.listen('multi-event', handler1);
      mockBridge.listen('multi-event', handler2);
      mockBridge.triggerEvent('multi-event', { value: 42 });

      expect(handler1).toHaveBeenCalledExactlyOnceWith({ value: 42 });
      expect(handler2).toHaveBeenCalledExactlyOnceWith({ value: 42 });
    });
  });

  describe('fileSystem operations', () => {
    it('readFile returns content for existing file', async () => {
      mockBridge.setFile('/project/src/index.ts', 'export const foo = 1;');

      const content = await mockBridge.fileSystem.readFile('/project/src/index.ts');

      expect(content).toBe('export const foo = 1;');
    });

    it('readFile throws for missing file', async () => {
      await expect(mockBridge.fileSystem.readFile('/nonexistent/file.txt')).rejects.toThrow(
        'File not found: /nonexistent/file.txt'
      );
    });

    it('writeFile stores content', async () => {
      await mockBridge.fileSystem.writeFile('/project/new.ts', 'const x = 1;');

      const content = await mockBridge.fileSystem.readFile('/project/new.ts');
      expect(content).toBe('const x = 1;');
    });

    it('writeFile overwrites existing file', async () => {
      await mockBridge.fileSystem.writeFile('/project/file.ts', 'original');
      await mockBridge.fileSystem.writeFile('/project/file.ts', 'updated');

      const content = await mockBridge.fileSystem.readFile('/project/file.ts');
      expect(content).toBe('updated');
    });

    it('watchDir returns unwatch function', () => {
      const handler = vi.fn();

      const unwatch = mockBridge.fileSystem.watchDir('/project', handler);

      expect(typeof unwatch).toBe('function');
      unwatch();
    });
  });

  describe('git operations', () => {
    it('commit returns hash string', async () => {
      const hash = await mockBridge.git.commit('Test commit', ['file1.ts']);

      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('commit clears staged files', async () => {
      mockBridge.setGitStatus({ staged: ['file1.ts', 'file2.ts'] });

      await mockBridge.git.commit('Test commit', ['file1.ts', 'file2.ts']);
      const status = await mockBridge.git.status();

      expect(status.staged).toEqual([]);
    });

    it('status returns GitStatus', async () => {
      const customStatus: GitStatus = {
        modified: ['mod.ts'],
        staged: ['staged.ts'],
        untracked: ['untracked.ts'],
        branch: 'develop',
      };
      mockBridge.setGitStatus(customStatus);

      const status = await mockBridge.git.status();

      expect(status).toEqual(customStatus);
    });

    it('status reflects current state after setGitStatus', async () => {
      mockBridge.setGitStatus({
        modified: ['a.ts'],
        staged: ['b.ts'],
        untracked: ['c.ts'],
        branch: 'feature/x',
      });

      const status = await mockBridge.git.status();

      expect(status.branch).toBe('feature/x');
      expect(status.modified).toContain('a.ts');
      expect(status.staged).toContain('b.ts');
      expect(status.untracked).toContain('c.ts');
    });
  });

  describe('control methods', () => {
    it('setFile allows pre-configuring file contents', async () => {
      mockBridge.setFile('/config.json', '{"key": "value"}');

      const content = await mockBridge.fileSystem.readFile('/config.json');
      expect(content).toBe('{"key": "value"}');
    });

    it('setGitStatus updates git state', async () => {
      mockBridge.setGitStatus({ branch: 'main', modified: ['test.ts'] });

      const status = await mockBridge.git.status();
      expect(status.branch).toBe('main');
      expect(status.modified).toEqual(['test.ts']);
    });

    it('setGitStatus partially updates existing state', async () => {
      mockBridge.setGitStatus({ branch: 'initial', modified: ['a.ts'] });
      mockBridge.setGitStatus({ branch: 'updated' });

      const status = await mockBridge.git.status();
      expect(status.branch).toBe('updated');
      expect(status.modified).toEqual(['a.ts']);
    });

    it('triggerEvent calls all registered handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const payload: FileChangeEvent = {
        path: '/project/file.ts',
        type: 'modify',
        timestamp: Date.now(),
      };

      mockBridge.listen('file-change', handler1);
      mockBridge.listen('file-change', handler2);
      mockBridge.triggerEvent('file-change', payload);

      expect(handler1).toHaveBeenCalledExactlyOnceWith(payload);
      expect(handler2).toHaveBeenCalledExactlyOnceWith(payload);
    });
  });
});

describe('factory functions', () => {
  it('createNativeBridge returns NativeBridgeImpl instance', () => {
    const bridge = createNativeBridge();
    expect(bridge).toBeInstanceOf(NativeBridgeImpl);
  });

  it('createMockNativeBridge returns MockNativeBridge instance', () => {
    const bridge = createMockNativeBridge();
    expect(bridge).toBeInstanceOf(MockNativeBridge);
  });
});

describe('type safety', () => {
  it('MockNativeBridge satisfies NativeBridge interface', () => {
    const bridge: NativeBridge = new MockNativeBridge();
    expect(bridge).toBeDefined();
  });

  it('fileSystem methods have correct signatures', async () => {
    const bridge = new MockNativeBridge();
    bridge.setFile('/test.txt', 'content');

    const readResult: string = await bridge.fileSystem.readFile('/test.txt');
    const writeResult: void = await bridge.fileSystem.writeFile('/test2.txt', 'content');
    const unwatch: () => void = bridge.fileSystem.watchDir('/project', () => {});

    expect(typeof readResult).toBe('string');
    expect(writeResult).toBeUndefined();
    expect(typeof unwatch).toBe('function');
    unwatch();
  });

  it('git methods have correct signatures', async () => {
    const bridge = new MockNativeBridge();

    const commitResult: string = await bridge.git.commit('msg', ['file.ts']);
    const statusResult: GitStatus = await bridge.git.status();

    expect(typeof commitResult).toBe('string');
    expect(statusResult).toHaveProperty('modified');
    expect(statusResult).toHaveProperty('staged');
    expect(statusResult).toHaveProperty('untracked');
    expect(statusResult).toHaveProperty('branch');
  });
});
