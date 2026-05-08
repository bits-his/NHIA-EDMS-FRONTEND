import { searchOcrClient } from './client';
import type {
  SearchRequest,
  SearchResponse,
  IndexDocumentRequest,
  OcrResponse,
} from '@/types/search';

export const searchApi = {
  search: async (data: SearchRequest): Promise<SearchResponse> => {
    const res = await searchOcrClient.post<SearchResponse>('/search', data);
    return res.data;
  },

  indexDocument: async (data: IndexDocumentRequest): Promise<void> => {
    await searchOcrClient.post('/search/index', data);
  },

  deleteIndex: async (id: string): Promise<void> => {
    await searchOcrClient.delete(`/search/index/${id}`);
  },

  ocr: async (file: File): Promise<OcrResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await searchOcrClient.post<OcrResponse>('/search/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
