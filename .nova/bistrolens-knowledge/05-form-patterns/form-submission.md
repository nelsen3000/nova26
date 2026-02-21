# Form Submission Patterns

## Source
Extracted from BistroLens `components/LoginPage.tsx`, `components/SignupPage.tsx`, `hooks/useAuthWithRecaptcha.ts`, `components/AffiliateSignup.tsx`

---

## Pattern: Async Form Submission with Loading States

Comprehensive form submission patterns with loading states, error handling, success feedback, and security verification.

---

## Basic Form Submission Handler

### Code Example

```typescript
import { useState } from 'react';
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/sound';

const MyForm: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await submitData({
        // form data
      });

      if (result.success) {
        playSuccessSound();
        setSuccess(true);
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (err: any) {
      playErrorSound();
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 bg-brand-primary text-brand-white rounded-full disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
};
```

---

## Form Submission with Custom Hook

### Code Example

```typescript
// useAuthWithRecaptcha.ts
import { useState, useCallback } from 'react';

interface AuthState {
  isLoading: boolean;
  error: string | null;
  success: string | null;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface AuthResult {
  success: boolean;
  user?: any;
  message?: string;
  error?: string;
}

export const useAuthWithRecaptcha = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    success: null
  });

  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  // Reset auth state
  const resetState = useCallback(() => {
    setAuthState({
      isLoading: false,
      error: null,
      success: null
    });
  }, []);

  // Signup with reCAPTCHA
  const signup = useCallback(async (data: SignupData): Promise<AuthResult> => {
    // Check if reCAPTCHA is required and verified
    if (config.enabled && !shouldBypassRecaptcha() && !recaptchaToken) {
      const error = 'Please complete the security verification';
      setAuthState({ isLoading: false, error, success: null });
      return { success: false, error };
    }

    setAuthState({ isLoading: true, error: null, success: null });

    try {
      const result = await signUpWithEmail(
        data.email, 
        data.password, 
        `${data.firstName} ${data.lastName}`
      );

      if (result.success && result.user) {
        setAuthState({
          isLoading: false,
          error: null,
          success: 'Account created successfully!'
        });
        
        // Reset reCAPTCHA token after successful use
        setRecaptchaToken(null);

        return {
          success: true,
          user: result.user,
          message: 'Account created successfully!'
        };
      } else {
        throw new Error(result.error || 'Signup failed');
      }
    } catch (error: any) {
      let errorMessage = 'Network error during signup. Please try again.';
      
      // Handle specific error messages
      if (error.message) {
        if (error.message.includes('already registered')) {
          errorMessage = 'An account with this email already exists';
        } else if (error.message.includes('Password should be')) {
          errorMessage = 'Password must be at least 6 characters long';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Please enter a valid email address';
        } else {
          errorMessage = error.message;
        }
      }

      setAuthState({
        isLoading: false,
        error: errorMessage,
        success: null
      });
      return { success: false, error: errorMessage };
    }
  }, [recaptchaToken]);

  // Check if form can be submitted
  const canSubmit = useCallback(() => {
    if (!config.enabled || shouldBypassRecaptcha()) {
      return true;
    }
    return !!recaptchaToken;
  }, [recaptchaToken]);

  return {
    ...authState,
    canSubmit: canSubmit(),
    signup,
    resetState,
    handleRecaptchaVerify: (token: string | null) => setRecaptchaToken(token)
  };
};
```

---

## Using the Submission Hook in Components

### Code Example

```typescript
import { useAuthWithRecaptcha } from '../hooks/useAuthWithRecaptcha';

const SignupPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const {
    isLoading,
    error,
    success,
    canSubmit,
    signup: signupWithRecaptcha,
    resetState
  } = useAuthWithRecaptcha();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    // Validation (see form-validation.md)
    if (!validateEmail(email)) {
      return;
    }

    try {
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

  return (
    <form onSubmit={handleEmailAuth} className="space-y-6">
      {/* Form fields */}
      
      <button
        type="submit"
        disabled={isLoading || !canSubmit}
        className="w-full h-12 bg-brand-primary text-brand-white rounded-full disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading && <LoaderIcon className="w-5 h-5 animate-spin" />}
        Sign Up
      </button>
    </form>
  );
};
```

---

## Submit Button with Loading Indicator

### Code Example

```tsx
import { LoaderIcon } from './Icons';

<button
  type="submit"
  disabled={isLoading || !canSubmit}
  className="w-full h-12 bg-brand-primary text-brand-white rounded-full hover:bg-brand-primary transition-all duration-200 font-black disabled:opacity-50 flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95"
>
  {isLoading && <LoaderIcon className="w-5 h-5 animate-spin" />}
  {isLoading ? 'Submitting...' : 'Submit'}
</button>
```

---

## Handling Submission Results

