import { describe, it, expect } from 'vitest';
import { ToneAdapter } from './tone-adapter.js';
import type { ToneProfile } from './tone-adapter.js';
import type { DeveloperState } from './signal-detector.js';

describe('ToneAdapter', () => {
  const adapter = new ToneAdapter();

  // --- getDefaultProfiles ---

  it('1. getDefaultProfiles returns 6 profiles', () => {
    const profiles = adapter.getDefaultProfiles();
    expect(profiles.length).toBe(6);
  });

  it('2. all profiles have useEmoji false', () => {
    const profiles = adapter.getDefaultProfiles();
    for (const profile of profiles) {
      expect(profile.useEmoji).toBe(false);
    }
  });

  // --- getProfile ---

  it('3. getProfile returns focused profile with high directness', () => {
    const profile = adapter.getProfile('focused');
    expect(profile.state).toBe('focused');
    expect(profile.directness).toBe(0.9);
  });

  it('4. focused profile has concise responseLength', () => {
    const profile = adapter.getProfile('focused');
    expect(profile.responseLength).toBe('concise');
  });

  it('5. focused profile has direct ledeStyle', () => {
    const profile = adapter.getProfile('focused');
    expect(profile.ledeStyle).toBe('direct');
  });

  it('6. getProfile returns exploring profile with detailed responseLength', () => {
    const profile = adapter.getProfile('exploring');
    expect(profile.responseLength).toBe('detailed');
  });

  it('7. stuck profile has empathetic ledeStyle', () => {
    const profile = adapter.getProfile('stuck');
    expect(profile.ledeStyle).toBe('empathetic');
  });

  it('8. stuck profile has detailed responseLength', () => {
    const profile = adapter.getProfile('stuck');
    expect(profile.responseLength).toBe('detailed');
  });

  it('9. frustrated profile has high warmth', () => {
    const profile = adapter.getProfile('frustrated');
    expect(profile.warmth).toBe(0.9);
  });

  it('10. frustrated profile has concise responseLength', () => {
    const profile = adapter.getProfile('frustrated');
    expect(profile.responseLength).toBe('concise');
  });

  it('11. fatigued profile has gentle ledeStyle', () => {
    const profile = adapter.getProfile('fatigued');
    expect(profile.ledeStyle).toBe('gentle');
  });

  it('12. celebrating profile has celebratory ledeStyle', () => {
    const profile = adapter.getProfile('celebrating');
    expect(profile.ledeStyle).toBe('celebratory');
  });

  it('13. celebrating profile has normal responseLength', () => {
    const profile = adapter.getProfile('celebrating');
    expect(profile.responseLength).toBe('normal');
  });

  // --- adjustResponseLength ---

  it('14. adjustResponseLength truncates to first paragraph for concise', () => {
    const profile = adapter.getProfile('focused');
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const result = adapter.adjustResponseLength(text, profile);
    expect(result).toBe('First paragraph.');
  });

  it('15. adjustResponseLength truncates to 200 chars with ellipsis for concise long text', () => {
    const profile = adapter.getProfile('focused');
    const longText = 'A'.repeat(300);
    const result = adapter.adjustResponseLength(longText, profile);
    expect(result.length).toBeLessThanOrEqual(203); // 200 + '...'
    expect(result).toContain('...');
  });

  it('16. adjustResponseLength returns full text for detailed', () => {
    const profile = adapter.getProfile('exploring');
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const result = adapter.adjustResponseLength(text, profile);
    expect(result).toBe(text);
  });

  it('17. adjustResponseLength returns text as-is for normal', () => {
    const profile = adapter.getProfile('celebrating');
    const text = 'Some response text';
    const result = adapter.adjustResponseLength(text, profile);
    expect(result).toBe(text);
  });

  // --- shouldAcknowledge ---

  it('18. shouldAcknowledge returns true for stuck, frustrated, fatigued', () => {
    expect(adapter.shouldAcknowledge('stuck')).toBe(true);
    expect(adapter.shouldAcknowledge('frustrated')).toBe(true);
    expect(adapter.shouldAcknowledge('fatigued')).toBe(true);
  });

  it('18b. shouldAcknowledge returns false for focused, exploring, celebrating', () => {
    expect(adapter.shouldAcknowledge('focused')).toBe(false);
    expect(adapter.shouldAcknowledge('exploring')).toBe(false);
    expect(adapter.shouldAcknowledge('celebrating')).toBe(false);
  });

  // --- formatLede ---

  it('19. formatLede returns correct strings for each ledeStyle', () => {
    const focused = adapter.getProfile('focused');
    expect(adapter.formatLede(focused, 'routing')).toContain('Here is what you need to know about routing.');

    const stuck = adapter.getProfile('stuck');
    expect(adapter.formatLede(stuck, 'routing')).toContain('I understand this is challenging');

    const celebrating = adapter.getProfile('celebrating');
    expect(adapter.formatLede(celebrating, 'routing')).toContain('Excellent progress');

    const fatigued = adapter.getProfile('fatigued');
    expect(adapter.formatLede(fatigued, 'routing')).toContain('Taking it easy');
  });
});
