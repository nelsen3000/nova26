'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/api';
import { use } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Play } from 'lucide-react';
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

type Task = {
  _id: string;
  taskId: string;
  title: string;
  agent: string;
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed' | 'blocked';
  phase: number;
  createdAt: string;
  output?: string;
  error?: string;
};

const taskStatusIcons = {
  done: { icon: CheckCircle2, className: 'text-success' },
  failed: { icon: XCircle, className: 'text-destructive' },
  running: { icon: Play, className: 'text-info animate-pulse' },
  pending: { icon: Clock, className: 'text-muted-foreground' },
  ready: { icon: Clock, className: 'text-warning' },
  blocked: { icon: XCircle, className: 'text-muted-foreground' },
};

function TaskRow({ task }: { task: Task }) {
  const statusConfig =
    taskStatusIcons[task.status] ?? taskStatusIcons.pending;
  const Icon = statusConfig.icon;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className={cn('mt-0.5 shrink-0', statusConfig.className)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{task.title}</span>
          <Badge variant="outline" className="h-4 px-1 text-[10px]">
            Phase {task.phase}
          </Badge>
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
            {task.agent}
          </Badge>
        </div>
        {task.error && (
          <p className="mt-1 text-xs text-destructive">{task.error}</p>
        )}
        {task.output && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {task.output}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
      </span>
    </div>
  );
}

export default function BuildDetailPage({
  params,
}: {
  params: Promise<{ buildId: string }>;
}) {
  const { buildId } = use(params);
  const buildData = useQuery(api.dashboard.getBuild, { buildId: buildId as any });

  if (buildData === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (buildData === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium">Build not found</p>
        <Button variant="link" asChild>
          <Link href="/dashboard/builds">Back to builds</Link>
        </Button>
      </div>
    );
  }

  const { build, tasks } = buildData as {
    build: {
      _id: string;
      prdName: string;
      prdId: string;
      status: string;
      startedAt: string;
      completedAt?: string;
      error?: string;
    };
    tasks: Task[];
  };

  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0;
  const phases = [...new Set(tasks.map((t) => t.phase))].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/builds">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{build.prdName}</h1>
          <p className="text-xs text-muted-foreground">{build.prdId}</p>
        </div>
        <Badge
          variant={
            build.status === 'completed'
              ? 'outline'
              : build.status === 'failed'
              ? 'destructive'
              : 'default'
          }
          className="ml-auto"
        >
          {build.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Started</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {formatDistanceToNow(new Date(build.startedAt), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {doneTasks} / {tasks.length} done
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duration</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {build.completedAt
                ? `${Math.round(
                    (new Date(build.completedAt).getTime() -
                      new Date(build.startedAt).getTime()) /
                      1000
                  )}s`
                : build.status === 'running'
                ? 'In progress'
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Progress</CardTitle>
              <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      {/* Tasks by phase */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            {tasks.length} tasks across {phases.length} phases
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No tasks found.</p>
          ) : (
            <div className="space-y-4">
              {phases.map((phase) => {
                const phaseTasks = tasks.filter((t) => t.phase === phase);
                return (
                  <div key={phase}>
                    <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Phase {phase}
                    </h3>
                    <div className="divide-y divide-border rounded-lg border border-border px-2">
                      {phaseTasks.map((task) => (
                        <TaskRow key={task._id} task={task} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {build.error && (
        <Card className="border-destructive">
          <CardHeader className="pb-3">
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-destructive">{build.error}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
