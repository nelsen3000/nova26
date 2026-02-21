# Requirements Document

## Introduction

SAGA (Self-Evolving Goal Agents) is a bi-level optimization framework for Nova26's Planetary Agents, inspired by DAIR.AI/UC Santa Barbara research. The outer loop evolves agent objectives and goals based on performance feedback, while the inner loop optimizes solutions for current objectives. SAGA requires no human training data — agents generate their own curricula through self-play and reflection. The framework integrates with the existing Ralph Loop orchestrator, ATLAS memory system, Taste Vault, Autonomy Slider, and Agent Harness infrastructure to enable scientific and creative discovery workflows, overnight evolution, and cross-project portfolio learning.

## Glossary

- **SAGA_Engine**: The core bi-level optimization engine that coordinates outer-loop goal evolution and inner-loop solution optimization for Planetary Agents.
- **Goal_Genome**: A serializable data structure representing an agent's current set of objectives, fitness criteria, and evolution history.
- **Outer_Loop**: The goal evolution cycle that mutates, evaluates, and selects Goal_Genomes based on performance feedback from the Inner_Loop.
- **Inner_Loop**: The solution optimization cycle where an agent works toward the objectives defined in its current Goal_Genome.
- **Curriculum**: A self-generated sequence of progressively challenging tasks that an agent creates to train itself toward its current goals.
- **Fitness_Evaluator**: The component that scores a Goal_Genome's effectiveness based on Inner_Loop performance metrics, novelty, and Taste Vault alignment.
- **Goal_Mutation**: An operation that produces a new candidate Goal_Genome by modifying an existing one through addition, removal, recombination, or perturbation of objectives.
- **Taste_Guard**: The safety mechanism that constrains goal evolution to remain aligned with user preferences stored in the Taste Vault.
- **Evolution_Session**: A bounded execution of one or more Outer_Loop iterations, tracked as a unit of work with start time, budget, and termination criteria.
- **ATLAS_Goal_Store**: The persistence layer within the ATLAS memory system that stores evolved Goal_Genomes, fitness histories, and lineage graphs.
- **Swarm_Debate**: A multi-agent discussion where agents with different Goal_Genomes critique and refine candidate goals before selection.
- **Portfolio_Context**: Cross-project learning data that informs goal evolution by surfacing patterns and insights from previous projects.
- **Evolution_Budget**: A configurable resource limit (compute time, iterations, memory) that bounds an Evolution_Session to prevent runaway resource consumption.

## Requirements

### Requirement 1: Goal Genome Representation and Serialization

**User Story:** As a developer, I want a structured, serializable representation of agent goals, so that goals can be persisted, evolved, compared, and restored across sessions.

#### Acceptance Criteria

1. THE SAGA_Engine SHALL represent each agent's objectives as a Goal_Genome containing a unique identifier, a list of objective descriptors, fitness criteria, a generation counter, and a parent lineage reference.
2. THE SAGA_Engine SHALL serialize a Goal_Genome to JSON format for storage in the ATLAS_Goal_Store.
3. THE SAGA_Engine SHALL deserialize a JSON-formatted Goal_Genome back into a valid Goal_Genome object.
4. FOR ALL valid Goal_Genome objects, serializing then deserializing SHALL produce an equivalent Goal_Genome object (round-trip property).
5. WHEN serializing a Goal_Genome, THE SAGA_Engine SHALL include a schema version field to support future migrations.
6. IF a Goal_Genome with an unknown schema version is encountered during deserialization, THEN THE SAGA_Engine SHALL return a descriptive error indicating the version mismatch.

### Requirement 2: Inner Loop — Solution Optimization

**User Story:** As a Planetary Agent, I want to optimize my solutions against my current goals, so that I produce progressively better outputs for my assigned objectives.

#### Acceptance Criteria

