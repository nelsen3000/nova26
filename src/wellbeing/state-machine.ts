import type { DeveloperState, SignalType, WellbeingSignal } from './signal-detector.js';

export interface EmotionalState {
  sessionId: string;
  currentState: DeveloperState;
  previousState?: DeveloperState;
  stateEnteredAt: string;
  signals: WellbeingSignal[];
  compositeConfidence: number;
  interventionCooldownUntil?: string;
  lastMilestoneAt?: string;
  lastMilestoneDescription?: string;
}

export interface TransitionRule {
  from: DeveloperState;
  to: DeveloperState;
  triggerSignals: SignalType[];
  minConfidence: number;
}

export class EmotionalStateMachine {
  processSignal(state: EmotionalState, signal: WellbeingSignal): EmotionalState {
    const updatedSignals = [...state.signals, signal];
    // Filter to last 10 minutes for composite
    const tenMinAgo = new Date(Date.now() - 10 * 60000).toISOString();
    const recentSignals = updatedSignals.filter(s => s.detectedAt >= tenMinAgo);
    const compositeConfidence = recentSignals.length > 0
      ? 1 - recentSignals.reduce((acc, s) => acc * (1 - s.confidence), 1)
      : 0;

    let newState: EmotionalState = {
      ...state,
      signals: updatedSignals,
      compositeConfidence: Math.max(0, Math.min(1, compositeConfidence)),
    };

    if (signal.type === 'milestone-reached') {
      newState.lastMilestoneAt = signal.detectedAt;
      newState.lastMilestoneDescription = signal.context;
    }

    const transitionTarget = this.shouldTransition(newState.currentState, updatedSignals);
    if (transitionTarget !== undefined) {
      newState = this.transitionState(newState, transitionTarget);
    }

    return newState;
  }

  transitionState(state: EmotionalState, newState: DeveloperState): EmotionalState {
    return {
      ...state,
      previousState: state.currentState,
      currentState: newState,
      stateEnteredAt: new Date().toISOString(),
      signals: [],
      compositeConfidence: 0,
    };
  }

  getTransitionRules(): TransitionRule[] {
    return [
      { from: 'focused', to: 'stuck', triggerSignals: ['repeated-failure', 'long-session-no-build'], minConfidence: 0.5 },
      { from: 'focused', to: 'exploring', triggerSignals: ['rapid-task-abandonment'], minConfidence: 0.3 },
      { from: 'focused', to: 'fatigued', triggerSignals: ['long-session-no-build', 'velocity-drop'], minConfidence: 0.6 },
      { from: 'stuck', to: 'frustrated', triggerSignals: ['repeated-failure', 'negative-commit-message', 'rapid-undo'], minConfidence: 0.6 },
      { from: 'stuck', to: 'focused', triggerSignals: ['successful-build-after-stuck', 'milestone-reached'], minConfidence: 0.3 },
      { from: 'exploring', to: 'focused', triggerSignals: ['successful-build-after-stuck', 'milestone-reached'], minConfidence: 0.3 },
      { from: 'exploring', to: 'stuck', triggerSignals: ['repeated-failure'], minConfidence: 0.5 },
      { from: 'frustrated', to: 'focused', triggerSignals: ['successful-build-after-stuck', 'milestone-reached'], minConfidence: 0.3 },
      { from: 'frustrated', to: 'celebrating', triggerSignals: ['milestone-reached'], minConfidence: 0.5 },
      { from: 'fatigued', to: 'focused', triggerSignals: ['successful-build-after-stuck', 'milestone-reached'], minConfidence: 0.3 },
      { from: 'celebrating', to: 'focused', triggerSignals: ['repeated-failure', 'velocity-drop'], minConfidence: 0.3 },
    ];
  }

  shouldTransition(currentState: DeveloperState, signals: WellbeingSignal[]): DeveloperState | undefined {
    const tenMinAgo = new Date(Date.now() - 10 * 60000).toISOString();
    const recentSignals = signals.filter(s => s.detectedAt >= tenMinAgo);
    if (recentSignals.length === 0) return undefined;

    const rules = this.getTransitionRules();
    // Check specific state transitions first
    const specificRules = rules.filter(r => r.from === currentState);
    for (const rule of specificRules) {
      const matchingSignals = recentSignals.filter(s => rule.triggerSignals.includes(s.type));
      if (matchingSignals.length > 0) {
        const confidence = 1 - matchingSignals.reduce((acc, s) => acc * (1 - s.confidence), 1);
        if (confidence >= rule.minConfidence) {
          return rule.to;
        }
      }
    }

    // Check wildcard: any -> celebrating
    const milestoneSignals = recentSignals.filter(s => s.type === 'milestone-reached');
    if (milestoneSignals.length > 0) {
      const confidence = 1 - milestoneSignals.reduce((acc, s) => acc * (1 - s.confidence), 1);
      if (confidence >= 0.8) {
        return 'celebrating';
      }
    }

    return undefined;
  }

  createInitialState(sessionId: string): EmotionalState {
    return {
      sessionId,
      currentState: 'focused',
      previousState: undefined,
      stateEnteredAt: new Date().toISOString(),
      signals: [],
      compositeConfidence: 0,
    };
  }

  getStateAge(state: EmotionalState): number {
    return Math.floor((Date.now() - new Date(state.stateEnteredAt).getTime()) / 60000);
  }
}
