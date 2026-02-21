/**
 * Stage Cards Component
 * Three main pipeline stage cards with dropdowns
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Code,
  Megaphone,
  ChevronDown,
  Sparkles,
  Users,
  Zap,
  Wrench,
  BarChart3,
  FileText,
  Shield,
  Video,
  TrendingUp,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StageCardsProps {
  onIdeaGeneratorClick: () => void;
  onVideoEngineClick: () => void;
}

type StageId = 'pre-production' | 'production' | 'post-production';

export function StageCards({
  onIdeaGeneratorClick,
  onVideoEngineClick,
}: StageCardsProps) {
  const [expandedCard, setExpandedCard] = useState<StageId | null>(null);

  const stages = [
    {
      id: 'pre-production' as StageId,
      title: 'Pre-Production',
      subtitle: 'Ideas, research, validation & iteration',
      icon: Lightbulb,
      color: '#6161FF',
      options: [
        {
          title: 'Idea Generator',
          description: 'Shadow Advisory Board scoring system',
          icon: Sparkles,
          featured: true,
          onClick: onIdeaGeneratorClick,
        },
        {
          title: 'Nova26 App Builder',
          description: '21 specialized agents',
          icon: Users,
          onClick: () => {},
        },
        {
          title: 'Swarm',
          description: 'Multi-agent parallel research',
          icon: Zap,
          onClick: () => {},
          subOptions: [
            'Deep Competitive Research',
            'Bulk Content Production',
            'Large Comparison Jobs',
            'Data Extraction Batches',
            'Parallel API/Monitoring',
            'Product & UX Research',
            'Code Exploration',
          ],
        },
      ],
    },
    {
      id: 'production' as StageId,
      title: 'Production',
      subtitle: 'Build, test, and ship your application',
      icon: Code,
      color: '#6161FF',
      options: [
        {
          title: 'Nova26 Full Build',
          description: 'SUN → 21 agents orchestration',
          icon: Wrench,
          onClick: () => {},
        },
        {
          title: 'Single Agent Tasks',
          description: 'Run specific agents on demand',
          icon: Users,
          onClick: () => {},
        },
        {
          title: 'ATLAS Learning Dashboard',
          description: 'Build patterns and insights',
          icon: BarChart3,
          onClick: () => {},
        },
        {
          title: 'PRD Manager',
          description: 'Product requirements documents',
          icon: FileText,
          onClick: () => {},
        },
        {
          title: 'Quality Gates Monitor',
          description: 'Automated quality checks',
          icon: Shield,
          onClick: () => {},
        },
      ],
    },
    {
      id: 'post-production' as StageId,
      title: 'Post-Production',
      subtitle: 'Marketing, content, and user acquisition',
      icon: Megaphone,
      color: '#6161FF',
      options: [
        {
          title: 'Video Content Engine',
          description: 'Open-source AI video generation',
          icon: Video,
          featured: true,
          onClick: onVideoEngineClick,
          subOptions: [
            'Trend Hijacker',
            'Hook Generator',
            'Model Selector (Open-Sora/CogVideo/Stable Video Diffusion/AnimateDiff/Mochi)',
            'Face Swap Factory',
            'Click-to-Ad Generator',
            'Cinema Studio Director',
            'Multi-Model A/B Testing',
            'Lipsync Dialogue Creator',
            '30-Day Content Calendar',
          ],
        },
        {
          title: 'Growth & Distribution',
          description: 'SEO, launch strategy, email sequences',
          icon: TrendingUp,
          onClick: () => {},
        },
        {
          title: 'Analytics & Iteration',
          description: 'User feedback, A/B testing, feature prioritization',
          icon: BarChart3,
          onClick: () => {},
        },
      ],
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3 lg:gap-8">
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const isExpanded = expandedCard === stage.id;

        return (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div
              className={cn(
                'group relative overflow-hidden rounded-lg border border-[#E6E9EF] bg-white p-6 transition-all duration-200 ease-out',
                'hover:-translate-y-0.5 hover:shadow-lg',
                isExpanded && 'shadow-lg'
              )}
              onMouseEnter={() => setExpandedCard(stage.id)}
              onMouseLeave={() => setExpandedCard(null)}
            >
              {/* Card Header */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#1F1F1F]">
                    {stage.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stage.subtitle}
                  </p>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${stage.color}15` }}
                >
                  <Icon
                    className="h-6 w-6"
                    style={{ color: stage.color }}
                  />
                </div>
              </div>

              {/* Expand Indicator */}
              <div className="flex items-center justify-center">
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </motion.div>
              </div>

              {/* Dropdown Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 space-y-2 border-t border-[#E6E9EF] pt-4"
                  >
                    {stage.options.map((option) => {
                      const OptionIcon = option.icon;
                      return (
                        <div key={option.title}>
                          <button
                            onClick={option.onClick}
                            className={cn(
                              'w-full rounded-md p-3 text-left transition-colors duration-150',
                              'hover:bg-[#F4F4F5]',
                              option.featured &&
                                'bg-[#6161FF]/5 ring-1 ring-[#6161FF]/20'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  'mt-0.5 flex h-8 w-8 items-center justify-center rounded-md',
                                  option.featured
                                    ? 'bg-[#6161FF] text-white'
                                    : 'bg-muted'
                                )}
                              >
                                <OptionIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#1F1F1F]">
                                    {option.title}
                                  </span>
                                  {option.featured && (
                                    <span className="rounded-full bg-[#6161FF] px-2 py-0.5 text-xs font-medium text-white">
                                      Featured
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {option.description}
                                </p>
                                {option.subOptions && (
                                  <ul className="mt-2 space-y-1">
                                    {option.subOptions.map((subOption) => (
                                      <li
                                        key={subOption}
                                        className="flex items-center gap-2 text-xs text-muted-foreground"
                                      >
                                        <div className="h-1 w-1 rounded-full bg-[#6161FF]" />
                                        {subOption}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
