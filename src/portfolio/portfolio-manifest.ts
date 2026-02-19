// Portfolio Manifest & Project Fingerprinting
// KIMI-PORTFOLIO-01: R16-01 spec

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export interface PortfolioConfig {
  manifestPath: string;                // default: '~/.nova/portfolio.json'
  similarityThreshold: number;         // default: 0.70
  patternPromotionMinProjects: number; // default: 3
  patternPromotionSimilarityMin: number; // default: 0.80
  recencyWeights: {
    within90Days: number;              // default: 1.0
    within1Year: number;              // default: 0.8
    beyond1Year: number;              // default: 0.6
  };
  crossProjectSuggestionsEnabled: boolean; // default: true
  globalWisdomOptIn: boolean;          // default: false
}

export interface Portfolio {
  version: string;                     // e.g. '1.0.0'
  userId: string;                      // local machine identifier (not user account)
  createdAt: string;
  updatedAt: string;
  projects: PortfolioProject[];
  portfolioPatterns: PortfolioPattern[];
  skillGrowthHistory: SkillGrowthRecord[];
}

export interface PortfolioProject {
  id: string;
  name: string;
  path: string;
  type: 'dashboard' | 'api' | 'cli' | 'mobile' | 'full-stack' | 'library' | 'other';
  primaryLanguage: string;
  framework?: string;
  firstBuildAt: string;
  lastBuildAt: string;
  totalBuilds: number;
  aceScoreHistory: Array<{ date: string; score: number }>;
  currentHealthScore?: number;
  patternCount: number;
  semanticFingerprint: number[];       // embedding vector from Ollama
  isPrivate: boolean;
  isArchived: boolean;
  tags: string[];
}

export type PatternScope = 'project' | 'portfolio' | 'global';

export interface PortfolioPattern {
  id: string;
  scope: PatternScope;
  name: string;
  description: string;
  sourceProjectIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  averageQualityScore: number;         // 0-100
  isAntiPattern: boolean;
  lineage?: PatternLineage;
}

export interface PatternLineage {
  patternId: string;
  versions: Array<{
    projectId: string;
    projectName: string;
    builtAt: string;
    qualityScore: number;
    changeDescription: string;
  }>;
  bestVersionProjectId: string;
}

export interface SkillGrowthRecord {
  date: string;
  dimension: 'test-coverage' | 'complexity' | 'security' | 'ace-score' | 'build-speed';
  rollingAverage5Projects: number;
  allTimeAverage: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const PortfolioConfigSchema = z.object({
  manifestPath: z.string().default('~/.nova/portfolio.json'),
  similarityThreshold: z.number().min(0).max(1).default(0.70),
  patternPromotionMinProjects: z.number().int().positive().default(3),
  patternPromotionSimilarityMin: z.number().min(0).max(1).default(0.80),
  recencyWeights: z.object({
    within90Days: z.number().default(1.0),
    within1Year: z.number().default(0.8),
    beyond1Year: z.number().default(0.6),
  }).default({}),
  crossProjectSuggestionsEnabled: z.boolean().default(true),
  globalWisdomOptIn: z.boolean().default(false),
});

export const PortfolioProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  type: z.enum(['dashboard', 'api', 'cli', 'mobile', 'full-stack', 'library', 'other']),
  primaryLanguage: z.string(),
  framework: z.string().optional(),
  firstBuildAt: z.string(),
  lastBuildAt: z.string(),
  totalBuilds: z.number().int().nonnegative(),
  aceScoreHistory: z.array(z.object({ date: z.string(), score: z.number() })),
  currentHealthScore: z.number().optional(),
  patternCount: z.number().int().nonnegative(),
  semanticFingerprint: z.array(z.number()),
  isPrivate: z.boolean(),
  isArchived: z.boolean(),
  tags: z.array(z.string()),
});

export const PortfolioPatternSchema = z.object({
  id: z.string(),
  scope: z.enum(['project', 'portfolio', 'global']),
  name: z.string(),
  description: z.string(),
  sourceProjectIds: z.array(z.string()),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  occurrenceCount: z.number().int().nonnegative(),
  averageQualityScore: z.number().min(0).max(100),
  isAntiPattern: z.boolean(),
  lineage: z.object({
    patternId: z.string(),
    versions: z.array(z.object({
      projectId: z.string(),
      projectName: z.string(),
      builtAt: z.string(),
      qualityScore: z.number(),
      changeDescription: z.string(),
    })),
    bestVersionProjectId: z.string(),
  }).optional(),
});

export const SkillGrowthRecordSchema = z.object({
  date: z.string(),
  dimension: z.enum(['test-coverage', 'complexity', 'security', 'ace-score', 'build-speed']),
  rollingAverage5Projects: z.number(),
  allTimeAverage: z.number(),
  trend: z.enum(['improving', 'stable', 'declining']),
});

