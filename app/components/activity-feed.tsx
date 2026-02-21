'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/api';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, Play, Clock, Zap } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const eventIcons = {
  task_started: { icon: Play, className: 'text-info' },
  task_completed: { icon: CheckCircle2, className: 'text-success' },
  task_failed: { icon: XCircle, className: 'text-destructive' },
  build_started: { icon: Play, className: 'text-info' },
  build_completed: { icon: CheckCircle2, className: 'text-success' },
  build_failed: { icon: XCircle, className: 'text-destructive' },
} as const;

type ActivityItem = {
  _id: string;
  agentName: string;
  eventType: string;
  details: string;
  timestamp: string;
  taskId?: string;
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const eventConfig =
    eventIcons[item.eventType as keyof typeof eventIcons] ?? {
      icon: Clock,
      className: 'text-muted-foreground',
    };
  const Icon = eventConfig.icon;

  return (
    <div className="flex items-start gap-3 py-3 animate-fade-in">
      <div className={cn('mt-0.5 shrink-0', eventConfig.className)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{item.agentName}</span>
          <Badge variant="outline" className="h-4 px-1 text-[10px]">
            {item.eventType.replace('_', ' ')}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.details}</p>
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
      </span>
    </div>
  );
}

export function ActivityFeed() {
  const activities = useQuery(api.realtime.subscribeToActivity);

  if (activities === undefined) {
    return (
      <div className="space-y-3 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="mt-0.5 h-4 w-4 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <Zap className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No activity yet.</p>
        <p className="text-xs text-muted-foreground">Run your first build to see events here.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[320px]">
      <div className="divide-y divide-border px-1">
        {(activities as ActivityItem[]).map((item) => (
          <ActivityRow key={item._id} item={item} />
        ))}
      </div>
    </ScrollArea>
  );
}
