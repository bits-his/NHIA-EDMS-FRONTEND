import { ArrowRight, GitBranch, Timer, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WORKFLOW_CONDITION_PRESETS } from './constants';
import { cn } from '@/utils/cn';

const DEFAULT_CHAIN = [
  'Initiator',
  'Unit Head',
  'Department Head',
  'Directorate',
  'State Office',
  'Zonal Office',
  'Headquarters',
  'Archive',
];

interface WorkflowChainVisualProps {
  className?: string;
}

export function WorkflowChainVisual({ className }: WorkflowChainVisualProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 overflow-x-auto">
        <p className="text-xs font-medium text-primary mb-3 flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5" />
          Sequential approval chain (configurable)
        </p>
        <div className="flex items-center gap-1 min-w-max pb-1">
          {DEFAULT_CHAIN.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-md border border-border bg-background px-3 py-2 text-center min-w-[100px] shadow-sm">
                  <UserCheck className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
                  <span className="text-[10px] font-medium leading-tight block">{label}</span>
                </div>
                {i < DEFAULT_CHAIN.length - 1 && (
                  <span className="text-[9px] text-muted-foreground">sequential</span>
                )}
              </div>
              {i < DEFAULT_CHAIN.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mx-0.5" />
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Parallel branches, conditional routing, escalation, SLA timers, and delegation map to the workflow
          engine when this template is published.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="border-border/80">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4 text-amber-600" />
              Routing conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ul className="text-xs text-muted-foreground space-y-1.5">
              {WORKFLOW_CONDITION_PRESETS.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">·</span>
                  {c}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Engine capabilities</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-wrap gap-1.5">
            {['Sequential', 'Parallel', 'Conditional', 'Escalation', 'SLA', 'Reminders', 'Delegation'].map(
              (t) => (
                <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                  {t}
                </Badge>
              )
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-muted/20">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Visual workflow canvas</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Full node-based designer integrates with the workflow service — connect initiators, approvers, and
            parallel lanes here before publish.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="h-[140px] rounded-md border border-border bg-background p-3">
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <div className="flex-1 rounded border border-dashed border-primary/40 p-3 text-center">
                Start
              </div>
              <div className="flex-1 rounded border border-dashed border-primary/40 p-3 text-center">
                Branch A / B
              </div>
              <div className="flex-1 rounded border border-dashed border-primary/40 p-3 text-center">
                Merge & SLA
              </div>
              <div className="flex-1 rounded border border-dashed border-emerald-500/40 p-3 text-center text-emerald-800 dark:text-emerald-300">
                Complete
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
