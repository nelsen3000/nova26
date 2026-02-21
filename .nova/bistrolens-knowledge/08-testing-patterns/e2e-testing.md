# E2E Testing Patterns

## Source
Extracted from BistroLens:
- `playwright.config.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/analytics-verification.spec.ts`
- `tests/e2e/seo-collections-cta.spec.ts`
- `docs/TESTPLAN.md`
- `docs/CI-CD.md`
- `.github/workflows/golden-pdfs.yml`
- `package.json`

---

## Overview

BistroLens uses **Playwright** for E2E testing. Tests live in `tests/e2e/` and cover smoke tests, analytics event verification, and SEO/CTA user flows. The stack runs against a local Vite dev server (`http://localhost:5173`) and is configured for 5 browser projects: Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari.

Key characteristics:
- Tests are co-located in `tests/e2e/` (not scattered across the codebase)
- `playwright.config.ts` at the project root auto-starts the dev server
- CI uses `workers: 1` and `retries: 2` for stability
- HTML reporter generates reports in `playwright-report/`

---

## Setup & Configuration

### `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/e2e/**/*.spec.ts', '**/golden-pdfs/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,   // Fail if test.only left in CI
  retries: process.env.CI ? 2 : 0, // Retry flaky tests in CI only
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry', // Capture trace on first retry for debugging
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI, // Reuse local server in dev
  },
});
```

### Key Config Decisions

| Setting | Value | Why |
|---|---|---|
| `fullyParallel` | `true` | Faster local runs |
| `forbidOnly` | `true` in CI | Prevents accidental `.only` commits |
| `retries` | 2 in CI, 0 locally | Handles flakiness without masking local bugs |
| `workers` | 1 in CI | Avoids race conditions on shared CI resources |
| `trace` | `on-first-retry` | Captures traces only when needed |
| `reuseExistingServer` | `true` locally | Faster dev iteration |

### npm Scripts

```json
{
  "test:e2e": "playwright test",
  "test:golden-pdfs": "playwright test tests/golden-pdfs/generate.spec.ts --project=chromium --workers=1"
}
```

Run a single spec against one browser:
```bash
npx playwright test tests/e2e/smoke.spec.ts --project=chromium
```

---

## Test Structure

### File Organization

```
tests/
├── e2e/
│   ├── smoke.spec.ts              # Core app smoke tests
│   ├── analytics-verification.spec.ts  # Event tracking verification
│   └── seo-collections-cta.spec.ts     # SEO page CTA flows
└── golden-pdfs/
    └── generate.spec.ts           # PDF generation tests
```

### Basic Test Anatomy

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('descriptive test name', async ({ page }) => {
    // Arrange: navigate / set up state
    // Act: interact with the page
    // Assert: verify expected outcome
    await expect(page).toHaveTitle(/Bistro Lens/);
  });
});
```

### Shared State Between Tests

```typescript
test.describe('Analytics Verification', () => {
  let consoleLogs: string[] = [];
  let sessionId: string = '';

  test.beforeEach(async ({ page }) => {
    consoleLogs = []; // Reset per test

    // Attach listener before navigation
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[analytics_')) {
        consoleLogs.push(text);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Extract runtime state from localStorage
    sessionId = await page.evaluate(() => {
      return localStorage.getItem('bistrolens_analytics_session_id') || '';
    });
  });
});
```

---

## Page Object Models

BistroLens does not yet use formal Page Object Models (POMs). Tests use inline locators. For Nova26, the recommended pattern is:

