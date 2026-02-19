import { readdirSync, readFileSync, existsSync, statSync, mkdirSync } from "fs";
import { join, basename, relative } from "path";

const NOVA_DIR = ".nova";
const BISTROLENS_DIR = join(NOVA_DIR, "bistrolens-knowledge");
const NOVA26_DIR = join(NOVA_DIR, "nova26-patterns");

export interface PatternFile {
  name: string;
  path: string;
  module: string;
  knowledgeBase: "bistrolens" | "nova26";
  sections: string[];
  relatedPatterns: string[];
  hasCodeExamples: boolean;
  hasAntiPatterns: boolean;
  hasWhenToUse: boolean;
  hasBenefits: boolean;
  hasSource: boolean;
}

export interface Module {
  name: string;
  path: string;
  knowledgeBase: "bistrolens" | "nova26";
  patterns: PatternFile[];
}

const SKIP_FILES = new Set([
  "INDEX.md",
  "EXTRACTION-TASK-LIST.md",
  "EXTRACTION-SUMMARY.md",
  "README.md",
]);

export function isKebabCase(filename: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*\.md$/.test(filename);
}

export function parsePatternFile(filePath: string): PatternFile {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const sections: string[] = [];

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      sections.push(match[1].trim());
    }
  }

  const relatedSection = extractSection(content, "Related Patterns");
  const relatedPatterns = extractRelatedRefs(relatedSection);

  const hasCodeExamples = /```(?:typescript|tsx|ts|javascript|js)/i.test(content);
  const hasAntiPatterns = sections.some(
    (s) =>
      s.toLowerCase().includes("anti-pattern") ||
      s.toLowerCase().includes("don't do this")
  );
  const hasWhenToUse = sections.some(
    (s) =>
      s.toLowerCase().includes("when to use") ||
      s.toLowerCase().includes("when to use this pattern")
  );
  const hasBenefits = sections.some((s) => s.toLowerCase().includes("benefit"));
  const hasSource = sections.some((s) => s.toLowerCase().includes("source"));

  const dir = relative(process.cwd(), filePath);
  const parts = dir.split("/");
  const kbIndex = parts.findIndex(
    (p) => p === "bistrolens-knowledge" || p === "nova26-patterns"
  );
  const knowledgeBase: "bistrolens" | "nova26" =
    parts[kbIndex] === "bistrolens-knowledge" ? "bistrolens" : "nova26";
  const moduleName = parts[kbIndex + 1] || "";

  return {
    name: basename(filePath),
    path: dir,
    module: moduleName,
    knowledgeBase,
    sections,
    relatedPatterns,
    hasCodeExamples,
    hasAntiPatterns,
    hasWhenToUse,
    hasBenefits,
    hasSource,
  };
}

function extractSection(content: string, sectionName: string): string {
  const regex = new RegExp(
    `^##\\s+${sectionName}[\\s\\S]*?(?=^##\\s|$(?!\\n))`,
    "mi"
  );
  const match = content.match(regex);
  return match ? match[0] : "";
}

export function extractRelatedRefs(sectionContent: string): string[] {
  const refs: string[] = [];
  const linkPattern = /`([^`]+\.md)`/g;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(sectionContent)) !== null) {
    refs.push(m[1]);
  }
  const seePattern = /See\s+`?([^`\n]+\.md)`?/gi;
  while ((m = seePattern.exec(sectionContent)) !== null) {
    if (!refs.includes(m[1])) {
      refs.push(m[1]);
    }
  }
  const mdLinkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  while ((m = mdLinkPattern.exec(sectionContent)) !== null) {
    if (!refs.includes(m[2])) {
      refs.push(m[2]);
    }
  }
  return refs;
}

export function scanKnowledgeBases(): Module[] {
  const modules: Module[] = [];

  for (const [kbDir, kb] of [
    [BISTROLENS_DIR, "bistrolens"],
    [NOVA26_DIR, "nova26"],
  ] as const) {
    if (!existsSync(kbDir)) continue;
    const entries = readdirSync(kbDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const modulePath = join(kbDir, entry.name);
      const patterns = scanModulePatterns(modulePath, entry.name, kb);
      modules.push({
        name: entry.name,
        path: modulePath,
        knowledgeBase: kb,
        patterns,
      });
    }
  }

  return modules;
}

function scanModulePatterns(
  modulePath: string,
  moduleName: string,
  kb: "bistrolens" | "nova26"
): PatternFile[] {
  const patterns: PatternFile[] = [];
  const files = readdirSync(modulePath).filter(
    (f) => f.endsWith(".md") && !SKIP_FILES.has(f)
  );
  for (const file of files) {
    const fullPath = join(modulePath, file);
    if (!statSync(fullPath).isFile()) continue;
    patterns.push(parsePatternFile(fullPath));
  }
  return patterns;
}

export function getMarkdownDocs(): string[] {
  const docs: string[] = [];
  if (!existsSync(NOVA_DIR)) return docs;

  const entries = readdirSync(NOVA_DIR);
  for (const entry of entries) {
    if (entry.endsWith(".md")) {
      docs.push(join(NOVA_DIR, entry));
    }
  }

  // Also include INDEX.md files from knowledge bases
  for (const kbDir of [BISTROLENS_DIR, NOVA26_DIR]) {
    const indexPath = join(kbDir, "INDEX.md");
    if (existsSync(indexPath)) {
      docs.push(indexPath);
    }
  }

  return docs;
}

export function readIndexEntries(indexPath: string): string[] {
  if (!existsSync(indexPath)) return [];
  const content = readFileSync(indexPath, "utf-8");
  const entries: string[] = [];
  // Match backtick-wrapped .md filenames: `path/file.md`
  const backtickPattern = /`([^`]+\.md)`/g;
  let m: RegExpExecArray | null;
  while ((m = backtickPattern.exec(content)) !== null) {
    const fname = m[1].replace(/.*\//, "");
    if (!entries.includes(fname)) {
      entries.push(fname);
    }
  }
  // Match markdown link .md filenames: [file.md](path/file.md)
  const linkPattern = /\[([^\]]+\.md)\]\([^)]+\)/g;
  while ((m = linkPattern.exec(content)) !== null) {
    const fname = m[1].replace(/.*\//, "");
    if (!entries.includes(fname)) {
      entries.push(fname);
    }
  }
  return entries;
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export const AUDIT_REPORTS_DIR = join(NOVA_DIR, "audit-reports");
export { NOVA_DIR, BISTROLENS_DIR, NOVA26_DIR };
