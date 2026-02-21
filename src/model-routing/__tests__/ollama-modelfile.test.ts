/**
 * Comprehensive tests for Ollama Modelfile Generator
 * Task H5-04: Ollama Modelfile Generator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateModelfile, generateAllModelfiles, generateOllamaInstallScript } from '../ollama-modelfile-generator.js';
import type { AgentModelMapping, HardwareTier } from '../types.js';

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockHardwareTiers: Record<string, HardwareTier> = {
  'low': {
    id: 'low',
    gpuVendor: null,
    vramGB: 0,
    ramGB: 8,
    cpuCores: 4,
    recommendedQuant: 'Q2_K',
  },
  'mid': {
    id: 'mid',
    gpuVendor: 'NVIDIA',
    vramGB: 8,
    ramGB: 16,
    cpuCores: 8,
    recommendedQuant: 'Q4_K_M',
  },
  'high': {
    id: 'high',
    gpuVendor: 'NVIDIA',
    vramGB: 24,
    ramGB: 48,
    cpuCores: 16,
    recommendedQuant: 'Q5_K_M',
  },
  'ultra': {
    id: 'ultra',
    gpuVendor: 'NVIDIA',
    vramGB: 80,
    ramGB: 160,
    cpuCores: 32,
    recommendedQuant: 'Q8_0',
  },
  'apple-silicon': {
    id: 'apple-silicon',
    gpuVendor: 'Apple',
    vramGB: 16,
    ramGB: 16,
    cpuCores: 8,
    recommendedQuant: 'Q4_K_M',
  },
};

const mockAgentMappings: AgentModelMapping[] = [
  {
    agentId: 'MARS',
    primary: { ollamaTag: 'llama2:7b', type: 'primary' },
    fallbacks: [],
  },
  {
    agentId: 'VENUS',
    primary: { ollamaTag: 'mistral:7b', type: 'primary' },
    fallbacks: [],
  },
  {
    agentId: 'MERCURY',
    primary: { ollamaTag: 'neural-chat:7b', type: 'primary' },
    fallbacks: [],
  },
];

// ─── generateModelfile Tests ──────────────────────────────────────────────────

describe('generateModelfile', () => {
  let mapping: AgentModelMapping;

  beforeEach(() => {
    mapping = {
      agentId: 'MARS',
      primary: { ollamaTag: 'llama2:7b', type: 'primary' },
      fallbacks: [],
    };
  });

  describe('Basic Generation', () => {
    it('should generate modelfile for low-tier hardware', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.low);

      expect(result).toBeDefined();
      expect(result.agentId).toBe('MARS');
      expect(result.hardwareTier).toBe('low');
      expect(result.modelName).toBe('nova26-mars-low');
      expect(result.content).toContain('FROM llama2:7b');
    });

    it('should generate modelfile for mid-tier hardware', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.mid);

      expect(result.hardwareTier).toBe('mid');
      expect(result.modelName).toBe('nova26-mars-mid');
      expect(result.content).toContain('num_ctx 16384');
    });

    it('should generate modelfile for high-tier hardware', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.high);

      expect(result.hardwareTier).toBe('high');
      expect(result.modelName).toBe('nova26-mars-high');
      expect(result.content).toContain('num_ctx 65536');
    });

    it('should generate modelfile for ultra-tier hardware', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.ultra);

      expect(result.hardwareTier).toBe('ultra');
      expect(result.modelName).toBe('nova26-mars-ultra');
      expect(result.content).toContain('num_ctx 131072');
    });

    it('should generate modelfile for Apple Silicon', () => {
      const result = generateModelfile(mapping, mockHardwareTiers['apple-silicon']);

      expect(result.hardwareTier).toBe('apple-silicon');
      expect(result.modelName).toBe('nova26-mars-apple-silicon');
      expect(result.content).toContain('num_ctx 32768');
      expect(result.content).toContain('mirostat 2');
    });
  });

  describe('Content Structure', () => {
    it('should include FROM directive', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.low);

      expect(result.content).toMatch(/^FROM llama2:7b/m);
    });

    it('should include generated timestamp', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.low);

      expect(result.content).toContain('Generated:');
      expect(result.content).toContain('Nova26 Auto-Generated');
    });

    it('should include all required parameters', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.mid);

      expect(result.content).toContain('num_ctx');
      expect(result.content).toContain('num_gpu');
      expect(result.content).toContain('num_thread');
      expect(result.content).toContain('temperature');
      expect(result.content).toContain('top_p');
      expect(result.content).toContain('top_k');
      expect(result.content).toContain('repeat_penalty');
      expect(result.content).toContain('num_predict');
      expect(result.content).toContain('mirostat');
    });

    it('should include SYSTEM prompt', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.low);

      expect(result.content).toContain('SYSTEM');
      expect(result.content).toContain('DevOps');
      expect(result.content).toContain('infrastructure');
    });

    it('should include flash_attn for high-tier hardware', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.high);

      expect(result.content).toContain('flash_attn');
    });

    it('should include f16_kv for ultra-tier hardware', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.ultra);

      expect(result.content).toContain('f16_kv');
    });

    it('should not include flash_attn for low-tier hardware', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.low);

      expect(result.content).not.toContain('flash_attn');
    });
  });

  describe('Agent-Specific System Prompts', () => {
    it('should include MARS-specific prompt', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.low);

      expect(result.content).toContain('MARS');
      expect(result.content).toContain('DevOps');
      expect(result.content).toContain('Kubernetes');
    });

    it('should include VENUS-specific prompt', () => {
      const venusMapping: AgentModelMapping = {
        agentId: 'VENUS',
        primary: { ollamaTag: 'mistral:7b', type: 'primary' },
        fallbacks: [],
      };

      const result = generateModelfile(venusMapping, mockHardwareTiers.low);

      expect(result.content).toContain('VENUS');
      expect(result.content).toContain('UI/UX');
      expect(result.content).toContain('React');
    });

    it('should include MERCURY-specific prompt', () => {
      const mercuryMapping: AgentModelMapping = {
        agentId: 'MERCURY',
        primary: { ollamaTag: 'neural-chat:7b', type: 'primary' },
        fallbacks: [],
      };

      const result = generateModelfile(mercuryMapping, mockHardwareTiers.low);

      expect(result.content).toContain('MERCURY');
      expect(result.content).toContain('code review');
    });

    it('should use default prompt for unknown agents', () => {
      const unknownMapping: AgentModelMapping = {
        agentId: 'UNKNOWN_AGENT',
        primary: { ollamaTag: 'mistral:7b', type: 'primary' },
        fallbacks: [],
      };

      const result = generateModelfile(unknownMapping, mockHardwareTiers.low);

      expect(result.content).toContain('Nova26 AI agent');
    });
  });

  describe('Parameter Values by Tier', () => {
    it('should use correct context size for each tier', () => {
      const low = generateModelfile(mapping, mockHardwareTiers.low);
      const mid = generateModelfile(mapping, mockHardwareTiers.mid);
      const high = generateModelfile(mapping, mockHardwareTiers.high);
      const ultra = generateModelfile(mapping, mockHardwareTiers.ultra);

      expect(low.content).toContain('num_ctx 8192');
      expect(mid.content).toContain('num_ctx 16384');
      expect(high.content).toContain('num_ctx 65536');
      expect(ultra.content).toContain('num_ctx 131072');
    });

    it('should use correct GPU layers for each tier', () => {
      const low = generateModelfile(mapping, mockHardwareTiers.low);
      const mid = generateModelfile(mapping, mockHardwareTiers.mid);
      const high = generateModelfile(mapping, mockHardwareTiers.high);

      expect(low.content).toContain('num_gpu 0');
      expect(mid.content).toContain('num_gpu 35');
      expect(high.content).toContain('num_gpu 50');
    });

    it('should use correct prediction tokens for each tier', () => {
      const low = generateModelfile(mapping, mockHardwareTiers.low);
      const mid = generateModelfile(mapping, mockHardwareTiers.mid);
      const high = generateModelfile(mapping, mockHardwareTiers.high);

      expect(low.content).toContain('num_predict 256');
      expect(mid.content).toContain('num_predict 512');
      expect(high.content).toContain('num_predict 1024');
    });
  });

  describe('Model Name Generation', () => {
    it('should lowercase agent ID in model name', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.low);

      expect(result.modelName).toContain('nova26-mars-low');
      expect(result.modelName).not.toContain('MARS');
    });

    it('should include hardware tier in model name', () => {
      for (const tier of Object.keys(mockHardwareTiers)) {
        const result = generateModelfile(mapping, mockHardwareTiers[tier]);
        expect(result.modelName).toContain(tier);
      }
    });

    it('should follow nova26 naming convention', () => {
      const result = generateModelfile(mapping, mockHardwareTiers.low);

      expect(result.modelName).toMatch(/^nova26-[a-z]+-[a-z-]+$/);
    });
  });
});

// ─── generateAllModelfiles Tests ──────────────────────────────────────────────

describe('generateAllModelfiles', () => {
  it('should generate modelfiles for all mappings', () => {
    const results = generateAllModelfiles(mockAgentMappings, mockHardwareTiers.mid);

    expect(results.length).toBe(mockAgentMappings.length);
  });

  it('should preserve agent IDs in order', () => {
    const results = generateAllModelfiles(mockAgentMappings, mockHardwareTiers.mid);

    for (let i = 0; i < results.length; i++) {
      expect(results[i].agentId).toBe(mockAgentMappings[i].agentId);
    }
  });

  it('should use same hardware tier for all modelfiles', () => {
    const results = generateAllModelfiles(mockAgentMappings, mockHardwareTiers.high);

    for (const result of results) {
      expect(result.hardwareTier).toBe('high');
    }
  });

  it('should handle empty mappings list', () => {
    const results = generateAllModelfiles([], mockHardwareTiers.low);

    expect(results.length).toBe(0);
  });

  it('should handle single mapping', () => {
    const results = generateAllModelfiles([mockAgentMappings[0]], mockHardwareTiers.low);

    expect(results.length).toBe(1);
    expect(results[0].agentId).toBe('MARS');
  });

  it('should generate content for each modelfile', () => {
    const results = generateAllModelfiles(mockAgentMappings, mockHardwareTiers.mid);

    for (const result of results) {
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    }
  });
});

// ─── generateOllamaInstallScript Tests ────────────────────────────────────────

describe('generateOllamaInstallScript', () => {
  let modelfiles: any[];

  beforeEach(() => {
    const mapping: AgentModelMapping = {
      agentId: 'MARS',
      primary: { ollamaTag: 'llama2:7b', type: 'primary' },
      fallbacks: [],
    };
    modelfiles = [generateModelfile(mapping, mockHardwareTiers.low)];
  });

  describe('Script Structure', () => {
    it('should start with shebang', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toMatch(/^#!\/bin/m);
    });

    it('should include Nova26 header', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toContain('Nova26 Ollama Setup Script');
      expect(script).toContain('Generated:');
    });

    it('should include Ollama installation check', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toContain('ollama');
      expect(script).toContain('command -v');
    });

    it('should include error handling', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toContain('set -e');
    });
  });

  describe('Model Creation', () => {
    it('should create section for each modelfile', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toContain('# MARS — low');
    });

    it('should include model name for each modelfile', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toContain('nova26-mars-low');
    });

    it('should use heredoc for Modelfile content', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toContain('MODELFILE_EOF');
    });

    it('should include ollama create command', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toContain('ollama create');
    });

    it('should include success echo for each model', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toContain('Created nova26-mars-low');
    });
  });

  describe('Multiple Modelfiles', () => {
    it('should handle multiple modelfiles', () => {
      const allModelfiles = generateAllModelfiles(
        mockAgentMappings,
        mockHardwareTiers.mid
      );

      const script = generateOllamaInstallScript(allModelfiles);

      expect(script).toContain('# MARS');
      expect(script).toContain('# VENUS');
      expect(script).toContain('# MERCURY');
    });

    it('should create separate sections for each agent', () => {
      const allModelfiles = generateAllModelfiles(
        mockAgentMappings,
        mockHardwareTiers.mid
      );

      const script = generateOllamaInstallScript(allModelfiles);

      expect(script).toContain('nova26-mars-mid');
      expect(script).toContain('nova26-venus-mid');
      expect(script).toContain('nova26-mercury-mid');
    });
  });

  describe('Script Validity', () => {
    it('should be valid bash syntax structure', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toMatch(/^#!\/bin\/bash/m);
      expect(script).toMatch(/^set -e/m);
    });

    it('should have proper quote escaping', () => {
      const script = generateOllamaInstallScript(modelfiles);

      // Check that heredoc uses proper quoting
      expect(script).toContain("'MODELFILE_EOF'");
    });

    it('should end with success message', () => {
      const script = generateOllamaInstallScript(modelfiles);

      expect(script).toContain('All Nova26 models installed successfully');
    });

    it('should handle empty modelfiles list', () => {
      const script = generateOllamaInstallScript([]);

      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('All Nova26 models installed successfully');
    });
  });
});

// ─── Property-Based Tests ──────────────────────────────────────────────────────

describe('Property-Based Tests', () => {
  it('should generate valid modelfiles for all tier combinations', () => {
    const tiers = Object.values(mockHardwareTiers);
    const mapping: AgentModelMapping = {
      agentId: 'MARS',
      primary: { ollamaTag: 'llama2:7b', type: 'primary' },
      fallbacks: [],
    };

    for (const tier of tiers) {
      const result = generateModelfile(mapping, tier);

      // Invariants
      expect(result.agentId).toBe('MARS');
      expect(result.hardwareTier).toBe(tier.id);
      expect(result.modelName).toMatch(/^nova26-mars-/);
      expect(result.content).toContain('FROM llama2:7b');
      expect(result.content).toContain('SYSTEM');
    }
  });

  it('should maintain modelfile validity invariants', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 131072 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 1, max: 128 }),
        (ctx, gpu, threads) => {
          const tier: HardwareTier = {
            id: 'test' as any,
            gpuVendor: 'NVIDIA',
            vramGB: 24,
            ramGB: 48,
            cpuCores: threads,
            recommendedQuant: 'Q5_K_M',
          };

          const mapping: AgentModelMapping = {
            agentId: 'MARS',
            primary: { ollamaTag: 'test:7b', type: 'primary' },
            fallbacks: [],
          };

          const result = generateModelfile(mapping, tier);

          // Content should have reasonable length
          return result.content.length > 100 && result.content.length < 10000;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should generate unique model names per tier', () => {
    const mapping: AgentModelMapping = {
      agentId: 'MARS',
      primary: { ollamaTag: 'llama2:7b', type: 'primary' },
      fallbacks: [],
    };

    const names = new Set();
    for (const tier of Object.values(mockHardwareTiers)) {
      const result = generateModelfile(mapping, tier);
      names.add(result.modelName);
    }

    // Each tier should produce unique name
    expect(names.size).toBe(Object.keys(mockHardwareTiers).length);
  });
});
