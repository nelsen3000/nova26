'use client';

import { ConvexReactClient, ConvexProvider } from 'convex/react';
import { ThemeProvider } from 'next-themes';
import { ReactNode, useState, Component } from 'react';

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ConvexErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold text-destructive">
              Connection Error
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {this.state.error?.message ?? 'Failed to connect to Nova26 backend.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// Convex Provider wrapper
// ============================================================================

function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;

  // When the URL is not configured (e.g., CI/SSR without env vars), render a
  // minimal connecting state rather than crashing.
  if (!url) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-sm rounded-lg border border-border p-6 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Connecting to Nova26…</p>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [convex] = useState(() => new ConvexReactClient(url));

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

// ============================================================================
// Root Providers composition
// ============================================================================

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexErrorBoundary>
      <ConvexClientProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </ConvexClientProvider>
    </ConvexErrorBoundary>
  );
}
