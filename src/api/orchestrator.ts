import { orchestratorClient } from './client';
import type { DocumentSubmitRequest, DocumentSubmitResponse, OrchestratorStatusResponse } from '@/types/orchestrator';

export const orchestratorApi = {
  submitDocument: async (data: DocumentSubmitRequest): Promise<DocumentSubmitResponse> => {
    const res = await orchestratorClient.post<DocumentSubmitResponse>(
      '/orchestrate/document-submit',
      data
    );
    return res.data;
  },

  getStatus: async (documentId: string): Promise<OrchestratorStatusResponse> => {
    const res = await orchestratorClient.get<OrchestratorStatusResponse>(
      `/orchestrate/status/${documentId}`
    );
    return res.data;
  },
};
