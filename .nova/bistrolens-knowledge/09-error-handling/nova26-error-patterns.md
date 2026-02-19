# Nova26 Error Handling Patterns

## Adapted from BistroLens Error UX

**Source:** BistroLens `48-ERROR-HANDLING-UX.md`  
**Category:** Error Handling & UX  
**Priority:** P2  
**Reusability:** 9/10

---

## Overview

BistroLens has detailed error UX patterns:
- User-friendly error messages
- Retry logic with exponential backoff
- Graceful degradation
- Error boundaries
- Loading states

Nova26's CHARON agent handles errors but the `visual-validator.ts` can be enhanced.

---

## Pattern 1: User-Facing Error Messages

**Source:** BistroLens `ERROR_MESSAGES` templates  
**Nova26 Adaptation:** Standardized error message service

### Implementation

```typescript
// src/errors/error-messages.ts

export interface ErrorMessage {
  title: string;
  message: string;
  action?: { label: string; handler: string };
  secondaryAction?: { label: string; handler: string };
  icon: string;
}

const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  // Network errors
  offline: {
    title: "You're offline",
    message: "Check your internet connection and try again.",
    action: { label: "Retry", handler: "retry" },
    icon: "wifi-off",
  },
  
  timeout: {
    title: "Taking too long",
    message: "This is taking longer than expected. Want to try again?",
    action: { label: "Try Again", handler: "retry" },
    secondaryAction: { label: "Cancel", handler: "cancel" },
    icon: "clock",
  },
  
  serverError: {
    title: "Something went wrong",
    message: "We're having some technical difficulties. Please try again in a moment.",
    action: { label: "Try Again", handler: "retry" },
    icon: "alert-circle",
  },
  
  // Auth errors
  sessionExpired: {
    title: "Session expired",
    message: "Please sign in again to continue.",
    action: { label: "Sign In", handler: "login" },
    icon: "log-in",
  },
  
  unauthorized: {
    title: "Access denied",
    message: "You don't have permission to do that.",
    action: { label: "Go Back", handler: "back" },
    icon: "lock",
  },
  
  // Rate limiting
  rateLimitExceeded: {
    title: "Slow down",
    message: "You've made too many requests. Please wait a moment and try again.",
    action: { label: "Retry", handler: "retry" },
    icon: "clock",
  },
  
  // Build/Agent errors
  buildFailed: {
    title: "Build failed",
    message: "We couldn't complete your request. Our team has been notified.",
    action: { label: "Try Again", handler: "retry" },
    secondaryAction: { label: "View Details", handler: "details" },
    icon: "x-circle",
  },
  
  agentError: {
    title: "Agent error",
    message: "Something went wrong while processing your request.",
    action: { label: "Retry", handler: "retry" },
    icon: "bot",
  },
};

export function getErrorMessage(errorCode: string): ErrorMessage {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.serverError;
}

export function mapErrorToCode(error: Error | unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'offline';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return 'sessionExpired';
    }
    if (message.includes('forbidden') || message.includes('403')) {
      return 'unauthorized';
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return 'rateLimitExceeded';
    }
  }
  
  return 'serverError';
}
```

---

## Pattern 2: Retry Logic

**Source:** BistroLens `withRetry` pattern  
**Nova26 Adaptation:** Smart retry with agent escalation

### Implementation

```typescript
// src/errors/retry-logic.ts

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['timeout', 'network', 'server'],
  nonRetryableErrors: ['unauthorized', 'forbidden', 'invalid'],
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;
  let delay = fullConfig.initialDelay;
  
  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry certain errors
      if (!isRetryable(error, fullConfig)) {
        throw error;
      }
      
      // Last attempt failed
      if (attempt === fullConfig.maxRetries) {
        break;
      }
      
      // Wait before retry
      await sleep(delay);
      delay = Math.min(delay * fullConfig.backoffMultiplier, fullConfig.maxDelay);
    }
  }
  
  throw lastError;
}

function isRetryable(error: unknown, config: RetryConfig): boolean {
  if (!(error instanceof Error)) return true;
  
  const message = error.message.toLowerCase();
  
  // Check non-retryable first
  for (const pattern of config.nonRetryableErrors || []) {
    if (message.includes(pattern)) return false;
  }
  
  // Check if explicitly retryable
  for (const pattern of config.retryableErrors || []) {
    if (message.includes(pattern)) return true;
  }
  
  // Default: retry unknown errors
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Pattern 3: Graceful Degradation

**Source:** BistroLens `withDegradation` pattern  
**Nova26 Adaptation:** Agent fallback strategies

### Implementation

```typescript
// src/errors/graceful-degradation.ts

interface DegradationStrategy<T> {
  fallback: () => T | Promise<T>;
  silent?: boolean;
  message?: string;
  logLevel?: 'info' | 'warn' | 'error';
}

export async function withDegradation<T>(
  operation: () => Promise<T>,
  strategy: DegradationStrategy<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Log for monitoring
    const logFn = console[strategy.logLevel || 'warn'];
    logFn('Operation failed, using fallback', { error, operation: operation.name });
    
    // Show message if not silent
    if (!strategy.silent && strategy.message) {
      showToast(strategy.message, 'info');
    }
    
    // Return fallback
    return await strategy.fallback();
  }
}

