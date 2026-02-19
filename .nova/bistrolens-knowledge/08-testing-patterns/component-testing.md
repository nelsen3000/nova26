# Component Testing Patterns

## Source
Extracted from BistroLens `components/PantryManager.test.tsx`, `components/PantryScannerModal.test.tsx`, `components/RecipeFinder.test.tsx`, `components/__tests__/HeroHeadline.test.tsx`, `components/RecipePDFLandscape/__tests__/RecipePDFLandscape.test.tsx`, `components/design-system/__tests__/components.property.test.tsx`, `components/navigation/__tests__/IntentNavigation.property.test.tsx`, `tests/RecipeCostBadge.test.tsx`, `tests/CostBreakdownPanel.test.tsx`.

---

## Overview

BistroLens tests React components with **React Testing Library (RTL)** and **Jest** in a `jsdom` environment. The philosophy is to test components the way users interact with them — querying by accessible roles, labels, and text rather than implementation details.

Component tests fall into three categories:
1. **Unit component tests** — render a component in isolation, assert on DOM output
2. **Property-based component tests** — use `fast-check` to verify invariants across many prop combinations
3. **Snapshot tests** — lock in rendered HTML structure to catch regressions

---

## Setup & Imports

### Standard imports for every component test file

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
// Always import Jest globals explicitly to avoid TypeScript "Cannot find name" errors
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
```

### Accessibility testing imports

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers once per file
expect.extend(toHaveNoViolations);
```

### Property-based testing imports

```typescript
import * as fc from 'fast-check';
```

---

## Rendering with Providers

Most BistroLens components consume `SettingsContext`. Wrap them in a provider for every test.

### Pattern: renderWithSettings helper

```typescript
// components/RecipeFinder.test.tsx
import { SettingsContext } from '../contexts';
import { AppSettings } from '../types';

const mockSettings: AppSettings = {
  fontSize: 'base',
  mode: 'food',
  theme: 'light',
  drinkPreference: 'Alcoholic',
  profile: { name: 'Test', dietaryPreferences: [], allergies: [], healthGoals: {} },
  pantry: [],
  voiceId: 'voice-uk-alistair',
  freezer: [],
  tasteProfile: { likes: [], dislikes: [] },
  challenges: {},
  tutorialMode: { level: 'beginner', focus: 'technique' },
  groceryList: [],
  defaultRecipeTone: 'Standard',
  defaultRecipeQualityFocus: 'Balanced',
  measurementSystem: 'Imperial',
  country: 'United States',
  defaultServings: 4,
  preparationStyle: 'From Scratch',
  soundEffects: false,
  keepScreenOn: false,
  recipeHistory: [],
  autoContribute: false,
};

const mockSetSettings = jest.fn();

// Reusable render helper
const renderWithSettings = (ui: React.ReactElement, settings = mockSettings) => {
  return render(
    <SettingsContext.Provider value={{ settings, setSettings: mockSetSettings }}>
      {ui}
    </SettingsContext.Provider>
  );
};
```

### Pattern: component-specific render helper

Define a dedicated render function per test file to keep tests DRY:

```typescript
// components/PantryManager.test.tsx
const renderPantryManager = () => {
  return render(
    <SettingsContext.Provider value={{ settings: mockAppSettings, setSettings: mockSetSettings }}>
      <PantryManager />
    </SettingsContext.Provider>
  );
};

// Usage in tests
it('should render without crashing', () => {
  renderPantryManager();
  expect(screen.getByText('Add to Pantry')).toBeInTheDocument();
});
```

### Pattern: render helper with window.innerWidth for responsive components

```typescript
// components/__tests__/HeroHeadline.test.tsx
const renderHero = (settings = defaultSettings, windowWidth = 1024) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: windowWidth,
  });
  window.dispatchEvent(new Event('resize'));

  return render(
    <SettingsContext.Provider value={{ settings, setSettings: jest.fn() }}>
      <Hero />
    </SettingsContext.Provider>
  );
};

// Test desktop vs mobile layout
it('renders desktop layout at 1200px', () => {
  const { container } = renderHero(defaultSettings, 1200);
  expect(container.querySelector('h1')).toBeInTheDocument();
});

it('renders mobile layout at 768px', () => {
  const { container } = renderHero(defaultSettings, 768);
  expect(container.querySelector('h1')).toBeInTheDocument();
});
```

