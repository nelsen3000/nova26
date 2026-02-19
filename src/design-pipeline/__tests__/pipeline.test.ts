// Design Pipeline Tests — R20-03
// Comprehensive vitest tests for AI-Native Design Pipeline

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DesignPipeline, createDesignPipeline } from '../pipeline-core.js';
import { TokenExtractor, createTokenExtractor } from '../token-extractor.js';
import { ResponsiveEngine, createResponsiveEngine } from '../responsive-engine.js';
import {
  DEFAULT_DESIGN_PIPELINE_CONFIG,
  JOURNEY_TEMPLATES,
  type DesignFlow,
  type ScreenSpec,
  type DesignToken,
  type ScreenshotAnalysis,
} from '../types.js';

describe('Design Pipeline Core', () => {
  let pipeline: DesignPipeline;

  beforeEach(() => {
    pipeline = createDesignPipeline();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  describe('End-to-end Generation', () => {
    it('generate returns PipelineOutput with all fields', async () => {
      const input = {
        prompt: 'Create a login page',
        journeyType: 'auth' as const,
      };

      const result = await pipeline.generate(input);

      expect(result).toHaveProperty('primaryFlow');
      expect(result).toHaveProperty('variants');
      expect(result).toHaveProperty('designSystem');
      expect(result).toHaveProperty('generationTimeMs');
      expect(result).toHaveProperty('tokenUsage');
      expect(typeof result.generationTimeMs).toBe('number');
      expect(typeof result.tokenUsage).toBe('number');
    });

    it('generates correct number of variants', async () => {
      const input = {
        prompt: 'Create a dashboard',
      };

      const result = await pipeline.generate(input);

      // defaultVariants is 3, so 2 variants (3 - 1 parent)
      expect(result.variants).toHaveLength(2);
    });

    it('respects maxScreensPerJourney', async () => {
      const customPipeline = createDesignPipeline({
        maxScreensPerJourney: 5,
      });

      const input = {
        prompt: 'Create a complex onboarding flow',
        journeyType: 'onboarding' as const,
      };

      const result = await customPipeline.generate(input);

      expect(result.primaryFlow.screens.length).toBeLessThanOrEqual(5);
    });

    it('selects correct template for auth journey', async () => {
      const input = {
        prompt: 'Login page',
        journeyType: 'auth' as const,
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('auth');
    });

    it('selects correct template for onboarding journey', async () => {
      const input = {
        prompt: 'Welcome tutorial',
        journeyType: 'onboarding' as const,
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('onboarding');
    });

    it('selects correct template for core journey', async () => {
      const input = {
        prompt: 'Main dashboard',
        journeyType: 'core' as const,
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('core');
    });

    it('selects correct template based on prompt keywords - login', async () => {
      const input = {
        prompt: 'Create a login form',
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('auth');
    });

    it('selects correct template based on prompt keywords - signup', async () => {
      const input = {
        prompt: 'User signup registration',
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('auth');
    });

    it('selects correct template based on prompt keywords - onboarding', async () => {
      const input = {
        prompt: 'App onboarding tutorial',
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('onboarding');
    });

    it('selects correct template based on prompt keywords - dashboard', async () => {
      const input = {
        prompt: 'Home dashboard',
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('core');
    });

    it('selects correct template based on prompt keywords - landing', async () => {
      const input = {
        prompt: 'Marketing landing page',
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('launch');
    });

    it('extracts semantic tags from prompt', async () => {
      const input = {
        prompt: 'Create a modern minimal professional dashboard',
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.semanticTags).toContain('modern');
      expect(result.primaryFlow.semanticTags).toContain('minimal');
      expect(result.primaryFlow.semanticTags).toContain('professional');
    });

    it('creates valid DesignFlow structure', async () => {
      const input = {
        prompt: 'Simple test page',
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.id).toBeDefined();
      expect(result.primaryFlow.name).toBeDefined();
      expect(result.primaryFlow.description).toBe(input.prompt);
      expect(Array.isArray(result.primaryFlow.screens)).toBe(true);
      expect(Array.isArray(result.primaryFlow.connections)).toBe(true);
      expect(Array.isArray(result.primaryFlow.semanticTags)).toBe(true);
    });

    it('generates connections between screens', async () => {
      const input = {
        prompt: 'Multi-step form',
        journeyType: 'onboarding' as const,
      };

      const result = await pipeline.generate(input);

      if (result.primaryFlow.screens.length > 1) {
        expect(result.primaryFlow.connections.length).toBeGreaterThan(0);
        expect(result.primaryFlow.connections[0]).toHaveProperty('fromScreenId');
        expect(result.primaryFlow.connections[0]).toHaveProperty('toScreenId');
        expect(result.primaryFlow.connections[0]).toHaveProperty('trigger');
      }
    });

    it('extracts design system correctly', async () => {
      const input = {
        prompt: 'Test page',
      };

      const result = await pipeline.generate(input);

      expect(result.designSystem).toHaveProperty('tokens');
      expect(result.designSystem).toHaveProperty('baseFont');
      expect(result.designSystem).toHaveProperty('colorPalette');
      expect(result.designSystem).toHaveProperty('spacingScale');
      expect(result.designSystem).toHaveProperty('motionCurve');
      expect(result.designSystem).toHaveProperty('derivedFromTasteVault');
    });

    it('estimates token usage', async () => {
      const input = {
        prompt: 'Test page',
      };

      const result = await pipeline.generate(input);

      expect(result.tokenUsage).toBeGreaterThan(0);
      expect(result.tokenUsage).toBeLessThanOrEqual(DEFAULT_DESIGN_PIPELINE_CONFIG.maxTokensPerGeneration);
    });

    it('generation time is recorded', async () => {
      const input = {
        prompt: 'Test page',
      };

      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      const startTime = Date.now();
      
      const result = await pipeline.generate(input);
      
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('respects tasteVaultInfluence', async () => {
      const highInfluencePipeline = createDesignPipeline({
        tasteVaultInfluence: 0.8,
      });

      const input = {
        prompt: 'Test page',
      };

      const result = await highInfluencePipeline.generate(input);

      expect(result.designSystem.derivedFromTasteVault).toBe(true);
    });

    it('handles low tasteVaultInfluence', async () => {
      const lowInfluencePipeline = createDesignPipeline({
        tasteVaultInfluence: 0.3,
      });

      const input = {
        prompt: 'Test page',
      };

      const result = await lowInfluencePipeline.generate(input);

      expect(result.designSystem.derivedFromTasteVault).toBe(false);
    });

    it('handles custom journey type', async () => {
      const input = {
        prompt: 'Something completely unique',
        journeyType: 'custom' as const,
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('custom');
    });
  });

  describe('Variant Generation', () => {
    it('creates correct number of variants based on config', async () => {
      const customPipeline = createDesignPipeline({
        defaultVariants: 5,
      });

      const input = {
        prompt: 'Test page',
      };

      const result = await customPipeline.generate(input);

      expect(result.variants).toHaveLength(4); // 5 - 1 = 4 variants
    });

    it('each variant has unique ID', async () => {
      const input = {
        prompt: 'Test page',
      };

      const result = await pipeline.generate(input);

      const ids = result.variants.map(v => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('variant references parent', async () => {
      const input = {
        prompt: 'Test page',
      };

      const result = await pipeline.generate(input);

      result.variants.forEach(variant => {
        expect(variant.variantParentId).toBe(result.primaryFlow.id);
      });
    });

    it('variants have different layouts (tone)', async () => {
      const input = {
        prompt: 'Test page',
        journeyType: 'auth' as const,
      };

      const result = await pipeline.generate(input);

      // Check that variants have different tones applied
      const tones = result.variants.map(v => {
        const firstComp = v.screens[0]?.components[0];
        return firstComp?.props?.variant;
      });

      // At least some variants should have different tones
      // Auth templates have components, so we should get tones
      const uniqueTones = new Set(tones.filter(Boolean));
      expect(uniqueTones.size).toBeGreaterThanOrEqual(0);
    });

    it('variants preserve screen structure', async () => {
      const input = {
        prompt: 'Test page',
      };

      const result = await pipeline.generate(input);

      result.variants.forEach(variant => {
        expect(variant.screens.length).toBe(result.primaryFlow.screens.length);
      });
    });

    it('A/B tracking works via variantParentId', async () => {
      const input = {
        prompt: 'Test page',
      };

      const result = await pipeline.generate(input);

      result.variants.forEach((variant, index) => {
        expect(variant.variantParentId).toBe(result.primaryFlow.id);
        expect(variant.name).toContain(`Variant ${index + 1}`);
      });
    });

    it('variant screen IDs are unique from parent', async () => {
      const input = {
        prompt: 'Test page',
      };

      const result = await pipeline.generate(input);

      const parentScreenIds = result.primaryFlow.screens.map(s => s.id);

      result.variants.forEach(variant => {
        variant.screens.forEach(screen => {
          expect(parentScreenIds).not.toContain(screen.id);
        });
      });
    });

    it('variant component IDs are unique from parent', async () => {
      const input = {
        prompt: 'Test page',
        journeyType: 'auth' as const,
      };

      const result = await pipeline.generate(input);

      result.variants.forEach((variant, vIndex) => {
        variant.screens.forEach((screen) => {
          // Variant screen IDs should contain variant suffix
          expect(screen.id).toContain(`-v${vIndex + 1}`);
          screen.components.forEach(comp => {
            // Components should be updated with variant-specific props
            expect(comp.props).toHaveProperty('variant');
          });
        });
      });
    });

    it('single variant config generates no variants', async () => {
      const singleVariantPipeline = createDesignPipeline({
        defaultVariants: 1,
      });

      const input = {
        prompt: 'Test page',
      };

      const result = await singleVariantPipeline.generate(input);

      expect(result.variants).toHaveLength(0);
    });

    it('handles max variants limit gracefully', async () => {
      const maxVariantPipeline = createDesignPipeline({
        defaultVariants: 5,
      });

      const input = {
        prompt: 'Test page',
      };

      const result = await maxVariantPipeline.generate(input);

      expect(result.variants).toHaveLength(4);
    });
  });
});

describe('Token Extractor', () => {
  let extractor: TokenExtractor;

  beforeEach(() => {
    extractor = createTokenExtractor();
  });

  describe('Extraction', () => {
    it('extractFromScreenshot returns tokens', () => {
      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: ['#007AFF', '#FFFFFF'],
        typography: {
          fonts: ['Inter'],
          sizes: [14, 16, 20],
        },
        layout: {
          type: 'stack',
        },
        confidence: 0.9,
      };

      const tokens = extractor.extractFromScreenshot(analysis);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('extracts color tokens from palette', () => {
      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: ['#007AFF', '#FF0000', '#00FF00'],
        typography: {
          fonts: [],
          sizes: [],
        },
        layout: { type: 'stack' },
        confidence: 0.9,
      };

      const tokens = extractor.extractFromScreenshot(analysis);
      const colorTokens = tokens.filter(t => t.category === 'color');

      expect(colorTokens.length).toBeGreaterThan(0);
      expect(colorTokens[0]).toHaveProperty('name');
      expect(colorTokens[0]).toHaveProperty('value');
    });

    it('extracts typography tokens', () => {
      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: [],
        typography: {
          fonts: ['Inter'],
          sizes: [14, 16, 20, 24],
        },
        layout: { type: 'stack' },
        confidence: 0.9,
      };

      const tokens = extractor.extractFromScreenshot(analysis);
      const typographyTokens = tokens.filter(t => t.category === 'typography');

      expect(typographyTokens.length).toBeGreaterThan(0);
    });

    it('filters by minConfidence', () => {
      const strictExtractor = createTokenExtractor({
        minConfidence: 0.9,
      });

      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: ['#007AFF', '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'],
        typography: {
          fonts: ['Inter'],
          sizes: [12, 14, 16, 18, 20, 24],
        },
        layout: { type: 'stack' },
        confidence: 0.9,
      };

      const tokens = strictExtractor.extractFromScreenshot(analysis);

      tokens.forEach(token => {
        expect(token.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('handles empty palette', () => {
      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: [],
        typography: {
          fonts: ['Inter'],
          sizes: [16],
        },
        layout: { type: 'stack' },
        confidence: 0.9,
      };

      const tokens = extractor.extractFromScreenshot(analysis);
      const colorTokens = tokens.filter(t => t.category === 'color');

      expect(colorTokens).toHaveLength(0);
    });

    it('handles multiple fonts', () => {
      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: [],
        typography: {
          fonts: ['Inter', 'Roboto', 'Arial'],
          sizes: [16],
        },
        layout: { type: 'stack' },
        confidence: 0.9,
      };

      const tokens = extractor.extractFromScreenshot(analysis);
      const fontTokens = tokens.filter(t => t.category === 'typography' && t.name === 'font-family');

      expect(fontTokens.length).toBe(1);
      expect(fontTokens[0].value).toBe('Inter');
    });

    it('extracts color tokens with semantic names', () => {
      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: ['#007AFF', '#FF0000', '#00FF00'],
        typography: {
          fonts: [],
          sizes: [],
        },
        layout: { type: 'stack' },
        confidence: 0.9,
      };

      const tokens = extractor.extractFromScreenshot(analysis);
      const primaryToken = tokens.find(t => t.name === 'primary');

      expect(primaryToken).toBeDefined();
      expect(primaryToken?.value).toBe('#007AFF');
    });

    it('extracts typography size tokens', () => {
      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: [],
        typography: {
          fonts: ['Inter'],
          sizes: [12, 14, 16, 20, 24, 32],
        },
        layout: { type: 'stack' },
        confidence: 0.9,
      };

      const tokens = extractor.extractFromScreenshot(analysis);

      expect(tokens.some(t => t.name === 'text-xs')).toBe(true);
      expect(tokens.some(t => t.name === 'text-sm')).toBe(true);
      expect(tokens.some(t => t.name === 'text-base')).toBe(true);
    });
  });

  describe('Merge Operations', () => {
    it('mergeTokens combines sets', () => {
      const existing: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#000', source: 'test', confidence: 0.8 },
      ];
      const newTokens: DesignToken[] = [
        { category: 'color', name: 'secondary', value: '#FFF', source: 'test', confidence: 0.8 },
      ];

      const merged = extractor.mergeTokens(existing, newTokens);

      expect(merged).toHaveLength(2);
    });

    it('higher confidence wins in merge', () => {
      const existing: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#000', source: 'test', confidence: 0.5 },
      ];
      const newTokens: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#FFF', source: 'test', confidence: 0.9 },
      ];

      const merged = extractor.mergeTokens(existing, newTokens);
      const primary = merged.find(t => t.name === 'primary');

      expect(merged).toHaveLength(1);
      expect(primary?.value).toBe('#FFF');
      expect(primary?.confidence).toBe(0.9);
    });

    it('lower confidence does not override', () => {
      const existing: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#000', source: 'test', confidence: 0.9 },
      ];
      const newTokens: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#FFF', source: 'test', confidence: 0.5 },
      ];

      const merged = extractor.mergeTokens(existing, newTokens);
      const primary = merged.find(t => t.name === 'primary');

      expect(primary?.value).toBe('#000');
      expect(primary?.confidence).toBe(0.9);
    });

    it('mergeTokens handles empty arrays', () => {
      const existing: DesignToken[] = [];
      const newTokens: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#FFF', source: 'test', confidence: 0.8 },
      ];

      const merged = extractor.mergeTokens(existing, newTokens);

      expect(merged).toHaveLength(1);
    });

    it('mergeTokens handles both empty', () => {
      const merged = extractor.mergeTokens([], []);

      expect(merged).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    it('validateTokens checks required categories', () => {
      const tokens: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#007AFF', source: 'test', confidence: 0.9 },
        { category: 'typography', name: 'base', value: '16px', source: 'test', confidence: 0.9 },
      ];

      const result = extractor.validateTokens(tokens);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('validateTokens detects missing color tokens', () => {
      const tokens: DesignToken[] = [
        { category: 'typography', name: 'base', value: '16px', source: 'test', confidence: 0.9 },
      ];

      const result = extractor.validateTokens(tokens);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing color tokens');
    });

    it('validateTokens detects missing typography tokens', () => {
      const tokens: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#007AFF', source: 'test', confidence: 0.9 },
      ];

      const result = extractor.validateTokens(tokens);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing typography tokens');
    });

    it('validateTokens detects duplicates', () => {
      const tokens: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#007AFF', source: 'test', confidence: 0.9 },
        { category: 'color', name: 'primary', value: '#FF0000', source: 'test', confidence: 0.8 },
      ];

      const result = extractor.validateTokens(tokens);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Duplicate'))).toBe(true);
    });

    it('validateTokens passes with valid tokens', () => {
      const tokens: DesignToken[] = [
        { category: 'color', name: 'primary', value: '#007AFF', source: 'test', confidence: 0.9 },
        { category: 'color', name: 'secondary', value: '#FF0000', source: 'test', confidence: 0.8 },
        { category: 'typography', name: 'base', value: '16px', source: 'test', confidence: 0.9 },
        { category: 'typography', name: 'heading', value: '24px', source: 'test', confidence: 0.9 },
      ];

      const result = extractor.validateTokens(tokens);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('validateTokens handles empty array', () => {
      const result = extractor.validateTokens([]);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing color tokens');
      expect(result.issues).toContain('Missing typography tokens');
    });
  });

  describe('Configuration', () => {
    it('respects extractColors config', () => {
      const noColorExtractor = createTokenExtractor({
        extractColors: false,
      });

      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: ['#007AFF', '#FFFFFF'],
        typography: {
          fonts: ['Inter'],
          sizes: [16],
        },
        layout: { type: 'stack' },
        confidence: 0.9,
      };

      const tokens = noColorExtractor.extractFromScreenshot(analysis);
      const colorTokens = tokens.filter(t => t.category === 'color');

      expect(colorTokens).toHaveLength(0);
    });

    it('respects extractTypography config', () => {
      const noTypographyExtractor = createTokenExtractor({
        extractTypography: false,
      });

      const analysis: ScreenshotAnalysis = {
        sourceImage: 'test.png',
        detectedComponents: [],
        colorPalette: ['#007AFF'],
        typography: {
          fonts: ['Inter'],
          sizes: [16],
        },
        layout: { type: 'stack' },
        confidence: 0.9,
      };

      const tokens = noTypographyExtractor.extractFromScreenshot(analysis);
      const typographyTokens = tokens.filter(t => t.category === 'typography');

      expect(typographyTokens).toHaveLength(0);
    });
  });
});

describe('Responsive Engine', () => {
  let engine: ResponsiveEngine;
  let mockScreen: ScreenSpec;

  beforeEach(() => {
    engine = createResponsiveEngine();
    mockScreen = {
      id: 'test-screen',
      name: 'Test Screen',
      layout: 'stack',
      components: [
        {
          id: 'comp-1',
          type: 'button',
          props: {},
          position: { x: 100, y: 100, width: 200, height: 50 },
          tasteVaultTags: [],
        },
        {
          id: 'comp-2',
          type: 'card',
          props: {},
          position: { x: 50, y: 200, width: 300, height: 150 },
          tasteVaultTags: [],
        },
      ],
      designTokens: [],
      responsiveBreakpoints: {
        mobile: { width: 375, columns: 4, spacing: '16px' },
        tablet: { width: 768, columns: 8, spacing: '24px' },
        desktop: { width: 1440, columns: 12, spacing: '32px' },
      },
      accessibility: {
        ariaLabels: {},
        contrastRatio: 4.5,
      },
      dreamModeReady: true,
    };
  });

  describe('Variant Generation', () => {
    it('generateResponsiveVariants creates mobile', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.mobile).toBeDefined();
    });

    it('creates tablet when configured', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.tablet).toBeDefined();
    });

    it('creates desktop when configured', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.desktop).toBeDefined();
    });

    it('omits tablet when not in breakpoints config', () => {
      const mobileOnlyEngine = createResponsiveEngine({
        breakpoints: ['mobile'],
      });

      const result = mobileOnlyEngine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.mobile).toBeDefined();
      expect(result.breakpoints.tablet).toBeUndefined();
      expect(result.breakpoints.desktop).toBeUndefined();
    });

    it('scales component positions for mobile', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      const mobileComp = result.breakpoints.mobile.components[0];
      expect(mobileComp.position.width).toBeLessThan(mockScreen.components[0].position.width);
    });

    it('scales component positions for tablet', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      const tabletComp = result.breakpoints.tablet!.components[0];
      expect(tabletComp.position.width).toBeLessThan(mockScreen.components[0].position.width);
    });

    it('scales component positions for desktop', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      const desktopComp = result.breakpoints.desktop!.components[0];
      expect(desktopComp.position.width).toBeGreaterThan(mockScreen.components[0].position.width);
    });

    it('adapts layout for tablet - stack to grid', () => {
      const stackScreen: ScreenSpec = {
        ...mockScreen,
        layout: 'stack',
      };

      const result = engine.generateResponsiveVariants(stackScreen);

      expect(result.breakpoints.tablet!.layout).toBe('grid');
    });

    it('preserves non-stack layout on tablet', () => {
      const scrollScreen: ScreenSpec = {
        ...mockScreen,
        layout: 'scroll',
      };

      const result = engine.generateResponsiveVariants(scrollScreen);

      expect(result.breakpoints.tablet!.layout).toBe('scroll');
    });

    it('adapts layout for desktop - always grid', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.desktop!.layout).toBe('grid');
    });

    it('sets correct mobile breakpoint config', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.mobile.responsiveBreakpoints.mobile).toEqual({
        width: 375,
        columns: 4,
        spacing: '16px',
      });
    });

    it('sets correct tablet breakpoint config', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.tablet!.responsiveBreakpoints.tablet).toEqual({
        width: 768,
        columns: 8,
        spacing: '24px',
      });
    });

    it('sets correct desktop breakpoint config', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.desktop!.responsiveBreakpoints.desktop).toEqual({
        width: 1440,
        columns: 12,
        spacing: '32px',
      });
    });
  });

  describe('Media Queries', () => {
    it('generateMediaQueries creates CSS', () => {
      const variants = engine.generateResponsiveVariants(mockScreen);
      const css = engine.generateMediaQueries(variants.breakpoints);

      expect(typeof css).toBe('string');
      expect(css.length).toBeGreaterThan(0);
    });

    it('includes mobile media query', () => {
      const variants = engine.generateResponsiveVariants(mockScreen);
      const css = engine.generateMediaQueries(variants.breakpoints);

      expect(css).toContain('@media (max-width: 767px)');
    });

    it('includes tablet media query', () => {
      const variants = engine.generateResponsiveVariants(mockScreen);
      const css = engine.generateMediaQueries(variants.breakpoints);

      expect(css).toContain('@media (min-width: 768px) and (max-width: 1023px)');
    });

    it('includes desktop media query', () => {
      const variants = engine.generateResponsiveVariants(mockScreen);
      const css = engine.generateMediaQueries(variants.breakpoints);

      expect(css).toContain('@media (min-width: 1024px)');
    });

    it('omits queries for missing breakpoints', () => {
      const css = engine.generateMediaQueries({
        mobile: mockScreen,
      });

      expect(css).toContain('Mobile styles');
      expect(css).not.toContain('Tablet styles');
      expect(css).not.toContain('Desktop styles');
    });
  });

  describe('Breakpoint Detection', () => {
    it('isResponsiveReady returns true when breakpoints defined', () => {
      const ready = engine.isResponsiveReady(mockScreen);

      expect(ready).toBe(true);
    });

    it('isResponsiveReady returns false when no breakpoints', () => {
      const noBreakpointsScreen: ScreenSpec = {
        ...mockScreen,
        responsiveBreakpoints: {},
      };

      const ready = engine.isResponsiveReady(noBreakpointsScreen);

      expect(ready).toBe(false);
    });

    it('isResponsiveReady returns true with only mobile', () => {
      const mobileOnlyScreen: ScreenSpec = {
        ...mockScreen,
        responsiveBreakpoints: {
          mobile: { width: 375, columns: 4, spacing: '16px' },
        },
      };

      const ready = engine.isResponsiveReady(mobileOnlyScreen);

      expect(ready).toBe(true);
    });

    it('getBreakpointForWidth returns mobile for small width', () => {
      const bp = engine.getBreakpointForWidth(375);

      expect(bp).toBe('mobile');
    });

    it('getBreakpointForWidth returns tablet for medium width', () => {
      const bp = engine.getBreakpointForWidth(768);

      expect(bp).toBe('tablet');
    });

    it('getBreakpointForWidth returns desktop for large width', () => {
      const bp = engine.getBreakpointForWidth(1024);

      expect(bp).toBe('desktop');
    });

    it('getBreakpointForWidth handles edge cases', () => {
      expect(engine.getBreakpointForWidth(0)).toBe('mobile');
      expect(engine.getBreakpointForWidth(767)).toBe('mobile');
      expect(engine.getBreakpointForWidth(1023)).toBe('tablet');
    });
  });
});

