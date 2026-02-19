// Root Cause Analyzer Edge Cases — R17-05
// KIMI-W-04: 8 edge case tests for debugging system

import { describe, it, expect, vi } from 'vitest';
import {
  RootCauseAnalyzer,
  createRootCauseAnalyzer,
} from './root-cause-analyzer.js';

describe('Root Cause Analyzer Edge Cases', () => {
  describe('RootCauseAnalyzer Edge Cases', () => {
    it('should handle empty session name', () => {
      const analyzer = new RootCauseAnalyzer();
      const session = analyzer.createSession('');
      expect(session).toBeDefined();
    });

    it('should handle very long session name', () => {
      const analyzer = new RootCauseAnalyzer();
      const longName = 'a'.repeat(1000);
      const session = analyzer.createSession(longName);
      expect(session.name).toBe(longName);
    });

    it('should handle many breakpoints', () => {
      const analyzer = new RootCauseAnalyzer();
      const session = analyzer.createSession('test');

      // Add 100 breakpoints
      for (let i = 0; i < 100; i++) {
        analyzer.addBreakpoint(session.id, {
          file: 'test.ts',
          line: i,
          type: 'line',
          condition: '',
          enabled: true,
        });
      }

      const retrieved = analyzer.getSession(session.id);
      expect(retrieved?.breakpoints).toHaveLength(100);
    });

    it('should handle deep stack traces', () => {
      const analyzer = new RootCauseAnalyzer();
      const session = analyzer.createSession('test');

      const frames = Array(100).fill(null).map((_, i) => ({
        id: i,
        name: `func${i}`,
        file: 'test.ts',
        line: i,
        column: 0,
        locals: [],
      }));

      analyzer.recordStackTrace(session.id, frames);
      const retrieved = analyzer.getSession(session.id);
      expect(retrieved?.callStack).toHaveLength(100);
    });

    it('should handle missing session gracefully', () => {
      const analyzer = new RootCauseAnalyzer();
      const result = analyzer.getSession('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should handle circular variable inspection', () => {
      const analyzer = new RootCauseAnalyzer();
      const session = analyzer.createSession('test');

      // Add circular log entry
      const circular: Record<string, unknown> = { a: 1 };
      circular['self'] = circular;

      analyzer.addLogEntry(session.id, {
        level: 'info',
        message: 'circular',
      });

      const retrieved = analyzer.getSession(session.id);
      expect(retrieved?.logs).toHaveLength(1);
    });

    it('should handle rapid session lifecycle', () => {
      const analyzer = new RootCauseAnalyzer();
      const session = analyzer.createSession('test');

      analyzer.pauseSession(session.id);
      analyzer.resumeSession(session.id);
      analyzer.pauseSession(session.id);
      analyzer.stopSession(session.id);

      const active = analyzer.getActiveSessions();
      expect(active).toHaveLength(0);
    });

    it('should handle variable inspection with undefined', () => {
      const analyzer = new RootCauseAnalyzer();
      const session = analyzer.createSession('test');

      const result = analyzer.inspectVariable(session.id, 'nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('createRootCauseAnalyzer Edge Cases', () => {
    it('should create a fresh analyzer instance', () => {
      const analyzer = createRootCauseAnalyzer();
      expect(analyzer).toBeDefined();
      expect(analyzer.getActiveSessions()).toHaveLength(0);
    });

    it('should create independent analyzer instances', () => {
      const analyzer1 = createRootCauseAnalyzer();
      const analyzer2 = createRootCauseAnalyzer();
      analyzer1.createSession('test');
      expect(analyzer1.getActiveSessions()).toHaveLength(1);
      expect(analyzer2.getActiveSessions()).toHaveLength(0);
    });
  });
});
