import { AgentName, AgentTemplate } from '../types/index.js';
import { readMarkdown, getNovaPath } from '../utils/file-io.js';

const AGENTS_DIR = 'agents';

/**
 * Load an agent template from the .nova/agents directory
 */
export async function loadAgent(agentName: AgentName): Promise<AgentTemplate> {
  const filePath = getNovaPath(AGENTS_DIR, `${agentName}.md`);
  
  try {
    const content = await readMarkdown(filePath);
    
    return {
      name: agentName,
      content,
      filePath,
    };
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('File not found')) {
      throw new Error(
        `Agent template not found: ${agentName}.md\n` +
        `Expected path: ${filePath}\n` +
        `Make sure all agent templates exist in .nova/agents/`
      );
    }
    throw error;
  }
}

/**
 * Load multiple agents at once
 */
export async function loadAgents(agentNames: AgentName[]): Promise<AgentTemplate[]> {
  const results = await Promise.all(
    agentNames.map(name => loadAgent(name))
  );
  
  return results;
}

/**
 * Check if an agent template exists
 */
export async function agentExists(agentName: AgentName): Promise<boolean> {
  try {
    await loadAgent(agentName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all available agent names
 */
export async function getAvailableAgents(): Promise<AgentName[]> {
  const allAgents: AgentName[] = [
    'SUN', 'MERCURY', 'VENUS', 'EARTH', 'MARS', 'PLUTO', 'SATURN',
    'JUPITER', 'ENCELADUS', 'GANYMEDE', 'NEPTUNE', 'CHARON',
    'URANUS', 'TITAN', 'EUROPA', 'MIMAS', 'IO', 'TRITON',
    'CALLISTO', 'ATLAS', 'ANDROMEDA',
  ];
  
  const available: AgentName[] = [];
  
  for (const agent of allAgents) {
    if (await agentExists(agent)) {
      available.push(agent);
    }
  }
  
  return available;
}
