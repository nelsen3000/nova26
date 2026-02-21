// LangSmith Bridge — LangSmith-compatible trace format
// KIMI-R23-05 | Feb 2026

import type { CinematicSpan } from './cinematic-core.js';

export interface LangSmithRun {
  id: string;
  name: string;
  run_type: 'llm' | 'chain' | 'tool' | 'retriever' | 'embedding';
  start_time: string;     // ISO 8601
  end_time?: string;
  status: 'success' | 'error';
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  parent_run_id?: string;
  session_id: string;
  tags: string[];
  extra: Record<string, unknown>;
  feedback_stats?: { score: number; comment?: string };
}

export interface LangSmithSession {
  id: string;
  name: string;
  runs: LangSmithRun[];
  createdAt: string;
  projectName: string;
}

export interface LangSmithDataset {
  id: string;
  name: string;
  examples: Array<{
    id: string;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
  }>;
}

function spanKindToRunType(kind: CinematicSpan['kind']): LangSmithRun['run_type'] {
  switch (kind) {
    case 'llm': return 'llm';
    case 'tool': return 'tool';
    case 'retrieval': return 'retriever';
    case 'embedding': return 'embedding';
    default: return 'chain';
  }
}

export function cinematicSpanToLangSmithRun(
  span: CinematicSpan,
  sessionId: string,
): LangSmithRun {
  return {
    id: span.id,
    name: span.name,
    run_type: spanKindToRunType(span.kind),
    start_time: new Date(span.startTime).toISOString(),
    end_time: span.endTime ? new Date(span.endTime).toISOString() : undefined,
    status: span.status === 'error' ? 'error' : 'success',
    inputs: { input: span.input, agentId: span.agentId },
    outputs: span.output ? { output: span.output } : undefined,
    error: span.error,
    parent_run_id: span.parentId ?? undefined,
    session_id: sessionId,
    tags: [span.kind, ...(span.agentId ? [span.agentId] : [])],
    extra: {
      tokensIn: span.tokensIn,
      tokensOut: span.tokensOut,
      costUsd: span.costUsd,
      tasteScore: span.tasteScore,
      ...span.metadata,
    },
  };
}

export class LangSmithBridge {
  private sessions = new Map<string, LangSmithSession>();
  private datasets = new Map<string, LangSmithDataset>();

  createSession(name: string, projectName: string): LangSmithSession {
    const session: LangSmithSession = {
      id: `ls-sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      runs: [],
      createdAt: new Date().toISOString(),
      projectName,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  ingestSpans(sessionId: string, spans: CinematicSpan[]): LangSmithRun[] {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const runs = spans.map(s => cinematicSpanToLangSmithRun(s, sessionId));
    session.runs.push(...runs);
    return runs;
  }

  ingestTrace(traceId: string, spans: CinematicSpan[], projectName = 'nova26'): LangSmithSession {
    const session = this.createSession(`trace-${traceId}`, projectName);
    this.ingestSpans(session.id, spans);
    return session;
  }

  getSession(sessionId: string): LangSmithSession | undefined {
    return this.sessions.get(sessionId);
  }

  createDataset(name: string, examples: LangSmithDataset['examples']): LangSmithDataset {
    const dataset: LangSmithDataset = {
      id: `ls-ds-${Date.now()}`,
      name,
      examples,
    };
    this.datasets.set(dataset.id, dataset);
    return dataset;
  }

  getDataset(datasetId: string): LangSmithDataset | undefined {
    return this.datasets.get(datasetId);
  }

  exportSessionJson(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    return JSON.stringify(session, null, 2);
  }

  getRunCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.runs.length ?? 0;
  }

  listSessions(): LangSmithSession[] {
    return [...this.sessions.values()];
  }
}
