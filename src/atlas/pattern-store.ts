import { Pattern, AgentName } from '../types/index.js';
import { readJSON, writeJSON, ensureDir, getNovaPath } from '../utils/file-io.js';
import { log } from '../utils/logger.js';

const PATTERNS_FILE = 'atlas/patterns.json';

/**
 * Get all patterns
 */
export async function getPatterns(): Promise<Pattern[]> {
  try {
    const patterns = await readJSON<Pattern[]>(getNovaPath(PATTERNS_FILE));
    return patterns;
  } catch {
    return [];
  }
}

/**
 * Get patterns for a specific agent
 */
export async function getPatternsByAgent(agent: AgentName): Promise<Pattern[]> {
  const patterns = await getPatterns();
  return patterns.filter(p => p.agent === agent);
}

/**
 * Get patterns by type
 */
export async function getPatternsByType(type: 'success' | 'failure' | 'optimization'): Promise<Pattern[]> {
  const patterns = await getPatterns();
  return patterns.filter(p => p.patternType === type);
}

/**
 * Save a new pattern
 */
export async function savePattern(pattern: Pattern): Promise<void> {
  const patterns = await getPatterns();
  patterns.push(pattern);
  await savePatterns(patterns);
  log(`Pattern saved: ${pattern.patternType} - ${pattern.description.substring(0, 50)}...`);
}

/**
 * Save patterns to file
 */
async function savePatterns(patterns: Pattern[]): Promise<void> {
  await ensureDir(getNovaPath('atlas'));
  await writeJSON(getNovaPath(PATTERNS_FILE), patterns);
}

/**
 * Get effective patterns (successful approaches)
 */
export async function getEffectivePatterns(): Promise<Pattern[]> {
  return getPatternsByType('success');
}

/**
 * Get failure patterns (what to avoid)
 */
export async function getFailurePatterns(): Promise<Pattern[]> {
  return getPatternsByType('failure');
}

/**
 * Update an existing pattern
 */
export async function updatePattern(patternId: string, updates: Partial<Pattern>): Promise<void> {
  const patterns = await getPatterns();
  const index = patterns.findIndex(p => p.id === patternId);
  
  if (index !== -1) {
    patterns[index] = { ...patterns[index], ...updates };
    await savePatterns(patterns);
  }
}

/**
 * Delete a pattern
 */
export async function deletePattern(patternId: string): Promise<void> {
  const patterns = await getPatterns();
  const filtered = patterns.filter(p => p.id !== patternId);
  await savePatterns(filtered);
}

/**
 * Extract patterns from recent builds (Phase 1 feature - stub for now)
 */
export async function extractPatternsFromBuilds(): Promise<void> {
  log('Pattern extraction is Phase 1+ - stub for now');
  // This will analyze recent builds and extract successful patterns
  // For now, patterns are added manually
}

/**
 * Clear all patterns (for testing)
 */
export async function clearPatterns(): Promise<void> {
  await ensureDir(getNovaPath('atlas'));
  await savePatterns([]);
}