// Agent-specific degradation strategies
export const AGENT_DEGRADATION: Record<string, DegradationStrategy<any>> = {
  URANUS: {
    fallback: () => ({ summary: 'Research temporarily unavailable', sources: [] }),
    message: 'Research limited - using cached results',
    silent: false,
  },
  VENUS: {
    fallback: () => '<div class="p-4 border">Component placeholder</div>',
    silent: true, // Don't show error for UI placeholder
  },
  MARS: {
    fallback: () => 'type Placeholder = any;',
    message: 'Type generation failed - using any',
    logLevel: 'error',
  },
};
```

---

## Pattern 4: Error Boundaries (React)

**Source:** BistroLens Error Boundary pattern  
**Nova26 Adaptation:** Agent-specific error boundaries

### Implementation

```typescript
// src/components/ErrorBoundary.tsx

import React from 'react';
import { getErrorMessage } from '../errors/error-messages';

interface ErrorBoundaryProps {
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  agentName?: string;  // For agent-specific handling
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class AgentErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error tracking
    console.error('Agent error boundary caught error', {
      error,
      errorInfo,
      agent: this.props.agentName,
    });
    
    this.props.onError?.(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      // Custom fallback or default
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default error UI
      const errorMessage = getErrorMessage('agentError');
      
      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <span className="font-semibold">{errorMessage.title}</span>
          </div>
          <p className="mt-2 text-sm text-red-600">{errorMessage.message}</p>
          {this.props.agentName && (
            <p className="mt-1 text-xs text-red-500">
              Agent: {this.props.agentName}
            </p>
          )}
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Usage: Wrap each agent output
export function withAgentErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  agentName: string
): React.FC<P> {
  return (props: P) => (
    <AgentErrorBoundary agentName={agentName}>
      <Component {...props} />
    </AgentErrorBoundary>
  );
}
```

---

## Pattern 5: Loading States

**Source:** BistroLens `LOADING_STATES` patterns  
**Nova26 Adaptation:** Agent-aware loading states

### Implementation

```typescript
// src/components/AgentLoadingState.tsx

interface AgentLoadingStateProps {
  agent: string;
  task?: string;
}

const AGENT_LOADING_MESSAGES: Record<string, string[]> = {
  SUN: ['Planning your build...', 'Creating specifications...', 'Defining architecture...'],
  VENUS: ['Designing UI components...', 'Styling with Tailwind...', 'Polishing interactions...'],
  MARS: ['Writing TypeScript...', 'Ensuring type safety...', 'Optimizing code...'],
  PLUTO: ['Designing database schema...', 'Creating tables...', 'Setting up indexes...'],
  URANUS: ['Researching...', 'Analyzing patterns...', 'Gathering insights...'],
};

export function AgentLoadingState({ agent, task }: AgentLoadingStateProps) {
  const messages = AGENT_LOADING_MESSAGES[agent] || ['Processing...'];
  const [messageIndex, setMessageIndex] = React.useState(0);
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(i => (i + 1) % messages.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [messages.length]);
  
  return (
    <div className="flex items-center gap-3 p-4">
      <LoadingSpinner />
      <div>
        <p className="font-medium text-gray-900">
          {agent} is working
        </p>
        <p className="text-sm text-gray-500">
          {messages[messageIndex]}
        </p>
        {task && (
          <p className="text-xs text-gray-400">{task}</p>
        )}
      </div>
    </div>
  );
}
```

---

## Pattern 6: Toast Notifications

**Source:** BistroLens `TOAST_CONFIG`  
**Nova26 Adaptation:** Build status notifications

```typescript
// src/components/BuildToast.tsx

interface ToastConfig {
  duration: number;
  icon: string;
  color: string;
  dismissible?: boolean;
}

const TOAST_CONFIGS: Record<string, ToastConfig> = {
  success: {
    duration: 3000,
    icon: 'check-circle',
    color: 'green',
  },
  error: {
    duration: 5000,
    icon: 'alert-circle',
    color: 'red',
    dismissible: true,
  },
  warning: {
    duration: 4000,
    icon: 'alert-triangle',
    color: 'yellow',
  },
  info: {
    duration: 3000,
    icon: 'info',
    color: 'blue',
  },
};

export function showBuildToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info',
  agent?: string
) {
  const config = TOAST_CONFIGS[type];
  
  toast({
    message: agent ? `[${agent}] ${message}` : message,
    duration: config.duration,
    icon: config.icon,
    color: config.color,
    dismissible: config.dismissible,
  });
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/errors/error-messages.ts` | New - standardized messages |
| `src/errors/retry-logic.ts` | New - retry with backoff |
| `src/errors/graceful-degradation.ts` | New - fallback strategies |
| `src/components/AgentErrorBoundary.tsx` | New - agent error boundaries |
| `src/components/AgentLoadingState.tsx` | New - loading states |
| `.nova/agents/CHARON.md` | Update with error patterns |

---

## Source

BistroLens `48-ERROR-HANDLING-UX.md`

## Anti-Patterns

- Showing raw error messages or stack traces to end users
- Retrying non-retryable errors (e.g., 403 Forbidden, validation failures)
- Swallowing errors silently without logging or user feedback
- Using a single generic error boundary for the entire application

## When to Use

- When implementing user-facing error states in any VENUS-generated component
- When adding retry logic to agent calls or API requests
- When wrapping agent output sections in error boundaries

## Benefits

- Standardized error messages provide consistent, user-friendly feedback
- Exponential backoff retry prevents thundering herd on transient failures
- Agent-specific degradation strategies keep the build moving when one agent fails
- Toast notification system surfaces build status without blocking the UI

## Related Patterns

- `nova26-cost-protection.md` for circuit breaker and cost-overrun error handling
- `nova26-accessibility-rules.md` for accessible error state ARIA patterns
- `nova26-test-plan.md` for testing error paths and agent failure scenarios

*Adapted from BistroLens error UX patterns*
*For Nova26 error handling*
