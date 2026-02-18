// Project Templates - Pre-configured project starters
// Speed up development with battle-tested templates

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TemplateFile {
  path: string;
  content: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'saas' | 'api' | 'mobile' | 'ecommerce' | 'content' | 'xcode';
  tags: string[];
  files: TemplateFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  postInstall?: string[];
}

// SaaS Starter Template
const saasTemplate: Template = {
  id: 'saas-starter',
  name: 'SaaS Starter',
  description: 'Full-stack SaaS with auth, billing, and dashboard',
  category: 'saas',
  tags: ['nextjs', 'convex', 'stripe', 'auth'],
  files: [
    {
      path: 'app/layout.tsx',
      content: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ConvexProvider } from '@/components/convex-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '{{projectName}}',
  description: 'Built with NOVA26',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexProvider>{children}</ConvexProvider>
      </body>
    </html>
  );
}
`,
    },
    {
      path: 'app/page.tsx',
      content: `import { LandingHero } from '@/components/landing/hero';
import { LandingFeatures } from '@/components/landing/features';
import { LandingPricing } from '@/components/landing/pricing';
import { LandingCTA } from '@/components/landing/cta';

export default function LandingPage() {
  return (
    <main>
      <LandingHero />
      <LandingFeatures />
      <LandingPricing />
      <LandingCTA />
    </main>
  );
}
`,
    },
    {
      path: 'app/dashboard/layout.tsx',
      content: `import { DashboardNav } from '@/components/dashboard/nav';
import { DashboardHeader } from '@/components/dashboard/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <DashboardNav />
      <div className="flex-1">
        <DashboardHeader />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
`,
    },
    {
      path: 'app/dashboard/page.tsx',
      content: `import { StatsCards } from '@/components/dashboard/stats-cards';
import { RecentActivity } from '@/components/dashboard/recent-activity';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <StatsCards />
      <RecentActivity />
    </div>
  );
}
`,
    },
    {
      path: 'convex/schema.ts',
      content: `import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    companyId: v.string(),
    role: v.union(v.literal('admin'), v.literal('member')),
    subscriptionStatus: v.optional(v.string()),
  })
    .index('by_email', ['email'])
    .index('by_company', ['companyId']),

  companies: defineTable({
    name: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.union(v.literal('free'), v.literal('pro'), v.literal('enterprise')),
  }),

  activities: defineTable({
    userId: v.string(),
    action: v.string(),
    metadata: v.optional(v.any()),
  })
    .index('by_user', ['userId'])
    .index('by_time', ['_creationTime']),
});
`,
    },
    {
      path: 'components/convex-provider.tsx',
      content: `'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode } from 'react';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexProviderClient({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
`,
    },
    {
      path: '.env.example',
      content: `# Copy to .env.local
NEXT_PUBLIC_CONVEX_URL=https://your-convex-url.convex.cloud
CONVEX_DEPLOYMENT=your-deployment
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
`,
    },
  ],
  dependencies: {
    'convex': '^1.0.0',
    '@stripe/stripe-js': '^2.0.0',
    '@stripe/react-stripe-js': '^2.0.0',
  },
  devDependencies: {
    '@types/node': '^20',
    'typescript': '^5',
  },
  postInstall: ['npx convex dev --once', 'npm run dev'],
};

// API Service Template
const apiTemplate: Template = {
  id: 'api-service',
  name: 'API Service',
  description: 'RESTful API with OpenAPI docs, auth, and rate limiting',
  category: 'api',
  tags: ['nextjs', 'api', 'openapi', 'trpc'],
  files: [
    {
      path: 'app/api/v1/users/route.ts',
      content: `import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { authenticate } from '@/lib/auth';

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limiter = await rateLimit(auth.userId);
  if (!limiter.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Return users
  return NextResponse.json({ users: [] });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const result = userSchema.safeParse(body);
  
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Create user
  return NextResponse.json({ user: result.data }, { status: 201 });
}
`,
    },
    {
      path: 'lib/rate-limit.ts',
      content: `import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, { count: number; resetTime: number }>({
  max: 500,
  ttl: 60 * 1000, // 1 minute
});

export async function rateLimit(identifier: string) {
  const now = Date.now();
  const record = cache.get(identifier);
  
  if (!record || now > record.resetTime) {
    cache.set(identifier, { count: 1, resetTime: now + 60 * 1000 });
    return { success: true, limit: 60, remaining: 59 };
  }
  
  if (record.count >= 60) {
    return { success: false, limit: 60, remaining: 0 };
  }
  
  record.count++;
  return { success: true, limit: 60, remaining: 60 - record.count };
}
`,
    },
    {
      path: 'lib/auth.ts',
      content: `import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export async function authenticate(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    return { userId: (decoded as any).sub };
  } catch {
    return null;
  }
}
`,
    },
    {
      path: 'app/api/openapi.json/route.ts',
      content: `import { NextResponse } from 'next/server';

