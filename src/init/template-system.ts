import crypto from 'node:crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type ProjectType = 'react-app' | 'api-server' | 'cli-tool' | 'library';

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

export interface TemplateFile {
  path: string;
  content: string;
  variables: TemplateVariable[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  projectType: ProjectType;
  description: string;
  version: string;
  files: TemplateFile[];
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  novaConfig: Record<string, unknown>;
  tags: string[];
  agentOverrides: Record<string, unknown>;
  createdAt: string;
}

export interface TemplateRenderResult {
  files: Array<{ path: string; content: string }>;
  packageJson: {
    name: string;
    version: string;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  novaConfig: Record<string, unknown>;
  renderedAt: string;
}

// ── Template System ────────────────────────────────────────────────────────

export class TemplateSystem {
  private templates: Map<string, ProjectTemplate> = new Map();

  constructor() {
    this.registerBuiltInTemplates();
  }

  private registerBuiltInTemplates(): void {
    const reactApp = this.createReactAppTemplate();
    const apiServer = this.createApiServerTemplate();
    const cliTool = this.createCliToolTemplate();
    const library = this.createLibraryTemplate();

    this.templates.set(reactApp.id, reactApp);
    this.templates.set(apiServer.id, apiServer);
    this.templates.set(cliTool.id, cliTool);
    this.templates.set(library.id, library);
  }

  private createReactAppTemplate(): ProjectTemplate {
    const projectNameVar: TemplateVariable = {
      name: 'projectName',
      description: 'Name of the React application',
      required: true,
    };

    return {
      id: crypto.randomUUID(),
      name: 'react-app',
      projectType: 'react-app',
      description: 'A modern React application with Vite and TypeScript',
      version: '1.0.0',
      files: [
        {
          path: 'src/App.tsx',
          content: `import React from 'react';\n\nexport default function App() {\n  return <div>{{projectName}}</div>;\n}\n`,
          variables: [projectNameVar],
        },
        {
          path: 'src/main.tsx',
          content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\n// {{projectName}} entry point\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);\n`,
          variables: [projectNameVar],
        },
      ],
      dependencies: ['react', 'react-dom'],
      devDependencies: [
        '@types/react',
        '@types/react-dom',
        'typescript',
        'vite',
        '@vitejs/plugin-react',
        'vitest',
      ],
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        test: 'vitest run',
        preview: 'vite preview',
      },
      novaConfig: {
        tier: 'standard',
      },
      tags: ['frontend', 'react', 'vite', 'typescript'],
      agentOverrides: {},
      createdAt: new Date().toISOString(),
    };
  }

  private createApiServerTemplate(): ProjectTemplate {
    const projectNameVar: TemplateVariable = {
      name: 'projectName',
      description: 'Name of the API server',
      required: true,
    };
    const authorVar: TemplateVariable = {
      name: 'author',
      description: 'Author of the project',
      required: false,
      defaultValue: 'Unknown',
    };

    return {
      id: crypto.randomUUID(),
      name: 'api-server',
      projectType: 'api-server',
      description: 'A RESTful API server with Express, Zod validation, and TypeScript',
      version: '1.0.0',
      files: [
        {
          path: 'src/index.ts',
          content: `import express from 'express';\nimport cors from 'cors';\nimport { routes } from './routes';\n\n// {{projectName}} server by {{author}}\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.use('/api', routes);\n\napp.listen(3000, () => console.log('{{projectName}} running on :3000'));\n`,
          variables: [projectNameVar, authorVar],
        },
        {
          path: 'src/routes.ts',
          content: `import { Router } from 'express';\n\n// {{projectName}} routes — authored by {{author}}\nexport const routes = Router();\n\nroutes.get('/health', (_req, res) => {\n  res.json({ status: 'ok', project: '{{projectName}}' });\n});\n`,
          variables: [projectNameVar, authorVar],
        },
      ],
      dependencies: ['express', 'zod', 'cors'],
      devDependencies: ['@types/express', '@types/cors', 'typescript', 'tsx', 'vitest'],
      scripts: {
        dev: 'tsx watch src/index.ts',
        build: 'tsc',
        test: 'vitest run',
        start: 'node dist/index.js',
      },
      novaConfig: {
        tier: 'standard',
      },
      tags: ['backend', 'express', 'api', 'typescript'],
      agentOverrides: {},
      createdAt: new Date().toISOString(),
    };
  }

  private createCliToolTemplate(): ProjectTemplate {
    const projectNameVar: TemplateVariable = {
      name: 'projectName',
      description: 'Name of the CLI tool',
      required: true,
    };

    return {
      id: crypto.randomUUID(),
      name: 'cli-tool',
      projectType: 'cli-tool',
      description: 'A command-line tool with Commander and Chalk',
      version: '1.0.0',
      files: [
        {
          path: 'src/cli.ts',
          content: `import { Command } from 'commander';\nimport chalk from 'chalk';\n\nconst program = new Command();\nprogram.name('{{projectName}}').description('CLI for {{projectName}}').version('1.0.0');\n\nprogram.command('hello').action(() => {\n  console.log(chalk.green('Hello from {{projectName}}!'));\n});\n\nprogram.parse();\n`,
          variables: [projectNameVar],
        },
        {
          path: 'src/commands/index.ts',
          content: `// {{projectName}} command registry\nexport const commands = new Map<string, () => void>();\n`,
          variables: [projectNameVar],
        },
      ],
      dependencies: ['commander', 'chalk'],
      devDependencies: ['typescript', 'vitest', '@types/node'],
      scripts: {
        dev: 'tsx src/cli.ts',
        build: 'tsc',
        test: 'vitest run',
      },
      novaConfig: {
        tier: 'free',
      },
      tags: ['cli', 'tool', 'typescript'],
      agentOverrides: {},
      createdAt: new Date().toISOString(),
    };
  }

