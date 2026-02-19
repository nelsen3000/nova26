// Tests for PatternLoader — BistroLens pattern import pipeline
// KIMI-INTEGRATE-06

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPatternLoader, resetPatternLoader, type PatternParseResult } from './pattern-loader.js';
import { resetGraphMemory, getGraphMemory } from './graph-memory.js';
import { resetSemanticDedup } from '../similarity/semantic-dedup.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PatternLoader', () => {
  let tempDir: string;

  beforeEach(() => {
    resetPatternLoader();
    resetGraphMemory();
    resetSemanticDedup();
    tempDir = join(tmpdir(), `nova26-pattern-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  function createPatternFile(dir: string, ...args: string[]): string {
    // Handle both (dir, filename, content) and (dir, subdir, filename, content)
    let subdir: string | undefined;
    let filename: string;
    let content: string;
    
    if (args.length === 2) {
      filename = args[0];
      content = args[1];
    } else {
      subdir = args[0];
      filename = args[1];
      content = args[2];
    }
    
    const targetDir = subdir ? join(dir, subdir) : dir;
    mkdirSync(targetDir, { recursive: true });
    const filePath = join(targetDir, filename);
    writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  describe('File parsing', () => {
    it('parsePatternFile() extracts the title from the first H1 heading', () => {
      const content = `# Test Pattern Title

This is a description paragraph.

## Section 1
Some content here.
`;
      const filePath = createPatternFile(tempDir, 'test.md', content);
      const loader = getPatternLoader();
      const result = loader.parsePatternFile(filePath);

      expect(result.title).toBe('Test Pattern Title');
    });

    it('parsePatternFile() extracts the description from the first paragraph after H1', () => {
      const content = `# Pattern Title

This is the first paragraph description that should be extracted.

This is a second paragraph that should not be in the description.

## Code Section
\
\`\`\`typescript
const x = 1;
\`\`\`
`;
      const filePath = createPatternFile(tempDir, 'test.md', content);
      const loader = getPatternLoader();
      const result = loader.parsePatternFile(filePath);

      expect(result.description).toBe('This is the first paragraph description that should be extracted.');
    });

    it('parsePatternFile() extracts all fenced code blocks into codeExamples array', () => {
      const content = `# Pattern

**Priority:** P1

\`\`\`typescript
const first = 1;
\`\`\`

Some text.

\`\`\`tsx
const Second = () => <div />;
\`\`\`
`;
      const filePath = createPatternFile(tempDir, 'test.md', content);
      const loader = getPatternLoader();
      const result = loader.parsePatternFile(filePath);

      expect(result.codeExamples.length).toBe(2);
      expect(result.codeExamples[0]).toContain('const first = 1');
      expect(result.codeExamples[1]).toContain('const Second');
    });

    it('parsePatternFile() extracts the priority from **Priority:** P1 frontmatter', () => {
      const content = `# Pattern

**Priority:** P1

Some content.
`;
      const filePath = createPatternFile(tempDir, 'test.md', content);
      const loader = getPatternLoader();
      const result = loader.parsePatternFile(filePath);

      expect(result.priority).toBe('P1');
    });

    it('parsePatternFile() defaults to P2 priority when frontmatter is missing', () => {
      const content = `# Pattern

Some content without priority.
`;
      const filePath = createPatternFile(tempDir, 'test.md', content);
      const loader = getPatternLoader();
      const result = loader.parsePatternFile(filePath);

      expect(result.priority).toBe('P2');
    });

    it('parsePatternFile() extracts reusability number from **Reusability:** 9/10', () => {
      const content = `# Pattern

**Reusability:** 9/10

Content here.
`;
      const filePath = createPatternFile(tempDir, 'test.md', content);
      const loader = getPatternLoader();
      const result = loader.parsePatternFile(filePath);

      expect(result.reusability).toBe(9);
    });

    it('parsePatternFile() defaults to 5 reusability when not present', () => {
      const content = `# Pattern

Content here.
`;
      const filePath = createPatternFile(tempDir, 'test.md', content);
      const loader = getPatternLoader();
      const result = loader.parsePatternFile(filePath);

      expect(result.reusability).toBe(5);
    });

    it('parsePatternFile() derives the category from the parent directory name (stripping numeric prefix)', () => {
      const subDir = join(tempDir, '01-security');
      mkdirSync(subDir, { recursive: true });
      const content = `# Pattern

Content.
`;
      const filePath = join(subDir, 'test.md');
      writeFileSync(filePath, content, 'utf-8');

      const loader = getPatternLoader();
      const result = loader.parsePatternFile(filePath);

      // Numeric prefix is stripped per the spec
      expect(result.category).toBe('security');
    });

    it('parsePatternFile() does not throw on a malformed or empty markdown file', () => {
      const filePath = createPatternFile(tempDir, 'empty.md', '');
      const loader = getPatternLoader();

      expect(() => loader.parsePatternFile(filePath)).not.toThrow();
    });
  });

  describe('Node conversion', () => {
    it('toGraphNode() maps 01-security category to NodeType Pattern', () => {
      const parsed: PatternParseResult = {
        filename: 'test.md',
        category: '01-security',
        title: 'Security Pattern',
        description: 'A security pattern',
        codeExamples: [],
        tags: ['security'],
        priority: 'P1',
        reusability: 8,
        sourceFile: '/test.md',
        rawContent: '',
      };

      const loader = getPatternLoader();
      const node = (loader as unknown as { toGraphNode: (p: PatternParseResult) => { type: string } }).toGraphNode(parsed);

      expect(node.type).toBe('Pattern');
    });

    it('toGraphNode() maps 02-steering-system category to NodeType Strategy', () => {
      const parsed: PatternParseResult = {
        filename: 'test.md',
        category: '02-steering-system',
        title: 'Steering Pattern',
        description: 'A steering pattern',
        codeExamples: [],
        tags: ['steering-system'],
        priority: 'P1',
        reusability: 7,
        sourceFile: '/test.md',
        rawContent: '',
      };

      const loader = getPatternLoader();
      const node = (loader as unknown as { toGraphNode: (p: PatternParseResult) => { type: string } }).toGraphNode(parsed);

      expect(node.type).toBe('Strategy');
    });

    it('toGraphNode() maps 08-design-system category to NodeType Preference', () => {
      const parsed: PatternParseResult = {
        filename: 'test.md',
        category: '08-design-system',
        title: 'Design Pattern',
        description: 'A design pattern',
        codeExamples: [],
        tags: ['design-system'],
        priority: 'P2',
        reusability: 9,
        sourceFile: '/test.md',
        rawContent: '',
      };

      const loader = getPatternLoader();
      const node = (loader as unknown as { toGraphNode: (p: PatternParseResult) => { type: string } }).toGraphNode(parsed);

      expect(node.type).toBe('Preference');
    });

    it('toGraphNode() sets isGlobal: true on all BistroLens nodes', () => {
      const parsed: PatternParseResult = {
        filename: 'test.md',
        category: 'security',
        title: 'Security',
        description: 'Pattern',
        codeExamples: [],
        tags: ['security'],
        priority: 'P1',
        reusability: 5,
        sourceFile: '/test.md',
        rawContent: '',
      };

      const loader = getPatternLoader();
      const node = (loader as unknown as { toGraphNode: (p: PatternParseResult) => { isGlobal: boolean } }).toGraphNode(parsed);

      expect(node.isGlobal).toBe(true);
    });

    it('toGraphNode() includes a code example excerpt in the content when available', () => {
      const parsed: PatternParseResult = {
        filename: 'test.md',
        category: 'security',
        title: 'Security',
        description: 'Pattern description',
        codeExamples: ['const example = "code";\nconst more = "lines";'],
        tags: ['security'],
        priority: 'P1',
        reusability: 5,
        sourceFile: '/test.md',
        rawContent: '',
      };

      const loader = getPatternLoader();
      const node = (loader as unknown as { toGraphNode: (p: PatternParseResult) => { content: string } }).toGraphNode(parsed);

      expect(node.content).toContain('Example:');
      expect(node.content).toContain('const example');
    });
  });

  describe('Import pipeline', () => {
    it('loadPatternsFromDirectory() skips KIRO-COMBINED-TASK.md and KIRO-EXTRACTION-TASK.md', async () => {
      const testDir = join(tempDir, 'skip-test');
      createPatternFile(testDir, 'KIRO-COMBINED-TASK.md', '# Combined Task');
      createPatternFile(testDir, 'KIRO-EXTRACTION-TASK.md', '# Extraction Task');
      createPatternFile(testDir, 'valid-pattern.md', `# Valid Pattern

**Priority:** P1

Content here.
`);

      const loader = getPatternLoader({ dryRun: true });
      const result = await loader.loadPatternsFromDirectory(testDir);

      expect(result.loaded).toBe(1);
    });

    it('loadPatternsFromDirectory() with dryRun: true parses but does not write to vault', async () => {
      const testDir = join(tempDir, 'dryrun-test');
      createPatternFile(testDir, '01-security', 'test.md', `# Security Pattern

**Priority:** P1

This is the description paragraph.
`);

      const loader = getPatternLoader({ dryRun: true });
      const result = await loader.loadPatternsFromDirectory(testDir);

      expect(result.loaded).toBe(1);
      // Check that nothing was actually imported
      const graphMemory = getGraphMemory('bistrolens-import');
      expect(graphMemory.nodeCount()).toBe(0);
    });

    it('loadPatternsFromDirectory() actually writes to vault when dryRun is false', async () => {
      const testDir = join(tempDir, 'import-test');
      // Reset singleton to get fresh loader
      resetPatternLoader();
      resetGraphMemory();
      
      createPatternFile(testDir, '01-security', 'test.md', `# Security Pattern

**Priority:** P1
**Reusability:** 8/10

This is the description paragraph.

\`\`\`typescript
const secure = true;
\`\`\`
`);

      const loader = getPatternLoader({ dryRun: false });
      const result = await loader.loadPatternsFromDirectory(testDir);

      expect(result.loaded).toBe(1);
      const graphMemory = getGraphMemory('bistrolens-import');
      expect(graphMemory.nodeCount()).toBeGreaterThan(0);
    });
  });
});