export async function GET() {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: '{{projectName}} API',
      version: '1.0.0',
      description: 'API documentation',
    },
    paths: {
      '/api/v1/users': {
        get: {
          summary: 'List users',
          responses: {
            '200': { description: 'List of users' },
          },
        },
        post: {
          summary: 'Create user',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec);
}
`,
    },
  ],
  dependencies: {
    'zod': '^3.22.0',
    'jsonwebtoken': '^9.0.0',
    'lru-cache': '^10.0.0',
  },
  devDependencies: {
    '@types/jsonwebtoken': '^9',
  },
};

// E-commerce Template
const ecommerceTemplate: Template = {
  id: 'ecommerce',
  name: 'E-commerce Store',
  description: 'Online store with products, cart, checkout, and Stripe',
  category: 'ecommerce',
  tags: ['nextjs', 'stripe', 'cart', 'products'],
  files: [
    {
      path: 'app/products/page.tsx',
      content: `import { ProductGrid } from '@/components/products/product-grid';
import { getProducts } from '@/lib/products';

export default async function ProductsPage() {
  const products = await getProducts();
  
  return (
    <main className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Products</h1>
      <ProductGrid products={products} />
    </main>
  );
}
`,
    },
    {
      path: 'components/products/product-card.tsx',
      content: `'use client';

import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Product } from '@/types';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <Card>
      <CardContent className="p-4">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-48 object-cover rounded-lg mb-4"
        />
        <h3 className="font-semibold">{product.name}</h3>
        <p className="text-muted-foreground">${product.price}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={() => addItem(product)} className="w-full">
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
}
`,
    },
    {
      path: 'lib/cart.tsx',
      content: `'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Product } from '@/types';

interface CartItem extends Product {
  quantity: number;
}

const CartContext = createContext<{
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  total: number;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (product: Product) => {
    setItems(current => {
      const existing = current.find(item => item.id === product.id);
      if (existing) {
        return current.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
  };

  const removeItem = (id: string) => {
    setItems(current => current.filter(item => item.id !== id));
  };

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, total }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
`,
    },
    {
      path: 'app/checkout/page.tsx',
      content: `'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from '@/components/checkout/checkout-form';
import { useCart } from '@/lib/cart';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY!);

export default function CheckoutPage() {
  const { items, total } = useCart();

  if (items.length === 0) {
    return <div>Your cart is empty</div>;
  }

  return (
    <main className="container mx-auto py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      <div className="mb-8">
        {items.map(item => (
          <div key={item.id} className="flex justify-between py-2">
            <span>{item.name} x {item.quantity}</span>
            <span>${item.price * item.quantity}</span>
          </div>
        ))}
        <div className="border-t pt-4 font-bold">
          Total: ${total}
        </div>
      </div>
      <Elements stripe={stripePromise}>
        <CheckoutForm amount={total} />
      </Elements>
    </main>
  );
}
`,
    },
  ],
  dependencies: {
    '@stripe/stripe-js': '^2.0.0',
    '@stripe/react-stripe-js': '^2.0.0',
  },
  devDependencies: {},
};

// Xcode iOS Template
const xcodeTemplate: Template = {
  id: 'xcode-ios',
  name: 'iOS App (SwiftUI)',
  description: 'Native iOS app with SwiftUI, Convex integration, and push notifications',
  category: 'xcode',
  tags: ['ios', 'swift', 'swiftui', 'xcode'],
  files: [
    {
      path: '{{projectName}}.xcodeproj/project.pbxproj',
      content: `// This is a placeholder. Use xcodegen or create manually in Xcode
// Recommended: Use Swift Package Manager for dependencies
`,
    },
    {
      path: '{{projectName}}/App/{{projectName}}App.swift',
      content: `import SwiftUI
import ConvexMobile

@main
struct {{projectName}}App: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        // Configure push notifications
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
        return true
    }
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        // Send token to Convex
    }
}
`,
    },
    {
      path: '{{projectName}}/Views/ContentView.swift',
      content: `import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = ContentViewModel()
    
    var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                } else if let error = viewModel.error {
                    ErrorView(error: error, retry: viewModel.load)
                } else {
                    List(viewModel.items) { item in
                        ItemRow(item: item)
                    }
                    .refreshable {
                        await viewModel.load()
                    }
                }
            }
            .navigationTitle("{{projectName}}")
        }
        .task {
            await viewModel.load()
        }
    }
}

