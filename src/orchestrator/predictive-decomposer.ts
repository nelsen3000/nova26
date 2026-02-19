// Predictive Task Decomposition — Learning from historical build patterns
// KIMI-FRONTIER-03: Grok R13-02 spec

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { z } from 'zod';
import { getSemanticDedup } from '../similarity/semantic-dedup.js';
import type { AgentName } from '../agents/message-bus.js';

// ============================================================================
// Core Types
// ============================================================================

export interface TaskTemplate {
  id: string;
  name: string;
  projectType: string;
  description: string;
  tasks: TemplateTask[];
  successCount: number;
  avgTokensUsed: number;
  createdAt: string;
  lastUsedAt: string;
  embedding?: number[];
}

export interface TemplateTask {
  order: number;
  agentName: AgentName;
  taskType: string;
  title: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
  dependsOnOrders: number[];
}

export interface DecompositionPrediction {
  suggestedTasks: TemplateTask[];
  confidence: number;
  basedOn: Array<{
    templateId: string;
    templateName: string;
    similarity: number;
  }>;
  sourceTemplates: TaskTemplate[];
}

export interface BuildRecord {
  buildId: string;
  intent: string;
  tasks: TemplateTask[];
  successful: boolean;
  completedAt: string;
  tokensUsed: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const TemplateTaskSchema = z.object({
  order: z.number().int().positive(),
  agentName: z.string(),
  taskType: z.string(),
  title: z.string(),
  estimatedComplexity: z.enum(['low', 'medium', 'high']),
  dependsOnOrders: z.array(z.number().int()),
});

export const TaskTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectType: z.string(),
  description: z.string(),
  tasks: z.array(TemplateTaskSchema),
  successCount: z.number().int().nonnegative(),
  avgTokensUsed: z.number().nonnegative(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  embedding: z.array(z.number()).optional(),
});

export const BuildRecordSchema = z.object({
  buildId: z.string(),
  intent: z.string(),
  tasks: z.array(TemplateTaskSchema),
  successful: z.boolean(),
  completedAt: z.string(),
  tokensUsed: z.number().nonnegative(),
});

// ============================================================================
// PredictiveDecomposer Class
// ============================================================================

class PredictiveDecomposer {
  private templateDir: string;
  private _embeddingModel: string;
  private minConfidence: number;
  private maxTemplatesUsed: number;
  private templates: TaskTemplate[] | null = null;

  constructor(options?: {
    templateDir?: string;
    embeddingModel?: string;
    minConfidence?: number;
    maxTemplatesUsed?: number;
  }) {
    this.templateDir = options?.templateDir ?? join(process.cwd(), '.nova', 'templates', 'decomposition');
    this._embeddingModel = options?.embeddingModel ?? 'nomic-embed-text';
    this.minConfidence = options?.minConfidence ?? 0.60;
    this.maxTemplatesUsed = options?.maxTemplatesUsed ?? 3;
  }

  get embeddingModel(): string {
    return this._embeddingModel;
  }

  // ---- Prediction ----

