# Error Logging Patterns

## Source
Extracted from BistroLens:
- `utils/errorLogger.ts` - Core error logging utility
- `services/incidentLoggerService.ts` - Security incident tracking
- `services/errorMonitoringService.ts` - React error monitoring
- `utils/sentry.ts` - Sentry integration
- `components/ErrorBoundary.tsx` - React error boundary with logging
- `api/_lib/middleware.ts` - API error logging
- Various components using `console.error` and `logError`

---

## Pattern: Centralized Error Logger with Persistence

BistroLens uses a singleton ErrorLogger class that captures, stores, and reports errors with rich context. Errors are persisted to localStorage, logged to console in development, and reported to external services in production.

---

## Core Error Logger Implementation

### Code Example

```typescript
// utils/errorLogger.ts

interface ErrorContext {
  componentStack?: string;
  level?: 'page' | 'component' | 'critical';
  timestamp?: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
  additionalData?: Record<string, any>;
}

interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: string;
  reported: boolean;
}

class ErrorLogger {
  private errors: ErrorLog[] = [];
  private maxErrors = 100; // Keep last 100 errors in memory
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadStoredErrors();
    this.setupGlobalErrorHandlers();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadStoredErrors(): void {
    try {
      const stored = localStorage.getItem('bistroLens_errorLogs');
      if (stored) {
        // Keep only the most recent errors
        this.errors = JSON.parse(stored).slice(-this.maxErrors);
      }
    } catch (e) {
      console.warn('Failed to load stored errors:', e);
    }
  }

  private saveErrors(): void {
    try {
      localStorage.setItem('bistroLens_errorLogs', JSON.stringify(this.errors));
    } catch (e) {
      console.warn('Failed to save errors to localStorage:', e);
    }
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError(new Error(event.message), {
        level: 'critical',
        url: event.filename,
        additionalData: {
          lineno: event.lineno,
          colno: event.colno,
          type: 'javascript'
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
        level: 'critical',
        additionalData: {
          type: 'promise_rejection',
          reason: event.reason
        }
      });
    });

    // Handle network errors
    window.addEventListener('offline', () => {
      this.logError(new Error('Network connection lost'), {
        level: 'component',
        additionalData: {
          type: 'network',
          online: navigator.onLine
        }
      });
    });
  }

  logError(error: Error, context: ErrorContext = {}): string {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorLog: ErrorLog = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        timestamp: context.timestamp || new Date().toISOString(),
        userAgent: context.userAgent || navigator.userAgent,
        url: context.url || window.location.href,
        sessionId: this.sessionId
      },
      timestamp: new Date().toISOString(),
      reported: false
    };

    // Add to errors array
    this.errors.push(errorLog);
    
    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Save to localStorage for persistence
    this.saveErrors();

    // Log to console in development with grouped output
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error ${errorId}`);
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      console.error('Context:', context);
      console.groupEnd();
    }

    // Report to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError(errorLog);
    }

    return errorId;
  }

  private async reportError(errorLog: ErrorLog): Promise<void> {
    try {
      // Report to backend API
      const response = await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorLog)
      });

      if (response.ok) {
        errorLog.reported = true;
        this.saveErrors();
      }
    } catch (e) {
      console.warn('Failed to report error to backend:', e);
      
      // Fallback: try to report to external service
      this.reportToExternalService(errorLog);
    }
  }

  private reportToExternalService(errorLog: ErrorLog): void {
    // Use beacon API for reliable error reporting even during page unload
    try {
      if (navigator.sendBeacon) {
        const data = new Blob([JSON.stringify(errorLog)], { type: 'application/json' });
        navigator.sendBeacon('/api/errors/beacon', data);
      }
    } catch (e) {
      console.warn('Failed to send error beacon:', e);
    }
  }

  getErrors(level?: string): ErrorLog[] {
    if (level) {
      return this.errors.filter(error => error.context.level === level);
    }
    return [...this.errors];
  }

  getUnreportedErrors(): ErrorLog[] {
    return this.errors.filter(error => !error.reported);
  }

  clearErrors(): void {
    this.errors = [];
    this.saveErrors();
  }

  getErrorStats(): {
    total: number;
    byLevel: Record<string, number>;
    recent: number;
    unreported: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const byLevel = this.errors.reduce((acc, error) => {
      const level = error.context.level || 'unknown';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recent = this.errors.filter(error => 
      new Date(error.timestamp).getTime() > oneHourAgo
    ).length;

    return {
      total: this.errors.length,
      byLevel,
      recent,
      unreported: this.getUnreportedErrors().length
    };
  }

  // Retry failed error reports
  async retryFailedReports(): Promise<void> {
    const unreported = this.getUnreportedErrors();
    
    for (const error of unreported) {
      try {
        await this.reportError(error);
        // Small delay between reports to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn('Failed to retry error report:', e);
      }
    }
  }
}

// Singleton instance
const errorLogger = new ErrorLogger();

// Export the main logging function
export const logError = (error: Error, context?: ErrorContext): string => {
  return errorLogger.logError(error, context);
};

// Export utility functions
export const getErrorStats = () => errorLogger.getErrorStats();
export const getErrors = (level?: string) => errorLogger.getErrors(level);
export const clearErrors = () => errorLogger.clearErrors();
export const retryFailedReports = () => errorLogger.retryFailedReports();
```

---

## Specialized Error Logging Functions

### Code Example

```typescript
// Specialized error logging functions for different contexts

// AI service errors
export const logAIError = (error: Error, operation: string, additionalData?: any) => {
  return logError(error, {
    level: 'component',
    additionalData: {
      type: 'ai_service',
      operation,
      ...additionalData
    }
  });
};

// Network errors
export const logNetworkError = (error: Error, url: string, method: string = 'GET') => {
  return logError(error, {
    level: 'component',
    additionalData: {
      type: 'network',
      url,
      method,
      online: navigator.onLine
    }
  });
};

// User action errors
export const logUserActionError = (error: Error, action: string, additionalData?: any) => {
  return logError(error, {
    level: 'component',
    additionalData: {
      type: 'user_action',
      action,
      ...additionalData
    }
  });
};
```

### Usage in Components

```typescript
// Example: Using logError in a component
import { logError, logAIError, logNetworkError } from '../utils/errorLogger';

function RecipeGenerator() {
  const handleGenerate = async () => {
    try {
      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        body: JSON.stringify({ prompt })
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      setRecipe(data);
    } catch (error) {
      // Log with specialized function for AI errors
      const errorId = logAIError(error as Error, 'recipe_generation', {
        prompt: prompt.substring(0, 100), // First 100 chars only
        userId: user?.id
      });
      
      // Show user-friendly error message
      toast.error(`Failed to generate recipe (Error ID: ${errorId})`);
    }
  };
  
  return (
    <button onClick={handleGenerate}>Generate Recipe</button>
  );
}
```

---

## Sentry Integration Pattern

### Code Example

```typescript
// utils/sentry.ts
import * as Sentry from '@sentry/react';

// Track if Sentry has been initialized to prevent duplicate initialization
let sentryInitialized = false;

export const initSentry = () => {
  // Prevent multiple initializations (React StrictMode, HMR, etc.)
  if (sentryInitialized) {
    return;
  }
  
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.log('Sentry DSN not provided, skipping initialization');
    return;
  }

  // Check if Sentry client already exists (another guard)
  if (Sentry.getClient()) {
    sentryInitialized = true;
    return;
  }

  sentryInitialized = true;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    sendDefaultPii: true,
    
    // Performance Monitoring
    integrations: [
      Sentry.browserTracingIntegration({
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/bistrolens\.com/,
          /^https:\/\/.*\.vercel\.app/,
          /^https:\/\/.*\.convex\.cloud/,
        ],
      }),
      Sentry.replayIntegration(),
    ],

    // Performance Monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',

    // Filter out non-critical errors in production
    beforeSend(event, hint) {
      if (import.meta.env.MODE === 'production') {
        // Skip network errors that are likely user connectivity issues
        if (event.exception?.values?.[0]?.type === 'NetworkError') {
          return null;
        }
        
        // Skip ResizeObserver errors (common browser quirk)
        if (event.message?.includes('ResizeObserver')) {
          return null;
        }
        
        // Skip non-Error objects
        if (hint.originalException && typeof hint.originalException !== 'object') {
          return null;
        }
      }
      
      return event;
    },

    debug: import.meta.env.MODE === 'development',
    captureUnhandledRejections: true,
    
    initialScope: {
      tags: {
        component: 'bistro-lens-frontend',
      },
    },
  });
};

