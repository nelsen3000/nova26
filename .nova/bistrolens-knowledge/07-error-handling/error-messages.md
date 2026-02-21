# Error Messages

## Source
Extracted from BistroLens `.kiro/steering/48-ERROR-HANDLING-UX.md` and `services/recaptchaService.ts`

---

## Pattern: User-Friendly Error Messages

Error messages should be clear, actionable, and never blame the user. They should use plain language, provide context, and offer a path forward.

---

## Core Principles

### Error Message Philosophy

```typescript
const ERROR_PRINCIPLES = {
  // User-first
  neverBlameUser: true,         // "Something went wrong" not "You did something wrong"
  alwaysProvideAction: true,    // Give users a next step
  useHumanLanguage: true,       // No technical jargon
  
  // Transparency
  honestAboutIssue: true,       // Don't hide problems
  setExpectations: true,        // Tell them what to expect
  
  // Recovery
  preserveUserWork: true,       // Never lose user data
  offerAlternatives: true,      // Suggest other options
};
```

**Key Principles:**
- Use contractions ("We're" not "We are")
- Use active voice ("Try again" not "The action can be retried")
- Avoid technical terms ("Something went wrong" not "500 Internal Server Error")
- Always provide an action button
- Maximum 2 action buttons (primary + secondary)

---

## Error Message Structure

### Message Template Type

```typescript
interface ErrorMessage {
  title: string;              // Max 30 characters
  message: string;            // Max 100 characters
  action: {
    label: string;
    handler: string;
  };
  secondary?: {
    label: string;
    handler: string;
  };
  icon: string;
}
```

### Configuration Guidelines

```typescript
const MESSAGE_GUIDELINES = {
  // Length
  titleMaxLength: 30,
  messageMaxLength: 100,
  
  // Tone
  useContractions: true,        // "We're" not "We are"
  useActiveVoice: true,         // "Try again" not "The action can be retried"
  avoidTechnicalTerms: true,    // "Something went wrong" not "500 Internal Server Error"
  
  // Structure
  alwaysHaveAction: true,
  maxActions: 2,
  primaryActionFirst: true,
};
```

---

## Error Categories & Messages

### Network Errors

```typescript
const NETWORK_ERRORS = {
  offline: {
    title: "You're offline",
    message: "Check your internet connection and try again.",
    action: { label: "Retry", handler: 'retry' },
    icon: 'wifi-off',
  },
  
  timeout: {
    title: "Taking too long",
    message: "This is taking longer than expected. Want to try again?",
    action: { label: "Try Again", handler: 'retry' },
    secondary: { label: "Cancel", handler: 'cancel' },
    icon: 'clock',
  },
  
  serverError: {
    title: "Something went wrong",
    message: "We're having some technical difficulties. Please try again in a moment.",
    action: { label: "Try Again", handler: 'retry' },
    icon: 'alert-circle',
  },
};
```

### Authentication Errors

```typescript
const AUTH_ERRORS = {
  sessionExpired: {
    title: "Session expired",
    message: "Please sign in again to continue.",
    action: { label: "Sign In", handler: 'login' },
    icon: 'log-in',
  },
  
  unauthorized: {
    title: "Sign in required",
    message: "You need to sign in to access this.",
    action: { label: "Sign In", handler: 'login' },
    icon: 'lock',
  },
  
  forbidden: {
    title: "Access denied",
    message: "You don't have permission to access this.",
    action: { label: "Go Back", handler: 'back' },
    icon: 'shield-off',
  },
};
```

### Validation Errors

```typescript
const VALIDATION_ERRORS = {
  invalidInput: {
    title: "Check your input",
    message: "Some information doesn't look right. Please review and try again.",
    action: { label: "OK", handler: 'dismiss' },
    icon: 'alert-triangle',
  },
  
  missingRequired: {
    title: "Missing information",
    message: "Please fill in all required fields.",
    action: { label: "OK", handler: 'dismiss' },
    icon: 'info',
  },
  
  formatError: {
    title: "Format error",
    message: "The format doesn't look right. Please check and try again.",
    action: { label: "OK", handler: 'dismiss' },
    icon: 'alert-circle',
  },
};
```

