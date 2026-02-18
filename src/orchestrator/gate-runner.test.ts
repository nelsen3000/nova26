import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runGates,
  allGatesPassed,
  getGatesSummary,
  clearHardLimitsCache,
} from './gate-runner.js';
import type { Task, LLMResponse, GateResult } from '../types/index.js';

// Use SUN agent (no hard limits configured) for most tests to isolate gate logic.
// Use EARTH agent only when testing hard-limits interaction.
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'T1',
    title: 'Test Task',
    description: 'A test task',
    agent: 'SUN', // SUN has no hard limits
    status: 'running',
    dependencies: [],
    phase: 1,
    attempts: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeResponse(content: string): LLMResponse {
  return {
    content,
    model: 'qwen2.5:7b',
    duration: 1000,
    tokens: 500,
  };
}

function mockLLMCaller(responseContent: string) {
  return vi.fn().mockResolvedValue({
    content: responseContent,
    model: 'mock',
    duration: 100,
    tokens: 50,
  });
}

// Helper to find a gate result by name
function findGate(results: GateResult[], gate: string): GateResult | undefined {
  return results.find(r => r.gate === gate);
}

beforeEach(() => {
  clearHardLimitsCache();
});

describe('runGates', () => {
  it('passes with valid response and gates disabled', async () => {
    const task = makeTask();
    const response = makeResponse('This is a valid response with sufficient content.');
    const results = await runGates(task, response, { enabled: false, gates: [] });

    const allGate = findGate(results, 'all');
    expect(allGate).toBeDefined();
    expect(allGate!.passed).toBe(true);
  });

  it('runs response-validation gate on valid response', async () => {
    const task = makeTask();
    const response = makeResponse('This is a valid response with sufficient content for testing.');
    const results = await runGates(task, response, {
      enabled: true,
      gates: ['response-validation'],
    });

    const rv = findGate(results, 'response-validation');
    expect(rv).toBeDefined();
    expect(rv!.passed).toBe(true);
  });

  it('fails response-validation on empty content', async () => {
    const task = makeTask();
    const response = makeResponse('');
    const results = await runGates(task, response, {
      enabled: true,
      gates: ['response-validation'],
    });

    const rv = findGate(results, 'response-validation');
    expect(rv).toBeDefined();
    expect(rv!.passed).toBe(false);
    expect(rv!.message).toContain('empty');
  });

  it('fails response-validation on very short response', async () => {
    const task = makeTask();
    const response = makeResponse('hi');
    const results = await runGates(task, response, {
      enabled: true,
      gates: ['response-validation'],
    });

    const rv = findGate(results, 'response-validation');
    expect(rv).toBeDefined();
    expect(rv!.passed).toBe(false);
    expect(rv!.message).toContain('too short');
  });

  it('fails response-validation on short error-like responses', async () => {
    const task = makeTask();
    const response = makeResponse('error occurred during processing');
    const results = await runGates(task, response, {
      enabled: true,
      gates: ['response-validation'],
    });

    const rv = findGate(results, 'response-validation');
    expect(rv).toBeDefined();
    expect(rv!.passed).toBe(false);
  });

  it('passes response-validation on long responses containing error words', async () => {
    const task = makeTask();
    const longContent = 'This is a detailed response about error handling patterns. ' +
      'We need to handle errors gracefully by catching exceptions and logging them. ' +
      'The error boundary component wraps all child components to prevent crashes.';
    const response = makeResponse(longContent);
    const results = await runGates(task, response, {
      enabled: true,
      gates: ['response-validation'],
    });

    const rv = findGate(results, 'response-validation');
    expect(rv).toBeDefined();
    expect(rv!.passed).toBe(true);
  });

  it('stops on first configured gate failure', async () => {
    const task = makeTask();
    const response = makeResponse('short'); // will fail response-validation
    const results = await runGates(task, response, {
      enabled: true,
      gates: ['response-validation', 'mercury-validator'],
    });

    // response-validation should fail, mercury-validator should not run
    const rv = findGate(results, 'response-validation');
    const mv = findGate(results, 'mercury-validator');
    expect(rv).toBeDefined();
    expect(rv!.passed).toBe(false);
    expect(mv).toBeUndefined(); // never ran
  });

  it('runs mercury-validator with mock LLM returning PASS', async () => {
    const task = makeTask(); // SUN - no hard limits
    const response = makeResponse('Here is a full PRD with goals, scope, and requirements for the project.');
    const llm = mockLLMCaller('PASS - Response contains all required specification elements');

    const results = await runGates(task, response, {
      enabled: true,
      gates: ['mercury-validator'],
      llmCaller: llm,
    });

    const mv = findGate(results, 'mercury-validator');
    expect(mv).toBeDefined();
    expect(mv!.passed).toBe(true);
    expect(llm).toHaveBeenCalledOnce();
  });

  it('runs mercury-validator with mock LLM returning FAIL', async () => {
    const task = makeTask();
    const response = makeResponse('Incomplete response without required sections.');
    const llm = mockLLMCaller('FAIL - Missing required sections');

    const results = await runGates(task, response, {
      enabled: true,
      gates: ['mercury-validator'],
      llmCaller: llm,
    });

    const mv = findGate(results, 'mercury-validator');
    expect(mv).toBeDefined();
    expect(mv!.passed).toBe(false);
    expect(mv!.message).toContain('Missing required sections');
  });

  it('falls back to keyword validation when LLM fails', async () => {
    // Use EARTH and provide content that passes its hard limits + keywords
    const task = makeTask({ agent: 'EARTH' });
    const response = makeResponse(
      '## Fields\nname: string\n\n## Constraints\nunique name\n\n## Validation\nrequired fields\n\n' +
      'This spec defines all fields, constraints, and validation rules.'
    );
    const llm = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const results = await runGates(task, response, {
      enabled: true,
      gates: ['mercury-validator'],
      llmCaller: llm,
    });

    // Should pass via keyword fallback (EARTH keywords: spec, field, constraint, validation)
    const mv = findGate(results, 'mercury-validator');
    expect(mv).toBeDefined();
    expect(mv!.passed).toBe(true);
    expect(mv!.message).toContain('fallback');
  });

  it('passes unknown gate names by default', async () => {
    const task = makeTask();
    const response = makeResponse('Some valid response content for testing purposes.');
    const results = await runGates(task, response, {
      enabled: true,
      gates: ['unknown-gate'],
    });

    const ug = findGate(results, 'unknown-gate');
    expect(ug).toBeDefined();
    expect(ug!.passed).toBe(true);
    expect(ug!.message).toContain('Unknown gate');
  });
});

