#!/usr/bin/env tsx
// Skill Generator - Creates 100+ skills for NOVA26

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface SkillTemplate {
  name: string;
  domain: string;
  agents: string[];
  keywords: string[];
  description: string;
  patterns: string[];
  examples: string[];
}

const skillTemplates: SkillTemplate[] = [
  // AI/ML Skills
  {
    name: 'openai-integration',
    domain: 'AI/ML',
    agents: ['GANYMEDE', 'MARS', 'ENCELADUS'],
    keywords: ['openai', 'gpt', 'ai', 'completion', 'chatgpt'],
    description: 'OpenAI API integration for GPT-4, GPT-3.5, embeddings',
    patterns: ['Chat completion', 'Streaming responses', 'Error handling', 'Rate limiting'],
    examples: ['Customer support bot', 'Content generation', 'Code review assistant']
  },
  {
    name: 'anthropic-claude',
    domain: 'AI/ML',
    agents: ['GANYMEDE', 'MARS'],
    keywords: ['claude', 'anthropic', 'ai', 'completion'],
    description: 'Anthropic Claude API integration',
    patterns: ['Claude API calls', 'System prompts', 'Streaming'],
    examples: ['Document analysis', 'Research assistant']
  },
  {
    name: 'huggingface',
    domain: 'AI/ML',
    agents: ['GANYMEDE', 'MARS'],
    keywords: ['huggingface', 'transformers', 'ml', 'model'],
    description: 'Hugging Face model inference',
    patterns: ['Model loading', 'Inference API', 'Text classification'],
    examples: ['Sentiment analysis', 'Named entity recognition']
  },
  {
    name: 'langchain',
    domain: 'AI/ML',
    agents: ['GANYMEDE', 'JUPITER', 'MARS'],
    keywords: ['langchain', 'llm', 'chain', 'agent', 'rag'],
    description: 'LangChain for LLM orchestration',
    patterns: ['Chains', 'Agents', 'Retrieval QA', 'Memory'],
    examples: ['RAG systems', 'Document QA', 'Multi-step workflows']
  },
  {
    name: 'vector-databases',
    domain: 'AI/ML',
    agents: ['PLUTO', 'GANYMEDE'],
    keywords: ['vector', 'embedding', 'pinecone', 'weaviate', 'chroma'],
    description: 'Vector database integration for semantic search',
    patterns: ['Embedding storage', 'Similarity search', 'Index management'],
    examples: ['Semantic search', 'Recommendation engine']
  },
  // API Integration
  {
    name: 'rest-api-design',
    domain: 'API Design',
    agents: ['JUPITER', 'GANYMEDE', 'MARS'],
    keywords: ['rest', 'api', 'endpoint', 'http', 'crud'],
    description: 'RESTful API design patterns',
    patterns: ['Resource naming', 'HTTP methods', 'Status codes', 'Pagination'],
    examples: ['REST API', 'CRUD endpoints', 'Versioning']
  },
  {
    name: 'graphql-api',
    domain: 'API Design',
    agents: ['JUPITER', 'GANYMEDE', 'MARS'],
    keywords: ['graphql', 'query', 'mutation', 'schema', 'resolver'],
    description: 'GraphQL API implementation',
    patterns: ['Schema design', 'Resolvers', 'Type definitions', 'Queries/Mutations'],
    examples: ['GraphQL server', 'Apollo integration']
  },
  {
    name: 'trpc',
    domain: 'API Design',
    agents: ['JUPITER', 'MARS', 'VENUS'],
    keywords: ['trpc', 'typescript', 'rpc', 'procedure'],
    description: 'tRPC for type-safe APIs',
    patterns: ['Router setup', 'Procedures', 'Middleware', 'Client setup'],
    examples: ['Full-stack TypeScript', 'End-to-end types']
  },
  {
    name: 'webhooks',
    domain: 'API Integration',
    agents: ['GANYMEDE', 'ENCELADUS', 'MARS'],
    keywords: ['webhook', 'callback', 'event', 'signature'],
    description: 'Webhook implementation and security',
    patterns: ['Signature verification', 'Event handling', 'Retry logic', 'Idempotency'],
    examples: ['Stripe webhooks', 'GitHub webhooks', 'Slack webhooks']
  },
  {
    name: 'api-rate-limiting',
    domain: 'API Integration',
    agents: ['ENCELADUS', 'MARS', 'IO'],
    keywords: ['rate limit', 'throttling', 'quota', 'burst'],
    description: 'API rate limiting strategies',
    patterns: ['Token bucket', 'Sliding window', 'Redis counters'],
    examples: ['API protection', 'User quotas']
  },
  // Authentication (more)
  {
    name: 'oauth2',
    domain: 'Authentication',
    agents: ['ENCELADUS', 'GANYMEDE', 'MARS'],
    keywords: ['oauth', 'oauth2', 'provider', 'google', 'github'],
    description: 'OAuth 2.0 integration',
    patterns: ['Authorization code flow', 'PKCE', 'Token refresh', 'Scope management'],
    examples: ['Social login', 'Third-party integrations']
  },
  {
    name: 'jwt-auth',
    domain: 'Authentication',
    agents: ['ENCELADUS', 'MARS'],
    keywords: ['jwt', 'token', 'json web token', 'bearer'],
    description: 'JWT authentication patterns',
    patterns: ['Token signing', 'Verification', 'Refresh tokens', 'Blacklisting'],
    examples: ['Stateless auth', 'API authentication']
  },
  {
    name: 'mfa-2fa',
    domain: 'Authentication',
    agents: ['ENCELADUS', 'VENUS', 'MARS'],
    keywords: ['mfa', '2fa', 'totp', 'authenticator', 'sms'],
    description: 'Multi-factor authentication',
    patterns: ['TOTP setup', 'QR codes', 'Backup codes', 'SMS verification'],
    examples: ['Account security', 'Authenticator app']
  },
  {
    name: 'session-management',
    domain: 'Authentication',
    agents: ['ENCELADUS', 'MARS', 'TITAN'],
    keywords: ['session', 'cookie', 'redis', 'store'],
    description: 'Session management patterns',
    patterns: ['Session stores', 'Cookie settings', 'Expiration', 'Rotation'],
    examples: ['User sessions', 'Remember me']
  },
  // Database
  {
    name: 'redis-caching',
    domain: 'Database',
    agents: ['PLUTO', 'MARS', 'IO'],
    keywords: ['redis', 'cache', 'key-value', 'session', 'queue'],
    description: 'Redis for caching and sessions',
    patterns: ['Cache-aside', 'Write-through', 'TTL management', 'Pub/sub'],
    examples: ['Query caching', 'Session store', 'Rate limiting']
  },
  {
    name: 'mongodb',
    domain: 'Database',
    agents: ['PLUTO', 'MARS'],
    keywords: ['mongodb', 'mongo', 'document', 'nosql', 'mongoose'],
    description: 'MongoDB document database',
    patterns: ['Schema design', 'Indexes', 'Aggregation', 'Transactions'],
    examples: ['Document storage', 'Flexible schemas']
  },
  {
    name: 'postgresql',
    domain: 'Database',
    agents: ['PLUTO', 'MARS'],
    keywords: ['postgres', 'postgresql', 'sql', 'relational'],
    description: 'PostgreSQL relational database',
    patterns: ['Table design', 'Indexes', 'Joins', 'Migrations', 'JSONB'],
    examples: ['Relational data', 'Complex queries', 'Full-text search']
  },
  {
    name: 'prisma-orm',
    domain: 'Database',
    agents: ['PLUTO', 'MARS'],
    keywords: ['prisma', 'orm', 'database', 'schema', 'migration'],
    description: 'Prisma ORM for database access',
    patterns: ['Schema definition', 'Migrations', 'Queries', 'Relations'],
    examples: ['Type-safe database', 'Auto-generated types']
  },
  {
    name: 'database-migrations',
    domain: 'Database',
    agents: ['PLUTO', 'TRITON'],
    keywords: ['migration', 'schema', 'version', 'rollback'],
    description: 'Database migration strategies',
    patterns: ['Version control', 'Up/down migrations', 'Seeding', 'Rollback'],
    examples: ['Schema evolution', 'Zero-downtime deploys']
  },
  // Frontend Frameworks
  {
    name: 'nextjs-app-router',
    domain: 'Frontend',
    agents: ['VENUS', 'JUPITER'],
    keywords: ['nextjs', 'app router', 'next', 'react', 'ssr'],
    description: 'Next.js 14+ App Router patterns',
    patterns: ['Server components', 'Client components', 'Route handlers', 'Streaming'],
    examples: ['App directory', 'Server actions', 'Parallel routes']
  },
  {
    name: 'react-query-tanstack',
    domain: 'Frontend',
    agents: ['VENUS', 'TITAN'],
    keywords: ['react query', 'tanstack', 'cache', 'server state'],
    description: 'TanStack Query for server state',
    patterns: ['Queries', 'Mutations', 'Invalidation', 'Optimistic updates'],
    examples: ['Data fetching', 'Cache management']
  },
  {
    name: 'zustand-state',
    domain: 'Frontend',
    agents: ['VENUS', 'JUPITER'],
    keywords: ['zustand', 'state', 'store', 'global'],
    description: 'Zustand for global state',
    patterns: ['Store creation', 'Slices', 'Persistence', 'Middleware'],
    examples: ['Global state', 'UI state management']
  },
  {
    name: 'redux-toolkit',
    domain: 'Frontend',
    agents: ['VENUS', 'JUPITER'],
    keywords: ['redux', 'toolkit', 'rtk', 'slice', 'state'],
    description: 'Redux Toolkit for complex state',
    patterns: ['Slices', 'Thunks', 'RTK Query', 'DevTools'],
    examples: ['Complex state logic', 'Time-travel debugging']
  },
  // CSS/Styling
  {
    name: 'tailwind-advanced',
    domain: 'Styling',
    agents: ['VENUS', 'EUROPA'],
    keywords: ['tailwind', 'css', 'utility', 'responsive', 'dark mode'],
    description: 'Advanced Tailwind CSS patterns',
    patterns: ['Custom config', 'Plugins', 'Dark mode', 'Responsive', 'Components'],
    examples: ['Design system', 'Custom themes']
  },
  {
    name: 'styled-components',
    domain: 'Styling',
    agents: ['VENUS'],
    keywords: ['styled-components', 'css-in-js', 'emotion', 'styling'],
    description: 'CSS-in-JS with styled-components',
    patterns: ['Component styles', 'Theming', 'Global styles', 'Animations'],
    examples: ['Component-based styles', 'Dynamic theming']
  },
  {
    name: 'framer-motion',
    domain: 'Styling',
    agents: ['VENUS'],
    keywords: ['framer', 'motion', 'animation', 'gesture', 'layout'],
    description: 'Framer Motion animations',
    patterns: ['Motion components', 'Variants', 'Gestures', 'Layout animations'],
    examples: ['Page transitions', 'Micro-interactions']
  },
  {
    name: 'sass-scss',
    domain: 'Styling',
    agents: ['VENUS'],
    keywords: ['sass', 'scss', 'css', 'preprocessor'],
    description: 'Sass/SCSS preprocessor',
    patterns: ['Variables', 'Mixins', 'Nesting', 'Partials', 'Modules'],
    examples: ['Organized CSS', 'Reusable styles']
  },
  // Testing
  {
    name: 'playwright-e2e',
    domain: 'Testing',
    agents: ['SATURN', 'VENUS'],
    keywords: ['playwright', 'e2e', 'test', 'browser', 'automation'],
    description: 'Playwright end-to-end testing',
    patterns: ['Page objects', 'Fixtures', 'Assertions', 'Parallel runs'],
    examples: ['Cross-browser testing', 'Visual regression']
  },
  {
    name: 'cypress-testing',
    domain: 'Testing',
    agents: ['SATURN', 'VENUS'],
    keywords: ['cypress', 'e2e', 'test', 'integration'],
    description: 'Cypress testing framework',
    patterns: ['Commands', 'Fixtures', 'Network stubbing', 'Component testing'],
    examples: ['Integration tests', 'Component tests']
  },
  {
    name: 'jest-testing',
    domain: 'Testing',
    agents: ['SATURN', 'MARS'],
    keywords: ['jest', 'unit test', 'mock', 'snapshot'],
    description: 'Jest testing framework',
    patterns: ['Mocks', 'Spies', 'Snapshots', 'Coverage', 'Watch mode'],
    examples: ['Unit tests', 'Snapshot testing']
  },
  {
    name: 'msw-mocking',
    domain: 'Testing',
    agents: ['SATURN', 'GANYMEDE'],
    keywords: ['msw', 'mock', 'service worker', 'api'],
    description: 'Mock Service Worker for API mocking',
    patterns: ['Request handlers', 'Response resolvers', 'Browser/Node setup'],
    examples: ['API mocking', 'Storybook integration']
  },
  // DevOps/Deployment
  {
    name: 'docker-containers',
    domain: 'DevOps',
    agents: ['TRITON', 'JUPITER'],
    keywords: ['docker', 'container', 'image', 'dockerfile'],
    description: 'Docker containerization',
    patterns: ['Dockerfile', 'Compose', 'Multi-stage builds', 'Optimization'],
    examples: ['Containerized apps', 'Local development']
  },
  {
    name: 'kubernetes-k8s',
    domain: 'DevOps',
    agents: ['TRITON', 'JUPITER'],
    keywords: ['kubernetes', 'k8s', 'pod', 'deployment', 'service'],
    description: 'Kubernetes orchestration',
    patterns: ['Deployments', 'Services', 'ConfigMaps', 'Ingress', 'Helm'],
    examples: ['Container orchestration', 'Scaling']
  },
  {
    name: 'aws-services',
    domain: 'Cloud',
    agents: ['TRITON', 'GANYMEDE', 'JUPITER'],
    keywords: ['aws', 'amazon', 's3', 'lambda', 'ec2', 'rds'],
    description: 'Amazon Web Services integration',
    patterns: ['S3 storage', 'Lambda functions', 'RDS databases', 'IAM roles'],
    examples: ['Serverless', 'Cloud storage', 'Managed databases']
  },
  {
    name: 'vercel-deployment',
    domain: 'Deployment',
    agents: ['TRITON'],
    keywords: ['vercel', 'deploy', 'serverless', 'edge'],
    description: 'Vercel deployment and edge functions',
    patterns: ['Deployments', 'Edge functions', 'Environment variables', 'Analytics'],
    examples: ['Frontend hosting', 'Edge computing']
  },
  {
    name: 'github-actions',
    domain: 'CI/CD',
    agents: ['TRITON'],
    keywords: ['github', 'actions', 'workflow', 'ci', 'cd'],
    description: 'GitHub Actions workflows',
    patterns: ['Workflows', 'Jobs', 'Steps', 'Secrets', 'Caching'],
    examples: ['Automated testing', 'Deployment pipelines']
  },
  // Security
  {
    name: 'csp-security',
    domain: 'Security',
    agents: ['ENCELADUS'],
    keywords: ['csp', 'content security policy', 'headers', 'xss'],
    description: 'Content Security Policy implementation',
    patterns: ['Policy directives', 'Nonce generation', 'Reporting', 'Strict CSP'],
    examples: ['XSS prevention', 'Script control']
  },
  {
    name: 'cors-configuration',
    domain: 'Security',
    agents: ['ENCELADUS', 'GANYMEDE'],
    keywords: ['cors', 'cross-origin', 'headers', 'preflight'],
    description: 'CORS configuration and security',
    patterns: ['Origin whitelist', 'Methods', 'Headers', 'Credentials'],
    examples: ['API CORS', 'Cross-origin requests']
  },
  {
    name: 'encryption-security',
    domain: 'Security',
    agents: ['ENCELADUS', 'MARS'],
    keywords: ['encryption', 'aes', 'rsa', 'hash', 'bcrypt'],
    description: 'Data encryption patterns',
    patterns: ['At-rest encryption', 'In-transit', 'Key management', 'Hashing'],
    examples: ['Password hashing', 'Data encryption']
  },
  {
    name: 'penetration-testing',
    domain: 'Security',
    agents: ['ENCELADUS', 'SATURN'],
    keywords: ['pentest', 'security', 'vulnerability', 'audit'],
    description: 'Security testing and auditing',
    patterns: ['Vulnerability scans', 'Dependency checks', 'SAST/DAST'],
    examples: ['Security audits', 'Compliance checks']
  },
  // Performance
  {
    name: 'lazy-loading',
    domain: 'Performance',
    agents: ['IO', 'VENUS'],
    keywords: ['lazy', 'dynamic import', 'code splitting', ' Suspense'],
    description: 'Lazy loading and code splitting',
    patterns: ['Dynamic imports', 'React.lazy', 'Route splitting', 'Preloading'],
    examples: ['Faster initial load', 'On-demand loading']
  },
  {
    name: 'image-optimization',
    domain: 'Performance',
    agents: ['IO', 'VENUS'],
    keywords: ['image', 'optimize', 'webp', 'lazy', 'cdn'],
    description: 'Image optimization strategies',
    patterns: ['WebP conversion', 'Responsive images', 'Lazy loading', 'CDN'],
    examples: ['Next/Image', 'Cloudinary', 'ImageKit']
  },
  {
    name: 'bundle-analysis',
    domain: 'Performance',
    agents: ['IO'],
    keywords: ['bundle', 'webpack', 'rollup', 'analyze', 'size'],
    description: 'Bundle size analysis and optimization',
    patterns: ['Bundle analyzer', 'Tree shaking', 'Dead code elimination'],
    examples: ['Size monitoring', 'Dependency optimization']
  },
  {
    name: 'core-web-vitals',
    domain: 'Performance',
    agents: ['IO', 'VENUS'],
    keywords: ['lcp', 'fid', 'cls', 'web vitals', 'performance'],
    description: 'Core Web Vitals optimization',
    patterns: ['LCP optimization', 'FID reduction', 'CLS prevention'],
    examples: ['Page speed', 'User experience']
  },
  // Monitoring
  {
    name: 'sentry-error-tracking',
    domain: 'Monitoring',
    agents: ['CHARON', 'NEPTUNE'],
    keywords: ['sentry', 'error', 'tracking', 'monitoring'],
    description: 'Sentry error tracking integration',
    patterns: ['Error capture', 'Breadcrumbs', 'Releases', 'Source maps'],
    examples: ['Error monitoring', 'Performance tracking']
  },
  {
    name: 'datadog-monitoring',
    domain: 'Monitoring',
    agents: ['NEPTUNE', 'TRITON'],
    keywords: ['datadog', 'apm', 'metrics', 'logs', 'monitoring'],
    description: 'Datadog monitoring and APM',
    patterns: ['APM tracing', 'Custom metrics', 'Log aggregation', 'Dashboards'],
    examples: ['Application monitoring', 'Infrastructure metrics']
  },
  {
    name: 'logging-structured',
    domain: 'Monitoring',
    agents: ['NEPTUNE', 'MARS'],
    keywords: ['logging', 'structured', 'json', 'pino', 'winston'],
    description: 'Structured logging patterns',
    patterns: ['JSON logging', 'Log levels', 'Correlation IDs', 'Centralized logs'],
    examples: ['Debug logging', 'Audit trails']
  },
  // Forms/Validation
  {
    name: 'react-hook-form',
    domain: 'Forms',
    agents: ['VENUS'],
    keywords: ['react-hook-form', 'form', 'validation', 'rhf'],
    description: 'React Hook Form with Zod validation',
    patterns: ['Form setup', 'Validation schema', 'Error handling', 'Arrays'],
    examples: ['Complex forms', 'Multi-step forms']
  },
  {
    name: 'form-validation',
    domain: 'Forms',
    agents: ['VENUS', 'MARS'],
    keywords: ['validation', 'zod', 'yup', 'joi', 'schema'],
    description: 'Form validation with schemas',
    patterns: ['Schema definition', 'Error messages', 'Async validation'],
    examples: ['Input validation', 'Type-safe forms']
  },
  {
    name: 'file-upload',
    domain: 'Forms',
    agents: ['VENUS', 'MARS', 'GANYMEDE'],
    keywords: ['upload', 'file', 'multipart', 's3', 'storage'],
    description: 'File upload handling',
    patterns: ['Drag & drop', 'Progress tracking', 'Chunked upload', 'Validation'],
    examples: ['Image uploads', 'Document uploads', 'CSV imports']
  },
  // Search
  {
    name: 'algolia-search',
    domain: 'Search',
    agents: ['GANYMEDE', 'VENUS'],
    keywords: ['algolia', 'search', 'instantsearch', 'indexing'],
    description: 'Algolia search integration',
    patterns: ['Index setup', 'Search UI', 'Faceting', 'Ranking'],
    examples: ['Instant search', 'Product search']
  },
  {
    name: 'elasticsearch',
    domain: 'Search',
    agents: ['PLUTO', 'GANYMEDE'],
    keywords: ['elasticsearch', 'search', 'index', 'query'],
    description: 'Elasticsearch search engine',
    patterns: ['Index mapping', 'Queries', 'Aggregations', 'Suggestions'],
    examples: ['Full-text search', 'Log search', 'Analytics']
  },
  {
    name: 'full-text-search',
    domain: 'Search',
    agents: ['PLUTO', 'MARS'],
    keywords: ['search', 'full-text', 'postgres', 'meilisearch'],
    description: 'Database full-text search',
    patterns: ['Text search', 'Ranking', 'Highlighting', 'Fuzzy matching'],
    examples: ['Article search', 'Document search']
  },
  // Notifications
  {
    name: 'email-sending',
    domain: 'Notifications',
    agents: ['GANYMEDE', 'MARS'],
    keywords: ['email', 'sendgrid', 'resend', 'smtp', 'mail'],
    description: 'Email sending and templates',
    patterns: ['Template emails', 'Transactional', 'Bulk sending', 'Tracking'],
    examples: ['Welcome emails', 'Password reset', 'Newsletters']
  },
  {
    name: 'push-notifications',
    domain: 'Notifications',
    agents: ['GANYMEDE', 'TITAN'],
    keywords: ['push', 'notification', 'firebase', 'web push', 'onesignal'],
    description: 'Push notification system',
    patterns: ['Web push', 'Permission handling', 'FCM integration', 'Topics'],
    examples: ['Browser notifications', 'Mobile push']
  },
  {
    name: 'sms-messaging',
    domain: 'Notifications',
    agents: ['GANYMEDE', 'MARS'],
    keywords: ['sms', 'twilio', 'messagebird', 'text', 'messaging'],
    description: 'SMS messaging integration',
    patterns: ['SMS sending', 'Two-way SMS', 'Verification codes'],
    examples: ['OTP codes', 'Alerts', 'Reminders']
  },
  // Real-time
  {
    name: 'websockets',
    domain: 'Real-time',
    agents: ['TITAN', 'MARS'],
    keywords: ['websocket', 'socket.io', 'ws', 'real-time'],
    description: 'WebSocket real-time communication',
    patterns: ['Socket setup', 'Event handling', 'Rooms', 'Authentication'],
    examples: ['Chat', 'Live updates', 'Collaboration']
  },
  {
    name: 'sse-events',
    domain: 'Real-time',
    agents: ['TITAN', 'MARS'],
    keywords: ['sse', 'server-sent events', 'streaming', 'push'],
    description: 'Server-Sent Events for streaming',
    patterns: ['Event streams', 'Connection management', 'Reconnection'],
    examples: ['Live feeds', 'Progress updates']
  },
  // E-commerce
  {
    name: 'shopping-cart',
    domain: 'E-commerce',
    agents: ['MARS', 'PLUTO', 'VENUS'],
    keywords: ['cart', 'basket', 'checkout', 'ecommerce'],
    description: 'Shopping cart implementation',
    patterns: ['Cart state', 'Add/remove items', 'Persistence', 'Calculations'],
    examples: ['Product cart', 'Guest cart', 'Saved carts']
  },
  {
    name: 'inventory-management',
    domain: 'E-commerce',
    agents: ['MARS', 'PLUTO', 'NEPTUNE'],
    keywords: ['inventory', 'stock', 'product', 'warehouse'],
    description: 'Inventory and stock management',
    patterns: ['Stock tracking', 'Reservations', 'Low stock alerts', 'History'],
    examples: ['Product stock', 'Multi-warehouse']
  },
  {
    name: 'order-processing',
    domain: 'E-commerce',
    agents: ['MARS', 'PLUTO'],
    keywords: ['order', 'fulfillment', 'processing', 'shipping'],
    description: 'Order processing workflow',
    patterns: ['Order lifecycle', 'Status tracking', 'Fulfillment', 'Refunds'],
    examples: ['Order management', 'Shipping integration']
  },
  // Charts/Data Viz
  {
    name: 'd3-charts',
    domain: 'Data Visualization',
    agents: ['VENUS', 'NEPTUNE'],
    keywords: ['d3', 'chart', 'visualization', 'svg'],
    description: 'D3.js data visualization',
    patterns: ['Scales', 'Axes', 'Transitions', 'Interactive charts'],
    examples: ['Custom charts', 'Complex visualizations']
  },
  {
    name: 'recharts',
    domain: 'Data Visualization',
    agents: ['VENUS', 'NEPTUNE'],
    keywords: ['recharts', 'chart', 'react', 'graph'],
    description: 'Recharts React charting',
    patterns: ['Line/Bar charts', 'Composed charts', 'Responsive', 'Tooltips'],
    examples: ['Dashboards', 'Analytics charts']
  },
  {
    name: 'chartjs',
    domain: 'Data Visualization',
    agents: ['VENUS', 'NEPTUNE'],
    keywords: ['chartjs', 'chart.js', 'canvas', 'graph'],
    description: 'Chart.js integration',
    patterns: ['Chart types', 'Options', 'Plugins', 'Animation'],
    examples: ['Simple charts', 'Mixed charts']
  },
  // More payment options
  {
    name: 'paypal-integration',
    domain: 'Payments',
    agents: ['GANYMEDE', 'MARS'],
    keywords: ['paypal', 'payment', 'checkout'],
    description: 'PayPal payment integration',
    patterns: ['PayPal SDK', 'Buttons', 'Webhooks', 'Refunds'],
    examples: ['PayPal checkout', 'Subscriptions']
  },
  {
    name: 'apple-pay',
    domain: 'Payments',
    agents: ['GANYMEDE', 'ENCELADUS', 'VENUS'],
    keywords: ['apple pay', 'payment', 'wallet', 'ios'],
    description: 'Apple Pay integration',
    patterns: ['Payment request', 'Tokenization', 'Validation'],
    examples: ['iOS payments', 'Safari payments']
  },
  {
    name: 'google-pay',
    domain: 'Payments',
    agents: ['GANYMEDE', 'VENUS'],
    keywords: ['google pay', 'payment', 'android', 'wallet'],
    description: 'Google Pay integration',
    patterns: ['Payment API', 'Button', 'Token handling'],
    examples: ['Android payments', 'Chrome payments']
  },
  // Calendar/Scheduling
  {
    name: 'calendar-integration',
    domain: 'Calendar',
    agents: ['GANYMEDE', 'VENUS'],
    keywords: ['calendar', 'google calendar', 'outlook', 'ical'],
    description: 'Calendar service integration',
    patterns: ['OAuth', 'Event CRUD', 'Sync', 'Webhooks'],
    examples: ['Google Calendar', 'Outlook integration']
  },
  {
    name: 'scheduling-system',
    domain: 'Calendar',
    agents: ['MARS', 'VENUS', 'PLUTO'],
    keywords: ['scheduling', 'booking', 'appointment', 'availability'],
    description: 'Scheduling and booking system',
    patterns: ['Availability checking', 'Time slots', 'Conflicts', 'Reminders'],
    examples: ['Appointment booking', 'Room scheduling']
  },
  // Maps/Location
  {
    name: 'google-maps',
    domain: 'Maps',
    agents: ['VENUS', 'GANYMEDE'],
    keywords: ['maps', 'google maps', 'location', 'geocoding'],
    description: 'Google Maps integration',
    patterns: ['Map display', 'Markers', 'Geocoding', 'Directions'],
    examples: ['Store locator', 'Delivery tracking']
  },
  {
    name: 'mapbox',
    domain: 'Maps',
    agents: ['VENUS', 'GANYMEDE'],
    keywords: ['mapbox', 'map', 'gl', 'custom'],
    description: 'Mapbox custom maps',
    patterns: ['Custom styles', 'Layers', 'Data visualization', 'Geolocation'],
    examples: ['Custom map designs', 'Data layers']
  },
  // PDF/Document
  {
    name: 'pdf-generation',
    domain: 'Documents',
    agents: ['VENUS', 'MARS'],
    keywords: ['pdf', 'generate', 'puppeteer', 'react-pdf'],
    description: 'PDF document generation',
    patterns: ['HTML to PDF', 'React-PDF', 'Templates', 'Styling'],
    examples: ['Invoices', 'Reports', 'Certificates']
  },
  {
    name: 'excel-csv',
    domain: 'Documents',
    agents: ['MARS', 'VENUS'],
    keywords: ['excel', 'csv', 'spreadsheet', 'export', 'import'],
    description: 'Excel/CSV import export',
    patterns: ['CSV parsing', 'Excel generation', 'Streaming', 'Validation'],
    examples: ['Data export', 'Bulk uploads']
  },
  // More testing
  {
    name: 'load-testing',
    domain: 'Testing',
    agents: ['SATURN', 'IO'],
    keywords: ['load', 'performance', 'k6', 'artillery', 'stress'],
    description: 'Load and performance testing',
    patterns: ['Load scenarios', 'Metrics', 'Thresholds', 'Reporting'],
    examples: ['Stress testing', 'Capacity planning']
  },
  {
    name: 'visual-testing',
    domain: 'Testing',
    agents: ['SATURN', 'VENUS'],
    keywords: ['visual', 'regression', 'screenshot', 'chromatic', 'percy'],
    description: 'Visual regression testing',
    patterns: ['Baseline images', 'Diff detection', 'Review workflow'],
    examples: ['UI consistency', 'Design system verification']
  },
  // SEO/Marketing
  {
    name: 'seo-optimization',
    domain: 'SEO',
    agents: ['VENUS', 'CALLISTO'],
    keywords: ['seo', 'meta', 'sitemap', 'robots', 'structured data'],
    description: 'SEO optimization patterns',
    patterns: ['Meta tags', 'Open Graph', 'Sitemaps', 'Structured data'],
    examples: ['Search optimization', 'Social sharing']
  },
  {
    name: 'analytics-tracking',
    domain: 'Analytics',
    agents: ['NEPTUNE', 'VENUS'],
    keywords: ['analytics', 'google analytics', 'gtm', 'tracking'],
    description: 'Analytics and tracking setup',
    patterns: ['Event tracking', 'User properties', 'Funnels', 'Goals'],
    examples: ['User analytics', 'Conversion tracking']
  },
  // Accessibility
  {
    name: 'accessibility-a11y',
    domain: 'Accessibility',
    agents: ['VENUS', 'SATURN'],
    keywords: ['a11y', 'accessibility', 'aria', 'wcag', 'screen reader'],
    description: 'Accessibility implementation',
    patterns: ['ARIA labels', 'Keyboard nav', 'Focus management', 'Testing'],
    examples: ['WCAG compliance', 'Screen reader support']
  },
  // Internationalization
  {
    name: 'i18n-internationalization',
    domain: 'i18n',
    agents: ['VENUS', 'EARTH'],
    keywords: ['i18n', 'translation', 'locale', 'language', 'next-intl'],
    description: 'Internationalization and localization',
    patterns: ['Translation keys', 'Locale switching', 'RTL support', 'Formatting'],
    examples: ['Multi-language apps', 'Localized content']
  },
  // CMS/Content
  {
    name: 'cms-headless',
    domain: 'CMS',
    agents: ['GANYMEDE', 'VENUS'],
    keywords: ['cms', 'contentful', 'sanity', 'strapi', 'headless'],
    description: 'Headless CMS integration',
    patterns: ['Content fetching', 'Rich text', 'Assets', 'Preview'],
    examples: ['Contentful', 'Sanity', 'Strapi integration']
  },
  // Background Jobs
  {
    name: 'bull-mq',
    domain: 'Queues',
    agents: ['MARS', 'MIMAS'],
    keywords: ['bull', 'queue', 'redis', 'job', 'worker'],
    description: 'Bull MQ for job queues',
    patterns: ['Queue setup', 'Workers', 'Scheduling', 'Retries'],
    examples: ['Email queues', 'Image processing', 'Data imports']
  },
  {
    name: 'cron-jobs',
    domain: 'Scheduling',
    agents: ['MARS', 'TRITON'],
    keywords: ['cron', 'schedule', 'job', 'recurring', 'task'],
    description: 'Cron job scheduling',
    patterns: ['Cron expressions', 'Job handlers', 'Monitoring', 'Overlap prevention'],
    examples: ['Scheduled reports', 'Maintenance tasks']
  },
  // Feature Flags
  {
    name: 'feature-flags',
    domain: 'Feature Management',
    agents: ['MARS', 'VENUS', 'JUPITER'],
    keywords: ['feature flag', 'toggle', 'launchdarkly', 'unleash'],
    description: 'Feature flag management',
    patterns: ['Flag evaluation', 'User targeting', 'Gradual rollout', 'A/B testing'],
    examples: ['Safe deployments', 'Beta features']
  },
  // Data Processing
  {
    name: 'etl-pipelines',
    domain: 'Data Engineering',
    agents: ['MARS', 'NEPTUNE'],
    keywords: ['etl', 'pipeline', 'extract', 'transform', 'load'],
    description: 'ETL data pipelines',
    patterns: ['Data extraction', 'Transformation', 'Loading', 'Orchestration'],
    examples: ['Data migration', 'Report generation']
  },
  {
    name: 'data-migration',
    domain: 'Data Engineering',
    agents: ['PLUTO', 'MARS', 'TRITON'],
    keywords: ['migration', 'data', 'transfer', 'transform'],
    description: 'Database migration strategies',
    patterns: ['Schema migration', 'Data transformation', 'Verification', 'Rollback'],
    examples: ['Zero-downtime migration', 'Cross-database moves']
  },
  // Web3/Blockchain
  {
    name: 'ethereum-web3',
    domain: 'Web3',
    agents: ['GANYMEDE', 'ENCELADUS', 'MARS'],
    keywords: ['ethereum', 'web3', 'solidity', 'smart contract', 'ethers'],
    description: 'Ethereum Web3 integration',
    patterns: ['Wallet connection', 'Contract interaction', 'Transaction handling'],
    examples: ['MetaMask integration', 'Smart contract calls']
  },
  {
    name: 'solana-web3',
    domain: 'Web3',
    agents: ['GANYMEDE', 'ENCELADUS'],
    keywords: ['solana', 'web3', 'rust', 'anchor', 'phantom'],
    description: 'Solana blockchain integration',
    patterns: ['Wallet adapter', 'Program interaction', 'Transactions'],
    examples: ['Phantom wallet', 'Solana Pay']
  },
  // Communication
  {
    name: 'slack-integration',
    domain: 'Communication',
    agents: ['GANYMEDE', 'MARS'],
    keywords: ['slack', 'bot', 'webhook', 'notification'],
    description: 'Slack app integration',
    patterns: ['Bot setup', 'Slash commands', 'Webhooks', 'Interactive components'],
    examples: ['Team notifications', 'Command bots']
  },
  {
    name: 'discord-integration',
    domain: 'Communication',
    agents: ['GANYMEDE', 'MARS'],
    keywords: ['discord', 'bot', 'webhook', 'gaming'],
    description: 'Discord bot integration',
    patterns: ['Bot creation', 'Commands', 'Embeds', 'Webhooks'],
    examples: ['Community bots', 'Game integrations']
  },
  {
    name: 'zapier-automation',
    domain: 'Automation',
    agents: ['GANYMEDE'],
    keywords: ['zapier', 'automation', 'workflow', 'integration'],
    description: 'Zapier workflow automation',
    patterns: ['Trigger setup', 'Actions', 'Multi-step Zaps', 'Webhooks'],
    examples: ['App integrations', 'Automated workflows']
  },
  // More to reach 100...
  {
    name: 'terraform-iac',
    domain: 'Infrastructure',
    agents: ['TRITON', 'JUPITER'],
    keywords: ['terraform', 'iac', 'infrastructure', 'provisioning'],
    description: 'Terraform infrastructure as code',
    patterns: ['Resource definition', 'State management', 'Modules', 'Variables'],
    examples: ['Cloud provisioning', 'Infrastructure versioning']
  },
  {
    name: 'serverless-functions',
    domain: 'Serverless',
    agents: ['MARS', 'TRITON'],
    keywords: ['serverless', 'lambda', 'function', 'edge'],
    description: 'Serverless function patterns',
    patterns: ['Function handlers', 'Cold starts', 'Environment', 'Deployment'],
    examples: ['AWS Lambda', 'Vercel Functions', 'Cloudflare Workers']
  },
  {
    name: 'edge-computing',
    domain: 'Edge',
    agents: ['MARS', 'TRITON'],
    keywords: ['edge', 'cdn', 'middleware', 'compute'],
    description: 'Edge computing patterns',
    patterns: ['Edge functions', 'Geolocation', 'Caching', 'A/B testing'],
    examples: ['Vercel Edge', 'Cloudflare Workers']
  },
  {
    name: 'arweave-storage',
    domain: 'Storage',
    agents: ['GANYMEDE', 'MARS'],
    keywords: ['arweave', 'permanent', 'storage', 'blockchain'],
    description: 'Arweave permanent storage',
    patterns: ['Transaction bundling', 'Upload', 'Retrieval', 'Costs'],
    examples: ['Permanent data', 'Archive storage']
  },
  {
    name: 'ipfs-storage',
    domain: 'Storage',
    agents: ['GANYMEDE'],
    keywords: ['ipfs', 'decentralized', 'storage', 'pinning'],
    description: 'IPFS decentralized storage',
    patterns: ['Content addressing', 'Pinning', 'Gateways', 'NFTs'],
    examples: ['Decentralized files', 'NFT metadata']
  },
  {
    name: 'web-rtc',
    domain: 'Real-time',
    agents: ['TITAN', 'MARS'],
    keywords: ['webrtc', 'video', 'audio', 'peer', 'streaming'],
    description: 'WebRTC peer-to-peer communication',
    patterns: ['Peer connection', 'Signaling', 'Media streams', 'ICE'],
    examples: ['Video calls', 'Screen sharing', 'Live streaming']
  },
  {
    name: 'video-processing',
    domain: 'Media',
    agents: ['MARS', 'IO'],
    keywords: ['video', 'ffmpeg', 'transcode', 'streaming'],
    description: 'Video processing and streaming',
    patterns: ['Transcoding', 'Thumbnails', 'Streaming', 'Optimization'],
    examples: ['Video uploads', 'Live streaming', 'On-demand']
  },
  {
    name: 'image-processing',
    domain: 'Media',
    agents: ['MARS', 'IO'],
    keywords: ['image', 'sharp', 'resize', 'optimize', 'transform'],
    description: 'Image processing and optimization',
    patterns: ['Resizing', 'Format conversion', 'Compression', 'Transformations'],
    examples: ['Image uploads', 'Thumbnails', 'Art direction']
  },
  {
    name: 'audio-processing',
    domain: 'Media',
    agents: ['MARS'],
    keywords: ['audio', 'waveform', 'transcode', 'stream'],
    description: 'Audio processing patterns',
    patterns: ['Transcoding', 'Waveforms', 'Streaming', 'Metadata'],
    examples: ['Audio uploads', 'Podcast hosting']
  },
  {
    name: 'wizards-multi-step',
    domain: 'UI Patterns',
    agents: ['VENUS', 'EARTH'],
    keywords: ['wizard', 'multi-step', 'form', 'progress', 'stepper'],
    description: 'Multi-step wizard forms',
    patterns: ['Step management', 'State persistence', 'Validation', 'Navigation'],
    examples: ['Onboarding', 'Complex forms', 'Setup flows']
  },
  {
    name: 'onboarding-flows',
    domain: 'UX',
    agents: ['VENUS', 'EARTH'],
    keywords: ['onboarding', 'tour', 'intro', 'walkthrough'],
    description: 'User onboarding experiences',
    patterns: ['Product tours', 'Tooltips', 'Progressive disclosure', 'Checklists'],
    examples: ['New user flow', 'Feature discovery']
  },
  {
    name: 'dashboard-analytics',
    domain: 'UI Patterns',
    agents: ['VENUS', 'NEPTUNE'],
    keywords: ['dashboard', 'analytics', 'kpi', 'metrics', 'report'],
    description: 'Analytics dashboard design',
    patterns: ['KPI cards', 'Charts', 'Filters', 'Date ranges', 'Real-time'],
    examples: ['Admin dashboards', 'Analytics views']
  },
  {
    name: 'admin-panel',
    domain: 'UI Patterns',
    agents: ['VENUS', 'MARS'],
    keywords: ['admin', 'crud', 'panel', 'cms', 'management'],
    description: 'Admin panel interfaces',
    patterns: ['CRUD tables', 'Filters', 'Bulk actions', 'Permissions', 'Audit logs'],
    examples: ['Content management', 'User management']
  },
  {
    name: 'data-tables',
    domain: 'UI Patterns',
    agents: ['VENUS'],
    keywords: ['table', 'datatable', 'grid', 'sort', 'filter', 'pagination'],
    description: 'Advanced data tables',
    patterns: ['Sorting', 'Filtering', 'Pagination', 'Selection', 'Actions'],
    examples: ['Data grids', 'Report tables']
  },
  {
    name: 'kanban-board',
    domain: 'UI Patterns',
    agents: ['VENUS', 'TITAN'],
    keywords: ['kanban', 'board', 'drag', 'drop', 'task'],
    description: 'Kanban board implementation',
    patterns: ['Drag & drop', 'Columns', 'Cards', 'Real-time sync'],
    examples: ['Task management', 'Project boards']
  },
  {
    name: 'comment-system',
    domain: 'Social',
    agents: ['MARS', 'VENUS', 'TITAN'],
    keywords: ['comment', 'thread', 'reply', 'mention'],
    description: 'Nested comment system',
    patterns: ['Threading', 'Mentions', 'Real-time', 'Moderation'],
    examples: ['Post comments', 'Discussion threads']
  },
  {
    name: 'notification-feed',
    domain: 'Social',
    agents: ['VENUS', 'TITAN', 'MARS'],
    keywords: ['notification', 'feed', 'activity', 'bell'],
    description: 'Notification center and feeds',
    patterns: ['Unread counts', 'Grouping', 'Actions', 'Real-time', 'History'],
    examples: ['Activity feed', 'Alert center']
  },
  {
    name: 'user-profile',
    domain: 'Social',
    agents: ['VENUS', 'MARS'],
    keywords: ['profile', 'user', 'avatar', 'settings'],
    description: 'User profile management',
    patterns: ['Profile editing', 'Avatar upload', 'Preferences', 'Privacy'],
    examples: ['User profiles', 'Account settings']
  },
  {
    name: 'activity-logs',
    domain: 'Monitoring',
    agents: ['NEPTUNE', 'MARS'],
    keywords: ['activity', 'log', 'audit', 'history', 'tracking'],
    description: 'Activity logging and auditing',
    patterns: ['Event logging', 'User tracking', 'Audit trails', 'Retention'],
    examples: ['Security audits', 'User activity', 'Compliance']
  },
  {
    name: 'rate-limiting-advanced',
    domain: 'Security',
    agents: ['ENCELADUS', 'MARS'],
    keywords: ['rate limit', 'throttle', 'quota', 'sliding window', 'token bucket'],
    description: 'Advanced rate limiting strategies',
    patterns: ['Sliding window', 'Token bucket', 'User tiers', 'Redis counters'],
    examples: ['API protection', 'Resource quotas']
  },
  {
    name: 'caching-strategies',
    domain: 'Performance',
    agents: ['IO', 'PLUTO', 'MARS'],
    keywords: ['cache', 'redis', 'cdn', 'memoization', 'stale-while-revalidate'],
    description: 'Multi-layer caching strategies',
    patterns: ['Browser cache', 'CDN', 'Redis', 'SWR', 'Cache invalidation'],
    examples: ['Query caching', 'Page caching', 'API response caching']
  },
  {
    name: 'database-sharding',
    domain: 'Database',
    agents: ['PLUTO', 'JUPITER'],
    keywords: ['shard', 'partition', 'scale', 'horizontal'],
    description: 'Database sharding patterns',
    patterns: ['Key-based sharding', 'Range sharding', 'Shard routing', 'Rebalancing'],
    examples: ['Multi-tenant scaling', 'Geographic distribution']
  },
  {
    name: 'microservices',
    domain: 'Architecture',
    agents: ['JUPITER', 'GANYMEDE'],
    keywords: ['microservice', 'service mesh', 'distributed', 'api gateway'],
    description: 'Microservices architecture',
    patterns: ['Service boundaries', 'Communication', 'Discovery', 'Resilience'],
    examples: ['Service decomposition', 'API gateway']
  },
  {
    name: 'event-sourcing',
    domain: 'Architecture',
    agents: ['JUPITER', 'PLUTO', 'MARS'],
    keywords: ['event sourcing', 'cqrs', 'event store', 'projection'],
    description: 'Event sourcing and CQRS',
    patterns: ['Event store', 'Aggregates', 'Projections', 'Snapshots'],
    examples: ['Audit trails', 'Complex domains']
  },
  {
    name: 'saga-pattern',
    domain: 'Architecture',
    agents: ['JUPITER', 'MIMAS', 'MARS'],
    keywords: ['saga', 'distributed transaction', 'compensating', 'orchestration'],
    description: 'Saga pattern for distributed transactions',
    patterns: ['Orchestration', 'Choreography', 'Compensation', 'Idempotency'],
    examples: ['Order processing', 'Payment flows']
  },
  {
    name: 'circuit-breaker',
    domain: 'Resilience',
    agents: ['MIMAS', 'GANYMEDE'],
    keywords: ['circuit breaker', 'fallback', 'retry', 'resilience'],
    description: 'Circuit breaker pattern',
    patterns: ['States', 'Thresholds', 'Fallbacks', 'Half-open'],
    examples: ['API resilience', 'Service degradation']
  },
  {
    name: 'bulk-operations',
    domain: 'Data',
    agents: ['MARS', 'IO'],
    keywords: ['bulk', 'batch', 'import', 'export', 'operation'],
    description: 'Bulk data operations',
    patterns: ['Batching', 'Streaming', 'Progress tracking', 'Error handling'],
    examples: ['Bulk imports', 'Mass updates', 'Data exports']
  },
  {
    name: 'gdpr-compliance',
    domain: 'Compliance',
    agents: ['ENCELADUS', 'EARTH', 'MARS'],
    keywords: ['gdpr', 'privacy', 'data protection', 'compliance', 'consent'],
    description: 'GDPR compliance implementation',
    patterns: ['Consent management', 'Data deletion', 'Export', 'Anonymization'],
    examples: ['Privacy controls', 'Data subject rights']
  },
  {
    name: 'soc2-compliance',
    domain: 'Compliance',
    agents: ['ENCELADUS', 'NEPTUNE'],
    keywords: ['soc2', 'compliance', 'security', 'audit', 'controls'],
    description: 'SOC 2 compliance controls',
    patterns: ['Access controls', 'Monitoring', 'Incident response', 'Documentation'],
    examples: ['Security audits', 'Compliance reporting']
  },
  {
    name: 'ai-content-moderation',
    domain: 'AI/ML',
    agents: ['ENCELADUS', 'GANYMEDE'],
    keywords: ['moderation', 'content', 'ai', 'toxicity', 'filter'],
    description: 'AI-powered content moderation',
    patterns: ['Text classification', 'Image analysis', 'Confidence scoring', 'Escalation'],
    examples: ['Comment moderation', 'Image filtering']
  },
  {
    name: 'recommendation-engine',
    domain: 'AI/ML',
    agents: ['NEPTUNE', 'MARS'],
    keywords: ['recommendation', 'personalization', 'collaborative', 'content'],
    description: 'Recommendation system',
    patterns: ['Collaborative filtering', 'Content-based', 'Hybrid', 'A/B testing'],
    examples: ['Product recommendations', 'Content suggestions']
  },
  {
    name: 'search-autocomplete',
    domain: 'Search',
    agents: ['GANYMEDE', 'VENUS'],
    keywords: ['autocomplete', 'suggest', 'search', 'typeahead'],
    description: 'Search autocomplete',
    patterns: ['Prefix matching', 'Fuzzy search', 'Ranking', 'Caching'],
    examples: ['Search suggestions', 'Command palette']
  },
  {
    name: 'fuzzy-search',
    domain: 'Search',
    agents: ['MARS', 'VENUS'],
    keywords: ['fuzzy', 'search', 'typo', 'tolerance', 'matching'],
    description: 'Fuzzy string matching',
    patterns: ['Levenshtein', 'Trigram', 'Phonetic', 'Ranking'],
    examples: ['Typo-tolerant search', 'Name matching']
  },
  {
    name: 'collaborative-editing',
    domain: 'Real-time',
    agents: ['TITAN', 'MARS'],
    keywords: ['collaborative', 'editing', 'crdt', 'yjs', 'conflict'],
    description: 'Collaborative document editing',
    patterns: ['CRDTs', 'Operational transforms', 'Conflict resolution', 'Presence'],
    examples: ['Google Docs style', 'Shared whiteboards']
  },
  {
    name: 'live-cursors',
    domain: 'Real-time',
    agents: ['TITAN', 'VENUS'],
    keywords: ['cursor', 'live', 'presence', 'collaborative', 'awareness'],
    description: 'Live cursor and presence indicators',
    patterns: ['Cursor tracking', 'User awareness', 'Smooth animations', 'Cleanup'],
    examples: ['Figma-style cursors', 'Live collaboration']
  },
  {
    name: 'undo-redo-history',
    domain: 'State',
    agents: ['VENUS', 'MARS'],
    keywords: ['undo', 'redo', 'history', 'command', 'stack'],
    description: 'Undo/redo functionality',
    patterns: ['Command pattern', 'History stack', 'Time travel', 'Batching'],
    examples: ['Editor undo', 'Action history']
  },
  {
    name: 'optimistic-updates-advanced',
    domain: 'Real-time',
    agents: ['TITAN', 'VENUS'],
    keywords: ['optimistic', 'update', 'rollback', 'revert', 'sync'],
    description: 'Advanced optimistic update patterns',
    patterns: ['Pending states', 'Rollback', 'Conflict resolution', 'Sync queues'],
    examples: ['Social interactions', 'Shopping carts']
  },
  {
    name: 'offline-first',
    domain: 'Architecture',
    agents: ['EUROPA', 'TITAN', 'MIMAS'],
    keywords: ['offline', 'pwa', 'sync', 'queue', 'conflict'],
    description: 'Offline-first application patterns',
    patterns: ['Local storage', 'Sync queue', 'Conflict resolution', 'Background sync'],
    examples: ['Offline apps', 'Airplane mode support']
  },
  {
    name: 'progressive-enhancement',
    domain: 'Architecture',
    agents: ['VENUS', 'JUPITER'],
    keywords: ['progressive', 'enhancement', 'graceful', 'degradation'],
    description: 'Progressive enhancement strategies',
    patterns: ['Core functionality', 'Layered features', 'Feature detection'],
    examples: ['Accessible apps', 'Low-bandwidth support']
  },
  {
    name: 'error-boundaries',
    domain: 'Reliability',
    agents: ['CHARON', 'VENUS'],
    keywords: ['error boundary', 'catch', 'fallback', 'recovery'],
    description: 'Error boundary patterns',
    patterns: ['Component boundaries', 'Fallback UI', 'Error reporting', 'Recovery'],
    examples: ['Crash isolation', 'Graceful degradation']
  },
  {
    name: 'loading-skeletons',
    domain: 'UI Patterns',
    agents: ['VENUS', 'CHARON'],
    keywords: ['skeleton', 'shimmer', 'loading', 'placeholder'],
    description: 'Skeleton loading states',
    patterns: ['Content shapes', 'Animation', 'Responsive', 'Progressive'],
    examples: ['Content placeholders', 'Page loading']
  },
  {
    name: 'empty-states',
    domain: 'UX',
    agents: ['CHARON', 'VENUS'],
    keywords: ['empty', 'state', 'blank', 'zero', 'illustration'],
    description: 'Empty state design patterns',
    patterns: ['Zero states', 'Onboarding', 'CTAs', 'Illustrations'],
    examples: ['No data states', 'First-time user experience']
  },
  {
    name: 'error-messaging',
    domain: 'UX',
    agents: ['CHARON', 'VENUS'],
    keywords: ['error', 'message', 'validation', 'feedback', 'toast'],
    description: 'Error message design patterns',
    patterns: ['Clear language', 'Actionable', 'Contextual', 'Non-blocking'],
    examples: ['Form errors', 'System errors', 'Network errors']
  },
  {
    name: 'confirmation-dialogs',
    domain: 'UX',
    agents: ['VENUS', 'EARTH'],
    keywords: ['confirm', 'dialog', 'modal', 'destructive', 'action'],
    description: 'Confirmation dialog patterns',
    patterns: ['Destructive actions', 'Context', 'Undo options', 'Shortcuts'],
    examples: ['Delete confirmation', 'Unsaved changes']
  },
  {
    name: 'toast-notifications',
    domain: 'UI Patterns',
    agents: ['VENUS', 'CHARON'],
    keywords: ['toast', 'notification', 'snackbar', 'alert', 'feedback'],
    description: 'Toast notification system',
    patterns: ['Auto-dismiss', 'Stacking', 'Actions', 'Accessibility', 'Positioning'],
    examples: ['Success messages', 'Error alerts']
  },
  {
    name: 'tooltip-popover',
    domain: 'UI Patterns',
    agents: ['VENUS'],
    keywords: ['tooltip', 'popover', 'hint', 'help', 'overlay'],
    description: 'Tooltip and popover patterns',
    patterns: ['Hover triggers', 'Click triggers', 'Positioning', 'Accessibility'],
    examples: ['Help tooltips', 'Info popovers']
  },
  {
    name: 'modal-dialogs',
    domain: 'UI Patterns',
    agents: ['VENUS'],
    keywords: ['modal', 'dialog', 'overlay', 'focus trap', 'accessibility'],
    description: 'Modal dialog patterns',
    patterns: ['Focus management', 'Escape handling', 'Backdrop', 'Animations'],
    examples: ['Form modals', 'Confirmation dialogs']
  },
  {
    name: 'dropdown-menus',
    domain: 'UI Patterns',
    agents: ['VENUS'],
    keywords: ['dropdown', 'menu', 'select', 'combobox', 'autocomplete'],
    description: 'Dropdown and select patterns',
    patterns: ['Keyboard navigation', 'Typeahead', 'Multi-select', 'Virtualization'],
    examples: ['Navigation menus', 'Form selects']
  },
  {
    name: 'tabs-navigation',
    domain: 'UI Patterns',
    agents: ['VENUS'],
    keywords: ['tabs', 'navigation', 'panel', 'switcher'],
    description: 'Tab navigation patterns',
    patterns: ['Stateful tabs', 'Lazy loading', 'Responsive', 'Accessibility'],
    examples: ['Content tabs', 'Settings panels']
  },
  {
    name: 'breadcrumb-navigation',
    domain: 'UI Patterns',
    agents: ['VENUS', 'JUPITER'],
    keywords: ['breadcrumb', 'navigation', 'hierarchy', 'path'],
    description: 'Breadcrumb navigation',
    patterns: ['Hierarchy display', 'Clickable', 'Responsive', 'Schema.org'],
    examples: ['Category paths', 'Site navigation']
  },
  {
    name: 'pagination-infinite',
    domain: 'UI Patterns',
    agents: ['VENUS', 'IO'],
    keywords: ['pagination', 'infinite scroll', 'load more', 'virtual'],
    description: 'Pagination and infinite scroll',
    patterns: ['Cursor pagination', 'Offset pagination', 'Virtual scrolling', 'Prefetching'],
    examples: ['Data tables', 'Feed scrolling']
  },
  {
    name: 'command-palette',
    domain: 'UX',
    agents: ['VENUS', 'JUPITER'],
    keywords: ['command', 'palette', 'spotlight', 'search', 'shortcut'],
    description: 'Command palette interface',
    patterns: ['Keyboard shortcut', 'Fuzzy search', 'Actions', 'Contextual'],
    examples: ['VS Code palette', 'Quick actions']
  },
  {
    name: 'dark-mode-toggle',
    domain: 'UI Patterns',
    agents: ['VENUS', 'EUROPA'],
    keywords: ['dark mode', 'theme', 'toggle', 'color scheme'],
    description: 'Dark mode implementation',
    patterns: ['System preference', 'Manual toggle', 'Persistence', 'Smooth transition'],
    examples: ['Theme switching', 'OS sync']
  },
  {
    name: 'print-styles',
    domain: 'Styling',
    agents: ['VENUS', 'EUROPA'],
    keywords: ['print', 'media query', 'pdf', 'stylesheet'],
    description: 'Print-friendly styles',
    patterns: ['@media print', 'Page breaks', 'Hide elements', 'Optimizations'],
    examples: ['Print views', 'PDF generation']
  },
  {
    name: 'responsive-images',
    domain: 'Performance',
    agents: ['VENUS', 'EUROPA', 'IO'],
    keywords: ['responsive', 'image', 'srcset', 'sizes', 'art direction'],
    description: 'Responsive image techniques',
    patterns: ['Srcset', 'Sizes', 'Picture element', 'Lazy loading'],
    examples: ['Art direction', 'Resolution switching']
  },
  {
    name: 'font-loading',
    domain: 'Performance',
    agents: ['VENUS', 'IO', 'EUROPA'],
    keywords: ['font', 'webfont', 'loading', 'foit', 'fout'],
    description: 'Web font loading strategies',
    patterns: ['Font display', 'Preloading', 'Subsetting', 'Fallbacks'],
    examples: ['Google Fonts', 'Custom fonts']
  },
  {
    name: 'critical-css',
    domain: 'Performance',
    agents: ['IO', 'VENUS'],
    keywords: ['critical', 'css', 'above fold', 'inline', 'render'],
    description: 'Critical CSS extraction',
    patterns: ['Above-fold CSS', 'Inline critical', 'Async non-critical', 'Tools'],
    examples: ['Fast first paint', 'Render optimization']
  },
  {
    name: 'service-worker-advanced',
    domain: 'PWA',
    agents: ['EUROPA', 'MIMAS'],
    keywords: ['service worker', 'sw', 'cache', 'background sync', 'push'],
    description: 'Advanced service worker patterns',
    patterns: ['Cache strategies', 'Background sync', 'Push notifications', 'Periodic sync'],
    examples: ['Offline apps', 'Background tasks']
  },
  {
    name: 'web-app-manifest',
    domain: 'PWA',
    agents: ['EUROPA'],
    keywords: ['manifest', 'pwa', 'install', 'icon', 'theme'],
    description: 'Web App Manifest configuration',
    patterns: ['Manifest.json', 'Icons', 'Display modes', 'Shortcuts'],
    examples: ['Installable apps', 'Homescreen icons']
  },
  {
    name: 'payment-request-api',
    domain: 'Payments',
    agents: ['GANYMEDE', 'VENUS'],
    keywords: ['payment request', 'api', 'browser', 'wallet'],
    description: 'Payment Request API',
    patterns: ['Payment methods', 'Shipping', 'Contact info', 'Confirmation'],
    examples: ['Apple Pay', 'Google Pay', 'Browser payments']
  },
  {
    name: 'subscription-billing',
    domain: 'Payments',
    agents: ['MARS', 'GANYMEDE'],
    keywords: ['subscription', 'billing', 'recurring', 'invoice', 'plan'],
    description: 'Subscription billing system',
    patterns: ['Plans', 'Trials', 'Upgrades', 'Proration', 'Invoicing'],
    examples: ['SaaS billing', 'Membership systems']
  },
  {
    name: 'usage-based-billing',
    domain: 'Payments',
    agents: ['MARS', 'NEPTUNE', 'GANYMEDE'],
    keywords: ['usage', 'metered', 'billing', 'consumption', 'pricing'],
    description: 'Usage-based billing',
    patterns: ['Metering', 'Aggregations', 'Pricing tiers', 'Billing cycles'],
    examples: ['API billing', 'Cloud resources', 'Pay-as-you-go']
  },
  {
    name: 'referral-system',
    domain: 'Growth',
    agents: ['MARS', 'NEPTUNE', 'VENUS'],
    keywords: ['referral', 'affiliate', 'invite', 'growth', 'viral'],
    description: 'Referral and affiliate system',
    patterns: ['Referral codes', 'Tracking', 'Rewards', 'Attribution'],
    examples: ['Invite friends', 'Affiliate marketing']
  },
  {
    name: 'ab-testing',
    domain: 'Growth',
    agents: ['NEPTUNE', 'VENUS', 'MARS'],
    keywords: ['ab test', 'experiment', 'split test', 'feature flag', 'conversion'],
    description: 'A/B testing framework',
    patterns: ['Experiment setup', 'Variant assignment', 'Tracking', 'Analysis'],
    examples: ['Conversion optimization', 'Feature testing']
  },
  {
    name: 'onboarding-checklist',
    domain: 'Growth',
    agents: ['VENUS', 'EARTH', 'NEPTUNE'],
    keywords: ['onboarding', 'checklist', 'progress', 'activation', 'tutorial'],
    description: 'User onboarding checklist',
    patterns: ['Progress tracking', 'Guided steps', 'Gamification', 'Completion'],
    examples: ['New user flow', 'Feature adoption']
  },
  {
    name: 'feedback-collection',
    domain: 'Product',
    agents: ['VENUS', 'NEPTUNE'],
    keywords: ['feedback', 'survey', 'nps', 'rating', 'review'],
    description: 'User feedback collection',
    patterns: ['In-app surveys', 'NPS', 'Ratings', 'Sentiment analysis'],
    examples: ['Product feedback', 'Feature requests']
  },
  {
    name: 'changelog-releases',
    domain: 'Product',
    agents: ['CALLISTO', 'TRITON'],
    keywords: ['changelog', 'release notes', 'version', 'update'],
    description: 'Changelog and release notes',
    patterns: ['Versioning', 'Categorization', 'Communication', 'Highlights'],
    examples: ['Release notes', 'Product updates']
  },
  {
    name: 'api-versioning',
    domain: 'API Design',
    agents: ['JUPITER', 'GANYMEDE'],
    keywords: ['api', 'version', 'v1', 'v2', 'deprecation'],
    description: 'API versioning strategies',
    patterns: ['URL versioning', 'Header versioning', 'Deprecation', 'Migration'],
    examples: ['REST API versions', 'Breaking changes']
  },
  {
    name: 'api-documentation',
    domain: 'Documentation',
    agents: ['CALLISTO', 'GANYMEDE'],
    keywords: ['api docs', 'openapi', 'swagger', 'documentation'],
    description: 'API documentation',
    patterns: ['OpenAPI spec', 'Examples', 'Interactive docs', 'Changelog'],
    examples: ['Swagger UI', 'API reference']
  },
  {
    name: 'sdk-generation',
    domain: 'Developer Tools',
    agents: ['GANYMEDE', 'CALLISTO'],
    keywords: ['sdk', 'client', 'generation', 'openapi', 'codegen'],
    description: 'SDK generation from APIs',
    patterns: ['OpenAPI generation', 'Type safety', 'Multiple languages', 'Publishing'],
    examples: ['TypeScript SDK', 'Python client']
  },
  {
    name: 'cli-tool',
    domain: 'Developer Tools',
    agents: ['TRITON', 'GANYMEDE'],
    keywords: ['cli', 'command line', 'terminal', 'tool'],
    description: 'CLI tool development',
    patterns: ['Argument parsing', 'Interactive prompts', 'Progress bars', 'Colors'],
    examples: ['Dev tools', 'Automation scripts']
  },
  {
    name: 'vscode-extension',
    domain: 'Developer Tools',
    agents: ['VENUS', 'MARS'],
    keywords: ['vscode', 'extension', 'plugin', 'ide'],
    description: 'VS Code extension development',
    patterns: ['Commands', 'Language server', 'Webviews', 'Settings'],
    examples: ['Editor extensions', 'Language support']
  },
  {
    name: 'browser-extension',
    domain: 'Browser',
    agents: ['VENUS', 'MARS'],
    keywords: ['browser extension', 'chrome', 'firefox', 'addon'],
    description: 'Browser extension development',
    patterns: ['Manifest v3', 'Content scripts', 'Background', 'Popup'],
    examples: ['Chrome extensions', 'Firefox addons']
  },
  {
    name: 'electron-app',
    domain: 'Desktop',
    agents: ['VENUS', 'JUPITER', 'MARS'],
    keywords: ['electron', 'desktop', 'app', 'cross platform'],
    description: 'Electron desktop app',
    patterns: ['Main process', 'Renderer', 'IPC', 'Auto-update'],
    examples: ['Desktop apps', 'Cross-platform']
  },
  {
    name: 'react-native-mobile',
    domain: 'Mobile',
    agents: ['VENUS', 'EUROPA'],
    keywords: ['react native', 'mobile', 'ios', 'android'],
    description: 'React Native mobile app',
    patterns: ['Components', 'Navigation', 'Platform-specific', 'Native modules'],
    examples: ['iOS apps', 'Android apps']
  },
  {
    name: 'flutter-mobile',
    domain: 'Mobile',
    agents: ['VENUS', 'EUROPA'],
    keywords: ['flutter', 'dart', 'mobile', 'cross platform'],
    description: 'Flutter mobile development',
    patterns: ['Widgets', 'State management', 'Navigation', 'Platform channels'],
    examples: ['Cross-platform apps']
  },
  {
    name: 'swift-ios',
    domain: 'Mobile',
    agents: ['VENUS', 'EUROPA'],
    keywords: ['swift', 'ios', 'apple', 'native'],
    description: 'Swift iOS development',
    patterns: ['SwiftUI', 'UIKit', 'Combine', 'Core Data'],
    examples: ['Native iOS apps']
  },
  {
    name: 'kotlin-android',
    domain: 'Mobile',
    agents: ['VENUS', 'EUROPA'],
    keywords: ['kotlin', 'android', 'native', 'jetpack'],
    description: 'Kotlin Android development',
    patterns: ['Jetpack Compose', 'ViewModel', 'Coroutines', 'Room'],
    examples: ['Native Android apps']
  }
];

