'use client';

// S3-21: Hypervisor Sandbox Panel
// Shows active sandboxes, per-sandbox resource usage, lifecycle states, and network policy summary
// from src/hypervisor/ — VMInstance, VMState, ResourceUsageSummary, AggregateHypervisorMetrics

import { useState, useEffect, useCallback } from 'react';
import {
  Server,
  RefreshCw,
  AlertTriangle,
  Shield,
  Cpu,
  MemoryStick,
  Network,
  Play,
  Pause,
  Square,
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
import type { VMInstance, VMState } from '@/src/hypervisor/types.js';
import type { AggregateHypervisorMetrics, SecurityMetrics } from '@/src/hypervisor/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HypervisorStatusSnapshot {
  vms: VMInstance[];
  metrics: AggregateHypervisorMetrics;
  security: SecurityMetrics;
  networkRulesCount: number;
  lastUpdatedAt: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stateConfig: Record<VMState, { label: string; color: string; icon: React.ElementType }> = {
  creating: { label: 'Creating', color: 'text-info', icon: RefreshCw },
  running: { label: 'Running', color: 'text-success', icon: Play },
  paused: { label: 'Paused', color: 'text-warning', icon: Pause },
  stopped: { label: 'Stopped', color: 'text-muted-foreground', icon: Square },
  destroyed: { label: 'Destroyed', color: 'text-muted-foreground/40', icon: Square },
  error: { label: 'Error', color: 'text-destructive', icon: AlertTriangle },
};

function VMStateBadge({ state }: { state: VMState }) {
  const cfg = stateConfig[state] ?? stateConfig.error;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 text-[10px]', cfg.color)}>
      <Icon className={cn('h-2.5 w-2.5', state === 'creating' && 'animate-spin')} />
      {cfg.label}
    </Badge>
  );
}

function ResourceBar({ label, used, max, unit }: { label: string; used: number; max: number; unit: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const isHigh = pct > 80;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className={cn('font-mono', isHigh && 'text-warning')}>
          {used}/{max} {unit}
        </span>
      </div>
      <Progress value={pct} className={cn('h-1', isHigh && '[&>div]:bg-warning')} />
    </div>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function HypervisorLoading() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-3 w-52" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}
        </div>
        <Skeleton className="h-20 rounded-md" />
      </CardContent>
    </Card>
  );
}

// ─── VM row ───────────────────────────────────────────────────────────────────

function VMRow({ vm }: { vm: VMInstance }) {
  return (
    <div className="space-y-2 rounded-md border border-border p-2.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{vm.spec.name}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{vm.vmId.slice(0, 16)}…</p>
        </div>
        <VMStateBadge state={vm.state} />
      </div>
      {vm.state === 'running' && (
        <div className="space-y-1.5">
          <ResourceBar
            label="CPU"
            used={vm.resources.cpuMillicores}
            max={1000}
            unit="mc"
          />
          <ResourceBar
            label="Memory"
            used={vm.resources.memoryMb}
            max={vm.resources.memoryMb}
            unit="MB"
          />
        </div>
      )}
    </div>
  );
}

// ─── Populated ────────────────────────────────────────────────────────────────

function HypervisorPopulated({
  data,
  onRefresh,
}: {
  data: HypervisorStatusSnapshot;
  onRefresh: () => void;
}) {
  const runningVMs = data.vms.filter(v => v.state === 'running');
  const totalVMs = data.vms.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Hypervisor Sandboxes
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={runningVMs.length > 0 ? 'default' : 'secondary'} className="text-xs">
              {runningVMs.length} / {totalVMs} running
            </Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} aria-label="Refresh hypervisor status">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardDescription>Sandbox lifecycle state and resource usage</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Cpu, label: 'Spawned', value: data.metrics.totalVMsSpawned },
            { icon: Square, label: 'Terminated', value: data.metrics.totalVMsTerminated },
            { icon: Shield, label: 'Violations', value: data.security.policyViolations },
            { icon: Network, label: 'Net rules', value: data.networkRulesCount },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg border border-border p-2 text-center">
              <Icon className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-base font-bold">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Avg task duration */}
        {data.metrics.avgTaskDurationMs > 0 && (
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
            <span className="text-muted-foreground">Avg task duration</span>
            <span className="font-mono font-medium">{data.metrics.avgTaskDurationMs.toFixed(0)} ms</span>
          </div>
        )}

        {/* VM list */}
        {totalVMs === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Server className="mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No active sandboxes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.vms.slice(0, 4).map(vm => <VMRow key={vm.vmId} vm={vm} />)}
            {totalVMs > 4 && (
              <p className="text-center text-xs text-muted-foreground">+{totalVMs - 4} more sandboxes</p>
            )}
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

function buildEmptySnapshot(): HypervisorStatusSnapshot {
  return {
    vms: [],
    metrics: {
      totalVMsSpawned: 0,
      totalVMsTerminated: 0,
      currentlyRunning: 0,
      totalTasksExecuted: 0,
      totalErrors: 0,
      avgTaskDurationMs: 0,
      providerBreakdown: {},
    },
    security: {
      policyViolations: 0,
      imageVerificationFailures: 0,
      unauthorizedAccessAttempts: 0,
      sandboxEscapeAttempts: 0,
    },
    networkRulesCount: 0,
    lastUpdatedAt: Date.now(),
  };
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: HypervisorStatusSnapshot };

export function HypervisorSandboxPanel() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  const fetchStatus = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/infrastructure/hypervisor');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: HypervisorStatusSnapshot };
      setState({ status: 'loaded', data: json.data });
    } catch {
      // No running hypervisor — show empty snapshot
      setState({ status: 'loaded', data: buildEmptySnapshot() });
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (state.status === 'loading') return <HypervisorLoading />;
  if (state.status === 'error') {
    return (
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Hypervisor Sandboxes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={fetchStatus}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <HypervisorPopulated data={state.data} onRefresh={fetchStatus} />;
}
