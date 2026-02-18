# Component Patterns Catalog
## Standard implementations for all UI components

---

## Buttons

### Button Variants

```tsx
// Primary - Main actions
<Button variant="default" size="default">
  Save Changes
</Button>

// Secondary - Alternative actions
<Button variant="secondary" size="default">
  Cancel
</Button>

// Outline - Less prominent
<Button variant="outline" size="default">
  Learn More
</Button>

// Ghost - Subtle, icon buttons
<Button variant="ghost" size="icon" aria-label="Close">
  <X className="h-4 w-4" />
</Button>

// Destructive - Dangerous actions
<Button variant="destructive" size="default">
  Delete
</Button>

// Link - Navigation style
<Button variant="link" size="default">
  View Details
</Button>
```

### Button Sizes

```tsx
<Button size="sm">Small</Button>      // 32px height
<Button size="default">Default</Button> // 40px height
<Button size="lg">Large</Button>      // 44px height
<Button size="icon">Icon</Button>     // Square, icon only
```

### Button States

```tsx
<Button 
  className="
    // Default
    bg-primary text-primary-foreground
    // Hover
    hover:bg-primary/90
    // Active/Pressed
    active:scale-[0.98] active:bg-primary/80
    // Focus
    focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
    // Disabled
    disabled:opacity-50 disabled:pointer-events-none
    // Loading
    data-[loading=true]:opacity-70
  "
  disabled={isLoading}
  data-loading={isLoading}
>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isLoading ? 'Saving...' : 'Save'}
</Button>
```

### Button Patterns

```tsx
// With icon
<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add Item
</Button>

// Icon only (must have aria-label)
<Button size="icon" aria-label="Delete item">
  <Trash2 className="h-4 w-4" />
</Button>

// Loading state
<Button disabled={isPending}>
  {isPending ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Saving...
    </>
  ) : (
    'Save'
  )}
</Button>

// As link
<Button variant="link" asChild>
  <a href="/docs">View Documentation</a>
</Button>
```

---

## Forms

### Input Field

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    className="
      h-10
      focus-visible:ring-2 focus-visible:ring-ring
    "
  />
  <p className="text-sm text-muted-foreground">
    We'll never share your email.
  </p>
</div>
```

### Input with Error

```tsx
<div className="space-y-2">
  <Label htmlFor="email" className="text-destructive">
    Email
  </Label>
  <Input
    id="email"
    type="email"
    aria-invalid="true"
    aria-describedby="email-error"
    className="border-destructive focus-visible:ring-destructive"
  />
  <p id="email-error" className="text-sm text-destructive">
    Please enter a valid email address.
  </p>
</div>
```

### Select Dropdown

```tsx
<div className="space-y-2">
  <Label htmlFor="role">Role</Label>
  <Select>
    <SelectTrigger id="role" className="w-full">
      <SelectValue placeholder="Select a role" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Team Roles</SelectLabel>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="editor">Editor</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</div>
```

### Textarea

```tsx
<div className="space-y-2">
  <Label htmlFor="description">Description</Label>
  <Textarea
    id="description"
    placeholder="Enter description..."
    rows={4}
    className="resize-none"
  />
  <p className="text-sm text-muted-foreground">
    {description.length}/500 characters
  </p>
</div>
```

### Checkbox

```tsx
<div className="flex items-start space-x-2">
  <Checkbox id="terms" />
  <div className="grid gap-1.5 leading-none">
    <Label htmlFor="terms" className="text-sm font-medium">
      Accept terms
    </Label>
    <p className="text-sm text-muted-foreground">
      You agree to our Terms of Service and Privacy Policy.
    </p>
  </div>
</div>
```

### Radio Group

```tsx
<RadioGroup defaultValue="comfortable" className="space-y-2">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="default" id="r1" />
    <Label htmlFor="r1">Default</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="comfortable" id="r2" />
    <Label htmlFor="r2">Comfortable</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="compact" id="r3" />
    <Label htmlFor="r3">Compact</Label>
  </div>
</RadioGroup>
```

### Switch

```tsx
<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <Label htmlFor="notifications">Notifications</Label>
    <p className="text-sm text-muted-foreground">
      Receive email notifications
    </p>
  </div>
  <Switch id="notifications" />
