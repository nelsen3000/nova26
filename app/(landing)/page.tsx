/**
 * Landing Page - Nova26
 * Main entry point showcasing the three-stage product pipeline
 */

'use client';

import { useState } from 'react';
import { HeroSection } from './components/hero-section';
import { StageCards } from './components/stage-cards';
import { LeftSidebar } from './components/left-sidebar';
import { IdeaGeneratorPanel } from './components/idea-generator-panel';
import { VideoEngineModal } from './components/video-engine-modal';
import { CTASection } from './components/cta-section';
import { Header } from './components/header';

export default function LandingPage() {
  const [ideaGeneratorOpen, setIdeaGeneratorOpen] = useState(false);
  const [videoEngineOpen, setVideoEngineOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      {/* Left Sidebar */}
      <LeftSidebar
        onIdeaGeneratorClick={() => setIdeaGeneratorOpen(true)}
        onVideoEngineClick={() => setVideoEngineOpen(true)}
      />

      {/* Main Content */}
      <main className="lg:ml-64">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-8">
          {/* Hero Section */}
          <HeroSection />

          {/* Three Pipeline Stage Cards */}
          <StageCards
            onIdeaGeneratorClick={() => setIdeaGeneratorOpen(true)}
            onVideoEngineClick={() => setVideoEngineOpen(true)}
          />

          {/* CTA Section */}
          <CTASection />
        </div>
      </main>

      {/* Idea Generator Panel (slide-in from left) */}
      <IdeaGeneratorPanel
        open={ideaGeneratorOpen}
        onClose={() => setIdeaGeneratorOpen(false)}
      />

      {/* Video Engine Modal */}
      <VideoEngineModal
        open={videoEngineOpen}
        onClose={() => setVideoEngineOpen(false)}
      />
    </div>
  );
}
