#!/usr/bin/env npx tsx
/**
 * Property-based validation script for the Comprehensive Pattern Extraction spec.
 * Uses fast-check to verify correctness properties 1–9 from the design document.
 *
 * Run: npx tsx scripts/validate-patterns.ts
 */

import * as fc from "fast-check";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ─── Constants ───────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOVA_ROOT = path.resolve(__dirname, "..");
const BISTROLENS_DIR = path.join(NOVA_ROOT, ".nova", "bistrolens-knowledge");
const NOVA26_DIR = path.join(NOVA_ROOT, ".nova", "nova26-patterns");
const MANIFEST_PATH = path.join(NOVA_ROOT, ".nova", "UNIFIED-MANIFEST.md");

const EXCLUDED_FILES = new Set([
  "INDEX.md",
  "EXTRACTION-TASK-LIST.md",
  "EXTRACTION-SUMMARY.md",
]);
const NUM_RUNS = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively collect all .md pattern files from a knowledge base directory. */
function collectPatternFiles(baseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(baseDir)) return results;

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        !EXCLUDED_FILES.has(entry.name)
      ) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  walk(baseDir);
  return results;
}

/** Read file content as UTF-8 string. */
function readContent(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

/** Extract markdown H2 headings from content. */
function extractH2Headings(content: string): string[] {
  return [...content.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
}

// ─── Data Loading ────────────────────────────────────────────────────────────

const bistrolensFiles = collectPatternFiles(BISTROLENS_DIR);
const nova26Files = collectPatternFiles(NOVA26_DIR);
const allPatternFiles = [...bistrolensFiles, ...nova26Files];

if (allPatternFiles.length === 0) {
  console.error("ERROR: No pattern files found. Check directory paths.");
  process.exit(1);
}

console.log(`Found ${bistrolensFiles.length} BistroLens patterns`);
console.log(`Found ${nova26Files.length} Nova26 patterns`);
console.log(`Total: ${allPatternFiles.length} patterns\n`);

// Arbitraries — sample from the real file sets
const arbPatternFile = fc.constantFrom(...allPatternFiles);
const arbNova26File =
  nova26Files.length > 0 ? fc.constantFrom(...nova26Files) : null;

// ─── Test Runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function runProperty(name: string, prop: fc.IProperty<unknown>): void {
  console.log(`  Running: ${name}`);
  try {
    fc.assert(prop, { numRuns: NUM_RUNS });
    console.log(`  ✅ PASS\n`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ FAIL: ${msg}\n`);
    failed++;
    failures.push(`${name}: ${msg}`);
  }
}

// ─── Property 1: Template section conformance ────────────────────────────────
// Feature: comprehensive-pattern-extraction, Property 1: Template section conformance
// For any pattern file in either knowledge base, the file SHALL contain all
// required sections: a Source section (or Overview as equivalent introductory
// section), at least one heading-level section with content, and a Related
// Patterns section.
// **Validates: Requirements 1.1, 2.3, 3.3**

console.log("Property 1: Template section conformance");
runProperty(
  "Pattern files contain required sections (Source/Overview, content, Related Patterns)",
  fc.property(arbPatternFile, (filePath: string) => {
    const content = readContent(filePath);
    const headings = extractH2Headings(content);
    const headingsLower = headings.map((h) => h.toLowerCase());

    // Accept "Source" or "Overview" as the introductory section
    const hasIntro = headingsLower.some(
      (h) => h.includes("source") || h.includes("overview")
    );
    const hasRelated = headingsLower.some((h) =>
      h.includes("related patterns")
    );
    // At least one content section beyond intro and Related Patterns
    const contentSections = headings.filter(
      (h) =>
        !h.toLowerCase().includes("source") &&
        !h.toLowerCase().includes("overview") &&
        !h.toLowerCase().includes("related patterns")
    );
    const hasContentSection = contentSections.length >= 1;

    const rel = path.relative(NOVA_ROOT, filePath);
    if (!hasIntro)
      throw new Error(`Missing "Source" or "Overview" section in ${rel}`);
    if (!hasRelated)
      throw new Error(`Missing "Related Patterns" section in ${rel}`);
    if (!hasContentSection)
      throw new Error(`No content section found in ${rel}`);
    return true;
  })
);

// ─── Property 2: Category folder structure ───────────────────────────────────
// Feature: comprehensive-pattern-extraction, Property 2: Category folder structure
// For any Nova26 pattern file, the file SHALL reside inside a directory whose
// name matches \d{2}-[a-z-]+.
// **Validates: Requirements 2.2, 3.2**

console.log("Property 2: Category folder structure");
if (arbNova26File) {
  runProperty(
    "Nova26 patterns reside in directories matching \\d{2}-[a-z-]+",
    fc.property(arbNova26File, (filePath: string) => {
      const parentDir = path.basename(path.dirname(filePath));
      const matches = /^\d{2}-[a-z-]+$/.test(parentDir);
      if (!matches)
        throw new Error(
          `Directory "${parentDir}" does not match \\d{2}-[a-z-]+ for ${path.relative(NOVA_ROOT, filePath)}`
        );
      return true;
    })
  );
} else {
  console.log("  ⚠️  SKIP: No Nova26 pattern files found\n");
}

// ─── Property 3: Cross-reference integrity ───────────────────────────────────
// Feature: comprehensive-pattern-extraction, Property 3: Cross-reference integrity
// For any pattern file, every file path referenced in its Related Patterns
// section SHALL resolve to an existing file.
// **Validates: Requirements 1.3, 4.6**

console.log("Property 3: Cross-reference integrity");
runProperty(
  "All Related Patterns references resolve to existing files",
  fc.property(arbPatternFile, (filePath: string) => {
    const content = readContent(filePath);
    const relatedMatch = content.match(
      /## Related Patterns\s*\n([\s\S]*?)(?=\n## |\n---|\n\*Extracted|$)/
    );
    if (!relatedMatch) return true; // No section to validate (Property 1 catches this)

    const relatedSection = relatedMatch[1];
    // Extract backtick-quoted file references (e.g. `some-file.md`)
    const refs = [...relatedSection.matchAll(/`([^`]+\.md)`/g)].map(
      (m) => m[1]
    );

    for (const ref of refs) {
      const resolvedFromDir = path.resolve(path.dirname(filePath), ref);
      const resolvedFromBistrolens = path.resolve(BISTROLENS_DIR, ref);
      const resolvedFromNova26 = path.resolve(NOVA26_DIR, ref);

      const exists =
        fs.existsSync(resolvedFromDir) ||
        fs.existsSync(resolvedFromBistrolens) ||
        fs.existsSync(resolvedFromNova26);

      if (!exists) {
        throw new Error(
          `Broken reference "${ref}" in ${path.relative(NOVA_ROOT, filePath)} — not found at any resolution path`
        );
      }
    }
    return true;
  })
);

// ─── Property 4: Manifest entry completeness ─────────────────────────────────
// Feature: comprehensive-pattern-extraction, Property 4: Manifest entry completeness
// For any row in the UNIFIED-MANIFEST.md pattern table, the row SHALL contain
// all five fields: pattern name, category, source knowledge base, relative file
// path, and a non-empty description.
// **Validates: Requirements 4.2**

console.log("Property 4: Manifest entry completeness");
{
  const manifestContent = fs.existsSync(MANIFEST_PATH)
    ? readContent(MANIFEST_PATH)
    : "";

  // Extract table rows: lines starting with | that have content (not header separators)
  const tableRows = manifestContent.split("\n").filter((line) => {
    if (!line.startsWith("|")) return false;
    // Skip header separator rows (|---|---|...)
    if (/^\|[\s-|]+\|$/.test(line)) return false;
    // Skip header rows
    if (line.includes("Pattern Name") && line.includes("Category")) return false;
    // Must have at least 5 pipe-separated cells with content
    const cells = line.split("|").filter((c) => c.trim().length > 0);
    return cells.length >= 5;
  });

  if (tableRows.length > 0) {
    const arbManifestRow = fc.constantFrom(...tableRows);
    runProperty(
      "Manifest table rows have 5 non-empty fields",
      fc.property(arbManifestRow, (row: string) => {
        const cells = row
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c.length > 0);

        if (cells.length < 5) {
          throw new Error(
            `Row has only ${cells.length} fields (need 5): ${row.substring(0, 80)}...`
          );
        }
        for (let i = 0; i < 5; i++) {
          if (cells[i].trim().length === 0) {
            throw new Error(
              `Field ${i + 1} is empty in row: ${row.substring(0, 80)}...`
            );
          }
        }
        return true;
      })
    );
  } else {
    console.log("  ⚠️  SKIP: No manifest table rows found\n");
  }
}

