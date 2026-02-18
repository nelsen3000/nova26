// Skill Loader - Dynamically loads domain-specific knowledge for agents

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface Skill {
  name: string;
  domain: string;
  content: string;
  agents: string[];
  keywords: string[];
}

const SKILLS_DIR = join(process.cwd(), '.nova', 'skills');

/**
 * Load all available skills from .nova/skills/
 */
export function loadAvailableSkills(): Skill[] {
  if (!existsSync(SKILLS_DIR)) {
    return [];
  }

  const skills: Skill[] = [];
  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const skillName of skillDirs) {
    const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf-8');
      const skill = parseSkill(skillName, content);
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * Parse skill metadata from SKILL.md content
 */
function parseSkill(name: string, content: string): Skill {
  // Extract domain from first header
  const domainMatch = content.match(/## Domain\n([^#]+)/);
  const domain = domainMatch ? domainMatch[1].trim() : name;

  // Extract agents that use this skill
  const agentsMatch = content.match(/## Agents That Use This Skill\n([^#]+)/);
  const agents = agentsMatch 
    ? agentsMatch[1].match(/\*\*[A-Z]+\*\*\)/g)?.map(a => a.replace(/\*\*/g, '')) || []
    : [];

  // Extract auto-load keywords
  const keywordsMatch = content.match(/## When to Load\n[^`]*`([^`]+)`/);
  const keywords = keywordsMatch 
    ? keywordsMatch[1].split(',').map(k => k.trim())
    : [];

  return {
    name,
    domain,
    content,
    agents,
    keywords,
  };
}

/**
 * Determine which skills are relevant for a task
 */
export function detectRelevantSkills(
  taskDescription: string,
  agentName: string,
  availableSkills: Skill[]
): Skill[] {
  const taskLower = taskDescription.toLowerCase();
  const relevant: Skill[] = [];

  for (const skill of availableSkills) {
    // Check if agent is in the skill's target agents
    const agentMatch = skill.agents.includes(agentName);
    
    // Check if task description contains keywords
    const keywordMatch = skill.keywords.some(k => 
      taskLower.includes(k.toLowerCase())
    );

    if (agentMatch && keywordMatch) {
      relevant.push(skill);
    }
  }

  return relevant;
}

/**
 * Format skills for injection into agent prompts
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';

  const sections = skills.map(skill => `
## Skill: ${skill.name}
${skill.domain}

${skill.content.substring(0, 2000)}... 
[Skill content truncated for length]
`);

  return `
---
## Loaded Domain Skills

The following specialized knowledge has been loaded for this task:

${sections.join('\n---\n')}

Apply these patterns and follow these guidelines when completing the task.
`;
}

/**
 * List available skills for CLI display
 */
export function listSkills(): void {
  const skills = loadAvailableSkills();
  
  console.log('\n📚 Available Skills:\n');
  
  for (const skill of skills) {
    console.log(`  ${skill.name}`);
    console.log(`    Domain: ${skill.domain}`);
    console.log(`    Agents: ${skill.agents.join(', ')}`);
    console.log(`    Keywords: ${skill.keywords.join(', ')}`);
    console.log('');
  }
}