```typescript
// pages/CollectionPage.ts
import { Page, Locator } from '@playwright/test';

export class CollectionPage {
  readonly page: Page;
  readonly heroHeadline: Locator;
  readonly cookTonightBtn: Locator;
  readonly saveCollectionBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroHeadline = page.locator('section h1').first();
    this.cookTonightBtn = page.locator('button:has-text("Cook one tonight")');
    this.saveCollectionBtn = page.locator('button:has-text("Save this collection")');
  }

  async goto(slug: string) {
    await this.page.goto(`/collections/${slug}`);
    await this.page.waitForLoadState('networkidle');
  }

  async dismissModals() {
    await this.page.waitForTimeout(500);
    const closeBtn = this.page.locator(
      'button:has-text("Get Started"), button:has-text("Skip"), [aria-label="Close"]'
    );
    if (await closeBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.first().click();
    }
  }
}

// Usage in test
import { CollectionPage } from '../pages/CollectionPage';

test('collection page loads CTAs', async ({ page }) => {
  const collectionPage = new CollectionPage(page);
  await collectionPage.goto('15-minute-chicken-dinners');
  await collectionPage.dismissModals();
  await expect(collectionPage.cookTonightBtn).toBeVisible();
});
```

---

## Authentication in Tests

BistroLens tests auth state by manipulating `localStorage` and `sessionStorage` directly — no test accounts or API-level auth setup.

### Simulating Logged-Out State

```typescript
test('Save CTA redirects to login when logged out', async ({ page }) => {
  await page.goto('/collections/15-minute-chicken-dinners');

  // Clear auth state
  await page.evaluate(() => {
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
  });

  // Reload to apply cleared state
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Interact as unauthenticated user
  const saveBtn = page.locator('button:has-text("Save this collection")');
  await saveBtn.click({ force: true });

  // Verify redirect behavior
  const currentUrl = page.url();
  const returnUrl = await page.evaluate(() =>
    sessionStorage.getItem('bistroLens_loginReturnUrl')
  );

  const isOnLoginPage = currentUrl.includes('/login');
  const hasReturnUrl = returnUrl?.includes('/collections/');

  expect(isOnLoginPage || hasReturnUrl).toBeTruthy();
});
```

### Simulating Logged-In State (Pattern for Nova26)

```typescript
// fixtures/auth.ts
import { test as base } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Set auth tokens before navigation
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'test-user-id',
        email: 'test@example.com',
        tier: 'pro',
      }));
    });
    await page.reload();
    await use(page);
  },
});
```

---

## Common Interactions

### Navigation & Load State

```typescript
// Navigate and wait for network to settle
await page.goto('/');
await page.waitForLoadState('networkidle');

// Navigate to a specific route
await page.goto('/collections/15-minute-chicken-dinners');
```

### Locator Strategies (Playwright-preferred order)

```typescript
// 1. Role-based (most resilient)
page.getByRole('button', { name: 'Generate Recipe' })
page.getByRole('textbox', { name: 'Recipe prompt' })

// 2. Label-based
page.getByLabel('Recipe prompt input')

// 3. Placeholder-based
page.getByPlaceholder(/Ask the chef/i)

// 4. Text-based
page.getByText('Bistro Lens')

// 5. CSS/attribute selectors (last resort)
page.locator('button:has-text("Cook one tonight")')
page.locator('[data-testid="favorite-button"]')
page.locator('meta[name="description"]')
```

### Filling Inputs

```typescript
const promptInput = page.getByPlaceholder(/Ask the chef/i);
await promptInput.fill('Spicy Tacos');
await expect(promptInput).toHaveValue('Spicy Tacos');
```

### Clicking with Force (Bypassing Overlays)

```typescript
// Use force: true when modals/overlays may intercept clicks
await saveBtn.click({ force: true });
```

### Keyboard Interactions

```typescript
// Dismiss modals with Escape
await page.keyboard.press('Escape');

// Tab navigation
await page.keyboard.press('Tab');
```

### Dismissing Modals (Reusable Helper)

```typescript
async function dismissModals(page: Page) {
  await page.waitForTimeout(500);

  // Try close buttons
  const closeBtn = page.locator(
    'button:has-text("Get Started"), button:has-text("Skip"), button:has-text("Close"), [aria-label="Close"]'
  );
  if (await closeBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.first().click();
    await page.waitForTimeout(300);
  }

  // Try Escape for overlay
  const overlay = page.locator('.fixed.inset-0.bg-black\\/50');
  if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}
```

