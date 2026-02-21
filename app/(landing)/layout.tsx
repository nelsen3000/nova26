/**
 * Landing Layout
 * Minimal layout for landing page (no dashboard navigation)
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nova26 - Build your next product from idea to launch',
  description: 'AI-powered product development platform with 21 specialized agents',
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
