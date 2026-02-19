// Tests for Generative UI Request & Variation Engine
// KIMI-GENUI-02

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GenerativeUIEngine,
  type InputMode,
} from './generative-engine.js';

describe('GenerativeUIEngine', () => {
  let engine: GenerativeUIEngine;
  let mockGenerateFn: ReturnType<typeof vi.fn>;
  let mockReviewFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGenerateFn = vi.fn((description: string, framework: string) => 
      Promise.resolve(`// Generated ${framework} code for: ${description.substring(0, 30)}...`)
    );
    mockReviewFn = vi.fn((code: string) => 
      Promise.resolve({ score: 85, issues: [] })
    );
    engine = new GenerativeUIEngine(mockGenerateFn, mockReviewFn);
  });

  describe('createRequest', () => {
    it('creates request with defaults', () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
      });

      expect(request.id).toBeDefined();
      expect(request.requestedAt).toBeDefined();
      expect(request.variationsRequested).toBe(1);
      expect(request.description).toBe('A blue button');
    });

    it('creates request with custom variations', () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
        variationsRequested: 3,
      });

      expect(request.variationsRequested).toBe(3);
    });

    it('clamps variations to max', () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
        variationsRequested: 10, // Max is 5
      });

      expect(request.variationsRequested).toBe(5);
    });

    it('enforces minimum of 1 variation', () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
        variationsRequested: 0,
      });

      expect(request.variationsRequested).toBe(1);
    });
  });

  describe('generate', () => {
    it('generates single variation', async () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
        variationsRequested: 1,
      });

      const result = await engine.generate(request);

      expect(result.variations).toHaveLength(1);
    });

    it('generates multiple variations', async () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
        variationsRequested: 3,
      });

      const result = await engine.generate(request);

      expect(result.variations).toHaveLength(3);
    });

    it('calls generateFn for each variation', async () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
        variationsRequested: 3,
      });

      await engine.generate(request);

      expect(mockGenerateFn).toHaveBeenCalledTimes(3);
    });

    it('calls reviewFn for each variation', async () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
        variationsRequested: 2,
      });

      await engine.generate(request);

      expect(mockReviewFn).toHaveBeenCalledTimes(2);
    });

    it('sets generatedBy to MARS', async () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
      });

      const result = await engine.generate(request);

      expect(result.generatedBy).toBe('MARS');
    });

    it('sets previewUrl correctly', async () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
      });

      const result = await engine.generate(request);

      expect(result.previewUrl).toBe(`http://localhost:5274/component/${request.id}`);
    });

    it('sets generatedAt', async () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
      });

      const result = await engine.generate(request);

      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('stores accessibility score on variation', async () => {
      mockReviewFn.mockResolvedValueOnce({ score: 92, issues: ['contrast'] });

      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
      });

      const result = await engine.generate(request);

      expect(result.variations[0].accessibility.score).toBe(92);
      expect(result.variations[0].accessibility.issues).toContain('contrast');
    });

    it('stores quality score on variation', async () => {
      mockReviewFn.mockResolvedValueOnce({ score: 88, issues: [] });

      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
      });

      const result = await engine.generate(request);

      expect(result.variations[0].qualityScore).toBe(88);
    });
  });

  describe('selectVariation', () => {
    it('selects a variation', async () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
        variationsRequested: 2,
      });

      const result = await engine.generate(request);
      const variationId = result.variations[0].id;

      const updated = engine.selectVariation(result, variationId);

      expect(updated.selectedVariationId).toBe(variationId);
    });

    it('throws for invalid variationId', async () => {
      const request = engine.createRequest({
        description: 'A blue button',
        inputMode: 'natural-language',
        framework: 'react',
        projectId: 'project-1',
        requestedBy: 'human',
      });

      const result = await engine.generate(request);

      expect(() => engine.selectVariation(result, 'fake-id')).toThrow('Variation not found');
    });
  });

  describe('decompose', () => {
    it('decomposes complex request', () => {
      const plan = engine.decompose(
        'user settings page with profile and notifications',
        'react'
      );

      expect(plan.components.length).toBeGreaterThan(1);
      expect(plan.compositionStrategy).toContain('Compose');
    });

    it('creates single component for simple request', () => {
      const plan = engine.decompose('a blue button', 'react');

      expect(plan.components).toHaveLength(1);
      expect(plan.components[0].name).toBe('MainComponent');
    });

    it('detects complex requests by keywords', () => {
      const dashboardPlan = engine.decompose('dashboard with charts', 'react');
      expect(dashboardPlan.components.length).toBeGreaterThan(1);

      const formPlan = engine.decompose('form with inputs and submit', 'react');
      expect(formPlan.components.length).toBeGreaterThanOrEqual(1);
    });

    it('detects complex requests by length', () => {
      const longDescription = 'a'.repeat(250);
      const plan = engine.decompose(longDescription, 'react');

      expect(plan.components.length).toBeGreaterThanOrEqual(1);
    });

    it('extracts header component', () => {
      const plan = engine.decompose('page with header', 'react');
      
      expect(plan.components.some(c => c.name === 'Header')).toBe(true);
    });

    it('extracts sidebar component', () => {
      const plan = engine.decompose('dashboard with sidebar', 'react');
      
      expect(plan.components.some(c => c.name === 'Sidebar')).toBe(true);
    });

    it('extracts form component', () => {
      const plan = engine.decompose('contact form page', 'react');
      
      expect(plan.components.some(c => c.name === 'Form')).toBe(true);
    });
  });

  describe('parseInputMode', () => {
    it('parses screenshot input mode', () => {
      const mode = engine.parseInputMode({ screenshotPath: '/path/to/image.png' });
      expect(mode).toBe('screenshot');
    });

    it('parses ascii-sketch input mode', () => {
      const mode = engine.parseInputMode({ asciiSketch: '+---+\n|box|\n+---+' });
      expect(mode).toBe('ascii-sketch');
    });

    it('parses natural-language by default', () => {
      const mode = engine.parseInputMode({ description: 'A blue button' });
      expect(mode).toBe('natural-language');
    });

    it('prefers screenshot over ascii', () => {
      const mode = engine.parseInputMode({
        screenshotPath: '/path/to/image.png',
        asciiSketch: 'ascii art',
      });
      expect(mode).toBe('screenshot');
    });
  });

  describe('buildVariationPromptSuffix', () => {
    it('variation 1 suffix differs from variation 2', () => {
      const suffix1 = engine.buildVariationPromptSuffix(1, 3);
      const suffix2 = engine.buildVariationPromptSuffix(2, 3);

      expect(suffix1).not.toBe(suffix2);
    });

    it('variation 1 is default implementation', () => {
      const suffix = engine.buildVariationPromptSuffix(1, 3);
      expect(suffix.toLowerCase()).toContain('default');
    });

    it('variation 2 is alternative layout', () => {
      const suffix = engine.buildVariationPromptSuffix(2, 3);
      expect(suffix.toLowerCase()).toContain('alternative');
    });

    it('variation 3 is minimal version', () => {
      const suffix = engine.buildVariationPromptSuffix(3, 3);
      expect(suffix.toLowerCase()).toContain('minimal');
    });

    it('variation 4+ is unique variant', () => {
      const suffix = engine.buildVariationPromptSuffix(4, 5);
      expect(suffix.toLowerCase()).toContain('unique');
    });
  });
});
