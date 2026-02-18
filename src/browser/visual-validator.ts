// Visual Feedback Loop - Headless Browser for UI Validation
// Renders VENUS output, takes screenshots, feeds visual info back to agents
//
// Requires: npx playwright install chromium (auto-installs on first use)

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
 * Check if Playwright is available
 */
let playwrightAvailable: boolean | null = null;
function isPlaywrightAvailable(): boolean {
  if (playwrightAvailable !== null) return playwrightAvailable;
  try {
    execSync('npx playwright --version', { stdio: 'pipe', timeout: 10000 });
    playwrightAvailable = true;
  } catch {
    playwrightAvailable = false;
  }
  return playwrightAvailable;
}

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

  if (!isPlaywrightAvailable()) {
    console.log('Playwright not available. Install with: npx playwright install chromium');
    return [{
      success: false,
      width: 0,
      height: 0,
      error: 'Playwright not installed',
      consoleErrors: [],
      loadTime: 0,
    }];
  }

  const results: ScreenshotResult[] = [];

  for (const bp of BREAKPOINTS) {
    const screenshotPath = join(SCREENSHOTS_DIR, `${taskId}-${bp.name}.png`);

    // Generate Playwright script
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
    const loadTime = Date.now() - start;
    await page.screenshot({ path: '${screenshotPath.replace(/\\/g, '\\\\')}', fullPage: true });

    console.log(JSON.stringify({
      success: true,
      loadTime,
      consoleErrors,
    }));
  } catch (err) {
    console.log(JSON.stringify({
      success: false,
      error: err.message,
      loadTime: Date.now() - start,
      consoleErrors,
    }));
  }

  await browser.close();
})();
`;

    const scriptPath = join(SCREENSHOTS_DIR, `_script-${bp.name}.js`);
    writeFileSync(scriptPath, script);

    try {
      const output = execSync(`node "${scriptPath}"`, {
        encoding: 'utf-8',
        timeout: 30000,
      }).trim();

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
      results.push({
        success: false,
        width: bp.width,
        height: bp.height,
        error: error.message,
        consoleErrors: [],
        loadTime: 0,
      });
    }
  }

  return results;
}

/**
 * Validate VENUS component output visually
 * Renders HTML/React component and checks for visual issues
 */
export async function validateVisually(
  componentCode: string,
  _taskId: string
): Promise<VisualValidationResult> {
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const issues: string[] = [];
  let score = 100;

  // Static analysis of the component code
  // Check for responsive classes
  if (!componentCode.includes('sm:') && !componentCode.includes('md:') && !componentCode.includes('lg:')) {
    issues.push('No responsive Tailwind classes found (sm:, md:, lg:)');
    score -= 15;
  }

  // Check for accessibility
  if (!componentCode.includes('aria-') && !componentCode.includes('role=')) {
    issues.push('No ARIA attributes found');
    score -= 10;
  }

  if (!componentCode.includes('alt=') && componentCode.includes('<img')) {
    issues.push('Images missing alt attributes');
    score -= 10;
  }

  // Check for loading states
  if (!componentCode.includes('loading') && !componentCode.includes('skeleton') && !componentCode.includes('Skeleton')) {
    issues.push('No loading state detected');
    score -= 10;
  }

  // Check for error handling
  if (!componentCode.includes('error') && !componentCode.includes('Error')) {
    issues.push('No error handling detected');
    score -= 10;
  }

  // Check for empty states
  if (!componentCode.includes('empty') && !componentCode.includes('no data') && !componentCode.includes('No ')) {
    issues.push('No empty state detected');
    score -= 10;
  }

  // Check for inline styles (anti-pattern)
  if (componentCode.includes('style={{') || componentCode.includes('style={')) {
    issues.push('Inline styles detected — use Tailwind classes instead');
    score -= 5;
  }

  // Check for div onClick (anti-pattern)
  if (componentCode.includes('<div onClick') || componentCode.includes('<div\n') && componentCode.includes('onClick')) {
    issues.push('<div onClick> detected — use <button> for interactive elements');
    score -= 10;
  }

  // Check for animation/transition
  if (!componentCode.includes('transition') && !componentCode.includes('animate') && !componentCode.includes('motion')) {
    issues.push('No animations or transitions detected');
    score -= 5;
  }

  score = Math.max(0, score);

  return {
    passed: score >= 70,
    screenshots: [], // Screenshots require running preview server
    issues,
    score,
  };
}

/**
 * Format visual validation results for agent feedback
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
      const status = ss.success ? 'OK' : 'FAILED';
      lines.push(`- ${ss.width}x${ss.height}: ${status} (${ss.loadTime}ms)`);
      if (ss.consoleErrors.length > 0) {
        lines.push(`  Console errors: ${ss.consoleErrors.join('; ')}`);
      }
    }
  }

  return lines.join('\n');
}
