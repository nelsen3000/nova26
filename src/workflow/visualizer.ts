// Workflow Visualizer - DOT/graph visualization and execution trace
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-02)

import type { Workflow, WorkflowRun } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export interface GraphvizOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  ranksep?: number;
  nodesep?: number;
  fontName?: string;
}

export interface NodeStyle {
  shape: string;
  color: string;
  fillcolor: string;
  style: string;
  fontcolor?: string;
}

export interface ExecutionTrace {
  runId: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  currentNodeId: string | null;
  durationMs: number;
}

export interface TraceNode {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  durationMs?: number;
}

export interface TraceEdge {
  source: string;
  target: string;
  traversed: boolean;
  label?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Visualizer Class
// ═══════════════════════════════════════════════════════════════════════════════

export class WorkflowVisualizer {
  private nodeStyles: Record<string, NodeStyle> = {
    trigger: {
      shape: 'circle',
      color: '#4CAF50',
      fillcolor: '#81C784',
      style: 'filled',
      fontcolor: 'white',
    },
    agent: {
      shape: 'box',
      color: '#2196F3',
      fillcolor: '#64B5F6',
      style: 'filled,rounded',
      fontcolor: 'white',
    },
    decision: {
      shape: 'diamond',
      color: '#FF9800',
      fillcolor: '#FFB74D',
      style: 'filled',
      fontcolor: 'black',
    },
    parallel: {
      shape: 'box3d',
      color: '#9C27B0',
      fillcolor: '#BA68C8',
      style: 'filled',
      fontcolor: 'white',
    },
    loop: {
      shape: 'ellipse',
      color: '#795548',
      fillcolor: '#A1887F',
      style: 'filled',
      fontcolor: 'white',
    },
    wait: {
      shape: 'ellipse',
      color: '#607D8B',
      fillcolor: '#90A4AE',
      style: 'filled',
      fontcolor: 'white',
    },
    default: {
      shape: 'box',
      color: '#757575',
      fillcolor: '#BDBDBD',
      style: 'filled',
      fontcolor: 'black',
    },
  };

  /**
   * Generate DOT format for Graphviz
   */
  toGraphviz(workflow: Workflow, options: GraphvizOptions = {}): string {
    const {
      direction = 'TB',
      ranksep = 1.0,
      nodesep = 0.5,
      fontName = 'Arial',
    } = options;

    const lines: string[] = [
      'digraph workflow {',
      `  rankdir=${direction};`,
      `  ranksep=${ranksep};`,
      `  nodesep=${nodesep};`,
      `  fontname="${fontName}";`,
      '  node [fontname="' + fontName + '"];',
      '  edge [fontname="' + fontName + '"];',
      '',
      `  label="${this.escapeLabel(workflow.name)}";`,
      '  labelloc=t;',
      '',
    ];

    // Add nodes
    for (const node of workflow.nodes) {
      const style = this.nodeStyles[node.type] ?? this.nodeStyles.default;
      lines.push(`  ${node.id} [`);
      lines.push(`    label="${this.escapeLabel(node.name)}"`);
      lines.push(`    shape=${style.shape}`);
      lines.push(`    color="${style.color}"`);
      lines.push(`    fillcolor="${style.fillcolor}"`);
      lines.push(`    style="${style.style}"`);
      if (style.fontcolor) {
        lines.push(`    fontcolor="${style.fontcolor}"`);
      }
      lines.push(`  ];`);
    }

    lines.push('');

    // Add edges
    for (const edge of workflow.edges) {
      let edgeStr = `  ${edge.source} -> ${edge.target}`;
      const attrs: string[] = [];

      if (edge.label) {
        attrs.push(`label="${this.escapeLabel(edge.label)}"`);
      }

      if (edge.condition) {
        attrs.push(`label="${this.escapeLabel(edge.condition)}"`);
        attrs.push('color="#FF9800"');
        attrs.push('fontcolor="#FF9800"');
      }

      if (attrs.length > 0) {
        edgeStr += ` [${attrs.join(', ')}]`;
      }

      lines.push(edgeStr + ';');
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate Mermaid diagram
   */
  toMermaid(workflow: Workflow): string {
    const lines: string[] = [
      'flowchart TD',
      `  %% ${workflow.name}`,
    ];

    // Add nodes with styling
    for (const node of workflow.nodes) {
      let definition: string;

      switch (node.type) {
        case 'trigger':
          definition = `(("${this.escapeMermaid(node.name)}"))`;
          break;
        case 'decision':
          definition = `{${this.escapeMermaid(node.name)}}`;
          break;
        case 'agent':
        default:
          definition = `["${this.escapeMermaid(node.name)}"]`;
          break;
      }

      lines.push(`  ${node.id}${definition}`);
    }

    lines.push('');

    // Add edges
    for (const edge of workflow.edges) {
      let edgeStr = `  ${edge.source} -->`;
      if (edge.label || edge.condition) {
        edgeStr += `|"${this.escapeMermaid(edge.label || edge.condition || '')}"|`;
      }
      edgeStr += ` ${edge.target}`;
      lines.push(edgeStr);
    }

    // Add styling
    lines.push('');
    lines.push('  %% Styling');
    lines.push('  classDef trigger fill:#4CAF50,stroke:#2E7D32,color:#fff');
    lines.push('  classDef agent fill:#2196F3,stroke:#1565C0,color:#fff');
    lines.push('  classDef decision fill:#FF9800,stroke:#E65100,color:#000');
    lines.push('');

    // Apply classes
    const triggers = workflow.nodes.filter(n => n.type === 'trigger').map(n => n.id);
    const agents = workflow.nodes.filter(n => n.type === 'agent').map(n => n.id);
    const decisions = workflow.nodes.filter(n => n.type === 'decision').map(n => n.id);

    if (triggers.length) lines.push(`  class ${triggers.join(',')} trigger;`);
    if (agents.length) lines.push(`  class ${agents.join(',')} agent;`);
    if (decisions.length) lines.push(`  class ${decisions.join(',')} decision;`);

    return lines.join('\n');
  }

  /**
   * Generate execution trace visualization
   */
  generateTrace(workflow: Workflow, run: WorkflowRun): ExecutionTrace {
    const nodes: TraceNode[] = workflow.nodes.map(node => {
      // Determine status based on run state and position
      let status: TraceNode['status'] = 'pending';

      if (run.currentNodeId === null) {
        // Run completed
        status = 'completed';
      } else if (node.id === run.currentNodeId) {
        status = run.state === 'running' ? 'running' : 'pending';
      } else {
        // Check if this node was already executed
        const nodeIndex = workflow.nodes.findIndex(n => n.id === node.id);
        const currentIndex = workflow.nodes.findIndex(n => n.id === run.currentNodeId);
        if (nodeIndex < currentIndex) {
          status = 'completed';
        }
      }

      if (run.state === 'failed') {
        status = 'failed';
      }

      return {
        id: node.id,
        name: node.name,
        type: node.type,
        status,
        startTime: run.startedAt,
      };
    });

    const edges: TraceEdge[] = workflow.edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      traversed: nodes.find(n => n.id === edge.source)?.status === 'completed',
      label: edge.label,
    }));

