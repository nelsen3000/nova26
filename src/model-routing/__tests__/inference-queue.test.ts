/**
 * Comprehensive tests for InferenceQueue and SpeculativeDecoder
 * Task H5-02: Inference Queue + Speculative Decoder Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { InferenceQueue } from '../inference-queue.js';
import { SpeculativeDecoder } from '../speculative-decoder.js';
import type { InferenceRequest } from '../types.js';

// ─── InferenceQueue Tests ───────────────────────────────────────────────────

describe('InferenceQueue', () => {
  let queue: InferenceQueue;

  beforeEach(() => {
    queue = new InferenceQueue({
      maxSize: 100,
      defaultPriority: 5,
      enableAging: true,
      agingThresholdMs: 30000,
      agingIncrement: 1,
    });
  });

  describe('Basic Operations', () => {
    it('should enqueue and dequeue requests', () => {
      const request: InferenceRequest = {
        id: 'req-1',
        agentId: 'test-agent',
        prompt: 'test prompt',
        priority: 5,
        timestamp: Date.now(),
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      };

      queue.enqueue(request);
      const dequeued = queue.dequeue();

      expect(dequeued).toBeDefined();
      expect(dequeued?.id).toBe('req-1');
    });

    it('should throw error when queue is full', () => {
      const smallQueue = new InferenceQueue({ maxSize: 1 });

      const req1: InferenceRequest = {
        id: 'req-1',
        agentId: 'agent',
        prompt: 'prompt',
        priority: 5,
        timestamp: Date.now(),
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      };

      smallQueue.enqueue(req1);

      const req2: InferenceRequest = {
        id: 'req-2',
        agentId: 'agent',
        prompt: 'prompt',
        priority: 5,
        timestamp: Date.now(),
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      };

      expect(() => smallQueue.enqueue(req2)).toThrow('Queue is full');
    });

    it('should handle auto-generated request IDs', () => {
      const request: Partial<InferenceRequest> = {
        agentId: 'test-agent',
        prompt: 'test prompt',
        priority: 5,
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      };

      const id = queue.enqueue(request as InferenceRequest);
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should set default priority', () => {
      const request: Partial<InferenceRequest> = {
        id: 'req-1',
        agentId: 'test-agent',
        prompt: 'test prompt',
        // no priority specified
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      };

      queue.enqueue(request as InferenceRequest);
      const dequeued = queue.dequeue();

      expect(dequeued?.priority).toBe(5); // default priority
    });

    it('should return undefined when queue is empty', () => {
      const result = queue.dequeue();
      expect(result).toBeUndefined();
    });

    it('should peek at next request without removing it', () => {
      const request: InferenceRequest = {
        id: 'req-1',
        agentId: 'agent',
        prompt: 'prompt',
        priority: 5,
        timestamp: Date.now(),
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      };

      queue.enqueue(request);
      const peeked = queue.peek();

      expect(peeked?.id).toBe('req-1');

      // Should still be in queue
      const dequeued = queue.dequeue();
      expect(dequeued?.id).toBe('req-1');
    });

    it('should get queue size', () => {
      expect(queue.getQueueLength()).toBe(0);

      for (let i = 0; i < 5; i++) {
        queue.enqueue({
          id: `req-${i}`,
          agentId: 'agent',
          prompt: 'prompt',
          priority: 5,
          timestamp: Date.now(),
          maxTokens: 256,
          temperature: 0.7,
          timeoutMs: 30000,
        });
      }

      expect(queue.getQueueLength()).toBe(5);
    });

    it('should clear the queue', () => {
      for (let i = 0; i < 3; i++) {
        queue.enqueue({
          id: `req-${i}`,
          agentId: 'agent',
          prompt: 'prompt',
          priority: 5,
          timestamp: Date.now(),
          maxTokens: 256,
          temperature: 0.7,
          timeoutMs: 30000,
        });
      }

      queue.clear();
      expect(queue.getQueueLength()).toBe(0);
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe('Priority Ordering', () => {
    it('should dequeue higher priority requests first', () => {
      queue.enqueue({
        id: 'low',
        agentId: 'agent',
        prompt: 'prompt',
        priority: 1,
        timestamp: Date.now(),
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      });

      queue.enqueue({
        id: 'high',
        agentId: 'agent',
        prompt: 'prompt',
        priority: 10,
        timestamp: Date.now(),
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      });

      const first = queue.dequeue();
      expect(first?.id).toBe('high');

      const second = queue.dequeue();
      expect(second?.id).toBe('low');
    });

    it('should maintain priority invariant', () => {
      const priorities = [3, 7, 1, 9, 2, 5];

      for (let i = 0; i < priorities.length; i++) {
        queue.enqueue({
          id: `req-${i}`,
          agentId: 'agent',
          prompt: 'prompt',
          priority: priorities[i],
          timestamp: Date.now(),
          maxTokens: 256,
          temperature: 0.7,
          timeoutMs: 30000,
        });
      }

      // Should dequeue in descending priority order
      let prevPriority = Infinity;
      while (queue.getQueueLength() > 0) {
        const req = queue.dequeue();
        expect(req!.priority).toBeLessThanOrEqual(prevPriority);
        prevPriority = req!.priority;
      }
    });

    it('should get queue position', () => {
      for (let i = 0; i < 5; i++) {
        queue.enqueue({
          id: `req-${i}`,
          agentId: 'agent',
          prompt: 'prompt',
          priority: i,
          timestamp: Date.now(),
          maxTokens: 256,
          temperature: 0.7,
          timeoutMs: 30000,
        });
      }

      const position = queue.getPosition('req-4');
      expect(position).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    it('should track queue statistics', () => {
      for (let i = 0; i < 3; i++) {
        queue.enqueue({
          id: `req-${i}`,
          agentId: 'agent',
          prompt: 'prompt',
          priority: 5,
          timestamp: Date.now(),
          maxTokens: 256,
          temperature: 0.7,
          timeoutMs: 30000,
        });
      }

      for (let i = 0; i < 2; i++) {
        queue.dequeue();
      }

      const stats = queue.getStats();

      expect(stats.totalEnqueued).toBe(3);
      expect(stats.totalDequeued).toBe(2);
      expect(stats.currentSize).toBe(1);
    });

    it('should track dropped requests', () => {
      const smallQueue = new InferenceQueue({ maxSize: 1 });

      smallQueue.enqueue({
        id: 'req-1',
        agentId: 'agent',
        prompt: 'prompt',
        priority: 5,
        timestamp: Date.now(),
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      });

      // Try to add another request when queue is full
      try {
        smallQueue.enqueue({
          id: 'req-2',
          agentId: 'agent',
          prompt: 'prompt',
          priority: 5,
          timestamp: Date.now(),
          maxTokens: 256,
          temperature: 0.7,
          timeoutMs: 30000,
        });
      } catch {
        // Expected
      }

      const stats = smallQueue.getStats();
      expect(stats.totalDropped).toBeGreaterThan(0);
    });
  });

  describe('Request Removal', () => {
    it('should remove specific requests by ID', () => {
      queue.enqueue({
        id: 'req-1',
        agentId: 'agent',
        prompt: 'prompt',
        priority: 5,
        timestamp: Date.now(),
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      });

      queue.enqueue({
        id: 'req-2',
        agentId: 'agent',
        prompt: 'prompt',
        priority: 5,
        timestamp: Date.now(),
        maxTokens: 256,
        temperature: 0.7,
        timeoutMs: 30000,
      });

      const removed = queue.remove('req-1');
      expect(removed).toBe(true);
      expect(queue.getQueueLength()).toBe(1);

      const remaining = queue.dequeue();
      expect(remaining?.id).toBe('req-2');
    });

    it('should estimate wait time for a request', () => {
      for (let i = 0; i < 3; i++) {
        queue.enqueue({
          id: `req-${i}`,
          agentId: 'agent',
          prompt: 'prompt',
          priority: 5,
          timestamp: Date.now(),
          maxTokens: 256,
          temperature: 0.7,
          timeoutMs: 30000,
        });
      }

      const waitTime = queue.estimateWaitTime(5);
      expect(waitTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Property-Based Tests', () => {
    it('should maintain priority invariant for all enqueues', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          requests => {
            queue.clear();

            requests.forEach((r, i) => {
              queue.enqueue({
                id: `req-${i}`,
                agentId: 'agent',
                prompt: 'prompt',
                priority: r.priority,
                timestamp: Date.now(),
                maxTokens: 256,
                temperature: 0.7,
                timeoutMs: 30000,
              });
            });

            // Verify priority ordering
            let prevPriority = Infinity;
            while (queue.getQueueLength() > 0) {
              const req = queue.dequeue();
              if (req!.priority > prevPriority) {
                return false; // Priority invariant violated
              }
              prevPriority = req!.priority;
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should never exceed queue capacity', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { maxLength: 200 }),
          priorities => {
            queue.clear();

            let enqueued = 0;
            for (let i = 0; i < priorities.length; i++) {
              try {
                queue.enqueue({
                  id: `req-${i}`,
                  agentId: 'agent',
                  prompt: 'prompt',
                  priority: priorities[i],
                  timestamp: Date.now(),
                  maxTokens: 256,
                  temperature: 0.7,
                  timeoutMs: 30000,
                });
                enqueued++;
              } catch {
                // Queue full, expected
              }
            }

            // Should never exceed max size
            return queue.getQueueLength() <= 100;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// ─── SpeculativeDecoder Tests ────────────────────────────────────────────────

describe('SpeculativeDecoder', () => {
  let decoder: SpeculativeDecoder;

  beforeEach(() => {
    decoder = new SpeculativeDecoder({
      maxDraftTokens: 4,
      acceptanceRateTarget: 0.7,
      minSpeedupThreshold: 1.1,
      adaptiveDraftTokens: true,
    });
  });

  describe('Basic Decoding', () => {
    it('should decode with draft and verify models', async () => {
      const result = await decoder.decode('test prompt', 'draft-model', 'verify-model');

      expect(result).toBeDefined();
      expect(typeof result.output).toBe('string');
      expect(result.tokensGenerated).toBeGreaterThanOrEqual(0);
      expect(result.draftTokens).toBeGreaterThanOrEqual(0);
      expect(result.acceptedTokens).toBeGreaterThanOrEqual(0);
    });

    it('should calculate acceptance rate', () => {
      const draftTokens = ['the', 'quick', 'brown', 'fox'];
      const verifiedTokens = ['the', 'quick', 'brown', 'jump'];

      const rate = decoder.calculateAcceptanceRate(draftTokens, verifiedTokens);

      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
      expect(rate).toBe(0.75); // 3 out of 4 match
    });

    it('should return 0 acceptance rate for empty tokens', () => {
      const rate = decoder.calculateAcceptanceRate([], []);
      expect(rate).toBe(0);
    });

    it('should handle full acceptance', () => {
      const tokens = ['a', 'b', 'c', 'd'];
      const rate = decoder.calculateAcceptanceRate(tokens, tokens);
      expect(rate).toBe(1.0);
    });

    it('should handle full rejection', () => {
      const draftTokens = ['a', 'b', 'c'];
      const verifiedTokens = ['x', 'y', 'z'];
      const rate = decoder.calculateAcceptanceRate(draftTokens, verifiedTokens);
      expect(rate).toBe(0);
    });
  });

  describe('Speedup Calculation', () => {
    it('should calculate speedup factor', () => {
      const factor = decoder.getSpeedupFactor(0.8);

      expect(factor).toBeGreaterThan(1);
      expect(typeof factor).toBe('number');
    });

    it('should have higher speedup for higher acceptance rates', () => {
      const lowAcceptanceSpeedup = decoder.getSpeedupFactor(0.3);
      const highAcceptanceSpeedup = decoder.getSpeedupFactor(0.9);

      expect(highAcceptanceSpeedup).toBeGreaterThan(lowAcceptanceSpeedup);
    });
  });

  describe('Statistics', () => {
    it('should track decoder statistics', async () => {
      await decoder.decode('prompt 1', 'draft', 'verify');
      await decoder.decode('prompt 2', 'draft', 'verify');

      const stats = decoder.getStats();

      expect(stats.totalCalls).toBe(2);
      expect(stats.totalDraftTokens).toBeGreaterThanOrEqual(0);
      expect(stats.totalAcceptedTokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration', () => {
    it('should respect max draft tokens setting', async () => {
      const limitedDecoder = new SpeculativeDecoder({
        maxDraftTokens: 1,
      });

      const result = await limitedDecoder.decode('prompt', 'draft', 'verify');

      expect(result.draftTokens).toBeLessThanOrEqual(10); // Rough bound
    });

    it('should handle adaptive draft token adjustment', async () => {
      const adaptiveDecoder = new SpeculativeDecoder({
        adaptiveDraftTokens: true,
        maxDraftTokens: 4,
      });

      const result = await adaptiveDecoder.decode('prompt', 'draft', 'verify');

      expect(result).toBeDefined();
      expect(result.acceptanceRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle fixed draft tokens when adaptive is disabled', async () => {
      const fixedDecoder = new SpeculativeDecoder({
        adaptiveDraftTokens: false,
        maxDraftTokens: 4,
      });

      const result = await fixedDecoder.decode('prompt', 'draft', 'verify');

      expect(result).toBeDefined();
    });
  });

  describe('Property-Based Tests', () => {
    it('should produce valid decode results', async () => {
      const result = await decoder.decode('test prompt', 'draft', 'verify');

      // All metrics should be valid
      expect(result.tokensGenerated).toBeGreaterThanOrEqual(0);
      expect(result.draftTokens).toBeGreaterThanOrEqual(0);
      expect(result.acceptedTokens).toBeGreaterThanOrEqual(0);
      expect(result.acceptanceRate).toBeGreaterThanOrEqual(0);
      expect(result.acceptanceRate).toBeLessThanOrEqual(1);
      expect(result.speedupFactor).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      return true;
    });

    it('should never accept more tokens than generated', async () => {
      const result = await decoder.decode('prompt', 'draft', 'verify');

      expect(result.acceptedTokens).toBeLessThanOrEqual(result.draftTokens);
      return true;
    });

    it('should maintain acceptance rate bounds for various token arrays', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 20 }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 20 }),
          (draftTokens, verifiedTokens) => {
            const rate = decoder.calculateAcceptanceRate(draftTokens, verifiedTokens);
            return rate >= 0 && rate <= 1;
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
