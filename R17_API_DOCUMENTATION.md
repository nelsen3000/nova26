# R17 API Documentation

## Module: Code Review & PR Intelligence

### Classes

#### `PRIntelligence`
Core class for managing code reviews and PR analysis.

**Constructor:**
```typescript
new PRIntelligence(config?: Partial<ReviewConfig>)
```

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `createReview` | `prNumber, title, author, branch, baseBranch` | `CodeReview` | Create new review |
| `addFileChange` | `reviewId, fileChange` | `CodeReview` | Add file to review |
| `addIssue` | `reviewId, issue` | `CodeReview` | Add code issue |
| `addComment` | `reviewId, comment` | `CodeReview` | Add review comment |
| `updateStatus` | `reviewId, status` | `CodeReview` | Update review status |
| `analyzeCodeQuality` | `reviewId` | `QualityAnalysis` | Analyze code quality |
| `shouldBlockMerge` | `reviewId` | `{ block, reasons }` | Check if merge should be blocked |
| `getReview` | `id` | `CodeReview \| undefined` | Get review by ID |
| `getReviewsByStatus` | `status` | `CodeReview[]` | Filter by status |
| `getReviewsByAuthor` | `author` | `CodeReview[]` | Filter by author |

---

## Module: Migration & Framework Upgrade

#### `FrameworkMigrator`
Manages framework and dependency migrations.

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `createPlan` | `name, type, fromVersion, toVersion` | `MigrationPlan` | Create migration plan |
| `addStep` | `planId, step` | `MigrationPlan` | Add migration step |
| `addBreakingChange` | `planId, change` | `MigrationPlan` | Add breaking change |
| `updateStepStatus` | `planId, stepId, status` | `MigrationPlan` | Update step status |
| `executePlan` | `planId` | `MigrationResult` | Execute migration |
| `analyzeFramework` | `current, target` | `AnalysisResult` | Compare frameworks |
| `generateReport` | `planId` | `string` | Generate text report |

---

## Module: Debugging & Root Cause Analysis

#### `RootCauseAnalyzer`
Debug session management and root cause analysis.

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `createSession` | `name` | `DebugSession` | Create debug session |
| `addBreakpoint` | `sessionId, breakpoint` | `DebugSession` | Add breakpoint |
| `removeBreakpoint` | `sessionId, breakpointId` | `DebugSession` | Remove breakpoint |
| `recordStackTrace` | `sessionId, frames` | `DebugSession` | Record stack trace |
| `addLogEntry` | `sessionId, entry` | `DebugSession` | Add log entry |
| `analyzeRootCause` | `sessionId, error` | `RootCauseAnalysis` | Perform RCA |
| `pauseSession` | `sessionId` | `DebugSession` | Pause execution |
| `resumeSession` | `sessionId` | `DebugSession` | Resume execution |
| `stopSession` | `sessionId` | `DebugSession` | Stop session |
| `getActiveSessions` | - | `DebugSession[]` | Get active sessions |

---

## Module: Accessibility & WCAG Engine

#### `WCAGEngine`
WCAG compliance auditing engine.

**Constructor:**
```typescript
new WCAGEngine(config?: Partial<A11yConfig>)
```

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `audit` | `html, url` | `Promise<AccessibilityAudit>` | Run accessibility audit |
| `checkElement` | `element, checks` | `ElementCheck` | Check specific element |
| `getViolations` | `auditId, level?` | `AccessibilityResult[]` | Get violations |
| `generateReport` | `auditId` | `string` | Generate text report |
| `isCompliant` | `auditId, level?` | `boolean` | Check compliance |
| `getScore` | `auditId` | `number` | Get accessibility score |

**Helper Functions:**
```typescript
calculateContrastRatio(foreground: string, background: string): number
isContrastCompliant(ratio: number, level?: WCAGLevel): boolean
```

---

## Module: Technical Debt Scoring

#### `DebtTracker`
Tracks and analyzes technical debt.

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `addDebt` | `debt` | `TechnicalDebt` | Add debt item |
| `updateDebt` | `id, updates` | `TechnicalDebt` | Update debt |
| `resolveDebt` | `id` | `TechnicalDebt` | Mark as resolved |
| `getDebt` | `id` | `TechnicalDebt \| undefined` | Get debt by ID |
| `getAllDebts` | - | `TechnicalDebt[]` | Get all debts |
| `getDebtsByType` | `type` | `TechnicalDebt[]` | Filter by type |
| `getDebtsByPriority` | `priority` | `TechnicalDebt[]` | Filter by priority |
| `getOverdueDebts` | - | `TechnicalDebt[]` | Get overdue items |
| `calculateMetrics` | - | `DebtMetrics` | Calculate metrics |
| `calculateScore` | - | `number` | Calculate score |
| `getTrends` | `periods?` | `DebtTrend[]` | Get trend data |
| `recommendRepayment` | - | `TechnicalDebt[]` | Get repayment order |

---

## Module: Dependency Management

#### `DependencyManager`
Manages package dependencies and vulnerabilities.

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `addDependency` | `dep` | `void` | Add dependency |
| `addVulnerability` | `vuln` | `void` | Add vulnerability |
| `getDependency` | `name` | `Dependency \| undefined` | Get dependency |
| `getAllDependencies` | - | `Dependency[]` | Get all dependencies |
| `getOutdatedDependencies` | - | `Dependency[]` | Get outdated packages |
| `getDeprecatedDependencies` | - | `Dependency[]` | Get deprecated packages |
| `getVulnerabilities` | `severity?` | `Vulnerability[]` | Get vulnerabilities |
| `analyzeUpdate` | `name, targetVersion` | `UpdatePlan` | Analyze update |
| `generateReport` | - | `DependencyReport` | Generate report |
| `getUpdateRecommendations` | - | `UpdatePlan[]` | Get recommendations |

