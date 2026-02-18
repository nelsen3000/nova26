// Template Engine for NOVA26
// Processes agent templates and generates structured output

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface Template {
  name: string;
  version: string;
  content: string;
  identity?: {
    role?: string;
    domain?: string;
    celestialBody?: string;
  };
  capabilities?: {
    primary?: string[];
    tools?: string[];
    outputFormat?: string;
  };
  constraints?: {
    must?: string[];
    mustNot?: string[];
    qualityGates?: string[];
  };
}

export interface TemplateRenderContext {
  task?: string;
  feature?: string;
  agent?: string;
  context?: Record<string, any>;
}

const AGENTS_DIR = join(process.cwd(), '.nova', 'agents');

/**
 * Load all agent templates from .nova/agents
 */
export function loadTemplates(): Template[] {
  if (!existsSync(AGENTS_DIR)) {
    console.log('⚠️  No agents directory found');
    return [];
  }

  const templates: Template[] = [];
  const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));

  for (const file of files) {
    try {
      const content = readFileSync(join(AGENTS_DIR, file), 'utf-8');
      const name = file.replace('.md', '');
      const template = parseTemplate(name, content);
      templates.push(template);
    } catch (error) {
      console.error(`Failed to load template ${file}:`, error);
    }
  }

  return templates;
}

/**
 * Parse template XML structure from markdown content
 */
function parseTemplate(name: string, content: string): Template {
  const template: Template = {
    name,
    version: '1.0',
    content,
  };

  // Extract XML agent block
  const xmlMatch = content.match(/<agent[^>]*>([\s\S]*?)<\/agent>/);
  if (xmlMatch) {
    const xmlContent = xmlMatch[1];
    
    // Parse version
    const versionMatch = content.match(/<agent[^>]*version="([^"]+)"/);
    if (versionMatch) {
      template.version = versionMatch[1];
    }

    // Parse identity
    const identityMatch = xmlContent.match(/<identity>([\s\S]*?)<\/identity>/);
    if (identityMatch) {
      template.identity = {
        role: extractXmlContent(identityMatch[1], 'role'),
        domain: extractXmlContent(identityMatch[1], 'domain'),
        celestialBody: extractXmlContent(identityMatch[1], 'celestial-body'),
      };
    }

    // Parse capabilities
    const capsMatch = xmlContent.match(/<capabilities>([\s\S]*?)<\/capabilities>/);
    if (capsMatch) {
      template.capabilities = {
        primary: extractListItems(extractXmlContent(capsMatch[1], 'primary')),
        tools: extractListItems(extractXmlContent(capsMatch[1], 'tools')),
        outputFormat: extractXmlContent(capsMatch[1], 'output-format'),
      };
    }

    // Parse constraints
    const constraintsMatch = xmlContent.match(/<constraints>([\s\S]*?)<\/constraints>/);
    if (constraintsMatch) {
      template.constraints = {
        must: extractListItems(extractXmlContent(constraintsMatch[1], 'must')),
        mustNot: extractListItems(extractXmlContent(constraintsMatch[1], 'must-not')),
        qualityGates: extractListItems(extractXmlContent(constraintsMatch[1], 'quality-gates')),
      };
    }
  }

  return template;
}

function extractXmlContent(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : '';
}

function extractListItems(content: string): string[] {
  if (!content) return [];
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim());
}

/**
 * Render a template with context
 */
export function renderTemplate(template: Template, context: TemplateRenderContext): string {
  let output = `# ${template.name} Agent Template\n\n`;

  if (template.identity) {
    output += `## Identity\n`;
    if (template.identity.role) {
      output += `**Role**: ${template.identity.role}\n\n`;
    }
    if (template.identity.domain) {
      output += `**Domain**: ${template.identity.domain}\n\n`;
    }
  }

  if (context.task) {
    output += `## Current Task\n${context.task}\n\n`;
  }

  if (context.feature) {
    output += `## Feature Context\n${context.feature}\n\n`;
  }

  if (template.capabilities?.primary) {
    output += `## Capabilities\n`;
    for (const cap of template.capabilities.primary) {
      output += `- ${cap}\n`;
    }
    output += '\n';
  }

  if (template.constraints?.mustNot) {
    output += `## Constraints (NEVER)\n`;
    for (const constraint of template.constraints.mustNot) {
      output += `- ${constraint}\n`;
    }
    output += '\n';
  }

  output += `## Full Template Content\n\n${template.content}\n`;

  return output;
}

/**
 * Find template by agent name
 */
export function findTemplate(name: string): Template | undefined {
  const templates = loadTemplates();
  return templates.find(t => t.name.toLowerCase() === name.toLowerCase());
}

/**
 * List all available templates
 */
export function listTemplates(): void {
  const templates = loadTemplates();
  
  console.log('\n📋 Available Agent Templates:\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  for (const template of templates) {
    const role = template.identity?.role?.slice(0, 60) + '...' || 'No role defined';
    console.log(`${template.name.padEnd(12)} v${template.version.padEnd(4)} ${role}`);
  }
  
  console.log(`\nTotal: ${templates.length} templates`);
  console.log('\n═══════════════════════════════════════════════════\n');
}

/**
 * Show template details
 */
export function showTemplate(name: string): void {
  const template = findTemplate(name);
  
  if (!template) {
    console.log(`❌ Template not found: ${name}`);
    console.log(`\nAvailable templates:`);
    listTemplates();
    return;
  }

  console.log(`\n📄 Template: ${template.name}`);
  console.log('═══════════════════════════════════════════════════\n');
  
  if (template.identity) {
    console.log(`🎯 Role: ${template.identity.role || 'N/A'}`);
    console.log(`📁 Domain: ${template.identity.domain || 'N/A'}`);
    if (template.identity.celestialBody) {
      console.log(`🌌 Symbol: ${template.identity.celestialBody}`);
    }
    console.log('');
  }

  if (template.capabilities?.primary) {
    console.log('⚡ Capabilities:');
    for (const cap of template.capabilities.primary) {
      console.log(`   • ${cap}`);
    }
    console.log('');
  }

  if (template.constraints?.mustNot) {
    console.log('🚫 Never Does:');
    for (const constraint of template.constraints.mustNot.slice(0, 5)) {
      console.log(`   • ${constraint}`);
    }
    if (template.constraints.mustNot.length > 5) {
      console.log(`   ... and ${template.constraints.mustNot.length - 5} more`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════\n');
}

/**
 * Apply template to generate output
 */
export function applyTemplate(templateName: string, context: TemplateRenderContext): string {
  const template = findTemplate(templateName);
  
  if (!template) {
    throw new Error(`Template not found: ${templateName}`);
  }

  return renderTemplate(template, context);
}

/**
 * CLI handler for /template command
 */
export function handleTemplateCommand(args: string[]): void {
  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
    case undefined:
      listTemplates();
      break;
    
    case 'show':
      if (!args[1]) {
        console.log('Usage: /template show <agent-name>');
        return;
      }
      showTemplate(args[1]);
      break;
    
    case 'apply':
      if (!args[1]) {
        console.log('Usage: /template apply <agent-name> [task]');
        return;
      }
      try {
        const context: TemplateRenderContext = {
          task: args.slice(2).join(' '),
        };
        const output = applyTemplate(args[1], context);
        console.log(output);
      } catch (error) {
        console.error(`❌ ${error}`);
      }
      break;
    
    default:
      console.log('Usage:');
      console.log('  /template list           - List all templates');
      console.log('  /template show <agent>   - Show template details');
      console.log('  /template apply <agent>  - Apply template with context');
  }
}
