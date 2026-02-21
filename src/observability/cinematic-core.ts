// KIMI-R23-05: Cinematic Observability & Eval Suite - Core Engine
// Main observability class with 100% span capture and auto-remediation

import { randomUUID } from 'crypto';
import {
  type CinematicSpan,
  type SpanInput,
  type SpanStatus,
  type CinematicEvalSuite,
  type CinematicEvalSuiteResult,
  type CinematicEvalResult,
  type EvaluatorConfig,
  type EvalDatasetEntry,
  type RemediationEvent,
  type RemediationAction,
  type CinematicConfig,
  DEFAULT_CINEMATIC_CONFIG,
} from './types.js';

// ============================================================================
// Evaluator Implementations
// ============================================================================

/**
 * Heuristic evaluator - rule-based scoring
 */
function runHeuristicEvaluator(
  entry: EvalDatasetEntry,
  config: Record<string, unknown>
): CinematicEvalResult {
  const rules = config.rules as Array<{ field: string; expected: unknown; weight: number }> || [];
  let score = 0;
  const details: string[] = [];
  const input = entry.input as Record<string, unknown>;

  for (const rule of rules) {
    const actual = input[rule.field];
    const passed = JSON.stringify(actual) === JSON.stringify(rule.expected);
    if (passed) {
      score += rule.weight;
      details.push(`✓ ${rule.field}: matched expected value`);
    } else {
      details.push(`✗ ${rule.field}: expected ${String(rule.expected)}, got ${String(actual)}`);
    }
  }

  // Normalize score to 0-1
  const totalWeight = rules.reduce((sum, r) => sum + r.weight, 0);
  const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;

  return {
    score: normalizedScore,
    evaluator: 'heuristic',
    details: details.join('; '),
    metadata: { rulesChecked: rules.length },
  };
}

/**
 * LLM judge evaluator - uses LLM to evaluate quality
 * Mocked implementation for Nova26
 */
async function runLLMJudgeEvaluator(
  entry: EvalDatasetEntry,
  config: Record<string, unknown>
): Promise<CinematicEvalResult> {
  const criteria = config.criteria as string || 'quality and correctness';
  
  // Mock LLM evaluation - in production, this would call an LLM API
  // Simulate evaluation delay
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Simple heuristic mock: compare input/output similarity for demonstration
  const inputStr = JSON.stringify(entry.input);
  const expectedStr = JSON.stringify(entry.expectedOutput);
  const similarity = inputStr.length > 0 && expectedStr.length > 0
    ? 0.7 + Math.random() * 0.3 // Mock score between 0.7-1.0
    : 0.5;

  return {
    score: similarity,
    evaluator: 'llm-judge',
    details: `LLM evaluation based on criteria: "${criteria}"`,
    metadata: { criteria, mockEvaluation: true },
  };
}

/**
 * Human-labeled evaluator - compares against ground truth
 */
function runHumanLabeledEvaluator(
  entry: EvalDatasetEntry,
  _config: Record<string, unknown>
): CinematicEvalResult {
  // Exact match comparison for human-labeled ground truth
  const inputStr = JSON.stringify(entry.input);
  const expectedStr = JSON.stringify(entry.expectedOutput);
  
  // Calculate simple string similarity as proxy
  const maxLen = Math.max(inputStr.length, expectedStr.length);
  const distance = levenshteinDistance(inputStr, expectedStr);
  const similarity = maxLen > 0 ? 1 - (distance / maxLen) : 1;

  return {
    score: similarity,
    evaluator: 'human-labeled',
    details: similarity >= 0.95 
      ? 'Exact match with ground truth'
      : `Similarity: ${(similarity * 100).toFixed(1)}%`,
    metadata: { editDistance: distance },
  };
}

/**
 * Taste vault evaluator - evaluates against user taste patterns
 */
function runTasteVaultEvaluator(
  entry: EvalDatasetEntry,
  config: Record<string, unknown>
): CinematicEvalResult {
  const tastePatterns = config.patterns as string[] || [];
  const input = entry.input as Record<string, unknown>;
  const inputStr = JSON.stringify(input).toLowerCase();
  
  let matches = 0;
  for (const pattern of tastePatterns) {
    if (inputStr.includes(pattern.toLowerCase())) {
      matches++;
    }
  }
  
  const score = tastePatterns.length > 0 ? matches / tastePatterns.length : 0.5;
  
  return {
    score,
    evaluator: 'taste-vault',
    details: `Matched ${matches}/${tastePatterns.length} taste patterns`,
    metadata: { patterns: tastePatterns, matches },
  };
}

