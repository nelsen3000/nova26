// KMS-05: /collaborate CLI command for CRDT Collaboration
// Commands: start, participants, changes, resolve

import {
  RealTimeCRDTOrchestrator,
  createCRDTOrchestrator,
} from '../collaboration/index.js';
import type { CRDTDocument as CRDTCoreDocument } from '../collaboration/crdt-core.js';

// ============================================================================
// Collaborate Command Handler
// ============================================================================

interface CollaborateCommandArgs {
  action: 'start' | 'participants' | 'changes' | 'resolve' | 'help';
  docId?: string;
  changeId?: string;
}

// Singleton orchestrator instance
let orchestratorInstance: RealTimeCRDTOrchestrator | null = null;
let activeDocumentId: string | null = null;

function getOrchestrator(): RealTimeCRDTOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = createCRDTOrchestrator();
  }
  return orchestratorInstance;
}

export function resetCollaborateState(): void {
  orchestratorInstance = null;
  activeDocumentId = null;
}

function parseCollaborateArgs(args: string[]): CollaborateCommandArgs {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    return { action: 'help' };
  }

  const action = args[0] as CollaborateCommandArgs['action'];
  const remainingArgs = args.slice(1);

  switch (action) {
    case 'start': {
      const docId = remainingArgs[0];
      return { action: 'start', docId };
    }
    case 'participants':
      return { action: 'participants' };
    case 'changes':
      return { action: 'changes' };
    case 'resolve': {
      const changeId = remainingArgs[0];
      return { action: 'resolve', changeId };
    }
    default:
      return { action: 'help' };
  }
}

async function handleStartCollaboration(
  orchestrator: RealTimeCRDTOrchestrator,
  docId?: string
): Promise<void> {
  if (!docId) {
    console.log('❌ Please specify a document ID. Usage: /collaborate start <doc-id>');
    return;
  }

  try {
    // Check if document exists, if not create one (the ID will be auto-generated)
    let doc = orchestrator.getDocument(docId);
    if (!doc) {
      // Create a new document — the orchestrator generates its own ID,
      // but we store the user-provided docId as the name for lookup
      doc = orchestrator.createDocument(docId);
    }

    // Join session as current user
    orchestrator.joinSession(doc.id, 'current-user');
    activeDocumentId = doc.id;

    console.log(`\n🤝 Collaboration Session Started`);
    console.log(`   Document: ${docId}`);
    console.log(`   Type: code`);
    console.log(`   Version: 1`);
    console.log(`   Participants: ${doc.peers.size}`);
    console.log(`   Status: ✅ Active\n`);
  } catch (error) {
    console.log(`❌ Failed to start collaboration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleShowParticipants(orchestrator: RealTimeCRDTOrchestrator): Promise<void> {
  if (!activeDocumentId) {
    console.log('❌ No active collaboration session. Start one with: /collaborate start <doc-id>');
    return;
  }

  try {
    const doc = orchestrator.getDocument(activeDocumentId);
    if (!doc) {
      console.log('❌ Document not found');
      return;
    }

    const participants = Array.from(doc.peers);

    console.log(`\n👥 Active Participants (${participants.length})\n`);

    if (participants.length === 0) {
      console.log('   No active participants\n');
      return;
    }

    for (const userId of participants) {
      const isCurrentUser = userId === 'current-user';
      const indicator = isCurrentUser ? '👉' : '  ';
      const youLabel = isCurrentUser ? ' (you)' : '';
      console.log(`   ${indicator} ${userId}${youLabel}`);
    }

    console.log(`\n   Document: ${doc.id}`);
    console.log();
  } catch (error) {
    console.log(`❌ Failed to get participants: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleShowChanges(orchestrator: RealTimeCRDTOrchestrator): Promise<void> {
  if (!activeDocumentId) {
    console.log('❌ No active collaboration session. Start one with: /collaborate start <doc-id>');
    return;
  }

  try {
    const doc = orchestrator.getDocument(activeDocumentId);
    if (!doc) {
      console.log('❌ Document not found');
      return;
    }

    const changes = doc.history;

    console.log(`\n📝 Recent Changes (${changes.length})\n`);

    if (changes.length === 0) {
      console.log('   No changes recorded yet\n');
      return;
    }

    // Show last 10 changes
    const recentChanges = changes.slice(-10).reverse();

    for (const op of recentChanges) {
      const shortId = op.id.slice(-8);
      console.log(`   ${op.type} | ${shortId} | ${op.peerId}`);
      console.log(`      Target: ${op.targetNodeId}`);
      console.log(`      Time: ${new Date(op.timestamp).toISOString()}`);
      if (op.payload.content !== undefined) {
        const valueStr = String(op.payload.content).slice(0, 50);
        console.log(`      Value: ${valueStr}${String(op.payload.content).length > 50 ? '...' : ''}`);
      }
      console.log();
    }

    const conflicts = orchestrator.getConflicts(activeDocumentId);
    if (conflicts.length > 0) {
      console.log(`⚠️  ${conflicts.length} conflict(s) need resolution\n`);
    }
  } catch (error) {
    console.log(`❌ Failed to get changes: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleResolveChange(
  orchestrator: RealTimeCRDTOrchestrator,
  changeId?: string
): Promise<void> {
  if (!activeDocumentId) {
    console.log('❌ No active collaboration session. Start one with: /collaborate start <doc-id>');
    return;
  }

  if (!changeId) {
    console.log('❌ Please specify a change ID. Usage: /collaborate resolve <change-id>');
    return;
  }

  try {
    orchestrator.resolveConflict(activeDocumentId, changeId, 'resolved');

    console.log(`\n✅ Conflict Resolved`);
    console.log(`   Change ID: ${changeId}`);
    console.log(`   Document: ${activeDocumentId}`);
    console.log(`   Resolution: Applied successfully\n`);
  } catch (error) {
    console.log(`❌ Failed to resolve: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function showHelp(): void {
  console.log(`
🤝 /collaborate — CRDT Collaboration Commands

Usage:
  /collaborate start <doc-id>      # Start or join a collaboration session
  /collaborate participants        # Show active participants
  /collaborate changes             # Show recent changes
  /collaborate resolve <change-id> # Resolve a conflict
  /collaborate help

Examples:
  /collaborate start doc-123       # Start collaboration on document
  /collaborate participants        # List who's editing
  /collaborate changes             # View recent edits
  /collaborate resolve change-abc  # Resolve a specific conflict

Notes:
  - Document IDs are created if they don't exist
  - Changes are tracked automatically during sessions
  - Conflicts may occur when multiple users edit simultaneously
`);
}

// ============================================================================
// Main Command Export
// ============================================================================

export async function handleCollaborateCommand(args: string[]): Promise<void> {
  const parsed = parseCollaborateArgs(args);
  const orchestrator = getOrchestrator();

  try {
    switch (parsed.action) {
      case 'start':
        await handleStartCollaboration(orchestrator, parsed.docId);
        break;
      case 'participants':
        await handleShowParticipants(orchestrator);
        break;
      case 'changes':
        await handleShowChanges(orchestrator);
        break;
      case 'resolve':
        await handleResolveChange(orchestrator, parsed.changeId);
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } finally {
    // Note: We don't reset state here to maintain session across commands
  }
}

// Command definition for slash-commands-extended.ts
export const collaborateCommand = {
  name: '/collaborate',
  description: 'CRDT Collaboration — start, participants, changes, resolve',
  usage: '/collaborate <start|participants|changes|resolve> [args]',
  handler: handleCollaborateCommand,
};
