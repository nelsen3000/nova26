// Rehearsal Stage — R19-01
// Dream Mode → real device capture simulation

import type { RehearsalCapture, RehearsalInteraction } from './types.js';

export interface RehearsalSession {
  id: string;
  deviceId: string;
  flowName: string;
  status: 'recording' | 'paused' | 'completed' | 'error';
  startTime: string;
  endTime?: string;
  captures: RehearsalCapture[];
}

export interface DeviceSimulator {
  id: string;
  name: string;
  platform: 'ios' | 'android';
  screenSize: { width: number; height: number };
  osVersion: string;
}

export class RehearsalStage {
  private sessions: Map<string, RehearsalSession> = new Map();
  private devices: Map<string, DeviceSimulator> = new Map();

  registerDevice(device: DeviceSimulator): void {
    this.devices.set(device.id, device);
  }

  getDevice(id: string): DeviceSimulator | undefined {
    return this.devices.get(id);
  }

  getDevicesByPlatform(platform: 'ios' | 'android'): DeviceSimulator[] {
    return Array.from(this.devices.values())
      .filter(d => d.platform === platform);
  }

  startSession(
    deviceId: string,
    flowName: string
  ): RehearsalSession | undefined {
    const device = this.devices.get(deviceId);
    if (!device) {
      return undefined;
    }

    const session: RehearsalSession = {
      id: crypto.randomUUID(),
      deviceId,
      flowName,
      status: 'recording',
      startTime: new Date().toISOString(),
      captures: [],
    };

    this.sessions.set(session.id, session);
    return session;
  }

  recordInteraction(
    sessionId: string,
    interaction: Omit<RehearsalInteraction, 'timestamp'>
  ): RehearsalSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'recording') {
      return undefined;
    }

    const capture = session.captures[session.captures.length - 1];
    if (capture) {
      capture.interactions.push({
        ...interaction,
        timestamp: Date.now(),
      });
    }

    return session;
  }

  startCapture(sessionId: string, flowName: string): RehearsalCapture | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'recording') {
      return undefined;
    }

    const capture: RehearsalCapture = {
      deviceId: session.deviceId,
      flowName,
      durationMs: 0,
      interactions: [],
    };

    session.captures.push(capture);
    return capture;
  }

  endCapture(sessionId: string): RehearsalCapture | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.captures.length === 0) {
      return undefined;
    }

    const capture = session.captures[session.captures.length - 1];
    const now = Date.now();
    const firstInteraction = capture.interactions[0]?.timestamp ?? now;
    capture.durationMs = now - firstInteraction;

    return capture;
  }

  pauseSession(sessionId: string): RehearsalSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'recording') {
      session.status = 'paused';
      return session;
    }
    return undefined;
  }

  resumeSession(sessionId: string): RehearsalSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'recording';
      return session;
    }
    return undefined;
  }

  completeSession(sessionId: string): RehearsalSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.endTime = new Date().toISOString();
      return session;
    }
    return undefined;
  }

  getSession(sessionId: string): RehearsalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionsByFlow(flowName: string): RehearsalSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.flowName === flowName);
  }

  generateVideoUrl(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (session?.status === 'completed') {
      return `https://rehearsal.nova26.dev/session/${sessionId}/video.mp4`;
    }
    return undefined;
  }

  simulateDreamModeFlow(flowName: string): RehearsalInteraction[] {
    // Pre-defined flows for common app interactions
    const flows: Record<string, RehearsalInteraction[]> = {
      'onboarding': [
        { type: 'wait', timestamp: 0 },
        { type: 'tap', target: 'get-started-button', timestamp: 1500 },
        { type: 'swipe', target: 'tutorial-carousel', timestamp: 3000 },
        { type: 'tap', target: 'continue-button', timestamp: 4500 },
      ],
      'login': [
        { type: 'wait', timestamp: 0 },
        { type: 'tap', target: 'email-field', timestamp: 500 },
        { type: 'type', target: 'email-field', value: 'user@example.com', timestamp: 1000 },
        { type: 'tap', target: 'password-field', timestamp: 1500 },
        { type: 'type', target: 'password-field', value: '********', timestamp: 2000 },
        { type: 'tap', target: 'login-button', timestamp: 2500 },
      ],
      'purchase': [
        { type: 'wait', timestamp: 0 },
        { type: 'tap', target: 'product-item', timestamp: 800 },
        { type: 'tap', target: 'add-to-cart', timestamp: 1600 },
        { type: 'tap', target: 'checkout-button', timestamp: 2400 },
        { type: 'tap', target: 'confirm-purchase', timestamp: 3200 },
      ],
    };

    return flows[flowName] ?? [];
  }

  getSessionStats(sessionId: string): {
    totalCaptures: number;
    totalInteractions: number;
    averageCaptureDuration: number;
  } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const totalInteractions = session.captures.reduce(
      (sum, c) => sum + c.interactions.length,
      0
    );

    const totalDuration = session.captures.reduce(
      (sum, c) => sum + c.durationMs,
      0
    );

    return {
      totalCaptures: session.captures.length,
      totalInteractions,
      averageCaptureDuration: session.captures.length > 0 
        ? totalDuration / session.captures.length 
        : 0,
    };
  }
}

export function createRehearsalStage(): RehearsalStage {
  return new RehearsalStage();
}
