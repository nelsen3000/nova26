# Requirements Document

## Introduction

This document specifies the requirements for integrating the Vistara-Labs Hypercore hypervisor abstraction layer (HAL) into Nova26 as Reel 2. This is distinct from the P2P Hypercore Protocol (Reel 1, Holepunch/Dat). Vistara-Labs/hypercore (MIT-licensed) provides a consistent API for spawning and managing microVMs across multiple hypervisor backends (Firecracker, Cloud Hypervisor, Unikernels). The integration targets four primary areas: Ultra-Sandbox agent isolation for zero-escape security, Moltbot deployment emulation of the 21 Planetary Agents, Hardware-as-Code declarative VM provisioning via hac.toml, and scalable edge/cloud deployments. The system uses containerd for orchestration, a Hypercore Shim for VM lifecycle management (provision, I/O proxy via VSOCK, cleanup), and a VM Agent inside each guest for task spawning and runc integration.

## Glossary

- **Hypercore_HAL**: The Vistara-Labs Hypercore Hypervisor Abstraction Layer — a Rust-based binary that abstracts hypervisor differences behind a consistent CLI and API
- **MicroVM**: A lightweight virtual machine (e.g., Firecracker, Cloud Hypervisor) optimized for fast boot times and minimal resource overhead
- **Firecracker**: An open-source microVM monitor from AWS that provides lightweight virtualization with a minimal device model
- **Cloud_Hypervisor**: An open-source VMM focused on running modern cloud workloads with a minimal footprint
- **Unikernel**: A specialized single-address-space machine image compiled from a library operating system, running a single application
- **Hypervisor_Provider**: A specific hypervisor backend (Firecracker, Cloud Hypervisor, or Unikernel runtime) that Hypercore_HAL abstracts over
- **HAC_Config**: A Hardware-as-Code configuration file (hac.toml) that declaratively specifies VM resources (vCPUs, memory, kernel, root filesystem, network)
- **Hypercore_Shim**: The containerd shim component that manages microVM lifecycle — provisioning, I/O proxy via VSOCK, and cleanup
- **VM_Agent**: A lightweight agent running inside the guest microVM that receives tasks, spawns processes via runc, and reports results back through VSOCK
- **VSOCK**: A host-guest communication channel (virtio-vsock) used for I/O proxying between the host and microVM without network stack overhead
- **Ultra_Sandbox**: Nova26's security isolation layer (R23-02) combining Firecracker microVMs with OPA policies for zero-escape agent execution
- **NanoClaw**: The <11MB Rust isolation core (R24-02) within the Eternal Engine that sandboxes modules for safe execution
- **Moltbot**: Nova26's deployment and plugin management bot that orchestrates agent configurations and infrastructure
- **Planetary_Agent**: One of the 21 specialized AI agents in Nova26 (SUN, MERCURY, VENUS, etc.) coordinated via the Ralph Loop
- **Ralph_Loop**: The core orchestration engine of Nova26 that picks tasks, loads agents, calls LLMs, and validates outputs
- **Eternal_Engine**: The planned <8MB Rust binary core of Nova26 for persistent, fault-tolerant agent state
- **OPA**: Open Policy Agent — a policy engine used to enforce least-privilege access rules on microVM operations
- **HypervisorManager**: The central TypeScript service that interfaces with Hypercore_HAL to provision, manage, and tear down microVMs
- **VMSpec**: A validated specification object describing the desired microVM configuration (provider, resources, kernel, drives)
- **Containerd**: A container runtime that Hypercore_HAL uses for orchestrating microVM lifecycle via shims

## Requirements

### Requirement 1: Hypervisor Manager Initialization and Provider Discovery

**User Story:** As a Nova26 system operator, I want the Hypervisor Manager to initialize and discover available hypervisor providers, so that the system knows which backends are available for spawning microVMs.

#### Acceptance Criteria

1. WHEN Nova26 starts the HypervisorManager, THE HypervisorManager SHALL detect which Hypervisor_Providers are installed and available on the host system
2. WHEN provider discovery completes, THE HypervisorManager SHALL emit a ready event containing the list of available Hypervisor_Providers and their version information
3. IF no Hypervisor_Providers are detected, THEN THE HypervisorManager SHALL return a descriptive error indicating which providers were checked and why each was unavailable
4. THE HypervisorManager SHALL validate that the Hypercore_HAL binary is present at a configurable path and report its version
5. WHEN the HypervisorManager initializes, THE HypervisorManager SHALL verify that containerd is running and accessible before accepting VM spawn requests

### Requirement 2: MicroVM Lifecycle Management

**User Story:** As a Nova26 agent orchestrator, I want to spawn, monitor, and terminate microVMs through a consistent API, so that I can run agent tasks in isolated environments regardless of the underlying hypervisor.

#### Acceptance Criteria

