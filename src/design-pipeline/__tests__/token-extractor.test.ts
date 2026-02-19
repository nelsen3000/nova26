// Token Extractor Tests — R20-03
// Comprehensive test suite for TokenExtractor class

import { describe, it, expect } from 'vitest';
import { TokenExtractor, createTokenExtractor, DEFAULT_EXTRACTION_CONFIG } from '../token-extractor.js';
import type { ScreenshotAnalysis, DesignToken } from '../types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockAnalysis = (overrides?: Partial<ScreenshotAnalysis>): ScreenshotAnalysis => ({
  sourceImage: 'test-screenshot.png',
  detectedComponents: [],
  colorPalette: ['#1a1a1a', '#f5f5f5', '#3b82f6', '#ef4444', '#22c55e'],
  typography: {
    fonts: ['Inter', 'Roboto'],
    sizes: [12, 14, 16, 18, 24, 32],
  },
  layout: {
    type: 'stack',
    gridColumns: 1,
  },
  confidence: 0.9,
  ...overrides,
});

const createMockToken = (overrides?: Partial<DesignToken>): DesignToken => ({
  category: 'color',
  name: 'primary',
  value: '#3b82f6',
  source: 'test-source',
  confidence: 0.85,
  ...overrides,
});

// ============================================================================
// extractFromScreenshot() Tests
// ============================================================================

describe('extractFromScreenshot()', () => {
  it('should return an array of DesignToken objects', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis();

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
    tokens.forEach(token => {
      expect(token).toHaveProperty('category');
      expect(token).toHaveProperty('name');
      expect(token).toHaveProperty('value');
      expect(token).toHaveProperty('source');
      expect(token).toHaveProperty('confidence');
    });
  });

  it('should extract color tokens from color palette', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      colorPalette: ['#ff0000', '#00ff00', '#0000ff'],
    });

    const tokens = extractor.extractFromScreenshot(analysis);
    const colorTokens = tokens.filter(t => t.category === 'color');

    expect(colorTokens.length).toBeGreaterThan(0);
    expect(colorTokens[0]?.value).toBe('#ff0000');
  });

  it('should extract typography tokens from typography data', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      typography: {
        fonts: ['Inter'],
        sizes: [16, 24, 32],
      },
    });

    const tokens = extractor.extractFromScreenshot(analysis);
    const typographyTokens = tokens.filter(t => t.category === 'typography');

    expect(typographyTokens.length).toBeGreaterThan(0);
    expect(typographyTokens.some(t => t.name === 'font-family')).toBe(true);
  });

  it('should filter tokens by minConfidence', () => {
    const extractor = new TokenExtractor({ minConfidence: 0.8 });
    const analysis = createMockAnalysis({
      colorPalette: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'],
    });

    const tokens = extractor.extractFromScreenshot(analysis);

    tokens.forEach(token => {
      expect(token.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  it('should handle empty analysis gracefully', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      colorPalette: [],
      typography: { fonts: [], sizes: [] },
    });

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(tokens).toEqual([]);
  });

  it('should include source as screenshot-analysis for extracted tokens', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis();

    const tokens = extractor.extractFromScreenshot(analysis);

    tokens.forEach(token => {
      expect(token.source).toBe('screenshot-analysis');
    });
  });
});

// ============================================================================
// extractColorTokens() Tests (via public extractFromScreenshot)
// ============================================================================

describe('extractColorTokens()', () => {
  it('should map palette colors to semantic names in order', () => {
    const extractor = new TokenExtractor({ minConfidence: 0 }); // Disable filtering for this test
    const analysis = createMockAnalysis({
      typography: { fonts: [], sizes: [] },
      colorPalette: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'],
    });

    const tokens = extractor.extractFromScreenshot(analysis);
    const expectedNames = ['primary', 'secondary', 'background', 'text', 'accent', 'error', 'success', 'warning'];

    expect(tokens.length).toBe(8);
    tokens.forEach((token, index) => {
      expect(token.name).toBe(expectedNames[index]);
      expect(token.value).toBe(analysis.colorPalette[index]);
    });
  });

  it('should assign decreasing confidence for each subsequent color', () => {
    const extractor = new TokenExtractor({ minConfidence: 0 });
    const analysis = createMockAnalysis({
      typography: { fonts: [], sizes: [] },
      colorPalette: ['#aaa', '#bbb', '#ccc', '#ddd'],
    });

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(tokens[0]?.confidence).toBeCloseTo(0.8, 2);
    expect(tokens[1]?.confidence).toBeCloseTo(0.75, 2);
    expect(tokens[2]?.confidence).toBeCloseTo(0.7, 2);
    expect(tokens[3]?.confidence).toBeCloseTo(0.65, 2);
  });

  it('should handle partial palette with fewer colors than semantic names', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      typography: { fonts: [], sizes: [] },
      colorPalette: ['#ff0000', '#00ff00'],
    });

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(tokens.length).toBe(2);
    expect(tokens[0]?.name).toBe('primary');
    expect(tokens[1]?.name).toBe('secondary');
  });

  it('should return empty array for empty palette', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      typography: { fonts: [], sizes: [] },
      colorPalette: [],
    });

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(tokens).toEqual([]);
  });
});

