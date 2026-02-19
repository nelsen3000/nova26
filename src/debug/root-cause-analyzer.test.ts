// Tests for Debugging & Root Cause Analysis
// KIMI-R17-03

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RootCauseAnalyzer,
  createRootCauseAnalyzer,
  parseStackTrace,
  formatVariable,
  BreakpointSchema,
  StackFrameSchema,
} from './root-cause-analyzer.js';

describe('RootCauseAnalyzer', () => {
  let analyzer: RootCauseAnalyzer;

  beforeEach(() => {
    analyzer = new RootCauseAnalyzer();
  });

  describe('createSession', () => {
    it('creates debug session', () => {
      const session = analyzer.createSession('Test Session');

      expect(session.name).toBe('Test Session');
      expect(session.status).toBe('active');
      expect(session.callStack).toHaveLength(0);
    });
  });

  describe('addBreakpoint', () => {
    it('adds breakpoint', () => {
      const session = analyzer.createSession('Test');
      const updated = analyzer.addBreakpoint(session.id, {
        file: 'src/index.ts',
        line: 10,
        type: 'line',
        enabled: true,
      });

      expect(updated.breakpoints).toHaveLength(1);
      expect(updated.breakpoints[0].file).toBe('src/index.ts');
    });

    it('sets hitCount to 0', () => {
      const session = analyzer.createSession('Test');
      const updated = analyzer.addBreakpoint(session.id, {
        file: 'src/index.ts',
        line: 10,
        type: 'line',
        enabled: true,
      });

      expect(updated.breakpoints[0].hitCount).toBe(0);
    });
  });

  describe('removeBreakpoint', () => {
    it('removes breakpoint by id', () => {
      const session = analyzer.createSession('Test');
      analyzer.addBreakpoint(session.id, { file: 'a.ts', line: 1, type: 'line', enabled: true });
      const bp2 = analyzer.addBreakpoint(session.id, { file: 'b.ts', line: 2, type: 'line', enabled: true });

      const updated = analyzer.removeBreakpoint(session.id, bp2.breakpoints[1].id);

      expect(updated.breakpoints).toHaveLength(1);
    });
  });

  describe('recordStackTrace', () => {
    it('records stack frames', () => {
      const session = analyzer.createSession('Test');
      const frames = [
        { id: 0, name: 'main', file: 'index.ts', line: 10, column: 5, locals: [] },
        { id: 1, name: 'helper', file: 'utils.ts', line: 20, column: 3, locals: [] },
      ];

      const updated = analyzer.recordStackTrace(session.id, frames);

      expect(updated.callStack).toHaveLength(2);
      expect(updated.callStack[0].name).toBe('main');
    });
  });

  describe('addLogEntry', () => {
    it('adds log with timestamp', () => {
      const session = analyzer.createSession('Test');
      const updated = analyzer.addLogEntry(session.id, {
        level: 'error',
        message: 'Something went wrong',
        source: 'index.ts',
        line: 42,
      });

      expect(updated.logs).toHaveLength(1);
      expect(updated.logs[0].message).toBe('Something went wrong');
      expect(updated.logs[0].timestamp).toBeDefined();
    });
  });

  describe('analyzeRootCause', () => {
    it('identifies suspected causes', () => {
      const session = analyzer.createSession('Test');
      const error = {
        type: 'TypeError',
        message: "Cannot read property 'x' of undefined",
        stackTrace: [
          { id: 0, name: 'processData', file: 'data.ts', line: 15, column: 10, locals: [] },
        ],
        occurredAt: new Date().toISOString(),
      };

      const analysis = analyzer.analyzeRootCause(session.id, error);

      expect(analysis.suspectedCauses.length).toBeGreaterThan(0);
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it('generates recommended fixes', () => {
      const session = analyzer.createSession('Test');
      const error = {
        type: 'Error',
        message: 'Test error',
        stackTrace: [
          { id: 0, name: 'main', file: 'main.ts', line: 10, column: 5, locals: [] },
        ],
        occurredAt: new Date().toISOString(),
      };

      const analysis = analyzer.analyzeRootCause(session.id, error);

      expect(analysis.recommendedFixes.length).toBeGreaterThan(0);
    });
  });

  describe('session control', () => {
    it('pauses session', () => {
      const session = analyzer.createSession('Test');
      const paused = analyzer.pauseSession(session.id);

      expect(paused.status).toBe('paused');
    });

    it('resumes session', () => {
      const session = analyzer.createSession('Test');
      analyzer.pauseSession(session.id);
      const resumed = analyzer.resumeSession(session.id);

      expect(resumed.status).toBe('active');
    });

    it('stops session', () => {
      const session = analyzer.createSession('Test');
      const stopped = analyzer.stopSession(session.id);

      expect(stopped.status).toBe('stopped');
      expect(stopped.stoppedAt).toBeDefined();
    });
  });

  describe('getActiveSessions', () => {
    it('returns only active sessions', () => {
      const s1 = analyzer.createSession('Active');
      const s2 = analyzer.createSession('To Stop');
      analyzer.stopSession(s2.id);

      const active = analyzer.getActiveSessions();

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(s1.id);
    });
  });
});

describe('Helper Functions', () => {
  it('createRootCauseAnalyzer creates instance', () => {
    const instance = createRootCauseAnalyzer();
    expect(instance).toBeInstanceOf(RootCauseAnalyzer);
  });

  it('parseStackTrace extracts frames', () => {
    const stack = `Error: test
    at function1 (/path/file1.ts:10:5)
    at function2 (/path/file2.ts:20:10)
    at main (/path/main.ts:30:15)`;

    const frames = parseStackTrace(stack);

    expect(frames).toHaveLength(3);
    expect(frames[0].name).toBe('function1');
    expect(frames[0].file).toBe('/path/file1.ts');
    expect(frames[0].line).toBe(10);
    expect(frames[0].column).toBe(5);
  });

  it('formatVariable formats strings', () => {
    expect(formatVariable('hello')).toBe('"hello"');
  });

  it('formatVariable formats null', () => {
    expect(formatVariable(null)).toBe('null');
  });

  it('formatVariable formats undefined', () => {
    expect(formatVariable(undefined)).toBe('undefined');
  });

  it('formatVariable formats objects', () => {
    expect(formatVariable({ a: 1 })).toBe('{"a":1}');
  });
});

describe('Zod Schemas', () => {
  it('validates breakpoint', () => {
    const bp = {
      id: 'bp1',
      file: 'test.ts',
      line: 10,
      type: 'line',
      enabled: true,
      hitCount: 0,
    };
    const result = BreakpointSchema.safeParse(bp);
    expect(result.success).toBe(true);
  });

  it('validates stack frame', () => {
    const frame = {
      id: 0,
      name: 'main',
      file: 'test.ts',
      line: 10,
      column: 5,
      locals: [],
    };
    const result = StackFrameSchema.safeParse(frame);
    expect(result.success).toBe(true);
  });
});