1. WHEN a valid VMSpec is submitted, THE HypervisorManager SHALL spawn a microVM using the specified Hypervisor_Provider and return a unique VM identifier
2. WHEN a microVM is spawned, THE HypervisorManager SHALL establish a VSOCK channel to the VM_Agent inside the guest and confirm connectivity
3. WHEN a termination request is issued for a running microVM, THE HypervisorManager SHALL gracefully shut down the VM, release all allocated resources, and confirm termination
4. WHEN a microVM status is queried, THE HypervisorManager SHALL return the current state (provisioning, running, stopping, terminated, error) and resource usage metrics
5. IF a microVM fails to boot within a configurable timeout, THEN THE HypervisorManager SHALL terminate the failed VM, release resources, and return an error with diagnostic details
6. WHEN multiple microVMs are running concurrently, THE HypervisorManager SHALL track each VM independently and report accurate status for each VM identifier
7. THE HypervisorManager SHALL enforce a configurable maximum concurrent VM limit and reject spawn requests that exceed the limit

### Requirement 3: Hardware-as-Code Configuration

**User Story:** As a Nova26 developer, I want to define microVM specifications declaratively in hac.toml files, so that VM provisioning is reproducible, version-controlled, and consistent across environments.

#### Acceptance Criteria

1. WHEN a hac.toml file is provided, THE HypervisorManager SHALL parse the file into a validated VMSpec object
2. WHEN a hac.toml file contains invalid fields or values, THE HypervisorManager SHALL return a descriptive parse error identifying the invalid field and expected format
3. THE HypervisorManager SHALL format VMSpec objects back into valid hac.toml files (pretty printer)
4. FOR ALL valid VMSpec objects, parsing a hac.toml then formatting then parsing again SHALL produce an equivalent VMSpec object (round-trip property)
5. WHEN a hac.toml specifies resource constraints (vCPUs, memory), THE HypervisorManager SHALL validate that the requested resources do not exceed host capacity before spawning
6. THE HypervisorManager SHALL support a default hac.toml template for each Hypervisor_Provider with sensible defaults (2 vCPUs, 512MB RAM)

### Requirement 4: Ultra-Sandbox Agent Isolation

**User Story:** As a security engineer, I want each agent task to execute inside an isolated microVM with enforced OPA policies, so that a compromised agent cannot escape its sandbox or access unauthorized resources.

#### Acceptance Criteria

1. WHEN an agent task is submitted for sandboxed execution, THE HypervisorManager SHALL spawn a dedicated microVM for that task with no shared filesystem or network access to other VMs
2. WHEN a microVM is spawned for sandboxed execution, THE HypervisorManager SHALL apply the OPA policy associated with the requesting agent before allowing task execution
3. WHEN an OPA policy evaluation denies an operation inside a microVM, THE VM_Agent SHALL block the operation and report the denial reason to the HypervisorManager
4. WHEN a sandboxed task completes, THE HypervisorManager SHALL destroy the microVM and verify that no guest state persists on the host filesystem
5. THE HypervisorManager SHALL integrate with NanoClaw isolation so that the Rust Eternal Engine can request microVM-level isolation for specific modules
6. IF a microVM attempts to access a resource outside its OPA-defined scope, THEN THE HypervisorManager SHALL terminate the VM and emit a security violation event

### Requirement 5: Moltbot Planetary Agent Deployment

**User Story:** As a Nova26 operator, I want Moltbot to deploy any of the 21 Planetary Agents into dedicated microVMs, so that agents can run in chat/voice modes with full isolation and configurable resource allocation.

#### Acceptance Criteria

1. WHEN Moltbot receives a deployment request for a Planetary_Agent, THE HypervisorManager SHALL spawn a microVM using the agent-specific hac.toml configuration
2. WHEN a Planetary_Agent is deployed in a microVM, THE VM_Agent SHALL load the agent prompt template and connect to the Ralph_Loop orchestrator via VSOCK
3. WHEN multiple Planetary_Agents are deployed simultaneously, THE HypervisorManager SHALL allocate resources according to each agent's hac.toml without exceeding host capacity
4. WHEN a deployed agent is no longer needed, THE HypervisorManager SHALL terminate the agent's microVM and reclaim resources within a configurable grace period
5. THE HypervisorManager SHALL maintain a registry of deployed Planetary_Agents mapping agent names to VM identifiers and current status
6. WHEN querying the agent registry, THE HypervisorManager SHALL return the complete list of deployed agents with their VM identifiers, status, and resource allocation

### Requirement 6: VSOCK Communication Channel

**User Story:** As a Nova26 system architect, I want reliable host-guest communication via VSOCK, so that the HypervisorManager can send tasks to and receive results from VM_Agents without network stack overhead.

#### Acceptance Criteria

