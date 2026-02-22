// API Route: GET /api/infrastructure/eternal-reel
// Returns a snapshot of Eternal Data Reel status: Harness, SAGA, Hindsight, RLM.
// When no Eternal Reel instance is running, returns zeroed snapshots.

import { NextResponse } from 'next/server';
import type { EternalReelSnapshot } from '@/app/dashboard/infrastructure/components/eternal-reel-panel.js';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  // No running Eternal Reel instance — return empty snapshot.
  // In production, the EternalReelInstance singleton created by createEternalReel()
  // would be accessed here and its sub-module stats queried.
  const snapshot: EternalReelSnapshot = {
    harness: {
      total: 0,
      byStatus: {},
      checkpoints: 0,
    },
    hindsight: {
      totalFragments: 0,
      consolidatedFragments: 0,
      namespaces: 0,
      lastConsolidationAt: null,
    },
    rlm: {
      pipelinesRun: 0,
      compressionRatio: 0,
      tokensSaved: 0,
      avgContextUtilization: 0,
    },
    saga: {
      generation: 0,
      populationSize: 0,
      bestFitness: 0,
      isRunning: false,
    },
    lastUpdatedAt: Date.now(),
  };

  return NextResponse.json({ data: snapshot });
}
