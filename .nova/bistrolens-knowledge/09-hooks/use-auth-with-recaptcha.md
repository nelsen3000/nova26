# useAuthWithRecaptcha

## Source
Extracted from BistroLens `hooks/useAuthWithRecaptcha.ts`, `convex/auth.ts`

**Category:** 09-hooks
**Type:** Pattern
**Tags:** hooks, auth, recaptcha, clerk, security, bot-prevention

---

## Overview

`useAuthWithRecaptcha` wraps Clerk's `useSignIn`/`useSignUp` with Google reCAPTCHA v3 token generation. Tokens are verified server-side in Convex before any auth action proceeds, preventing bot signups and brute-force attacks.

---

## Pattern

```typescript
// hooks/useAuthWithRecaptcha.ts
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!;

async function getRecaptchaToken(action: string): Promise<string> {
  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(async () => {
      try {
        const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
        resolve(token);
      } catch (err) {
        reject(err);
      }
    });
  });
}

interface AuthWithRecaptchaOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useAuthWithRecaptcha(options: AuthWithRecaptchaOptions = {}) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const verifyRecaptcha = useMutation(api.auth.verifyRecaptchaToken);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithRecaptcha = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Get reCAPTCHA token
        const recaptchaToken = await getRecaptchaToken("signin");

        // Step 2: Verify token server-side
        const { valid, score } = await verifyRecaptcha({ token: recaptchaToken, action: "signin" });
        if (!valid || score < 0.5) {
          throw new Error("Bot detection triggered. Please try again.");
        }

        // Step 3: Proceed with Clerk sign-in
        const result = await signIn!.create({ identifier: email, password });

        if (result.status === "complete") {
          options.onSuccess?.();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sign in failed";
        setError(message);
        options.onError?.(message);
      } finally {
        setIsLoading(false);
      }
    },
    [signIn, verifyRecaptcha, options]
  );

  const signUpWithRecaptcha = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const recaptchaToken = await getRecaptchaToken("signup");
        const { valid, score } = await verifyRecaptcha({ token: recaptchaToken, action: "signup" });

        if (!valid || score < 0.7) {
          throw new Error("Signup blocked by bot detection.");
        }

        await signUp!.create({ emailAddress: email, password });
        options.onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sign up failed";
        setError(message);
        options.onError?.(message);
      } finally {
        setIsLoading(false);
      }
    },
    [signUp, verifyRecaptcha, options]
  );

  return { signInWithRecaptcha, signUpWithRecaptcha, isLoading, error };
}
```

```typescript
// convex/auth.ts — server-side reCAPTCHA verification
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const verifyRecaptchaToken = mutation({
  args: { token: v.string(), action: v.string() },
  handler: async (_ctx, { token, action }) => {
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
      { method: "POST" }
    );

    const data = await response.json();

    return {
      valid: data.success && data.action === action,
      score: data.score ?? 0,
    };
  },
});
```

---

## Usage

```tsx
function LoginForm() {
  const { signInWithRecaptcha, isLoading, error } = useAuthWithRecaptcha({
    onSuccess: () => router.push("/dashboard"),
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      signInWithRecaptcha(email, password);
    }}>
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
```

---

## Anti-Patterns

### Don't Do This

```typescript
// Client-side only reCAPTCHA verification
const token = await getRecaptchaToken("signin");
if (token) signIn(); // Token not verified server-side — trivially bypassed

// Low score threshold
if (score < 0.1) throw new Error("Bot detected"); // Score 0.1 allows most bots

// Missing action verification
const { valid } = await verifyRecaptcha({ token }); // Action mismatch not checked
```

### Do This Instead

```typescript
// Server-side verification with action matching and reasonable threshold
const { valid, score } = await verifyRecaptcha({ token: recaptchaToken, action: "signin" });
if (!valid || score < 0.5) {
  throw new Error("Bot detection triggered. Please try again.");
}
```

---

## When to Use This Pattern

**Use for:**
- Login and signup forms to prevent automated bot attacks
- Password reset flows to prevent abuse
- Any public-facing form that triggers server-side actions

**Don't use for:**
- Authenticated-only actions where the user is already verified
- Internal admin tools behind VPN or IP allowlists

---

## Benefits

1. Prevents automated bot signups and brute-force login attempts
2. Invisible to legitimate users — reCAPTCHA v3 requires no user interaction
3. Server-side verification ensures tokens cannot be forged or replayed
4. Score-based thresholds allow tuning sensitivity per action type

---

## Related Patterns

- `use-auth.md` — Base auth hook without reCAPTCHA
- `../03-auth-patterns/auth-helpers.md` — Server-side auth helpers
- `../03-auth-patterns/session-management.md` — Session handling
