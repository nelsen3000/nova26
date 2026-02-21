#!/usr/bin/env node
// Cross-reference validation script for both knowledge bases
// Scans all pattern .md files, extracts Related Patterns references, checks if targets exist

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';

const BISTROLENS_ROOT = '.nova/bistrolens-knowledge';
const NOVA26_ROOT = '.nova/nova26-patterns';

// Collect all .md pattern files (exclude INDEX, EXTRACTION, SUMMARY)
function collectPatternFiles(baseDir) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (
        entry.endsWith('.md') &&
        !entry.startsWith('INDEX') &&
        !entry.startsWith('EXTRACTION') &&
        !entry.startsWith('.') &&
        entry !== 'EXTRACTION-SUMMARY.md'
      ) {
        files.push(full);
      }
    }
  }
  walk(baseDir);
  return files;
}

// Build a set of all known pattern file paths (for resolution)
const allPatternFiles = new Set();
const bistrolensFiles = collectPatternFiles(BISTROLENS_ROOT);
const nova26Files = collectPatternFiles(NOVA26_ROOT);
[...bistrolensFiles, ...nova26Files].forEach(f => allPatternFiles.add(f));

// Extract references from Related Patterns section
function extractRefs(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const refs = [];
  let inRelated = false;

  for (const line of lines) {
    if (/^##\s+Related\s+Patterns/i.test(line)) {
      inRelated = true;
      continue;
    }
    if (inRelated && /^##\s/.test(line)) {
      inRelated = false;
      continue;
    }
    if (inRelated) {
      // Match backtick references: `path/to/file.md`
      const backtickRefs = [...line.matchAll(/`([^`]*\.md)`/g)].map(m => m[1]);
      // Match markdown link references: [text](path/to/file.md)
      const linkRefs = [...line.matchAll(/\]\(([^)]*\.md)\)/g)].map(m => m[1]);
      // Match square bracket references: [path/to/file.md]  (not followed by ()
      const squareRefs = [...line.matchAll(/\[([^\]]*\.md)\](?!\()/g)].map(m => m[1]);
      
      refs.push(...backtickRefs, ...linkRefs, ...squareRefs);
    }
  }
  return refs;
}

// Try to resolve a reference to an existing file
function resolveRef(ref, sourceFile) {
  const sourceDir = dirname(sourceFile);
  
  // Try relative to source file directory
  const relPath = resolve(sourceDir, ref);
  if (existsSync(relPath)) return { resolved: true, path: relPath };
  
  // Try relative to bistrolens root
  const blPath = join(BISTROLENS_ROOT, ref);
  if (existsSync(blPath)) return { resolved: true, path: blPath };
  
  // Try relative to nova26 root
  const n26Path = join(NOVA26_ROOT, ref);
  if (existsSync(n26Path)) return { resolved: true, path: n26Path };
  
  // Try relative to .nova/
  const novaPath = join('.nova', ref);
  if (existsSync(novaPath)) return { resolved: true, path: novaPath };
  
  // Try as absolute from repo root
  if (existsSync(ref)) return { resolved: true, path: ref };
  
  // Try stripping leading ../
  let cleaned = ref;
  while (cleaned.startsWith('../')) cleaned = cleaned.slice(3);
  if (existsSync(join(BISTROLENS_ROOT, cleaned))) return { resolved: true, path: join(BISTROLENS_ROOT, cleaned) };
  if (existsSync(join(NOVA26_ROOT, cleaned))) return { resolved: true, path: join(NOVA26_ROOT, cleaned) };
  
  return { resolved: false, path: null };
}

// Main validation
let totalRefs = 0;
let brokenRefs = 0;
const brokenList = [];

const allFiles = [...bistrolensFiles, ...nova26Files];
console.log(`=== Cross-Reference Validation ===`);
console.log(`Scanning ${allFiles.length} pattern files...\n`);

for (const file of allFiles) {
  const refs = extractRefs(file);
  for (const ref of refs) {
    totalRefs++;
    const result = resolveRef(ref, file);
    if (!result.resolved) {
      brokenRefs++;
      brokenList.push({ file, ref });
    }
  }
}

console.log(`Total references checked: ${totalRefs}`);
console.log(`Broken references found: ${brokenRefs}`);
console.log();

if (brokenList.length > 0) {
  console.log(`=== Broken References ===`);
  for (const { file, ref } of brokenList) {
    console.log(`  FILE: ${file}`);
    console.log(`  REF:  ${ref}`);
    console.log();
  }
}
