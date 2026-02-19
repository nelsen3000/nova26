# useAuth Hook Pattern

## Source
Extracted from BistroLens `hooks/useAuthWithRecaptcha.ts` and `services/simpleAuth.ts`

---

## Pattern: Authentication Hook with reCAPTCHA Integration

A comprehensive React hook that manages authentication state and provides secure signup/signin methods with built-in reCAPTCHA verification. This pattern combines form state management, security validation, and error handling into a single reusable hook.

---

## Core Implementation

### Hook Structure

```typescript
/**
 * Enhanced Authentication Hook with reCAPTCHA Integration
 * Provides secure auth methods with built-in reCAPTCHA verification
 */

import { useState, useCallback } from 'react';
import { getRecaptchaConfig, shouldBypassRecaptcha } from '../services/recaptchaService';
import { signUpWithEmail, signInWithEmail } from '../services/simpleAuth';

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

interface SigninData {
  email: string;
  password: string;
}

interface AuthResult {
  success: boolean;
  user?: any;
  session?: any;
  message?: string;
  error?: string;
  requiresEmailConfirmation?: boolean;
}

export const useAuthWithRecaptcha = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    success: null
  });

  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const config = getRecaptchaConfig();

  // Reset auth state
  const resetState = useCallback(() => {
    setAuthState({
      isLoading: false,
      error: null,
      success: null
    });
  }, []);

  // Handle reCAPTCHA verification
  const handleRecaptchaVerify = useCallback((token: string | null) => {
    setRecaptchaToken(token);
    if (authState.error) {
      resetState();
    }
  }, [authState.error, resetState]);

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
      // Use simple auth service
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
  }, [config.enabled, recaptchaToken]);

  // Signin with reCAPTCHA
  const signin = useCallback(async (data: SigninData): Promise<AuthResult> => {
    // Check if reCAPTCHA is required and verified
    if (config.enabled && !shouldBypassRecaptcha() && !recaptchaToken) {
      const error = 'Please complete the security verification';
      setAuthState({ isLoading: false, error, success: null });
      return { success: false, error };
    }

    setAuthState({ isLoading: true, error: null, success: null });

    try {
      // Use simple auth service
      const result = await signInWithEmail(data.email, data.password);

      if (result.success && result.user) {
        setAuthState({
          isLoading: false,
          error: null,
          success: 'Sign in successful!'
        });

        // Reset reCAPTCHA token after successful use
        setRecaptchaToken(null);

        return {
          success: true,
          user: result.user,
          message: 'Sign in successful!'
        };
      } else {
        throw new Error(result.error || 'Sign in failed');
      }
    } catch (error: any) {
      let errorMessage = 'Network error during signin. Please try again.';

      // Handle specific error messages
      if (error.message) {
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please confirm your email address before signing in';
        } else if (error.message.includes('too many requests')) {
          errorMessage = 'Too many signin attempts. Please try again later.';
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
  }, [config.enabled, recaptchaToken]);

  // Check if form can be submitted (reCAPTCHA verified if required)
  const canSubmit = useCallback(() => {
    if (!config.enabled || shouldBypassRecaptcha()) {
      return true;
    }
    return !!recaptchaToken;
  }, [config.enabled, recaptchaToken]);

  return {
    // State
    ...authState,
    recaptchaToken,
    canSubmit: canSubmit(),

    // Actions
    signup,
    signin,
    resetState,
    handleRecaptchaVerify,

    // Config
    recaptchaConfig: config
  };
};
```

---

## Usage in Components

### Login Form Example

```typescript
import { useAuthWithRecaptcha } from '../hooks/useAuthWithRecaptcha';
import RecaptchaWrapper from './ui/RecaptchaWrapper';

export function LoginPage({ onSuccess }: { onSuccess: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const {
    isLoading,
    error,
    success,
    canSubmit,
    signin,
    resetState,
    handleRecaptchaVerify,
    recaptchaConfig
  } = useAuthWithRecaptcha();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await signin({
        email,
        password
      });

      if (result.success && result.user) {
        onSuccess(result.user);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
    }
  };

  return (
    <form onSubmit={handleEmailAuth}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />

      {/* reCAPTCHA integration */}
      {recaptchaConfig.enabled && (
        <RecaptchaWrapper
          siteKey={recaptchaConfig.siteKey}
          onVerify={handleRecaptchaVerify}
        />
      )}

      {/* Error/Success messages */}
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <button
        type="submit"
        disabled={!canSubmit || isLoading}
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

### Signup Form Example

```typescript
export function SignupPage({ onSuccess }: { onSuccess: (user: any) => void }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });

  const {
    isLoading,
    error,
    canSubmit,
    signup,
    handleRecaptchaVerify,
    recaptchaConfig
  } = useAuthWithRecaptcha();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await signup(formData);

    if (result.success && result.user) {
      onSuccess(result.user);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.firstName}
        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
        placeholder="First Name"
        required
      />
      <input
        type="text"
        value={formData.lastName}
        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
        placeholder="Last Name"
        required
      />
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        placeholder="Password"
        required
      />

      {recaptchaConfig.enabled && (
        <RecaptchaWrapper
          siteKey={recaptchaConfig.siteKey}
          onVerify={handleRecaptchaVerify}
        />
      )}

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={!canSubmit || isLoading}>
        {isLoading ? 'Creating account...' : 'Sign Up'}
      </button>
    </form>
  );
}
```

---

## Supporting Auth Service

### Simple Auth Implementation

```typescript
// Simple authentication service for Convex
interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

