# Skill Loader

## Source
Extracted from Nova26 `src/skills/skill-loader.ts`

---

## Pattern: Dynamic Domain Knowledge Injection for Agents

The Skill Loader pattern dynamically discovers, parses, and injects domain-specific knowledge into agent prompts at task time. Skills are markdown files stored in `.nova/skills/` that contain specialized guidelines, patterns, and constraints for particular domains (e.g., Convex best practices, Stripe integration rules, accessibility standards). Rather than baking all knowledge into every agent prompt, the loader selectively attaches only the skills relevant to the current task and agent — keeping context windows focused and token costs low.

The pattern implements a three-stage pipeline: discovery (filesystem scan), relevance detection (keyword + agent matching), and prompt injection (formatted skill content appended to agent context).

---

## Implementation

### Code Example

```typescript
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface Skill {
  name: string;
  domain: string;
  content: string;
  agents: string[];    // Which agents can use this skill (e.g., ['MARS', 'VENUS'])
  keywords: string[];  // Auto-load triggers (e.g., ['stripe', 'payment', 'billing'])
}

const SKILLS_DIR = join(process.cwd(), '.nova', 'skills');

/**
 * Discover and load all skills from the .nova/skills/ directory.
 * Each skill lives in its own subdirectory with a SKILL.md file.
 */
export function loadAvailableSkills(): Skill[] {
  if (!existsSync(SKILLS_DIR)) return [];

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
```

### Skill Metadata Parsing

```typescript
/**
 * Parse structured metadata from a SKILL.md file.
 * Extracts domain, target agents, and auto-load keywords from markdown sections.
 */
function parseSkill(name: string, content: string): Skill {
  // Extract domain from ## Domain section
  const domainMatch = content.match(/## Domain\n([^#]+)/);
  const domain = domainMatch ? domainMatch[1].trim() : name;

  // Extract target agents from ## Agents That Use This Skill section
  const agentsMatch = content.match(/## Agents That Use This Skill\n([^#]+)/);
  const agents = agentsMatch
    ? agentsMatch[1].match(/\*\*[A-Z]+\*\*/g)?.map(a => a.replace(/\*\*/g, '')) || []
    : [];

  // Extract auto-load keywords from ## When to Load section
  const keywordsMatch = content.match(/## When to Load\n[^`]*`([^`]+)`/);
  const keywords = keywordsMatch
    ? keywordsMatch[1].split(',').map(k => k.trim())
    : [];

  return { name, domain, content, agents, keywords };
}
```

### Relevance Detection (Dual-Match Strategy)

```typescript
/**
 * Determine which skills are relevant for a given task.
 * Uses a dual-match strategy: both the agent name AND at least one keyword
 * must match for a skill to be selected. This prevents over-loading context.
 */
export function detectRelevantSkills(
  taskDescription: string,
  agentName: string,
  availableSkills: Skill[]
): Skill[] {
  const taskLower = taskDescription.toLowerCase();
  const relevant: Skill[] = [];

  for (const skill of availableSkills) {
    const agentMatch = skill.agents.includes(agentName);
    const keywordMatch = skill.keywords.some(k =>
      taskLower.includes(k.toLowerCase())
    );

    // Both conditions must be true — prevents irrelevant skill injection
    if (agentMatch && keywordMatch) {
      relevant.push(skill);
    }
  }

  return relevant;
}
```

### Prompt Injection Formatting

```typescript
/**
 * Format selected skills into a prompt section for agent context injection.
 * Truncates skill content to 2000 chars to stay within token budgets.
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
```

### Key Concepts

- **Convention-over-configuration discovery**: Skills are found by scanning `.nova/skills/*/SKILL.md` — no registration step needed
- **Dual-match relevance filter**: A skill is only loaded when both the agent name AND a keyword match, preventing context pollution
- **Markdown-as-schema**: Skill metadata (domain, agents, keywords) is extracted from markdown section headers, keeping skills human-readable
- **Content truncation**: Skill content is capped at 2000 characters per skill to manage LLM token budgets
- **Lazy loading**: Skills are loaded from disk on demand, not at startup, keeping initialization fast

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Hardcoding domain knowledge directly into agent prompts
function buildAgentPrompt(agent: string, task: string): string {
  let prompt = `You are ${agent}. Complete this task: ${task}\n`;

  // Every domain requires modifying this function
  if (task.includes('stripe')) {
    prompt += 'Use Stripe API v2. Always use PaymentIntents...\n';
  }
  if (task.includes('convex')) {
    prompt += 'Use defineTable for schemas. Always add companyId...\n';
  }
  // Grows unbounded, impossible to maintain, always loaded even when irrelevant
  return prompt;
}
```

### ✅ Do This Instead

```typescript
// Dynamic skill loading — knowledge lives in files, not code
const allSkills = loadAvailableSkills();
const relevant = detectRelevantSkills(taskDescription, agentName, allSkills);
const skillSection = formatSkillsForPrompt(relevant);

const prompt = `You are ${agentName}. Complete this task: ${taskDescription}\n${skillSection}`;
// Only relevant skills are injected — clean, maintainable, extensible
```

---

## When to Use This Pattern

✅ **Use for:**
- Multi-agent systems where different agents need different domain knowledge
- Systems with growing domain expertise that should be added without code changes
- LLM-based workflows where context window management is critical

❌ **Don't use for:**
- Static, single-purpose agents that always need the same context (just inline it)
- Non-LLM systems where "prompt injection" doesn't apply

---

## Benefits

1. **Zero-code extensibility** — New skills are added by creating a markdown file in `.nova/skills/`, no code changes required
2. **Context efficiency** — Dual-match filtering and content truncation keep agent prompts focused and within token limits
3. **Separation of concerns** — Domain knowledge lives in dedicated skill files, not scattered across agent code
4. **Human-readable skills** — Skills are plain markdown, editable by non-developers and version-controllable
5. **Agent-scoped loading** — Each agent only receives skills tagged for its role, preventing cross-domain confusion

---

## Related Patterns

- See `../02-agent-system/agent-loader.md` for the agent loading system that consumes formatted skill content
- See `../01-orchestration/prompt-builder-dependency-injection.md` for the prompt builder that integrates skill sections into final agent prompts
- See `./template-engine.md` for the complementary pattern that scaffolds project files (templates) rather than injecting domain knowledge (skills)

---

*Extracted: 2025-07-18*
