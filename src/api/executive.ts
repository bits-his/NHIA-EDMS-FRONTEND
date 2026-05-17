import { documentClient } from './client';
import type { Executive360Response, ExecutiveReportResponse } from '@/types/executive';
import type { PerformanceAnalyticsResponse } from '@/types/performance';

export const executiveApi = {
  get360: async (): Promise<Executive360Response> => {
    const res = await documentClient.get<Executive360Response>('/documents/executive/360');
    return res.data;
  },

  getReport: async (params: Record<string, string>): Promise<ExecutiveReportResponse> => {
    const res = await documentClient.get<ExecutiveReportResponse>('/documents/executive/report', {
      params,
    });
    return res.data;
  },

  getPerformance: async (params: Record<string, string>): Promise<PerformanceAnalyticsResponse> => {
    const res = await documentClient.get<PerformanceAnalyticsResponse>(
      '/documents/executive/performance',
      { params }
    );
    return res.data;
  },
};