### Intercepting Network Requests

```typescript
// Intercept Convex API calls
await page.route('**/*convex*', async (route, request) => {
  const postData = request.postData();
  if (postData?.includes('logSaveEvent')) {
    mutationCalls.push(postData);
  }
  await route.continue(); // Always continue unless mocking
});
```

### Reading localStorage / sessionStorage

```typescript
// Read
const value = await page.evaluate(() =>
  localStorage.getItem('bistrolens_analytics_session_id')
);

// Write
await page.evaluate(() => {
  localStorage.setItem('key', 'value');
});

// Clear
await page.evaluate(() => {
  localStorage.removeItem('currentUser');
  sessionStorage.clear();
});
```

---

## Assertions

### Page-Level

```typescript
await expect(page).toHaveTitle(/Bistro Lens/);
await expect(page).toHaveURL('/collections/15-minute-chicken-dinners');
```

### Element Visibility

```typescript
await expect(element).toBeVisible();
await expect(element).toBeVisible({ timeout: 5000 }); // Custom timeout
await expect(element).not.toBeVisible();
```

### Text Content

```typescript
await expect(heroHeadline).toContainText('15-Minute Chicken Dinners', { timeout: 10000 });
await expect(element).toHaveText('Exact text');
```

### Input Values

```typescript
await expect(input).toHaveValue('Spicy Tacos');
```

### Attribute Assertions

```typescript
const metaDescription = await page
  .locator('meta[name="description"]')
  .getAttribute('content');
expect(metaDescription).toBeTruthy();

const ogTitle = await page
  .locator('meta[property="og:title"]')
  .getAttribute('content');
expect(ogTitle).toContain('15-Minute Chicken Dinners');
```

### Conditional Assertions (Soft Checks)

```typescript
// When element may or may not exist, use isVisible with catch
const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
if (isVisible) {
  await element.click();
}

// Assert at least one condition is true
expect(isOnLoginPage || hasReturnUrl || hasRedirectLog).toBeTruthy();
```

### Console Log Assertions

```typescript
// Capture logs before navigation
const consoleLogs: string[] = [];
page.on('console', (msg) => {
  if (msg.text().includes('[analytics_track]')) {
    consoleLogs.push(msg.text());
  }
});

// After interactions, assert on captured logs
const trackLogs = consoleLogs.filter(log => log.includes('GENERATE'));
expect(trackLogs.length).toBeGreaterThan(0);
```

---

## Test Data Management

BistroLens uses hardcoded test slugs and inline test data — no external fixtures or database seeding.

### Hardcoded Test Constants

```typescript
// At the top of the spec file
const TEST_COLLECTION_SLUG = '15-minute-chicken-dinners';
const BASE_URL = 'http://localhost:5173';
```

### Inline Test Data

```typescript
// Fill inputs with known test values
await recipeInput.fill('quick pasta with garlic');
await recipeInput.fill('simple garlic bread');
```

### State Reset Between Tests

```typescript
test.beforeEach(async ({ page }) => {
  consoleLogs = []; // Reset captured logs

  // Clear auth/session state if needed
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('currentUser');
  });
});
```

### Pattern for Nova26: Test Fixtures

For more complex data needs, use Playwright fixtures:

```typescript
// fixtures/testData.ts
import { test as base } from '@playwright/test';

type TestData = {
  recipeSlug: string;
  testUser: { email: string; tier: string };
};

export const test = base.extend<TestData>({
  recipeSlug: async ({}, use) => {
    await use('quick-pasta-garlic');
  },
  testUser: async ({}, use) => {
    await use({ email: 'test@example.com', tier: 'pro' });
  },
});
```

---

## CI/CD Integration

