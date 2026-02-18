# Nova26 Accessibility Rules

## Adapted from BistroLens WCAG Compliance

**Source:** BistroLens `50-ACCESSIBILITY-WCAG-COMPLIANCE.md`  
**Category:** Accessibility & Design System  
**Priority:** P2  
**Reusability:** 9/10

---

## Overview

BistroLens targets WCAG 2.1 Level AA with:
- Color contrast requirements
- Keyboard navigation rules
- Screen reader support
- Semantic HTML requirements
- Focus management

Nova26's `visual-validator.ts` can be enhanced with these patterns.

---

## Contrast Requirements

```typescript
// src/accessibility/contrast.ts

export const CONTRAST_REQUIREMENTS = {
  // WCAG AA minimums
  normalText: 4.5,      // 4.5:1 ratio
  largeText: 3.0,       // 3:1 ratio (18pt+ or 14pt bold)
  uiComponents: 3.0,    // 3:1 ratio for interactive elements
  
  // Large text definition
  largeTextSize: 18,    // 18px or larger
  largeBoldSize: 14,    // 14px bold or larger
};

// Tailwind colors with guaranteed contrast
export const ACCESSIBLE_COLOR_PAIRS = {
  primary: {
    bg: 'bg-indigo-600',
    fg: 'text-white',
    ratio: 7.2,
  },
  secondary: {
    bg: 'bg-gray-200',
    fg: 'text-gray-900',
    ratio: 11.2,
  },
  success: {
    bg: 'bg-green-600',
    fg: 'text-white',
    ratio: 5.8,
  },
  error: {
    bg: 'bg-red-600',
    fg: 'text-white',
    ratio: 5.9,
  },
  warning: {
    bg: 'bg-yellow-500',
    fg: 'text-gray-900',
    ratio: 8.0,
  },
};
```

---

## Visual Validator Enhancements

```typescript
// src/browser/visual-validator.ts - Enhanced checks

interface A11yViolation {
  rule: string;
  element: string;
  file: string;
  line: number;
  severity: 'error' | 'warning';
  fix: string;
}

const A11Y_CHECKS = {
  // 1. Confidence indicators for AI output
  'confidence-indicator': {
    applies: (code: string) => code.includes('AI') || code.includes('generated'),
    check: (code: string) => 
      code.includes('confidence') || 
      code.includes('score') ||
      code.includes('certainty'),
    fix: 'Add confidence score display for AI-generated content',
    weight: 5,
  },
  
  // 2. Undo/rollback controls
  'undo-control': {
    applies: (code: string) => code.includes('mutation') || code.includes('delete'),
    check: (code: string) => 
      code.includes('undo') || 
      code.includes('rollback') ||
      code.includes('onRevert'),
    fix: 'Add undo button for destructive operations',
    weight: 5,
  },
  
  // 3. Feedback widgets
  'feedback-widget': {
    applies: (code: string) => code.includes('AI') || code.includes('suggestion'),
    check: (code: string) => 
      code.includes('thumbs') || 
      code.includes('feedback') ||
      code.includes('helpful'),
    fix: 'Add thumbs up/down feedback for AI outputs',
    weight: 5,
  },
  
  // 4. Explainability affordances
  'explainability': {
    applies: (code: string) => code.includes('AI') || code.includes('recommendation'),
    check: (code: string) => 
      code.includes('why') || 
      code.includes('explanation') ||
      code.includes('Tooltip'),
    fix: 'Add "Why?" tooltip or info button for AI decisions',
    weight: 5,
  },
  
  // 5. Confirmation dialogs
  'confirmation-dialog': {
    applies: (code: string) => 
      code.includes('delete') || 
      code.includes('remove') ||
      code.includes('danger'),
    check: (code: string) => 
      code.includes('confirm') || 
      code.includes('AlertDialog') ||
      code.includes('Confirmation'),
    fix: 'Add confirmation dialog before destructive actions',
    weight: 5,
  },
  
  // 6. Keyboard navigation
  'keyboard-navigation': {
    applies: (code: string) => /onClick|onPress/.test(code),
    check: (code: string) => 
      code.includes('onKeyDown') || 
      code.includes('onKeyPress') ||
      code.includes('tabIndex'),
    fix: 'Add keyboard handlers (onKeyDown, tabIndex) for interactive elements',
    weight: 10,
  },
  
  // 7. ARIA live regions
  'aria-live': {
    applies: (code: string) => 
      code.includes('loading') || 
      code.includes('streaming') ||
      /\{[^}]*\}/.test(code),
    check: (code: string) => code.includes('aria-live'),
    fix: 'Add aria-live="polite" for dynamic content',
    weight: 5,
  },
  
  // 8. Color contrast
  'color-contrast': {
    applies: (code: string) => 
      code.includes('text-') && code.includes('bg-'),
    check: (code: string) => {
      // Check for low-contrast combinations
      const dangerous = [
        /text-gray-300.*bg-white/,
        /text-gray-400.*bg-gray-100/,
        /text-white.*bg-yellow-300/,
      ];
      return !dangerous.some(pattern => pattern.test(code));
    },
    fix: 'Use accessible color combinations from design system',
    weight: 10,
  },
  
  // 9. i18n readiness
  'i18n-ready': {
    applies: (code: string) => code.includes('>') && code.includes('<'),
    check: (code: string) => {
      // Look for hardcoded strings that should be i18n keys
      const matches = code.match(/>[A-Z][a-z]{2,}</g);
      return !matches || matches.length === 0;
    },
    fix: 'Use i18n keys instead of hardcoded strings',
    weight: 3,
  },
  
  // 10. Progressive disclosure
  'progressive-disclosure': {
    applies: (code: string) => code.length > 500,
    check: (code: string) => 
      code.includes('Accordion') || 
      code.includes('details') ||
      code.includes('Collapsible'),
    fix: 'Consider using Accordion for long content sections',
    weight: 3,
  },
  
  // 11. Semantic HTML
  'semantic-html': {
    applies: (code: string) => code.includes('function') || code.includes('=>'),
    check: (code: string) => 
      code.includes('<main') || 
      code.includes('<nav') ||
      code.includes('<header') ||
      code.includes('<footer') ||
      code.includes('<section'),
    fix: 'Use semantic elements (main, nav, header, footer, section)',
    weight: 5,
  },
  
  // 12. Focus management
  'focus-management': {
    applies: (code: string) => 
      code.includes('Dialog') || code.includes('Modal'),
    check: (code: string) => 
      code.includes('autoFocus') || 
      code.includes('FocusTrap') ||
      code.includes('initialFocus'),
    fix: 'Add focus trap and initialFocus for modals',
    weight: 10,
  },
};

export function runA11yChecks(code: string, filePath: string): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const lines = code.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const [ruleName, rule] of Object.entries(A11Y_CHECKS)) {
      if (rule.applies(line) && !rule.check(line)) {
        violations.push({
          rule: ruleName,
          element: line.trim().slice(0, 50),
          file: filePath,
          line: i + 1,
          severity: rule.weight >= 10 ? 'error' : 'warning',
          fix: rule.fix,
        });
      }
    }
  }
  
  return violations;
}
```

