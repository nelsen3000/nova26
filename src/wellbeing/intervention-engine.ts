import { randomUUID } from 'crypto';
import type { DeveloperState, WellbeingSignal } from './signal-detector.js';
import type { EmotionalState } from './state-machine.js';

export type InterventionType =
  | 'alternative-approach-offer'
  | 'explanation-offer'
  | 'break-suggestion'
  | 'milestone-acknowledgment';

export interface InterventionStrategy {
  triggerState: DeveloperState;
  interventionType: InterventionType;
  minStateMinutes: number;
  cooldownMinutes: number;
  maxPerSession: number;
  messageTemplate: string;
}

export interface InterventionRecord {
  id: string;
  type: InterventionType;
  triggeredAt: string;
  state: DeveloperState;
  signal: WellbeingSignal;
  message: string;
  sessionId: string;
  accepted: boolean | undefined;
}

export class InterventionEngine {
  private records: InterventionRecord[] = [];

  getStrategies(): InterventionStrategy[] {
    return [
      {
        triggerState: 'stuck',
        interventionType: 'alternative-approach-offer',
        minStateMinutes: 30,
        cooldownMinutes: 15,
        maxPerSession: 2,
        messageTemplate: 'It looks like you have been working on this for a while. Would you like me to suggest an alternative approach?',
      },
      {
        triggerState: 'frustrated',
        interventionType: 'explanation-offer',
        minStateMinutes: 5,
        cooldownMinutes: 20,
        maxPerSession: 2,
        messageTemplate: 'I notice this might be getting tricky. Would it help if I walked through what might be going wrong?',
      },
      {
        triggerState: 'fatigued',
        interventionType: 'break-suggestion',
        minStateMinutes: 90,
        cooldownMinutes: 30,
        maxPerSession: 1,
        messageTemplate: 'You have been coding for a while now. A short break might help you come back with fresh eyes.',
      },
      {
        triggerState: 'celebrating',
        interventionType: 'milestone-acknowledgment',
        minStateMinutes: 0,
        cooldownMinutes: 5,
        maxPerSession: 3,
        messageTemplate: 'Great work on reaching this milestone!',
      },
    ];
  }

  shouldIntervene(state: EmotionalState, stateAgeMinutes: number): InterventionStrategy | undefined {
    const strategies = this.getStrategies();
    const matchingStrategy = strategies.find(s => s.triggerState === state.currentState);
    if (matchingStrategy === undefined) return undefined;

    // Check minimum time in state
    if (stateAgeMinutes < matchingStrategy.minStateMinutes) return undefined;

    // Check cooldown
    if (this.isOnCooldown(matchingStrategy.interventionType, matchingStrategy.cooldownMinutes)) {
      return undefined;
    }

    // Check max per session
    const sessionRecords = this.records.filter(
      r => r.sessionId === state.sessionId && r.type === matchingStrategy.interventionType
    );
    if (sessionRecords.length >= matchingStrategy.maxPerSession) return undefined;

    return matchingStrategy;
  }

  formatMessage(strategy: InterventionStrategy, state: EmotionalState): string {
    let message = strategy.messageTemplate;
    if (state.lastMilestoneDescription !== undefined && strategy.interventionType === 'milestone-acknowledgment') {
      message = `${message} ${state.lastMilestoneDescription}`;
    }
    return message;
  }

  recordIntervention(
    strategy: InterventionStrategy,
    state: EmotionalState,
    signal: WellbeingSignal,
    message: string
  ): InterventionRecord {
    const record: InterventionRecord = {
      id: randomUUID(),
      type: strategy.interventionType,
      triggeredAt: new Date().toISOString(),
      state: state.currentState,
      signal,
      message,
      sessionId: state.sessionId,
      accepted: undefined,
    };
    this.records = [...this.records, record];
    return record;
  }

  isOnCooldown(interventionType: InterventionType, cooldownMinutes: number): boolean {
    const now = Date.now();
    const lastRecord = [...this.records]
      .reverse()
      .find(r => r.type === interventionType);
    if (lastRecord === undefined) return false;
    const triggeredMs = new Date(lastRecord.triggeredAt).getTime();
    const cooldownMs = cooldownMinutes * 60000;
    return (now - triggeredMs) < cooldownMs;
  }

  getRecords(): InterventionRecord[] {
    return [...this.records];
  }
}
