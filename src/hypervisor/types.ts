// Hypervisor Hypercore — Core Types
// Sprint S2-10 | Hypervisor Integration (Reel 2)

import { z } from 'zod';

// ─── VM Specs & State ────────────────────────────────────────────────────────

export const IsolationLevelSchema = z.enum(['none', 'process', 'namespace', 'vm', 'ultra']);
export type IsolationLevel = z.infer<typeof IsolationLevelSchema>;

export const VMStateSchema = z.enum(['creating', 'running', 'paused', 'stopped', 'destroyed', 'error']);
export type VMState = z.infer<typeof VMStateSchema>;

export const HypervisorProviderSchema = z.enum(['firecracker', 'qemu', 'docker']);
export type HypervisorProvider = z.infer<typeof HypervisorProviderSchema>;

export const ResourceLimitsSchema = z.object({
  cpuMillicores: z.number().positive().default(500),
  memoryMb: z.number().positive().default(256),
  diskMb: z.number().positive().default(1024),
  networkKbps: z.number().nonnegative().default(1024),
  maxProcesses: z.number().positive().default(32),
});
export type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;

export const DriveSpecSchema = z.object({
  driveId: z.string(),
  pathOnHost: z.string(),
  isRootDevice: z.boolean().default(false),
  isReadOnly: z.boolean().default(false),
});
export type DriveSpec = z.infer<typeof DriveSpecSchema>;

export const VMSpecSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  provider: HypervisorProviderSchema.default('docker'),
  image: z.string(),
  kernelImage: z.string().optional(),
  isolationLevel: IsolationLevelSchema.default('process'),
  resources: ResourceLimitsSchema.default({}),
  drives: z.array(DriveSpecSchema).default([]),
  networkEnabled: z.boolean().default(false),
  agentId: z.string().optional(),
  metadata: z.record(z.string()).default({}),
  bootTimeoutMs: z.number().positive().default(30_000),
});
export type VMSpec = z.infer<typeof VMSpecSchema>;

export const VMInstanceSchema = z.object({
  vmId: z.string(),
  spec: VMSpecSchema,
  state: VMStateSchema,
  createdAt: z.number(),
  startedAt: z.number().optional(),
  stoppedAt: z.number().optional(),
  resources: ResourceLimitsSchema,
  errorMessage: z.string().optional(),
});
export type VMInstance = z.infer<typeof VMInstanceSchema>;

// ─── Task I/O ────────────────────────────────────────────────────────────────

export const TaskPayloadSchema = z.object({
  taskId: z.string(),
  agentId: z.string(),
  action: z.string(),
  args: z.record(z.unknown()).default({}),
  timeoutMs: z.number().positive().default(60_000),
  correlationId: z.string().optional(),
});
export type TaskPayload = z.infer<typeof TaskPayloadSchema>;

export const TaskResultSchema = z.object({
  taskId: z.string(),
  success: z.boolean(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number().nonnegative(),
  exitCode: z.number().optional(),
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

// ─── Sandbox / OPA Policy ────────────────────────────────────────────────────

export const SandboxPolicySchema = z.object({
  agentId: z.string(),
  allowedOperations: z.array(z.string()),
  blockedOperations: z.array(z.string()).default([]),
  networkAccess: z.boolean().default(false),
  fileSystemAccess: z.boolean().default(false),
  maxMemoryMb: z.number().positive().default(256),
  isolationLevel: IsolationLevelSchema.default('vm'),
});
export type SandboxPolicy = z.infer<typeof SandboxPolicySchema>;

export const PolicyEvaluationResultSchema = z.object({
  allowed: z.boolean(),
  agentId: z.string(),
  operation: z.string(),
  reasons: z.array(z.string()),
  evaluatedAt: z.number(),
});
export type PolicyEvaluationResult = z.infer<typeof PolicyEvaluationResultSchema>;

export const CleanupVerificationSchema = z.object({
  vmId: z.string(),
  cleaned: z.boolean(),
  residualFiles: z.array(z.string()).default([]),
  residualProcesses: z.number().default(0),
  verifiedAt: z.number(),
});
export type CleanupVerification = z.infer<typeof CleanupVerificationSchema>;

// ─── Observability & Audit ────────────────────────────────────────────────────

export const HypervisorAuditEventSchema = z.object({
  eventType: z.enum(['vm-spawned', 'vm-terminated', 'vm-state-change', 'task-executed',
    'policy-evaluated', 'security-violation', 'image-verified', 'health-warning', 'error']),
  vmId: z.string().optional(),
  agentId: z.string().optional(),
  details: z.record(z.unknown()).default({}),
  timestamp: z.number(),
  severity: z.enum(['info', 'warn', 'error']).default('info'),
});
export type HypervisorAuditEvent = z.infer<typeof HypervisorAuditEventSchema>;

export const AggregateHypervisorMetricsSchema = z.object({
  totalVMsSpawned: z.number().default(0),
  totalVMsTerminated: z.number().default(0),
  currentlyRunning: z.number().default(0),
  totalTasksExecuted: z.number().default(0),
  totalErrors: z.number().default(0),
  avgTaskDurationMs: z.number().default(0),
  providerBreakdown: z.record(z.number()).default({}),
});
export type AggregateHypervisorMetrics = z.infer<typeof AggregateHypervisorMetricsSchema>;

export const SecurityMetricsSchema = z.object({
  policyViolations: z.number().default(0),
  imageVerificationFailures: z.number().default(0),
  unauthorizedAccessAttempts: z.number().default(0),
  sandboxEscapeAttempts: z.number().default(0),
});
export type SecurityMetrics = z.infer<typeof SecurityMetricsSchema>;

// ─── Agent Deployment ─────────────────────────────────────────────────────────

export const AgentDeploymentSchema = z.object({
  agentName: z.string(),
  vmId: z.string(),
  spec: VMSpecSchema,
  deployedAt: z.number(),
  status: VMStateSchema,
});
export type AgentDeployment = z.infer<typeof AgentDeploymentSchema>;

export const TrustedManifestSchema = z.object({
  version: z.string(),
  images: z.record(z.string()),    // imagePath → sha256
  kernels: z.record(z.string()),   // kernelPath → sha256
  plugins: z.record(z.string()),   // pluginName → sha256
  updatedAt: z.number(),
});
export type TrustedManifest = z.infer<typeof TrustedManifestSchema>;

export const VerificationResultSchema = z.object({
  verified: z.boolean(),
  path: z.string(),
  expectedHash: z.string(),
  actualHash: z.string(),
  verifiedAt: z.number(),
  error: z.string().optional(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

// ─── Config ──────────────────────────────────────────────────────────────────

export const HypervisorManagerConfigSchema = z.object({
  storagePath: z.string().default('.nova/hypervisor'),
  maxConcurrentVMs: z.number().positive().default(10),
  defaultProvider: HypervisorProviderSchema.default('docker'),
  healthWarningThreshold: z.number().positive().default(5),
  healthWarningWindowMs: z.number().positive().default(60_000),
  replicationEnabled: z.boolean().default(false),
});
export type HypervisorManagerConfig = z.infer<typeof HypervisorManagerConfigSchema>;
