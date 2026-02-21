// Nova-Bench — 42 role-specific benchmark tasks
// Tests routing quality per agent role
// KIMI-R22-01 | Feb 2026

import type { BenchmarkTask, BenchmarkResult } from '../types.js';

export const NOVA_BENCH_TASKS: BenchmarkTask[] = [
  // MARS — Deployment & DevOps (6 tasks)
  { id: 'MARS-01', agentId: 'MARS', role: 'DevOps', complexity: 'medium',
    prompt: 'Write a GitHub Actions workflow for a Next.js app with pnpm and Vercel deployment.',
    expectedKeywords: ['workflow', 'pnpm', 'vercel', 'deploy', 'node'],
    timeoutMs: 15000 },
  { id: 'MARS-02', agentId: 'MARS', role: 'DevOps', complexity: 'high',
    prompt: 'Write a Kubernetes Helm chart for a stateful AI inference service with GPU node selectors.',
    expectedKeywords: ['helm', 'chart', 'gpu', 'nodeSelector', 'resources'],
    timeoutMs: 20000 },
  { id: 'MARS-03', agentId: 'MARS', role: 'DevOps', complexity: 'low',
    prompt: 'Write a Dockerfile for a Node.js 22 app using multi-stage builds.',
    expectedKeywords: ['FROM', 'RUN', 'COPY', 'multistage', 'node'],
    timeoutMs: 10000 },
  { id: 'MARS-04', agentId: 'MARS', role: 'DevOps', complexity: 'medium',
    prompt: 'Write a docker-compose.yml for Next.js + Postgres + Redis.',
    expectedKeywords: ['services', 'postgres', 'redis', 'volumes', 'depends_on'],
    timeoutMs: 12000 },
  { id: 'MARS-05', agentId: 'MARS', role: 'DevOps', complexity: 'high',
    prompt: 'Design a blue-green deployment strategy for a Convex + Next.js app.',
    expectedKeywords: ['blue', 'green', 'traffic', 'rollback', 'health'],
    timeoutMs: 18000 },
  { id: 'MARS-06', agentId: 'MARS', role: 'DevOps', complexity: 'medium',
    prompt: 'Write a Terraform module for an AWS Lambda function with S3 trigger.',
    expectedKeywords: ['resource', 'aws_lambda', 's3', 'trigger', 'iam'],
    timeoutMs: 15000 },

  // VENUS — UI/UX Design (6 tasks)
  { id: 'VENUS-01', agentId: 'VENUS', role: 'UI/UX', complexity: 'medium',
    prompt: 'Design a React dashboard card component for real-time build status with Tailwind CSS.',
    expectedKeywords: ['card', 'status', 'tailwind', 'className', 'badge'],
    timeoutMs: 12000 },
  { id: 'VENUS-02', agentId: 'VENUS', role: 'UI/UX', complexity: 'high',
    prompt: 'Create a Figma-to-code pipeline for a multi-step onboarding wizard with state machine.',
    expectedKeywords: ['wizard', 'step', 'state', 'onboarding', 'next'],
    timeoutMs: 18000 },
  { id: 'VENUS-03', agentId: 'VENUS', role: 'UI/UX', complexity: 'low',
    prompt: 'Write a shadcn/ui Button variant for a "destructive" action with loading state.',
    expectedKeywords: ['variant', 'destructive', 'loading', 'disabled', 'spinner'],
    timeoutMs: 8000 },
  { id: 'VENUS-04', agentId: 'VENUS', role: 'UI/UX', complexity: 'medium',
    prompt: 'Create a responsive sidebar navigation with mobile drawer using Framer Motion.',
    expectedKeywords: ['sidebar', 'drawer', 'motion', 'animate', 'responsive'],
    timeoutMs: 14000 },
  { id: 'VENUS-05', agentId: 'VENUS', role: 'UI/UX', complexity: 'high',
    prompt: 'Design a real-time collaboration cursor overlay component using Yjs and React.',
    expectedKeywords: ['cursor', 'yjs', 'awareness', 'realtime', 'collaboration'],
    timeoutMs: 20000 },
  { id: 'VENUS-06', agentId: 'VENUS', role: 'UI/UX', complexity: 'medium',
    prompt: 'Create a dark mode token system using CSS custom properties and Tailwind.',
    expectedKeywords: ['token', 'dark', 'variable', 'tailwind', 'semantic'],
    timeoutMs: 12000 },

  // MERCURY — Code Review (4 tasks)
  { id: 'MERCURY-01', agentId: 'MERCURY', role: 'CodeReview', complexity: 'medium',
    prompt: 'Review this TypeScript function for potential null pointer dereferences and suggest fixes.',
    expectedKeywords: ['null', 'optional', 'undefined', 'guard', 'fix'],
    timeoutMs: 10000 },
  { id: 'MERCURY-02', agentId: 'MERCURY', role: 'CodeReview', complexity: 'high',
    prompt: 'Identify security vulnerabilities in a Node.js API handler that takes user input.',
    expectedKeywords: ['injection', 'sanitize', 'validate', 'escape', 'security'],
    timeoutMs: 14000 },
  { id: 'MERCURY-03', agentId: 'MERCURY', role: 'CodeReview', complexity: 'low',
    prompt: 'Review a React component for performance issues: unnecessary re-renders and missing memoization.',
    expectedKeywords: ['memo', 'useMemo', 'useCallback', 'render', 'performance'],
    timeoutMs: 8000 },
  { id: 'MERCURY-04', agentId: 'MERCURY', role: 'CodeReview', complexity: 'high',
    prompt: 'Analyze this database schema for N+1 query problems and suggest eager loading patterns.',
    expectedKeywords: ['N+1', 'eager', 'join', 'index', 'query'],
    timeoutMs: 14000 },

  // SUN — PRD Generation (4 tasks)
  { id: 'SUN-01', agentId: 'SUN', role: 'PRD', complexity: 'high',
    prompt: 'Write a PRD for an AI agent that monitors production errors and auto-creates GitHub issues.',
    expectedKeywords: ['requirement', 'user story', 'acceptance criteria', 'scope', 'milestone'],
    timeoutMs: 25000 },
  { id: 'SUN-02', agentId: 'SUN', role: 'PRD', complexity: 'medium',
    prompt: 'Define success metrics for a developer productivity dashboard.',
    expectedKeywords: ['metric', 'KPI', 'baseline', 'target', 'measurement'],
    timeoutMs: 15000 },
  { id: 'SUN-03', agentId: 'SUN', role: 'PRD', complexity: 'high',
    prompt: 'Write a product requirements document for a multi-tenant SaaS billing system.',
    expectedKeywords: ['billing', 'subscription', 'tenant', 'invoice', 'usage'],
    timeoutMs: 25000 },
  { id: 'SUN-04', agentId: 'SUN', role: 'PRD', complexity: 'medium',
    prompt: 'Define the user journey for a first-time developer setting up Nova26.',
    expectedKeywords: ['journey', 'onboarding', 'step', 'friction', 'activation'],
    timeoutMs: 15000 },

  // NEPTUNE — Data Pipeline (4 tasks)
  { id: 'NEPTUNE-01', agentId: 'NEPTUNE', role: 'DataPipeline', complexity: 'high',
    prompt: 'Design a streaming ETL pipeline for ingesting GitHub webhook events into Convex.',
    expectedKeywords: ['stream', 'webhook', 'transform', 'ingest', 'queue'],
    timeoutMs: 18000 },
  { id: 'NEPTUNE-02', agentId: 'NEPTUNE', role: 'DataPipeline', complexity: 'medium',
    prompt: 'Write a BullMQ job processor for batch embedding generation with Voyage 3.5.',
    expectedKeywords: ['queue', 'job', 'batch', 'embedding', 'retry'],
    timeoutMs: 14000 },
  { id: 'NEPTUNE-03', agentId: 'NEPTUNE', role: 'DataPipeline', complexity: 'low',
    prompt: 'Write a Convex scheduled function to aggregate daily build statistics.',
    expectedKeywords: ['cron', 'scheduled', 'aggregate', 'stats', 'mutation'],
    timeoutMs: 10000 },
  { id: 'NEPTUNE-04', agentId: 'NEPTUNE', role: 'DataPipeline', complexity: 'high',
    prompt: 'Design a real-time semantic search system using Convex + Voyage embeddings.',
    expectedKeywords: ['embedding', 'similarity', 'cosine', 'index', 'search'],
    timeoutMs: 20000 },

  // IO — Real-Time Processing (4 tasks)
  { id: 'IO-01', agentId: 'IO', role: 'RealTime', complexity: 'high',
    prompt: 'Design a WebSocket event multiplexer for distributing agent output to multiple clients.',
    expectedKeywords: ['websocket', 'multiplex', 'broadcast', 'subscriber', 'event'],
    timeoutMs: 15000 },
  { id: 'IO-02', agentId: 'IO', role: 'RealTime', complexity: 'medium',
    prompt: 'Implement an SSE endpoint in Next.js for streaming AI output tokens.',
    expectedKeywords: ['SSE', 'stream', 'event', 'token', 'chunk'],
    timeoutMs: 10000 },
  { id: 'IO-03', agentId: 'IO', role: 'RealTime', complexity: 'low',
    prompt: 'Write a rate limiter middleware for high-frequency WebSocket messages.',
    expectedKeywords: ['rate', 'limit', 'throttle', 'window', 'middleware'],
    timeoutMs: 8000 },
  { id: 'IO-04', agentId: 'IO', role: 'RealTime', complexity: 'medium',
    prompt: 'Design a latency budget system for sub-200ms AI inference responses.',
    expectedKeywords: ['latency', 'budget', 'p99', 'timeout', 'fallback'],
    timeoutMs: 12000 },

  // JUPITER — Architecture (4 tasks)
  { id: 'JUPITER-01', agentId: 'JUPITER', role: 'Architecture', complexity: 'high',
    prompt: 'Design the data model for a multi-agent orchestration system with event sourcing.',
    expectedKeywords: ['event', 'aggregate', 'command', 'projection', 'schema'],
    timeoutMs: 25000 },
  { id: 'JUPITER-02', agentId: 'JUPITER', role: 'Architecture', complexity: 'high',
    prompt: 'Architect a plugin system for Nova26 that allows third-party agent extensions.',
    expectedKeywords: ['plugin', 'extension', 'manifest', 'sandbox', 'API'],
    timeoutMs: 22000 },
  { id: 'JUPITER-03', agentId: 'JUPITER', role: 'Architecture', complexity: 'medium',
    prompt: 'Design the caching strategy for an LLM response cache with semantic deduplication.',
    expectedKeywords: ['cache', 'TTL', 'semantic', 'hash', 'eviction'],
    timeoutMs: 16000 },
  { id: 'JUPITER-04', agentId: 'JUPITER', role: 'Architecture', complexity: 'high',
    prompt: 'Design a horizontal scaling strategy for Nova26 when processing 10,000 concurrent builds.',
    expectedKeywords: ['horizontal', 'shard', 'load', 'queue', 'partition'],
    timeoutMs: 22000 },

  // PLUTO — Security (4 tasks)
  { id: 'PLUTO-01', agentId: 'PLUTO', role: 'Security', complexity: 'high',
    prompt: 'Audit a Next.js API route for OWASP Top 10 vulnerabilities.',
    expectedKeywords: ['OWASP', 'injection', 'XSS', 'CSRF', 'auth'],
    timeoutMs: 18000 },
  { id: 'PLUTO-02', agentId: 'PLUTO', role: 'Security', complexity: 'medium',
    prompt: 'Write a secret detection scanner for a codebase using regex patterns.',
    expectedKeywords: ['regex', 'secret', 'API key', 'token', 'scan'],
    timeoutMs: 12000 },
  { id: 'PLUTO-03', agentId: 'PLUTO', role: 'Security', complexity: 'high',
    prompt: 'Design a zero-trust architecture for Nova26 agent-to-agent communication.',
    expectedKeywords: ['zero-trust', 'mTLS', 'attestation', 'policy', 'principal'],
    timeoutMs: 20000 },
  { id: 'PLUTO-04', agentId: 'PLUTO', role: 'Security', complexity: 'medium',
    prompt: 'Write a SOC 2 access control matrix for Nova26 Sovereign Tier.',
    expectedKeywords: ['SOC2', 'access', 'control', 'role', 'audit'],
    timeoutMs: 15000 },

  // GANYMEDE — Testing (4 tasks)
  { id: 'GANYMEDE-01', agentId: 'GANYMEDE', role: 'Testing', complexity: 'medium',
    prompt: 'Write Playwright E2E tests for a multi-step form submission flow.',
    expectedKeywords: ['test', 'page', 'fill', 'click', 'expect'],
    timeoutMs: 14000 },
  { id: 'GANYMEDE-02', agentId: 'GANYMEDE', role: 'Testing', complexity: 'high',
    prompt: 'Design a chaos engineering test suite for Nova26 agent failure scenarios.',
    expectedKeywords: ['chaos', 'failure', 'inject', 'resilience', 'fallback'],
    timeoutMs: 20000 },
  { id: 'GANYMEDE-03', agentId: 'GANYMEDE', role: 'Testing', complexity: 'low',
    prompt: 'Write vitest unit tests for a utility function that formats build duration.',
    expectedKeywords: ['it', 'expect', 'describe', 'toBe', 'vitest'],
    timeoutMs: 8000 },
  { id: 'GANYMEDE-04', agentId: 'GANYMEDE', role: 'Testing', complexity: 'medium',
    prompt: 'Design a visual regression testing pipeline using Playwright screenshots.',
    expectedKeywords: ['screenshot', 'diff', 'threshold', 'baseline', 'regression'],
    timeoutMs: 14000 },
  // CHARON — Debug & Fix (2 tasks)
  { id: 'CHARON-01', agentId: 'CHARON', role: 'Debug', complexity: 'medium',
    prompt: 'Debug a TypeScript async function that sometimes resolves with undefined.',
    expectedKeywords: ['async', 'undefined', 'race', 'await', 'fix'],
    timeoutMs: 12000 },
  { id: 'CHARON-02', agentId: 'CHARON', role: 'Debug', complexity: 'high',
    prompt: 'Investigate a memory leak in a long-running Node.js process using heap snapshots.',
    expectedKeywords: ['heap', 'leak', 'gc', 'snapshot', 'closure'],
    timeoutMs: 18000 },
];

