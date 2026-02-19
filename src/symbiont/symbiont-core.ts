// Nova Symbiont Core — Meta-layer creative intelligence
// KIMI-VISIONARY-04: R16-09 spec

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { hostname } from 'os';
import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export interface SymbiontConfig {
  dbPath: string;                // default: '.nova/symbiont.db'
  insightGenerationEnabled: boolean; // default: true
  metaCognitionInterval: number; // turns between meta-checks; default: 5
  maxInsightsPerDay: number;     // default: 5
  evolutionEnabled: boolean;     // default: true
}

export interface SymbiontState {
  id: string;
  userId: string;                // local machine identifier
  tasteDNA: number[];            // embedding vector of accumulated preferences
  creativeStyleProfile: CreativeStyleProfile;
  totalInteractions: number;
  totalBuilds: number;
  maturityLevel: 'nascent' | 'growing' | 'mature' | 'evolved';
  createdAt: string;
  lastActiveAt: string;
}

export interface CreativeStyleProfile {
  preferredPatterns: string[];   // top 10 pattern names from Taste Vault
  avoidedPatterns: string[];     // patterns the user consistently rejects
  colorPreferences: string[];   // hex codes user gravitates toward
  layoutPreference: 'minimal' | 'dense' | 'balanced' | 'unknown';
  codeStyleTraits: string[];    // e.g., "functional", "explicit-errors", "small-functions"
  confidence: number;            // 0-1, how confident the profile is
}

export interface DecisionJournalEntry {
  id: string;
  buildId: string;
  decision: string;              // what was decided
  rationale: string;             // why
  alternatives: string[];        // what else was considered
  outcome: 'positive' | 'negative' | 'neutral' | 'unknown';
  createdAt: string;
}

