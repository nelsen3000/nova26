// Responsive Engine — R20-03
// Generate responsive variants for screens

import type { ScreenSpec, ResponsiveOutput } from './types.js';

export interface ResponsiveConfig {
  breakpoints: ('mobile' | 'tablet' | 'desktop')[];
  fluidTypography: boolean;
  maintainAspectRatios: boolean;
}

export const DEFAULT_RESPONSIVE_CONFIG: ResponsiveConfig = {
  breakpoints: ['mobile', 'tablet', 'desktop'],
  fluidTypography: true,
  maintainAspectRatios: true,
};

export class ResponsiveEngine {
  private config: ResponsiveConfig;

  constructor(config: Partial<ResponsiveConfig> = {}) {
    this.config = { ...DEFAULT_RESPONSIVE_CONFIG, ...config };
  }

  /**
   * Generate responsive variants for a screen
   */
  generateResponsiveVariants(screen: ScreenSpec): ResponsiveOutput {
    const output: ResponsiveOutput = {
      screenId: screen.id,
      breakpoints: {
        mobile: this.adaptForMobile(screen),
      },
    };

    if (this.config.breakpoints.includes('tablet')) {
      output.breakpoints.tablet = this.adaptForTablet(screen);
    }

    if (this.config.breakpoints.includes('desktop')) {
      output.breakpoints.desktop = this.adaptForDesktop(screen);
    }

    return output;
  }

  /**
   * Adapt screen for mobile (375px base)
   */
  private adaptForMobile(screen: ScreenSpec): ScreenSpec {
    return {
      ...screen,
      components: screen.components.map(comp => ({
        ...comp,
        position: this.scalePosition(comp.position, 0.5),
      })),
      responsiveBreakpoints: {
        mobile: { width: 375, columns: 4, spacing: '16px' },
      },
    };
  }

  /**
   * Adapt screen for tablet (768px base)
   */
  private adaptForTablet(screen: ScreenSpec): ScreenSpec {
    return {
      ...screen,
      layout: screen.layout === 'stack' ? 'grid' : screen.layout,
      components: screen.components.map(comp => ({
        ...comp,
        position: this.scalePosition(comp.position, 0.8),
      })),
      responsiveBreakpoints: {
        tablet: { width: 768, columns: 8, spacing: '24px' },
      },
    };
  }

  /**
   * Adapt screen for desktop (1440px base)
   */
  private adaptForDesktop(screen: ScreenSpec): ScreenSpec {
    return {
      ...screen,
      layout: 'grid',
      components: screen.components.map(comp => ({
        ...comp,
        position: this.scalePosition(comp.position, 1.2),
      })),
      responsiveBreakpoints: {
        desktop: { width: 1440, columns: 12, spacing: '32px' },
      },
    };
  }

  /**
   * Scale component position for different breakpoints
   */
  private scalePosition(
    position: ScreenSpec['components'][0]['position'],
    scale: number
  ): ScreenSpec['components'][0]['position'] {
    return {
      x: Math.round(position.x * scale),
      y: Math.round(position.y * scale),
      width: Math.round(position.width * scale),
      height: Math.round(position.height * scale),
    };
  }

  /**
   * Generate CSS media queries for breakpoints
   */
  generateMediaQueries(breakpoints: ResponsiveOutput['breakpoints']): string {
    const queries: string[] = [];

    if (breakpoints.mobile) {
      queries.push(`@media (max-width: 767px) { /* Mobile styles */ }`);
    }
    if (breakpoints.tablet) {
      queries.push(`@media (min-width: 768px) and (max-width: 1023px) { /* Tablet styles */ }`);
    }
    if (breakpoints.desktop) {
      queries.push(`@media (min-width: 1024px) { /* Desktop styles */ }`);
    }

    return queries.join('\n');
  }

  /**
   * Check if a screen is responsive-ready
   */
  isResponsiveReady(screen: ScreenSpec): boolean {
    return (
      screen.responsiveBreakpoints.mobile !== undefined ||
      screen.responsiveBreakpoints.tablet !== undefined ||
      screen.responsiveBreakpoints.desktop !== undefined
    );
  }

  /**
   * Get optimal breakpoint for a given width
   */
  getBreakpointForWidth(width: number): keyof ResponsiveOutput['breakpoints'] {
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}

export function createResponsiveEngine(
  config?: Partial<ResponsiveConfig>
): ResponsiveEngine {
  return new ResponsiveEngine(config);
}