---

## Module: Production Feedback Loop

#### `FeedbackLoop`
Collects and analyzes production feedback.

**Constructor:**
```typescript
new FeedbackLoop(config?: Partial<FeedbackLoopConfig>)
```

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `collect` | `feedback` | `ProductionFeedback` | Collect feedback |
| `analyze` | `feedbackId` | `FeedbackAnalysis` | Analyze feedback |
| `getFeedback` | `id` | `ProductionFeedback \| undefined` | Get feedback |
| `getFeedbackByType` | `type` | `ProductionFeedback[]` | Filter by type |
| `getFeedbackByService` | `service` | `ProductionFeedback[]` | Filter by service |
| `getCriticalFeedback` | - | `ProductionFeedback[]` | Get critical items |
| `getTrend` | `timeWindow` | `Trend[]` | Get trend data |
| `correlate` | `id1, id2` | `boolean` | Check correlation |
| `generateIncidentReport` | `timeWindow` | `IncidentReport` | Generate report |

---

## Module: Health Dashboard

#### `HealthMonitor`
Monitors system health and metrics.

**Constructor:**
```typescript
new HealthMonitor(config?: Partial<HealthConfig>)
```

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `registerCheck` | `check` | `HealthCheck` | Register health check |
| `updateCheck` | `id, updates` | `HealthCheck` | Update check |
| `recordMetric` | `metric` | `SystemMetric` | Record metric |
| `createAlert` | `alert` | `Alert` | Create alert |
| `acknowledgeAlert` | `id` | `Alert` | Acknowledge alert |
| `resolveAlert` | `id` | `Alert` | Resolve alert |
| `getDashboard` | - | `HealthDashboard` | Get full dashboard |
| `getChecksByStatus` | `status` | `HealthCheck[]` | Filter checks |
| `getActiveAlerts` | - | `Alert[]` | Get active alerts |
| `getMetrics` | `type?, name?` | `SystemMetric[]` | Get metrics |

---

## Module: Environment Management

#### `EnvironmentManager`
Manages environment variables and configurations.

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `createEnvironment` | `name, type, description?` | `Environment` | Create environment |
| `createFromTemplate` | `template` | `Environment` | Create from template |
| `addVariable` | `envId, variable` | `Environment` | Add variable |
| `updateVariable` | `envId, varId, updates` | `Environment` | Update variable |
| `removeVariable` | `envId, varId` | `Environment` | Remove variable |
| `deleteEnvironment` | `id` | `boolean` | Delete environment |
| `getEnvironment` | `id` | `Environment \| undefined` | Get environment |
| `getEnvironmentsByType` | `type` | `Environment[]` | Filter by type |
| `getVariable` | `envId, key` | `Variable \| undefined` | Get variable |
| `getSecrets` | `envId` | `Variable[]` | Get secrets |
| `diffEnvironments` | `id1, id2` | `EnvironmentDiff` | Compare environments |
| `syncEnvironment` | `envId` | `SyncResult` | Sync environment |
| `cloneEnvironment` | `sourceId, newName, newType` | `Environment` | Clone environment |
| `generateDotenv` | `envId` | `string` | Generate .env file |
| `validateEnvironment` | `envId` | `{ valid, errors }` | Validate environment |

---

## Module: Orchestration Optimization

#### `OrchestrationOptimizer`
Orchestrates all R17 modules.

**Methods:**
| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `createPlan` | `tasks, priority, context` | `OptimizationPlan` | Create execution plan |
| `executePlan` | `planId` | `Promise<OrchestrationReport>` | Execute plan |
| `getOptimalTaskOrder` | `tasks` | `AgentTask[]` | Optimize task order |
| `analyzeBottlenecks` | `planId` | `Bottleneck[]` | Find bottlenecks |

**Helper Functions:**
```typescript
createOrchestrationOptimizer(): OrchestrationOptimizer
buildOrchestrationContext(projectId: string, options?: Partial<Modules>): OrchestrationContext
mergeTaskResults(results: TaskResult[]): MergedResults
```

---

## Common Types

### Severity Levels
```typescript
type SeverityLevel = 'info' | 'warning' | 'error' | 'critical';
type AccessibilitySeverity = 'minor' | 'moderate' | 'serious' | 'critical';
type VulnerabilitySeverity = 'low' | 'moderate' | 'high' | 'critical';
type DebtPriority = 'low' | 'medium' | 'high' | 'critical';
```

### Status Types
```typescript
type ReviewStatus = 'pending' | 'in-review' | 'approved' | 'changes-requested' | 'merged';
type MigrationStatus = 'pending' | 'analyzing' | 'ready' | 'migrating' | 'testing' | 'complete' | 'failed';
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';
```

### Task Types
```typescript
type AgentTask = 
  | 'code-review' 
  | 'migration' 
  | 'debug' 
  | 'a11y-audit' 
  | 'debt-analysis' 
  | 'dependency-check' 
  | 'feedback-monitor' 
  | 'health-check' 
  | 'env-sync';
```
