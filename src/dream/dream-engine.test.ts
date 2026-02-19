// Tests for Dream Mode Engine
// KIMI-VISIONARY-01

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DreamEngine, type DreamSession, type DreamAnnotation } from './dream-engine.js';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('DreamEngine', () => {
  let tempDir: string;
  let engine: DreamEngine;

  beforeEach(() => {
    tempDir = join(tmpdir(), 'nova-dream-test-' + Date.now());
    mkdirSync(tempDir, { recursive: true });
    engine = new DreamEngine({ storagePath: tempDir, persistSimulations: false });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('createDreamSession', () => {
    it('creates a dream session from description', async () => {
      const session = await engine.createDreamSession('Build a todo app');
      
      expect(session).toBeDefined();
      expect(session.description).toBe('Build a todo app');
      expect(session.id).toBeDefined();
      expect(session.simulationHtml).toContain('<html>');
    });

    it('session starts in generating status', async () => {
      // Create engine with persistence to check internal state
      const engineWithPersist = new DreamEngine({ 
        storagePath: tempDir, 
        persistSimulations: false 
      });
      
      const sessionPromise = engineWithPersist.createDreamSession('Test app');
      
      // After awaiting, it should be ready
      const session = await sessionPromise;
      expect(session.status).toBe('ready');
    });

    it('session transitions to ready after generation', async () => {
      const session = await engine.createDreamSession('A dashboard app');
      
      expect(session.status).toBe('ready');
      expect(session.simulationHtml).toBeTruthy();
      expect(session.generationDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles empty description gracefully', async () => {
      await expect(engine.createDreamSession('')).rejects.toThrow('Description cannot be empty');
      await expect(engine.createDreamSession('   ')).rejects.toThrow('Description cannot be empty');
    });

    it('seeds taste profile from mock Taste Vault data', async () => {
      const session = await engine.createDreamSession('An app with taste');
      
      expect(session.tasteProfile).toBeDefined();
      expect(session.tasteProfile?.['preferred-layout']).toBe('clean');
    });

    it('tracks generation duration', async () => {
      const session = await engine.createDreamSession('Track duration test');
      
      expect(session.generationDurationMs).toBeGreaterThanOrEqual(0);
      expect(typeof session.generationDurationMs).toBe('number');
    });
  });

  describe('addAnnotation', () => {
    let session: DreamSession;

    beforeEach(async () => {
      session = await engine.createDreamSession('Test app');
    });

    it('adds annotations to a session', () => {
      const annotation = engine.addAnnotation(session.id, {
        targetSelector: '.header',
        feedback: 'Make this bigger',
        type: 'change',
      });

      expect(annotation).toBeDefined();
      expect(annotation.id).toBeDefined();
      expect(annotation.createdAt).toBeDefined();
      expect(annotation.sessionId).toBe(session.id);
      expect(annotation.targetSelector).toBe('.header');
    });

    it('rejects annotation when session not in annotating or ready status', async () => {
      // Approve the session first
      engine.approveSession(session.id);

      expect(() => {
        engine.addAnnotation(session.id, {
          targetSelector: '.header',
          feedback: 'Should fail',
          type: 'change',
        });
      }).toThrow('Cannot add annotations to session with status: approved');
    });

    it('changes session status to annotating when first annotation added', () => {
      expect(session.status).toBe('ready');

      engine.addAnnotation(session.id, {
        targetSelector: '.header',
        feedback: 'First annotation',
        type: 'change',
      });

      const updated = engine.getSession(session.id);
      expect(updated?.status).toBe('annotating');
    });

    it('respects maxAnnotations limit', () => {
      const limitedEngine = new DreamEngine({ 
        storagePath: tempDir, 
        persistSimulations: false,
        maxAnnotations: 2 
      });

      // Need to create a new session with the limited engine
      return limitedEngine.createDreamSession('Limited annotations').then(s => {
        limitedEngine.addAnnotation(s.id, {
          targetSelector: '.one',
          feedback: 'First',
          type: 'change',
        });

        limitedEngine.addAnnotation(s.id, {
          targetSelector: '.two',
          feedback: 'Second',
          type: 'change',
        });

        expect(() => {
          limitedEngine.addAnnotation(s.id, {
            targetSelector: '.three',
            feedback: 'Third - should fail',
            type: 'change',
          });
        }).toThrow('Maximum annotations (2) reached');
      });
    });
  });

  describe('approveSession', () => {
    it('approves a session', async () => {
      const session = await engine.createDreamSession('Approve test');
      
      const approved = engine.approveSession(session.id);
      
      expect(approved.status).toBe('approved');
      expect(approved.approvedAt).toBeDefined();
    });

    it('throws when session not found', () => {
      expect(() => engine.approveSession('non-existent-id')).toThrow('Session not found');
    });
  });

  describe('rejectSession', () => {
    it('rejects a session', async () => {
      const session = await engine.createDreamSession('Reject test');
      
      const rejected = engine.rejectSession(session.id);
      
      expect(rejected.status).toBe('rejected');
    });
  });

  describe('listSessions', () => {
    it('lists all sessions', async () => {
      await engine.createDreamSession('Session 1');
      await engine.createDreamSession('Session 2');
      await engine.createDreamSession('Session 3');

      const sessions = engine.listSessions();
      
      expect(sessions.length).toBe(3);
      expect(sessions.map(s => s.description)).toContain('Session 1');
      expect(sessions.map(s => s.description)).toContain('Session 2');
      expect(sessions.map(s => s.description)).toContain('Session 3');
    });
  });

  describe('exportConstraints', () => {
    it('exports constraints from annotations', async () => {
      const session = await engine.createDreamSession('Export constraints test');
      
      engine.addAnnotation(session.id, {
        targetSelector: '.header',
        feedback: 'Make it blue',
        type: 'change',
      });
      
      engine.addAnnotation(session.id, {
        targetSelector: '.footer',
        feedback: 'Remove this',
        type: 'remove',
      });
      
      engine.addAnnotation(session.id, {
        targetSelector: '.sidebar',
        feedback: 'Looks good',
        type: 'approve',
      });

      const constraints = engine.exportConstraints(session.id);
      
      expect(constraints.length).toBe(3);
      expect(constraints[0]).toContain('[change]');
      expect(constraints[0]).toContain('Make it blue');
      expect(constraints[0]).toContain('target: .header');
      expect(constraints[1]).toContain('[remove]');
      expect(constraints[2]).toContain('[approve]');
    });

    it('throws when session not found', () => {
      expect(() => engine.exportConstraints('non-existent')).toThrow('Session not found');
    });
  });

  describe('persistence', () => {
    it('persists sessions to disk when persistSimulations is true', async () => {
      const persistEngine = new DreamEngine({ 
        storagePath: tempDir, 
        persistSimulations: true 
      });

      const session = await persistEngine.createDreamSession('Persisted session');
      
      const filePath = join(tempDir, `${session.id}.json`);
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.description).toBe('Persisted session');
    });

    it('loads persisted sessions', async () => {
      // Create a session file manually
      const sessionId = 'test-session-123';
      const sessionData = {
        id: sessionId,
        description: 'Loaded session',
        status: 'ready',
        simulationHtml: '<html></html>',
        annotations: [],
        createdAt: new Date().toISOString(),
        generationDurationMs: 100,
      };

      mkdirSync(tempDir, { recursive: true });
      writeFileSync(join(tempDir, `${sessionId}.json`), JSON.stringify(sessionData));

      // Create engine that should load the persisted session
      const loadedEngine = new DreamEngine({ 
        storagePath: tempDir, 
        persistSimulations: true 
      });

      const sessions = loadedEngine.listSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].description).toBe('Loaded session');
    });
  });

  describe('getSession', () => {
    it('returns session by id', async () => {
      const session = await engine.createDreamSession('Get me');
      
      const retrieved = engine.getSession(session.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.description).toBe('Get me');
    });

    it('returns undefined for non-existent session', () => {
      const retrieved = engine.getSession('non-existent');
      
      expect(retrieved).toBeUndefined();
    });
  });
});
