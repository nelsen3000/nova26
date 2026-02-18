// Scratchpad Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { Scratchpad, estimateTokens } from './scratchpad.js';

describe('estimateTokens', () => {
  it('should estimate ~1 token per 4 chars', () => {
    expect(estimateTokens('1234')).toBe(1);
    expect(estimateTokens('12345678')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });

  it('should round up', () => {
    expect(estimateTokens('12345')).toBe(2); // 5/4 = 1.25 → 2
  });
});

describe('Scratchpad', () => {
  let pad: Scratchpad;

  beforeEach(() => {
    pad = new Scratchpad({ maxTokens: 1000, activeWindowSize: 3, maxToolOutputTokens: 200 });
  });

  // --------------------------------------------------------------------------
  // Basic Operations
  // --------------------------------------------------------------------------

  describe('add and getMessages', () => {
    it('should add messages and retrieve them', () => {
      pad.add('system', 'You are an agent.');
      pad.add('user', 'Fix the bug.');
      pad.add('assistant', 'I will check the code.');

      const messages = pad.getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[2].role).toBe('assistant');
    });

    it('should include tool messages with metadata', () => {
      pad.add('tool', 'File contents here', { toolCallId: 'tc_1', toolName: 'readFile' });

      const messages = pad.getMessages();
      expect(messages[0].toolCallId).toBe('tc_1');
    });
  });

  // --------------------------------------------------------------------------
  // Token Management
  // --------------------------------------------------------------------------

  describe('token counting', () => {
    it('should track total tokens', () => {
      pad.add('user', 'a'.repeat(100)); // ~25 tokens
      expect(pad.getTotalTokens()).toBeGreaterThan(0);
    });

    it('should truncate oversized tool outputs', () => {
      const bigOutput = 'x'.repeat(2000); // Way over maxToolOutputTokens (200 * 4 = 800 chars)
      pad.add('tool', bigOutput, { toolCallId: 'tc_1', toolName: 'readFile' });

      const messages = pad.getMessages();
      expect(messages[0].content.length).toBeLessThan(bigOutput.length);
      expect(messages[0].content).toContain('truncated');
    });
  });

  // --------------------------------------------------------------------------
  // Turn Counting
  // --------------------------------------------------------------------------

  describe('getTurnCount', () => {
    it('should count assistant messages as turns', () => {
      pad.add('user', 'question');
      pad.add('assistant', 'answer 1');
      pad.add('tool', 'result', { toolCallId: 'tc_1', toolName: 'readFile' });
      pad.add('assistant', 'answer 2');

      expect(pad.getTurnCount()).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Last Assistant Message
  // --------------------------------------------------------------------------

  describe('getLastAssistantMessage', () => {
    it('should return the last assistant message', () => {
      pad.add('assistant', 'first');
      pad.add('tool', 'result', { toolCallId: 'tc_1', toolName: 'test' });
      pad.add('assistant', 'second');

      expect(pad.getLastAssistantMessage()).toBe('second');
    });

    it('should return undefined when no assistant messages', () => {
      pad.add('user', 'hello');
      expect(pad.getLastAssistantMessage()).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Context Collapsing
  // --------------------------------------------------------------------------

  describe('token budget enforcement', () => {
    it('should collapse old messages when over budget', () => {
      // Use a very small budget to force collapsing
      const smallPad = new Scratchpad({ maxTokens: 50, activeWindowSize: 2, maxToolOutputTokens: 100 });

      // Add messages that exceed budget
      smallPad.add('user', 'a'.repeat(100));     // ~25 tokens
      smallPad.add('assistant', 'b'.repeat(100)); // ~25 tokens
      smallPad.add('tool', 'c'.repeat(100), { toolCallId: 'tc_1', toolName: 'test' }); // ~25 tokens
      smallPad.add('assistant', 'd'.repeat(100)); // ~25 tokens — now over budget

      // Old messages should be collapsed
      const messages = smallPad.getMessages();
      const collapsed = messages.filter(m => m.content.includes('collapsed'));
      expect(collapsed.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Clear
  // --------------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all messages', () => {
      pad.add('user', 'hello');
      pad.add('assistant', 'hi');
      pad.clear();

      expect(pad.getMessages()).toHaveLength(0);
      expect(pad.getTotalTokens()).toBe(0);
      expect(pad.getTurnCount()).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Debug Output
  // --------------------------------------------------------------------------

  describe('toDebugString', () => {
    it('should format conversation for debugging', () => {
      pad.add('user', 'Fix the bug');
      pad.add('assistant', 'Let me check the code');

      const debug = pad.toDebugString();
      expect(debug).toContain('[user]');
      expect(debug).toContain('[assistant]');
      expect(debug).toContain('Fix the bug');
    });

    it('should show tool names', () => {
      pad.add('tool', 'contents', { toolCallId: 'tc_1', toolName: 'readFile' });
      const debug = pad.toDebugString();
      expect(debug).toContain('readFile');
    });
  });
});
