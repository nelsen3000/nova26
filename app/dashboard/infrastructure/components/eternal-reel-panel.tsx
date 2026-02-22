'use client';

// S3-23: Eternal Data Reel Overview Panel
// Shows Harness, SAGA, Hindsight, and RLM status from src/eternal-reel/
// Wires into: HarnessManager.list(), HindsightEngine state, RlmPipeline metrics, SAGA OuterLoopState

import { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  RefreshCw,
  Brain,
  Dna,
  Archive,
  Minimize2,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { HarnessStatus } from '@/src/harness/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HarnessStats {
  total: number;
  byStatus: Partial<Record<HarnessStatus, number>>;
  checkpoints: number;
}

export interface HindsightStats {
  totalFragments: number;
  consolidatedFragments: number;
  namespaces: number;
  lastConsolidationAt: number | null;
}

export interface RlmStats {
  pipelinesRun: number;
  compressionRatio: number;
  tokensSaved: number;
  avgContextUtilization: number;
}

export interface SagaStats {
  generation: number;
  populationSize: number;
  bestFitness: number;
  isRunning: boolean;
}

export interface EternalReelSnapshot {
  harness: HarnessStats;
  hindsight: HindsightStats;
  rlm: RlmStats;
  saga: SagaStats;
  lastUpdatedAt: number;
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function HarnessSubPanel({ stats }: { stats: HarnessStats }) {
  const running = stats.byStatus['running'] ?? 0;
  const completed = stats.byStatus['completed'] ?? 0;
  const failed = stats.byStatus['failed'] ?? 0;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold">Harness</p>
        <Badge variant="secondary" className="ml-auto h-4 px-1 text-[10px]">{stats.total} total</Badge>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-md bg-success/10 py-1">
          <p className="text-sm font-bold text-success">{running}</p>
          <p className="text-[10px] text-muted-foreground">Running</p>
        </div>
        <div className="rounded-md bg-muted py-1">
          <p className="text-sm font-bold">{completed}</p>
          <p className="text-[10px] text-muted-foreground">Done</p>
        </div>
        <div className={cn('rounded-md py-1', failed > 0 ? 'bg-destructive/10' : 'bg-muted')}>
          <p className={cn('text-sm font-bold', failed > 0 && 'text-destructive')}>{failed}</p>
          <p className="text-[10px] text-muted-foreground">Failed</p>
        </div>
      </div>
      {stats.checkpoints > 0 && (
        <p className="mt-1.5 text-right text-[10px] text-muted-foreground">
          <CheckCircle className="mr-0.5 inline h-2.5 w-2.5 text-success" />
          {stats.checkpoints} checkpoints saved
        </p>
      )}
    </div>
  );
}

function HindsightSubPanel({ stats }: { stats: HindsightStats }) {
  const consolidationPct = stats.totalFragments > 0
    ? Math.round((stats.consolidatedFragments / stats.totalFragments) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold">Hindsight</p>
        <Badge variant="secondary" className="ml-auto h-4 px-1 text-[10px]">{stats.namespaces} ns</Badge>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Memory fragments</span>
          <span className="font-mono font-medium">{stats.totalFragments.toLocaleString()}</span>
        </div>
        {stats.totalFragments > 0 && (
          <>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Consolidation</span>
              <span>{consolidationPct}%</span>
            </div>
            <Progress value={consolidationPct} className="h-1" />
          </>
        )}
        {stats.lastConsolidationAt && (
          <p className="text-[10px] text-muted-foreground">
            Last: {new Date(stats.lastConsolidationAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

function RlmSubPanel({ stats }: { stats: RlmStats }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold">RLM Compression</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-base font-bold">
            {stats.compressionRatio > 0 ? `${(stats.compressionRatio * 100).toFixed(0)}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">Ratio</p>
        </div>
        <div>
          <p className="text-base font-bold">
            {stats.tokensSaved > 0 ? `${(stats.tokensSaved / 1000).toFixed(1)}k` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">Tokens saved</p>
        </div>
      </div>
      {stats.pipelinesRun > 0 && (
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          {stats.pipelinesRun} pipelines run
        </p>
      )}
    </div>
  );
}

function SagaSubPanel({ stats }: { stats: SagaStats }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Dna className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold">SAGA Evolution</p>
        {stats.isRunning && (
          <Badge className="ml-auto h-4 gap-1 px-1 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Running
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-base font-bold">{stats.generation}</p>
          <p className="text-[10px] text-muted-foreground">Gen</p>
        </div>
        <div>
          <p className="text-base font-bold">{stats.populationSize}</p>
          <p className="text-[10px] text-muted-foreground">Pop</p>
        </div>
        <div>
          <p className={cn('text-base font-bold', stats.bestFitness > 0.7 && 'text-success')}>
            {stats.bestFitness > 0 ? stats.bestFitness.toFixed(2) : '—'}
          </p>
          <p className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
            <TrendingUp className="h-2.5 w-2.5" />
            Fit
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function EternalReelLoading() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Skeleton className="h-5 w-44" />
        </div>
        <Skeleton className="h-3 w-52" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Populated ────────────────────────────────────────────────────────────────

function EternalReelPopulated({
  data,
  onRefresh,
}: {
  data: EternalReelSnapshot;
  onRefresh: () => void;
}) {
  const hasActivity = data.harness.total > 0 || data.hindsight.totalFragments > 0 || data.saga.generation > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Eternal Data Reel
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActivity ? (
              <Badge variant="default" className="gap-1 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Idle</Badge>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} aria-label="Refresh Eternal Reel status">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardDescription>Harness · SAGA · Hindsight · RLM compression status</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {!hasActivity && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Archive className="h-3.5 w-3.5 shrink-0" />
            <span>No active evolution cycles. Start a build to initialize the Eternal Reel.</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <HarnessSubPanel stats={data.harness} />
          <HindsightSubPanel stats={data.hindsight} />
          <RlmSubPanel stats={data.rlm} />
          <SagaSubPanel stats={data.saga} />
        </div>

        <p className="text-right text-[10px] text-muted-foreground">
          Updated {new Date(data.lastUpdatedAt).toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function buildEmptySnapshot(): EternalReelSnapshot {
  return {
    harness: { total: 0, byStatus: {}, checkpoints: 0 },
    hindsight: { totalFragments: 0, consolidatedFragments: 0, namespaces: 0, lastConsolidationAt: null },
    rlm: { pipelinesRun: 0, compressionRatio: 0, tokensSaved: 0, avgContextUtilization: 0 },
    saga: { generation: 0, populationSize: 0, bestFitness: 0, isRunning: false },
    lastUpdatedAt: Date.now(),
  };
}

type FetchState =
  | { status: 'loading' }
  | { status: 'loaded'; data: EternalReelSnapshot };

export function EternalReelPanel() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  const fetchStatus = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/infrastructure/eternal-reel');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: EternalReelSnapshot };
      setState({ status: 'loaded', data: json.data });
    } catch {
      setState({ status: 'loaded', data: buildEmptySnapshot() });
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (state.status === 'loading') return <EternalReelLoading />;
  return <EternalReelPopulated data={state.data} onRefresh={fetchStatus} />;
}
