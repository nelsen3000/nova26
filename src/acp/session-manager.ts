/**
 * ACP (Agent Client Protocol) Session Manager
 * 
 * Manages active ACP sessions including creation, tracking, and cleanup.
 * Integrates with Nova26's TasteVault for session snapshots.
 */

import {
  type ACPSession,
  type ACPSessionState,
  type ACPTransport,
  type ACPTransportType,
} from './types.js';

/**
 * Session manager configuration
 */
export interface ACPSessionManagerOptions {
  /** Session idle timeout in milliseconds */
  idleTimeout?: number;
  /** Maximum number of concurrent sessions */
  maxSessions?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Function to compute TasteVault snapshot hash */
  tasteVaultHashFn?: () => string;
}

/**
 * Session creation parameters
 */
export interface ACPSessionCreateParams {
  /** Project root directory */
  projectRoot: string;
  /** Optional user ID */
  userId?: string;
  /** Transport configuration */
  transport: ACPTransport;
  /** Initial session state */
  initialState?: ACPSessionState;
}

/**
 * Session statistics
 */
export interface ACPSessionStats {
  /** Total number of sessions */
  total: number;
  /** Sessions by state */
  byState: Record<ACPSessionState, number>;
  /** Sessions by transport type */
  byTransport: Record<ACPTransportType, number>;
  /** Average session duration in milliseconds (for closed sessions) */
  averageDuration: number | null;
  /** Oldest active session timestamp */
  oldestActiveSession: number | null;
}

/**
 * ACP Session Manager implementation
 */
export class ACPSessionManager {
  private readonly options: Required<Pick<ACPSessionManagerOptions, 'idleTimeout' | 'maxSessions' | 'debug'>> & 
    Pick<ACPSessionManagerOptions, 'tasteVaultHashFn'>;
  private readonly sessions: Map<string, ACPSession> = new Map();
  private readonly sessionHistory: Array<{ session: ACPSession; closedAt: number }> = [];
  private sessionIdCounter = 0;

  /**
   * Create a new Session Manager
   * @param options - Configuration options
   */
  constructor(options: ACPSessionManagerOptions = {}) {
    this.options = {
      idleTimeout: 3600000, // 1 hour default
      maxSessions: 100,
      debug: false,
      tasteVaultHashFn: options.tasteVaultHashFn,
    };
  }

  /**
   * Create a new session
   * @param params - Session creation parameters
   * @returns Created session
   * @throws Error if max sessions reached
   */
  createSession(params: ACPSessionCreateParams): ACPSession {
    // Check session limit
    if (this.sessions.size >= this.options.maxSessions) {
      // Try to clean up idle sessions first
      this.cleanupIdleSessions();
      
      if (this.sessions.size >= this.options.maxSessions) {
        throw new Error(`Maximum number of sessions (${this.options.maxSessions}) reached`);
      }
    }

    const now = Date.now();
    const sessionId = this.generateSessionId();
    
    // Get TasteVault snapshot hash
    const tasteVaultSnapshotHash = this.options.tasteVaultHashFn 
      ? this.options.tasteVaultHashFn()
      : 'default-hash';

    const session: ACPSession = {
      id: sessionId,
      projectRoot: params.projectRoot,
      userId: params.userId,
      tasteVaultSnapshotHash,
      state: params.initialState ?? 'active',
      connectedAt: now,
      lastActivity: now,
      transport: params.transport,
    };

    this.sessions.set(sessionId, session);

    if (this.options.debug) {
      console.log(`[ACP SessionManager] Created session: ${sessionId}`);
    }

    return session;
  }

  /**
   * Get a session by ID
   * @param sessionId - Session ID
   * @returns Session or undefined
   */
  getSession(sessionId: string): ACPSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get or throw session by ID
   * @param sessionId - Session ID
   * @returns Session
   * @throws Error if session not found
   */
  getSessionOrThrow(sessionId: string): ACPSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Close a session
   * @param sessionId - Session ID to close
   * @returns True if session was closed, false if not found
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Update state
    session.state = 'closed';
    
    // Move to history
    this.sessionHistory.push({ session: { ...session }, closedAt: Date.now() });
    
    // Remove from active
    this.sessions.delete(sessionId);

    if (this.options.debug) {
      console.log(`[ACP SessionManager] Closed session: ${sessionId}`);
    }