---

## Querying Elements

RTL queries in order of preference (most accessible → least):

### By role (preferred)

```typescript
// Semantic HTML elements have implicit roles
screen.getByRole('button', { name: 'Add item to pantry' });
screen.getByRole('heading', { level: 1 });
screen.getByRole('textbox');
screen.getByRole('checkbox');
```

### By label text

```typescript
// Matches <label> text or aria-label
screen.getByLabelText('New pantry item name');
screen.getByLabelText('Take photo of pantry items');
screen.getByLabelText('Toggle selection for Milk');
```

### By text content

```typescript
screen.getByText('Add to Pantry');
screen.getByText(/What are you craving/i);  // regex for partial match
```

### By placeholder

```typescript
screen.getByPlaceholderText(/What are you craving/i);
```

### By alt text

```typescript
screen.getByAltText('Pantry preview');
```

### By test ID (last resort)

```typescript
screen.getByTestId('pantry-scanner-mock');
```

### Querying the container directly (for CSS class checks)

```typescript
const { container } = render(<RecipeCostBadge recipeCost={mockCost} />);

// Query by CSS selector
container.querySelector('h1');
container.querySelector('[data-page="1"]');
container.querySelector('.ds-card');
container.querySelectorAll('svg[class*="text-green-600"]');
```

### queryBy vs getBy

```typescript
// getBy throws if not found — use for elements that MUST exist
screen.getByText('Submit');

// queryBy returns null if not found — use for elements that may be absent
expect(screen.queryByText('Hidden Text')).not.toBeInTheDocument();
```

---

## User Interactions

### Firing events with fireEvent

```typescript
import { fireEvent } from '@testing-library/react';

// Click
fireEvent.click(screen.getByRole('button', { name: 'Add item to pantry' }));

// Type into input
const nameInput = screen.getByLabelText('New pantry item name');
fireEvent.change(nameInput, { target: { value: 'Rice' } });
expect(nameInput).toHaveValue('Rice');

// Submit form
fireEvent.submit(screen.getByRole('form'));
```

### Full interaction flow example

```typescript
// components/PantryManager.test.tsx
it('should allow adding new items manually with quantity', () => {
  renderPantryManager();

  const nameInput = screen.getByLabelText('New pantry item name');
  const quantityInput = screen.getByLabelText('New pantry item quantity');
  const addButton = screen.getByLabelText('Add item to pantry');

  fireEvent.change(nameInput, { target: { value: 'Rice' } });
  fireEvent.change(quantityInput, { target: { value: '500g' } });
  fireEvent.click(addButton);

  // Verify the state updater was called
  expect(mockSetSettings).toHaveBeenCalledWith(expect.any(Function));

  // Inspect the state update function's result
  const [updateFn] = (mockSetSettings as jest.Mock).mock.calls[0];
  const updatedSettings = updateFn(mockAppSettings);
  expect(updatedSettings.pantry).toContainEqual({
    name: 'Rice',
    quantity: '500g',
    purchaseDate: expect.any(String),
  });
});
```

### Verifying state updater functions

When a component calls `setSettings(prev => ...)`, you can't directly inspect the new state. Instead, call the updater function manually:

```typescript
expect(mockSetSettings).toHaveBeenCalledWith(expect.any(Function));

// Extract and invoke the updater
const [updateFn] = (mockSetSettings as jest.Mock).mock.calls[0];
const updatedSettings = updateFn(currentSettings);
expect(updatedSettings.pantry).toHaveLength(3);
```

---

## Async Testing

### waitFor — wait for DOM changes

