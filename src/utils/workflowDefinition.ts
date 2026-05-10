import type { WorkflowDefinition, WorkflowGraphEdge, WorkflowGraphNode, WorkflowStep } from '@/types/workflow';

/** Convert legacy linear template steps into a graph definition for the visual designer & versioning API. */
export function linearStepsToDefinition(steps: WorkflowStep[]): WorkflowDefinition {
  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
  if (!sorted.length) {
    return {
      schemaVersion: 1,
      entry_node_id: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'approval',
          label: 'Approval',
          assignee_role: 'reviewer',
          metadata: { sla_hours: 48 },
        },
      ],
      edges: [],
    };
  }

  const nodes: WorkflowGraphNode[] = sorted.map((s) => ({
    id: `n${s.step_number}`,
    type: 'approval',
    label: s.name,
    assignee_role: s.assignee_role,
    metadata: { action_type: s.action_type, sla_hours: 48 },
  }));

  const edges: WorkflowGraphEdge[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    edges.push({
      id: `e${a.step_number}_${b.step_number}`,
      from: `n${a.step_number}`,
      to: `n${b.step_number}`,
    });
  }

  const last = sorted[sorted.length - 1];
  nodes.push({
    id: 'archive_end',
    type: 'archive',
    label: 'Archive',
    metadata: {},
  });
  edges.push({
    id: `e${last.step_number}_archive`,
    from: `n${last.step_number}`,
    to: 'archive_end',
  });

  return {
    schemaVersion: 1,
    entry_node_id: `n${sorted[0].step_number}`,
    nodes,
    edges,
  };
}