1. WHEN a microVM is spawned, THE Hypercore_Shim SHALL establish a VSOCK channel between the host HypervisorManager and the guest VM_Agent
2. WHEN a task payload is sent over VSOCK to a VM_Agent, THE VM_Agent SHALL acknowledge receipt and return a task identifier
3. WHEN a VM_Agent completes a task, THE VM_Agent SHALL send the result payload back over VSOCK to the HypervisorManager
4. IF the VSOCK channel is interrupted, THEN THE HypervisorManager SHALL detect the disconnection within a configurable heartbeat interval and mark the VM as unhealthy
5. WHEN serializing task payloads for VSOCK transmission, THE HypervisorManager SHALL encode payloads using a binary format and THE VM_Agent SHALL decode them back to equivalent objects (round-trip property)
6. THE HypervisorManager SHALL support multiplexing multiple task streams over a single VSOCK connection per microVM

### Requirement 7: Edge and Cloud Deployment Provisioning

**User Story:** As a Nova26 operator deploying to edge or cloud environments, I want one-click provisioning of microVM infrastructure, so that I can deploy agents to distributed nodes with minimal configuration following the "least space, cheapest, most efficient" principle.

#### Acceptance Criteria

1. WHEN a deployment target (edge node or cloud instance) is specified, THE HypervisorManager SHALL validate connectivity and Hypercore_HAL availability on the target
2. WHEN provisioning a remote deployment, THE HypervisorManager SHALL transfer the hac.toml configuration and required VM images to the target node
3. WHEN a remote microVM is spawned, THE HypervisorManager SHALL establish a management channel to monitor and control the remote VM
4. THE HypervisorManager SHALL report resource utilization (CPU, memory, disk) for each deployment target to support capacity planning
5. IF a remote deployment target becomes unreachable, THEN THE HypervisorManager SHALL mark the target as offline and queue pending operations for retry when connectivity is restored

### Requirement 8: Security Auditing and Supply Chain Verification

**User Story:** As a security engineer, I want all microVM operations audited and VM images verified, so that I can detect unauthorized activity and prevent supply chain attacks on the agent execution environment.

#### Acceptance Criteria

1. WHEN any microVM lifecycle event occurs (spawn, terminate, policy violation, resource change), THE HypervisorManager SHALL emit a structured audit log event with timestamp, VM identifier, event type, and actor
2. WHEN a VM image or kernel is loaded for microVM boot, THE HypervisorManager SHALL verify the image checksum against a trusted manifest before proceeding
3. IF an image checksum verification fails, THEN THE HypervisorManager SHALL reject the boot request and emit a supply chain violation event
4. WHEN Moltbot plugins are loaded for agent deployment, THE HypervisorManager SHALL verify plugin signatures against a trusted keyring before execution
5. THE HypervisorManager SHALL expose aggregate security metrics (total spawns, policy denials, checksum failures, plugin verification failures) via a metrics query

### Requirement 9: Observability and Health Monitoring

**User Story:** As a Nova26 system operator, I want comprehensive observability into microVM operations, so that I can monitor system health, debug issues, and ensure reliable agent execution.

#### Acceptance Criteria

1. WHEN any HypervisorManager operation occurs, THE HypervisorManager SHALL emit a structured log event with operation type, VM identifier, timestamp, and duration
2. WHEN a microVM is running, THE HypervisorManager SHALL collect and expose resource metrics (CPU usage, memory usage, VSOCK throughput) at configurable intervals
3. THE HypervisorManager SHALL expose aggregate metrics (total VMs spawned, active VMs, total resource allocation, error count) via a metrics query
4. WHEN the error count for VM operations exceeds a configurable threshold within a time window, THE HypervisorManager SHALL emit a health-warning event
5. WHEN a microVM transitions between states, THE HypervisorManager SHALL emit a state-change event with the previous state, new state, and transition reason

### Requirement 10: Rust Eternal Engine Integration

**User Story:** As the Eternal Engine runtime, I want native Rust bindings to the Hypercore_HAL, so that the <8MB binary can spawn and manage microVMs directly without depending on the TypeScript layer.

#### Acceptance Criteria

1. THE RustHypervisorBridge SHALL expose spawn, terminate, status, and list operations for microVMs via a Rust FFI interface
2. WHEN the RustHypervisorBridge spawns a microVM, THE microVM SHALL be visible and manageable from both the Rust FFI interface and the TypeScript HypervisorManager
3. THE RustHypervisorBridge SHALL add no more than 2MB to the compiled Eternal Engine binary size
4. WHEN a NanoClaw isolation boundary wraps a hypervisor module, THE RustHypervisorBridge SHALL restrict that module to only its designated VM operations and OPA policies
5. IF a Rust FFI call encounters an error, THEN THE RustHypervisorBridge SHALL return a structured error code and message to the calling Rust context