export interface SymbiontInsight {
  id: string;
  type: 'pattern-suggestion' | 'style-drift' | 'proactive-idea' | 'meta-reflection';
  title: string;
  content: string;
  confidence: number;            // 0-1
  actionable: boolean;
  actionDescription?: string;
  generatedAt: string;
  status: 'pending' | 'accepted' | 'dismissed';
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const CreativeStyleProfileSchema = z.object({
  preferredPatterns: z.array(z.string()),
  avoidedPatterns: z.array(z.string()),
  colorPreferences: z.array(z.string()),
  layoutPreference: z.enum(['minimal', 'dense', 'balanced', 'unknown']),
  codeStyleTraits: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const SymbiontStateSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tasteDNA: z.array(z.number()),
  creativeStyleProfile: CreativeStyleProfileSchema,
  totalInteractions: z.number().int().nonnegative(),
  totalBuilds: z.number().int().nonnegative(),
  maturityLevel: z.enum(['nascent', 'growing', 'mature', 'evolved']),
  createdAt: z.string(),
  lastActiveAt: z.string(),
});

export const DecisionJournalEntrySchema = z.object({
  id: z.string(),
  buildId: z.string(),
  decision: z.string(),
  rationale: z.string(),
  alternatives: z.array(z.string()),
  outcome: z.enum(['positive', 'negative', 'neutral', 'unknown']),
  createdAt: z.string(),
});

export const SymbiontInsightSchema = z.object({
  id: z.string(),
  type: z.enum(['pattern-suggestion', 'style-drift', 'proactive-idea', 'meta-reflection']),
  title: z.string(),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  actionable: z.boolean(),
  actionDescription: z.string().optional(),
  generatedAt: z.string(),
  status: z.enum(['pending', 'accepted', 'dismissed']),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: SymbiontConfig = {
  dbPath: '.nova/symbiont.db',
  insightGenerationEnabled: true,
  metaCognitionInterval: 5,
  maxInsightsPerDay: 5,
  evolutionEnabled: true,
};

// ============================================================================
// Maturity Level Thresholds
// ============================================================================

function calculateMaturityLevel(interactions: number): SymbiontState['maturityLevel'] {
  if (interactions <= 10) return 'nascent';
  if (interactions <= 50) return 'growing';
  if (interactions <= 200) return 'mature';
  return 'evolved';
}

// ============================================================================
// SymbiontCore Class
// ============================================================================

export class SymbiontCore {
  private config: SymbiontConfig;
  private db: Database.Database | null = null;
  private state: SymbiontState | null = null;
  private insights: Map<string, SymbiontInsight> = new Map();
  private insightsGeneratedToday: number = 0;
  private lastInsightDate: string = '';

  constructor(config?: Partial<SymbiontConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Initialization ----

  async initSymbiont(config?: Partial<SymbiontConfig>): Promise<SymbiontState> {
    const initConfig = { ...this.config, ...config };

    // Check if symbiont already exists
    this.initDatabase(initConfig.dbPath);
    const existing = this.loadSymbiontFromDb();

    if (existing) {
      this.state = existing;
      this.config = initConfig;
      return existing;
    }

    // Create new symbiont
    const now = new Date().toISOString();
    const newState: SymbiontState = {
      id: crypto.randomUUID(),
      userId: hostname(), // Use machine hostname as user identifier
      tasteDNA: [],
      creativeStyleProfile: {
        preferredPatterns: [],
        avoidedPatterns: [],
        colorPreferences: [],
        layoutPreference: 'unknown',
        codeStyleTraits: [],
        confidence: 0,
      },
      totalInteractions: 0,
      totalBuilds: 0,
      maturityLevel: 'nascent',
      createdAt: now,
      lastActiveAt: now,
    };

    this.saveSymbiontToDb(newState);
    this.state = newState;
    this.config = initConfig;

    return newState;
  }

  getSymbiont(): SymbiontState | undefined {
    return this.state ?? undefined;
  }

  // ---- Taste DNA ----

  updateTasteDNA(preferences: Record<string, number>): void {
    if (!this.state) {
      throw new Error('Symbiont not initialized');
    }

    // Convert preferences to vector format
    const preferenceVector = Object.values(preferences);
    
    // Append or update tasteDNA
    if (this.state.tasteDNA.length === 0) {
      this.state.tasteDNA = preferenceVector;
    } else {
      // Average with existing (simple strategy)
      const newLength = Math.max(this.state.tasteDNA.length, preferenceVector.length);
      const newDNA: number[] = [];
      
      for (let i = 0; i < newLength; i++) {
        const existing = this.state.tasteDNA[i] || 0;
        const incoming = preferenceVector[i] || 0;
        newDNA.push((existing + incoming) / 2);
      }
      
      this.state.tasteDNA = newDNA;
    }

    this.state.totalInteractions++;
    this.state.maturityLevel = calculateMaturityLevel(this.state.totalInteractions);
    this.state.lastActiveAt = new Date().toISOString();

    this.saveSymbiontToDb(this.state);
  }

  // ---- Decision Journal ----

  recordDecision(entry: Omit<DecisionJournalEntry, 'id' | 'createdAt'>): DecisionJournalEntry {
    if (!this.db) {
      throw new Error('Symbiont not initialized');
    }

    const fullEntry: DecisionJournalEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO decisions (id, buildId, decision, rationale, alternatives, outcome, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullEntry.id,
      fullEntry.buildId,
      fullEntry.decision,
      fullEntry.rationale,
      JSON.stringify(fullEntry.alternatives),
      fullEntry.outcome,
      fullEntry.createdAt
    );

    return fullEntry;
  }

  getDecisionJournal(limit?: number): DecisionJournalEntry[] {
    if (!this.db) {
      throw new Error('Symbiont not initialized');
    }

    const query = limit !== undefined
      ? `SELECT * FROM decisions ORDER BY createdAt DESC LIMIT ?`
      : `SELECT * FROM decisions ORDER BY createdAt DESC`;

    const stmt = this.db.prepare(query);
    const rows = limit !== undefined
      ? stmt.all(limit) as any[]
      : stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      buildId: row.buildId,
      decision: row.decision,
      rationale: row.rationale,
      alternatives: JSON.parse(row.alternatives),
      outcome: row.outcome,
      createdAt: row.createdAt,
    }));
  }

  // ---- Insights ----

  async generateInsight(): Promise<SymbiontInsight | null> {
    if (!this.config.insightGenerationEnabled) {
      return null;
    }

    if (!this.state) {
      throw new Error('Symbiont not initialized');
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastInsightDate) {
      this.insightsGeneratedToday = 0;
      this.lastInsightDate = today;
    }

    if (this.insightsGeneratedToday >= this.config.maxInsightsPerDay) {
      return null;
    }

    // Generate insight (mock LLM call in tests)
    const insight = await this.mockGenerateInsight();

    this.insights.set(insight.id, insight);
    this.insightsGeneratedToday++;

    // Persist to DB
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO insights (id, type, title, content, confidence, actionable, actionDescription, generatedAt, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        insight.id,
        insight.type,
        insight.title,
        insight.content,
        insight.confidence,
        insight.actionable ? 1 : 0,
        insight.actionDescription || null,
        insight.generatedAt,
        insight.status
      );
    }

    return insight;
  }

  private async mockGenerateInsight(): Promise<SymbiontInsight> {
    const types: SymbiontInsight['type'][] = ['pattern-suggestion', 'style-drift', 'proactive-idea', 'meta-reflection'];
    const type = types[Math.floor(Math.random() * types.length)];

    return {
      id: crypto.randomUUID(),
      type,
      title: `Insight: ${type.replace('-', ' ')}`,
      content: `Based on your taste profile, I've noticed a pattern in your preferences.`,
      confidence: 0.7 + Math.random() * 0.2,
      actionable: true,
      actionDescription: 'Consider applying this pattern to your current project.',
      generatedAt: new Date().toISOString(),
      status: 'pending',
    };
  }

  getInsights(filter?: { status?: string; type?: string }): SymbiontInsight[] {
    let insights = Array.from(this.insights.values());

    if (filter?.status) {
      insights = insights.filter(i => i.status === filter.status);
    }

    if (filter?.type) {
      insights = insights.filter(i => i.type === filter.type);
    }

    return insights;
  }

