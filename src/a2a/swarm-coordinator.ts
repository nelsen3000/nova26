// A2A Swarm Coordinator — Decentralized swarm coordination via A2A messaging
// Implements Requirements 8.1-8.6

import { randomUUID } from 'crypto';
import type { A2ARouter } from './router.js';
import type { AgentRegistry } from './registry.js';
import { EnvelopeFactory } from './envelope.js';

export type SwarmStatus = 'recruiting' | 'active' | 'completing' | 'completed' | 'failed';
export type SubTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SwarmSubTask {
  id: string;
  description: string;
  assignedAgent: string;
  requiredCapabilities: string[];
  status: SubTaskStatus;
  result?: unknown;
  error?: string;
}

export interface SwarmSession {
  id: string;
  taskDescription: string;
  requiredCapabilities: string[];
  participants: string[];
  subTasks: SwarmSubTask[];
  status: SwarmStatus;
  sharedState: Record<string, unknown>;
  createdAt: number;
  completedAt?: number;
}

/**
 * SwarmCoordinator — manages decentralized swarm task execution via A2A messaging.
 * Broadcasts proposals to capable agents, assigns sub-tasks, tracks completion.
 */
export class SwarmCoordinator {
  private swarms = new Map<string, SwarmSession>();
  private router: A2ARouter;
  private registry: AgentRegistry;
  private coordinatorAgentId: string;
  private factory: EnvelopeFactory;

  constructor(coordinatorAgentId: string, router: A2ARouter, registry: AgentRegistry) {
    this.coordinatorAgentId = coordinatorAgentId;
    this.router = router;
    this.registry = registry;
    this.factory = new EnvelopeFactory(coordinatorAgentId);
  }

  /**
   * Create a swarm — broadcasts task-proposal to capable agents, collects participants.
   */
  async createSwarm(
    taskDescription: string,
    requiredCapabilities: string[],
    subTaskDescriptions: string[] = [],
  ): Promise<SwarmSession> {
    const swarmId = randomUUID();

    // Find capable agents from registry
    const capableAgents: string[] = [];
    for (const cap of requiredCapabilities) {
      const agents = this.registry.findByCapability(cap);
      for (const agent of agents) {
        if (!capableAgents.includes(agent.id) && agent.id !== this.coordinatorAgentId) {
          capableAgents.push(agent.id);
        }
      }
    }

    const session: SwarmSession = {
      id: swarmId,
      taskDescription,
      requiredCapabilities,
      participants: [],
      subTasks: subTaskDescriptions.map((desc, i) => ({
        id: `${swarmId}-sub-${i}`,
        description: desc,
        assignedAgent: '',
        requiredCapabilities,
        status: 'pending',
      })),
      status: 'recruiting',
      sharedState: {},
      createdAt: Date.now(),
    };
    this.swarms.set(swarmId, session);

    // Broadcast task-proposal to capable agents
    for (const agentId of capableAgents) {
      const envelope = this.factory.createEnvelope('task-proposal', agentId, {
        swarmId,
        taskDescription,
        requiredCapabilities,
        subTaskCount: subTaskDescriptions.length,
      });
      await this.router.send(envelope);
    }

    return session;
  }

  /**
   * Agent joins a swarm — adds to participants and assigns pending sub-tasks.
   */
  joinSwarm(swarmId: string, agentId: string): SwarmSubTask | undefined {
    const session = this.swarms.get(swarmId);
    if (!session) throw new Error(`Swarm "${swarmId}" not found`);
    if (session.status !== 'recruiting' && session.status !== 'active') {
      throw new Error(`Swarm "${swarmId}" is ${session.status}, cannot join`);
    }

    if (!session.participants.includes(agentId)) {
      session.participants.push(agentId);
    }

    // Assign first pending sub-task to this agent
    const pendingTask = session.subTasks.find(t => t.status === 'pending');
    if (pendingTask) {
      pendingTask.assignedAgent = agentId;
      pendingTask.status = 'running';
    }

    // Transition to active if we have participants
    if (session.status === 'recruiting' && session.participants.length > 0) {
      session.status = 'active';
    }

    return pendingTask;
  }

  /**
   * Complete a sub-task — updates shared state, checks if swarm is done.
   */
  completeSubTask(swarmId: string, subTaskId: string, result: unknown): void {
    const session = this.swarms.get(swarmId);
    if (!session) throw new Error(`Swarm "${swarmId}" not found`);

    const subTask = session.subTasks.find(t => t.id === subTaskId);
    if (!subTask) throw new Error(`Sub-task "${subTaskId}" not found in swarm "${swarmId}"`);

    subTask.status = 'completed';
    subTask.result = result;
    session.sharedState[subTaskId] = result;

    // Check if all sub-tasks are done
    const allDone = session.subTasks.every(t => t.status === 'completed' || t.status === 'failed');
    const anyFailed = session.subTasks.some(t => t.status === 'failed');

    if (allDone) {
      session.status = anyFailed ? 'failed' : 'completed';
      session.completedAt = Date.now();
    } else {
      session.status = 'completing';
    }
  }

  /**
   * Fail a sub-task — attempts reassignment to another capable participant, or escalates.
   */
  failSubTask(swarmId: string, subTaskId: string, error: string): { reassigned: boolean; newAgent?: string } {
    const session = this.swarms.get(swarmId);
    if (!session) throw new Error(`Swarm "${swarmId}" not found`);

    const subTask = session.subTasks.find(t => t.id === subTaskId);
    if (!subTask) throw new Error(`Sub-task "${subTaskId}" not found in swarm "${swarmId}"`);

    const failedAgent = subTask.assignedAgent;

    // Try to reassign to another participant
    const alternativeAgent = session.participants.find(p =>
      p !== failedAgent &&
      !session.subTasks.some(t => t.assignedAgent === p && t.status === 'running'),
    );

    if (alternativeAgent) {
      subTask.assignedAgent = alternativeAgent;
      subTask.status = 'running';
      subTask.error = undefined;
      return { reassigned: true, newAgent: alternativeAgent };
    }

    // No alternative — mark as failed
    subTask.status = 'failed';
    subTask.error = error;

    // Check if swarm should fail
    const allDone = session.subTasks.every(t => t.status === 'completed' || t.status === 'failed');
    if (allDone) {
      session.status = 'failed';
      session.completedAt = Date.now();
    }

    return { reassigned: false };
  }

  getSwarm(swarmId: string): SwarmSession | undefined {
    return this.swarms.get(swarmId);
  }

  listActiveSwarms(): SwarmSession[] {
    return [...this.swarms.values()].filter(s =>
      s.status === 'recruiting' || s.status === 'active' || s.status === 'completing',
    );
  }

  listAllSwarms(): SwarmSession[] {
    return [...this.swarms.values()];
  }
}
