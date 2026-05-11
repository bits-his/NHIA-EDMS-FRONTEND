import axios from 'axios';
import { workflowClient } from './client';
import type {
  WorkflowBpmnView,
  WorkflowInstance,
  WorkflowInstanceStepRow,
  WorkflowTemplateSummary,
  CreateWorkflowTemplatePayload,
  UpdateWorkflowTemplatePayload,
} from '@/types/workflow';

export type AdvanceWorkflowResponse = {
  workflow: WorkflowInstance;
  warnings?: Array<{ agent: string; error: string }>;
};

export const workflowApi = {
  /** Instantiate a workflow from a template for an existing document. */
  start: async (payload: { template_id: string; document_id: string }): Promise<WorkflowInstance> => {
    const res = await workflowClient.post<WorkflowInstance>('/workflows/start', payload);
    return res.data;
  },

  /** Move linear workflow to the next step (current assignee or reviewer/director/admin). */
  advance: async (workflowInstanceId: string): Promise<AdvanceWorkflowResponse> => {
    const res = await workflowClient.post<AdvanceWorkflowResponse>(
      `/workflows/${workflowInstanceId}/advance`
    );
    return res.data;
  },

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

  /**
   * Latest workflow instance for a document, or `null` when none exists (HTTP 404/403 from agent).
   * Avoids treating “no instance yet” as a client/network error in DevTools and React Query.
   */
  getInstanceByDocumentId: async (documentId: string): Promise<WorkflowInstance | null> => {
    try {
      const res = await workflowClient.get<WorkflowInstance>(
        `/workflows/instances/by-document/${documentId}`
      );
      return res.data;
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const status = e.response?.status;
        if (status === 404 || status === 403) return null;
      }
      throw e;
    }
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
