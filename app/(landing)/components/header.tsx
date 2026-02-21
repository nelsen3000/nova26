/**
 * Header Component
 * Top navigation with logo, nav links, and CTA button
 */

'use client';

import Link from 'next/link';
import { useConvexAuth } from 'convex/react';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';

export function Header() {
  const { isAuthenticated } = useConvexAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6161FF]">
              <span className="text-lg font-bold text-white">N</span>
            </div>
            <span className="text-xl font-bold text-foreground">Nova26</span>
          </a>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6">
            <NavigationMenu>
              <NavigationMenuList>
                {/* Products */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-9 bg-transparent hover:bg-transparent data-[state=open]:bg-transparent">
                    Products
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4">
                      <ListItem title="Idea Generator" href="/products/idea-generator">
                        Validate ideas with AI-powered research
                      </ListItem>
                      <ListItem title="App Builder" href="/products/app-builder">
                        21 specialized agents build your app
                      </ListItem>
                      <ListItem title="Video Engine" href="/products/video-engine">
                        Create marketing content with AI
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Teams */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-9 bg-transparent hover:bg-transparent data-[state=open]:bg-transparent">
                    Teams
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4">
                      <ListItem title="For Startups" href="/teams/startups">
                        Move fast from idea to MVP
                      </ListItem>
                      <ListItem title="For Agencies" href="/teams/agencies">
                        Scale client delivery
                      </ListItem>
                      <ListItem title="For Enterprise" href="/teams/enterprise">
                        Custom workflows and integrations
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Platform */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-9 bg-transparent hover:bg-transparent data-[state=open]:bg-transparent">
                    Platform
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4">
                      <ListItem title="Integrations" href="/platform/integrations">
                        Connect your tools
                      </ListItem>
                      <ListItem title="API" href="/platform/api">
                        Build custom workflows
                      </ListItem>
                      <ListItem title="Security" href="/platform/security">
                        Enterprise-grade security
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Resources */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-9 bg-transparent hover:bg-transparent data-[state=open]:bg-transparent">
                    Resources
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4">
                      <ListItem title="Documentation" href="/docs">
                        Learn how to use Nova26
                      </ListItem>
                      <ListItem title="Blog" href="/blog">
                        Latest updates and insights
                      </ListItem>
                      <ListItem title="Community" href="/community">
                        Join the community
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </nav>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          <Link
            href="/pricing"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-block"
          >
            Pricing
          </Link>
          {isAuthenticated ? (
            <Button asChild className="bg-[#6161FF] text-white hover:bg-[#6161FF]/90" size="sm">
              <Link href="/dashboard">Dashboard →</Link>
            </Button>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-block"
              >
                Log in
              </Link>
              <Button asChild className="bg-[#6161FF] text-white hover:bg-[#6161FF]/90" size="sm">
                <Link href="/sign-up">Get Started →</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// Helper component for navigation menu items
function ListItem({
  className,
  title,
  children,
  href,
  ...props
}: {
  className?: string;
  title: string;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          href={href}
          className={cn(
            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
}
