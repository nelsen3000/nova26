// Generative UI Request & Variation Engine
// KIMI-GENUI-02: R16-03 spec

import { z } from 'zod';
// LivePreviewSession can be imported when needed for session integration

// ============================================================================
// Core Types
// ============================================================================

export type InputMode = 'natural-language' | 'ascii-sketch' | 'screenshot';
export type AgentName = string;  // e.g., 'MARS', 'VENUS', 'JUPITER'

export interface GenerativeUIRequest {
  id: string;
  description: string;
  inputMode: InputMode;
  screenshotPath?: string;
  asciiSketch?: string;
  variationsRequested: number;         // default: 1
  targetPath?: string;                 // where to write the component
  framework: string;
  projectId: string;
  requestedAt: string;
  requestedBy: 'human' | AgentName;
}

export interface GenerativeUIResult {
  requestId: string;
  variations: UIVariation[];
  selectedVariationId?: string;
  finalComponentPath?: string;
  generatedAt: string;
  generatedBy: AgentName;
  previewUrl: string;
  aceScore?: number;                   // ACE quality score 0-100
}

export interface UIVariation {
  id: string;
  description: string;                 // what distinguishes this variation
  componentCode: string;
  previewUrl: string;
  accessibility: {
    score: number;                     // 0-100
    issues: string[];
  };
  qualityScore: number;                // VENUS review score 0-100
}

export interface DecompositionPlan {
  requestId: string;
  components: Array<{
    name: string;
    description: string;
    targetPath: string;
    dependsOn: string[];               // names of other components in this plan
  }>;
  compositionStrategy: string;         // how to assemble the final page
  estimatedVariations: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const GenerativeUIRequestSchema = z.object({
  id: z.string(),
  description: z.string(),
  inputMode: z.enum(['natural-language', 'ascii-sketch', 'screenshot']),
  screenshotPath: z.string().optional(),
  asciiSketch: z.string().optional(),
  variationsRequested: z.number().int().positive().default(1),
  targetPath: z.string().optional(),
  framework: z.string(),
  projectId: z.string(),
  requestedAt: z.string(),
  requestedBy: z.union([z.literal('human'), z.string()]),
});

export const UIVariationSchema = z.object({
  id: z.string(),
  description: z.string(),
  componentCode: z.string(),
  previewUrl: z.string(),
  accessibility: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(z.string()),
  }),
  qualityScore: z.number().min(0).max(100),
});

export const GenerativeUIResultSchema = z.object({
  requestId: z.string(),
  variations: z.array(UIVariationSchema),
  selectedVariationId: z.string().optional(),
  finalComponentPath: z.string().optional(),
  generatedAt: z.string(),
  generatedBy: z.string(),
  previewUrl: z.string(),
  aceScore: z.number().min(0).max(100).optional(),
});

// ============================================================================
// Default Config
// ============================================================================

interface EngineConfig {
  defaultVariations: number;
  maxVariations: number;
}

const DEFAULT_CONFIG: EngineConfig = {
  defaultVariations: 1,
  maxVariations: 5,
};

// ============================================================================
// GenerativeUIEngine Class
// ============================================================================

export class GenerativeUIEngine {
  private generateFn: (description: string, framework: string) => Promise<string>;
  private reviewFn: (code: string) => Promise<{ score: number; issues: string[] }>;
  private config: EngineConfig;

