// Design Pipeline Core — R20-03
// End-to-end design generation from prompt to DesignFlow

import type {
  DesignPipelineConfig,
  DesignFlow,
  DesignSystemConfig,
  JourneyTemplate,
} from './types.js';

import {
  DEFAULT_DESIGN_PIPELINE_CONFIG,
  JOURNEY_TEMPLATES,
} from './types.js';

export interface PipelineInput {
  prompt: string;
  journeyType?: DesignFlow['journeyType'];
  referenceImages?: string[];
  tasteVaultProfile?: string;
  targetPlatforms?: ('web' | 'ios' | 'android')[];
}

export interface PipelineOutput {
  primaryFlow: DesignFlow;
  variants: DesignFlow[];
  designSystem: DesignSystemConfig;
  generationTimeMs: number;
  tokenUsage: number;
}

export class DesignPipeline {
  private config: DesignPipelineConfig;

  constructor(config: Partial<DesignPipelineConfig> = {}) {
    this.config = { ...DEFAULT_DESIGN_PIPELINE_CONFIG, ...config };
  }

  /**
   * Generate design flows from a natural language prompt
   */
  async generate(input: PipelineInput): Promise<PipelineOutput> {
    const startTime = Date.now();

    // Step 1: Parse intent and select template
    const template = this.selectTemplate(input);

    // Step 2: Generate primary flow
    const primaryFlow = await this.generateFlow(input, template);

    // Step 3: Generate variants
    const variants = await this.generateVariants(primaryFlow);

    // Step 4: Extract design system
    const designSystem = this.extractDesignSystem(primaryFlow);

    return {
      primaryFlow,
      variants,
      designSystem,
      generationTimeMs: Date.now() - startTime,
      tokenUsage: this.estimateTokenUsage(primaryFlow, variants),
    };
  }

  /**
   * Select appropriate journey template based on input
   */
  private selectTemplate(input: PipelineInput): JourneyTemplate {
    if (input.journeyType) {
      const match = JOURNEY_TEMPLATES.find(t => t.type === input.journeyType);
      if (match) return match;
    }

    // Parse prompt for intent
    const prompt = input.prompt.toLowerCase();
    
    if (prompt.includes('login') || prompt.includes('sign in')) {
      return JOURNEY_TEMPLATES.find(t => t.id === 'auth-login')!;
    }
    if (prompt.includes('signup') || prompt.includes('register')) {
      return JOURNEY_TEMPLATES.find(t => t.id === 'auth-signup')!;
    }
    if (prompt.includes('onboard') || prompt.includes('tutorial')) {
      return JOURNEY_TEMPLATES.find(t => t.id === 'onboarding-welcome')!;
    }
    if (prompt.includes('dashboard') || prompt.includes('home')) {
      return JOURNEY_TEMPLATES.find(t => t.id === 'core-dashboard')!;
    }
    if (prompt.includes('landing') || prompt.includes('marketing')) {
      return JOURNEY_TEMPLATES.find(t => t.id === 'launch-landing')!;
    }

    // Default to custom
    return {
      id: 'custom',
      name: 'Custom Journey',
      type: 'custom',
      minScreens: 1,
      maxScreens: this.config.maxScreensPerJourney,
      requiredComponents: [],
      recommendedPatterns: [],
    };
  }

  /**
   * Generate a DesignFlow from input and template
   */
  private async generateFlow(
    input: PipelineInput,
    template: JourneyTemplate
  ): Promise<DesignFlow> {
    const screenCount = Math.min(
      template.maxScreens,
      Math.max(template.minScreens, 3)
    );

    const screens = this.generateScreens(screenCount, template);
    const connections = this.generateConnections(screens);

    return {
      id: `flow-${Date.now()}`,
      name: template.name,
      description: input.prompt,
      screens,
      connections,
      journeyType: template.type,
      semanticTags: this.extractSemanticTags(input.prompt),
    };
  }

  /**
   * Generate variant flows for A/B testing
   */
  private async generateVariants(primaryFlow: DesignFlow): Promise<DesignFlow[]> {
    const variantCount = this.config.defaultVariants - 1;
    const variants: DesignFlow[] = [];

    for (let i = 0; i < variantCount; i++) {
      const variant = this.createVariant(primaryFlow, i);
      variants.push(variant);
    }

    return variants;
  }

  /**
   * Create a variant of the primary flow
   */
  private createVariant(primaryFlow: DesignFlow, index: number): DesignFlow {
    const variations = [
      { layoutShift: 'compact', tone: 'minimal' },
      { layoutShift: 'spacious', tone: 'bold' },
      { layoutShift: 'centered', tone: 'friendly' },
      { layoutShift: 'asymmetric', tone: 'premium' },
    ];

    const variation = variations[index % variations.length];

    return {
      ...primaryFlow,
      id: `${primaryFlow.id}-variant-${index + 1}`,
      name: `${primaryFlow.name} (Variant ${index + 1})`,
      screens: primaryFlow.screens.map(screen => ({
        ...screen,
        id: `${screen.id}-v${index + 1}`,
        components: screen.components.map(c => ({
          ...c,
          props: {
            ...c.props,
            variant: variation.tone,
          },
        })),
      })),
      variantParentId: primaryFlow.id,
    };
  }

