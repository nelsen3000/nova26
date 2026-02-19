/**
 * Nova26 Model Routing & Speculative Decoding Module
 * KIMI-R22-01 - Inference Queue
 */

import { InferenceRequest } from './types.js';

/**
 * Configuration options for the inference queue.
 */
export interface InferenceQueueConfig {
  /** Maximum number of requests in the queue */
  maxSize: number;
  /** Default priority for requests without explicit priority */
  defaultPriority: number;
  /** Enable priority aging (bump priority of old requests) */
  enableAging: boolean;
  /** Milliseconds after which a request's priority increases */
  agingThresholdMs: number;
  /** Amount to increase priority on aging */
  agingIncrement: number;
}

/**
 * Default queue configuration.
 */
const DEFAULT_CONFIG: InferenceQueueConfig = {
  maxSize: 100,
  defaultPriority: 5,
  enableAging: true,
  agingThresholdMs: 30000, // 30 seconds
  agingIncrement: 1,
};

/**
 * Statistics about queue operations.
 */
export interface QueueStats {
  totalEnqueued: number;
  totalDequeued: number;
  totalDropped: number;
  averageWaitTimeMs: number;
  currentSize: number;
}

/**
 * Priority queue for managing inference requests with support for:
 * - Priority-based ordering
 * - Aging (priority boost for waiting requests)
 * - Agent-based concurrency tracking
 * - Queue position queries
 */
export class InferenceQueue {
  private queue: InferenceRequest[] = [];
  private config: InferenceQueueConfig;
  private stats: QueueStats;
  private requestHistory: Map<string, { enqueuedAt: number; dequeuedAt?: number }> = new Map();

