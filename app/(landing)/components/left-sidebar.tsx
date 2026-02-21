/**
 * Left Sidebar Component
 * Persistent navigation with Idea Generator as most prominent feature
 */

'use client';

import { motion } from 'framer-motion';
import {
  Sparkles,
  Home,
  FolderKanban,
  FileText,
  Database,
  Video,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeftSidebarProps {
  onIdeaGeneratorClick: () => void;
  onVideoEngineClick: () => void;
}

export function LeftSidebar({
  onIdeaGeneratorClick,
  onVideoEngineClick,
}: LeftSidebarProps) {
  const navItems = [
    {
      title: 'Home / Dashboard',
      icon: Home,
      href: '/dashboard',
      featured: false,
    },
    {
      title: 'Active Builds',
      icon: FolderKanban,
      href: '/builds',
      featured: false,
    },
    {
      title: 'PRD Manager',
      icon: FileText,
      href: '/prds',
      featured: false,
    },
    {
      title: 'ATLAS Logs',
      icon: Database,
      href: '/atlas',
      featured: false,
    },
    {
      title: 'Video Engine',
      icon: Video,
      onClick: onVideoEngineClick,
      featured: false,
    },
    {
      title: 'Chat with Nova26',
      icon: MessageSquare,
      href: '/chat',
      featured: false,
    },
  ];

  return (
    <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-64 border-r border-border bg-background lg:block">
      <div className="flex h-full flex-col gap-4 p-4">
        {/* Idea Generator - Most Prominent */}
        <motion.button
          onClick={onIdeaGeneratorClick}
          className={cn(
            'group relative overflow-hidden rounded-lg p-4',
            'bg-gradient-to-br from-[#6161FF] to-[#7B68EE]',
            'shadow-lg shadow-[#6161FF]/20',
            'transition-all duration-200',
            'hover:shadow-xl hover:shadow-[#6161FF]/30 hover:-translate-y-0.5'
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-white">
                Idea Generator
              </div>
              <div className="text-xs text-white/80">
                Shadow Advisory Board
              </div>
            </div>
          </div>

          {/* Animated sparkles */}
          <motion.div
            className="absolute -right-2 -top-2"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <Sparkles className="h-4 w-4 text-white/40" />
          </motion.div>
        </motion.button>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Regular Navigation Items */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.title}
                href={item.href}
                onClick={(e) => {
                  if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2',
                  'text-sm font-medium text-muted-foreground',
                  'transition-colors duration-150',
                  'hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </a>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-border pt-4">
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs font-medium text-foreground">
              Need help?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Check out our{' '}
              <a
                href="/docs"
                className="text-[#6161FF] hover:underline"
              >
                documentation
              </a>
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