// ============================================================================
// extractTypographyTokens() Tests (via public extractFromScreenshot)
// ============================================================================

describe('extractTypographyTokens()', () => {
  it('should extract font-family token from first font', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      colorPalette: [],
      typography: {
        fonts: ['Roboto', 'Arial'],
        sizes: [],
      },
    });

    const tokens = extractor.extractFromScreenshot(analysis);
    const fontToken = tokens.find(t => t.name === 'font-family');

    expect(fontToken).toBeDefined();
    expect(fontToken?.value).toBe('Roboto');
    expect(fontToken?.confidence).toBe(0.85);
  });

  it('should extract size tokens with correct names', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      colorPalette: [],
      typography: {
        fonts: [],
        sizes: [12, 14, 16, 18, 20, 24],
      },
    });

    const tokens = extractor.extractFromScreenshot(analysis);
    const sizeNames = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];

    sizeNames.forEach((name, index) => {
      const token = tokens.find(t => t.name === name);
      expect(token).toBeDefined();
      expect(token?.value).toBe(`${[12, 14, 16, 18, 20, 24][index]}px`);
    });
  });

  it('should sort sizes in ascending order', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      colorPalette: [],
      typography: {
        fonts: [],
        sizes: [32, 12, 24, 16],
      },
    });

    const tokens = extractor.extractFromScreenshot(analysis);
    const sizeTokens = tokens.filter(t => t.name.startsWith('text-'));

    expect(sizeTokens[0]?.value).toBe('12px');
    expect(sizeTokens[1]?.value).toBe('16px');
    expect(sizeTokens[2]?.value).toBe('24px');
    expect(sizeTokens[3]?.value).toBe('32px');
  });

  it('should limit size tokens to length of sizeNames array', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      colorPalette: [],
      typography: {
        fonts: [],
        sizes: [10, 12, 14, 16, 18, 20, 22, 24, 26, 28],
      },
    });

    const tokens = extractor.extractFromScreenshot(analysis);
    const sizeTokens = tokens.filter(t => t.name.startsWith('text-'));

    expect(sizeTokens.length).toBe(6);
  });
});

// ============================================================================
// mergeTokens() Tests
// ============================================================================

describe('mergeTokens()', () => {
  it('should combine existing and new tokens', () => {
    const extractor = new TokenExtractor();
    const existing: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary', value: '#blue' }),
    ];
    const newTokens: DesignToken[] = [
      createMockToken({ category: 'color', name: 'secondary', value: '#green' }),
    ];

    const merged = extractor.mergeTokens(existing, newTokens);

    expect(merged.length).toBe(2);
    expect(merged.some(t => t.name === 'primary')).toBe(true);
    expect(merged.some(t => t.name === 'secondary')).toBe(true);
  });

  it('should keep token with higher confidence when duplicates exist', () => {
    const extractor = new TokenExtractor();
    const existing: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary', value: '#old', confidence: 0.7 }),
    ];
    const newTokens: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary', value: '#new', confidence: 0.9 }),
    ];

    const merged = extractor.mergeTokens(existing, newTokens);

    expect(merged.length).toBe(1);
    expect(merged[0]?.value).toBe('#new');
    expect(merged[0]?.confidence).toBe(0.9);
  });

  it('should not replace existing token if new token has lower confidence', () => {
    const extractor = new TokenExtractor();
    const existing: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary', value: '#existing', confidence: 0.9 }),
    ];
    const newTokens: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary', value: '#lower', confidence: 0.5 }),
    ];

    const merged = extractor.mergeTokens(existing, newTokens);

    expect(merged.length).toBe(1);
    expect(merged[0]?.value).toBe('#existing');
    expect(merged[0]?.confidence).toBe(0.9);
  });

  it('should preserve non-conflicting tokens from both sources', () => {
    const extractor = new TokenExtractor();
    const existing: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary', value: '#blue' }),
      createMockToken({ category: 'typography', name: 'font-family', value: 'Inter' }),
    ];
    const newTokens: DesignToken[] = [
      createMockToken({ category: 'color', name: 'secondary', value: '#green' }),
      createMockToken({ category: 'spacing', name: 'sm', value: '8px' }),
    ];

    const merged = extractor.mergeTokens(existing, newTokens);

    expect(merged.length).toBe(4);
    expect(merged.some(t => t.category === 'color' && t.name === 'primary')).toBe(true);
    expect(merged.some(t => t.category === 'typography' && t.name === 'font-family')).toBe(true);
    expect(merged.some(t => t.category === 'color' && t.name === 'secondary')).toBe(true);
    expect(merged.some(t => t.category === 'spacing' && t.name === 'sm')).toBe(true);
  });
});