</div>
```

### Form Layout Patterns

```tsx
// Single column (mobile-first)
<form className="space-y-6">
  <div className="space-y-2">
    <Label>Name</Label>
    <Input />
  </div>
  <div className="space-y-2">
    <Label>Email</Label>
    <Input />
  </div>
  <Button type="submit">Submit</Button>
</form>

// Two column (desktop)
<form className="space-y-6">
  <div className="grid gap-4 md:grid-cols-2">
    <div className="space-y-2">
      <Label>First Name</Label>
      <Input />
    </div>
    <div className="space-y-2">
      <Label>Last Name</Label>
      <Input />
    </div>
  </div>
  <Button type="submit">Submit</Button>
</form>

// With actions
<form className="space-y-6">
  {/* Form fields */}
  <div className="flex items-center justify-between border-t pt-6">
    <Button type="button" variant="outline" onClick={onCancel}>
      Cancel
    </Button>
    <Button type="submit" disabled={isPending}>
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Save Changes
    </Button>
  </div>
</form>
```

---

## Cards

### Basic Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here.</p>
  </CardContent>
  <CardFooter className="flex justify-between">
    <Button variant="ghost">Cancel</Button>
    <Button>Continue</Button>
  </CardFooter>
</Card>
```

### Card with Actions

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <div className="space-y-1">
      <CardTitle className="text-sm font-medium">
        Total Revenue
      </CardTitle>
      <CardDescription>
        +20.1% from last month
      </CardDescription>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>View details</DropdownMenuItem>
        <DropdownMenuItem>Export</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">$45,231.89</div>
  </CardContent>
</Card>
```

### Stats Card

```tsx
<Card>
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Active Users
        </p>
        <p className="mt-1 text-3xl font-bold">2,345</p>
      </div>
      <div className="rounded-full bg-primary/10 p-3">
        <Users className="h-5 w-5 text-primary" />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      <TrendingUp className="mr-1 h-4 w-4 text-success" />
      <span className="text-success font-medium">+12.5%</span>
      <span className="ml-2 text-muted-foreground">
        from last month
      </span>
    </div>
  </CardContent>
</Card>
```

---

## Tables

### Data Table

```tsx
<div className="rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="w-[100px]">ID</TableHead>
        <TableHead>Name</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="font-medium">{item.id}</TableCell>
          <TableCell>{item.name}</TableCell>
          <TableCell>
            <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
              {item.status}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>View</DropdownMenuItem>
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### Table with Empty State

```tsx
{items.length === 0 ? (
  <div className="flex h-64 flex-col items-center justify-center rounded-md border border-dashed">
    <div className="rounded-full bg-muted p-3">
      <Inbox className="h-6 w-6 text-muted-foreground" />
    </div>
    <h3 className="mt-4 text-sm font-medium">No items found</h3>
    <p className="mt-1 text-sm text-muted-foreground">
      Get started by creating a new item.
    </p>
    <Button className="mt-4">
      <Plus className="mr-2 h-4 w-4" />
      Create Item
    </Button>
  </div>
) : (
  <Table>...</Table>
)}
```

---

## Modals & Dialogs

### Alert Dialog (Confirmation)

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete the
        item and remove it from our servers.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Dialog (Forms)

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Edit Profile</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogDescription>
        Make changes to your profile here.
      </DialogDescription>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" defaultValue="John Doe" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" defaultValue="@johndoe" />
      </div>
    </div>
    <DialogFooter>
      <Button type="submit">Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Badges

```tsx
// Default
<Badge>Default</Badge>

// Variants
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Destructive</Badge>

// With icon
<Badge>
  <Check className="mr-1 h-3 w-3" />
  Active
</Badge>

// Status badges
<Badge className="bg-success text-success-foreground">Online</Badge>
<Badge className="bg-warning text-warning-foreground">Pending</Badge>
<Badge className="bg-destructive text-destructive-foreground">Failed</Badge>
<Badge variant="secondary">Offline</Badge>
```

---

## Toasts

### Toast Usage