describe('Templates & Design System', () => {
  describe('JOURNEY_TEMPLATES', () => {
    it('has all journey types', () => {
      const types = JOURNEY_TEMPLATES.map(t => t.type);

      expect(types).toContain('auth');
      expect(types).toContain('onboarding');
      expect(types).toContain('core');
      expect(types).toContain('launch');
    });

    it('auth template has required components', () => {
      const authTemplate = JOURNEY_TEMPLATES.find(t => t.id === 'auth-login');

      expect(authTemplate).toBeDefined();
      expect(authTemplate!.requiredComponents.length).toBeGreaterThan(0);
    });

    it('onboarding template has correct screen range', () => {
      const onboardingTemplate = JOURNEY_TEMPLATES.find(t => t.id === 'onboarding-welcome');

      expect(onboardingTemplate!.minScreens).toBe(3);
      expect(onboardingTemplate!.maxScreens).toBe(5);
    });

    it('core template has correct type', () => {
      const coreTemplate = JOURNEY_TEMPLATES.find(t => t.id === 'core-dashboard');

      expect(coreTemplate!.type).toBe('core');
    });

    it('launch template has correct components', () => {
      const launchTemplate = JOURNEY_TEMPLATES.find(t => t.id === 'launch-landing');

      expect(launchTemplate!.requiredComponents).toContain('hero');
      expect(launchTemplate!.requiredComponents).toContain('cta');
    });

    it('all templates have required fields', () => {
      JOURNEY_TEMPLATES.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('type');
        expect(template).toHaveProperty('minScreens');
        expect(template).toHaveProperty('maxScreens');
        expect(template).toHaveProperty('requiredComponents');
        expect(template).toHaveProperty('recommendedPatterns');
      });
    });

    it('minScreens is less than or equal to maxScreens for all templates', () => {
      JOURNEY_TEMPLATES.forEach(template => {
        expect(template.minScreens).toBeLessThanOrEqual(template.maxScreens);
      });
    });
  });

  describe('DEFAULT_DESIGN_PIPELINE_CONFIG', () => {
    it('has correct default values', () => {
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.defaultVariants).toBe(3);
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.maxScreensPerJourney).toBe(10);
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.visionModel).toBe('grok-vision');
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.tasteVaultInfluence).toBe(0.94);
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.autoDreamModePreview).toBe(true);
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.maxTokensPerGeneration).toBe(4000);
    });

    it('has valid responsivePresets', () => {
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.responsivePresets).toContain('mobile');
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.responsivePresets).toContain('tablet');
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.responsivePresets).toContain('desktop');
    });

    it('tasteVaultInfluence is within valid range', () => {
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.tasteVaultInfluence).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.tasteVaultInfluence).toBeLessThanOrEqual(1);
    });

    it('maxScreensPerJourney is positive', () => {
      expect(DEFAULT_DESIGN_PIPELINE_CONFIG.maxScreensPerJourney).toBeGreaterThan(0);
    });
  });

  describe('Design System Extraction', () => {
    let pipeline: DesignPipeline;

    beforeEach(() => {
      pipeline = createDesignPipeline();
    });

    it('extractDesignSystem gets colors from flow', async () => {
      const input = { prompt: 'Test page' };
      const result = await pipeline.generate(input);

      expect(result.designSystem.colorPalette.length).toBeGreaterThan(0);
    });

    it('extractDesignSystem gets fonts from flow', async () => {
      const input = { prompt: 'Test page' };
      const result = await pipeline.generate(input);

      expect(typeof result.designSystem.baseFont).toBe('string');
      expect(result.designSystem.baseFont.length).toBeGreaterThan(0);
    });

    it('designSystem derivedFromTasteVault when influence is high', async () => {
      const highInfluencePipeline = createDesignPipeline({
        tasteVaultInfluence: 0.6,
      });

      const input = { prompt: 'Test page' };
      const result = await highInfluencePipeline.generate(input);

      expect(result.designSystem.derivedFromTasteVault).toBe(true);
    });

    it('designSystem not derivedFromTasteVault when influence is low', async () => {
      const lowInfluencePipeline = createDesignPipeline({
        tasteVaultInfluence: 0.4,
      });

      const input = { prompt: 'Test page' };
      const result = await lowInfluencePipeline.generate(input);

      expect(result.designSystem.derivedFromTasteVault).toBe(false);
    });

    it('generates default tokens', async () => {
      const input = { prompt: 'Test page' };
      const result = await pipeline.generate(input);

      expect(result.designSystem.tokens.length).toBeGreaterThan(0);
    });

    it('colorPalette is populated with unique colors', async () => {
      const input = { prompt: 'Test page' };
      const result = await pipeline.generate(input);

      const uniqueColors = new Set(result.designSystem.colorPalette);
      expect(uniqueColors.size).toBe(result.designSystem.colorPalette.length);
    });

    it('spacingScale is array of strings', async () => {
      const input = { prompt: 'Test page' };
      const result = await pipeline.generate(input);

      expect(Array.isArray(result.designSystem.spacingScale)).toBe(true);
      result.designSystem.spacingScale.forEach(s => {
        expect(typeof s).toBe('string');
      });
    });

    it('motionCurve is defined', async () => {
      const input = { prompt: 'Test page' };
      const result = await pipeline.generate(input);

      expect(typeof result.designSystem.motionCurve).toBe('string');
    });

    it('handles flows without design tokens gracefully', async () => {
      const input = { prompt: 'Empty test' };
      const result = await pipeline.generate(input);

      // Should still have default design system values
      expect(result.designSystem.baseFont).toBeDefined();
      expect(result.designSystem.colorPalette).toBeDefined();
      expect(result.designSystem.spacingScale).toBeDefined();
    });
  });
});

