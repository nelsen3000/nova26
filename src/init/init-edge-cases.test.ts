// Init Edge Cases — R17-02
// KIMI-W-04: 8 edge case tests for init system

import { describe, it, expect, vi } from 'vitest';
import {
  ConfigWizard,
  FrameworkDetector,
  DependencyRecommender,
  TemplateSystem,
} from './init-index.js';

describe('Init Edge Cases', () => {
  describe('ConfigWizard Edge Cases', () => {
    it('should handle empty answer processing', () => {
      const wizard = new ConfigWizard();
      const state = wizard.createState();

      const updated = wizard.processAnswer(state, '');
      expect(updated).toBeDefined();
    });

    it('should handle very long answer', () => {
      const wizard = new ConfigWizard();
      const state = wizard.createState();
      const longAnswer = 'a'.repeat(1000);

      const updated = wizard.processAnswer(state, longAnswer);
      expect(updated).toBeDefined();
    });

    it('should handle rapid step navigation', () => {
      const wizard = new ConfigWizard();
      let state = wizard.createState();

      state = wizard.processAnswer(state, 'answer1');
      state = wizard.previousStep(state);
      state = wizard.processAnswer(state, 'answer2');
      state = wizard.previousStep(state);

      expect(state).toBeDefined();
    });

    it('should handle config generation with empty answers', () => {
      const wizard = new ConfigWizard();
      const config = wizard.generateConfig({});
      expect(config).toBeDefined();
    });
  });

  describe('FrameworkDetector Edge Cases', () => {
    it('should handle empty package.json', () => {
      const detector = new FrameworkDetector();
      const result = detector.detectFromPackageJson({});
      expect(result).toBeDefined();
    });

    it('should handle conflicting framework signals', () => {
      const detector = new FrameworkDetector();
      const packageJson = {
        dependencies: {
          'react': '^18.0.0',
          'vue': '^3.0.0',
          '@angular/core': '^15.0.0',
        },
      };

      const result = detector.detectFromPackageJson(packageJson);
      expect(result).toBeDefined();
    });

    it('should handle empty file list', () => {
      const detector = new FrameworkDetector();
      const result = detector.detectFromConfigFiles([]);
      expect(result).toEqual([]);
    });

    it('should handle unknown package manager', () => {
      const detector = new FrameworkDetector();
      const result = detector.detectPackageManager(['unknown.file']);
      expect(result).toBe('unknown');
    });
  });

  describe('DependencyRecommender Edge Cases', () => {
    it('should return recommendation rules', () => {
      const recommender = new DependencyRecommender();
      const rules = recommender.getRecommendationRules();
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should handle profile with no matching rules', () => {
      const recommender = new DependencyRecommender();
      const recommendations = recommender.recommendForProfile({
        detectedFrameworks: [],
        packageManager: 'unknown',
        inferredProjectType: null,
        hasTypeScript: false,
        hasTests: false,
        builtAt: new Date().toISOString(),
      });
      expect(recommendations).toBeDefined();
    });
  });

  describe('TemplateSystem Edge Cases', () => {
    it('should handle rendering with missing required variables', () => {
      const system = new TemplateSystem();
      // Render without required projectName variable
      const result = system.renderTemplate('react-app', {});
      expect(result).toBeNull();
    });

    it('should handle rendering with valid variables', () => {
      const system = new TemplateSystem();
      const result = system.renderTemplate('react-app', { projectName: 'test-app' });
      expect(result).toBeDefined();
    });
  });

  describe('Module Integration Edge Cases', () => {
    it('should handle wizard completion with default answers', () => {
      const wizard = new ConfigWizard();
      const config = wizard.generateConfig({});
      expect(config).toBeDefined();
      expect(config['projectType']).toBeDefined();
    });
  });
});