1. WHEN an Inner_Loop cycle begins, THE SAGA_Engine SHALL load the agent's current Goal_Genome and use its objectives as the optimization target.
2. WHEN the Inner_Loop completes a solution attempt, THE SAGA_Engine SHALL record the performance metrics (score, duration, resource usage) against each objective in the Goal_Genome.
3. WHEN the Inner_Loop completes all iterations for a Goal_Genome, THE SAGA_Engine SHALL produce a fitness summary containing per-objective scores and an aggregate fitness value.
4. IF the Inner_Loop exceeds its configured iteration budget, THEN THE SAGA_Engine SHALL terminate the cycle and produce a partial fitness summary with the results collected so far.
5. THE SAGA_Engine SHALL pass the fitness summary to the Outer_Loop for goal evaluation.

### Requirement 3: Outer Loop — Goal Evolution

**User Story:** As a developer, I want agents to autonomously evolve their goals based on performance feedback, so that agents discover increasingly effective objectives without human-curated training data.

#### Acceptance Criteria

1. WHEN an Outer_Loop iteration begins, THE SAGA_Engine SHALL generate candidate Goal_Genomes by applying Goal_Mutations to the current population of Goal_Genomes.
2. WHEN candidate Goal_Genomes are generated, THE Fitness_Evaluator SHALL score each candidate based on Inner_Loop performance, novelty relative to the existing population, and Taste Vault alignment.
3. WHEN fitness scores are computed, THE SAGA_Engine SHALL select the top-performing Goal_Genomes to form the next generation, using tournament selection with a configurable population size.
4. WHEN a new generation is selected, THE SAGA_Engine SHALL store the selected Goal_Genomes and their fitness histories in the ATLAS_Goal_Store.
5. IF all candidate Goal_Genomes score below a configurable minimum fitness threshold, THEN THE SAGA_Engine SHALL retain the current generation and increase mutation diversity for the next iteration.
6. THE SAGA_Engine SHALL track the lineage of each Goal_Genome so that the evolutionary path from any genome back to its origin is recoverable.

### Requirement 4: Goal Mutation Operations

**User Story:** As a developer, I want a set of mutation operations that produce diverse candidate goals, so that the evolutionary search explores a wide space of possible objectives.

#### Acceptance Criteria

1. THE SAGA_Engine SHALL support an "add objective" mutation that appends a new objective descriptor to a Goal_Genome.
2. THE SAGA_Engine SHALL support a "remove objective" mutation that removes an existing objective descriptor from a Goal_Genome containing more than one objective.
3. THE SAGA_Engine SHALL support a "perturb objective" mutation that modifies the parameters of an existing objective descriptor.
4. THE SAGA_Engine SHALL support a "recombine" mutation that merges objectives from two parent Goal_Genomes into a single child Goal_Genome.
5. WHEN a Goal_Mutation is applied, THE SAGA_Engine SHALL increment the generation counter and record the parent genome identifier in the child's lineage.
6. WHEN a Goal_Mutation is applied, THE SAGA_Engine SHALL validate that the resulting Goal_Genome contains at least one objective and no duplicate objective identifiers.

### Requirement 5: Taste Vault Guard Rails

**User Story:** As a user, I want goal evolution to stay aligned with my preferences, so that agents do not drift toward objectives that conflict with my creative vision or quality standards.

#### Acceptance Criteria

1. WHEN a candidate Goal_Genome is evaluated, THE Taste_Guard SHALL check each objective against the active Taste Vault patterns for compatibility.
2. IF a candidate Goal_Genome contains an objective that conflicts with a Taste Vault pattern with a success score above 0.5, THEN THE Taste_Guard SHALL reject that candidate and log the conflict reason.
3. WHEN the Taste_Guard rejects a candidate, THE SAGA_Engine SHALL exclude that candidate from the selection pool and generate a replacement mutation.
4. THE Taste_Guard SHALL allow objectives that are neutral (neither aligned nor conflicting) with Taste Vault patterns to pass through without penalty.
5. WHEN Taste Vault patterns are updated by the user, THE Taste_Guard SHALL apply the updated patterns to the next Outer_Loop iteration without requiring a restart of the Evolution_Session.