```typescript
import { waitFor } from '@testing-library/react';

it('should analyze photo and show results', async () => {
  renderPantryScannerModal();

  fireEvent.click(screen.getByLabelText('Take photo of pantry items'));
  fireEvent.click(screen.getByRole('button', { name: 'Use Photo' }));

  // Wait for async state update
  await waitFor(() => {
    expect(screen.getByText('Review and edit identified ingredients:')).toBeInTheDocument();
  });
});
```

### Testing camera/media APIs

```typescript
// Mock navigator.mediaDevices before tests
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() =>
      Promise.resolve({
        getTracks: () => [{ stop: jest.fn() }],
      } as MediaStream)
    ),
  },
});

it('should start camera on mount', async () => {
  renderPantryScannerModal();
  await waitFor(() => {
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
    });
  });
});

it('should show error if camera access is denied', async () => {
  (navigator.mediaDevices.getUserMedia as jest.Mock).mockImplementationOnce(() =>
    Promise.reject(new Error('Permission denied'))
  );
  renderPantryScannerModal();
  await waitFor(() => {
    expect(
      screen.getByText('Could not access the camera. Please check permissions and try again.')
    ).toBeInTheDocument();
  });
});
```

### Testing with fake timers

```typescript
describe('HeroHeadline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rotates words on interval', () => {
    renderHero();
    // Advance timers to trigger rotation
    jest.advanceTimersByTime(3000);
    // Assert new word is visible
  });
});
```

---

## Snapshot Testing

Snapshots lock in the rendered HTML structure. Use them for layout-critical components where visual regressions matter.

### Creating snapshots

```typescript
// components/__tests__/HeroHeadline.test.tsx
it('matches desktop snapshot', () => {
  const { container } = renderHero(defaultSettings, 1200);
  const h1 = container.querySelector('h1');
  expect(h1).toMatchSnapshot();
});

it('matches mobile snapshot', () => {
  const { container } = renderHero(defaultSettings, 768);
  const h1 = container.querySelector('h1');
  expect(h1).toMatchSnapshot();
});
```

### When to use snapshots

✅ Use for:
- Layout components where structure must not regress (hero sections, PDF layouts)
- Responsive breakpoint differences (desktop vs mobile)
- Components with complex inline styles

❌ Avoid for:
- Components with dynamic content (timestamps, random IDs)
- Components that change frequently during development
- Testing behavior — snapshots only catch structure changes

### Updating snapshots

```bash
jest --updateSnapshot
# or
jest -u
```

---

## Accessibility Testing

BistroLens uses `jest-axe` to run automated WCAG checks as part of unit tests.

