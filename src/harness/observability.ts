// Harness Observability - Logging, metrics, and telemetry
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { EventEmitter } from 'events';
import type { HarnessEvent, LogLevel, ToolCallRecord } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Structured Logger
// ═══════════════════════════════════════════════════════════════════════════════

export interface LogEntry {
  id: string;
  harnessId: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  parentId?: string;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  maxEntries: number;
  enableConsole: boolean;
  enableStructured: boolean;
}

export class StructuredLogger extends EventEmitter {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];
  private levelOrder: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    super();
    this.config = {
      minLevel: 'info',
      maxEntries: 1000,
      enableConsole: true,
      enableStructured: true,
      ...config,
    };
  }

  /**
   * Log a debug message
   */
  debug(harnessId: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', harnessId, message, metadata);
  }

  /**
   * Log an info message
   */
  info(harnessId: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('info', harnessId, message, metadata);
  }

  /**
   * Log a warning message
   */
  warn(harnessId: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', harnessId, message, metadata);
  }

  /**
   * Log an error message
   */
  error(harnessId: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('error', harnessId, message, metadata);
  }

  /**
   * Get all log entries for a harness
   */
  getEntries(harnessId: string, level?: LogLevel): LogEntry[] {
    let entries = this.entries.filter(e => e.harnessId === harnessId);
    
    if (level) {
      const minLevel = this.levelOrder[level];
      entries = entries.filter(e => this.levelOrder[e.level] >= minLevel);
    }
    
    return entries;
  }

  /**
   * Get recent entries across all harnesses
   */
  getRecent(count: number = 100, level?: LogLevel): LogEntry[] {
    let entries = [...this.entries];
    
    if (level) {
      const minLevel = this.levelOrder[level];
      entries = entries.filter(e => this.levelOrder[e.level] >= minLevel);
    }
    
    return entries.slice(-count);
  }

  /**
   * Clear old entries
   */
  prune(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    const initialCount = this.entries.length;
    
    this.entries = this.entries.filter(e => e.timestamp >= cutoff);
    
    return initialCount - this.entries.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private log(
    level: LogLevel,
    harnessId: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    // Check level filter
    if (this.levelOrder[level] < this.levelOrder[this.config.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      harnessId,
      level,
      message,
      timestamp: Date.now(),
      metadata,
    };

    // Store entry
    this.entries.push(entry);
    if (this.entries.length > this.config.maxEntries) {
      this.entries.shift();
    }

    // Emit event
    this.emit('log', entry);
    this.emit(`log:${harnessId}`, entry);

    // Console output
    if (this.config.enableConsole) {
      const prefix = `[${level.toUpperCase()}] [${harnessId}]`;
      if (level === 'error') {
        console.error(prefix, message, metadata || '');
      } else if (level === 'warn') {
        console.warn(prefix, message, metadata || '');
      } else {
        console.log(prefix, message, metadata || '');
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Stream
// ═══════════════════════════════════════════════════════════════════════════════

export class EventStream extends EventEmitter {
  private events: HarnessEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 10000) {
    super();
    this.maxEvents = maxEvents;
  }

  /**
   * Emit a harness event
   */
  emitEvent(event: HarnessEvent): void {
    this.events.push(event);
    
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    this.emit('event', event);
    this.emit(`event:${event.harnessId}`, event);
    this.emit(`event:type:${event.type}`, event);
  }

  /**
   * Get events for a harness
   */
  getEvents(harnessId: string, type?: string): HarnessEvent[] {
    let events = this.events.filter(e => e.harnessId === harnessId);
    if (type) {
      events = events.filter(e => e.type === type);
    }
    return events;
  }

  /**
   * Get recent events
   */
  getRecent(count: number = 100): HarnessEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Subscribe to events for a harness
   */
  subscribe(harnessId: string, handler: (event: HarnessEvent) => void): () => void {
    const eventName = `event:${harnessId}`;
    this.on(eventName, handler);
    return () => this.off(eventName, handler);
  }

  /**
   * Subscribe to events by type
   */
  subscribeByType(type: string, handler: (event: HarnessEvent) => void): () => void {
    const eventName = `event:type:${type}`;
    this.on(eventName, handler);
    return () => this.off(eventName, handler);
  }

  /**
   * Clear old events
   */
  prune(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    const initialCount = this.events.length;
    
    this.events = this.events.filter(e => e.timestamp >= cutoff);
    
    return initialCount - this.events.length;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Metrics Collector
// ═══════════════════════════════════════════════════════════════════════════════

export interface MetricValue {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface MetricsSnapshot {
  timestamp: number;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, { count: number; sum: number; buckets: number[] }>;
}

export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private metricHistory: MetricValue[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 10000) {
    this.maxHistory = maxHistory;
  }

  /**
   * Increment a counter
   */
  increment(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.makeKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    this.record({ name, value: current + value, labels });
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    this.gauges.set(key, value);
    this.record({ name, value, labels });
  }

  /**
   * Record a histogram observation
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    this.record({ name, value, labels });
  }

  /**
   * Get current snapshot
   */
  getSnapshot(): MetricsSnapshot {
    const histogramData: Record<string, { count: number; sum: number; buckets: number[] }> = {};
    
    for (const [key, values] of this.histograms) {
      const sum = values.reduce((a, b) => a + b, 0);
      histogramData[key] = {
        count: values.length,
        sum,
        buckets: this.calculateBuckets(values),
      };
    }

    return {
      timestamp: Date.now(),
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: histogramData,
    };
  }

  /**
   * Get metric history for a name
   */
  getHistory(name: string): MetricValue[] {
    return this.metricHistory.filter(m => m.name === name);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private makeKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private record(metric: Omit<MetricValue, 'timestamp'>): void {
    const fullMetric: MetricValue = {
      ...metric,
      timestamp: Date.now(),
    };
    
    this.metricHistory.push(fullMetric);
    if (this.metricHistory.length > this.maxHistory) {
      this.metricHistory.shift();
    }
  }

  private calculateBuckets(values: number[]): number[] {
    if (values.length === 0) return [];
    
    const sorted = [...values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    return [p50, p90, p99];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Call Audit Log
// ═══════════════════════════════════════════════════════════════════════════════

export class ToolCallAuditLog {
  private calls: ToolCallRecord[] = [];
  private maxCalls: number;

  constructor(maxCalls: number = 10000) {
    this.maxCalls = maxCalls;
  }

  /**
   * Record a tool call
   */
  record(call: ToolCallRecord): void {
    this.calls.push(call);
    if (this.calls.length > this.maxCalls) {
      this.calls.shift();
    }
  }

  /**
   * Get calls for a harness
   */
  getCalls(harnessId: string): ToolCallRecord[] {
    return this.calls.filter(c => c.harnessId === harnessId);
  }

  /**
   * Get recent calls
   */
  getRecent(count: number = 100): ToolCallRecord[] {
    return this.calls.slice(-count);
  }

  /**
   * Search calls by tool name
   */
  searchByTool(toolName: string): ToolCallRecord[] {
    return this.calls.filter(c => c.toolName === toolName);
  }

  /**
   * Get statistics by tool
   */
  getToolStats(): Record<string, { count: number; success: number; error: number }> {
    const stats: Record<string, { count: number; success: number; error: number }> = {};
    
    for (const call of this.calls) {
      if (!stats[call.toolName]) {
        stats[call.toolName] = { count: 0, success: 0, error: 0 };
      }
      
      stats[call.toolName].count++;
      if (call.error) {
        stats[call.toolName].error++;
      } else {
        stats[call.toolName].success++;
      }
    }
    
    return stats;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Exports
// ═══════════════════════════════════════════════════════════════════════════════

export const harnessLogger = new StructuredLogger();

export const harnessEventStream = new EventStream();

export const harnessMetrics = new MetricsCollector();

export const toolCallAuditLog = new ToolCallAuditLog();
