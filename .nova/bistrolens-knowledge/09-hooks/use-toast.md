# useToast Hook Pattern

## Source
Extracted from BistroLens `.nova/reference-components/NotificationToast.reference.tsx` and `App.tsx`

---

## Pattern: Toast Notification Management Hook

A comprehensive React hook that manages toast notifications with support for multiple severity levels, auto-dismiss timers, progress indicators, actions, and promise-based workflows. This pattern provides a complete notification system with both simple and advanced use cases.

---

## Core Implementation

### Hook Structure

```typescript
/**
 * Toast Management Hook
 * Provides methods for displaying toast notifications with various types and features
 */

import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

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

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Add a new toast
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  // Remove a toast by ID
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Update an existing toast
  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  // Convenience method: Success toast
  const success = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'success', duration: 5000, ...options });
    },
    [addToast]
  );

  // Convenience method: Error toast
  const error = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'error', duration: 8000, ...options });
    },
    [addToast]
  );

  // Convenience method: Warning toast
  const warning = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'warning', duration: 6000, ...options });
    },
    [addToast]
  );

  // Convenience method: Info toast
  const info = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'info', duration: 5000, ...options });
    },
    [addToast]
  );

  // Convenience method: Loading toast (infinite duration)
  const loading = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) => {
      return addToast({ title, type: 'loading', duration: Infinity, ...options });
    },
    [addToast]
  );

  // Promise-based toast workflow
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
      // Show loading toast
      const id = addToast({
        title: loadingMsg,
        type: 'loading',
        duration: Infinity,
      });

      // Update toast based on promise result
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
```

---

## Usage Examples

### Basic Toast Notifications

```typescript
import { useToast } from '@/hooks/useToast';
import { NotificationToast } from '@/components/NotificationToast';

export function MyComponent() {
  const { toasts, success, error, warning, info } = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      success('Changes saved', {
        description: 'Your profile has been updated successfully.'
      });
    } catch (err) {
      error('Something went wrong', {
        description: 'Please try again later.'
      });
    }
  };

  const handleWarning = () => {
    warning('Session expiring', {
      description: 'Your session will expire in 5 minutes.'
    });
  };

  const handleInfo = () => {
    info('New update available', {
      description: 'Version 2.0 is now available.'
    });
  };

  return (
    <>
      <button onClick={handleSave}>Save</button>
      <button onClick={handleWarning}>Show Warning</button>
      <button onClick={handleInfo}>Show Info</button>

      {/* Render toast container */}
      <NotificationToast toasts={toasts} position="bottom-right" />
    </>
  );
}
```

### Toast with Action Button

```typescript
export function DeleteItemComponent() {
  const { toasts, success, removeToast } = useToast();
  const [deletedItem, setDeletedItem] = useState(null);

  const handleDelete = (item: any) => {
    setDeletedItem(item);

    success('Item deleted', {
      action: {
        label: 'Undo',
        variant: 'outline',
        onClick: () => {
          // Restore the deleted item
          restoreItem(item);
          console.log('Undo delete');
        }
      }
    });
  };

  return (
    <>
      <button onClick={() => handleDelete(item)}>Delete</button>
      <NotificationToast toasts={toasts} />
    </>
  );
}
```

### Promise-Based Toast Workflow

```typescript
export function DataFetchComponent() {
  const { toasts, promise } = useToast();

  const handleFetchData = async () => {
    const fetchPromise = fetch('/api/data').then(res => res.json());

    // Automatically shows loading, then success or error
    await promise(fetchPromise, {
      loading: 'Fetching data...',
      success: (data) => `Loaded ${data.items.length} items`,
      error: (err) => `Failed: ${err.message}`
    });
  };

  return (
    <>
      <button onClick={handleFetchData}>Fetch Data</button>
      <NotificationToast toasts={toasts} />
    </>
  );
}
```

### Simple Toast Pattern (BistroLens App.tsx)

```typescript
// Simplified toast for basic use cases
export function SimplifiedToastExample() {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);

  const showToast = (message: string) => {
    const id = Date.now();
    setToast({ message, id });

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToast(current => current?.id === id ? null : current);
    }, 3000);
  };

  const handleFavorite = () => {
    // Add to favorites logic
    showToast("Saved to favorites!");
  };

  const handleMealLog = () => {
    // Log meal logic
    showToast("Meal logged!");
  };

  return (
    <>
      <button onClick={handleFavorite}>Add to Favorites</button>
      <button onClick={handleMealLog}>Log Meal</button>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-black text-white px-4 py-2 rounded-lg">
          {toast.message}
        </div>
      )}
    </>
  );
}
```

### Loading Toast with Progress

```typescript
export function UploadComponent() {
  const { toasts, addToast, updateToast } = useToast();

  const handleUpload = async (file: File) => {
    // Create loading toast
    const toastId = addToast({
      title: 'Uploading file...',
      type: 'loading',
      duration: Infinity,
      showProgress: true,
      progress: 0
    });

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      updateToast(toastId, { progress: i });
    }

    // Update to success
    updateToast(toastId, {
      type: 'success',
      title: 'Upload complete!',
      duration: 5000
    });
  };

  return (
    <>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      <NotificationToast toasts={toasts} />
    </>
  );
}
```

### Multiple Toast Positions

```typescript
export function MultiPositionToasts() {
  const topToasts = useToast();
  const bottomToasts = useToast();

  const handleTopNotification = () => {
    topToasts.info('System notification', {
      description: 'This appears at the top'
    });
  };

  const handleBottomNotification = () => {
    bottomToasts.success('Action completed', {
      description: 'This appears at the bottom'
    });
  };

  return (
    <>
      <button onClick={handleTopNotification}>Top Toast</button>
      <button onClick={handleBottomNotification}>Bottom Toast</button>

      <NotificationToast toasts={topToasts.toasts} position="top-right" />
      <NotificationToast toasts={bottomToasts.toasts} position="bottom-right" />
    </>
  );
}
```

