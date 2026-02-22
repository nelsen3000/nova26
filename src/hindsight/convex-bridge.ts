// Convex Bridge for Hindsight
// Client-side bridge to convex/hindsight.ts mutations and queries
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md Task 13

import type {
  MemoryFragmentRecord,
  ConsolidationJobRecord,
  StoreFragmentInput,
  CreateConsolidationInput,
  FragmentQueryOptions,
  VectorSearchOptions,
  StorageStats,
} from './convex-types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Type-only imports for Convex API
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConvexApi {
  query: <TArgs, TReturn>(name: string) => (args: TArgs) => Promise<TReturn>;
  mutation: <TArgs, TReturn>(name: string) => (args: TArgs) => Promise<TReturn>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fragment Bridge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Store a memory fragment in Convex
 */
export async function storeFragment(
  convex: ConvexApi,
  input: StoreFragmentInput
): Promise<string> {
  const fragmentId = await convex.mutation<StoreFragmentInput, string>(
    'hindsight:storeFragment'
  )(input);
  return fragmentId;
}

/**
 * Get a fragment by ID
 */
export async function getFragment(
  convex: ConvexApi,
  fragmentId: string
): Promise<MemoryFragmentRecord | null> {
  const fragment = await convex.query<
    { fragmentId: string },
    MemoryFragmentRecord | null
  >('hindsight:getFragment')({ fragmentId });
  return fragment;
}

/**
 * Query fragments with filters
 */
export async function queryFragments(
  convex: ConvexApi,
  companyId: string,
  options?: FragmentQueryOptions
): Promise<MemoryFragmentRecord[]> {
  const fragments = await convex.query<
    { companyId: string } & FragmentQueryOptions,
    MemoryFragmentRecord[]
  >('hindsight:queryFragments')({ companyId, ...options });
  return fragments;
}

/**
 * Search fragments by vector similarity
 */
export async function searchByVector(
  convex: ConvexApi,
  companyId: string,
  embedding: number[],
  options?: VectorSearchOptions
): Promise<Array<{ fragment: MemoryFragmentRecord; similarity: number }>> {
  const results = await convex.query<
    { companyId: string; embedding: number[] } & VectorSearchOptions,
    Array<{ fragment: MemoryFragmentRecord; similarity: number }>
  >('hindsight:searchByVector')({ companyId, embedding, ...options });
  return results;
}

/**
 * Delete a fragment
 */
export async function deleteFragment(
  convex: ConvexApi,
  fragmentId: string
): Promise<boolean> {
  const success = await convex.mutation<
    { fragmentId: string },
    boolean
  >('hindsight:deleteFragment')({ fragmentId });
  return success;
}

/**
 * Batch store fragments
 */
export async function batchStoreFragments(
  convex: ConvexApi,
  inputs: StoreFragmentInput[]
): Promise<string[]> {
  const fragmentIds: string[] = [];
  for (const input of inputs) {
    const id = await storeFragment(convex, input);
    fragmentIds.push(id);
  }
  return fragmentIds;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Consolidation Bridge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a consolidation job
 */
export async function createConsolidationJob(
  convex: ConvexApi,
  input: CreateConsolidationInput
): Promise<string> {
  const jobId = await convex.mutation<CreateConsolidationInput, string>(
    'hindsight:createConsolidationJob'
  )(input);
  return jobId;
}

/**
 * Get a consolidation job
 */
export async function getConsolidationJob(
  convex: ConvexApi,
  jobId: string
): Promise<ConsolidationJobRecord | null> {
  const job = await convex.query<
    { jobId: string },
    ConsolidationJobRecord | null
  >('hindsight:getConsolidationJob')({ jobId });
  return job;
}

/**
 * List consolidation jobs for a company
 */
export async function listConsolidationJobs(
  convex: ConvexApi,
  companyId: string,
  namespace?: string
): Promise<ConsolidationJobRecord[]> {
  const jobs = await convex.query<
    { companyId: string; namespace?: string },
    ConsolidationJobRecord[]
  >('hindsight:listConsolidationJobs')({ companyId, namespace });
  return jobs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Statistics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get storage statistics
 */
export async function getStorageStats(
  convex: ConvexApi,
  companyId: string,
  namespace?: string
): Promise<StorageStats> {
  const stats = await convex.query<
    { companyId: string; namespace?: string },
    StorageStats
  >('hindsight:getStorageStats')({ companyId, namespace });
  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Access Tracking
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Increment access count for a fragment
 */
export async function trackFragmentAccess(
  convex: ConvexApi,
  fragmentId: string
): Promise<void> {
  await convex.mutation<
    { fragmentId: string },
    void
  >('hindsight:trackFragmentAccess')({ fragmentId });
}

/**
 * Update fragment relevance
 */
export async function updateFragmentRelevance(
  convex: ConvexApi,
  fragmentId: string,
  relevance: number
): Promise<void> {
  await convex.mutation<
    { fragmentId: string; relevance: number },
    void
  >('hindsight:updateFragmentRelevance')({ fragmentId, relevance });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Re-export Types
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  MemoryFragmentRecord,
  ConsolidationJobRecord,
  StoreFragmentInput,
  CreateConsolidationInput,
  FragmentQueryOptions,
  VectorSearchOptions,
  StorageStats,
} from './convex-types.js';