### Business Logic Errors

```typescript
const BUSINESS_ERRORS = {
  dailyLimitReached: {
    title: "Daily limit reached",
    message: "You've used all your recipes for today. Come back tomorrow or upgrade for more!",
    action: { label: "See Plans", handler: 'upgrade' },
    secondary: { label: "View Saved Recipes", handler: 'savedRecipes' },
    icon: 'zap',
  },
  
  featureUnavailable: {
    title: "Feature unavailable",
    message: "This feature isn't available right now. Try again later.",
    action: { label: "OK", handler: 'dismiss' },
    icon: 'info',
  },
  
  subscriptionRequired: {
    title: "Upgrade required",
    message: "This feature requires a subscription.",
    action: { label: "See Plans", handler: 'upgrade' },
    secondary: { label: "Maybe Later", handler: 'dismiss' },
    icon: 'star',
  },
};
```

### AI/Generation Errors

```typescript
const GENERATION_ERRORS = {
  generationFailed: {
    title: "Couldn't create that",
    message: "We had trouble generating your recipe. Try a different request?",
    action: { label: "Try Again", handler: 'retry' },
    secondary: { label: "Browse Recipes", handler: 'browse' },
    icon: 'refresh-cw',
  },
  
  contentFiltered: {
    title: "Can't create that",
    message: "We couldn't create that content. Try a different request.",
    action: { label: "New Request", handler: 'clear' },
    icon: 'shield',
  },
  
  generationTimeout: {
    title: "Generation timed out",
    message: "This is taking too long. Want to try a simpler request?",
    action: { label: "Try Again", handler: 'retry' },
    secondary: { label: "Cancel", handler: 'cancel' },
    icon: 'clock',
  },
};
```

---

## Real-World Implementation

### Example: reCAPTCHA Error Messages

From `services/recaptchaService.ts`:

```typescript
/**
 * Get user-friendly error messages for reCAPTCHA error codes
 */
export const getRecaptchaErrorMessage = (errorCodes?: string[]): string => {
  if (!errorCodes || errorCodes.length === 0) {
    return 'reCAPTCHA verification failed. Please try again.';
  }

  const errorMessages: Record<string, string> = {
    'missing-input-secret': 'Server configuration error. Please contact support.',
    'invalid-input-secret': 'Server configuration error. Please contact support.',
    'missing-input-response': 'Please complete the reCAPTCHA challenge.',
    'invalid-input-response': 'reCAPTCHA verification failed. Please try again.',
    'bad-request': 'Invalid request. Please refresh the page and try again.',
    'timeout-or-duplicate': 'reCAPTCHA has expired. Please try again.',
    'network-error': 'Network error. Please check your connection and try again.',
    'missing-secret-key': 'Server configuration error. Please contact support.'
  };

  // Return the first known error message, or a generic one
  for (const code of errorCodes) {
    if (errorMessages[code]) {
      return errorMessages[code];
    }
  }

  return 'reCAPTCHA verification failed. Please try again.';
};
```

**Key Features:**
- Maps technical error codes to user-friendly messages
- Provides fallback for unknown errors
- Distinguishes between user errors and system errors
- Gives actionable guidance ("Please complete the reCAPTCHA challenge")

---

## Error Message Patterns

### Pattern 1: Network Error with Retry

```typescript
// Service layer error handling
async function fetchData() {
  try {
    const response = await api.getData();
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes('network')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw error;
  }
}

// UI layer
try {
  await fetchData();
} catch (error) {
  showError({
    title: "Connection problem",
    message: error.message,
    action: { label: "Retry", handler: () => fetchData() }
  });
}
```

