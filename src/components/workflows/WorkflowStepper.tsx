import { Check, ArrowRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { WorkflowStep, WorkflowInstance } from '@/types/workflow';

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  instance?: WorkflowInstance;
}

export function WorkflowStepper({ steps, instance }: WorkflowStepperProps) {
  const currentStep = instance?.current_step ?? 0;
  const isCompleted = instance?.status === 'completed';

  // Normalise — seed uses "step", schema uses "step_number"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = [...steps].map((s: any) => ({
    ...s,
    step_number: s.step_number ?? s.step,
  })).sort((a, b) => a.step_number - b.step_number);

  return (
    <div className="flex items-start overflow-x-auto pb-1 gap-0">
      {sorted.map((step, idx) => {
        const isDone    = isCompleted || step.step_number < currentStep;
        const isCurrent = !isCompleted && step.step_number === currentStep;
        const isPending = !isCompleted && step.step_number > currentStep;

        return (
          <div key={step.step_number} className="flex items-start shrink-0">
            {/* Step node */}
            <div className="flex flex-col items-center min-w-[96px] max-w-[120px]">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200',
                isDone    && 'border-emerald-500 bg-emerald-500 text-white shadow-sm',
                isCurrent && 'border-primary bg-primary text-white shadow-md shadow-primary/25',
                isPending && 'border-border bg-background text-muted-foreground'
              )}>
                {isDone
                  ? <Check className="h-4 w-4" strokeWidth={2.5} />
                  : <span className="text-sm font-bold">{step.step_number}</span>
                }
              </div>
              <div className="mt-2 text-center px-1">
                <p className={cn(
                  'text-xs font-medium leading-tight',
                  isDone    && 'text-emerald-600 dark:text-emerald-400',
                  isCurrent && 'text-primary',
                  isPending && 'text-muted-foreground'
                )}>
                  {step.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                  {step.assignee_role}
                </p>
              </div>
            </div>

            {/* Connector */}
            {idx < sorted.length - 1 && (
              <div className="flex items-center mt-4 mx-1">
                <div className={cn('h-0.5 w-8 transition-colors', isDone ? 'bg-emerald-500' : 'bg-border')} />
                <ArrowRight className={cn('h-3 w-3 -ml-1', isDone ? 'text-emerald-500' : 'text-border')} />
              </div>
            )}
          </div>
        );
      })}

      {isCompleted && (
        <div className="flex items-center ml-3 mt-3.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium px-3 py-1 border border-emerald-200 dark:border-emerald-800">
            <Check className="h-3 w-3" strokeWidth={2.5} /> Completed
          </span>
        </div>
      )}
    </div>
  );
}
