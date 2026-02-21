/**
 * Hero Section Component
 * Main headline and subheadline
 */

'use client';

import { motion } from 'framer-motion';

export function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center py-12 text-center md:py-16 lg:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-4"
      >
        {/* Headline */}
        <h1 className="text-4xl font-bold tracking-tight text-[#1F1F1F] md:text-5xl lg:text-6xl">
          Build your next product —<br />
          from idea to launch
        </h1>

        {/* Subheadline */}
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
          What stage are you working on with Nova26?
        </p>
      </motion.div>
    </section>
  );
}