### Requirement 6: Self-Generated Curriculum

**User Story:** As a Planetary Agent, I want to generate my own training curriculum based on my current goals, so that I can improve without requiring human-curated training data.

#### Acceptance Criteria

1. WHEN an Inner_Loop cycle begins, THE SAGA_Engine SHALL generate a Curriculum of progressively challenging tasks derived from the current Goal_Genome objectives.
2. THE Curriculum SHALL contain an ordered sequence of tasks where each task builds on skills validated by preceding tasks.
3. WHEN a Curriculum task is completed, THE SAGA_Engine SHALL evaluate the result against the relevant objective criteria and record a pass or fail outcome.
4. IF a Curriculum task fails, THEN THE SAGA_Engine SHALL generate a remedial task targeting the specific skill gap before advancing to the next task.
5. WHEN all Curriculum tasks are completed, THE SAGA_Engine SHALL produce the fitness summary for the Inner_Loop cycle.

### Requirement 7: Evolution Session Management

**User Story:** As a developer, I want to start, monitor, pause, and stop evolution sessions with configurable budgets, so that goal evolution runs within resource constraints.

#### Acceptance Criteria

1. WHEN an Evolution_Session is started, THE SAGA_Engine SHALL create a session record with a unique identifier, the target agent name, the Evolution_Budget, and a "running" status.
2. THE Evolution_Budget SHALL specify maximum compute time, maximum Outer_Loop iterations, and maximum memory allocation.
3. WHILE an Evolution_Session is running, THE SAGA_Engine SHALL check the Evolution_Budget before each Outer_Loop iteration and terminate the session if any budget limit is exceeded.
4. WHEN an Evolution_Session is paused, THE SAGA_Engine SHALL persist the current Outer_Loop state (population, generation counter, fitness histories) to the ATLAS_Goal_Store.
5. WHEN a paused Evolution_Session is resumed, THE SAGA_Engine SHALL restore the persisted state and continue from the last completed generation.
6. WHEN an Evolution_Session completes or is stopped, THE SAGA_Engine SHALL record the final population, best Goal_Genome, and session metrics in the ATLAS_Goal_Store.
7. IF an Evolution_Session exceeds the configured memory budget, THEN THE SAGA_Engine SHALL terminate the session, persist the current state, and emit a "budget_exceeded" event.

### Requirement 8: ATLAS Memory Integration

**User Story:** As a developer, I want evolved goals and evolution history to be stored in the ATLAS memory system, so that agents can recall and build upon past evolution across sessions and projects.

#### Acceptance Criteria

1. WHEN a new generation of Goal_Genomes is selected, THE ATLAS_Goal_Store SHALL persist each Goal_Genome with its fitness score, generation number, and parent lineage.
2. WHEN an agent starts a new Evolution_Session, THE SAGA_Engine SHALL query the ATLAS_Goal_Store for the agent's most recent Goal_Genome population to use as the starting generation.
3. THE ATLAS_Goal_Store SHALL support querying Goal_Genomes by agent name, generation number, and minimum fitness score.
4. WHEN a Goal_Genome achieves a fitness score above a configurable "notable" threshold, THE SAGA_Engine SHALL log a learning entry in the ATLAS learnings table with the genome details and the insight that led to the high score.
5. THE ATLAS_Goal_Store SHALL retain Goal_Genome history for a configurable retention period (default 30 days) and prune older records automatically.

### Requirement 9: Swarm Debate Integration

**User Story:** As a developer, I want agents in a debate swarm to critique and refine candidate goals, so that goal evolution benefits from multi-perspective evaluation.

#### Acceptance Criteria

