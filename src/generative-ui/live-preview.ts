// Live Preview Types & Session Manager
// KIMI-GENUI-01: R16-03 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type PreviewStrategy = 'vite-hmr' | 'iframe-sandbox' | 'auto';
export type FrameworkType = 'auto' | 'react' | 'vue' | 'svelte' | 'solid';
export type SessionStatus = 'starting' | 'ready' | 'updating' | 'error' | 'stopped';

export interface LivePreviewConfig {
  port: number;                        // default: 5274
  framework: FrameworkType;            // default: 'auto'
  strategy: PreviewStrategy;           // default: 'auto'
  mockBackend: boolean;                // default: true
  openBrowser: boolean;                // default: false (terminal-first)
  variationsDefault: number;           // default: 1
  sourceMapAnnotation: boolean;        // default: true — inject data-nova-source attributes
}

export interface LivePreviewSession {
  id: string;
  projectId: string;
  strategy: 'vite-hmr' | 'iframe-sandbox';  // resolved strategy (never 'auto')
  port: number;
  url: string;
  startedAt: string;
  lastUpdatedAt: string;
  activeComponentPath?: string;
  status: SessionStatus;
  errorMessage?: string;
  framework: string;                   // resolved framework (never 'auto')
}

export interface FrameworkDetectionResult {
  framework: string;
  confidence: number;                  // 0-1
  detectedFrom: string;               // e.g., 'package.json dependencies'
  strategy: 'vite-hmr' | 'iframe-sandbox';
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const LivePreviewConfigSchema = z.object({
  port: z.number().int().positive().default(5274),
  framework: z.enum(['auto', 'react', 'vue', 'svelte', 'solid']).default('auto'),
  strategy: z.enum(['vite-hmr', 'iframe-sandbox', 'auto']).default('auto'),
  mockBackend: z.boolean().default(true),
  openBrowser: z.boolean().default(false),
  variationsDefault: z.number().int().positive().default(1),
  sourceMapAnnotation: z.boolean().default(true),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: LivePreviewConfig = {
  port: 5274,
  framework: 'auto',
  strategy: 'auto',
  mockBackend: true,
  openBrowser: false,
  variationsDefault: 1,
  sourceMapAnnotation: true,
};

// ============================================================================
// LivePreviewSessionManager Class
// ============================================================================

export class LivePreviewSessionManager {
  private config: LivePreviewConfig;
  private sessions: Map<string, LivePreviewSession> = new Map();
  private packageJsonReader: () => Record<string, string>;
  private portChecker: (port: number) => boolean;

  constructor(
    config?: Partial<LivePreviewConfig>,
    options?: {
      packageJsonReader?: () => Record<string, string>;
      portChecker?: (port: number) => boolean;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.packageJsonReader = options?.packageJsonReader ?? this.defaultPackageJsonReader;
    this.portChecker = options?.portChecker ?? this.defaultPortChecker;
  }

  // ---- Session Management ----

  createSession(
    projectId: string,
    options?: { port?: number; strategy?: PreviewStrategy }
  ): LivePreviewSession {
    const id = crypto.randomUUID();
    const port = options?.port ?? this.findAvailablePort(this.config.port);
    
    // Resolve strategy
    let strategy: 'vite-hmr' | 'iframe-sandbox';
    if (options?.strategy && options.strategy !== 'auto') {
      strategy = options.strategy;
    } else if (this.config.strategy !== 'auto') {
      strategy = this.config.strategy;
    } else {
      strategy = this.resolveStrategy('react'); // Default to react if auto
    }

    // Detect framework
    const detection = this.detectFramework();
    const framework = detection.framework;
    
    // Override strategy based on detection if it was auto
    if ((options?.strategy === 'auto' || this.config.strategy === 'auto') && detection.strategy) {
      strategy = detection.strategy;
    }

    const now = new Date().toISOString();
    
    const session: LivePreviewSession = {
      id,
      projectId,
      strategy,
      port,
      url: `http://localhost:${port}`,
      startedAt: now,
      lastUpdatedAt: now,
      status: 'starting',
      framework,
    };

    this.sessions.set(id, session);
    return session;
  }

  startSession(sessionId: string): LivePreviewSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status !== 'starting') {
      throw new Error(`Cannot start session with status '${session.status}'`);
    }

    session.status = 'ready';
    session.lastUpdatedAt = new Date().toISOString();
    return session;
  }

  stopSession(sessionId: string): LivePreviewSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'stopped';
    session.lastUpdatedAt = new Date().toISOString();
    return session;
  }

  getSession(sessionId: string): LivePreviewSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSession(): LivePreviewSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.status === 'ready' || session.status === 'updating') {
        return session;
      }
    }
    return undefined;
  }

  updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    errorMessage?: string
  ): LivePreviewSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = status;
    session.lastUpdatedAt = new Date().toISOString();
    if (errorMessage !== undefined) {
      session.errorMessage = errorMessage;
    }
    return session;
  }

  setActiveComponent(sessionId: string, componentPath: string): LivePreviewSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.activeComponentPath = componentPath;
    session.lastUpdatedAt = new Date().toISOString();
    return session;
  }

  listSessions(): LivePreviewSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  /**
   * Stop and remove sessions that have not been updated within `thresholdMs`
   * (default: 1 hour). Sessions already in 'stopped' status are skipped.
   * Returns the number of sessions cleaned up.
   */
  cleanupStaleSessions(thresholdMs: number = 60 * 60 * 1000): number {
    const cutoff = Date.now() - thresholdMs;
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (session.status === 'stopped') continue;
      const lastUpdated = new Date(session.lastUpdatedAt).getTime();
      if (lastUpdated < cutoff) {
        session.status = 'stopped';
        session.lastUpdatedAt = new Date().toISOString();
        this.sessions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  // ---- Framework Detection ----

  detectFramework(dependencies?: Record<string, string>): FrameworkDetectionResult {
    const deps = dependencies ?? this.packageJsonReader();
    const depNames = Object.keys(deps).map(d => d.toLowerCase());

    // Priority order detection
    if (depNames.includes('react') || depNames.includes('next')) {
      return {
        framework: 'react',
        confidence: 0.95,
        detectedFrom: 'package.json dependencies',
        strategy: 'vite-hmr',
      };
    }

    if (depNames.includes('vue')) {
      return {
        framework: 'vue',
        confidence: 0.95,
        detectedFrom: 'package.json dependencies',
        strategy: 'vite-hmr',
      };
    }

    if (depNames.includes('svelte') || depNames.includes('sveltekit')) {
      return {
        framework: 'svelte',
        confidence: 0.95,
        detectedFrom: 'package.json dependencies',
        strategy: 'vite-hmr',
      };
    }

    if (depNames.includes('solid-js')) {
      return {
        framework: 'solid',
        confidence: 0.95,
        detectedFrom: 'package.json dependencies',
        strategy: 'vite-hmr',
      };
    }

    // Fallback
    return {
      framework: 'react',
      confidence: 0.5,
      detectedFrom: 'fallback (no framework detected)',
      strategy: 'iframe-sandbox',
    };
  }

  resolveStrategy(framework: string): 'vite-hmr' | 'iframe-sandbox' {
    // For known frameworks with Vite support, use vite-hmr
    const viteSupportedFrameworks = ['react', 'vue', 'svelte', 'solid'];
    if (viteSupportedFrameworks.includes(framework.toLowerCase())) {
      // In real implementation, would check for vite.config.js
      return 'vite-hmr';
    }
    return 'iframe-sandbox';
  }

  findAvailablePort(startPort: number): number {
    // In tests, the portChecker will always return true for the first port
    // In real implementation, would check if port is in use
    let port = startPort;
    while (!this.portChecker(port)) {
      port++;
    }
    return port;
  }

  // ---- Private Helpers ----

  private defaultPackageJsonReader(): Record<string, string> {
    // Default implementation - in real usage would read from process.cwd()/package.json
    try {
      // This is a placeholder - in real implementation would use fs.readFileSync
      return {};
    } catch {
      return {};
    }
  }

  private defaultPortChecker(port: number): boolean {
    // Default: assume port is available
    // In real implementation, would try to bind to the port
    void port;
    return true;
  }
}
