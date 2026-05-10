import { useMemo } from 'react';
import type { BpmnConnection, BpmnWorkflowElement, BpmnTerminalElement, WorkflowBpmnView } from '@/types/workflow';

function paletteClasses(palette?: string): { ring: string; bg: string; text: string } {
  switch (palette) {
    case 'emerald':
      return {
        ring: 'ring-emerald-200 dark:ring-emerald-800',
        bg: 'bg-emerald-50/90 dark:bg-emerald-950/40',
        text: 'text-emerald-800 dark:text-emerald-200',
      };
    case 'rose':
      return {
        ring: 'ring-rose-200 dark:ring-rose-900',
        bg: 'bg-rose-50/90 dark:bg-rose-950/40',
        text: 'text-rose-800 dark:text-rose-200',
      };
    case 'amber':
      return {
        ring: 'ring-amber-200 dark:ring-amber-900',
        bg: 'bg-amber-50/90 dark:bg-amber-950/40',
        text: 'text-amber-900 dark:text-amber-200',
      };
    case 'blue':
      return {
        ring: 'ring-blue-200 dark:ring-blue-900',
        bg: 'bg-blue-50/90 dark:bg-blue-950/40',
        text: 'text-blue-900 dark:text-blue-100',
      };
    default:
      return {
        ring: 'ring-slate-200 dark:ring-slate-700',
        bg: 'bg-slate-50/90 dark:bg-slate-900/50',
        text: 'text-slate-800 dark:text-slate-200',
      };
  }
}

function FlowArrow({ conn }: { conn: BpmnConnection }) {
  const isLoop = conn.kind === 'loop_back' || conn.direction === 'return';
  return (
    <div
      className={`flex flex-col items-center justify-center shrink-0 px-1 ${
        isLoop ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
      }`}
      title={conn.kind}
    >
      <span className="text-lg font-medium leading-none">{conn.label ?? '→'}</span>
      {isLoop && (
        <span className="text-[10px] uppercase tracking-wide mt-0.5 text-center max-w-[4rem] leading-tight">
          Revision
        </span>
      )}
    </div>
  );
}

function TaskNode({ el }: { el: BpmnWorkflowElement }) {
  const pal = paletteClasses(el.badge?.palette);
  const active = el.phase === 'active';
  return (
    <div
      className={`relative min-w-[158px] max-w-[200px] rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm px-3 py-2.5 ${pal.bg} ring-2 ${pal.ring} transition-shadow`}
    >
      {active && (
        <span className="absolute -top-2 left-3 px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-medium shadow">
          Active
        </span>
      )}
      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 leading-snug line-clamp-3">
        {el.title}
      </p>
      {el.assignee_role && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 capitalize truncate">
          {el.assignee_role.replace(/_/g, ' ')}
        </p>
      )}
      {el.badge && (
        <p className={`text-[10px] mt-1.5 font-medium ${pal.text}`}>
          <span className="mr-1">{el.badge.symbol}</span>
          {el.badge.label}
        </p>
      )}
    </div>
  );
}

function GatewayNode({ el }: { el: BpmnWorkflowElement }) {
  const pal = paletteClasses(el.badge?.palette);
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div
        className={`w-[72px] h-[72px] rotate-45 rounded-xl border border-slate-300 dark:border-slate-600 ${pal.bg} ring-2 ${pal.ring} flex items-center justify-center shadow-sm`}
      >
        <div className="-rotate-45 text-center px-1">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Gateway
          </p>
          {el.badge && (
            <p className={`text-[10px] mt-0.5 font-semibold ${pal.text}`}>
              {el.badge.symbol} {el.badge.label}
            </p>
          )}
        </div>
      </div>
      <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 max-w-[140px] leading-snug">
        {el.title}
      </p>
      {el.decision_branches && el.decision_branches.length > 0 && (
        <ul className="text-[9px] text-slate-500 dark:text-slate-400 space-y-0.5 text-left w-full max-w-[180px]">
          {el.decision_branches.map((b) => (
            <li key={b.key}>
              <span className="mr-1">{b.symbol}</span>
              {b.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TerminalNode({ t }: { t: BpmnTerminalElement }) {
  const pal = paletteClasses(
    t.semantic === 'rejected' || t.semantic === 'cancelled'
      ? 'rose'
      : t.semantic === 'revision_loop'
        ? 'amber'
        : 'emerald'
  );
  return (
    <div
      className={`min-w-[120px] rounded-full border border-slate-200 dark:border-slate-700 px-4 py-2 ${pal.bg} ring-2 ${pal.ring} text-center`}
    >
      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1">
        <span>{t.symbol}</span>
        {t.title}
      </p>
      {t.description && (
        <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{t.description}</p>
      )}
    </div>
  );
}

export interface WorkflowFlowchartViewProps {
  view: WorkflowBpmnView;
  /** When false, omit the dashed revision loop strip even if the payload includes a loop edge */
  showRevisionLoopNote?: boolean;
}

/**
 * Read-only BPMN-style horizontal flow chart (tasks → gateway → terminal) plus legend and annotations.
 */
export function WorkflowFlowchartView({ view, showRevisionLoopNote = true }: WorkflowFlowchartViewProps) {
  const edgesBetweenElements = useMemo(() => {
    const edges: BpmnConnection[] = [];
    for (let i = 0; i < view.elements.length - 1; i++) {
      const from = view.elements[i]!;
      const to = view.elements[i + 1]!;
      const edge = view.connections.find((c) => c.from === from.id && c.to === to.id);
      if (edge) edges.push(edge);
      else
        edges.push({
          id: `placeholder-${from.id}-${to.id}`,
          from: from.id,
          to: to.id,
          kind: 'sequence_flow',
          direction: 'forward',
          label: '→',
        });
    }
    return edges;
  }, [view]);

  const edgeLastToTerminal = useMemo(() => {
    if (!view.terminal || !view.elements.length) return undefined;
    const last = view.elements[view.elements.length - 1]!;
    return view.connections.find((c) => c.from === last.id && c.to === view.terminal!.id);
  }, [view]);

  const loopConn = view.connections.find((c) => c.kind === 'loop_back');

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-gradient-to-b from-slate-50/90 to-white dark:from-slate-900/80 dark:to-slate-950 p-4 overflow-x-auto">
        <div className="flex items-start gap-0 min-w-min pb-2">
          {view.elements.map((el, idx) => {
            const edge = edgesBetweenElements[idx];
            return (
              <div key={el.id} className="flex items-center shrink-0">
                {el.kind === 'exclusive_gateway' ? <GatewayNode el={el} /> : <TaskNode el={el} />}
                {edge && <FlowArrow conn={edge} />}
              </div>
            );
          })}
          {view.terminal && (
            <>
              {edgeLastToTerminal && <FlowArrow conn={edgeLastToTerminal} />}
              <TerminalNode t={view.terminal} />
            </>
          )}
        </div>

        {showRevisionLoopNote && loopConn && (
          <div className="mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
            <span className="font-semibold">{loopConn.label}</span>
            <span>Return path to department review after correction.</span>
          </div>
        )}
      </div>

      {view.legend && (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
          {Object.entries(view.legend).map(([k, v]) => (
            <p key={k}>
              <span className="font-medium text-slate-600 dark:text-slate-300">{k}:</span> {v}
            </p>
          ))}
        </div>
      )}

      {view.annotations?.map((a) => (
        <p
          key={a.id}
          className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/30 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-900"
        >
          {a.text}
        </p>
      ))}
    </div>
  );
}
