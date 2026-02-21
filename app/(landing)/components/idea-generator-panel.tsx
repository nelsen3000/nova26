/**
 * Idea Generator Panel Component
 * Slide-in panel from left with Shadow Advisory Board
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  X,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Archive,
  Loader2,
  User,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IdeaGeneratorPanelProps {
  open: boolean;
  onClose: () => void;
}

// Mock data for demonstration
const mockIdeas = {
  queue: [
    {
      id: '1',
      title: 'AI-powered code review assistant',
      score: 8.2,
      sources: ['Reddit', 'ProductHunt', 'Hacker News'],
      advisors: [
        { name: 'Peter Thiel', vote: 'Fund', confidence: 9 },
        { name: 'Naval Ravikant', vote: 'Fund', confidence: 8 },
        { name: 'Warren Buffett', vote: 'Fund', confidence: 7 },
        { name: 'YC Partner', vote: 'Fund', confidence: 9 },
        { name: 'Skeptical VC', vote: 'Fund', confidence: 8 },
      ],
    },
  ],
  revision: [
    {
      id: '2',
      title: 'Social network for pet owners',
      score: 5.4,
      sources: ['Twitter', 'Instagram', 'App Store'],
      advisors: [
        { name: 'Peter Thiel', vote: 'Pass', confidence: 4 },
        { name: 'Naval Ravikant', vote: 'Fund', confidence: 6 },
        { name: 'Warren Buffett', vote: 'Fund', confidence: 7 },
        { name: 'YC Partner', vote: 'Pass', confidence: 5 },
        { name: 'Skeptical VC', vote: 'Pass', confidence: 5 },
      ],
    },
  ],
  archived: [
    {
      id: '3',
      title: 'Blockchain-based todo app',
      score: 2.1,
      sources: ['Discord', 'Reddit'],
      advisors: [
        { name: 'Peter Thiel', vote: 'Pass', confidence: 2 },
        { name: 'Naval Ravikant', vote: 'Pass', confidence: 3 },
        { name: 'Warren Buffett', vote: 'Pass', confidence: 1 },
        { name: 'YC Partner', vote: 'Pass', confidence: 2 },
        { name: 'Skeptical VC', vote: 'Pass', confidence: 3 },
      ],
    },
  ],
};

export function IdeaGeneratorPanel({ open, onClose }: IdeaGeneratorPanelProps) {
  const [activeTab, setActiveTab] = useState('queue');

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed left-0 top-0 z-50 h-full w-full max-w-2xl overflow-y-auto bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6161FF]">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Idea Generator
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Shadow Advisory Board
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close panel"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Research Sources Info */}
              <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Research Sources
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Reddit',
                    'Discord',
                    'ProductHunt',
                    'App Store',
                    'Play Store',
                    'Twitter/X',
                    'Hacker News',
                    'Amazon',
                    'YouTube',
                    'LinkedIn',
                    'Google Trends',
                    'Patents',
                  ].map((source) => (
                    <Badge key={source} variant="secondary" className="text-xs">
                      {source}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Advisory Board Info */}
              <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Shadow Advisory Board
                </h3>
                <div className="space-y-2">
                  {[
                    {
                      name: 'Peter Thiel',
                      role: 'Contrarian Technologist',
                      question: '0→1? Monopoly potential?',
                    },
                    {
                      name: 'Naval Ravikant',
                      role: 'Leverage Maximalist',
                      question: 'Code/media/capital leverage?',
                    },
                    {
                      name: 'Warren Buffett',
                      role: 'Economics Fundamentalist',
                      question: 'Moat? Simple model?',
                    },
                    {
                      name: 'YC Partner',
                      role: 'Startup Operator',
                      question: '2-week MVP? First 10 users?',
                    },
                    {
                      name: 'Skeptical VC',
                      role: 'Devil\'s Advocate',
                      question: 'Why hasn\'t this been done?',
                    },
                  ].map((advisor) => (
                    <div
                      key={advisor.name}
                      className="flex items-start gap-3 rounded-md bg-background p-2"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6161FF]/10">
                        <User className="h-4 w-4 text-[#6161FF]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {advisor.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {advisor.role} • {advisor.question}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring Thresholds */}
              <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Scoring Thresholds
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm text-foreground">
                      Score ≥ 7.0 → Idea Queue (green)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <span className="text-sm text-foreground">
                      Score 4.0-6.9 → Revision List (yellow)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-foreground">
                      Score &lt; 4.0 → Archived (red)
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="running">
                    <Loader2 className="mr-2 h-4 w-4" />
                    Running
                  </TabsTrigger>
                  <TabsTrigger value="queue">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Queue
                  </TabsTrigger>
                  <TabsTrigger value="revision">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Revision
                  </TabsTrigger>
                  <TabsTrigger value="archived">
                    <Archive className="mr-2 h-4 w-4" />
                    Archived
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="running" className="mt-6">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Loader2 className="mb-4 h-12 w-12 animate-spin text-[#6161FF]" />
                    <p className="text-sm font-medium text-foreground">
                      No research running
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submit an idea to start analysis
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="queue" className="mt-6 space-y-4">
                  {mockIdeas.queue.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} status="queue" />
                  ))}
                </TabsContent>

                <TabsContent value="revision" className="mt-6 space-y-4">
                  {mockIdeas.revision.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} status="revision" />
                  ))}
                </TabsContent>

                <TabsContent value="archived" className="mt-6 space-y-4">
                  {mockIdeas.archived.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} status="archived" />
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Idea Card Component
function IdeaCard({
  idea,
  status,
}: {
  idea: any;
  status: 'queue' | 'revision' | 'archived';
}) {
  const statusConfig = {
    queue: { color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
    revision: { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
    archived: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' },
  };

  const config = statusConfig[status];

  return (
    <div className={cn('rounded-lg border p-4', config.border, config.bg)}>
      <div className="mb-3 flex items-start justify-between">
        <h4 className="text-sm font-semibold text-foreground">{idea.title}</h4>
        <Badge className={cn('ml-2', config.color)}>
          Score: {idea.score}
        </Badge>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {idea.sources.map((source: string) => (
          <Badge key={source} variant="outline" className="text-xs">
            {source}
          </Badge>
        ))}
      </div>

      <div className="space-y-1">
        {idea.advisors.map((advisor: any) => (
          <div
            key={advisor.name}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-muted-foreground">{advisor.name}</span>
            <div className="flex items-center gap-2">
              <Badge
                variant={advisor.vote === 'Fund' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {advisor.vote}
              </Badge>
              <span className="text-muted-foreground">
                {advisor.confidence}/10
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
