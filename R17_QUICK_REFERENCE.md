# R17 Quick Reference Card

## Module Overview

### R17-01: Code Review & PR Intelligence
```typescript
import { PRIntelligence, createPRIntelligence } from './src/review/index.js';

const pr = createPRIntelligence({ autoReview: true });
const review = pr.createReview(1, 'Title', 'author', 'branch', 'main');
pr.addIssue(review.id, { filePath: 'src/index.ts', line: 10, severity: 'critical', category: 'security', message: 'Issue' });
const analysis = pr.analyzeCodeQuality(review.id);
```

### R17-02: Migration & Framework Upgrade
```typescript
import { FrameworkMigrator, createFrameworkMigrator } from './src/migrate/index.js';

const migrator = createFrameworkMigrator();
const plan = migrator.createPlan('React 18', 'framework', '17.0', '18.0');
migrator.addStep(plan.id, { name: 'Update deps', order: 1, automated: true, files: ['package.json'] });
const result = migrator.executePlan(plan.id);
```

### R17-03: Debugging & Root Cause Analysis
```typescript
import { RootCauseAnalyzer, parseStackTrace } from './src/debug/index.js';

const analyzer = new RootCauseAnalyzer();
const session = analyzer.createSession('Debug Session');
analyzer.addBreakpoint(session.id, { file: 'src/index.ts', line: 10, type: 'line', enabled: true });
const analysis = analyzer.analyzeRootCause(session.id, errorDetails);
```

### R17-04: Accessibility & WCAG Engine
```typescript
import { WCAGEngine, calculateContrastRatio } from './src/a11y/index.js';

const engine = new WCAGEngine({ targetLevel: 'AA' });
const audit = await engine.audit(html, 'https://example.com');
const score = engine.getScore(audit.id);
const isCompliant = engine.isCompliant(audit.id);
```

### R17-05: Technical Debt Scoring
```typescript
import { DebtTracker, createDebtTracker } from './src/debt/index.js';

const tracker = createDebtTracker();
tracker.addDebt({ title: 'Legacy code', type: 'code', priority: 'high', estimatedEffort: 8, interestPerPeriod: 2 });
const metrics = tracker.calculateMetrics();
const score = tracker.calculateScore();
```

### R17-06: Dependency Management
```typescript
import { DependencyManager, createDependencyManager } from './src/deps/index.js';

const manager = createDependencyManager();
manager.addDependency({ name: 'lodash', currentVersion: '4.17.20', type: 'production', outdated: true });
manager.addVulnerability({ id: 'VULN-1', packageName: 'lodash', severity: 'high', fixAvailable: true });
const report = manager.generateReport();
```

### R17-07: Production Feedback Loop
```typescript
import { FeedbackLoop, createFeedbackLoop } from './src/prod-feedback/index.js';

const loop = createFeedbackLoop({ samplingRate: 1.0 });
const feedback = loop.collect({ type: 'error', priority: 'critical', service: 'api', environment: 'prod' });
const analysis = loop.analyze(feedback.id);
const incidentReport = loop.generateIncidentReport(3600000);
```

### R17-08: Health Dashboard
```typescript
import { HealthMonitor, createHealthMonitor } from './src/health/index.js';

const monitor = createHealthMonitor();
monitor.registerCheck({ name: 'API', service: 'api', status: 'healthy', responseTime: 50 });
monitor.recordMetric({ type: 'cpu', name: 'cpu_usage', value: 45, unit: '%' });
const dashboard = monitor.getDashboard();
```

### R17-09: Environment Management
```typescript
import { EnvironmentManager, createEnvironmentManager } from './src/env/index.js';

const manager = createEnvironmentManager();
const env = manager.createEnvironment('Production', 'production');
manager.addVariable(env.id, { key: 'API_URL', value: 'https://api.com', type: 'string' });
const dotenv = manager.generateDotenv(env.id);
```

### R17-10: Orchestration Optimization
```typescript
import { OrchestrationOptimizer, buildOrchestrationContext } from './src/orchestration/index.js';

const optimizer = new OrchestrationOptimizer();
const context = buildOrchestrationContext('project-1', {
  prIntelligence: new PRIntelligence(),
  debtTracker: new DebtTracker(),
  // ... other modules
});
const plan = optimizer.createPlan(['code-review', 'debt-analysis'], 'high', context);
const report = await optimizer.executePlan(plan.id);
```

## Integration Pattern

```typescript
// Full R17 Stack Integration
import { createOrchestrationOptimizer, buildOrchestrationContext } from './src/orchestration/index.js';
import { createPRIntelligence } from './src/review/index.js';
import { createDebtTracker } from './src/debt/index.js';
import { createDependencyManager } from './src/deps/index.js';
import { createFeedbackLoop } from './src/prod-feedback/index.js';
import { createHealthMonitor } from './src/health/index.js';

const context = buildOrchestrationContext('my-project', {
  prIntelligence: createPRIntelligence(),
  debtTracker: createDebtTracker(),
  dependencyManager: createDependencyManager(),
  feedbackLoop: createFeedbackLoop(),
  healthMonitor: createHealthMonitor(),
});

const optimizer = createOrchestrationOptimizer();
const plan = optimizer.createPlan([
  'health-check',
  'feedback-monitor', 
  'code-review',
  'debt-analysis',
  'dependency-check'
], 'high', context);

const report = await optimizer.executePlan(plan.id);
console.log(`Success: ${report.overallSuccess}`);
console.log(`Issues found: ${report.summary.issuesFound}`);
```

## Test Counts by Module

| Module | Tests | Key Features Tested |
|--------|-------|---------------------|
| review | 20 | PR creation, issues, analysis, blocking |
| migrate | 19 | Plans, steps, breaking changes, execution |
| debug | 20 | Sessions, breakpoints, stack traces, RCA |
| a11y | 15 | Audits, contrast, compliance, reports |
| debt | 14 | Tracking, metrics, scoring, trends |
| deps | 15 | Vulnerabilities, updates, reports |
| prod-feedback | 13 | Collection, analysis, correlation |
| health | 17 | Checks, metrics, alerts, dashboard |
| env | 19 | Variables, sync, validation, dotenv |
| orchestration | 19 | Planning, execution, optimization |

**Total: 171 new tests**
