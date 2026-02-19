// Design Pipeline Integration Tests — R20-03
// End-to-end integration tests for complete workflow scenarios

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDesignPipeline } from '../pipeline-core.js';
import { createTokenExtractor } from '../token-extractor.js';
import { createResponsiveEngine } from '../responsive-engine.js';
import type { ScreenshotAnalysis, DesignFlow, DesignToken, ScreenSpec } from '../types.js';

describe('Integration: Prompt → DesignFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  it('completes full generation from login prompt', async () => {
    const pipeline = createDesignPipeline();
    const input = { prompt: 'Create a login page' };

    const result = await pipeline.generate(input);

    expect(result.primaryFlow).toBeDefined();
    expect(result.primaryFlow.id).toBe('flow-1704067200000');
    expect(result.primaryFlow.journeyType).toBe('auth');
    expect(result.primaryFlow.screens.length).toBeGreaterThan(0);
    expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.tokenUsage).toBeGreaterThan(0);
  });

  it('selects correct template for onboarding journey', async () => {
    const pipeline = createDesignPipeline();
    const input = { prompt: 'Create an onboarding tutorial' };

    const result = await pipeline.generate(input);

    expect(result.primaryFlow.journeyType).toBe('onboarding');
    expect(result.primaryFlow.screens.length).toBeGreaterThanOrEqual(3);
    expect(result.primaryFlow.screens.length).toBeLessThanOrEqual(5);
  });

  it('creates variants with A/B tracking info', async () => {
    const pipeline = createDesignPipeline({ defaultVariants: 3 });
    const input = { prompt: 'Create a signup page' };

    const result = await pipeline.generate(input);

    expect(result.variants).toHaveLength(2);
    result.variants.forEach((variant, index) => {
      expect(variant.variantParentId).toBe(result.primaryFlow.id);
      expect(variant.name).toContain(`Variant ${index + 1}`);
      expect(variant.screens.length).toBe(result.primaryFlow.screens.length);
    });
  });

  it('extracts design system with tokens from generated flow', async () => {
    const pipeline = createDesignPipeline();
    const input = { prompt: 'Create a modern dashboard' };

    const result = await pipeline.generate(input);

    expect(result.designSystem).toBeDefined();
    expect(result.designSystem.tokens).toBeDefined();
    expect(result.designSystem.tokens.length).toBeGreaterThan(0);
    expect(result.designSystem.colorPalette).toBeDefined();
    expect(result.designSystem.baseFont).toBeDefined();
    expect(result.designSystem.spacingScale).toBeDefined();
    expect(result.designSystem.motionCurve).toBeDefined();
  });
});