  acceptInsight(insightId: string): void {
    const insight = this.insights.get(insightId);
    if (!insight) {
      throw new Error(`Insight not found: ${insightId}`);
    }

    insight.status = 'accepted';

    if (this.db) {
      const stmt = this.db.prepare(`UPDATE insights SET status = ? WHERE id = ?`);
      stmt.run('accepted', insightId);
    }
  }

  dismissInsight(insightId: string): void {
    const insight = this.insights.get(insightId);
    if (!insight) {
      throw new Error(`Insight not found: ${insightId}`);
    }

    insight.status = 'dismissed';

    if (this.db) {
      const stmt = this.db.prepare(`UPDATE insights SET status = ? WHERE id = ?`);
      stmt.run('dismissed', insightId);
    }
  }

  // ---- Creative Profile ----

  getCreativeProfile(): CreativeStyleProfile {
    if (!this.state) {
      throw new Error('Symbiont not initialized');
    }

    return this.state.creativeStyleProfile;
  }

  updateCreativeProfile(traits: Partial<CreativeStyleProfile>): void {
    if (!this.state) {
      throw new Error('Symbiont not initialized');
    }

    this.state.creativeStyleProfile = {
      ...this.state.creativeStyleProfile,
      ...traits,
    };

    this.state.lastActiveAt = new Date().toISOString();
    this.saveSymbiontToDb(this.state);
  }

  // ---- Maturity ----

  getMaturityLevel(): string {
    if (!this.state) {
      throw new Error('Symbiont not initialized');
    }

    return this.state.maturityLevel;
  }

  // ---- Ask Symbiont ----

  async askSymbiont(question: string): Promise<string> {
    if (!this.state) {
      throw new Error('Symbiont not initialized');
    }

    // Mock LLM response based on question
    const responses: Record<string, string> = {
      'What color scheme?': 'Based on your taste profile, I recommend a dark mode with blue accents.',
      'What pattern?': 'The functional pattern has worked well in your recent builds.',
      'How should I refactor?': 'Consider extracting the repeated logic into a shared utility.',
    };

    for (const [key, value] of Object.entries(responses)) {
      if (question.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return `Based on your creative profile (${this.state.maturityLevel} maturity), I would suggest exploring options that align with your preference for ${this.state.creativeStyleProfile.layoutPreference} layouts.`;
  }

  // ---- Reset ----

  async resetSymbiont(): Promise<void> {
    if (this.db) {
      // Drop tables
      this.db.exec(`DROP TABLE IF EXISTS symbiont;`);
      this.db.exec(`DROP TABLE IF EXISTS decisions;`);
      this.db.exec(`DROP TABLE IF EXISTS insights;`);
      this.db.close();
      this.db = null;
    }

    this.state = null;
    this.insights.clear();
    this.insightsGeneratedToday = 0;
    this.lastInsightDate = '';
  }

  // ---- Private Helpers ----

  private initDatabase(dbPath: string): void {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS symbiont (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        tasteDNA TEXT NOT NULL,
        creativeStyleProfile TEXT NOT NULL,
        totalInteractions INTEGER NOT NULL,
        totalBuilds INTEGER NOT NULL,
        maturityLevel TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        lastActiveAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        buildId TEXT NOT NULL,
        decision TEXT NOT NULL,
        rationale TEXT NOT NULL,
        alternatives TEXT NOT NULL,
        outcome TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS insights (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence REAL NOT NULL,
        actionable INTEGER NOT NULL,
        actionDescription TEXT,
        generatedAt TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);
  }

  private loadSymbiontFromDb(): SymbiontState | null {
    if (!this.db) return null;

    const row = this.db.prepare('SELECT * FROM symbiont LIMIT 1').get() as any;
    if (!row) return null;

    const state: SymbiontState = {
      id: row.id,
      userId: row.userId,
      tasteDNA: JSON.parse(row.tasteDNA),
      creativeStyleProfile: JSON.parse(row.creativeStyleProfile),
      totalInteractions: row.totalInteractions,
      totalBuilds: row.totalBuilds,
      maturityLevel: row.maturityLevel,
      createdAt: row.createdAt,
      lastActiveAt: row.lastActiveAt,
    };

    // Load insights
    const insights = this.db.prepare('SELECT * FROM insights').all() as any[];
    for (const insightRow of insights) {
      const insight: SymbiontInsight = {
        id: insightRow.id,
        type: insightRow.type,
        title: insightRow.title,
        content: insightRow.content,
        confidence: insightRow.confidence,
        actionable: insightRow.actionable === 1,
        actionDescription: insightRow.actionDescription || undefined,
        generatedAt: insightRow.generatedAt,
        status: insightRow.status,
      };
      this.insights.set(insight.id, insight);
    }

    return state;
  }

  private saveSymbiontToDb(state: SymbiontState): void {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbiont 
      (id, userId, tasteDNA, creativeStyleProfile, totalInteractions, totalBuilds, maturityLevel, createdAt, lastActiveAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      state.id,
      state.userId,
      JSON.stringify(state.tasteDNA),
      JSON.stringify(state.creativeStyleProfile),
      state.totalInteractions,
      state.totalBuilds,
      state.maturityLevel,
      state.createdAt,
      state.lastActiveAt
    );
  }
}
