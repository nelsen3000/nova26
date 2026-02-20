// KMS-27: Template Engine Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadTemplates,
  renderTemplate,
  findTemplate,
  listTemplates,
  showTemplate,
  applyTemplate,
  handleTemplateCommand,
  type Template,
} from '../template-engine.js';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { readFileSync, readdirSync, existsSync } from 'fs';

describe('Template Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadTemplates', () => {
    it('should return empty array when agents directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const templates = loadTemplates();

      expect(templates).toEqual([]);
    });

    it('should load all markdown templates from agents directory', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['sun.md', 'mercury.md', 'venus.md'] as any);
      vi.mocked(readFileSync)
        .mockReturnValueOnce('# Sun Agent')
        .mockReturnValueOnce('# Mercury Agent')
        .mockReturnValueOnce('# Venus Agent');

      const templates = loadTemplates();

      expect(templates).toHaveLength(3);
      expect(templates[0].name).toBe('sun');
      expect(templates[1].name).toBe('mercury');
      expect(templates[2].name).toBe('venus');
    });

    it('should parse template XML content correctly', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['sun.md'] as any);
      vi.mocked(readFileSync).mockReturnValue(`
<agent version="2.0">
<identity>
  <role>Frontend Developer</role>
  <domain>UI/UX</domain>
  <celestial-body>Sun</celestial-body>
</identity>
<capabilities>
  <primary>
    - Component development
    - Style implementation
  </primary>
  <tools>
    - React
    - TypeScript
  </tools>
  <output-format>TSX</output-format>
</capabilities>
<constraints>
  <must>
    - Follow style guide
  </must>
  <must-not>
    - Skip accessibility
  </must-not>
  <quality-gates>
    - TypeScript strict
  </quality-gates>
</constraints>
</agent>
# Sun Agent Content
      `);

      const templates = loadTemplates();

      expect(templates[0].version).toBe('2.0');
      expect(templates[0].identity?.role).toBe('Frontend Developer');
      expect(templates[0].identity?.domain).toBe('UI/UX');
      expect(templates[0].identity?.celestialBody).toBe('Sun');
      expect(templates[0].capabilities?.primary).toContain('Component development');
      expect(templates[0].capabilities?.tools).toContain('React');
      expect(templates[0].capabilities?.outputFormat).toBe('TSX');
      expect(templates[0].constraints?.must).toContain('Follow style guide');
      expect(templates[0].constraints?.mustNot).toContain('Skip accessibility');
      expect(templates[0].constraints?.qualityGates).toContain('TypeScript strict');
    });

    it('should handle templates without XML blocks', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['simple.md'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Simple Template');

      const templates = loadTemplates();

      expect(templates[0].name).toBe('simple');
      expect(templates[0].version).toBe('1.0');
      expect(templates[0].identity).toBeUndefined();
    });

    it('should skip files that fail to load', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['good.md', 'bad.md'] as any);
      vi.mocked(readFileSync)
        .mockReturnValueOnce('# Good Template')
        .mockImplementationOnce(() => {
          throw new Error('Permission denied');
        });

      const templates = loadTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('good');
    });

    it('should only load .md files', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['agent.md', 'readme.txt', 'config.json'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Template');

      const templates = loadTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('agent');
    });
  });

  describe('renderTemplate', () => {
    const mockTemplate: Template = {
      name: 'sun',
      version: '1.0',
      content: '# Original Content',
      identity: {
        role: 'Frontend Developer',
        domain: 'UI/UX',
      },
      capabilities: {
        primary: ['Component development', 'Testing'],
      },
      constraints: {
        mustNot: ['Skip accessibility', 'Ignore types'],
      },
    };

    it('should include template name in output', () => {
      const output = renderTemplate(mockTemplate, {});

      expect(output).toContain('# sun Agent Template');
    });

    it('should include identity when available', () => {
      const output = renderTemplate(mockTemplate, {});

      expect(output).toContain('## Identity');
      expect(output).toContain('**Role**: Frontend Developer');
      expect(output).toContain('**Domain**: UI/UX');
    });

    it('should skip identity section when not available', () => {
      const templateWithoutIdentity: Template = {
        name: 'simple',
        version: '1.0',
        content: 'Simple content',
      };

      const output = renderTemplate(templateWithoutIdentity, {});

      expect(output).not.toContain('## Identity');
    });

    it('should include task context when provided', () => {
      const output = renderTemplate(mockTemplate, { task: 'Create a button component' });

      expect(output).toContain('## Current Task');
      expect(output).toContain('Create a button component');
    });

    it('should include feature context when provided', () => {
      const output = renderTemplate(mockTemplate, { feature: 'Authentication flow' });

      expect(output).toContain('## Feature Context');
      expect(output).toContain('Authentication flow');
    });

    it('should include capabilities when available', () => {
      const output = renderTemplate(mockTemplate, {});

      expect(output).toContain('## Capabilities');
      expect(output).toContain('- Component development');
      expect(output).toContain('- Testing');
    });

    it('should include constraints when available', () => {
      const output = renderTemplate(mockTemplate, {});

      expect(output).toContain('## Constraints (NEVER)');
      expect(output).toContain('- Skip accessibility');
      expect(output).toContain('- Ignore types');
    });

    it('should include full template content', () => {
      const output = renderTemplate(mockTemplate, {});

      expect(output).toContain('## Full Template Content');
      expect(output).toContain('# Original Content');
    });

    it('should handle empty constraints', () => {
      const templateWithEmptyConstraints: Template = {
        name: 'test',
        version: '1.0',
        content: 'Content',
        constraints: {
          mustNot: [],
        },
      };

      const output = renderTemplate(templateWithEmptyConstraints, {});

      expect(output).toContain('## Constraints (NEVER)');
    });
  });

  describe('findTemplate', () => {
    it('should find template by exact name match', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md', 'Mercury.md'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Template');

      const template = findTemplate('Sun');

      expect(template).toBeDefined();
      expect(template?.name).toBe('Sun');
    });

    it('should find template case-insensitively', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['SUN.md'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Template');

      const template = findTemplate('sun');

      expect(template).toBeDefined();
      expect(template?.name).toBe('SUN');
    });

    it('should return undefined when template not found', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Template');

      const template = findTemplate('Venus');

      expect(template).toBeUndefined();
    });

    it('should return undefined when no templates exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const template = findTemplate('Sun');

      expect(template).toBeUndefined();
    });
  });

  describe('listTemplates', () => {
    it('should list all available templates', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md', 'Mercury.md'] as any);
      vi.mocked(readFileSync).mockReturnValue(`
<agent>
<identity>
  <role>Frontend Developer specializing in React components and design systems</role>
</identity>
</agent>
      `);

      listTemplates();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Agent Templates'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Sun'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mercury'));

      consoleSpy.mockRestore();
    });

    it('should show truncated role for long descriptions', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md'] as any);
      vi.mocked(readFileSync).mockReturnValue(`
<agent>
<identity>
  <role>This is an extremely long role description that goes on and on and should be truncated when displayed in the list view</role>
</identity>
</agent>
      `);

      listTemplates();

      const calls = consoleSpy.mock.calls.flat();
      const sunLine = calls.find(call => call.includes('Sun'));
      expect(sunLine?.length).toBeLessThan(100);

      consoleSpy.mockRestore();
    });

    it('should show total count', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md', 'Mercury.md', 'Venus.md'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Template');

      listTemplates();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total: 3 templates'));

      consoleSpy.mockRestore();
    });
  });

  describe('showTemplate', () => {
    it('should show template details when found', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md'] as any);
      vi.mocked(readFileSync).mockReturnValue(`
<agent version="1.5">
<identity>
  <role>Frontend Developer</role>
  <domain>UI/UX</domain>
  <celestial-body>Sun</celestial-body>
</identity>
<capabilities>
  <primary>
    - Component development
    - Style implementation
  </primary>
</capabilities>
<constraints>
  <must-not>
    - Skip accessibility
    - Ignore types
  </must-not>
</constraints>
</agent>
      `);

      showTemplate('Sun');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Template: Sun'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Role: Frontend Developer'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Domain: UI/UX'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Symbol: Sun'));

      consoleSpy.mockRestore();
    });

    it('should show error when template not found', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(false);

      showTemplate('NonExistent');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Template not found'));

      consoleSpy.mockRestore();
    });

    it('should show available templates when not found', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Sun');

      showTemplate('NonExistent');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available templates'));

      consoleSpy.mockRestore();
    });

    it('should truncate long must-not lists', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md'] as any);
      vi.mocked(readFileSync).mockReturnValue(`
<agent>
<constraints>
  <must-not>
    - Constraint 1
    - Constraint 2
    - Constraint 3
    - Constraint 4
    - Constraint 5
    - Constraint 6
    - Constraint 7
  </must-not>
</constraints>
</agent>
      `);

      showTemplate('Sun');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('... and 2 more'));

      consoleSpy.mockRestore();
    });
  });

  describe('applyTemplate', () => {
    it('should apply template and return rendered output', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Sun Agent');

      const output = applyTemplate('Sun', { task: 'Create component' });

      expect(output).toContain('# Sun Agent Template');
      expect(output).toContain('Create component');
    });

    it('should throw error when template not found', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      expect(() => applyTemplate('NonExistent', {})).toThrow('Template not found: NonExistent');
    });
  });

  describe('handleTemplateCommand', () => {
    it('should list templates when no subcommand provided', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([] as any);

      handleTemplateCommand([]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Agent Templates'));

      consoleSpy.mockRestore();
    });

    it('should list templates with list subcommand', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([] as any);

      handleTemplateCommand(['list']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Agent Templates'));

      consoleSpy.mockRestore();
    });

    it('should show template with show subcommand', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Sun');

      handleTemplateCommand(['show', 'Sun']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Template: Sun'));

      consoleSpy.mockRestore();
    });

    it('should show usage when show called without template name', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      handleTemplateCommand(['show']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));

      consoleSpy.mockRestore();
    });

    it('should apply template with apply subcommand', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['Sun.md'] as any);
      vi.mocked(readFileSync).mockReturnValue('# Sun');

      handleTemplateCommand(['apply', 'Sun', 'Create', 'button']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('# Sun Agent Template'));

      consoleSpy.mockRestore();
    });

    it('should show usage when apply called without template name', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      handleTemplateCommand(['apply']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));

      consoleSpy.mockRestore();
    });

    it('should handle apply errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(false);

      handleTemplateCommand(['apply', 'NonExistent']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Template not found'));

      consoleSpy.mockRestore();
    });

    it('should show usage for unknown subcommands', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      handleTemplateCommand(['unknown']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));

      consoleSpy.mockRestore();
    });
  });
});
