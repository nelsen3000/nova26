import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionTracker } from './session-tracker.js';
import type { SessionSummary } from './session-tracker.js';
import type { WellbeingSignal } from './signal-detector.js';

function makeSignal(overrides: Partial<WellbeingSignal> = {}): WellbeingSignal {
  return {
    id: 'signal-1',
    type: 'milestone-reached',
    confidence: 1.0,
    detectedAt: new Date().toISOString(),
    context: 'test milestone',
    sessionId: 'session-1',
    projectId: 'project-1',
    ...overrides,
  };
}

describe('SessionTracker', () => {
  let tracker: SessionTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T10:00:00.000Z'));
    tracker = new SessionTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- startSession ---

  it('1. startSession creates session with unique id', () => {
    const session = tracker.startSession('project-1');
    expect(session.sessionId).toBeDefined();
    expect(session.sessionId.length).toBeGreaterThan(0);
  });

  it('2. startSession sets projectId', () => {
    const session = tracker.startSession('project-abc');
    expect(session.projectId).toBe('project-abc');
  });

  it('3. startSession initializes empty arrays', () => {
    const session = tracker.startSession('project-1');
    expect(session.builds).toEqual([]);
    expect(session.tasks).toEqual([]);
    expect(session.milestones).toEqual([]);
    expect(session.stateVisits).toEqual([]);
  });

  it('4. startSession has ISO 8601 startedAt', () => {
    const session = tracker.startSession('project-1');
    expect(session.startedAt).toBe('2025-01-01T10:00:00.000Z');
  });

  // --- recordBuild ---

  it('5. recordBuild adds a build record', () => {
    const session = tracker.startSession('project-1');
    const updated = tracker.recordBuild(session, true, 5000);
    expect(updated.builds.length).toBe(1);
    expect(updated.builds[0].success).toBe(true);
    expect(updated.builds[0].durationMs).toBe(5000);
  });

  it('6. recordBuild is immutable — original unchanged', () => {
    const session = tracker.startSession('project-1');
    const updated = tracker.recordBuild(session, true, 5000);
    expect(session.builds.length).toBe(0);
    expect(updated.builds.length).toBe(1);
  });

  it('7. recordBuild accumulates builds', () => {
    let session = tracker.startSession('project-1');
    session = tracker.recordBuild(session, true, 3000);
    session = tracker.recordBuild(session, false, 2000);
    expect(session.builds.length).toBe(2);
  });

  // --- recordTask ---

  it('8. recordTask adds a new task', () => {
    const session = tracker.startSession('project-1');
    const updated = tracker.recordTask(session, 'task-1', 'in-progress');
    expect(updated.tasks.length).toBe(1);
    expect(updated.tasks[0].taskId).toBe('task-1');
    expect(updated.tasks[0].status).toBe('in-progress');
  });

  it('9. recordTask updates existing task status', () => {
    let session = tracker.startSession('project-1');
    session = tracker.recordTask(session, 'task-1', 'in-progress');
    session = tracker.recordTask(session, 'task-1', 'completed');
    expect(session.tasks.length).toBe(1);
    expect(session.tasks[0].status).toBe('completed');
  });

  it('10. recordTask sets completedAt for completed status', () => {
    let session = tracker.startSession('project-1');
    session = tracker.recordTask(session, 'task-1', 'in-progress');
    vi.setSystemTime(new Date('2025-01-01T10:30:00.000Z'));
    session = tracker.recordTask(session, 'task-1', 'completed');
    expect(session.tasks[0].completedAt).toBeDefined();
  });

  it('11. recordTask is immutable', () => {
    const session = tracker.startSession('project-1');
    const updated = tracker.recordTask(session, 'task-1', 'in-progress');
    expect(session.tasks.length).toBe(0);
    expect(updated.tasks.length).toBe(1);
  });

  // --- recordMilestone ---

  it('12. recordMilestone adds a milestone', () => {
    const session = tracker.startSession('project-1');
    const signal = makeSignal();
    const updated = tracker.recordMilestone(session, 'build', 'First build', signal);
    expect(updated.milestones.length).toBe(1);
    expect(updated.milestones[0].type).toBe('build');
    expect(updated.milestones[0].description).toBe('First build');
  });

  it('13. recordMilestone is immutable', () => {
    const session = tracker.startSession('project-1');
    const signal = makeSignal();
    const updated = tracker.recordMilestone(session, 'build', 'First build', signal);
    expect(session.milestones.length).toBe(0);
    expect(updated.milestones.length).toBe(1);
  });

  // --- recordStateVisit ---

  it('14. recordStateVisit adds a new state visit', () => {
    const session = tracker.startSession('project-1');
    const updated = tracker.recordStateVisit(session, 'focused');
    expect(updated.stateVisits.length).toBe(1);
    expect(updated.stateVisits[0].state).toBe('focused');
  });

  it('15. recordStateVisit closes previous open state visit', () => {
    let session = tracker.startSession('project-1');
    session = tracker.recordStateVisit(session, 'focused');
    vi.setSystemTime(new Date('2025-01-01T10:30:00.000Z'));
    session = tracker.recordStateVisit(session, 'stuck');
    expect(session.stateVisits.length).toBe(2);
    expect(session.stateVisits[0].exitedAt).toBeDefined();
    expect(session.stateVisits[0].durationMinutes).toBe(30);
    expect(session.stateVisits[1].exitedAt).toBeUndefined();
  });

  it('16. recordStateVisit is immutable', () => {
    const session = tracker.startSession('project-1');
    const updated = tracker.recordStateVisit(session, 'focused');
    expect(session.stateVisits.length).toBe(0);
    expect(updated.stateVisits.length).toBe(1);
  });

  // --- computeVelocity ---

  it('17. computeVelocity returns 0 for zero duration', () => {
    const session = tracker.startSession('project-1');
    const velocity = tracker.computeVelocity(session);
    expect(velocity).toBe(0);
  });

  it('18. computeVelocity returns tasks per hour', () => {
    let session = tracker.startSession('project-1');
    session = tracker.recordTask(session, 'task-1', 'completed');
    session = tracker.recordTask(session, 'task-2', 'completed');
    session = { ...session, durationMinutes: 60 };
    const velocity = tracker.computeVelocity(session);
    expect(velocity).toBe(2); // 2 tasks / 60 min * 60 = 2 per hour
  });

  // --- endSession ---

  it('19. endSession sets endedAt and computes duration', () => {
    const session = tracker.startSession('project-1');
    vi.setSystemTime(new Date('2025-01-01T11:30:00.000Z')); // 90 min later
    const ended = tracker.endSession(session);
    expect(ended.endedAt).toBeDefined();
    expect(ended.durationMinutes).toBe(90);
  });

  it('20. endSession generates narrative', () => {
    let session = tracker.startSession('project-1');
    session = tracker.recordBuild(session, true, 3000);
    session = tracker.recordTask(session, 'task-1', 'completed');
    vi.setSystemTime(new Date('2025-01-01T11:00:00.000Z'));
    const ended = tracker.endSession(session);
    expect(ended.narrative.length).toBeGreaterThan(0);
    expect(ended.narrative).toContain('60 minutes');
  });

  // --- generateNarrative ---

  it('21. generateNarrative includes build stats and task stats', () => {
    let session = tracker.startSession('project-1');
    session = tracker.recordBuild(session, true, 3000);
    session = tracker.recordBuild(session, false, 2000);
    session = tracker.recordTask(session, 'task-1', 'completed');
    session = tracker.recordTask(session, 'task-2', 'abandoned');
    session = tracker.recordStateVisit(session, 'focused');
    session = { ...session, durationMinutes: 45 };

    const narrative = tracker.generateNarrative(session);
    expect(narrative).toContain('45 minutes');
    expect(narrative).toContain('1/2 builds succeeded');
    expect(narrative).toContain('1 tasks completed');
    expect(narrative).toContain('1 abandoned');
    expect(narrative).toContain('focused');
  });
});
