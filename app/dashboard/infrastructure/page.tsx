'use client';

// S3-20..S3-23: Infrastructure Dashboard Page
// Aggregates all 4 integration panels: Hypercore, Hypervisor, A2A, Eternal Data Reel

import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { HypercoreStatusPanel } from './components/hypercore-status-panel.js';
import { HypervisorSandboxPanel } from './components/hypervisor-sandbox-panel.js';
import { A2ACommPanel } from './components/a2a-comm-panel.js';
import { EternalReelPanel } from './components/eternal-reel-panel.js';

export default function InfrastructurePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Infrastructure</h1>
          <p className="text-sm text-muted-foreground">
            P2P Hypercore · Hypervisor · A2A · Eternal Data Reel
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Activity className="h-3 w-3" />
          Live polling
        </Badge>
      </div>

      {/* Panel grid — 2 columns on lg+, single column on mobile */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* S3-20: Hypercore Status */}
        <HypercoreStatusPanel />

        {/* S3-21: Hypervisor Sandbox */}
        <HypervisorSandboxPanel />

        {/* S3-22: A2A Communication */}
        <A2ACommPanel />

        {/* S3-23: Eternal Data Reel */}
        <EternalReelPanel />
      </div>
    </div>
  );
}