export const PortfolioSchema = z.object({
  version: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  projects: z.array(PortfolioProjectSchema),
  portfolioPatterns: z.array(PortfolioPatternSchema),
  skillGrowthHistory: z.array(SkillGrowthRecordSchema),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: PortfolioConfig = {
  manifestPath: '~/.nova/portfolio.json',
  similarityThreshold: 0.70,
  patternPromotionMinProjects: 3,
  patternPromotionSimilarityMin: 0.80,
  recencyWeights: {
    within90Days: 1.0,
    within1Year: 0.8,
    beyond1Year: 0.6,
  },
  crossProjectSuggestionsEnabled: true,
  globalWisdomOptIn: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

function expandHomeDir(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

// ============================================================================
// PortfolioManifest Class
// ============================================================================

export class PortfolioManifest {
  private config: PortfolioConfig;

  constructor(config?: Partial<PortfolioConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Core Operations ----

  load(): Portfolio {
    const manifestPath = expandHomeDir(this.config.manifestPath);

    if (!existsSync(manifestPath)) {
      // Return empty portfolio
      const now = new Date().toISOString();
      return {
        version: '1.0.0',
        userId: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        projects: [],
        portfolioPatterns: [],
        skillGrowthHistory: [],
      };
    }

    try {
      const content = readFileSync(manifestPath, 'utf-8');
      const parsed = JSON.parse(content);
      const validated = PortfolioSchema.parse(parsed);
      return validated;
    } catch (error) {
      console.warn('PortfolioManifest: validation failed, returning empty portfolio:', error);
      const now = new Date().toISOString();
      return {
        version: '1.0.0',
        userId: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        projects: [],
        portfolioPatterns: [],
        skillGrowthHistory: [],
      };
    }
  }

  save(portfolio: Portfolio): void {
    const manifestPath = expandHomeDir(this.config.manifestPath);
    const dir = dirname(manifestPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const updatedPortfolio = {
      ...portfolio,
      updatedAt: new Date().toISOString(),
    };

    const validated = PortfolioSchema.parse(updatedPortfolio);
    writeFileSync(manifestPath, JSON.stringify(validated, null, 2));
  }

  // ---- Project Management ----

  addProject(
    project: Omit<PortfolioProject, 'id' | 'firstBuildAt' | 'lastBuildAt' | 'totalBuilds' | 'aceScoreHistory' | 'patternCount' | 'semanticFingerprint' | 'isArchived' | 'tags'>
  ): PortfolioProject {
    const portfolio = this.load();
    const now = new Date().toISOString();

    const newProject: PortfolioProject = {
      ...project,
      id: crypto.randomUUID(),
      firstBuildAt: now,
      lastBuildAt: now,
      totalBuilds: 0,
      aceScoreHistory: [],
      patternCount: 0,
      semanticFingerprint: [],
      isArchived: false,
      tags: [],
    };

    portfolio.projects.push(newProject);
    this.save(portfolio);

    return newProject;
  }

  updateProjectAfterBuild(
    projectId: string,
    aceScore: number,
    patternCount: number
  ): PortfolioProject {
    const portfolio = this.load();
    const project = portfolio.projects.find(p => p.id === projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.totalBuilds++;
    project.lastBuildAt = new Date().toISOString();
    project.aceScoreHistory.push({
      date: new Date().toISOString(),
      score: aceScore,
    });
    project.patternCount = patternCount;

    this.save(portfolio);
    return project;
  }

  async computeFingerprint(
    projectId: string,
    projectSummary: string
  ): Promise<PortfolioProject> {
    const portfolio = this.load();
    const project = portfolio.projects.find(p => p.id === projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // In production, this would call Ollama to generate an embedding
    // For tests, we generate a mock fingerprint based on the summary
    project.semanticFingerprint = await this.mockGenerateFingerprint(projectSummary);

    this.save(portfolio);
    return project;
  }

  private async mockGenerateFingerprint(summary: string): Promise<number[]> {
    // Generate a deterministic mock fingerprint based on summary content
    // This simulates what Ollama would return
    const fingerprint: number[] = [];
    const seed = summary.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Generate 768-dimensional vector (common embedding size)
    for (let i = 0; i < 768; i++) {
      // Pseudo-random based on seed and position
      const value = Math.sin(seed + i * 0.1) * 0.5 + 0.5;
      fingerprint.push(value);
    }

    // Normalize to unit length (cosine similarity requirement)
    const magnitude = Math.sqrt(fingerprint.reduce((sum, v) => sum + v * v, 0));
    return fingerprint.map(v => v / magnitude);
  }

  getProject(projectId: string): PortfolioProject | undefined {
    const portfolio = this.load();
    return portfolio.projects.find(p => p.id === projectId);
  }

  listProjects(filter?: { archived?: boolean; private?: boolean; type?: PortfolioProject['type'] }): PortfolioProject[] {
    const portfolio = this.load();
    let projects = portfolio.projects;

    // Default: exclude archived
    if (filter?.archived === undefined) {
      projects = projects.filter(p => !p.isArchived);
    } else if (filter.archived === false) {
      projects = projects.filter(p => !p.isArchived);
    } else if (filter.archived === true) {
      projects = projects.filter(p => p.isArchived);
    }

    if (filter?.private !== undefined) {
      projects = projects.filter(p => p.isPrivate === filter.private);
    }

    if (filter?.type !== undefined) {
      projects = projects.filter(p => p.type === filter.type);
    }

    return projects;
  }

  archiveProject(projectId: string): PortfolioProject {
    const portfolio = this.load();
    const project = portfolio.projects.find(p => p.id === projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.isArchived = true;
    this.save(portfolio);
    return project;
  }

  setProjectPrivacy(projectId: string, isPrivate: boolean): PortfolioProject {
    const portfolio = this.load();
    const project = portfolio.projects.find(p => p.id === projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.isPrivate = isPrivate;
    this.save(portfolio);
    return project;
  }

  getRecencyWeight(lastBuildAt: string): number {
    const lastBuild = new Date(lastBuildAt);
    const now = new Date();
    const diffMs = now.getTime() - lastBuild.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays <= 90) {
      return this.config.recencyWeights.within90Days;
    } else if (diffDays <= 365) {
      return this.config.recencyWeights.within1Year;
    } else {
      return this.config.recencyWeights.beyond1Year;
    }
  }
}
