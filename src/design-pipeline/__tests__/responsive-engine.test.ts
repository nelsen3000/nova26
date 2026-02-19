// Responsive Engine Tests — R20-03
// Focused vitest tests for responsive-engine.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResponsiveEngine,
  createResponsiveEngine,
  DEFAULT_RESPONSIVE_CONFIG,
  type ResponsiveConfig,
} from '../responsive-engine.js';
import type { ScreenSpec, ResponsiveOutput } from '../types.js';

describe('ResponsiveEngine', () => {
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

  describe('generateResponsiveVariants()', () => {
    it('creates mobile variant', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.mobile).toBeDefined();
      expect(result.screenId).toBe('test-screen');
    });

    it('creates tablet when configured', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.tablet).toBeDefined();
    });

    it('creates desktop when configured', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.desktop).toBeDefined();
    });

    it('scales component positions', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      const mobileComp = result.breakpoints.mobile.components[0];
      const tabletComp = result.breakpoints.tablet!.components[0];
      const desktopComp = result.breakpoints.desktop!.components[0];

      // Mobile scales by 0.5 (comp-1: x=100, y=100, width=200, height=50)
      expect(mobileComp.position.x).toBe(50);   // 100 * 0.5
      expect(mobileComp.position.y).toBe(50);   // 100 * 0.5
      expect(mobileComp.position.width).toBe(100);  // 200 * 0.5
      expect(mobileComp.position.height).toBe(25);  // 50 * 0.5

      // Tablet scales by 0.8 (comp-1: x=100, y=100, width=200, height=50)
      expect(tabletComp.position.x).toBe(80);   // 100 * 0.8
      expect(tabletComp.position.y).toBe(80);   // 100 * 0.8
      expect(tabletComp.position.width).toBe(160);  // 200 * 0.8
      expect(tabletComp.position.height).toBe(40);  // 50 * 0.8

      // Desktop scales by 1.2 (comp-1: x=100, y=100, width=200, height=50)
      expect(desktopComp.position.x).toBe(120);  // 100 * 1.2
      expect(desktopComp.position.y).toBe(120);  // 100 * 1.2
      expect(desktopComp.position.width).toBe(240);  // 200 * 1.2
      expect(desktopComp.position.height).toBe(60);  // 50 * 1.2
    });

    it('adapts layout for tablet (stack→grid)', () => {
      const stackScreen: ScreenSpec = {
        ...mockScreen,
        layout: 'stack',
      };

      const result = engine.generateResponsiveVariants(stackScreen);

      expect(result.breakpoints.tablet!.layout).toBe('grid');
    });

    it('adapts layout for desktop', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.desktop!.layout).toBe('grid');
    });
  });

  describe('adaptForMobile()', () => {
    it('sets correct width (375)', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.mobile.responsiveBreakpoints.mobile).toEqual({
        width: 375,
        columns: 4,
        spacing: '16px',
      });
    });

    it('sets 4 columns', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.mobile.responsiveBreakpoints.mobile?.columns).toBe(4);
    });

    it('scales positions by 0.5', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      const mobileComp = result.breakpoints.mobile.components[0];
      expect(mobileComp.position.x).toBe(50); // 100 * 0.5
      expect(mobileComp.position.y).toBe(50); // 100 * 0.5
      expect(mobileComp.position.width).toBe(100); // 200 * 0.5
      expect(mobileComp.position.height).toBe(25); // 50 * 0.5
    });
  });

  describe('adaptForTablet()', () => {
    it('sets correct width (768)', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.tablet!.responsiveBreakpoints.tablet).toEqual({
        width: 768,
        columns: 8,
        spacing: '24px',
      });
    });

    it('sets 8 columns', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.tablet!.responsiveBreakpoints.tablet?.columns).toBe(8);
    });

    it('converts stack to grid', () => {
      const stackScreen: ScreenSpec = {
        ...mockScreen,
        layout: 'stack',
      };

      const result = engine.generateResponsiveVariants(stackScreen);

      expect(result.breakpoints.tablet!.layout).toBe('grid');
    });
  });

  describe('adaptForDesktop()', () => {
    it('sets correct width (1440)', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.desktop!.responsiveBreakpoints.desktop).toEqual({
        width: 1440,
        columns: 12,
        spacing: '32px',
      });
    });

    it('sets 12 columns', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.desktop!.responsiveBreakpoints.desktop?.columns).toBe(12);
    });

    it('uses grid layout', () => {
      const result = engine.generateResponsiveVariants(mockScreen);

      expect(result.breakpoints.desktop!.layout).toBe('grid');
    });
  });

  describe('generateMediaQueries()', () => {
    it('includes mobile query', () => {
      const variants = engine.generateResponsiveVariants(mockScreen);
      const css = engine.generateMediaQueries(variants.breakpoints);

      expect(css).toContain('@media (max-width: 767px)');
      expect(css).toContain('Mobile styles');
    });

    it('includes tablet query', () => {
      const variants = engine.generateResponsiveVariants(mockScreen);
      const css = engine.generateMediaQueries(variants.breakpoints);

      expect(css).toContain('@media (min-width: 768px) and (max-width: 1023px)');
      expect(css).toContain('Tablet styles');
    });

    it('includes desktop query', () => {
      const variants = engine.generateResponsiveVariants(mockScreen);
      const css = engine.generateMediaQueries(variants.breakpoints);

      expect(css).toContain('@media (min-width: 1024px)');
      expect(css).toContain('Desktop styles');
    });
  });

  describe('Utility methods', () => {
    it('isResponsiveReady returns true with breakpoints', () => {
      const ready = engine.isResponsiveReady(mockScreen);

      expect(ready).toBe(true);
    });

    it('isResponsiveReady returns false without breakpoints', () => {
      const noBreakpointsScreen: ScreenSpec = {
        ...mockScreen,
        responsiveBreakpoints: {},
      };

      const ready = engine.isResponsiveReady(noBreakpointsScreen);

      expect(ready).toBe(false);
    });

    it('getBreakpointForWidth returns mobile for small width', () => {
      expect(engine.getBreakpointForWidth(375)).toBe('mobile');
      expect(engine.getBreakpointForWidth(767)).toBe('mobile');
      expect(engine.getBreakpointForWidth(0)).toBe('mobile');
    });

    it('getBreakpointForWidth returns tablet for medium width', () => {
      expect(engine.getBreakpointForWidth(768)).toBe('tablet');
      expect(engine.getBreakpointForWidth(800)).toBe('tablet');
      expect(engine.getBreakpointForWidth(1023)).toBe('tablet');
    });

    it('getBreakpointForWidth returns desktop for large width', () => {
      expect(engine.getBreakpointForWidth(1024)).toBe('desktop');
      expect(engine.getBreakpointForWidth(1440)).toBe('desktop');
      expect(engine.getBreakpointForWidth(1920)).toBe('desktop');
    });
  });
});

