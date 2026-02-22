// API Route: GET /api/infrastructure/hypercore
// Returns a snapshot of Hypercore store status, metrics, and sync state.
// When no Hypercore instance is running (no long-lived singleton), returns a zeroed snapshot.

import { NextResponse } from 'next/server';
import { ObservabilityLogger } from '@/src/hypercore/observability.js';
import type { HypercoreStatusSnapshot } from '@/app/dashboard/infrastructure/components/hypercore-status-panel.js';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    // ObservabilityLogger can be instantiated without a running store —
    // it initializes with zeroed metrics and a healthy status by default.
    const logger = new ObservabilityLogger();
    const health = logger.getHealth();
    const metrics = logger.getMetrics();

    const snapshot: HypercoreStatusSnapshot = {
      health,
      metrics,
      queue: { queueLength: 0, isOnline: false, totalDrained: 0, totalFailed: 0 },
      peerCount: 0,
      storeCount: 0,
      syncState: 'offline',
      lastUpdatedAt: Date.now(),
    };

    return NextResponse.json({ data: snapshot });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
