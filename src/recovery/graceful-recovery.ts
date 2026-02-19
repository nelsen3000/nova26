// Graceful Recovery - Checkpoint, fallback, and error recovery systems
// KIMI-POLISH-06: Production Polish Sprint

import { z } from 'zod';
import { join } from 'path';
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';

// ============================================================================
// Checkpoint Types & Schema
// ============================================================================

export interface Checkpoint {
  id: string;
  buildId: string;
  checkpointedAt: string;
  resumable: boolean;
  tasks: Array<{
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    output?: string;
  }>;
  metadata: Record<string, unknown>;
}

const CheckpointSchema = z.object({
  id: z.string(),
  buildId: z.string(),
  checkpointedAt: z.string().datetime(),
  resumable: z.boolean(),
  tasks: z.array(z.object({
    id: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    output: z.string().optional(),
  })),
  metadata: z.record(z.unknown()),
});

// ============================================================================
// Configuration
// ============================================================================

const CHECKPOINTS_DIR = join(process.cwd(), '.nova', 'checkpoints');
const OFFLINE_QUEUE_FILE = join(process.cwd(), '.nova', 'offline-queue.jsonl');

// Model fallback chain
const FALLBACK_CHAIN = ['gpt-4o', 'claude-3-sonnet', 'gpt-4o-mini', 'claude-3-haiku'];

// ============================================================================
// Checkpoint Management
// ============================================================================

/**
 * Save a checkpoint to disk
 */
export function saveCheckpoint(checkpoint: Checkpoint): void {
  mkdirSync(CHECKPOINTS_DIR, { recursive: true });
  const filePath = join(CHECKPOINTS_DIR, `${checkpoint.id}.json`);
  writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

/**
 * Load a checkpoint by ID
 */
export function loadCheckpoint(id: string): Checkpoint | null {
  const filePath = join(CHECKPOINTS_DIR, `${id}.json`);
  
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = CheckpointSchema.safeParse(parsed);
    
    if (!result.success) {
      return null;
    }
    
    return result.data;
  } catch {
    return null;
  }
}

/**
 * List all resumable checkpoints, sorted by checkpointedAt desc
 */
export function listResumableCheckpoints(): Checkpoint[] {
  if (!existsSync(CHECKPOINTS_DIR)) {
    return [];
  }

  const files = readdirSync(CHECKPOINTS_DIR).filter(f => f.endsWith('.json'));
  const checkpoints: Checkpoint[] = [];

  for (const file of files) {
    const id = file.replace('.json', '');
    const checkpoint = loadCheckpoint(id);
    if (checkpoint && checkpoint.resumable) {
      checkpoints.push(checkpoint);
    }
  }

  // Sort by checkpointedAt desc
  return checkpoints.sort((a, b) => 
    new Date(b.checkpointedAt).getTime() - new Date(a.checkpointedAt).getTime()
  );
}

/**
 * Delete a checkpoint by ID
 */
export function deleteCheckpoint(id: string): void {
  const filePath = join(CHECKPOINTS_DIR, `${id}.json`);
  
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
    } catch {
      // Silent fail if cannot delete
    }
  }
  // Silent if file doesn't exist
}

// ============================================================================
// Fallback System
// ============================================================================

/**
 * Check if an error message should trigger a fallback
 */
export function isFallbackTrigger(errorMessage: string): boolean {
  const triggers = ['oom', 'out of memory', 'timeout', '500'];
  const lowerError = errorMessage.toLowerCase();
  return triggers.some(trigger => lowerError.includes(trigger));
}

/**
 * Select the next fallback model in the chain
 */
export function selectFallbackModel(currentModel: string): string | null {
  const currentIndex = FALLBACK_CHAIN.indexOf(currentModel);
  
  if (currentIndex === -1 || currentIndex >= FALLBACK_CHAIN.length - 1) {
    return null;
  }
  
  return FALLBACK_CHAIN[currentIndex + 1];
}

// ============================================================================
// Offline Queue
// ============================================================================

interface QueuedEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  status: 'pending' | 'retrying' | 'failed';
  createdAt: string;
}

/**
 * Enqueue an event for later delivery when back online
 */
