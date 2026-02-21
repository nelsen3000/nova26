'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/api';
import { Bot, TrendingUp, Search } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type AgentStat = {
  agentId: string;
  name: string;
  role: string;
  currentStatus: 'active' | 'idle';
  successRate: number;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
  avgDuration: number;
  lastActive: string;
};

function AgentCard({ agent }: { agent: AgentStat }) {
  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm">{agent.name}</CardTitle>
            <CardDescription className="truncate text-xs">{agent.role}</CardDescription>
          </div>
          <Badge
            variant={agent.currentStatus === 'active' ? 'default' : 'secondary'}
            className="shrink-0 gap-1"
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                agent.currentStatus === 'active' ? 'bg-current animate-pulse' : 'bg-current/50'
              )}
            />
            {agent.currentStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Success rate</span>
            <span className="font-medium">{agent.successRate.toFixed(1)}%</span>
          </div>
          <Progress value={agent.successRate} className="h-1.5" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-sm font-semibold">{agent.totalTasks}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-success">{agent.completedTasks}</p>
            <p className="text-[10px] text-muted-foreground">Done</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-destructive">{agent.failedTasks}</p>
            <p className="text-[10px] text-muted-foreground">Failed</p>
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Avg: {agent.avgDuration > 0 ? `${agent.avgDuration}ms` : '—'}</span>
          <span>{formatDistanceToNow(new Date(agent.lastActive), { addSuffix: true })}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'name' | 'success' | 'tasks'>('name');

  const agentStats = useQuery(api.dashboard.getAgentStats);
  const agents = (agentStats ?? []) as AgentStat[];

  const filtered = agents
    .filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.role.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === 'success') return b.successRate - a.successRate;
      if (sort === 'tasks') return b.totalTasks - a.totalTasks;
      return a.name.localeCompare(b.name);
    });

  const activeCount = agents.filter((a) => a.currentStatus === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            {agentStats !== undefined
              ? `${agents.length} agents · ${activeCount} active`
              : 'Loading agents...'}
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          {agents.length > 0 ? agents.length : '—'} registered
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort by name</SelectItem>
            <SelectItem value="success">Sort by success rate</SelectItem>
            <SelectItem value="tasks">Sort by task count</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {agentStats === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Bot className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? 'No agents match your search' : 'No agents registered'}
          </p>
          <p className="text-xs text-muted-foreground">
            {search
              ? 'Try a different search term.'
              : 'Agents are registered automatically when a build runs.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
