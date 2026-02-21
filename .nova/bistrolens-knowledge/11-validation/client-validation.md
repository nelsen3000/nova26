# Client-Side Validation

## Source
Extracted from BistroLens `components/SignupPage.tsx`, `components/LoginPage.tsx`, `convex/securityGuards.ts`

---

## Pattern: Client-Side Form Validation

BistroLens validates form inputs on the client before submitting to the server. Validation functions return booleans, errors are stored in local state, and the UI renders inline error messages with animated feedback.

---

## Email & Password Validation

### Code Example

```typescript
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircleIcon, CheckCircleIcon } from './Icons';

const SignupPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Validation functions — pure, return boolean
  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };

  const validateAge = (birthDate: string): boolean => {
    if (!birthDate) return false;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 13; // Minimum age
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null); // Clear previous errors

    // Run validations in order — fail fast
    if (!validateEmail(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (!validateAge(birthDate)) {
      setLocalError('You must be at least 13 years old to use this app');
      return;
    }

    // All validations passed — submit
    try {
      await submitForm({ email, password });
    } catch (err: any) {
      setLocalError(err.message || 'Submission failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Animated error display */}
      <AnimatePresence>
        {localError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3"
          >
            <AlertCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{localError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Create a password"
        required
      />
      <p className="text-xs text-gray-400 mt-1">Use 8 or more characters.</p>

      <button
        type="submit"
        disabled={!email || !password}
      >
        Sign Up
      </button>
    </form>
  );
};
```

---

## Input Sanitization (Server-Side Guard)

### Code Example

```typescript
import { ConvexError } from "convex/values";

/**
 * Sanitize string input — basic XSS prevention
 * Used in Convex mutation handlers before storing data
 */
export function sanitizeString(input: string, maxLength: number = 10000): string {
  if (typeof input !== "string") {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Expected string input"
    });
  }

  // Truncate to max length
  let sanitized = input.slice(0, maxLength);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // HTML entity encoding for dangerous characters
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  return sanitized;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate URL format — only http/https allowed
 */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

---

## Error State Pattern

### Code Example

```typescript
// Combining local errors with hook errors
const {
  isLoading,
  error,        // Error from auth hook
  success,
  canSubmit,
  signup,
  resetState,
} = useAuthWithRecaptcha();

// Local validation errors take priority
const [localError, setLocalError] = useState<string | null>(null);
const displayError = localError || error; // Local errors shown first

// Clear errors on new attempt
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLocalError(null);
  resetState(); // Clear hook errors too

  // Validate...
  if (!validateEmail(email)) {
    setLocalError('Please enter a valid email address');
    return;
  }

  // Submit...
};

// Render combined error
return (
  <AnimatePresence>
    {displayError && (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3"
      >
        <AlertCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
        <span className="text-red-300 text-sm">{displayError}</span>
      </motion.div>
    )}

    {success && (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3"
      >
        <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
        <span className="text-green-300 text-sm">{success}</span>
      </motion.div>
    )}
  </AnimatePresence>
);
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Validating inside onChange — causes jittery UX
const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setEmail(e.target.value);
  if (!validateEmail(e.target.value)) {
    setError('Invalid email'); // ❌ Shows error while user is still typing
  }
};

// Not clearing errors before re-validation
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // ❌ Old error stays visible while new validation runs
  if (!validateEmail(email)) {
    setError('Invalid email');
    return;
  }
};

// Relying only on client validation
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateEmail(email)) return;
  // ❌ No server-side validation — client can be bypassed
  await submitDirectlyToDatabase({ email });
};
```

### ✅ Do This Instead

```typescript
// Validate on submit, not on change
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLocalError(null); // ✅ Clear first

  if (!validateEmail(email)) {
    setLocalError('Please enter a valid email address');
    return;
  }
  // ...
};

// Always validate server-side too
// Client validation = UX improvement
// Server validation = security requirement
```

---

## When to Use This Pattern

✅ **Use for:**
- Form submission validation (email, password, required fields)
- Immediate user feedback before API calls
- Age verification checks
- Password confirmation matching

❌ **Don't use for:**
- Replacing server-side validation (always do both)
- Validating on every keystroke (use `onBlur` or `onSubmit`)
- Complex business rules that require database lookups

---

## Benefits

1. Instant feedback without network round-trips
2. Reduces unnecessary API calls for obviously invalid data
3. `AnimatePresence` + `motion.div` gives smooth error transitions
4. Combining `localError || hookError` keeps a single error display point
5. Clearing errors on submit prevents stale error messages

---

## Related Patterns

- See `convex-validators.md` for server-side Convex validation
- See `business-rules.md` for tier/subscription enforcement
- See `../05-form-patterns/form-validation.md` for full form validation patterns

---

*Extracted: 2026-02-18*
