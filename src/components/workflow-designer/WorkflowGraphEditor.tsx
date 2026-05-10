import { memo, useCallback, useEffect, useImperativeHandle, forwardRef, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorkflowDefinition, WorkflowGraphNode } from '@/types/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function findEntryNodeId(nodes: Node[], edges: Edge[]): string {
  const targets = new Set(edges.map((e) => e.target));
  const entry = nodes.map((n) => n.id).find((id) => !targets.has(id));
  return entry ?? nodes[0]?.id ?? 'n1';
}

export function definitionToReactFlow(def: WorkflowDefinition): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = def.nodes.map((n, i) => {
    const pos = (n.metadata?.position as { x: number; y: number } | undefined) ?? {
      x: 48 + (i % 4) * 220,
      y: 48 + Math.floor(i / 4) * 160,
    };
    return {
      id: n.id,
      type: 'workflowNode',
      position: pos,
      data: {
        label: n.label ?? n.id,
        nodeType: n.type,
        assignee_role: n.assignee_role,
      },
    };
  });

  const edges: Edge[] = def.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.condition ?? undefined,
  }));

  return { nodes, edges };
}

export function reactFlowToDefinition(nodes: Node[], edges: Edge[]): WorkflowDefinition {
  const graphNodes: WorkflowGraphNode[] = nodes.map((n) => ({
    id: n.id,
    type: ((n.data?.nodeType as WorkflowGraphNode['type']) || 'approval') as WorkflowGraphNode['type'],
    label: String(n.data?.label ?? n.id),
    assignee_role: n.data?.assignee_role as string | undefined,
    metadata: { position: n.position },
  }));

  return {
    schemaVersion: 1,
    entry_node_id: findEntryNodeId(nodes, edges),
    nodes: graphNodes,
    edges: edges.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      condition:
        typeof e.label === 'string' && e.label.trim().length > 0 ? e.label : null,
    })),
  };
}

function WorkflowCanvasNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(String(data.label ?? ''));

  useEffect(() => {
    setDraftLabel(String(data.label ?? ''));
  }, [data.label]);

  const commitLabel = useCallback(() => {
    const next = draftLabel.trim() || String(data.label ?? id);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: next } } : n
      )
    );
    setEditing(false);
  }, [data.label, draftLabel, id, setNodes]);

  return (
    <div
      className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm min-w-[150px] max-w-[240px] cursor-default"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Double-click to edit stage label"
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <Badge variant="outline" className="text-[10px] uppercase tracking-wide mb-1">
        {String(data.nodeType ?? 'step')}
      </Badge>
      {editing ? (
        <Input
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitLabel();
            if (e.key === 'Escape') {
              setDraftLabel(String(data.label ?? ''));
              setEditing(false);
            }
          }}
          className="h-8 text-sm font-semibold"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="text-sm font-semibold leading-snug">{String(data.label ?? '')}</div>
      )}
      {data.assignee_role ? (
        <p className="text-[11px] text-muted-foreground mt-1 capitalize">{String(data.assignee_role)}</p>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}

const nodeTypes = { workflowNode: memo(WorkflowCanvasNode) };

export type WorkflowGraphEditorHandle = {
  getDefinition: () => WorkflowDefinition;
};

interface WorkflowGraphEditorProps {
  defaultDefinition: WorkflowDefinition;
}

export const WorkflowGraphEditor = forwardRef<WorkflowGraphEditorHandle, WorkflowGraphEditorProps>(
  function WorkflowGraphEditorInner({ defaultDefinition }, ref) {
    const initial = useMemo(() => definitionToReactFlow(defaultDefinition), [defaultDefinition]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

    useImperativeHandle(
      ref,
      () => ({
        getDefinition: () => reactFlowToDefinition(nodes, edges),
      }),
      [nodes, edges]
    );

    const onConnect = useCallback(
      (params: Connection) =>
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              id: `e_${params.source}_${params.target}_${eds.length}`,
            },
            eds
          )
        ),
      [setEdges]
    );

    const addNode = useCallback(
      (type: WorkflowGraphNode['type']) => {
        const id = `n_${crypto.randomUUID().slice(0, 8)}`;
        setNodes((nds) => [
          ...nds,
          {
            id,
            type: 'workflowNode',
            position: { x: 120 + nds.length * 12, y: 80 + nds.length * 12 },
            data: {
              label: type === 'archive' ? 'Archive' : 'New stage',
              nodeType: type,
              assignee_role: type === 'archive' ? undefined : 'reviewer',
            },
          },
        ]);
      },
      [setNodes]
    );

    return (
      <div className="h-[min(70vh,640px)] w-full rounded-xl border bg-muted/15 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          className="bg-background"
        >
          <Background gap={20} size={1} />
          <MiniMap pannable zoomable className="!bg-card border border-border rounded-md" />
          <Controls className="!bg-card !border-border !shadow-md" />
          <Panel position="top-left" className="flex flex-wrap gap-2 m-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => addNode('approval')}>
              + Approval
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addNode('condition')}>
              + Condition
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addNode('parallel')}>
              + Parallel
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addNode('notification')}>
              + Notify
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addNode('archive')}>
              + Archive
            </Button>
          </Panel>
        </ReactFlow>
      </div>
    );
  }
);

WorkflowGraphEditor.displayName = 'WorkflowGraphEditor';
