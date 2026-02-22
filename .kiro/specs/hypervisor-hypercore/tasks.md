# Implementation Plan: Hypervisor Hypercore Integration (Reel 2)

## Overview

Incremental implementation of the Vistara-Labs Hypercore HAL integration into Nova26. Starts with core types and config parsing, builds up through VM lifecycle management, then layers on sandbox isolation, Moltbot deployment, VSOCK communication, observability, and Rust FFI bindings. Each step builds on the previous and wires into existing Nova26 modules.

## Tasks

- [x] 1. Set up project structure and core types
  - [x] 1.1 Create `src/hypervisor/types.ts` with all Zod schemas and type exports (VMSpec, VMState, VMInstance, TaskPayload, TaskResult, HypervisorProvider, DriveSpec, ProviderInfo, SandboxPolicy, PolicyEvaluationResult, CleanupVerification, HypervisorAuditEvent, AggregateHypervisorMetrics, SecurityMetrics, HypervisorError, AgentDeployment, TrustedManifest, VerificationResult)
    - _Requirements: 2.4, 3.1, 6.5, 8.1, 8.5, 9.3_
  - [x] 1.2 Create `src/hypervisor/index.ts` barrel export file
    - _Requirements: all_

- [x] 2. Implement hac.toml config parser and pretty printer
  - [x] 2.1 Create `src/hypervisor/hac-config.ts` with HACConfigParser class
    - Implement `parse(toml: string): VMSpec` using lightweight custom TOML parser (no external deps)
    - Implement `format(spec: VMSpec): string` pretty printer
    - Implement `validate(spec: VMSpec, hostCapacity: HostCapacity): ValidationResult`
    - Implement `getDefaultTemplate(provider: HypervisorProvider): VMSpec` for each of the 3 providers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
    - **Implemented. parse/format/validate/getDefaultTemplate with 3 provider templates. 24 tests.**
  - [x]* 2.2 Write property test for hac.toml round-trip
    - **Property 1: hac.toml round-trip consistency**
    - **Validates: Requirements 3.1, 3.3, 3.4**
    - **Covered in hac-config.test.ts (50 property runs).**
  - [x]* 2.3 Write property test for invalid config error reporting
    - **Property 2: Invalid config produces descriptive errors**
    - **Validates: Requirements 3.2**
    - **Covered in hac-config.test.ts.**
  - [x]* 2.4 Write property test for resource validation
    - **Property 3: Resource validation against host capacity**
    - **Validates: Requirements 3.5, 5.3**
    - **Covered in hac-config.test.ts.**

- [ ] 3. Checkpoint - Config parser tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement HypervisorManager core lifecycle
  - [ ] 4.1 Create `src/hypervisor/manager.ts` with HypervisorManager class
    - Implement constructor with HypervisorManagerConfig
    - Implement `initialize()` — detect providers via CLI (`hypercore providers`), verify HAL binary, check containerd
    - Implement `close()` — terminate all VMs, cleanup
    - Implement `getProviders(): ProviderInfo[]`
    - Implement typed event emitter (ready, vm-spawned, vm-terminated, vm-state-change, health-warning, security-violation, error)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
    - **GAP: No manager.ts. SandboxManager in sandbox-manager.ts covers initialize/spawn/terminate/getStatus/listVMs/close and all required events, but is missing getProviders() and named differently.**
  - [x] 4.2 Implement VM spawn and terminate in HypervisorManager
    - Implement `spawn(spec: VMSpec): Promise<string>` — write temp hac.toml, invoke `hypercore spawn`, parse VM ID, track in internal map
    - Implement `terminate(vmId: string): Promise<void>` — invoke `hypercore terminate`, remove from map, emit event
    - Implement `getStatus(vmId: string): VMInstance`
    - Implement `listVMs(): VMInstance[]`
    - Enforce max concurrent VM limit
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7_
  - [ ]* 4.3 Write property test for VM spawn uniqueness and independent tracking
    - **Property 4: VM spawn uniqueness and independent tracking**
    - **Validates: Requirements 2.1, 2.6**
  - [ ]* 4.4 Write property test for VM termination
    - **Property 5: VM termination releases resources**
    - **Validates: Requirements 2.3**
  - [ ]* 4.5 Write property test for max concurrent VM limit
    - **Property 6: Max concurrent VM limit enforcement**
    - **Validates: Requirements 2.7**
  - [ ]* 4.6 Write property test for VM status
    - **Property 24: VM status returns valid state and metrics**
    - **Validates: Requirements 2.4**
  - [ ]* 4.7 Write unit tests for manager initialization edge cases
    - Test HAL binary not found (1.3), containerd unavailable (1.5), no providers detected (1.3), boot timeout (2.5)
    - _Requirements: 1.3, 1.5, 2.5_

