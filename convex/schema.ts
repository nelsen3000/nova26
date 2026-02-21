import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // =====================
  // ATLAS Tables (6)
  // =====================
  
  builds: defineTable({
    prdId: v.string(),
    prdName: v.string(),
    status: v.union(v.literal('running'), v.literal('completed'), v.literal('failed')),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index('by_prd', ['prdId'])
    .index('by_status', ['status'])
    .index('by_timestamp', ['startedAt']),  // H6: time-based queries

  patterns: defineTable({
    name: v.string(),
    description: v.string(),
    code: v.string(),
    language: v.string(),
    tags: v.array(v.string()),
    createdAt: v.string(),
  }).index('by_language', ['language'])
    .index('by_tags', ['tags']),

  agents: defineTable({
    name: v.string(),
    role: v.string(),
    domain: v.string(),
    systemPrompt: v.string(),
    model: v.string(),
    gates: v.array(v.string()),
    createdAt: v.string(),
  }).index('by_name', ['name'])
    .index('by_domain', ['domain']),

  tasks: defineTable({
    buildId: v.id('builds'),
    taskId: v.string(),
    title: v.string(),
    agent: v.string(),
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('running'), v.literal('done'), v.literal('failed'), v.literal('blocked')),
    dependencies: v.array(v.string()),
    phase: v.number(),
    attempts: v.number(),
    createdAt: v.string(),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index('by_build', ['buildId'])
    .index('by_status', ['status'])
    .index('by_agent', ['agent']),

  executions: defineTable({
    taskId: v.id('tasks'),
    agent: v.string(),
    model: v.string(),
    prompt: v.string(),
    response: v.string(),
    gatesPassed: v.boolean(),
    duration: v.number(),
    timestamp: v.string(),
    error: v.optional(v.string()),
  }).index('by_task', ['taskId'])
    .index('by_timestamp', ['timestamp']),

  learnings: defineTable({
    buildId: v.id('builds'),
    taskId: v.string(),
    pattern: v.string(),
    insight: v.string(),
    code: v.optional(v.string()),
    createdAt: v.string(),
  }).index('by_build', ['buildId'])
    .index('by_task', ['taskId']),

  // Agent stats cache — updated by cron job every 5 minutes (H6, H7)
  agentStatsCache: defineTable({
    agentId: v.id('agents'),
    agentName: v.string(),
    role: v.string(),
    totalTasks: v.number(),
    completedTasks: v.number(),
    failedTasks: v.number(),
    successRate: v.number(),
    avgDuration: v.number(),
    lastActive: v.string(),
    currentStatus: v.string(),
    cachedAt: v.string(),
  }).index('by_agent_id', ['agentId'])
    .index('by_last_active', ['lastActive']),

  // =====================
  // UA Dashboard Tables (4)
  // =====================

  companies: defineTable({
    name: v.string(),
    sector: v.string(),
    ceoPersona: v.string(),
    status: v.union(v.literal('active'), v.literal('suspended'), v.literal('bankrupt')),
    createdAt: v.string(),
  }).index("by_status", ["status"])
    .index("by_sector", ["sector"]),

  chipAccounts: defineTable({
    companyId: v.id("companies"),
    type: v.union(v.literal("savings"), v.literal("spending"), v.literal("investment")),
    balance: v.number(),
    lastTransactionAt: v.string(),
  }).index("by_company", ["companyId"])
    .index("by_company_type", ["companyId", "type"]),

  divisions: defineTable({
    companyId: v.id("companies"),
    name: v.string(),
    revenue: v.number(),
    expenses: v.number(),
    agentCount: v.number(),
    status: v.union(v.literal("active"), v.literal("paused")),
  }).index("by_company", ["companyId"])
    .index("by_company_revenue", ["companyId", "revenue"]),

  // UA Dashboard agents (game entities, distinct from ATLAS orchestrator agents above)
  companyAgents: defineTable({
    companyId: v.id("companies"),
    divisionId: v.id("divisions"),
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("active"), v.literal("idle"), v.literal("suspended")),
    currentTaskId: v.optional(v.string()),
    idleMinutes: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_division", ["divisionId"])
    .index("by_status", ["companyId", "status"]),

  // =====================
  // NOVA26 Global Wisdom Tables (4)
  // =====================

  // Global Wisdom patterns with optional embedding vector
  globalPatterns: defineTable({
    canonicalContent: v.string(),
    originalNodeIds: v.array(v.string()),
    successScore: v.number(),
    userDiversity: v.number(),
    lastPromotedAt: v.string(),
    language: v.optional(v.string()),
    tags: v.array(v.string()),
    promotionCount: v.number(),
    harmReports: v.number(),
    isActive: v.boolean(),
    embeddingVector: v.optional(v.array(v.number())),
  }).index('by_active', ['isActive'])
    .index('by_success_score', ['successScore'])
    .index('by_promoted_at', ['lastPromotedAt']),

  // User profiles for Nova26 premium users
  userProfiles: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    tier: v.union(
      v.literal('free'),
      v.literal('pro'),
      v.literal('team'),
      v.literal('enterprise')
    ),
    globalWisdomOptIn: v.boolean(),
    createdAt: v.string(),
    lastActiveAt: v.string(),
  }).index('by_user_id', ['userId'])
    .index('by_tier', ['tier'])
    .index('by_email', ['email']),  // H6: enables fast email lookups

  // Wisdom updates feed for real-time subscriptions
  wisdomUpdates: defineTable({
    patternId: v.string(),
    promotedByUserId: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    successScore: v.number(),
    timestamp: v.string(),
  }).index('by_timestamp', ['timestamp'])
    .index('by_pattern', ['patternId']),

  // Agent activity feed per user
  agentActivityFeed: defineTable({
    userId: v.string(),
    agentName: v.string(),
    eventType: v.union(
      v.literal('task_started'),
      v.literal('task_completed'),
      v.literal('task_failed'),
      v.literal('playbook_updated'),
      v.literal('wisdom_promoted'),
      v.literal('rehearsal_ran')
    ),
    taskId: v.optional(v.string()),
    details: v.string(),
    timestamp: v.string(),
  }).index('by_user_and_time', ['userId', 'timestamp'])
    .index('by_user_and_agent', ['userId', 'agentName']),

  // =====================
  // Agent Harnesses Tables (2)
  // =====================

  // Long-running agent harness state persistence
  agentHarnesses: defineTable({
    harnessId: v.string(),
    agentName: v.string(),
    status: v.union(
      v.literal('created'),
      v.literal('running'),
      v.literal('paused'),
      v.literal('completed'),
      v.literal('failed')
    ),
    parentHarnessId: v.optional(v.string()),
    currentStepId: v.optional(v.string()),
    checkpointData: v.optional(v.string()), // Serialized HarnessState
    progressPercent: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
    completedAt: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  }).index('by_harness_id', ['harnessId'])
    .index('by_status', ['status'])
    .index('by_agent', ['agentName'])
    .index('by_parent', ['parentHarnessId']),

  // Harness execution events for observability
  harnessEvents: defineTable({
    harnessId: v.string(),
    eventType: v.union(
      v.literal('state_transition'),
      v.literal('tool_call'),
      v.literal('human_gate'),
      v.literal('sub_agent_spawned'),
      v.literal('sub_agent_completed'),
      v.literal('checkpoint_created'),
      v.literal('step_completed'),
      v.literal('step_failed'),
      v.literal('plan_completed')
    ),
    stepId: v.optional(v.string()),
    details: v.string(), // JSON string with event-specific data
    timestamp: v.string(),
  }).index('by_harness', ['harnessId'])
    .index('by_harness_and_time', ['harnessId', 'timestamp'])
    .index('by_event_type', ['eventType']),

  // =====================
  // RLM (Recursive Language Models) Tables (2)
  // =====================

  // RLM configuration per company/agent
  rlmConfigs: defineTable({
    companyId: v.string(),
    agentId: v.optional(v.string()), // null = default for company
    enabled: v.boolean(),
    readerModelId: v.string(),
    compressionThreshold: v.number(), // 0-1 relevance score threshold
    maxTokens: v.number(),
    fallbackOnError: v.boolean(),
    updatedAt: v.string(),
    updatedBy: v.string(),
  }).index('by_company', ['companyId'])
    .index('by_company_agent', ['companyId', 'agentId']),

  // RLM audit logs for drift detection
  rlmAuditLogs: defineTable({
    companyId: v.string(),
    sessionId: v.string(),
    agentId: v.string(),
    originalTokens: v.number(),
    compressedTokens: v.number(),
    compressionRatio: v.number(),
    driftScore: v.number(), // semantic similarity score
    fallbackUsed: v.boolean(),
    segmentsCount: v.number(),
    timestamp: v.string(),
    warningIssued: v.boolean(),
  }).index('by_company', ['companyId'])
    .index('by_session', ['sessionId'])
    .index('by_agent', ['agentId'])
    .index('by_timestamp', ['timestamp'])
    .index('by_company_time', ['companyId', 'timestamp']),

  // =====================
  // SAGA (Self-Evolving Goal Agents) Tables (2)
  // =====================

  // Goal genomes for evolutionary optimization
  goalGenomes: defineTable({
    genomeId: v.string(),
    agentName: v.string(),
    schemaVersion: v.number(),
    generation: v.number(),
    parentId: v.optional(v.string()),
    objectives: v.array(v.object({
      id: v.string(),
      description: v.string(),
      domain: v.string(),
      parameters: v.record(v.string(), v.any()),
      weight: v.number(),
    })),
    fitnessCriteria: v.array(v.object({
      objectiveId: v.string(),
      metricName: v.string(),
      targetValue: v.number(),
      currentValue: v.number(),
    })),
    fitnessScore: v.optional(v.number()),
    serializedData: v.string(), // Full genome JSON
    createdAt: v.string(),
    projectId: v.string(),
    isArchived: v.boolean(),
  }).index('by_genome_id', ['genomeId'])
    .index('by_agent', ['agentName'])
    .index('by_project', ['projectId'])
    .index('by_fitness', ['fitnessScore'])
    .index('by_generation', ['generation']),

  // Evolution sessions for SAGA
  evolutionSessions: defineTable({
    sessionId: v.string(),
    agentName: v.string(),
    projectId: v.string(),
    status: v.union(
      v.literal('running'),
      v.literal('paused'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('budget_exceeded')
    ),
    config: v.string(), // Serialized EvolutionConfig
    currentGeneration: v.number(),
    populationIds: v.array(v.string()),
    bestGenomeId: v.optional(v.string()),
    fitnessHistory: v.array(v.array(v.number())), // Array of fitness scores per generation
    startedAt: v.string(),
    updatedAt: v.string(),
    completedAt: v.optional(v.string()),
    metrics: v.object({
      outerLoopIterations: v.number(),
      innerLoopExecutions: v.number(),
      totalComputeTimeMs: v.number(),
      peakMemoryBytes: v.number(),
      candidatesGenerated: v.number(),
      candidatesRejectedByTaste: v.number(),
      swarmDebatesRun: v.number(),
    }),
  }).index('by_session_id', ['sessionId'])
    .index('by_agent', ['agentName'])
    .index('by_project', ['projectId'])
    .index('by_status', ['status']),

  // =====================
  // Hindsight Persistent Memory Tables (3)
  // =====================

  // Memory fragments with vector embeddings
  memoryFragments: defineTable({
    fragmentId: v.string(),
    content: v.string(),
    contentType: v.union(
      v.literal('text'),
      v.literal('code'),
      v.literal('error'),
      v.literal('insight'),
      v.literal('task_result')
    ),
    agentId: v.string(),
    projectId: v.string(),
    namespaceId: v.string(),
    embeddingVector: v.optional(v.array(v.number())),
    accessCount: v.number(),
    lastAccessedAt: v.optional(v.string()),
    createdAt: v.string(),
    expiresAt: v.optional(v.string()),
    isPinned: v.boolean(),
    isArchived: v.boolean(),
    consolidationCount: v.number(),
    metadata: v.record(v.string(), v.any()),
  }).index('by_fragment_id', ['fragmentId'])
    .index('by_agent', ['agentId'])
    .index('by_project', ['projectId'])
    .index('by_namespace', ['namespaceId'])
    .index('by_created', ['createdAt'])
    .index('by_accessed', ['lastAccessedAt']),

  // Consolidation jobs for memory maintenance
  consolidationJobs: defineTable({
    jobId: v.string(),
    namespaceId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    fragmentsProcessed: v.number(),
    fragmentsDeduplicated: v.number(),
    fragmentsArchived: v.number(),
    errorMessage: v.optional(v.string()),
  }).index('by_job_id', ['jobId'])
    .index('by_namespace', ['namespaceId'])
    .index('by_status', ['status']),

  // Namespace management for parallel universes
  memoryNamespaces: defineTable({
    namespaceId: v.string(),
    name: v.string(),
    parentNamespaceId: v.optional(v.string()),
    forkedFromId: v.optional(v.string()),
    projectId: v.string(),
    agentId: v.string(),
    isActive: v.boolean(),
    fragmentCount: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_namespace_id', ['namespaceId'])
    .index('by_project', ['projectId'])
    .index('by_agent', ['agentId'])
    .index('by_parent', ['parentNamespaceId']),

  // =====================
  // Taste Vault Tables (2)
  // =====================

  // Taste patterns with success scores
  tastePatterns: defineTable({
    patternId: v.string(),
    canonicalContent: v.string(),
    patternType: v.union(
      v.literal('architectural'),
      v.literal('code_style'),
      v.literal('testing'),
      v.literal('security'),
      v.literal('performance')
    ),
    successScore: v.number(),
    userDiversity: v.number(),
    promotionCount: v.number(),
    harmReports: v.number(),
    isActive: v.boolean(),
    language: v.optional(v.string()),
    tags: v.array(v.string()),
    createdAt: v.string(),
    lastPromotedAt: v.string(),
    embeddingVector: v.optional(v.array(v.number())),
  }).index('by_pattern_id', ['patternId'])
    .index('by_type', ['patternType'])
    .index('by_success_score', ['successScore'])
    .index('by_active', ['isActive'])
    .index('by_promoted', ['lastPromotedAt']),

  // User votes on patterns
  patternVotes: defineTable({
    voteId: v.string(),
    patternId: v.string(),
    userId: v.string(),
    voteType: v.union(v.literal('upvote'), v.literal('downvote'), v.literal('report')),
    context: v.optional(v.string()),
    createdAt: v.string(),
  }).index('by_vote_id', ['voteId'])
    .index('by_pattern', ['patternId'])
    .index('by_user', ['userId'])
    .index('by_pattern_user', ['patternId', 'userId']),

  // =====================
  // A2A/MCP Protocol Tables (3)
  // =====================

  // Agent cards for discovery
  agentCards: defineTable({
    cardId: v.string(),
    agentId: v.string(),
    name: v.string(),
    description: v.string(),
    tier: v.union(v.literal('L0'), v.literal('L1'), v.literal('L2'), v.literal('L3')),
    capabilities: v.array(v.object({
      skill: v.string(),
      description: v.string(),
      inputSchema: v.optional(v.record(v.string(), v.any())),
      outputSchema: v.optional(v.record(v.string(), v.any())),
    })),
    endpoints: v.array(v.object({
      protocol: v.union(v.literal('a2a'), v.literal('mcp')),
      url: v.string(),
      authentication: v.optional(v.record(v.string(), v.any())),
    })),
    origin: v.union(v.literal('local'), v.literal('remote')),
    revision: v.number(),
    isActive: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_card_id', ['cardId'])
    .index('by_agent', ['agentId'])
    .index('by_tier', ['tier'])
    .index('by_origin', ['origin'])
    .index('by_active', ['isActive']),

  // Swarm coordination tasks
  swarmTasks: defineTable({
    taskId: v.string(),
    swarmId: v.string(),
    coordinatorId: v.string(),
    taskType: v.string(),
    payload: v.string(), // JSON serialized
    status: v.union(
      v.literal('proposed'),
      v.literal('negotiating'),
      v.literal('assigned'),
      v.literal('executing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    assignedAgentId: v.optional(v.string()),
    priority: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
    completedAt: v.optional(v.string()),
    result: v.optional(v.string()),
  }).index('by_task_id', ['taskId'])
    .index('by_swarm', ['swarmId'])
    .index('by_coordinator', ['coordinatorId'])
    .index('by_status', ['status'])
    .index('by_assigned', ['assignedAgentId']),

  // A2A message log for audit
  a2aMessages: defineTable({
    messageId: v.string(),
    envelopeId: v.string(),
    messageType: v.union(
      v.literal('request'),
      v.literal('response'),
      v.literal('notification'),
      v.literal('task_proposal'),
      v.literal('crdt_sync')
    ),
    senderId: v.string(),
    recipientId: v.string(),
    correlationId: v.optional(v.string()),
    payload: v.string(), // JSON serialized
    timestamp: v.string(),
    delivered: v.boolean(),
  }).index('by_message_id', ['messageId'])
    .index('by_envelope', ['envelopeId'])
    .index('by_sender', ['senderId'])
    .index('by_recipient', ['recipientId'])
    .index('by_correlation', ['correlationId'])
    .index('by_timestamp', ['timestamp']),

  // =====================
  // Hypercore P2P Tables (2)
  // =====================

  // P2P peers and connections
  hypercorePeers: defineTable({
    peerId: v.string(),
    publicKey: v.string(),
    displayName: v.optional(v.string()),
    isLocal: v.boolean(),
    connectionStatus: v.union(
      v.literal('connected'),
      v.literal('disconnected'),
      v.literal('connecting'),
      v.literal('banned')
    ),
    lastSeenAt: v.string(),
    bytesTransferred: v.number(),
    latencyMs: v.optional(v.number()),
    version: v.string(),
    capabilities: v.array(v.string()),
  }).index('by_peer_id', ['peerId'])
    .index('by_public_key', ['publicKey'])
    .index('by_status', ['connectionStatus']),

  // Replication status for feeds
  replicationStatus: defineTable({
    feedId: v.string(),
    feedType: v.union(v.literal('memory'), v.literal('crdt'), v.literal('audit')),
    localSeq: v.number(),
    remoteSeq: v.optional(v.number()),
    syncPercentage: v.number(),
    peerCount: v.number(),
    lastSyncAt: v.optional(v.string()),
    conflictCount: v.number(),
    isFullySynced: v.boolean(),
    updatedAt: v.string(),
  }).index('by_feed_id', ['feedId'])
    .index('by_type', ['feedType'])
    .index('by_synced', ['isFullySynced']),

  // =====================
  // Hypervisor (Reel 2) Tables (3)
  // =====================

  // Virtual machines
  virtualMachines: defineTable({
    vmId: v.string(),
    name: v.string(),
    provider: v.union(v.literal('hypercore-hal'), v.literal('qemu'), v.literal('cloud-hypervisor')),
    status: v.union(
      v.literal('creating'),
      v.literal('running'),
      v.literal('paused'),
      v.literal('stopped'),
      v.literal('failed'),
      v.literal('destroyed')
    ),
    vmSpec: v.string(), // JSON serialized hac.toml content
    parentHarnessId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    vsockPort: v.optional(v.number()),
    cpuCount: v.number(),
    memoryMB: v.number(),
    diskMB: v.number(),
    createdAt: v.string(),
    startedAt: v.optional(v.string()),
    stoppedAt: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  }).index('by_vm_id', ['vmId'])
    .index('by_name', ['name'])
    .index('by_status', ['status'])
    .index('by_provider', ['provider'])
    .index('by_harness', ['parentHarnessId']),

  // Sandbox policies
  sandboxPolicies: defineTable({
    policyId: v.string(),
    name: v.string(),
    policyType: v.union(v.literal('ultra'), v.literal('standard'), v.literal('permissive')),
    rules: v.array(v.object({
      action: v.union(v.literal('allow'), v.literal('deny')),
      resource: v.string(),
      condition: v.optional(v.string()),
    })),
    maxSyscallsPerSecond: v.number(),
    maxNetworkConnections: v.number(),
    allowedSystemCalls: v.array(v.string()),
    blockedSystemCalls: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_policy_id', ['policyId'])
    .index('by_name', ['name'])
    .index('by_type', ['policyType']),

  // Agent deployments in VMs
  agentDeployments: defineTable({
    deploymentId: v.string(),
    vmId: v.string(),
    agentId: v.string(),
    agentType: v.union(v.literal('moltbot'), v.literal('custom')),
    manifestHash: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('deploying'),
      v.literal('running'),
      v.literal('failed'),
      v.literal('terminated')
    ),
    environment: v.record(v.string(), v.string()),
    startedAt: v.string(),
    terminatedAt: v.optional(v.string()),
    healthCheckUrl: v.optional(v.string()),
    lastHealthCheck: v.optional(v.string()),
    isHealthy: v.optional(v.boolean()),
  }).index('by_deployment_id', ['deploymentId'])
    .index('by_vm', ['vmId'])
    .index('by_agent', ['agentId'])
    .index('by_status', ['status']),
});
