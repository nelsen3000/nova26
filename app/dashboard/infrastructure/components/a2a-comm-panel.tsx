'use client';

// S3-22: A2A Communication Panel
// Shows active channels, message throughput, agent tier visualization, and recent routing events
// from src/a2a/ — A2AMetrics, RegistryStats, AgentCard, A2ALogEvent

import { useState, useEffect, useCallback } from 'react';
import {
  Network,
  RefreshCw,
  AlertTriangle,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Layers,
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
import { cn } from '@/lib/utils';
import type { A2AMetrics, A2ALogEvent, AgentTier } from '@/src/a2a/types.js';
import type { RegistryStats } from '@/src/a2a/registry.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface A2AStatusSnapshot {
  metrics: A2AMetrics;
  registry: RegistryStats;
  recentEvents: A2ALogEvent[];
  activeChannels: number;
  lastUpdatedAt: number;
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

const tierConfig: Record<AgentTier, { label: string; className: string }> = {
  L0: { label: 'L0 Core', className: 'bg-primary/10 text-primary border-primary/20' },
  L1: { label: 'L1 Senior', className: 'bg-info/10 text-info border-info/20' },
  L2: { label: 'L2 Worker', className: 'bg-success/10 text-success border-success/20' },
  L3: { label: 'L3 Util', className: 'bg-muted text-muted-foreground border-border' },
};

function TierBadge({ tier, count }: { tier: AgentTier; count: number }) {
  const cfg = tierConfig[tier];
  return (
    <div className={cn('flex items-center justify-between rounded-md border px-2 py-1.5', cfg.className)}>
      <span className="text-xs font-medium">{cfg.label}</span>
      <span className="text-sm font-bold">{count}</span>
    </div>
  );
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: A2ALogEvent }) {
  const isError = event.eventType === 'routing-failed';
  return (
    <div className="flex items-start gap-2 py-1.5 text-xs">
      <span className={cn('mt-0.5 shrink-0 font-mono text-[10px]', isError ? 'text-destructive' : 'text-muted-foreground')}>
        {new Date(event.timestamp).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate', isError && 'text-destructive')}>
          {event.agentId ?? '?'} → {event.targetAgentId ?? 'broadcast'}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">{event.eventType}</p>
      </div>
    </div>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function A2ALoading() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <Skeleton className="h-5 w-36" />
        </div>
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}
        </div>
        <Skeleton className="h-24 rounded-md" />
      </CardContent>
    </Card>
  );
}

// ─── Populated ────────────────────────────────────────────────────────────────

function A2APopulated({
  data,
  onRefresh,
}: {
  data: A2AStatusSnapshot;
  onRefresh: () => void;
}) {
  const totalAgents = data.registry.totalAgents;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4" />
            A2A Communication
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={data.activeChannels > 0 ? 'default' : 'secondary'} className="text-xs">
              {data.activeChannels} channels
            </Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} aria-label="Refresh A2A status">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardDescription>Agent-to-agent message flow and routing events</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Message throughput */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border p-2">
            <ArrowUp className="h-4 w-4 shrink-0 text-success" />
            <div>
              <p className="text-base font-bold">{data.metrics.messagesSent.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Sent</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border p-2">
            <ArrowDown className="h-4 w-4 shrink-0 text-info" />
            <div>
              <p className="text-base font-bold">{data.metrics.messagesReceived.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Received</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border p-2">
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-base font-bold">{data.metrics.toolInvocations.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">MCP tools</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border p-2">
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-base font-bold">
                {data.metrics.avgRoutingLatencyMs > 0 ? `${data.metrics.avgRoutingLatencyMs.toFixed(1)}ms` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">Avg latency</p>
            </div>
          </div>
        </div>

        {/* Routing failures */}
        {data.metrics.routingFailures > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>{data.metrics.routingFailures} routing failure{data.metrics.routingFailures !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Agent tier breakdown */}
        {totalAgents > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Layers className="h-3 w-3" />
              Agent tier distribution ({totalAgents} registered)
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(['L0', 'L1', 'L2', 'L3'] as AgentTier[]).map(tier => (
                <TierBadge key={tier} tier={tier} count={data.registry.byTier[tier] ?? 0} />
              ))}
            </div>
          </div>
        )}

        {/* Recent events */}
        {data.recentEvents.length > 0 ? (
          <div className="rounded-md border border-border">
            <p className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Recent routing events
            </p>
            <div className="divide-y divide-border px-3">
              {data.recentEvents.slice(0, 5).map((event, i) => (
                <EventRow key={`${event.timestamp}-${i}`} event={event} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Network className="mb-1 h-5 w-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No routing events yet</p>
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

function buildEmptySnapshot(): A2AStatusSnapshot {
  return {
    metrics: {
      messagesSent: 0,
      messagesReceived: 0,
      routingFailures: 0,
      toolInvocations: 0,
      avgRoutingLatencyMs: 0,
      channelsOpened: 0,
      channelsClosed: 0,
    },
    registry: { totalAgents: 0, localAgents: 0, remoteAgents: 0, byTier: { L0: 0, L1: 0, L2: 0, L3: 0 } },
    recentEvents: [],
    activeChannels: 0,
    lastUpdatedAt: Date.now(),
  };
}

type FetchState =
  | { status: 'loading' }
  | { status: 'loaded'; data: A2AStatusSnapshot };

export function A2ACommPanel() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  const fetchStatus = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/infrastructure/a2a');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: A2AStatusSnapshot };
      setState({ status: 'loaded', data: json.data });
    } catch {
      setState({ status: 'loaded', data: buildEmptySnapshot() });
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 20_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (state.status === 'loading') return <A2ALoading />;
  return <A2APopulated data={state.data} onRefresh={fetchStatus} />;
}
