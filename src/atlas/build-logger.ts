import { BuildLog } from '../types/index.js';
import { readJSON, writeJSON, ensureDir, getNovaPath } from '../utils/file-io.js';
import { log } from '../utils/logger.js';

const BUILDS_FILE = 'atlas/builds.json';

/**
 * Log a build to the ATLAS builds file
 */
export async function logBuild(buildLog: BuildLog): Promise<void> {
  try {
    const builds = await getBuilds();
    builds.push(buildLog);
    await saveBuilds(builds);
    log(`Build logged: ${buildLog.taskId} - ${buildLog.success ? 'SUCCESS' : 'FAILED'}`);
  } catch (err) {
    log(`Failed to log build: ${err}`);
  }
}

/**
 * Get all builds from the builds file
 */
export async function getBuilds(): Promise<BuildLog[]> {
  try {
    const builds = await readJSON<BuildLog[]>(getNovaPath(BUILDS_FILE));
    return builds;
  } catch {
    // File doesn't exist yet - return empty array
    return [];
  }
}

/**
 * Save builds to the builds file
 */
async function saveBuilds(builds: BuildLog[]): Promise<void> {
  await ensureDir(getNovaPath('atlas'));
  await writeJSON(getNovaPath(BUILDS_FILE), builds);
}

/**
 * Get builds for a specific task
 */
export async function getBuildsByTask(taskId: string): Promise<BuildLog[]> {
  const builds = await getBuilds();
  return builds.filter(b => b.taskId === taskId);
}

/**
 * Get builds for a specific agent
 */
export async function getBuildsByAgent(agent: string): Promise<BuildLog[]> {
  const builds = await getBuilds();
  return builds.filter(b => b.agent === agent);
}

/**
 * Get recent builds (last N)
 */
export async function getRecentBuilds(count: number = 10): Promise<BuildLog[]> {
  const builds = await getBuilds();
  return builds.slice(-count);
}

/**
 * Calculate success rate for an agent
 */
export async function getAgentSuccessRate(agent: string): Promise<number> {
  const builds = await getBuildsByAgent(agent);
  if (builds.length === 0) return 0;
  
  const successful = builds.filter(b => b.success).length;
  return successful / builds.length;
}

/**
 * Get build statistics
 */
export async function getBuildStats(): Promise<{
  total: number;
  success: number;
  failure: number;
  successRate: number;
}> {
  const builds = await getBuilds();
  
  const success = builds.filter(b => b.success).length;
  const failure = builds.length - success;
  
  return {
    total: builds.length,
    success,
    failure,
    successRate: builds.length > 0 ? success / builds.length : 0,
  };
}

/**
 * Clear all builds (for testing)
 */
export async function clearBuilds(): Promise<void> {
  await ensureDir(getNovaPath('atlas'));
  await saveBuilds([]);
}