// ============================================================================
// validateTokens() Tests
// ============================================================================

describe('validateTokens()', () => {
  it('should return valid when tokens have both color and typography categories', () => {
    const extractor = new TokenExtractor();
    const tokens: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary' }),
      createMockToken({ category: 'typography', name: 'font-family' }),
    ];

    const result = extractor.validateTokens(tokens);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('should return invalid when missing color tokens', () => {
    const extractor = new TokenExtractor();
    const tokens: DesignToken[] = [
      createMockToken({ category: 'typography', name: 'font-family' }),
    ];

    const result = extractor.validateTokens(tokens);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Missing color tokens');
  });

  it('should return invalid when missing typography tokens', () => {
    const extractor = new TokenExtractor();
    const tokens: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary' }),
    ];

    const result = extractor.validateTokens(tokens);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Missing typography tokens');
  });

  it('should detect duplicate token names within same category', () => {
    const extractor = new TokenExtractor();
    const tokens: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary', value: '#111' }),
      createMockToken({ category: 'color', name: 'primary', value: '#222' }),
      createMockToken({ category: 'typography', name: 'font-family' }),
    ];

    const result = extractor.validateTokens(tokens);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Duplicate token: color:primary');
  });
});

// ============================================================================
// Configuration & Factory Tests
// ============================================================================

describe('DEFAULT_EXTRACTION_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_EXTRACTION_CONFIG.minConfidence).toBe(0.7);
    expect(DEFAULT_EXTRACTION_CONFIG.extractColors).toBe(true);
    expect(DEFAULT_EXTRACTION_CONFIG.extractTypography).toBe(true);
    expect(DEFAULT_EXTRACTION_CONFIG.extractSpacing).toBe(true);
  });
});

describe('createTokenExtractor()', () => {
  it('should create a TokenExtractor instance with default config', () => {
    const extractor = createTokenExtractor();

    expect(extractor).toBeInstanceOf(TokenExtractor);
  });

  it('should create a TokenExtractor with custom config', () => {
    const extractor = createTokenExtractor({ minConfidence: 0.9, extractColors: false });
    const analysis = createMockAnalysis();

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(tokens.filter(t => t.category === 'color').length).toBe(0);
  });
});

// ============================================================================
// Edge Cases & Integration Tests
// ============================================================================

describe('Edge Cases', () => {
  it('should handle typography with empty fonts array but valid sizes', () => {
    const extractor = new TokenExtractor();
    const analysis = createMockAnalysis({
      colorPalette: [],
      typography: {
        fonts: [],
        sizes: [16, 24],
      },
    });

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(tokens.some(t => t.name === 'font-family')).toBe(false);
    expect(tokens.some(t => t.name === 'text-xs')).toBe(true);
  });

  it('should handle extractColors: false config option', () => {
    const extractor = new TokenExtractor({ extractColors: false });
    const analysis = createMockAnalysis();

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(tokens.some(t => t.category === 'color')).toBe(false);
    expect(tokens.some(t => t.category === 'typography')).toBe(true);
  });

  it('should handle extractTypography: false config option', () => {
    const extractor = new TokenExtractor({ extractTypography: false });
    const analysis = createMockAnalysis();

    const tokens = extractor.extractFromScreenshot(analysis);

    expect(tokens.some(t => t.category === 'typography')).toBe(false);
    expect(tokens.some(t => t.category === 'color')).toBe(true);
  });

  it('should merge tokens with equal confidence (new replaces existing)', () => {
    const extractor = new TokenExtractor();
    const existing: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary', value: '#old', confidence: 0.8 }),
    ];
    const newTokens: DesignToken[] = [
      createMockToken({ category: 'color', name: 'primary', value: '#new', confidence: 0.8 }),
    ];

    const merged = extractor.mergeTokens(existing, newTokens);

    expect(merged[0]?.value).toBe('#old');
  });
});
