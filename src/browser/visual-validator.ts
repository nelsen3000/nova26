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

  // NEW CHECKS - AI UX Requirements

  // 1. Confidence indicators (for AI output UIs)
  if ((componentCode.includes('ai') || componentCode.includes('AI') || componentCode.includes('generated')) &&
      !componentCode.includes('confidence') && !componentCode.includes('score') && !componentCode.includes('certainty')) {
    issues.push('AI output detected but no confidence indicator found');
    score -= 8;
  }

  // 2. Undo/rollback controls (for AI-driven actions)
  if ((componentCode.includes('mutation') || componentCode.includes('useMutation') || componentCode.includes('submit')) &&
      !componentCode.includes('undo') && !componentCode.includes('revert') && !componentCode.includes('rollback')) {
    issues.push('Mutation detected but no undo/rollback control found');
    score -= 8;
  }

  // 3. Feedback widgets (thumbs up/down, ratings)
  if ((componentCode.includes('ai') || componentCode.includes('AI') || componentCode.includes('response')) &&
      !componentCode.includes('thumbs') && !componentCode.includes('rating') && !componentCode.includes('feedback') && !componentCode.includes('helpful')) {
    issues.push('AI response detected but no feedback widget found');
    score -= 7;
  }

  // 4. Explainability affordances ("Why?" buttons, info icons)
  if ((componentCode.includes('ai') || componentCode.includes('AI') || componentCode.includes('recommendation')) &&
      !componentCode.includes('why') && !componentCode.includes('explain') && !componentCode.includes('info') && !componentCode.includes('tooltip')) {
    issues.push('AI output detected but no explainability affordance found (Why? button, info icon)');
    score -= 8;
  }

  // 5. Confirmation dialogs (before risky actions)
  if ((componentCode.includes('delete') || componentCode.includes('remove') || componentCode.includes('destroy')) &&
      !componentCode.includes('confirm') && !componentCode.includes('dialog') && !componentCode.includes('alert') && !componentCode.includes('modal')) {
    issues.push('Destructive action detected but no confirmation dialog found');
    score -= 10;
  }

  // 6. Keyboard navigation (tabIndex, onKeyDown, onKeyPress)
  if (!componentCode.includes('tabIndex') && !componentCode.includes('onKeyDown') && !componentCode.includes('onKeyPress') && !componentCode.includes('onKeyUp')) {
    issues.push('No keyboard navigation support detected (tabIndex, onKeyDown)');
    score -= 8;
  }

  // 7. ARIA live regions (for streaming/dynamic content)
  if ((componentCode.includes('streaming') || componentCode.includes('dynamic') || componentCode.includes('real-time') || componentCode.includes('live')) &&
      !componentCode.includes('aria-live')) {
    issues.push('Dynamic/streaming content detected but no aria-live region found');
    score -= 8;
  }

  // 8. Color contrast (check for low-contrast Tailwind classes)
  const lowContrastPatterns = [
    'text-gray-300',
    'text-gray-400',
    'bg-white.*text-gray-300',
    'bg-white.*text-gray-400',
  ];
  for (const pattern of lowContrastPatterns) {
    if (new RegExp(pattern).test(componentCode)) {
      issues.push('Low color contrast detected (text-gray-300/400 on light backgrounds)');
      score -= 7;
      break;
    }
  }

  // 9. i18n readiness (check for hardcoded user-facing strings)
  const hardcodedStringPattern = /["'](?:Click|Submit|Cancel|Delete|Save|Edit|Add|Remove|Update|Create|Search|Filter|Sort|Login|Logout|Sign in|Sign up|Welcome|Hello|Error|Success|Warning|Loading|Please|Thank you)[^"']*["']/gi;
  const hardcodedMatches = componentCode.match(hardcodedStringPattern);
  if (hardcodedMatches && hardcodedMatches.length > 3) {
    issues.push(`Multiple hardcoded user-facing strings detected (${hardcodedMatches.length} found) — consider i18n keys`);
    score -= 6;
  }

  // 10. Progressive disclosure (collapsible/expandable sections)
  if (componentCode.length > 500 && // Only check for longer components
      !componentCode.includes('collapse') && !componentCode.includes('expand') && !componentCode.includes('accordion') && 
      !componentCode.includes('details') && !componentCode.includes('summary') && !componentCode.includes('Collapsible')) {
    issues.push('Long component detected but no progressive disclosure pattern found (collapsible sections)');
    score -= 6;
  }

  // 11. Semantic HTML (check for proper use of semantic elements)
  const hasGenericDivs = (componentCode.match(/<div/g) || []).length > 5;
  const hasSemanticHTML = componentCode.includes('<nav') || componentCode.includes('<main') || 
                          componentCode.includes('<header') || componentCode.includes('<footer') || 
                          componentCode.includes('<section') || componentCode.includes('<article');
  
  if (hasGenericDivs && !hasSemanticHTML && componentCode.length > 300) {
    issues.push('Excessive use of <div> without semantic HTML elements (nav, main, header, footer, section)');
    score -= 8;
  }

  // 12. Focus management (for modals/dialogs)
  if ((componentCode.includes('modal') || componentCode.includes('Modal') || componentCode.includes('dialog') || componentCode.includes('Dialog')) &&
      !componentCode.includes('autoFocus') && !componentCode.includes('focus') && !componentCode.includes('trap')) {
    issues.push('Modal/dialog detected but no focus management found (autoFocus, focus trap)');
    score -= 8;
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
