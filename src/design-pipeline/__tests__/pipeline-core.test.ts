import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DesignPipeline, createDesignPipeline } from '../pipeline-core.js';
import { DEFAULT_DESIGN_PIPELINE_CONFIG, JOURNEY_TEMPLATES } from '../types.js';
import type { PipelineInput, PipelineOutput } from '../pipeline-core.js';
import type { DesignFlow, DesignPipelineConfig } from '../types.js';

describe('DesignPipeline', () => {
  let pipeline: DesignPipeline;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
    pipeline = new DesignPipeline();
  });

  describe('generate()', () => {
    it('should return a PipelineOutput with all required fields', async () => {
      const input: PipelineInput = { prompt: 'Create a login page' };
      
      const result = await pipeline.generate(input);
      
      expect(result).toHaveProperty('primaryFlow');
      expect(result).toHaveProperty('variants');
      expect(result).toHaveProperty('designSystem');
      expect(result).toHaveProperty('generationTimeMs');
      expect(result).toHaveProperty('tokenUsage');
    });

    it('should return primaryFlow as a DesignFlow', async () => {
      const input: PipelineInput = { prompt: 'Dashboard design' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow).toHaveProperty('id');
      expect(result.primaryFlow).toHaveProperty('name');
      expect(result.primaryFlow).toHaveProperty('screens');
      expect(result.primaryFlow).toHaveProperty('connections');
      expect(result.primaryFlow).toHaveProperty('journeyType');
    });

    it('should generate correct number of variants based on config', async () => {
      const config: Partial<DesignPipelineConfig> = { defaultVariants: 2 };
      const customPipeline = new DesignPipeline(config);
      const input: PipelineInput = { prompt: 'Login page' };
      
      const result = await customPipeline.generate(input);
      
      // defaultVariants: 2 means 1 variant (defaultVariants - 1)
      expect(result.variants).toHaveLength(1);
    });

    it('should generate 3 variants when defaultVariants is 4', async () => {
      const config: Partial<DesignPipelineConfig> = { defaultVariants: 4 };
      const customPipeline = new DesignPipeline(config);
      const input: PipelineInput = { prompt: 'Signup flow' };
      
      const result = await customPipeline.generate(input);
      
      expect(result.variants).toHaveLength(3);
    });

    it('should record generationTimeMs as a non-negative number', async () => {
      const input: PipelineInput = { prompt: 'Landing page' };
      
      const result = await pipeline.generate(input);
      
      expect(typeof result.generationTimeMs).toBe('number');
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should record accurate generationTimeMs based on elapsed time', async () => {
      const input: PipelineInput = { prompt: 'Test timing' };
      
      const startTime = Date.now();
      const result = await pipeline.generate(input);
      const endTime = Date.now();
      
      expect(result.generationTimeMs).toBe(endTime - startTime);
    });

    it('should estimate tokenUsage as a positive number', async () => {
      const input: PipelineInput = { prompt: 'Dashboard with charts' };
      
      const result = await pipeline.generate(input);
      
      expect(typeof result.tokenUsage).toBe('number');
      expect(result.tokenUsage).toBeGreaterThan(0);
    });

    it('should create designSystem with required properties', async () => {
      const input: PipelineInput = { prompt: 'Modern dashboard' };
      
      const result = await pipeline.generate(input);
      
      expect(result.designSystem).toHaveProperty('tokens');
      expect(result.designSystem).toHaveProperty('baseFont');
      expect(result.designSystem).toHaveProperty('colorPalette');
      expect(result.designSystem).toHaveProperty('spacingScale');
      expect(result.designSystem).toHaveProperty('motionCurve');
      expect(result.designSystem).toHaveProperty('derivedFromTasteVault');
    });

    it('should handle auth journeyType', async () => {
      const input: PipelineInput = { 
        prompt: 'Create auth flow',
        journeyType: 'auth'
      };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('auth');
    });

    it('should handle onboarding journeyType', async () => {
      const input: PipelineInput = { 
        prompt: 'User onboarding',
        journeyType: 'onboarding'
      };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('onboarding');
    });

    it('should handle core journeyType', async () => {
      const input: PipelineInput = { 
        prompt: 'Main application',
        journeyType: 'core'
      };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('core');
    });

    it('should handle custom journeyType', async () => {
      const input: PipelineInput = { 
        prompt: 'Special feature',
        journeyType: 'custom'
      };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('custom');
    });

    it('should respect maxTokensPerGeneration config', async () => {
      const config: Partial<DesignPipelineConfig> = { maxTokensPerGeneration: 2000 };
      const customPipeline = new DesignPipeline(config);
      const input: PipelineInput = { prompt: 'Complex multi-screen app' };
      
      const result = await customPipeline.generate(input);
      
      expect(result.tokenUsage).toBeLessThanOrEqual(2000);
    });
  });

  describe('selectTemplate()', () => {
    it('should select auth-login template for login keyword', async () => {
      const input: PipelineInput = { prompt: 'Create a login page' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('auth');
      expect(result.primaryFlow.name).toBe('Authentication - Login');
    });

    it('should select auth-login template for sign in keyword', async () => {
      const input: PipelineInput = { prompt: 'Sign in page design' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('auth');
    });

    it('should select auth-signup template for signup keyword', async () => {
      const input: PipelineInput = { prompt: 'User signup flow' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('auth');
      expect(result.primaryFlow.name).toBe('Authentication - Signup');
    });

    it('should select auth-signup template for signup keyword variations', async () => {
      const input: PipelineInput = { prompt: 'Signup form' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('auth');
      expect(result.primaryFlow.name).toBe('Authentication - Signup');
    });

    it('should select onboarding template for onboard keyword', async () => {
      const input: PipelineInput = { prompt: 'New user onboarding' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('onboarding');
      expect(result.primaryFlow.name).toBe('Onboarding - Welcome');
    });

    it('should select onboarding template for tutorial keyword', async () => {
      const input: PipelineInput = { prompt: 'First-time tutorial' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('onboarding');
    });

    it('should select core-dashboard template for dashboard keyword', async () => {
      const input: PipelineInput = { prompt: 'Admin dashboard' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('core');
      expect(result.primaryFlow.name).toBe('Core - Dashboard');
    });

    it('should select core-dashboard template for home keyword', async () => {
      const input: PipelineInput = { prompt: 'Home page with widgets' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('core');
    });

    it('should select launch-landing template for landing keyword', async () => {
      const input: PipelineInput = { prompt: 'Product landing page' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('launch');
      expect(result.primaryFlow.name).toBe('Launch - Landing Page');
    });

    it('should select launch-landing template for marketing keyword', async () => {
      const input: PipelineInput = { prompt: 'Marketing campaign page' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('launch');
    });

    it('should return custom template for unknown keywords', async () => {
      const input: PipelineInput = { prompt: 'Something completely different' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('custom');
      expect(result.primaryFlow.name).toBe('Custom Journey');
    });

    it('should prioritize explicit journeyType over prompt keywords', async () => {
      const input: PipelineInput = { 
        prompt: 'Login page', // Would normally select auth
        journeyType: 'onboarding' // But explicit type takes precedence
      };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('onboarding');
    });

    it('should use explicit journeyType when provided without keywords', async () => {
      const input: PipelineInput = { 
        prompt: 'My custom thing',
        journeyType: 'core'
      };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('core');
      expect(result.primaryFlow.name).toBe('Core - Dashboard');
    });
  });

  describe('generateFlow()', () => {
    it('should create DesignFlow with screens array', async () => {
      const input: PipelineInput = { prompt: 'Login page' };
      
      const result = await pipeline.generate(input);
      
      expect(Array.isArray(result.primaryFlow.screens)).toBe(true);
      expect(result.primaryFlow.screens.length).toBeGreaterThan(0);
    });

    it('should generate correct number of screens based on template limits', async () => {
      const input: PipelineInput = { prompt: 'Login page' }; // auth-login: max 3 screens
      
      const result = await pipeline.generate(input);
      
      // Should be min(3, max(1, 3)) = 3, but capped at template.maxScreens
      expect(result.primaryFlow.screens.length).toBeLessThanOrEqual(3);
      expect(result.primaryFlow.screens.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate screens for onboarding with more screens', async () => {
      const input: PipelineInput = { prompt: 'User onboarding tutorial' };
      
      const result = await pipeline.generate(input);
      
      // onboarding-welcome: min 3, max 5 screens
      expect(result.primaryFlow.screens.length).toBeGreaterThanOrEqual(3);
    });

    it('should create connections between screens', async () => {
      const input: PipelineInput = { prompt: 'Multi-step form' };
      
      const result = await pipeline.generate(input);
      
      expect(Array.isArray(result.primaryFlow.connections)).toBe(true);
      
      // If there are N screens, there should be N-1 connections
      const expectedConnections = Math.max(0, result.primaryFlow.screens.length - 1);
      expect(result.primaryFlow.connections.length).toBe(expectedConnections);
    });

    it('should assign correct journeyType to flow', async () => {
      const input: PipelineInput = { prompt: 'Dashboard' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.journeyType).toBe('core');
    });

    it('should generate components for each screen', async () => {
      const input: PipelineInput = { prompt: 'Login page' };
      
      const result = await pipeline.generate(input);
      
      for (const screen of result.primaryFlow.screens) {
        expect(Array.isArray(screen.components)).toBe(true);
      }
    });

    it('should set flow description from prompt', async () => {
      const input: PipelineInput = { prompt: 'My awesome login page' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.description).toBe('My awesome login page');
    });

    it('should generate flow with unique id containing timestamp', async () => {
      const input: PipelineInput = { prompt: 'Test flow' };
      
      const result = await pipeline.generate(input);
      
      expect(result.primaryFlow.id).toContain('flow-');
      expect(result.primaryFlow.id).toContain('1705312800000'); // Mocked timestamp
    });
  });

  describe('generateVariants()', () => {
    it('should create correct number of variants', async () => {
      const config: Partial<DesignPipelineConfig> = { defaultVariants: 3 };
      const customPipeline = new DesignPipeline(config);
      const input: PipelineInput = { prompt: 'Login page' };
      
      const result = await customPipeline.generate(input);
      
      // defaultVariants: 3 means 2 variants
      expect(result.variants).toHaveLength(2);
    });

    it('should create zero variants when defaultVariants is 1', async () => {
      const config: Partial<DesignPipelineConfig> = { defaultVariants: 1 };
      const customPipeline = new DesignPipeline(config);
      const input: PipelineInput = { prompt: 'Single design' };
      
      const result = await customPipeline.generate(input);
      
      expect(result.variants).toHaveLength(0);
    });

    it('should set variantParentId referencing parent flow', async () => {
      const input: PipelineInput = { prompt: 'Login with variants' };
      
      const result = await pipeline.generate(input);
      
      for (const variant of result.variants) {
        expect(variant.variantParentId).toBe(result.primaryFlow.id);
      }
    });

    it('should give each variant a unique id', async () => {
      const config: Partial<DesignPipelineConfig> = { defaultVariants: 5 };
      const customPipeline = new DesignPipeline(config);
      const input: PipelineInput = { prompt: 'Many variants' };
      
      const result = await customPipeline.generate(input);
      
      const ids = result.variants.map(v => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include variant index in variant name', async () => {
      const input: PipelineInput = { prompt: 'Named variants' };
      
      const result = await pipeline.generate(input);
      
      for (let i = 0; i < result.variants.length; i++) {
        expect(result.variants[i].name).toContain(`Variant ${i + 1}`);
      }
    });

    it('should preserve screen structure in variants', async () => {
      const input: PipelineInput = { prompt: 'Login page' };
      
      const result = await pipeline.generate(input);
      
      for (const variant of result.variants) {
        expect(variant.screens).toHaveLength(result.primaryFlow.screens.length);
      }
    });

    it('should apply layout variations to variant screens', async () => {
      const input: PipelineInput = { prompt: 'Styled login' };
      
      const result = await pipeline.generate(input);
      
      // Variants should have modified component props
      for (const variant of result.variants) {
        for (const screen of variant.screens) {
          for (const component of screen.components) {
            expect(component.props).toHaveProperty('variant');
            expect(['minimal', 'bold', 'friendly', 'premium']).toContain(component.props.variant);
          }
        }
      }
    });

    it('should generate unique screen ids for each variant', async () => {
      const input: PipelineInput = { prompt: 'Variant screens' };
      
      const result = await pipeline.generate(input);
      
      const primaryScreenIds = result.primaryFlow.screens.map(s => s.id);
      
      for (const variant of result.variants) {
        for (const screen of variant.screens) {
          // Variant screen ids should differ from primary
          expect(primaryScreenIds).not.toContain(screen.id);
          // Should contain variant suffix
          expect(screen.id).toMatch(/-v\d+$/);
        }
      }
    });

    it('should preserve connections in variants', async () => {
      const input: PipelineInput = { prompt: 'Connected screens' };
      
      const result = await pipeline.generate(input);
      
      for (const variant of result.variants) {
        expect(variant.connections).toHaveLength(result.primaryFlow.connections.length);
      }
    });

    it('should maintain journeyType in variants', async () => {
      const input: PipelineInput = { prompt: 'Dashboard', journeyType: 'core' };
      
      const result = await pipeline.generate(input);
      
      for (const variant of result.variants) {
        expect(variant.journeyType).toBe('core');
      }
    });
  });

  describe('createDesignPipeline factory', () => {
    it('should create a DesignPipeline instance', () => {
      const pipeline = createDesignPipeline();
      
      expect(pipeline).toBeInstanceOf(DesignPipeline);
    });

    it('should pass config to DesignPipeline', async () => {
      const config: Partial<DesignPipelineConfig> = { 
        defaultVariants: 2,
        maxScreensPerJourney: 5 
      };
      const pipeline = createDesignPipeline(config);
      const input: PipelineInput = { prompt: 'Test' };
      
      const result = await pipeline.generate(input);
      
      expect(result.variants).toHaveLength(1); // defaultVariants: 2 means 1 variant
    });

    it('should use default config when no config provided', async () => {
      const pipeline = createDesignPipeline();
      const input: PipelineInput = { prompt: 'Test defaults' };
      
      const result = await pipeline.generate(input);
      
      // DEFAULT_DESIGN_PIPELINE_CONFIG has defaultVariants: 3
      expect(result.variants).toHaveLength(2);
    });
  });

  describe('designSystem extraction', () => {
    it('should extract colors from screen tokens', async () => {
      const input: PipelineInput = { prompt: 'Colorful dashboard' };
      
      const result = await pipeline.generate(input);
      
      expect(Array.isArray(result.designSystem.colorPalette)).toBe(true);
      expect(result.designSystem.colorPalette.length).toBeGreaterThan(0);
    });

    it('should include both light and dark values for semantic colors', async () => {
      const input: PipelineInput = { prompt: 'Themed app' };
      
      const result = await pipeline.generate(input);
      
      // Background color with light/dark should be in palette
      const hasSemanticColor = result.designSystem.colorPalette.some(
        color => color === '#FFFFFF' || color === '#000000'
      );
      expect(hasSemanticColor).toBe(true);
    });

    it('should set derivedFromTasteVault based on config', async () => {
      const highInfluenceConfig: Partial<DesignPipelineConfig> = { 
        tasteVaultInfluence: 0.8 
      };
      const highPipeline = new DesignPipeline(highInfluenceConfig);
      
      const lowInfluenceConfig: Partial<DesignPipelineConfig> = { 
        tasteVaultInfluence: 0.3 
      };
      const lowPipeline = new DesignPipeline(lowInfluenceConfig);
      
      const input: PipelineInput = { prompt: 'Test vault' };
      
      const highResult = await highPipeline.generate(input);
      const lowResult = await lowPipeline.generate(input);
      
      expect(highResult.designSystem.derivedFromTasteVault).toBe(true);
      expect(lowResult.designSystem.derivedFromTasteVault).toBe(false);
    });

    it('should extract typography from screen tokens', async () => {
      const input: PipelineInput = { prompt: 'Typography focused' };
      
      const result = await pipeline.generate(input);
      
      expect(typeof result.designSystem.baseFont).toBe('string');
      expect(result.designSystem.baseFont.length).toBeGreaterThan(0);
    });

    it('should include spacing scale in design system', async () => {
      const input: PipelineInput = { prompt: 'Spaced layout' };
      
      const result = await pipeline.generate(input);
      
      expect(Array.isArray(result.designSystem.spacingScale)).toBe(true);
      expect(result.designSystem.spacingScale.length).toBeGreaterThan(0);
    });
  });

  describe('tokenUsage estimation', () => {
    it('should calculate higher token usage for more screens', async () => {
      const input: PipelineInput = { prompt: 'onboarding flow' }; // More screens
      
      const result = await pipeline.generate(input);
      
      // Onboarding has more screens than auth, so should use more tokens
      expect(result.tokenUsage).toBeGreaterThan(1000); // Base tokens
    });

    it('should factor in variant count for token estimation', async () => {
      const highVariantConfig: Partial<DesignPipelineConfig> = { defaultVariants: 5 };
      const highPipeline = new DesignPipeline(highVariantConfig);
      
      const lowVariantConfig: Partial<DesignPipelineConfig> = { defaultVariants: 2 };
      const lowPipeline = new DesignPipeline(lowVariantConfig);
      
      const input: PipelineInput = { prompt: 'Same prompt' };
      
      const highResult = await highPipeline.generate(input);
      const lowResult = await lowPipeline.generate(input);
      
      expect(highResult.tokenUsage).toBeGreaterThan(lowResult.tokenUsage);
    });
  });
});