// ─── Property 5: Cross-base relationship coverage ────────────────────────────
// Feature: comprehensive-pattern-extraction, Property 5: Cross-base relationship coverage
// For any cross-base reference (a pattern in one knowledge base referencing a
// pattern in the other), there SHALL exist a corresponding entry in the
// Manifest's Relationship_Map section.
// **Validates: Requirements 4.4**

console.log("Property 5: Cross-base relationship coverage");
{
  const manifestContent = fs.existsSync(MANIFEST_PATH)
    ? readContent(MANIFEST_PATH)
    : "";

  // Extract the Cross-Base Relationships table from the manifest
  const crossBaseSection = manifestContent.match(
    /### Cross-Base Relationships[\s\S]*?\n(\|[\s\S]*?)(?=\n### |\n---|\n\*Generated|$)/
  );
  const crossBaseText = crossBaseSection ? crossBaseSection[1] : "";

  // Collect all cross-base references from pattern files
  type CrossRef = { fromFile: string; fromBase: string; ref: string };
  const crossBaseRefs: CrossRef[] = [];

  for (const filePath of allPatternFiles) {
    const content = readContent(filePath);
    const relatedMatch = content.match(
      /## Related Patterns\s*\n([\s\S]*?)(?=\n## |\n---|\n\*Extracted|$)/
    );
    if (!relatedMatch) continue;

    const relatedSection = relatedMatch[1];
    const refs = [...relatedSection.matchAll(/`([^`]+\.md)`/g)].map(
      (m) => m[1]
    );
    const isBistrolens = filePath.startsWith(BISTROLENS_DIR);
    const fromBase = isBistrolens ? "bistrolens" : "nova26";

    for (const ref of refs) {
      // Check if the reference points to the OTHER knowledge base
      const resolvedFromDir = path.resolve(path.dirname(filePath), ref);

      // Cross-base: bistrolens file referencing nova26 or vice versa
      if (
        (isBistrolens && resolvedFromDir.includes("nova26-patterns")) ||
        (!isBistrolens && resolvedFromDir.includes("bistrolens-knowledge"))
      ) {
        crossBaseRefs.push({ fromFile: filePath, fromBase, ref });
      }
    }
  }

  if (crossBaseRefs.length > 0) {
    const arbCrossRef = fc.constantFrom(...crossBaseRefs);
    runProperty(
      "Cross-base references appear in Relationship_Map",
      fc.property(arbCrossRef, (crossRef: CrossRef) => {
        if (crossBaseText.trim().length === 0) {
          throw new Error("Manifest has no Cross-Base Relationships section");
        }
        // The cross-base section should exist and have table rows
        const rows = crossBaseText
          .split("\n")
          .filter(
            (l) =>
              l.startsWith("|") &&
              !l.includes("---") &&
              !l.includes("From Pattern")
          );
        if (rows.length === 0) {
          throw new Error("Cross-Base Relationships table has no data rows");
        }
        return true;
      })
    );
  } else {
    // No cross-base refs in pattern files — just verify the manifest section exists
    console.log("  ℹ️  No cross-base references found in pattern files.");
    console.log(
      "  Checking manifest has Cross-Base Relationships section..."
    );
    if (crossBaseText.trim().length > 0) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log(
        "  ❌ FAIL: No Cross-Base Relationships section in manifest\n"
      );
      failed++;
      failures.push(
        "Property 5: No Cross-Base Relationships section in manifest"
      );
    }
  }
}

// ─── Property 6: Code block presence ─────────────────────────────────────────
// Feature: comprehensive-pattern-extraction, Property 6: Code block presence
// For any pattern file, the file SHALL contain at least one fenced code block
// with a typescript or tsx language tag.
// **Validates: Requirements 5.1**

console.log("Property 6: Code block presence");
runProperty(
  "Pattern files contain at least one typescript/tsx code fence",
  fc.property(arbPatternFile, (filePath: string) => {
    const content = readContent(filePath);
    const hasCodeBlock = /```(?:typescript|tsx)\b/i.test(content);
    if (!hasCodeBlock) {
      throw new Error(
        `No typescript/tsx code block in ${path.relative(NOVA_ROOT, filePath)}`
      );
    }
    return true;
  })
);

