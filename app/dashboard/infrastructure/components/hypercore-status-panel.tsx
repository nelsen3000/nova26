'use client';

// S3-20: Hypercore Status Panel
// Shows active stores, sync status, peer count, and health metrics
// from src/hypercore/ — AggregateMetrics, HealthStatus, OfflineQueueStats

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  Users,
  Activity,
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
import type { AggregateMetrics, HealthStatus } from '@/src/hypercore/observability.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HypercoreQueueStats {
  queueLength: number;
  isOnline: boolean;
  totalDrained: number;
  totalFailed: number;
}

export interface HypercoreStatusSnapshot {
  health: HealthStatus;
  metrics: AggregateMetrics;
  queue: HypercoreQueueStats;
  peerCount: number;
  storeCount: number;
  syncState: 'synced' | 'syncing' | 'offline';
  lastUpdatedAt: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SyncBadge({ state }: { state: HypercoreStatusSnapshot['syncState'] }) {
  const config = {
    synced: { label: 'Synced', variant: 'outline' as const, icon: Wifi, className: 'text-success border-success' },
    syncing: { label: 'Syncing', variant: 'secondary' as const, icon: RefreshCw, className: 'text-info' },
    offline: { label: 'Offline', variant: 'destructive' as const, icon: WifiOff, className: '' },
  }[state];

  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className={cn('gap-1', config.className)}>
      <Icon className={cn('h-3 w-3', state === 'syncing' && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}

function MetricRow({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">
        {value}
        {unit && <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────

function HypercoreStatusLoading() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-md" />
      </CardContent>
    </Card>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function HypercoreStatusEmpty() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" />
          P2P Hypercore
        </CardTitle>
        <CardDescription>Distributed storage and replication status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <HardDrive className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No Hypercore stores initialized</p>
          <p className="text-xs text-muted-foreground">Start a build to initialize P2P storage</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function HypercoreStatusError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" />
          P2P Hypercore
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-md bg-destructive/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Failed to load Hypercore status</p>
            <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={onRetry}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Populated state ──────────────────────────────────────────────────────────

function HypercoreStatusPopulated({
  data,
  onRefresh,
}: {
  data: HypercoreStatusSnapshot;
  onRefresh: () => void;
}) {
  const errorRatePct = Math.round(data.metrics.errorRate * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            P2P Hypercore
          </CardTitle>
          <div className="flex items-center gap-2">
            <SyncBadge state={data.syncState} />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} aria-label="Refresh Hypercore status">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardDescription>Distributed storage and replication status</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health banner */}
        {!data.health.healthy && (
          <div className="flex items-start gap-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{data.health.warnings.join(' · ') || 'Health check failed'}</span>
          </div>
        )}

        {/* Key stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border p-2 text-center">
            <p className="text-lg font-bold">{data.storeCount}</p>
            <p className="text-[10px] text-muted-foreground">Stores</p>
          </div>
          <div className="rounded-lg border border-border p-2 text-center">
            <p className="text-lg font-bold">{data.peerCount}</p>
            <p className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
              <Users className="h-2.5 w-2.5" />
              Peers
            </p>
          </div>
          <div className={cn('rounded-lg border p-2 text-center', data.health.healthy ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5')}>
            {data.health.healthy
              ? <CheckCircle className="mx-auto h-5 w-5 text-success" />
              : <AlertTriangle className="mx-auto h-5 w-5 text-destructive" />}
            <p className="text-[10px] text-muted-foreground">{data.health.healthy ? 'Healthy' : 'Degraded'}</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="rounded-md border border-border p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Replication Metrics</p>
          <div className="divide-y divide-border">
            <MetricRow label="Total appends" value={data.metrics.totalAppends.toLocaleString()} />
            <MetricRow label="Data replicated" value={(data.metrics.totalBytes / 1024).toFixed(1)} unit="KB" />
            <MetricRow label="Replication events" value={data.metrics.totalReplicationEvents.toLocaleString()} />
            <MetricRow label="Error rate" value={`${errorRatePct}%`} />
          </div>
        </div>

        {/* Offline queue */}
        {data.queue.queueLength > 0 && (
          <div className="rounded-md border border-border p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <p className="flex items-center gap-1 font-medium text-muted-foreground">
                <Activity className="h-3 w-3" />
                Offline queue
              </p>
              <span className="font-mono text-muted-foreground">{data.queue.queueLength} pending</span>
            </div>
            <Progress value={Math.min(100, data.queue.queueLength * 10)} className="h-1.5" />
          </div>
        )}

        <p className="text-right text-[10px] text-muted-foreground">
          Updated {new Date(data.lastUpdatedAt).toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type FetchState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'loaded'; data: HypercoreStatusSnapshot };

function buildEmptySnapshot(): HypercoreStatusSnapshot {
  return {
    health: { healthy: true, errorCount: 0, windowMs: 60_000, threshold: 10, warnings: [] },
    metrics: { totalAppends: 0, totalBytes: 0, totalReplicationEvents: 0, totalErrors: 0, avgBytesPerAppend: 0, errorRate: 0, logMetrics: {} },
    queue: { queueLength: 0, isOnline: false, totalDrained: 0, totalFailed: 0 },
    peerCount: 0,
    storeCount: 0,
    syncState: 'offline',
    lastUpdatedAt: Date.now(),
  };
}

export function HypercoreStatusPanel() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  const fetchStatus = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/infrastructure/hypercore');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: HypercoreStatusSnapshot | null };
      if (!json.data || json.data.storeCount === 0) {
        setState({ status: 'empty' });
      } else {
        setState({ status: 'loaded', data: json.data });
      }
    } catch {
      // Fallback: show empty state (no running Hypercore instance)
      setState({ status: 'empty' });
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (state.status === 'loading') return <HypercoreStatusLoading />;
  if (state.status === 'error') return <HypercoreStatusError onRetry={fetchStatus} />;
  if (state.status === 'empty') {
    return <HypercoreStatusPopulated data={buildEmptySnapshot()} onRefresh={fetchStatus} />;
  }
  return <HypercoreStatusPopulated data={state.data} onRefresh={fetchStatus} />;
}