export function enqueueConvexEvent(type: string, payload: Record<string, unknown>): void {
  const novaDir = join(process.cwd(), '.nova');
  mkdirSync(novaDir, { recursive: true });
  
  const event: QueuedEvent = {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    attempts: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  const line = JSON.stringify(event) + '\n';
  writeFileSync(OFFLINE_QUEUE_FILE, line, { flag: 'a' });
}

/**
 * Flush offline queue by posting to Convex
 * Marks failed after 5 attempts
 */
export async function flushOfflineQueue(
  postToConvex: (type: string, payload: Record<string, unknown>) => Promise<boolean>
): Promise<{ processed: number; failed: number }> {
  if (!existsSync(OFFLINE_QUEUE_FILE)) {
    return { processed: 0, failed: 0 };
  }

  const content = readFileSync(OFFLINE_QUEUE_FILE, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const remaining: QueuedEvent[] = [];
  let processed = 0;
  let failed = 0;

  for (const line of lines) {
    try {
      const event: QueuedEvent = JSON.parse(line);
      
      if (event.status === 'failed') {
        continue; // Skip already failed events
      }

      event.attempts++;
      
      if (event.attempts >= 5) {
        event.status = 'failed';
        failed++;
        remaining.push(event);
        continue;
      }

      event.status = 'retrying';
      const success = await postToConvex(event.type, event.payload);
      
      if (success) {
        processed++;
      } else {
        remaining.push(event);
      }
    } catch {
      // Invalid line, skip it
    }
  }

  // Write remaining events back
  if (remaining.length > 0) {
    const newContent = remaining.map(e => JSON.stringify(e)).join('\n') + '\n';
    writeFileSync(OFFLINE_QUEUE_FILE, newContent);
  } else {
    // Clear the file if all processed
    writeFileSync(OFFLINE_QUEUE_FILE, '');
  }

  return { processed, failed };
}

/**
 * Get the size of the offline queue (pending + retrying events)
 */
export function offlineQueueSize(): number {
  if (!existsSync(OFFLINE_QUEUE_FILE)) {
    return 0;
  }

  const content = readFileSync(OFFLINE_QUEUE_FILE, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  let count = 0;
  for (const line of lines) {
    try {
      const event: QueuedEvent = JSON.parse(line);
      if (event.status === 'pending' || event.status === 'retrying') {
        count++;
      }
    } catch {
      // Invalid line, skip
    }
  }
  
  return count;
}

// ============================================================================
// Vault Validation
// ============================================================================

interface VaultGraph {
  nodes: Array<{ id: string; type: string; data: unknown }>;
  edges: Array<{ from: string; to: string; relation: string }>;
}

interface ValidationResult {
  isHealthy: boolean;
  orphanEdgesRemoved: number;
  duplicateIdsResolved: number;
  errors: string[];
}

/**
 * Validate and repair a vault graph
 */
export function validateVault(vaultData: string): ValidationResult {
  const result: ValidationResult = {
    isHealthy: true,
    orphanEdgesRemoved: 0,
    duplicateIdsResolved: 0,
    errors: [],
  };

  let graph: VaultGraph;
  
  try {
    graph = JSON.parse(vaultData);
  } catch {
    result.isHealthy = false;
    result.errors.push('Invalid JSON');
    return result;
  }

  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    result.isHealthy = false;
    result.errors.push('Missing or invalid nodes array');
    return result;
  }

  if (!graph.edges || !Array.isArray(graph.edges)) {
    result.isHealthy = false;
    result.errors.push('Missing or invalid edges array');
    return result;
  }

  // Build set of valid node IDs
  const nodeIds = new Set<string>();
  const seenIds = new Set<string>();
  
  for (const node of graph.nodes) {
    if (!node.id) continue;
    
    if (seenIds.has(node.id)) {
      // Resolve duplicate ID
      const newId = `${node.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      node.id = newId;
      result.duplicateIdsResolved++;
    }
    
    seenIds.add(node.id);
    nodeIds.add(node.id);
  }

  // Remove orphan edges
  const validEdges = graph.edges.filter(edge => {
    const isValid = nodeIds.has(edge.from) && nodeIds.has(edge.to);
    if (!isValid) {
      result.orphanEdgesRemoved++;
    }
    return isValid;
  });

  graph.edges = validEdges;

  if (result.orphanEdgesRemoved > 0 || result.duplicateIdsResolved > 0) {
    result.isHealthy = false;
  }

  return result;
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format an error into a user-friendly message
 */
export function formatError(error: unknown): string {
  if (error === null || error === undefined) {
    return 'An unknown error occurred';
  }

  let message: string;

  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else {
    message = String(error);
  }

  // Clean up the message - remove 'stack' and 'Error:' prefixes
  message = message
    .replace(/^Error:\s*/i, '')
    .replace(/\s*Stack:\s*.+/is, '')
    .replace(/\s*at\s+.+$/gm, '')
    .trim();

  // User-friendly translations
  const translations: Record<string, string> = {
    'oom': 'System ran out of memory. Try reducing the task size.',
    'out of memory': 'System ran out of memory. Try reducing the task size.',
    'timeout': 'The operation timed out. Please try again.',
    'connection refused': 'Could not connect to the service. Please check your network.',
    'econnrefused': 'Could not connect to the service. Please check your network.',
    'ENOTFOUND': 'Could not resolve the server address. Please check your network.',
  };

  const lowerMessage = message.toLowerCase();
  for (const [pattern, translation] of Object.entries(translations)) {
    if (lowerMessage.includes(pattern.toLowerCase())) {
      return translation;
    }
  }

  return message || 'An error occurred';
}