### Setup

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);
```

### Running an axe audit

```typescript
it('should render without crashing and pass accessibility audit', async () => {
  const { container } = renderPantryManager();
  expect(screen.getByText('Add to Pantry')).toBeInTheDocument();

  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Checking ARIA attributes manually

```typescript
it('shows loading state correctly', () => {
  render(<Button loading>Test</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(button).toBeDisabled();
});

it('interactive card is keyboard accessible', () => {
  render(<Card interactive onClick={jest.fn()}>Test</Card>);
  const card = document.querySelector('.ds-card');
  expect(card).toHaveAttribute('role', 'button');
  expect(card).toHaveAttribute('tabIndex', '0');
});
```

### Checking color contrast classes

```typescript
// Verify text/background combinations provide sufficient contrast
it('should have proper color contrast for different cost levels', () => {
  const costs = [
    { cost: 2.50, expectedBg: 'bg-green-50', expectedText: 'text-green-700' },
    { cost: 5.00, expectedBg: 'bg-blue-50',  expectedText: 'text-blue-700' },
    { cost: 12.00, expectedBg: 'bg-yellow-50', expectedText: 'text-yellow-700' },
    { cost: 20.00, expectedBg: 'bg-purple-50', expectedText: 'text-purple-700' },
  ];

  costs.forEach(({ cost, expectedBg, expectedText }) => {
    const testCost = { ...mockRecipeCost, costPerServing: cost };
    const { container } = render(<RecipeCostBadge recipeCost={testCost} />);
    expect(container.firstChild).toHaveClass(expectedBg, expectedText);
  });
});
```

---

## Mocking Child Components

Isolate the component under test by replacing complex children with simple stubs.

### Pattern: mock with __esModule and default export

```typescript
// components/PantryManager.test.tsx
jest.mock('./PantryScannerModal', () => ({
  __esModule: true,
  default: jest.fn(({ onClose, onAddItems, existingPantry }) => (
    <Modal title="Mock Pantry Scanner" onClose={onClose}>
      <div data-testid="pantry-scanner-mock">
        Mock Scanner Content
        <button
          onClick={() => onAddItems([
            { name: 'Milk', suggestedQuantity: '1 liter' },
            { name: 'Eggs', suggestedQuantity: '6 large' },
          ])}
        >
          Add Scanned Items
        </button>
        {/* Expose props for assertion */}
        <span data-existing-pantry={JSON.stringify(existingPantry)} />
      </div>
    </Modal>
  )),
}));
```

### Pattern: mock framer-motion to avoid animation issues

```typescript
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      button: React.forwardRef(({ children, whileHover, whileTap, transition, ...props }: any, ref: any) =>
        React.createElement('button', { ref, ...props }, children)
      ),
      div: React.forwardRef(({ children, whileHover, whileTap, transition, ...props }: any, ref: any) =>
        React.createElement('div', { ref, ...props }, children)
      ),
      span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});
```

### Pattern: mock a hook

```typescript
jest.mock('../hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    isSupported: true,
    startListening: jest.fn(),
    stopListening: jest.fn(),
    toggleListening: jest.fn(),
  }),
}));
```

### Pattern: mock a service

```typescript
jest.mock('../services/geminiService', () => ({
  generateRecipe: jest.fn(() =>
    Promise.resolve({
      title: 'Mock Recipe',
      description: 'Mock Description',
      steps: [],
      ingredientGroups: [],
      nutrition: { calories: '100', protein: '10g', carbs: '10g', fat: '2g' },
      kitchenTools: [],
    })
  ),
}));
```

---

## Property-Based Component Tests

Use `fast-check` to verify that component invariants hold across many prop combinations.

### Pattern: property test for all variants

```typescript
// components/design-system/__tests__/components.property.test.tsx
import * as fc from 'fast-check';
import { ALLOWED_BUTTON_VARIANTS, type ButtonVariant } from '../tokens';

it('any button variant renders successfully', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...ALLOWED_BUTTON_VARIANTS),
      fc.constantFrom('sm', 'md', 'lg') as fc.Arbitrary<'sm' | 'md' | 'lg'>,
      (variant: ButtonVariant, size) => {
        const { container } = render(
          <Button variant={variant} size={size}>Test</Button>
        );
        return container.querySelector('.ds-button') !== null;
      }
    ),
    { numRuns: 50 }
  );
});
```

### Pattern: property test for style invariants

```typescript
it('button always meets touch target regardless of size', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('sm', 'md', 'lg') as fc.Arbitrary<'sm' | 'md' | 'lg'>,
      (size) => {
        const { container } = render(<Button size={size}>Test</Button>);
        const button = container.querySelector('.ds-button');
        const style = button?.getAttribute('style') || '';
        return style.includes('min-height: 44px') && style.includes('min-width: 44px');
      }
    ),
    { numRuns: 30 }
  );
});
```

### Pattern: property test with complex data generation

```typescript
// tests/CostBreakdownPanel.test.tsx
it('should correctly identify most expensive ingredients (top 20%)', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          price: fc.float({ min: Math.fround(0.01), max: Math.fround(50), noNaN: true }),
        }),
        { minLength: 5, maxLength: 20 }
      ),
      (ingredientData) => {
        const ingredients = ingredientData.map((data, index) =>
          createMockIngredient({
            ingredient: `ingredient-${index}`,
            displayName: `Ingredient ${index}`,
            totalPrice: data.price,
          })
        );

        const recipeCost = createMockRecipeCost({ ingredients });
        const { container } = render(<CostBreakdownPanel recipeCost={recipeCost} />);

        const expensiveThreshold = Math.ceil(ingredients.length * 0.2);
        const expensiveBadges = Array.from(
          container.querySelectorAll('.bg-red-100.text-red-800')
        ).filter(badge => badge.textContent === 'Most Expensive');

        expect(expensiveBadges).toHaveLength(expensiveThreshold);
      }
    ),
    { numRuns: 100 }
  );
});
```

---

## Examples

### Full component test: PantryManager

```typescript
// components/PantryManager.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import PantryManager from './PantryManager';
import { SettingsContext } from '../contexts';
import { AppSettings, PantryItem } from '../types';

expect.extend(toHaveNoViolations);

const mockPantryItems: PantryItem[] = [
  { name: 'Flour', quantity: '2 cups', purchaseDate: '2024-01-01' },
  { name: 'Sugar', quantity: '1 kg', purchaseDate: '2024-01-05' },
];

const mockAppSettings: AppSettings = {
  fontSize: 'base',
  mode: 'food',
  theme: 'light',
  drinkPreference: 'Alcoholic',
  profile: { name: 'Test User', dietaryPreferences: [], allergies: [], healthGoals: {} },
  pantry: mockPantryItems,
  voiceId: 'en-US-Standard-E',
  freezer: [],
  tasteProfile: { likes: [], dislikes: [] },
  challenges: {},
  tutorialMode: { level: 'beginner', focus: 'technique' },
  groceryList: [],
  defaultRecipeTone: 'Standard',
  defaultRecipeQualityFocus: 'Balanced',
  measurementSystem: 'Imperial',
  country: 'United States',
  defaultServings: 4,
  preparationStyle: 'From Scratch',
};

const mockSetSettings = jest.fn();

const renderPantryManager = () =>
  render(
    <SettingsContext.Provider value={{ settings: mockAppSettings, setSettings: mockSetSettings }}>
      <PantryManager />
    </SettingsContext.Provider>
  );

describe('PantryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing and pass accessibility audit', async () => {
    const { container } = renderPantryManager();
    expect(screen.getByText('Add to Pantry')).toBeInTheDocument();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should display existing pantry items with quantities', () => {
    renderPantryManager();
    expect(screen.getByText('2 cups Flour')).toBeInTheDocument();
    expect(screen.getByText('1 kg Sugar')).toBeInTheDocument();
  });

  it('should allow adding new items manually with quantity', () => {
    renderPantryManager();
    fireEvent.change(screen.getByLabelText('New pantry item name'), { target: { value: 'Rice' } });
    fireEvent.change(screen.getByLabelText('New pantry item quantity'), { target: { value: '500g' } });
    fireEvent.click(screen.getByLabelText('Add item to pantry'));

    const [updateFn] = (mockSetSettings as jest.Mock).mock.calls[0];
    const updatedSettings = updateFn(mockAppSettings);
    expect(updatedSettings.pantry).toContainEqual({
      name: 'Rice',
      quantity: '500g',
      purchaseDate: expect.any(String),
    });
  });

  it('should allow removing an item', () => {
    renderPantryManager();
    fireEvent.click(screen.getByLabelText('Remove Flour from pantry'));

    const [updateFn] = (mockSetSettings as jest.Mock).mock.calls[0];
    const updatedSettings = updateFn(mockAppSettings);
    expect(updatedSettings.pantry).not.toContainEqual(mockPantryItems[0]);
    expect(updatedSettings.pantry).toHaveLength(1);
  });
});
```

### Full component test: RecipeCostBadge (no context needed)

```typescript
// tests/RecipeCostBadge.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecipeCostBadge } from '../components/RecipeCostBadge';
import { RecipeCost } from '../services/pricingService';

const mockRecipeCost: RecipeCost = {
  recipeId: 'test-recipe-123',
  totalCost: 12.50,
  costPerServing: 3.13,
  servings: 4,
  currency: 'USD',
  confidence: 'high',
  ingredients: [],
  pantryDiscount: 0,
  outOfPocketCost: 12.50,
  calculatedAt: new Date(),
  priceRange: { min: 2.80, max: 3.50 },
};

describe('RecipeCostBadge', () => {
  it('should render cost per serving correctly', () => {
    render(<RecipeCostBadge recipeCost={mockRecipeCost} />);
    expect(screen.getByText('$3.13')).toBeInTheDocument();
    expect(screen.getByText('per serving')).toBeInTheDocument();
  });

  it('should render without crashing when no cost data provided', () => {
    render(<RecipeCostBadge />);
    expect(screen.getByText('Cost not available')).toBeInTheDocument();
  });

  it('should display loading state correctly', () => {
    render(<RecipeCostBadge isLoading={true} />);
    expect(screen.getByText('Calculating...')).toBeInTheDocument();
  });

  it('should apply green styling for budget-friendly costs (≤$3)', () => {
    const { container } = render(
      <RecipeCostBadge recipeCost={{ ...mockRecipeCost, costPerServing: 2.50 }} />
    );
    expect(container.firstChild).toHaveClass('bg-green-50', 'text-green-700', 'border-green-200');
  });

  it('should handle zero cost gracefully', () => {
    render(<RecipeCostBadge recipeCost={{ ...mockRecipeCost, costPerServing: 0 }} />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});
```

---

## Anti-Patterns

### ❌ Don't query by implementation details

```typescript
// Bad: brittle, breaks on refactor
const button = container.querySelector('button.primary-btn.submit');
```

### ✅ Query by accessible role or label

```typescript
// Good: resilient to CSS class changes
const button = screen.getByRole('button', { name: 'Submit' });
```

---

### ❌ Don't forget to clear mocks between tests

```typescript
// Bad: mock call counts bleed between tests
describe('MyComponent', () => {
  it('test 1', () => { ... });
  it('test 2', () => {
    // mockSetSettings.mock.calls[0] may include calls from test 1!
  });
});
```

### ✅ Clear mocks in beforeEach

```typescript
// Good
beforeEach(() => {
  jest.clearAllMocks();
});
```

---

### ❌ Don't access .mock without casting

```typescript
// Bad: TypeScript error — Property 'mock' does not exist
const [updateFn] = mockSetSettings.mock.calls[0];
```

### ✅ Cast to jest.Mock first

```typescript
// Good
const [updateFn] = (mockSetSettings as jest.Mock).mock.calls[0];
```

---

### ❌ Don't test third-party library internals

```typescript
// Bad: testing framer-motion's animation behavior
expect(motionDiv).toHaveStyle({ opacity: 0 });
```

### ✅ Mock the library and test your component's behavior

```typescript
// Good: mock framer-motion, test your component's output
jest.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

it('renders content when visible', () => {
  render(<AnimatedPanel visible={true} />);
  expect(screen.getByText('Panel Content')).toBeInTheDocument();
});
```

---

### ❌ Don't use snapshots for frequently-changing components

```typescript
// Bad: snapshot breaks every time copy changes
it('matches snapshot', () => {
  render(<MarketingBanner />);
  expect(document.body).toMatchSnapshot();
});
```

### ✅ Use snapshots only for stable layout structures

```typescript
// Good: snapshot of a structural element that rarely changes
it('matches desktop headline snapshot', () => {
  const { container } = renderHero(defaultSettings, 1200);
  expect(container.querySelector('h1')).toMatchSnapshot();
});
```

---

## Related Patterns

- See `unit-testing.md` for utility function testing and Jest configuration
- See `integration-testing.md` for multi-component integration tests
- See `e2e-testing.md` for Playwright browser tests
- See `test-utilities.md` for shared test helpers
- See `../15-accessibility/aria-patterns.md` for ARIA attribute patterns used in components

## When to Use

- When testing any React component rendered in the browser (unit or integration level)
- When verifying accessible markup, ARIA attributes, and keyboard navigation
- When testing responsive layouts across different viewport widths
- When using property-based testing to verify component invariants across many prop combinations

## Benefits

- Testing by accessible role and label ensures components remain usable by assistive technology
- Property-based tests catch edge cases that hand-written test cases miss
- Snapshot tests lock in layout-critical structures to catch visual regressions
- `jest-axe` integration catches WCAG violations as part of the standard test suite

---

*Extracted: 2026-02-18*