describe('DEFAULT_RESPONSIVE_CONFIG', () => {
  it('has all default breakpoints', () => {
    expect(DEFAULT_RESPONSIVE_CONFIG.breakpoints).toContain('mobile');
    expect(DEFAULT_RESPONSIVE_CONFIG.breakpoints).toContain('tablet');
    expect(DEFAULT_RESPONSIVE_CONFIG.breakpoints).toContain('desktop');
  });

  it('has fluidTypography enabled by default', () => {
    expect(DEFAULT_RESPONSIVE_CONFIG.fluidTypography).toBe(true);
  });

  it('has maintainAspectRatios enabled by default', () => {
    expect(DEFAULT_RESPONSIVE_CONFIG.maintainAspectRatios).toBe(true);
  });
});

describe('createResponsiveEngine', () => {
  it('creates engine with default config', () => {
    const defaultEngine = createResponsiveEngine();

    expect(defaultEngine).toBeInstanceOf(ResponsiveEngine);
  });

  it('creates engine with custom config', () => {
    const customConfig: Partial<ResponsiveConfig> = {
      breakpoints: ['mobile'],
      fluidTypography: false,
    };
    const customEngine = createResponsiveEngine(customConfig);

    expect(customEngine).toBeInstanceOf(ResponsiveEngine);
  });
});