struct ItemRow: View {
    let item: Item
    
    var body: some View {
        VStack(alignment: .leading) {
            Text(item.title)
                .font(.headline)
            Text(item.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}
`,
    },
    {
      path: '{{projectName}}/ViewModels/ContentViewModel.swift',
      content: `import Foundation
import ConvexMobile

@MainActor
class ContentViewModel: ObservableObject {
    @Published var items: [Item] = []
    @Published var isLoading = false
    @Published var error: Error?
    
    private let convex = ConvexClient(deploymentUrl: "YOUR_CONVEX_URL")
    
    func load() async {
        isLoading = true
        error = nil
        
        do {
            items = try await convex.query("items:list", ["limit": 50])
        } catch {
            self.error = error
        }
        
        isLoading = false
    }
}
`,
    },
    {
      path: '{{projectName}}/Models/Item.swift',
      content: `import Foundation

struct Item: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let createdAt: Date
}
`,
    },
    {
      path: '{{projectName}}/Info.plist',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.{{projectName}}.app</string>
    <key>CFBundleName</key>
    <string>{{projectName}}</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>UILaunchScreen</key>
    <dict/>
    <key>UIBackgroundModes</key>
    <array>
        <string>remote-notification</string>
    </array>
</dict>
</plist>
`,
    },
    {
      path: 'Package.swift',
      content: `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "{{projectName}}",
    platforms: [.iOS(.v16)],
    dependencies: [
        .package(url: "https://github.com/get-convex/convex-mobile.git", from: "0.1.0"),
    ],
    targets: [
        .executableTarget(
            name: "{{projectName}}",
            dependencies: ["ConvexMobile"]
        ),
    ]
)
`,
    },
  ],
  dependencies: {},
  devDependencies: {},
  postInstall: ['xcodebuild -resolvePackageDependencies'],
};

// All templates
const TEMPLATES: Record<string, Template> = {
  'saas-starter': saasTemplate,
  'api-service': apiTemplate,
  'ecommerce': ecommerceTemplate,
  'xcode-ios': xcodeTemplate,
};

export class TemplateEngine {
  async generate(templateId: string, projectName: string, targetDir: string): Promise<void> {
    const template = TEMPLATES[templateId];
    if (!template) {
      throw new Error(`Template not found: ${templateId}. Available: ${Object.keys(TEMPLATES).join(', ')}`);
    }

    console.log(`🚀 Generating ${template.name}...`);

    // Create directory
    mkdirSync(targetDir, { recursive: true });

    // Generate files
    for (const file of template.files) {
      const filePath = join(targetDir, file.path.replace(/\{\{projectName\}\}/g, projectName));
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      
      mkdirSync(dir, { recursive: true });
      
      const content = file.content.replace(/\{\{projectName\}\}/g, projectName);
      writeFileSync(filePath, content);
      
      console.log(`  ✓ Created ${filePath}`);
    }

    // Generate package.json
    const packageJson = {
      name: projectName,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
      },
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        ...template.dependencies,
      },
      devDependencies: {
        '@types/node': '^20',
        '@types/react': '^18',
        '@types/react-dom': '^18',
        typescript: '^5',
        eslint: '^8',
        'eslint-config-next': '14.0.0',
        ...template.devDependencies,
      },
    };

    writeFileSync(join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    console.log(`\n✅ Project "${projectName}" created!`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${projectName}`);
    console.log(`  npm install`);
    if (template.postInstall) {
      template.postInstall.forEach(cmd => console.log(`  ${cmd}`));
    }
  }

  listTemplates(): Template[] {
    return Object.values(TEMPLATES);
  }

  getTemplate(id: string): Template | undefined {
    return TEMPLATES[id];
  }
}

interface LineItem {
  title: string;
  description: string;
}

function formatLineItem(item: LineItem): string {
  return `${item.title}: ${item.description}`;
}

export function formatTemplateList(templates: Template[]): string {
  const lines = [
    '📦 Available Templates',
    '═══════════════════════════════════════════════════',
    '',
  ];

  const categories = ['saas', 'api', 'ecommerce', 'mobile', 'content', 'xcode'];
  
  for (const category of categories) {
    const categoryTemplates = templates.filter(t => t.category === category);
    if (categoryTemplates.length === 0) continue;
    
    lines.push(`${category.toUpperCase()}:`);
    for (const template of categoryTemplates) {
      const idLine: LineItem = { title: template.id.padEnd(20), description: template.name };
      lines.push(`  ${formatLineItem(idLine)}`);
      lines.push(`    ${template.description}`);
      lines.push(`    Tags: ${template.tags.join(', ')}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export const templateEngine = new TemplateEngine();
