import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InterventionEngine } from './intervention-engine.js';
import type { EmotionalState } from './state-machine.js';
import type { WellbeingSignal } from './signal-detector.js';

function makeState(overrides: Partial<EmotionalState> = {}): EmotionalState {
  return {
    sessionId: 'session-1',
    currentState: 'focused',
    previousState: undefined,
    stateEnteredAt: new Date().toISOString(),
    signals: [],
    compositeConfidence: 0,
    ...overrides,
  };
}

function makeSignal(overrides: Partial<WellbeingSignal> = {}): WellbeingSignal {
  return {
    id: 'signal-1',
    type: 'repeated-failure',
    confidence: 0.7,
    detectedAt: new Date().toISOString(),
    context: 'test signal',
    sessionId: 'session-1',
    projectId: 'project-1',
    ...overrides,
  };
}

describe('InterventionEngine', () => {
  let engine: InterventionEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));
    engine = new InterventionEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- getStrategies ---

  it('1. getStrategies returns 4 strategies', () => {
    const strategies = engine.getStrategies();
    expect(strategies.length).toBe(4);
  });

  it('2. getStrategies has stuck -> alternative-approach-offer strategy', () => {
    const strategies = engine.getStrategies();
    const stuck = strategies.find(s => s.triggerState === 'stuck');
    expect(stuck).toBeDefined();
    expect(stuck!.interventionType).toBe('alternative-approach-offer');
    expect(stuck!.minStateMinutes).toBe(30);
    expect(stuck!.cooldownMinutes).toBe(15);
    expect(stuck!.maxPerSession).toBe(2);
  });

  it('3. getStrategies has frustrated -> explanation-offer strategy', () => {
    const strategies = engine.getStrategies();
    const frustrated = strategies.find(s => s.triggerState === 'frustrated');
    expect(frustrated).toBeDefined();
    expect(frustrated!.interventionType).toBe('explanation-offer');
    expect(frustrated!.minStateMinutes).toBe(5);
    expect(frustrated!.cooldownMinutes).toBe(20);
    expect(frustrated!.maxPerSession).toBe(2);
  });

  it('4. getStrategies has fatigued -> break-suggestion strategy', () => {
    const strategies = engine.getStrategies();
    const fatigued = strategies.find(s => s.triggerState === 'fatigued');
    expect(fatigued).toBeDefined();
    expect(fatigued!.interventionType).toBe('break-suggestion');
    expect(fatigued!.minStateMinutes).toBe(90);
    expect(fatigued!.cooldownMinutes).toBe(30);
    expect(fatigued!.maxPerSession).toBe(1);
  });

  it('5. getStrategies has celebrating -> milestone-acknowledgment strategy', () => {
    const strategies = engine.getStrategies();
    const celebrating = strategies.find(s => s.triggerState === 'celebrating');
    expect(celebrating).toBeDefined();
    expect(celebrating!.interventionType).toBe('milestone-acknowledgment');
    expect(celebrating!.minStateMinutes).toBe(0);
    expect(celebrating!.cooldownMinutes).toBe(5);
    expect(celebrating!.maxPerSession).toBe(3);
  });

  // --- shouldIntervene ---

  it('6. shouldIntervene returns strategy for stuck state after 30+ minutes', () => {
    const state = makeState({ currentState: 'stuck' });
    const result = engine.shouldIntervene(state, 35);
    expect(result).toBeDefined();
    expect(result!.interventionType).toBe('alternative-approach-offer');
  });

  it('7. shouldIntervene returns undefined for stuck state under 30 minutes', () => {
    const state = makeState({ currentState: 'stuck' });
    const result = engine.shouldIntervene(state, 20);
    expect(result).toBeUndefined();
  });

  it('8. shouldIntervene returns strategy for frustrated state after 5+ minutes', () => {
    const state = makeState({ currentState: 'frustrated' });
    const result = engine.shouldIntervene(state, 10);
    expect(result).toBeDefined();
    expect(result!.interventionType).toBe('explanation-offer');
  });

  it('9. shouldIntervene returns undefined for focused state — no matching strategy', () => {
    const state = makeState({ currentState: 'focused' });
    const result = engine.shouldIntervene(state, 60);
    expect(result).toBeUndefined();
  });

  it('10. shouldIntervene returns strategy for celebrating state immediately (minStateMinutes 0)', () => {
    const state = makeState({ currentState: 'celebrating' });
    const result = engine.shouldIntervene(state, 0);
    expect(result).toBeDefined();
    expect(result!.interventionType).toBe('milestone-acknowledgment');
  });

  it('11. shouldIntervene returns undefined when on cooldown', () => {
    const state = makeState({ currentState: 'stuck' });
    const signal = makeSignal();
    const strategy = engine.getStrategies().find(s => s.triggerState === 'stuck')!;
    engine.recordIntervention(strategy, state, signal, 'test');
    // Still on cooldown (0 minutes elapsed)
    const result = engine.shouldIntervene(state, 35);
    expect(result).toBeUndefined();
  });

  it('12. shouldIntervene returns strategy after cooldown expires', () => {
    const state = makeState({ currentState: 'stuck' });
    const signal = makeSignal();
    const strategy = engine.getStrategies().find(s => s.triggerState === 'stuck')!;
    engine.recordIntervention(strategy, state, signal, 'test');
    // Advance time past cooldown (15 minutes)
    vi.setSystemTime(new Date('2025-01-01T12:16:00.000Z'));
    const result = engine.shouldIntervene(state, 35);
    expect(result).toBeDefined();
  });

  it('13. shouldIntervene respects maxPerSession limit', () => {
    const state = makeState({ currentState: 'stuck' });
    const signal = makeSignal();
    const strategy = engine.getStrategies().find(s => s.triggerState === 'stuck')!;

    // Record 2 interventions (max is 2)
    engine.recordIntervention(strategy, state, signal, 'test 1');
    vi.setSystemTime(new Date('2025-01-01T12:20:00.000Z'));
    engine.recordIntervention(strategy, state, signal, 'test 2');
    vi.setSystemTime(new Date('2025-01-01T12:40:00.000Z'));

    const result = engine.shouldIntervene(state, 45);
    expect(result).toBeUndefined();
  });

  // --- formatMessage ---

  it('14. formatMessage returns template for non-milestone', () => {
    const strategy = engine.getStrategies().find(s => s.triggerState === 'stuck')!;
    const state = makeState({ currentState: 'stuck' });
    const message = engine.formatMessage(strategy, state);
    expect(message).toContain('alternative approach');
  });

  it('15. formatMessage appends milestone description for milestone-acknowledgment', () => {
    const strategy = engine.getStrategies().find(s => s.triggerState === 'celebrating')!;
    const state = makeState({
      currentState: 'celebrating',
      lastMilestoneDescription: 'First successful deployment',
    });
    const message = engine.formatMessage(strategy, state);
    expect(message).toContain('First successful deployment');
  });

  it('16. formatMessage works without milestone description for milestone-acknowledgment', () => {
    const strategy = engine.getStrategies().find(s => s.triggerState === 'celebrating')!;
    const state = makeState({ currentState: 'celebrating' });
    const message = engine.formatMessage(strategy, state);
    expect(message).toContain('Great work');
  });

  // --- recordIntervention ---

  it('17. recordIntervention creates record with unique id', () => {
    const strategy = engine.getStrategies().find(s => s.triggerState === 'stuck')!;
    const state = makeState({ currentState: 'stuck' });
    const signal = makeSignal();
    const record = engine.recordIntervention(strategy, state, signal, 'test message');
    expect(record.id).toBeDefined();
    expect(record.id.length).toBeGreaterThan(0);
  });

  it('18. recordIntervention stores record retrievable via getRecords', () => {
    const strategy = engine.getStrategies().find(s => s.triggerState === 'stuck')!;
    const state = makeState({ currentState: 'stuck' });
    const signal = makeSignal();
    engine.recordIntervention(strategy, state, signal, 'test message');
    const records = engine.getRecords();
    expect(records.length).toBe(1);
    expect(records[0].message).toBe('test message');
  });

  it('19. recordIntervention sets accepted to undefined initially', () => {
    const strategy = engine.getStrategies().find(s => s.triggerState === 'stuck')!;
    const state = makeState({ currentState: 'stuck' });
    const signal = makeSignal();
    const record = engine.recordIntervention(strategy, state, signal, 'test');
    expect(record.accepted).toBeUndefined();
  });

  // --- isOnCooldown ---

  it('20. isOnCooldown returns false when no prior interventions', () => {
    const result = engine.isOnCooldown('alternative-approach-offer', 15);
    expect(result).toBe(false);
  });

  it('21. isOnCooldown returns true within cooldown window', () => {
    const strategy = engine.getStrategies().find(s => s.triggerState === 'stuck')!;
    const state = makeState({ currentState: 'stuck' });
    const signal = makeSignal();
    engine.recordIntervention(strategy, state, signal, 'test');
    // 5 minutes later, still within 15 min cooldown
    vi.setSystemTime(new Date('2025-01-01T12:05:00.000Z'));
    const result = engine.isOnCooldown('alternative-approach-offer', 15);
    expect(result).toBe(true);
  });
});