```tsx
import { toast } from "sonner";

// Simple toast
toast("Event has been created");

// With description
toast("Event has been created", {
  description: "Sunday, December 03, 2023 at 9:00 AM",
});

// Success toast
toast.success("Profile updated successfully");

// Error toast
toast.error("Failed to update profile", {
  description: "Please try again later.",
});

// Promise toast
const promise = () => new Promise((resolve) => setTimeout(resolve, 2000));

toast.promise(promise, {
  loading: "Updating profile...",
  success: "Profile updated",
  error: "Failed to update",
});

// With action
toast("Message sent", {
  action: {
    label: "Undo",
    onClick: () => console.log("Undo"),
  },
});
```

---

## Dropdown Menus

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <DropdownMenuItem>
        <User className="mr-2 h-4 w-4" />
        <span>Profile</span>
        <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Settings className="mr-2 h-4 w-4" />
        <span>Settings</span>
        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <DropdownMenuItem disabled>
        <Keyboard className="mr-2 h-4 w-4" />
        <span>Keyboard shortcuts</span>
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-destructive">
      <LogOut className="mr-2 h-4 w-4" />
      <span>Log out</span>
      <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Navigation

### Sidebar Navigation

```tsx
<nav className="flex flex-col gap-2">
  <Link
    href="/dashboard"
    className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      pathname === "/dashboard"
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
  >
    <Home className="h-4 w-4" />
    Dashboard
  </Link>
  <Link
    href="/projects"
    className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      pathname === "/projects"
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
  >
    <Folder className="h-4 w-4" />
    Projects
  </Link>
</nav>
```

### Breadcrumbs

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/products">Products</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Edit Product</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

---

## Empty States

### Generic Empty State

```tsx
<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
  <div className="rounded-full bg-muted p-4">
    <Inbox className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="mt-6 text-lg font-semibold">No items yet</h3>
  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
    Get started by creating your first item. You can manage all your items from here.
  </p>
  <Button className="mt-6">
    <Plus className="mr-2 h-4 w-4" />
    Create Item
  </Button>
</div>
```

### Search Empty State

```tsx
<div className="flex flex-col items-center justify-center p-12 text-center">
  <div className="rounded-full bg-muted p-4">
    <Search className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="mt-6 text-lg font-semibold">No results found</h3>
  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
    We couldn't find anything matching "{searchQuery}". Try different keywords.
  </p>
  <Button variant="outline" className="mt-6" onClick={clearSearch}>
    Clear Search
  </Button>
</div>
```

---

## Error States

### Error Boundary Fallback

```tsx
<div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
  <div className="rounded-full bg-destructive/20 p-4">
    <AlertTriangle className="h-8 w-8 text-destructive" />
  </div>
  <h3 className="mt-6 text-lg font-semibold text-destructive">
    Something went wrong
  </h3>
  <p className="mt-2 max-w-md text-sm text-muted-foreground">
    {error.message || "An unexpected error occurred. Please try again."}
  </p>
  <div className="mt-6 flex gap-4">
    <Button variant="outline" onClick={reset}>
      Try Again
    </Button>
    <Button variant="secondary" onClick={() => window.location.reload()}>
      Reload Page
    </Button>
  </div>
</div>
```

### Inline Error

```tsx
<div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
  <div className="flex items-start gap-3">
    <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
    <div>
      <h4 className="font-medium text-destructive">Error loading data</h4>
      <p className="mt-1 text-sm text-destructive/80">
        {error.message}
      </p>
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-3 border-destructive/50 hover:bg-destructive/20"
        onClick={refetch}
      >
        <RefreshCw className="mr-2 h-3 w-3" />
        Retry
      </Button>
    </div>
  </div>
</div>
```

---

## Loading Skeletons

### Card Skeleton

```tsx
<Card>
  <CardHeader>
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-4 w-1/2" />
  </CardHeader>
  <CardContent className="space-y-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-4/5" />
    <Skeleton className="h-4 w-3/4" />
  </CardContent>
  <CardFooter>
    <Skeleton className="h-10 w-24" />
  </CardFooter>
</Card>
```

### List Skeleton

```tsx
<div className="space-y-4">
  {Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-8" />
    </div>
  ))}
</div>
```

### Stats Card Skeleton

```tsx
<Card>
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-12 w-12 rounded-full" />
    </div>
    <div className="mt-4 flex items-center gap-2">
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-24" />
    </div>
  </CardContent>
</Card>
```