---

## Anti-Patterns

### Don't Create Multiple Toast Instances for Same Purpose

```typescript
// BAD: Creating new hook instance on every render
function MyComponent() {
  const toast = useToast(); // New instance each render

  return <button onClick={() => toast.success('Done')}>Click</button>;
}
```

### Do Use Hook at Component Level

```typescript
// GOOD: Single hook instance for component
function MyComponent() {
  const { toasts, success } = useToast();

  return (
    <>
      <button onClick={() => success('Done')}>Click</button>
      <NotificationToast toasts={toasts} />
    </>
  );
}
```

### Don't Forget to Render Toast Container

```typescript
// BAD: Hook without container - toasts won't display
function MyComponent() {
  const { success } = useToast();

  return <button onClick={() => success('Done')}>Click</button>;
  // Missing: <NotificationToast toasts={toasts} />
}
```

### Do Always Render the Container

```typescript
// GOOD: Hook with container
function MyComponent() {
  const { toasts, success } = useToast();

  return (
    <>
      <button onClick={() => success('Done')}>Click</button>
      <NotificationToast toasts={toasts} />
    </>
  );
}
```

### Don't Use Alerts or Console for User Feedback

```typescript
// BAD: Using browser alerts
const handleSave = () => {
  saveData();
  alert('Saved!'); // Blocks UI, poor UX
};

// BAD: Using console.log for user feedback
const handleDelete = () => {
  deleteItem();
  console.log('Deleted'); // User can't see this
};
```

### Do Use Toast Notifications

```typescript
// GOOD: Non-blocking toast notifications
const { success } = useToast();

const handleSave = () => {
  saveData();
  success('Saved!'); // Non-blocking, good UX
};

const handleDelete = () => {
  deleteItem();
  success('Item deleted'); // Visible to user
};
```

### Don't Manually Manage Toast IDs

```typescript
// BAD: Manually tracking toast IDs
const [toastId, setToastId] = useState(1);

const showToast = () => {
  const id = toastId;
  setToastId(id + 1);
  addToast({ id: id.toString(), title: 'Message' });
};
```

### Do Let Hook Generate IDs

```typescript
// GOOD: Hook generates unique IDs automatically
const { success } = useToast();

const showToast = () => {
  success('Message'); // ID generated internally
};
```

### Don't Show Too Many Toasts Simultaneously

```typescript
// BAD: Spamming user with toasts
const handleBulkAction = (items: any[]) => {
  items.forEach(item => {
    success(`Processed ${item.name}`); // 100 toasts!
  });
};
```

### Do Batch or Summarize Notifications

```typescript
// GOOD: Single summary toast
const handleBulkAction = (items: any[]) => {
  // Process items...
  success(`Processed ${items.length} items`);
};

// GOOD: Show progress with single updating toast
const handleBulkAction = async (items: any[]) => {
  const toastId = loading('Processing items...');

  // Process items...

  updateToast(toastId, {
    type: 'success',
    title: `Processed ${items.length} items`,
    duration: 5000
  });
};
```

### Don't Use Infinite Duration for Non-Loading Toasts

```typescript
// BAD: Success toast that never dismisses
success('Saved!', { duration: Infinity }); // User must manually close
```

### Do Use Appropriate Durations

```typescript
// GOOD: Auto-dismiss with appropriate timing
success('Saved!', { duration: 5000 }); // Auto-dismiss after 5s
error('Failed', { duration: 8000 }); // Errors stay longer
loading('Processing...', { duration: Infinity }); // Loading stays until updated
```

---

## When to Use This Pattern

**Use for:**
- User action feedback (save, delete, update)
- Async operation status (loading, success, error)
- Non-critical notifications (info, warnings)
- Undo/redo actions with action buttons
- Promise-based workflows (API calls, file uploads)
- Multi-step process feedback
- Session warnings (expiring, logged out)
- Real-time event notifications

**Don't use for:**
- Critical errors requiring user action (use modal dialogs)
- Form validation errors (use inline validation)
- Permanent status indicators (use status badges)
- Complex multi-action choices (use dialogs)
- Long-form content (use dedicated pages)
- Navigation feedback (use loading states)

---

## Benefits

1. **Flexible API**: Multiple convenience methods (success, error, warning, info, loading)
2. **Promise Integration**: Automatic loading to success/error workflow
3. **Action Support**: Built-in action buttons for undo/retry operations
4. **Progress Tracking**: Visual progress indicators for long operations
5. **Auto-Dismiss**: Configurable durations with pause-on-hover
6. **Type Safety**: Full TypeScript support with clear interfaces
7. **Accessible**: ARIA attributes for screen readers
8. **Customizable**: Supports descriptions, actions, and custom durations
9. **Non-Blocking**: Doesn't interrupt user workflow
10. **Stacking**: Multiple toasts display in sequence with animations

---

## Related Patterns

- See `../07-error-handling/error-messages.md` for error handling UX patterns
- See `../04-ui-components/loading-states.md` for loading indicator patterns
- See `../04-ui-components/modal-dialog.md` for critical user interactions
- See `../05-form-patterns/form-validation.md` for inline validation feedback
- See `../04-ui-components/button-variants.md` for action button styling
- See `use-local-storage.md` for persisting toast preferences

---

*Extracted: 2026-02-18*
