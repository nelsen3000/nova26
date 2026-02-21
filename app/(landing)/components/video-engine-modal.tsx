/**
 * Video Engine Modal Component
 * Modal showcasing 9 open-source video generation templates
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Video,
  TrendingUp,
  Zap,
  Layers,
  UserCircle,
  MousePointerClick,
  Film,
  BarChart3,
  Mic,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoEngineModalProps {
  open: boolean;
  onClose: () => void;
}

const videoTemplates = [
  {
    id: 'trend-hijacker',
    title: 'Trend Hijacker',
    description: 'Capitalize on viral trends with AI-generated content',
    icon: TrendingUp,
    color: '#6161FF',
  },
  {
    id: 'hook-generator',
    title: 'Hook Generator',
    description: 'Create attention-grabbing video hooks',
    icon: Zap,
    color: '#7B68EE',
  },
  {
    id: 'model-selector',
    title: 'Model Selector',
    description: 'Choose from Open-Sora, CogVideo, Stable Video Diffusion, AnimateDiff, Mochi',
    icon: Layers,
    color: '#6161FF',
    featured: true,
  },
  {
    id: 'face-swap',
    title: 'Face Swap Factory',
    description: 'Swap faces in videos with AI precision',
    icon: UserCircle,
    color: '#7B68EE',
  },
  {
    id: 'click-to-ad',
    title: 'Click-to-Ad Generator',
    description: 'Transform ideas into ads instantly',
    icon: MousePointerClick,
    color: '#6161FF',
  },
  {
    id: 'cinema-studio',
    title: 'Cinema Studio Director',
    description: 'Professional-grade video production',
    icon: Film,
    color: '#7B68EE',
  },
  {
    id: 'ab-testing',
    title: 'Multi-Model A/B Testing',
    description: 'Test multiple AI models simultaneously',
    icon: BarChart3,
    color: '#6161FF',
  },
  {
    id: 'lipsync',
    title: 'Lipsync Dialogue Creator',
    description: 'Sync dialogue with video perfectly',
    icon: Mic,
    color: '#7B68EE',
  },
  {
    id: 'content-calendar',
    title: '30-Day Content Calendar',
    description: 'Plan and schedule a month of content',
    icon: Calendar,
    color: '#6161FF',
  },
];

export function VideoEngineModal({ open, onClose }: VideoEngineModalProps) {
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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="border-b border-border bg-muted/50 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#6161FF]">
                    <Video className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      Video Content Engine
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Open-source AI Video Generation
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {videoTemplates.map((template, index) => {
                  const Icon = template.icon;
                  return (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <button
                        className={cn(
                          'group relative w-full overflow-hidden rounded-lg border border-border bg-card p-4 text-left transition-all duration-200',
                          'hover:-translate-y-0.5 hover:shadow-lg',
                          template.featured &&
                            'ring-2 ring-[#6161FF]/20 bg-[#6161FF]/5'
                        )}
                      >
                        {/* Featured Badge */}
                        {template.featured && (
                          <Badge className="absolute right-2 top-2 bg-[#6161FF] text-white">
                            Popular
                          </Badge>
                        )}

                        {/* Icon */}
                        <div
                          className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${template.color}15` }}
                        >
                          <Icon
                            className="h-6 w-6"
                            style={{ color: template.color }}
                          />
                        </div>

                        {/* Content */}
                        <h3 className="mb-1 text-sm font-semibold text-foreground">
                          {template.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>

                        {/* Hover Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#6161FF]/5 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Model Selector Details */}
              <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Available Open-Source AI Models
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['Open-Sora', 'CogVideo', 'Stable Video Diffusion', 'AnimateDiff', 'Mochi'].map(
                    (model) => (
                      <Badge key={model} variant="secondary">
                        {model}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-muted/50 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Choose a template to get started
                </p>
                <Button className="bg-[#6161FF] text-white hover:bg-[#6161FF]/90">
                  Get Started
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
