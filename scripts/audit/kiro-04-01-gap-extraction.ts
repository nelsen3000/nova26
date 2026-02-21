/**
 * KIRO-04-01: Gap Pattern Extraction
 * Scans all modules across both knowledge bases, identifies patterns referenced
 * but not documented, creates stub pattern files, and updates indexes.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, basename } from "path";
import {
  scanKnowledgeBases,
  ensureDir,
  AUDIT_REPORTS_DIR,
  BISTROLENS_DIR,
  NOVA26_DIR,
  type Module,
  type PatternFile,
} from "./scan-utils.js";

interface GapPattern {
  name: string;
  fileName: string;
  filePath: string;
  module: string;
  knowledgeBase: "bistrolens" | "nova26";
  reason: string;
}

interface GapReport {
  module: string;
  knowledgeBase: "bistrolens" | "nova26";
  existingCount: number;
  gapsFound: GapPattern[];
}

function getExistingFileNames(mod: Module): Set<string> {
  return new Set(mod.patterns.map((p) => p.name));
}

function findReferencedButMissing(
  mod: Module,
  allModules: Module[]
): GapPattern[] {
  const existing = getExistingFileNames(mod);
  const gaps: GapPattern[] = [];
  const seen = new Set<string>();

  for (const pattern of mod.patterns) {
    for (const ref of pattern.relatedPatterns) {
      const refFile = basename(ref);
      // Only consider refs that point to files in the same module directory
      if (!ref.includes("/") && !existing.has(refFile) && !seen.has(refFile)) {
        seen.add(refFile);
        gaps.push({
          name: refFile.replace(".md", "").replace(/-/g, " "),
          fileName: refFile,
          filePath: join(mod.path, refFile),
          module: mod.name,
          knowledgeBase: mod.knowledgeBase,
          reason: `Referenced in ${pattern.name} Related Patterns but file does not exist`,
        });
      }
    }
  }

  // Also check INDEX entries that don't have files — only match entries
  // explicitly scoped to this module's path (e.g., "01-convex-patterns/schema-conventions.md")
  const kbDir = mod.knowledgeBase === "bistrolens" ? BISTROLENS_DIR : NOVA26_DIR;
  const indexPath = join(kbDir, "INDEX.md");
  if (existsSync(indexPath)) {
    const indexContent = readFileSync(indexPath, "utf-8");
    // Match entries like `module-name/filename.md` in the INDEX
    const moduleEntryPattern = new RegExp(`${mod.name}/([a-zA-Z0-9_-]+\\.md)`, "g");
    let indexMatch: RegExpExecArray | null;
    while ((indexMatch = moduleEntryPattern.exec(indexContent)) !== null) {
      const entry = indexMatch[1];
      if (!existing.has(entry) && !seen.has(entry)) {
        seen.add(entry);
        gaps.push({
          name: entry.replace(".md", "").replace(/-/g, " "),
          fileName: entry,
          filePath: join(mod.path, entry),
          module: mod.name,
          knowledgeBase: mod.knowledgeBase,
          reason: `Listed in INDEX.md but file does not exist in module directory`,
        });
      }
    }
  }

  return gaps;
}

function createPatternStub(gap: GapPattern): void {
  const title = gap.name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const kbLabel = gap.knowledgeBase === "bistrolens" ? "BistroLens" : "Nova26";

  const content = `# ${title}

## Source
Identified as gap during KIRO-04-01 audit of ${kbLabel} ${gap.module}

---

## Pattern: ${title}

${title} — pattern stub created during knowledge base audit. This pattern was referenced by other patterns but had no dedicated documentation.

---

## Implementation

### Code Example

\`\`\`typescript
// TODO: Add implementation example for ${title}
\`\`\`

---

## Anti-Patterns

### ❌ Don't Do This

\`\`\`typescript
// TODO: Add anti-pattern examples
\`\`\`

---

## When to Use This Pattern

✅ **Use for:**
- TODO: Document when to use this pattern

❌ **Don't use for:**
- TODO: Document when not to use this pattern

---

## Benefits

1. TODO: Document benefits

---

## Related Patterns

- TODO: Add related pattern references

---

*Created: ${new Date().toISOString().split("T")[0]} (KIRO-04-01 gap extraction)*
`;

  writeFileSync(gap.filePath, content, "utf-8");
}

function updateIndexFile(
  knowledgeBase: "bistrolens" | "nova26",
  newPatterns: GapPattern[]
): void {
  if (newPatterns.length === 0) return;
  const kbDir = knowledgeBase === "bistrolens" ? BISTROLENS_DIR : NOVA26_DIR;
  const indexPath = join(kbDir, "INDEX.md");
  if (!existsSync(indexPath)) return;

  let content = readFileSync(indexPath, "utf-8");

  // Group by module
  const byModule = new Map<string, GapPattern[]>();
  for (const p of newPatterns) {
    const list = byModule.get(p.module) || [];
    list.push(p);
    byModule.set(p.module, list);
  }

  for (const [mod, patterns] of byModule) {
    const entries = patterns
      .map((p) => {
        const title = p.name
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        return `| ${title} | \`${mod}/${p.fileName}\` | Gap pattern identified during KIRO-04-01 audit |`;
      })
      .join("\n");

    // Append after the module's table section
    const moduleHeader = new RegExp(`(## \\d+ — [^\\n]*${mod.replace(/[-/]/g, ".")}[\\s\\S]*?)(\\n---\\n|\\n## |$)`, "i");
    const match = content.match(moduleHeader);
    if (match) {
      const insertPos = content.indexOf(match[0]) + match[0].length - match[2].length;
      content = content.slice(0, insertPos) + "\n" + entries + "\n" + content.slice(insertPos);
    }
  }

  writeFileSync(indexPath, content, "utf-8");
}

function updateUnifiedManifest(newPatterns: GapPattern[]): void {
  if (newPatterns.length === 0) return;
  const manifestPath = join(".nova", "UNIFIED-MANIFEST.md");
  if (!existsSync(manifestPath)) return;

  let content = readFileSync(manifestPath, "utf-8");

  for (const p of newPatterns) {
    const title = p.name
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const kbLabel = p.knowledgeBase === "bistrolens" ? "BistroLens" : "Nova26";
    const kbDir = p.knowledgeBase === "bistrolens" ? "bistrolens-knowledge" : "nova26-patterns";
    const category = p.module.replace(/^\d+-/, "").replace(/-/g, " ");
    const catTitle = category.charAt(0).toUpperCase() + category.slice(1);

    const entry = `| ${title} | ${catTitle} | ${kbLabel} | ${kbDir}/${p.module}/${p.fileName} | Gap pattern identified during KIRO-04-01 audit |`;

    // Find the module's section in the manifest and append
    const sectionPattern = new RegExp(`(#### ${p.module}[:\\s][^\\n]*\\n[\\s\\S]*?)(\\n####|\\n###|$)`);
    const match = content.match(sectionPattern);
    if (match) {
      const insertPos = content.indexOf(match[0]) + match[0].length - match[2].length;
      content = content.slice(0, insertPos) + "\n" + entry + content.slice(insertPos);
    }
  }

  // Update total count
  const countMatch = content.match(/\*\*Total Patterns:\*\*\s*(\d+)/);
  if (countMatch) {
    const newTotal = parseInt(countMatch[1]) + newPatterns.length;
    content = content.replace(
      /\*\*Total Patterns:\*\*\s*\d+/,
      `**Total Patterns:** ${newTotal}`
    );
  }

  writeFileSync(manifestPath, content, "utf-8");
}

function generateReport(reports: GapReport[]): string {
  const totalGaps = reports.reduce((sum, r) => sum + r.gapsFound.length, 0);
  let md = `# KIRO-04-01: Gap Pattern Extraction Report\n\n`;
  md += `**Date:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Total Modules Scanned:** ${reports.length}\n`;
  md += `**Total Gaps Found:** ${totalGaps}\n\n`;
  md += `---\n\n`;
  md += `## Summary by Module\n\n`;
  md += `| Module | Knowledge Base | Existing | Gaps Found |\n`;
  md += `|--------|---------------|----------|------------|\n`;

  for (const r of reports) {
    md += `| ${r.module} | ${r.knowledgeBase} | ${r.existingCount} | ${r.gapsFound.length} |\n`;
  }

  md += `\n---\n\n## Gap Details\n\n`;

  for (const r of reports) {
    if (r.gapsFound.length === 0) continue;
    md += `### ${r.knowledgeBase}/${r.module}\n\n`;
    for (const g of r.gapsFound) {
      md += `- **${g.name}** → \`${g.filePath}\`\n  - Reason: ${g.reason}\n`;
    }
    md += `\n`;
  }

  if (totalGaps === 0) {
    md += `No gaps found. All referenced patterns have corresponding files.\n`;
  }

  return md;
}

// Main execution
function main(): void {
  console.log("KIRO-04-01: Scanning for gap patterns...\n");
  const modules = scanKnowledgeBases();
  const reports: GapReport[] = [];
  const allGaps: GapPattern[] = [];

  for (const mod of modules) {
    const gaps = findReferencedButMissing(mod, modules);
    reports.push({
      module: mod.name,
      knowledgeBase: mod.knowledgeBase,
      existingCount: mod.patterns.length,
      gapsFound: gaps,
    });

    for (const gap of gaps) {
      console.log(`  GAP: ${gap.knowledgeBase}/${gap.module}/${gap.fileName} — ${gap.reason}`);
      createPatternStub(gap);
      allGaps.push(gap);
    }
  }

  // Update indexes
  const bistrolensGaps = allGaps.filter((g) => g.knowledgeBase === "bistrolens");
  const nova26Gaps = allGaps.filter((g) => g.knowledgeBase === "nova26");
  updateIndexFile("bistrolens", bistrolensGaps);
  updateIndexFile("nova26", nova26Gaps);
  updateUnifiedManifest(allGaps);

  // Write report
  ensureDir(AUDIT_REPORTS_DIR);
  const report = generateReport(reports);
  writeFileSync(join(AUDIT_REPORTS_DIR, "kiro-04-01-gap-report.md"), report, "utf-8");

  console.log(`\nDone. ${allGaps.length} gap patterns created.`);
  console.log(`Report: ${AUDIT_REPORTS_DIR}/kiro-04-01-gap-report.md`);
}

main();
