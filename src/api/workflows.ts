import { workflowClient } from './client';
import type {
  WorkflowTemplate,
  WorkflowInstance,
  StartWorkflowRequest,
  AdvanceWorkflowResponse,
} from '@/types/workflow';

export const workflowsApi = {
  getTemplates: async (): Promise<WorkflowTemplate[]> => {
    const res = await workflowClient.get<WorkflowTemplate[]>('/workflows/templates');
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

  advance: async (id: string): Promise<AdvanceWorkflowResponse> => {
    const res = await workflowClient.post<AdvanceWorkflowResponse>(`/workflows/${id}/advance`);
    return res.data;
  },
};
