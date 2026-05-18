import { documentClient } from '@/api/client';
import type { ReportingHubPayload, ReportingHubQuery } from '@/types/reporting';

export type { ReportingHubQuery };

export const reportingApi = {
  getHub: async (params?: ReportingHubQuery): Promise<ReportingHubPayload> => {
    const res = await documentClient.get<ReportingHubPayload>('/documents/reporting/hub', {
      params,
    });
    return res.data;
  },

  exportCsv: async (params?: ReportingHubQuery) => {
    const response = await documentClient.get('/documents/reporting/export', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nhia-operational-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