describe('hard limits', () => {
  it('fails EARTH tasks missing required sections', async () => {
    const task = makeTask({ agent: 'EARTH' });
    const response = makeResponse('Just a plain response without required headings.');
    const results = await runGates(task, response, { enabled: true, gates: [] });

    // Should have SEVERE hard limit failures
    const hardLimitFails = results.filter(r => r.gate.startsWith('hard-limit:') && !r.passed);
    expect(hardLimitFails.length).toBeGreaterThan(0);
    expect(hardLimitFails.some(r => r.message.includes('## Fields'))).toBe(true);
  });

  it('passes EARTH tasks with all required sections', async () => {
    const task = makeTask({ agent: 'EARTH' });
    const response = makeResponse(
      '## Fields\nname: string\nemail: string\n\n## Constraints\nemail must be unique\n\n## Validation\nname required'
    );
    const results = await runGates(task, response, { enabled: false, gates: [] });

    const hardLimitFails = results.filter(r => r.gate.startsWith('hard-limit:') && !r.passed);
    expect(hardLimitFails).toHaveLength(0);
  });

  it('stops immediately on SEVERE hard limit failure', async () => {
    const task = makeTask({ agent: 'EARTH' });
    const response = makeResponse('No required sections at all.');
    const results = await runGates(task, response, {
      enabled: true,
      gates: ['response-validation', 'mercury-validator'],
    });

    // SEVERE hard limit should cause immediate return — no configured gates should run
    const rv = findGate(results, 'response-validation');
    expect(rv).toBeUndefined(); // never ran due to SEVERE failure
  });

  it('does not run hard limits for agents without configured limits', async () => {
    const task = makeTask({ agent: 'SUN' }); // SUN has no hard limits
    const response = makeResponse('A simple PRD outline.');
    const results = await runGates(task, response, {
      enabled: true,
      gates: ['response-validation'],
    });

    const hardLimits = results.filter(r => r.gate.startsWith('hard-limit:'));
    expect(hardLimits).toHaveLength(0);
  });
});

describe('allGatesPassed', () => {
  it('returns true when all gates pass', () => {
    const results: GateResult[] = [
      { gate: 'a', passed: true, message: 'ok' },
      { gate: 'b', passed: true, message: 'ok' },
    ];
    expect(allGatesPassed(results)).toBe(true);
  });

  it('returns false when any gate fails', () => {
    const results: GateResult[] = [
      { gate: 'a', passed: true, message: 'ok' },
      { gate: 'b', passed: false, message: 'failed' },
    ];
    expect(allGatesPassed(results)).toBe(false);
  });

  it('returns true for empty results', () => {
    expect(allGatesPassed([])).toBe(true);
  });
});

describe('getGatesSummary', () => {
  it('summarizes all passing', () => {
    const results: GateResult[] = [
      { gate: 'a', passed: true, message: 'ok' },
      { gate: 'b', passed: true, message: 'ok' },
    ];
    const summary = getGatesSummary(results);
    expect(summary).toContain('2 passed');
    expect(summary).toContain('0 failed');
  });

  it('summarizes failures with gate names', () => {
    const results: GateResult[] = [
      { gate: 'response-validation', passed: true, message: 'ok' },
      { gate: 'mercury-validator', passed: false, message: 'nope' },
    ];
    const summary = getGatesSummary(results);
    expect(summary).toContain('1 passed');
    expect(summary).toContain('1 failed');
    expect(summary).toContain('mercury-validator');
  });
});