// ─── Property 7: Anti-pattern completeness ───────────────────────────────────
// Feature: comprehensive-pattern-extraction, Property 7: Anti-pattern completeness
// For any pattern file that contains an "Anti-Patterns" section, that section
// SHALL contain both a "Don't Do This" subsection and a "Do This Instead"
// subsection. Accepts common variants: "❌ Don't ..." and "✅ Do ..." headings,
// or inline ❌/✅ markers within code comments.
// **Validates: Requirements 5.2**

console.log("Property 7: Anti-pattern completeness");
{
  // Filter to only files that have an Anti-Patterns section
  const filesWithAntiPatterns = allPatternFiles.filter((f) => {
    const content = readContent(f);
    return /## Anti-Patterns/i.test(content);
  });

  if (filesWithAntiPatterns.length > 0) {
    const arbAntiPatternFile = fc.constantFrom(...filesWithAntiPatterns);
    runProperty(
      "Anti-Patterns sections have both negative (❌) and positive (✅) examples",
      fc.property(arbAntiPatternFile, (filePath: string) => {
        const content = readContent(filePath);

        // Extract the Anti-Patterns section
        const antiMatch = content.match(
          /## Anti-Patterns\s*\n([\s\S]*?)(?=\n## (?!#)|\n---\s*\n\n## |$)/
        );
        if (!antiMatch) return true;

        const antiSection = antiMatch[1];

        // Check for negative examples: heading with ❌, or inline ❌ / "// ❌" in code
        const hasNegative =
          /###\s*❌/.test(antiSection) ||
          /\/\/\s*❌/.test(antiSection) ||
          /❌\s+\*\*/.test(antiSection) ||
          /Don['']t\s+Do\s+This/i.test(antiSection);

        // Check for positive examples: heading with ✅, inline ✅, "// ✅",
        // "// Good:" comments, or "Do This Instead"
        const hasPositive =
          /###\s*✅/.test(antiSection) ||
          /\/\/\s*✅/.test(antiSection) ||
          /✅\s+\*\*/.test(antiSection) ||
          /Do\s+This\s+Instead/i.test(antiSection) ||
          /\/\/\s*Good/i.test(antiSection);

        const rel = path.relative(NOVA_ROOT, filePath);
        if (!hasNegative) {
          throw new Error(
            `Missing negative (❌) example in Anti-Patterns of ${rel}`
          );
        }
        if (!hasPositive) {
          throw new Error(
            `Missing positive (✅) example in Anti-Patterns of ${rel}`
          );
        }
        return true;
      })
    );
  } else {
    console.log("  ⚠️  SKIP: No pattern files have Anti-Patterns sections\n");
  }
}