// Custom error reporting with context
export const reportError = (error: Error, context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });
    }
    Sentry.captureException(error);
  });
};

// Add breadcrumbs for error context
export const addBreadcrumb = (
  message: string, 
  category: string, 
  level: 'info' | 'warning' | 'error' = 'info', 
  data?: Record<string, any>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
};
```

### Usage with ErrorBoundary

```typescript
// components/ErrorBoundary.tsx
import { reportError, addBreadcrumb } from '../utils/sentry';

class ErrorBoundary extends Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const eventId = this.state.errorId || generateEventId();
    
    // Add breadcrumb for error context
    addBreadcrumb(
      `Error boundary caught error: ${error.message}`,
      'error',
      'error',
      {
        errorId: eventId,
        level: this.props.level || 'component',
        componentStack: errorInfo.componentStack,
      }
    );

    // Report error to Sentry with context
    reportError(error, {
      errorBoundary: {
        errorId: eventId,
        level: this.props.level || 'component',
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        BUILD_SHA: BUILD_SHA_SHORT,
      }
    });
  }
}
```

---

## API Error Logging Pattern

### Code Example

```typescript
// api/_lib/middleware.ts

// Error logging middleware for API routes
export function logError(error: Error, req: Request, userId?: string): void {
  const logData = {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    request: {
      method: req.method,
      url: req.url,
      userId: userId || 'anonymous'
    }
  };
  
  // In production, send to error tracking service (e.g., Sentry)
  console.error('API Error:', JSON.stringify(logData));
}

