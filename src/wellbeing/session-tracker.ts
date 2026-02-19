import { randomUUID } from 'crypto';
import type { DeveloperState, WellbeingSignal } from './signal-detector.js';

export interface SessionSummary {
  sessionId: string;
  projectId: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes: number;
  builds: BuildRecord[];
  tasks: TaskRecord[];
  milestones: MilestoneRecord[];
  stateVisits: StateVisit[];
  velocity: number;
  narrative: string;
}

export interface BuildRecord {
  id: string;
  timestamp: string;
  success: boolean;
  durationMs: number;
}

export interface TaskRecord {
  id: string;
  taskId: string;
  startedAt: string;
  completedAt?: string;
  status: 'in-progress' | 'completed' | 'abandoned';
}

export interface MilestoneRecord {
  id: string;
  type: string;
  description: string;
  reachedAt: string;
  signal: WellbeingSignal;
}

export interface StateVisit {
  state: DeveloperState;
  enteredAt: string;
  exitedAt?: string;
  durationMinutes: number;
}

export class SessionTracker {
  startSession(projectId: string): SessionSummary {
    return {
      sessionId: randomUUID(),
      projectId,
      startedAt: new Date().toISOString(),
      endedAt: undefined,
      durationMinutes: 0,
      builds: [],
      tasks: [],
      milestones: [],
      stateVisits: [],
      velocity: 0,
      narrative: '',
    };
  }

  recordBuild(session: SessionSummary, success: boolean, durationMs: number): SessionSummary {
    const build: BuildRecord = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      success,
      durationMs,
    };
    return {
      ...session,
      builds: [...session.builds, build],
    };
  }

  recordTask(session: SessionSummary, taskId: string, status: 'in-progress' | 'completed' | 'abandoned'): SessionSummary {
    // Check if task already exists
    const existingIndex = session.tasks.findIndex(t => t.taskId === taskId);
    if (existingIndex >= 0) {
      const updatedTasks = session.tasks.map((t, i) => {
        if (i === existingIndex) {
          return {
            ...t,
            status,
            completedAt: status !== 'in-progress' ? new Date().toISOString() : t.completedAt,
          };
        }
        return t;
      });
      return { ...session, tasks: updatedTasks };
    }
    const task: TaskRecord = {
      id: randomUUID(),
      taskId,
      startedAt: new Date().toISOString(),
      completedAt: status !== 'in-progress' ? new Date().toISOString() : undefined,
      status,
    };
    return {
      ...session,
      tasks: [...session.tasks, task],
    };
  }

  recordMilestone(session: SessionSummary, type: string, description: string, signal: WellbeingSignal): SessionSummary {
    const milestone: MilestoneRecord = {
      id: randomUUID(),
      type,
      description,
      reachedAt: new Date().toISOString(),
      signal,
    };
    return {
      ...session,
      milestones: [...session.milestones, milestone],
    };
  }

  recordStateVisit(session: SessionSummary, state: DeveloperState): SessionSummary {
    const now = new Date().toISOString();
    // Close the previous open state visit
    const updatedVisits = session.stateVisits.map((v, i) => {
      if (i === session.stateVisits.length - 1 && v.exitedAt === undefined) {
        const enteredMs = new Date(v.enteredAt).getTime();
        const nowMs = new Date(now).getTime();
        return {
          ...v,
          exitedAt: now,
          durationMinutes: Math.floor((nowMs - enteredMs) / 60000),
        };
      }
      return v;
    });
    const newVisit: StateVisit = {
      state,
      enteredAt: now,
      exitedAt: undefined,
      durationMinutes: 0,
    };
    return {
      ...session,
      stateVisits: [...updatedVisits, newVisit],
    };
  }

  computeVelocity(session: SessionSummary): number {
    const completedTasks = session.tasks.filter(t => t.status === 'completed');
    if (session.durationMinutes <= 0) return 0;
    // Tasks per hour
    return (completedTasks.length / session.durationMinutes) * 60;
  }

  endSession(session: SessionSummary): SessionSummary {
    const now = new Date();
    const startMs = new Date(session.startedAt).getTime();
    const durationMinutes = Math.floor((now.getTime() - startMs) / 60000);

    // Close any open state visit
    const nowIso = now.toISOString();
    const updatedVisits = session.stateVisits.map((v, i) => {
      if (i === session.stateVisits.length - 1 && v.exitedAt === undefined) {
        const enteredMs = new Date(v.enteredAt).getTime();
        return {
          ...v,
          exitedAt: nowIso,
          durationMinutes: Math.floor((now.getTime() - enteredMs) / 60000),
        };
      }
      return v;
    });

    const updatedSession: SessionSummary = {
      ...session,
      endedAt: nowIso,
      durationMinutes,
      stateVisits: updatedVisits,
    };

    const velocity = this.computeVelocity(updatedSession);
    const narrative = this.generateNarrative(updatedSession);

    return {
      ...updatedSession,
      velocity,
      narrative,
    };
  }

  generateNarrative(session: SessionSummary): string {
    const parts: string[] = [];

    parts.push(`Session lasted ${session.durationMinutes} minutes.`);

    const totalBuilds = session.builds.length;
    const successfulBuilds = session.builds.filter(b => b.success).length;
    if (totalBuilds > 0) {
      parts.push(`${successfulBuilds}/${totalBuilds} builds succeeded.`);
    } else {
      parts.push('No builds recorded.');
    }

    const completedTasks = session.tasks.filter(t => t.status === 'completed').length;
    const abandonedTasks = session.tasks.filter(t => t.status === 'abandoned').length;
    const totalTasks = session.tasks.length;
    if (totalTasks > 0) {
      parts.push(`${completedTasks} tasks completed, ${abandonedTasks} abandoned out of ${totalTasks} total.`);
    } else {
      parts.push('No tasks recorded.');
    }

    if (session.milestones.length > 0) {
      parts.push(`${session.milestones.length} milestone(s) reached.`);
    }

    if (session.stateVisits.length > 0) {
      const stateNames = [...new Set(session.stateVisits.map(v => v.state))];
      parts.push(`Developer states visited: ${stateNames.join(', ')}.`);
    }

    return parts.join(' ');
  }
}
