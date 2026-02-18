// Tool Registry Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry, type Tool, type AgentToolPermissions, resetToolRegistry, getToolRegistry } from './tool-registry.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockTool(name: string, overrides?: Partial<Tool>): Tool {
  return {
    name,
    description: `Mock tool: ${name}`,
    parameters: z.object({ input: z.string().optional() }),
    execute: async () => ({ success: true, output: 'mock output', duration: 10, truncated: false }),
    allowedAgents: [],
    blockedAgents: [],
    mutating: false,
    timeout: 5000,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    resetToolRegistry();
  });

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  describe('register', () => {
    it('should register a tool', () => {
      const tool = createMockTool('readFile');
      registry.register(tool);
      expect(registry.get('readFile')).toBe(tool);
    });

    it('should throw on duplicate registration', () => {
      const tool = createMockTool('readFile');
      registry.register(tool);
      expect(() => registry.register(tool)).toThrow('already registered');
    });

    it('should return undefined for unregistered tool', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Listing
  // --------------------------------------------------------------------------

  describe('listAll', () => {
    it('should list all registered tools', () => {
      registry.register(createMockTool('readFile'));
      registry.register(createMockTool('writeFile'));
      registry.register(createMockTool('searchCode'));

      const tools = registry.listAll();
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toEqual(['readFile', 'writeFile', 'searchCode']);
    });

    it('should return empty array when no tools registered', () => {
      expect(registry.listAll()).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Agent Permissions
  // --------------------------------------------------------------------------

  describe('listForAgent', () => {
    it('should list tools allowed for MARS', () => {
      registry.register(createMockTool('readFile'));
      registry.register(createMockTool('writeFile', { mutating: true }));
      registry.register(createMockTool('checkTypes'));
      registry.register(createMockTool('runTests'));
      registry.register(createMockTool('searchCode'));
      registry.register(createMockTool('listFiles'));

      const tools = registry.listForAgent('MARS');
      const names = tools.map(t => t.name);

      expect(names).toContain('readFile');
      expect(names).toContain('writeFile');
      expect(names).toContain('checkTypes');
      expect(names).toContain('runTests');
    });

    it('should block mutating tools for read-only agents', () => {
      registry.register(createMockTool('readFile'));
      registry.register(createMockTool('writeFile', { mutating: true }));

      const tools = registry.listForAgent('JUPITER');
      const names = tools.map(t => t.name);

      expect(names).toContain('readFile');
      expect(names).not.toContain('writeFile');
    });

    it('should respect blockedAgents on tool', () => {
      registry.register(createMockTool('readFile', { blockedAgents: ['MARS'] }));

      const marsTools = registry.listForAgent('MARS');
      expect(marsTools.map(t => t.name)).not.toContain('readFile');
    });

    it('should give unknown agents only non-mutating tools', () => {
      registry.register(createMockTool('readFile'));
      registry.register(createMockTool('writeFile', { mutating: true }));

      const tools = registry.listForAgent('UNKNOWN_AGENT');
      expect(tools.map(t => t.name)).toContain('readFile');
      expect(tools.map(t => t.name)).not.toContain('writeFile');
    });
  });

  // --------------------------------------------------------------------------
  // Permission Checking
  // --------------------------------------------------------------------------

  describe('canCall', () => {
    it('should allow permitted tool calls', () => {
      registry.register(createMockTool('readFile'));
      const result = registry.canCall('MARS', 'readFile', 'task-1');
      expect(result.allowed).toBe(true);
    });

    it('should reject non-existent tools', () => {
      const result = registry.canCall('MARS', 'nonexistent', 'task-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should reject blocked agents', () => {
      registry.register(createMockTool('readFile', { blockedAgents: ['MARS'] }));
      const result = registry.canCall('MARS', 'readFile', 'task-1');
      expect(result.allowed).toBe(false);
    });

    it('should reject when agent has no permissions', () => {
      const customPerms: AgentToolPermissions[] = [];
      const customRegistry = new ToolRegistry(customPerms);
      customRegistry.register(createMockTool('readFile'));

      const result = customRegistry.canCall('MARS', 'readFile', 'task-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('no permissions');
    });

    it('should enforce rate limits', () => {
      registry.register(createMockTool('readFile'));
      const perms = registry.getPermissions('ANDROMEDA');
      expect(perms).toBeDefined();
      const max = perms!.maxCallsPerTask;

      for (let i = 0; i < max; i++) {
        registry.recordCall('ANDROMEDA', 'task-1');
      }

      const result = registry.canCall('ANDROMEDA', 'readFile', 'task-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('max tool calls');
    });

    it('should track rate limits per task', () => {
      registry.register(createMockTool('readFile'));
      const perms = registry.getPermissions('ANDROMEDA')!;

      for (let i = 0; i < perms.maxCallsPerTask; i++) {
        registry.recordCall('ANDROMEDA', 'task-1');
      }

      // Different task should still be allowed
      const result = registry.canCall('ANDROMEDA', 'readFile', 'task-2');
      expect(result.allowed).toBe(true);
    });

    it('should reset call counts', () => {
      registry.register(createMockTool('readFile'));
      const perms = registry.getPermissions('ANDROMEDA')!;

      for (let i = 0; i < perms.maxCallsPerTask; i++) {
        registry.recordCall('ANDROMEDA', 'task-1');
      }

      registry.resetCallCounts('task-1');
      const result = registry.canCall('ANDROMEDA', 'readFile', 'task-1');
      expect(result.allowed).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Tool Specs
  // --------------------------------------------------------------------------

  describe('toSpec', () => {
    it('should convert tool to OpenAI-compatible spec', () => {
      const tool = createMockTool('readFile', {
        parameters: z.object({
          path: z.string(),
          startLine: z.number().optional(),
        }),
      });
      registry.register(tool);

      const spec = registry.toSpec(tool);
      expect(spec.type).toBe('function');
      expect(spec.function.name).toBe('readFile');
      expect(spec.function.parameters.type).toBe('object');
      expect(spec.function.parameters.properties).toHaveProperty('path');
    });
  });

  describe('getSpecsForAgent', () => {
    it('should return specs only for allowed tools', () => {
      registry.register(createMockTool('readFile'));
      registry.register(createMockTool('writeFile', { mutating: true }));

      const specs = registry.getSpecsForAgent('JUPITER');
      const names = specs.map(s => s.function.name);

      expect(names).toContain('readFile');
      expect(names).not.toContain('writeFile');
    });
  });

  // --------------------------------------------------------------------------
  // Prompt Formatting
  // --------------------------------------------------------------------------

  describe('formatToolsForPrompt', () => {
    it('should format tools as prompt string', () => {
      registry.register(createMockTool('readFile'));
      registry.register(createMockTool('searchCode'));

      const prompt = registry.formatToolsForPrompt('MARS');

      expect(prompt).toContain('<available_tools>');
      expect(prompt).toContain('</available_tools>');
      expect(prompt).toContain('readFile');
      expect(prompt).toContain('searchCode');
      expect(prompt).toContain('<tool_call>');
      expect(prompt).toContain('<final_output>');
    });

    it('should return empty string for agents with no tools', () => {
      const customPerms: AgentToolPermissions[] = [
        { agent: 'EMPTY', allowed: [], maxCallsPerTask: 0, canMutate: false },
      ];
      const customRegistry = new ToolRegistry(customPerms);
      const prompt = customRegistry.formatToolsForPrompt('EMPTY');
      expect(prompt).toBe('');
    });

    it('should include max calls info', () => {
      registry.register(createMockTool('readFile'));
      const prompt = registry.formatToolsForPrompt('MARS');
      expect(prompt).toContain('Max 20 calls');
    });
  });

  // --------------------------------------------------------------------------
  // Singleton
  // --------------------------------------------------------------------------

  describe('singleton', () => {
    it('should return same instance', () => {
      const r1 = getToolRegistry();
      const r2 = getToolRegistry();
      expect(r1).toBe(r2);
    });

    it('should reset singleton', () => {
      const r1 = getToolRegistry();
      resetToolRegistry();
      const r2 = getToolRegistry();
      expect(r1).not.toBe(r2);
    });
  });
});
