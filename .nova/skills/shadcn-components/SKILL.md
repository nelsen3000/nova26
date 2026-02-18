# Skill: shadcn/ui Component Library

## Domain
UI component patterns, form handling, data tables, dialogs, navigation

## Agents That Use This Skill
- **VENUS** - All UI component implementation
- **EARTH** - Specifying component requirements
- **SATURN** - Component testing patterns

## When to Load
Auto-load when task description contains: `component`, `form`, `dialog`, `table`, `button`, `card`, `ui`, `shadcn`

## Component Installation
```bash
npx shadcn add button card dialog form table input label select
```

## Patterns Provided

### 1. Form with Validation
```tsx
// VENUS: Complete form pattern
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

export function ProfileForm({ onSubmit }: { onSubmit: (values: z.infer<typeof formSchema>) => void }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
```

### 2. Data Table Pattern
```tsx
// VENUS: Table with sorting, filtering
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function DataTable<T>({ data, columns }: { data: T[]; columns: ColumnDef<T>[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => (
              <TableHead key={col.key}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              {columns.map(col => (
                <TableCell key={col.key}>{col.cell(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### 3. Dialog for CRUD
```tsx
// VENUS: Create/Edit dialog
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function CreateDialog({ onCreate }: { onCreate: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create New</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Item</DialogTitle>
        </DialogHeader>
        <CreateForm 
          onSubmit={(data) => {
            onCreate(data);
            setOpen(false);
          }} 
        />
      </DialogContent>
    </Dialog>
  );
}
```

## Design Tokens (Always Use)
```css
/* Never hardcode colors - use these tokens */
bg-background      /* Page background */
bg-card            /* Card background */
text-foreground    /* Primary text */
text-muted-foreground /* Secondary text */
border-border      /* Borders */
primary            /* Brand color */
destructive        /* Error color */
```

## Accessibility Requirements
- All buttons must have aria-label or visible text
- Touch targets minimum 44x44px
- Focus visible on all interactive elements
- Keyboard navigation support