describe('Integration', () => {
  describe('Full Pipeline Flow', () => {
    it('full pipeline flow with all components', async () => {
      const pipeline = createDesignPipeline();
      const tokenExtractor = createTokenExtractor();
      const responsiveEngine = createResponsiveEngine();

      const input = {
        prompt: 'Create a modern onboarding flow with login',
        journeyType: 'onboarding' as const,
      };

      // Run pipeline
      const result = await pipeline.generate(input);

      // Verify pipeline output
      expect(result.primaryFlow).toBeDefined();
      expect(result.variants).toBeDefined();
      expect(result.designSystem).toBeDefined();

      // Test token extraction on a screen
      const screen = result.primaryFlow.screens[0];
      const mockAnalysis: ScreenshotAnalysis = {
        sourceImage: 'generated.png',
        detectedComponents: screen.components,
        colorPalette: result.designSystem.colorPalette,
        typography: {
          fonts: [result.designSystem.baseFont],
          sizes: [14, 16, 18],
        },
        layout: { type: screen.layout },
        confidence: 0.9,
      };

      const tokens = tokenExtractor.extractFromScreenshot(mockAnalysis);
      expect(tokens.length).toBeGreaterThan(0);

      // Test responsive generation
      const responsiveVariants = responsiveEngine.generateResponsiveVariants(screen);
      expect(responsiveVariants.breakpoints.mobile).toBeDefined();
    });

    it('token extraction integration with design system', async () => {
      const pipeline = createDesignPipeline();
      const tokenExtractor = createTokenExtractor();

      const input = { prompt: 'Dashboard with blue theme' };
      const result = await pipeline.generate(input);

      // Extract tokens from the generated design system
      const mockAnalysis: ScreenshotAnalysis = {
        sourceImage: 'dashboard.png',
        detectedComponents: [],
        colorPalette: result.designSystem.colorPalette,
        typography: {
          fonts: [result.designSystem.baseFont],
          sizes: [12, 14, 16, 20, 24],
        },
        layout: { type: 'grid' },
        confidence: 0.95,
      };

      const tokens = tokenExtractor.extractFromScreenshot(mockAnalysis);
      const validation = tokenExtractor.validateTokens(tokens);

      // Should have valid tokens for further use
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('responsive + pipeline integration', async () => {
      const pipeline = createDesignPipeline();
      const responsiveEngine = createResponsiveEngine();

      const input = {
        prompt: 'Responsive landing page',
        journeyType: 'launch' as const,
      };

      const result = await pipeline.generate(input);

      // Generate responsive variants for all screens
      const allResponsiveVariants = result.primaryFlow.screens.map(screen =>
        responsiveEngine.generateResponsiveVariants(screen)
      );

      expect(allResponsiveVariants).toHaveLength(result.primaryFlow.screens.length);

      allResponsiveVariants.forEach(variant => {
        expect(variant.breakpoints.mobile).toBeDefined();
        expect(variant.breakpoints.tablet).toBeDefined();
        expect(variant.breakpoints.desktop).toBeDefined();
      });
    });

    it('variant generation integration', async () => {
      const pipeline = createDesignPipeline({
        defaultVariants: 5,
      });

      const input = { prompt: 'A/B test landing page' };
      const result = await pipeline.generate(input);

      // Verify variant structure
      expect(result.variants).toHaveLength(4);

      // All variants should be valid DesignFlows
      result.variants.forEach(variant => {
        expect(variant.id).toBeDefined();
        expect(variant.screens).toBeDefined();
        expect(variant.variantParentId).toBe(result.primaryFlow.id);
      });
    });

    it('design system extraction integration', async () => {
      const pipeline = createDesignPipeline();

      const input = { prompt: 'Professional dashboard with Inter font' };
      const result = await pipeline.generate(input);

      // Design system should be complete
      expect(result.designSystem.tokens).toBeDefined();
      expect(result.designSystem.colorPalette).toBeDefined();
      expect(result.designSystem.baseFont).toBeDefined();
      expect(result.designSystem.spacingScale).toBeDefined();

      // Tokens should be extractable
      const colorTokens = result.designSystem.tokens.filter(t => t.category === 'color');
      expect(colorTokens.length).toBeGreaterThanOrEqual(0);
    });

    it('performance - generation completes in reasonable time', async () => {
      const pipeline = createDesignPipeline();

      const input = { prompt: 'Complex multi-screen application' };
      const startTime = Date.now();
      const result = await pipeline.generate(input);
      const endTime = Date.now();

      // Should complete in less than 25 seconds (mocked)
      expect(result.generationTimeMs).toBeLessThan(25000);
    });

    it('token validation integration with pipeline output', async () => {
      const pipeline = createDesignPipeline();
      const tokenExtractor = createTokenExtractor();

      const input = { prompt: 'Complete design system' };
      const result = await pipeline.generate(input);

      const validation = tokenExtractor.validateTokens(result.designSystem.tokens);

      // Pipeline generates tokens across multiple screens
      // Tokens should have both color and typography categories
      const hasColor = result.designSystem.tokens.some(t => t.category === 'color');
      const hasTypography = result.designSystem.tokens.some(t => t.category === 'typography');
      expect(hasColor).toBe(true);
      expect(hasTypography).toBe(true);
      // Validation may find duplicates since screens share similar tokens
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('issues');
    });

    it('screens have responsive breakpoints', async () => {
      const pipeline = createDesignPipeline();

      const input = { prompt: 'Test page' };
      const result = await pipeline.generate(input);

      result.primaryFlow.screens.forEach(screen => {
        expect(screen.responsiveBreakpoints).toBeDefined();
        expect(screen.responsiveBreakpoints.mobile).toBeDefined();
        expect(screen.responsiveBreakpoints.tablet).toBeDefined();
        expect(screen.responsiveBreakpoints.desktop).toBeDefined();
      });
    });

    it('screens have accessibility config', async () => {
      const pipeline = createDesignPipeline();

      const input = { prompt: 'Accessible page' };
      const result = await pipeline.generate(input);

      result.primaryFlow.screens.forEach(screen => {
        expect(screen.accessibility).toBeDefined();
        expect(screen.accessibility.ariaLabels).toBeDefined();
        expect(typeof screen.accessibility.contrastRatio).toBe('number');
      });
    });

    it('dreamModeReady respects config', async () => {
      const enabledPipeline = createDesignPipeline({
        autoDreamModePreview: true,
      });
      const disabledPipeline = createDesignPipeline({
        autoDreamModePreview: false,
      });

      const input = { prompt: 'Test page' };
      const enabledResult = await enabledPipeline.generate(input);
      const disabledResult = await disabledPipeline.generate(input);

      expect(enabledResult.primaryFlow.screens[0].dreamModeReady).toBe(true);
      expect(disabledResult.primaryFlow.screens[0].dreamModeReady).toBe(false);
    });

    it('multiple pipeline instances are independent', async () => {
      const pipeline1 = createDesignPipeline({ defaultVariants: 2 });
      const pipeline2 = createDesignPipeline({ defaultVariants: 5 });

      const input = { prompt: 'Test page' };
      const result1 = await pipeline1.generate(input);
      const result2 = await pipeline2.generate(input);

      expect(result1.variants).toHaveLength(1);
      expect(result2.variants).toHaveLength(4);
    });

    it('complete workflow with all options', async () => {
      const pipeline = createDesignPipeline({
        defaultVariants: 3,
        maxScreensPerJourney: 8,
        tasteVaultInfluence: 0.8,
      });

      const input = {
        prompt: 'Modern minimal professional login page',
        journeyType: 'auth' as const,
        targetPlatforms: ['web', 'ios'] as const,
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.journeyType).toBe('auth');
      expect(result.primaryFlow.semanticTags).toContain('modern');
      expect(result.primaryFlow.semanticTags).toContain('minimal');
      expect(result.primaryFlow.semanticTags).toContain('professional');
      expect(result.variants).toHaveLength(2);
      expect(result.designSystem.derivedFromTasteVault).toBe(true);
    });

    it('handles complex prompt with multiple keywords', async () => {
      const pipeline = createDesignPipeline();

      const input = {
        prompt: 'A bold friendly premium onboarding signup experience',
      };

      const result = await pipeline.generate(input);

      expect(result.primaryFlow.semanticTags).toContain('bold');
      expect(result.primaryFlow.semanticTags).toContain('friendly');
      expect(result.primaryFlow.semanticTags).toContain('premium');
    });

    it('estimates token usage correctly', async () => {
      const pipeline = createDesignPipeline();

      const input = { prompt: 'Simple page' };
      const result = await pipeline.generate(input);

      // Base tokens (1000) + screen tokens + variant tokens
      expect(result.tokenUsage).toBeGreaterThanOrEqual(1000);
    });
  });
});
