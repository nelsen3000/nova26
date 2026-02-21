# Visual Validator

## Source
Extracted from Nova26 `src/browser/visual-validator.ts`

---

## Pattern: Visual Validator

The Visual Validator implements a headless-browser feedback loop that validates VENUS (frontend agent) output for UI quality. It combines static analysis of component code with Playwright-based screenshot capture across multiple breakpoints (mobile, tablet, desktop). The validator scores components 0–100 against a checklist covering responsiveness, accessibility, UI states, semantic HTML, AI UX affordances, and more — feeding structured feedback back to agents so they can self-correct.

---

## Implementation

### Code Example

```typescript
import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface ScreenshotResult {
  success: boolean;
  screenshotPath?: string;
  width: number;
  height: number;
  error?: string;
  consoleErrors: string[];
  loadTime: number;
}

export interface VisualValidationResult {
  passed: boolean;
  screenshots: ScreenshotResult[];
  issues: string[];
  score: number; // 0-100
}

const SCREENSHOTS_DIR = join(process.cwd(), '.nova', 'screenshots');
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

/**
 * Take screenshots of a URL at multiple breakpoints
 */
export async function takeScreenshots(
  url: string,
  taskId: string
): Promise<ScreenshotResult[]> {
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const results: ScreenshotResult[] = [];

  for (const bp of BREAKPOINTS) {
    const screenshotPath = join(SCREENSHOTS_DIR, `${taskId}-${bp.name}.png`);

    // Generate and execute a Playwright script per breakpoint
    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: ${bp.width}, height: ${bp.height} }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  const start = Date.now();
  try {
    await page.goto('${url}', { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: '${screenshotPath}', fullPage: true });
    console.log(JSON.stringify({ success: true, loadTime: Date.now() - start, consoleErrors }));
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message, loadTime: Date.now() - start, consoleErrors }));
  }
  await browser.close();
})();`;

    const scriptPath = join(SCREENSHOTS_DIR, `_script-${bp.name}.js`);
    writeFileSync(scriptPath, script);

    try {
      const output = execSync(`node "${scriptPath}"`, { encoding: 'utf-8', timeout: 30000 }).trim();
      const parsed = JSON.parse(output);
      results.push({
        success: parsed.success,
        screenshotPath: parsed.success ? screenshotPath : undefined,
        width: bp.width,
        height: bp.height,
        error: parsed.error,
        consoleErrors: parsed.consoleErrors || [],
        loadTime: parsed.loadTime || 0,
      });
    } catch (error: any) {
      results.push({ success: false, width: bp.width, height: bp.height, error: error.message, consoleErrors: [], loadTime: 0 });
    }
  }

  return results;
}
```

### Static Analysis Scoring

```typescript
/**
 * Validate component code via static analysis — no browser needed.
 * Checks responsiveness, accessibility, UI states, semantic HTML, AI UX, and more.
 */
export async function validateVisually(
  componentCode: string,
  _taskId: string
): Promise<VisualValidationResult> {
  const issues: string[] = [];
  let score = 100;

  // Responsive Tailwind classes
  if (!componentCode.includes('sm:') && !componentCode.includes('md:') && !componentCode.includes('lg:')) {
    issues.push('No responsive Tailwind classes found (sm:, md:, lg:)');
    score -= 15;
  }

  // ARIA attributes
  if (!componentCode.includes('aria-') && !componentCode.includes('role=')) {
    issues.push('No ARIA attributes found');
    score -= 10;
  }

  // Loading / error / empty states
  if (!componentCode.includes('loading') && !componentCode.includes('skeleton')) {
    issues.push('No loading state detected');
    score -= 10;
  }
  if (!componentCode.includes('error') && !componentCode.includes('Error')) {
    issues.push('No error handling detected');
    score -= 10;
  }

  // AI UX: confidence indicators, undo controls, feedback widgets, explainability
  if ((componentCode.includes('AI') || componentCode.includes('generated')) &&
      !componentCode.includes('confidence') && !componentCode.includes('score')) {
    issues.push('AI output detected but no confidence indicator found');
    score -= 8;
  }

  // Destructive action confirmation
  if ((componentCode.includes('delete') || componentCode.includes('remove')) &&
      !componentCode.includes('confirm') && !componentCode.includes('dialog')) {
    issues.push('Destructive action detected but no confirmation dialog found');
    score -= 10;
  }

  score = Math.max(0, score);
  return { passed: score >= 70, screenshots: [], issues, score };
}
```

### Formatting Feedback for Agents

```typescript
/**
 * Format validation results into markdown for agent consumption
 */
export function formatVisualFeedback(result: VisualValidationResult): string {
  const lines: string[] = [
    `## Visual Validation: ${result.passed ? 'PASSED' : 'FAILED'} (Score: ${result.score}/100)\n`,
  ];

  if (result.issues.length > 0) {
    lines.push('### Issues Found\n');
    for (const issue of result.issues) {
      lines.push(`- ${issue}`);
    }
  }

  if (result.screenshots.length > 0) {
    lines.push('\n### Screenshots\n');
    for (const ss of result.screenshots) {
      lines.push(`- ${ss.width}x${ss.height}: ${ss.success ? 'OK' : 'FAILED'} (${ss.loadTime}ms)`);
    }
  }

  return lines.join('\n');
}
```

### Key Concepts

- Dual validation strategy: static code analysis (fast, no browser) plus Playwright screenshots (thorough, requires headless Chromium)
- Scored checklist with weighted deductions — each check subtracts from a perfect 100
- Multi-breakpoint capture at mobile (375px), tablet (768px), and desktop (1440px)
- AI UX checks: confidence indicators, undo controls, feedback widgets, explainability affordances
- Lazy Playwright detection with cached availability flag
- Structured result types (`ScreenshotResult`, `VisualValidationResult`) for programmatic consumption by agents

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Running visual validation only at desktop resolution
async function validateComponent(code: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage(); // default viewport only
  await page.setContent(code);
  const screenshot = await page.screenshot();
  // No scoring, no issue tracking, no multi-breakpoint
  return { screenshot };
}
```

### ✅ Do This Instead

```typescript
// Validate across all breakpoints with structured scoring
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const bp of BREAKPOINTS) {
  const context = await browser.newContext({ viewport: { width: bp.width, height: bp.height } });
  const page = await context.newPage();
  // Capture console errors, measure load time, score against checklist
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Automated UI quality checks in a multi-agent build pipeline (VENUS output validation)
- Catching accessibility, responsiveness, and UI state gaps before human review
- Generating visual regression screenshots across device breakpoints

❌ **Don't use for:**
- Replacing manual accessibility audits or WCAG compliance certification
- Validating non-visual backend logic or API responses

---

## Benefits

1. Catches common UI quality issues (missing ARIA, no loading states, inline styles) automatically before code review
2. Multi-breakpoint screenshots provide visual evidence of responsive behavior at mobile, tablet, and desktop
3. Scored feedback (0–100) gives agents a quantitative signal to self-correct component output
4. AI UX checks enforce confidence indicators, undo controls, and explainability affordances in AI-facing UIs
5. Graceful degradation — static analysis works without Playwright; screenshots are additive

---

## Related Patterns

- See `../01-orchestration/ralph-loop-execution.md` for how the orchestrator triggers visual validation as part of the build loop
- See `../03-quality-gates/typescript-gate.md` for the TypeScript compilation gate that runs before visual validation
- See `../13-browser-and-preview/preview-server.md` for the local preview server that provides URLs for screenshot capture

---

*Extracted: 2026-02-18*