// Usage in API route
export default async function handler(req: Request, res: Response) {
  try {
    // API logic here
    const result = await processRequest(req);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logError(error as Error, new Request(`https://bistrolens.com${req.url}`));
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
```

---

## Structured Console Logging Pattern

### Code Example

```typescript
// Structured logging for monitoring systems
// From components/ErrorBoundary.tsx

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  const eventId = this.state.errorId || generateEventId();
  const route = this.props.routeName || window.location.pathname;
  
  // CRITICAL: Structured log line for monitoring (no PII)
  console.error(`UI_ROUTE_ERROR`, JSON.stringify({
    eventId,
    route,
    message: error.message,
    level: this.props.level || 'component',
    BUILD_SHA: BUILD_SHA_SHORT,
    timestamp: new Date().toISOString()
  }));

  // CRITICAL: Log full error details to console for mobile debugging
  console.error('[ErrorBoundary] Component crashed:', {
    eventId,
    level: this.props.level || 'component',
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    BUILD_SHA: BUILD_SHA_SHORT,
    BUILD_TIME,
    timestamp: new Date().toISOString()
  });
}
```

---

## Graceful Degradation Pattern

### Code Example

```typescript
// From convex/bentoDataset.ts
// Log errors but return empty array instead of throwing

export const getBentoRecipes = query({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const requestId = generateRequestId();
    
    try {
      const recipes = await ctx.db
        .query("recipes")
        .filter(/* ... */)
        .take(safeLimit + 50);
      
      return recipes;
    } catch (dbError) {
      // Log the error for monitoring
      console.error(`[getBentoRecipes:${requestId}] Database query failed:`, dbError);
      
      // Return empty array instead of throwing - graceful degradation
      return [];
    }
  }
});
```

---

## Incident Logger Pattern (Security & Compliance)

### Code Example

```typescript
// services/incidentLoggerService.ts
// Specialized logger for security violations, safety blocks, and anomalies

import * as crypto from 'crypto';

