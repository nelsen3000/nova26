'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Hammer,
  Bot,
  Settings,
  Search,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const pages = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Builds', href: '/dashboard/builds', icon: Hammer },
  { label: 'Agents', href: '/dashboard/agents', icon: Bot },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const navigate = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          'hidden h-8 w-[220px] items-center justify-between rounded-md text-sm text-muted-foreground sm:flex md:w-[260px]'
        )}
      >
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
        </div>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Mobile search icon */}
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="sr-only">Search</span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages and actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <CommandItem
                key={page.href}
                onSelect={() => navigate(page.href)}
                className="gap-3"
              >
                <page.icon className="h-4 w-4" />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => navigate('/dashboard/builds')}>
              <Hammer className="mr-2 h-4 w-4" />
              View all builds
            </CommandItem>
            <CommandItem onSelect={() => navigate('/dashboard/agents')}>
              <Bot className="mr-2 h-4 w-4" />
              View all agents
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