### Pattern 2: Rate Limit Error with Upgrade Path

```typescript
async function generateRecipe(prompt: string) {
  try {
    const result = await api.generate(prompt);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rate limit')) {
      throw new Error('You\'ve reached your usage limit. Please try again later or upgrade your plan.');
    }
    throw error;
  }
}

// UI layer
try {
  await generateRecipe(prompt);
} catch (error) {
  if (error.message.includes('usage limit')) {
    showError({
      title: "Daily limit reached",
      message: error.message,
      action: { label: "See Plans", handler: () => navigate('/pricing') },
      secondary: { label: "View Saved", handler: () => navigate('/saved') }
    });
  }
}
```

### Pattern 3: Geolocation Error with Fallback

From `services/locationService.ts`:

```typescript
// Handle geolocation errors with user-friendly messages
navigator.geolocation.getCurrentPosition(
  (position) => {
    // Success handler
  },
  (error) => {
    let errorMessage = 'Geolocation failed';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Geolocation permission denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Position unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Geolocation timeout';
        break;
    }
    
    resolve({
      success: false,
      error: errorMessage,
      source: 'geolocation'
    });
  }
);
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// BAD: Technical jargon
throw new Error('HTTP 500: Internal Server Error');

// BAD: Blaming the user
throw new Error('You entered invalid data');

// BAD: No action provided
showError('Something went wrong');

// BAD: Vague message
throw new Error('Error occurred');

// BAD: Too technical
throw new Error('Failed to parse JSON response from API endpoint');
```

### ✅ Do This Instead

```typescript
// GOOD: User-friendly language
throw new Error('We\'re having some technical difficulties. Please try again in a moment.');

// GOOD: Neutral tone
throw new Error('Please check your input and try again.');

// GOOD: Action provided
showError({
  title: "Something went wrong",
  message: "We couldn't save your changes.",
  action: { label: "Try Again", handler: retry }
});

// GOOD: Specific and clear
throw new Error('We couldn\'t save your recipe. Please try again.');

// GOOD: Simple explanation
throw new Error('We couldn\'t load that data. Please check your connection.');
```

---

## Error Message Helpers

### Generic Error Extractor

```typescript
/**
 * Extract user-friendly error message from any error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

// Usage in catch blocks
try {
  await operation();
} catch (error) {
  const errorMessage = getErrorMessage(error);
  showError(errorMessage);
}
```

### Error Message Formatter

```typescript
/**
 * Format error messages consistently
 */
function formatErrorMessage(
  operation: string,
  error: unknown
): string {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return `${operation} failed: ${errorMessage}`;
}

// Usage
try {
  await saveRecipe(recipe);
} catch (error) {
  const message = formatErrorMessage('Save', error);
  // "Save failed: Network error"
}
```

---

## When to Use This Pattern

✅ **Use for:**
- All user-facing error messages
- API error responses
- Form validation errors
- Network failures
- Business logic violations
- Rate limiting messages
- Authentication errors

❌ **Don't use for:**
- Internal logging (use technical details there)
- Developer debugging (use console.error with full stack traces)
- System monitoring (use structured error codes)

---

## Benefits

1. **Better User Experience** - Users understand what went wrong and what to do next
2. **Reduced Support Tickets** - Clear messages reduce confusion and support requests
3. **Increased Trust** - Honest, helpful messages build user confidence
4. **Higher Conversion** - Actionable errors guide users to solutions (like upgrading)
5. **Consistent Voice** - Maintains brand tone even in error states

---

## Related Patterns

- See `retry-logic.md` for automatic retry patterns
- See `error-boundaries.md` for React error boundary implementation
- See `error-logging.md` for error tracking and monitoring
- See `../04-ui-components/toast-notifications.md` for displaying error messages
- See `../05-form-patterns/form-validation.md` for validation error messages

---

*Extracted: 2026-02-18*