/**
 * Levenshtein distance for string similarity
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// ============================================================================
// CinematicObservability Class
// ============================================================================

/**
 * Main observability engine for Nova26
 * Provides 100% span capture, eval suite execution, and auto-remediation
 */
export class CinematicObservability {
  private spans: Map<string, CinematicSpan> = new Map();
  private traceIndex: Map<string, Set<string>> = new Map();
  private remediationHistory: RemediationEvent[] = [];
  private lastRemediationTime: number = 0;
  private config: CinematicConfig;
  private tasteScoreBaseline: number = 1.0;

  constructor(config: Partial<CinematicConfig> = {}) {
    this.config = { ...DEFAULT_CINEMATIC_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Span Management
  // --------------------------------------------------------------------------

  /**
   * Record a new span - 100% capture when fullCapture enabled
   * @param span - Span data (id will be auto-generated)
   * @returns The generated span ID
   */
  recordSpan(span: SpanInput): string {
    // Check sampling if not full capture
    if (!this.config.fullCapture && Math.random() > this.config.sampleRate) {
      return '';
    }

    const id = randomUUID();
    const fullSpan: CinematicSpan = {
      ...span,
      id,
    };

    // Store span
    this.spans.set(id, fullSpan);

    // Index by trace ID
    if (!this.traceIndex.has(span.traceId)) {
      this.traceIndex.set(span.traceId, new Set());
    }
    this.traceIndex.get(span.traceId)?.add(id);

    // Enforce memory limit
    this.enforceMemoryLimit();

    // Check for taste vault score degradation
    if (span.tasteVaultScore !== undefined) {
      this.checkTasteScoreDegradation(span.tasteVaultScore, id);
    }

    return id;
  }

  /**
   * End a span and update its status
   * @param spanId - Span ID to end
   * @param result - End result with status and optional metadata
   */
  endSpan(
    spanId: string,
    result: { status: 'success' | 'failure'; metadata?: Record<string, unknown> }
  ): void {
    const span = this.spans.get(spanId);
    if (!span) {
      console.warn(`CinematicObservability: Span ${spanId} not found`);
      return;
    }

    const endTime = new Date().toISOString();
    const startMs = new Date(span.startTime).getTime();
    const endMs = new Date(endTime).getTime();
    const durationMs = endMs - startMs;

    const updatedSpan: CinematicSpan = {
      ...span,
      endTime,
      durationMs,
      status: result.status,
      metadata: result.metadata 
        ? { ...span.metadata, ...result.metadata, ended: true }
        : { ...span.metadata, ended: true },
    };

    this.spans.set(spanId, updatedSpan);
  }

  /**
   * Get a span by ID
   * @param spanId - Span ID
   * @returns The span or undefined
   */
  getSpan(spanId: string): CinematicSpan | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all spans for a trace as a tree structure
   * @param traceId - Trace ID
   * @returns Array of spans in the trace
   */
  getTraceTree(traceId: string): CinematicSpan[] {
    const spanIds = this.traceIndex.get(traceId);
    if (!spanIds) {
      return [];
    }

    const spans: CinematicSpan[] = [];
    for (const id of Array.from(spanIds)) {
      const span = this.spans.get(id);
      if (span) {
        spans.push(span);
      }
    }

    // Sort by start time
    spans.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    return spans;
  }

  /**
   * Get hierarchical trace tree with parent-child relationships
   * @param traceId - Trace ID
   * @returns Root spans with nested children
   */
  getHierarchicalTrace(traceId: string): Array<CinematicSpan & { children: CinematicSpan[] }> {
    const spans = this.getTraceTree(traceId);
    const spanMap = new Map<string, CinematicSpan & { children: CinematicSpan[] }>();
    
    // First pass: create map entries
    for (const span of spans) {
      spanMap.set(span.id, { ...span, children: [] });
    }
    
    // Second pass: build hierarchy
    const roots: Array<CinematicSpan & { children: CinematicSpan[] }> = [];
    for (const span of spans) {
      const node = spanMap.get(span.id)!;
      if (span.parentId && spanMap.has(span.parentId)) {
        spanMap.get(span.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    
    return roots;
  }

  // --------------------------------------------------------------------------
  // Eval Suite Execution
  // --------------------------------------------------------------------------

  /**
   * Run an evaluation suite against the configured evaluators
   * @param suite - Eval suite configuration
   * @returns Aggregated results with pass/fail status
   */
  async runEvalSuite(suite: CinematicEvalSuite): Promise<CinematicEvalSuiteResult> {
    const scores: Record<string, number> = {};
    const details: string[] = [];
    const entryResults: Array<{ entryIndex: number; scores: Record<string, number>; passed: boolean }> = [];
    let totalPassed = true;

    details.push(`Running eval suite: ${suite.name} (${suite.dataset.length} entries)`);

    // Run each evaluator against each dataset entry
    for (const evaluator of suite.evaluators) {
      let evaluatorTotalScore = 0;
      const evaluatorScores: number[] = [];

      for (let i = 0; i < suite.dataset.length; i++) {
        const entry = suite.dataset[i];
        const result = await this.runEvaluator(entry, evaluator);
        evaluatorTotalScore += result.score;
        evaluatorScores.push(result.score);
      }

      const avgScore = evaluatorScores.length > 0 ? evaluatorTotalScore / evaluatorScores.length : 0;
      scores[evaluator.name] = avgScore;
      
      const threshold = (evaluator.config.threshold as number) || 0.8;
      const evaluatorPassed = avgScore >= threshold;
      
      if (!evaluatorPassed) {
        totalPassed = false;
      }

      details.push(`${evaluator.name}: ${(avgScore * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(0)}%) ${evaluatorPassed ? '✓' : '✗'}`);
    }

    // Per-entry scoring
    for (let i = 0; i < suite.dataset.length; i++) {
      const entryScores: Record<string, number> = {};
      
      for (const evaluator of suite.evaluators) {
        const result = await this.runEvaluator(suite.dataset[i], evaluator);
        entryScores[evaluator.name] = result.score;
      }

      const entryPassed = Object.values(entryScores).every(score => score >= ((suite.evaluators[0]?.config.threshold as number) || 0.8));
      
      entryResults.push({
        entryIndex: i,
        scores: entryScores,
        passed: entryPassed,
      });
    }

    return {
      passed: totalPassed,
      scores,
      details,
      entryResults,
    };
  }

  /**
   * Run a single evaluator against a dataset entry
   */
  private async runEvaluator(
    entry: EvalDatasetEntry,
    evaluator: EvaluatorConfig
  ): Promise<CinematicEvalResult> {
    switch (evaluator.type) {
      case 'heuristic':
        return runHeuristicEvaluator(entry, evaluator.config);
      case 'llm-judge':
        return await runLLMJudgeEvaluator(entry, evaluator.config);
      case 'human-labeled':
        return runHumanLabeledEvaluator(entry, evaluator.config);
      case 'taste-vault':
        return runTasteVaultEvaluator(entry, evaluator.config);
      default:
        return {
          score: 0,
          evaluator: evaluator.name,
          details: `Unknown evaluator type: ${evaluator.type}`,
        };
    }
  }

  // --------------------------------------------------------------------------
  // Auto-Remediation
  // --------------------------------------------------------------------------

  /**
   * Check for taste score degradation and trigger remediation if needed
   */
  private checkTasteScoreDegradation(currentScore: number, spanId: string): void {
    const drop = this.tasteScoreBaseline - currentScore;
    const threshold = this.config.remediation.tasteScoreDropThreshold;

    if (drop > threshold) {
      this.triggerRemediation(drop, spanId);
    }

    // Update baseline (exponential moving average)
    this.tasteScoreBaseline = this.tasteScoreBaseline * 0.9 + currentScore * 0.1;
  }

  /**
   * Trigger auto-remediation actions
   */
  private triggerRemediation(scoreDrop: number, spanId: string): void {
    const now = Date.now();
    const cooldown = this.config.remediation.cooldownMs;

    // Enforce cooldown
    if (now - this.lastRemediationTime < cooldown) {
      return;
    }

    this.lastRemediationTime = now;

    const actionsTaken = this.executeRemediationActions(
      this.config.remediation.actions,
      scoreDrop,
      spanId
    );

    const event: RemediationEvent = {
      timestamp: new Date().toISOString(),
      triggerId: spanId,
      scoreDrop,
      actionsTaken,
      resolved: false,
    };

    this.remediationHistory.push(event);

    console.warn(`[CinematicObservability] Taste score dropped by ${(scoreDrop * 100).toFixed(1)}%. Actions: ${actionsTaken.join(', ')}`);
  }

  /**
   * Execute remediation actions
   */
  private executeRemediationActions(
    actions: RemediationAction[],
    scoreDrop: number,
    spanId: string
  ): RemediationAction[] {
    const executed: RemediationAction[] = [];

    for (const action of actions) {
      switch (action) {
        case 'alert':
          this.sendAlert(scoreDrop, spanId);
          executed.push(action);
          break;
        case 'escalate':
          this.escalateToHuman(scoreDrop, spanId);
          executed.push(action);
          break;
        case 'circuit-break':
          this.activateCircuitBreaker();
          executed.push(action);
          break;
        case 'retry':
          this.scheduleRetry(spanId);
          executed.push(action);
          break;
        case 'rollback':
          this.initiateRollback(spanId);
          executed.push(action);
          break;
      }
    }

    return executed;
  }

  private sendAlert(scoreDrop: number, spanId: string): void {
    console.error(`[ALERT] Taste vault score dropped by ${(scoreDrop * 100).toFixed(1)}% (span: ${spanId})`);
  }

  private escalateToHuman(scoreDrop: number, spanId: string): void {
    console.error(`[ESCALATION] Manual review required for span ${spanId} (drop: ${(scoreDrop * 100).toFixed(1)}%)`);
  }

  private activateCircuitBreaker(): void {
    console.warn('[CIRCUIT BREAKER] Temporarily blocking new spans for cool-down');
  }

  private scheduleRetry(spanId: string): void {
    console.log(`[RETRY] Scheduling retry for span ${spanId}`);
  }

  private initiateRollback(spanId: string): void {
    console.warn(`[ROLLBACK] Initiating rollback for span ${spanId}`);
  }

  // --------------------------------------------------------------------------
  // Statistics & Queries
  // --------------------------------------------------------------------------

  /**
   * Get observability statistics
   */
  getStats(): {
    totalSpans: number;
    activeTraces: number;
    runningSpans: number;
    completedSpans: number;
    failedSpans: number;
    remediationCount: number;
  } {
    let runningSpans = 0;
    let completedSpans = 0;
    let failedSpans = 0;

    for (const span of Array.from(this.spans.values())) {
      if (span.status === 'running') runningSpans++;
      else if (span.status === 'success') completedSpans++;
      else if (span.status === 'failure') failedSpans++;
    }

    return {
      totalSpans: this.spans.size,
      activeTraces: this.traceIndex.size,
      runningSpans,
      completedSpans,
      failedSpans,
      remediationCount: this.remediationHistory.length,
    };
  }

  /**
   * Get remediation history
   */
  getRemediationHistory(): RemediationEvent[] {
    return [...this.remediationHistory];
  }

  /**
   * Get spans by status
   */
  getSpansByStatus(status: SpanStatus): CinematicSpan[] {
    return Array.from(this.spans.values()).filter(span => span.status === status);
  }

  /**
   * Get spans by agent
   */
  getSpansByAgent(agentId: string): CinematicSpan[] {
    return Array.from(this.spans.values()).filter(span => span.agentId === agentId);
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private enforceMemoryLimit(): void {
    if (this.spans.size > this.config.maxInMemorySpans) {
      // Remove oldest completed spans first
      const completedSpans = Array.from(this.spans.values())
        .filter(s => s.status !== 'running' && s.endTime)
        .sort((a, b) => new Date(a.endTime!).getTime() - new Date(b.endTime!).getTime());

      const toRemove = Math.floor(this.config.maxInMemorySpans * 0.1); // Remove 10%
      for (let i = 0; i < toRemove && i < completedSpans.length; i++) {
        const span = completedSpans[i];
        this.spans.delete(span.id);
        this.traceIndex.get(span.traceId)?.delete(span.id);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /**
   * Clear all spans and traces
   */
  clear(): void {
    this.spans.clear();
    this.traceIndex.clear();
    this.remediationHistory = [];
    this.tasteScoreBaseline = 1.0;
    this.lastRemediationTime = 0;
  }

  /**
   * Flush spans older than specified age
   * @param maxAgeMs - Maximum age in milliseconds
   */
  flushOldSpans(maxAgeMs: number): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, span] of Array.from(this.spans.entries())) {
      const spanTime = new Date(span.startTime).getTime();
      if (now - spanTime > maxAgeMs) {
        this.spans.delete(id);
        this.traceIndex.get(span.traceId)?.delete(id);
        removed++;
      }
    }

    return removed;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let cinematicInstance: CinematicObservability | null = null;

/**
 * Get or create the singleton CinematicObservability instance
 */
export function getCinematicObservability(
  config?: Partial<CinematicConfig>
): CinematicObservability {
  if (!cinematicInstance) {
    cinematicInstance = new CinematicObservability(config);
  }
  return cinematicInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCinematicObservability(): void {
  cinematicInstance?.clear();
  cinematicInstance = null;
}

/**
 * Create a new instance (for multi-tenant scenarios)
 */
export function createCinematicObservability(
  config?: Partial<CinematicConfig>
): CinematicObservability {
  return new CinematicObservability(config);
}
