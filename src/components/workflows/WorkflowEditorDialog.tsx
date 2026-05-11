import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Skeleton } from '@/components/shared/Skeleton';
import { workflowApi } from '@/api/workflow';
import { QUERY_KEYS } from '@/utils/constants';
import { getErrorMessage } from '@/api/client';
import type { WorkflowStepDefinition } from '@/types/workflow';
import {
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_ASSIGNEE_ROLES,
  defaultCustomWorkflowSteps,
  templateStepsToDraft,
} from '@/utils/workflowEditor';

type StepDraft = Omit<WorkflowStepDefinition, 'step_number'>;

export interface WorkflowEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** create (default) saves a new template; edit updates an existing id */
  mode?: 'create' | 'edit';
  templateId?: string;
  /** After successful create */
  onCreated?: (templateId: string) => void;
  /** After successful edit */
  onSaved?: () => void;
}

function renumber(steps: StepDraft[]): WorkflowStepDefinition[] {
  return steps.map((s, i) => ({
    ...s,
    step_number: i + 1,
  }));
}

export function WorkflowEditorDialog({
  open,
  onOpenChange,
  mode = 'create',
  templateId,
  onCreated,
  onSaved,
}: WorkflowEditorDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit' && !!templateId;

  const [name, setName] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    defaultCustomWorkflowSteps().map(({ name: n, assignee_role, action_type }) => ({
      name: n,
      assignee_role,
      action_type,
    }))
  );

  const {
    data: existing,
    isLoading: loadingTemplate,
    isError: loadError,
    error: loadErr,
  } = useQuery({
    queryKey: QUERY_KEYS.workflowTemplate(templateId ?? ''),
    queryFn: () => workflowApi.getTemplateById(templateId!),
    enabled: open && isEdit && !!templateId,
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && existing) {
      setName(existing.name || '');
      setSteps(templateStepsToDraft(existing.steps));
      return;
    }
    if (!isEdit) {
      setName('');
      setSteps(
        defaultCustomWorkflowSteps().map(({ name: n, assignee_role, action_type }) => ({
          name: n,
          assignee_role,
          action_type,
        }))
      );
    }
  }, [open, isEdit, existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Workflow name is required');
      const payloadSteps = renumber(steps);
      for (const s of payloadSteps) {
        if (!s.name.trim()) throw new Error('Each step needs a title');
        if (!s.assignee_role || !s.action_type) throw new Error('Each step needs role and action');
      }
      if (isEdit && templateId) {
        return workflowApi.updateTemplate(templateId, { name: trimmed, steps: payloadSteps });
      }
      return workflowApi.createTemplate({ name: trimmed, steps: payloadSteps });
    },
    onSuccess: (row) => {
      toast.success(isEdit ? 'Workflow updated' : 'Custom workflow created');
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.workflowTemplates] });
      if (row?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workflowTemplate(row.id) });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workflowTemplateBpmnPreview(row.id) });
      }
      onOpenChange(false);
      if (isEdit) onSaved?.();
      else onCreated?.(row.id);
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

  const showLoadError = isEdit && loadError && open;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit workflow' : 'Create custom workflow'}</DialogTitle>
         
        </DialogHeader>

        {isEdit && loadingTemplate && open ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : showLoadError ? (
          <p className="text-sm text-destructive py-4">{getErrorMessage(loadErr)}</p>
        ) : (
          <>
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
              <Button
                type="button"
                loading={mutation.isPending}
                disabled={isEdit && loadingTemplate}
                onClick={() => mutation.mutate()}
              >
                {isEdit ? 'Save changes' : 'Save workflow'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
