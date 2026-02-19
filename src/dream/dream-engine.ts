// Dream Mode Engine — Interactive simulation from natural language description
// KIMI-VISIONARY-01: R16-06 spec

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export interface DreamModeConfig {
  simulationTimeout: number;     // default: 60000 (60s)
  maxAnnotations: number;        // default: 50
  persistSimulations: boolean;   // default: true
  storagePath: string;           // default: '.nova/dreams'
  tasteVaultSeeding: boolean;    // default: true
}

export interface DreamSession {
  id: string;
  description: string;           // original user description
  status: 'generating' | 'ready' | 'annotating' | 'approved' | 'rejected';
  simulationHtml: string;        // the generated interactive HTML
  annotations: DreamAnnotation[];
  tasteProfile?: TasteProfile;   // seeded from Taste Vault
  createdAt: string;
  approvedAt?: string;
  generationDurationMs: number;
}

export interface DreamAnnotation {
  id: string;
  sessionId: string;
  targetSelector: string;        // CSS selector or description of element
  feedback: string;              // user's annotation text
  type: 'change' | 'approve' | 'remove' | 'add';
  createdAt: string;
}

export interface SimulationState {
  sessionId: string;
  currentRoute: string;
  viewport: 'mobile' | 'tablet' | 'desktop';
  interactionLog: Array<{ action: string; target: string; timestamp: string }>;
}

export type TasteProfile = Record<string, string>;  // key-value taste preferences

// ============================================================================
// Zod Schemas
// ============================================================================

export const DreamModeConfigSchema = z.object({
  simulationTimeout: z.number().int().positive().default(60000),
  maxAnnotations: z.number().int().positive().default(50),
  persistSimulations: z.boolean().default(true),
  storagePath: z.string().default('.nova/dreams'),
  tasteVaultSeeding: z.boolean().default(true),
});

export const DreamAnnotationSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  targetSelector: z.string(),
  feedback: z.string(),
  type: z.enum(['change', 'approve', 'remove', 'add']),
  createdAt: z.string(),
});

export const DreamSessionSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.enum(['generating', 'ready', 'annotating', 'approved', 'rejected']),
  simulationHtml: z.string(),
  annotations: z.array(DreamAnnotationSchema),
  tasteProfile: z.record(z.string()).optional(),
  createdAt: z.string(),
  approvedAt: z.string().optional(),
  generationDurationMs: z.number().nonnegative(),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: DreamModeConfig = {
  simulationTimeout: 60000,
  maxAnnotations: 50,
  persistSimulations: true,
  storagePath: '.nova/dreams',
  tasteVaultSeeding: true,
};

// ============================================================================
// DreamEngine Class
// ============================================================================

export class DreamEngine {
  private config: DreamModeConfig;
  private sessions: Map<string, DreamSession> = new Map();

  constructor(config?: Partial<DreamModeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Load persisted sessions if enabled
    if (this.config.persistSimulations) {
      this.loadPersistedSessions();
    }
  }

  // ---- Session Management ----

  async createDreamSession(
    description: string,
    config?: Partial<DreamModeConfig>
  ): Promise<DreamSession> {
    // Validate description
    if (!description || description.trim() === '') {
      throw new Error('Description cannot be empty');
    }

    // Merge config for this session
    const sessionConfig = { ...this.config, ...config };

    const sessionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // Create session with generating status
    const session: DreamSession = {
      id: sessionId,
      description: description.trim(),
      status: 'generating',
      simulationHtml: '',
      annotations: [],
      createdAt,
      generationDurationMs: 0,
    };

    // Seed taste profile if enabled
    if (sessionConfig.tasteVaultSeeding) {
      session.tasteProfile = await this.seedTasteProfile();
    }

    // Track generation duration
    const generationStart = Date.now();

    // Generate simulation HTML (mocked in tests, real LLM call in production)
    session.simulationHtml = await this.generateSimulationHtml(description);
    
    session.generationDurationMs = Date.now() - generationStart;
    session.status = 'ready';

    // Store session
    this.sessions.set(sessionId, session);

    // Persist if enabled
    if (sessionConfig.persistSimulations) {
      this.persistSession(session);
    }

    return session;
  }

  addAnnotation(
    sessionId: string,
    annotation: Omit<DreamAnnotation, 'id' | 'sessionId' | 'createdAt'>
  ): DreamAnnotation {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check if session is in a valid state for annotation
    if (session.status !== 'ready' && session.status !== 'annotating') {
      throw new Error(`Cannot add annotations to session with status: ${session.status}`);
    }

    // Check max annotations limit
    if (session.annotations.length >= this.config.maxAnnotations) {
      throw new Error(`Maximum annotations (${this.config.maxAnnotations}) reached`);
    }

    // Create annotation
    const fullAnnotation: DreamAnnotation = {
      ...annotation,
      id: crypto.randomUUID(),
      sessionId,
      createdAt: new Date().toISOString(),
    };

    // Add to session
    session.annotations.push(fullAnnotation);

    // Update session status to annotating if it was ready
    if (session.status === 'ready') {
      session.status = 'annotating';
    }

    // Persist changes
    if (this.config.persistSimulations) {
      this.persistSession(session);
    }

    return fullAnnotation;
  }

  approveSession(sessionId: string): DreamSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'approved';
    session.approvedAt = new Date().toISOString();

    if (this.config.persistSimulations) {
      this.persistSession(session);
    }

    return session;
  }

  rejectSession(sessionId: string): DreamSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'rejected';

    if (this.config.persistSimulations) {
      this.persistSession(session);
    }

    return session;
  }

  getSession(sessionId: string): DreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): DreamSession[] {
    return Array.from(this.sessions.values());
  }

  exportConstraints(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session.annotations.map(annotation => 
      `[${annotation.type}] ${annotation.feedback} (target: ${annotation.targetSelector})`
    );
  }

  // ---- Private Helpers ----

  private async generateSimulationHtml(description: string): Promise<string> {
    // In production, this would call an LLM (Ollama) to generate HTML
    // For tests, this will be mocked
    // Mock implementation returns a simple HTML structure
    return `<!DOCTYPE html>
<html>
<head>
  <title>Dream: ${description.slice(0, 50)}...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; }
    .dream-container { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="dream-container">
    <h1>Simulation: ${description}</h1>
    <p>This is an interactive simulation generated from your description.</p>
  </div>
</body>
</html>`;
  }

  private async seedTasteProfile(): Promise<TasteProfile> {
    // In production, this would load from Taste Vault
    // For tests, return a mock profile
    return {
      'preferred-layout': 'clean',
      'color-scheme': 'system',
      'component-density': 'medium',
    };
  }

  private persistSession(session: DreamSession): void {
    const storagePath = this.config.storagePath;
    
    if (!existsSync(storagePath)) {
      mkdirSync(storagePath, { recursive: true });
    }

    const filePath = join(storagePath, `${session.id}.json`);
    const validated = DreamSessionSchema.parse(session);
    writeFileSync(filePath, JSON.stringify(validated, null, 2));
  }

  private loadPersistedSessions(): void {
    const storagePath = this.config.storagePath;
    
    if (!existsSync(storagePath)) {
      return;
    }

    const files = readdirSync(storagePath).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const content = readFileSync(join(storagePath, file), 'utf-8');
        const parsed = JSON.parse(content);
        const validated = DreamSessionSchema.parse(parsed);
        this.sessions.set(validated.id, validated);
      } catch (error) {
        console.warn(`DreamEngine: skipping invalid session file ${file}:`, error);
      }
    }
  }
}
