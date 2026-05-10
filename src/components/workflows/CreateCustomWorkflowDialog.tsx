import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { workflowApi } from '@/api/workflow';
import { QUERY_KEYS } from '@/utils/constants';
import { getErrorMessage } from '@/api/client';
import type { WorkflowStepDefinition } from '@/types/workflow';
import {
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_ASSIGNEE_ROLES,
  defaultCustomWorkflowSteps,
} from '@/utils/workflowEditor';

type StepDraft = Omit<WorkflowStepDefinition, 'step_number'>;

interface CreateCustomWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After successful create — parent may navigate using new template id */
  onCreated?: (templateId: string) => void;
}

function renumber(steps: StepDraft[]): WorkflowStepDefinition[] {
  return steps.map((s, i) => ({
    ...s,
    step_number: i + 1,
  }));
}

export function CreateCustomWorkflowDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateCustomWorkflowDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    defaultCustomWorkflowSteps().map(({ name: n, assignee_role, action_type }) => ({
      name: n,
      assignee_role,
      action_type,
    }))
  );

  useEffect(() => {
    if (open) {
      setName('');
      setSteps(
        defaultCustomWorkflowSteps().map(({ name: n, assignee_role, action_type }) => ({
          name: n,
          assignee_role,
          action_type,
        }))
      );
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Workflow name is required');
      const payloadSteps = renumber(steps);
      for (const s of payloadSteps) {
        if (!s.name.trim()) throw new Error('Each step needs a title');
        if (!s.assignee_role || !s.action_type) throw new Error('Each step needs role and action');
      }
      return workflowApi.createTemplate({ name: trimmed, steps: payloadSteps });
    },
    onSuccess: (row) => {
      toast.success('Custom workflow created');
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.workflowTemplates] });
      onOpenChange(false);
      onCreated?.(row.id);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        name: `Step ${prev.length + 1}`,
        assignee_role: 'manager',
        action_type: 'approve',
      },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create custom workflow</DialogTitle>
          <DialogDescription>
            Define your own approval chain (linear steps). This saves a new workflow template you can use when
            creating a document — it does not replace catalogue templates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wf-name">Workflow name</Label>
            <Input
              id="wf-name"
              placeholder="e.g. Q3 procurement clearance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Steps (in order)</Label>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addStep}>
                <Plus className="h-3.5 w-3.5" /> Add step
              </Button>
            </div>

            {steps.map((step, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-muted/20 p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Step {index + 1}</span>
                  {steps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => removeStep(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Step title</Label>
                  <Input
                    value={step.name}
                    onChange={(e) => updateStep(index, { name: e.target.value })}
                    placeholder="e.g. Directorate review"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Approver role</Label>
                    <Select
                      value={step.assignee_role}
                      onValueChange={(v) => updateStep(index, { assignee_role: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKFLOW_ASSIGNEE_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Action type</Label>
                    <Select
                      value={step.action_type}
                      onValueChange={(v) => updateStep(index, { action_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Action" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKFLOW_ACTION_TYPES.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