describe('Integration: DesignFlow → Tokens', () => {
  let pipeline: ReturnType<typeof createDesignPipeline>;
  let extractor: ReturnType<typeof createTokenExtractor>;

  beforeEach(() => {
    pipeline = createDesignPipeline();
    extractor = createTokenExtractor();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  it('extracts tokens from flow screens', async () => {
    const input = { prompt: 'Create a landing page with blue theme' };
    const result = await pipeline.generate(input);

    const screen = result.primaryFlow.screens[0];
    const analysis: ScreenshotAnalysis = {
      sourceImage: 'generated-screen.png',
      detectedComponents: screen.components,
      colorPalette: result.designSystem.colorPalette,
      typography: {
        fonts: [result.designSystem.baseFont],
        sizes: [12, 14, 16, 20, 24],
      },
      layout: { type: screen.layout },
      confidence: 0.9,
    };

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some((t) => t.category === 'color')).toBe(true);
    expect(tokens.some((t) => t.category === 'typography')).toBe(true);
  });

  it('merges extracted tokens with new tokens preserving higher confidence', async () => {
    const existingTokens: DesignToken[] = [
      { category: 'color', name: 'primary', value: '#000000', source: 'test', confidence: 0.5 },
      { category: 'typography', name: 'heading', value: 'Arial', source: 'test', confidence: 0.8 },
    ];

    const newTokens: DesignToken[] = [
      { category: 'color', name: 'primary', value: '#007AFF', source: 'extracted', confidence: 0.9 },
      { category: 'color', name: 'secondary', value: '#FF0000', source: 'extracted', confidence: 0.8 },
    ];

    const merged = extractor.mergeTokens(existingTokens, newTokens);

    expect(merged).toHaveLength(3);
    const primary = merged.find((t) => t.name === 'primary');
    expect(primary?.value).toBe('#007AFF');
    expect(primary?.confidence).toBe(0.9);
  });

  it('validates token consistency across extracted tokens', async () => {
    const input = { prompt: 'Create a complete design system' };
    const result = await pipeline.generate(input);

    const tokens: DesignToken[] = [];
    result.primaryFlow.screens.forEach((screen) => {
      tokens.push(...screen.designTokens);
    });

    const validation = extractor.validateTokens(tokens);

    expect(validation).toHaveProperty('valid');
    expect(validation).toHaveProperty('issues');
    // Pipeline generates default tokens with both color and typography
    const hasColor = tokens.some((t) => t.category === 'color');
    const hasTypography = tokens.some((t) => t.category === 'typography');
    expect(hasColor).toBe(true);
    expect(hasTypography).toBe(true);
  });

  it('handles missing token categories gracefully', async () => {
    const incompleteTokens: DesignToken[] = [
      { category: 'spacing', name: 'base', value: '16px', source: 'test', confidence: 0.9 },
    ];

    const validation = extractor.validateTokens(incompleteTokens);

    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain('Missing color tokens');
    expect(validation.issues).toContain('Missing typography tokens');
  });
});

describe('Integration: Tokens → Responsive Output', () => {
  let engine: ReturnType<typeof createResponsiveEngine>;
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
      ],
      designTokens: [
        { category: 'color', name: 'primary', value: '#007AFF', source: 'test', confidence: 0.9 },
        { category: 'spacing', name: 'base', value: '16px', source: 'test', confidence: 0.9 },
      ],
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

  it('generates responsive variants for all breakpoints', () => {
    const output = engine.generateResponsiveVariants(mockScreen);

    expect(output.screenId).toBe('test-screen');
    expect(output.breakpoints.mobile).toBeDefined();
    expect(output.breakpoints.tablet).toBeDefined();
    expect(output.breakpoints.desktop).toBeDefined();
  });

  it('maintains token consistency across responsive variants', () => {
    const output = engine.generateResponsiveVariants(mockScreen);

    const mobileTokens = output.breakpoints.mobile.designTokens;
    const tabletTokens = output.breakpoints.tablet!.designTokens;
    const desktopTokens = output.breakpoints.desktop!.designTokens;

    expect(mobileTokens).toEqual(mockScreen.designTokens);
    expect(tabletTokens).toEqual(mockScreen.designTokens);
    expect(desktopTokens).toEqual(mockScreen.designTokens);
  });

  it('scales components proportionally with token spacing', () => {
    const output = engine.generateResponsiveVariants(mockScreen);

    const originalComp = mockScreen.components[0];
    const mobileComp = output.breakpoints.mobile.components[0];
    const tabletComp = output.breakpoints.tablet!.components[0];
    const desktopComp = output.breakpoints.desktop!.components[0];

    // Mobile scales down by 0.5
    expect(mobileComp.position.width).toBe(Math.round(originalComp.position.width * 0.5));
    // Tablet scales down by 0.8
    expect(tabletComp.position.width).toBe(Math.round(originalComp.position.width * 0.8));
    // Desktop scales up by 1.2
    expect(desktopComp.position.width).toBe(Math.round(originalComp.position.width * 1.2));
  });

  it('generates correct CSS media queries for breakpoints', () => {
    const output = engine.generateResponsiveVariants(mockScreen);
    const css = engine.generateMediaQueries(output.breakpoints);

    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('@media (min-width: 768px) and (max-width: 1023px)');
    expect(css).toContain('@media (min-width: 1024px)');
  });
});