  async predictDecomposition(intent: string): Promise<DecompositionPrediction | null> {
    // Load templates if not loaded
    if (!this.templates) {
      await this.loadTemplates();
    }

    // If no templates, return null
    if (!this.templates || this.templates.length === 0) {
      return null;
    }

    // Embed the intent
    let intentEmbedding: number[];
    try {
      const dedup = getSemanticDedup();
      intentEmbedding = await dedup.getEmbedding(intent);
    } catch (error) {
      console.warn('PredictiveDecomposer: failed to embed intent:', error);
      return null;
    }

    // Compute similarities
    const scoredTemplates = this.templates
      .filter(t => t.embedding)
      .map(t => ({
        template: t,
        similarity: this.cosineSimilarity(intentEmbedding, t.embedding!),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    // Filter by min confidence
    const matchingTemplates = scoredTemplates.filter(s => s.similarity >= this.minConfidence);

    if (matchingTemplates.length === 0) {
      return null;
    }

    // Take top templates
    const topTemplates = matchingTemplates.slice(0, this.maxTemplatesUsed);
    const bestMatch = topTemplates[0];

    // Build prediction
    const prediction: DecompositionPrediction = {
      suggestedTasks: bestMatch.template.tasks,
      confidence: bestMatch.similarity,
      basedOn: topTemplates.map(t => ({
        templateId: t.template.id,
        templateName: t.template.name,
        similarity: t.similarity,
      })),
      sourceTemplates: topTemplates.map(t => t.template),
    };

    return prediction;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ---- Learning loop ----

  async learnFromBuild(record: BuildRecord): Promise<void> {
    if (!record.successful) {
      return; // Only learn from successful builds
    }

    const projectType = this.detectProjectType(record.intent);

    // Look for existing similar template
    let matchingTemplate: TaskTemplate | null = null;
    
    if (this.templates) {
      try {
        const dedup = getSemanticDedup();
        const recordEmbedding = await dedup.getEmbedding(record.intent);

        for (const template of this.templates) {
          if (!template.embedding) continue;
          
          const similarity = this.cosineSimilarity(recordEmbedding, template.embedding);
          if (similarity > 0.90 && template.projectType === projectType) {
            matchingTemplate = template;
            break;
          }
        }
      } catch {
        // Embedding failed, skip matching
      }
    }

    if (matchingTemplate) {
      // Update existing template
      matchingTemplate.successCount++;
      matchingTemplate.avgTokensUsed = 
        (matchingTemplate.avgTokensUsed * (matchingTemplate.successCount - 1) + record.tokensUsed) / 
        matchingTemplate.successCount;
      matchingTemplate.lastUsedAt = record.completedAt;
      
      await this.saveTemplate(matchingTemplate);
    } else {
      // Create new template
      const newTemplate = await this.extractTemplate(record);
      newTemplate.projectType = projectType;
      
      // Embed the template
      try {
        const dedup = getSemanticDedup();
        newTemplate.embedding = await dedup.getEmbedding(record.intent);
      } catch {
        // Embedding failed, save without
      }
      
      await this.saveTemplate(newTemplate);
      
      // Add to cache
      if (!this.templates) {
        this.templates = [];
      }
      this.templates.push(newTemplate);
    }
  }

  private detectProjectType(intent: string): string {
    const lowerIntent = intent.toLowerCase();
    
    if (lowerIntent.includes('next.js') || lowerIntent.includes('nextjs')) {
      return 'nextjs-saas';
    }
    if ((lowerIntent.includes('react') && (lowerIntent.includes('spa') || lowerIntent.includes('app')))) {
      return 'react-spa';
    }
    if (lowerIntent.includes('api') || lowerIntent.includes('express') || lowerIntent.includes('fastify')) {
      return 'node-api';
    }
    if (lowerIntent.includes('cli')) {
      return 'cli-tool';
    }
    
    return 'general';
  }

  async extractTemplate(record: BuildRecord): Promise<TaskTemplate> {
    const id = createHash('sha256').update(record.buildId).digest('hex').slice(0, 16);
    
    return {
      id,
      name: record.intent.slice(0, 60),
      projectType: 'general',
      description: record.intent,
      tasks: record.tasks,
      successCount: 1,
      avgTokensUsed: record.tokensUsed,
      createdAt: record.completedAt,
      lastUsedAt: record.completedAt,
    };
  }

  // ---- Template storage ----

  async saveTemplate(template: TaskTemplate): Promise<void> {
    if (!existsSync(this.templateDir)) {
      mkdirSync(this.templateDir, { recursive: true });
    }

    const filePath = join(this.templateDir, `${template.id}.json`);
    const validated = TaskTemplateSchema.parse(template);
    
    writeFileSync(filePath, JSON.stringify(validated, null, 2));
  }

  async loadTemplates(): Promise<TaskTemplate[]> {
    if (!existsSync(this.templateDir)) {
      this.templates = [];
      return [];
    }

    const templates: TaskTemplate[] = [];
    const files = readdirSync(this.templateDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = readFileSync(join(this.templateDir, file), 'utf-8');
        const parsed = JSON.parse(content);
        const validated = TaskTemplateSchema.parse(parsed) as TaskTemplate;
        templates.push(validated);
      } catch (error) {
        console.warn(`PredictiveDecomposer: skipping invalid template ${file}:`, error);
      }
    }

    this.templates = templates;
    return templates;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const filePath = join(this.templateDir, `${templateId}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    // Remove from cache
    if (this.templates) {
      this.templates = this.templates.filter(t => t.id !== templateId);
    }
  }

  listTemplates(projectType?: string): TaskTemplate[] {
    const templates = this.templates ?? [];
    if (projectType) {
      return templates.filter(t => t.projectType === projectType);
    }
    return templates;
  }

  getTemplate(templateId: string): TaskTemplate | undefined {
    return this.templates?.find(t => t.id === templateId);
  }

  getStats(): { templateCount: number; totalSuccessfulBuilds: number } {
    const templates = this.templates ?? [];
    const totalSuccessfulBuilds = templates.reduce((sum, t) => sum + t.successCount, 0);
    
    return {
      templateCount: templates.length,
      totalSuccessfulBuilds,
    };
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: PredictiveDecomposer | null = null;

export function getPredictiveDecomposer(options?: ConstructorParameters<typeof PredictiveDecomposer>[0]): PredictiveDecomposer {
  if (!instance) {
    instance = new PredictiveDecomposer(options);
  }
  return instance;
}

export function resetPredictiveDecomposer(): void {
  instance = null;
}

export { PredictiveDecomposer };
