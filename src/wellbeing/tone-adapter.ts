import type { DeveloperState } from './signal-detector.js';

export interface ToneProfile {
  state: DeveloperState;
  warmth: number;
  directness: number;
  encouragement: number;
  technicalDepth: number;
  responseLength: 'concise' | 'normal' | 'detailed';
  useEmoji: boolean;
  ledeStyle: 'direct' | 'empathetic' | 'celebratory' | 'gentle';
}

export class ToneAdapter {
  getProfile(state: DeveloperState): ToneProfile {
    const profiles = this.getDefaultProfiles();
    const profile = profiles.find(p => p.state === state);
    if (profile !== undefined) return profile;
    // Fallback to focused
    return profiles.find(p => p.state === 'focused')!;
  }

  getDefaultProfiles(): ToneProfile[] {
    return [
      {
        state: 'focused',
        warmth: 0.3,
        directness: 0.9,
        encouragement: 0.2,
        technicalDepth: 0.9,
        responseLength: 'concise',
        useEmoji: false,
        ledeStyle: 'direct',
      },
      {
        state: 'exploring',
        warmth: 0.5,
        directness: 0.6,
        encouragement: 0.5,
        technicalDepth: 0.7,
        responseLength: 'detailed',
        useEmoji: false,
        ledeStyle: 'direct',
      },
      {
        state: 'stuck',
        warmth: 0.7,
        directness: 0.7,
        encouragement: 0.6,
        technicalDepth: 0.8,
        responseLength: 'detailed',
        useEmoji: false,
        ledeStyle: 'empathetic',
      },
      {
        state: 'frustrated',
        warmth: 0.9,
        directness: 0.5,
        encouragement: 0.8,
        technicalDepth: 0.5,
        responseLength: 'concise',
        useEmoji: false,
        ledeStyle: 'empathetic',
      },
      {
        state: 'fatigued',
        warmth: 0.8,
        directness: 0.4,
        encouragement: 0.7,
        technicalDepth: 0.4,
        responseLength: 'concise',
        useEmoji: false,
        ledeStyle: 'gentle',
      },
      {
        state: 'celebrating',
        warmth: 0.9,
        directness: 0.5,
        encouragement: 0.9,
        technicalDepth: 0.5,
        responseLength: 'normal',
        useEmoji: false,
        ledeStyle: 'celebratory',
      },
    ];
  }

  adjustResponseLength(text: string, profile: ToneProfile): string {
    if (profile.responseLength === 'concise') {
      // Return first paragraph or first 200 chars, whichever is shorter
      const firstParagraph = text.split('\n\n')[0];
      if (firstParagraph.length <= 200) return firstParagraph;
      return text.slice(0, 200).trimEnd() + '...';
    }
    if (profile.responseLength === 'detailed') {
      return text;
    }
    // normal — return as-is
    return text;
  }

  shouldAcknowledge(state: DeveloperState): boolean {
    return state === 'stuck' || state === 'frustrated' || state === 'fatigued';
  }

  formatLede(profile: ToneProfile, topic: string): string {
    switch (profile.ledeStyle) {
      case 'direct':
        return `Here is what you need to know about ${topic}.`;
      case 'empathetic':
        return `I understand this is challenging. Let me help with ${topic}.`;
      case 'celebratory':
        return `Excellent progress! Regarding ${topic}:`;
      case 'gentle':
        return `Taking it easy. Here is a quick look at ${topic}.`;
    }
  }
}
