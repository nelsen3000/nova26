// SN-08: Dead code elimination verification
// Ensures key exports exist and removed dead code stays removed

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

const srcRoot = join(import.meta.dirname, '..');

describe('Dead Code Elimination', () => {
  describe('Removed modules should not exist', () => {
    const removedFiles = [
      'orchestrator/agent-selector.ts',
      'orchestrator/agent-selector.test.ts',
      'orchestrator/plan-approval.ts',
      'orchestrator/plan-approval.test.ts',
      'sync/offline-engine.ts',
      'sync/offline-engine.test.ts',
      'retry/smart-retry.ts',
      'templates/template-engine.ts',
      'ide/vscode-extension.ts',
    ];

    for (const file of removedFiles) {
      it(`${file} should not exist`, () => {
        expect(existsSync(join(srcRoot, file))).toBe(false);
      });
    }
  });

  describe('Key exports should still exist', () => {
    it('ralph-loop.ts exports RalphLoopOptions', async () => {
      const mod = await import('../orchestrator/ralph-loop-types.js');
      expect(mod).toHaveProperty('HookRegistry');
    });

    it('lifecycle-wiring.ts exports wireFeatureHooks', async () => {
      const mod = await import('../orchestrator/lifecycle-wiring.js');
      expect(mod).toHaveProperty('wireFeatureHooks');
      expect(mod).toHaveProperty('getWiringSummary');
      expect(mod).toHaveProperty('DEFAULT_FEATURE_HOOKS');
    });

    it('agent-explanations.ts exports used functions only', async () => {
      const mod = await import('../orchestrator/agent-explanations.js');
      // These should exist (used by CLI)
      expect(mod).toHaveProperty('getAgentExplanation');
      expect(mod).toHaveProperty('formatExplanation');
      expect(mod).toHaveProperty('formatReasoning');
      // These should NOT exist (removed dead code)
      expect(mod).not.toHaveProperty('generateExplanationHTML');
      expect(mod).not.toHaveProperty('showInteractiveExplanation');
    });

    it('model-routing barrel exports core types', async () => {
      const mod = await import('../model-routing/index.js');
      expect(mod).toHaveProperty('ModelRouter');
      expect(mod).toHaveProperty('HardwareDetector');
    });

    it('observability barrel exports core types', async () => {
      const mod = await import('../observability/index.js');
      expect(mod).toHaveProperty('CinematicObservability');
    });

    it('workflow-engine barrel exports core types', async () => {
      const mod = await import('../workflow-engine/index.js');
      expect(mod).toHaveProperty('RalphVisualWorkflowEngine');
    });
  });
});