interface IncidentLog {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'safety_violation' | 'model_mismatch' | 'generation_blocked' | 
        'storage_failure' | 'brand_detected' | 'age_gate_violation';
  description: string;
  context?: Record<string, any>;
  resolution?: string;
  resolvedAt?: Date;
}

class IncidentLoggerService {
  private incidents: Map<string, IncidentLog> = new Map();
  private listeners: Array<(incident: IncidentLog) => void> = [];
  
  /**
   * Log a new incident with automatic severity-based console logging
   */
  log(
    type: IncidentLog['type'],
    severity: IncidentLog['severity'],
    description: string,
    context?: Record<string, any>
  ): IncidentLog {
    const incident: IncidentLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      severity,
      type,
      description,
      context: context || {},
    };
    
    this.incidents.set(incident.id, incident);
    
    // Notify listeners (for real-time monitoring dashboards)
    for (const listener of this.listeners) {
      try {
        listener(incident);
      } catch (error) {
        console.error('[IncidentLogger] Listener error:', error);
      }
    }
    
    // Log to console based on severity
    if (severity === 'critical') {
      console.error(`[CRITICAL INCIDENT] ${type}: ${description}`, context);
    } else if (severity === 'high') {
      console.warn(`[HIGH INCIDENT] ${type}: ${description}`, context);
    }
    
