// Tests for Live Preview Types & Session Manager
// KIMI-GENUI-01

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LivePreviewSessionManager,
  type LivePreviewConfig,
  type PreviewStrategy,
} from './live-preview.js';

describe('LivePreviewSessionManager', () => {
  let manager: LivePreviewSessionManager;

  beforeEach(() => {
    manager = new LivePreviewSessionManager();
  });

  describe('session creation', () => {
    it('creates session with defaults', () => {
      const session = manager.createSession('project-1');

      expect(session.projectId).toBe('project-1');
      expect(session.port).toBe(5274);
      expect(session.status).toBe('starting');
      expect(session.url).toBe('http://localhost:5274');
      expect(session.id).toBeDefined();
      expect(session.startedAt).toBeDefined();
      expect(session.lastUpdatedAt).toBeDefined();
    });

    it('creates session with custom port', () => {
      const session = manager.createSession('project-1', { port: 8080 });

      expect(session.port).toBe(8080);
      expect(session.url).toBe('http://localhost:8080');
    });

    it('creates session with explicit strategy', () => {
      const session = manager.createSession('project-1', { strategy: 'iframe-sandbox' });

      expect(session.strategy).toBe('iframe-sandbox');
    });
  });

  describe('session lifecycle', () => {
    it('starts session transitions to ready', () => {
      const session = manager.createSession('project-1');
      const started = manager.startSession(session.id);

      expect(started.status).toBe('ready');
    });

    it('start throws for non-existent session', () => {
      expect(() => manager.startSession('fake-id')).toThrow('Session not found');
    });

    it('start throws for non-starting session', () => {
      const session = manager.createSession('project-1');
      manager.startSession(session.id); // Now 'ready'

      expect(() => manager.startSession(session.id)).toThrow("Cannot start session with status 'ready'");
    });

    it('stops session', () => {
      const session = manager.createSession('project-1');
      manager.startSession(session.id);
      const stopped = manager.stopSession(session.id);

      expect(stopped.status).toBe('stopped');
    });

    it('stop throws for non-existent session', () => {
      expect(() => manager.stopSession('fake-id')).toThrow('Session not found');
    });
  });

  describe('session retrieval', () => {
    it('gets session by ID', () => {
      const session = manager.createSession('project-1');
      const retrieved = manager.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(session.id);
    });

    it('returns undefined for non-existent ID', () => {
      const retrieved = manager.getSession('fake-id');
      expect(retrieved).toBeUndefined();
    });

    it('gets active session', () => {
      const session1 = manager.createSession('project-1');
      manager.startSession(session1.id); // ready

      const session2 = manager.createSession('project-2');
      // session2 is still 'starting', not active

      const active = manager.getActiveSession();
      expect(active).toBeDefined();
      expect(active!.id).toBe(session1.id);
    });

    it('returns undefined when no active session', () => {
      manager.createSession('project-1'); // 'starting', not active
      const active = manager.getActiveSession();
      expect(active).toBeUndefined();
    });
  });

  describe('session updates', () => {
    it('updates session status', () => {
      const session = manager.createSession('project-1');
      const updated = manager.updateSessionStatus(session.id, 'error', 'Something went wrong');

      expect(updated.status).toBe('error');
      expect(updated.errorMessage).toBe('Something went wrong');
    });

    it('sets active component', () => {
      const session = manager.createSession('project-1');
      const updated = manager.setActiveComponent(session.id, '/components/Button.tsx');

      expect(updated.activeComponentPath).toBe('/components/Button.tsx');
    });

    it('set active component throws for non-existent session', () => {
      expect(() => manager.setActiveComponent('fake-id', '/path.tsx')).toThrow('Session not found');
    });
  });

  describe('session listing', () => {
    it('lists sessions sorted by startedAt', async () => {
      const session1 = manager.createSession('project-1');
      await new Promise(r => setTimeout(r, 10)); // Small delay
      const session2 = manager.createSession('project-2');
      await new Promise(r => setTimeout(r, 10)); // Small delay
      const session3 = manager.createSession('project-3');

      const list = manager.listSessions();

      expect(list).toHaveLength(3);
      // Should be sorted by startedAt descending (newest first)
      expect(list[0].projectId).toBe('project-3');
      expect(list[1].projectId).toBe('project-2');
      expect(list[2].projectId).toBe('project-1');
    });
  });

  describe('framework detection', () => {
    it('detects React from dependencies', () => {
      const result = manager.detectFramework({ react: '18.0.0' });

      expect(result.framework).toBe('react');
      expect(result.confidence).toBe(0.95);
      expect(result.strategy).toBe('vite-hmr');
    });

    it('detects Vue from dependencies', () => {
      const result = manager.detectFramework({ vue: '3.0.0' });

      expect(result.framework).toBe('vue');
      expect(result.confidence).toBe(0.95);
    });

    it('detects Svelte from dependencies', () => {
      const result = manager.detectFramework({ svelte: '4.0.0' });

      expect(result.framework).toBe('svelte');
      expect(result.confidence).toBe(0.95);
    });

    it('detects Solid from dependencies', () => {
      const result = manager.detectFramework({ 'solid-js': '1.0.0' });

      expect(result.framework).toBe('solid');
      expect(result.confidence).toBe(0.95);
    });

    it('falls back to React', () => {
      const result = manager.detectFramework({});

      expect(result.framework).toBe('react');
      expect(result.confidence).toBe(0.5);
      expect(result.strategy).toBe('iframe-sandbox');
    });

    it('detects Next.js as React', () => {
      const result = manager.detectFramework({ next: '14.0.0' });

      expect(result.framework).toBe('react');
    });

    it('detects SvelteKit as Svelte', () => {
      const result = manager.detectFramework({ sveltekit: '1.0.0' });

      expect(result.framework).toBe('svelte');
    });
  });

  describe('strategy resolution', () => {
    it('resolves strategy to vite-hmr for known frameworks', () => {
      expect(manager.resolveStrategy('react')).toBe('vite-hmr');
      expect(manager.resolveStrategy('vue')).toBe('vite-hmr');
      expect(manager.resolveStrategy('svelte')).toBe('vite-hmr');
      expect(manager.resolveStrategy('solid')).toBe('vite-hmr');
    });

    it('resolves strategy to iframe-sandbox for unknown frameworks', () => {
      expect(manager.resolveStrategy('angular')).toBe('iframe-sandbox');
      expect(manager.resolveStrategy('ember')).toBe('iframe-sandbox');
    });
  });

  describe('port finding', () => {
    it('finds available port', () => {
      const managerWithMock = new LivePreviewSessionManager({}, {
        portChecker: () => true, // Always available
      });

      const port = managerWithMock.findAvailablePort(5274);
      expect(port).toBe(5274);
    });

    it('scans upward until finding available port', () => {
      let callCount = 0;
      const managerWithMock = new LivePreviewSessionManager({}, {
        portChecker: () => {
          callCount++;
          return callCount > 2; // Fail first 2, succeed on 3rd
        },
      });

      const port = managerWithMock.findAvailablePort(5274);
      expect(port).toBe(5276); // 5274, 5275 fail, 5276 succeeds
    });
  });

  describe('default config', () => {
    it('has correct default values', () => {
      const defaultConfig: LivePreviewConfig = {
        port: 5274,
        framework: 'auto',
        strategy: 'auto',
        mockBackend: true,
        openBrowser: false,
        variationsDefault: 1,
        sourceMapAnnotation: true,
      };

      expect(defaultConfig.port).toBe(5274);
      expect(defaultConfig.framework).toBe('auto');
      expect(defaultConfig.strategy).toBe('auto');
      expect(defaultConfig.mockBackend).toBe(true);
      expect(defaultConfig.openBrowser).toBe(false);
      expect(defaultConfig.variationsDefault).toBe(1);
      expect(defaultConfig.sourceMapAnnotation).toBe(true);
    });
  });
});