  constructor(config: Partial<InferenceQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      totalEnqueued: 0,
      totalDequeued: 0,
      totalDropped: 0,
      averageWaitTimeMs: 0,
      currentSize: 0,
    };
  }

  /**
   * Adds a request to the queue with automatic priority assignment.
   * 
   * @param request - The inference request to queue
   * @returns The assigned request ID, or null if queue is full
   */
  enqueue(request: InferenceRequest): string {
    // Check queue capacity
    if (this.queue.length >= this.config.maxSize) {
      this.stats.totalDropped++;
      throw new Error('Queue is full');
    }

    // Generate ID if not provided
    const requestId = request.id || this.generateRequestId();
    
    // Set default priority if not specified
    const priority = request.priority ?? this.config.defaultPriority;
    
    // Create normalized request
    const normalizedRequest: InferenceRequest = {
      ...request,
      id: requestId,
      priority,
      timestamp: request.timestamp || Date.now(),
    };

    // Insert into queue maintaining priority order (higher priority = earlier)
    this.insertByPriority(normalizedRequest);

    // Track statistics
    this.stats.totalEnqueued++;
    this.stats.currentSize = this.queue.length;
    this.requestHistory.set(requestId, { enqueuedAt: Date.now() });

    return requestId;
  }

  /**
   * Removes and returns the highest priority request from the queue.
   * Applies priority aging before selection.
   * 
   * @returns The highest priority request, or undefined if queue is empty
   */
  dequeue(): InferenceRequest | undefined {
    // Apply aging if enabled
    if (this.config.enableAging) {
      this.applyAging();
    }

    // Re-sort queue after aging
    this.resortQueue();

    const request = this.queue.shift();
    
    if (request) {
      const history = this.requestHistory.get(request.id);
      if (history) {
        history.dequeuedAt = Date.now();
        this.updateAverageWaitTime(history.enqueuedAt, history.dequeuedAt);
      }

      this.stats.totalDequeued++;
      this.stats.currentSize = this.queue.length;
    }

    return request;
  }

  /**
   * Gets the current position of a request in the queue.
   * 
   * @param requestId - The ID of the request to locate
   * @returns The 0-based position in queue, or -1 if not found
   */
  getPosition(requestId: string): number {
    const position = this.queue.findIndex(r => r.id === requestId);
    return position;
  }

  /**
   * Gets the current number of requests in the queue.
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Checks if the queue is empty.
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Checks if the queue is at capacity.
   */
  isFull(): boolean {
    return this.queue.length >= this.config.maxSize;
  }

  /**
   * Clears all requests from the queue.
   */
  clear(): void {
    this.queue = [];
    this.stats.currentSize = 0;
    
    // Mark all pending requests as dropped
    for (const [_id, history] of this.requestHistory.entries()) {
      if (!history.dequeuedAt) {
        this.stats.totalDropped++;
      }
    }
  }

  /**
   * Peeks at the highest priority request without removing it.
   */
  peek(): InferenceRequest | undefined {
    return this.queue[0];
  }

  /**
   * Gets all requests in the queue (in priority order).
   */
  getAll(): InferenceRequest[] {
    return [...this.queue];
  }

  /**
   * Gets requests filtered by agent ID.
   */
  getByAgent(agentId: string): InferenceRequest[] {
    return this.queue.filter(r => r.agentId === agentId);
  }

  /**
   * Removes a specific request from the queue.
   * 
   * @param requestId - The ID of the request to remove
   * @returns True if removed, false if not found
   */
  remove(requestId: string): boolean {
    const index = this.queue.findIndex(r => r.id === requestId);
    
    if (index >= 0) {
      this.queue.splice(index, 1);
      this.stats.currentSize = this.queue.length;
      
      const history = this.requestHistory.get(requestId);
      if (history && !history.dequeuedAt) {
        this.stats.totalDropped++;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Updates the priority of a queued request.
   * 
   * @param requestId - The ID of the request
   * @param newPriority - The new priority value
   * @returns True if updated, false if not found
   */
  updatePriority(requestId: string, newPriority: number): boolean {
    const request = this.queue.find(r => r.id === requestId);
    
    if (request) {
      request.priority = newPriority;
      this.resortQueue();
      return true;
    }
    
    return false;
  }

  /**
   * Gets current queue statistics.
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Resets all statistics.
   */
  resetStats(): void {
    this.stats = {
      totalEnqueued: 0,
      totalDequeued: 0,
      totalDropped: 0,
      averageWaitTimeMs: 0,
      currentSize: this.queue.length,
    };
    this.requestHistory.clear();
  }

  /**
   * Gets the estimated wait time for a new request.
   * 
   * @param priority - The priority of the hypothetical request
   * @returns Estimated wait time in milliseconds
   */
  estimateWaitTime(priority: number): number {
    if (this.queue.length === 0) {
      return 0;
    }

    // Count requests with higher or equal priority
    const requestsAhead = this.queue.filter(r => r.priority >= priority).length;
    
    // Estimate based on average processing time (mock: 5 seconds per request)
    const ESTIMATED_PROCESSING_TIME_MS = 5000;
    
    return requestsAhead * ESTIMATED_PROCESSING_TIME_MS;
  }

  // Private helper methods

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private insertByPriority(request: InferenceRequest): void {
    // Find insertion point (higher priority first, then earlier timestamp)
    let insertIndex = this.queue.length;
    
    for (let i = 0; i < this.queue.length; i++) {
      const current = this.queue[i];
      
      if (request.priority > current.priority) {
        insertIndex = i;
        break;
      }
      
      // Same priority: earlier timestamp first (FCFS)
      if (request.priority === current.priority && 
          request.timestamp < current.timestamp) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, request);
  }

  private applyAging(): void {
    const now = Date.now();
    
    for (const request of this.queue) {
      const waitTime = now - request.timestamp;
      
      if (waitTime > this.config.agingThresholdMs) {
        const agingCycles = Math.floor(waitTime / this.config.agingThresholdMs);
        const priorityBoost = agingCycles * this.config.agingIncrement;
        
        // Apply boost but cap at maximum priority of 10
        request.priority = Math.min(10, request.priority + priorityBoost);
      }
    }
  }

  private resortQueue(): void {
    this.queue.sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Earlier timestamp first (FCFS within same priority)
      return a.timestamp - b.timestamp;
    });
  }

  private updateAverageWaitTime(enqueuedAt: number, dequeuedAt: number): void {
    const waitTime = dequeuedAt - enqueuedAt;
    
    // Exponential moving average
    const alpha = 0.1;
    this.stats.averageWaitTimeMs = 
      (1 - alpha) * this.stats.averageWaitTimeMs + alpha * waitTime;
  }
}

/**
 * Factory function to create an inference request with sensible defaults.
 */
export function createInferenceRequest(
  agentId: string,
  prompt: string,
  options: Partial<Omit<InferenceRequest, 'agentId' | 'prompt'>> = {}
): InferenceRequest {
  return {
    id: options.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    agentId,
    prompt,
    priority: options.priority ?? 5,
    timestamp: options.timestamp || Date.now(),
    maxTokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7,
    timeoutMs: options.timeoutMs ?? 60000,
  };
}
