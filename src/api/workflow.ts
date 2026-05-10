import { workflowClient } from './client';
import type {
  WorkflowBpmnView,
  WorkflowInstance,
  WorkflowInstanceStepRow,
  WorkflowTemplateSummary,
  CreateWorkflowTemplatePayload,
  UpdateWorkflowTemplatePayload,
} from '@/types/workflow';

export const workflowApi = {
  getTemplates: async (): Promise<WorkflowTemplateSummary[]> => {
    const res = await workflowClient.get<WorkflowTemplateSummary[]>('/workflows/templates');
    return res.data;
  },

  createTemplate: async (payload: CreateWorkflowTemplatePayload): Promise<WorkflowTemplateSummary> => {
    const res = await workflowClient.post<WorkflowTemplateSummary>('/workflows/templates', payload);
    return res.data;
  },

  updateTemplate: async (
    templateId: string,
    payload: UpdateWorkflowTemplatePayload
  ): Promise<WorkflowTemplateSummary> => {
    const res = await workflowClient.put<WorkflowTemplateSummary>(
      `/workflows/templates/${templateId}`,
      payload
    );
    return res.data;
  },

  getTemplateById: async (templateId: string): Promise<WorkflowTemplateSummary> => {
    const res = await workflowClient.get<WorkflowTemplateSummary>(`/workflows/templates/${templateId}`);
    return res.data;
  },

  getTemplateBpmnPreview: async (templateId: string): Promise<WorkflowBpmnView> => {
    const res = await workflowClient.get<WorkflowBpmnView>(
      `/workflows/templates/${templateId}/bpmn-preview`
    );
    return res.data;
  },

  getInstanceByDocumentId: async (documentId: string): Promise<WorkflowInstance> => {
    const res = await workflowClient.get<WorkflowInstance>(
      `/workflows/instances/by-document/${documentId}`
    );
    return res.data;
  },

  getBpmnView: async (
    workflowInstanceId: string,
    options?: { document_status?: string }
  ): Promise<WorkflowBpmnView> => {
    const res = await workflowClient.get<WorkflowBpmnView>(
      `/workflows/${workflowInstanceId}/bpmn-view`,
      {
        params:
          options?.document_status != null && options.document_status !== ''
            ? { document_status: options.document_status }
            : undefined,
      }
    );
    return res.data;
  },

  listSteps: async (workflowInstanceId: string): Promise<WorkflowInstanceStepRow[]> => {
    const res = await workflowClient.get<WorkflowInstanceStepRow[]>(
      `/workflows/${workflowInstanceId}/steps`
    );
    return res.data;
  },
};
