// Observability with Langfuse
// Provides tracing for Ralph Loop iterations, LLM calls, gates, and council votes

import { Langfuse } from 'langfuse';

/**
 * Generic council vote type - flexible to match different sources
 */
export interface CouncilVote {
  member: string;
  verdict?: 'approve' | 'reject' | 'abstain';
  vote?: 'approve' | 'reject' | 'abstain';
  reasoning?: string;
  confidence?: number;
}

/**
 * Langfuse trace handle
 */
export interface TraceHandle {
  id: string;
  name: string;
}

/**
 * Council decision type
 */
export interface CouncilDecision {
  finalVerdict: 'approved' | 'rejected' | 'pending' | 'deadlock';
  summary: string;
  votes: CouncilVote[];
}

/**
 * NovaTracer - Wrapper around Langfuse for Nova26 observability
 * Gracefully degrades if Langfuse is not configured
 */
export class NovaTracer {
  private langfuse: Langfuse | null = null;
  private enabled: boolean = false;
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Initialize Langfuse client if credentials are available
   */
  private initialize(): void {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const host = process.env.LANGFUSE_HOST;
    
    if (!publicKey || !secretKey) {
      console.log('Langfuse not configured - observability disabled');
      console.log('To enable: set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY environment variables');
      return;
    }
    
    try {
      this.langfuse = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: host || 'https://cloud.langfuse.com',
      });
      this.enabled = true;
      console.log('Langfuse observability enabled');
    } catch (error: unknown) {
      console.warn(`Failed to initialize Langfuse: ${error instanceof Error ? error.message : String(error)}`);
      this.enabled = false;
    }
  }
  
  /**
   * Check if tracing is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Start a new tracing session
   * @param prdName - Name of the PRD being processed
   * @returns Session ID or null if disabled
   */
  public startSession(prdName: string): string | null {
    if (!this.enabled || !this.langfuse) {
      return null;
    }
    
    try {
      const session = this.langfuse.trace({
        name: `nova26-${prdName}`,
        metadata: {
          prdName,
          startedAt: new Date().toISOString(),
        },
      });
      
      return session.id;
    } catch (error: unknown) {
      console.warn(`Failed to start Langfuse session: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Start a trace for a specific task
   * @param sessionId - Session ID from startSession
   * @param taskId - Task ID
   * @param agent - Agent name
   * @returns Trace handle or null if disabled
   */
  public startTrace(sessionId: string | null, taskId: string, agent: string): TraceHandle | null {
    if (!this.enabled || !this.langfuse || !sessionId) {
      return null;
    }
    
    try {
      const trace = this.langfuse.trace({
        name: `task-${taskId}`,
        sessionId,
        metadata: {
          taskId,
          agent,
        },
      });
      
      return {
        id: trace.id,
        name: `task-${taskId}`,
      };
    } catch (error: unknown) {
      console.warn(`Failed to start trace: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Log an LLM call
   * @param trace - Trace handle from startTrace
   * @param input - Input prompt
   * @param output - LLM response
   * @param model - Model used
   * @param duration - Duration in ms
   * @param tokens - Token count
   */
  public logLLMCall(
    trace: TraceHandle | null,
    input: string,
    output: string,
    model: string,
    duration: number,
    tokens: number
  ): void {
    if (!this.enabled || !this.langfuse || !trace) {
      return;
    }
    
    try {
      this.langfuse.trace({
        id: trace.id,
      }).generation({
        name: 'llm-call',
        model,
        input: {
          prompt: input.substring(0, 1000), // Truncate for storage
        },
        output: {
          response: output.substring(0, 1000),
        },
        metadata: {
          duration,
          tokens,
        },
      });
    } catch (error: unknown) {
      console.warn(`Failed to log LLM call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Log a gate result
   * @param trace - Trace handle from startTrace
   * @param gate - Gate name
   * @param passed - Whether gate passed
   * @param message - Gate message/result
   */
  public logGateResult(
    trace: TraceHandle | null,
    gate: string,
    passed: boolean,
    message: string
  ): void {
    if (!this.enabled || !this.langfuse || !trace) {
      return;
    }
    
    try {
      this.langfuse.trace({
        id: trace.id,
      }).span({
        name: `gate-${gate}`,
        metadata: {
          gate,
          passed,
          message: message.substring(0, 500),
        },
      });
    } catch (error: unknown) {
      console.warn(`Failed to log gate result: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Log council vote
   * @param trace - Trace handle from startTrace
   * @param votes - Array of council votes
   * @param decision - Final council decision
   */
  public logCouncilVote(
    trace: TraceHandle | null,
    votes: CouncilVote[],
    decision: CouncilDecision
  ): void {
    if (!this.enabled || !this.langfuse || !trace) {
      return;
    }
    
    try {
      this.langfuse.trace({
        id: trace.id,
      }).span({
        name: 'council-vote',
        metadata: {
          votes: votes.map(v => ({
            member: v.member,
            verdict: v.verdict,
          })),
          finalVerdict: decision.finalVerdict,
          summary: decision.summary.substring(0, 500),
        },
      });
    } catch (error: unknown) {
      console.warn(`Failed to log council vote: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * End a trace
   * @param trace - Trace handle from startTrace
   * @param status - 'done' or 'failed'
   * @param error - Optional error message
   */
  public endTrace(
    trace: TraceHandle | null,
    status: 'done' | 'failed',
    error?: string
  ): void {
    if (!this.enabled || !this.langfuse || !trace) {
      return;
    }
    
    try {
      this.langfuse.trace({
        id: trace.id,
      }).update({
        metadata: {
          status,
          error: error?.substring(0, 500),
          endedAt: new Date().toISOString(),
        },
      });
    } catch (error: unknown) {
      console.warn(`Failed to end trace: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Flush all pending events to Langfuse
   * Should be called before process exits
   */
  public async flush(): Promise<void> {
    if (!this.enabled || !this.langfuse) {
      return;
    }
    
    try {
      await this.langfuse.flushAsync();
    } catch (error: unknown) {
      console.warn(`Failed to flush Langfuse: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Create a singleton instance
 */
let tracerInstance: NovaTracer | null = null;

export function getTracer(): NovaTracer {
  if (!tracerInstance) {
    tracerInstance = new NovaTracer();
  }
  return tracerInstance;
}