// Generate SKILL.md files for each template
function generateSkillFiles() {
  const skillsDir = join(process.cwd(), '.nova', 'skills');
  
  for (const template of skillTemplates) {
    const skillPath = join(skillsDir, template.name);
    
    // Create directory
    mkdirSync(skillPath, { recursive: true });
    mkdirSync(join(skillPath, 'patterns'), { recursive: true });
    mkdirSync(join(skillPath, 'examples'), { recursive: true });
    
    // Generate SKILL.md content
    const content = generateSkillContent(template);
    
    // Write file
    writeFileSync(join(skillPath, 'SKILL.md'), content);
    console.log(`✅ Created skill: ${template.name}`);
  }
  
  console.log(`\n🎉 Generated ${skillTemplates.length} skills!`);
}

function generateSkillContent(template: SkillTemplate): string {
  return `# Skill: ${template.name}

## Domain
${template.domain}

## Agents That Use This Skill
${template.agents.map(a => `- **${a}** - ${getAgentRole(a)}`).join('\n')}

## When to Load
Auto-load when task description contains: \`${template.keywords.join(', ')}\`

## Description
${template.description}

## Patterns Provided

${template.patterns.map(p => `### ${p}
Detailed pattern description and implementation guidance for ${p.toLowerCase()}.
`).join('\n')}

## Example Use Cases

${template.examples.map(e => `- **${e}** - Implementation guidance`).join('\n')}

## Key Considerations

- Security implications
- Performance best practices
- Common pitfalls to avoid
- Integration points with other systems

## Related Skills

- List of complementary skills
- Skills that should be loaded together

## Resources

- Documentation links
- Best practice guides
- Community resources
`;
}

function getAgentRole(agent: string): string {
  const roles: Record<string, string> = {
    'GANYMEDE': 'API integration',
    'MARS': 'Backend implementation',
    'VENUS': 'Frontend/UI',
    'ENCELADUS': 'Security',
    'PLUTO': 'Database schema',
    'JUPITER': 'Architecture',
    'NEPTUNE': 'Analytics',
    'IO': 'Performance',
    'MIMAS': 'Resilience',
    'EUROPA': 'Mobile/PWA',
    'CALLISTO': 'Documentation',
    'TRITON': 'DevOps/Deployment',
    'EARTH': 'Product specs',
    'SATURN': 'Testing',
    'TITAN': 'Real-time',
    'URANUS': 'Research',
    'ATLAS': 'Meta-learning',
    'ANDROMEDA': 'Ideas/Research',
    'SUN': 'Orchestration',
    'MERCURY': 'Validation',
    'JUPITER': 'Architecture'
  };
  return roles[agent] || 'Domain expert';
}

// Run generator
generateSkillFiles();