    return incident;
  }
  
  /**
   * Specialized logging methods for different incident types
   */
  logSafetyViolation(description: string, prompt: string, violationType: string): IncidentLog {
    return this.log('safety_violation', 'high', description, { prompt, violationType });
  }
  
  logModelMismatch(requestedModel: string, description: string): IncidentLog {
    return this.log('model_mismatch', 'critical', description, { modelRequested: requestedModel });
  }
  
  logBlockedGeneration(prompt: string, reason: string, batchId?: string): IncidentLog {
    return this.log('generation_blocked', 'medium', reason, { prompt, batchId });
  }
  
  logStorageFailure(imageId: string, error: string): IncidentLog {
    return this.log('storage_failure', 'high', error, { imageId });
  }
  
  /**
   * Resolve an incident with resolution notes
   */
  resolve(incidentId: string, resolution: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;
    
    incident.resolution = resolution;
    incident.resolvedAt = new Date();
    return true;
  }
  
  /**
   * Get incidents with filtering
   */
  getAll(filter?: {
    severity?: IncidentLog['severity'];
    type?: IncidentLog['type'];
    startDate?: Date;
    endDate?: Date;
    resolved?: boolean;
    limit?: number;
  }): IncidentLog[] {
    let results = Array.from(this.incidents.values());
    
    if (filter) {
      if (filter.severity) {
        results = results.filter(i => i.severity === filter.severity);
      }
      if (filter.type) {
        results = results.filter(i => i.type === filter.type);
      }
      if (filter.resolved !== undefined) {
        results = results.filter(i => 
          filter.resolved ? i.resolvedAt !== undefined : i.resolvedAt === undefined
        );
      }
      if (filter.limit) {
        results = results.slice(0, filter.limit);
      }
    }
    
    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return results;
  }
  
  /**
   * Get critical unresolved incidents
   */
  getCritical(): IncidentLog[] {
    return this.getAll({ severity: 'critical', resolved: false });
  }
  
  /**
   * Export incidents for compliance auditing
   */
  exportCSV(filter?: any): string {
    const incidents = this.getAll(filter);
    
    const headers = ['id', 'timestamp', 'severity', 'type', 'description', 'resolved', 'resolvedAt', 'resolution'];
    
    const rows = incidents.map(i => [
      i.id,
      i.timestamp.toISOString(),
      i.severity,
      i.type,
      `"${i.description.replace(/"/g, '""')}"`,
      i.resolvedAt ? 'true' : 'false',
      i.resolvedAt?.toISOString() || '',
      i.resolution ? `"${i.resolution.replace(/"/g, '""')}"` : '',
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
  
  /**
   * Add listener for real-time monitoring
   */
  addListener(callback: (incident: IncidentLog) => void): void {
    this.listeners.push(callback);
  }
}

// Singleton export
export const incidentLoggerService = new IncidentLoggerService();
```

### Usage in Security-Critical Operations

```typescript
// Example: Image generation with safety checks
import { incidentLoggerService } from '../services/incidentLoggerService';

async function generateImage(prompt: string, modelId: string) {
  // Check for model mismatch (critical security issue)
  if (modelId !== ALLOWED_IMAGE_MODEL) {
    incidentLoggerService.logModelMismatch(
      modelId,
      `Attempted to use unauthorized model: ${modelId}`
    );
    throw new Error('Model not allowed');
  }
  
  // Check for safety violations
  const safetyCheck = await validatePrompt(prompt);
  if (!safetyCheck.safe) {
    incidentLoggerService.logSafetyViolation(
      'Unsafe prompt detected',
      prompt,
      safetyCheck.violationType
    );
    throw new Error('Prompt violates safety guidelines');
  }
  
  try {
    const result = await callImageAPI(prompt, modelId);
    return result;
  } catch (error) {
    incidentLoggerService.logStorageFailure(
      'image_gen_001',
      error.message
    );
    throw error;
  }
}

// Example: Real-time monitoring dashboard
incidentLoggerService.addListener((incident) => {
  if (incident.severity === 'critical') {
    // Send alert to security team
    sendSlackAlert(`🚨 Critical incident: ${incident.description}`);
  }
});

// Example: Compliance audit export
const auditReport = incidentLoggerService.exportCSV({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});
downloadFile('security-audit-2024.csv', auditReport);
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// 1. Logging without context
try {
  await fetchData();
} catch (error) {
  console.error(error); // No context, hard to debug
}

// 2. Swallowing errors silently
try {
  await processPayment();
} catch (error) {
  // Silent failure - no logging at all
}

// 3. Logging sensitive data
console.error('Payment failed:', {
  creditCard: user.creditCard, // PII leak!
  ssn: user.ssn // PII leak!
});

// 4. Not using error IDs
try {
  await generateRecipe();
} catch (error) {
  console.error('Failed to generate recipe');
  toast.error('Something went wrong'); // User can't report the issue
}

// 5. Logging in production without filtering
console.error(error); // Exposes stack traces to users in production

// 6. Not handling async errors
window.addEventListener('unhandledrejection', () => {
  // No logging - errors disappear
});

// 7. Duplicate error reporting
try {
  await fetchData();
} catch (error) {
  logError(error);
  reportError(error); // Already called by logError
  Sentry.captureException(error); // Triple reporting!
}

// 8. Not using specialized incident loggers for security events
try {
  await generateImage(prompt, modelId);
} catch (error) {
  console.error('Image generation failed:', error); // Generic logging for security issue
}

// 9. Logging incidents without severity classification
incidentLogger.log('something_happened', 'info', 'A thing occurred'); // No severity context

// 10. Not exporting audit trails for compliance
// No way to generate compliance reports for security incidents
```

### ✅ Do This Instead

```typescript
// 1. Log with rich context
try {
  await fetchData();
} catch (error) {
  logError(error as Error, {
    level: 'component',
    additionalData: {
      operation: 'fetch_data',
      userId: user?.id,
      timestamp: Date.now()
    }
  });
}

// 2. Always log errors, even if handled
try {
  await processPayment();
} catch (error) {
  const errorId = logError(error as Error, {
    level: 'critical',
    additionalData: { operation: 'payment_processing' }
  });
  
  // Show user-friendly message with error ID
  toast.error(`Payment failed. Error ID: ${errorId}`);
}

// 3. Sanitize sensitive data
console.error('Payment failed:', {
  userId: user.id,
  amount: payment.amount,
  lastFourDigits: user.creditCard.slice(-4), // Only last 4 digits
  // Never log full credit card, SSN, passwords, etc.
});

// 4. Always provide error IDs
try {
  await generateRecipe();
} catch (error) {
  const errorId = logError(error as Error, {
    level: 'component',
    additionalData: { operation: 'recipe_generation' }
  });
  
  toast.error(`Failed to generate recipe. Error ID: ${errorId}`);
}

// 5. Filter errors in production
if (process.env.NODE_ENV === 'development') {
  console.error('Full error:', error);
} else {
  console.error('Error occurred:', error.message); // Only message in production
}

// 6. Handle all async errors
window.addEventListener('unhandledrejection', (event) => {
  logError(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
    level: 'critical',
    additionalData: {
      type: 'promise_rejection',
      reason: event.reason
    }
  });
});

// 7. Single source of truth for error reporting
try {
  await fetchData();
} catch (error) {
  // logError handles both console logging AND external reporting
  const errorId = logError(error as Error, {
    level: 'component',
    additionalData: { operation: 'fetch_data' }
  });
}

// 8. Use specialized incident loggers for security events
try {
  await generateImage(prompt, modelId);
} catch (error) {
  if (error.code === 'MODEL_MISMATCH') {
    incidentLoggerService.logModelMismatch(modelId, error.message);
  } else if (error.code === 'SAFETY_VIOLATION') {
    incidentLoggerService.logSafetyViolation(error.message, prompt, error.violationType);
  } else {
    logError(error as Error, { level: 'component' });
  }
}

// 9. Always classify incident severity
incidentLoggerService.log(
  'model_mismatch',
  'critical', // Clear severity classification
  'Unauthorized model access attempt',
  { modelRequested: 'gpt-4', userId: user.id }
);

// 10. Export audit trails for compliance
const auditReport = incidentLoggerService.exportCSV({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  severity: 'critical'
});
await uploadToComplianceSystem(auditReport);
```

---

## When to Use This Pattern

✅ **Use for:**
- All production applications that need error monitoring
- Applications with complex user flows where debugging is difficult
- Mobile web apps where console access is limited
- Applications that need to track error trends over time
- Multi-tenant applications where you need to isolate errors by user
- Applications with external service integrations (Sentry, LogRocket, etc.)
- Applications that need to retry failed operations
- Applications where users need to report bugs with error IDs
- **Security-critical applications** that need incident tracking and compliance auditing (use IncidentLogger)
- **AI/ML applications** that need to log safety violations and model mismatches
- **Applications with regulatory requirements** that need audit trails

❌ **Don't use for:**
- Simple prototypes or demos
- Applications where all errors should crash the app
- Environments where localStorage is not available
- Applications with strict privacy requirements that prohibit error logging

---

## Benefits

1. **Centralized Error Management**: Single source of truth for all error logging
2. **Persistence**: Errors are saved to localStorage and survive page reloads
3. **Rich Context**: Captures user agent, URL, session ID, and custom data
4. **Global Error Handling**: Automatically catches unhandled errors and promise rejections
5. **Development-Friendly**: Grouped console logs in development for easy debugging
6. **Production-Ready**: Automatic reporting to external services in production
7. **Error IDs**: Unique IDs for each error make bug reports actionable
8. **Retry Logic**: Can retry failed error reports to ensure nothing is lost
9. **Error Statistics**: Track error trends by level, time, and reporting status
10. **Graceful Degradation**: Fallback to beacon API if fetch fails
11. **Specialized Loggers**: Domain-specific logging functions (AI, network, user actions)
12. **Sentry Integration**: Professional error tracking with session replay and performance monitoring
13. **Privacy-Conscious**: Filters out PII and sensitive data before reporting
14. **Mobile-Friendly**: Structured logs work well with mobile debugging tools
15. **Incident Tracking**: Specialized incident logger for security violations and compliance
16. **Real-time Monitoring**: Listener pattern enables live dashboards and alerts
17. **Audit Trail**: CSV export for compliance and regulatory requirements
18. **Severity-Based Routing**: Automatic console logging based on incident severity

---

## Related Patterns

- See `error-boundaries.md` for React error boundary patterns
- See `error-messages.md` for user-facing error message patterns
- See `retry-logic.md` for error recovery patterns
- See `../01-convex-patterns/error-handling.md` for Convex-specific error handling

---

*Extracted: 2026-02-18*