---

## Keyboard Navigation Requirements

```typescript
// src/accessibility/keyboard-requirements.ts

export const KEYBOARD_REQUIREMENTS = {
  buttons: {
    activation: ['Enter', 'Space'],
    focusable: true,
    visualFocus: 'ring-2 ring-indigo-500 ring-offset-2',
  },
  
  links: {
    activation: ['Enter'],
    focusable: true,
    skipLink: true,  // Provide skip to main content
  },
  
  menus: {
    open: ['Enter', 'Space', 'ArrowDown'],
    navigate: ['ArrowUp', 'ArrowDown'],
    select: ['Enter'],
    close: ['Escape'],
  },
  
  modals: {
    close: ['Escape'],
    trapFocus: true,
    returnFocusOnClose: true,
  },
  
  sliders: {
    increase: ['ArrowRight', 'ArrowUp'],
    decrease: ['ArrowLeft', 'ArrowDown'],
  },
};

export function validateKeyboardAccessibility(
  code: string,
  componentType: string
): string[] {
  const issues: string[] = [];
  const requirements = KEYBOARD_REQUIREMENTS[componentType as keyof typeof KEYBOARD_REQUIREMENTS];
  
  if (!requirements) return issues;
  
  if (requirements.trapFocus && !code.includes('FocusTrap')) {
    issues.push(`Add FocusTrap for ${componentType}`);
  }
  
  if (requirements.close?.includes('Escape') && !code.includes('Escape')) {
    issues.push('Add Escape key handler for closing');
  }
  
  return issues;
}
```

---

## Screen Reader Support

```typescript
// src/accessibility/screen-reader.ts

export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

export const ARIA_PATTERNS = {
  // Loading states
  loading: {
    'aria-busy': 'true',
    'aria-label': 'Loading...',
  },
  
  // Error states
  error: {
    role: 'alert',
    'aria-live': 'assertive',
  },
  
  // Success states
  success: {
    role: 'status',
    'aria-live': 'polite',
  },
  
  // Required form fields
  required: {
    'aria-required': 'true',
  },
  
  // Invalid input
  invalid: {
    'aria-invalid': 'true',
  },
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/browser/visual-validator.ts` | Add 12 new a11y checks |
| `src/accessibility/contrast.ts` | New - color contrast utilities |
| `src/accessibility/keyboard-requirements.ts` | New - keyboard patterns |
| `src/accessibility/screen-reader.ts` | New - screen reader utilities |
| `.nova/agents/VENUS.md` | Add a11y requirements |
| `.nova/config/hard-limits.json` | Add a11y-related hard limits |

---

## Hard Limits Addition

```json
{
  "hardLimits": {
    "NO_DIV_BUTTON": {
      "severity": "error",
      "message": "Interactive elements must use <button> not <div onClick>"
    },
    "REQUIRE_ARIA_LIVE": {
      "severity": "warning",
      "message": "Dynamic content sections should have aria-live"
    },
    "REQUIRE_SEMANTIC_HTML": {
      "severity": "warning", 
      "message": "Page-level layouts should use semantic elements"
    },
    "REQUIRE_FOCUS_MANAGEMENT": {
      "severity": "error",
      "message": "Modals must trap focus"
    }
  }
}
```

---

*Adapted from BistroLens WCAG compliance rules*
*For Nova26 accessibility requirements*