### GitHub Actions Workflow (Golden PDFs Example)

```yaml
name: Golden PDF Generation

on:
  workflow_dispatch: # Manual trigger only

jobs:
  generate-golden-pdfs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      # Install only the browsers you need in CI
      - run: npx playwright install --with-deps chromium

      - run: npm run test:golden-pdfs
        env:
          CI: true
          VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}

      - uses: actions/upload-artifact@v4
        with:
          name: golden-pdfs
          path: tests/golden-pdfs/golden-*.pdf
          retention-days: 30
```

### CI Behavior Differences

| Setting | Local | CI |
|---|---|---|
| `retries` | 0 | 2 |
| `workers` | auto (CPU cores) | 1 |
| `forbidOnly` | false | true |
| `reuseExistingServer` | true | false |
| Browser install | pre-installed | `playwright install --with-deps` |

### Running E2E in CI for All Browsers

```yaml
- run: npx playwright install --with-deps
- run: npm run test:e2e
  env:
    CI: true
    VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}

- uses: actions/upload-artifact@v4
  if: always() # Upload even on failure
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

---

## Examples

### Smoke Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Bistro Lens Smoke Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('homepage has correct title and mode toggle', async ({ page }) => {
    await expect(page).toHaveTitle(/Bistro Lens/);
    await expect(page.getByText('Bistro Lens')).toBeVisible();
    await expect(page.locator('text=Food')).toBeVisible();
  });

  test('can enter text in recipe prompt', async ({ page }) => {
    const promptInput = page.getByPlaceholder(/Ask the chef/i);
    await expect(promptInput).toBeVisible();
    await promptInput.fill('Spicy Tacos');
    await expect(promptInput).toHaveValue('Spicy Tacos');
  });
});
```

### Analytics Event Verification

```typescript
import { test, expect, Page } from '@playwright/test';

test.describe('Event-Driven Analytics Verification', () => {
  let consoleLogs: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[analytics_')) consoleLogs.push(text);
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('full flow: GENERATE -> SAVE -> COOK_START', async ({ page }) => {
    // Step 1: Generate
    const recipeInput = page.locator('textarea, input[type="text"]').first();
    if (await recipeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await recipeInput.fill('simple garlic bread');
      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(10000); // Wait for AI generation
      }
    }

    // Step 2: Favorite
    const heartBtn = page.locator('[aria-label*="favorite"]').first();
    if (await heartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await heartBtn.click();
      await page.waitForTimeout(2000);
    }

    // Step 3: Cook
    const cookBtn = page.locator('button:has-text("Cook")').first();
    if (await cookBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookBtn.click();
      await page.waitForTimeout(5000); // Wait for flush
    }

    // Assert at least one analytics event was tracked
    const trackLogs = consoleLogs.filter(log => log.includes('[analytics_track]'));
    expect(trackLogs.length).toBeGreaterThan(0);
  });
});
```

### SEO & CTA Flow

```typescript
import { test, expect, Page } from '@playwright/test';

const SLUG = '15-minute-chicken-dinners';

async function dismissModals(page: Page) {
  await page.waitForTimeout(500);
  const closeBtn = page.locator('[aria-label="Close"], button:has-text("Skip")');
  if (await closeBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.first().click();
  }
}

test('collection page has correct SEO meta tags', async ({ page }) => {
  await page.goto(`/collections/${SLUG}`);
  await page.waitForLoadState('networkidle');
  await dismissModals(page);

  const title = await page.title();
  expect(title).toContain('15-Minute Chicken Dinners');

  const metaDesc = await page
    .locator('meta[name="description"]')
    .getAttribute('content');
  expect(metaDesc).toBeTruthy();
});
```

### Planned E2E Flows (from TESTPLAN.md)

These flows are documented but not yet implemented as specs:

