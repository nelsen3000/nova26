# UX Patterns
## Common interaction patterns for NOVA26

---

## Optimistic Updates

### Concept
Update UI immediately before server confirms, rollback on error.

```tsx
import { useMutation } from 'convex/react';

function useOptimisticToggle() {
  const toggle = useMutation(api.items.toggle);
  const [optimisticState, setOptimisticState] = useState(null);
  
  const handleToggle = async (id: string, currentValue: boolean) => {
    // Optimistically update
    setOptimisticState({ id, value: !currentValue });
    
    try {
      await toggle({ id });
    } catch (error) {
      // Rollback on error
      setOptimisticState(null);
      toast.error('Failed to update');
    }
  };
  
  return { optimisticState, handleToggle };
}

// Usage with Convex's built-in optimistic updates
function TodoItem({ todo }: { todo: Doc<'todos'> }) {
  const toggle = useMutation(api.todos.toggle).withOptimisticUpdate(
    (localStore, { id }) => {
      const todo = localStore.getQuery(api.todos.get, { id });
      if (todo !== undefined) {
        localStore.setQuery(api.todos.get, { id }, {
          ...todo,
          completed: !todo.completed,
        });
      }
    }
  );
  
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={todo.completed}
        onCheckedChange={() => toggle({ id: todo._id })}
      />
      <span className={todo.completed ? 'line-through text-muted-foreground' : ''}>
        {todo.title}
      </span>
    </div>
  );
}
```

### Visual Feedback

```tsx
// Show optimistic state visually
<div className={cn(
  "transition-opacity duration-200",
  isPending && "opacity-70"
)}>
  {content}
</div>

// Or with loading indicator
<div className="relative">
  {content}
  {isPending && (
    <div className="absolute inset-0 flex items-center justify-center bg-background/50">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  )}
</div>
```

---

## Infinite Scroll

### Implementation

```tsx
import { useInView } from 'react-intersection-observer';

function InfiniteItemList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.items.list,
    {},
    { initialNumItems: 10 }
  );
  
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });
  
  useEffect(() => {
    if (inView && status === 'CanLoadMore') {
      loadMore(10);
    }
  }, [inView, status, loadMore]);
  
  return (
    <div className="space-y-4">
      {results.map((item) => (
        <ItemCard key={item._id} item={item} />
      ))}
      
      {/* Loading trigger */}
      <div ref={ref} className="py-4">
        {status === 'LoadingMore' && (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {status === 'Exhausted' && results.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No more items
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## Command Palette (Cmd+K)

### Implementation

```tsx
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  
  // Open with Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
  
  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };
  
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Suggestions">
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard'))}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/settings'))}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => window.print())}>
            <Printer className="mr-2 h-4 w-4" />
            Print
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {/* copy */})}>
            <Copy className="mr-2 h-4 w-4" />
            Copy URL
            <CommandShortcut>⌘C</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

---

## Keyboard Shortcuts

### Hook

```tsx
function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options?: { ctrl?: boolean; shift?: boolean; alt?: boolean }
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const keyMatch = event.key.toLowerCase() === key.toLowerCase();
      const ctrlMatch = options?.ctrl ? event.ctrlKey || event.metaKey : true;
      const shiftMatch = options?.shift ? event.shiftKey : true;
      const altMatch = options?.alt ? event.altKey : true;
      
      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        callback();
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}

// Usage
useKeyboardShortcut('k', () => setOpen(true), { ctrl: true });
useKeyboardShortcut('s', () => saveDocument(), { ctrl: true });
useKeyboardShortcut('?', () => setHelpOpen(true));
```

### Display Shortcuts

```tsx
// Show shortcuts in UI
<div className="flex items-center gap-2 text-xs text-muted-foreground">
  <kbd className="rounded border bg-muted px-2 py-1 font-mono">⌘</kbd>
  <kbd className="rounded border bg-muted px-2 py-1 font-mono">K</kbd>
  <span>to search</span>
</div>
```

---

## Drag and Drop

### Sortable List

```tsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ item }: { item: Item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-3",
        isDragging && "shadow-lg ring-2 ring-primary opacity-50"
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
      <span className="flex-1">{item.title}</span>
    </div>
  );
}

function SortableList({ items: initialItems }: { items: Item[] }) {
  const [items, setItems] = useState(initialItems);
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
            <SortableItem key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

---

## Toast Notifications

### Toast System

```tsx
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Add Toaster to root layout
export default function RootLayout({ children }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" />
    </>
  );
}

// Usage patterns
toast.success('Item created successfully');

toast.error('Failed to create item', {
  description: 'Please try again later',
});

toast.promise(createItem(data), {
  loading: 'Creating item...',
  success: 'Item created!',
  error: 'Failed to create item',
});

toast.info('New update available', {
  action: {
    label: 'Refresh',
    onClick: () => window.location.reload(),
  },
});

// With undo
toast.success('Item deleted', {
  action: {
    label: 'Undo',
    onClick: () => restoreItem(id),
  },
});
```

### Custom Toast Content

```tsx
toast.custom((t) => (
  <div className="rounded-lg bg-background border p-4 shadow-lg">
    <div className="flex items-start gap-3">
      <Avatar>
        <AvatarImage src={user.image} />
        <AvatarFallback>{user.initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-medium">{user.name} commented</p>
        <p className="text-sm text-muted-foreground mt-1">
          {comment.text}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => toast.dismiss(t)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  </div>
));
```

---

## Auto-Save

### Form Auto-Save

```tsx
function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  options?: { delay?: number; onError?: (error: Error) => void }
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const save = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      await saveFn(data);
      setLastSaved(new Date());
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Save failed');
      setError(error);
      options?.onError?.(error);
    } finally {
      setIsSaving(false);
    }
  }, [data, saveFn, options]);
  
  useEffect(() => {
    const timer = setTimeout(save, options?.delay ?? 2000);
    return () => clearTimeout(timer);
  }, [data, save]);
  
  return { isSaving, lastSaved, error, save };
}

