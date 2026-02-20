// KMS-25: Config file watcher
// Watch .nova/config.json and .nova/flags.json for changes

import { watch, unwatchFile, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { EventBus } from '../orchestrator/event-bus.js';

// ============================================================================
// Types
// ============================================================================

export interface ConfigChangedEvent {
  filePath: string;
  configType: 'config' | 'flags';
  previousHash: string;
  currentHash: string;
  timestamp: number;
}

// Extend EventMap for config:changed event
declare module '../orchestrator/event-bus.js' {
  interface EventMap {
    'config:changed': ConfigChangedEvent;
  }
}

export interface WatcherConfig {
  configPath: string;
  flagsPath: string;
  debounceMs: number;
}

export interface FileState {
  lastModified: number;
  contentHash: string;
  lastContent: string;
}

// ============================================================================
// Config Watcher
// ============================================================================

export class ConfigWatcher {
  private config: WatcherConfig;
  private eventBus: EventBus;
  private watchers: Map<string, ReturnType<typeof watch>> = new Map();
  private fileStates: Map<string, FileState> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isWatching: boolean = false;

  constructor(
    eventBus: EventBus,
    config: Partial<WatcherConfig> = {}
  ) {
    this.eventBus = eventBus;
    this.config = {
      configPath: config.configPath ?? '.nova/config.json',
      flagsPath: config.flagsPath ?? '.nova/flags.json',
      debounceMs: config.debounceMs ?? 100,
    };
  }

  /**
   * Start watching config files
   */
  start(): void {
    if (this.isWatching) return;

    this.isWatching = true;

    // Watch config.json
    const configFullPath = resolve(this.config.configPath);
    if (existsSync(configFullPath)) {
      this.watchFile(configFullPath, 'config');
    }

    // Watch flags.json
    const flagsFullPath = resolve(this.config.flagsPath);
    if (existsSync(flagsFullPath)) {
      this.watchFile(flagsFullPath, 'flags');
    }
  }

  /**
   * Stop watching config files
   */
  stop(): void {
    for (const [path, watcher] of this.watchers) {
      watcher.close();
      unwatchFile(path);
    }
    this.watchers.clear();
    this.debounceTimers.clear();
    this.isWatching = false;
  }

  /**
   * Check if currently watching
   */
  watching(): boolean {
    return this.isWatching;
  }

  /**
   * Get list of watched files
   */
  getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Watch a specific file
   */
  private watchFile(filePath: string, configType: 'config' | 'flags'): void {
    // Initialize file state
    this.initializeFileState(filePath);

    // Set up watcher
    const watcher = watch(filePath, (eventType) => {
      if (eventType === 'change') {
        this.handleFileChange(filePath, configType);
      }
    });

    this.watchers.set(filePath, watcher);
  }

  /**
   * Initialize state for a file
   */
  private async initializeFileState(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const hash = this.hashContent(content);
      
      this.fileStates.set(filePath, {
        lastModified: Date.now(),
        contentHash: hash,
        lastContent: content,
      });
    } catch {
      // File doesn't exist or can't be read
      this.fileStates.set(filePath, {
        lastModified: 0,
        contentHash: '',
        lastContent: '',
      });
    }
  }

  /**
   * Handle file change event
   */
  private handleFileChange(filePath: string, configType: 'config' | 'flags'): void {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.processFileChange(filePath, configType);
    }, this.config.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Process actual file change
   */
  private async processFileChange(filePath: string, configType: 'config' | 'flags'): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const newHash = this.hashContent(content);
      
      const previousState = this.fileStates.get(filePath);
      const previousHash = previousState?.contentHash ?? '';

      // Only emit if content actually changed
      if (newHash !== previousHash) {
        // Update state
        this.fileStates.set(filePath, {
          lastModified: Date.now(),
          contentHash: newHash,
          lastContent: content,
        });

        // Emit event
        const event: ConfigChangedEvent = {
          filePath,
          configType,
          previousHash,
          currentHash: newHash,
          timestamp: Date.now(),
        };

        await this.eventBus.emit('config:changed', event);
      }
    } catch (error) {
      // File may have been deleted
      console.warn(`[ConfigWatcher] Error reading ${filePath}:`, error);
    }
  }

  /**
   * Simple hash function for content comparison
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get current file state
   */
  getFileState(filePath: string): FileState | undefined {
    return this.fileStates.get(filePath);
  }

  /**
   * Manually trigger a file check (for testing)
   */
  async checkFile(filePath: string, configType: 'config' | 'flags'): Promise<void> {
    await this.processFileChange(filePath, configType);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WatcherConfig>): void {
    const wasWatching = this.isWatching;
    
    if (wasWatching) {
      this.stop();
    }

    this.config = { ...this.config, ...config };

    if (wasWatching) {
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): WatcherConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalWatcher: ConfigWatcher | null = null;
let globalEventBus: EventBus | null = null;

export function getGlobalConfigWatcher(eventBus?: EventBus): ConfigWatcher {
  if (!globalWatcher) {
    const bus = eventBus ?? getGlobalEventBus();
    globalWatcher = new ConfigWatcher(bus);
  }
  return globalWatcher;
}

export function resetGlobalConfigWatcher(): void {
  if (globalWatcher) {
    globalWatcher.stop();
  }
  globalWatcher = null;
}

export function setGlobalConfigWatcher(watcher: ConfigWatcher): void {
  globalWatcher = watcher;
}

function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}
