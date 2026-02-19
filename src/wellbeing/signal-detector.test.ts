import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignalDetector } from './signal-detector.js';

describe('SignalDetector', () => {
  let detector: SignalDetector;

  beforeEach(() => {
    detector = new SignalDetector();
  });

  // --- detectRapidUndo ---

  it('1. detectRapidUndo returns signal for 6 undos in 50s', () => {
    const signal = detector.detectRapidUndo(6, 50000);
    expect(signal).toBeDefined();
    expect(signal!.type).toBe('rapid-undo');
    expect(signal!.confidence).toBeCloseTo(0.6);
  });

  it('2. detectRapidUndo returns undefined for 5 undos — threshold is >5', () => {
    const signal = detector.detectRapidUndo(5, 50000);
    expect(signal).toBeUndefined();
  });

  it('3. detectRapidUndo returns undefined for 6 undos in 90s — window exceeds 60s', () => {
    const signal = detector.detectRapidUndo(6, 90000);
    expect(signal).toBeUndefined();
  });

  it('4. detectRapidUndo returns undefined when detection disabled', () => {
    const disabledDetector = new SignalDetector({ signalDetectionEnabled: false });
    const signal = disabledDetector.detectRapidUndo(10, 30000);
    expect(signal).toBeUndefined();
  });

  // --- detectRepeatedFailure ---

  it('5. detectRepeatedFailure returns signal for 3 failures', () => {
    const signal = detector.detectRepeatedFailure(3, 'task-abc');
    expect(signal).toBeDefined();
    expect(signal!.type).toBe('repeated-failure');
    expect(signal!.confidence).toBeCloseTo(0.6);
  });

  it('6. detectRepeatedFailure returns undefined for 2 failures', () => {
    const signal = detector.detectRepeatedFailure(2, 'task-abc');
    expect(signal).toBeUndefined();
  });

  it('7. detectRepeatedFailure includes taskId in context', () => {
    const signal = detector.detectRepeatedFailure(4, 'task-xyz');
    expect(signal).toBeDefined();
    expect(signal!.context).toContain('task-xyz');
  });

  // --- detectNegativeCommitMessage ---

  it('8. detectNegativeCommitMessage detects ugh', () => {
    const signal = detector.detectNegativeCommitMessage('ugh fix this bug');
    expect(signal).toBeDefined();
    expect(signal!.type).toBe('negative-commit-message');
  });

  it('9. detectNegativeCommitMessage detects wtf case-insensitive', () => {
    const signal = detector.detectNegativeCommitMessage('WTF is going on');
    expect(signal).toBeDefined();
    expect(signal!.type).toBe('negative-commit-message');
  });

  it('10. detectNegativeCommitMessage detects multiple keywords', () => {
    const signal = detector.detectNegativeCommitMessage('ugh this is broken');
    expect(signal).toBeDefined();
    expect(signal!.confidence).toBeCloseTo(0.6);
  });

  it('11. detectNegativeCommitMessage returns undefined for clean message', () => {
    const signal = detector.detectNegativeCommitMessage('feat: add user authentication');
    expect(signal).toBeUndefined();
  });

  it('12. detectNegativeCommitMessage returns undefined when disabled', () => {
    const disabledDetector = new SignalDetector({ signalDetectionEnabled: false });
    const signal = disabledDetector.detectNegativeCommitMessage('ugh broken');
    expect(signal).toBeUndefined();
  });

  // --- detectLongSession ---

  describe('detectLongSession (with fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('13. detectLongSession returns signal after 90 minutes without build', () => {
      const sessionStart = new Date('2025-01-01T10:00:00.000Z');
      vi.setSystemTime(new Date('2025-01-01T11:31:00.000Z')); // 91 minutes later
      const signal = detector.detectLongSession(sessionStart.toISOString(), undefined);
      expect(signal).toBeDefined();
      expect(signal!.type).toBe('long-session-no-build');
    });

    it('14. detectLongSession returns undefined for short session — 30 minutes', () => {
      const sessionStart = new Date('2025-01-01T10:00:00.000Z');
      vi.setSystemTime(new Date('2025-01-01T10:30:00.000Z')); // 30 minutes later
      const signal = detector.detectLongSession(sessionStart.toISOString(), undefined);
      expect(signal).toBeUndefined();
    });

    it('15. detectLongSession returns undefined when recent build exists', () => {
      const sessionStart = new Date('2025-01-01T10:00:00.000Z');
      const recentBuild = new Date('2025-01-01T11:25:00.000Z'); // 6 mins ago
      vi.setSystemTime(new Date('2025-01-01T11:31:00.000Z')); // 91 minutes since start
      const signal = detector.detectLongSession(sessionStart.toISOString(), recentBuild.toISOString());
      expect(signal).toBeUndefined();
    });
  });

  // --- detectVelocityDrop ---

  it('16. detectVelocityDrop returns signal for 50% drop', () => {
    const signal = detector.detectVelocityDrop(5, 10);
    expect(signal).toBeDefined();
    expect(signal!.type).toBe('velocity-drop');
    expect(signal!.confidence).toBeCloseTo(0.5);
  });

  it('17. detectVelocityDrop returns undefined for 30% drop', () => {
    // 70% of baseline -> ratio 0.7 >= 0.6, so undefined
    const signal = detector.detectVelocityDrop(7, 10);
    expect(signal).toBeUndefined();
  });

  it('18. detectVelocityDrop returns undefined for zero baseline', () => {
    const signal = detector.detectVelocityDrop(5, 0);
    expect(signal).toBeUndefined();
  });

  // --- detectMilestone ---

  it('19. detectMilestone always returns signal — even when signalDetectionEnabled is false', () => {
    const disabledDetector = new SignalDetector({ signalDetectionEnabled: false });
    const signal = disabledDetector.detectMilestone('build', 'First successful build');
    expect(signal).toBeDefined();
    expect(signal.type).toBe('milestone-reached');
  });

  it('20. detectMilestone has confidence 1.0', () => {
    const signal = detector.detectMilestone('deploy', 'First deployment');
    expect(signal.confidence).toBe(1.0);
  });

  // --- aggregateSignals ---

  it('21. aggregateSignals returns 0 for empty array', () => {
    const result = detector.aggregateSignals([]);
    expect(result).toBe(0);
  });

  it('22. aggregateSignals returns single signal confidence', () => {
    const signal = {
      id: 'test-id',
      type: 'rapid-undo' as const,
      confidence: 0.7,
      detectedAt: new Date().toISOString(),
      context: 'test',
      sessionId: '',
      projectId: '',
    };
    const result = detector.aggregateSignals([signal]);
    expect(result).toBeCloseTo(0.7);
  });

  it('23. aggregateSignals compounds multiple signals — two signals at 0.5 each, result 0.75', () => {
    const makeSignal = (confidence: number) => ({
      id: 'test-id',
      type: 'rapid-undo' as const,
      confidence,
      detectedAt: new Date().toISOString(),
      context: 'test',
      sessionId: '',
      projectId: '',
    });
    const result = detector.aggregateSignals([makeSignal(0.5), makeSignal(0.5)]);
    expect(result).toBeCloseTo(0.75);
  });

  it('24. aggregateSignals clamps to 1.0', () => {
    const makeSignal = (confidence: number) => ({
      id: 'test-id',
      type: 'rapid-undo' as const,
      confidence,
      detectedAt: new Date().toISOString(),
      context: 'test',
      sessionId: '',
      projectId: '',
    });
    const result = detector.aggregateSignals([
      makeSignal(0.99),
      makeSignal(0.99),
      makeSignal(0.99),
      makeSignal(0.99),
    ]);
    expect(result).toBeLessThanOrEqual(1.0);
    expect(result).toBeGreaterThan(0.99);
  });
});
