// Tests for SkillRunner — Skill execution engine
// KIMI-INTEGRATE-06

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSkillRunner, resetSkillRunner } from './skill-runner.js';
import { getSkillRegistry, resetSkillRegistry } from './skill-registry.js';
import { getToolRegistry, resetToolRegistry, type Tool, type ToolResult } from '../tools/tool-registry.js';
import { z } from 'zod';

describe('SkillRunner', () => {
  beforeEach(() => {
    resetSkillRunner();
    resetSkillRegistry();
    resetToolRegistry();
  });

  // Helper to register a mock tool
  function registerMockTool(name: string, returnValue: ToolResult): void {
    const tool: Tool = {
      name,
      description: `Mock ${name}`,
      parameters: z.object({}),
      execute: vi.fn().mockResolvedValue(returnValue),
      allowedAgents: [],
      blockedAgents: [],
      mutating: false,
      timeout: 5000,
    };
    getToolRegistry().register(tool);
  }

  describe('Successful execution', () => {
    it('execute() runs all steps in order and returns success: true', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      // Register mock tools
      registerMockTool('tool1', { success: true, output: 'result1', duration: 100, truncated: false });
      registerMockTool('tool2', { success: true, output: 'result2', duration: 100, truncated: false });

      // Register a test skill
      registry.register({
        name: 'test-skill',
        description: 'Test skill',
        agents: [],
        version: '1.0.0',
        requiredTools: ['tool1', 'tool2'],
        steps: [
          { name: 'step1', tool: 'tool1', buildArgs: () => ({}) },
          { name: 'step2', tool: 'tool2', buildArgs: () => ({}) },
        ],
      });

      const result = await runner.execute('test-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.success).toBe(true);
      expect(result.stepsCompleted).toBe(2);
      expect(result.totalSteps).toBe(2);
    });

    it('execute() accumulates step results in context.stepResults', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      registerMockTool('readFile', { success: true, output: 'file content', duration: 100, truncated: false });

      registry.register({
        name: 'accumulate-skill',
        description: 'Test accumulation',
        agents: [],
        version: '1.0.0',
        requiredTools: ['readFile'],
        steps: [
          { name: 'read-file', tool: 'readFile', buildArgs: () => ({ path: 'test.txt' }) },
        ],
      });

      const result = await runner.execute('accumulate-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.stepResults['read-file']).toBe('file content');
    });

    it('execute() returns the correct stepsCompleted count', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      registerMockTool('tool1', { success: true, output: 'r1', duration: 100, truncated: false });
      registerMockTool('tool2', { success: true, output: 'r2', duration: 100, truncated: false });
      registerMockTool('tool3', { success: true, output: 'r3', duration: 100, truncated: false });

      registry.register({
        name: 'multi-step-skill',
        description: 'Multi step',
        agents: [],
        version: '1.0.0',
        requiredTools: ['tool1', 'tool2', 'tool3'],
        steps: [
          { name: 'step1', tool: 'tool1', buildArgs: () => ({}) },
          { name: 'step2', tool: 'tool2', buildArgs: () => ({}) },
          { name: 'step3', tool: 'tool3', buildArgs: () => ({}) },
        ],
      });

      const result = await runner.execute('multi-step-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.stepsCompleted).toBe(3);
    });

    it('execute() calls each step buildArgs() with the updated context', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();
      const buildArgsSpy = vi.fn().mockReturnValue({});

      registerMockTool('tool1', { success: true, output: 'step1-result', duration: 100, truncated: false });
      registerMockTool('tool2', { success: true, output: 'step2-result', duration: 100, truncated: false });

      registry.register({
        name: 'context-skill',
        description: 'Context test',
        agents: [],
        version: '1.0.0',
        requiredTools: ['tool1', 'tool2'],
        steps: [
          { name: 'step1', tool: 'tool1', buildArgs: () => ({}) },
          { name: 'step2', tool: 'tool2', buildArgs: buildArgsSpy },
        ],
      });

      await runner.execute('context-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(buildArgsSpy).toHaveBeenCalled();
      const context = buildArgsSpy.mock.calls[0][0];
      expect(context.stepResults).toHaveProperty('step1', 'step1-result');
    });
  });

  describe('Failure handling', () => {
    it('execute() returns success: false when a tool returns success: false', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      registerMockTool('tool1', { success: true, output: 'r1', duration: 100, truncated: false });
      registerMockTool('tool2', { success: false, output: '', error: 'Tool failed', duration: 100, truncated: false });

      registry.register({
        name: 'failing-skill',
        description: 'Failing skill',
        agents: [],
        version: '1.0.0',
        requiredTools: ['tool1', 'tool2'],
        steps: [
          { name: 'step1', tool: 'tool1', buildArgs: () => ({}) },
          { name: 'step2', tool: 'tool2', buildArgs: () => ({}) },
        ],
      });

      const result = await runner.execute('failing-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('step2');
    });

    it('execute() stops after the failing step', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      const tool3Execute = vi.fn().mockResolvedValue({ success: true, output: 'r3', duration: 100, truncated: false });

      registerMockTool('tool1', { success: true, output: 'r1', duration: 100, truncated: false });
      registerMockTool('tool2', { success: false, output: '', error: 'Tool failed', duration: 100, truncated: false });
      getToolRegistry().register({
        name: 'tool3',
        description: 'Tool 3',
        parameters: z.object({}),
        execute: tool3Execute,
        allowedAgents: [],
        blockedAgents: [],
        mutating: false,
        timeout: 5000,
      });

      registry.register({
        name: 'stopping-skill',
        description: 'Stopping skill',
        agents: [],
        version: '1.0.0',
        requiredTools: ['tool1', 'tool2', 'tool3'],
        steps: [
          { name: 'step1', tool: 'tool1', buildArgs: () => ({}) },
          { name: 'step2', tool: 'tool2', buildArgs: () => ({}) },
          { name: 'step3', tool: 'tool3', buildArgs: () => ({}) },
        ],
      });

      const result = await runner.execute('stopping-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.stepsCompleted).toBe(1);
      expect(tool3Execute).not.toHaveBeenCalled();
    });

    it('execute() sets failedStep to the name of the step that failed', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      registerMockTool('tool1', { success: false, output: '', error: 'Failed', duration: 100, truncated: false });

      registry.register({
        name: 'first-fail-skill',
        description: 'First fail',
        agents: [],
        version: '1.0.0',
        requiredTools: ['tool1'],
        steps: [
          { name: 'first-step', tool: 'tool1', buildArgs: () => ({}) },
        ],
      });

      const result = await runner.execute('first-fail-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.failedStep).toBe('first-step');
    });

    it('execute() returns success: false when validateResult() returns false', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      // Use 'wrong output' which doesn't contain the substring 'valid'
      registerMockTool('tool1', { success: true, output: 'wrong output', duration: 100, truncated: false });

      registry.register({
        name: 'validation-skill',
        description: 'Validation test',
        agents: [],
        version: '1.0.0',
        requiredTools: ['tool1'],
        steps: [
          { name: 'validate-step', tool: 'tool1', buildArgs: () => ({}), validateResult: (r) => r.includes('VALIDATED') },
        ],
      });

      const result = await runner.execute('validation-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });

    it('execute() returns success: false for an unknown skill name', async () => {
      const runner = getSkillRunner();

      const result = await runner.execute('nonexistent-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Skill not found');
    });

    it('execute() returns success: false when a required tool is not in ToolRegistry', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      registry.register({
        name: 'missing-tool-skill',
        description: 'Missing tool',
        agents: [],
        version: '1.0.0',
        requiredTools: ['nonexistent-tool'],
        steps: [
          { name: 'step1', tool: 'nonexistent-tool', buildArgs: () => ({}) },
        ],
      });

      const result = await runner.execute('missing-tool-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required tools');
    });

    it('execute() returns success: false when a step throws an exception', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      const throwingTool: Tool = {
        name: 'throwing-tool',
        description: 'Throws error',
        parameters: z.object({}),
        execute: vi.fn().mockRejectedValue(new Error('Tool crashed')),
        allowedAgents: [],
        blockedAgents: [],
        mutating: false,
        timeout: 5000,
      };
      getToolRegistry().register(throwingTool);

      registry.register({
        name: 'throwing-skill',
        description: 'Throwing skill',
        agents: [],
        version: '1.0.0',
        requiredTools: ['throwing-tool'],
        steps: [
          { name: 'throw-step', tool: 'throwing-tool', buildArgs: () => ({}) },
        ],
      });

      const result = await runner.execute('throwing-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool crashed');
    });

    it('execute() never throws — always returns a SkillRunResult', async () => {
      const runner = getSkillRunner();

      // Execute with unknown skill - should not throw
      const result = await runner.execute('unknown', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  describe('Result formatting', () => {
    it('formatResultForPrompt() returns a string containing the skill name', () => {
      const runner = getSkillRunner();
      const result = runner.formatResultForPrompt({
        skillName: 'my-skill',
        success: true,
        stepsCompleted: 2,
        totalSteps: 2,
        stepResults: { step1: 'result1', step2: 'result2' },
        durationMs: 1000,
      });

      expect(result).toContain('my-skill');
    });

    it('formatResultForPrompt() includes step names and truncated results for success', () => {
      const runner = getSkillRunner();
      const result = runner.formatResultForPrompt({
        skillName: 'my-skill',
        success: true,
        stepsCompleted: 1,
        totalSteps: 1,
        stepResults: { 'my-step': 'some result' },
        durationMs: 500,
      });

      expect(result).toContain('my-step');
      expect(result).toContain('some result');
    });

    it('formatResultForPrompt() includes "Failed at step" and error for failure', () => {
      const runner = getSkillRunner();
      const result = runner.formatResultForPrompt({
        skillName: 'my-skill',
        success: false,
        stepsCompleted: 0,
        totalSteps: 2,
        stepResults: {},
        failedStep: 'failed-step',
        error: 'Something went wrong',
        durationMs: 100,
      });

      expect(result).toContain('Failed at step');
      expect(result).toContain('failed-step');
      expect(result).toContain('Something went wrong');
    });

    it('formatResultForPrompt() output is at most 1000 characters', () => {
      const runner = getSkillRunner();
      const longResult = 'a'.repeat(500);
      const result = runner.formatResultForPrompt({
        skillName: 'my-skill',
        success: true,
        stepsCompleted: 1,
        totalSteps: 1,
        stepResults: { step1: longResult },
        durationMs: 100,
      });

      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Timing', () => {
    it('execute() includes durationMs in the result', async () => {
      const registry = getSkillRegistry();
      const runner = getSkillRunner();

      registerMockTool('fast-tool', { success: true, output: 'ok', duration: 10, truncated: false });

      registry.register({
        name: 'fast-skill',
        description: 'Fast skill',
        agents: [],
        version: '1.0.0',
        requiredTools: ['fast-tool'],
        steps: [
          { name: 'fast-step', tool: 'fast-tool', buildArgs: () => ({}) },
        ],
      });

      const result = await runner.execute('fast-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('execute() sets durationMs to 0 for immediate unknown-skill failure', async () => {
      const runner = getSkillRunner();

      const result = await runner.execute('unknown-skill', {
        agentName: 'TEST',
        taskDescription: 'Test',
        workingDir: process.cwd(),
        inputs: {},
        stepResults: {},
      });

      expect(result.durationMs).toBe(0);
    });
  });
});