// Usage
function Editor({ document }: { document: Doc }) {
  const [content, setContent] = useState(document.content);
  
  const { isSaving, lastSaved } = useAutoSave(
    content,
    async (data) => {
      await saveDocument({ id: document._id, content: data });
    },
    { delay: 1000 }
  );
  
  return (
    <div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="text-sm text-muted-foreground">
        {isSaving ? 'Saving...' : lastSaved && `Saved ${formatRelativeTime(lastSaved)}`}
      </div>
    </div>
  );
}
```

---

## Real-Time Presence

### Who's Online

```tsx
import { useQuery } from 'convex/react';

function PresenceIndicator({ userId }: { userId: string }) {
  const presence = useQuery(api.presence.get, { userId });
  
  return (
    <div className="relative inline-block">
      <Avatar>
        <AvatarImage src={presence?.image} />
        <AvatarFallback>{presence?.initials}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background',
          presence?.status === 'online' && 'bg-success',
          presence?.status === 'away' && 'bg-warning',
          presence?.status === 'offline' && 'bg-muted'
        )}
      />
    </div>
  );
}

// Typing indicator
function TypingIndicator({ roomId }: { roomId: string }) {
  const typingUsers = useQuery(api.typing.get, { roomId });
  
  if (!typingUsers || typingUsers.length === 0) return null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="animate-bounce">.</span>
        <span className="animate-bounce [animation-delay:0.2s]">.</span>
        <span className="animate-bounce [animation-delay:0.4s]">.</span>
      </div>
      <span>
        {typingUsers.length === 1
          ? `${typingUsers[0].name} is typing`
          : `${typingUsers.length} people are typing`}
      </span>
    </div>
  );
}
```

---

## Error Retry

### Retry with Backoff

```tsx
function useRetryableQuery<T>(
  query: () => Promise<T>,
  options?: { maxRetries?: number; baseDelay?: number }
): { data: T | null; error: Error | null; retry: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const execute = useCallback(async () => {
    try {
      setError(null);
      const result = await query();
      setData(result);
      setRetryCount(0);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Query failed');
      setError(error);
      
      const maxRetries = options?.maxRetries ?? 3;
      if (retryCount < maxRetries) {
        const delay = (options?.baseDelay ?? 1000) * Math.pow(2, retryCount);
        setTimeout(() => {
          setRetryCount((c) => c + 1);
          execute();
        }, delay);
      }
    }
  }, [query, retryCount, options]);
  
  useEffect(() => {
    execute();
  }, [execute]);
  
  const retry = () => {
    setRetryCount(0);
    execute();
  };
  
  return { data, error, retry };
}

// Usage with UI
function DataComponent() {
  const { data, error, retry } = useRetryableQuery(fetchData);
  
  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-destructive mb-2">{error.message}</p>
        <Button onClick={retry} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }
  
  return data ? <Display data={data} /> : <Loading />;
}
```

---

## File Upload

### Drag & Drop Upload

```tsx
function FileUploader({ onUpload }: { onUpload: (files: File[]) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };
  
  const upload = async () => {
    setUploading(true);
    try {
      await onUpload(files);
      setFiles([]);
      toast.success('Files uploaded successfully');
    } catch {
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
      )}
    >
      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
      <p className="mt-4 text-sm font-medium">
        Drag and drop files here
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        or click to browse
      </p>
      <Input
        type="file"
        multiple
        className="hidden"
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        id="file-upload"
      />
      <label htmlFor="file-upload">
        <Button variant="outline" className="mt-4" asChild>
          <span>Select Files</span>
        </Button>
      </label>
      
      {files.length > 0 && (
        <div className="mt-6 text-left">
          <p className="text-sm font-medium mb-2">
            {files.length} file(s) selected
          </p>
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded bg-muted p-2 text-sm"
              >
                <span className="truncate">{file.name}</span>
                <span className="text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              </li>
            ))}
          </ul>
          <Button
            className="mt-4 w-full"
            onClick={upload}
            disabled={uploading}
          >
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload Files
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

## Pagination

### Cursor-Based Pagination

```tsx
function PaginatedList() {
  const [cursor, setCursor] = useState<string | null>(null);
  const { results, nextCursor, status } = usePaginatedQuery(
    api.items.list,
    { cursor },
    { initialNumItems: 20 }
  );
  
  return (
    <div>
      <div className="space-y-4">
        {results.map((item) => (
          <ItemCard key={item._id} item={item} />
        ))}
      </div>
      
      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {results.length} items
        </p>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCursor(null)}
            disabled={!cursor}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            First
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setCursor(nextCursor)}
            disabled={status !== 'CanLoadMore'}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## Confirmation Patterns

### Destructive Action Confirmation

```tsx
function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false);
  
  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setShowConfirm(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
      
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete
              the item and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Undo Pattern

```tsx
function useUndoableAction<T>(
  action: (item: T) => Promise<void>,
  undo: (item: T) => Promise<void>
) {
  const execute = async (item: T) => {
    await action(item);
    
    toast.success('Action completed', {
      action: {
        label: 'Undo',
        onClick: async () => {
          await undo(item);
          toast.success('Action undone');
        },
      },
    });
  };
  
  return { execute };
}
```
