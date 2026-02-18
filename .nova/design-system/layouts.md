# Layout Patterns
## Standard page layouts for NOVA26

---

## Dashboard Layout

### Standard Dashboard

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-background lg:block">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center border-b px-4">
            <Logo />
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 overflow-auto p-4">
            <SidebarNav />
          </nav>
          
          {/* User */}
          <div className="border-t p-4">
            <UserNav />
          </div>
        </div>
      </aside>
      
      {/* Mobile sidebar - Sheet */}
      <MobileSidebar />
      
      {/* Main content */}
      <main className="flex-1 lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-8">
          <MobileMenuButton />
          <BreadcrumbNav />
          <div className="ml-auto flex items-center gap-4">
            <SearchCommand />
            <Notifications />
            <ThemeToggle />
          </div>
        </header>
        
        {/* Page content */}
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

### Dashboard Page Structure

```tsx
// app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your account activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create New
          </Button>
        </div>
      </div>
      
      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Revenue" value="$45,231.89" change="+12.5%" />
        <StatCard title="Active Users" value="2,345" change="+8.2%" />
        <StatCard title="Sales" value="12,234" change="-3.1%" />
        <StatCard title="Active Now" value="573" change="+24" />
      </div>
      
      {/* Main content grid */}
      <div className="grid gap-8 lg:grid-cols-7">
        {/* Charts - takes 4/7 on large screens */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueChart />
            </CardContent>
          </Card>
        </div>
        
        {/* Recent activity - takes 3/7 on large screens */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityList />
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Data table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              You have 265 orders this month
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <OrdersTable />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Settings Layout

### Settings Page Pattern

```tsx
// app/settings/layout.tsx
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>
      
      {/* Settings layout with sidebar */}
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Settings navigation */}
        <aside className="lg:w-64">
          <nav className="flex flex-col gap-1">
            <SettingsNavItem href="/settings/profile" icon={User}>
              Profile
            </SettingsNavItem>
            <SettingsNavItem href="/settings/account" icon={Settings}>
              Account
            </SettingsNavItem>
            <SettingsNavItem href="/settings/notifications" icon={Bell}>
              Notifications
            </SettingsNavItem>
            <SettingsNavItem href="/settings/billing" icon={CreditCard}>
              Billing
            </SettingsNavItem>
            <SettingsNavItem href="/settings/team" icon={Users}>
              Team
            </SettingsNavItem>
            <SettingsNavItem href="/settings/integrations" icon={Plug}>
              Integrations
            </SettingsNavItem>
          </nav>
        </aside>
        
        {/* Settings content */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
```

### Settings Section Pattern

```tsx
// app/settings/profile/page.tsx
export default function ProfileSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your profile information and how others see you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.image} />
              <AvatarFallback>{user.initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Button variant="outline" size="sm">
                Change Avatar
              </Button>
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max 2MB.
              </p>
            </div>
          </div>
          
          <Separator />
          
          {/* Form fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" defaultValue={user.firstName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" defaultValue={user.lastName} />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={user.email} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Brief description for your profile. Max 500 characters.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-4 border-t px-6 py-4">
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </CardFooter>
      </Card>
      
      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="destructive">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## List/Detail Layout

### Master-Detail Pattern

```tsx
// List view
export default function ItemsPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] border rounded-lg overflow-hidden">
      {/* List panel */}
      <div className="w-full md:w-80 lg:w-96 border-r bg-muted/30 flex flex-col">
        {/* List header */}
        <div className="p-4 border-b bg-background">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Items</h2>
            <Button size="icon" variant="ghost">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items..." className="pl-8" />
          </div>
        </div>
        
        {/* List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 transition-colors",
                  selectedId === item.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={item.image} />
                  <AvatarFallback>{item.initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                  {item.status}
                </Badge>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </div>
      
      {/* Detail panel */}
      <div className="hidden md:flex flex-1 flex-col bg-background">
        {selectedItem ? (
          <ItemDetail item={selectedItem} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

// Detail component
function ItemDetail({ item }: { item: Item }) {
  return (
    <>
      {/* Detail header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={item.image} />
            <AvatarFallback>{item.initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold">{item.name}</h2>
            <p className="text-sm text-muted-foreground">
              Created {formatDate(item.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Detail content */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 max-w-2xl">
          <div>
            <h3 className="font-medium mb-2">Description</h3>
            <p className="text-muted-foreground">{item.description}</p>
          </div>
          
          <Separator />
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-medium mb-2">Status</h3>
              <Badge>{item.status}</Badge>
            </div>
            <div>
              <h3 className="font-medium mb-2">Category</h3>
              <p className="text-muted-foreground">{item.category}</p>
            </div>
          </div>
          
          {/* Tabs for more content */}
          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="activity" className="mt-4">
              <ActivityFeed itemId={item.id} />
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <ItemSettings item={item} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </>
  );
}
```

---

## Wizard/Multi-Step Layout

### Step Wizard

```tsx
interface WizardProps {
  steps: {
    id: string;
    title: string;
    description: string;
    component: React.ReactNode;
  }[];
}

export function Wizard({ steps }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const progress = ((currentStep + 1) / steps.length) * 100;
  
  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress header */}
      <div className="mb-8">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-muted-foreground">
              {steps[currentStep].title}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Step indicators */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex flex-col items-center",
                index > currentStep && "opacity-50"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  index < currentStep && "border-primary bg-primary text-primary-foreground",
                  index === currentStep && "border-primary text-primary",
                  index > currentStep && "border-muted-foreground text-muted-foreground"
                )}
              >
                {index < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span className="mt-2 hidden text-xs font-medium sm:block">
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>
            {steps[currentStep].description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {steps[currentStep].component}
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          {currentStep < steps.length - 1 ? (
            <Button onClick={() => setCurrentStep(s => s + 1)}>
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit}>
              Complete
              <Check className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
```

---

## Auth Pages

### Login Page

```tsx
export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Content */}
      <div className="hidden flex-1 flex-col justify-between bg-muted p-12 lg:flex">
        <div>
          <Logo className="h-8" />
        </div>
        <div className="space-y-4">
          <blockquote className="text-lg font-medium">
            "This platform has completely transformed how we work."
          </blockquote>
          <div>
            <p className="font-medium">Sarah Chen</p>
            <p className="text-sm text-muted-foreground">
              CTO at TechCorp
            </p>
          </div>
        </div>
      </div>
      
      {/* Right side - Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>
          
          <LoginForm />
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline">
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </Button>
            <Button variant="outline">
              <Google className="mr-2 h-4 w-4" />
              Google
            </Button>
          </div>
          
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Marketing Layouts

### Landing Page Sections

```tsx
// Hero Section
<section className="relative overflow-hidden py-24 lg:py-32">
  <div className="container mx-auto px-4">
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
      <div className="space-y-8">
        <Badge variant="secondary" className="w-fit">
          New: AI-Powered Features
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Build faster with{' '}
          <span className="text-primary">intelligent tools</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-lg">
          Streamline your workflow with our AI-powered platform. 
          Get more done in less time.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg" className="h-12 px-8">
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8">
            Watch Demo
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          No credit card required. 14-day free trial.
        </p>
      </div>
      <div className="relative">
        <HeroIllustration />
      </div>
    </div>
  </div>
</section>

// Features Grid
<section className="py-24 bg-muted/50">
  <div className="container mx-auto px-4">
    <div className="text-center max-w-2xl mx-auto mb-16">
      <h2 className="text-3xl font-bold tracking-tight mb-4">
        Everything you need
      </h2>
      <p className="text-lg text-muted-foreground">
        Powerful features to help you build better products faster
      </p>
    </div>
    
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.title} className="border-0 shadow-none bg-background">
          <CardContent className="p-6">
            <div className="rounded-lg bg-primary/10 p-3 w-fit mb-4">
              <feature.icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">
              {feature.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
</section>

// Pricing Section
<section className="py-24">
  <div className="container mx-auto px-4">
    <div className="text-center max-w-2xl mx-auto mb-16">
      <h2 className="text-3xl font-bold tracking-tight mb-4">
        Simple, transparent pricing
      </h2>
      <p className="text-lg text-muted-foreground">
        Choose the plan that's right for you
      </p>
    </div>
    
    <div className="grid gap-8 lg:grid-cols-3 max-w-6xl mx-auto">
      {plans.map((plan) => (
        <Card
          key={plan.name}
          className={cn(
            "flex flex-col",
            plan.popular && "border-primary shadow-lg scale-105"
          )}
        >
          {plan.popular && (
            <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-medium">
              Most Popular
            </div>
          )}
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="mb-6">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              variant={plan.popular ? 'default' : 'outline'}
            >
              Get Started
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  </div>
</section>
```