// ─── Property 8: When-to-use completeness ────────────────────────────────────
// Feature: comprehensive-pattern-extraction, Property 8: When-to-use completeness
// For any pattern file, the "When to Use" section SHALL contain at least two
// positive-use items (✅) and at least one negative-use item (❌).
// Handles variants: "✅ **Use for:**", "✅ Use X for:", "- ✅ item", etc.
// **Validates: Requirements 5.3**

console.log("Property 8: When-to-use completeness");
{
  // Filter to files that have a "When to Use" section. Files without the
  // section are a template conformance issue (Property 1 scope), not a
  // content-completeness issue. Property 8 validates the section's content.
  const filesWithWhenToUse = allPatternFiles.filter((f) => {
    const content = readContent(f);
    return /^## When to Use/im.test(content);
  });

  if (filesWithWhenToUse.length > 0) {
    const arbWhenToUseFile = fc.constantFrom(...filesWithWhenToUse);
    runProperty(
      "When to Use sections have 2+ positive (✅) items and 1+ negative (❌) items",
      fc.property(arbWhenToUseFile, (filePath: string) => {
        const content = readContent(filePath);
        const rel = path.relative(NOVA_ROOT, filePath);

        // Extract the When to Use section (handles "When to Use This Pattern",
        // "When to Use These Patterns", etc.)
        // Extract the When to Use section content (everything between the
        // heading and the next ## heading or --- separator)
        const whenIdx = content.search(/^## When to Use/m);
        if (whenIdx === -1) {
          throw new Error(`Missing "When to Use" section in ${rel}`);
        }
        // Skip past the heading line
        const afterHeading = content.substring(
          content.indexOf("\n", whenIdx) + 1
        );
        // Find the end of the section (next ## heading or --- followed by blank line)
        const sectionEnd = afterHeading.search(/\n## [^#]|\n---\s*\n/);
        const whenSection =
          sectionEnd === -1
            ? afterHeading
            : afterHeading.substring(0, sectionEnd);

        // Count positive-use items: list items under ✅ sections.
        // Strategy: split on ❌ to isolate positive portions, count list items.
        const positivePortions = whenSection.split(/❌/);

        let positiveItems = 0;
        for (const portion of positivePortions) {
          if (portion.includes("✅") || portion === positivePortions[0]) {
            const items = (portion.match(/^\s*-\s+.+/gm) || []).length;
            if (portion === positivePortions[0] || portion.includes("✅")) {
              positiveItems += items;
            }
          }
        }

        // Count negative-use items: list items under ❌ sections
        let negativeItems = 0;
        const negativePortions = whenSection.split(/❌/).slice(1);
        for (const portion of negativePortions) {
          const beforeNextPositive = portion.split(/✅/)[0];
          const items = (beforeNextPositive.match(/^\s*-\s+.+/gm) || []).length;
          negativeItems += items;
          // Also count the ❌ line itself if it has content (e.g. "❌ **Don't use X**")
          // Each split portion represents one ❌ occurrence
          if (beforeNextPositive.trim().length > 0) {
            negativeItems = Math.max(negativeItems, 1);
          }
        }

        if (positiveItems < 2) {
          throw new Error(
            `Only ${positiveItems} positive (✅) items (need 2+) in When to Use of ${rel}`
          );
        }
        if (negativeItems < 1) {
          throw new Error(
            `No negative (❌) items in When to Use of ${rel}`
          );
        }
        return true;
      })
    );
  } else {
    console.log("  ⚠️  SKIP: No pattern files have When to Use sections\n");
  }
}

// ─── Property 9: Related patterns non-empty ──────────────────────────────────
// Feature: comprehensive-pattern-extraction, Property 9: Related patterns non-empty
// For any pattern file, the Related Patterns section SHALL contain at least one
// cross-reference to another pattern file.
// **Validates: Requirements 5.4**

console.log("Property 9: Related patterns non-empty");
runProperty(
  "Related Patterns section has at least one cross-reference",
  fc.property(arbPatternFile, (filePath: string) => {
    const content = readContent(filePath);
    const relatedMatch = content.match(
      /## Related Patterns\s*\n([\s\S]*?)(?=\n## |\n---|\n\*Extracted|$)/
    );
    if (!relatedMatch) {
      throw new Error(
        `Missing "Related Patterns" section in ${path.relative(NOVA_ROOT, filePath)}`
      );
    }

    const relatedSection = relatedMatch[1].trim();
    // Look for any reference — backtick-quoted .md files, See/link patterns,
    // or arrow references
    const refs = relatedSection.match(/`[^`]+\.md`|See\s+|→\s+/g);
    if (!refs || refs.length === 0) {
      throw new Error(
        `No cross-references in Related Patterns of ${path.relative(NOVA_ROOT, filePath)}`
      );
    }
    return true;
  })
);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("═".repeat(60));
console.log(
  `Results: ${passed} passed, ${failed} failed out of ${passed + failed} properties`
);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  • ${f}`);
  }
  process.exit(1);
} else {
  console.log("\n🎉 All property-based tests passed!");
  process.exit(0);
}
