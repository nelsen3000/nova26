// Tauri Desktop Types — R20-02

export interface TauriAppConfig {
  window: WindowConfig;
  autoUpdate: boolean;
  deepLinks: string[];
  menuBar: boolean;
  security: SecurityModel;
  offline: OfflineCapabilityConfig;
}

export interface WindowConfig {
  title: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  alwaysOnTop: boolean;
  transparent: boolean;
  systemTray: boolean;
}

export interface NativeBridge {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  listen: (event: string, handler: (payload: unknown) => void) => () => void;
  fileSystem: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    watchDir: (path: string, handler: (event: FileChangeEvent) => void) => () => void;
  };
  git: {
    commit: (message: string, files: string[]) => Promise<string>;
    status: () => Promise<GitStatus>;
  };
  notifications: {
    send: (title: string, body: string) => Promise<void>;
  };
}

export interface OfflineCapabilityConfig {
  ollamaAutoStart: boolean;
  queuePath: string;
  syncEngine: 'electric-sql' | 'custom';
  conflictStrategy: 'last-write-wins' | 'merge' | 'manual';
}

export interface SecurityModel {
  allowlist: string[];
  fsScope: string[];
  csp: string;
  noShell: boolean;
}

export interface FileChangeEvent {
  path: string;
  type: 'create' | 'modify' | 'delete';
  timestamp: number;
}

export interface GitStatus {
  modified: string[];
  staged: string[];
  untracked: string[];
  branch: string;
}

export interface OllamaStatus {
  running: boolean;
  port: number;
  version?: string;
  models: string[];
}

export interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  path: string;
  content?: string;
  timestamp: number;
  synced: boolean;
}

export interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'manual';
  localVersion: string;
  remoteVersion: string;
  resolvedContent?: string;
}

export const DEFAULT_TAURI_CONFIG: TauriAppConfig = {
  window: {
    title: 'Nova26 IDE',
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    alwaysOnTop: false,
    transparent: false,
    systemTray: true,
  },
  autoUpdate: true,
  deepLinks: ['nova26://', 'nova://'],
  menuBar: true,
  security: {
    allowlist: ['read_project_file', 'write_file', 'git_commit', 'spawn_ollama'],
    fsScope: ['$HOME/projects/**', '$PWD/**'],
    csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    noShell: true,
  },
  offline: {
    ollamaAutoStart: true,
    queuePath: '.nova/sync-queue.json',
    syncEngine: 'custom',
    conflictStrategy: 'last-write-wins',
  },
};
