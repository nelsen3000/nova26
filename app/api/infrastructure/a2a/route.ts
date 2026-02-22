// API Route: GET /api/infrastructure/a2a
// Returns a snapshot of A2A communication metrics, registry stats, and recent events.
// When no A2A layer is running, returns a zeroed snapshot.

import { NextResponse } from 'next/server';
import type { A2AStatusSnapshot } from '@/app/dashboard/infrastructure/components/a2a-comm-panel.js';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  // No running A2A layer — return empty snapshot.
  // In production, the A2ALayer singleton would be injected here.
  const snapshot: A2AStatusSnapshot = {
    metrics: {
      messagesSent: 0,
      messagesReceived: 0,
      routingFailures: 0,
      toolInvocations: 0,
      avgRoutingLatencyMs: 0,
      channelsOpened: 0,
      channelsClosed: 0,
    },
    registry: {
      totalAgents: 0,
      localAgents: 0,
      remoteAgents: 0,
      byTier: { L0: 0, L1: 0, L2: 0, L3: 0 },
    },
    recentEvents: [],
    activeChannels: 0,
    lastUpdatedAt: Date.now(),
  };

  return NextResponse.json({ data: snapshot });
}
