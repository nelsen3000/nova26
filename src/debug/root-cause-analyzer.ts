// Debugging & Root Cause Analysis
// KIMI-R17-03: R17 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type DebugSessionStatus = 'active' | 'paused' | 'stopped' | 'error';
export type BreakpointType = 'line' | 'conditional' | 'function' | 'exception';

export interface DebugSession {
  id: string;
  name: string;
  status: DebugSessionStatus;
  breakpoints: Breakpoint[];
  callStack: StackFrame[];
  variables: Variable[];
  logs: LogEntry[];
  startedAt: string;
  stoppedAt?: string;
}

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  column?: number;
  type: BreakpointType;
  condition?: string;
  enabled: boolean;
  hitCount: number;
}

export interface StackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
  column: number;
  source?: string;
  locals: Variable[];
}

export interface Variable {
  name: string;
  value: unknown;
  type: string;
  scope: 'local' | 'global' | 'closure';
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source?: string;
  line?: number;
}

export interface RootCauseAnalysis {
  sessionId: string;
  error: ErrorDetails;
  suspectedCauses: SuspectedCause[];
  recommendedFixes: RecommendedFix[];
  confidence: number;
}

export interface ErrorDetails {
  type: string;
  message: string;
  stackTrace: StackFrame[];
  occurredAt: string;
}

export interface SuspectedCause {
  id: string;
  description: string;
  location: { file: string; line: number };
  confidence: number;
  evidence: string[];
}

export interface RecommendedFix {
  id: string;
  description: string;
  code?: string;
  automatic: boolean;
  confidence: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const BreakpointSchema = z.object({
  id: z.string(),
  file: z.string(),
  line: z.number(),
  column: z.number().optional(),
  type: z.enum(['line', 'conditional', 'function', 'exception']),
  condition: z.string().optional(),
  enabled: z.boolean(),
  hitCount: z.number(),
});

export const StackFrameSchema = z.object({
  id: z.number(),
  name: z.string(),
  file: z.string(),
  line: z.number(),
  column: z.number(),
  source: z.string().optional(),
  locals: z.array(z.any()),
});

export const VariableSchema = z.object({
  name: z.string(),
  value: z.unknown(),
  type: z.string(),
  scope: z.enum(['local', 'global', 'closure']),
});

// ============================================================================
// RootCauseAnalyzer Class
// ============================================================================

export class RootCauseAnalyzer {
  private sessions = new Map<string, DebugSession>();

  createSession(name: string): DebugSession {
    const session: DebugSession = {
      id: crypto.randomUUID(),
      name,
      status: 'active',
      breakpoints: [],
      callStack: [],
      variables: [],
      logs: [],
      startedAt: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  addBreakpoint(sessionId: string, breakpoint: Omit<Breakpoint, 'id' | 'hitCount'>): DebugSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const newBreakpoint: Breakpoint = {
      ...breakpoint,
      id: crypto.randomUUID(),
      hitCount: 0,
    };

    session.breakpoints.push(newBreakpoint);
    return session;
  }

  removeBreakpoint(sessionId: string, breakpointId: string): DebugSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.breakpoints = session.breakpoints.filter(b => b.id !== breakpointId);
    return session;
  }

  recordStackTrace(sessionId: string, frames: StackFrame[]): DebugSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.callStack = frames;
    return session;
  }

  addLogEntry(sessionId: string, entry: Omit<LogEntry, 'timestamp'>): DebugSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.logs.push({ ...entry, timestamp: new Date().toISOString() });
    return session;
  }

  analyzeRootCause(sessionId: string, error: ErrorDetails): RootCauseAnalysis {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const suspectedCauses = this.identifySuspectedCauses(error, session);
    const recommendedFixes = this.generateRecommendedFixes(suspectedCauses);
    const confidence = this.calculateConfidence(suspectedCauses);

    return {
      sessionId,
      error,
      suspectedCauses,
      recommendedFixes,
      confidence,
    };
  }

  traceExecution(sessionId: string, fromLine: number, toLine: number): StackFrame[] {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    // Simulate execution trace
    return session.callStack.filter(frame => 
      frame.line >= fromLine && frame.line <= toLine
    );
  }

  inspectVariable(sessionId: string, name: string): Variable | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    return session.variables.find(v => v.name === name);
  }

  pauseSession(sessionId: string): DebugSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.status = 'paused';
    return session;
  }

  resumeSession(sessionId: string): DebugSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.status = 'active';
    return session;
  }

  stopSession(sessionId: string): DebugSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.status = 'stopped';
    session.stoppedAt = new Date().toISOString();
    return session;
  }

  getSession(id: string): DebugSession | undefined {
    return this.sessions.get(id);
  }

  getActiveSessions(): DebugSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  // ---- Private Methods ----

  private identifySuspectedCauses(error: ErrorDetails, session: DebugSession): SuspectedCause[] {
    const causes: SuspectedCause[] = [];

    // Analyze stack trace
    for (const frame of error.stackTrace.slice(0, 3)) {
      causes.push({
        id: crypto.randomUUID(),
        description: `Error originated in ${frame.name}`,
        location: { file: frame.file, line: frame.line },
        confidence: 90 - causes.length * 20,
        evidence: [`Stack frame: ${frame.name}`, `File: ${frame.file}:${frame.line}`],
      });
    }

    // Check logs for related errors
    const relatedLogs = session.logs.filter(l => 
      l.level === 'error' && l.message.includes(error.type)
    );

    if (relatedLogs.length > 0) {
      causes.push({
        id: crypto.randomUUID(),
        description: 'Previous errors of same type detected',
        location: { file: relatedLogs[0].source || 'unknown', line: relatedLogs[0].line || 0 },
        confidence: 60,
        evidence: relatedLogs.map(l => l.message),
      });
    }

    return causes;
  }

  private generateRecommendedFixes(causes: SuspectedCause[]): RecommendedFix[] {
    const fixes: RecommendedFix[] = [];

    for (const cause of causes) {
      if (cause.confidence > 70) {
        fixes.push({
          id: crypto.randomUUID(),
          description: `Fix the issue at ${cause.location.file}:${cause.location.line}`,
          automatic: cause.confidence > 85,
          confidence: cause.confidence,
        });
      }
    }

    return fixes;
  }

  private calculateConfidence(causes: SuspectedCause[]): number {
    if (causes.length === 0) return 0;
    const avg = causes.reduce((sum, c) => sum + c.confidence, 0) / causes.length;
    return Math.round(avg);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createRootCauseAnalyzer(): RootCauseAnalyzer {
  return new RootCauseAnalyzer();
}

export function parseStackTrace(stack: string): StackFrame[] {
  const lines = stack.split('\n');
  const frames: StackFrame[] = [];
  let id = 0;

  for (const line of lines) {
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    if (match) {
      frames.push({
        id: id++,
        name: match[1],
        file: match[2],
        line: parseInt(match[3]),
        column: parseInt(match[4]),
        locals: [],
      });
    }
  }

  return frames;
}

export function formatVariable(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