- [ ] 5. Checkpoint - Manager lifecycle tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement VSOCK communication channel
  - [ ] 6.1 Create `src/hypervisor/vsock-channel.ts` with VSOCKChannel class
    - Implement `serialize(payload: TaskPayload): Buffer` and `deserialize(data: Buffer): TaskResult` using MessagePack encoding
    - Implement `send(payload: TaskPayload): Promise<string>` — serialize and send over VSOCK
    - Implement `receive(taskId: string, timeout: number): Promise<TaskResult>` — receive and deserialize
    - Implement `isConnected(): boolean` heartbeat check
    - Implement multiplexing via taskId-keyed pending map
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
    - **GAP: No vsock-channel.ts. SandboxManager.executeTask() simulates in-memory task execution but no real VSOCK/MessagePack.**
  - [ ]* 6.2 Write property test for VSOCK payload round-trip
    - **Property 13: VSOCK task payload round-trip**
    - **Validates: Requirements 6.5**
  - [ ]* 6.3 Write property test for VSOCK task execution protocol
    - **Property 14: VSOCK task execution protocol**
    - **Validates: Requirements 6.2, 6.3**
  - [ ]* 6.4 Write property test for VSOCK multiplexing
    - **Property 15: VSOCK multiplexing independence**
    - **Validates: Requirements 6.6**

- [ ] 7. Implement Ultra-Sandbox adapter
  - [ ] 7.1 Create `src/hypervisor/ultra-sandbox.ts` with UltraSandboxAdapter class
    - Implement `spawnSandboxed(agentId: string, task: TaskPayload): Promise<string>` — load OPA policy, evaluate, spawn VM with isolation constraints
    - Implement `evaluatePolicy(agentId: string, operation: string): Promise<PolicyEvaluationResult>` — evaluate OPA Rego policy
    - Implement `destroySandbox(vmId: string): Promise<CleanupVerification>` — terminate VM, verify no host residue
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
    - **GAP: No ultra-sandbox.ts. SandboxManager has evaluatePolicy() and verifyCleanup() but no dedicated UltraSandboxAdapter with spawnSandboxed().**
  - [ ]* 7.2 Write property test for sandbox isolation guarantees
    - **Property 7: Sandbox isolation guarantees**
    - **Validates: Requirements 4.1**
  - [ ]* 7.3 Write property test for OPA policy enforcement
    - **Property 8: OPA policy enforcement and denial reporting**
    - **Validates: Requirements 4.2, 4.3**
  - [ ]* 7.4 Write property test for security violation termination
    - **Property 9: Security violation terminates VM**
    - **Validates: Requirements 4.6**
  - [ ]* 7.5 Write property test for sandbox cleanup
    - **Property 10: Sandbox cleanup leaves no residual state**
    - **Validates: Requirements 4.4**

