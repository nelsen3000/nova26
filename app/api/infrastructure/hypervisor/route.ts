// API Route: GET /api/infrastructure/hypervisor
// Returns a snapshot of Hypervisor sandbox status and security metrics.
// When no Hypervisor instance is running, returns a zeroed snapshot.

import { NextResponse } from 'next/server';
import { AggregateHypervisorMetricsSchema, SecurityMetricsSchema } from '@/src/hypervisor/types.js';
import type { HypervisorStatusSnapshot } from '@/app/dashboard/infrastructure/components/hypervisor-sandbox-panel.js';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  // Build empty defaults using the Zod schemas (which specify defaults)
  const metrics = AggregateHypervisorMetricsSchema.parse({});
  const security = SecurityMetricsSchema.parse({});

  const snapshot: HypervisorStatusSnapshot = {
    vms: [],
    metrics,
    security,
    networkRulesCount: 0,
    lastUpdatedAt: Date.now(),
  };

  return NextResponse.json({ data: snapshot });
}