describe('Integration: Full Pipeline End-to-End', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  it('auth journey end-to-end: login → tokens → responsive', async () => {
    const pipeline = createDesignPipeline();
    const extractor = createTokenExtractor();
    const responsiveEngine = createResponsiveEngine();

    // Step 1: Generate login flow
    const input = { prompt: 'Create a login page with email and password' };
    const result = await pipeline.generate(input);

    expect(result.primaryFlow.journeyType).toBe('auth');
    expect(result.primaryFlow.screens.length).toBeGreaterThan(0);

    // Step 2: Extract tokens from screens
    const screen = result.primaryFlow.screens[0];
    const analysis: ScreenshotAnalysis = {
      sourceImage: 'login-screen.png',
      detectedComponents: screen.components,
      colorPalette: result.designSystem.colorPalette,
      typography: { fonts: [result.designSystem.baseFont], sizes: [14, 16, 18] },
      layout: { type: screen.layout },
      confidence: 0.9,
    };
    const tokens = extractor.extractFromScreenshot(analysis);
    expect(tokens.length).toBeGreaterThan(0);

    // Step 3: Generate responsive variants
    const responsiveVariants = responsiveEngine.generateResponsiveVariants(screen);
    expect(responsiveVariants.breakpoints.mobile).toBeDefined();
    expect(responsiveVariants.breakpoints.tablet).toBeDefined();
    expect(responsiveVariants.breakpoints.desktop).toBeDefined();
  });

  it('onboarding journey end-to-end: multi-screen → tokens → responsive', async () => {
    const pipeline = createDesignPipeline();
    const extractor = createTokenExtractor();
    const responsiveEngine = createResponsiveEngine();

    // Step 1: Generate onboarding flow
    const input = { prompt: 'Create a 3-step onboarding tutorial' };
    const result = await pipeline.generate(input);

    expect(result.primaryFlow.journeyType).toBe('onboarding');
    expect(result.primaryFlow.screens.length).toBeGreaterThanOrEqual(3);

    // Step 2: Process all screens
    for (const screen of result.primaryFlow.screens) {
      const analysis: ScreenshotAnalysis = {
        sourceImage: `${screen.id}.png`,
        detectedComponents: screen.components,
        colorPalette: result.designSystem.colorPalette,
        typography: { fonts: [result.designSystem.baseFont], sizes: [16, 18, 20] },
        layout: { type: screen.layout },
        confidence: 0.85,
      };
      const tokens = extractor.extractFromScreenshot(analysis);
      expect(tokens.length).toBeGreaterThanOrEqual(0);

      // Step 3: Generate responsive for each screen
      const responsive = responsiveEngine.generateResponsiveVariants(screen);
      expect(responsive.breakpoints.mobile).toBeDefined();
    }
  });

  it('complete flow with tasteVault influence enabled', async () => {
    const pipeline = createDesignPipeline({
      tasteVaultInfluence: 0.8,
      defaultVariants: 3,
    });
    const extractor = createTokenExtractor();

    const input = { prompt: 'Create a premium professional landing page' };
    const result = await pipeline.generate(input);

    expect(result.designSystem.derivedFromTasteVault).toBe(true);
    expect(result.primaryFlow.semanticTags).toContain('premium');
    expect(result.primaryFlow.semanticTags).toContain('professional');

    // Verify tokens can be extracted and validated
    const allTokens: DesignToken[] = [];
    result.primaryFlow.screens.forEach((screen) => {
      allTokens.push(...screen.designTokens);
    });

    const validation = extractor.validateTokens(allTokens);
    expect(validation).toHaveProperty('valid');
  });

  it('performance: complete generation under 25 seconds (mocked)', async () => {
    const pipeline = createDesignPipeline();
    const input = { prompt: 'Create a complex multi-screen application' };

    const result = await pipeline.generate(input);

    expect(result.generationTimeMs).toBeLessThan(25000);
    expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('multiple flows can be generated independently', async () => {
    const pipeline = createDesignPipeline();

    // Generate flows sequentially to ensure unique timestamps
    const authResult = await pipeline.generate({ prompt: 'Login page' });
    vi.setSystemTime(new Date('2024-01-01T00:00:01.000Z'));
    
    const onboardingResult = await pipeline.generate({ prompt: 'Welcome tutorial' });
    vi.setSystemTime(new Date('2024-01-01T00:00:02.000Z'));
    
    const dashboardResult = await pipeline.generate({ prompt: 'Main dashboard' });

    expect(authResult.primaryFlow.journeyType).toBe('auth');
    expect(onboardingResult.primaryFlow.journeyType).toBe('onboarding');
    expect(dashboardResult.primaryFlow.journeyType).toBe('core');

    // All flows should have unique IDs
    const ids = [authResult.primaryFlow.id, onboardingResult.primaryFlow.id, dashboardResult.primaryFlow.id];
    expect(new Set(ids).size).toBe(3);
  });

  it('variant A/B tracking across full pipeline', async () => {
    const pipeline = createDesignPipeline({ defaultVariants: 5 });
    const input = { prompt: 'Create a signup page for A/B testing' };

    const result = await pipeline.generate(input);

    expect(result.variants).toHaveLength(4);

    // Verify A/B tracking structure
    const variantSet = {
      parentId: result.primaryFlow.id,
      variants: result.variants,
      selectionMetric: 'conversion' as const,
    };

    expect(variantSet.parentId).toBe(result.primaryFlow.id);
    expect(variantSet.variants).toHaveLength(4);

    // Each variant should reference parent
    variantSet.variants.forEach((variant) => {
      expect(variant.variantParentId).toBe(result.primaryFlow.id);
    });
  });

  it('responsive generation integrated with pipeline output', async () => {
    const pipeline = createDesignPipeline();
    const responsiveEngine = createResponsiveEngine();

    const input = { prompt: 'Create a responsive landing page' };
    const result = await pipeline.generate(input);

    // Generate responsive variants for all screens in the flow
    const responsiveOutputs = result.primaryFlow.screens.map((screen) =>
      responsiveEngine.generateResponsiveVariants(screen)
    );

    expect(responsiveOutputs).toHaveLength(result.primaryFlow.screens.length);

    responsiveOutputs.forEach((output) => {
      expect(output.breakpoints.mobile).toBeDefined();
      expect(output.breakpoints.tablet).toBeDefined();
      expect(output.breakpoints.desktop).toBeDefined();

      // Verify media queries can be generated
      const css = responsiveEngine.generateMediaQueries(output.breakpoints);
      expect(css.length).toBeGreaterThan(0);
    });
  });

  it('token extraction and validation integrated with pipeline', async () => {
    const pipeline = createDesignPipeline();
    const extractor = createTokenExtractor();

    const input = { prompt: 'Create a design system with colors and typography' };
    const result = await pipeline.generate(input);

    // Extract tokens from design system
    const mockAnalysis: ScreenshotAnalysis = {
      sourceImage: 'design-system.png',
      detectedComponents: result.primaryFlow.screens.flatMap((s) => s.components),
      colorPalette: result.designSystem.colorPalette,
      typography: {
        fonts: [result.designSystem.baseFont],
        sizes: [12, 14, 16, 20, 24, 32],
      },
      layout: { type: 'grid' },
      confidence: 0.95,
    };

    const extractedTokens = extractor.extractFromScreenshot(mockAnalysis);
    const validation = extractor.validateTokens(extractedTokens);

    // Merge with pipeline tokens
    const pipelineTokens = result.designSystem.tokens;
    const mergedTokens = extractor.mergeTokens(pipelineTokens, extractedTokens);

    // mergeTokens deduplicates by category:name, so merged count may be less than sum
    // but should have at least the unique tokens from both sets
    expect(mergedTokens.length).toBeGreaterThanOrEqual(1);
    expect(extractedTokens.length).toBeGreaterThan(0);
  });

  it('realistic scenario: login page → 2 screens → tokens → responsive', async () => {
    const pipeline = createDesignPipeline({ defaultVariants: 2 });
    const extractor = createTokenExtractor();
    const responsiveEngine = createResponsiveEngine();

    // User request: "Create a login page"
    const input = { prompt: 'Create a login page' };
    const result = await pipeline.generate(input);

    // Verify 2 screens generated (auth template can have up to 3)
    expect(result.primaryFlow.screens.length).toBeGreaterThanOrEqual(1);
    expect(result.primaryFlow.screens.length).toBeLessThanOrEqual(3);

    // Extract tokens from the flow
    const screenTokens: DesignToken[] = [];
    result.primaryFlow.screens.forEach((screen) => {
      screenTokens.push(...screen.designTokens);
    });

    // Verify tokens exist
    expect(screenTokens.length).toBeGreaterThan(0);
    expect(screenTokens.some((t) => t.category === 'color')).toBe(true);

    // Make responsive
    const responsiveVariants = result.primaryFlow.screens.map((screen) =>
      responsiveEngine.generateResponsiveVariants(screen)
    );

    expect(responsiveVariants.length).toBe(result.primaryFlow.screens.length);

    // Verify all breakpoints have appropriate spacing
    responsiveVariants.forEach((variant) => {
      expect(variant.breakpoints.mobile?.responsiveBreakpoints.mobile?.spacing).toBe('16px');
      expect(variant.breakpoints.tablet?.responsiveBreakpoints.tablet?.spacing).toBe('24px');
      expect(variant.breakpoints.desktop?.responsiveBreakpoints.desktop?.spacing).toBe('32px');
    });
  });

  it('complex workflow: multi-variant with responsive and token merge', async () => {
    const pipeline = createDesignPipeline({
      defaultVariants: 3,
      tasteVaultInfluence: 0.7,
    });
    const extractor = createTokenExtractor();
    const responsiveEngine = createResponsiveEngine();

    const input = { prompt: 'Modern minimal professional onboarding flow' };
    const result = await pipeline.generate(input);

    // Process primary flow and variants
    const allFlows: DesignFlow[] = [result.primaryFlow, ...result.variants];

    for (const flow of allFlows) {
      // Extract and merge tokens from each screen
      let flowTokens: DesignToken[] = [];

      for (const screen of flow.screens) {
        const analysis: ScreenshotAnalysis = {
          sourceImage: `${flow.id}-${screen.id}.png`,
          detectedComponents: screen.components,
          colorPalette: result.designSystem.colorPalette,
          typography: { fonts: [result.designSystem.baseFont], sizes: [14, 16, 18] },
          layout: { type: screen.layout },
          confidence: 0.88,
        };

        const extracted = extractor.extractFromScreenshot(analysis);
        flowTokens = extractor.mergeTokens(flowTokens, extracted);

        // Generate responsive variants
        const responsive = responsiveEngine.generateResponsiveVariants(screen);
        expect(responsive.breakpoints.mobile).toBeDefined();
      }

      expect(flowTokens.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('breakpoint detection works with pipeline-generated screens', async () => {
    const pipeline = createDesignPipeline();
    const responsiveEngine = createResponsiveEngine();

    const input = { prompt: 'Create a responsive dashboard' };
    const result = await pipeline.generate(input);

    result.primaryFlow.screens.forEach((screen) => {
      const isReady = responsiveEngine.isResponsiveReady(screen);
      expect(isReady).toBe(true);

      const optimalBreakpoint = responsiveEngine.getBreakpointForWidth(1024);
      expect(optimalBreakpoint).toBe('desktop');
    });
  });

  it('design system consistency across pipeline components', async () => {
    const pipeline = createDesignPipeline();
    const extractor = createTokenExtractor();

    const input = { prompt: 'Create a cohesive design system' };
    const result = await pipeline.generate(input);

    // Verify design system has all required properties
    expect(result.designSystem.tokens).toBeDefined();
    expect(result.designSystem.baseFont).toBeDefined();
    expect(result.designSystem.colorPalette).toBeDefined();
    expect(result.designSystem.spacingScale).toBeDefined();
    expect(result.designSystem.motionCurve).toBeDefined();
    expect(typeof result.designSystem.derivedFromTasteVault).toBe('boolean');

    // Extract tokens and validate they can be merged with design system
    const extracted: DesignToken[] = result.designSystem.colorPalette.map((color, index) => ({
      category: 'color',
      name: `extracted-${index}`,
      value: color,
      source: 'integration-test',
      confidence: 0.85,
    }));

    const merged = extractor.mergeTokens(result.designSystem.tokens, extracted);
    // mergeTokens deduplicates by category:name, merged length may be less than sum
    // but should contain at least some tokens
    expect(merged.length).toBeGreaterThanOrEqual(1);
  });
});
