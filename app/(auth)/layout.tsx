import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  robots: { index: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Nova26
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-Powered IDE
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
