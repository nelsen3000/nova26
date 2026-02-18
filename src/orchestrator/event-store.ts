// Event-Sourced Durable Sessions
// Records every agent action to a durable event log, enabling full replay
// and resumption at any exact point after crashes.

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type EventType =
  | 'session_start'
  | 'session_end'
  | 'task_start'
  | 'task_complete'
  | 'task_fail'
  | 'llm_call_start'
  | 'llm_call_complete'
  | 'llm_call_fail'
  | 'gate_start'
  | 'gate_pass'
  | 'gate_fail'
  | 'retry_start'
  | 'council_vote'
  | 'output_saved'
  | 'phase_promoted'
  | 'checkpoint';

export interface Event {
  id: string;
  timestamp: string;
  type: EventType;
  sessionId: string;
  taskId?: string;
  agent?: string;
  data: Record<string, unknown>;
}

export interface SessionState {
  sessionId: string;
  prdPath: string;
  startedAt: string;
  lastEventAt: string;
  completedTaskIds: string[];
  failedTaskIds: string[];
  currentTaskId: string | null;
  totalEvents: number;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
}

const EVENTS_DIR = join(process.cwd(), '.nova', 'events');

/**
 * EventStore - Append-only event log with replay capability
 */
export class EventStore {
  private sessionId: string;
  private eventFile: string;
  private stateFile: string;
  private state: SessionState;

  constructor(sessionId: string, prdPath: string) {
    this.sessionId = sessionId;

    if (!existsSync(EVENTS_DIR)) {
      mkdirSync(EVENTS_DIR, { recursive: true });
    }

    this.eventFile = join(EVENTS_DIR, `${sessionId}.jsonl`);
    this.stateFile = join(EVENTS_DIR, `${sessionId}.state.json`);

    this.state = {
      sessionId,
      prdPath,
      startedAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
      completedTaskIds: [],
      failedTaskIds: [],
      currentTaskId: null,
      totalEvents: 0,
      status: 'running',
    };
  }

  /**
   * Append an event to the log
   */
  emit(type: EventType, data: Record<string, unknown> = {}, taskId?: string, agent?: string): Event {
    const event: Event = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      sessionId: this.sessionId,
      taskId,
      agent,
      data,
    };

    // Append to JSONL file (crash-safe: one line per event)
    appendFileSync(this.eventFile, JSON.stringify(event) + '\n');

    // Update state
    this.state.lastEventAt = event.timestamp;
    this.state.totalEvents++;

    if (taskId) {
      this.state.currentTaskId = taskId;
    }

    if (type === 'task_complete' && taskId) {
      this.state.completedTaskIds.push(taskId);
      this.state.currentTaskId = null;
    }

    if (type === 'task_fail' && taskId) {
      this.state.failedTaskIds.push(taskId);
      this.state.currentTaskId = null;
    }

    if (type === 'session_end') {
      this.state.status = data.success ? 'completed' : 'failed';
    }

    // Save state checkpoint
    this.saveState();

    return event;
  }

  /**
   * Create a checkpoint (explicit save point for resumption)
   */
  checkpoint(description: string, prdSnapshot?: unknown): void {
    this.emit('checkpoint', {
      description,
      completedTasks: this.state.completedTaskIds.length,
      prdSnapshot: prdSnapshot ? JSON.stringify(prdSnapshot) : undefined,
    });
  }

  /**
   * Save current state to disk
   */
  private saveState(): void {
    writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return { ...this.state };
  }

  /**
   * Replay all events from a session
   */
  static replay(sessionId: string): Event[] {
    const eventFile = join(EVENTS_DIR, `${sessionId}.jsonl`);
    if (!existsSync(eventFile)) return [];

    const content = readFileSync(eventFile, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as Event);
  }

  /**
   * Load session state for resumption
   */
  static loadState(sessionId: string): SessionState | null {
    const stateFile = join(EVENTS_DIR, `${sessionId}.state.json`);
    if (!existsSync(stateFile)) return null;

    try {
      return JSON.parse(readFileSync(stateFile, 'utf-8')) as SessionState;
    } catch {
      return null;
    }
  }

  /**
   * Resume a session from its last state
   * Returns the event store and list of already-completed task IDs
   */
  static resume(sessionId: string): { store: EventStore; completedTaskIds: string[] } | null {
    const state = EventStore.loadState(sessionId);
    if (!state) return null;

    const store = new EventStore(sessionId, state.prdPath);
    store.state = {
      ...state,
      status: 'running',
      lastEventAt: new Date().toISOString(),
    };

    store.emit('session_start', { resumed: true, previousEvents: state.totalEvents });

    return {
      store,
      completedTaskIds: state.completedTaskIds,
    };
  }

  /**
   * List all sessions
   */
  static listSessions(): SessionState[] {
    if (!existsSync(EVENTS_DIR)) return [];

    const { readdirSync } = require('fs');
    const files = readdirSync(EVENTS_DIR) as string[];

    return files
      .filter((f: string) => f.endsWith('.state.json'))
      .map((f: string) => {
        try {
          return JSON.parse(readFileSync(join(EVENTS_DIR, f), 'utf-8')) as SessionState;
        } catch {
          return null;
        }
      })
      .filter((s: SessionState | null): s is SessionState => s !== null)
      .sort((a: SessionState, b: SessionState) =>
        new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime()
      );
  }

  /**
   * Get events since last checkpoint (for resumption)
   */
  static getEventsSinceCheckpoint(sessionId: string): Event[] {
    const events = EventStore.replay(sessionId);
    let lastCheckpointIdx = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === 'checkpoint') { lastCheckpointIdx = i; break; }
    }

    if (lastCheckpointIdx === -1) return events;
    return events.slice(lastCheckpointIdx + 1);
  }
}

/**
 * Create a new session event store
 */
export function createEventStore(prdPath: string): EventStore {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const store = new EventStore(sessionId, prdPath);
  store.emit('session_start', { prdPath });
  return store;
}
