/**
 * KIRO-04-03: Documentation Accuracy Validation
 * Validates ~20 markdown documentation files in .nova/ for:
 * - File path references that resolve to existing files
 * - Pattern counts that match actual file counts
 * - Cross-references between documentation files
 * Produces accuracy scores and a stale references report.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import {
  getMarkdownDocs,
  ensureDir,
  AUDIT_REPORTS_DIR,
} from "./scan-utils.js";

interface StaleReference {
  line: number;
  referenceText: string;
  expectedPath: string;
}

interface CountMismatch {
  line: number;
  statedCount: number;
  actualCount: number;
  context: string;
}

interface DocValidationResult {
  filePath: string;
  totalReferences: number;
  validReferences: number;
  staleReferences: StaleReference[];
  countMismatches: CountMismatch[];
  accuracyScore: number;
}

function extractFileReferences(
  content: string,
  docDir: string
): { line: number; ref: string; resolvedPath: string }[] {
  const refs: { line: number; ref: string; resolvedPath: string }[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Match markdown links: [text](path.md) or [text](path/)
    const mdLinks = line.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g);
    for (const m of mdLinks) {
      const ref = m[2];
      if (ref.startsWith("http") || ref.startsWith("#")) continue;
      const resolved = join(docDir, ref);
      refs.push({ line: lineNum, ref, resolvedPath: resolved });
    }

    // Match backtick paths: `some/path/file.md` or `some/path/`
    const backtickPaths = line.matchAll(
      /`((?:[\w.-]+\/)+[\w.-]+\.(?:md|ts|tsx|js|json))`/g
    );
    for (const m of backtickPaths) {
      const ref = m[1];
      // Try resolving relative to the document's directory first, then .nova/, then project root
      const fromDocDir = join(docDir, ref);
      const fromNova = join(".nova", ref);
      const fromRoot = ref;
      const resolved = existsSync(fromDocDir) ? fromDocDir : existsSync(fromNova) ? fromNova : fromRoot;
      refs.push({ line: lineNum, ref, resolvedPath: resolved });
    }

    // Match bare file paths in table cells: | path/to/file.md |
    const tablePaths = line.matchAll(
      /\|\s*((?:[\w.-]+\/)+[\w.-]+\.md)\s*\|/g
    );
    for (const m of tablePaths) {
      const ref = m[1];
      const fromDocDir = join(docDir, ref);
      const fromNova = join(".nova", ref);
      const fromRoot = ref;
      const resolved = existsSync(fromDocDir) ? fromDocDir : existsSync(fromNova) ? fromNova : fromRoot;
      refs.push({ line: lineNum, ref, resolvedPath: resolved });
    }
  }

  return refs;
}

function extractCountClaims(
  content: string
): { line: number; count: number; context: string; dirHint: string }[] {
  const claims: { line: number; count: number; context: string; dirHint: string }[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match patterns like "89 patterns", "51 patterns", "Pattern Count | 10"
    const countPatterns = [
      /(\d+)\s+patterns?/gi,
      /Pattern Count[:\s|]*(\d+)/gi,
      /\*\*Total[^*]*:\*\*\s*(\d+)/gi,
      /\*\*[^*]*Patterns:\*\*\s*(\d+)/gi,
    ];

    for (const pattern of countPatterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(line)) !== null) {
        const count = parseInt(m[1]);
        if (count > 0 && count < 1000) {
          // Try to find a directory hint from context
          const dirHint = extractDirHint(lines, i);
          claims.push({
            line: i + 1,
            count,
            context: line.trim().slice(0, 100),
            dirHint,
          });
        }
      }
    }
  }

  return claims;
}

function extractDirHint(lines: string[], lineIndex: number): string {
  // Look at surrounding lines for directory references
  const window = lines.slice(Math.max(0, lineIndex - 3), lineIndex + 3).join(" ");
  const dirMatch = window.match(
    /(?:bistrolens-knowledge|nova26-patterns)\/[\w-]+/
  );
  return dirMatch ? join(".nova", dirMatch[0]) : "";
}

function countMdFiles(dirPath: string): number {
  if (!existsSync(dirPath)) return -1;
  try {
    return readdirSync(dirPath).filter(
      (f) =>
        f.endsWith(".md") &&
        f !== "INDEX.md" &&
        f !== "EXTRACTION-TASK-LIST.md" &&
        f !== "EXTRACTION-SUMMARY.md"
    ).length;
  } catch {
    return -1;
  }
}

function validateDocument(filePath: string): DocValidationResult {
  const content = readFileSync(filePath, "utf-8");
  const docDir = dirname(filePath);

  const fileRefs = extractFileReferences(content, docDir);
  const staleRefs: StaleReference[] = [];
  let validCount = 0;

  for (const ref of fileRefs) {
    if (existsSync(ref.resolvedPath)) {
      validCount++;
    } else {
      staleRefs.push({
        line: ref.line,
        referenceText: ref.ref,
        expectedPath: ref.resolvedPath,
      });
    }
  }

  const countClaims = extractCountClaims(content);
  const countMismatches: CountMismatch[] = [];
  for (const claim of countClaims) {
    if (claim.dirHint) {
      const actual = countMdFiles(claim.dirHint);
      if (actual >= 0 && actual !== claim.count) {
        countMismatches.push({
          line: claim.line,
          statedCount: claim.count,
          actualCount: actual,
          context: claim.context,
        });
      }
    }
  }

  const totalRefs = fileRefs.length;
  const accuracyScore = totalRefs === 0 ? 1.0 : validCount / totalRefs;

  return {
    filePath,
    totalReferences: totalRefs,
    validReferences: validCount,
    staleReferences: staleRefs,
    countMismatches,
    accuracyScore,
  };
}

function generateReport(results: DocValidationResult[]): string {
  let md = `# KIRO-04-03: Documentation Accuracy Validation Report\n\n`;
  md += `**Date:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Documents Validated:** ${results.length}\n\n`;

  md += `---\n\n## Accuracy Scores\n\n`;
  md += `| Document | Total Refs | Valid | Stale | Count Mismatches | Score |\n`;
  md += `|----------|-----------|-------|-------|-----------------|-------|\n`;

  for (const r of results) {
    const score = (r.accuracyScore * 100).toFixed(1);
    md += `| ${r.filePath} | ${r.totalReferences} | ${r.validReferences} | ${r.staleReferences.length} | ${r.countMismatches.length} | ${score}% |\n`;
  }

  const totalStale = results.reduce(
    (sum, r) => sum + r.staleReferences.length,
    0
  );
  const totalMismatches = results.reduce(
    (sum, r) => sum + r.countMismatches.length,
    0
  );

  md += `\n**Total Stale References:** ${totalStale}\n`;
  md += `**Total Count Mismatches:** ${totalMismatches}\n`;

  md += `\n---\n\n## Stale References\n\n`;
  for (const r of results) {
    if (r.staleReferences.length === 0) continue;
    md += `### ${r.filePath}\n\n`;
    for (const s of r.staleReferences) {
      md += `- Line ${s.line}: \`${s.referenceText}\` → expected at \`${s.expectedPath}\`\n`;
    }
    md += `\n`;
  }

  if (totalStale === 0) {
    md += `No stale references found.\n`;
  }

  md += `\n---\n\n## Count Mismatches\n\n`;
  for (const r of results) {
    if (r.countMismatches.length === 0) continue;
    md += `### ${r.filePath}\n\n`;
    for (const c of r.countMismatches) {
      md += `- Line ${c.line}: states ${c.statedCount}, actual ${c.actualCount} — "${c.context}"\n`;
    }
    md += `\n`;
  }

  if (totalMismatches === 0) {
    md += `No count mismatches found.\n`;
  }

  return md;
}

function main(): void {
  console.log("KIRO-04-03: Validating documentation accuracy...\n");
  const docs = getMarkdownDocs();
  const results: DocValidationResult[] = [];

  for (const doc of docs) {
    const result = validateDocument(doc);
    results.push(result);
    const score = (result.accuracyScore * 100).toFixed(1);
    console.log(
      `  ${doc}: ${score}% (${result.staleReferences.length} stale, ${result.countMismatches.length} mismatches)`
    );
  }

  ensureDir(AUDIT_REPORTS_DIR);
  const report = generateReport(results);
  writeFileSync(
    join(AUDIT_REPORTS_DIR, "kiro-04-03-doc-accuracy.md"),
    report,
    "utf-8"
  );

  console.log(
    `\nDone. Report: ${AUDIT_REPORTS_DIR}/kiro-04-03-doc-accuracy.md`
  );
}

main();
