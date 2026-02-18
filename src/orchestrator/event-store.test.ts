import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventStore, createEventStore } from './event-store.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_EVENTS_DIR = join(process.cwd(), '.nova', 'events');

// Clean up test events before/after
function cleanEvents() {
  if (existsSync(TEST_EVENTS_DIR)) {
    rmSync(TEST_EVENTS_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_EVENTS_DIR, { recursive: true });
}

beforeEach(() => cleanEvents());
afterEach(() => cleanEvents());

describe('EventStore', () => {
  it('creates a new session with session_start event', () => {
    const store = createEventStore('/tmp/test.json');
    const state = store.getState();

    expect(state.sessionId).toMatch(/^session-/);
    expect(state.status).toBe('running');
    expect(state.totalEvents).toBe(1); // session_start
    expect(state.completedTaskIds).toEqual([]);
    expect(state.failedTaskIds).toEqual([]);
  });

  it('emits events and updates state', () => {
    const store = createEventStore('/tmp/test.json');

    store.emit('task_start', { title: 'Test Task' }, 'T1', 'MARS');
    const state1 = store.getState();
    expect(state1.currentTaskId).toBe('T1');
    expect(state1.totalEvents).toBe(2);

    store.emit('task_complete', { outputPath: '/tmp/out.md' }, 'T1', 'MARS');
    const state2 = store.getState();
    expect(state2.completedTaskIds).toContain('T1');
    expect(state2.currentTaskId).toBeNull();
    expect(state2.totalEvents).toBe(3);
  });

  it('tracks failed tasks', () => {
    const store = createEventStore('/tmp/test.json');
    store.emit('task_start', {}, 'T1', 'VENUS');
    store.emit('task_fail', { error: 'Gate failed' }, 'T1', 'VENUS');

    const state = store.getState();
    expect(state.failedTaskIds).toContain('T1');
    expect(state.currentTaskId).toBeNull();
  });

  it('marks session as completed on session_end with success', () => {
    const store = createEventStore('/tmp/test.json');
    store.emit('session_end', { success: true });

    expect(store.getState().status).toBe('completed');
  });

  it('marks session as failed on session_end without success', () => {
    const store = createEventStore('/tmp/test.json');
    store.emit('session_end', { success: false });

    expect(store.getState().status).toBe('failed');
  });
});

describe('replay', () => {
  it('replays all events from a session', () => {
    const store = createEventStore('/tmp/test.json');
    const sid = store.getState().sessionId;

    store.emit('task_start', {}, 'T1', 'MARS');
    store.emit('llm_call_complete', { model: 'qwen2.5:7b', tokens: 500 }, 'T1', 'MARS');
    store.emit('task_complete', {}, 'T1', 'MARS');

    const events = EventStore.replay(sid);
    expect(events.length).toBe(4); // session_start + 3
    expect(events[0].type).toBe('session_start');
    expect(events[1].type).toBe('task_start');
    expect(events[3].type).toBe('task_complete');
  });

  it('returns empty array for unknown session', () => {
    expect(EventStore.replay('nonexistent-session')).toEqual([]);
  });
});

describe('crash recovery (C-06)', () => {
  it('resumes a session after simulated crash', () => {
    // Phase 1: Create a session and complete some tasks, then "crash"
    const store = createEventStore('/tmp/test-prd.json');
    const sid = store.getState().sessionId;

    // Task 1: complete
    store.emit('task_start', { title: 'PRD' }, 'T1', 'EARTH');
    store.emit('llm_call_complete', { tokens: 200 }, 'T1', 'EARTH');
    store.emit('task_complete', {}, 'T1', 'EARTH');

    // Task 2: start but "crash" mid-execution
    store.emit('task_start', { title: 'Schema' }, 'T2', 'PLUTO');
    store.emit('llm_call_start', {}, 'T2', 'PLUTO');
    // --- SIMULATED CRASH HERE --- (no task_complete for T2)

    // Verify pre-crash state
    const preCrashState = store.getState();
    expect(preCrashState.completedTaskIds).toEqual(['T1']);
    expect(preCrashState.currentTaskId).toBe('T2');
    expect(preCrashState.totalEvents).toBe(6);

    // Phase 2: Resume from crash
    const resumed = EventStore.resume(sid);
    expect(resumed).not.toBeNull();
    expect(resumed!.completedTaskIds).toEqual(['T1']);

    const resumedStore = resumed!.store;
    const resumedState = resumedStore.getState();
    expect(resumedState.status).toBe('running');

    // T2 was in progress — re-run it
    resumedStore.emit('task_start', { title: 'Schema', retried: true }, 'T2', 'PLUTO');
    resumedStore.emit('llm_call_complete', { tokens: 300 }, 'T2', 'PLUTO');
    resumedStore.emit('task_complete', {}, 'T2', 'PLUTO');

    const finalState = resumedStore.getState();
    expect(finalState.completedTaskIds).toContain('T1');
    expect(finalState.completedTaskIds).toContain('T2');
    expect(finalState.currentTaskId).toBeNull();
  });

  it('loadState returns saved state from disk', () => {
    const store = createEventStore('/tmp/test.json');
    const sid = store.getState().sessionId;
    store.emit('task_start', {}, 'T1', 'MARS');
    store.emit('task_complete', {}, 'T1', 'MARS');

    // Load from disk (as if process restarted)
    const loaded = EventStore.loadState(sid);
    expect(loaded).not.toBeNull();
    expect(loaded!.completedTaskIds).toEqual(['T1']);
    expect(loaded!.totalEvents).toBe(3);
  });

  it('returns null for unknown session resume', () => {
    expect(EventStore.resume('nonexistent')).toBeNull();
    expect(EventStore.loadState('nonexistent')).toBeNull();
  });

  it('checkpoint creates a save point for resumption', () => {
    const store = createEventStore('/tmp/test.json');
    const sid = store.getState().sessionId;

    store.emit('task_start', {}, 'T1', 'EARTH');
    store.emit('task_complete', {}, 'T1', 'EARTH');
    store.checkpoint('After T1 complete', { tasks: [{ id: 'T1', status: 'done' }] });

    store.emit('task_start', {}, 'T2', 'PLUTO');
    store.emit('task_complete', {}, 'T2', 'PLUTO');

    // Events since checkpoint should only include T2 events
    const sinceCheckpoint = EventStore.getEventsSinceCheckpoint(sid);
    expect(sinceCheckpoint.length).toBe(2);
    expect(sinceCheckpoint[0].type).toBe('task_start');
    expect(sinceCheckpoint[0].taskId).toBe('T2');
  });

  it('listSessions returns all sessions sorted by recency', () => {
    createEventStore('/tmp/a.json');
    // Small delay to ensure different timestamps
    const store2 = createEventStore('/tmp/b.json');
    store2.emit('task_start', {}, 'T1', 'MARS');

    const sessions = EventStore.listSessions();
    expect(sessions.length).toBe(2);
    // Most recent should be first
    expect(new Date(sessions[0].lastEventAt).getTime())
      .toBeGreaterThanOrEqual(new Date(sessions[1].lastEventAt).getTime());
  });
});