// Safe localStorage wrapper for mobile compatibility
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('[Auth] localStorage.getItem failed:', e);
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('[Auth] localStorage.setItem failed:', e);
      return false;
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Auth] localStorage.removeItem failed:', e);
    }
  }
};

// Email/Password Authentication
export const signUpWithEmail = async (
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> => {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Basic validation
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Check if user already exists
    const existingUser = safeStorage.getItem(`user_${email}`);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Create new user
    const user: User = {
      id: `user_${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`
    };

    // Store user (in production, this would be in Convex)
    safeStorage.setItem(`user_${email}`, JSON.stringify({ ...user, password }));
    safeStorage.setItem('currentUser', JSON.stringify(user));

    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Basic validation
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Check if user exists
    const userData = safeStorage.getItem(`user_${email}`);
    if (!userData) {
      throw new Error('No account found with this email');
    }

    const storedUser = JSON.parse(userData);
    if (storedUser.password !== password) {
      throw new Error('Invalid password');
    }

    const user: User = {
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      avatar: storedUser.avatar
    };

    safeStorage.setItem('currentUser', JSON.stringify(user));

    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
```

---

## Anti-Patterns

### Don't Store Sensitive State in Hook

```typescript
// BAD: Storing password in hook state
const [password, setPassword] = useState('');

const signup = async () => {
  // Password persists in memory
  await signUpWithEmail(email, password);
};
```

### Do Pass Credentials Directly

```typescript
// GOOD: Pass credentials directly, don't store
const signup = async (data: SignupData) => {
  // Credentials only exist during function execution
  const result = await signUpWithEmail(data.email, data.password);
  return result;
};
```

### Don't Ignore reCAPTCHA Verification

```typescript
// BAD: Allowing submission without reCAPTCHA
const signup = async (data: SignupData) => {
  // No reCAPTCHA check - vulnerable to bots
  return await signUpWithEmail(data.email, data.password);
};
```

### Do Enforce Security Checks

```typescript
// GOOD: Verify reCAPTCHA before proceeding
const signup = async (data: SignupData) => {
  if (config.enabled && !shouldBypassRecaptcha() && !recaptchaToken) {
    return { success: false, error: 'Please complete security verification' };
  }
  return await signUpWithEmail(data.email, data.password);
};
```

### Don't Use Generic Error Messages

```typescript
// BAD: Unhelpful error message
catch (error) {
  setError('Something went wrong');
}
```

### Do Provide Specific Error Messages

```typescript
// GOOD: User-friendly, specific error messages
catch (error: any) {
  let errorMessage = 'Network error during signup. Please try again.';

  if (error.message.includes('already registered')) {
    errorMessage = 'An account with this email already exists';
  } else if (error.message.includes('Password should be')) {
    errorMessage = 'Password must be at least 6 characters long';
  }

  setAuthState({ isLoading: false, error: errorMessage, success: null });
}
```

### Don't Forget to Reset reCAPTCHA Token

```typescript
// BAD: Token persists after use
if (result.success) {
  setAuthState({ isLoading: false, error: null, success: 'Success!' });
  return result;
}
```

### Do Reset Token After Each Use

```typescript
// GOOD: Reset token to prevent reuse
if (result.success) {
  setAuthState({ isLoading: false, error: null, success: 'Success!' });
  setRecaptchaToken(null); // Reset for next attempt
  return result;
}
```

---

## When to Use This Pattern

**Use for:**
- Email/password authentication flows
- Forms requiring bot protection (reCAPTCHA)
- Authentication with loading/error states
- Multi-step auth processes (signup, signin, password reset)
- Mobile-compatible auth (safe localStorage handling)
- Applications needing security verification

**Don't use for:**
- Simple OAuth-only authentication (use provider's hooks)
- Server-side authentication (use API routes)
- Authentication without user interaction
- Real-time auth state synchronization across tabs (needs additional listeners)

---

## Benefits

1. **Security First**: Built-in reCAPTCHA integration prevents bot attacks
2. **Comprehensive State Management**: Handles loading, error, and success states
3. **User-Friendly Errors**: Translates technical errors into actionable messages
4. **Mobile Compatible**: Safe localStorage wrapper handles mobile edge cases
5. **Type Safety**: Full TypeScript support with clear interfaces
6. **Reusable**: Single hook for both signup and signin flows
7. **Flexible**: Supports bypassing reCAPTCHA for development/testing
8. **Clean API**: Returns both state and actions in a single object

---

## Related Patterns

- See `../03-auth-patterns/session-management.md` for maintaining auth state across sessions
- See `../03-auth-patterns/rbac-implementation.md` for role-based access control
- See `../05-form-patterns/form-validation.md` for client-side validation patterns
- See `../07-error-handling/error-messages.md` for error handling UX patterns
- See `use-subscription.md` for subscription-based auth enforcement

---

*Extracted: 2026-02-18*