- [ ] 8. Checkpoint - Sandbox and VSOCK tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Moltbot deployer and agent registry
  - [ ] 9.1 Create `src/hypervisor/agent-registry.ts` with AgentRegistry class
    - Implement register, unregister, get, list operations
    - Implement save/load persistence to `.nova/hypervisor/registry.json`
    - _Requirements: 5.5, 5.6_
    - **GAP: Not implemented.**
  - [ ] 9.2 Create `src/hypervisor/moltbot-deployer.ts` with MoltbotDeployer class
    - Implement `deployAgent(agentName: string, overrides?: Partial<VMSpec>): Promise<AgentDeployment>` — load agent hac.toml, merge overrides, spawn VM, register in registry
    - Implement `undeployAgent(agentName: string): Promise<void>` — terminate VM, unregister
    - Implement `getDeployment(agentName: string)` and `listDeployments()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
    - **GAP: Not implemented.**
  - [ ]* 9.3 Write property test for agent deployment config
    - **Property 11: Agent deployment uses correct config**
    - **Validates: Requirements 5.1**
  - [ ]* 9.4 Write property test for agent registry accuracy
    - **Property 12: Agent registry accuracy**
    - **Validates: Requirements 5.5, 5.6**

- [ ] 10. Implement image verifier and security auditing
  - [ ] 10.1 Create `src/hypervisor/image-verifier.ts` with ImageVerifier class
    - Implement `verifyImage(imagePath: string): Promise<VerificationResult>` — SHA-256 checksum against manifest
    - Implement `verifyKernel(kernelPath: string): Promise<VerificationResult>`
    - Implement `verifyPlugin(pluginName: string, pluginData: Buffer): Promise<VerificationResult>`
    - Implement `loadManifest(): Promise<TrustedManifest>`
    - _Requirements: 8.2, 8.3, 8.4_
    - **GAP: Not implemented. TrustedManifest and VerificationResult types are defined in types.ts but no ImageVerifier class.**
  - [ ]* 10.2 Write property test for image/kernel checksum verification
    - **Property 17: Image and kernel checksum verification**
    - **Validates: Requirements 8.2**
  - [ ]* 10.3 Write property test for plugin signature verification
    - **Property 18: Plugin signature verification**
    - **Validates: Requirements 8.4**

- [ ] 11. Implement observability and health monitoring
  - [x] 11.1 Create `src/hypervisor/observer.ts` with HypervisorObserver class
    - Subscribe to HypervisorManager events and emit structured audit log events
    - Implement `getMetrics(): AggregateHypervisorMetrics`
    - Implement `getSecurityMetrics(): SecurityMetrics`
    - Implement `getRecentEvents(limit?: number): HypervisorAuditEvent[]`
    - Implement health warning threshold detection
    - _Requirements: 8.1, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_
    - **Implemented as `src/hypervisor/observability.ts` (HypervisorObserver). File name differs but all required methods present: attach(), detach(), getMetrics(), getSecurityMetrics(), getRecentEvents(), isHealthy(). Exports via index.ts.**
  - [ ]* 11.2 Write property test for audit log completeness
    - **Property 16: Audit log completeness**
    - **Validates: Requirements 8.1**
  - [ ]* 11.3 Write property test for metrics accuracy
    - **Property 19: Metrics accuracy**
    - **Validates: Requirements 8.5, 9.3**
  - [ ]* 11.4 Write property test for health warning threshold
    - **Property 20: Health warning threshold**
    - **Validates: Requirements 9.4**
  - [ ]* 11.5 Write property test for state change events
    - **Property 21: State change events**
    - **Validates: Requirements 9.5**

- [ ] 12. Checkpoint - Observability and security tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement edge/cloud deployment provisioning
  - [ ] 13.1 Add remote deployment methods to HypervisorManager
    - Implement `validateTarget(target: DeploymentTarget): Promise<TargetValidation>` — check connectivity and HAL availability
    - Implement `provisionRemote(target: DeploymentTarget, spec: VMSpec): Promise<string>` — transfer config and images, spawn remote VM
    - Implement `getTargetMetrics(target: DeploymentTarget): Promise<TargetResourceMetrics>`
    - Handle target unreachable with offline queuing and retry
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
    - **GAP: Not implemented.**
  - [ ]* 13.2 Write unit tests for remote deployment
    - Test target validation, file transfer, management channel, offline queuing
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [ ] 14. Implement Rust Hypervisor Bridge
  - [ ] 14.1 Create `src-tauri/src/hypervisor_bridge.rs` with Tauri commands
    - Implement `hypervisor_spawn`, `hypervisor_terminate`, `hypervisor_status`, `hypervisor_list` commands
    - Implement NanoClawHypervisorScope for isolation enforcement
    - Register commands in `src-tauri/src/main.rs`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
    - **GAP: No Rust/Tauri bridge implemented.**
  - [ ]* 14.2 Write property test for cross-runtime VM visibility
    - **Property 22: Cross-runtime VM visibility**
    - **Validates: Requirements 10.2**
  - [ ]* 14.3 Write property test for NanoClaw scope enforcement
    - **Property 23: NanoClaw scope enforcement**
    - **Validates: Requirements 10.4**

- [ ] 15. Wire everything together and integrate with existing Nova26 modules
  - [ ] 15.1 Wire HypervisorManager into the executeTask path with VSOCKChannel
    - Implement `executeTask(vmId: string, payload: TaskPayload): Promise<TaskResult>` in HypervisorManager using VSOCKChannel
    - _Requirements: 6.2, 6.3_
    - **GAP: executeTask() exists on SandboxManager (in-memory only); no real VSOCKChannel integration.**
  - [ ] 15.2 Wire UltraSandboxAdapter into existing `src/sandbox/` module
    - Add microVM execution path alongside existing Docker executor
    - _Requirements: 4.1, 4.5_
    - **GAP: No UltraSandboxAdapter; no sandbox/ module wiring.**
  - [ ] 15.3 Wire HypervisorObserver into existing `src/observability/` module
    - Connect audit events to the existing observability bridge
    - _Requirements: 9.1_
    - **GAP: HypervisorObserver exists but not wired to src/observability/ bridge.**
  - [ ] 15.4 Wire ImageVerifier into the spawn path
    - Verify image/kernel checksums before every VM boot
    - Verify plugin signatures before Moltbot agent deployment
    - _Requirements: 8.2, 8.4_
    - **GAP: No ImageVerifier; not wired.**
  - [x] 15.5 Update `src/hypervisor/index.ts` barrel exports with all public APIs
    - _Requirements: all_

- [ ] 16. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (min 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests (VSOCK, cross-runtime, remote deployment) require infrastructure and should be run in CI with appropriate backends
- The TOML parsing library (`@iarna/toml` or similar) needs to be added as a dependency
- The MessagePack library (`msgpackr` or similar) needs to be added for VSOCK serialization
