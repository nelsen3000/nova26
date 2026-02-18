/**
 * Magic UI Components for Nova26 Landing Page
 * Animated bento grids, hero sections, and number tickers
 */

'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// Number Ticker Component
// ============================================================================

interface NumberTickerProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function NumberTicker({
  value,
  duration = 2,
  prefix = '',
  suffix = '',
  className = '',
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeOutQuart * value));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);
  
  return (
    <span className={className}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// ============================================================================
// Bento Grid Component
// ============================================================================

interface BentoItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
  href?: string;
}

interface BentoGridProps {
  items: BentoItem[];
}

export function BentoGrid({ items }: BentoGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
      {items.map((item, index) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.5 }}
          className={`
            relative group overflow-hidden rounded-3xl bg-white border border-slate-200
            hover:shadow-xl transition-all duration-300
            ${item.className || ''}
          `}
        >
          <div className="p-8">
            <div className="mb-4 text-indigo-600">
              {item.icon}
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              {item.title}
            </h3>
            <p className="text-slate-600">
              {item.description}
            </p>
          </div>
          
          {/* Hover gradient effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-indigo-100/0 group-hover:from-indigo-50/50 group-hover:to-indigo-100/30 transition-all duration-500" />
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// Hero Section Component
// ============================================================================

interface HeroProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  secondaryCta?: { text: string; href: string };
}

export function Hero({ title, subtitle, ctaText, ctaHref, secondaryCta }: HeroProps) {
  return (
    <section className="relative overflow-hidden py-20 lg:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />
      
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
          animate={{
            x: [0, 30, 0],
            y: [0, 20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
          animate={{
            x: [0, -20, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 tracking-tight">
            {title}
          </h1>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <p className="text-xl md:text-2xl text-slate-600 mb-10 max-w-3xl mx-auto">
            {subtitle}
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <a
            href={ctaHref}
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
          >
            {ctaText}
            <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          
          {secondaryCta && (
            <a
              href={secondaryCta.href}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-slate-700 bg-white border-2 border-slate-200 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              {secondaryCta.text}
            </a>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// Feature Showcase Component
// ============================================================================

interface Feature {
  title: string;
  description: string;
  stats: { label: string; value: number; suffix?: string }[];
}

interface FeatureShowcaseProps {
  features: Feature[];
}

export function FeatureShowcase({ features }: FeatureShowcaseProps) {
  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2, duration: 0.5 }}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                {feature.title}
              </h3>
              <p className="text-slate-600 mb-6">
                {feature.description}
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {feature.stats.map((stat) => (
                  <div key={stat.label} className="text-center p-4 bg-slate-50 rounded-xl">
                    <div className="text-3xl font-bold text-indigo-600">
                      <NumberTicker value={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Pipeline Stage Cards (for Nova26's 3 pipeline stages)
// ============================================================================

interface PipelineStage {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  features: string[];
  color: string;
}

interface PipelineStagesProps {
  stages: PipelineStage[];
  onStageSelect?: (stageId: string) => void;
}

export function PipelineStages({ stages, onStageSelect }: PipelineStagesProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {stages.map((stage, index) => (
        <motion.div
          key={stage.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.15, duration: 0.5 }}
          className="relative"
          onMouseEnter={() => setHoveredStage(stage.id)}
          onMouseLeave={() => setHoveredStage(null)}
        >
          <button
            onClick={() => onStageSelect?.(stage.id)}
            className={`
              w-full text-left p-8 rounded-2xl border-2 transition-all duration-300
              ${hoveredStage === stage.id 
                ? `border-${stage.color}-500 shadow-xl scale-105` 
                : 'border-slate-200 hover:border-slate-300'
              }
              bg-white
            `}
          >
            <div className={`w-16 h-16 rounded-2xl bg-${stage.color}-100 flex items-center justify-center mb-6`}>
              <div className={`text-${stage.color}-600`}>
                {stage.icon}
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {stage.title}
            </h3>
            <p className="text-slate-600 mb-6">
              {stage.subtitle}
            </p>
            
            <ul className="space-y-2">
              {stage.features.slice(0, 3).map((feature) => (
                <li key={feature} className="flex items-center text-sm text-slate-600">
                  <svg className={`w-4 h-4 mr-2 text-${stage.color}-500`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </button>
          
          {/* Expanded dropdown on hover */}
          <motion.div
            initial={false}
            animate={{
              height: hoveredStage === stage.id ? 'auto' : 0,
              opacity: hoveredStage === stage.id ? 1 : 0,
            }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 bg-slate-50 rounded-xl">
              <p className="text-sm font-medium text-slate-700 mb-2">Available Agents:</p>
              <div className="flex flex-wrap gap-2">
                {stage.features.map((feature) => (
                  <span
                    key={feature}
                    className={`px-3 py-1 text-xs rounded-full bg-${stage.color}-100 text-${stage.color}-700`}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// Nova26 Landing Page Component (Complete)
// ============================================================================

export function Nova26LandingPage() {
  const pipelineStages: PipelineStage[] = [
    {
      id: 'pre-production',
      title: 'Pre-Production',
      subtitle: 'Ideas, research, validation & iteration',
      icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      features: ['Idea Generator', 'Research Swarm', 'Shadow Advisory Board'],
      color: 'amber',
    },
    {
      id: 'production',
      title: 'Production',
      subtitle: 'Build, test, and ship your application',
      icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
      features: ['21 Agent Build', 'TypeScript Generation', 'Quality Gates'],
      color: 'indigo',
    },
    {
      id: 'post-production',
      title: 'Post-Production',
      subtitle: 'Marketing, content, and user acquisition',
      icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
      features: ['Video Content Engine', 'SEO Clusters', 'Launch Strategy'],
      color: 'emerald',
    },
  ];

  const bentoItems: BentoItem[] = [
    {
      title: '21 Specialized Agents',
      description: 'From database design to UI polish, each agent has one job and does it exceptionally well.',
      icon: <NumberTicker value={21} className="text-4xl font-bold" />,
      className: 'md:col-span-2',
    },
    {
      title: 'TypeScript First',
      description: 'Zero any types. Full type safety guaranteed.',
      icon: <span className="text-4xl font-mono font-bold">TS</span>,
    },
    {
      title: 'Convex Backend',
      description: 'Real-time sync, automatic caching, type-safe queries.',
      icon: <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>,
    },
    {
      title: 'Quality Gates',
      description: 'Every output passes MERCURY validation. No broken code reaches your codebase.',
      icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
      className: 'md:col-span-2',
    },
  ];

  const features: Feature[] = [
    {
      title: 'Pre-Production',
      description: 'Research and validate ideas before writing code',
      stats: [
        { label: 'Sources', value: 12 },
        { label: 'Advisors', value: 5 },
      ],
    },
    {
      title: 'Production',
      description: 'Build with 21 specialized AI agents',
      stats: [
        { label: 'Agents', value: 21 },
        { label: 'Success Rate', value: 94, suffix: '%' },
      ],
    },
    {
      title: 'Post-Production',
      description: 'Launch and grow with AI-powered marketing',
      stats: [
        { label: 'Video Models', value: 9 },
        { label: 'Platforms', value: 5 },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Hero
        title="Build your next product — from idea to launch"
        subtitle="21 specialized AI agents. One cohesive workflow. From research to revenue."
        ctaText="Start Building"
        ctaHref="#pipeline"
        secondaryCta={{ text: 'View Documentation', href: '/docs' }}
      />
      
      <section id="pipeline" className="py-20 px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            What stage are you working on?
          </h2>
          <p className="text-lg text-slate-600">
            Select a pipeline stage to see available agents
          </p>
        </div>
        
        <PipelineStages stages={pipelineStages} />
      </section>
      
      <section className="py-20 px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Why Nova26?
          </h2>
        </div>
        
        <BentoGrid items={bentoItems} />
      </section>
      
      <FeatureShowcase features={features} />
      
      <section className="py-20 px-4 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to build?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join the developers shipping faster with Nova26
          </p>
          <a
            href="/get-started"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-slate-900 bg-white rounded-full hover:bg-slate-100 transition-colors"
          >
            Get Started Free
            <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}

export default Nova26LandingPage;