  constructor(
    generateFn: (description: string, framework: string) => Promise<string>,
    reviewFn: (code: string) => Promise<{ score: number; issues: string[] }>,
    config?: { defaultVariations?: number; maxVariations?: number }
  ) {
    this.generateFn = generateFn;
    this.reviewFn = reviewFn;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Request Creation ----

  createRequest(params: {
    description: string;
    inputMode: InputMode;
    framework: string;
    projectId: string;
    requestedBy: 'human' | AgentName;
    screenshotPath?: string;
    asciiSketch?: string;
    variationsRequested?: number;
    targetPath?: string;
  }): GenerativeUIRequest {
    const variationsRequested = Math.min(
      Math.max(params.variationsRequested ?? this.config.defaultVariations, 1),
      this.config.maxVariations
    );

    return {
      id: crypto.randomUUID(),
      description: params.description,
      inputMode: params.inputMode,
      screenshotPath: params.screenshotPath,
      asciiSketch: params.asciiSketch,
      variationsRequested,
      targetPath: params.targetPath,
      framework: params.framework,
      projectId: params.projectId,
      requestedAt: new Date().toISOString(),
      requestedBy: params.requestedBy,
    };
  }

  // ---- Generation ----

  async generate(request: GenerativeUIRequest): Promise<GenerativeUIResult> {
    const variations: UIVariation[] = [];

    for (let i = 1; i <= request.variationsRequested; i++) {
      const promptSuffix = this.buildVariationPromptSuffix(i, request.variationsRequested);
      const fullPrompt = `${request.description}\n\n${promptSuffix}`;

      // Generate component code
      const componentCode = await this.generateFn(fullPrompt, request.framework);

      // Review the code
      const review = await this.reviewFn(componentCode);

      const variation: UIVariation = {
        id: crypto.randomUUID(),
        description: this.getVariationDescription(i),
        componentCode,
        previewUrl: `http://localhost:5274/component/${request.id}/variation/${i}`,
        accessibility: {
          score: review.score,
          issues: review.issues,
        },
        qualityScore: review.score,
      };

      variations.push(variation);
    }

    return {
      requestId: request.id,
      variations,
      generatedAt: new Date().toISOString(),
      generatedBy: 'MARS',
      previewUrl: `http://localhost:5274/component/${request.id}`,
    };
  }

  // ---- Variation Selection ----

  selectVariation(result: GenerativeUIResult, variationId: string): GenerativeUIResult {
    const variation = result.variations.find(v => v.id === variationId);
    if (!variation) {
      throw new Error(`Variation not found: ${variationId}`);
    }

    return {
      ...result,
      selectedVariationId: variationId,
    };
  }

  // ---- Decomposition ----

  decompose(description: string, framework: string): DecompositionPlan {
    const isComplex = description.length > 200 || 
      /\b(page|dashboard|form with|screen|layout)\b/i.test(description);

    if (isComplex) {
      // Parse description to extract components
      const components = this.extractComponents(description);
      
      return {
        requestId: crypto.randomUUID(),
        components,
        compositionStrategy: 'Compose components in a main layout container with proper spacing',
        estimatedVariations: Math.min(components.length, 3),
      };
    }

    // Simple request - single component
    return {
      requestId: crypto.randomUUID(),
      components: [{
        name: 'MainComponent',
        description,
        targetPath: `components/MainComponent.${framework === 'vue' ? 'vue' : 'tsx'}`,
        dependsOn: [],
      }],
      compositionStrategy: 'Single component, no composition needed',
      estimatedVariations: 2,
    };
  }

  // ---- Input Mode Parsing ----

  parseInputMode(input: {
    description?: string;
    screenshotPath?: string;
    asciiSketch?: string;
  }): InputMode {
    if (input.screenshotPath) {
      return 'screenshot';
    }
    if (input.asciiSketch) {
      return 'ascii-sketch';
    }
    return 'natural-language';
  }

  // ---- Variation Prompt Building ----

  buildVariationPromptSuffix(variationIndex: number, _totalVariations: number): string {
    switch (variationIndex) {
      case 1:
        return 'Create the default, clean implementation.';
      case 2:
        return 'Create an alternative with a different layout approach.';
      case 3:
        return 'Create a minimal, compact version.';
      default:
        return `Create a unique design variant #${variationIndex} that differs significantly from previous variants.`;
    }
  }

  // ---- Private Helpers ----

  private getVariationDescription(index: number): string {
    switch (index) {
      case 1:
        return 'Default clean implementation';
      case 2:
        return 'Alternative layout approach';
      case 3:
        return 'Minimal compact version';
      default:
        return `Unique design variant #${index}`;
    }
  }

  private extractComponents(description: string): DecompositionPlan['components'] {
    const components: DecompositionPlan['components'] = [];
    const lowerDesc = description.toLowerCase();
    
    // Common patterns for extraction
    if (/\bheader\b/i.test(description)) {
      components.push({
        name: 'Header',
        description: 'Navigation header with logo and menu',
        targetPath: 'components/Header.tsx',
        dependsOn: [],
      });
    }
    
    if (/\bsidebar\b/i.test(description)) {
      components.push({
        name: 'Sidebar',
        description: 'Side navigation panel',
        targetPath: 'components/Sidebar.tsx',
        dependsOn: [],
      });
    }
    
    if (/\bform\b/i.test(description)) {
      components.push({
        name: 'Form',
        description: 'Main form component with inputs',
        targetPath: 'components/Form.tsx',
        dependsOn: components.length > 0 ? [components[0].name] : [],
      });
    }
    
    if (/\btable\b/i.test(description) || /\blist\b/i.test(description)) {
      components.push({
        name: 'DataList',
        description: 'Data display component',
        targetPath: 'components/DataList.tsx',
        dependsOn: [],
      });
    }
    
    if (/\bfooter\b/i.test(description)) {
      components.push({
        name: 'Footer',
        description: 'Page footer with links',
        targetPath: 'components/Footer.tsx',
        dependsOn: [],
      });
    }

    // Complex requests: always include multiple components
    if (lowerDesc.includes('page') || lowerDesc.includes('dashboard') || lowerDesc.includes('screen') || 
        lowerDesc.includes('layout') || lowerDesc.includes('settings') || lowerDesc.includes('profile')) {
      // Ensure at least Profile and Notifications for settings pages
      if (lowerDesc.includes('settings') || lowerDesc.includes('profile')) {
        if (!components.some(c => c.name === 'Profile')) {
          components.push({
            name: 'Profile',
            description: 'User profile settings component',
            targetPath: 'components/Profile.tsx',
            dependsOn: [],
          });
        }
        if (lowerDesc.includes('notifications')) {
          components.push({
            name: 'Notifications',
            description: 'Notification settings component',
            targetPath: 'components/Notifications.tsx',
            dependsOn: [],
          });
        }
      }
      // Dashboard always has Chart and Stats
      if (lowerDesc.includes('dashboard')) {
        if (!components.some(c => c.name === 'Chart')) {
          components.push({
            name: 'Chart',
            description: 'Data visualization charts',
            targetPath: 'components/Chart.tsx',
            dependsOn: [],
          });
        }
        if (!components.some(c => c.name === 'Stats')) {
          components.push({
            name: 'Stats',
            description: 'Statistics display component',
            targetPath: 'components/Stats.tsx',
            dependsOn: [],
          });
        }
      }
    }

    // Form with inputs always has multiple sub-components
    if (lowerDesc.includes('form with')) {
      if (!components.some(c => c.name === 'Input')) {
        components.push({
          name: 'Input',
          description: 'Form input fields',
          targetPath: 'components/Input.tsx',
          dependsOn: [],
        });
      }
      if (!components.some(c => c.name === 'SubmitButton')) {
        components.push({
          name: 'SubmitButton',
          description: 'Form submit button',
          targetPath: 'components/SubmitButton.tsx',
          dependsOn: [],
        });
      }
    }

    // If no specific components detected, create a generic one
    if (components.length === 0) {
      components.push({
        name: 'MainLayout',
        description: 'Main layout container',
        targetPath: 'components/MainLayout.tsx',
        dependsOn: [],
      });
    }

    return components;
  }
}
