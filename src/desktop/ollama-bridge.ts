// Ollama Bridge — R20-02
// TypeScript interface to OllamaManager Rust commands

import type { OllamaStatus } from './types.js';
import type { NativeBridge } from './types.js';

export interface OllamaBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
  getStatus(): Promise<OllamaStatus>;
  waitForReady(timeoutMs?: number): Promise<boolean>;
  detectPort(): Promise<number | null>;
}

export class OllamaBridgeImpl implements OllamaBridge {
  private bridge: NativeBridge;
  constructor(bridge: NativeBridge) {
    this.bridge = bridge;
  }

  /**
   * Start Ollama service
   */
  async start(): Promise<void> {
    await this.bridge.invoke('spawn_ollama');
  }

  /**
   * Stop Ollama service
   */
  async stop(): Promise<void> {
    await this.bridge.invoke('stop_ollama');
  }

  /**
   * Check if Ollama is running
   */
  async isRunning(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.running;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed Ollama status
   */
  async getStatus(): Promise<OllamaStatus> {
    return this.bridge.invoke<OllamaStatus>('ollama_status');
  }

  /**
   * Wait for Ollama to be ready
   */
  async waitForReady(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 500;

    while (Date.now() - startTime < timeoutMs) {
      const running = await this.isRunning();
      if (running) return true;
      await this.delay(checkInterval);
    }

    return false;
  }

  /**
   * Detect which port Ollama is running on
   */
  async detectPort(): Promise<number | null> {
    try {
      const status = await this.getStatus();
      return status.port;
    } catch {
      // Try common ports
      const commonPorts = [11434, 11435, 11436];
      for (const port of commonPorts) {
        if (await this.checkPort(port)) {
          return port;
        }
      }
      return null;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    const status = await this.getStatus();
    return status.models;
  }

  /**
   * Check if a specific model is available
   */
  async hasModel(modelName: string): Promise<boolean> {
    const models = await this.listModels();
    return models.includes(modelName);
  }

  private async checkPort(port: number): Promise<boolean> {
    try {
      // This would be a Rust command in real implementation
      await this.bridge.invoke('check_ollama_port', { port });
      return true;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Mock implementation for testing
export class MockOllamaBridge implements OllamaBridge {
  private running: boolean = false;
  private port: number = 11434;
  private models: string[] = ['llama2', 'codellama', 'mistral'];
  private startDelay: number = 100;
  private shouldFailStart: boolean = false;

  async start(): Promise<void> {
    if (this.shouldFailStart) {
      throw new Error('Failed to start Ollama');
    }
    await this.delay(this.startDelay);
    this.running = true;
  }

  async stop(): Promise<void> {
    await this.delay(50);
    this.running = false;
  }

  async isRunning(): Promise<boolean> {
    return this.running;
  }

  async getStatus(): Promise<OllamaStatus> {
    return {
      running: this.running,
      port: this.port,
      version: '0.1.0',
      models: this.models,
    };
  }

  async waitForReady(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (this.running) return true;
      await this.delay(100);
    }
    return false;
  }

  async detectPort(): Promise<number | null> {
    return this.running ? this.port : null;
  }

  async listModels(): Promise<string[]> {
    return this.models;
  }

  async hasModel(modelName: string): Promise<boolean> {
    return this.models.includes(modelName);
  }

  // Mock control methods
  setRunning(running: boolean): void {
    this.running = running;
  }

  setPort(port: number): void {
    this.port = port;
  }

  setModels(models: string[]): void {
    this.models = models;
  }

  setStartDelay(delay: number): void {
    this.startDelay = delay;
  }

  setShouldFailStart(shouldFail: boolean): void {
    this.shouldFailStart = shouldFail;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createOllamaBridge(bridge: NativeBridge): OllamaBridge {
  return new OllamaBridgeImpl(bridge);
}

export function createMockOllamaBridge(): MockOllamaBridge {
  return new MockOllamaBridge();
}
