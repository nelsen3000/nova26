import { describe, it, expect } from 'vitest';
import * as wellbeing from './wellbeing-index.js';

describe('wellbeing-index barrel export', () => {
  it('1. exports SignalDetector class', () => {
    expect(wellbeing.SignalDetector).toBeDefined();
    expect(typeof wellbeing.SignalDetector).toBe('function');
  });

  it('2. exports DEFAULT_WELLBEING_CONFIG', () => {
    expect(wellbeing.DEFAULT_WELLBEING_CONFIG).toBeDefined();
    expect(wellbeing.DEFAULT_WELLBEING_CONFIG.signalDetectionEnabled).toBe(true);
  });

  it('3. exports EmotionalStateMachine class', () => {
    expect(wellbeing.EmotionalStateMachine).toBeDefined();
    expect(typeof wellbeing.EmotionalStateMachine).toBe('function');
  });

  it('4. exports InterventionEngine class', () => {
    expect(wellbeing.InterventionEngine).toBeDefined();
    expect(typeof wellbeing.InterventionEngine).toBe('function');
  });

  it('5. exports ToneAdapter class', () => {
    expect(wellbeing.ToneAdapter).toBeDefined();
    expect(typeof wellbeing.ToneAdapter).toBe('function');
  });

  it('6. exports SessionTracker class', () => {
    expect(wellbeing.SessionTracker).toBeDefined();
    expect(typeof wellbeing.SessionTracker).toBe('function');
  });

  it('7. SignalDetector is instantiable', () => {
    const detector = new wellbeing.SignalDetector();
    expect(detector).toBeDefined();
  });

  it('8. EmotionalStateMachine is instantiable', () => {
    const machine = new wellbeing.EmotionalStateMachine();
    expect(machine).toBeDefined();
  });

  it('9. InterventionEngine is instantiable', () => {
    const engine = new wellbeing.InterventionEngine();
    expect(engine).toBeDefined();
  });

  it('10. ToneAdapter is instantiable', () => {
    const adapter = new wellbeing.ToneAdapter();
    expect(adapter).toBeDefined();
  });
});