  /**
   * Extract design system from a flow
   */
  private extractDesignSystem(flow: DesignFlow): DesignSystemConfig {
    const tokens: DesignSystemConfig['tokens'] = [];
    const colors = new Set<string>();
    const fonts = new Set<string>();

    for (const screen of flow.screens) {
      for (const token of screen.designTokens) {
        tokens.push(token);
        if (token.category === 'color') {
          const value = typeof token.value === 'string'
            ? token.value
            : typeof token.value === 'number'
              ? String(token.value)
              : token.value.light;
          colors.add(value);
        }
        if (token.category === 'typography') {
          fonts.add(token.name);
        }
      }
    }

    return {
      tokens,
      baseFont: Array.from(fonts)[0] ?? 'system-ui',
      colorPalette: Array.from(colors),
      spacingScale: ['4px', '8px', '12px', '16px', '24px', '32px', '48px'],
      motionCurve: 'cubic-bezier(0.4, 0, 0.2, 1)',
      derivedFromTasteVault: this.config.tasteVaultInfluence > 0.5,
    };
  }

  /**
   * Generate screens based on template
   */
  private generateScreens(count: number, template: JourneyTemplate): DesignFlow['screens'] {
    const screens: DesignFlow['screens'] = [];

    for (let i = 0; i < count; i++) {
      screens.push({
        id: `screen-${i + 1}`,
        name: `${template.name} - Screen ${i + 1}`,
        layout: i === 0 ? 'stack' : 'scroll',
        components: this.generateComponents(template),
        designTokens: this.generateDefaultTokens(),
        responsiveBreakpoints: {
          mobile: { width: 375, columns: 4, spacing: '16px' },
          tablet: { width: 768, columns: 8, spacing: '24px' },
          desktop: { width: 1440, columns: 12, spacing: '32px' },
        },
        accessibility: {
          ariaLabels: {},
          contrastRatio: 4.5,
        },
        dreamModeReady: this.config.autoDreamModePreview,
      });
    }

    return screens;
  }

  /**
   * Generate components for a screen
   */
  private generateComponents(template: JourneyTemplate): DesignFlow['screens'][0]['components'] {
    const components: DesignFlow['screens'][0]['components'] = [];

    for (const componentType of template.requiredComponents) {
      components.push({
        id: `comp-${componentType}`,
        type: componentType as ComponentSpec['type'],
        props: {},
        position: { x: 0, y: 0, width: 100, height: 50 },
        tasteVaultTags: [],
      });
    }

    return components;
  }

  /**
   * Generate default design tokens
   */
  private generateDefaultTokens(): DesignSystemConfig['tokens'] {
    return [
      { category: 'color', name: 'primary', value: '#007AFF', source: 'default', confidence: 0.9 },
      { category: 'color', name: 'background', value: { light: '#FFFFFF', dark: '#000000' }, source: 'default', confidence: 0.95 },
      { category: 'typography', name: 'heading', value: 'Inter', source: 'default', confidence: 0.8 },
      { category: 'spacing', name: 'base', value: '16px', source: 'default', confidence: 0.9 },
      { category: 'radius', name: 'button', value: '8px', source: 'default', confidence: 0.85 },
    ];
  }

  /**
   * Generate connections between screens
   */
  private generateConnections(screens: DesignFlow['screens']): DesignFlow['connections'] {
    const connections: DesignFlow['connections'] = [];

    for (let i = 0; i < screens.length - 1; i++) {
      connections.push({
        fromScreenId: screens[i].id,
        toScreenId: screens[i + 1].id,
        trigger: 'click:next',
      });
    }

    return connections;
  }

  /**
   * Extract semantic tags from prompt
   */
  private extractSemanticTags(prompt: string): string[] {
    const tags: string[] = [];
    const lower = prompt.toLowerCase();

    if (lower.includes('modern')) tags.push('modern');
    if (lower.includes('minimal')) tags.push('minimal');
    if (lower.includes('bold')) tags.push('bold');
    if (lower.includes('professional')) tags.push('professional');
    if (lower.includes('friendly')) tags.push('friendly');
    if (lower.includes('premium')) tags.push('premium');

    return tags;
  }

  /**
   * Estimate token usage for generation
   */
  private estimateTokenUsage(primaryFlow: DesignFlow, variants: DesignFlow[]): number {
    const baseTokens = 1000;
    const screenTokens = primaryFlow.screens.length * 500;
    const variantTokens = variants.length * screenTokens * 0.7;
    return Math.min(this.config.maxTokensPerGeneration, baseTokens + screenTokens + variantTokens);
  }
}

export function createDesignPipeline(
  config?: Partial<DesignPipelineConfig>
): DesignPipeline {
  return new DesignPipeline(config);
}

// Type import for ComponentSpec
import type { ComponentSpec } from './types.js';
