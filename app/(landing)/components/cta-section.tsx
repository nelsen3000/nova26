/**
 * CTA Section Component
 * Call-to-action button below the stage cards
 */

'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export function CTASection() {
  return (
    <section className="mt-16 flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="space-y-4"
      >
        {/* Main CTA Button */}
        <Button
          size="lg"
          className="h-12 bg-[#6161FF] px-8 text-base font-semibold text-white shadow-lg shadow-[#6161FF]/20 transition-all duration-200 hover:bg-[#6161FF]/90 hover:shadow-xl hover:shadow-[#6161FF]/30"
        >
          Start Building
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        {/* Subtext */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>No credit card needed</span>
          <Sparkles className="h-4 w-4 text-[#6161FF]" />
          <span>Free tier available</span>
        </div>
      </motion.div>
    </section>
  );
}
