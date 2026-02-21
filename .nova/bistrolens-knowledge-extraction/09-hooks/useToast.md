# useToast Hook

## Source
Extracted from BistroLens `.nova/reference-components/NotificationToast.reference.tsx`

---

## Pattern: Toast Notification Management Hook

A comprehensive React hook for managing toast notifications with support for multiple severity levels (success, error, warning, info, loading), actions, progress tracking, and promise-based notifications. Provides a clean API for displaying temporary user feedback.

---

## Core Hook Implementation

### Types

```typescript
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
```

### Hook Code

```typescript
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

  // Convenience methods for different toast types
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
```

---

## Usage Examples

### Basic Success Toast

```typescript
function SaveButton() {
  const { success } = useToast();

  const handleSave = async () => {
    await saveData();
    success('Changes saved', {
      description: 'Your profile has been updated successfully.',
    });
  };

  return <Button onClick={handleSave}>Save</Button>;
}
```

### Error Toast with Description

```typescript
function DeleteButton() {
  const { error } = useToast();

  const handleDelete = async () => {
    try {
      await deleteItem();
    } catch (err) {
      error('Something went wrong', {
        description: 'Please try again later.',
      });
    }
  };

  return <Button onClick={handleDelete}>Delete</Button>;
}
```

### Toast with Action (Undo)

```typescript
function DeleteWithUndo() {
  const { success } = useToast();

  const handleDelete = async (itemId: string) => {
    await deleteItem(itemId);
    
    success('Item deleted', {
      action: {
        label: 'Undo',
        variant: 'outline',
        onClick: () => restoreItem(itemId),
      },
    });
  };

  return <Button onClick={() => handleDelete('123')}>Delete</Button>;
}
```

### Promise-Based Toast

```typescript
function SaveForm() {
  const { promise } = useToast();

  const handleSubmit = async (data: FormData) => {
    // Automatically shows loading, then success/error based on promise result
    await promise(saveFormData(data), {
      loading: 'Saving your changes...',
      success: 'Data saved successfully!',
      error: (err) => `Failed: ${err.message}`,
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Dynamic Success Message

```typescript
function UploadFile() {
  const { promise } = useToast();

  const handleUpload = async (file: File) => {
    await promise(uploadFile(file), {
      loading: 'Uploading file...',
      success: (data) => `${data.filename} uploaded successfully!`,
      error: (err) => `Upload failed: ${err.message}`,
    });
  };

  return <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />;
}
```

### Manual Toast Management

```typescript
function ManualControl() {
  const { addToast, updateToast, removeToast } = useToast();

  const handleLongOperation = async () => {
    // Add loading toast
    const toastId = addToast({
      title: 'Processing...',
      type: 'loading',
      duration: Infinity,
      showProgress: true,
    });

    // Update progress
    for (let i = 0; i <= 100; i += 10) {
      await delay(200);
      updateToast(toastId, { progress: i });
    }

    // Update to success
    updateToast(toastId, {
      type: 'success',
      title: 'Complete!',
      duration: 3000,
    });
  };

  return <Button onClick={handleLongOperation}>Start</Button>;
}
```

### Warning Toast

```typescript
function SessionWarning() {
  const { warning } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      warning('Session expiring', {
        description: 'Your session will expire in 5 minutes.',
        duration: 10000,
      });
    }, 25 * 60 * 1000); // 25 minutes

    return () => clearTimeout(timer);
  }, [warning]);

  return null;
}
```

### Info Toast with Action

```typescript
function UpdateNotification() {
  const { info } = useToast();

  const notifyUpdate = () => {
    info('New update available', {
      description: 'Version 2.0 is now available.',
      action: {
        label: 'View',
        onClick: () => window.open('/changelog', '_blank'),
      },
      duration: 15000,
    });
  };

  return <Button onClick={notifyUpdate}>Check Updates</Button>;
}
```

---

## Anti-Patterns

### ❌ Don't Create Multiple Hook Instances

```typescript
// BAD: Each component creates its own toast state
function ComponentA() {
  const { success } = useToast(); // Separate state
  return <Button onClick={() => success('A')}>A</Button>;
}