```typescript
// Recipe Generation & Cooking
test('should generate a recipe and navigate to cooking view', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Recipe prompt input').fill('Spicy vegetarian ramen');
  await page.getByRole('button', { name: 'Create Recipe' }).click();
  await page.getByRole('button', { name: "Let's Cook!" }).click();
  await expect(page.getByText('Step 1 of')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next Step' })).toBeVisible();
});

// Dark Mode Toggle
test('should toggle dark mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Profile and Settings' }).click();
  await page.getByRole('button', { name: 'Manage Preferences' }).click();
  await expect(page.locator('html')).not.toHaveClass('dark');
  await page.getByRole('switch', { name: 'Toggle Dark Mode' }).click();
  await expect(page.locator('html')).toHaveClass('dark');
});
```

---

## Anti-Patterns

### ❌ Don't Use `page.waitForTimeout` as Primary Wait Strategy

```typescript
// Bad: arbitrary waits are flaky
await page.waitForTimeout(5000);
await expect(element).toBeVisible();
```

```typescript
// Good: wait for specific conditions
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible({ timeout: 10000 });
```

### ❌ Don't Hardcode Absolute URLs in Tests

```typescript
// Bad: breaks when baseURL changes
await page.goto('http://localhost:5173/collections/slug');
```

```typescript
// Good: use relative paths with baseURL from config
await page.goto('/collections/slug');
```

### ❌ Don't Assert on Implementation Details

```typescript
// Bad: tests internal class names
await expect(page.locator('.recipe-card-v2-container')).toBeVisible();
```

```typescript
// Good: tests user-visible content
await expect(page.getByRole('article', { name: 'Spicy Tacos' })).toBeVisible();
```

### ❌ Don't Skip Error Handling in Conditional Interactions

```typescript
// Bad: throws if element not found
await page.locator('button:has-text("Cook")').click();
```

```typescript
// Good: gracefully handle optional elements
const cookBtn = page.locator('button:has-text("Cook")').first();
if (await cookBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await cookBtn.click();
}
```

### ❌ Don't Leave `test.only` in Code

```typescript
// Bad: blocks all other tests, fails CI (forbidOnly: true)
test.only('my test', async ({ page }) => { ... });
```

```typescript
// Good: use --grep flag to run specific tests locally
// npx playwright test --grep "my test"
```

### ❌ Don't Forget to Reset State Between Tests

```typescript
// Bad: consoleLogs accumulates across tests
let consoleLogs: string[] = [];
page.on('console', msg => consoleLogs.push(msg.text()));
```

```typescript
// Good: reset in beforeEach
test.beforeEach(async ({ page }) => {
  consoleLogs = []; // Reset
  page.on('console', msg => consoleLogs.push(msg.text()));
});
```

---

## When to Use This Pattern

✅ **Use E2E tests for:**
- Critical user journeys (generate recipe → cook → complete)
- Auth flows (login redirect, session persistence)
- SEO verification (meta tags, canonical URLs, OG tags)
- Analytics event verification (console log capture, network interception)
- Cross-browser compatibility checks
- PDF/export generation validation

❌ **Don't use E2E tests for:**
- Unit logic (use Jest/Vitest)
- Component rendering (use React Testing Library)
- API contract testing (use integration tests)
- Anything that can be tested faster at a lower level

---

## Benefits

1. Catches regressions that unit/integration tests miss (real browser behavior)
2. Verifies cross-browser compatibility with minimal extra effort (Playwright projects)
3. Tests analytics pipelines end-to-end via console log capture
4. Validates SEO meta tags that are dynamically injected
5. CI integration with artifact upload preserves test reports for debugging

---

## Related Patterns

- See `unit-testing.md` for Jest unit test patterns
- See `component-testing.md` for React Testing Library patterns
- See `integration-testing.md` for integration test patterns
- See `../16-deployment/deployment-config.md` for CI/CD pipeline configuration
- See `../03-auth-patterns/auth-helpers.md` for auth state management

---

*Extracted: 2026-02-18*
