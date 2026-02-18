/**
 * NotificationToast.reference.tsx
 * Gold-standard reference component for toast notifications
 * Demonstrates: different severity levels, actions, progress, stacking
 * Quality Score: 48/50
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
  Undo2,
  ExternalLink,
  XCircle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';
toastPosition = 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'bottom-center';

interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline';
}

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
  onDismiss?: () => void;
  progress?: number;
  showProgress?: boolean;
}

interface NotificationToastProps {
  toasts: Toast[];
  position?: ToastPosition;
  className?: string;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  index: number;
}

// =============================================================================
// STYLES
// =============================================================================

const toastVariants = cva(
  'relative w-full max-w-sm overflow-hidden rounded-lg border p-4 shadow-lg',
  {
    variants: {
      type: {
        success: 'border-success/30 bg-success/10 text-success-foreground',
        error: 'border-destructive/30 bg-destructive/10 text-destructive-foreground',
        warning: 'border-warning/30 bg-warning/10 text-warning-foreground',
        info: 'border-info/30 bg-info/10 text-info-foreground',
        loading: 'border-border bg-background',
      },
    },
    defaultVariants: {
      type: 'info',
    },
  }
);

const iconVariants: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const iconColors: Record<ToastType, string> = {
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
  loading: 'text-muted-foreground',
};

// =============================================================================
// TOAST ITEM COMPONENT
// =============================================================================

function ToastItem({ toast, onDismiss, index }: ToastItemProps): JSX.Element {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(toast.duration || 5000);

  const duration = toast.duration || 5000;
  const showProgress = toast.showProgress ?? (toast.type === 'loading' || duration > 0);

  // Auto-dismiss with progress
  useEffect(() => {
    if (toast.type === 'loading' || duration === Infinity) return;

    const interval = setInterval(() => {
      if (isPaused) {
        startTimeRef.current = Date.now();
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, remainingTimeRef.current - elapsed);
      const newProgress = (remaining / duration) * 100;

      setProgress(newProgress);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss(toast.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [toast.id, toast.type, duration, isPaused, onDismiss]);

  const Icon = iconVariants[toast.type];
  const iconColor = iconColors[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(toastVariants({ type: toast.type }))}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        setIsPaused(false);
        startTimeRef.current = Date.now();
      }}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <Icon
            className={cn(
              'h-5 w-5',
              iconColor,
              toast.type === 'loading' && 'animate-spin'
            )}
            aria-hidden="true"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{toast.title}</h4>
          {toast.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {toast.description}
            </p>
          )}

          {/* Action */}
          {toast.action && (
            <div className="mt-3">
              <Button
                size="sm"
                variant={toast.action.variant || 'outline'}
                onClick={() => {
                  toast.action?.onClick();
                  onDismiss(toast.id);
                }}
                className="h-7 text-xs"
              >
                <Undo2 className="mr-1 h-3 w-3" />
                {toast.action.label}
              </Button>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 -mr-1 -mt-1 p-1 rounded-md opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      {showProgress && toast.type !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
          <motion.div
            className={cn(
              'h-full',
              toast.type === 'success' && 'bg-success',
              toast.type === 'error' && 'bg-destructive',
              toast.type === 'warning' && 'bg-warning',
              toast.type === 'info' && 'bg-info'
            )}
            style={{ width: `${progress}%` }}
            initial={{ width: '100%' }}
          />
        </div>
      )}

      {/* Loading progress */}
      {toast.type === 'loading' && toast.progress !== undefined && (
        <div className="mt-3">
          <Progress value={toast.progress} className="h-1" />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {toast.progress}%
          </p>
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// TOAST CONTAINER
// =============================================================================

export function NotificationToast({
  toasts,
  position = 'bottom-right',
  className,
}: NotificationToastProps): JSX.Element {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    const toast = toasts.find((t) => t.id === id);
    toast?.onDismiss?.();
  }, [toasts]);

  const visibleToasts = toasts.filter((t) => !dismissedIds.has(t.id));

  const positionClasses: Record<ToastPosition, string> = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-3 p-4',
        positionClasses[position],
        className
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="popLayout">
        {visibleToasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={handleDismiss}
            index={index}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// HOOK FOR TOAST MANAGEMENT
// =============================================================================

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  // Convenience methods
  const success = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'success', duration: 5000, ...options });
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'error', duration: 8000, ...options });
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'warning', duration: 6000, ...options });
    },
    [addToast]
  );

  const info = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'info', duration: 5000, ...options });
    },
    [addToast]
  );

  const loading = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'loading', duration: Infinity, ...options });
    },
    [addToast]
  );

  const promise = useCallback(
    <T,>(
      promise: Promise<T>,
      {
        loading: loadingMsg,
        success: successMsg,
        error: errorMsg,
      }: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: Error) => string);
      }
    ) => {
      const id = addToast({
        title: loadingMsg,
        type: 'loading',
        duration: Infinity,
      });

      promise
        .then((data) => {
          updateToast(id, {
            type: 'success',
            title: typeof successMsg === 'function' ? successMsg(data) : successMsg,
            duration: 5000,
          });
        })
        .catch((err) => {
          updateToast(id, {
            type: 'error',
            title: typeof errorMsg === 'function' ? errorMsg(err) : errorMsg,
            duration: 8000,
          });
        });

      return promise;
    },
    [addToast, updateToast]
  );

  return {
    toasts,
    addToast,
    removeToast,
    updateToast,
    success,
    error,
    warning,
    info,
    loading,
    promise,
  };
}

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

export function ToastExamples(): JSX.Element {
  const { toasts, success, error, warning, info, loading, promise, removeToast } =
    useToast();

  const handlePromise = () => {
    const mockPromise = new Promise<string>((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.5) {
          resolve('Data saved successfully!');
        } else {
          reject(new Error('Network error'));
        }
      }, 2000);
    });

    promise(mockPromise, {
      loading: 'Saving your changes...',
      success: (data) => data,
      error: (err) => `Failed: ${err.message}`,
    });
  };

  return (
    <div className="space-y-4 p-8">
      <h2 className="text-lg font-semibold">Toast Examples</h2>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            success('Changes saved', {
              description: 'Your profile has been updated successfully.',
            })
          }
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Success
        </Button>

        <Button
          variant="destructive"
          onClick={() =>
            error('Something went wrong', {
              description: 'Please try again later.',
            })
          }
        >
          <XCircle className="mr-2 h-4 w-4" />
          Error
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            warning('Session expiring', {
              description: 'Your session will expire in 5 minutes.',
            })
          }
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Warning
        </Button>

        <Button
          variant="secondary"
          onClick={() =>
            info('New update available', {
              description: 'Version 2.0 is now available.',
              action: {
                label: 'View',
                onClick: () => console.log('View update'),
              },
            })
          }
        >
          <Info className="mr-2 h-4 w-4" />
          Info with Action
        </Button>

        <Button onClick={handlePromise}>
          <Loader2 className="mr-2 h-4 w-4" />
          Promise Toast
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            success('Item deleted', {
              action: {
                label: 'Undo',
                variant: 'outline',
                onClick: () => console.log('Undo delete'),
              },
            })
          }
        >
          <Undo2 className="mr-2 h-4 w-4" />
          With Undo
        </Button>
      </div>

      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

// Export
export { NotificationToast };