    return true;
  }

  /**
   * List all active sessions
   * @returns Array of active sessions
   */
  listActiveSessions(): ACPSession[] {
    return Array.from(this.sessions.values()).filter(s => s.state !== 'closed');
  }

  /**
   * List sessions by state
   * @param state - Filter by state
   * @returns Array of matching sessions
   */
  listSessionsByState(state: ACPSessionState): ACPSession[] {
    return Array.from(this.sessions.values()).filter(s => s.state === state);
  }

  /**
   * List sessions by user
   * @param userId - User ID to filter by
   * @returns Array of matching sessions
   */
  listSessionsByUser(userId: string): ACPSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  /**
   * List sessions by project
   * @param projectRoot - Project root to filter by
   * @returns Array of matching sessions
   */
  listSessionsByProject(projectRoot: string): ACPSession[] {
    return Array.from(this.sessions.values()).filter(s => s.projectRoot === projectRoot);
  }

  /**
   * Update activity timestamp for a session
   * @param sessionId - Session ID
   * @returns Updated session or undefined
   */
  updateActivity(sessionId: string): ACPSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.lastActivity = Date.now();
    
    // Update state if it was idle
    if (session.state === 'idle') {
      session.state = 'active';
    }

    return session;
  }

  /**
   * Set session state
   * @param sessionId - Session ID
   * @param state - New state
   * @returns Updated session or undefined
   */
  setSessionState(sessionId: string, state: ACPSessionState): ACPSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.state = state;
    session.lastActivity = Date.now();

    if (this.options.debug) {
      console.log(`[ACP SessionManager] Session ${sessionId} state changed to: ${state}`);
    }

    return session;
  }

  /**
   * Check if a session is expired (idle too long)
   * @param sessionId - Session ID
   * @returns True if session is expired
   */
  isSessionExpired(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return true;
    }

    const idleTime = Date.now() - session.lastActivity;
    return idleTime > this.options.idleTimeout;
  }

  /**
   * Clean up expired/idle sessions
   * @returns Number of sessions closed
   */
  cleanupIdleSessions(): number {
    let closedCount = 0;
    const now = Date.now();

    for (const [id, session] of this.sessions) {
      const idleTime = now - session.lastActivity;
      
      if (idleTime > this.options.idleTimeout) {
        session.state = 'idle';
        
        // Mark as closed after extended idle
        if (idleTime > this.options.idleTimeout * 2) {
          this.closeSession(id);
          closedCount++;
        }
      }
    }

    if (this.options.debug && closedCount > 0) {
      console.log(`[ACP SessionManager] Cleaned up ${closedCount} idle sessions`);
    }

    return closedCount;
  }

  /**
   * Get session statistics
   * @returns Session stats
   */
  getStats(): ACPSessionStats {
    const sessions = Array.from(this.sessions.values());
    
    const byState: Record<ACPSessionState, number> = {
      active: 0,
      idle: 0,
      closed: 0,
    };

    const byTransport: Record<ACPTransportType, number> = {
      stdio: 0,
      websocket: 0,
      sse: 0,
    };

    for (const session of sessions) {
      byState[session.state]++;
      byTransport[session.transport.type]++;
    }

    // Calculate average duration for closed sessions
    let averageDuration: number | null = null;
    if (this.sessionHistory.length > 0) {
      const totalDuration = this.sessionHistory.reduce((sum, h) => {
        return sum + (h.closedAt - h.session.connectedAt);
      }, 0);
      averageDuration = totalDuration / this.sessionHistory.length;
    }

    // Find oldest active session
    let oldestActiveSession: number | null = null;
    for (const session of sessions) {
      if (session.state === 'active') {
        if (oldestActiveSession === null || session.connectedAt < oldestActiveSession) {
          oldestActiveSession = session.connectedAt;
        }
      }
    }

    return {
      total: sessions.length,
      byState,
      byTransport,
      averageDuration,
      oldestActiveSession,
    };
  }

  /**
   * Get total number of active sessions
   * @returns Session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Check if a session exists
   * @param sessionId - Session ID
   * @returns True if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Close all sessions
   * @returns Number of sessions closed
   */
  closeAllSessions(): number {
    let count = 0;
    for (const id of this.sessions.keys()) {
      this.closeSession(id);
      count++;
    }
    return count;
  }

  /**
   * Get session history
   * @param limit - Maximum number of history entries to return
   * @returns Session history
   */
  getSessionHistory(limit?: number): Array<{ session: ACPSession; closedAt: number }> {
    const history = [...this.sessionHistory];
    history.sort((a, b) => b.closedAt - a.closedAt);
    
    if (limit !== undefined && limit > 0) {
      return history.slice(0, limit);
    }
    return history;
  }

  /**
   * Clear session history
   */
  clearHistory(): void {
    this.sessionHistory.length = 0;
  }

  /**
   * Generate unique session ID
   * @returns Unique session ID
   */
  private generateSessionId(): string {
    this.sessionIdCounter++;
    return `acp-session-${Date.now()}-${this.sessionIdCounter}`;
  }
}
