/**
 * KIRO-04-02: Structural Consistency Audit
 * Audits all pattern files across both knowledge bases for template conformance,
 * file naming, and INDEX coverage. Produces a pass/fail matrix.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  scanKnowledgeBases,
  readIndexEntries,
  isKebabCase,
  ensureDir,
  AUDIT_REPORTS_DIR,
  BISTROLENS_DIR,
  NOVA26_DIR,
  type Module,
  type PatternFile,
} from "./scan-utils.js";

interface CriterionResult {
  name: string;
  passed: boolean;
  details?: string;
}

interface PatternAudit {
  fileName: string;
  criteria: CriterionResult[];
}

interface ModuleAuditResult {
  module: string;
  knowledgeBase: "bistrolens" | "nova26";
  patternAudits: PatternAudit[];
  summary: Record<string, { pass: number; fail: number }>;
}

const CRITERIA_NAMES = [
  "has-source",
  "has-code-examples",
  "has-anti-patterns",
  "has-when-to-use",
  "has-benefits",
  "has-related-patterns",
  "kebab-case-filename",
  "in-index",
] as const;

function auditPattern(
  pattern: PatternFile,
  indexEntries: Set<string>
): PatternAudit {
  const criteria: CriterionResult[] = [
    { name: "has-source", passed: pattern.hasSource },
    { name: "has-code-examples", passed: pattern.hasCodeExamples },
    { name: "has-anti-patterns", passed: pattern.hasAntiPatterns },
    { name: "has-when-to-use", passed: pattern.hasWhenToUse },
    { name: "has-benefits", passed: pattern.hasBenefits },
    {
      name: "has-related-patterns",
      passed: pattern.relatedPatterns.length > 0,
    },
    { name: "kebab-case-filename", passed: isKebabCase(pattern.name) },
    { name: "in-index", passed: indexEntries.has(pattern.name) },
  ];

  return { fileName: pattern.name, criteria };
}

function auditModule(mod: Module): ModuleAuditResult {
  const kbDir =
    mod.knowledgeBase === "bistrolens" ? BISTROLENS_DIR : NOVA26_DIR;
  const indexPath = join(kbDir, "INDEX.md");
  const indexEntries = new Set(readIndexEntries(indexPath));

  const patternAudits: PatternAudit[] = [];
  for (const pattern of mod.patterns) {
    patternAudits.push(auditPattern(pattern, indexEntries));
  }

  // Build summary
  const summary: Record<string, { pass: number; fail: number }> = {};
  for (const name of CRITERIA_NAMES) {
    summary[name] = { pass: 0, fail: 0 };
  }
  for (const audit of patternAudits) {
    for (const c of audit.criteria) {
      if (c.passed) {
        summary[c.name].pass++;
      } else {
        summary[c.name].fail++;
      }
    }
  }

  return {
    module: mod.name,
    knowledgeBase: mod.knowledgeBase,
    patternAudits,
    summary,
  };
}

function generateMatrix(results: ModuleAuditResult[]): string {
  let md = `# KIRO-04-02: Structural Consistency Audit Matrix\n\n`;
  md += `**Date:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Modules Audited:** ${results.length}\n\n`;

  // Header
  md += `| Module | KB | Patterns |`;
  for (const name of CRITERIA_NAMES) {
    md += ` ${name} |`;
  }
  md += `\n`;

  md += `|--------|-----|----------|`;
  for (const _name of CRITERIA_NAMES) {
    md += `------|`;
  }
  md += `\n`;

  // Rows
  const totals: Record<string, { pass: number; fail: number }> = {};
  for (const name of CRITERIA_NAMES) {
    totals[name] = { pass: 0, fail: 0 };
  }

  for (const r of results) {
    const patternCount = r.patternAudits.length;
    md += `| ${r.module} | ${r.knowledgeBase} | ${patternCount} |`;
    for (const name of CRITERIA_NAMES) {
      const s = r.summary[name];
      totals[name].pass += s.pass;
      totals[name].fail += s.fail;
      const icon = s.fail === 0 ? "✅" : `❌ ${s.fail}`;
      md += ` ${icon} |`;
    }
    md += `\n`;
  }

  // Summary row
  md += `| **TOTAL** | | |`;
  for (const name of CRITERIA_NAMES) {
    const t = totals[name];
    md += ` ${t.pass}✅ ${t.fail}❌ |`;
  }
  md += `\n`;

  // Detailed failures
  md += `\n---\n\n## Detailed Failures\n\n`;
  for (const r of results) {
    const failures = r.patternAudits.filter((a) =>
      a.criteria.some((c) => !c.passed)
    );
    if (failures.length === 0) continue;

    md += `### ${r.knowledgeBase}/${r.module}\n\n`;
    for (const audit of failures) {
      const failedCriteria = audit.criteria
        .filter((c) => !c.passed)
        .map((c) => c.name);
      md += `- **${audit.fileName}**: missing ${failedCriteria.join(", ")}\n`;
    }
    md += `\n`;
  }

  return md;
}

function main(): void {
  console.log("KIRO-04-02: Running structural consistency audit...\n");
  const modules = scanKnowledgeBases();
  const results: ModuleAuditResult[] = [];

  for (const mod of modules) {
    const result = auditModule(mod);
    results.push(result);
    const totalFails = Object.values(result.summary).reduce(
      (sum, s) => sum + s.fail,
      0
    );
    console.log(
      `  ${mod.knowledgeBase}/${mod.name}: ${mod.patterns.length} patterns, ${totalFails} failures`
    );
  }

  ensureDir(AUDIT_REPORTS_DIR);
  const matrix = generateMatrix(results);
  writeFileSync(
    join(AUDIT_REPORTS_DIR, "kiro-04-02-structural-matrix.md"),
    matrix,
    "utf-8"
  );

  console.log(
    `\nDone. Report: ${AUDIT_REPORTS_DIR}/kiro-04-02-structural-matrix.md`
  );
}

main();
