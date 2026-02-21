'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/api';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Hammer,
  Bot,
  CheckSquare,
  TrendingUp,
  ArrowRight,
  Circle,
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
import { ActivityFeed } from '@/app/components/activity-feed';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────
// Stat card
// ──────────────────────────────────────
function StatCard({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-sm font-medium">{title}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && !isLoading && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────
// Agent mini-card
// ──────────────────────────────────────
type AgentStat = {
  agentId: string;
  name: string;
  role: string;
  currentStatus: 'active' | 'idle';
  successRate: number;
  completedTasks: number;
};

function AgentCard({ agent }: { agent: AgentStat }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          agent.currentStatus === 'active' ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{agent.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{agent.role}</p>
      </div>
      <Badge
        variant={agent.currentStatus === 'active' ? 'default' : 'secondary'}
        className="h-4 shrink-0 px-1 text-[9px]"
      >
        {agent.currentStatus}
      </Badge>
    </div>
  );
}

// ──────────────────────────────────────
// Recent builds table
// ──────────────────────────────────────
type Build = {
  _id: string;
  prdName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
};

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  running: { label: 'Running', variant: 'default' },
  completed: { label: 'Done', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
};

function BuildRow({ build }: { build: Build }) {
  const s = statusBadge[build.status] ?? statusBadge.pending;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Circle
        className={cn(
          'h-2 w-2 shrink-0 fill-current',
          build.status === 'running' && 'text-info animate-pulse',
          build.status === 'completed' && 'text-success',
          build.status === 'failed' && 'text-destructive',
          build.status === 'pending' && 'text-muted-foreground/40'
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{build.prdName}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(build.startedAt), { addSuffix: true })}
        </p>
      </div>
      <Badge variant={s.variant} className="shrink-0 text-xs">
        {s.label}
      </Badge>
    </div>
  );
}

// ──────────────────────────────────────
// Page
// ──────────────────────────────────────
export default function DashboardPage() {
  const stats = useQuery(api.dashboard.getOverviewStats);
  const agentStats = useQuery(api.dashboard.getAgentStats);
  const recentBuilds = useQuery(api.dashboard.listBuilds, { pageSize: 5 });

  const isLoading = stats === undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Your Nova26 agent activity at a glance.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" />
          Live
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Builds"
          value={stats?.totalBuilds ?? '—'}
          icon={Hammer}
          description={
            stats ? `${stats.completedBuilds} completed, ${stats.failedBuilds} failed` : undefined
          }
          isLoading={isLoading}
        />
        <StatCard
          title="Active Agents"
          value={stats?.totalAgents ?? 21}
          icon={Bot}
          description="Specialized AI agents available"
          isLoading={isLoading}
        />
        <StatCard
          title="Tasks Completed"
          value={stats?.completedTasks ?? '—'}
          icon={CheckSquare}
          description={stats ? `${stats.activeTasks} active` : undefined}
          isLoading={isLoading}
        />
        <StatCard
          title="Success Rate"
          value={stats ? `${stats.successRate.toFixed(1)}%` : '—'}
          icon={TrendingUp}
          description="Gate pass rate across all builds"
          isLoading={isLoading}
        />
      </div>

      {/* Success rate progress bar */}
      {stats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Build Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Success rate</span>
              <span>{stats.successRate.toFixed(1)}%</span>
            </div>
            <Progress value={stats.successRate} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Recent builds */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Recent Builds</CardTitle>
              <CardDescription>Latest build runs and their status.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/builds">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentBuilds === undefined ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : recentBuilds.builds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Hammer className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No builds yet.</p>
                <p className="text-xs text-muted-foreground">Run your first build to see it here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(recentBuilds.builds as Build[]).map((build) => (
                  <BuildRow key={build._id} build={build} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>Real-time agent events.</CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <ActivityFeed />
          </CardContent>
        </Card>
      </div>

      {/* Agent grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Agents</CardTitle>
            <CardDescription>Status of all 21 Nova26 agents.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/agents">
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {agentStats === undefined ? (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : agentStats.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No agents registered. Run a build to initialize agent tracking.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {(agentStats as AgentStat[]).map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