    const durationMs = run.completedAt
      ? run.completedAt - (run.startedAt ?? 0)
      : Date.now() - (run.startedAt ?? 0);

    return {
      runId: run.id,
      nodes,
      edges,
      currentNodeId: run.currentNodeId,
      durationMs,
    };
  }

  /**
   * Render execution trace as DOT
   */
  traceToGraphviz(trace: ExecutionTrace): string {
    const lines: string[] = [
      'digraph execution_trace {',
      '  rankdir=TB;',
      '  node [fontname="Arial"];',
      '',
    ];

    // Add nodes with status-based coloring
    for (const node of trace.nodes) {
      const color = this.getStatusColor(node.status);
      lines.push(`  ${node.id} [`);
      lines.push(`    label="${this.escapeLabel(node.name)}"`);
      lines.push(`    shape=box`);
      lines.push(`    fillcolor="${color}"`);
      lines.push(`    style="filled"`);
      lines.push(`    fontcolor="${node.status === 'pending' ? 'black' : 'white'}"`);
      lines.push(`  ];`);
    }

    lines.push('');

    // Add edges
    for (const edge of trace.edges) {
      const attrs: string[] = [];
      if (!edge.traversed) {
        attrs.push('style=dashed');
        attrs.push('color="#999"');
      }
      if (edge.label) {
        attrs.push(`label="${this.escapeLabel(edge.label)}"`);
      }

      lines.push(
        `  ${edge.source} -> ${edge.target}` +
          (attrs.length ? ` [${attrs.join(', ')}]` : '') +
          ';'
      );
    }

    // Highlight current node
    if (trace.currentNodeId) {
      lines.push('');
      lines.push(`  ${trace.currentNodeId} [penwidth=3, color="#FF5722"];`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Get color for node status
   */
  private getStatusColor(status: TraceNode['status']): string {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'running':
        return '#2196F3';
      case 'failed':
        return '#F44336';
      case 'skipped':
        return '#9E9E9E';
      case 'pending':
      default:
        return '#E0E0E0';
    }
  }

  /**
   * Escape label for DOT
   */
  private escapeLabel(label: string): string {
    return label.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * Escape text for Mermaid
   */
  private escapeMermaid(text: string): string {
    return text.replace(/"/g, '#quot;');
  }
}