1. WHEN the Outer_Loop generates candidate Goal_Genomes and the Autonomy_Slider is set to level 3 or above, THE SAGA_Engine SHALL submit the top candidates to a Swarm_Debate for evaluation.
2. WHEN a Swarm_Debate evaluates candidates, THE participating agents SHALL each score the candidates and provide written critiques.
3. WHEN the Swarm_Debate completes, THE SAGA_Engine SHALL incorporate the debate scores into the Fitness_Evaluator's final ranking alongside Inner_Loop performance and Taste Vault alignment.
4. IF the Swarm_Debate produces a consensus rejection of a candidate, THEN THE SAGA_Engine SHALL exclude that candidate from the selection pool.
5. WHEN the Autonomy_Slider is set below level 3, THE SAGA_Engine SHALL skip the Swarm_Debate step and rely on the Fitness_Evaluator alone.

### Requirement 10: Overnight Evolution and Autonomy Slider Integration

**User Story:** As a user, I want agents to evolve their goals while I sleep, respecting my autonomy preferences, so that I wake up to improved agent capabilities without manual intervention.

#### Acceptance Criteria

1. WHEN overnight evolution mode is activated, THE SAGA_Engine SHALL start an Evolution_Session with a time budget matching the configured overnight window duration.
2. WHILE overnight evolution is active, THE SAGA_Engine SHALL auto-checkpoint at configurable intervals (default 10 minutes) by persisting the current Outer_Loop state to the ATLAS_Goal_Store.
3. WHEN the Autonomy_Slider is set to level 4 or 5, THE SAGA_Engine SHALL allow the Outer_Loop to run without human approval gates.
4. WHEN the Autonomy_Slider is set to level 1 or 2, THE SAGA_Engine SHALL pause the Evolution_Session after each generation and wait for human approval before continuing.
5. WHEN the Autonomy_Slider is set to level 3, THE SAGA_Engine SHALL pause only when a Goal_Mutation produces a candidate that deviates significantly (configurable threshold) from the current best genome.
6. WHEN overnight evolution completes, THE SAGA_Engine SHALL produce a summary report containing the starting and ending best fitness scores, the number of generations evolved, and notable Goal_Genome discoveries.

### Requirement 11: Portfolio Learning Integration

**User Story:** As a developer, I want goal evolution to leverage insights from previous projects, so that agents start from a stronger baseline and avoid repeating past mistakes.

#### Acceptance Criteria

1. WHEN an Evolution_Session starts, THE SAGA_Engine SHALL query the ATLAS_Goal_Store for high-fitness Goal_Genomes from previous projects to seed the initial population alongside the agent's current genomes.
2. WHEN seeding from Portfolio_Context, THE SAGA_Engine SHALL adapt imported Goal_Genomes to the current project context by re-evaluating their fitness against current objectives.
3. THE SAGA_Engine SHALL limit portfolio seeding to a configurable maximum percentage (default 20%) of the initial population to prevent over-reliance on past solutions.
4. WHEN a Goal_Genome originating from portfolio seeding achieves top fitness in the current project, THE SAGA_Engine SHALL log a cross-project learning entry in the ATLAS learnings table.

### Requirement 12: Resource Constraints and Performance

**User Story:** As a developer, I want SAGA to operate within Nova26's resource targets, so that goal evolution does not degrade the application's performance or exceed memory limits.

#### Acceptance Criteria

1. THE SAGA_Engine SHALL limit its in-memory working set to a configurable maximum (default 8MB) to stay within Nova26's target memory budget.
2. THE SAGA_Engine SHALL process Outer_Loop iterations asynchronously so that the main application thread is not blocked during evolution.
3. WHEN the SAGA_Engine detects that memory usage exceeds 90% of the configured limit, THE SAGA_Engine SHALL reduce the active population size and log a "memory_pressure" warning.
4. THE SAGA_Engine SHALL support a configurable maximum population size (default 20 genomes) to bound compute and memory usage.
5. WHEN an Evolution_Session is idle (no active iteration), THE SAGA_Engine SHALL release all non-essential memory allocations.
