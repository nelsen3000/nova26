# Template Engine

## Source
Extracted from Nova26 `src/templates/template-engine.ts`

---

## Pattern: Declarative Project Scaffolding with Template Registry

The Template Engine pattern provides a declarative, registry-based approach to project scaffolding. Instead of imperative scripts that manually create files one by one, each project template is defined as a typed data structure — a `Template` object containing metadata, file manifests with content, dependency lists, and post-install hooks. The engine then hydrates these templates by replacing `{{placeholders}}` with user-provided values and writing the file tree to disk.

This pattern separates template definition (what to generate) from template execution (how to generate), making it trivial to add new project types without touching the generation logic.

---

## Implementation

### Code Example

```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TemplateFile {
  path: string;
  content: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'saas' | 'api' | 'mobile' | 'ecommerce' | 'content' | 'xcode';
  tags: string[];
  files: TemplateFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  postInstall?: string[];
}

// Registry: all templates keyed by ID
const TEMPLATES: Record<string, Template> = {
  'saas-starter': saasTemplate,
  'api-service': apiTemplate,
  'ecommerce': ecommerceTemplate,
  'xcode-ios': xcodeTemplate,
};

export class TemplateEngine {
  async generate(
    templateId: string,
    projectName: string,
    targetDir: string
  ): Promise<void> {
    const template = TEMPLATES[templateId];
    if (!template) {
      throw new Error(
        `Template not found: ${templateId}. Available: ${Object.keys(TEMPLATES).join(', ')}`
      );
    }

    mkdirSync(targetDir, { recursive: true });

    // Hydrate and write each file
    for (const file of template.files) {
      const filePath = join(
        targetDir,
        file.path.replace(/\{\{projectName\}\}/g, projectName)
      );
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      mkdirSync(dir, { recursive: true });

      const content = file.content.replace(/\{\{projectName\}\}/g, projectName);
      writeFileSync(filePath, content);
    }

    // Generate package.json by merging template deps with base deps
    const packageJson = {
      name: projectName,
      version: '0.1.0',
      private: true,
      scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        ...template.dependencies,
      },
      devDependencies: {
        '@types/node': '^20',
        typescript: '^5',
        ...template.devDependencies,
      },
    };

    writeFileSync(
      join(targetDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  listTemplates(): Template[] {
    return Object.values(TEMPLATES);
  }

  getTemplate(id: string): Template | undefined {
    return TEMPLATES[id];
  }
}
```

### Template Definition Example (SaaS Starter)

```typescript
const saasTemplate: Template = {
  id: 'saas-starter',
  name: 'SaaS Starter',
  description: 'Full-stack SaaS with auth, billing, and dashboard',
  category: 'saas',
  tags: ['nextjs', 'convex', 'stripe', 'auth'],
  files: [
    {
      path: 'app/layout.tsx',
      content: `import type { Metadata } from 'next';
import { ConvexProvider } from '@/components/convex-provider';

export const metadata: Metadata = {
  title: '{{projectName}}',
  description: 'Built with NOVA26',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConvexProvider>{children}</ConvexProvider>
      </body>
    </html>
  );
}`,
    },
    {
      path: 'convex/schema.ts',
      content: `import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    companyId: v.string(),
    role: v.union(v.literal('admin'), v.literal('member')),
  }).index('by_email', ['email']).index('by_company', ['companyId']),
});`,
    },
  ],
  dependencies: {
    convex: '^1.0.0',
    '@stripe/stripe-js': '^2.0.0',
  },
  devDependencies: {
    '@types/node': '^20',
    typescript: '^5',
  },
  postInstall: ['npx convex dev --once', 'npm run dev'],
};
```

### CLI Display Formatting

```typescript
export function formatTemplateList(templates: Template[]): string {
  const lines = ['📦 Available Templates', '═'.repeat(50), ''];
  const categories = ['saas', 'api', 'ecommerce', 'mobile', 'content', 'xcode'];

  for (const category of categories) {
    const categoryTemplates = templates.filter(t => t.category === category);
    if (categoryTemplates.length === 0) continue;

    lines.push(`${category.toUpperCase()}:`);
    for (const template of categoryTemplates) {
      lines.push(`  ${template.id.padEnd(20)} ${template.name}`);
      lines.push(`    ${template.description}`);
      lines.push(`    Tags: ${template.tags.join(', ')}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
```

### Key Concepts

- **Template as data**: Each template is a typed `Template` object — not a script — containing files, dependencies, and metadata
- **Placeholder hydration**: `{{projectName}}` tokens in both file paths and content are replaced at generation time
- **Category-based registry**: Templates are organized by category (`saas`, `api`, `ecommerce`, `xcode`) for discovery and filtering
- **Dependency merging**: Template-specific dependencies are spread into a base `package.json` structure with shared defaults
- **Cross-platform templates**: The Xcode iOS template demonstrates that the engine supports non-web project types (Swift/SwiftUI)

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Imperative scaffolding with hardcoded file creation
function createProject(name: string): void {
  mkdirSync(name);
  mkdirSync(`${name}/src`);
  mkdirSync(`${name}/components`);

  // Every new template requires modifying this function
  writeFileSync(`${name}/src/index.ts`, `console.log("hello")`);
  writeFileSync(`${name}/package.json`, `{"name": "${name}"}`);

  // No validation, no metadata, no discoverability
  // Adding a new template means copy-pasting this entire function
}
```

### ✅ Do This Instead

```typescript
// Declarative template definition — add new templates without touching engine logic
const myTemplate: Template = {
  id: 'my-template',
  name: 'My Template',
  description: 'Description here',
  category: 'saas',
  tags: ['nextjs'],
  files: [
    { path: 'src/index.ts', content: 'export default function main() {}' },
  ],
  dependencies: { convex: '^1.0.0' },
  devDependencies: {},
};

// Register it
TEMPLATES['my-template'] = myTemplate;

// Engine handles all file creation, placeholder replacement, and package.json generation
await templateEngine.generate('my-template', 'my-project', './output');
```

---

## When to Use This Pattern

✅ **Use for:**
- CLI tools that scaffold new projects from predefined starters
- Multi-category project generation (SaaS, API, e-commerce, mobile, iOS)
- Systems where non-developers need to add new templates without modifying engine code

❌ **Don't use for:**
- One-off code generation where a simple string template suffices (use template literals)
- Dynamic code generation that depends on runtime analysis (use AST-based code generation instead)

---

## Benefits

1. **Open/Closed Principle** — New templates are added as data objects without modifying the `TemplateEngine` class
2. **Type safety** — The `Template` interface enforces structure, preventing incomplete or malformed templates at compile time
3. **Discoverability** — `listTemplates()` and `formatTemplateList()` provide built-in CLI discovery with category grouping and tag filtering
4. **Consistent output** — Every generated project gets a properly structured `package.json` with merged dependencies, regardless of template
5. **Cross-platform support** — The same engine handles Next.js web apps and Xcode iOS projects, proving the abstraction is flexible

---

## Related Patterns

- See `../04-cli-and-commands/slash-commands.md` for the CLI command that invokes template generation via `/new`
- See `./skill-loader.md` for the complementary pattern that loads domain-specific knowledge (skills) rather than project scaffolds (templates)
- See `../01-orchestration/prompt-builder-dependency-injection.md` for another pattern that uses template hydration for agent prompt construction

---

*Extracted: 2025-07-18*
