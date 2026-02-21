'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/api';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Hammer, ArrowRight, RefreshCw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Build = {
  _id: string;
  prdName: string;
  prdId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
};

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  running: { label: 'Running', variant: 'default' },
  completed: { label: 'Done', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
};

function BuildsTable({ builds }: { builds: Build[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Build</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {builds.map((build) => {
          const s = statusBadge[build.status] ?? statusBadge.pending;
          const duration =
            build.completedAt
              ? `${Math.round(
                  (new Date(build.completedAt).getTime() -
                    new Date(build.startedAt).getTime()) /
                    1000
                )}s`
              : build.status === 'running'
              ? 'In progress'
              : '—';

          return (
            <TableRow key={build._id} className="group">
              <TableCell>
                <div>
                  <p className="font-medium">{build.prdName}</p>
                  <p className="text-xs text-muted-foreground">{build.prdId}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={s.variant} className="gap-1">
                  {build.status === 'running' && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  )}
                  {s.label}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(build.startedAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{duration}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" asChild>
                  <Link href={`/dashboard/builds/${build._id}`}>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function BuildsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const buildsData = useQuery(api.dashboard.listBuilds, { pageSize: 50 });

  const builds = (buildsData?.builds ?? []) as Build[];
  const filtered =
    statusFilter === 'all' ? builds : builds.filter((b) => b.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Builds</h1>
          <p className="text-sm text-muted-foreground">All build runs across your projects.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          {buildsData !== undefined ? `${filtered.length} builds` : ''}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Build History</CardTitle>
          <CardDescription>Click a row to see tasks and execution details.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {buildsData === undefined ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Hammer className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {statusFilter === 'all' ? 'No builds yet' : `No ${statusFilter} builds`}
              </p>
              <p className="text-xs text-muted-foreground">
                {statusFilter === 'all'
                  ? 'Run your first build to see results here.'
                  : 'Try changing the status filter.'}
              </p>
            </div>
          ) : (
            <BuildsTable builds={filtered} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
