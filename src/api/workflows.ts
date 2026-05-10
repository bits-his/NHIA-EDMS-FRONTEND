import { workflowClient } from './client';
import type {
  WorkflowTemplate,
  WorkflowInstance,
  StartWorkflowRequest,
  AdvanceWorkflowResponse,
  WorkflowDefinition,
  WorkflowTemplateVersion,
  WorkflowInstanceStepRow,
  WorkflowActionRecord,
  WorkflowTransitionRequest,
} from '@/types/workflow';

export const workflowsApi = {
  getTemplates: async (): Promise<WorkflowTemplate[]> => {
    const res = await workflowClient.get<WorkflowTemplate[]>('/workflows/templates');
    return res.data;
  },

  createTemplate: async (body: { name: string; steps: WorkflowTemplate['steps'] }): Promise<WorkflowTemplate> => {
    const res = await workflowClient.post<WorkflowTemplate>('/workflows/templates', body);
    return res.data;
  },

  updateTemplate: async (
    templateId: string,
    body: Partial<{ name: string; steps: WorkflowTemplate['steps'] }>
  ): Promise<WorkflowTemplate> => {
    const res = await workflowClient.put<WorkflowTemplate>(`/workflows/templates/${templateId}`, body);
    return res.data;
  },

  listTemplateVersions: async (templateId: string): Promise<WorkflowTemplateVersion[]> => {
    const res = await workflowClient.get<WorkflowTemplateVersion[]>(`/workflows/templates/${templateId}/versions`);
    return res.data;
  },

  createTemplateVersion: async (
    templateId: string,
    body: { definition: WorkflowDefinition; changelog?: string }
  ): Promise<WorkflowTemplateVersion> => {
    const res = await workflowClient.post<WorkflowTemplateVersion>(
      `/workflows/templates/${templateId}/versions`,
      body
    );
    return res.data;
  },

  publishTemplateVersion: async (versionId: string): Promise<WorkflowTemplateVersion> => {
    const res = await workflowClient.post<WorkflowTemplateVersion>(
      `/workflows/template-versions/${versionId}/publish`
    );
    return res.data;
  },

  start: async (data: StartWorkflowRequest): Promise<WorkflowInstance> => {
    const res = await workflowClient.post<WorkflowInstance>('/workflows/start', data);
    return res.data;
  },

  getById: async (id: string): Promise<WorkflowInstance> => {
    const res = await workflowClient.get<WorkflowInstance>(`/workflows/${id}`);
    return res.data;
  },

  listInstanceSteps: async (id: string): Promise<WorkflowInstanceStepRow[]> => {
    const res = await workflowClient.get<WorkflowInstanceStepRow[]>(`/workflows/${id}/steps`);
    return res.data;
  },

  listInstanceActions: async (id: string): Promise<WorkflowActionRecord[]> => {
    const res = await workflowClient.get<WorkflowActionRecord[]>(`/workflows/${id}/actions`);
    return res.data;
  },

  transition: async (id: string, body: WorkflowTransitionRequest): Promise<{ workflow?: WorkflowInstance }> => {
    const res = await workflowClient.post<{ workflow?: WorkflowInstance }>(`/workflows/${id}/transition`, body);
    return res.data;
  },

  advance: async (id: string): Promise<AdvanceWorkflowResponse> => {
    const res = await workflowClient.post<AdvanceWorkflowResponse>(`/workflows/${id}/advance`);
    return res.data;
  },
};