  private createLibraryTemplate(): ProjectTemplate {
    const projectNameVar: TemplateVariable = {
      name: 'projectName',
      description: 'Name of the library',
      required: true,
    };
    const authorVar: TemplateVariable = {
      name: 'author',
      description: 'Author of the library',
      required: false,
      defaultValue: 'Unknown',
    };

    return {
      id: crypto.randomUUID(),
      name: 'library',
      projectType: 'library',
      description: 'A TypeScript library with tsup for bundling',
      version: '1.0.0',
      files: [
        {
          path: 'src/index.ts',
          content: `// {{projectName}} — a TypeScript library by {{author}}\nexport function greet(name: string): string {\n  return \`Hello from {{projectName}}, \${name}!\`;\n}\n`,
          variables: [projectNameVar, authorVar],
        },
        {
          path: 'README.md',
          content: `# {{projectName}}\n\nA TypeScript library by {{author}}.\n\n## Installation\n\n\`\`\`bash\nnpm install {{projectName}}\n\`\`\`\n`,
          variables: [projectNameVar, authorVar],
        },
      ],
      dependencies: [],
      devDependencies: ['typescript', 'vitest', 'tsup'],
      scripts: {
        build: 'tsup src/index.ts --format esm,cjs --dts',
        test: 'vitest run',
        prepublishOnly: 'npm run build',
      },
      novaConfig: {
        tier: 'free',
      },
      tags: ['library', 'npm', 'typescript'],
      agentOverrides: {},
      createdAt: new Date().toISOString(),
    };
  }

  listTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(projectType: ProjectType): ProjectTemplate | undefined {
    for (const template of this.templates.values()) {
      if (template.projectType === projectType) {
        return template;
      }
    }
    return undefined;
  }

  getTemplateVariables(projectType: ProjectType): TemplateVariable[] {
    const template = this.getTemplate(projectType);
    if (!template) {
      return [];
    }
    const varMap = new Map<string, TemplateVariable>();
    for (const file of template.files) {
      for (const v of file.variables) {
        varMap.set(v.name, v);
      }
    }
    return Array.from(varMap.values());
  }

  validateVariables(
    projectType: ProjectType,
    variables: Record<string, string>,
  ): { valid: boolean; missing: string[]; errors: string[] } {
    const templateVars = this.getTemplateVariables(projectType);
    const missing: string[] = [];
    const errors: string[] = [];

    for (const tv of templateVars) {
      if (tv.required && !(tv.name in variables)) {
        missing.push(tv.name);
        errors.push(`Required variable "${tv.name}" is missing`);
      }
    }

    return { valid: missing.length === 0, missing, errors };
  }

  renderTemplate(
    projectType: ProjectType,
    variables: Record<string, string>,
  ): TemplateRenderResult | null {
    const template = this.getTemplate(projectType);
    if (!template) {
      return null;
    }

    const validation = this.validateVariables(projectType, variables);
    if (!validation.valid) {
      return null;
    }

    // Apply defaults for optional variables
    const resolvedVars: Record<string, string> = { ...variables };
    for (const tv of this.getTemplateVariables(projectType)) {
      if (!(tv.name in resolvedVars) && tv.defaultValue !== undefined) {
        resolvedVars[tv.name] = tv.defaultValue;
      }
    }

    const renderedFiles = template.files.map((file) => ({
      path: file.path,
      content: this.replaceVariables(file.content, resolvedVars),
    }));

    const deps: Record<string, string> = {};
    for (const d of template.dependencies) {
      deps[d] = 'latest';
    }
    const devDeps: Record<string, string> = {};
    for (const d of template.devDependencies) {
      devDeps[d] = 'latest';
    }

    return {
      files: renderedFiles,
      packageJson: {
        name: resolvedVars['projectName'] ?? template.name,
        version: '1.0.0',
        scripts: { ...template.scripts },
        dependencies: deps,
        devDependencies: devDeps,
      },
      novaConfig: { ...template.novaConfig },
      renderedAt: new Date().toISOString(),
    };
  }

  createProjectFromTemplate(
    projectType: ProjectType,
    variables: Record<string, string>,
  ): {
    id: string;
    projectType: ProjectType;
    result: TemplateRenderResult;
    createdAt: string;
  } | null {
    const result = this.renderTemplate(projectType, variables);
    if (!result) {
      return null;
    }
    return {
      id: crypto.randomUUID(),
      projectType,
      result,
      createdAt: new Date().toISOString(),
    };
  }

  private replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }
}
