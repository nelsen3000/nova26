// Token Extractor — R20-03
// Extract design tokens from screenshots and existing designs

import type { DesignToken, ScreenshotAnalysis } from './types.js';

export interface TokenExtractionConfig {
  minConfidence: number;
  extractColors: boolean;
  extractTypography: boolean;
  extractSpacing: boolean;
}

export const DEFAULT_EXTRACTION_CONFIG: TokenExtractionConfig = {
  minConfidence: 0.7,
  extractColors: true,
  extractTypography: true,
  extractSpacing: true,
};

export class TokenExtractor {
  private config: TokenExtractionConfig;

  constructor(config: Partial<TokenExtractionConfig> = {}) {
    this.config = { ...DEFAULT_EXTRACTION_CONFIG, ...config };
  }

  /**
   * Extract tokens from a screenshot analysis
   */
  extractFromScreenshot(analysis: ScreenshotAnalysis): DesignToken[] {
    const tokens: DesignToken[] = [];

    if (this.config.extractColors) {
      tokens.push(...this.extractColorTokens(analysis.colorPalette));
    }

    if (this.config.extractTypography) {
      tokens.push(...this.extractTypographyTokens(analysis.typography));
    }

    return tokens.filter(t => t.confidence >= this.config.minConfidence);
  }

  /**
   * Extract color tokens from palette
   */
  private extractColorTokens(palette: string[]): DesignToken[] {
    const tokens: DesignToken[] = [];
    const semanticNames = ['primary', 'secondary', 'background', 'text', 'accent', 'error', 'success', 'warning'];

    for (let i = 0; i < Math.min(palette.length, semanticNames.length); i++) {
      tokens.push({
        category: 'color',
        name: semanticNames[i],
        value: palette[i],
        source: 'screenshot-analysis',
        confidence: 0.8 - (i * 0.05),
      });
    }

    return tokens;
  }

  /**
   * Extract typography tokens
   */
  private extractTypographyTokens(typography: { fonts: string[]; sizes: number[] }): DesignToken[] {
    const tokens: DesignToken[] = [];

    if (typography.fonts.length > 0) {
      tokens.push({
        category: 'typography',
        name: 'font-family',
        value: typography.fonts[0],
        source: 'screenshot-analysis',
        confidence: 0.85,
      });
    }

    const sizeNames = ['xs', 'sm', 'base', 'lg', 'xl', '2xl'];
    const sortedSizes = [...typography.sizes].sort((a, b) => a - b);

    for (let i = 0; i < Math.min(sortedSizes.length, sizeNames.length); i++) {
      tokens.push({
        category: 'typography',
        name: `text-${sizeNames[i]}`,
        value: `${sortedSizes[i]}px`,
        source: 'screenshot-analysis',
        confidence: 0.75,
      });
    }

    return tokens;
  }

  /**
   * Merge tokens with existing set
   */
  mergeTokens(existing: DesignToken[], newTokens: DesignToken[]): DesignToken[] {
    const merged = new Map<string, DesignToken>();

    // Add existing tokens
    for (const token of existing) {
      merged.set(`${token.category}:${token.name}`, token);
    }

    // Add or update with new tokens (higher confidence wins)
    for (const token of newTokens) {
      const key = `${token.category}:${token.name}`;
      const existing = merged.get(key);
      
      if (!existing || token.confidence > existing.confidence) {
        merged.set(key, token);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Validate token consistency
   */
  validateTokens(tokens: DesignToken[]): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const byCategory = new Map<string, DesignToken[]>();

    // Group by category
    for (const token of tokens) {
      const list = byCategory.get(token.category) ?? [];
      list.push(token);
      byCategory.set(token.category, list);
    }

    // Check for minimum tokens per category
    const requiredCategories = ['color', 'typography'];
    for (const cat of requiredCategories) {
      const list = byCategory.get(cat) ?? [];
      if (list.length === 0) {
        issues.push(`Missing ${cat} tokens`);
      }
    }

    // Check for duplicate names
    const names = new Set<string>();
    for (const token of tokens) {
      const key = `${token.category}:${token.name}`;
      if (names.has(key)) {
        issues.push(`Duplicate token: ${key}`);
      }
      names.add(key);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

export function createTokenExtractor(
  config?: Partial<TokenExtractionConfig>
): TokenExtractor {
  return new TokenExtractor(config);
}
