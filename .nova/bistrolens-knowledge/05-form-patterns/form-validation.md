# Form Validation Patterns

## Source
Extracted from BistroLens `components/LoginPage.tsx`, `components/SignupPage.tsx`, `components/AffiliateSignup.tsx`

---

## Pattern: Client-Side Form Validation

Comprehensive form validation patterns using React state, inline validation functions, and real-time error feedback.

---

## Email Validation

### Code Example

```typescript
// Simple regex-based email validation
const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Usage in form submission
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateEmail(email)) {
    setLocalError('Please enter a valid email address');
    return;
  }
  
  // Proceed with submission
};
```

---

## Password Validation

### Code Example

```typescript
// Password strength validation
const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

// Password confirmation matching
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validatePassword(password)) {
    setLocalError('Password must be at least 8 characters');
    return;
  }
  
  if (password !== confirmPassword) {
    setLocalError('Passwords do not match');
    return;
  }
  
  // Proceed with submission
};
```

### UI Feedback

```tsx
<div>
  <label className="block text-sm font-semibold text-brand-white mb-2">
    Create a password
  </label>
  <input
    type={showPassword ? 'text' : 'password'}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    className="w-full h-12 px-4 bg-[#121212] border border-[#535353] rounded"
    placeholder="Create a password"
    required
  />
  <p className="text-xs text-[#B3B3B3] mt-2 font-medium">
    Use 8 or more characters.
  </p>
</div>
```

---

## Age Verification Validation

### Code Example

```typescript
// Age calculation and validation
const validateAge = (birthDate: string): boolean => {
  if (!birthDate) return false;
  const age = ageVerificationService.calculateAge(birthDate);
  return age >= 13; // Minimum age requirement
};

// Usage in signup form
const handleEmailAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!birthDate) {
    setLocalError('Please enter your date of birth');
    return;
  }
  
  if (!validateAge(birthDate)) {
    setLocalError('You must be at least 13 years old to use Bistro Lens');
    return;
  }
  
  // Proceed with signup
};
```

### Date Input with Constraints

```tsx
<div>
  <label className="block text-sm font-semibold text-brand-white mb-2">
    Date of birth
  </label>
  <input
    type="date"
    value={birthDate}
    onChange={(e) => setBirthDate(e.target.value)}
    max={new Date().toISOString().split('T')[0]}
    className="w-full h-12 px-4 bg-[#121212] border border-[#535353] rounded"
    required
  />
  <p className="text-xs text-[#B3B3B3] mt-1 font-medium">
    Required for age verification
  </p>
</div>
```

---

## Required Field Validation

### Code Example

```typescript
// Multiple required field validation
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Check required text fields
  if (!firstName.trim() || !lastName.trim()) {
    setLocalError('Please enter your first and last name');
    return;
  }
  
  // Check required selections
  if (!agreeToTerms) {
    setLocalError('Please agree to the Terms and Conditions');
    return;
  }
  
  // All validations passed
  await submitForm();
};
```

---

## Checkbox Agreement Validation

### Code Example

```tsx
// Terms agreement checkbox
const [agreeToTerms, setAgreeToTerms] = useState(false);

// In form
<div className="flex items-start">
  <input
    type="checkbox"
    id="agree-terms"
    checked={agreeToTerms}
    onChange={(e) => setAgreeToTerms(e.target.checked)}
    className="w-4 h-4 mt-1 text-brand-primary bg-[#121212] border-[#535353] rounded"
    required
  />
  <label htmlFor="agree-terms" className="ml-3 text-sm text-[#B3B3B3]">
    I agree to Bistro Lens's{' '}
    <a href="/terms" className="text-brand-primary hover:underline">
      Terms and Conditions of Use
    </a>.
  </label>
</div>

// Submit button disabled state
<button
  type="submit"
  disabled={isLoading || !agreeToTerms}
  className="w-full h-12 bg-brand-primary text-brand-white rounded-full disabled:opacity-50"
>
  Sign Up
</button>
```

---

## Error Display Pattern

### Code Example

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircleIcon } from './Icons';

// Error state management
const [localError, setLocalError] = useState<string | null>(null);

// Error display component
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
```

---

## Success Message Pattern

### Code Example

```tsx
import { CheckCircleIcon } from './Icons';

// Success state
const [success, setSuccess] = useState<string | null>(null);

// Success display
<AnimatePresence>
  {success && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3"
    >
      <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
      <span className="text-green-300 text-sm">{success}</span>
    </motion.div>
  )}
</AnimatePresence>
```

---

## Comprehensive Validation Flow

### Code Example

```typescript
const handleEmailAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  playClickSound();
  setLocalError(null); // Clear previous errors

  // Validation chain
  if (!validateEmail(email)) {
    setLocalError('Please enter a valid email address');
    return;
  }

  if (!firstName.trim() || !lastName.trim()) {
    setLocalError('Please enter your first and last name');
    return;
  }

  if (!birthDate) {
    setLocalError('Please enter your date of birth');
    return;
  }

  if (!validateAge(birthDate)) {
    setLocalError('You must be at least 13 years old to use Bistro Lens');
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

  if (!agreeToTerms) {
    setLocalError('Please agree to the Terms and Conditions');
    return;
  }

  try {
    // All validations passed - submit form
    const result = await signupWithRecaptcha({
      email,
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim()
    });

    if (result.success && result.user) {
      playSuccessSound();
      onSuccess(result.user);
    } else if (!result.success) {
      playErrorSound();
    }
  } catch (err: any) {
    playErrorSound();
    console.error('Authentication error:', err);
  }
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No validation before submission
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // Directly submit without checking
  await submitForm({ email, password });
};

// Silent failures
const handleSubmit = async (e: React.FormEvent) => {
  if (!validateEmail(email)) {
    return; // User has no idea what went wrong
  }
};

// Validating on every keystroke (poor UX)
<input
  onChange={(e) => {
    setEmail(e.target.value);
    if (!validateEmail(e.target.value)) {
      setError('Invalid email'); // Shows error while typing
    }
  }}
/>
```

### ✅ Do This Instead

```typescript
// Comprehensive validation with clear feedback
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLocalError(null);
  
  if (!validateEmail(email)) {
    setLocalError('Please enter a valid email address');
    playErrorSound();
    return;
  }
  
  await submitForm({ email, password });
};

// Validate on blur or submit, not on every keystroke
<input
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  onBlur={() => {
    if (email && !validateEmail(email)) {
      setError('Invalid email format');
    }
  }}
/>
```

---

## When to Use This Pattern

✅ **Use for:**
- User registration and login forms
- Any form requiring data quality assurance
- Forms with complex business rules (age verification, password strength)
- Multi-field forms where fields depend on each other
- Forms requiring user agreement to terms

❌ **Don't use for:**
- Simple search inputs (over-validation hurts UX)
- Optional feedback forms where any input is acceptable
- Forms where backend validation is sufficient

---

## Benefits

1. **Immediate Feedback** - Users know instantly if their input is valid
2. **Reduced Server Load** - Invalid data never reaches the backend
3. **Better UX** - Clear error messages guide users to correct input
4. **Security** - First line of defense against malformed data
5. **Accessibility** - Error messages can be announced by screen readers
6. **Cost Savings** - Prevents unnecessary API calls with invalid data

---

## Related Patterns

- See `form-submission.md` for handling validated form data
- See `../07-error-handling/error-messages.md` for error display best practices
- See `../09-hooks/use-auth-with-recaptcha.md` in hooks for reCAPTCHA integration
- See `../11-validation/client-validation.md` in validation patterns for more validators

---

*Extracted: 2026-02-18*