export type InferenceRunnerFn = (
  agentId: string,
  prompt: string,
  timeoutMs: number,
) => Promise<string>;

export async function runNovaBench(
  tasks: BenchmarkTask[],
  runnerFn: InferenceRunnerFn,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (const task of tasks) {
    const start = Date.now();
    let output = '';
    let passed = false;

    try {
      output = await runnerFn(task.agentId, task.prompt, task.timeoutMs);
      const lowerOutput = output.toLowerCase();
      const keywordsFound = task.expectedKeywords.filter(kw =>
        lowerOutput.includes(kw.toLowerCase()),
      );
      const score = Math.round((keywordsFound.length / task.expectedKeywords.length) * 100);
      passed = score >= 60;

      results.push({
        taskId: task.id,
        agentId: task.agentId,
        modelUsed: 'unknown',
        durationMs: Date.now() - start,
        passed,
        score,
        keywordsFound,
        timestamp: Date.now(),
      });
    } catch {
      results.push({
        taskId: task.id,
        agentId: task.agentId,
        modelUsed: 'unknown',
        durationMs: Date.now() - start,
        passed: false,
        score: 0,
        keywordsFound: [],
        timestamp: Date.now(),
      });
    }
  }

  return results;
}

export function computeBenchSummary(results: BenchmarkResult[]): {
  totalTasks: number;
  passRate: number;
  avgScore: number;
  byAgent: Record<string, { pass: number; total: number; avgScore: number }>;
} {
  const byAgent: Record<string, { pass: number; total: number; scores: number[] }> = {};

  for (const r of results) {
    if (!byAgent[r.agentId]) byAgent[r.agentId] = { pass: 0, total: 0, scores: [] };
    byAgent[r.agentId]!.total++;
    if (r.passed) byAgent[r.agentId]!.pass++;
    byAgent[r.agentId]!.scores.push(r.score);
  }

  const summary: Record<string, { pass: number; total: number; avgScore: number }> = {};
  for (const [id, data] of Object.entries(byAgent)) {
    summary[id] = {
      pass: data.pass,
      total: data.total,
      avgScore: data.scores.reduce((s, v) => s + v, 0) / data.scores.length,
    };
  }

  return {
    totalTasks: results.length,
    passRate: results.filter(r => r.passed).length / results.length,
    avgScore: results.reduce((s, r) => s + r.score, 0) / results.length,
    byAgent: summary,
  };
}
