import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Nova26 — AI-Powered IDE',
    template: '%s | Nova26',
  },
  description:
    'Build your next product from idea to launch with 21 specialized AI agents orchestrating every step.',
  keywords: ['AI', 'IDE', 'agents', 'code generation', 'orchestration'],
  authors: [{ name: 'Nova26' }],
  creator: 'Nova26',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Nova26 — AI-Powered IDE',
    description:
      'Build your next product from idea to launch with 21 specialized AI agents.',
    siteName: 'Nova26',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nova26 — AI-Powered IDE',
    description:
      'Build your next product from idea to launch with 21 specialized AI agents.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