function ComponentB() {
  const { success } = useToast(); // Different state
  return <Button onClick={() => success('B')}>B</Button>;
}
```

### ✅ Use Context Provider for Global State

```typescript
// GOOD: Single toast state shared across app
const ToastContext = createContext<ReturnType<typeof useToast> | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <NotificationToast toasts={toast.toasts} />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToastContext must be used within ToastProvider');
  return context;
}
```

### ❌ Don't Forget to Handle Errors in Promise Toasts

```typescript
// BAD: Unhandled promise rejection
function BadSubmit() {
  const { promise } = useToast();
  
  const handleSubmit = () => {
    promise(submitData(), {
      loading: 'Submitting...',
      success: 'Done!',
      // Missing error handler - promise rejection not caught
    });
  };
}
```

### ✅ Always Provide Error Messages

```typescript
// GOOD: Complete error handling
function GoodSubmit() {
  const { promise } = useToast();
  
  const handleSubmit = () => {
    promise(submitData(), {
      loading: 'Submitting...',
      success: 'Submitted successfully!',
      error: (err) => `Submission failed: ${err.message}`,
    });
  };
}
```

### ❌ Don't Use Infinite Duration for Non-Loading Toasts

```typescript
// BAD: Success toast stays forever
function BadSuccess() {
  const { addToast } = useToast();
  
  addToast({
    title: 'Success!',
    type: 'success',
    duration: Infinity, // User must manually dismiss
  });
}
```

### ✅ Use Appropriate Durations

```typescript
// GOOD: Auto-dismiss with sensible duration
function GoodSuccess() {
  const { success } = useToast();
  
  success('Success!', {
    duration: 5000, // Auto-dismiss after 5 seconds
  });
}
```

### ❌ Don't Show Too Many Toasts Simultaneously

```typescript
// BAD: Spam user with multiple toasts
function BadBulkAction() {
  const { success } = useToast();
  
  items.forEach(item => {
    success(`Processed ${item.name}`); // 100 toasts!
  });
}
```

### ✅ Batch Operations into Single Toast

```typescript
// GOOD: Single summary toast
function GoodBulkAction() {
  const { success } = useToast();
  
  await processItems(items);
  success(`Processed ${items.length} items`, {
    description: 'All items have been updated successfully.',
  });
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Form submission feedback (success/error)
- Async operation status (loading → success/error)
- User action confirmations ("Item deleted")
- Undo/redo actions with action buttons
- Session warnings and notifications
- File upload progress
- Background task completion
- Non-critical alerts that auto-dismiss

❌ **Don't use for:**
- Critical errors requiring user acknowledgment (use modal instead)
- Complex forms with multiple validation errors (use inline validation)
- Permanent status indicators (use status badges)
- Navigation confirmations (use confirmation dialogs)
- Long-form content (use dedicated notification center)
- Errors that require user action to resolve (use error boundaries)

---

## Benefits

1. **Unified API**: Single hook provides all toast functionality
2. **Type Safety**: Full TypeScript support with proper types
3. **Promise Integration**: Automatic loading → success/error flow
4. **Flexible Actions**: Support for undo, retry, and custom actions
5. **Auto-Dismiss**: Configurable durations with sensible defaults
6. **Progress Tracking**: Built-in support for progress indicators
7. **Accessibility**: Proper ARIA attributes and keyboard support
8. **Stacking**: Multiple toasts stack gracefully
9. **Pause on Hover**: Auto-dismiss pauses when user hovers
10. **Customizable**: Supports descriptions, actions, and custom durations

---

## Related Patterns

- See `toast-notifications.md` for the UI component implementation
- See `error-messages.md` for error message best practices
- See `loading-states.md` for loading indicator patterns
- See `form-submission.md` for form feedback patterns
- See `error-handling.md` for comprehensive error handling strategies

---

*Extracted: 2026-02-18*
