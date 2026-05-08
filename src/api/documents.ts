import { documentClient } from './client';
import type {
  Document,
  DocumentVersion,
  CreateDocumentRequest,
  CreateDocumentResponse,
  UpdateDocumentRequest,
  UpdateDocumentResponse,
} from '@/types/document';

export const documentsApi = {
  listAll: async (): Promise<Document[]> => {
    const res = await documentClient.get<Document[]>('/documents');
    return res.data;
  },

  create: async (data: CreateDocumentRequest): Promise<CreateDocumentResponse> => {
    const res = await documentClient.post<CreateDocumentResponse>('/documents', data);
    return res.data;
  },

  getById: async (id: string): Promise<Document> => {
    const res = await documentClient.get<Document>(`/documents/${id}`);
    return res.data;
  },

  update: async (id: string, data: UpdateDocumentRequest): Promise<UpdateDocumentResponse> => {
    const res = await documentClient.put<UpdateDocumentResponse>(`/documents/${id}`, data);
    return res.data;
  },

  getVersions: async (id: string): Promise<DocumentVersion[]> => {
    const res = await documentClient.get<DocumentVersion[]>(`/documents/${id}/versions`);
    return res.data;
  },

  submit: async (id: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/submit`);
    return res.data;
  },

  approve: async (id: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/approve`);
    return res.data;
  },

  reject: async (id: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/reject`);
    return res.data;
  },

  archive: async (id: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/archive`);
    return res.data;
  },
};
