import { randomUUID } from 'crypto';

export interface WellbeingConfig {
  signalDetectionEnabled: boolean;
  interventionsEnabled: boolean;
  toneAdaptationEnabled: boolean;
  milestoneAcknowledgmentEnabled: boolean;
  sessionSummaryEnabled: boolean;
  sessionInactivityTimeoutMinutes: number;
  stuckThresholdMinutes: number;
  fatigueThresholdMinutes: number;
}

export type DeveloperState = 'focused' | 'exploring' | 'stuck' | 'frustrated' | 'fatigued' | 'celebrating';

export type SignalType =
  | 'rapid-undo'
  | 'repeated-failure'
  | 'negative-commit-message'
  | 'long-session-no-build'
  | 'rapid-task-abandonment'
  | 'velocity-drop'
  | 'milestone-reached'
  | 'successful-build-after-stuck';

export interface WellbeingSignal {
  id: string;
  type: SignalType;
  confidence: number;
  detectedAt: string;
  context: string;
  sessionId: string;
  projectId: string;
  rawData?: Record<string, unknown>;
}

export const DEFAULT_WELLBEING_CONFIG: WellbeingConfig = {
  signalDetectionEnabled: true,
  interventionsEnabled: true,
  toneAdaptationEnabled: true,
  milestoneAcknowledgmentEnabled: true,
  sessionSummaryEnabled: true,
  sessionInactivityTimeoutMinutes: 30,
  stuckThresholdMinutes: 30,
  fatigueThresholdMinutes: 90,
};

export class SignalDetector {
  private config: WellbeingConfig;

  constructor(config?: Partial<WellbeingConfig>) {
    this.config = { ...DEFAULT_WELLBEING_CONFIG, ...config };
  }

  detectRapidUndo(undoCount: number, timeWindowMs: number): WellbeingSignal | undefined {
    if (!this.config.signalDetectionEnabled) return undefined;
    if (undoCount <= 5 || timeWindowMs > 60000) return undefined;
    return {
      id: randomUUID(),
      type: 'rapid-undo',
      confidence: Math.min(1, undoCount / 10),
      detectedAt: new Date().toISOString(),
      context: `${undoCount} undos in ${timeWindowMs}ms`,
      sessionId: '',
      projectId: '',
    };
  }

  detectRepeatedFailure(failureCount: number, taskId: string): WellbeingSignal | undefined {
    if (!this.config.signalDetectionEnabled) return undefined;
    if (failureCount < 3) return undefined;
    return {
      id: randomUUID(),
      type: 'repeated-failure',
      confidence: Math.min(1, failureCount / 5),
      detectedAt: new Date().toISOString(),
      context: `${failureCount} consecutive failures on task ${taskId}`,
      sessionId: '',
      projectId: '',
    };
  }

  detectNegativeCommitMessage(message: string): WellbeingSignal | undefined {
    if (!this.config.signalDetectionEnabled) return undefined;
    const keywords = ['ugh', 'why', 'broken', 'hate', 'stupid', 'wtf', 'nothing works', 'give up', 'frustrated', 'terrible', 'awful', 'worst'];
    const lowerMessage = message.toLowerCase();
    const matchCount = keywords.filter(kw => lowerMessage.includes(kw)).length;
    if (matchCount === 0) return undefined;
    return {
      id: randomUUID(),
      type: 'negative-commit-message',
      confidence: Math.min(1, matchCount * 0.3),
      detectedAt: new Date().toISOString(),
      context: `Negative sentiment in commit: '${message.slice(0, 60)}'`,
      sessionId: '',
      projectId: '',
    };
  }

  detectLongSession(sessionStartedAt: string, lastBuildSuccessAt: string | undefined): WellbeingSignal | undefined {
    if (!this.config.signalDetectionEnabled) return undefined;
    const now = Date.now();
    const startMs = new Date(sessionStartedAt).getTime();
    const minutesSinceStart = Math.floor((now - startMs) / 60000);
    if (minutesSinceStart < this.config.fatigueThresholdMinutes) return undefined;
    if (lastBuildSuccessAt !== undefined) {
      const buildMs = new Date(lastBuildSuccessAt).getTime();
      const minutesSinceBuild = Math.floor((now - buildMs) / 60000);
      if (minutesSinceBuild < this.config.fatigueThresholdMinutes) return undefined;
    }
    return {
      id: randomUUID(),
      type: 'long-session-no-build',
      confidence: Math.min(1, minutesSinceStart / (this.config.fatigueThresholdMinutes * 2)),
      detectedAt: new Date().toISOString(),
      context: `Session running ${minutesSinceStart} minutes without successful build`,
      sessionId: '',
      projectId: '',
    };
  }

  detectVelocityDrop(recentVelocity: number, baselineVelocity: number): WellbeingSignal | undefined {
    if (!this.config.signalDetectionEnabled) return undefined;
    if (baselineVelocity <= 0) return undefined;
    const ratio = recentVelocity / baselineVelocity;
    if (ratio >= 0.6) return undefined;
    return {
      id: randomUUID(),
      type: 'velocity-drop',
      confidence: Math.min(1, 1 - ratio),
      detectedAt: new Date().toISOString(),
      context: `Velocity dropped from ${baselineVelocity} to ${recentVelocity}`,
      sessionId: '',
      projectId: '',
    };
  }

  detectMilestone(milestoneType: string, milestoneDescription: string): WellbeingSignal {
    return {
      id: randomUUID(),
      type: 'milestone-reached',
      confidence: 1.0,
      detectedAt: new Date().toISOString(),
      context: `${milestoneType}: ${milestoneDescription}`,
      sessionId: '',
      projectId: '',
    };
  }

  aggregateSignals(signals: WellbeingSignal[]): number {
    if (signals.length === 0) return 0;
    const result = 1 - signals.reduce((acc, s) => acc * (1 - s.confidence), 1);
    return Math.max(0, Math.min(1, result));
  }
}
