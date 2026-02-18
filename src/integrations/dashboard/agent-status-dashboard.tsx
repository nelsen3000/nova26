/**
 * Tremor-based Agent Monitoring Dashboard
 * Tracks status of all 21 Nova26 agents in real-time
 */

'use client';

import React from 'react';
import {
  Card,
  Title,
  Text,
  Tracker,
  type TrackerBlockProps,
  Flex,
  Metric,
  Grid,
  Col,
  ProgressBar,
  Badge,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  AreaChart,
  BarChart,
  DonutChart,
} from '@tremor/react';

// ============================================================================
// Types
// ============================================================================

type AgentStatus = 'idle' | 'running' | 'completed' | 'error' | 'waiting';

interface AgentState {
  name: string;
  status: AgentStatus;
  task?: string;
  progress: number;
  startTime?: number;
  endTime?: number;
  tokensUsed: number;
  cost: number;
  lastOutput?: string;
}

interface BuildMetrics {
  totalBuilds: number;
  successRate: number;
  avgDuration: number;
  totalCost: number;
  activeAgents: number;
}

// ============================================================================
// Mock Data (replace with real Convex subscriptions)
// ============================================================================

const MOCK_AGENTS: AgentState[] = [
  { name: 'SUN', status: 'completed', task: 'PRD Generation', progress: 100, tokensUsed: 2500, cost: 0.15 },
  { name: 'EARTH', status: 'completed', task: 'Requirements', progress: 100, tokensUsed: 1800, cost: 0.12 },
  { name: 'PLUTO', status: 'running', task: 'Schema Design', progress: 65, tokensUsed: 1200, cost: 0.08 },
  { name: 'MARS', status: 'waiting', task: 'Type Definitions', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'VENUS', status: 'waiting', task: 'UI Components', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'GANYMEDE', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'TITAN', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'SATURN', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'MERCURY', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'URANUS', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'ANDROMEDA', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'CALLISTO', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'ATLAS', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'CHARON', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'ENCELADUS', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'EUROPA', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'IO', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'JUPITER', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'MIMAS', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'NEPTUNE', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
  { name: 'TRITON', status: 'idle', progress: 0, tokensUsed: 0, cost: 0 },
];

const MOCK_METRICS: BuildMetrics = {
  totalBuilds: 47,
  successRate: 94,
  avgDuration: 245000, // ms
  totalCost: 12.45,
  activeAgents: 3,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusColor(status: AgentStatus): TrackerBlockProps['color'] {
  switch (status) {
    case 'completed': return 'emerald';
    case 'running': return 'blue';
    case 'error': return 'red';
    case 'waiting': return 'amber';
    case 'idle': return 'slate';
    default: return 'slate';
  }
}

function getStatusBadgeColor(status: AgentStatus): string {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-800';
    case 'running': return 'bg-blue-100 text-blue-800';
    case 'error': return 'bg-red-100 text-red-800';
    case 'waiting': return 'bg-amber-100 text-amber-800';
    case 'idle': return 'bg-slate-100 text-slate-800';
    default: return 'bg-slate-100 text-slate-800';
  }
}

// ============================================================================
// Components
// ============================================================================

export function AgentStatusTracker({ agents }: { agents: AgentState[] }) {
  const trackerData: TrackerBlockProps[] = agents.map(agent => ({
    color: getStatusColor(agent.status),
    tooltip: `${agent.name}: ${agent.status}${agent.task ? ` (${agent.task})` : ''}`,
  }));

  return (
    <Card>
      <Title>Agent Status Overview</Title>
      <Text>Real-time status of all 21 Nova26 agents</Text>
      <div className="mt-6">
        <Tracker data={trackerData} className="h-4" />
      </div>
      <Flex className="mt-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <Text className="text-xs">Completed</Text>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <Text className="text-xs">Running</Text>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <Text className="text-xs">Waiting</Text>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <Text className="text-xs">Error</Text>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-300" />
          <Text className="text-xs">Idle</Text>
        </div>
      </Flex>
    </Card>
  );
}

export function MetricsOverview({ metrics }: { metrics: BuildMetrics }) {
  return (
    <Grid numItems={4} className="gap-4">
      <Card decoration="top" decorationColor="indigo">
        <Text>Total Builds</Text>
        <Metric>{metrics.totalBuilds}</Metric>
      </Card>
      <Card decoration="top" decorationColor="emerald">
        <Text>Success Rate</Text>
        <Metric>{metrics.successRate}%</Metric>
      </Card>
      <Card decoration="top" decorationColor="blue">
        <Text>Active Agents</Text>
        <Metric>{metrics.activeAgents}</Metric>
      </Card>
      <Card decoration="top" decorationColor="amber">
        <Text>Total Cost</Text>
        <Metric>${metrics.totalCost.toFixed(2)}</Metric>
      </Card>
    </Grid>
  );
}

export function AgentDetailsTable({ agents }: { agents: AgentState[] }) {
  const activeAgents = agents.filter(a => a.status !== 'idle');

  return (
    <Card>
      <Title>Active Agents</Title>
      <Table className="mt-4">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Agent</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Task</TableHeaderCell>
            <TableHeaderCell>Progress</TableHeaderCell>
            <TableHeaderCell>Tokens</TableHeaderCell>
            <TableHeaderCell>Cost</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {activeAgents.map((agent) => (
            <TableRow key={agent.name}>
              <TableCell className="font-medium">{agent.name}</TableCell>
              <TableCell>
                <Badge className={getStatusBadgeColor(agent.status)}>
                  {agent.status}
                </Badge>
              </TableCell>
              <TableCell>{agent.task || '-'}</TableCell>
              <TableCell>
                <ProgressBar value={agent.progress} className="w-24" />
              </TableCell>
              <TableCell>{agent.tokensUsed.toLocaleString()}</TableCell>
              <TableCell>${agent.cost.toFixed(3)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function CostBreakdownChart() {
  const data = [
    { name: 'SUN', cost: 0.45 },
    { name: 'VENUS', cost: 0.82 },
    { name: 'MARS', cost: 0.63 },
    { name: 'PLUTO', cost: 0.31 },
    { name: 'GANYMEDE', cost: 0.28 },
    { name: 'Others', cost: 0.42 },
  ];

  return (
    <Card>
      <Title>Cost by Agent</Title>
      <DonutChart
        className="mt-6"
        data={data}
        category="cost"
        index="name"
        valueFormatter={(value) => `$${value.toFixed(2)}`}
        colors={['indigo', 'violet', 'blue', 'cyan', 'emerald', 'slate']}
      />
    </Card>
  );
}

export function BuildHistoryChart() {
  const data = [
    { date: 'Mon', builds: 8, failures: 1 },
    { date: 'Tue', builds: 12, failures: 0 },
    { date: 'Wed', builds: 6, failures: 2 },
    { date: 'Thu', builds: 10, failures: 0 },
    { date: 'Fri', builds: 7, failures: 1 },
    { date: 'Sat', builds: 3, failures: 0 },
    { date: 'Sun', builds: 1, failures: 0 },
  ];

  return (
    <Card>
      <Title>Build History (7 Days)</Title>
      <BarChart
        className="mt-6 h-48"
        data={data}
        index="date"
        categories={['builds', 'failures']}
        colors={['emerald', 'red']}
        stack={false}
      />
    </Card>
  );
}

export function TokenUsageChart() {
  const data = [
    { time: '00:00', tokens: 1200 },
    { time: '04:00', tokens: 800 },
    { time: '08:00', tokens: 3500 },
    { time: '12:00', tokens: 5200 },
    { time: '16:00', tokens: 4800 },
    { time: '20:00', tokens: 2100 },
  ];

  return (
    <Card>
      <Title>Token Usage (24h)</Title>
      <AreaChart
        className="mt-6 h-48"
        data={data}
        index="time"
        categories={['tokens']}
        colors={['indigo']}
        valueFormatter={(value) => value.toLocaleString()}
      />
    </Card>
  );
}

// ============================================================================
// Main Dashboard
// ============================================================================

export function AgentDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <Title>Nova26 Agent Dashboard</Title>
        <Text>Monitor all 21 agents, track costs, and view build metrics</Text>
      </div>

      <MetricsOverview metrics={MOCK_METRICS} />
      
      <AgentStatusTracker agents={MOCK_AGENTS} />
      
      <Grid numItems={3} className="gap-6">
        <Col numColSpan={2}>
          <AgentDetailsTable agents={MOCK_AGENTS} />
        </Col>
        <Col>
          <CostBreakdownChart />
        </Col>
      </Grid>
      
      <Grid numItems={2} className="gap-6">
        <BuildHistoryChart />
        <TokenUsageChart />
      </Grid>
    </div>
  );
}

export default AgentDashboard;