### Code Example

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  playClickSound();
  setIsSubmitting(true);
  
  // Validate required fields
  if (!formData.full_name || !formData.email || !formData.paypal_email) {
    setSubmitResult({ 
      success: false, 
      message: "Please fill in all required fields." 
    });
    setIsSubmitting(false);
    return;
  }

  const result = await submitAffiliateApplication(formData);
  setSubmitResult(result);
  
  if (result.success) {
    playSuccessSound();
  } else {
    playErrorSound();
  }
  
  setIsSubmitting(false);
};

// Display result
if (submitResult) {
  return (
    <div className={`p-6 rounded-2xl text-center border ${
      submitResult.success 
        ? 'bg-green-50 border-green-200 text-green-800' 
        : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      <div className="text-4xl mb-4">
        {submitResult.success ? '🎉' : '⚠️'}
      </div>
      <h3 className="text-xl font-bold mb-2">
        {submitResult.success ? "Application Received!" : "Error"}
      </h3>
      <p>{submitResult.message}</p>
    </div>
  );
}
```

---

## Preventing Double Submission

### Code Example

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Prevent double submission
  if (isSubmitting) return;
  
  setIsSubmitting(true);
  
  try {
    await submitData();
  } finally {
    // Always reset, even on error
    setIsSubmitting(false);
  }
};

// Disable button during submission
<button
  type="submit"
  disabled={isSubmitting}
  className="disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isSubmitting ? 'Submitting...' : 'Submit'}
</button>
```

---

## Form Submission with Sound Feedback

### Code Example

```typescript
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/sound';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  playClickSound(); // Immediate feedback on click
  
  try {
    const result = await submitForm();
    
    if (result.success) {
      playSuccessSound(); // Success audio feedback
      onSuccess(result.data);
    } else {
      playErrorSound(); // Error audio feedback
      setError(result.error);
    }
  } catch (err) {
    playErrorSound();
    setError('Submission failed');
  }
};
```

---

## Resetting Form State

### Code Example

```typescript
// Reset function in custom hook
const resetState = useCallback(() => {
  setAuthState({
    isLoading: false,
    error: null,
    success: null
  });
}, []);

// Usage in component
const handleSocialAuth = async (provider: 'google' | 'facebook') => {
  resetState(); // Clear previous errors/success messages
  
  try {
    const result = await signInWithGoogle();
    // Handle result
  } catch (err) {
    // Handle error
  }
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No loading state - button can be clicked multiple times
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  await submitData(); // Multiple submissions possible
};

// No error handling
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const result = await submitData();
  // What if this fails? User has no feedback
};

// Blocking UI without feedback
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);
  await submitData();
  // If this takes 10 seconds, user has no idea what's happening
};

// Not preventing default
const handleSubmit = async (e: React.FormEvent) => {
  // Missing e.preventDefault() - page will reload
  await submitData();
};
```

### ✅ Do This Instead

```typescript
// Proper submission with all safeguards
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault(); // Prevent page reload
  
  if (isSubmitting) return; // Prevent double submission
  
  playClickSound(); // Immediate feedback
  setError(null); // Clear previous errors
  setIsSubmitting(true); // Show loading state
  
  try {
    const result = await submitData();
    
    if (result.success) {
      playSuccessSound();
      setSuccess('Form submitted successfully!');
      onSuccess(result.data);
    } else {
      throw new Error(result.error);
    }
  } catch (err: any) {
    playErrorSound();
    setError(err.message || 'Submission failed');
  } finally {
    setIsSubmitting(false); // Always reset loading state
  }
};

// Button with proper disabled state and loading indicator
<button
  type="submit"
  disabled={isSubmitting || !canSubmit}
  className="disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isSubmitting && <LoaderIcon className="animate-spin" />}
  {isSubmitting ? 'Submitting...' : 'Submit'}
</button>
```

---

## When to Use This Pattern

✅ **Use for:**
- Any form that sends data to a server
- Authentication forms (login, signup, password reset)
- User profile updates
- Application submissions
- Payment forms
- Multi-step forms

❌ **Don't use for:**
- Simple client-side only forms (like filters)
- Forms that don't require async operations
- Search inputs (use debouncing instead)

---

## Benefits

1. **Prevents Double Submission** - Loading state disables button during submission
2. **Clear User Feedback** - Loading indicators show progress
3. **Error Recovery** - Users can retry after errors
4. **Accessibility** - Disabled states prevent confusion
5. **Better UX** - Sound feedback provides immediate response
6. **Security** - Can integrate reCAPTCHA or other verification
7. **Maintainability** - Custom hooks centralize submission logic

---

## Related Patterns

- See `form-validation.md` for pre-submission validation
- See `../07-error-handling/error-messages.md` for error display patterns
- See `../04-ui-components/loading-states.md` for loading UI patterns
- See `../09-hooks/useAuthWithRecaptcha.md` in hooks for auth-specific submission
- See `../07-error-handling/retry-logic.md` for handling failed submissions

---

*Extracted: 2026-02-18*
