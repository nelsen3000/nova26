// Rehearsal Stage Tests — R19-01

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RehearsalStage,
  createRehearsalStage,
} from '../rehearsal-stage.js';

describe('RehearsalStage', () => {
  let stage: RehearsalStage;

  beforeEach(() => {
    stage = new RehearsalStage();
  });

  describe('registerDevice() & getDevice()', () => {
    it('should register and retrieve a device', () => {
      const device = {
        id: 'test-device',
        name: 'iPhone 15 Pro',
        platform: 'ios' as const,
        screenSize: { width: 393, height: 852 },
        osVersion: '17.0',
      };

      stage.registerDevice(device);
      const retrieved = stage.getDevice('test-device');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('iPhone 15 Pro');
    });

    it('should return undefined for non-existent device', () => {
      const result = stage.getDevice('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should get devices by platform', () => {
      stage.registerDevice({
        id: 'ios-1',
        name: 'iPhone',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      stage.registerDevice({
        id: 'android-1',
        name: 'Pixel',
        platform: 'android',
        screenSize: { width: 400, height: 800 },
        osVersion: '14',
      });

      const iosDevices = stage.getDevicesByPlatform('ios');
      expect(iosDevices).toHaveLength(1);
      expect(iosDevices[0].id).toBe('ios-1');
    });
  });

  describe('startSession()', () => {
    it('should create a new session', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'onboarding-flow');

      expect(session).toBeDefined();
      expect(session?.status).toBe('recording');
      expect(session?.flowName).toBe('onboarding-flow');
    });

    it('should return undefined for non-existent device', () => {
      const session = stage.startSession('nonexistent', 'flow');
      expect(session).toBeUndefined();
    });
  });

  describe('recordInteraction()', () => {
    it('should record interaction in current capture', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test-flow')!;
      stage.startCapture(session.id, 'capture-1');

      const updated = stage.recordInteraction(session.id, {
        type: 'tap',
        target: 'button',
      });

      expect(updated).toBeDefined();
    });

    it('should return undefined for non-recording session', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      stage.pauseSession(session.id);

      const result = stage.recordInteraction(session.id, { type: 'tap' });
      expect(result).toBeUndefined();
    });
  });

  describe('startCapture() & endCapture()', () => {
    it('should start a new capture', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      const capture = stage.startCapture(session.id, 'login-flow');

      expect(capture).toBeDefined();
      expect(capture?.flowName).toBe('login-flow');
    });

    it('should end capture with duration', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      stage.startCapture(session.id, 'flow');
      stage.recordInteraction(session.id, { type: 'tap', target: 'button' });

      const capture = stage.endCapture(session.id);
      expect(capture?.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pauseSession() & resumeSession()', () => {
    it('should pause recording session', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      const paused = stage.pauseSession(session.id);

      expect(paused?.status).toBe('paused');
    });

    it('should resume paused session', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      stage.pauseSession(session.id);
      const resumed = stage.resumeSession(session.id);

      expect(resumed?.status).toBe('recording');
    });

    it('should return undefined for non-paused session', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      const result = stage.resumeSession(session.id); // Already recording

      expect(result).toBeUndefined();
    });
  });

  describe('completeSession()', () => {
    it('should complete session', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      const completed = stage.completeSession(session.id);

      expect(completed?.status).toBe('completed');
      expect(completed?.endTime).toBeDefined();
    });

    it('should return undefined for non-existent session', () => {
      const result = stage.completeSession('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('getSession() & getSessionsByFlow()', () => {
    it('should retrieve session by ID', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'onboarding')!;
      const retrieved = stage.getSession(session.id);

      expect(retrieved?.id).toBe(session.id);
    });

    it('should filter sessions by flow name', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      stage.startSession('device-1', 'onboarding');
      stage.startSession('device-1', 'onboarding');
      stage.startSession('device-1', 'checkout');

      const onboardingSessions = stage.getSessionsByFlow('onboarding');
      expect(onboardingSessions).toHaveLength(2);
    });
  });

  describe('generateVideoUrl()', () => {
    it('should generate URL for completed session', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      stage.completeSession(session.id);

      const url = stage.generateVideoUrl(session.id);
      expect(url).toContain('rehearsal.nova26.dev');
      expect(url).toContain(session.id);
    });

    it('should return undefined for incomplete session', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      const url = stage.generateVideoUrl(session.id);

      expect(url).toBeUndefined();
    });
  });

  describe('simulateDreamModeFlow()', () => {
    it('should return onboarding flow', () => {
      const flow = stage.simulateDreamModeFlow('onboarding');
      expect(flow.length).toBeGreaterThan(0);
      expect(flow[0].type).toBe('wait');
    });

    it('should return login flow', () => {
      const flow = stage.simulateDreamModeFlow('login');
      expect(flow.some(i => i.type === 'type')).toBe(true);
    });

    it('should return purchase flow', () => {
      const flow = stage.simulateDreamModeFlow('purchase');
      expect(flow.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown flow', () => {
      const flow = stage.simulateDreamModeFlow('unknown');
      expect(flow).toEqual([]);
    });
  });

  describe('getSessionStats()', () => {
    it('should calculate session statistics', () => {
      stage.registerDevice({
        id: 'device-1',
        name: 'Test Device',
        platform: 'ios',
        screenSize: { width: 400, height: 800 },
        osVersion: '17',
      });

      const session = stage.startSession('device-1', 'test')!;
      stage.startCapture(session.id, 'flow1');
      stage.recordInteraction(session.id, { type: 'tap' });
      stage.recordInteraction(session.id, { type: 'tap' });
      stage.endCapture(session.id);

      const stats = stage.getSessionStats(session.id);

      expect(stats?.totalCaptures).toBe(1);
      expect(stats?.totalInteractions).toBe(2);
    });

    it('should return undefined for non-existent session', () => {
      const stats = stage.getSessionStats('nonexistent');
      expect(stats).toBeUndefined();
    });
  });

  describe('createRehearsalStage()', () => {
    it('should create a new stage instance', () => {
      const stage = createRehearsalStage();
      expect(stage).toBeInstanceOf(RehearsalStage);
    });
  });
});
