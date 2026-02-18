// Skill Marketplace for NOVA26
// Share and discover reusable skills across projects

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export interface MarketplaceSkill {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  domain: string;
  tags: string[];
  agents: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  content: string;
  examples: string[];
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillSearchFilters {
  domain?: string;
  agent?: string;
  complexity?: string;
  tags?: string[];
}

export interface SkillSubmission {
  name: string;
  description: string;
  domain: string;
  tags: string[];
  agents: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  content: string;
  examples: string[];
}

const MARKETPLACE_DIR = join(process.cwd(), '.nova', 'marketplace');
const REGISTRY_FILE = join(MARKETPLACE_DIR, 'registry.json');

// Ensure marketplace directory exists
if (!existsSync(MARKETPLACE_DIR)) {
  mkdirSync(MARKETPLACE_DIR, { recursive: true });
}

/**
 * Initialize the skill marketplace registry
 */
export function initializeMarketplace(): void {
  if (!existsSync(REGISTRY_FILE)) {
    const initialRegistry = {
      version: '1.0.0',
      skills: [],
      categories: [
        'authentication',
        'payments',
        'database',
        'api-integration',
        'ui-components',
        'testing',
        'deployment',
        'analytics',
      ],
    };
    writeFileSync(REGISTRY_FILE, JSON.stringify(initialRegistry, null, 2));
    console.log('✅ Skill marketplace initialized');
  }
}

/**
 * Load the skill registry
 */
function loadRegistry(): { version: string; skills: MarketplaceSkill[]; categories: string[] } {
  initializeMarketplace();
  const content = readFileSync(REGISTRY_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save the skill registry
 */
function saveRegistry(registry: { version: string; skills: MarketplaceSkill[]; categories: string[] }): void {
  writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

/**
 * Search for skills in the marketplace
 */
export function searchSkills(query: string, filters?: SkillSearchFilters): MarketplaceSkill[] {
  const registry = loadRegistry();
  let results = registry.skills;

  // Text search
  if (query) {
    const queryLower = query.toLowerCase();
    results = results.filter(skill =>
      skill.name.toLowerCase().includes(queryLower) ||
      skill.description.toLowerCase().includes(queryLower) ||
      skill.tags.some(t => t.toLowerCase().includes(queryLower))
    );
  }

  // Apply filters
  if (filters) {
    if (filters.domain) {
      results = results.filter(s => s.domain === filters.domain);
    }
    if (filters.agent) {
      results = results.filter(s => s.agents.includes(filters.agent!));
    }
    if (filters.complexity) {
      results = results.filter(s => s.complexity === filters.complexity);
    }
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(s => 
        filters.tags!.some(tag => s.tags.includes(tag))
      );
    }
  }

  // Sort by rating and downloads
  results.sort((a, b) => {
    const scoreA = a.rating * Math.log(a.downloads + 1);
    const scoreB = b.rating * Math.log(b.downloads + 1);
    return scoreB - scoreA;
  });

  return results;
}

/**
 * Get a skill by ID
 */
export function getSkill(skillId: string): MarketplaceSkill | null {
  const registry = loadRegistry();
  return registry.skills.find(s => s.id === skillId) || null;
}

/**
 * Submit a new skill to the marketplace
 */
export function submitSkill(submission: SkillSubmission, author: string): MarketplaceSkill {
  const registry = loadRegistry();
  
  const skill: MarketplaceSkill = {
    id: `skill-${createHash('sha256').update(submission.name + Date.now()).digest('hex').slice(0, 12)}`,
    name: submission.name,
    version: '1.0.0',
    description: submission.description,
    author,
    domain: submission.domain,
    tags: submission.tags,
    agents: submission.agents,
    complexity: submission.complexity,
    content: submission.content,
    examples: submission.examples,
    downloads: 0,
    rating: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  registry.skills.push(skill);
  saveRegistry(registry);

  // Save skill content to file
  const skillDir = join(MARKETPLACE_DIR, 'skills');
  if (!existsSync(skillDir)) {
    mkdirSync(skillDir, { recursive: true });
  }
  writeFileSync(
    join(skillDir, `${skill.id}.md`),
    generateSkillMarkdown(skill)
  );

  return skill;
}

/**
 * Download a skill from the marketplace
 */
export function downloadSkill(skillId: string, targetDir: string = join(process.cwd(), '.nova', 'skills')): boolean {
  const skill = getSkill(skillId);
  if (!skill) {
    console.log(`❌ Skill not found: ${skillId}`);
    return false;
  }

  // Ensure target directory exists
  const skillTargetDir = join(targetDir, skill.name);
  if (!existsSync(skillTargetDir)) {
    mkdirSync(skillTargetDir, { recursive: true });
  }

  // Write SKILL.md
  writeFileSync(
    join(skillTargetDir, 'SKILL.md'),
    generateSkillMarkdown(skill)
  );

  // Update download count
  const registry = loadRegistry();
  const skillIndex = registry.skills.findIndex(s => s.id === skillId);
  if (skillIndex >= 0) {
    registry.skills[skillIndex].downloads++;
    saveRegistry(registry);
  }

  console.log(`✅ Downloaded skill: ${skill.name}`);
  return true;
}

/**
 * Rate a skill
 */
export function rateSkill(skillId: string, rating: number): boolean {
  if (rating < 1 || rating > 5) {
    console.log('❌ Rating must be between 1 and 5');
    return false;
  }

  const registry = loadRegistry();
  const skill = registry.skills.find(s => s.id === skillId);
  
  if (!skill) {
    console.log(`❌ Skill not found: ${skillId}`);
    return false;
  }

  // Update rating (simple average)
  const currentTotal = skill.rating * skill.downloads;
  skill.rating = (currentTotal + rating) / (skill.downloads + 1);
  skill.updatedAt = new Date().toISOString();
  
  saveRegistry(registry);
  return true;
}

/**
 * Generate SKILL.md content
 */
function generateSkillMarkdown(skill: MarketplaceSkill): string {
  return `# ${skill.name}

## Description
${skill.description}

## Domain
${skill.domain}

## Complexity
${skill.complexity}

## Agents That Use This Skill
${skill.agents.map(a => `- **${a}**`).join('\n')}

## Tags
${skill.tags.map(t => `\`${t}\``).join(', ')}

## When to Load
\`${skill.tags.slice(0, 3).join(', ')}\`

## Content
${skill.content}

## Examples
${skill.examples.map((ex, i) => `### Example ${i + 1}\n${ex}`).join('\n\n')}

---

**Author**: ${skill.author}  
**Version**: ${skill.version}  
**Downloads**: ${skill.downloads}  
**Rating**: ${skill.rating.toFixed(1)}/5  
**Updated**: ${skill.updatedAt}
`;
}

/**
 * List all categories
 */
export function listCategories(): string[] {
  const registry = loadRegistry();
  return registry.categories;
}

/**
 * Get featured/popular skills
 */
export function getFeaturedSkills(limit: number = 5): MarketplaceSkill[] {
  const registry = loadRegistry();
  return registry.skills
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, limit);
}

/**
 * Get recently added skills
 */
export function getRecentSkills(limit: number = 5): MarketplaceSkill[] {
  const registry = loadRegistry();
  return registry.skills
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/**
 * Display marketplace UI in CLI
 */
export function displayMarketplace(): void {
  const registry = loadRegistry();
  
  console.log('\n🏪 NOVA26 Skill Marketplace\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log(`Total Skills: ${registry.skills.length}`);
  console.log(`Categories: ${registry.categories.join(', ')}\n`);
  
  const featured = getFeaturedSkills(3);
  if (featured.length > 0) {
    console.log('⭐ Featured Skills:');
    for (const skill of featured) {
      console.log(`  • ${skill.name} - ${skill.description.slice(0, 50)}...`);
      console.log(`    Downloads: ${skill.downloads} | Rating: ${skill.rating.toFixed(1)}/5`);
    }
    console.log('');
  }
  
  console.log('Commands:');
  console.log('  /marketplace search <query>    - Search for skills');
  console.log('  /marketplace install <skill-id> - Install a skill');
  console.log('  /marketplace list              - List all skills');
  console.log('  /marketplace submit            - Submit a new skill\n');
  
  console.log('═══════════════════════════════════════════════════\n');
}

/**
 * CLI handler for marketplace commands
 */
export function handleMarketplaceCommand(args: string[]): void {
  const subcommand = args[0];

  switch (subcommand) {
    case 'search': {
      const query = args.slice(1).join(' ');
      const results = searchSkills(query);
      console.log(`\n🔍 Search Results for "${query}":\n`);
      for (const skill of results.slice(0, 10)) {
        console.log(`  ${skill.name} [${skill.domain}]`);
        console.log(`    ${skill.description.slice(0, 60)}...`);
        console.log(`    Agents: ${skill.agents.join(', ')}`);
        console.log('');
      }
      break;
    }

    case 'install':
    case 'download': {
      const skillId = args[1];
      if (!skillId) {
        console.log('Usage: /marketplace install <skill-id>');
        return;
      }
      downloadSkill(skillId);
      break;
    }

    case 'list': {
      const registry = loadRegistry();
      console.log('\n📚 Available Skills:\n');
      for (const skill of registry.skills) {
        console.log(`  ${skill.name.padEnd(20)} ${skill.domain.padEnd(15)} ${skill.complexity}`);
      }
      console.log('');
      break;
    }

    case 'featured': {
      const featured = getFeaturedSkills();
      console.log('\n⭐ Featured Skills:\n');
      for (const skill of featured) {
        console.log(`  ${skill.name}`);
        console.log(`    ${skill.description}`);
        console.log(`    ⭐ ${skill.rating.toFixed(1)} | 📥 ${skill.downloads}`);
        console.log('');
      }
      break;
    }

    default:
      displayMarketplace();
  }
}

// Initialize on load
initializeMarketplace();
